"""Quick script: extract text from PDF and build DocFlow project data, save to DB."""

import pdfplumber
import json
import uuid
import psycopg
from datetime import datetime, timezone

PDF_PATH = r"C:\Users\abmat\Downloads\Bangla song lyrics\205.pdf"
PROJECT_ID = "ec040cb3-20f6-45ca-b769-e68ea5d4415b"
DB_URL = "postgresql://docflow:docflow@localhost:5432/docflow"


def extract_pdf_to_project(pdf_path: str) -> dict:
    """Extract text from PDF and build a DocFlowProject structure."""
    pages_data = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            # Group chars into lines based on y-position
            chars = page.chars
            if not chars:
                pages_data.append({
                    "page_index": page_idx,
                    "width": float(page.width),
                    "height": float(page.height),
                    "lines": [],
                })
                continue

            # Sort chars by top (y) then x
            chars_sorted = sorted(chars, key=lambda c: (round(c["top"], 1), c["x0"]))

            # Group into lines
            lines = []
            current_line = []
            current_y = None

            for char in chars_sorted:
                char_y = round(char["top"], 1)
                if current_y is None or abs(char_y - current_y) <= 3:
                    current_line.append(char)
                    current_y = char_y if current_y is None else current_y
                else:
                    lines.append(current_line)
                    current_line = [char]
                    current_y = char_y
            if current_line:
                lines.append(current_line)

            # Build line data
            page_lines = []
            for line in lines:
                text = "".join(c["text"] for c in line)
                if text.strip():
                    x0 = min(c["x0"] for c in line)
                    x1 = max(c["x1"] for c in line)
                    top = min(c["top"] for c in line)
                    bottom = max(c["bottom"] for c in line)
                    font = line[0].get("fontname", "unknown")
                    size = float(line[0].get("size", 12))

                    page_lines.append({
                        "text": text,
                        "x": float(x0),
                        "y": float(top),
                        "width": float(x1 - x0),
                        "height": float(bottom - top),
                        "font": font,
                        "size": size,
                    })

            pages_data.append({
                "page_index": page_idx,
                "width": float(page.width),
                "height": float(page.height),
                "lines": page_lines,
            })

    # Build DocFlowProject structure
    pages = []
    for pd in pages_data:
        elements = []
        for line in pd["lines"]:
            elem_id = str(uuid.uuid4())
            elements.append({
                "id": elem_id,
                "type": "text",
                "bbox": {
                    "x": line["x"],
                    "y": line["y"],
                    "width": line["width"],
                    "height": line["height"],
                },
                "transform": {
                    "rotate": 0,
                    "scaleX": 1,
                    "scaleY": 1,
                    "skewX": 0,
                    "skewY": 0,
                },
                "zIndex": 0,
                "locked": False,
                "visible": True,
                "sourceType": "extracted",
                "confidence": 1.0,
                "type": "text",
                "paragraphs": [{
                    "id": str(uuid.uuid4()),
                    "runs": [{
                        "text": line["text"],
                        "style": {
                            "fontId": line["font"],
                            "fontSize": line["size"],
                            "fontWeight": 400,
                            "fontStyle": "normal",
                            "color": "#000000",
                            "opacity": 1.0,
                            "underline": False,
                            "strikethrough": False,
                            "alignment": "left",
                            "direction": "ltr",
                            "lineHeight": 1.5,
                            "letterSpacing": 0,
                            "language": "bn",
                        },
                    }],
                    "alignment": "left",
                    "direction": "ltr",
                    "lineHeight": 1.5,
                    "spaceBefore": 0,
                    "spaceAfter": 0,
                    "indent": 0,
                }],
                "style": {
                    "fontId": line["font"],
                    "fontSize": line["size"],
                    "color": "#000000",
                    "opacity": 1.0,
                    "alignment": "left",
                },
                "overflow": "visible",
            })

        pages.append({
            "id": str(uuid.uuid4()),
            "index": pd["page_index"],
            "width": pd["width"],
            "height": pd["height"],
            "rotation": 0,
            "pageType": "digital",
            "backgroundRef": "",
            "elements": elements,
            "confidence": 1.0,
        })

    total_elements = sum(len(p["elements"]) for p in pages)
    all_text = []
    for p in pages:
        for elem in p["elements"]:
            for para in elem.get("paragraphs", []):
                for run in para["runs"]:
                    all_text.append(run["text"])

    project = {
        "id": PROJECT_ID,
        "schemaVersion": 1,
        "name": "Bangla Song 205",
        "locale": "bn",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "originalPdfRef": f"projects/{PROJECT_ID}/original.pdf",
        "pageRenderRefs": [],
        "pages": pages,
        "fonts": [],
        "history": [],
        "metadata": {
            "pageCount": len(pages),
            "totalElements": total_elements,
            "languages": ["bn", "en"],
            "hasTables": False,
            "hasForms": False,
            "hasScannedPages": False,
        },
    }

    return project


def save_to_db(project: dict):
    """Save project data to the database."""
    project_json = json.dumps(project)
    page_count = len(project["pages"])

    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE projects SET project_data = %s, page_count = %s, updated_at = NOW() WHERE id = %s""",
                (project_json, page_count, PROJECT_ID),
            )
            print(f"Updated project {PROJECT_ID}: {page_count} pages, {project['metadata']['totalElements']} elements")
        conn.commit()


if __name__ == "__main__":
    print(f"Extracting text from: {PDF_PATH}")
    project = extract_pdf_to_project(PDF_PATH)
    print(f"Extracted {project['metadata']['pageCount']} pages, {project['metadata']['totalElements']} text elements")
    print("Saving to database...")
    save_to_db(project)
    print("Done!")

    # Print first page text preview
    if project["pages"]:
        print("\n--- Page 1 text preview ---")
        for elem in project["pages"][0]["elements"][:10]:
            for para in elem.get("paragraphs", []):
                for run in para["runs"]:
                    print(run["text"])
