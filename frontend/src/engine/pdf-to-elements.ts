import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextBlock, Paragraph, TextRun, TextStyle, Page, PageType, PageElement, TableElement } from '@model/document-model';
import { ocrPdfWithLayout, renderPageToDataUrl, type OcrPageLayout, type OcrWord, type OcrLine } from '@engine/pdf-ocr';
import { detectTablesFromLayout, detectedTableToElement, buildTextBlocksFromLines } from '@engine/table-detector';
import { createDefaultTransform } from '@engine/canvas-objects';
import { createDefaultCellStyle } from '@engine/table-utils';

const defaultStyle: TextStyle = {
  fontId: 'inter-regular',
  fontSize: 11,
  fontWeight: 400,
  fontStyle: 'normal',
  color: '#000000',
  opacity: 1,
  underline: false,
  strikethrough: false,
  alignment: 'left',
  direction: 'ltr',
  lineHeight: 1.4,
  letterSpacing: 0,
  language: 'en',
};

function makeRun(text: string, styleOverride?: Partial<TextStyle>): TextRun {
  return { text, style: { ...defaultStyle, ...styleOverride } };
}

function makeParagraph(runs: TextRun[]): Paragraph {
  return {
    id: crypto.randomUUID(),
    runs,
    alignment: 'left',
    direction: 'ltr',
    lineHeight: 1.4,
    spaceBefore: 0,
    spaceAfter: 4,
    indent: 0,
  };
}

export type OcrMode = 'fast' | 'high-accuracy';

export interface PdfImportOptions {
  ocrMode?: OcrMode;
  serverOcrResults?: ServerOcrPage[];
}

/** Server-side OCR result page (from hybrid OCR worker) */
export interface ServerOcrPage {
  page: number;
  pageType: string;
  text: string;
  confidence: number;
  words: ServerOcrWord[];
  tables?: ServerOcrTable[];
  engine: string;
  layoutRegions?: ServerOcrRegion[];
}

export interface ServerOcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  isLine?: boolean;
  regionType?: string;
}

export interface ServerOcrTable {
  bbox: { x: number; y: number; width: number; height: number };
  cells: ServerOcrTableCell[];
}

export interface ServerOcrTableCell {
  row: number;
  col: number;
  text: string;
  colspan: number;
  rowspan: number;
  isHeader: boolean;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface ServerOcrRegion {
  type: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface PdfImportResult {
  document: PDFDocumentProxy;
  pageCount: number;
  pages: Page[];
}

/**
 * Build a single editable TextBlock from plain text (e.g. OCR output).
 * All text goes into ONE block per page so it reads like a continuous document.
 */
function buildElementsFromText(
  text: string,
  pageWidth: number,
  pageHeight: number,
): TextBlock[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const paragraphs: Paragraph[] = [];
  for (const line of lines) {
    const isBangla = /[\u0980-\u09FF]/.test(line);
    const fontId = isBangla ? 'noto-sans-bengali-regular' : 'inter-regular';
    const run = makeRun(line, { fontSize: 12, fontId, language: isBangla ? 'bn' : 'en' });
    paragraphs.push(makeParagraph([run]));
  }

  return [makeTextBlock(paragraphs, pageWidth, pageHeight, 72)];
}


/**
 * Import PDF and convert to editable elements with layout preservation.
 *
 * OCR modes:
 * - 'fast' (default): Client-side Tesseract.js — no network, privacy-first
 * - 'high-accuracy': Server-side hybrid OCR (PaddleOCR + Surya) — better Bangla/table accuracy
 *
 * Enhanced strategy:
 * 1. OCR all pages with word-level bounding boxes
 *    - Fast mode: Tesseract.js in-browser (multi-script detection)
 *    - High-accuracy mode: PaddleOCR (tables/forms) + Surya (text) on worker
 * 2. Render each PDF page as a background image for exact visual format
 * 3. Detect tables from word positions → TableElement with cell values
 *    - High-accuracy mode: Uses native PP-Structure table detection from PaddleOCR
 * 4. Create positioned TextBlocks for non-table text at exact OCR coordinates
 * 5. Page background preserves the original visual format
 * 6. Page margin detection and multi-column layout support
 */
export async function importPdfToElements(
  pdfDoc: PDFDocumentProxy,
  onProgress?: (status: string, pct: number) => void,
  options?: PdfImportOptions,
): Promise<{ pages: Page[]; pageCount: number }> {
  const ocrMode = options?.ocrMode ?? 'fast';
  const serverResults = options?.serverOcrResults;
  const pageCount = pdfDoc.numPages;
  const pages: Page[] = [];

  // Step 1: OCR all pages
  let layouts: OcrPageLayout[] = [];
  let serverTables: ServerOcrTable[][] = [];

  if (ocrMode === 'high-accuracy' && serverResults && serverResults.length > 0) {
    // Use server-side hybrid OCR results (PaddleOCR + Surya)
    onProgress?.('Processing high-accuracy OCR results…', 0);
    for (let i = 0; i < pageCount; i++) {
      const srvPage = serverResults[i];
      if (srvPage) {
        const converted = convertServerOcrToLayout(srvPage);
        layouts.push(converted.layout);
        serverTables.push(srvPage.tables ?? []);
      } else {
        layouts.push({ words: [], lines: [], text: '', scale: 1, medianFontSize: 11, pageWidth: 0, pageHeight: 0 });
        serverTables.push([]);
      }
      onProgress?.(`Converting OCR page ${i + 1}/${pageCount}`, Math.round((i / pageCount) * 60));
    }
  } else {
    // Fast mode: client-side Tesseract.js OCR
    onProgress?.('Starting layout-aware OCR extraction…', 0);
    layouts = await ocrPdfWithLayout(pdfDoc, (status, pct) => {
      onProgress?.(status, Math.round(pct * 0.7));
    });
    serverTables = new Array(pageCount).fill([]);
  }

  // Step 2: Build elements for each page
  onProgress?.('Building layout-preserving elements…', 70);
  for (let i = 0; i < pageCount; i++) {
    const pdfPage = await pdfDoc.getPage(i + 1);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const layout = layouts[i];

    // Render page as background image (preserves exact visual format)
    let backgroundRef = '';
    try {
      onProgress?.(`Rendering page ${i + 1}…`, 70 + Math.round((i / pageCount) * 20));
      backgroundRef = await renderPageToDataUrl(pdfPage, 2.0);
    } catch (e) {
      console.warn('Failed to render page background:', e);
    }

    let elements: PageElement[] = [];
    let pageType: PageType;
    let confidence = 0;
    let margins: { top: number; bottom: number; left: number; right: number } | undefined;

    if (layout && layout.words.length > 0) {
      // Layout-aware path: detect tables + create positioned text blocks
      pageType = layout.words.length > 20 ? 'digital' : 'mixed';
      confidence = Math.round(
        layout.words.reduce((sum, w) => sum + w.confidence, 0) / layout.words.length
      );

      // Detect page margins from word positions
      margins = detectPageMargins(layout, viewport.width, viewport.height);

      // Detect tables from layout (client-side) or use server-side tables
      let tableElements: TableElement[] = [];
      const srvTables = serverTables[i];

      if (srvTables.length > 0) {
        // Use server-side table detection (PP-Structure)
        tableElements = srvTables.map(st => convertServerTableToElement(st));
      } else {
        // Client-side table detection from word positions
        const detectedTables = detectTablesFromLayout(
          layout.lines,
          viewport.width,
          viewport.height,
          layout.scale,
        );
        tableElements = detectedTables.map(dt => detectedTableToElement(dt));
      }

      // Build table regions (Y ranges) to exclude from text blocks
      const tableRegions = tableElements.map(te => ({
        startY: te.bbox.y,
        endY: te.bbox.y + te.bbox.height,
      }));

      // Create positioned text blocks for non-table content
      const textBlocks = buildTextBlocksFromLines(
        layout.lines,
        tableRegions,
        viewport.width,
        viewport.height,
        layout.scale,
      );

      elements = [...textBlocks, ...tableElements];

      // Sort elements by reading order (z-index based on position)
      elements = sortElementsByReadingOrder(elements);
    } else if (layout && layout.text.trim().length > 0) {
      // Fallback: OCR returned text but no word boxes
      pageType = 'digital';
      confidence = 90;
      elements = buildElementsFromText(layout.text, viewport.width, viewport.height);
    } else {
      pageType = 'scanned';
    }

    pdfPage.cleanup();

    pages.push({
      id: crypto.randomUUID(),
      index: i,
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
      pageType,
      backgroundRef,
      elements,
      confidence,
      margins,
    });

    onProgress?.(`Page ${i + 1}/${pageCount} processed`, 70 + Math.round(((i + 1) / pageCount) * 25));
  }

  onProgress?.('Done', 100);
  return { pages, pageCount };
}

/**
 * Convert server-side OCR result to OcrPageLayout for the existing pipeline.
 * Server OCR uses pixel coords at 200 DPI → scale = 200/72 ≈ 2.78
 */
function convertServerOcrToLayout(srvPage: ServerOcrPage): { layout: OcrPageLayout } {
  const dpi = 200;
  const scale = dpi / 72; // PDF points to pixel scale

  const words: OcrWord[] = srvPage.words.map(w => {
    const text = w.text;
    const isBangla = /[\u0980-\u09FF]/.test(text);
    const isDevanagari = /[\u0900-\u097F]/.test(text);
    const heightPt = w.height / scale;
    return {
      text,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      confidence: w.confidence,
      fontSize: Math.max(8, Math.round(heightPt * 0.75)),
      isBold: false,
      isItalic: false,
      script: isBangla ? 'bn' : isDevanagari ? 'hi' : 'en',
    };
  });

  // Build lines from words (group by Y proximity)
  const sortedWords = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: OcrLine[] = [];
  let currentLineWords: OcrWord[] = [];
  let currentLineY = -999;
  const yTol = scale * 5;

  for (const w of sortedWords) {
    if (Math.abs(w.y - currentLineY) > yTol) {
      if (currentLineWords.length > 0) {
        lines.push(buildSimpleOcrLine(currentLineWords));
      }
      currentLineWords = [w];
      currentLineY = w.y;
    } else {
      currentLineWords.push(w);
    }
  }
  if (currentLineWords.length > 0) {
    lines.push(buildSimpleOcrLine(currentLineWords));
  }

  const fontSizes = words.map(w => w.fontSize).sort((a, b) => a - b);
  const medianFontSize = fontSizes.length > 0
    ? fontSizes[Math.floor(fontSizes.length / 2)]
    : 11;

  return {
    layout: {
      words,
      lines,
      text: srvPage.text,
      scale,
      medianFontSize,
      pageWidth: 0, // filled later from viewport
      pageHeight: 0,
    },
  };
}

function buildSimpleOcrLine(words: OcrWord[]): OcrLine {
  const sorted = [...words].sort((a, b) => a.x - b.x);
  const leftX = sorted[0].x;
  const rightX = Math.max(...sorted.map(w => w.x + w.width));
  const lineY = sorted[0].y;
  const lineHeight = Math.max(...sorted.map(w => w.height));
  const lineText = sorted.map(w => w.text).join(' ');
  const fontSizes = sorted.map(w => w.fontSize).sort((a, b) => a - b);
  const dominantFontSize = fontSizes[Math.floor(fontSizes.length / 2)] ?? 11;

  // Simple alignment detection
  const isHeading = dominantFontSize > 16;

  return {
    text: lineText,
    x: leftX,
    y: lineY,
    width: rightX - leftX,
    height: lineHeight,
    words: sorted,
    fontSize: dominantFontSize,
    alignment: 'left',
    isHeading,
  };
}

/**
 * Convert a server-side table (PP-Structure) to a TableElement.
 * Includes colspan/rowspan and header detection from PaddleOCR.
 */
function convertServerTableToElement(st: ServerOcrTable): TableElement {
  const maxRow = Math.max(...st.cells.map(c => c.row + c.rowspan - 1), 0) + 1;
  const maxCol = Math.max(...st.cells.map(c => c.col + c.colspan - 1), 0) + 1;

  // Build row heights and column widths from cell bboxes
  const rowHeights = new Map<number, number>();
  const colWidths = new Map<number, number>();
  for (const cell of st.cells) {
    if (!rowHeights.has(cell.row) || cell.bbox.height > rowHeights.get(cell.row)!) {
      rowHeights.set(cell.row, cell.bbox.height);
    }
    if (!colWidths.has(cell.col) || cell.bbox.width > colWidths.get(cell.col)!) {
      colWidths.set(cell.col, cell.bbox.width);
    }
  }

  const rows = Array.from({ length: maxRow }, (_, r) => ({
    id: crypto.randomUUID(),
    height: Math.round(rowHeights.get(r) ?? 20),
  }));

  const columns = Array.from({ length: maxCol }, (_, c) => ({
    id: crypto.randomUUID(),
    width: Math.round(colWidths.get(c) ?? 80),
  }));

  const cells = st.cells.map(cell => {
    const isBangla = /[\u0980-\u09FF]/.test(cell.text);
    return {
      id: crypto.randomUUID(),
      rowIndex: cell.row,
      colIndex: cell.col,
      rowspan: cell.rowspan,
      colspan: cell.colspan,
      value: cell.text,
      style: {
        ...createDefaultCellStyle(),
        fontFamily: isBangla ? 'Noto Sans Bengali' : 'Inter',
        fontWeight: cell.isHeader ? 700 : 400,
        fill: cell.isHeader ? '#f0f0f0' : '#ffffff',
        borderTop: cell.isHeader || cell.row > 0,
        borderBottom: true,
      },
      merged: cell.rowspan > 1 || cell.colspan > 1,
    };
  });

  return {
    id: crypto.randomUUID(),
    type: 'table',
    bbox: st.bbox,
    transform: createDefaultTransform(),
    zIndex: 1,
    locked: false,
    visible: true,
    sourceType: 'extracted',
    confidence: 90,
    rows,
    columns,
    cells,
    hasFormulas: false,
  };
}

/**
 * Detect page margins from OCR word positions.
 * Finds the bounding box of all text content and computes margins.
 */
function detectPageMargins(
  layout: OcrPageLayout,
  pageWidth: number,
  pageHeight: number,
): { top: number; bottom: number; left: number; right: number } {
  if (layout.words.length === 0) {
    return { top: 72, bottom: 72, left: 72, right: 72 };
  }

  const scale = layout.scale;
  const minX = Math.min(...layout.words.map(w => w.x / scale));
  const maxX = Math.max(...layout.words.map(w => (w.x + w.width) / scale));
  const minY = Math.min(...layout.words.map(w => w.y / scale));
  const maxY = Math.max(...layout.words.map(w => (w.y + w.height) / scale));

  return {
    top: Math.max(0, Math.round(minY)),
    bottom: Math.max(0, Math.round(pageHeight - maxY)),
    left: Math.max(0, Math.round(minX)),
    right: Math.max(0, Math.round(pageWidth - maxX)),
  };
}

/**
 * Sort elements by reading order: top-to-bottom, then left-to-right within a row.
 * Assigns z-index based on position so elements render in correct order.
 */
function sortElementsByReadingOrder(elements: PageElement[]): PageElement[] {
  const sorted = [...elements].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    if (Math.abs(yDiff) > 20) return yDiff; // different rows (20pt tolerance)
    return a.bbox.x - b.bbox.x; // same row, left-to-right
  });

  // Reassign z-index based on sorted order
  return sorted.map((el, idx) => ({
    ...el,
    zIndex: idx + 1,
  }));
}

function makeTextBlock(
  paragraphs: Paragraph[],
  pageWidth: number,
  pageHeight: number,
  yPos: number
): TextBlock {
  // Estimate bbox — full width with margins, height based on paragraph count
  const margin = 72;
  const lineHeight = 16;
  const blockHeight = paragraphs.length * lineHeight + 8;
  // Convert PDF Y (bottom-left origin) to top-left origin
  const topY = pageHeight - yPos - lineHeight;

  return {
    id: crypto.randomUUID(),
    type: 'text',
    bbox: {
      x: margin,
      y: Math.max(0, topY),
      width: pageWidth - margin * 2,
      height: blockHeight,
    },
    transform: { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 },
    zIndex: 1,
    locked: false,
    visible: true,
    sourceType: 'extracted',
    confidence: 95,
    paragraphs,
    style: {},
    overflow: 'visible',
  };
}
