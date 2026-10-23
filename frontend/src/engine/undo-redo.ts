import type { DocFlowProject, OperationEntry } from '@model/document-model';

const MAX_HISTORY = 100;

export interface HistoryEntry {
  operation: OperationEntry;
  beforeState: DocFlowProject;
  afterState: DocFlowProject;
  timestamp: string;
}

export class UndoRedoEngine {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = MAX_HISTORY) {
    this.maxHistory = maxHistory;
  }

  push(operation: OperationEntry, beforeState: DocFlowProject, afterState: DocFlowProject): void {
    const entry: HistoryEntry = {
      operation,
      beforeState: structuredClone(beforeState),
      afterState: structuredClone(afterState),
      timestamp: new Date().toISOString(),
    };

    this.undoStack.push(entry);

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    return entry;
  }

  redo(): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    return entry;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoCount(): number {
    return this.undoStack.length;
  }

  getRedoCount(): number {
    return this.redoStack.length;
  }

  getUndoStack(): readonly HistoryEntry[] {
    return this.undoStack;
  }

  getRedoStack(): readonly HistoryEntry[] {
    return this.redoStack;
  }

  toJSON(): string {
    return JSON.stringify({
      undoStack: this.undoStack,
      redoStack: this.redoStack,
    });
  }

  fromJSON(json: string): void {
    const data = JSON.parse(json);
    this.undoStack = data.undoStack ?? [];
    this.redoStack = data.redoStack ?? [];
  }
}

export function createOperation(
  type: string,
  targetId: string,
  patch: Record<string, unknown> = {},
  inversePatch: Record<string, unknown> = {}
): OperationEntry {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    targetId,
    patch,
    inversePatch,
  };
}
