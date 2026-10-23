import { create } from 'zustand';
import type {
  DocFlowProject,
  Page,
  PageElement,
  EditorMode,
  BoundingBox,
  TextBlock,
  TableElement,
  TableCell,
  TextStyle,
  ListType,
  HeadingLevel,
  TrackChange,
  Comment,
} from '../types/document-model';
import { SCHEMA_VERSION } from '../types/document-model';
import { UndoRedoEngine, createOperation } from '../engine/undo-redo';
import { loadProject } from '../engine/project-storage';
import { saveProjectData, isProjectDeleted } from '../engine/project-service';
import { exportProjectToPdf } from '../engine/pdf-exporter';
import { api } from '../api/client';

export type ToolType = 'select' | 'text' | 'image' | 'shape' | 'draw' | 'sign' | 'table' | 'annotate';

interface EditorState {
  project: DocFlowProject | null;
  cloudProjectId: string | null;
  currentPageIndex: number;
  selectedElementIds: string[];
  selectedElementId: string | null;
  mode: EditorMode;
  zoom: number;
  activeTool: ToolType;
  isDirty: boolean;
  isSaving: boolean;
  isExporting: boolean;
  lastSavedAt: string | null;
  undoRedo: UndoRedoEngine;

  setProject: (project: DocFlowProject | null) => void;
  setCloudProjectId: (id: string | null) => void;
  setMode: (mode: EditorMode) => void;
  setZoom: (zoom: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setCurrentPage: (index: number) => void;
  selectElement: (id: string | null) => void;
  selectElements: (ids: string[]) => void;
  toggleElementSelection: (id: string) => void;
  clearSelection: () => void;
  markDirty: () => void;
  setSaving: (saving: boolean) => void;
  setSaved: () => void;

  addElement: (pageIndex: number, element: PageElement) => void;
  updateElement: (pageIndex: number, elementId: string, updates: Partial<PageElement>) => void;
  deleteElement: (pageIndex: number, elementId: string) => void;
  updateElementBbox: (pageIndex: number, elementId: string, bbox: BoundingBox) => void;
  duplicateElement: (pageIndex: number, elementId: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  updateTextBlock: (pageIndex: number, elementId: string, updates: Partial<TextBlock>) => void;
  addTextBlockAtEnd: (pageIndex: number, text?: string) => string;
  setParagraphListType: (pageIndex: number, elementId: string, paraIdx: number, listType: ListType) => void;
  setParagraphHeading: (pageIndex: number, elementId: string, paraIdx: number, heading: HeadingLevel) => void;
  updateTableCell: (pageIndex: number, elementId: string, rowIndex: number, colIndex: number, value: string) => void;
  setPageMargins: (pageIndex: number, margins: { top: number; bottom: number; left: number; right: number }) => void;
  setPageHeader: (pageIndex: number, header: string) => void;
  setPageFooter: (pageIndex: number, footer: string) => void;
  togglePageNumber: (pageIndex: number, show: boolean) => void;
  addPage: () => void;
  appendPagesToProject: (pages: Page[]) => void;
  addTrackChange: (change: Omit<TrackChange, 'id' | 'timestamp' | 'accepted' | 'rejected'>) => void;
  acceptTrackChange: (changeId: string) => void;
  rejectTrackChange: (changeId: string) => void;
  addComment: (comment: Omit<Comment, 'id' | 'timestamp' | 'resolved'>) => void;
  resolveComment: (commentId: string) => void;
  addCommentReply: (commentId: string, author: string, content: string) => void;
  deleteComment: (commentId: string) => void;

  saveToStorage: () => Promise<void>;
  loadFromStorage: (projectId: string) => Promise<void>;
  exportPdf: () => Promise<void>;
  saveToCloud: () => Promise<void>;
  loadFromCloud: (projectId: string) => Promise<void>;
}

const undoRedoEngine = new UndoRedoEngine();

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  cloudProjectId: null,
  currentPageIndex: 0,
  selectedElementIds: [],
  selectedElementId: null,
  mode: 'pdf-layout',
  zoom: 1.0,
  activeTool: 'select',
  isDirty: false,
  isSaving: false,
  isExporting: false,
  lastSavedAt: null,
  undoRedo: undoRedoEngine,

  setProject: (project) => {
    undoRedoEngine.clear();
    set({ project, currentPageIndex: 0, selectedElementIds: [], selectedElementId: null, isDirty: false, activeTool: 'select' });
  },

  setCloudProjectId: (id) => set({ cloudProjectId: id }),

  setMode: (mode) => set({ mode }),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4.0, zoom)) }),

  setActiveTool: (tool) => set({ activeTool: tool }),

  setCurrentPage: (index) => set({ currentPageIndex: index }),

  selectElement: (id) => set({ selectedElementIds: id ? [id] : [], selectedElementId: id }),

  selectElements: (ids) => set({ selectedElementIds: ids, selectedElementId: ids[0] ?? null }),

  toggleElementSelection: (id) =>
    set((state) => {
      const ids = state.selectedElementIds.includes(id)
        ? state.selectedElementIds.filter(x => x !== id)
        : [...state.selectedElementIds, id];
      return { selectedElementIds: ids, selectedElementId: ids[0] ?? null };
    }),

  clearSelection: () => set({ selectedElementIds: [], selectedElementId: null }),

  markDirty: () => set({ isDirty: true }),

  setSaving: (saving) => set({ isSaving: saving }),

  setSaved: () => set({ isDirty: false, isSaving: false, lastSavedAt: new Date().toISOString() }),

  addElement: (pageIndex, element) =>
    set((state) => {
      if (!state.project) return state;
      const beforeState = structuredClone(state.project);

      const pages = [...state.project.pages];
      const page = { ...pages[pageIndex] };
      // Insert after the currently selected element if one exists on this page
      let insertIdx = page.elements.length;
      if (state.selectedElementId) {
        const selIdx = page.elements.findIndex(e => e.id === state.selectedElementId);
        if (selIdx >= 0) insertIdx = selIdx + 1;
      } else if (state.selectedElementIds.length > 0) {
        const lastSelId = state.selectedElementIds[state.selectedElementIds.length - 1];
        const selIdx = page.elements.findIndex(e => e.id === lastSelId);
        if (selIdx >= 0) insertIdx = selIdx + 1;
      }
      page.elements = [...page.elements.slice(0, insertIdx), element, ...page.elements.slice(insertIdx)];
      pages[pageIndex] = page;

      const afterState = { ...state.project, pages };

      const op = createOperation('add', element.id, { element });
      undoRedoEngine.push(op, beforeState, afterState);

      return {
        project: afterState,
        isDirty: true,
        selectedElementIds: [element.id],
        selectedElementId: element.id,
      };
    }),

  updateElement: (pageIndex, elementId, updates) =>
    set((state) => {
      if (!state.project) return state;
      const beforeState = structuredClone(state.project);

      const pages = [...state.project.pages];
      const page = { ...pages[pageIndex] };
      page.elements = page.elements.map((el) =>
        el.id === elementId ? ({ ...el, ...updates } as PageElement) : el
      );
      pages[pageIndex] = page;

      const afterState = { ...state.project, pages };

      const op = createOperation('update', elementId, updates);
      undoRedoEngine.push(op, beforeState, afterState);

      return { project: afterState, isDirty: true };
    }),

  deleteElement: (pageIndex, elementId) =>
    set((state) => {
      if (!state.project) return state;
      const beforeState = structuredClone(state.project);

      const pages = [...state.project.pages];
      const page = { ...pages[pageIndex] };
      page.elements = page.elements.filter((el) => el.id !== elementId);
      pages[pageIndex] = page;

      const afterState = { ...state.project, pages };

      const op = createOperation('delete', elementId);
      undoRedoEngine.push(op, beforeState, afterState);

      return {
        project: afterState,
        isDirty: true,
        selectedElementIds: state.selectedElementIds.filter(id => id !== elementId),
        selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId,
      };
    }),

  updateElementBbox: (pageIndex, elementId, bbox) =>
    set((state) => {
      if (!state.project) return state;
      const pages = [...state.project.pages];
      const page = { ...pages[pageIndex] };
      page.elements = page.elements.map((el) =>
        el.id === elementId ? ({ ...el, bbox } as PageElement) : el
      );
      pages[pageIndex] = page;
      return { project: { ...state.project, pages }, isDirty: true };
    }),

  duplicateElement: (pageIndex, elementId) => {
    const state = get();
    if (!state.project) return;
    const page = state.project.pages[pageIndex];
    const element = page.elements.find((e) => e.id === elementId);
    if (!element) return;
    const clone = structuredClone(element);
    clone.id = crypto.randomUUID();
    clone.bbox = { ...clone.bbox, x: clone.bbox.x + 20, y: clone.bbox.y + 20 };
    get().addElement(pageIndex, clone);
  },

  undo: () => {
    const entry = undoRedoEngine.undo();
    if (entry) {
      set({ project: structuredClone(entry.beforeState), isDirty: true, selectedElementIds: [], selectedElementId: null });
    }
  },

  redo: () => {
    const entry = undoRedoEngine.redo();
    if (entry) {
      set({ project: structuredClone(entry.afterState), isDirty: true, selectedElementIds: [], selectedElementId: null });
    }
  },

  canUndo: () => undoRedoEngine.canUndo(),
  canRedo: () => undoRedoEngine.canRedo(),

  updateTextBlock: (pageIndex, elementId, updates) =>
    get().updateElement(pageIndex, elementId, updates as Partial<PageElement>),

  addTextBlockAtEnd: (pageIndex, text = '') => {
    const state = get();
    if (!state.project) return '';
    const page = state.project.pages[pageIndex];
    if (!page) return '';
    const id = crypto.randomUUID();
    const defaultStyle: TextStyle = {
      fontId: 'inter-regular',
      fontSize: 12,
      fontWeight: 400,
      fontStyle: 'normal',
      color: '#000000',
      opacity: 1,
      underline: false,
      strikethrough: false,
      alignment: 'left',
      direction: 'ltr',
      lineHeight: 1.5,
      letterSpacing: 0,
      language: 'en',
    };
    const block: TextBlock = {
      id,
      type: 'text',
      bbox: { x: 72, y: page.elements.length * 30 + 72, width: page.width - 144, height: 40 },
      transform: { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0 },
      zIndex: page.elements.length,
      locked: false,
      visible: true,
      sourceType: 'added',
      confidence: null,
      paragraphs: [{
        id: crypto.randomUUID(),
        runs: [{ text, style: defaultStyle }],
        alignment: 'left',
        direction: 'ltr',
        lineHeight: 1.5,
        spaceBefore: 0,
        spaceAfter: 8,
        indent: 0,
      }],
      style: {},
      overflow: 'visible',
    };
    get().addElement(pageIndex, block);
    return id;
  },

  setParagraphListType: (pageIndex, elementId, paraIdx, listType) => {
    const state = get();
    if (!state.project) return;
    const page = state.project.pages[pageIndex];
    const el = page?.elements.find(e => e.id === elementId);
    if (!el || el.type !== 'text') return;
    const block = el as TextBlock;
    const paragraphs = block.paragraphs.map((p, pi) =>
      pi === paraIdx ? { ...p, listType } : p
    );
    get().updateElement(pageIndex, elementId, { paragraphs } as Partial<TextBlock>);
  },

  setParagraphHeading: (pageIndex, elementId, paraIdx, heading) => {
    const state = get();
    if (!state.project) return;
    const page = state.project.pages[pageIndex];
    const el = page?.elements.find(e => e.id === elementId);
    if (!el || el.type !== 'text') return;
    const block = el as TextBlock;
    const headingStyles: Record<string, Partial<TextStyle>> = {
      h1: { fontSize: 24, fontWeight: 700 },
      h2: { fontSize: 20, fontWeight: 700 },
      h3: { fontSize: 16, fontWeight: 600 },
      none: { fontSize: 12, fontWeight: 400 },
    };
    const hs = headingStyles[heading] ?? {};
    const paragraphs = block.paragraphs.map((p, pi) => {
      if (pi !== paraIdx) return p;
      const runs = p.runs.map(r => ({ ...r, style: { ...r.style, ...hs } }));
      return { ...p, runs, headingLevel: heading };
    });
    get().updateElement(pageIndex, elementId, { paragraphs } as Partial<TextBlock>);
  },

  updateTableCell: (pageIndex, elementId, rowIndex, colIndex, value) => {
    const state = get();
    if (!state.project) return;
    const page = state.project.pages[pageIndex];
    const el = page?.elements.find(e => e.id === elementId);
    if (!el || el.type !== 'table') return;
    const table = el as TableElement;
    const cells: TableCell[] = table.cells.map(c =>
      c.rowIndex === rowIndex && c.colIndex === colIndex
        ? { ...c, value }
        : c
    );
    get().updateElement(pageIndex, elementId, { cells } as Partial<TableElement>);
  },

  setPageMargins: (pageIndex, margins) => {
    const state = get();
    if (!state.project) return;
    const pages = state.project.pages.map((p, i) =>
      i === pageIndex ? { ...p, margins } : p
    );
    set({ project: { ...state.project, pages }, isDirty: true });
  },

  setPageHeader: (pageIndex, header) => {
    const state = get();
    if (!state.project) return;
    const pages = state.project.pages.map((p, i) =>
      i === pageIndex ? { ...p, header } : p
    );
    set({ project: { ...state.project, pages }, isDirty: true });
  },

  setPageFooter: (pageIndex, footer) => {
    const state = get();
    if (!state.project) return;
    const pages = state.project.pages.map((p, i) =>
      i === pageIndex ? { ...p, footer } : p
    );
    set({ project: { ...state.project, pages }, isDirty: true });
  },

  togglePageNumber: (pageIndex, show) => {
    const state = get();
    if (!state.project) return;
    const pages = state.project.pages.map((p, i) =>
      i === pageIndex ? { ...p, showPageNumber: show } : p
    );
    set({ project: { ...state.project, pages }, isDirty: true });
  },

  addPage: () => {
    const state = get();
    if (!state.project) return;
    const lastPage = state.project.pages[state.project.pages.length - 1];
    const newPage = {
      id: crypto.randomUUID(),
      index: state.project.pages.length,
      width: lastPage?.width ?? 595,
      height: lastPage?.height ?? 841,
      rotation: 0 as const,
      pageType: 'digital' as const,
      backgroundRef: '',
      elements: [],
      confidence: 100,
      margins: lastPage?.margins ?? { top: 72, bottom: 72, left: 72, right: 72 },
    };
    set({
      project: { ...state.project, pages: [...state.project.pages, newPage] },
      currentPageIndex: state.project.pages.length,
      isDirty: true,
    });
  },

  appendPagesToProject: (pages) => {
    const state = get();
    if (!state.project) return;
    const baseIndex = state.project.pages.length;
    const reindexed = pages.map((p, i) => ({ ...p, index: baseIndex + i }));
    const allPages = [...state.project.pages, ...reindexed];
    set({
      project: {
        ...state.project,
        pages: allPages,
        metadata: {
          ...state.project.metadata,
          pageCount: allPages.length,
          totalElements: allPages.reduce((s, p) => s + p.elements.length, 0),
          hasScannedPages: allPages.some((p) => p.pageType === 'scanned'),
        },
      },
      isDirty: true,
    });
  },

  addTrackChange: (change) => {
    const state = get();
    if (!state.project) return;
    const tc: TrackChange = {
      ...change,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      accepted: false,
      rejected: false,
    };
    const trackChanges = [...(state.project.trackChanges ?? []), tc];
    set({ project: { ...state.project, trackChanges }, isDirty: true });
  },

  acceptTrackChange: (changeId) => {
    const state = get();
    if (!state.project?.trackChanges) return;
    const trackChanges = state.project.trackChanges.map(tc =>
      tc.id === changeId ? { ...tc, accepted: true } : tc
    );
    set({ project: { ...state.project, trackChanges }, isDirty: true });
  },

  rejectTrackChange: (changeId) => {
    const state = get();
    if (!state.project?.trackChanges) return;
    const trackChanges = state.project.trackChanges.map(tc =>
      tc.id === changeId ? { ...tc, rejected: true } : tc
    );
    set({ project: { ...state.project, trackChanges }, isDirty: true });
  },

  addComment: (comment) => {
    const state = get();
    if (!state.project) return;
    const c: Comment = {
      ...comment,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    const comments = [...(state.project.comments ?? []), c];
    set({ project: { ...state.project, comments }, isDirty: true });
  },

  resolveComment: (commentId) => {
    const state = get();
    if (!state.project?.comments) return;
    const comments = state.project.comments.map(c =>
      c.id === commentId ? { ...c, resolved: !c.resolved } : c
    );
    set({ project: { ...state.project, comments }, isDirty: true });
  },

  addCommentReply: (commentId, author, content) => {
    const state = get();
    if (!state.project?.comments) return;
    const comments = state.project.comments.map(c =>
      c.id === commentId
        ? {
            ...c,
            replies: [...(c.replies ?? []), {
              id: crypto.randomUUID(),
              author,
              content,
              timestamp: new Date().toISOString(),
            }],
          }
        : c
    );
    set({ project: { ...state.project, comments }, isDirty: true });
  },

  deleteComment: (commentId) => {
    const state = get();
    if (!state.project?.comments) return;
    const comments = state.project.comments.filter(c => c.id !== commentId);
    set({ project: { ...state.project, comments }, isDirty: true });
  },

  saveToStorage: async () => {
    const { project } = get();
    if (!project) return;
    if (isProjectDeleted(project.id)) {
      console.log('[editor-store] skipping save for deleted project:', project.id);
      return;
    }
    set({ isSaving: true });
    try {
      await saveProjectData(project);
      set({ isDirty: false, isSaving: false, lastSavedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Save failed:', err);
      set({ isSaving: false });
    }
  },

  loadFromStorage: async (projectId) => {
    try {
      const stored = await loadProject(projectId);
      if (stored) {
        undoRedoEngine.clear();
        set({ project: stored.project, currentPageIndex: 0, selectedElementId: null, isDirty: false });
      }
    } catch (err) {
      console.error('Load failed:', err);
    }
  },

  exportPdf: async () => {
    const { project } = get();
    if (!project) return;
    set({ isExporting: true });
    try {
      const bytes = await exportProjectToPdf(project);
      const arrayBuffer = new ArrayBuffer(bytes.length);
      const view = new Uint8Array(arrayBuffer);
      view.set(bytes);
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = project.name.endsWith('.pdf') ? project.name : `${project.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      set({ isExporting: false });
    }
  },

  saveToCloud: async () => {
    const { project, cloudProjectId } = get();
    if (!project) return;
    set({ isSaving: true });
    try {
      const data = {
        id: project.id,
        name: project.name,
        pageCount: project.pages.length,
        projectData: project as unknown as Record<string, unknown>,
      };
      if (cloudProjectId) {
        await api.projects.update(cloudProjectId, data);
      } else {
        const created = await api.projects.create(data);
        set({ cloudProjectId: created.id });
      }
      set({ isDirty: false, isSaving: false, lastSavedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Cloud save failed:', err);
      set({ isSaving: false });
    }
  },

  loadFromCloud: async (projectId) => {
    set({ isSaving: true });
    try {
      const cloudProject = await api.projects.get(projectId);
      if (cloudProject.projectData) {
        const loadedProject = cloudProject.projectData as unknown as DocFlowProject;
        undoRedoEngine.clear();
        set({
          project: loadedProject,
          cloudProjectId: projectId,
          currentPageIndex: 0,
          selectedElementId: null,
          isDirty: false,
        });
      } else {
        // New project with no data yet — create a default blank page
        const now = new Date().toISOString();
        const blankProject: DocFlowProject = {
          id: projectId,
          schemaVersion: SCHEMA_VERSION,
          name: cloudProject.name,
          locale: 'en',
          createdAt: now,
          updatedAt: now,
          originalPdfRef: '',
          pageRenderRefs: [],
          pages: [{
            id: crypto.randomUUID(),
            index: 0,
            width: 595,
            height: 841,
            rotation: 0,
            pageType: 'digital',
            backgroundRef: '',
            elements: [],
            confidence: 100,
          }],
          fonts: [],
          history: [],
          metadata: {
            pageCount: 1,
            totalElements: 0,
            languages: ['en'],
            hasTables: false,
            hasForms: false,
            hasScannedPages: false,
          },
        };
        undoRedoEngine.clear();
        set({
          project: blankProject,
          cloudProjectId: projectId,
          currentPageIndex: 0,
          selectedElementId: null,
          isDirty: false,
        });
      }
    } catch (err) {
      console.error('Cloud load failed:', err);
    } finally {
      set({ isSaving: false });
    }
  },
}));
