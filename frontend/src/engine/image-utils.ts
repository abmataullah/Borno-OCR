import type { ImageElement, SignatureElement } from '@model/document-model';
import { createDefaultTransform, createDefaultBBox } from './canvas-objects';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Unsupported format: ${file.type}. Use PNG, JPEG, or WebP.` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image too large. Maximum 10 MB.' };
  }
  return { valid: true };
}

export async function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function createImageElementFromFile(
  file: File,
  x: number = 50,
  y: number = 50,
  maxDisplayWidth: number = 400
): Promise<ImageElement> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const dataUrl = await fileToDataURL(file);
  const dims = await loadImageDimensions(dataUrl);

  const aspectRatio = dims.height / dims.width;
  const displayWidth = Math.min(dims.width, maxDisplayWidth);
  const displayHeight = displayWidth * aspectRatio;

  const bbox = createDefaultBBox(x, y, displayWidth, displayHeight);

  return {
    id: crypto.randomUUID(),
    type: 'image',
    bbox,
    transform: createDefaultTransform(),
    zIndex: 0,
    locked: false,
    visible: true,
    sourceType: 'added',
    confidence: null,
    src: dataUrl,
    format: file.type.split('/')[1] as string,
    naturalWidth: dims.width,
    naturalHeight: dims.height,
    opacity: 1,
  };
}

export function createSignatureElement(
  signatureDataUrl: string,
  x: number = 50,
  y: number = 50,
  width: number = 200,
  height: number = 80
): SignatureElement {
  const bbox = createDefaultBBox(x, y, width, height);

  return {
    id: crypto.randomUUID(),
    type: 'signature',
    bbox,
    transform: createDefaultTransform(),
    zIndex: 0,
    locked: false,
    visible: true,
    sourceType: 'added',
    confidence: null,
    src: signatureDataUrl,
    format: 'drawn',
  };
}

export function resizeImageKeepingAspect(
  currentWidth: number,
  currentHeight: number,
  targetWidth?: number,
  targetHeight?: number
): { width: number; height: number } {
  const aspect = currentWidth / currentHeight;

  if (targetWidth && !targetHeight) {
    return { width: targetWidth, height: targetWidth / aspect };
  }
  if (targetHeight && !targetWidth) {
    return { width: targetHeight * aspect, height: targetHeight };
  }
  if (targetWidth && targetHeight) {
    return { width: targetWidth, height: targetHeight };
  }
  return { width: currentWidth, height: currentHeight };
}

export function cropImage(
  dataUrl: string,
  cropX: number,
  cropY: number,
  cropWidth: number,
  cropHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
