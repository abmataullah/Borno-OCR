"""Table detection from PDF pages using camelot."""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import camelot
import io
import tempfile
import os

router = APIRouter()


class TableCell(BaseModel):
    row: int
    col: int
    text: str
    x: float
    y: float
    width: float
    height: float


class TableResult(BaseModel):
    page: int
    row_count: int
    col_count: int
    cells: list[TableCell]


def detect_tables_from_bytes(content: bytes) -> list[dict]:
    """Detect tables from PDF bytes. Returns list of table result dicts."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        tables = camelot.read_pdf(tmp_path, pages="all", flavor="lattice")
        results: list[dict] = []

        for table in tables:
            df = table.df
            cells: list[dict] = []
            for row_idx in range(len(df)):
                for col_idx in range(len(df.columns)):
                    text = str(df.iloc[row_idx, col_idx])
                    cells.append(
                        {
                            "row": row_idx,
                            "col": col_idx,
                            "text": text,
                            "x": 0,
                            "y": 0,
                            "width": 0,
                            "height": 0,
                        }
                    )
            results.append(
                {
                    "page": table.page,
                    "row_count": len(df),
                    "col_count": len(df.columns),
                    "cells": cells,
                }
            )

        return results
    except Exception as e:
        raise Exception(f"Table detection failed: {str(e)}")
    finally:
        os.unlink(tmp_path)


@router.post("/tables/detect", response_model=list[TableResult])
async def detect_tables(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    content = await file.read()
    results = detect_tables_from_bytes(content)
    return [TableResult(**r) for r in results]


@router.post("/tables/detect/page/{page_num}", response_model=list[TableResult])
async def detect_tables_page(page_num: int, file: UploadFile = File(...)):
    if page_num < 1:
        raise HTTPException(status_code=400, detail="Page number must be >= 1")

    content = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        tables = camelot.read_pdf(tmp_path, pages=str(page_num), flavor="lattice")
        results: list[TableResult] = []

        for table in tables:
            df = table.df
            cells: list[TableCell] = []
            for row_idx in range(len(df)):
                for col_idx in range(len(df.columns)):
                    text = str(df.iloc[row_idx, col_idx])
                    cells.append(
                        TableCell(
                            row=row_idx,
                            col=col_idx,
                            text=text,
                            x=0,
                            y=0,
                            width=0,
                            height=0,
                        )
                    )
            results.append(
                TableResult(
                    page=table.page,
                    row_count=len(df),
                    col_count=len(df.columns),
                    cells=cells,
                )
            )

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Table detection failed: {str(e)}")
    finally:
        os.unlink(tmp_path)
