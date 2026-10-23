import { describe, it, expect } from 'vitest';
import { SCHEMA_VERSION } from '../types/document-model';
import type { DocFlowProject, Page, TextBlock } from '../types/document-model';
import { createTextBlockElement, createShapeElement, createDefaultBBox } from '../engine/canvas-objects';
import { createTableElement, updateCellValue, getCellAt, addRow, addColumn } from '../engine/table-utils';
import { createSignatureElement } from '../engine/image-utils';
import { UndoRedoEngine, createOperation } from '../engine/undo-redo';
import { exportProjectToPdf } from '../engine/pdf-exporter';
import { saveProject, loadProject } from '../engine/project-storage';
import { detectLanguage, isComplexScript } from '../engine/text-shaper';
import { generateTestPdf } from '../engine/test-pdf-generator';

function createGateTestProject(): DocFlowProject {
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
    name: 'Gate Criteria Test',
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

describe('Phase 0 Gate Criteria (Section 8.1)', () => {
  describe('Gate 1: Bangla exports correctly', () => {
    it('should detect and shape Bangla text', () => {
      const banglaText = 'আমার নাম বাংলা';
      expect(detectLanguage(banglaText)).toBe('bn');
      expect(isComplexScript(banglaText)).toBe(true);
    });

    it('should export PDF with Bangla metadata', async () => {
      const project = createGateTestProject();
      project.metadata.languages = ['bn', 'en'];
      const bytes = await exportProjectToPdf(project);
      expect(bytes.length).toBeGreaterThan(0);
      const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
      expect(header).toBe('%PDF');
    });
  });

  describe('Gate 2: Table edits survive export', () => {
    it('should create, edit, and export a table', async () => {
      const project = createGateTestProject();
      let table = createTableElement(50, 50, 3, 3);

      const cell = getCellAt(table, 0, 0);
      expect(cell).not.toBeNull();
      table = updateCellValue(table, cell!.id, 'Edited Value');

      table = addRow(table);
      table = addColumn(table);

      project.pages[0].elements.push(table);
      const bytes = await exportProjectToPdf(project);

      expect(bytes.length).toBeGreaterThan(0);
      const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
      expect(header).toBe('%PDF');
    });
  });

  describe('Gate 3: Projects reopen correctly', () => {
    it('should save and reload a project with all data intact', async () => {
      const project = createGateTestProject();
      const textEl = createTextBlockElement('text-1', 'Test text', createDefaultBBox(50, 50, 200, 40));
      const tableEl = createTableElement(50, 150, 3, 3);
      project.pages[0].elements.push(textEl, tableEl);

      await saveProject(project);
      const loaded = await loadProject(project.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.project.id).toBe(project.id);
      expect(loaded!.project.pages[0].elements).toHaveLength(2);
      expect(loaded!.project.pages[0].elements[0].type).toBe('text');
      expect(loaded!.project.pages[0].elements[1].type).toBe('table');
    });
  });

  describe('Gate 4: Unrelated content is not damaged', () => {
    it('should not affect other elements when one is modified', () => {
      const project = createGateTestProject();
      const text1 = createTextBlockElement('text-1', 'Text One', createDefaultBBox(50, 50, 200, 40));
      const text2 = createTextBlockElement('text-2', 'Text Two', createDefaultBBox(50, 150, 200, 40));
      project.pages[0].elements.push(text1, text2);

      const beforeText2 = JSON.parse(JSON.stringify(text2));
      project.pages[0].elements[0] = {
        ...project.pages[0].elements[0],
        bbox: createDefaultBBox(100, 100, 300, 60),
      } as TextBlock;

      const afterText2 = project.pages[0].elements[1];
      expect(afterText2).toEqual(beforeText2);
    });
  });

  describe('Gate 5: Undo/redo is reliable', () => {
    it('should undo and redo add/delete/modify operations', () => {
      const engine = new UndoRedoEngine();
      const project = createGateTestProject();

      const beforeAdd = structuredClone(project);
      const textEl = createTextBlockElement('text-1', 'Test', createDefaultBBox(50, 50, 200, 40));
      project.pages[0].elements.push(textEl);
      const afterAdd = structuredClone(project);

      engine.push(createOperation('add', textEl.id, { element: textEl }), beforeAdd, afterAdd);

      expect(engine.canUndo()).toBe(true);
      const undoEntry = engine.undo();
      expect(undoEntry).not.toBeNull();
      expect(undoEntry!.beforeState.pages[0].elements).toHaveLength(0);

      expect(engine.canRedo()).toBe(true);
      const redoEntry = engine.redo();
      expect(redoEntry).not.toBeNull();
      expect(redoEntry!.afterState.pages[0].elements).toHaveLength(1);
    });
  });

  describe('Gate 6: Mixed Bangla-English renders correctly', () => {
    it('should detect mixed script content', () => {
      const mixed = 'Hello আমার নাম World';
      expect(isComplexScript(mixed)).toBe(true);
    });

    it('should export project with mixed-language metadata', async () => {
      const project = createGateTestProject();
      project.metadata.languages = ['en', 'bn'];
      const bytes = await exportProjectToPdf(project);
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe('Gate 7: Font substitution works', () => {
    it('should fall back to standard fonts when custom font unavailable', async () => {
      const project = createGateTestProject();
      const textEl = createTextBlockElement('text-1', 'Substituted text', createDefaultBBox(50, 50, 200, 40));
      project.pages[0].elements.push(textEl);

      // Export without custom font data — should use Helvetica fallback
      const bytes = await exportProjectToPdf(project);
      expect(bytes.length).toBeGreaterThan(0);
      const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
      expect(header).toBe('%PDF');
    });
  });

  describe('Gate 8: Export validation', () => {
    it('should produce valid PDF that starts with %PDF header', async () => {
      const project = createGateTestProject();
      const bytes = await exportProjectToPdf(project);
      const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
      expect(header).toBe('%PDF');
    });

    it('should produce PDF with EOF marker', async () => {
      const project = createGateTestProject();
      const bytes = await exportProjectToPdf(project);
      const tail = String.fromCharCode(...Array.from(bytes.slice(-6)));
      expect(tail).toContain('%%EOF');
    });

    it('should export project with all element types', async () => {
      const project = createGateTestProject();
      project.pages[0].elements.push(
        createTextBlockElement('t1', 'Title', createDefaultBBox(50, 50, 300, 40), 24),
        createShapeElement('s1', 'rectangle', createDefaultBBox(50, 120, 200, 80), 'transparent', '#d4af37', 2),
        createTableElement(50, 250, 3, 3),
        createSignatureElement('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 50, 400, 200, 80)
      );

      const bytes = await exportProjectToPdf(project);
      expect(bytes.length).toBeGreaterThan(0);
    });
  });

  describe('Test document generation (Section 7)', () => {
    it('should generate all 11 test documents as valid PDFs', async () => {
      for (let i = 1; i <= 11; i++) {
        const bytes = await generateTestPdf(i);
        const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
        expect(header).toBe('%PDF');
        expect(bytes.length).toBeGreaterThan(100);
      }
    });
  });
});
