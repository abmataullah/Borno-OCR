"""Advanced layout analysis for PDF pages.

Detects:
- Multi-column layouts (newspaper/magazine style)
- Figure/image regions (photos, charts, diagrams)
- Header and footer regions
- Page numbers
- Reading order for multi-column documents
- Text regions vs non-text regions
- Margins and content area

Uses OpenCV for line/region detection and heuristics for column splitting.
"""

import logging
import numpy as np
from PIL import Image
from typing import Any

logger = logging.getLogger(__name__)


def detect_layout_regions(img: Image.Image) -> dict[str, Any]:
    """Detect layout regions on a page image.

    Returns:
        - columns: list of column boundaries (x ranges)
        - figures: list of figure/image regions
        - header: header region bbox or None
        - footer: footer region bbox or None
        - pageNumber: page number text and bbox or None
        - margins: detected page margins
        - readingOrder: suggested reading order for text blocks
    """
    try:
        import cv2
    except ImportError:
        logger.warning("OpenCV not available for layout analysis")
        return _default_layout()

    arr = np.array(img.convert("L"))
    h, w = arr.shape

    # 1. Detect columns via vertical whitespace gaps
    columns = _detect_columns(arr, w, h)

    # 2. Detect figure/image regions (large non-text areas with varied pixel values)
    figures = _detect_figures(arr, w, h)

    # 3. Detect header region (top 10% with text)
    header = _detect_header(arr, w, h)

    # 4. Detect footer region (bottom 10% with text)
    footer, page_number = _detect_footer(arr, w, h)

    # 5. Detect margins
    margins = _detect_margins(arr, w, h)

    # 6. Compute reading order based on columns
    reading_order = _compute_reading_order(columns, header, footer, h)

    return {
        "columns": columns,
        "figures": figures,
        "header": header,
        "footer": footer,
        "pageNumber": page_number,
        "margins": margins,
        "readingOrder": reading_order,
        "pageWidth": w,
        "pageHeight": h,
    }


def _detect_columns(arr: np.ndarray, w: int, h: int) -> list[dict]:
    """Detect multi-column layout by finding vertical whitespace gaps."""
    try:
        import cv2

        # Binarize
        _, binary = cv2.threshold(arr, 200, 255, cv2.THRESH_BINARY_INV)

        # Project horizontally — sum of dark pixels per column
        col_sum = np.sum(binary > 0, axis=0)

        # Find vertical whitespace gaps (columns with very few dark pixels)
        threshold = h * 0.01  # at most 1% of height has text
        is_whitespace = col_sum < threshold

        # Find whitespace runs that are wide enough (at least 3% of page width)
        min_gap = int(w * 0.03)
        gaps = []
        start = -1
        for i, ws in enumerate(is_whitespace):
            if ws and start < 0:
                start = i
            elif not ws and start >= 0:
                gap_width = i - start
                if gap_width >= min_gap:
                    gaps.append((start, i, gap_width))
                start = -1
        if start >= 0:
            gap_width = w - start
            if gap_width >= min_gap:
                gaps.append((start, w, gap_width))

        # If we have 1+ significant gaps, it's multi-column
        # Filter: only keep gaps in the middle 80% of the page (not margins)
        content_start = int(w * 0.05)
        content_end = int(w * 0.95)
        significant_gaps = [g for g in gaps if g[0] > content_start and g[1] < content_end]

        if len(significant_gaps) == 0:
            return [{"x": 0, "width": w, "index": 0}]

        # Build column boundaries from gaps
        columns = []
        col_start = 0
        for idx, (gap_start, gap_end, _) in enumerate(significant_gaps):
            columns.append({
                "x": col_start,
                "width": gap_start - col_start,
                "index": idx,
            })
            col_start = gap_end
        columns.append({
            "x": col_start,
            "width": w - col_start,
            "index": len(columns),
        })

        return columns

    except Exception as e:
        logger.debug(f"Column detection failed: {e}")
        return [{"x": 0, "width": w, "index": 0}]


def _detect_figures(arr: np.ndarray, w: int, h: int) -> list[dict]:
    """Detect figure/image regions — large areas with continuous non-text content."""
    try:
        import cv2

        # Look for large connected components that aren't text
        _, binary = cv2.threshold(arr, 127, 255, cv2.THRESH_BINARY_INV)

        # Dilate to merge nearby pixels
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        dilated = cv2.dilate(binary, kernel, iterations=2)

        # Find contours
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        figures = []
        min_area = h * w * 0.02  # at least 2% of page

        for contour in contours:
            x, y, fw, fh = cv2.boundingRect(contour)
            area = fw * fh
            if area < min_area:
                continue

            # Check if this region has low text density (likely a figure)
            roi = arr[y:y+fh, x:x+fw]
            text_density = np.sum(roi < 128) / (fw * fh)

            # Figures have moderate pixel density (not pure white, not dense text)
            # Dense text has >15% dark pixels, figures have 5-50%
            if 0.03 < text_density < 0.65:
                # Additional check: figures tend to have high variance
                variance = float(np.std(roi))
                if variance > 30:  # Non-uniform content
                    figures.append({
                        "bbox": {
                            "x": float(x),
                            "y": float(y),
                            "width": float(fw),
                            "height": float(fh),
                        },
                        "area": float(area),
                        "type": "figure",
                    })

        # Sort by area (largest first)
        figures.sort(key=lambda f: f["area"], reverse=True)
        return figures

    except Exception as e:
        logger.debug(f"Figure detection failed: {e}")
        return []


def _detect_header(arr: np.ndarray, w: int, h: int) -> dict | None:
    """Detect header region in top 10% of page."""
    header_region = arr[:int(h * 0.1), :]
    dark_ratio = np.sum(header_region < 128) / (header_region.shape[0] * header_region.shape[1])

    if dark_ratio > 0.005:  # Has some text
        return {
            "bbox": {
                "x": 0,
                "y": 0,
                "width": float(w),
                "height": float(int(h * 0.1)),
            },
        }
    return None


def _detect_footer(arr: np.ndarray, w: int, h: int) -> tuple[dict | None, dict | None]:
    """Detect footer region and page number in bottom 10% of page."""
    footer_start = int(h * 0.9)
    footer_region = arr[footer_start:, :]
    dark_ratio = np.sum(footer_region < 128) / (footer_region.shape[0] * footer_region.shape[1])

    footer = None
    page_number = None

    if dark_ratio > 0.003:
        footer = {
            "bbox": {
                "x": 0,
                "y": float(footer_start),
                "width": float(w),
                "height": float(h - footer_start),
            },
        }

        # Try to detect page number — small text cluster at bottom center or corners
        try:
            import cv2

            _, binary = cv2.threshold(footer_region, 128, 255, cv2.THRESH_BINARY_INV)
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            # Find small text blobs in footer that could be page numbers
            for contour in contours:
                x, y, fw, fh = cv2.boundingRect(contour)
                area = fw * fh
                # Page numbers are small (10-50px height at 200 DPI)
                if 10 < fh < 50 and 5 < fw < 100:
                    # Check if it's in the center or corners of the footer
                    center_x = x + fw / 2
                    if center_x > w * 0.3 and center_x < w * 0.7:
                        # Center — likely page number
                        page_number = {
                            "bbox": {
                                "x": float(x),
                                "y": float(footer_start + y),
                                "width": float(fw),
                                "height": float(fh),
                            },
                        }
                        break
        except Exception:
            pass

    return footer, page_number


def _detect_margins(arr: np.ndarray, w: int, h: int) -> dict:
    """Detect page margins from content bounding box."""
    # Find the bounding box of all dark pixels
    rows_with_content = np.any(arr < 128, axis=1)
    cols_with_content = np.any(arr < 128, axis=0)

    if not np.any(rows_with_content) or not np.any(cols_with_content):
        return {"top": 72, "bottom": 72, "left": 72, "right": 72}

    top = int(np.argmax(rows_with_content))
    bottom = h - int(np.argmax(rows_with_content[::-1]))
    left = int(np.argmax(cols_with_content))
    right = w - int(np.argmax(cols_with_content[::-1]))

    return {
        "top": max(0, top),
        "bottom": max(0, h - bottom),
        "left": max(0, left),
        "right": max(0, w - right),
    }


def _compute_reading_order(columns: list[dict], header: dict | None, footer: dict | None, h: int) -> list[dict]:
    """Compute reading order for multi-column layouts.

    For single column: top to bottom.
    For multi-column: column by column, top to bottom within each column.
    """
    order: list[dict] = []

    # Header first
    if header:
        order.append({"region": "header", "order": 0})

    # Columns in order
    for col in columns:
        order.append({
            "region": "column",
            "index": col["index"],
            "x": col["x"],
            "width": col["width"],
            "order": len(order),
        })

    # Footer last
    if footer:
        order.append({"region": "footer", "order": len(order)})

    return order


def _default_layout() -> dict[str, Any]:
    return {
        "columns": [{"x": 0, "width": 0, "index": 0}],
        "figures": [],
        "header": None,
        "footer": None,
        "pageNumber": None,
        "margins": {"top": 72, "bottom": 72, "left": 72, "right": 72},
        "readingOrder": [],
        "pageWidth": 0,
        "pageHeight": 0,
    }


def extract_figures_from_pdf(content: bytes, dpi: int = 200) -> list[dict]:
    """Extract figure/image regions from PDF as base64-encoded images.

    Returns list of {page, bbox, imageBase64, format} for each detected figure.
    """
    import base64
    import io

    images = convert_from_bytes(content, dpi=dpi)
    results: list[dict] = []

    for page_idx, img in enumerate(images):
        layout = detect_layout_regions(img)
        for fig in layout.get("figures", []):
            bbox = fig["bbox"]
            # Crop the figure region
            cropped = img.crop((
                int(bbox["x"]),
                int(bbox["y"]),
                int(bbox["x"] + bbox["width"]),
                int(bbox["y"] + bbox["height"]),
            ))

            # Convert to base64
            buf = io.BytesIO()
            cropped.save(buf, format="PNG", optimize=True)
            img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

            results.append({
                "page": page_idx + 1,
                "bbox": bbox,
                "imageBase64": img_b64,
                "format": "png",
            })

    return results
