"""Text extraction from PDF pages using pdfplumber."""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import pdfplumber
import io

router = APIRouter()


class TextItem(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    font: str | None = None
    size: float | None = None


class ExtractResult(BaseModel):
    page_count: int
    pages: list[list[TextItem]]


def extract_text_from_bytes(content: bytes) -> dict:
    """Extract text from PDF bytes. Returns dict with page_count and pages."""
    pages_result: list[list[dict]] = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            items: list[dict] = []
            for char in page.chars:
                items.append(
                    {
                        "text": char["text"],
                        "x": char["x0"],
                        "y": char["top"],
                        "width": char["width"],
                        "height": char["height"],
                        "font": char.get("fontname"),
                        "size": char.get("size"),
                    }
                )
            pages_result.append(items)

    return {"page_count": len(pages_result), "pages": pages_result}


@router.post("/extract/text", response_model=ExtractResult)
async def extract_text(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    result = extract_text_from_bytes(content)
    return ExtractResult(**result)


@router.post("/extract/page/{page_num}", response_model=list[TextItem])
async def extract_page_text(page_num: int, file: UploadFile = File(...)):
    if page_num < 1:
        raise HTTPException(status_code=400, detail="Page number must be >= 1")

    content = await file.read()
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        if page_num > len(pdf.pages):
            raise HTTPException(status_code=404, detail="Page not found")
        page = pdf.pages[page_num - 1]
        items = [
            TextItem(
                text=char["text"],
                x=char["x0"],
                y=char["top"],
                width=char["width"],
                height=char["height"],
                font=char.get("fontname"),
                size=char.get("size"),
            )
            for char in page.chars
        ]
    return items
