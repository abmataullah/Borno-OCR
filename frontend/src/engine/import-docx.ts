import type { DocFlowProject, Page, TextBlock, Paragraph, TextRun, TextStyle } from '@model/document-model';
import { defaultStyle } from './rich-text-utils';

/**
 * Import a .docx file into the editor by parsing its XML content.
 * Uses JSZip to extract document.xml from the .docx archive.
 */
export async function importDocx(file: File): Promise<Partial<DocFlowProject>> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Invalid .docx file: missing document.xml');

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'text/xml');

  const paragraphs: Paragraph[] = [];
  const paraNodes = doc.querySelectorAll('w\\:p, p');

  for (const paraNode of Array.from(paraNodes)) {
    const runs: TextRun[] = [];
    const runNodes = paraNode.querySelectorAll('w\\:r, r');

    for (const runNode of Array.from(runNodes)) {
      const textNodes = runNode.querySelectorAll('w\\:t, t');
      const text = Array.from(textNodes).map(t => t.textContent ?? '').join('');
      if (!text) continue;

      const style: TextStyle = { ...defaultStyle() };

      // Parse run properties
      const rPr = runNode.querySelector('w\\:rPr, rPr');
      if (rPr) {
        const bold = rPr.querySelector('w\\:b, b');
        if (bold) style.fontWeight = 700;

        const italic = rPr.querySelector('w\\:i, i');
        if (italic) style.fontStyle = 'italic';

        const underline = rPr.querySelector('w\\:u, u');
        if (underline) style.underline = true;

        const strike = rPr.querySelector('w\\:strike, strike');
        if (strike) style.strikethrough = true;

        const color = rPr.querySelector('w\\:color, color');
        if (color) {
          const val = color.getAttribute('w:val') ?? color.getAttribute('val');
          if (val) style.color = `#${val}`;
        }

        const sz = rPr.querySelector('w\\:sz, sz');
        if (sz) {
          const val = sz.getAttribute('w:val') ?? sz.getAttribute('val');
          if (val) style.fontSize = Math.round(parseInt(val) / 2);
        }

        const rFonts = rPr.querySelector('w\\:rFonts, rFonts');
        if (rFonts) {
          const fontName = rFonts.getAttribute('w:ascii') ?? rFonts.getAttribute('ascii') ?? '';
          if (fontName.toLowerCase().includes('bengali') || fontName.toLowerCase().includes('noto')) {
            style.fontId = 'noto-sans-bengali-regular';
          }
        }
      }

      runs.push({ text, style });
    }

    // Parse paragraph properties
    let alignment: Paragraph['alignment'] = 'left';
    let listType: Paragraph['listType'] = 'none';
    let headingLevel: Paragraph['headingLevel'] = 'none';

    const pPr = paraNode.querySelector('w\\:pPr, pPr');
    if (pPr) {
      const jc = pPr.querySelector('w\\:jc, jc');
      if (jc) {
        const val = jc.getAttribute('w:val') ?? jc.getAttribute('val') ?? '';
        if (val === 'center') alignment = 'center';
        else if (val === 'right') alignment = 'right';
        else if (val === 'both') alignment = 'justify';
      }

      const numPr = pPr.querySelector('w\\:numPr, numPr');
      if (numPr) {
        const numId = numPr.querySelector('w\\:numId, numId');
        const idVal = numId?.getAttribute('w:val') ?? numId?.getAttribute('val') ?? '0';
        listType = parseInt(idVal) % 2 === 0 ? 'numbered' : 'bullet';
      }

      const pStyle = pPr.querySelector('w\\:pStyle, pStyle');
      if (pStyle) {
        const styleVal = (pStyle.getAttribute('w:val') ?? pStyle.getAttribute('val') ?? '').toLowerCase();
        if (styleVal.includes('heading1') || styleVal === 'h1') headingLevel = 'h1';
        else if (styleVal.includes('heading2') || styleVal === 'h2') headingLevel = 'h2';
        else if (styleVal.includes('heading3') || styleVal === 'h3') headingLevel = 'h3';
      }
    }

    if (runs.length === 0) {
      runs.push({ text: '', style: { ...defaultStyle() } });
    }

    paragraphs.push({
      id: crypto.randomUUID(),
      runs,
      alignment,
      direction: 'ltr',
      lineHeight: 1.5,
      spaceBefore: 0,
      spaceAfter: 8,
      indent: 0,
      listType,
      headingLevel,
    });
  }

  // Create a single page with all content
  const textBlock: TextBlock = {
    id: crypto.randomUUID(),
    type: 'text',
    bbox: { x: 72, y: 72, width: 451, height: 697 },
    transform: { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 },
    zIndex: 0,
    locked: false,
    visible: true,
    sourceType: 'imported',
    confidence: null,
    paragraphs,
    style: {},
    overflow: 'visible',
  };

  const page: Page = {
    id: crypto.randomUUID(),
    index: 0,
    width: 595,
    height: 841,
    rotation: 0,
    pageType: 'digital',
    backgroundRef: '',
    elements: [textBlock],
    confidence: 100,
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
  };

  return {
    name: file.name.replace(/\.docx$/i, ''),
    pages: [page],
    originalPdfRef: '',
    pageRenderRefs: [],
    fonts: [],
    history: [],
    metadata: {
      pageCount: 1,
      totalElements: 1,
      languages: ['en'],
      hasTables: false,
      hasForms: false,
      hasScannedPages: false,
    },
  };
}
