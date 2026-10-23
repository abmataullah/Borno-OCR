import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { buildApp } from '../app';

vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'job-1', status: 'queued' }])),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: 'job-1', status: 'queued', progress: 0 }])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([{ id: 'job-1', status: 'queued', progress: 0 }])),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
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
  },
}));

vi.mock('../services/email.service', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('../queue/queues', () => ({
  pdfProcessingQueue: {
    add: vi.fn(() => Promise.resolve({ id: 'bullmq-1' })),
  },
  conversionQueue: {
    add: vi.fn(() => Promise.resolve({ id: 'bullmq-2' })),
  },
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
  })),
}));

vi.mock('../services/scheduler.service', () => ({
  startScheduler: vi.fn(),
  stopScheduler: vi.fn(),
}));

describe('Job & Admin Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await buildApp(app);
    await app.ready();
  });

  it('GET /health should return ok with services info', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.services).toBeDefined();
  });

  it('GET /api/jobs/:jobId without auth should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/jobs/test-id' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/projects/:id/jobs without auth should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/projects/test-id/jobs' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/projects/:id/process without auth should return 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects/test-id/process',
      payload: {},
    });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/projects/:id/convert without auth should return 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/projects/test-id/convert',
      payload: { targetFormat: 'docx' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admin/stats without auth should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/stats' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/admin/users without auth should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/users' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/admin/payments/manual without auth should return 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/payments/manual',
      payload: {
        userId: '00000000-0000-0000-0000-000000000000',
        planId: 'pro',
        amount: 900,
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/billing/plans without auth should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/billing/plans' });
    expect(response.statusCode).toBe(401);
  });

  it('POST /api/billing/webhook should be accessible without auth', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/billing/webhook',
      payload: {
        provider: 'manual',
        payload: { paymentId: 'test' },
      },
    });
    // Should not be 401 — webhook is public
    expect(response.statusCode).not.toBe(401);
  });
});
