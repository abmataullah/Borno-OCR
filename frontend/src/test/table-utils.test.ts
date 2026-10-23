import { describe, it, expect } from 'vitest';
import {
  createTableElement,
  getCellAt,
  updateCellValue,
  addRow,
  addColumn,
  deleteRow,
  deleteColumn,
  getCellPosition,
  createDefaultCellStyle,
} from '../engine/table-utils';

describe('table-utils', () => {
  describe('createTableElement', () => {
    it('should create a table with correct dimensions', () => {
      const table = createTableElement(100, 100, 3, 4);
      expect(table.type).toBe('table');
      expect(table.rows).toHaveLength(3);
      expect(table.columns).toHaveLength(4);
      expect(table.cells).toHaveLength(12);
      expect(table.bbox.width).toBe(400);
      expect(table.bbox.height).toBe(90);
    });

    it('should create cells with default style', () => {
      const table = createTableElement(0, 0, 2, 2);
      const cell = table.cells[0];
      expect(cell.style.fontFamily).toBe('Inter');
      expect(cell.style.fontSize).toBe(12);
      expect(cell.value).toBe('');
      expect(cell.merged).toBe(false);
    });
  });

  describe('getCellAt', () => {
    it('should find cell at given row and column', () => {
      const table = createTableElement(0, 0, 3, 3);
      const cell = getCellAt(table, 1, 2);
      expect(cell).not.toBeNull();
      expect(cell!.rowIndex).toBe(1);
      expect(cell!.colIndex).toBe(2);
    });

    it('should return null for out-of-bounds indices', () => {
      const table = createTableElement(0, 0, 2, 2);
      expect(getCellAt(table, 5, 5)).toBeNull();
    });
  });

  describe('updateCellValue', () => {
    it('should update the value of a specific cell', () => {
      const table = createTableElement(0, 0, 2, 2);
      const cell = table.cells[0];
      const updated = updateCellValue(table, cell.id, 'Hello');
      const updatedCell = getCellAt(updated, 0, 0);
      expect(updatedCell!.value).toBe('Hello');
    });
  });

  describe('addRow', () => {
    it('should add a row and update bbox height', () => {
      const table = createTableElement(0, 0, 2, 3);
      const updated = addRow(table, 40);
      expect(updated.rows).toHaveLength(3);
      expect(updated.cells).toHaveLength(9);
      expect(updated.bbox.height).toBe(100);
    });
  });

  describe('addColumn', () => {
    it('should add a column and update bbox width', () => {
      const table = createTableElement(0, 0, 2, 2);
      const updated = addColumn(table, 120);
      expect(updated.columns).toHaveLength(3);
      expect(updated.cells).toHaveLength(6);
      expect(updated.bbox.width).toBe(320);
    });
  });

  describe('deleteRow', () => {
    it('should delete a row and update bbox height', () => {
      const table = createTableElement(0, 0, 3, 2);
      const updated = deleteRow(table, 1);
      expect(updated.rows).toHaveLength(2);
      expect(updated.cells).toHaveLength(4);
      expect(updated.bbox.height).toBe(60);
    });

    it('should not delete the last row', () => {
      const table = createTableElement(0, 0, 1, 2);
      const updated = deleteRow(table, 0);
      expect(updated.rows).toHaveLength(1);
    });
  });

  describe('deleteColumn', () => {
    it('should delete a column and update bbox width', () => {
      const table = createTableElement(0, 0, 2, 3);
      const updated = deleteColumn(table, 1);
      expect(updated.columns).toHaveLength(2);
      expect(updated.cells).toHaveLength(4);
      expect(updated.bbox.width).toBe(200);
    });

    it('should not delete the last column', () => {
      const table = createTableElement(0, 0, 2, 1);
      const updated = deleteColumn(table, 0);
      expect(updated.columns).toHaveLength(1);
    });
  });

  describe('getCellPosition', () => {
    it('should calculate correct cell position', () => {
      const table = createTableElement(0, 0, 3, 3, 30, 100);
      const pos = getCellPosition(table, 1, 2);
      expect(pos.x).toBe(200);
      expect(pos.y).toBe(30);
      expect(pos.width).toBe(100);
      expect(pos.height).toBe(30);
    });
  });

  describe('createDefaultCellStyle', () => {
    it('should return default cell style', () => {
      const style = createDefaultCellStyle();
      expect(style.fontFamily).toBe('Inter');
      expect(style.alignment).toBe('left');
      expect(style.borderBottom).toBe(true);
    });
  });
});
