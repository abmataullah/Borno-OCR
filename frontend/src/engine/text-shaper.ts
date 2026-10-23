import type { ShapedGlyph } from '@model/document-model';

export interface ShapeResult {
  glyphs: ShapedGlyph[];
  totalWidth: number;
  ascent: number;
  descent: number;
}

export interface FontMetrics {
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  capHeight: number;
  xHeight: number;
}

type HarfBuzzModule = typeof import('harfbuzzjs');

let hbModule: HarfBuzzModule | null = null;
let hbBlobCache: Map<string, number> = new Map();
let hbFaceCache: Map<string, number> = new Map();
let hbFontCache: Map<string, number> = new Map();

let fontDataCache: Map<string, ArrayBuffer> = new Map();

export async function initHarfBuzz(): Promise<HarfBuzzModule> {
  if (hbModule) return hbModule;
  hbModule = await import('harfbuzzjs');
  return hbModule;
}

export async function loadFontData(fontUrl: string): Promise<ArrayBuffer> {
  if (fontDataCache.has(fontUrl)) {
    return fontDataCache.get(fontUrl)!;
  }
  const response = await fetch(fontUrl);
  const buffer = await response.arrayBuffer();
  fontDataCache.set(fontUrl, buffer);
  return buffer;
}

export async function shapeText(
  text: string,
  fontUrl: string,
  fontSize: number = 14,
  language: string = 'en',
  direction: 'ltr' | 'rtl' = 'ltr'
): Promise<ShapeResult> {
  const hb = await initHarfBuzz();
  const fontData = await loadFontData(fontUrl);

  let blobId = hbBlobCache.get(fontUrl);
  if (blobId === undefined) {
    blobId = hb.createBlob(fontData);
    hbBlobCache.set(fontUrl, blobId);
  }

  let faceId = hbFaceCache.get(fontUrl);
  if (faceId === undefined) {
    faceId = hb.createFace(blobId, 0);
    hbFaceCache.set(fontUrl, faceId);
  }

  let fontId = hbFontCache.get(fontUrl);
  if (fontId === undefined) {
    fontId = hb.createFont(faceId);
    const fontObj = hb.font_get(fontId);
    const scale = fontSize * 64;
    hb.font_set_scale(fontObj, scale, scale);
    hbFontCache.set(fontUrl, fontId);
  }

  const buffer = hb.createBuffer();
  try {
    hb.buffer_add_utf8(buffer, text);
    hb.buffer_set_direction(buffer, direction);
    hb.buffer_set_script(buffer, getScriptForLanguage(language));
    hb.buffer_set_language(buffer, language);

    hb.shape(fontId, buffer);

    const result = hb.buffer_get_glyph_infos(buffer);
    const positions = hb.buffer_get_glyph_positions(buffer);

    const glyphs: ShapedGlyph[] = [];
    let totalWidth = 0;

    for (let i = 0; i < result.length; i++) {
      const info = result[i];
      const pos = positions[i];
      glyphs.push({
        glyphId: info.codepoint,
        xAdvance: pos.x_advance,
        yAdvance: pos.y_advance,
        xOffset: pos.x_offset,
        yOffset: pos.y_offset,
        cluster: info.cluster,
      });
      totalWidth += pos.x_advance;
    }

    return {
      glyphs,
      totalWidth: totalWidth / 64,
      ascent: fontSize * 0.8,
      descent: fontSize * 0.2,
    };
  } finally {
    hb.destroyBuffer(buffer);
  }
}

function getScriptForLanguage(lang: string): string {
  const scriptMap: Record<string, string> = {
    bn: 'Beng',
    en: 'Latn',
    ar: 'Arab',
    hi: 'Deva',
    fa: 'Arab',
    ur: 'Arab',
  };
  return scriptMap[lang] || 'Latn';
}

export function detectLanguage(text: string): string {
  const bengaliRange = /[\u0980-\u09FF]/;
  const arabicRange = /[\u0600-\u06FF]/;
  const devanagariRange = /[\u0900-\u097F]/;

  if (bengaliRange.test(text)) return 'bn';
  if (arabicRange.test(text)) return 'ar';
  if (devanagariRange.test(text)) return 'hi';
  return 'en';
}

export function getDirectionForLanguage(lang: string): 'ltr' | 'rtl' {
  const rtlLanguages = ['ar', 'fa', 'ur', 'he'];
  return rtlLanguages.includes(lang) ? 'rtl' : 'ltr';
}

export function isComplexScript(text: string): boolean {
  const lang = detectLanguage(text);
  return lang !== 'en';
}

export function clearFontCache(): void {
  fontDataCache = new Map();
  hbBlobCache = new Map();
  hbFaceCache = new Map();
  hbFontCache = new Map();
}
