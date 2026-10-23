import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDB, saveProject, loadProject, listProjects, deleteProject } from '../engine/project-storage';
import type { DocFlowProject } from '../types/document-model';
import { SCHEMA_VERSION } from '../types/document-model';

function createMockProject(id: string, name: string): DocFlowProject {
  const now = new Date().toISOString();
  return {
    id,
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

describe('project-storage', () => {
  beforeEach(async () => {
    const db = getDB();
    await db.projects.clear();
  });

  afterEach(async () => {
    const db = getDB();
    await db.projects.clear();
  });

  it('should save and load a project', async () => {
    const project = createMockProject('test-1', 'Test Project');
    await saveProject(project);

    const loaded = await loadProject('test-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.project.name).toBe('Test Project');
    expect(loaded!.project.id).toBe('test-1');
  });

  it('should return null for non-existent project', async () => {
    const loaded = await loadProject('non-existent');
    expect(loaded).toBeNull();
  });

  it('should list projects sorted by updatedAt', async () => {
    const p1 = createMockProject('p1', 'Project 1');
    p1.updatedAt = '2024-01-01T00:00:00Z';
    await saveProject(p1);

    const p2 = createMockProject('p2', 'Project 2');
    p2.updatedAt = '2024-06-01T00:00:00Z';
    await saveProject(p2);

    const projects = await listProjects();
    expect(projects).toHaveLength(2);
    expect(projects[0].project.name).toBe('Project 2');
    expect(projects[1].project.name).toBe('Project 1');
  });

  it('should delete a project', async () => {
    const project = createMockProject('test-delete', 'Delete Me');
    await saveProject(project);

    await deleteProject('test-delete');
    const loaded = await loadProject('test-delete');
    expect(loaded).toBeNull();
  });

  it('should update existing project on re-save', async () => {
    const project = createMockProject('test-update', 'Original');
    await saveProject(project);

    const updated = { ...project, name: 'Updated Name' };
    await saveProject(updated);

    const loaded = await loadProject('test-update');
    expect(loaded!.project.name).toBe('Updated Name');
  });
});
