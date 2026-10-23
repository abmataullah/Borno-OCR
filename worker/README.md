# DocFlow Worker

Python worker service for PDF text extraction, table detection, and OCR.

## Endpoints

- `GET /health` — Health check
- `POST /api/extract/text` — Extract text from all pages
- `POST /api/extract/page/{page_num}` — Extract text from specific page
- `POST /api/tables/detect` — Detect tables in all pages
- `POST /api/tables/detect/page/{page_num}` — Detect tables on specific page
- `POST /api/ocr` — OCR all pages (Bangla + English)
- `POST /api/ocr/page/{page_num}` — OCR specific page

## Dependencies

- pdfplumber — Text extraction
- camelot-py — Table detection
- pytesseract — OCR (Bangla + English)
- pdf2image — PDF to image conversion
- FastAPI — API framework

## Run locally

```bash
pip install -e .
uvicorn app.main:app --port 8001
```

## Run via Docker

```bash
docker build -t docflow-worker .
docker run -p 8001:8001 docflow-worker
```
