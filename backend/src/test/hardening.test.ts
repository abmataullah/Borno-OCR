import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import Fastify from 'fastify';
import { buildApp } from '../app';
import { signToken } from '../utils/jwt';
import { contentDisposition } from '../utils/content-disposition';
import { clearWopiDocuments, MAX_DOCS_PER_USER, getWopiDocument } from '../services/wopi-store.service';

vi.mock('../db', () => ({ db: {}, schema: {} }));

vi.mock('../services/email.service', () => ({
  sendOtpEmail: vi.fn(() => Promise.resolve()),
}));

const users: Record<string, { id: string; email: string; name: string; plan: string; isAdmin: boolean }> = {
  u1: { id: 'u1', email: 'one@example.com', name: 'One', plan: 'free', isAdmin: false },
  u2: { id: 'u2', email: 'two@example.com', name: 'Two', plan: 'free', isAdmin: false },
};

const findOrCreateUser = vi.fn((email: string) =>
  Promise.resolve({ id: 'local-embed-user', email, name: 'Embed', plan: 'free', isAdmin: false }),
);

vi.mock('../services/auth.service', () => ({
  authService: {
    getUserById: vi.fn((id: string) => Promise.resolve(users[id] ?? null)),
    findOrCreateUser: (email: string) => findOrCreateUser(email),
  },
}));

const OWN_PROJECT = '11111111-1111-4111-8111-111111111111';
const OTHER_PROJECT = '22222222-2222-4222-8222-222222222222';

const getById = vi.fn((userId: string, projectId: string) =>
  Promise.resolve(userId === 'u1' && projectId === OWN_PROJECT
    ? { id: OWN_PROJECT, userId: 'u1', name: 'Mine', originalPdfKey: `projects/${OWN_PROJECT}/original.pdf` }
    : null),
);

vi.mock('../services/project.service', () => ({
  projectService: {
    getById: (userId: string, projectId: string) => getById(userId, projectId),
    listByUser: vi.fn((userId: string) => Promise.resolve([{ id: 'p', userId }])),
  },
}));

const download = vi.fn(() => Promise.resolve(Buffer.from('%PDF-1.4 test')));

vi.mock('../services/storage.service', () => ({
  getStorage: () => ({
    upload: vi.fn(() => Promise.resolve()),
    download: (key: string) => download(key),
    delete: vi.fn(() => Promise.resolve()),
    getSignedUrl: vi.fn(() => Promise.resolve('http://localhost/test')),
  }),
}));

function tokenFor(id: 'u1' | 'u2'): string {
  return signToken({ id, email: users[id].email, plan: 'free' });
}

function embedToken(payload: Record<string, unknown>): string {
  const secret = process.env.BORNOOCR_EMBED_SECRET || 'dev-bornoocr-embed-secret-change-me';
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

const DOCX_BYTES = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('fake docx body')]);

function multipart(filename: string, content: Buffer) {
  const boundary = '----bornoocrTestBoundary';
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n',
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('contentDisposition', () => {
  it('strips quotes, backslashes and control characters from the fallback name', () => {
    const header = contentDisposition('evil"; x=1\\\r\nSet-Cookie: a=b.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    const fallback = /filename="([^"]*)"/.exec(header)![1];
    expect(fallback).not.toContain('"');
    expect(fallback).not.toContain('\\');
  });

  it('keeps non-ASCII names in filename*', () => {
    const header = contentDisposition('বাংলা.pdf');
    expect(header).toContain("filename*=UTF-8''" + encodeURIComponent('বাংলা.pdf'));
    expect(header).toMatch(/filename="[\x20-\x7e]+"/);
  });

  it('uses the fallback for empty names', () => {
    expect(contentDisposition('\r\n', 'document.docx')).toContain('filename="document.docx"');
  });
});

describe('Security hardening routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    clearWopiDocuments();
    app = Fastify({ logger: false });
    await buildApp(app);
    await app.ready();
  });

  describe('GET /api/files/*', () => {
    const auth = () => ({ authorization: `Bearer ${tokenFor('u1')}` });

    it('serves a file from a project the caller owns', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/files/projects/${OWN_PROJECT}/original.pdf`, headers: auth() });
      expect(res.statusCode).toBe(200);
      expect(download).toHaveBeenCalledWith(`projects/${OWN_PROJECT}/original.pdf`);
    });

    it("rejects another user's project", async () => {
      const res = await app.inject({ method: 'GET', url: `/api/files/projects/${OTHER_PROJECT}/original.pdf`, headers: auth() });
      expect(res.statusCode).toBe(404);
      expect(download).not.toHaveBeenCalled();
    });

    it.each([
      '%2E%2E%2F.env',
      '..%2F..%2F.env',
      `projects/${OWN_PROJECT}/..%2F..%2F.env`,
      `projects/${OWN_PROJECT}/.env`,
      'etc/passwd',
    ])('rejects path traversal key %s without touching storage', async (key) => {
      const res = await app.inject({ method: 'GET', url: `/api/files/${key}`, headers: auth() });
      expect(res.statusCode).toBe(404);
      expect(download).not.toHaveBeenCalled();
    });

    it('requires authentication', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/files/projects/${OWN_PROJECT}/original.pdf` });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('WOPI', () => {
    async function createDoc(user: 'u1' | 'u2' = 'u1', content = DOCX_BYTES) {
      const { payload, headers } = multipart('Report.docx', content);
      return app.inject({
        method: 'POST',
        url: '/api/wopi/create',
        payload,
        headers: { ...headers, authorization: `Bearer ${tokenFor(user)}` },
      });
    }

    it('requires login to create a document', async () => {
      const { payload, headers } = multipart('Report.docx', DOCX_BYTES);
      const res = await app.inject({ method: 'POST', url: '/api/wopi/create', payload, headers });
      expect(res.statusCode).toBe(401);
    });

    it('rejects uploads that are not DOCX (ZIP) files', async () => {
      const res = await createDoc('u1', Buffer.from('not a zip'));
      expect(res.statusCode).toBe(415);
    });

    it('issues a random access token separate from the file ID', async () => {
      const res = await createDoc();
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.fileId).toBeTruthy();
      expect(body.accessToken).toMatch(/^[0-9a-f]{64}$/);
      expect(body.accessToken).not.toBe(body.fileId);
    });

    it('rejects WOPI calls with a missing or wrong access token', async () => {
      const { fileId, accessToken } = JSON.parse((await createDoc()).body);
      for (const url of [
        `/wopi/files/${fileId}`,
        `/wopi/files/${fileId}?access_token=${fileId}`,
        `/wopi/files/${fileId}/contents?access_token=${'0'.repeat(64)}`,
        `/wopi/files/${crypto.randomUUID()}?access_token=${accessToken}`,
      ]) {
        const res = await app.inject({ method: 'GET', url });
        expect(res.statusCode, url).toBe(401);
      }
      const put = await app.inject({
        method: 'POST',
        url: `/wopi/files/${fileId}/contents`,
        payload: Buffer.from('overwrite'),
        headers: { 'content-type': 'application/octet-stream' },
      });
      expect(put.statusCode).toBe(401);
    });

    it('serves, saves and reports a restricted PostMessageOrigin with the right token', async () => {
      const { fileId, accessToken } = JSON.parse((await createDoc()).body);

      const info = await app.inject({ method: 'GET', url: `/wopi/files/${fileId}?access_token=${accessToken}` });
      expect(info.statusCode).toBe(200);
      expect(JSON.parse(info.body).PostMessageOrigin).not.toBe('*');

      const contents = await app.inject({ method: 'GET', url: `/wopi/files/${fileId}/contents?access_token=${accessToken}` });
      expect(contents.statusCode).toBe(200);
      expect(contents.rawPayload.equals(DOCX_BYTES)).toBe(true);

      const edited = Buffer.from('edited document bytes');
      const put = await app.inject({
        method: 'POST',
        url: `/wopi/files/${fileId}/contents?access_token=${accessToken}`,
        payload: edited,
        headers: { 'content-type': 'application/octet-stream' },
      });
      expect(put.statusCode).toBe(200);
      expect(getWopiDocument(fileId)!.buffer.equals(edited)).toBe(true);
    });

    it('only lets the owner download the edited document', async () => {
      const { fileId } = JSON.parse((await createDoc('u1')).body);

      const anon = await app.inject({ method: 'GET', url: `/api/wopi/${fileId}/download` });
      expect(anon.statusCode).toBe(401);

      const other = await app.inject({
        method: 'GET',
        url: `/api/wopi/${fileId}/download`,
        headers: { authorization: `Bearer ${tokenFor('u2')}` },
      });
      expect(other.statusCode).toBe(404);

      const owner = await app.inject({
        method: 'GET',
        url: `/api/wopi/${fileId}/download`,
        headers: { authorization: `Bearer ${tokenFor('u1')}` },
      });
      expect(owner.statusCode).toBe(200);
      expect(owner.headers['content-disposition']).toContain('filename="Report.docx"');
    });

    it('keeps at most MAX_DOCS_PER_USER documents per user', async () => {
      const ids: string[] = [];
      for (let i = 0; i < MAX_DOCS_PER_USER + 2; i++) {
        ids.push(JSON.parse((await createDoc()).body).fileId);
      }
      const alive = ids.filter((id) => getWopiDocument(id));
      expect(alive).toEqual(ids.slice(-MAX_DOCS_PER_USER));
    });
  });

  describe('Content-Security-Policy', () => {
    it("keeps helmet's full policy and allows Banglai Cloud framing", async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      const csp = String(res.headers['content-security-policy']);
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain('frame-ancestors');
      expect(csp).toContain('https://banglai.cloud');
    });
  });

  describe('Embed tokens', () => {
    it('maps the embed user to a local account by email, never by Banglai uid', async () => {
      // uid deliberately equals a real local user's ID.
      const token = embedToken({ uid: 'u1', email: 'embed@banglai.cloud', name: 'Embed', plan: 'pro', exp: Date.now() + 60_000 });
      const res = await app.inject({ method: 'GET', url: '/api/projects', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(200);
      expect(findOrCreateUser).toHaveBeenCalledWith('embed@banglai.cloud');
      expect(JSON.parse(res.body)[0].userId).toBe('local-embed-user');
    });

    it('rejects expired embed tokens', async () => {
      const token = embedToken({ uid: 'x', email: 'embed@banglai.cloud', name: 'E', plan: 'pro', exp: Date.now() - 1 });
      const res = await app.inject({ method: 'GET', url: '/api/projects', headers: { authorization: `Bearer ${token}` } });
      expect(res.statusCode).toBe(401);
    });
  });
});
