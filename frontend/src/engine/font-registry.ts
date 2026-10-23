export interface BundledFont {
  id: string;
  family: string;
  subfamily: string;
  url: string;
  format: 'ttf' | 'woff' | 'woff2';
  language: string;
  license: string;
  weight: number;
  isItalic: boolean;
  supportsScripts: string[];
}

export const BUNDLED_FONTS: BundledFont[] = [
  {
    id: 'noto-sans-bengali-regular',
    family: 'Noto Sans Bengali',
    subfamily: 'Regular',
    url: '/fonts/NotoSansBengali-Regular.ttf',
    format: 'ttf',
    language: 'bn',
    license: 'SIL OFL 1.1',
    weight: 400,
    isItalic: false,
    supportsScripts: ['bengali', 'latin'],
  },
  {
    id: 'noto-sans-bengali-bold',
    family: 'Noto Sans Bengali',
    subfamily: 'Bold',
    url: '/fonts/NotoSansBengali-Bold.ttf',
    format: 'ttf',
    language: 'bn',
    license: 'SIL OFL 1.1',
    weight: 700,
    isItalic: false,
    supportsScripts: ['bengali', 'latin'],
  },
  {
    id: 'noto-serif-bengali-regular',
    family: 'Noto Serif Bengali',
    subfamily: 'Regular',
    url: '/fonts/NotoSerifBengali-Regular.ttf',
    format: 'ttf',
    language: 'bn',
    license: 'SIL OFL 1.1',
    weight: 400,
    isItalic: false,
    supportsScripts: ['bengali', 'latin'],
  },
  {
    id: 'siyam-rupali-regular',
    family: 'Siyam Rupali',
    subfamily: 'Regular',
    url: '/fonts/Siyam Rupali.ttf',
    format: 'ttf',
    language: 'bn',
    license: 'SIL OFL 1.1',
    weight: 400,
    isItalic: false,
    supportsScripts: ['bengali', 'latin'],
  },
  {
    id: 'kalpurush-regular',
    family: 'Kalpurush',
    subfamily: 'Regular',
    url: '/fonts/kalpurush.ttf',
    format: 'ttf',
    language: 'bn',
    license: 'SIL OFL 1.1',
    weight: 400,
    isItalic: false,
    supportsScripts: ['bengali', 'latin'],
  },
  {
    id: 'solaiman-lipi-regular',
    family: 'SolaimanLipi',
    subfamily: 'Regular',
    url: '/fonts/Solaiman Lipi.ttf',
    format: 'ttf',
    language: 'bn',
    license: 'SIL OFL 1.1',
    weight: 400,
    isItalic: false,
    supportsScripts: ['bengali', 'latin'],
  },
  {
    id: 'inter-regular',
    family: 'Inter',
    subfamily: 'Regular',
    url: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2',
    format: 'woff2',
    language: 'en',
    license: 'SIL OFL 1.1',
    weight: 400,
    isItalic: false,
    supportsScripts: ['latin'],
  },
  {
    id: 'inter-bold',
    family: 'Inter',
    subfamily: 'Bold',
    url: 'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2',
    format: 'woff2',
    language: 'en',
    license: 'SIL OFL 1.1',
    weight: 700,
    isItalic: false,
    supportsScripts: ['latin'],
  },
];

export function getFontsByLanguage(language: string): BundledFont[] {
  return BUNDLED_FONTS.filter((f) => f.language === language || f.supportsScripts.includes('latin'));
}

export function getFontsByScript(script: string): BundledFont[] {
  return BUNDLED_FONTS.filter((f) => f.supportsScripts.includes(script));
}

export function getFontById(id: string): BundledFont | undefined {
  return BUNDLED_FONTS.find((f) => f.id === id);
}

export function getFontFamilyOptions(): { label: string; value: string }[] {
  const families = new Set(BUNDLED_FONTS.map((f) => f.family));
  return Array.from(families).map((family) => ({
    label: family,
    value: family,
  }));
}

export async function loadFontData(font: BundledFont): Promise<ArrayBuffer> {
  const response = await fetch(font.url);
  return response.arrayBuffer();
}

export async function preloadBengaliFonts(): Promise<void> {
  const bengaliFonts = getFontsByScript('bengali');
  const loadPromises = bengaliFonts.map(async (font) => {
    try {
      const fontFace = new FontFace(font.family, `url(${font.url})`);
      await fontFace.load();
      document.fonts.add(fontFace);
    } catch (err) {
      console.warn(`Failed to preload font ${font.family}:`, err);
    }
  });
  await Promise.allSettled(loadPromises);
}
