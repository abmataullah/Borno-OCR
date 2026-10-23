import { describe, it, expect } from 'vitest';

describe('pdf-renderer', () => {
  it('loadPdf should be a function', async () => {
    const mod = await import('../engine/pdf-renderer');
    expect(typeof mod.loadPdf).toBe('function');
  });

  it('renderPage should be a function', async () => {
    const mod = await import('../engine/pdf-renderer');
    expect(typeof mod.renderPage).toBe('function');
  });

  it('renderThumbnail should be a function', async () => {
    const mod = await import('../engine/pdf-renderer');
    expect(typeof mod.renderThumbnail).toBe('function');
  });

  it('loadPdf should reject for invalid data', async () => {
    const mod = await import('../engine/pdf-renderer');
    const fakeFile = new File(['not a pdf'], 'fake.pdf', { type: 'application/pdf' });
    await expect(mod.loadPdf(fakeFile)).rejects.toThrow();
  });
});
