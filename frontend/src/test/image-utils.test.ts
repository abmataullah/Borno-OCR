import { describe, it, expect } from 'vitest';
import {
  validateImageFile,
  resizeImageKeepingAspect,
  createSignatureElement,
} from '../engine/image-utils';

describe('image-utils', () => {
  describe('validateImageFile', () => {
    it('should accept PNG files', () => {
      const file = new File([''], 'test.png', { type: 'image/png' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should accept JPEG files', () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject unsupported formats', () => {
      const file = new File([''], 'test.gif', { type: 'image/gif' });
      const result = validateImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('should reject files that are too large', () => {
      const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.png', { type: 'image/png' });
      const result = validateImageFile(bigFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too large');
    });
  });

  describe('resizeImageKeepingAspect', () => {
    it('should resize by width keeping aspect ratio', () => {
      const result = resizeImageKeepingAspect(800, 600, 400);
      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
    });

    it('should resize by height keeping aspect ratio', () => {
      const result = resizeImageKeepingAspect(800, 600, undefined, 300);
      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
    });

    it('should use both dimensions when provided', () => {
      const result = resizeImageKeepingAspect(800, 600, 200, 200);
      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
    });

    it('should return original dimensions when no target given', () => {
      const result = resizeImageKeepingAspect(800, 600);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('createSignatureElement', () => {
    it('should create a signature element with correct properties', () => {
      const el = createSignatureElement('data:image/png;base64,abc', 100, 200, 300, 100);
      expect(el.type).toBe('signature');
      expect(el.src).toBe('data:image/png;base64,abc');
      expect(el.format).toBe('drawn');
      expect(el.bbox.x).toBe(100);
      expect(el.bbox.y).toBe(200);
      expect(el.bbox.width).toBe(300);
      expect(el.bbox.height).toBe(100);
      expect(el.sourceType).toBe('added');
    });
  });
});
