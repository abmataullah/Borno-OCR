"""Barcode and QR code detection module.

Detects and decodes:
- QR codes
- Code 128, Code 39, EAN-13, EAN-8, UPC-A barcodes
- PDF417 (common on ID cards, boarding passes)

Uses pyzbar for decoding and OpenCV for detection.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

# Lazy-loaded decoder
_zbar_available = False
_zbar_loaded = False


def _load_zbar() -> bool:
    """Lazily load pyzbar library."""
    global _zbar_available, _zbar_loaded
    if _zbar_loaded:
        return _zbar_available
    _zbar_loaded = True
    try:
        from pyzbar.pyzbar import decode
        _zbar_available = True
        logger.info("pyzbar loaded successfully for barcode/QR detection")
    except ImportError:
        logger.warning("pyzbar not available — barcode/QR detection disabled")
        _zbar_available = False
    return _zbar_available


def detect_barcodes(img) -> list[dict]:
    """Detect and decode barcodes/QR codes in an image.

    Args:
        img: PIL Image

    Returns:
        List of {type, data, bbox, quality} for each detected code
    """
    if not _load_zbar():
        return []

    try:
        from pyzbar.pyzbar import decode
        import numpy as np
    except ImportError:
        return []

    results: list[dict] = []
    arr = np.array(img.convert("RGB"))

    try:
        decoded = decode(arr)
    except Exception as e:
        logger.debug(f"Barcode decode failed: {e}")
        return []

    for code in decoded:
        # code.rect gives x, y, width, height
        rect = code.rect
        bbox = {
            "x": float(rect.left),
            "y": float(rect.top),
            "width": float(rect.width),
            "height": float(rect.height),
        }

        # code.type: QRCODE, CODE128, CODE39, EAN13, EAN8, UPC, PDF417
        code_type = code.type if hasattr(code, 'type') else 'UNKNOWN'

        # code.data is bytes
        data = code.data.decode("utf-8", errors="replace") if code.data else ""

        # Quality: check if data is valid
        quality = "high" if data and len(data) > 0 else "low"

        results.append({
            "type": code_type,
            "data": data,
            "bbox": bbox,
            "quality": quality,
        })

    return results


def detect_qr_code_regions(img) -> list[dict]:
    """Detect QR code regions using OpenCV (before decoding).

    This is faster for pages that might not have QR codes.
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return []

    arr = np.array(img.convert("L"))
    h, w = arr.shape

    # QR code detection using OpenCV's QRCodeDetector
    try:
        detector = cv2.QRCodeDetector()
        data, points, _ = detector.detectAndDecode(arr)

        if points is not None:
            results: list[dict] = []
            # points shape: (1, 4, 2) — 4 corners
            pts = points[0]
            x_coords = pts[:, 0]
            y_coords = pts[:, 1]

            bbox = {
                "x": float(np.min(x_coords)),
                "y": float(np.min(y_coords)),
                "width": float(np.max(x_coords) - np.min(x_coords)),
                "height": float(np.max(y_coords) - np.min(y_coords)),
            }

            results.append({
                "type": "QRCODE",
                "data": data if data else "",
                "bbox": bbox,
                "quality": "high" if data else "medium",
            })
            return results
    except Exception as e:
        logger.debug(f"OpenCV QR detection failed: {e}")

    return []
