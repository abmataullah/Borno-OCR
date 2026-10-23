import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../types/document-model';
import type { DocFlowProject, Page } from '../types/document-model';
import { createTextBlockElement, createShapeElement, createDefaultBBox } from '../engine/canvas-objects';
import { createTableElement, addRow, addColumn, updateCellValue, getCellAt } from '../engine/table-utils';
import { createSignatureElement } from '../engine/image-utils';
import { UndoRedoEngine, createOperation } from '../engine/undo-redo';
import { exportProjectToPdf } from '../engine/pdf-exporter';
import { detectLanguage, isComplexScript } from '../engine/text-shaper';

function createIntegrationProject(): DocFlowProject {
  const now = new Date().toISOString();
  const page: Page = {
    id: crypto.randomUUID(),
    index: 0,
    width: 595,
    height: 842,
    rotation: 0,
    pageType: 'digital',
    backgroundRef: '',
    elements: [],
    confidence: 100,
  };

  return {
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    name: 'Integration Test Document',
    locale: 'en',
    createdAt: now,
    updatedAt: now,
    originalPdfRef: 'test.pdf',
    pageRenderRefs: [],
    pages: [page],
    fonts: [],
    history: [],
    metadata: {
      pageCount: 1,
      totalElements: 0,
      languages: ['en', 'bn'],
      hasTables: true,
      hasForms: false,
      hasScannedPages: false,
    },
  };
}

describe('Phase 0 Integration Tests', () => {
  describe('Document Model', () => {
    it('should have schema version 1', () => {
      expect(SCHEMA_VERSION).toBe(1);
    });

    it('should create a valid project with all required fields', () => {
      const project = createIntegrationProject();
      expect(project.id).toBeDefined();
      expect(project.pages).toHaveLength(1);
      expect(project.metadata.pageCount).toBe(1);
      expect(project.schemaVersion).toBe(SCHEMA_VERSION);
    });
  });

  describe('End-to-end: Create elements, undo/redo, export', () => {
    it('should create text, shape, table, and signature elements', () => {
      const project = createIntegrationProject();
      const page = project.pages[0];

      const textEl = createTextBlockElement(
        'text-1',
        'Hello World',
        createDefaultBBox(50, 50, 300, 40),
        16,
        '#000000'
      );

      const shapeEl = createShapeElement(
        'shape-1',
        'rectangle',
        createDefaultBBox(50, 120, 200, 100),
        'transparent',
        '#d4af37',
        2
      );

      const tableEl = createTableElement(50, 250, 3, 4);
      const sigEl = createSignatureElement('data:image/png;base64,abc', 50, 400, 200, 80);

      page.elements.push(textEl, shapeEl, tableEl, sigEl);
      project.metadata.totalElements = page.elements.length;

      expect(page.elements).toHaveLength(4);
      expect(page.elements[0].type).toBe('text');
      expect(page.elements[1].type).toBe('shape');
      expect(page.elements[2].type).toBe('table');
      expect(page.elements[3].type).toBe('signature');
    });

    it('should handle undo/redo with element modifications', () => {
      const engine = new UndoRedoEngine();
      const project = createIntegrationProject();

      const textEl = createTextBlockElement(
        'text-1',
        'Original',
        createDefaultBBox(50, 50, 300, 40)
      );

      project.pages[0].elements.push(textEl);
      const beforeState = JSON.parse(JSON.stringify(project));

      (project.pages[0].elements[0] as { paragraphs: Array<{ runs: Array<{ text: string }> }> }).paragraphs[0].runs[0].text = 'Modified';
      const afterState = JSON.parse(JSON.stringify(project));

      const op = createOperation('update', 'text-1', { text: 'Modified' }, { text: 'Original' });
      engine.push(op, beforeState, afterState);

      expect(engine.canUndo()).toBe(true);
      const undoEntry = engine.undo();
      expect(undoEntry).not.toBeNull();
      const undoEl = undoEntry!.beforeState.pages[0].elements[0] as { paragraphs: Array<{ runs: Array<{ text: string }> }> };
      expect(undoEl.paragraphs[0].runs[0].text).toBe('Original');
    });

    it('should modify table cells and export to PDF', async () => {
      const project = createIntegrationProject();
      const tableEl = createTableElement(50, 50, 3, 3);
      project.pages[0].elements.push(tableEl);

      const cell = getCellAt(tableEl, 0, 0);
      expect(cell).not.toBeNull();

      const updatedTable = updateCellValue(tableEl, cell!.id, 'Test Value');
      project.pages[0].elements[0] = updatedTable;

      const updatedCell = getCellAt(updatedTable, 0, 0);
      expect(updatedCell!.value).toBe('Test Value');

      const bytes = await exportProjectToPdf(project);
      expect(bytes.length).toBeGreaterThan(0);
      const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
      expect(header).toBe('%PDF');
    });

    it('should add rows and columns to table', () => {
      let table = createTableElement(50, 50, 2, 2);
      expect(table.rows).toHaveLength(2);
      expect(table.cells).toHaveLength(4);

      table = addRow(table);
      expect(table.rows).toHaveLength(3);
      expect(table.cells).toHaveLength(6);

      table = addColumn(table);
      expect(table.columns).toHaveLength(3);
      expect(table.cells).toHaveLength(9);
    });
  });

  describe('Multilingual support', () => {
    it('should detect Bengali text', () => {
      expect(detectLanguage('আমার নাম')).toBe('bn');
      expect(isComplexScript('আমার নাম')).toBe(true);
    });

    it('should detect English text as non-complex', () => {
      expect(detectLanguage('Hello World')).toBe('en');
      expect(isComplexScript('Hello World')).toBe(false);
    });

    it('should support mixed-language metadata', () => {
      const project = createIntegrationProject();
      project.metadata.languages = ['en', 'bn'];
      expect(project.metadata.languages).toContain('bn');
      expect(project.metadata.languages).toContain('en');
    });
  });

  describe('Export pipeline', () => {
    it('should export a project with multiple element types', async () => {
      const project = createIntegrationProject();
      const page = project.pages[0];

      page.elements.push(
        createTextBlockElement('t1', 'Title', createDefaultBBox(50, 50, 400, 60), 24),
        createShapeElement('s1', 'rectangle', createDefaultBBox(50, 150, 400, 2), 'transparent', '#d4af37', 1),
        createTableElement(50, 200, 4, 3)
      );

      const bytes = await exportProjectToPdf(project);
      expect(bytes.length).toBeGreaterThan(0);
      const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
      expect(header).toBe('%PDF');
    });
  });
});
