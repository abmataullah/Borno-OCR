import { describe, it, expect } from 'vitest';
import { findTextItemAtPoint } from '../engine/text-extractor';
import type { ExtractedTextItem } from '../engine/text-extractor';

describe('text-extractor', () => {
  const mockItems: ExtractedTextItem[] = [
    {
      str: 'Hello World',
      transform: [12, 0, 0, 12, 50, 700],
      width: 66,
      height: 12,
      x: 50,
      y: 700,
      fontName: 'Helvetica',
      hasEOL: false,
    },
    {
      str: 'Second Line',
      transform: [12, 0, 0, 12, 50, 680],
      width: 72,
      height: 12,
      x: 50,
      y: 680,
      fontName: 'Helvetica',
      hasEOL: true,
    },
  ];

  it('findTextItemAtPoint should find item at correct coordinates', () => {
    const pageHeight = 800;
    const scale = 1;
    const itemY = pageHeight * scale - 700 * scale - 12 * scale;
    const result = findTextItemAtPoint(mockItems, pageHeight, 55, itemY + 2, scale);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Hello World');
  });

  it('findTextItemAtPoint should return null for empty area', () => {
    const result = findTextItemAtPoint(mockItems, 800, 500, 500, 1);
    expect(result).toBeNull();
  });

  it('findTextItemAtPoint should work with zoom scale', () => {
    const scale = 2;
    const pageHeight = 800;
    const itemY = pageHeight * scale - 700 * scale - 12 * scale;
    const result = findTextItemAtPoint(mockItems, pageHeight, 100, itemY + 4, scale);
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Hello World');
  });
});
