"""DocFlow Python Worker — PDF text extraction, table detection, OCR."""

from fastapi import FastAPI
from routers import extract, tables, ocr, hybrid_ocr, health
from queue_consumer import start_queue_consumer

app = FastAPI(
    title="DocFlow Worker",
    version="0.3.0",
    description="PDF text extraction, table detection, and OCR service with hybrid OCR engine",
)

app.include_router(health.router, tags=["health"])
app.include_router(extract.router, prefix="/api", tags=["extract"])
app.include_router(tables.router, prefix="/api", tags=["tables"])
app.include_router(ocr.router, prefix="/api", tags=["ocr"])
app.include_router(hybrid_ocr.router, prefix="/api", tags=["hybrid-ocr"])


@app.on_event("startup")
async def startup_event():
    """Start the queue consumer on startup."""
    import logging
    logging.basicConfig(level=logging.INFO)
    start_queue_consumer()
