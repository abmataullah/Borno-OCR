/**
 * OCR module — Tesseract.js with self-hosted assets.
 *
 * Supports multi-script detection: Bangla, Devanagari (Hindi/Marathi/Nepali),
 * Sinhala, Tamil, Telugu, Gujarati, Gurmukhi, Kannada, Malayalam, Arabic, Thai.
 * All assets are self-hosted under /public/tesseract to avoid CDN issues.
 *
 * Key functions:
 * - detectScript(): identifies Unicode script from text
 * - looksMangledBangla(): detects if PDF.js text extraction produced garbage
 * - ocrPdfPageWithLayout(): OCR with word-level bounding boxes + font metrics
 * - ocrPdfWithLayout(): OCR entire PDF with layout data
 * - renderPageToDataUrl(): render PDF page as PNG background
 */

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

const TESSERACT_OPTS = {
  workerPath: '/tesseract/worker.min.js',
  corePath: '/tesseract/',
  langPath: '/tesseract/lang/',
};

const BANGLA_FONT_KEYWORDS = [
  'bengali', 'bangla', 'noto', 'solaiman', 'siyam', 'kalpurush',
  'vrinda', 'sutonny', 'ador', 'abirvab', 'akash', 'akaash',
  'amar', 'mukti', 'rupa', 'rupo', 'charu', 'liponi', 'ponn',
  'baloo', 'hind', 'nirmala', 'mukti', 'prothoma', 'kohinoor',
  'sagar', 'bensen', 'charuk', 'utkal', 'lohit', 'muktar',
];

/**
 * Check if a font name suggests it's a Bangla font.
 */
export function isBanglaFont(fontName: string): boolean {
  const lower = fontName.toLowerCase();
  return BANGLA_FONT_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Heuristic: does this extracted text look like mangled Bangla?
 *
 * Three detection strategies:
 * 1. Empty text → unreliable (scanned or no text layer)
 * 2. Text has Bangla Unicode but with broken patterns (space before
 *    dependent vowel signs) → corrupted ToUnicode CMap
 * 3. Text has NO Bangla Unicode but fonts have Bangla names →
 *    non-Unicode embedded font mapping Bangla glyphs to ASCII codes.
 *    This is the most common case: PDF.js extracts English-looking
 *    characters from a Bangla document.
 *
 * @param text Extracted text from PDF.js
 * @param fontNames Array of font names used in the page (optional)
 */
export function looksMangledBangla(text: string, fontNames?: string[]): boolean {
  if (!text || text.trim().length === 0) return true; // empty = unreliable

  const hasBangla = /[\u0980-\u09FF]/.test(text);

  if (hasBangla) {
    // Strategy 2: Check for broken Bangla patterns
    const brokenPattern = /\s[\u09BE-\u09CC\u09CD\u09D7]/g; // space + dependent sign
    const hits = (text.match(brokenPattern) || []).length;
    const banglaChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
    return hits > 2 && hits / Math.max(banglaChars, 1) > 0.01;
  }

  // No Bangla Unicode in text. Check if fonts suggest Bangla.
  if (fontNames && fontNames.length > 0) {
    const hasBanglaFont = fontNames.some(isBanglaFont);
    if (hasBanglaFont) {
      // Bangla font but no Bangla Unicode = broken encoding
      return true;
    }
  }

  // No Bangla font and no Bangla text — probably a genuine English PDF
  return false;
}

/**
 * Check if extracted text from a page is reliable.
 * Returns true if text looks good, false if OCR is needed.
 */
export function isTextReliable(text: string): boolean {
  if (!text || text.trim().length === 0) return false;

  // If text has proper Bangla Unicode and isn't mangled, it's reliable
  if (looksMangledBangla(text)) return false;

  // Check for non-ASCII garbage from broken font encodings
  const nonAscii = text.replace(/[\x20-\x7E\u0980-\u09FF]/g, '');
  if (nonAscii.length > text.length * 0.05) return false;

  return true;
}

/**
 * Extract text from a single PDF page using PDF.js text layer.
 * Returns the text and the set of font names used.
 */
export async function extractPageText(pdfPage: PDFPageProxy): Promise<{ text: string; fontNames: string[] }> {
  const tc = await pdfPage.getTextContent();
  const fontSet = new Set<string>();
  const parts: string[] = [];
  for (const item of tc.items) {
    const textItem = item as TextItem;
    if ('str' in textItem) {
      parts.push(textItem.str);
      if (textItem.fontName) fontSet.add(textItem.fontName);
    }
  }
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return { text, fontNames: Array.from(fontSet) };
}

/**
 * OCR a single PDF page using Tesseract.js.
 * Renders the page to canvas at 2.5x scale, then runs OCR.
 */
export async function ocrPdfPage(
  pdfPage: PDFPageProxy,
  worker: TesseractWorker,
  scale = 2.5,
): Promise<string> {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // White background — OCR accuracy drops badly on transparent canvases
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({
    canvas,
    canvasContext: ctx,
    viewport,
  } as any).promise;

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob returned null'))),
      'image/png',
    ),
  );

  const { data: { text } } = await worker.recognize(blob);
  return text.trim();
}

// ── Layout-aware OCR (word-level bounding boxes) ──────

export interface OcrWord {
  text: string;
  x: number;       // top-left X in page pixels (at given scale)
  y: number;       // top-left Y in page pixels
  width: number;
  height: number;
  confidence: number;
  fontSize: number;   // estimated font size in PDF points
  isBold: boolean;    // detected from word height vs width ratio
  isItalic: boolean;  // detected from slant (not yet — placeholder)
  script: string;     // detected script: 'en', 'bn', 'hi', 'si', 'ta', etc.
}

export interface OcrLine {
  words: OcrWord[];
  text: string;
  x: number;          // leftmost X
  y: number;
  width: number;      // full line width
  height: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  fontSize: number;   // dominant font size in line
  isHeading: boolean; // detected from font size relative to page median
}

export interface OcrPageLayout {
  words: OcrWord[];
  lines: OcrLine[];
  text: string;
  scale: number;
  medianFontSize: number;   // median font size across all words
  pageWidth: number;        // PDF page width in points
  pageHeight: number;       // PDF page height in points
}

/**
 * Unicode script ranges for multi-script detection.
 */
const SCRIPT_RANGES: { script: string; range: RegExp; lang: string }[] = [
  { script: 'bn', range: /[\u0980-\u09FF]/, lang: 'ben' },
  { script: 'hi', range: /[\u0900-\u097F]/, lang: 'hin' },   // Devanagari
  { script: 'si', range: /[\u0D80-\u0DFF]/, lang: 'sin' },   // Sinhala
  { script: 'ta', range: /[\u0B80-\u0BFF]/, lang: 'tam' },   // Tamil
  { script: 'te', range: /[\u0C00-\u0C7F]/, lang: 'tel' },   // Telugu
  { script: 'gu', range: /[\u0A80-\u0AFF]/, lang: 'guj' },   // Gujarati
  { script: 'pa', range: /[\u0A00-\u0A7F]/, lang: 'pan' },   // Gurmukhi (Punjabi)
  { script: 'kn', range: /[\u0C80-\u0CFF]/, lang: 'kan' },   // Kannada
  { script: 'ml', range: /[\u0D00-\u0D7F]/, lang: 'mal' },   // Malayalam
  { script: 'ar', range: /[\u0600-\u06FF\u0750-\u077F]/, lang: 'ara' }, // Arabic/Urdu
  { script: 'th', range: /[\u0E00-\u0E7F]/, lang: 'tha' },   // Thai
];

/**
 * Detect the dominant Unicode script in a text string.
 * Returns script code ('en', 'bn', 'hi', etc.) and corresponding Tesseract lang.
 */
export function detectScript(text: string): { script: string; lang: string } {
  if (!text || text.length === 0) return { script: 'en', lang: 'eng' };
  const counts: Record<string, number> = {};
  for (const { script, range } of SCRIPT_RANGES) {
    const matches = text.match(new RegExp(range.source, 'g'));
    if (matches) counts[script] = matches.length;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0 || sorted[0][1] < 3) return { script: 'en', lang: 'eng' };
  const dominant = sorted[0][0];
  const entry = SCRIPT_RANGES.find(s => s.script === dominant);
  return { script: dominant, lang: entry?.lang ?? 'eng' };
}

/**
 * Detect all scripts present in text (for multi-script pages).
 * Returns array of Tesseract lang codes.
 */
export function detectAllScripts(text: string): string[] {
  const langs = new Set<string>(['eng']);
  for (const { range, lang } of SCRIPT_RANGES) {
    if (range.test(text)) langs.add(lang);
  }
  return Array.from(langs);
}

/**
 * Map script code to font family for document model.
 */
export function scriptToFontId(script: string): string {
  const fontMap: Record<string, string> = {
    en: 'inter-regular',
    bn: 'noto-sans-bengali-regular',
    hi: 'noto-sans-devanagari-regular',
    si: 'noto-sans-sinhala-regular',
    ta: 'noto-sans-tamil-regular',
    te: 'noto-sans-telugu-regular',
    gu: 'noto-sans-gujarati-regular',
    pa: 'noto-sans-gurmukhi-regular',
    kn: 'noto-sans-kannada-regular',
    ml: 'noto-sans-malayalam-regular',
    ar: 'noto-sans-arabic-regular',
    th: 'noto-sans-thai-regular',
  };
  return fontMap[script] ?? 'inter-regular';
}

/**
 * Map script code to font family name for DOCX export.
 */
export function scriptToFontFamily(script: string): string {
  const fontMap: Record<string, string> = {
    en: 'Inter',
    bn: 'Noto Sans Bengali',
    hi: 'Noto Sans Devanagari',
    si: 'Noto Sans Sinhala',
    ta: 'Noto Sans Tamil',
    te: 'Noto Sans Telugu',
    gu: 'Noto Sans Gujarati',
    pa: 'Noto Sans Gurmukhi',
    kn: 'Noto Sans Kannada',
    ml: 'Noto Sans Malayalam',
    ar: 'Noto Sans Arabic',
    th: 'Noto Sans Thai',
  };
  return fontMap[script] ?? 'Inter';
}

/**
 * OCR a single PDF page and return word-level bounding boxes.
 * Tesseract.js v7 provides data.words with bbox info.
 * Enriches each word with script detection, font size, and bold detection.
 */
export async function ocrPdfPageWithLayout(
  pdfPage: PDFPageProxy,
  worker: TesseractLayoutWorker,
  scale = 2.5,
): Promise<OcrPageLayout> {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({
    canvas,
    canvasContext: ctx,
    viewport,
  } as any).promise;

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob returned null'))),
      'image/png',
    ),
  );

  const result = await worker.recognize(blob);
  const data = result.data as any;

  const rawWords: OcrWord[] = [];

  // Tesseract.js v7: data.words has { text, bbox: {x0,y0,x1,y1}, confidence }
  if (data.words && Array.isArray(data.words)) {
    for (const w of data.words) {
      if (!w.text || w.text.trim().length === 0) continue;
      const wordText = w.text.trim();
      const { script } = detectScript(wordText);
      const wordHeight = (w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0);
      const wordWidth = (w.bbox?.x1 ?? 0) - (w.bbox?.x0 ?? 0);
      // Font size estimate: word height in PDF points (height / scale)
      // Bold detection: bold words tend to be wider for same text
      // We'll refine this after computing median font size
      rawWords.push({
        text: wordText,
        x: w.bbox?.x0 ?? 0,
        y: w.bbox?.y0 ?? 0,
        width: wordWidth,
        height: wordHeight,
        confidence: w.confidence ?? 0,
        fontSize: Math.round((wordHeight / scale) * 0.72), // convert px to pt
        isBold: false,  // determined after median computation
        isItalic: false,
        script,
      });
    }
  }

  // Compute median font size for the page
  const fontSizes = rawWords.map(w => w.fontSize).sort((a, b) => a - b);
  const medianFontSize = fontSizes.length > 0
    ? fontSizes[Math.floor(fontSizes.length / 2)]
    : 11;

  // Detect bold: words significantly taller than median AND wider than expected
  for (const w of rawWords) {
    const heightRatio = w.fontSize / medianFontSize;
    // Bold heuristic: word width / char count ratio is higher than normal
    const charWidth = w.width / Math.max(w.text.length, 1);
    const expectedCharWidth = medianFontSize * scale * 0.55; // normal char width
    w.isBold = charWidth > expectedCharWidth * 1.15 || heightRatio > 1.15;
  }

  // Group words into lines by Y proximity
  const yTolerance = scale * 5;
  const sortedWords = [...rawWords].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: OcrLine[] = [];
  let currentLineWords: OcrWord[] = [];
  let currentLineY = -999;

  for (const w of sortedWords) {
    if (Math.abs(w.y - currentLineY) > yTolerance) {
      if (currentLineWords.length > 0) {
        lines.push(buildOcrLine(currentLineWords, medianFontSize));
      }
      currentLineWords = [w];
      currentLineY = w.y;
    } else {
      currentLineWords.push(w);
    }
  }
  if (currentLineWords.length > 0) {
    lines.push(buildOcrLine(currentLineWords, medianFontSize));
  }

  return {
    words: rawWords,
    lines,
    text: data.text?.trim() ?? lines.map(l => l.text).join('\n'),
    scale,
    medianFontSize,
    pageWidth: viewport.width / scale,
    pageHeight: viewport.height / scale,
  };
}

/**
 * Build an OcrLine from a group of words on the same Y.
 * Detects alignment and heading status.
 */
function buildOcrLine(words: OcrWord[], medianFontSize: number): OcrLine {
  const sortedByX = [...words].sort((a, b) => a.x - b.x);
  const leftX = sortedByX[0].x;
  const rightX = Math.max(...sortedByX.map(w => w.x + w.width));
  const lineY = sortedByX[0].y;
  const lineHeight = Math.max(...sortedByX.map(w => w.height));
  const lineText = sortedByX.map(w => w.text).join(' ');

  // Dominant font size in line
  const lineFontSizes = sortedByX.map(w => w.fontSize).sort((a, b) => a - b);
  const dominantFontSize = lineFontSizes[Math.floor(lineFontSizes.length / 2)];

  // Heading detection: font size >= 1.4x median
  const isHeading = dominantFontSize >= medianFontSize * 1.4;

  // Alignment detection (needs page width — will be refined in import)
  // For now default to left; will be adjusted in buildTextBlocksFromLines
  return {
    words: sortedByX,
    text: lineText,
    x: leftX,
    y: lineY,
    width: rightX - leftX,
    height: lineHeight,
    alignment: 'left',
    fontSize: dominantFontSize,
    isHeading,
  };
}

// Type for Tesseract worker with layout data
interface TesseractLayoutWorker {
  recognize: (image: Blob | File | string) => Promise<{
    data: { text: string; words?: unknown[] };
  }>;
  terminate: () => Promise<unknown>;
}

let layoutWorkerPromise: Promise<TesseractLayoutWorker> | null = null;

async function getLayoutWorker(lang = 'eng+ben'): Promise<TesseractLayoutWorker> {
  if (!layoutWorkerPromise) {
    const { createWorker } = await import('tesseract.js');
    layoutWorkerPromise = createWorker(lang, 1, TESSERACT_OPTS) as unknown as Promise<TesseractLayoutWorker>;
  }
  return layoutWorkerPromise;
}

/**
 * OCR an entire PDF with word-level layout data.
 * Returns OcrPageLayout per page.
 */
export async function ocrPdfWithLayout(
  pdfDoc: PDFDocumentProxy,
  onProgress?: (status: string, pct: number) => void,
  lang = 'eng+ben',
): Promise<OcrPageLayout[]> {
  const total = pdfDoc.numPages;
  const worker = await getLayoutWorker(lang);
  const layouts: OcrPageLayout[] = [];

  try {
    for (let i = 1; i <= total; i++) {
      onProgress?.(`OCR page ${i} of ${total}…`, Math.round(((i - 1) / total) * 100));
      const page = await pdfDoc.getPage(i);
      const layout = await ocrPdfPageWithLayout(page, worker as TesseractLayoutWorker);
      layouts.push(layout);
      page.cleanup();
    }
  } finally {
    // Keep worker alive for reuse
  }

  onProgress?.('Done', 100);
  return layouts;
}

/**
 * Render a PDF page to a PNG data URL at high resolution.
 * Used as page background to preserve exact visual format.
 */
export async function renderPageToDataUrl(
  pdfPage: PDFPageProxy,
  scale = 2.0,
): Promise<string> {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({
    canvas,
    canvasContext: ctx,
    viewport,
  } as any).promise;

  return canvas.toDataURL('image/png');
}

// Type for Tesseract worker (avoid importing the full type)
interface TesseractWorker {
  recognize: (image: Blob | File | string) => Promise<{
    data: { text: string };
  }>;
  terminate: () => Promise<unknown>;
}

let workerPromise: Promise<TesseractWorker> | null = null;

async function getWorker(lang = 'eng+ben'): Promise<TesseractWorker> {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js');
    workerPromise = createWorker(lang, undefined, TESSERACT_OPTS) as unknown as Promise<TesseractWorker>;
  }
  return workerPromise;
}

/**
 * OCR an entire PDF page-by-page.
 * Reuses a single Tesseract worker for all pages.
 */
export async function ocrPdf(
  pdfDoc: PDFDocumentProxy,
  onProgress?: (status: string, pct: number) => void,
  lang = 'eng+ben',
): Promise<string[]> {
  const total = pdfDoc.numPages;
  const worker = await getWorker(lang);
  const pages: string[] = [];

  try {
    for (let i = 1; i <= total; i++) {
      onProgress?.(`OCR page ${i} of ${total}…`, Math.round(((i - 1) / total) * 100));
      const page = await pdfDoc.getPage(i);
      const text = await ocrPdfPage(page, worker);
      pages.push(text);
      page.cleanup();
    }
  } finally {
    // Don't terminate — keep worker alive for potential re-use
    // It will be cleaned up on page unload
  }

  onProgress?.('Done', 100);
  return pages;
}

/**
 * Extract text from a PDF with automatic OCR fallback.
 *
 * Strategy (same as Banglai Cloud):
 * 1. Try PDF.js text extraction (fast, instant)
 * 2. If text looks mangled Bangla, fall back to Tesseract OCR (slower but accurate)
 * 3. Returns page-separated text array
 */
export async function extractPdfTextWithOcrFallback(
  pdfDoc: PDFDocumentProxy,
  onProgress?: (status: string, pct: number) => void,
): Promise<{ pages: string[]; usedOcr: boolean }> {
  // Step 1: Try text layer extraction
  onProgress?.('Extracting text layer…', 0);
  const pages: string[] = [];
  const allFontNames: string[] = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const { text, fontNames } = await extractPageText(page);
    pages.push(text);
    allFontNames.push(...fontNames);
    page.cleanup();
  }

  // Step 2: Check if text is mangled Bangla (using font names too)
  const allText = pages.join(' ');
  const needsOcr = looksMangledBangla(allText, allFontNames);

  if (!needsOcr) {
    onProgress?.('Done', 100);
    return { pages, usedOcr: false };
  }

  // Step 3: Fall back to OCR
  onProgress?.('Text layer is corrupted Bangla — switching to OCR…', 0);
  const ocrPages = await ocrPdf(pdfDoc, onProgress);
  return { pages: ocrPages, usedOcr: true };
}
