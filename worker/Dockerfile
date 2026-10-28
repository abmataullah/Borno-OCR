FROM python:3.12-slim

# System dependencies for OCR, PDF processing, and computer vision
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ben \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-sin \
    tesseract-ocr-tam \
    tesseract-ocr-ara \
    poppler-utils \
    ghostscript \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    gcc \
    g++ \
    libzbar0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

# Pre-download PaddleOCR models at build time to avoid runtime downloads
RUN python -c "from paddleocr import PaddleOCR; PaddleOCR(use_angle_cls=True, lang='bengali')" || true

COPY app/ ./app/

EXPOSE 8001

ENV PYTHONPATH=/app:/app/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
