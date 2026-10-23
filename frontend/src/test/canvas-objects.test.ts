import { describe, it, expect } from 'vitest';
import {
  createDefaultTransform,
  createDefaultBBox,
  createTextBlockElement,
  createShapeElement,
} from '../engine/canvas-objects';

describe('canvas-objects', () => {
  describe('createDefaultTransform', () => {
    it('should return identity transform', () => {
      const t = createDefaultTransform();
      expect(t.rotate).toBe(0);
      expect(t.scaleX).toBe(1);
      expect(t.scaleY).toBe(1);
      expect(t.skewX).toBe(0);
      expect(t.skewY).toBe(0);
    });
  });

  describe('createDefaultBBox', () => {
    it('should return default bbox', () => {
      const b = createDefaultBBox();
      expect(b.x).toBe(0);
      expect(b.y).toBe(0);
      expect(b.width).toBe(200);
      expect(b.height).toBe(50);
    });

    it('should accept custom values', () => {
      const b = createDefaultBBox(10, 20, 100, 200);
      expect(b.x).toBe(10);
      expect(b.y).toBe(20);
      expect(b.width).toBe(100);
      expect(b.height).toBe(200);
    });
  });

  describe('createTextBlockElement', () => {
    it('should create a text block with correct properties', () => {
      const bbox = createDefaultBBox(50, 50, 300, 40);
      const el = createTextBlockElement('test-1', 'Hello World', bbox, 16, '#ff0000');
      expect(el.id).toBe('test-1');
      expect(el.type).toBe('text');
      expect(el.bbox).toEqual(bbox);
      expect(el.paragraphs).toHaveLength(1);
      expect(el.paragraphs[0].runs[0].text).toBe('Hello World');
      expect(el.paragraphs[0].runs[0].style.fontSize).toBe(16);
      expect(el.paragraphs[0].runs[0].style.color).toBe('#ff0000');
      expect(el.sourceType).toBe('added');
    });
  });

  describe('createShapeElement', () => {
    it('should create a rectangle shape', () => {
      const bbox = createDefaultBBox(10, 10, 100, 100);
      const el = createShapeElement('shape-1', 'rectangle', bbox);
      expect(el.id).toBe('shape-1');
      expect(el.type).toBe('shape');
      expect(el.shapeType).toBe('rectangle');
      expect(el.stroke).toBe('#d4af37');
    });

    it('should create an ellipse with custom colors', () => {
      const bbox = createDefaultBBox(10, 10, 100, 100);
      const el = createShapeElement('shape-2', 'ellipse', bbox, '#ff0000', '#000000', 3);
      expect(el.shapeType).toBe('ellipse');
      expect(el.fill).toBe('#ff0000');
      expect(el.stroke).toBe('#000000');
      expect(el.strokeWidth).toBe(3);
    });
  });
});
