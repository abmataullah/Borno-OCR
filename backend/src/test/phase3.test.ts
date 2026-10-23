import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { buildApp } from '../app';

vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'ann-1', content: 'test', resolved: false }])),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: 'ann-1', content: 'test', resolved: false }])),
          orderBy: vi.fn(() => Promise.resolve([{ id: 'ann-1', content: 'test', resolved: false }])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: 'ann-1', content: 'updated', resolved: true }])),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'ann-1' }])),
      })),
    })),
  },
  schema: {
    jobs: {},
    users: {},
    projects: {},
    payments: {},
    subscriptions: {},
    sessions: {},
    otpCodes: {},
    annotations: {},
  },
}));

vi.mock('../services/email.service', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
  sendJobCompletionEmail: vi.fn(() => Promise.resolve()),
  sendPaymentConfirmationEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../queue/queues', () => ({
  pdfProcessingQueue: { add: vi.fn(() => Promise.resolve({ id: 'bullmq-1' })) },
  conversionQueue: { add: vi.fn(() => Promise.resolve({ id: 'bullmq-2' })) },
  pdfProcessingEvents: { on: vi.fn() },
  conversionEvents: { on: vi.fn() },
}));

vi.mock('../queue/connection', () => ({
  redisConfig: { url: 'redis://localhost:6379' },
  QUEUE_NAMES: { PDF_PROCESSING: 'pdf-processing', CONVERSION: 'conversion' },
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    hgetall: vi.fn(() => Promise.resolve({})),
    keys: vi.fn(() => Promise.resolve([])),
    expire: vi.fn(() => Promise.resolve()),
    ttl: vi.fn(() => Promise.resolve(-1)),
    ping: vi.fn(() => Promise.resolve('PONG')),
    disconnect: vi.fn(),
  })),
}));

vi.mock('../services/scheduler.service', () => ({
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
}));

describe('Phase 3 Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await buildApp(app);
    await app.ready();
  });

  describe('Public Share Routes', () => {
    it('GET /api/public/projects/:shareToken should be accessible without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/public/projects/test-share-token',
      });
      expect(response.statusCode).not.toBe(401);
    });

    it('GET /api/public/projects/:shareToken/download should be accessible without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/public/projects/test-share-token/download',
      });
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe('Annotation Routes', () => {
    it('GET /api/projects/:projectId/annotations without auth should return 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects/test-id/annotations',
      });
      expect(response.statusCode).toBe(401);
    });

    it('POST /api/projects/:projectId/annotations without auth should return 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/projects/test-id/annotations',
        payload: { pageIndex: 0, content: 'test' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('PATCH /api/annotations/:annotationId without auth should return 401', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/annotations/test-id',
        payload: { content: 'updated' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('DELETE /api/annotations/:annotationId without auth should return 401', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/annotations/test-id',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Batch Routes', () => {
    it('POST /api/batch/projects/delete without auth should return 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/batch/projects/delete',
        payload: { projectIds: ['test-id'] },
      });
      expect(response.statusCode).toBe(401);
    });

    it('POST /api/batch/projects/process without auth should return 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/batch/projects/process',
        payload: { projectIds: ['test-id'] },
      });
      expect(response.statusCode).toBe(401);
    });

    it('POST /api/batch/projects/convert without auth should return 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/batch/projects/convert',
        payload: { projectIds: ['test-id'], targetFormat: 'docx' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('PATCH /api/batch/projects/tags without auth should return 401', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/batch/projects/tags',
        payload: { updates: [{ projectId: 'test-id', tags: ['tag1'] }] },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Job SSE Stream', () => {
    it('GET /api/jobs/:jobId/stream without auth should return 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/jobs/test-id/stream',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Monitoring Routes', () => {
    it('GET /health/detailed should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/detailed',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBeDefined();
      expect(body.checks).toBeDefined();
      expect(body.checks.api).toBeDefined();
    });

    it('GET /health/metrics should return process metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/metrics',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.process).toBeDefined();
      expect(body.process.pid).toBeDefined();
      expect(body.process.memory).toBeDefined();
    });
  });

  describe('Project Search', () => {
    it('GET /api/projects?q=test without auth should return 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/projects?q=test',
      });
      expect(response.statusCode).toBe(401);
    });
  });
});
