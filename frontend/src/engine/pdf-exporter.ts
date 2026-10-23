import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { DocFlowProject, Page, TextBlock, ImageElement, ShapeElement, TableElement, SignatureElement, PageElement, TextStyle } from '@model/document-model';

interface FontCache {
  [key: string]: PDFFont;
}

// URL for Bangla font (Noto Sans Bengali)
const BANGLA_FONT_URL = 'https://fonts.gstatic.com/s/notosansbengali/v26/CY-aq4o15JIvGxGj0GY7kO6ivjpa5_-vBY23TA.ttf';

let banglaFontDataCache: ArrayBuffer | null = null;

async function fetchBanglaFont(): Promise<ArrayBuffer | null> {
  if (banglaFontDataCache) return banglaFontDataCache;
  try {
    const resp = await fetch(BANGLA_FONT_URL);
    if (!resp.ok) return null;
    banglaFontDataCache = await resp.arrayBuffer();
    return banglaFontDataCache;
  } catch {
    return null;
  }
}

export async function exportProjectToPdf(
  project: DocFlowProject,
  fontData?: ArrayBuffer
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontCache: FontCache = {};

  fontCache.helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  fontCache.helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  fontCache.helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  fontCache.timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  // Embed Bangla font for Bangla text
  let banglaFont: PDFFont | null = null;
  const banglaData = fontData ?? await fetchBanglaFont();
  if (banglaData) {
    try {
      banglaFont = await pdfDoc.embedFont(banglaData, { subset: true });
      fontCache.bangla = banglaFont;
    } catch (err) {
      console.warn('Failed to embed Bangla font:', err);
    }
  }

  for (const page of project.pages) {
    const pdfPage = pdfDoc.addPage([page.width, page.height]);
    await renderPageElements(pdfPage, page, fontCache, banglaFont);
  }

  pdfDoc.setTitle(project.name);
  pdfDoc.setCreator('DocFlow');
  pdfDoc.setProducer('DocFlow');
  pdfDoc.setCreationDate(new Date(project.createdAt));
  pdfDoc.setModificationDate(new Date(project.updatedAt));

  return pdfDoc.save();
}

async function renderPageElements(
  pdfPage: PDFPage,
  page: Page,
  fontCache: FontCache,
  banglaFont: PDFFont | null
): Promise<void> {
  const sortedElements = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);

  for (const element of sortedElements) {
    if (!element.visible) continue;
    await renderElement(pdfPage, element, fontCache, banglaFont);
  }
}

async function renderElement(
  pdfPage: PDFPage,
  element: PageElement,
  fontCache: FontCache,
  banglaFont: PDFFont | null
): Promise<void> {
  switch (element.type) {
    case 'text':
      renderTextBlock(pdfPage, element, fontCache, banglaFont);
      break;
    case 'image':
      return renderImageElement(pdfPage, element);
    case 'shape':
      renderShapeElement(pdfPage, element);
      break;
    case 'table':
      renderTableElement(pdfPage, element, fontCache, banglaFont);
      break;
    case 'signature':
      return renderSignatureElement(pdfPage, element);
    default:
      break;
  }
}

function getFontForText(text: string, style: TextStyle, fontCache: FontCache, banglaFont: PDFFont | null): PDFFont {
  const isBangla = /[\u0980-\u09FF]/.test(text);
  if (isBangla && banglaFont) return banglaFont;
  if (style.fontWeight >= 700) return fontCache.helveticaBold;
  if (style.fontStyle === 'italic') return fontCache.helveticaOblique;
  return fontCache.helvetica;
}

function renderTextBlock(
  pdfPage: PDFPage,
  element: TextBlock,
  fontCache: FontCache,
  banglaFont: PDFFont | null
): void {
  const { x, y, width } = element.bbox;
  const pageHeight = pdfPage.getHeight();

  let currentY = pageHeight - y - 14;

  for (const paragraph of element.paragraphs) {
    if (paragraph.runs.length === 0 || paragraph.runs.every(r => !r.text)) {
      currentY -= 14 * (paragraph.lineHeight ?? 1.4);
      continue;
    }

    // Render each run with its own style
    let currentX = x;
    for (const run of paragraph.runs) {
      if (!run.text) continue;
      const style = run.style;
      const fontSize = style.fontSize ?? 12;
      const color = parseColor(style.color ?? '#000000');
      const font = getFontForText(run.text, style, fontCache, banglaFont);

      try {
        const lines = wrapText(run.text, font, fontSize, width - (currentX - x));
        for (let i = 0; i < lines.length; i++) {
          if (i > 0) {
            currentY -= fontSize * (paragraph.lineHeight ?? 1.4);
            currentX = x;
          }
          pdfPage.drawText(lines[i], {
            x: currentX,
            y: currentY,
            size: fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
          });
          currentX += font.widthOfTextAtSize(lines[i], fontSize);
        }
      } catch (err) {
        console.warn('Failed to render text run, skipping:', err);
      }
    }

    currentY -= 14 * (paragraph.lineHeight ?? 1.4);
    currentY -= paragraph.spaceAfter ?? 4;
  }
}

async function renderImageElement(
  pdfPage: PDFPage,
  element: ImageElement
): Promise<void> {
  try {
    const base64Data = element.src.split(',')[1];
    if (!base64Data) return;
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    let img;
    if (element.format === 'png') {
      img = await pdfPage.doc.embedPng(bytes);
    } else {
      img = await pdfPage.doc.embedJpg(bytes);
    }

    const pageHeight = pdfPage.getHeight();
    pdfPage.drawImage(img, {
      x: element.bbox.x,
      y: pageHeight - element.bbox.y - element.bbox.height,
      width: element.bbox.width,
      height: element.bbox.height,
      opacity: element.opacity,
    });
  } catch (err) {
    console.warn('Failed to embed image, skipping:', err);
  }
}

function renderShapeElement(
  pdfPage: PDFPage,
  element: ShapeElement
): void {
  const { x, y, width, height } = element.bbox;
  const pageHeight = pdfPage.getHeight();
  const fillColor = parseColor(element.fill);
  const strokeColor = parseColor(element.stroke);

  const options = {
    x,
    y: pageHeight - y - height,
    width,
    height,
    borderWidth: element.strokeWidth,
    borderColor: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
    color: element.fill === 'transparent' ? undefined : rgb(fillColor.r, fillColor.g, fillColor.b),
    opacity: element.opacity,
  };

  switch (element.shapeType) {
    case 'rectangle':
      pdfPage.drawRectangle(options);
      break;
    case 'ellipse':
      pdfPage.drawEllipse({
        ...options,
        xScale: width / 2,
        yScale: height / 2,
      });
      break;
    case 'line':
      pdfPage.drawLine({
        start: { x, y: pageHeight - y },
        end: { x: x + width, y: pageHeight - y - height },
        thickness: element.strokeWidth,
        color: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
      });
      break;
    default:
      pdfPage.drawRectangle(options);
  }
}

function renderTableElement(
  pdfPage: PDFPage,
  element: TableElement,
  fontCache: FontCache,
  banglaFont: PDFFont | null
): void {
  const { x, y } = element.bbox;
  const pageHeight = pdfPage.getHeight();
  const fontSize = 12;

  let currentY = pageHeight - y;

  for (let r = 0; r < element.rows.length; r++) {
    const row = element.rows[r];
    let currentX = x;

    for (let c = 0; c < element.columns.length; c++) {
      const col = element.columns[c];
      const cell = element.cells.find(
        (cell) => cell.rowIndex === r && cell.colIndex === c && !cell.merged
      );

      if (cell && cell.value) {
        const color = parseColor(cell.style.color ?? '#000000');
        const isBangla = /[\u0980-\u09FF]/.test(cell.value);
        const font = isBangla && banglaFont ? banglaFont : fontCache.helvetica;
        try {
          pdfPage.drawText(cell.value, {
            x: currentX + 4,
            y: currentY - fontSize - 4,
            size: cell.style.fontSize ?? fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
          });
        } catch (err) {
          console.warn('Failed to render cell text:', err);
        }
      }

      const strokeColor = parseColor('#d4af37');
      if (cell?.style.borderRight) {
        pdfPage.drawLine({
          start: { x: currentX + col.width, y: currentY },
          end: { x: currentX + col.width, y: currentY - row.height },
          thickness: 1,
          color: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
        });
      }
      if (cell?.style.borderBottom) {
        pdfPage.drawLine({
          start: { x: currentX, y: currentY - row.height },
          end: { x: currentX + col.width, y: currentY - row.height },
          thickness: 1,
          color: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
        });
      }

      currentX += col.width;
    }

    currentY -= row.height;
  }
}

async function renderSignatureElement(
  pdfPage: PDFPage,
  element: SignatureElement
): Promise<void> {
  try {
    const base64Data = element.src.split(',')[1];
    if (!base64Data) return;
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const img = await pdfPage.doc.embedPng(bytes);
    const pageHeight = pdfPage.getHeight();

    pdfPage.drawImage(img, {
      x: element.bbox.x,
      y: pageHeight - element.bbox.y - element.bbox.height,
      width: element.bbox.width,
      height: element.bbox.height,
    });
  } catch (err) {
    console.warn('Failed to embed signature, skipping:', err);
  }
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    try {
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    } catch {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

function parseColor(hex: string): { r: number; g: number; b: number } {
  if (hex === 'transparent' || !hex.startsWith('#')) {
    return { r: 0, g: 0, b: 0 };
  }
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return { r, g, b };
}

export async function exportToBlob(project: DocFlowProject, fontData?: ArrayBuffer): Promise<Blob> {
  const bytes = await exportProjectToPdf(project, fontData);
  const arrayBuffer = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(arrayBuffer);
  view.set(bytes);
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}

export async function downloadProjectPdf(project: DocFlowProject, fontData?: ArrayBuffer): Promise<void> {
  const blob = await exportToBlob(project, fontData);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = project.name.endsWith('.pdf') ? project.name : `${project.name}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
