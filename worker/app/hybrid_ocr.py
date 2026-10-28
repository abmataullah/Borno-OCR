"""Hybrid OCR engine combining PaddleOCR and Surya OCR.

Strategy:
- PaddleOCR: Best for table/form pages (PP-Structure detects tables natively)
- Surya OCR: Best for text-heavy pages (superior reading order + layout)
- Tesseract: Fallback if both fail to load

The module auto-detects page type and routes to the best engine:
- Pages with tables/forms → PaddleOCR (PP-Structure)
- Text-heavy pages → Surya OCR
- Fallback → Tesseract (existing)

Enhanced features:
- Advanced layout analysis (multi-column, figures, headers/footers)
- Key-value extraction (form fields, invoice fields)
- Bangla OCR post-correction (character confusion, dictionary, spacing)
- Barcode/QR code detection
- Document type classification (invoice, form, letter, etc.)
- Form field detection (checkboxes)
- OCR quality scoring with grades
"""

import io
import logging
import os
from typing import Any

import numpy as np
from pdf2image import convert_from_bytes
from PIL import Image

# Import enhanced modules
from app.layout_analysis import detect_layout_regions
from app.kv_extraction import (
    extract_key_values,
    detect_checkboxes,
    detect_document_type,
)
from app.bangla_corrector import (
    correct_ocr_words,
    compute_ocr_quality_score,
)
from app.barcode_detector import detect_barcodes

logger = logging.getLogger(__name__)

# Lazy-loaded engine instances
_paddle_ocr = None
_paddle_structure = None
_surya_ocr = None
_surya_layout = None
_engines_loaded = False
_engines_available: dict[str, bool] = {
    "paddle": False,
    "surya": False,
    "tesseract": True,
}


def _load_engines() -> None:
    """Lazily load OCR engines. Called once on first use."""
    global _paddle_ocr, _paddle_structure, _surya_ocr, _surya_layout, _engines_loaded, _engines_available

    if _engines_loaded:
        return

    _engines_loaded = True

    # Try loading PaddleOCR
    try:
        from paddleocr import PaddleOCR, PPStructure

        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="bengali", show_log=False)
        _paddle_structure = PPStructure(show_log=False, lang="bengali")
        _engines_available["paddle"] = True
        logger.info("PaddleOCR loaded successfully (bengali + PP-Structure)")
    except Exception as e:
        logger.warning(f"PaddleOCR not available: {e}")
        _engines_available["paddle"] = False

    # Try loading Surya OCR
    try:
        from surya.ocr import run_ocr
        from surya.layout import batch_layout_detection as run_layout

        _surya_ocr = run_ocr
        _surya_layout = run_layout
        _engines_available["surya"] = True
        logger.info("Surya OCR loaded successfully")
    except Exception as e:
        logger.warning(f"Surya OCR not available: {e}")
        _engines_available["surya"] = False


def get_available_engines() -> dict[str, bool]:
    """Return which OCR engines are available."""
    _load_engines()
    return _engines_available.copy()


def _detect_page_type(img: Image.Image) -> str:
    """Detect if a page is table/form-heavy or text-heavy.

    Uses simple heuristics:
    - Count horizontal/vertical lines (tables have many)
    - Check whitespace ratio (forms have more whitespace)
    Returns: 'table' or 'text'
    """
    try:
        import cv2

        arr = np.array(img.convert("L"))
        h, w = arr.shape

        # Detect lines using Hough transform
        edges = cv2.Canny(arr, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80,
                                minLineLength=w // 4, maxLineGap=20)

        if lines is not None:
            horizontal = 0
            vertical = 0
            for line in lines:
                x1, y1, x2, y2 = line[0]
                angle = abs(np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi)
                if angle < 10 or angle > 170:
                    horizontal += 1
                elif 80 < angle < 100:
                    vertical += 1

            # Tables/forms typically have 3+ horizontal and 2+ vertical lines
            if horizontal >= 3 and vertical >= 2:
                return "table"

        # Check whitespace ratio — forms have >40% whitespace
        whitespace_ratio = np.sum(arr > 240) / (h * w)
        if whitespace_ratio > 0.5:
            return "table"  # likely a form with fields

    except Exception as e:
        logger.debug(f"Page type detection failed: {e}")

    return "text"


def _paddle_ocr_page(img: Image.Image) -> dict[str, Any]:
    """Run PaddleOCR on a single page image.

    Returns word-level results with bounding boxes.
    """
    arr = np.array(img.convert("RGB"))
    result = _paddle_ocr.ocr(arr, cls=True)

    words: list[dict] = []
    texts: list[str] = []
    confidences: list[float] = []

    if result and result[0]:
        for line in result[0]:
            bbox, (text, conf) = line
            if not text or conf < 0.3:
                continue

            # PaddleOCR bbox: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]
            x0 = min(p[0] for p in bbox)
            y0 = min(p[1] for p in bbox)
            x1 = max(p[0] for p in bbox)
            y1 = max(p[1] for p in bbox)

            words.append({
                "text": text,
                "x": float(x0),
                "y": float(y0),
                "width": float(x1 - x0),
                "height": float(y1 - y0),
                "confidence": round(float(conf) * 100, 2),
            })
            texts.append(text)
            confidences.append(conf)

    avg_conf = sum(confidences) / len(confidences) * 100 if confidences else 0

    return {
        "text": " ".join(texts),
        "confidence": round(avg_conf, 2),
        "words": words,
        "engine": "paddle",
    }


def _paddle_structure_page(img: Image.Image) -> dict[str, Any]:
    """Run PaddleOCR PP-Structure on a page for table detection.

    Returns table cells with bounding boxes and text.
    """
    arr = np.array(img.convert("RGB"))
    result = _paddle_structure(arr)

    tables: list[dict] = []
    words: list[dict] = []
    texts: list[str] = []

    for region in result:
        region_type = region.get("type", "")
        bbox = region.get("bbox", [0, 0, 0, 0])
        res = region.get("res", {})

        if region_type == "table":
            # Extract table HTML and cells
            html = res.get("html", "")
            cell_bbox = res.get("cell_bbox", [])

            # Parse HTML table to extract cell text
            cells = _parse_table_html(html, cell_bbox, bbox)
            tables.append({
                "bbox": {
                    "x": float(bbox[0]),
                    "y": float(bbox[1]),
                    "width": float(bbox[2] - bbox[0]),
                    "height": float(bbox[3] - bbox[1]),
                },
                "cells": cells,
            })

        elif region_type == "text":
            # Extract text words
            if isinstance(res, list):
                for line in res:
                    if isinstance(line, list) and len(line) >= 2:
                        box, (text, conf) = line[0], line[1]
                        if not text:
                            continue
                        x0 = min(p[0] for p in box)
                        y0 = min(p[1] for p in box)
                        x1 = max(p[0] for p in box)
                        y1 = max(p[1] for p in box)
                        words.append({
                            "text": text,
                            "x": float(x0),
                            "y": float(y0),
                            "width": float(x1 - x0),
                            "height": float(y1 - y0),
                            "confidence": round(float(conf) * 100, 2),
                        })
                        texts.append(text)

        elif region_type in ("figure", "title", "header", "footer"):
            # Extract text from these regions too
            if isinstance(res, list):
                for line in res:
                    if isinstance(line, list) and len(line) >= 2:
                        box, (text, conf) = line[0], line[1]
                        if not text:
                            continue
                        x0 = min(p[0] for p in box)
                        y0 = min(p[1] for p in box)
                        x1 = max(p[0] for p in box)
                        y1 = max(p[1] for p in box)
                        words.append({
                            "text": text,
                            "x": float(x0),
                            "y": float(y0),
                            "width": float(x1 - x0),
                            "height": float(y1 - y0),
                            "confidence": round(float(conf) * 100, 2),
                            "regionType": region_type,
                        })
                        texts.append(text)

    avg_conf = (
        sum(w["confidence"] for w in words) / len(words)
        if words else 0
    )

    return {
        "text": " ".join(texts),
        "confidence": round(avg_conf, 2),
        "words": words,
        "tables": tables,
        "engine": "paddle_structure",
    }


def _parse_table_html(html: str, cell_bbox: list, table_bbox: list) -> list[dict]:
    """Parse PaddleOCR table HTML to extract cell text and positions."""
    cells: list[dict] = []
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        table = soup.find("table")
        if not table:
            return cells

        rows = table.find_all("tr")
        for row_idx, tr in enumerate(rows):
            tds = tr.find_all(["td", "th"])
            for col_idx, td in enumerate(tds):
                text = td.get_text(strip=True)
                colspan = int(td.get("colspan", 1))
                rowspan = int(td.get("rowspan", 1))

                # Try to get bbox from cell_bbox list
                cell_idx = row_idx * len(tds) + col_idx
                bbox = cell_bbox[cell_idx] if cell_idx < len(cell_bbox) else table_bbox

                cells.append({
                    "row": row_idx,
                    "col": col_idx,
                    "text": text,
                    "colspan": colspan,
                    "rowspan": rowspan,
                    "isHeader": td.name == "th",
                    "bbox": {
                        "x": float(bbox[0]) if len(bbox) > 0 else 0,
                        "y": float(bbox[1]) if len(bbox) > 1 else 0,
                        "width": float(bbox[2] - bbox[0]) if len(bbox) > 2 else 0,
                        "height": float(bbox[3] - bbox[1]) if len(bbox) > 3 else 0,
                    },
                })
    except Exception as e:
        logger.debug(f"Table HTML parsing failed: {e}")

    return cells


def _surya_ocr_page(img: Image.Image) -> dict[str, Any]:
    """Run Surya OCR on a single page image.

    Returns word-level results with bounding boxes and layout information.
    """
    from surya.schema import OCRResult

    images = [img]
    langs = ["en", "bn"]  # English + Bangla

    result: OCRResult = _surya_ocr(images, langs=langs)[0]

    words: list[dict] = []
    texts: list[str] = []
    confidences: list[float] = []

    for line in result.text_lines:
        line_text = line.text
        if not line_text:
            continue

        # Surya provides line-level bboxes
        bbox = line.bbox
        x0, y0, x1, y1 = bbox[0], bbox[1], bbox[2], bbox[3]

        words.append({
            "text": line_text,
            "x": float(x0),
            "y": float(y0),
            "width": float(x1 - x0),
            "height": float(y1 - y0),
            "confidence": round(float(line.confidence) * 100, 2),
            "isLine": True,
        })
        texts.append(line_text)
        confidences.append(line.confidence)

    avg_conf = sum(confidences) / len(confidences) * 100 if confidences else 0

    return {
        "text": "\n".join(texts),
        "confidence": round(avg_conf, 2),
        "words": words,
        "engine": "surya",
    }


def _surya_layout_page(img: Image.Image) -> dict[str, Any]:
    """Run Surya layout detection on a page.

    Returns layout regions (text, table, figure, etc.) with bounding boxes.
    """
    from surya.schema import LayoutResult

    images = [img]
    result: LayoutResult = _surya_layout(images)[0]

    regions: list[dict] = []
    for box in result.boxes:
        regions.append({
            "type": box.label,
            "bbox": {
                "x": float(box.bbox[0]),
                "y": float(box.bbox[1]),
                "width": float(box.bbox[2] - box.bbox[0]),
                "height": float(box.bbox[3] - box.bbox[1]),
            },
            "confidence": float(box.confidence),
        })

    return {
        "regions": regions,
        "engine": "surya_layout",
    }


def hybrid_ocr_from_bytes(
    content: bytes,
    lang: str = "ben+eng",
    dpi: int = 200,
    enable_corrections: bool = True,
    enable_kv_extraction: bool = True,
    enable_layout_analysis: bool = True,
    enable_barcodes: bool = True,
    enable_classification: bool = True,
) -> list[dict]:
    """Run hybrid OCR on PDF bytes with full enhancement pipeline.

    For each page:
    1. Detect page type (table/form vs text-heavy)
    2. If table/form → PaddleOCR PP-Structure (native table extraction)
    3. If text-heavy → Surya OCR (better reading order)
    4. Fallback → Tesseract (existing)
    5. Post-processing:
       a. Bangla OCR correction (character confusion, dictionary, spacing)
       b. Layout analysis (columns, figures, headers/footers, margins)
       c. Key-value extraction (form fields, invoice fields)
       d. Barcode/QR code detection
       e. Checkbox detection
       f. Document type classification
       g. OCR quality scoring

    Returns list of per-page results with words, tables, and engine info.
    """
    _load_engines()

    images = convert_from_bytes(content, dpi=dpi)
    results: list[dict] = []

    for i, img in enumerate(images):
        page_type = _detect_page_type(img)
        page_result: dict[str, Any] = {"page": i + 1, "pageType": page_type}

        # --- Step 1: Core OCR ---
        if page_type == "table" and _engines_available["paddle"]:
            try:
                ocr_result = _paddle_structure_page(img)
                page_result.update(ocr_result)
                page_result["engine"] = "paddle_structure"
            except Exception as e:
                logger.error(f"PaddleOCR failed on page {i + 1}: {e}")
                if _engines_available["surya"]:
                    page_result.update(_surya_ocr_page(img))
                else:
                    page_result.update(_tesseract_fallback(img, lang))
        elif _engines_available["surya"]:
            try:
                ocr_result = _surya_ocr_page(img)
                page_result.update(ocr_result)
                if _surya_layout:
                    layout_result = _surya_layout_page(img)
                    page_result["layoutRegions"] = layout_result["regions"]
            except Exception as e:
                logger.error(f"Surya OCR failed on page {i + 1}: {e}")
                if _engines_available["paddle"]:
                    page_result.update(_paddle_ocr_page(img))
                else:
                    page_result.update(_tesseract_fallback(img, lang))
        elif _engines_available["paddle"]:
            try:
                page_result.update(_paddle_ocr_page(img))
            except Exception as e:
                logger.error(f"PaddleOCR fallback failed on page {i + 1}: {e}")
                page_result.update(_tesseract_fallback(img, lang))
        else:
            page_result.update(_tesseract_fallback(img, lang))

        # --- Step 2: Bangla OCR Post-Correction ---
        if enable_corrections and page_result.get("words"):
            try:
                corrected_words, corrections = correct_ocr_words(page_result["words"])
                page_result["words"] = corrected_words
                page_result["corrections"] = corrections
                # Update full text if corrections were made
                if corrections:
                    page_result["text"] = " ".join(w["text"] for w in corrected_words)
            except Exception as e:
                logger.debug(f"Bangla correction failed on page {i + 1}: {e}")

        # --- Step 3: Layout Analysis ---
        if enable_layout_analysis:
            try:
                layout = detect_layout_regions(img)
                page_result["layout"] = layout
            except Exception as e:
                logger.debug(f"Layout analysis failed on page {i + 1}: {e}")

        # --- Step 4: Key-Value Extraction ---
        if enable_kv_extraction and page_result.get("words"):
            try:
                kv_pairs = extract_key_values(page_result["words"])
                if kv_pairs:
                    page_result["keyValues"] = kv_pairs
            except Exception as e:
                logger.debug(f"KV extraction failed on page {i + 1}: {e}")

        # --- Step 5: Barcode/QR Detection ---
        if enable_barcodes:
            try:
                barcodes = detect_barcodes(img)
                if barcodes:
                    page_result["barcodes"] = barcodes
            except Exception as e:
                logger.debug(f"Barcode detection failed on page {i + 1}: {e}")

        # --- Step 6: Checkbox Detection ---
        try:
            checkboxes = detect_checkboxes(img)
            if checkboxes:
                page_result["checkboxes"] = checkboxes
        except Exception as e:
            logger.debug(f"Checkbox detection failed on page {i + 1}: {e}")

        # --- Step 7: Document Type Classification ---
        if enable_classification and page_result.get("words"):
            try:
                doc_type = detect_document_type(
                    page_result["words"],
                    page_result.get("tables", []),
                )
                page_result["documentType"] = doc_type
            except Exception as e:
                logger.debug(f"Document classification failed on page {i + 1}: {e}")

        # --- Step 8: OCR Quality Scoring ---
        try:
            quality = compute_ocr_quality_score(
                page_result.get("words", []),
                page_result.get("corrections", []),
            )
            page_result["quality"] = quality
        except Exception as e:
            logger.debug(f"Quality scoring failed on page {i + 1}: {e}")

        results.append(page_result)

    return results


def _tesseract_fallback(img: Image.Image, lang: str = "ben+eng") -> dict[str, Any]:
    """Tesseract OCR fallback."""
    import pytesseract

    data = pytesseract.image_to_data(
        img, lang=lang, output_type=pytesseract.Output.DICT
    )

    words: list[dict] = []
    texts: list[str] = []
    confidences: list[float] = []

    n_items = len(data["text"])
    for j in range(n_items):
        text = data["text"][j].strip()
        conf = int(data["conf"][j])
        if not text or conf < 0:
            continue

        words.append({
            "text": text,
            "x": float(data["left"][j]),
            "y": float(data["top"][j]),
            "width": float(data["width"][j]),
            "height": float(data["height"][j]),
            "confidence": float(conf),
        })
        texts.append(text)
        confidences.append(conf)

    avg_conf = sum(confidences) / len(confidences) if confidences else 0

    return {
        "text": " ".join(texts),
        "confidence": round(avg_conf, 2),
        "words": words,
        "engine": "tesseract",
    }


def hybrid_ocr_page_from_bytes(
    content: bytes,
    page_num: int,
    lang: str = "ben+eng",
    dpi: int = 200,
) -> dict:
    """Run hybrid OCR on a single page of a PDF."""
    _load_engines()

    images = convert_from_bytes(
        content, dpi=dpi, first_page=page_num, last_page=page_num
    )

    if not images:
        raise ValueError(f"Page {page_num} not found")

    img = images[0]
    page_type = _detect_page_type(img)
    result: dict[str, Any] = {"page": page_num, "pageType": page_type}

    if page_type == "table" and _engines_available["paddle"]:
        result.update(_paddle_structure_page(img))
    elif _engines_available["surya"]:
        result.update(_surya_ocr_page(img))
    elif _engines_available["paddle"]:
        result.update(_paddle_ocr_page(img))
    else:
        result.update(_tesseract_fallback(img, lang))

    return result
