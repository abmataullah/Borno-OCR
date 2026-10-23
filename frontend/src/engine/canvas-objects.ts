import * as fabric from 'fabric';
import type { PageElement, TextBlock, ShapeElement, ShapeType, BoundingBox, Transform } from '@model/document-model';

export interface CanvasObjectManagerOptions {
  canvasElement: HTMLCanvasElement;
  pageWidth: number;
  pageHeight: number;
  zoom: number;
  onObjectModified: (elementId: string, updates: Partial<PageElement>) => void;
  onObjectSelected: (elementId: string | null) => void;
}

export class CanvasObjectManager {
  private fabricCanvas: fabric.Canvas;
  private options: CanvasObjectManagerOptions;
  private elementMap: Map<string, fabric.Object> = new Map();
  private objectToElement: Map<string, string> = new Map();

  constructor(options: CanvasObjectManagerOptions) {
    this.options = options;
    this.fabricCanvas = new fabric.Canvas(options.canvasElement, {
      width: options.pageWidth * options.zoom,
      height: options.pageHeight * options.zoom,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.fabricCanvas.on('object:modified', (e) => {
      const obj = e.target;
      if (!obj) return;
      const elementId = this.objectToElement.get(this.getObjectKey(obj));
      if (!elementId) return;

      const updates: Partial<PageElement> = {
        bbox: {
          x: obj.left ?? 0,
          y: obj.top ?? 0,
          width: obj.width ?? 0,
          height: obj.height ?? 0,
        },
        transform: {
          rotate: obj.angle ?? 0,
          scaleX: obj.scaleX ?? 1,
          scaleY: obj.scaleY ?? 1,
          skewX: obj.skewX ?? 0,
          skewY: obj.skewY ?? 0,
        },
      };
      this.options.onObjectModified(elementId, updates);
    });

    this.fabricCanvas.on('selection:created', (e) => {
      const obj = e.selected?.[0];
      const elementId = obj ? this.objectToElement.get(this.getObjectKey(obj)) ?? null : null;
      this.options.onObjectSelected(elementId);
    });

    this.fabricCanvas.on('selection:updated', (e) => {
      const obj = e.selected?.[0];
      const elementId = obj ? this.objectToElement.get(this.getObjectKey(obj)) ?? null : null;
      this.options.onObjectSelected(elementId);
    });

    this.fabricCanvas.on('selection:cleared', () => {
      this.options.onObjectSelected(null);
    });
  }

  addTextBlock(element: TextBlock): void {
    const text = element.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
    const textObj = new fabric.IText(text, {
      left: element.bbox.x * this.options.zoom,
      top: element.bbox.y * this.options.zoom,
      width: element.bbox.width * this.options.zoom,
      fontSize: (element.style.fontSize ?? 14) * this.options.zoom,
      fill: element.style.color ?? '#000000',
      fontFamily: 'Inter',
      id: element.id,
    } as Record<string, unknown>);

    this.fabricCanvas.add(textObj);
    this.elementMap.set(element.id, textObj);
    this.objectToElement.set(this.getObjectKey(textObj), element.id);
  }

  addShape(element: ShapeElement): void {
    let shapeObj: fabric.Object;

    const commonProps = {
      left: element.bbox.x * this.options.zoom,
      top: element.bbox.y * this.options.zoom,
      width: element.bbox.width * this.options.zoom,
      height: element.bbox.height * this.options.zoom,
      fill: element.fill,
      stroke: element.stroke,
      strokeWidth: element.strokeWidth,
      id: element.id,
    };

    switch (element.shapeType) {
      case 'rectangle':
        shapeObj = new fabric.Rect(commonProps);
        break;
      case 'ellipse':
        shapeObj = new fabric.Ellipse({
          ...commonProps,
          rx: (element.bbox.width * this.options.zoom) / 2,
          ry: (element.bbox.height * this.options.zoom) / 2,
        });
        break;
      case 'line':
        shapeObj = new fabric.Line(
          [
            element.bbox.x * this.options.zoom,
            element.bbox.y * this.options.zoom,
            (element.bbox.x + element.bbox.width) * this.options.zoom,
            (element.bbox.y + element.bbox.height) * this.options.zoom,
          ],
          {
            stroke: element.stroke,
            strokeWidth: element.strokeWidth,
            id: element.id,
          } as Record<string, unknown>
        );
        break;
      default:
        shapeObj = new fabric.Rect(commonProps);
    }

    this.fabricCanvas.add(shapeObj);
    this.elementMap.set(element.id, shapeObj);
    this.objectToElement.set(this.getObjectKey(shapeObj), element.id);
  }

  addImage(element: { id: string; bbox: BoundingBox; src: string; transform?: Transform }): void {
    fabric.Image.fromURL(element.src).then((imgObj) => {
      imgObj.set({
        left: element.bbox.x * this.options.zoom,
        top: element.bbox.y * this.options.zoom,
        scaleX: (element.bbox.width / (imgObj.width ?? 1)) * this.options.zoom,
        scaleY: (element.bbox.height / (imgObj.height ?? 1)) * this.options.zoom,
      });

      this.fabricCanvas.add(imgObj);
      this.elementMap.set(element.id, imgObj);
      this.objectToElement.set(this.getObjectKey(imgObj), element.id);
      this.fabricCanvas.renderAll();
    });
  }

  removeElement(elementId: string): void {
    const obj = this.elementMap.get(elementId);
    if (obj) {
      this.fabricCanvas.remove(obj);
      this.elementMap.delete(elementId);
      this.objectToElement.delete(this.getObjectKey(obj));
    }
  }

  updateElement(elementId: string, updates: Partial<PageElement>): void {
    const obj = this.elementMap.get(elementId);
    if (!obj) return;

    if (updates.bbox) {
      obj.set({
        left: updates.bbox.x * this.options.zoom,
        top: updates.bbox.y * this.options.zoom,
        width: updates.bbox.width * this.options.zoom,
        height: updates.bbox.height * this.options.zoom,
      });
    }

    if (updates.transform) {
      obj.set({
        angle: updates.transform.rotate,
        scaleX: updates.transform.scaleX,
        scaleY: updates.transform.scaleY,
        skewX: updates.transform.skewX,
        skewY: updates.transform.skewY,
      });
    }

    if (updates.visible !== undefined) {
      obj.visible = updates.visible;
    }

    if (updates.locked !== undefined) {
      obj.lockMovementX = updates.locked;
      obj.lockMovementY = updates.locked;
      obj.lockScalingX = updates.locked;
      obj.lockScalingY = updates.locked;
      obj.lockRotation = updates.locked;
    }

    this.fabricCanvas.renderAll();
  }

  selectElement(elementId: string | null): void {
    if (!elementId) {
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.renderAll();
      return;
    }
    const obj = this.elementMap.get(elementId);
    if (obj) {
      this.fabricCanvas.setActiveObject(obj);
      this.fabricCanvas.renderAll();
    }
  }

  setZoom(zoom: number): void {
    this.options.zoom = zoom;
    this.fabricCanvas.setDimensions({
      width: this.options.pageWidth * zoom,
      height: this.options.pageHeight * zoom,
    });
    this.fabricCanvas.setZoom(zoom);
    this.fabricCanvas.renderAll();
  }

  clear(): void {
    this.fabricCanvas.clear();
    this.elementMap.clear();
    this.objectToElement.clear();
  }

  private getObjectKey(obj: fabric.Object): string {
    return String((obj as unknown as { __uid?: number }).__uid ?? (obj as unknown as { cacheKey?: string }).cacheKey ?? Math.random());
  }

  dispose(): void {
    this.fabricCanvas.dispose();
    this.elementMap.clear();
    this.objectToElement.clear();
  }

  getFabricCanvas(): fabric.Canvas {
    return this.fabricCanvas;
  }
}

export function createDefaultTransform(): Transform {
  return { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0};
}

export function createDefaultBBox(x: number = 0, y: number = 0, width: number = 200, height: number = 50): BoundingBox {
  return { x, y, width, height };
}

export function createTextBlockElement(
  id: string,
  text: string,
  bbox: BoundingBox,
  fontSize: number = 14,
  color: string = '#000000'
): TextBlock {
  return {
    id,
    type: 'text',
    bbox,
    transform: createDefaultTransform(),
    zIndex: 0,
    locked: false,
    visible: true,
    sourceType: 'added',
    confidence: null,
    paragraphs: [
      {
        id: crypto.randomUUID(),
        runs: [
          {
            text,
            style: {
              fontId: 'inter-regular',
              fontSize,
              fontWeight: 400,
              fontStyle: 'normal',
              color,
              opacity: 1,
              underline: false,
              strikethrough: false,
              alignment: 'left',
              direction: 'ltr',
              lineHeight: 1.2,
              letterSpacing: 0,
              language: 'en',
            },
          },
        ],
        alignment: 'left',
        direction: 'ltr',
        lineHeight: 1.2,
        spaceBefore: 0,
        spaceAfter: 0,
        indent: 0,
      },
    ],
    style: { fontSize, color },
    overflow: 'visible',
  };
}

export function createShapeElement(
  id: string,
  shapeType: ShapeType,
  bbox: BoundingBox,
  fill: string = 'transparent',
  stroke: string = '#d4af37',
  strokeWidth: number = 2
): ShapeElement {
  return {
    id,
    type: 'shape',
    bbox,
    transform: createDefaultTransform(),
    zIndex: 0,
    locked: false,
    visible: true,
    sourceType: 'added',
    confidence: null,
    shapeType,
    fill,
    stroke,
    strokeWidth,
    opacity: 1,
  };
}
