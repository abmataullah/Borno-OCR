"""BullMQ queue consumer for PDF processing jobs.

Consumes jobs from the 'pdf-processing' and 'conversion' queues via Redis.
Downloads PDF from backend storage, runs extraction/OCR/table detection,
and reports results back via the backend API.
"""

import asyncio
import json
import logging
import os
import tempfile
import time
from typing import Any

import httpx
import redis.asyncio as aioredis

from app.routers.extract import extract_text_from_bytes
from app.routers.tables import detect_tables_from_bytes
from app.routers.ocr import ocr_from_bytes
from app.hybrid_ocr import hybrid_ocr_from_bytes, get_available_engines
from app.document_model import build_document_model_from_pdf, merge_ocr_into_model

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")
BACKEND_API_KEY = os.getenv("BACKEND_API_KEY", "")

QUEUE_PROCESSING = "pdf-processing"
QUEUE_CONVERSION = "conversion"


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(REDIS_URL, decode_responses=True)


async def _download_pdf(pdf_key: str) -> bytes:
    """Download PDF from backend storage."""
    async with httpx.AsyncClient() as client:
        url = f"{BACKEND_URL}/api/files/{pdf_key}"
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def _report_job_status(
    redis: aioredis.Redis,
    job_id: str,
    queue_name: str,
    status: str,
    progress: int = 0,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    """Update job progress in Redis for the backend to poll."""
    key = f"docflow:job:{job_id}"
    data = {
        "status": status,
        "progress": progress,
        "updatedAt": time.time(),
    }
    if result is not None:
        data["result"] = json.dumps(result)
    if error is not None:
        data["error"] = error
    await redis.hset(key, mapping=data)
    await redis.expire(key, 3600)


async def _process_pdf_job(redis: aioredis.Redis, job_id: str, data: dict) -> None:
    """Process a PDF extraction job."""
    pdf_key = data["pdfKey"]
    project_id = data["projectId"]
    options = data.get("options", {})
    run_ocr = options.get("runOcr", True)
    run_tables = options.get("runTableDetection", True)
    ocr_lang = options.get("ocrLang", "ben+eng")

    await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 10)

    pdf_bytes = await _download_pdf(pdf_key)
    await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 20)

    result: dict[str, Any] = {"projectId": project_id, "pages": []}

    # Text extraction
    try:
        extract_result = extract_text_from_bytes(pdf_bytes)
        result["textExtraction"] = extract_result
        await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 40)
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        result["textExtraction"] = {"error": str(e)}

    # Table detection
    if run_tables:
        try:
            tables_result = detect_tables_from_bytes(pdf_bytes)
            result["tables"] = tables_result
            await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 60)
        except Exception as e:
            logger.error(f"Table detection failed: {e}")
            result["tables"] = {"error": str(e)}
    else:
        await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 60)

    # OCR — use hybrid engine (PaddleOCR + Surya) for high accuracy, Tesseract fallback
    if run_ocr:
        try:
            use_hybrid = options.get("useHybridOcr", True)
            if use_hybrid:
                engines = get_available_engines()
                if engines.get("paddle") or engines.get("surya"):
                    ocr_result = hybrid_ocr_from_bytes(pdf_bytes, lang=ocr_lang)
                    result["ocr"] = ocr_result
                    result["ocrEngine"] = "hybrid"
                else:
                    ocr_result = ocr_from_bytes(pdf_bytes, lang=ocr_lang)
                    result["ocr"] = ocr_result
                    result["ocrEngine"] = "tesseract"
            else:
                ocr_result = ocr_from_bytes(pdf_bytes, lang=ocr_lang)
                result["ocr"] = ocr_result
                result["ocrEngine"] = "tesseract"
            await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 80)
        except Exception as e:
            logger.error(f"OCR failed: {e}")
            result["ocr"] = {"error": str(e)}
    else:
        await _report_job_status(redis, job_id, QUEUE_PROCESSING, "processing", 80)

    # Build advanced document model with proper text grouping
    try:
        doc_model = build_document_model_from_pdf(pdf_bytes)

        # Merge OCR results into the model (for scanned/mixed pages)
        if run_ocr and "ocr" in result and isinstance(result["ocr"], list):
            doc_model = merge_ocr_into_model(doc_model, result["ocr"])

        # Merge table detection results
        if run_tables and "tables" in result and isinstance(result["tables"], dict):
            _merge_tables_into_model(doc_model, result["tables"])

        result["documentModel"] = doc_model
    except Exception as e:
        logger.error(f"Document model building failed: {e}")
        result["documentModel"] = {"error": str(e)}

    await _report_job_status(
        redis, job_id, QUEUE_PROCESSING, "completed", 100, result=result
    )
    logger.info(f"Job {job_id} completed successfully")


def _merge_tables_into_model(model: dict, tables_result: dict) -> None:
    """Merge table detection results into the document model."""
    tables = tables_result.get("tables", [])
    for table_idx, table in enumerate(tables):
        page_idx = table.get("page", 1) - 1
        if page_idx < 0 or page_idx >= len(model["pages"]):
            continue

        page = model["pages"][page_idx]
        bbox = table.get("bbox", {"x": 50, "y": 50, "width": 500, "height": 100})

        rows_data = table.get("rows", [])
        cols_data = table.get("columns", [])
        cells_data = table.get("cells", [])

        rows = [{"id": f"row-{page_idx}-{table_idx}-{i}", "height": 30} for i in range(len(rows_data))]
        columns = [{"id": f"col-{page_idx}-{table_idx}-{i}", "width": 100} for i in range(len(cols_data))]

        cells = []
        for cell in cells_data:
            cells.append({
                "id": f"cell-{page_idx}-{table_idx}-{cell.get('row', 0)}-{cell.get('col', 0)}",
                "rowIndex": cell.get("row", 0),
                "colIndex": cell.get("col", 0),
                "rowspan": 1,
                "colspan": 1,
                "value": cell.get("text", ""),
                "style": {
                    "fontFamily": "Inter",
                    "fontSize": 12,
                    "fontWeight": 400,
                    "color": "#000000",
                    "fill": "#ffffff",
                    "alignment": "left",
                    "borderBottom": True,
                    "borderTop": True,
                    "borderLeft": True,
                    "borderRight": True,
                },
                "merged": False,
            })

        if cells:
            page["elements"].append({
                "id": f"table-{page_idx}-{table_idx}",
                "type": "table",
                "bbox": bbox,
                "transform": {"rotate": 0, "scaleX": 1, "scaleY": 1, "skewX": 0, "skewY": 0},
                "zIndex": len(page["elements"]),
                "locked": False,
                "visible": True,
                "sourceType": "extracted",
                "confidence": 0.85,
                "rows": rows,
                "columns": columns,
                "cells": cells,
                "hasFormulas": False,
                "sourceTableIndex": table_idx,
            })


async def _process_conversion_job(redis: aioredis.Redis, job_id: str, data: dict) -> None:
    """Process a conversion job (PDF -> DOCX/ODT/HTML via LibreOffice/unoserver)."""
    pdf_key = data["pdfKey"]
    target_format = data.get("targetFormat", "docx")

    await _report_job_status(redis, job_id, QUEUE_CONVERSION, "processing", 10)

    pdf_bytes = await _download_pdf(pdf_key)
    await _report_job_status(redis, job_id, QUEUE_CONVERSION, "processing", 30)

    unoserver_url = os.getenv("UNOSERVER_URL", "http://libreoffice-worker:2003")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_in:
        tmp_in.write(pdf_bytes)
        tmp_in_path = tmp_in.name

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            with open(tmp_in_path, "rb") as f:
                resp = await client.post(
                    f"{unoserver_url}/convert",
                    files={"file": f},
                    data={"convert_to": target_format},
                )
                resp.raise_for_status()
                converted_bytes = resp.content

        # Store converted file
        result_key = f"converted/{pdf_key.replace('original.pdf', '')}converted.{target_format}"
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{BACKEND_URL}/api/files/upload",
                json={"key": result_key, "contentType": "application/octet-stream"},
                content=converted_bytes,
            )

        await _report_job_status(
            redis,
            job_id,
            QUEUE_CONVERSION,
            "completed",
            100,
            result={"downloadKey": result_key, "format": target_format},
        )
        logger.info(f"Conversion job {job_id} completed")
    except Exception as e:
        logger.error(f"Conversion job {job_id} failed: {e}")
        await _report_job_status(
            redis, job_id, QUEUE_CONVERSION, "failed", 0, error=str(e)
        )
    finally:
        os.unlink(tmp_in_path)


async def _poll_and_process() -> None:
    """Poll Redis for BullMQ jobs and process them."""
    redis = await _get_redis()
    logger.info("Worker queue consumer started, polling for jobs...")

    while True:
        try:
            # Check for processing jobs
            job_data = await redis.brpop(
                f"bull:{QUEUE_PROCESSING}:wait", timeout=5
            )
            if job_data:
                _, raw = job_data
                job = json.loads(raw)
                job_id = job.get("id", "")
                data = job.get("data", {})
                logger.info(f"Received processing job {job_id}")
                try:
                    await _process_pdf_job(redis, job_id, data)
                except Exception as e:
                    logger.error(f"Job {job_id} failed: {e}")
                    await _report_job_status(
                        redis, job_id, QUEUE_PROCESSING, "failed", 0, error=str(e)
                    )

            # Also check conversion queue
            conv_data = await redis.brpop(
                f"bull:{QUEUE_CONVERSION}:wait", timeout=1
            )
            if conv_data:
                _, raw = conv_data
                job = json.loads(raw)
                job_id = job.get("id", "")
                data = job.get("data", {})
                logger.info(f"Received conversion job {job_id}")
                try:
                    await _process_conversion_job(redis, job_id, data)
                except Exception as e:
                    logger.error(f"Conversion job {job_id} failed: {e}")
                    await _report_job_status(
                        redis, job_id, QUEUE_CONVERSION, "failed", 0, error=str(e)
                    )

        except asyncio.CancelledError:
            logger.info("Worker queue consumer shutting down...")
            break
        except Exception as e:
            logger.error(f"Polling error: {e}")
            await asyncio.sleep(5)


def start_queue_consumer() -> None:
    """Start the queue consumer in a background task alongside the FastAPI app."""
    asyncio.ensure_future(_poll_and_process())
