/**
 * Unified Project Service
 *
 * IndexedDB is the primary store. Backend syncs in the background when available.
 * All project CRUD goes through this single service — no scattered save/delete calls.
 */

import type { DocFlowProject } from '@model/document-model';
import { SCHEMA_VERSION } from '@model/document-model';
import {
  saveProject as idbSave,
  loadProject as idbLoad,
  listProjects as idbList,
  deleteProject as idbDelete,
  clearAllProjects as idbClearAll,
  countProjects as idbCount,
} from '@engine/project-storage';
import { api } from '@api/client';

// ── Types ─────────────────────────────────────────────

export interface ProjectMeta {
  id: string;
  name: string;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
  isShared: boolean;
  shareToken: string | null;
}

// ── Deleted tracking ──────────────────────────────────

const deletedIds = new Set<string>();

function isDeleted(id: string): boolean {
  return deletedIds.has(id);
}

// ── Backend availability ──────────────────────────────

let backendAvailable: boolean | null = null;
let lastBackendCheck = 0;
const BACKEND_CHECK_THROTTLE_MS = 60_000; // Only check once per minute

async function checkBackend(): Promise<boolean> {
  const now = Date.now();
  if (backendAvailable !== null && (now - lastBackendCheck) < BACKEND_CHECK_THROTTLE_MS) {
    return backendAvailable;
  }
  lastBackendCheck = now;
  try {
    await api.auth.me();
    backendAvailable = true;
  } catch {
    backendAvailable = false;
  }
  return backendAvailable;
}

// Reset cache when tab regains focus (but still throttled)
if (typeof window !== 'undefined') {
  window.addEventListener('focus', () => {
    const now = Date.now();
    if (now - lastBackendCheck > BACKEND_CHECK_THROTTLE_MS) {
      backendAvailable = null;
    }
  });
}

// ── Backend sync throttling ───────────────────────────

const lastSyncPerProject = new Map<string, number>();
const SYNC_THROTTLE_MS = 30_000; // Only sync each project to backend once per 30s

function shouldSync(projectId: string): boolean {
  const now = Date.now();
  const last = lastSyncPerProject.get(projectId) ?? 0;
  if (now - last < SYNC_THROTTLE_MS) return false;
  lastSyncPerProject.set(projectId, now);
  return true;
}

let listSyncDone = false; // Only sync list once per page load

// ── Public API ────────────────────────────────────────

/**
 * List all projects. Reads from IndexedDB (primary).
 * If backend is available, syncs any cloud-only projects down.
 */
export async function listAllProjects(): Promise<ProjectMeta[]> {
  const local = await idbList();

  // Always return local projects immediately
  const metas: ProjectMeta[] = local.map((sp) => ({
    id: sp.id,
    name: sp.project.name,
    pageCount: sp.project.metadata?.pageCount ?? sp.project.pages.length,
    createdAt: sp.createdAt,
    updatedAt: sp.updatedAt,
    isShared: false,
    shareToken: null,
  }));

  // Try backend sync in background (non-blocking, throttled, once per page load)
  if (!listSyncDone) {
    listSyncDone = true;
    checkBackend().then(async (available) => {
      if (!available) return;
      try {
        const cloudProjects = await api.projects.list();
        // Merge: add cloud projects not in local
        for (const cp of cloudProjects) {
          if (!local.some((lp) => lp.id === cp.id) && !isDeleted(cp.id)) {
            // Cloud-only project — fetch full data and save locally
            try {
              const full = await api.projects.get(cp.id);
              if (full.projectData) {
                const proj = full.projectData as unknown as DocFlowProject;
                await idbSave(proj);
              }
            } catch { /* ignore individual failures */ }
          }
        }
      } catch { /* backend list failed — ignore */ }
    }).catch(() => {});
  }

  return metas.filter((m) => !isDeleted(m.id));
}

/**
 * Create a new empty project.
 * Saves to IndexedDB immediately. Syncs to backend in background.
 */
export async function createProject(name?: string): Promise<DocFlowProject> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const project: DocFlowProject = {
    id,
    schemaVersion: SCHEMA_VERSION,
    name: name ?? 'Untitled Project',
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

  await idbSave(project);

  // Background sync to backend
  checkBackend().then(async (available) => {
    if (!available) return;
    try {
      await api.projects.create({
        id: project.id,
        name: project.name,
        pageCount: project.pages.length,
        projectData: project as unknown as Record<string, unknown>,
      });
    } catch { /* ignore */ }
  }).catch(() => {});

  return project;
}

/**
 * Save a project. Always saves to IndexedDB.
 * Syncs to backend in background if available.
 * Skips saving if project is marked as deleted.
 */
export async function saveProjectData(project: DocFlowProject): Promise<void> {
  if (isDeleted(project.id)) {
    console.log('[project-service] skipping save for deleted project:', project.id);
    return;
  }

  // Always save to IndexedDB (primary)
  await idbSave(project);

  // Background sync to backend (non-blocking, throttled per project)
  if (shouldSync(project.id)) {
    checkBackend().then(async (available) => {
      if (!available) return;
      try {
        const data = {
          name: project.name,
          pageCount: project.pages.length,
          projectData: project as unknown as Record<string, unknown>,
        };
        // Try update first, if it fails try create with the same id
        try {
          await api.projects.update(project.id, data);
        } catch {
          await api.projects.create({
            id: project.id,
            name: project.name,
            pageCount: project.pages.length,
            projectData: project as unknown as Record<string, unknown>,
          });
        }
      } catch { /* ignore */ }
    }).catch(() => {});
  }
}

/**
 * Load a single project by ID.
 * Reads from IndexedDB first, falls back to backend.
 */
export async function loadProjectData(projectId: string): Promise<DocFlowProject | null> {
  if (isDeleted(projectId)) return null;

  // Try IndexedDB first
  const local = await idbLoad(projectId);
  if (local) return local.project;

  // Fall back to backend
  try {
    const cloudProject = await api.projects.get(projectId);
    if (cloudProject.projectData) {
      const project = cloudProject.projectData as unknown as DocFlowProject;
      // Save to IndexedDB for future use
      await idbSave(project);
      return project;
    }
    // Cloud project exists but has no data — create blank
    if (cloudProject.name) {
      return createProject(cloudProject.name);
    }
  } catch { /* backend unavailable */ }

  return null;
}

/**
 * Delete a project permanently.
 * Removes from IndexedDB, backend, and marks as deleted
 * to prevent any future saves.
 */
export async function deleteProjectData(projectId: string): Promise<void> {
  // Mark as deleted FIRST to prevent any race condition saves
  deletedIds.add(projectId);
  console.log('[project-service] marked deleted:', projectId);

  // Delete from IndexedDB
  try {
    await idbDelete(projectId);
    console.log('[project-service] removed from IndexedDB:', projectId);
  } catch (e) {
    console.error('[project-service] failed to remove from IndexedDB:', projectId, e);
  }

  // Delete from backend
  try {
    await api.projects.delete(projectId);
    console.log('[project-service] removed from backend:', projectId);
  } catch (e) {
    // Backend may not be available — that's fine
    console.log('[project-service] backend delete skipped (unavailable):', projectId);
  }
}

/**
 * Delete all projects.
 * Wipes IndexedDB projects table and tries to delete all from backend.
 */
export async function deleteAllProjects(): Promise<void> {
  const local = await idbList();

  // Mark all as deleted first
  for (const sp of local) {
    deletedIds.add(sp.id);
  }
  console.log('[project-service] marked all deleted:', local.length, 'projects');

  // Wipe IndexedDB
  try {
    await idbClearAll();
    console.log('[project-service] IndexedDB cleared');
  } catch (e) {
    console.error('[project-service] failed to clear IndexedDB:', e);
  }

  // Try deleting from backend
  checkBackend().then(async (available) => {
    if (!available) return;
    for (const sp of local) {
      try {
        await api.projects.delete(sp.id);
      } catch { /* ignore */ }
    }
    console.log('[project-service] backend cleanup done');
  }).catch(() => {});
}

/**
 * Get the count of projects in IndexedDB (for diagnostics).
 */
export async function countAllProjects(): Promise<number> {
  return idbCount();
}

/**
 * Rename a project. Updates IndexedDB and syncs to backend.
 */
export async function renameProjectData(projectId: string, newName: string): Promise<void> {
  if (isDeleted(projectId)) return;
  const trimmed = newName.trim();
  if (!trimmed) return;

  const local = await idbLoad(projectId);
  if (local) {
    local.project.name = trimmed;
    local.project.updatedAt = new Date().toISOString();
    await idbSave(local.project);
  }

  if (shouldSync(projectId)) {
    checkBackend().then(async (available) => {
      if (!available) return;
      try {
        await api.projects.update(projectId, { name: trimmed });
      } catch { /* ignore */ }
    }).catch(() => {});
  }
}

/**
 * Check if a project ID has been deleted.
 */
export function isProjectDeleted(id: string): boolean {
  return isDeleted(id);
}
