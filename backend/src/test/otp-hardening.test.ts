import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import Fastify from 'fastify';
import { buildApp } from '../app';
import { clearAuthRateLimits } from '../middleware/security';
import { resolveStorageKey } from '../services/storage.service';

const otpRecords: Array<Record<string, unknown>> = [];
const updateWhere = vi.fn(() => Promise.resolve());

vi.mock('../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => {
        const p = Promise.resolve();
        return Object.assign(p, {
          onConflictDoNothing: () => ({ returning: () => Promise.resolve([{ id: 'u1', email: 'a@example.com', plan: 'free' }]) }),
          returning: () => Promise.resolve([{ id: 'u1', email: 'a@example.com', plan: 'free' }]),
        });
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{ id: 'u1', email: 'a@example.com', name: 'A', plan: 'free' }])),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(otpRecords.splice(0))),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: updateWhere })),
    })),
  },
  schema: { otpCodes: {}, users: {} },
}));

vi.mock('../services/email.service', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));

describe('OTP hardening', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    clearAuthRateLimits();
    updateWhere.mockClear();
    otpRecords.length = 0;
    app = Fastify({ logger: false });
    await buildApp(app);
    await app.ready();
  });

  afterEach(() => vi.restoreAllMocks());

  function verify(email: string, ip: string, code = '123456') {
    return app.inject({
      method: 'POST',
      url: '/api/auth/verify-otp',
      payload: { email, code },
      remoteAddress: ip,
    });
  }

  it('limits verify attempts per email even when the IP changes', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await verify('victim@example.com', `10.0.0.${i + 1}`);
      expect(res.statusCode).toBe(401);
    }
    const blocked = await verify('Victim@Example.com', '10.0.0.99');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();

    // Other emails are unaffected.
    expect((await verify('someone-else@example.com', '10.0.0.100')).statusCode).toBe(401);
  });

  it('limits OTP requests per email even when the IP changes', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST', url: '/api/auth/request-otp', payload: { email: 'spam@example.com' }, remoteAddress: `10.1.0.${i + 1}`,
      });
      expect(res.statusCode).toBe(200);
    }
    const blocked = await app.inject({
      method: 'POST', url: '/api/auth/request-otp', payload: { email: 'spam@example.com' }, remoteAddress: '10.1.0.99',
    });
    expect(blocked.statusCode).toBe(429);
  });

  it('expires older pending codes when a new one is requested', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/request-otp', payload: { email: 'a@example.com' } });
    expect(res.statusCode).toBe(200);
    expect(updateWhere).toHaveBeenCalled();
  });

  it('never logs the OTP code', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    otpRecords.push({ id: 'otp1', email: 'a@example.com', code: '987654', status: 'pending', expiresAt: new Date(Date.now() + 60_000) });
    const res = await verify('a@example.com', '10.2.0.1', '987654');
    expect(res.statusCode).toBe(200);
    const logged = log.mock.calls.flat().map(String).join('\n');
    expect(logged).not.toContain('987654');
  });
});

describe('resolveStorageKey', () => {
  const base = path.join(os.tmpdir(), 'bornoocr-storage');

  it('resolves normal keys inside the storage root', () => {
    expect(resolveStorageKey(base, 'projects/abc/original.pdf')).toBe(path.resolve(base, 'projects/abc/original.pdf'));
  });

  it.each(['../.env', 'projects/../../.env', '/etc/passwd', 'C:\\Windows\\win.ini', '\\\\server\\share', '', 'a\0b', '.'])(
    'rejects %j',
    (key) => {
      expect(() => resolveStorageKey(base, key)).toThrow('Invalid storage key');
    },
  );
});
