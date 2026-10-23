import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const PAGE_W = 595;
const PAGE_H = 842;

async function addPage(pdfDoc: PDFDocument, draw: (page: ReturnType<typeof pdfDoc.addPage>) => void) {
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  draw(page);
}

function drawText(page: ReturnType<PDFDocument['addPage']>, text: string, x: number, y: number, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, color = rgb(0, 0, 0)) {
  page.drawText(text, { x, y, size, font, color });
}

export async function generateTestPdf(id: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const times = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  switch (id) {
    case 1: {
      // Native English PDF
      await addPage(pdfDoc, (page) => {
        drawText(page, 'English Test Document', 50, 800, helvBold, 24);
        drawText(page, 'This is a test document for basic text extraction.', 50, 770, helv, 14);
        drawText(page, 'It contains multiple lines of English text.', 50, 750, helv, 14);
        drawText(page, 'Line three with different content.', 50, 730, helv, 14);
      });
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Page 2', 50, 800, helvBold, 18);
        drawText(page, 'Second page with more text content.', 50, 770, helv, 14);
      });
      break;
    }

    case 2: {
      // Native Bangla PDF (using standard fonts as placeholder — real Bangla needs embedded font)
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Bangla Test Document', 50, 800, helvBold, 24);
        drawText(page, 'Bengali text rendering test.', 50, 770, helv, 14);
        drawText(page, 'Note: Full Bangla requires embedded Noto Sans Bengali.', 50, 750, helv, 12, rgb(0.5, 0.5, 0.5));
      });
      break;
    }

    case 3: {
      // Mixed Bangla-English
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Mixed Language Document', 50, 800, helvBold, 24);
        drawText(page, 'This document contains mixed Bangla and English text.', 50, 770, helv, 14);
        drawText(page, 'Bangla text placeholder - needs embedded font.', 50, 750, helv, 12, rgb(0.5, 0.5, 0.5));
        drawText(page, 'English text here alongside Bangla.', 50, 730, helv, 14);
      });
      break;
    }

    case 4: {
      // Embedded fonts PDF
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Embedded Font Test', 50, 800, helvBold, 24);
        drawText(page, 'Helvetica regular text.', 50, 770, helv, 14);
        drawText(page, 'Times Roman text.', 50, 750, times, 14);
        drawText(page, 'Helvetica Bold text.', 50, 730, helvBold, 14);
      });
      break;
    }

    case 5: {
      // Missing fonts PDF (uses standard fonts, simulates missing font scenario)
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Missing Font Test', 50, 800, helv, 24);
        drawText(page, 'This document simulates missing font references.', 50, 770, helv, 14);
        drawText(page, 'Font substitution logic should handle this.', 50, 750, helv, 14);
      });
      break;
    }

    case 6: {
      // Scanned Bangla (image) — placeholder
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Scanned Bangla (Image PDF)', 50, 800, helv, 18);
        drawText(page, 'This would be a scanned page image.', 50, 770, helv, 12, rgb(0.5, 0.5, 0.5));
        page.drawRectangle({ x: 50, y: 400, width: 495, height: 350, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
      });
      break;
    }

    case 7: {
      // Scanned English (image) — placeholder
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Scanned English (Image PDF)', 50, 800, helv, 18);
        drawText(page, 'This would be a scanned page image.', 50, 770, helv, 12, rgb(0.5, 0.5, 0.5));
        page.drawRectangle({ x: 50, y: 400, width: 495, height: 350, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
      });
      break;
    }

    case 8: {
      // Invoice/table PDF
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Invoice #001', 50, 800, helvBold, 24);
        drawText(page, 'Item         Qty    Price    Total', 50, 750, helvBold, 12);
        page.drawLine({ start: { x: 50, y: 745 }, end: { x: 300, y: 745 }, thickness: 1, color: rgb(0, 0, 0) });
        drawText(page, 'Widget A     2      $10.00   $20.00', 50, 730, helv, 12);
        drawText(page, 'Widget B     5      $5.00    $25.00', 50, 710, helv, 12);
        drawText(page, 'Widget C     1      $50.00   $50.00', 50, 690, helv, 12);
        page.drawLine({ start: { x: 50, y: 685 }, end: { x: 300, y: 685 }, thickness: 1, color: rgb(0, 0, 0) });
        drawText(page, 'Total:                              $95.00', 50, 670, helvBold, 12);
      });
      break;
    }

    case 9: {
      // Form PDF
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Application Form', 50, 800, helvBold, 24);
        drawText(page, 'Name:', 50, 760, helv, 14);
        page.drawRectangle({ x: 150, y: 755, width: 300, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        drawText(page, 'Email:', 50, 720, helv, 14);
        page.drawRectangle({ x: 150, y: 715, width: 300, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        drawText(page, 'Phone:', 50, 680, helv, 14);
        page.drawRectangle({ x: 150, y: 675, width: 300, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 1 });
        drawText(page, '[  ] Check here to agree to terms', 50, 620, helv, 12);
      });
      break;
    }

    case 10: {
      // Rotated pages PDF
      const p1 = pdfDoc.addPage([PAGE_W, PAGE_H]);
      p1.setRotation(degrees(90));
      drawText(p1, 'Rotated 90 degrees', 50, 800, helvBold, 18);

      const p2 = pdfDoc.addPage([PAGE_W, PAGE_H]);
      p2.setRotation(degrees(180));
      drawText(p2, 'Rotated 180 degrees', 50, 800, helvBold, 18);

      const p3 = pdfDoc.addPage([PAGE_W, PAGE_H]);
      p3.setRotation(degrees(270));
      drawText(p3, 'Rotated 270 degrees', 50, 800, helvBold, 18);
      break;
    }

    case 11: {
      // 20-page document for performance testing
      for (let i = 0; i < 20; i++) {
        await addPage(pdfDoc, (page) => {
          drawText(page, `Page ${i + 1} of 20`, 50, 800, helvBold, 18);
          drawText(page, `This is page ${i + 1} of the performance test document.`, 50, 770, helv, 14);
          drawText(page, `It contains standard text content for testing.`, 50, 750, helv, 14);
          if (i % 5 === 0) {
            drawText(page, `This page also has a section header.`, 50, 720, helvBold, 14);
          }
        });
      }
      break;
    }

    default:
      await addPage(pdfDoc, (page) => {
        drawText(page, 'Unknown test document', 50, 800, helv, 14);
      });
  }

  pdfDoc.setTitle(`DocFlow Test Document ${id}`);
  pdfDoc.setCreator('DocFlow Test Generator');
  return pdfDoc.save();
}

export const TEST_DOCUMENTS = [
  { id: 1, name: 'Native English PDF', purpose: 'Basic text extraction/editing' },
  { id: 2, name: 'Native Bangla PDF', purpose: 'Bangla shaping, conjuncts, marks' },
  { id: 3, name: 'Mixed Bangla-English', purpose: 'Mixed-script line rendering' },
  { id: 4, name: 'Embedded Fonts PDF', purpose: 'Font extraction and matching' },
  { id: 5, name: 'Missing Fonts PDF', purpose: 'Font substitution logic' },
  { id: 6, name: 'Scanned Bangla (image)', purpose: 'OCR fallback (visual edit only)' },
  { id: 7, name: 'Scanned English (image)', purpose: 'OCR fallback (visual edit only)' },
  { id: 8, name: 'Invoice/Table PDF', purpose: 'Table detection + editing' },
  { id: 9, name: 'Form PDF', purpose: 'Form field detection (basic)' },
  { id: 10, name: 'Rotated Pages PDF', purpose: 'Rotation handling' },
  { id: 11, name: '20-Page Document', purpose: 'Performance, page management' },
];
