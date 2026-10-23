declare module 'harfbuzzjs' {
  export function createBlob(data: ArrayBuffer): number;
  export function createFace(blobId: number, index: number): number;
  export function createFont(faceId: number): number;
  export function createBuffer(): number;
  export function destroyBuffer(bufferId: number): void;
  export function shape(fontId: number, bufferId: number): void;

  interface FontData {
    set_scale(x: number, y: number): void;
  }

  interface GlyphInfo {
    codepoint: number;
    cluster: number;
  }

  interface GlyphPosition {
    x_advance: number;
    y_advance: number;
    x_offset: number;
    y_offset: number;
  }

  export function buffer_add_utf8(bufferId: number, text: string): void;
  export function buffer_set_direction(bufferId: number, direction: string): void;
  export function buffer_set_script(bufferId: number, script: string): void;
  export function buffer_set_language(bufferId: number, language: string): void;
  export function buffer_get_glyph_infos(bufferId: number): GlyphInfo[];
  export function buffer_get_glyph_positions(bufferId: number): GlyphPosition[];

  export function font_get(fontId: number): FontData;
  export function font_set_scale(fontData: FontData, x: number, y: number): void;
}
