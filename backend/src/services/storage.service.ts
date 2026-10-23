import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '../config/env';

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
    return join(this.basePath, key);
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
