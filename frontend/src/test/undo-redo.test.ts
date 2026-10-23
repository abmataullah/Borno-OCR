import { describe, it, expect } from 'vitest';
import { UndoRedoEngine, createOperation } from '../engine/undo-redo';
import type { DocFlowProject } from '../types/document-model';
import { SCHEMA_VERSION } from '../types/document-model';

function createMockProject(name: string): DocFlowProject {
  const now = new Date().toISOString();
  return {
    id: 'test-project',
    schemaVersion: SCHEMA_VERSION,
    name,
    locale: 'en',
    createdAt: now,
    updatedAt: now,
    originalPdfRef: 'test.pdf',
    pageRenderRefs: [],
    pages: [],
    fonts: [],
    history: [],
    metadata: {
      pageCount: 0,
      totalElements: 0,
      languages: ['en'],
      hasTables: false,
      hasForms: false,
      hasScannedPages: false,
    },
  };
}

describe('undo-redo', () => {
  it('should start empty', () => {
    const engine = new UndoRedoEngine();
    expect(engine.canUndo()).toBe(false);
    expect(engine.canRedo()).toBe(false);
    expect(engine.getUndoCount()).toBe(0);
    expect(engine.getRedoCount()).toBe(0);
  });

  it('should push operations and enable undo', () => {
    const engine = new UndoRedoEngine();
    const op = createOperation('add', 'elem-1');
    const before = createMockProject('Before');
    const after = createMockProject('After');

    engine.push(op, before, after);
    expect(engine.canUndo()).toBe(true);
    expect(engine.canRedo()).toBe(false);
    expect(engine.getUndoCount()).toBe(1);
  });

  it('should undo and redo', () => {
    const engine = new UndoRedoEngine();
    const op = createOperation('add', 'elem-1');
    const before = createMockProject('Before');
    const after = createMockProject('After');

    engine.push(op, before, after);

    const undoEntry = engine.undo();
    expect(undoEntry).not.toBeNull();
    expect(undoEntry!.operation.type).toBe('add');
    expect(engine.canUndo()).toBe(false);
    expect(engine.canRedo()).toBe(true);

    const redoEntry = engine.redo();
    expect(redoEntry).not.toBeNull();
    expect(engine.canUndo()).toBe(true);
    expect(engine.canRedo()).toBe(false);
  });

  it('should clear redo stack on new push', () => {
    const engine = new UndoRedoEngine();
    const op1 = createOperation('add', 'elem-1');
    const op2 = createOperation('update', 'elem-1');

    engine.push(op1, createMockProject('A'), createMockProject('B'));
    engine.push(op2, createMockProject('B'), createMockProject('C'));

    engine.undo();
    expect(engine.canRedo()).toBe(true);

    engine.push(createOperation('delete', 'elem-2'), createMockProject('B'), createMockProject('D'));
    expect(engine.canRedo()).toBe(false);
  });

  it('should limit history to maxHistory', () => {
    const engine = new UndoRedoEngine(3);
    for (let i = 0; i < 5; i++) {
      engine.push(
        createOperation('add', `elem-${i}`),
        createMockProject(`Before-${i}`),
        createMockProject(`After-${i}`)
      );
    }
    expect(engine.getUndoCount()).toBe(3);
  });

  it('should clear all stacks', () => {
    const engine = new UndoRedoEngine();
    engine.push(createOperation('add', 'elem-1'), createMockProject('A'), createMockProject('B'));
    engine.undo();
    engine.clear();
    expect(engine.getUndoCount()).toBe(0);
    expect(engine.getRedoCount()).toBe(0);
  });

  it('createOperation should create proper OperationEntry', () => {
    const op = createOperation('update', 'elem-1', { value: 'new' }, { value: 'old' });
    expect(op.type).toBe('update');
    expect(op.targetId).toBe('elem-1');
    expect(op.patch).toEqual({ value: 'new' });
    expect(op.inversePatch).toEqual({ value: 'old' });
    expect(op.id).toBeDefined();
    expect(op.timestamp).toBeDefined();
  });
});
