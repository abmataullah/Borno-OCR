/**
 * In-memory WOPI document store.
 * Stores DOCX blobs temporarily so Collabora Online can load/save them via WOPI.
 * In production, this would use filesystem or object storage.
 *
 * SECURITY: each document gets a random access token that Collabora must send
 * back (`?access_token=`) on every WOPI call, and per-user / global caps keep
 * the store from being used to exhaust server memory.
 */
import crypto from 'crypto';

interface WopiDocument {
  id: string;
  filename: string;
  buffer: Buffer;
  createdAt: number;
  updatedAt: number;
  userId: string;
  accessToken: string;
}

const DOC_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_DOCS_PER_USER = 3;
export const MAX_DOCS_TOTAL = 200;

const documents = new Map<string, WopiDocument>();

export function createWopiDocument(filename: string, buffer: Buffer, userId: string): { id: string; accessToken: string } {
  // Evict the user's oldest documents so one user can hold at most MAX_DOCS_PER_USER.
  const own = [...documents.values()]
    .filter((d) => d.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
  while (own.length >= MAX_DOCS_PER_USER) {
    documents.delete(own.shift()!.id);
  }
  if (documents.size >= MAX_DOCS_TOTAL) {
    throw new Error('WOPI store is full');
  }

  const id = crypto.randomUUID();
  const accessToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  documents.set(id, {
    id,
    filename,
    buffer,
    createdAt: now,
    updatedAt: now,
    userId,
    accessToken,
  });
  // Auto-clean after 2 hours
  setTimeout(() => documents.delete(id), DOC_TTL_MS).unref();
  return { id, accessToken };
}

export function getWopiDocument(id: string): WopiDocument | undefined {
  return documents.get(id);
}

/** Return the document only if `accessToken` matches the one issued for it. */
export function getWopiDocumentWithToken(id: string, accessToken: string | undefined): WopiDocument | undefined {
  const doc = documents.get(id);
  if (!doc || !accessToken) return undefined;
  const expected = Buffer.from(doc.accessToken);
  const provided = Buffer.from(accessToken);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return undefined;
  }
  return doc;
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

/** Test helper: drop every stored document. */
export function clearWopiDocuments(): void {
  documents.clear();
}
