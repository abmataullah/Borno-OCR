"""OCR using Tesseract with Bangla + English support.

Returns word-level bounding boxes with confidence scores for each word,
enabling OCR correction UI and confidence heatmaps.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from pydantic import BaseModel
import pytesseract
from pdf2image import convert_from_bytes
import io

router = APIRouter()


class OcrWord(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    confidence: float


class OcrResult(BaseModel):
    page: int
    text: str
    confidence: float
    words: list[OcrWord] = []


def ocr_from_bytes(content: bytes, lang: str = "ben+eng") -> list[dict]:
    """Run OCR on PDF bytes. Returns list of OCR result dicts with word-level data."""
    images = convert_from_bytes(content, dpi=200)

    results: list[dict] = []
    for i, img in enumerate(images):
        data = pytesseract.image_to_data(img, lang=lang, output_type=pytesseract.Output.DICT)

        words: list[dict] = []
        texts: list[str] = []
        confidences: list[float] = []

        n_items = len(data["text"])
        for j in range(n_items):
            text = data["text"][j].strip()
            conf = int(data["conf"][j])
            if not text or conf < 0:
                continue

            x = float(data["left"][j])
            y = float(data["top"][j])
            w = float(data["width"][j])
            h = float(data["height"][j])

            words.append({
                "text": text,
                "x": x,
                "y": y,
                "width": w,
                "height": h,
                "confidence": conf,
            })
            texts.append(text)
            confidences.append(conf)

        full_text = " ".join(texts)
        avg_conf = sum(confidences) / len(confidences) if confidences else 0

        results.append(
            {
                "page": i + 1,
                "text": full_text,
                "confidence": round(avg_conf, 2),
                "words": words,
            }
        )

    return results


@router.post("/ocr", response_model=list[OcrResult])
async def ocr_pdf(
    file: UploadFile = File(...),
    lang: str = Query("ben+eng", description="Tesseract language(s)"),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    results = ocr_from_bytes(content, lang=lang)
    return [OcrResult(**r) for r in results]


@router.post("/ocr/page/{page_num}", response_model=OcrResult)
async def ocr_page(
    page_num: int,
    file: UploadFile = File(...),
    lang: str = Query("ben+eng", description="Tesseract language(s)"),
):
    if page_num < 1:
        raise HTTPException(status_code=400, detail="Page number must be >= 1")

    content = await file.read()
    images = convert_from_bytes(content, dpi=200, first_page=page_num, last_page=page_num)

    if not images:
        raise HTTPException(status_code=404, detail="Page not found")

    img = images[0]
    data = pytesseract.image_to_data(img, lang=lang, output_type=pytesseract.Output.DICT)

    words: list[OcrWord] = []
    texts: list[str] = []
    confidences: list[float] = []

    n_items = len(data["text"])
    for j in range(n_items):
        text = data["text"][j].strip()
        conf = int(data["conf"][j])
        if not text or conf < 0:
            continue

        words.append(OcrWord(
            text=text,
            x=float(data["left"][j]),
            y=float(data["top"][j]),
            width=float(data["width"][j]),
            height=float(data["height"][j]),
            confidence=float(conf),
        ))
        texts.append(text)
        confidences.append(conf)

    full_text = " ".join(texts)
    avg_conf = sum(confidences) / len(confidences) if confidences else 0

    return OcrResult(
        page=page_num,
        text=full_text,
        confidence=round(avg_conf, 2),
        words=words,
    )
