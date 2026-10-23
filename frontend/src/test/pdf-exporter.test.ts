import { describe, it, expect } from 'vitest';
import { exportProjectToPdf } from '../engine/pdf-exporter';
import type { DocFlowProject } from '../types/document-model';
import { SCHEMA_VERSION } from '../types/document-model';

function createMockProject(): DocFlowProject {
  const now = new Date().toISOString();
  return {
    id: 'export-test',
    schemaVersion: SCHEMA_VERSION,
    name: 'Export Test',
    locale: 'en',
    createdAt: now,
    updatedAt: now,
    originalPdfRef: 'test.pdf',
    pageRenderRefs: [],
    pages: [
      {
        id: 'page-1',
        index: 0,
        width: 595,
        height: 842,
        rotation: 0,
        pageType: 'digital',
        backgroundRef: '',
        elements: [],
        confidence: 100,
      },
    ],
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
}

describe('pdf-exporter', () => {
  it('exportProjectToPdf should produce a valid PDF', async () => {
    const project = createMockProject();
    const bytes = await exportProjectToPdf(project);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
    expect(header).toBe('%PDF');
  });

  it('exportProjectToPdf should handle empty project', async () => {
    const project = createMockProject();
    project.pages = [];
    const bytes = await exportProjectToPdf(project);
    expect(bytes.length).toBeGreaterThan(0);
    const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
    expect(header).toBe('%PDF');
  });
});
