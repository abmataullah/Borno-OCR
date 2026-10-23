import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { buildApp } from '../app';
import { signToken } from '../utils/jwt';

vi.mock('../db', () => ({ db: {}, schema: {} }));

vi.mock('../services/email.service', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/auth.service', () => ({
  authService: {
    getUserById: vi.fn(() => Promise.resolve({
      id: 'u1', email: 'test@example.com', name: 'Test', plan: 'free',
      storageQuotaMb: 100, storageUsedMb: 0, createdAt: new Date(), updatedAt: new Date(),
    })),
  },
}));

const mockProject = { id: 'p1', userId: 'u1', name: 'Test', pageCount: 0, fileSizeKb: 0, isShared: false, shareToken: null, originalPdfKey: null, projectData: null, createdAt: new Date(), updatedAt: new Date() };

vi.mock('../services/project.service', () => ({
  projectService: {
    create: vi.fn((_userId: string, data: { name: string }) => Promise.resolve({ ...mockProject, name: data.name })),
    getById: vi.fn(() => Promise.resolve(mockProject)),
    listByUser: vi.fn(() => Promise.resolve([mockProject])),
    update: vi.fn((_uid: string, _pid: string, data: { isShared?: boolean }) => Promise.resolve({ ...mockProject, ...data, shareToken: data.isShared ? 'tok-1' : null })),
    delete: vi.fn(() => Promise.resolve(true)),
    generateShareToken: vi.fn(() => Promise.resolve({ ...mockProject, isShared: true, shareToken: 'tok-1' })),
  },
}));

vi.mock('../services/storage.service', () => ({
  getStorage: () => ({
    upload: vi.fn(() => Promise.resolve()),
    download: vi.fn(() => Promise.resolve(Buffer.from('test'))),
    delete: vi.fn(() => Promise.resolve()),
    getSignedUrl: vi.fn(() => Promise.resolve('http://localhost/test')),
  }),
}));

function makeToken(): string {
  return signToken({ id: 'u1', email: 'test@example.com', plan: 'free' });
}

describe('Project Routes', () => {
  let app: ReturnType<typeof Fastify>;
  let token: string;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await buildApp(app);
    await app.ready();
    token = makeToken();
  });

  it('GET /api/projects without auth should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/projects with auth should return 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/projects with valid data should return 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'My Project' },
    });
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.name).toBe('My Project');
  });

  it('POST /api/projects with empty name should return 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('GET /api/projects/:id with auth should return 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/projects/p1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
  });

  it('DELETE /api/projects/:id with auth should return 204', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/projects/p1',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(204);
  });

  it('POST /api/projects/:id/share with isShared=true should return 200', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects/p1/share',
      headers: { authorization: `Bearer ${token}` },
      payload: { isShared: true },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.isShared).toBe(true);
  });
});
