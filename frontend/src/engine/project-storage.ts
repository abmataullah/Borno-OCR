import Dexie, { type Table } from 'dexie';
import type { DocFlowProject } from '@model/document-model';

export interface StoredProject {
  id: string;
  project: DocFlowProject;
  pdfBlob?: Blob;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFont {
  id: string;
  name: string;
  family: string;
  data: ArrayBuffer;
  format: 'ttf' | 'otf' | 'woff' | 'woff2';
  language: string;
}

class DocFlowDB extends Dexie {
  projects!: Table<StoredProject, string>;
  fonts!: Table<StoredFont, string>;

  constructor() {
    super('docflow');
    this.version(1).stores({
      projects: 'id, updatedAt',
      fonts: 'id, family, language',
    });
  }
}

let dbInstance: DocFlowDB | null = null;

export function getDB(): DocFlowDB {
  if (!dbInstance) {
    dbInstance = new DocFlowDB();
  }
  return dbInstance;
}

export async function saveProject(project: DocFlowProject, pdfBlob?: Blob): Promise<void> {
  const db = getDB();
  const existing = await db.projects.get(project.id);
  const now = new Date().toISOString();

  await db.projects.put({
    id: project.id,
    project,
    pdfBlob,
    thumbnail: existing?.thumbnail,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function loadProject(projectId: string): Promise<StoredProject | null> {
  const db = getDB();
  const result = await db.projects.get(projectId);
  return result ?? null;
}

export async function listProjects(): Promise<StoredProject[]> {
  const db = getDB();
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = getDB();
  await db.projects.delete(projectId);
}

export async function saveFont(font: StoredFont): Promise<void> {
  const db = getDB();
  await db.fonts.put(font);
}

export async function loadFont(fontId: string): Promise<StoredFont | null> {
  const db = getDB();
  const result = await db.fonts.get(fontId);
  return result ?? null;
}

export async function loadFontsByLanguage(language: string): Promise<StoredFont[]> {
  const db = getDB();
  return db.fonts.where('language').equals(language).toArray();
}

export async function deleteFont(fontId: string): Promise<void> {
  const db = getDB();
  await db.fonts.delete(fontId);
}

export async function saveProjectThumbnail(projectId: string, thumbnail: string): Promise<void> {
  const db = getDB();
  const existing = await db.projects.get(projectId);
  if (existing) {
    await db.projects.put({
      ...existing,
      thumbnail,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return { usage: 0, quota: 0 };
}

export async function clearAllData(): Promise<void> {
  const db = getDB();
  await db.projects.clear();
  await db.fonts.clear();
}

export async function clearAllProjects(): Promise<void> {
  const db = getDB();
  await db.projects.clear();
}

export async function countProjects(): Promise<number> {
  const db = getDB();
  return db.projects.count();
}
