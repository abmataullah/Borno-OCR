import { describe, it, expect } from 'vitest';
import {
  BUNDLED_FONTS,
  getFontsByLanguage,
  getFontsByScript,
  getFontById,
  getFontFamilyOptions,
} from '../engine/font-registry';

describe('font-registry', () => {
  describe('BUNDLED_FONTS', () => {
    it('should include Noto Sans Bengali', () => {
      const noto = BUNDLED_FONTS.find((f) => f.id === 'noto-sans-bengali-regular');
      expect(noto).toBeDefined();
      expect(noto!.family).toBe('Noto Sans Bengali');
      expect(noto!.license).toBe('SIL OFL 1.1');
      expect(noto!.supportsScripts).toContain('bengali');
    });

    it('should include Siyam Rupali', () => {
      const siyam = BUNDLED_FONTS.find((f) => f.id === 'siyam-rupali-regular');
      expect(siyam).toBeDefined();
      expect(siyam!.family).toBe('Siyam Rupali');
      expect(siyam!.license).toBe('SIL OFL 1.1');
    });

    it('should include Kalpurush', () => {
      const kalpurush = BUNDLED_FONTS.find((f) => f.id === 'kalpurush-regular');
      expect(kalpurush).toBeDefined();
      expect(kalpurush!.family).toBe('Kalpurush');
    });

    it('should include SolaimanLipi', () => {
      const solaiman = BUNDLED_FONTS.find((f) => f.id === 'solaiman-lipi-regular');
      expect(solaiman).toBeDefined();
      expect(solaiman!.family).toBe('SolaimanLipi');
    });

    it('should include Inter for UI', () => {
      const inter = BUNDLED_FONTS.find((f) => f.id === 'inter-regular');
      expect(inter).toBeDefined();
      expect(inter!.family).toBe('Inter');
    });

    it('should all have SIL OFL license', () => {
      for (const font of BUNDLED_FONTS) {
        expect(font.license).toContain('OFL');
      }
    });
  });

  describe('getFontsByLanguage', () => {
    it('should return Bengali fonts for bn', () => {
      const fonts = getFontsByLanguage('bn');
      expect(fonts.length).toBeGreaterThanOrEqual(4);
      expect(fonts.every((f) => f.language === 'bn' || f.supportsScripts.includes('latin'))).toBe(true);
    });

    it('should return English fonts for en', () => {
      const fonts = getFontsByLanguage('en');
      expect(fonts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getFontsByScript', () => {
    it('should return Bengali script fonts', () => {
      const fonts = getFontsByScript('bengali');
      expect(fonts.length).toBeGreaterThanOrEqual(4);
      expect(fonts.every((f) => f.supportsScripts.includes('bengali'))).toBe(true);
    });

    it('should return Latin script fonts', () => {
      const fonts = getFontsByScript('latin');
      expect(fonts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getFontById', () => {
    it('should find font by id', () => {
      const font = getFontById('inter-regular');
      expect(font).toBeDefined();
      expect(font!.family).toBe('Inter');
    });

    it('should return undefined for unknown id', () => {
      expect(getFontById('nonexistent')).toBeUndefined();
    });
  });

  describe('getFontFamilyOptions', () => {
    it('should return unique family options', () => {
      const options = getFontFamilyOptions();
      const families = options.map((o) => o.value);
      expect(new Set(families).size).toBe(families.length);
      expect(families).toContain('Noto Sans Bengali');
      expect(families).toContain('Siyam Rupali');
      expect(families).toContain('Kalpurush');
      expect(families).toContain('SolaimanLipi');
      expect(families).toContain('Inter');
    });
  });
});
