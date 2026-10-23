"""Hybrid OCR API router — PaddleOCR + Surya OCR for high-accuracy extraction.

Endpoints:
- POST /api/hybrid-ocr         — OCR entire PDF with hybrid engine + all enhancements
- POST /api/hybrid-ocr/page/{n} — OCR single page
- GET  /api/hybrid-ocr/engines  — Check which OCR engines are available
- POST /api/hybrid-ocr/analyze  — Full document analysis (layout, KV, classification, quality)
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
import logging

from app.hybrid_ocr import (
    hybrid_ocr_from_bytes,
    hybrid_ocr_page_from_bytes,
    get_available_engines,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class HybridOcrWord(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    confidence: float
    isLine: bool = False
    regionType: str | None = None
    originalText: str | None = None
    corrections: list[dict] = []


class HybridOcrTable(BaseModel):
    bbox: dict
    cells: list[dict]


class HybridOcrResult(BaseModel):
    page: int
    pageType: str
    text: str
    confidence: float
    words: list[HybridOcrWord] = []
    tables: list[HybridOcrTable] = []
    engine: str
    layoutRegions: list[dict] = []
    corrections: list[dict] = []
    layout: dict | None = None
    keyValues: list[dict] = []
    barcodes: list[dict] = []
    checkboxes: list[dict] = []
    documentType: dict | None = None
    quality: dict | None = None


class EngineStatus(BaseModel):
    paddle: bool
    surya: bool
    tesseract: bool


@router.get("/hybrid-ocr/engines", response_model=EngineStatus)
async def engines():
    """Check which OCR engines are available on this worker."""
    avail = get_available_engines()
    return EngineStatus(**avail)


@router.post("/hybrid-ocr", response_model=list[HybridOcrResult])
async def hybrid_ocr_pdf(
    file: UploadFile = File(...),
    lang: str = Query("ben+eng", description="Fallback Tesseract language(s)"),
    dpi: int = Query(200, description="Render DPI for OCR"),
    enable_corrections: bool = Query(True, description="Enable Bangla OCR post-correction"),
    enable_kv_extraction: bool = Query(True, description="Enable key-value field extraction"),
    enable_layout_analysis: bool = Query(True, description="Enable advanced layout analysis"),
    enable_barcodes: bool = Query(True, description="Enable barcode/QR code detection"),
    enable_classification: bool = Query(True, description="Enable document type classification"),
):
    """Run hybrid OCR on an entire PDF with full enhancement pipeline.

    Enhancement pipeline:
    1. Core OCR (PaddleOCR/Surya/Tesseract)
    2. Bangla OCR post-correction (character confusion, dictionary, spacing)
    3. Layout analysis (multi-column, figures, headers/footers, margins)
    4. Key-value extraction (form fields, invoice fields, Bangla+English)
    5. Barcode/QR code detection
    6. Checkbox detection with state (checked/unchecked)
    7. Document type classification (invoice, form, letter, receipt, etc.)
    8. OCR quality scoring with letter grade
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    try:
        results = hybrid_ocr_from_bytes(
            content,
            lang=lang,
            dpi=dpi,
            enable_corrections=enable_corrections,
            enable_kv_extraction=enable_kv_extraction,
            enable_layout_analysis=enable_layout_analysis,
            enable_barcodes=enable_barcodes,
            enable_classification=enable_classification,
        )
        return [HybridOcrResult(**r) for r in results]
    except Exception as e:
        logger.error(f"Hybrid OCR failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")


@router.post("/hybrid-ocr/page/{page_num}", response_model=HybridOcrResult)
async def hybrid_ocr_single_page(
    page_num: int,
    file: UploadFile = File(...),
    lang: str = Query("ben+eng"),
    dpi: int = Query(200),
):
    """Run hybrid OCR on a single page."""
    if page_num < 1:
        raise HTTPException(status_code=400, detail="Page number must be >= 1")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    try:
        result = hybrid_ocr_page_from_bytes(content, page_num, lang=lang, dpi=dpi)
        return HybridOcrResult(**result)
    except Exception as e:
        logger.error(f"Hybrid OCR page failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")


@router.post("/hybrid-ocr/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    lang: str = Query("ben+eng"),
    dpi: int = Query(200),
):
    """Full document analysis — returns OCR + layout + KV + classification + quality summary.

    Returns a summary report with:
    - Document type and confidence
    - Overall quality score and grade
    - Extracted key-value fields
    - Detected tables with cell data
    - Detected barcodes/QR codes
    - Layout summary (columns, figures, headers/footers)
    - Per-page quality breakdown
    - Total correction count
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    try:
        results = hybrid_ocr_from_bytes(content, lang=lang, dpi=dpi)

        # Build summary
        all_kv: list[dict] = []
        all_tables: list[dict] = []
        all_barcodes: list[dict] = []
        all_corrections: list[dict] = []
        page_qualities: list[dict] = []
        doc_types: dict[str, float] = {}

        for r in results:
            page_num = r.get("page", 0)

            for kv in r.get("keyValues", []):
                kv["page"] = page_num
                all_kv.append(kv)

            for table in r.get("tables", []):
                table["page"] = page_num
                all_tables.append(table)

            for bc in r.get("barcodes", []):
                bc["page"] = page_num
                all_barcodes.append(bc)

            for corr in r.get("corrections", []):
                corr["page"] = page_num
                all_corrections.append(corr)

            quality = r.get("quality")
            if quality:
                page_qualities.append({
                    "page": page_num,
                    "score": quality["score"],
                    "grade": quality["grade"],
                    "avgConfidence": quality["avgConfidence"],
                    "lowConfidenceWords": quality["lowConfidenceWords"],
                    "totalWords": quality["totalWords"],
                })

            doc_type = r.get("documentType")
            if doc_type:
                t = doc_type.get("type", "mixed")
                c = doc_type.get("confidence", 0)
                doc_types[t] = doc_types.get(t, 0) + c

        # Overall document type
        overall_type = max(doc_types, key=doc_types.get) if doc_types else "mixed"
        overall_confidence = doc_types.get(overall_type, 0) / max(len(results), 1)

        # Overall quality
        if page_qualities:
            avg_score = sum(pq["score"] for pq in page_qualities) / len(page_qualities)
            worst_page = min(page_qualities, key=lambda p: p["score"])
            best_page = max(page_qualities, key=lambda p: p["score"])
        else:
            avg_score = 0
            worst_page = None
            best_page = None

        # Grade
        if avg_score >= 90:
            overall_grade = "A+"
        elif avg_score >= 80:
            overall_grade = "A"
        elif avg_score >= 70:
            overall_grade = "B"
        elif avg_score >= 60:
            overall_grade = "C"
        elif avg_score >= 50:
            overall_grade = "D"
        else:
            overall_grade = "F"

        return {
            "summary": {
                "totalPages": len(results),
                "documentType": overall_type,
                "documentTypeConfidence": round(overall_confidence, 2),
                "overallQualityScore": round(avg_score, 1),
                "overallGrade": overall_grade,
                "totalKeyValues": len(all_kv),
                "totalTables": len(all_tables),
                "totalBarcodes": len(all_barcodes),
                "totalCorrections": len(all_corrections),
                "worstPage": worst_page,
                "bestPage": best_page,
            },
            "keyValues": all_kv,
            "tables": all_tables,
            "barcodes": all_barcodes,
            "pageQualities": page_qualities,
            "pages": results,
        }
    except Exception as e:
        logger.error(f"Document analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
