import { describe, it, expect } from 'vitest';
import { detectLanguage, getDirectionForLanguage, isComplexScript } from '../engine/text-shaper';

describe('text-shaper', () => {
  describe('detectLanguage', () => {
    it('should detect Bengali text', () => {
      expect(detectLanguage('আমার নাম')).toBe('bn');
    });

    it('should detect English text', () => {
      expect(detectLanguage('Hello World')).toBe('en');
    });

    it('should detect Arabic text', () => {
      expect(detectLanguage('مرحبا')).toBe('ar');
    });

    it('should detect Hindi text', () => {
      expect(detectLanguage('नमस्ते')).toBe('hi');
    });

    it('should default to English for mixed text', () => {
      expect(detectLanguage('Hello 123')).toBe('en');
    });
  });

  describe('getDirectionForLanguage', () => {
    it('should return rtl for Arabic', () => {
      expect(getDirectionForLanguage('ar')).toBe('rtl');
    });

    it('should return rtl for Farsi', () => {
      expect(getDirectionForLanguage('fa')).toBe('rtl');
    });

    it('should return ltr for English', () => {
      expect(getDirectionForLanguage('en')).toBe('ltr');
    });

    it('should return ltr for Bengali', () => {
      expect(getDirectionForLanguage('bn')).toBe('ltr');
    });
  });

  describe('isComplexScript', () => {
    it('should return true for Bengali', () => {
      expect(isComplexScript('আমার নাম')).toBe(true);
    });

    it('should return false for English', () => {
      expect(isComplexScript('Hello World')).toBe(false);
    });

    it('should return true for Arabic', () => {
      expect(isComplexScript('مرحبا')).toBe(true);
    });
  });
});
