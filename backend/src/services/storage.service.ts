import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import { config } from '../config/env';

/**
 * SECURITY: map a storage key to a path inside `basePath`. Rejects absolute
 * keys and anything that resolves outside the storage root (e.g. `../.env`).
 */
export function resolveStorageKey(basePath: string, key: string): string {
  const root = resolve(basePath);
  if (!key || key.includes('\0') || /^([a-zA-Z]:)?[\\/]/.test(key)) {
    throw new Error('Invalid storage key');
  }
  const full = resolve(root, key);
  if (!full.startsWith(root + sep)) {
    throw new Error('Invalid storage key');
  }
  return full;
}

export interface StorageAdapter {
  upload(key: string, data: Buffer, contentType: string): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}

class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string = './storage') {
    this.basePath = basePath;
  }

  private fullPath(key: string): string {
    return resolveStorageKey(this.basePath, key);
  }

  async upload(key: string, data: Buffer, _contentType: string): Promise<void> {
    const path = this.fullPath(key);
    const dir = join(path, '..');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path, data);
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.fullPath(key));
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return;
      throw err;
    }
  }

  async getSignedUrl(key: string, _expiresIn: number): Promise<string> {
    return `${config.corsOrigin}/api/files/${encodeURIComponent(key)}`;
  }
}

let adapter: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!adapter) {
    adapter = new LocalStorageAdapter();
  }
  return adapter;
}

export function setStorage(customAdapter: StorageAdapter): void {
  adapter = customAdapter;
}
