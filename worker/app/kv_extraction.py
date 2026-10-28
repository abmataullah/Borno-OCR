"""Key-value extraction from OCR results.

Automatically detects form fields, invoice fields, and labeled data from
OCR text. Supports both English and Bangla labels.

Detects:
- Form fields: "Name: ______", "Date: ______", etc.
- Invoice fields: "Invoice No:", "Total:", "GST:", etc.
- Bangla form fields: "নাম:", "তারিখ:", "ঠিকানা:", etc.
- Table-like key-value pairs
- Checkbox states (checked/unchecked)
"""

import logging
import re
from PIL import Image
from typing import Any

logger = logging.getLogger(__name__)

# Common field labels (English + Bangla)
FIELD_PATTERNS = {
    # Identity / Personal
    "name": [r"(?:name|নাম)\s*[:：]\s*(.+)", r"(?:full\s*name|পূর্ণ\s*নাম)\s*[:：]\s*(.+)"],
    "fatherName": [r"(?:father['']?s?\s*name|পিতার\s*নাম)\s*[:：]\s*(.+)", r"(?:father|পিতা)\s*[:：]\s*(.+)"],
    "motherName": [r"(?:mother['']?s?\s*name|মাতার\s*নাম)\s*[:：]\s*(.+)", r"(?:mother|মাতা)\s*[:：]\s*(.+)"],
    "dateOfBirth": [r"(?:date\s*of\s*birth|জন্ম\s*তারিখ|জন্ম\s*দিন)\s*[:：]\s*(.+)", r"(?:dob|d\.o\.b)\s*[:：]\s*(.+)"],
    "nationalId": [r"(?:national\s*id|nid|জাতীয়\s*পরিচয়পত্র|এনআইডি)\s*[:：]\s*(.+)"],
    "passport": [r"(?:passport\s*(?:no|number)|পাসপোর্ট\s*নম্বর)\s*[:：]\s*(.+)"],

    # Contact
    "phone": [r"(?:phone|mobile|tel|ফোন|মোবাইল)\s*[:：]\s*([\d\s\-\+()]+)"],
    "email": [r"(?:email|e-mail|ইমেইল)\s*[:：]\s*([\w\.\-]+@[\w\.\-]+)"],
    "address": [r"(?:address|ঠিকানা)\s*[:：]\s*(.+)"],

    # Dates
    "date": [r"(?:date|তারিখ)\s*[:：]\s*(.+)"],
    "issueDate": [r"(?:issue\s*date|প্রদান\s*তারিখ)\s*[:：]\s*(.+)"],
    "expiryDate": [r"(?:expiry\s*date|মেয়াদ\s*তারিখ)\s*[:：]\s*(.+)"],

    # Invoice / Financial
    "invoiceNo": [r"(?:invoice\s*(?:no|number)|চালান\s*নম্বর)\s*[:：]\s*(.+)"],
    "total": [r"(?:total\s*amount|মোট\s*টাকা|মোট)\s*[:：]\s*([\d,\.]+)"],
    "subtotal": [r"(?:sub\s*total|উপমোট)\s*[:：]\s*([\d,\.]+)"],
    "tax": [r"(?:tax|vat|gst|ট্যাক্স|ভ্যাট)\s*[:：]\s*([\d,\.]+)"],
    "discount": [r"(?:discount|ছাড়)\s*[:：]\s*([\d,\.]+)"],
    "amount": [r"(?:amount|টাকা)\s*[:：]\s*([\d,\.]+)"],
    "currency": [r"(?:currency|মুদ্রা)\s*[:：]\s*(\w+)"],

    # Organization
    "company": [r"(?:company|company\s*name|প্রতিষ্ঠান)\s*[:：]\s*(.+)"],
    "registrationNo": [r"(?:registration\s*(?:no|number)|নিবন্ধন\s*নম্বর)\s*[:：]\s*(.+)"],
    "tin": [r"(?:tin|টিআইএন)\s*[:：]\s*(.+)"],
    "bin": [r"(?:bin|বিআইএন)\s*[:：]\s*(.+)"],

    # Education
    "rollNo": [r"(?:roll\s*(?:no|number)|রোল\s*নম্বর)\s*[:：]\s*(.+)"],
    "registration": [r"(?:registration|নিবন্ধন)\s*[:：]\s*(.+)"],
    "session": [r"(?:session|সেশন)\s*[:：]\s*(.+)"],
    "gpa": [r"(?:gpa|জিপিএ)\s*[:：]\s*([\d\.]+)"],
    "result": [r"(?:result|ফলাফল)\s*[:：]\s*(.+)"],

    # Banking
    "accountNo": [r"(?:account\s*(?:no|number)|হিসাব\s*নম্বর)\s*[:：]\s*(.+)"],
    "bankName": [r"(?:bank\s*name|ব্যাংক\s*নাম)\s*[:：]\s*(.+)"],
    "branch": [r"(?:branch|শাখা)\s*[:：]\s*(.+)"],
    "swiftCode": [r"(?:swift\s*code|সুইফট\s*কোড)\s*[:：]\s*(.+)"],

    # Medical
    "patientName": [r"(?:patient\s*name|রোগীর\s*নাম)\s*[:：]\s*(.+)"],
    "diagnosis": [r"(?:diagnosis|রোগ\s*নির্ণয়)\s*[:：]\s*(.+)"],
    "bloodGroup": [r"(?:blood\s*group|রক্তের\s*গ্রুপ)\s*[:：]\s*(\w+)"],
    "prescription": [r"(?:prescription|প্রেসক্রিপশন)\s*[:：]\s*(.+)"],
}

# Bangla number pattern
BANGLA_NUMBERS = r"[\u09E6-\u09EF]"
# English number pattern
EN_NUMBERS = r"[0-9]"


def extract_key_values(ocr_words: list[dict]) -> list[dict]:
    """Extract key-value pairs from OCR words.

    Args:
        ocr_words: List of word dicts with text, x, y, width, height, confidence

    Returns:
        List of extracted fields: {key, value, confidence, bbox}
    """
    # Build text lines from words (group by Y proximity)
    lines = _group_words_into_lines(ocr_words)
    full_text = "\n".join(line["text"] for line in lines)

    results: list[dict] = []

    # Extract using regex patterns
    for field_name, patterns in FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, full_text, re.IGNORECASE | re.MULTILINE)
            if match:
                value = match.group(1).strip()
                if not value:
                    continue

                # Find the bbox of the matched text
                bbox = _find_match_bbox(lines, match.group(0))

                results.append({
                    "key": field_name,
                    "value": value,
                    "confidence": 0.85,
                    "bbox": bbox,
                    "rawMatch": match.group(0),
                })
                break  # Take first match per field

    # Also detect unlabeled key-value pairs (label: value pattern)
    kv_pairs = _detect_unlabeled_kv_pairs(lines)
    for kv in kv_pairs:
        # Don't duplicate if already found
        if not any(r["key"] == kv["key"] for r in results):
            results.append(kv)

    return results


def _group_words_into_lines(words: list[dict]) -> list[dict]:
    """Group OCR words into lines based on Y proximity."""
    if not words:
        return []

    sorted_words = sorted(words, key=lambda w: (w.get("y", 0), w.get("x", 0)))
    lines: list[dict] = []
    current_line: list[dict] = []
    current_y = -999
    y_tolerance = 10

    for w in sorted_words:
        y = w.get("y", 0)
        if abs(y - current_y) > y_tolerance:
            if current_line:
                lines.append(_build_line(current_line))
            current_line = [w]
            current_y = y
        else:
            current_line.append(w)

    if current_line:
        lines.append(_build_line(current_line))

    return lines


def _build_line(words: list[dict]) -> dict:
    """Build a line dict from words."""
    text = " ".join(w.get("text", "") for w in words)
    xs = [w.get("x", 0) for w in words]
    ys = [w.get("y", 0) for w in words]
    x_ends = [w.get("x", 0) + w.get("width", 0) for w in words]
    y_ends = [w.get("y", 0) + w.get("height", 0) for w in words]

    return {
        "text": text,
        "words": words,
        "x": min(xs) if xs else 0,
        "y": min(ys) if ys else 0,
        "width": max(x_ends) - min(xs) if xs else 0,
        "height": max(y_ends) - min(ys) if ys else 0,
    }


def _find_match_bbox(lines: list[dict], match_text: str) -> dict:
    """Find the bounding box of a matched text in lines."""
    for line in lines:
        if match_text.strip() in line["text"]:
            return {
                "x": float(line["x"]),
                "y": float(line["y"]),
                "width": float(line["width"]),
                "height": float(line["height"]),
            }
    return {"x": 0, "y": 0, "width": 0, "height": 0}


def _detect_unlabeled_kv_pairs(lines: list[dict]) -> list[dict]:
    """Detect key-value pairs without known labels (label: value pattern)."""
    results: list[dict] = []

    for line in lines:
        text = line["text"]
        # Match "Label: value" or "Label：value" (both colon types)
        match = re.match(r"^(.+?)\s*[:：]\s*(.+)$", text)
        if match:
            key = match.group(1).strip()
            value = match.group(2).strip()

            # Filter out very short keys or values
            if len(key) < 2 or len(value) < 1:
                continue

            # Normalize key to camelCase
            normalized_key = _normalize_key(key)

            results.append({
                "key": normalized_key,
                "value": value,
                "confidence": 0.75,
                "bbox": {
                    "x": float(line["x"]),
                    "y": float(line["y"]),
                    "width": float(line["width"]),
                    "height": float(line["height"]),
                },
                "rawMatch": text,
            })

    return results


def _normalize_key(key: str) -> str:
    """Normalize a key string to camelCase."""
    # Remove special chars and split
    words = re.sub(r"[^\w\s]", "", key).split()
    if not words:
        return key.lower()
    # camelCase
    result = words[0].lower()
    for w in words[1:]:
        result += w.capitalize()
    return result


def detect_checkboxes(img: Image.Image) -> list[dict]:
    """Detect checkboxes in a page image and their state (checked/unchecked).

    Uses OpenCV to find small square/rectangular shapes and determine if
    they contain a mark (✓, ✗, X, ●, ■).
    """
    try:
        import cv2
        import numpy as np
    except ImportError:
        return []

    arr = np.array(img.convert("L"))
    h, w = arr.shape

    # Look for small square shapes
    _, binary = cv2.threshold(arr, 127, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    checkboxes: list[dict] = []

    for contour in contours:
        x, y, cw, ch = cv2.boundingRect(contour)
        area = cv2.contourArea(contour)

        # Checkbox heuristics:
        # - Small (15-60px at 200 DPI)
        # - Roughly square (aspect ratio 0.7-1.3)
        # - Not too small, not too large
        if 15 < cw < 60 and 15 < ch < 60:
            aspect = cw / ch
            if 0.7 < aspect < 1.3:
                # Check if it's a hollow rectangle (checkbox border)
                roi = binary[y:y+ch, x:x+cw]
                border_pixels = (
                    np.sum(roi[0, :] > 0) + np.sum(roi[-1, :] > 0) +
                    np.sum(roi[:, 0] > 0) + np.sum(roi[:, -1] > 0)
                )
                total_border = 2 * (cw + ch)
                border_ratio = border_pixels / total_border if total_border > 0 else 0

                if border_ratio > 0.5:  # Has a clear border
                    # Check if filled (checked) or empty (unchecked)
                    inner = roi[3:-3, 3:-3]
                    fill_ratio = np.sum(inner > 0) / (inner.shape[0] * inner.shape[1]) if inner.size > 0 else 0

                    is_checked = fill_ratio > 0.15

                    checkboxes.append({
                        "bbox": {
                            "x": float(x),
                            "y": float(y),
                            "width": float(cw),
                            "height": float(ch),
                        },
                        "checked": is_checked,
                        "fillRatio": float(fill_ratio),
                    })

    return checkboxes


def detect_document_type(ocr_words: list[dict], tables: list[dict] = None) -> dict:
    """Classify document type based on OCR content and structure.

    Types: invoice, receipt, form, letter, table, report, certificate, id_card, mixed
    """
    if tables is None:
        tables = []

    lines = _group_words_into_lines(ocr_words)
    full_text = " ".join(line["text"] for line in lines).lower()

    scores: dict[str, float] = {
        "invoice": 0.0,
        "receipt": 0.0,
        "form": 0.0,
        "letter": 0.0,
        "table": 0.0,
        "report": 0.0,
        "certificate": 0.0,
        "id_card": 0.0,
        "mixed": 0.0,
    }

    # Invoice indicators
    invoice_keywords = ["invoice", "bill to", "subtotal", "total due", "payment terms",
                        "চালান", "বিল", "মোট", "প্রদেয়", "ভ্যাট"]
    for kw in invoice_keywords:
        if kw in full_text:
            scores["invoice"] += 0.2

    # Receipt indicators
    receipt_keywords = ["receipt", "paid", "change", "cashier", "transaction",
                        "রসিদ", "প্রদান", "হস্তান্তর"]
    for kw in receipt_keywords:
        if kw in full_text:
            scores["receipt"] += 0.2

    # Form indicators
    form_keywords = ["form", "fill", "submit", "field", "checkbox",
                     "ফরম", "পূরণ", "জমা", "টিক চিহ্ন"]
    for kw in form_keywords:
        if kw in full_text:
            scores["form"] += 0.2

    # Letter indicators
    letter_keywords = ["dear", "sincerely", "regards", "subject", "to whom",
                       "প্রিয়", "বিনীত", "বিষয়", "শুভেচ্ছা"]
    for kw in letter_keywords:
        if kw in full_text:
            scores["letter"] += 0.2

    # Table indicators (many tables, little text)
    if tables and len(tables) > 0:
        text_len = len(full_text)
        if text_len < 200:
            scores["table"] += 0.4
        else:
            scores["table"] += 0.15

    # Report indicators
    report_keywords = ["report", "analysis", "summary", "conclusion", "findings",
                       "প্রতিবেদন", "বিশ্লেষণ", "সারসংক্ষেপ", "উপসংহার"]
    for kw in report_keywords:
        if kw in full_text:
            scores["report"] += 0.2

    # Certificate indicators
    cert_keywords = ["certificate", "certified", "awarded", "this is to certify",
                     "সনদপত্র", "প্রত্যয়িত", "প্রদান করা হলো"]
    for kw in cert_keywords:
        if kw in full_text:
            scores["certificate"] += 0.25

    # ID card indicators
    id_keywords = ["identity", "id card", "passport", "license", "national",
                   "পরিচয়পত্র", "লাইসেন্স", "জাতীয়"]
    for kw in id_keywords:
        if kw in full_text:
            scores["id_card"] += 0.2

    # Small text + specific layout = ID card
    if len(ocr_words) < 50:
        scores["id_card"] += 0.15

    # Mixed: multiple types have similar scores
    top_scores = sorted(scores.values(), reverse=True)
    if len(top_scores) >= 2 and top_scores[0] > 0 and top_scores[1] > 0:
        if top_scores[0] - top_scores[1] < 0.2:
            scores["mixed"] += 0.3

    # Pick highest scoring type
    best_type = max(scores, key=scores.get)
    confidence = min(scores[best_type], 1.0)

    if confidence < 0.1:
        best_type = "mixed"
        confidence = 0.5

    return {
        "type": best_type,
        "confidence": round(confidence, 2),
        "scores": {k: round(v, 2) for k, v in scores.items()},
    }
