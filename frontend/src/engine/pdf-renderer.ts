/// <reference types="vite/client" />
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface RenderedPage {
  pageIndex: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  scale: number;
}

export interface PdfLoadResult {
  document: PDFDocumentProxy;
  pageCount: number;
  pages: Array<{
    width: number;
    height: number;
  }>;
}

export async function loadPdf(file: File): Promise<PdfLoadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const document = await loadingTask.promise;

  const pages: Array<{ width: number; height: number }> = [];
  for (let i = 1; i <= document.numPages; i++) {
    const page = await document.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ width: viewport.width, height: viewport.height });
  }

  return {
    document,
    pageCount: document.numPages,
    pages,
  };
}

export async function renderPage(
  pdfDocument: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
  targetCanvas?: HTMLCanvasElement
): Promise<RenderedPage> {
  const page: PDFPageProxy = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  const canvas = targetCanvas ?? globalThis.document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to get 2D canvas context');
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  page.cleanup();

  return {
    pageIndex,
    canvas,
    width: viewport.width,
    height: viewport.height,
    scale,
  };
}

export async function renderThumbnail(
  pdfDocument: PDFDocumentProxy,
  pageIndex: number,
  maxWidth: number = 150
): Promise<string> {
  const page = await pdfDocument.getPage(pageIndex + 1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = globalThis.document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Failed to get 2D canvas context');
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  page.cleanup();

  return canvas.toDataURL('image/png');
}
