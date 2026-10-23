/**
 * In-memory WOPI document store.
 * Stores DOCX blobs temporarily so Collabora Online can load/save them via WOPI.
 * In production, this would use filesystem or object storage.
 */
import crypto from 'crypto';

interface WopiDocument {
  id: string;
  filename: string;
  buffer: Buffer;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

const documents = new Map<string, WopiDocument>();

export function createWopiDocument(filename: string, buffer: Buffer, userId: string): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  documents.set(id, {
    id,
    filename,
    buffer,
    createdAt: now,
    updatedAt: now,
    userId,
  });
  // Auto-clean after 2 hours
  setTimeout(() => documents.delete(id), 2 * 60 * 60 * 1000);
  return id;
}

export function getWopiDocument(id: string): WopiDocument | undefined {
  return documents.get(id);
}

export function updateWopiDocument(id: string, buffer: Buffer): boolean {
  const doc = documents.get(id);
  if (!doc) return false;
  doc.buffer = buffer;
  doc.updatedAt = Date.now();
  return true;
}

export function deleteWopiDocument(id: string): boolean {
  return documents.delete(id);
}
