import {
  Document, Packer, Paragraph as DocxParagraph, TextRun as DocxTextRun,
  HeadingLevel, AlignmentType, Table as DocxTable, TableRow as DocxTableRow,
  TableCell as DocxTableCell, WidthType, BorderStyle,
} from 'docx';
import type { DocFlowProject, TextBlock, TableElement, Paragraph, TextRun, PageElement } from '@model/document-model';
import { looksMangledBangla } from '@engine/pdf-ocr';

function mapAlignment(alignment: string): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (alignment) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default: return AlignmentType.LEFT;
  }
}

function mapHeading(level?: string): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  switch (level) {
    case 'h1': return HeadingLevel.HEADING_1;
    case 'h2': return HeadingLevel.HEADING_2;
    case 'h3': return HeadingLevel.HEADING_3;
    default: return undefined;
  }
}

function runToDocxRun(run: TextRun): DocxTextRun {
  const style = run.style;
  const props: Record<string, unknown> = {
    text: run.text,
    size: Math.round((style.fontSize ?? 12) * 2), // half-points
    color: (style.color ?? '#000000').replace('#', ''),
    font: /[\u0980-\u09FF]/.test(run.text) ? 'Noto Sans Bengali' : 'Inter',
  };
  if (style.fontWeight >= 700) props.bold = true;
  if (style.fontStyle === 'italic') props.italics = true;
  if (style.underline) props.underline = {};
  if (style.strikethrough) props.strike = true;
  return new DocxTextRun(props as ConstructorParameters<typeof DocxTextRun>[0]);
}

function paragraphToDocxParagraph(para: Paragraph): DocxParagraph {
  const heading = mapHeading(para.headingLevel);
  const children = para.runs.map(runToDocxRun);

  return new DocxParagraph({
    children,
    heading,
    alignment: mapAlignment(para.alignment),
    spacing: {
      before: para.spaceBefore ?? 0,
      after: para.spaceAfter ?? 4,
      line: Math.round((para.lineHeight ?? 1.4) * 240),
    },
    indent: para.indent ? { left: para.indent } : undefined,
  });
}

function textBlockToDocxParagraphs(block: TextBlock): DocxParagraph[] {
  return block.paragraphs.map(paragraphToDocxParagraph);
}

function tableElementToDocxTable(table: TableElement): DocxTable {
  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };

  const rows = table.rows.map((row, rowIdx) => {
    const cells = table.columns.map((col, colIdx) => {
      const cell = table.cells.find(
        c => c.rowIndex === rowIdx && c.colIndex === colIdx
      );
      const cellText = cell?.value ?? '';

      return new DocxTableCell({
        children: [new DocxParagraph({
          children: [(() => {
            const cellProps: Record<string, unknown> = {
              text: cellText,
              size: Math.round((cell?.style.fontSize ?? 11) * 2),
              color: (cell?.style.color ?? '#000000').replace('#', ''),
              font: /[\u0980-\u09FF]/.test(cellText) ? 'Noto Sans Bengali' : 'Inter',
            };
            if ((cell?.style.fontWeight ?? 400) >= 700) cellProps.bold = true;
            return new DocxTextRun(cellProps as ConstructorParameters<typeof DocxTextRun>[0]);
          })()],
          alignment: mapAlignment(cell?.style.alignment ?? 'left'),
        })],
        columnSpan: cell?.colspan && cell.colspan > 1 ? cell.colspan : undefined,
        rowSpan: cell?.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined,
        width: { size: col.width, type: WidthType.DXA },
        borders: {
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
        },
        shading: cell?.style.fill ? { fill: cell.style.fill.replace('#', '') } : undefined,
      });
    });

    return new DocxTableRow({ children: cells, height: { value: row.height, rule: 'atLeast' } });
  });

  return new DocxTable({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

type DocxChild = DocxParagraph | DocxTable;

/**
 * Check if a text block's content looks garbled/mangled.
 * Skips blocks with broken font encodings or garbage characters.
 */
function isTextGarbled(block: TextBlock): boolean {
  const allText = block.paragraphs
    .map(p => p.runs.map(r => r.text).join(''))
    .join(' ');
  if (!allText.trim()) return true;
  // Check for non-ASCII garbage from broken font encodings
  const nonAscii = allText.replace(/[\x20-\x7E\u0980-\u09FF\u200C-\u200D]/g, '');
  if (nonAscii.length > allText.length * 0.1) return true;
  // Check for mangled Bangla
  if (looksMangledBangla(allText)) return true;
  return false;
}

function elementToDocxChildren(element: PageElement): DocxChild[] {
  if (element.type === 'text' && element.visible) {
    const block = element as TextBlock;
    // Skip garbled text blocks to avoid exporting garbage
    if (isTextGarbled(block)) return [];
    return textBlockToDocxParagraphs(block);
  }
  if (element.type === 'table' && element.visible) {
    return [tableElementToDocxTable(element as TableElement)];
  }
  return [];
}

export async function exportProjectToDocx(project: DocFlowProject): Promise<Blob> {
  const allChildren: DocxChild[] = [];

  for (let pageIdx = 0; pageIdx < project.pages.length; pageIdx++) {
    const page = project.pages[pageIdx];
    const sortedElements = [...page.elements].sort((a, b) => a.zIndex - b.zIndex);
    const pageChildren: DocxChild[] = [];

    for (const element of sortedElements) {
      pageChildren.push(...elementToDocxChildren(element));
    }

    if (pageChildren.length === 0) continue; // skip empty pages

    // Add a proper page break before each page (except the first)
    if (pageIdx > 0 && allChildren.length > 0) {
      allChildren.push(new DocxParagraph({
        children: [],
        pageBreakBefore: true,
      }));
    }
    allChildren.push(...pageChildren);
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: allChildren.length > 0 ? allChildren : [new DocxParagraph({ children: [] })],
    }],
  });

  return Packer.toBlob(doc);
}

export async function downloadProjectDocx(project: DocFlowProject): Promise<void> {
  const blob = await exportProjectToDocx(project);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = project.name.endsWith('.docx') ? project.name : `${project.name.replace(/\.pdf$/i, '')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
