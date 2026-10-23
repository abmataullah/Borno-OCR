"""Advanced document model builder.

Groups extracted characters into runs → lines → paragraphs → blocks,
classifies pages as digital/scanned/mixed, and matches/substitutes fonts.
"""

import logging
import re
import uuid
from typing import Any

import pdfplumber

logger = logging.getLogger(__name__)

# Font substitution map: PDF font name → bundled font info
FONT_SUBSTITUTIONS = {
    # Bengali fonts
    "noto sans bengali": {"id": "noto-sans-bengali-regular", "family": "Noto Sans Bengali", "weight": 400},
    "noto sans bengali bold": {"id": "noto-sans-bengali-bold", "family": "Noto Sans Bengali", "weight": 700},
    "noto serif bengali": {"id": "noto-serif-bengali-regular", "family": "Noto Serif Bengali", "weight": 400},
    "siyam rupali": {"id": "siyam-rupali-regular", "family": "Siyam Rupali", "weight": 400},
    "kalpurush": {"id": "kalpurush-regular", "family": "Kalpurush", "weight": 400},
    "solaimanlipi": {"id": "solaiman-lipi-regular", "family": "SolaimanLipi", "weight": 400},
    "solaiman lipi": {"id": "solaiman-lipi-regular", "family": "SolaimanLipi", "weight": 400},
    # Latin fonts
    "inter": {"id": "inter-regular", "family": "Inter", "weight": 400},
    "inter bold": {"id": "inter-bold", "family": "Inter", "weight": 700},
    "arial": {"id": "inter-regular", "family": "Inter", "weight": 400},
    "helvetica": {"id": "inter-regular", "family": "Inter", "weight": 400},
    "helvetica-bold": {"id": "inter-bold", "family": "Inter", "weight": 700},
    "times": {"id": "inter-regular", "family": "Inter", "weight": 400},
    "times-roman": {"id": "inter-regular", "family": "Inter", "weight": 400},
    "courier": {"id": "inter-regular", "family": "Inter", "weight": 400},
}

# Bengali Unicode range for script detection
BENGALI_RANGE = re.compile(r"[\u0980-\u09FF]")
ARABIC_RANGE = re.compile(r"[\u0600-\u06FF]")
DEVANAGARI_RANGE = re.compile(r"[\u0900-\u097F]")


def detect_script(text: str) -> str:
    """Detect the primary script of a text string."""
    if BENGALI_RANGE.search(text):
        return "bengali"
    if ARABIC_RANGE.search(text):
        return "arabic"
    if DEVANAGARI_RANGE.search(text):
        return "devanagari"
    return "latin"


def detect_language(text: str) -> str:
    """Detect BCP-47 language tag from text."""
    script = detect_script(text)
    if script == "bengali":
        return "bn"
    if script == "arabic":
        return "ar"
    if script == "devanagari":
        return "hi"
    return "en"


def match_font(fontname: str | None, size: float | None, text: str) -> dict:
    """Match a PDF font to a bundled font, with substitution logic."""
    script = detect_script(text)

    if fontname:
        # Normalize: lowercase, remove subset prefix (e.g., "ABCDEF+NotoSansBengali")
        clean = fontname.split("+")[-1].lower().replace("-", " ").replace("_", " ")

        # Try exact match (also try without spaces for camelCase names)
        clean_nospace = clean.replace(" ", "")
        for key, info in FONT_SUBSTITUTIONS.items():
            if key in clean or key.replace(" ", "") in clean_nospace:
                is_bold = "bold" in clean or "black" in clean or "heavy" in clean
                is_italic = "italic" in clean or "oblique" in clean
                return {
                    "id": info["id"] if not is_bold else info.get("id", info["id"]).replace("regular", "bold"),
                    "family": info["family"],
                    "subfamily": "Bold" if is_bold else ("Italic" if is_italic else "Regular"),
                    "source": "embedded" if not fontname.startswith("/") else "system",
                    "originalFontName": fontname,
                    "weight": 700 if is_bold else info["weight"],
                    "isItalic": is_italic,
                    "license": "SIL OFL 1.1",
                    "embeddable": True,
                    "supportsScripts": [script, "latin"] if script != "latin" else ["latin"],
                }

    # Font substitution based on script
    if script == "bengali":
        return {
            "id": "noto-sans-bengali-regular",
            "family": "Noto Sans Bengali",
            "subfamily": "Regular",
            "source": "substituted",
            "originalFontName": fontname,
            "substitutedFrom": fontname or "unknown",
            "weight": 400,
            "isItalic": False,
            "license": "SIL OFL 1.1",
            "embeddable": True,
            "supportsScripts": ["bengali", "latin"],
        }

    # Default to Inter for Latin
    return {
        "id": "inter-regular",
        "family": "Inter",
        "subfamily": "Regular",
        "source": "substituted",
        "originalFontName": fontname,
        "substitutedFrom": fontname or "unknown",
        "weight": 400,
        "isItalic": False,
        "license": "SIL OFL 1.1",
        "embeddable": True,
        "supportsScripts": ["latin"],
    }


def _char_key(char: dict) -> tuple:
    """Create a grouping key for characters with same font/size/color."""
    return (
        char.get("fontname", ""),
        round(char.get("size", 12), 1),
        char.get("non_stroking_color", None),
    )


def _group_chars_into_runs(chars: list[dict]) -> list[dict]:
    """Group characters into runs (same font, size, color, adjacent position)."""
    if not chars:
        return []

    runs = []
    current_chars = [chars[0]]
    current_key = _char_key(chars[0])

    for i in range(1, len(chars)):
        char = chars[i]
        char_key = _char_key(char)

        # Check if char is adjacent to previous (within reasonable gap)
        prev = current_chars[-1]
        gap = char["x0"] - prev["x1"]
        line_gap = abs(char["top"] - prev["top"])

        if char_key == current_key and gap < prev.get("size", 12) * 0.5 and line_gap < 2:
            current_chars.append(char)
        else:
            runs.append(_make_run(current_chars))
            current_chars = [char]
            current_key = char_key

    runs.append(_make_run(current_chars))
    return runs


def _make_run(chars: list[dict]) -> dict:
    """Create a run dict from a list of characters."""
    text = "".join(c["text"] for c in chars)
    font_info = match_font(
        chars[0].get("fontname"),
        chars[0].get("size"),
        text,
    )
    return {
        "text": text,
        "fontId": font_info["id"],
        "fontFamily": font_info["family"],
        "fontSize": round(chars[0].get("size", 12), 1),
        "fontWeight": font_info["weight"],
        "fontStyle": "italic" if font_info["isItalic"] else "normal",
        "color": _color_to_hex(chars[0].get("non_stroking_color")),
        "opacity": 1.0,
        "underline": False,
        "strikethrough": False,
        "language": detect_language(text),
        "bbox": {
            "x": round(min(c["x0"] for c in chars), 2),
            "y": round(min(c["top"] for c in chars), 2),
            "width": round(max(c["x1"] for c in chars) - min(c["x0"] for c in chars), 2),
            "height": round(max(c["bottom"] for c in chars) - min(c["top"] for c in chars), 2),
        },
        "fontInfo": font_info,
    }


def _color_to_hex(color: Any) -> str:
    """Convert pdfplumber color to hex string."""
    if color is None:
        return "#000000"
    if isinstance(color, (list, tuple)):
        if len(color) >= 3:
            r, g, b = round(color[0] * 255), round(color[1] * 255), round(color[2] * 255)
            return f"#{r:02x}{g:02x}{b:02x}"
    if isinstance(color, (int, float)):
        v = round(color * 255)
        return f"#{v:02x}{v:02x}{v:02x}"
    return "#000000"


def _group_runs_into_lines(runs: list[dict], line_threshold: float = 3.0) -> list[list[dict]]:
    """Group runs into lines based on y-position proximity."""
    if not runs:
        return []

    lines = []
    current_line = [runs[0]]
    current_y = runs[0]["bbox"]["y"]

    for i in range(1, len(runs)):
        run = runs[i]
        run_y = run["bbox"]["y"]

        if abs(run_y - current_y) <= line_threshold:
            current_line.append(run)
        else:
            lines.append(current_line)
            current_line = [run]
            current_y = run_y

    lines.append(current_line)
    return lines


def _group_lines_into_paragraphs(
    lines: list[list[dict]], para_gap_ratio: float = 1.5
) -> list[list[list[dict]]]:
    """Group lines into paragraphs based on vertical spacing."""
    if not lines:
        return []

    paragraphs = []
    current_para = [lines[0]]

    for i in range(1, len(lines)):
        prev_line = lines[i - 1]
        curr_line = lines[i]

        prev_bottom = max(r["bbox"]["y"] + r["bbox"]["height"] for r in prev_line)
        curr_top = min(r["bbox"]["y"] for r in curr_line)
        gap = curr_top - prev_bottom

        avg_height = sum(r["bbox"]["height"] for r in prev_line) / len(prev_line)

        if gap > avg_height * para_gap_ratio:
            paragraphs.append(current_para)
            current_para = [curr_line]
        else:
            current_para.append(curr_line)

    paragraphs.append(current_para)
    return paragraphs


def _group_paragraphs_into_blocks(
    paragraphs: list[list[list[dict]]], block_gap_ratio: float = 2.5
) -> list[list[list[list[dict]]]]:
    """Group paragraphs into blocks based on larger vertical spacing or column breaks."""
    if not paragraphs:
        return []

    blocks = []
    current_block = [paragraphs[0]]

    for i in range(1, len(paragraphs)):
        prev_para = paragraphs[i - 1]
        curr_para = paragraphs[i]

        prev_bottom = max(
            r["bbox"]["y"] + r["bbox"]["height"]
            for line in prev_para
            for r in line
        )
        curr_top = min(r["bbox"]["y"] for line in curr_para for r in line)
        gap = curr_top - prev_bottom

        avg_height = sum(r["bbox"]["height"] for line in prev_para for r in line) / max(
            len([r for line in prev_para for r in line]), 1
        )

        # Also check horizontal overlap (column detection)
        prev_x_range = (
            min(r["bbox"]["x"] for line in prev_para for r in line),
            max(r["bbox"]["x"] + r["bbox"]["width"] for line in prev_para for r in line),
        )
        curr_x_range = (
            min(r["bbox"]["x"] for line in curr_para for r in line),
            max(r["bbox"]["x"] + r["bbox"]["width"] for line in curr_para for r in line),
        )

        horizontal_overlap = not (
            curr_x_range[0] > prev_x_range[1] or curr_x_range[1] < prev_x_range[0]
        )

        if gap > avg_height * block_gap_ratio or not horizontal_overlap:
            blocks.append(current_block)
            current_block = [curr_para]
        else:
            current_block.append(curr_para)

    blocks.append(current_block)
    return blocks


def _block_to_text_block(block: list[list[list[dict]]], block_idx: int) -> dict:
    """Convert a block (paragraphs of lines of runs) into a TextBlock element."""
    all_runs_flat = [r for para in block for line in para for r in line]

    if not all_runs_flat:
        return {}

    bbox = {
        "x": round(min(r["bbox"]["x"] for r in all_runs_flat), 2),
        "y": round(min(r["bbox"]["y"] for r in all_runs_flat), 2),
        "width": round(
            max(r["bbox"]["x"] + r["bbox"]["width"] for r in all_runs_flat)
            - min(r["bbox"]["x"] for r in all_runs_flat),
            2,
        ),
        "height": round(
            max(r["bbox"]["y"] + r["bbox"]["height"] for r in all_runs_flat)
            - min(r["bbox"]["y"] for r in all_runs_flat),
            2,
        ),
    }

    paragraphs = []
    for para_idx, para in enumerate(block):
        runs = []
        for line in para:
            for run in line:
                runs.append({
                    "text": run["text"],
                    "fontId": run["fontId"],
                    "fontSize": run["fontSize"],
                    "fontWeight": run["fontWeight"],
                    "fontStyle": run["fontStyle"],
                    "color": run["color"],
                    "opacity": run["opacity"],
                    "underline": run["underline"],
                    "strikethrough": run["strikethrough"],
                    "language": run["language"],
                })

        # Determine paragraph alignment (simple heuristic)
        if para:
            first_line = para[0]
            last_line = para[-1] if len(para) > 1 else para[0]
            page_width = 612  # Default US Letter width
            first_x = first_line[0]["bbox"]["x"] if first_line else 0
            last_end = max(r["bbox"]["x"] + r["bbox"]["width"] for r in last_line) if last_line else 0

            if first_x > page_width * 0.35:
                alignment = "center" if abs(first_x - (page_width - last_end) / 2 - first_x) < 20 else "right"
            elif last_end < page_width * 0.6:
                alignment = "left"
            else:
                alignment = "justify"
        else:
            alignment = "left"

        # Detect direction from first run
        direction = "ltr"
        if runs and runs[0].get("language") in ("ar", "he"):
            direction = "rtl"

        paragraphs.append({
            "id": f"para-{block_idx}-{para_idx}",
            "runs": runs,
            "alignment": alignment,
            "direction": direction,
            "lineHeight": 1.2,
            "spaceBefore": 0,
            "spaceAfter": 8,
            "indent": 0,
        })

    # Collect font references
    fonts = {}
    for r in all_runs_flat:
        fi = r.get("fontInfo", {})
        if fi.get("id"):
            fonts[fi["id"]] = fi

    # Determine primary language
    languages = [r["language"] for r in all_runs_flat]
    primary_lang = max(set(languages), key=languages.count) if languages else "en"

    return {
        "id": f"text-{block_idx}",
        "type": "text",
        "bbox": bbox,
        "transform": {"rotate": 0, "scaleX": 1, "scaleY": 1, "skewX": 0, "skewY": 0},
        "zIndex": block_idx,
        "locked": False,
        "visible": True,
        "sourceType": "extracted",
        "confidence": 0.95,
        "paragraphs": paragraphs,
        "style": {
            "fontId": all_runs_flat[0].get("fontId", "inter-regular"),
            "fontSize": all_runs_flat[0].get("fontSize", 12),
            "language": primary_lang,
        },
        "overflow": "visible",
        "fonts": list(fonts.values()),
    }


def classify_page(page: pdfplumber.page.Page) -> str:
    """Classify a page as 'digital', 'scanned', or 'mixed'.

    - digital: has extractable text characters
    - scanned: no text characters, has images covering most of the page
    - mixed: has some text and some large images
    """
    char_count = len(page.chars)
    image_count = len(page.images)

    if char_count > 50 and image_count == 0:
        return "digital"
    elif char_count == 0 and image_count > 0:
        return "scanned"
    elif char_count > 50 and image_count > 0:
        # Check if any image covers > 50% of page area
        page_area = page.width * page.height
        large_images = sum(
            1 for img in page.images
            if (img["width"] * img["height"]) > page_area * 0.3
        )
        if large_images > 0:
            return "mixed"
        return "digital"
    elif char_count > 0 and char_count <= 50:
        return "mixed"
    else:
        return "scanned"


def build_document_model_from_pdf(content: bytes) -> dict:
    """Build a complete DocFlow document model from PDF bytes.

    This replaces the rudimentary _build_document_model in queue_consumer.py.
    """
    pages = []
    all_fonts = {}

    with pdfplumber.open(__import__("io").BytesIO(content)) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            page_type = classify_page(page)
            page_width = float(page.width)
            page_height = float(page.height)

            elements = []

            if page.chars:
                # Sort chars by position (top-to-bottom, left-to-right)
                chars = sorted(page.chars, key=lambda c: (round(c["top"], 1), c["x0"]))

                # Group: chars → runs → lines → paragraphs → blocks
                runs = _group_chars_into_runs(chars)
                lines = _group_runs_into_lines(runs)
                paragraphs = _group_lines_into_paragraphs(lines)
                blocks = _group_paragraphs_into_blocks(paragraphs)

                for block_idx, block in enumerate(blocks):
                    text_block = _block_to_text_block(block, block_idx)
                    if text_block:
                        elements.append(text_block)
                        # Collect fonts
                        for f in text_block.get("fonts", []):
                            all_fonts[f["id"]] = f

            # If scanned/mixed, add placeholder for OCR
            if page_type in ("scanned", "mixed") and not elements:
                elements.append({
                    "id": f"ocr-placeholder-{page_idx}",
                    "type": "text",
                    "bbox": {"x": 50, "y": 50, "width": page_width - 100, "height": 30},
                    "transform": {"rotate": 0, "scaleX": 1, "scaleY": 1, "skewX": 0, "skewY": 0},
                    "zIndex": 0,
                    "locked": False,
                    "visible": True,
                    "sourceType": "ocr",
                    "confidence": 0.0,
                    "paragraphs": [],
                    "style": {},
                    "overflow": "visible",
                })

            # Compute page confidence
            if elements:
                confidences = [e.get("confidence", 0.9) for e in elements if e.get("confidence") is not None]
                page_confidence = sum(confidences) / len(confidences) if confidences else 0.9
            else:
                page_confidence = 0.0

            pages.append({
                "id": f"page-{page_idx}",
                "index": page_idx,
                "width": page_width,
                "height": page_height,
                "rotation": 0,
                "pageType": page_type,
                "elements": elements,
                "confidence": round(page_confidence, 2),
            })

    # Build metadata
    total_elements = sum(len(p["elements"]) for p in pages)
    languages = set()
    has_tables = False
    has_scanned = False

    for p in pages:
        if p["pageType"] in ("scanned", "mixed"):
            has_scanned = True
        for e in p["elements"]:
            if e.get("type") == "table":
                has_tables = True
            for para in e.get("paragraphs", []):
                for run in para.get("runs", []):
                    if run.get("language"):
                        languages.add(run["language"])

    return {
        "schemaVersion": 1,
        "pages": pages,
        "fonts": list(all_fonts.values()),
        "metadata": {
            "pageCount": len(pages),
            "totalElements": total_elements,
            "languages": sorted(languages) if languages else ["en"],
            "hasTables": has_tables,
            "hasForms": False,
            "hasScannedPages": has_scanned,
        },
    }


def merge_ocr_into_model(
    model: dict,
    ocr_results: list[dict],
) -> dict:
    """Merge OCR word-level results into the document model.

    Replaces placeholder elements on scanned/mixed pages with OCR text blocks
    that include word-level bounding boxes.
    """
    for ocr_page in ocr_results:
        page_idx = ocr_page.get("page", 1) - 1
        if page_idx < 0 or page_idx >= len(model["pages"]):
            continue

        page = model["pages"][page_idx]

        # Only replace if page is scanned or has OCR placeholder
        has_placeholder = any(
            e.get("id", "").startswith("ocr-placeholder-") for e in page["elements"]
        )

        if not has_placeholder and page["pageType"] == "digital":
            continue

        # Remove placeholder elements
        page["elements"] = [
            e for e in page["elements"]
            if not e.get("id", "").startswith("ocr-placeholder-")
        ]

        # Add OCR text blocks from word-level data
        words = ocr_page.get("words", [])
        if not words:
            # Fallback: use full text
            text = ocr_page.get("text", "")
            if text.strip():
                page["elements"].append({
                    "id": f"ocr-text-{page_idx}",
                    "type": "text",
                    "bbox": {"x": 50, "y": 50, "width": 500, "height": 30},
                    "transform": {"rotate": 0, "scaleX": 1, "scaleY": 1, "skewX": 0, "skewY": 0},
                    "zIndex": 0,
                    "locked": False,
                    "visible": True,
                    "sourceType": "ocr",
                    "confidence": ocr_page.get("confidence", 0) / 100,
                    "paragraphs": [{
                        "id": f"ocr-para-{page_idx}-0",
                        "runs": [{
                            "text": text,
                            "fontId": "noto-sans-bengali-regular",
                            "fontSize": 12,
                            "fontWeight": 400,
                            "fontStyle": "normal",
                            "color": "#000000",
                            "opacity": 1.0,
                            "underline": False,
                            "strikethrough": False,
                            "language": detect_language(text),
                        }],
                        "alignment": "left",
                        "direction": "ltr",
                        "lineHeight": 1.2,
                        "spaceBefore": 0,
                        "spaceAfter": 8,
                        "indent": 0,
                    }],
                    "style": {
                        "fontId": "noto-sans-bengali-regular",
                        "fontSize": 12,
                        "language": detect_language(text),
                    },
                    "overflow": "visible",
                })
        else:
            # Group words into lines then paragraphs
            lines = _group_ocr_words_into_lines(words)
            paragraphs = _group_ocr_lines_into_paragraphs(lines)

            for para_idx, para in enumerate(paragraphs):
                runs = []
                for word in para:
                    text = word.get("text", "")
                    if not text:
                        continue
                    font_info = match_font(None, 12, text)
                    runs.append({
                        "text": text + " ",
                        "fontId": font_info["id"],
                        "fontSize": 12,
                        "fontWeight": font_info["weight"],
                        "fontStyle": "normal",
                        "color": "#000000",
                        "opacity": 1.0,
                        "underline": False,
                        "strikethrough": False,
                        "language": detect_language(text),
                    })

                if not runs:
                    continue

                all_words = [w for w in para if w.get("text")]
                if not all_words:
                    continue

                bbox = {
                    "x": round(min(w["x"] for w in all_words), 2),
                    "y": round(min(w["y"] for w in all_words), 2),
                    "width": round(
                        max(w["x"] + w["width"] for w in all_words)
                        - min(w["x"] for w in all_words), 2
                    ),
                    "height": round(
                        max(w["y"] + w["height"] for w in all_words)
                        - min(w["y"] for w in all_words), 2
                    ),
                }

                page["elements"].append({
                    "id": f"ocr-text-{page_idx}-{para_idx}",
                    "type": "text",
                    "bbox": bbox,
                    "transform": {"rotate": 0, "scaleX": 1, "scaleY": 1, "skewX": 0, "skewY": 0},
                    "zIndex": len(page["elements"]),
                    "locked": False,
                    "visible": True,
                    "sourceType": "ocr",
                    "confidence": ocr_page.get("confidence", 0) / 100,
                    "paragraphs": [{
                        "id": f"ocr-para-{page_idx}-{para_idx}",
                        "runs": runs,
                        "alignment": "left",
                        "direction": "ltr",
                        "lineHeight": 1.2,
                        "spaceBefore": 0,
                        "spaceAfter": 8,
                        "indent": 0,
                    }],
                    "style": {
                        "fontId": runs[0]["fontId"],
                        "fontSize": 12,
                        "language": runs[0]["language"],
                    },
                    "overflow": "visible",
                })

        # Update page confidence
        if page["elements"]:
            confs = [e.get("confidence", 0) for e in page["elements"] if e.get("confidence") is not None]
            page["confidence"] = round(sum(confs) / len(confs), 2) if confs else 0.0

    return model


def _group_ocr_words_into_lines(words: list[dict], line_threshold: float = 10.0) -> list[list[dict]]:
    """Group OCR words into lines based on y-position proximity."""
    if not words:
        return []

    sorted_words = sorted(words, key=lambda w: (w.get("y", 0), w.get("x", 0)))
    lines = []
    current_line = [sorted_words[0]]

    for i in range(1, len(sorted_words)):
        word = sorted_words[i]
        prev = current_line[-1]
        y_diff = abs(word.get("y", 0) - prev.get("y", 0))

        if y_diff <= line_threshold:
            current_line.append(word)
        else:
            lines.append(current_line)
            current_line = [word]

    lines.append(current_line)
    return lines


def _group_ocr_lines_into_paragraphs(
    lines: list[list[dict]], para_gap: float = 20.0
) -> list[list[dict]]:
    """Group OCR lines into paragraphs based on vertical spacing."""
    if not lines:
        return []

    paragraphs = []
    current_para = list(lines[0])

    for i in range(1, len(lines)):
        prev_line = lines[i - 1]
        curr_line = lines[i]

        prev_bottom = max(w.get("y", 0) + w.get("height", 0) for w in prev_line)
        curr_top = min(w.get("y", 0) for w in curr_line)
        gap = curr_top - prev_bottom

        if gap > para_gap:
            paragraphs.append(current_para)
            current_para = list(curr_line)
        else:
            current_para.extend(curr_line)

    paragraphs.append(current_para)
    return paragraphs
