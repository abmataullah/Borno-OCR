import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

export interface ExtractedTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  x: number;
  y: number;
  fontName: string;
  hasEOL: boolean;
}

export interface ExtractedTextResult {
  items: ExtractedTextItem[];
  totalChars: number;
  hasText: boolean;
}

export async function extractTextFromPage(
  pdfDocument: PDFDocumentProxy,
  pageIndex: number
): Promise<ExtractedTextResult> {
  const page: PDFPageProxy = await pdfDocument.getPage(pageIndex + 1);
  const textContent = await page.getTextContent();

  const items: ExtractedTextItem[] = [];
  let totalChars = 0;

  for (const item of textContent.items) {
    const textItem = item as TextItem;
    if (!('str' in textItem)) continue;

    const transform = textItem.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4];
    const y = transform[5];
    const height = Math.abs(transform[3]) || textItem.height || 12;

    items.push({
      str: textItem.str,
      transform,
      width: textItem.width,
      height,
      x,
      y,
      fontName: textItem.fontName,
      hasEOL: textItem.hasEOL,
    });

    totalChars += textItem.str.length;
  }

  page.cleanup();

  return {
    items,
    totalChars,
    hasText: totalChars > 0,
  };
}

export async function extractAllText(
  pdfDocument: PDFDocumentProxy,
  pageCount: number
): Promise<ExtractedTextResult[]> {
  const results: ExtractedTextResult[] = [];
  for (let i = 0; i < pageCount; i++) {
    results.push(await extractTextFromPage(pdfDocument, i));
  }
  return results;
}

export interface TextSelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  itemIndex: number;
}

export function findTextItemAtPoint(
  items: ExtractedTextItem[],
  pageHeight: number,
  clickX: number,
  clickY: number,
  scale: number
): TextSelectionBox | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemX = item.x * scale;
    const itemY = pageHeight * scale - item.y * scale - item.height * scale;
    const itemWidth = item.width * scale;
    const itemHeight = item.height * scale;

    if (
      clickX >= itemX &&
      clickX <= itemX + itemWidth &&
      clickY >= itemY &&
      clickY <= itemY + itemHeight
    ) {
      return {
        x: itemX,
        y: itemY,
        width: itemWidth,
        height: itemHeight,
        text: item.str,
        itemIndex: i,
      };
    }
  }
  return null;
}
