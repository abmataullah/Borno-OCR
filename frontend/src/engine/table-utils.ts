import type {
  TableElement,
  TableCell,
  TableRow,
  TableColumn,
  CellStyle,
  BoundingBox,
} from '@model/document-model';
import { createDefaultTransform, createDefaultBBox } from './canvas-objects';
import type { ExtractedTextItem } from './text-extractor';

export interface DetectedTable {
  bbox: BoundingBox;
  rows: number;
  cols: number;
  confidence: number;
}

export function detectTablesFromTextItems(
  items: ExtractedTextItem[],
  pageHeight: number
): DetectedTable[] {
  if (items.length === 0) return [];

  const yTolerance = 5;
  const xTolerance = 5;

  const rowGroups: ExtractedTextItem[][] = [];
  const sorted = [...items].sort((a, b) => b.y - a.y);

  for (const item of sorted) {
    const lastGroup = rowGroups[rowGroups.length - 1];
    if (lastGroup && Math.abs(lastGroup[0].y - item.y) < yTolerance) {
      lastGroup.push(item);
    } else {
      rowGroups.push([item]);
    }
  }

  const columnXs = new Set<number>();
  for (const group of rowGroups) {
    for (const item of group) {
      let found = false;
      for (const x of columnXs) {
        if (Math.abs(x - item.x) < xTolerance) {
          found = true;
          break;
        }
      }
      if (!found) columnXs.add(item.x);
    }
  }

  const sortedColumnXs = Array.from(columnXs).sort((a, b) => a - b);
  const tableLikeRows = rowGroups.filter((group) => group.length >= 3);

  if (tableLikeRows.length < 2 || sortedColumnXs.length < 3) {
    return [];
  }

  const minX = Math.min(...items.map((i) => i.x));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y));
  const minY = Math.min(...items.map((i) => i.y - i.height));

  return [
    {
      bbox: createDefaultBBox(minX, pageHeight - maxY, maxX - minX, maxY - minY),
      rows: tableLikeRows.length,
      cols: sortedColumnXs.length,
      confidence: 70,
    },
  ];
}

export function createDefaultCellStyle(): CellStyle {
  return {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 400,
    color: '#000000',
    fill: '#ffffff',
    alignment: 'left',
    borderBottom: true,
    borderTop: false,
    borderLeft: false,
    borderRight: false,
  };
}

export function createTableElement(
  x: number,
  y: number,
  rowCount: number,
  colCount: number,
  rowHeight: number = 30,
  colWidth: number = 100
): TableElement {
  const rows: TableRow[] = Array.from({ length: rowCount }, () => ({
    id: crypto.randomUUID(),
    height: rowHeight,
  }));

  const columns: TableColumn[] = Array.from({ length: colCount }, () => ({
    id: crypto.randomUUID(),
    width: colWidth,
  }));

  const cells: TableCell[] = [];
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      cells.push({
        id: crypto.randomUUID(),
        rowIndex: r,
        colIndex: c,
        rowspan: 1,
        colspan: 1,
        value: '',
        style: createDefaultCellStyle(),
        merged: false,
      });
    }
  }

  const bbox = createDefaultBBox(x, y, colCount * colWidth, rowCount * rowHeight);

  return {
    id: crypto.randomUUID(),
    type: 'table',
    bbox,
    transform: createDefaultTransform(),
    zIndex: 0,
    locked: false,
    visible: true,
    sourceType: 'added',
    confidence: null,
    rows,
    columns,
    cells,
    hasFormulas: false,
  };
}

export function getCellAt(table: TableElement, rowIndex: number, colIndex: number): TableCell | null {
  return table.cells.find(
    (c) => c.rowIndex === rowIndex && c.colIndex === colIndex && !c.merged
  ) ?? null;
}

export function updateCellValue(table: TableElement, cellId: string, value: string): TableElement {
  return {
    ...table,
    cells: table.cells.map((c) =>
      c.id === cellId ? { ...c, value } : c
    ),
  };
}

export function addRow(table: TableElement, rowHeight: number = 30): TableElement {
  const newRowIndex = table.rows.length;
  const newRow: TableRow = { id: crypto.randomUUID(), height: rowHeight };
  const newCells: TableCell[] = table.columns.map((_, colIndex) => ({
    id: crypto.randomUUID(),
    rowIndex: newRowIndex,
    colIndex,
    rowspan: 1,
    colspan: 1,
    value: '',
    style: createDefaultCellStyle(),
    merged: false,
  }));

  return {
    ...table,
    rows: [...table.rows, newRow],
    cells: [...table.cells, ...newCells],
    bbox: {
      ...table.bbox,
      height: table.bbox.height + rowHeight,
    },
  };
}

export function addColumn(table: TableElement, colWidth: number = 100): TableElement {
  const newColIndex = table.columns.length;
  const newCol: TableColumn = { id: crypto.randomUUID(), width: colWidth };
  const newCells: TableCell[] = table.rows.map((_, rowIndex) => ({
    id: crypto.randomUUID(),
    rowIndex,
    colIndex: newColIndex,
    rowspan: 1,
    colspan: 1,
    value: '',
    style: createDefaultCellStyle(),
    merged: false,
  }));

  return {
    ...table,
    columns: [...table.columns, newCol],
    cells: [...table.cells, ...newCells],
    bbox: {
      ...table.bbox,
      width: table.bbox.width + colWidth,
    },
  };
}

export function deleteRow(table: TableElement, rowIndex: number): TableElement {
  if (table.rows.length <= 1) return table;
  const deletedRow = table.rows[rowIndex];
  return {
    ...table,
    rows: table.rows.filter((_, i) => i !== rowIndex),
    cells: table.cells
      .filter((c) => c.rowIndex !== rowIndex)
      .map((c) => ({
        ...c,
        rowIndex: c.rowIndex > rowIndex ? c.rowIndex - 1 : c.rowIndex,
      })),
    bbox: {
      ...table.bbox,
      height: table.bbox.height - deletedRow.height,
    },
  };
}

export function deleteColumn(table: TableElement, colIndex: number): TableElement {
  if (table.columns.length <= 1) return table;
  const deletedCol = table.columns[colIndex];
  return {
    ...table,
    columns: table.columns.filter((_, i) => i !== colIndex),
    cells: table.cells
      .filter((c) => c.colIndex !== colIndex)
      .map((c) => ({
        ...c,
        colIndex: c.colIndex > colIndex ? c.colIndex - 1 : c.colIndex,
      })),
    bbox: {
      ...table.bbox,
      width: table.bbox.width - deletedCol.width,
    },
  };
}

export function getCellPosition(
  table: TableElement,
  rowIndex: number,
  colIndex: number
): { x: number; y: number; width: number; height: number } {
  const x = table.columns.slice(0, colIndex).reduce((sum, col) => sum + col.width, 0);
  const y = table.rows.slice(0, rowIndex).reduce((sum, row) => sum + row.height, 0);
  const width = table.columns[colIndex]?.width ?? 0;
  const height = table.rows[rowIndex]?.height ?? 0;
  return { x, y, width, height };
}
