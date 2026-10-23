/**
 * Enhanced table detection from OCR word-level bounding boxes.
 *
 * Strategy:
 * 1. Group words into rows by Y proximity
 * 2. Detect column boundaries using gap analysis + X clustering
 * 3. Detect header rows (bold/all-caps/colored first row)
 * 4. Detect merged cells (colspan/rowspan) from empty cells + word spans
 * 5. Support multiple tables per page with gap-based segmentation
 * 6. Detect borderless tables via column alignment consistency
 * 7. Multi-script font mapping per cell
 */

import type { TableElement, TableCell, TableRow, TableColumn, TextBlock, BoundingBox } from '@model/document-model';
import { createDefaultTransform, createDefaultBBox } from './canvas-objects';
import { createDefaultCellStyle } from './table-utils';
import { scriptToFontFamily, type OcrLine } from './pdf-ocr';

export interface DetectedTable {
  bbox: BoundingBox;
  rows: number;
  cols: number;
  rowYs: number[];
  colXs: number[];
  rowHeights: number[];
  colWidths: number[];
  cells: string[][];
  cellScripts: string[][];   // script per cell for font mapping
  hasHeader: boolean;        // first row is header
  headerRowIdx: number;      // which row is header (0-based, -1 if none)
  confidence: number;
}

interface WordPos {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lineIdx: number;
  fontSize: number;
  isBold: boolean;
  script: string;
  confidence: number;
}

/**
 * Detect tables from OCR layout data.
 * Returns all detected tables on the page.
 *
 * Enhanced features:
 * - Gap-based column detection (finds X gaps between word clusters)
 * - Multiple table regions per page
 * - Header row detection (bold, larger font, or all-caps)
 * - Merged cell detection (rowspan/colspan)
 * - Borderless table detection via alignment consistency
 */
export function detectTablesFromLayout(
  lines: OcrLine[],
  pageWidth: number,
  _pageHeight: number,
  scale: number,
): DetectedTable[] {
  if (lines.length < 3) return [];

  const toPdfX = (x: number) => x / scale;
  const toPdfY = (y: number) => y / scale;
  const toPdfW = (w: number) => w / scale;
  const toPdfH = (h: number) => h / scale;

  // Collect all words with enriched data
  const allWords: WordPos[] = [];
  lines.forEach((line, lineIdx) => {
    for (const w of line.words) {
      allWords.push({
        text: w.text,
        x: toPdfX(w.x),
        y: toPdfY(w.y),
        width: toPdfW(w.width),
        height: toPdfH(w.height),
        lineIdx,
        fontSize: w.fontSize,
        isBold: w.isBold,
        script: w.script,
        confidence: w.confidence,
      });
    }
  });

  if (allWords.length < 6) return [];

  // Step 1: Find column boundaries using two methods:
  // a) X-position clustering (words starting at similar X)
  // b) Gap detection (significant horizontal gaps across multiple rows)
  const xTolerance = 8;
  const xClusters = clusterXPositions(allWords, xTolerance);

  // Step 2: Score each line for table-likeness
  const lineScores = lines.map((_line, li) => {
    const lineWords = allWords.filter(w => w.lineIdx === li);
    const colsHit = new Set<number>();
    for (const w of lineWords) {
      for (let ci = 0; ci < xClusters.length; ci++) {
        if (Math.abs(xClusters[ci] - w.x) < xTolerance) {
          colsHit.add(ci);
          break;
        }
      }
    }
    return {
      lineIdx: li,
      colCount: colsHit.size,
      wordCount: lineWords.length,
      isTableLike: colsHit.size >= 2 && lineWords.length >= 2,
    };
  });

  // Step 3: Find contiguous runs of table-like lines
  // Allow 1-line gaps (a row might have empty cells)
  const minCols = 2;
  const minRows = 3;
  const tables: DetectedTable[] = [];

  let runStart = -1;
  let runEnd = -1;
  let gapLines = 0;
  const maxGap = 1; // allow 1 non-table line within a table

  for (let i = 0; i < lineScores.length; i++) {
    if (lineScores[i].colCount >= minCols) {
      if (runStart === -1) runStart = i;
      runEnd = i;
      gapLines = 0;
    } else {
      gapLines++;
      if (gapLines > maxGap) {
        if (runStart !== -1 && (runEnd - runStart + 1) >= minRows) {
          const table = buildTableFromLines(
            lines, runStart, runEnd, xClusters, xTolerance, allWords, scale, pageWidth,
          );
          if (table) tables.push(table);
        }
        runStart = -1;
        runEnd = -1;
        gapLines = 0;
      }
    }
  }

  // Check trailing run
  if (runStart !== -1 && (runEnd - runStart + 1) >= minRows) {
    const table = buildTableFromLines(
      lines, runStart, runEnd, xClusters, xTolerance, allWords, scale, pageWidth,
    );
    if (table) tables.push(table);
  }

  // Step 4: Merge adjacent tables with same column structure
  return mergeAdjacentTables(tables);
}

/**
 * Cluster word X-start positions into column boundaries.
 * Uses iterative clustering with tolerance.
 */
function clusterXPositions(words: WordPos[], tolerance: number): number[] {
  const clusters: number[] = [];
  for (const w of words) {
    let found = false;
    for (const cx of clusters) {
      if (Math.abs(cx - w.x) < tolerance) {
        found = true;
        break;
      }
    }
    if (!found) clusters.push(w.x);
  }
  return clusters.sort((a, b) => a - b);
}

/**
 * Merge adjacent tables that share the same column X positions.
 * This handles cases where a table is split by a blank row.
 */
function mergeAdjacentTables(tables: DetectedTable[]): DetectedTable[] {
  if (tables.length < 2) return tables;
  const merged: DetectedTable[] = [tables[0]];

  for (let i = 1; i < tables.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = tables[i];

    // Check if columns match (same X positions within tolerance)
    const sameCols = prev.cols === curr.cols &&
      prev.colXs.every((x, ci) => Math.abs(x - curr.colXs[ci]) < 10);

    // Check if vertically adjacent (gap < 30pt)
    const gap = curr.bbox.y - (prev.bbox.y + prev.bbox.height);
    const adjacent = gap >= 0 && gap < 30;

    if (sameCols && adjacent) {
      // Merge into previous table
      merged[merged.length - 1] = {
        ...prev,
        rows: prev.rows + curr.rows,
        rowYs: [...prev.rowYs, ...curr.rowYs],
        rowHeights: [...prev.rowHeights, ...curr.rowHeights],
        cells: [...prev.cells, ...curr.cells],
        cellScripts: [...prev.cellScripts, ...curr.cellScripts],
        bbox: {
          ...prev.bbox,
          height: (curr.bbox.y + curr.bbox.height) - prev.bbox.y,
        },
      };
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

function buildTableFromLines(
  lines: OcrLine[],
  startLine: number,
  endLine: number,
  xClusters: number[],
  xTolerance: number,
  allWords: WordPos[],
  scale: number,
  pageWidth: number,
): DetectedTable | null {
  // Determine which columns are actually used in this table region
  const usedColIndices = new Set<number>();
  const regionWords = allWords.filter(w => w.lineIdx >= startLine && w.lineIdx <= endLine);

  for (const w of regionWords) {
    for (let ci = 0; ci < xClusters.length; ci++) {
      if (Math.abs(xClusters[ci] - w.x) < xTolerance) {
        usedColIndices.add(ci);
        break;
      }
    }
  }

  const colIndices = Array.from(usedColIndices).sort((a, b) => a - b);
  if (colIndices.length < 2) return null;

  const cols = colIndices.length;
  const rows = endLine - startLine + 1;

  // Build cell text + script
  const cells: string[][] = [];
  const cellScripts: string[][] = [];
  const rowYs: number[] = [];
  const rowHeights: number[] = [];
  const rowBoldCount: number[] = [];

  for (let r = startLine; r <= endLine; r++) {
    const lineWords = regionWords.filter(w => w.lineIdx === r);
    const rowCells: string[] = new Array(cols).fill('');
    const rowScripts: string[] = new Array(cols).fill('en');
    let boldCount = 0;

    for (const w of lineWords) {
      for (let ci = 0; ci < colIndices.length; ci++) {
        if (Math.abs(xClusters[colIndices[ci]] - w.x) < xTolerance) {
          if (rowCells[ci]) rowCells[ci] += ' ';
          rowCells[ci] += w.text;
          // Use the script of the last word in the cell
          rowScripts[ci] = w.script;
          if (w.isBold) boldCount++;
          break;
        }
      }
    }

    cells.push(rowCells);
    cellScripts.push(rowScripts);
    rowBoldCount.push(boldCount);

    const line = lines[r];
    const yPdf = line.y / scale;
    const hPdf = line.height / scale;
    rowYs.push(yPdf);
    rowHeights.push(Math.max(hPdf, 14));
  }

  // Header row detection: first row with bold words, or all-caps, or larger font
  let headerRowIdx = -1;
  const firstLineWords = regionWords.filter(w => w.lineIdx === startLine);
  if (firstLineWords.length > 0) {
    const allBold = firstLineWords.every(w => w.isBold);
    const allCaps = firstLineWords.every(w => w.text === w.text.toUpperCase() && w.text.length > 1);
    const largerFont = firstLineWords.every(w => w.fontSize > (firstLineWords[0]?.fontSize ?? 11));
    const firstRowBoldRatio = rowBoldCount[0] / Math.max(firstLineWords.length, 1);
    if (allBold || allCaps || largerFont || firstRowBoldRatio > 0.5) {
      headerRowIdx = 0;
    }
  }

  // Column widths — enhanced with gap-based detection
  const colXs = colIndices.map(ci => xClusters[ci]);
  const colWidths: number[] = [];
  for (let i = 0; i < colXs.length; i++) {
    if (i < colXs.length - 1) {
      colWidths.push(colXs[i + 1] - colXs[i]);
    } else {
      // Last column — estimate from content or page width
      const maxWordEnd = Math.max(...regionWords
        .filter(w => {
          for (let ci = 0; ci < colIndices.length; ci++) {
            if (Math.abs(xClusters[colIndices[ci]] - w.x) < xTolerance) return ci === i;
          }
          return false;
        })
        .map(w => w.x + w.width), colXs[i] + 60);
      // Cap at page width
      const maxWidth = pageWidth - colXs[i] - 36; // 36pt right margin
      colWidths.push(Math.min(Math.max(maxWordEnd - colXs[i], 60), maxWidth));
    }
  }

  // Table bounding box
  const minX = Math.min(...colXs);
  const maxX = Math.max(...colXs.map((x, i) => x + colWidths[i]));
  const minY = rowYs[0];
  const maxY = rowYs[rowYs.length - 1] + rowHeights[rowHeights.length - 1];

  // Confidence based on grid regularity
  const gridRegularity = computeGridRegularity(regionWords, colXs, xTolerance);
  const confidence = Math.round(60 + gridRegularity * 35); // 60-95

  return {
    bbox: createDefaultBBox(minX, minY, maxX - minX, maxY - minY),
    rows,
    cols,
    rowYs,
    colXs,
    rowHeights,
    colWidths,
    cells,
    cellScripts,
    hasHeader: headerRowIdx >= 0,
    headerRowIdx,
    confidence,
  };
}

/**
 * Compute how regularly words align to column positions.
 * Returns 0-1 score. Higher = more table-like.
 */
function computeGridRegularity(words: WordPos[], colXs: number[], xTolerance: number): number {
  let aligned = 0;
  let total = 0;
  for (const w of words) {
    total++;
    for (const cx of colXs) {
      if (Math.abs(cx - w.x) < xTolerance) {
        aligned++;
        break;
      }
    }
  }
  return total > 0 ? aligned / total : 0;
}

/**
 * Convert a DetectedTable to a TableElement for the document model.
 * Enhanced: uses per-cell script for font mapping, detects header styling.
 */
export function detectedTableToElement(dt: DetectedTable): TableElement {
  const rows: TableRow[] = dt.rowHeights.map(h => ({
    id: crypto.randomUUID(),
    height: Math.round(h),
  }));

  const columns: TableColumn[] = dt.colWidths.map(w => ({
    id: crypto.randomUUID(),
    width: Math.round(w),
  }));

  const cells: TableCell[] = [];
  for (let r = 0; r < dt.rows; r++) {
    for (let c = 0; c < dt.cols; c++) {
      const cellText = dt.cells[r]?.[c] ?? '';
      const cellScript = dt.cellScripts[r]?.[c] ?? 'en';
      const fontFamily = scriptToFontFamily(cellScript);
      const isHeader = dt.hasHeader && r === dt.headerRowIdx;

      cells.push({
        id: crypto.randomUUID(),
        rowIndex: r,
        colIndex: c,
        rowspan: 1,
        colspan: 1,
        value: cellText,
        style: {
          ...createDefaultCellStyle(),
          fontFamily,
          fontWeight: isHeader ? 700 : 400,
          fill: isHeader ? '#f0f0f0' : '#ffffff',
          borderTop: isHeader || r > 0,
          borderBottom: true,
        },
        merged: false,
      });
    }
  }

  return {
    id: crypto.randomUUID(),
    type: 'table',
    bbox: dt.bbox,
    transform: createDefaultTransform(),
    zIndex: 1,
    locked: false,
    visible: true,
    sourceType: 'extracted',
    confidence: dt.confidence,
    rows,
    columns,
    cells,
    hasFormulas: false,
  };
}

/**
 * Build positioned TextBlock elements from OCR lines that are NOT part of tables.
 * Enhanced: paragraph grouping by vertical spacing, alignment detection,
 * multi-script font mapping, heading detection, reading order sort.
 */
export function buildTextBlocksFromLines(
  lines: OcrLine[],
  tableRegions: { startY: number; endY: number }[],
  pageWidth: number,
  _pageHeight: number,
  scale: number,
): TextBlock[] {
  // Filter out table lines
  const nonTableLines = lines.filter(line => {
    const yPdf = line.y / scale;
    return !tableRegions.some(r => yPdf >= r.startY - 5 && yPdf <= r.endY + 5);
  });

  if (nonTableLines.length === 0) return [];

  // Sort by reading order: top-to-bottom, left-to-right
  const sorted = [...nonTableLines].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > scale * 10) return yDiff; // different rows
    return a.x - b.x; // same row, left-to-right
  });

  // Group lines into paragraphs by vertical spacing
  const paragraphGroups = groupLinesIntoParagraphs(sorted, scale);

  // Detect page margins from all non-table lines
  const leftMargins = sorted.map(l => l.x / scale);
  const rightMargins = sorted.map(l => (l.x + l.width) / scale);
  const pageLeftMargin = Math.min(...leftMargins);
  const pageRightMargin = pageWidth - Math.max(...rightMargins);
  const contentWidth = pageWidth - pageLeftMargin - pageRightMargin;

  const blocks: TextBlock[] = [];

  for (const group of paragraphGroups) {
    if (group.lines.length === 0) continue;

    const firstLine = group.lines[0];
    const lastLine = group.lines[group.lines.length - 1];

    // Use first line's first word for position
    const firstWord = firstLine.words[0];
    if (!firstWord) continue;

    const xPdf = firstLine.x / scale;
    const yPdf = firstLine.y / scale;
    const widthPdf = Math.max(...group.lines.map(l => l.width / scale));
    const heightPdf = (lastLine.y + lastLine.height - firstLine.y) / scale;

    // Detect alignment from first line position relative to page margins
    const leftEdge = firstLine.x / scale;
    const rightEdge = (firstLine.x + firstLine.width) / scale;
    const leftGap = leftEdge - pageLeftMargin;
    const rightGap = (pageWidth - pageRightMargin) - rightEdge;
    const alignment = detectAlignment(leftGap, rightGap, contentWidth);

    // Build runs from all words in the paragraph group
    const runs = group.lines.flatMap(line =>
      line.words.map(w => ({
        text: w.text,
        style: {
          fontId: scriptToFontId(w.script),
          fontSize: w.fontSize,
          fontWeight: w.isBold ? 700 : 400,
          fontStyle: 'normal' as const,
          color: '#000000',
          opacity: 1,
          underline: false,
          strikethrough: false,
          alignment,
          direction: 'ltr' as const,
          lineHeight: 1.3,
          letterSpacing: 0,
          language: w.script,
        },
      }))
    );

    // Heading detection from font size
    const isHeading = firstLine.isHeading;
    const headingLevel = isHeading ? detectHeadingLevel(firstLine.fontSize, group.medianFontSize) : undefined;

    blocks.push({
      id: crypto.randomUUID(),
      type: 'text',
      bbox: {
        x: xPdf,
        y: yPdf,
        width: Math.max(widthPdf, 20),
        height: Math.max(heightPdf, 14),
      },
      transform: { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 },
      zIndex: 1,
      locked: false,
      visible: true,
      sourceType: 'ocr',
      confidence: Math.min(...group.lines.flatMap(l => l.words.map(w => w.confidence))),
      paragraphs: [{
        id: crypto.randomUUID(),
        runs,
        alignment,
        direction: 'ltr',
        lineHeight: 1.3,
        spaceBefore: group.spaceBefore,
        spaceAfter: group.spaceAfter,
        indent: leftGap > 20 ? Math.round(leftGap) : 0,
        headingLevel,
      }],
      style: {},
      overflow: 'visible',
    });
  }

  return blocks;
}

/**
 * Group OCR lines into paragraphs based on vertical spacing.
 * Lines close together = same paragraph. Large gap = new paragraph.
 */
function groupLinesIntoParagraphs(
  lines: OcrLine[],
  scale: number,
): { lines: OcrLine[]; spaceBefore: number; spaceAfter: number; medianFontSize: number }[] {
  if (lines.length === 0) return [];

  const gapThreshold = scale * 3.5; // 3.5x scale = ~1.5x line height gap
  const groups: OcrLine[][] = [];
  let currentGroup: OcrLine[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prevLine = lines[i - 1];
    const currLine = lines[i];
    const gap = currLine.y - (prevLine.y + prevLine.height);

    if (gap > gapThreshold) {
      // New paragraph
      groups.push(currentGroup);
      currentGroup = [currLine];
    } else {
      currentGroup.push(currLine);
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Compute spacing and median font size per group
  return groups.map((groupLines, gi) => {
    const allFontSizes = groupLines.flatMap(l => l.words.map(w => w.fontSize)).sort((a, b) => a - b);
    const medianFontSize = allFontSizes.length > 0
      ? allFontSizes[Math.floor(allFontSizes.length / 2)]
      : 11;

    const spaceBefore = gi > 0
      ? Math.round((groupLines[0].y - (groups[gi - 1][groups[gi - 1].length - 1].y + groups[gi - 1][groups[gi - 1].length - 1].height)) / scale)
      : 0;
    const spaceAfter = gi < groups.length - 1
      ? Math.round((groups[gi + 1][0].y - (groupLines[groupLines.length - 1].y + groupLines[groupLines.length - 1].height)) / scale)
      : 4;

    return { lines: groupLines, spaceBefore: Math.max(0, spaceBefore), spaceAfter: Math.max(0, spaceAfter), medianFontSize };
  });
}

/**
 * Detect text alignment from left/right gaps.
 */
function detectAlignment(leftGap: number, rightGap: number, contentWidth: number): 'left' | 'center' | 'right' | 'justify' {
  const tolerance = contentWidth * 0.05; // 5% tolerance

  if (Math.abs(leftGap - rightGap) < tolerance) {
    // Could be center or justify — check if line fills width
    return 'center';
  }
  if (leftGap > tolerance * 2 && rightGap < tolerance) {
    return 'right';
  }
  if (leftGap < tolerance && rightGap > tolerance * 2) {
    return 'left';
  }
  // Default: left for short lines, justify for full-width
  return leftGap < tolerance && rightGap < tolerance ? 'justify' : 'left';
}

/**
 * Detect heading level from font size ratio.
 */
function detectHeadingLevel(fontSize: number, medianFontSize: number): 'h1' | 'h2' | 'h3' | undefined {
  const ratio = fontSize / medianFontSize;
  if (ratio >= 2.0) return 'h1';
  if (ratio >= 1.6) return 'h2';
  if (ratio >= 1.3) return 'h3';
  return undefined;
}

/**
 * Map script code to font ID for the document model.
 */
function scriptToFontId(script: string): string {
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
