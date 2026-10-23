import { describe, it, expect } from 'vitest';
import { generateTestPdf, TEST_DOCUMENTS } from '../engine/test-pdf-generator';

describe('test-pdf-generator', () => {
  it('should have 11 test documents defined', () => {
    expect(TEST_DOCUMENTS).toHaveLength(11);
  });

  it.each(TEST_DOCUMENTS)('should generate valid PDF for document $id: $name', async (doc) => {
    const bytes = await generateTestPdf(doc.id);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
    const header = String.fromCharCode(...Array.from(bytes.slice(0, 4)));
    expect(header).toBe('%PDF');
  });

  it('should generate multi-page document for id=1', async () => {
    const bytes = await generateTestPdf(1);
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('should generate 20-page document for id=11', async () => {
    const bytes = await generateTestPdf(11);
    expect(bytes.length).toBeGreaterThan(2000);
  });

  it('should generate invoice with table for id=8', async () => {
    const bytes = await generateTestPdf(8);
    expect(bytes.length).toBeGreaterThan(300);
  });
});
