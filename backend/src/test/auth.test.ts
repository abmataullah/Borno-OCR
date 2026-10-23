import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { buildApp } from '../app';

vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
  schema: {},
}));

vi.mock('../services/email.service', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));

describe('Auth Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await buildApp(app);
    await app.ready();
  });

  it('GET /health should return ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('POST /auth/request-otp with valid email should return 200', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { email: 'test@example.com' },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sent).toBe(true);
  });

  it('POST /auth/request-otp with invalid email should return 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/request-otp',
      payload: { email: 'not-an-email' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('POST /auth/verify-otp with missing code should return 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email: 'test@example.com' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('GET /auth/me without token should return 401', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
  });
});
