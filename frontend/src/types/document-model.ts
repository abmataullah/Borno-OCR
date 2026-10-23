// DocFlow Internal Document Model — Core Types
// Schema version 1

export const SCHEMA_VERSION = 1;

export type ElementType =
  | 'text'
  | 'image'
  | 'shape'
  | 'table'
  | 'form-field'
  | 'annotation'
  | 'signature';

export type PageType = 'digital' | 'scanned' | 'mixed';
export type SourceType = 'extracted' | 'ocr' | 'added' | 'imported';
export type EditorMode = 'pdf-layout' | 'document' | 'table';
export type WritingDirection = 'ltr' | 'rtl';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Transform {
  rotate: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
}

export interface BaseElement {
  id: string;
  type: ElementType;
  bbox: BoundingBox;
  transform: Transform;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  sourceType: SourceType;
  confidence: number | null;
}

export interface TextStyle {
  fontId: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  color: string;
  opacity: number;
  underline: boolean;
  strikethrough: boolean;
  alignment: 'left' | 'center' | 'right' | 'justify';
  direction: WritingDirection;
  lineHeight: number;
  letterSpacing: number;
  language: string;
}

export interface TextRun {
  text: string;
  style: TextStyle;
  shapedGlyphs?: ShapedGlyph[];
}

export type ListType = 'none' | 'bullet' | 'numbered';
export type HeadingLevel = 'none' | 'h1' | 'h2' | 'h3';

export interface TrackChange {
  id: string;
  type: 'insert' | 'delete' | 'format';
  pageIndex: number;
  elementId: string;
  paraIdx: number;
  startOffset: number;
  endOffset: number;
  text: string;
  style?: Partial<TextStyle>;
  author: string;
  timestamp: string;
  accepted: boolean;
  rejected: boolean;
}

export interface Comment {
  id: string;
  pageIndex: number;
  elementId: string;
  paraIdx: number;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  content: string;
  author: string;
  timestamp: string;
  resolved: boolean;
  replies?: { id: string; author: string; content: string; timestamp: string }[];
}

export interface Paragraph {
  id: string;
  runs: TextRun[];
  alignment: 'left' | 'center' | 'right' | 'justify';
  direction: WritingDirection;
  lineHeight: number;
  spaceBefore: number;
  spaceAfter: number;
  indent: number;
  listType?: ListType;
  headingLevel?: HeadingLevel;
}

export interface TextBlock extends BaseElement {
  type: 'text';
  paragraphs: Paragraph[];
  style: Partial<TextStyle>;
  overflow: 'visible' | 'hidden' | 'warn';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  format: string;
  naturalWidth: number;
  naturalHeight: number;
  opacity: number;
}

export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'polygon';

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: ShapeType;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
}

export interface CellStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  fill: string;
  alignment: 'left' | 'center' | 'right';
  borderBottom: boolean;
  borderTop: boolean;
  borderLeft: boolean;
  borderRight: boolean;
}

export interface TableCell {
  id: string;
  rowIndex: number;
  colIndex: number;
  rowspan: number;
  colspan: number;
  value: string;
  formula?: string;
  style: CellStyle;
  merged: boolean;
}

export interface TableRow {
  id: string;
  height: number;
}

export interface TableColumn {
  id: string;
  width: number;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: TableRow[];
  columns: TableColumn[];
  cells: TableCell[];
  hasFormulas: boolean;
  sourceTableIndex?: number;
}

export type FormFieldType =
  | 'text'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'signature';

export interface FormField extends BaseElement {
  type: 'form-field';
  fieldType: FormFieldType;
  name: string;
  value: string;
  required: boolean;
  options?: string[];
}

export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'note'
  | 'link'
  | 'freehand';

export interface Annotation extends BaseElement {
  type: 'annotation';
  annotationType: AnnotationType;
  color: string;
  content?: string;
  points?: { x: number; y: number }[];
}

export interface SignatureElement extends BaseElement {
  type: 'signature';
  src: string;
  format: 'drawn' | 'uploaded' | 'typed';
}

export type PageElement =
  | TextBlock
  | ImageElement
  | ShapeElement
  | TableElement
  | FormField
  | Annotation
  | SignatureElement;

export interface Page {
  id: string;
  index: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  pageType: PageType;
  backgroundRef: string;
  elements: PageElement[];
  confidence: number;
  margins?: { top: number; bottom: number; left: number; right: number };
  header?: string;
  footer?: string;
  showPageNumber?: boolean;
}

export interface FontReference {
  id: string;
  family: string;
  subfamily: string;
  source: 'embedded' | 'system' | 'bundled' | 'substituted';
  originalFontName?: string;
  substitutedFrom?: string;
  license: string;
  embeddable: boolean;
  weight: number;
  isItalic: boolean;
  supportsScripts: string[];
}

export interface OperationEntry {
  id: string;
  timestamp: string;
  type: string;
  targetId: string;
  patch: Record<string, unknown>;
  inversePatch: Record<string, unknown>;
}

export interface ProjectMetadata {
  pageCount: number;
  totalElements: number;
  languages: string[];
  hasTables: boolean;
  hasForms: boolean;
  hasScannedPages: boolean;
}

export interface DocFlowProject {
  id: string;
  schemaVersion: number;
  name: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  originalPdfRef: string;
  pageRenderRefs: string[];
  pages: Page[];
  fonts: FontReference[];
  history: OperationEntry[];
  metadata: ProjectMetadata;
  trackChanges?: TrackChange[];
  comments?: Comment[];
}

export interface ShapedGlyph {
  glyphId: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
  cluster: number;
}
