/**
 * WOPI (Web Application Open Platform Interface) routes for Collabora Online.
 *
 * Collabora CODE loads/saves documents via these endpoints:
 * - GET  /wopi/files/{id}          → checkFileInfo (metadata)
 * - GET  /wopi/files/{id}/contents → getFile (raw document bytes)
 * - POST /wopi/files/{id}/contents → putFile (save edited document)
 *
 * The frontend creates a WOPI document from the project, gets back an ID + token,
 * then embeds Collabora's editor iframe with the WOPISrc pointing here.
 *
 * SECURITY: creating and downloading documents requires a logged-in user, and
 * every /wopi/files call must carry the per-document `access_token` that was
 * issued at creation time (Collabora appends it to each request).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createWopiDocument,
  getWopiDocument,
  getWopiDocumentWithToken,
  updateWopiDocument,
} from '../services/wopi-store.service';
import { authMiddleware } from '../middleware/auth';
import { config } from '../config/env';
import { contentDisposition } from '../utils/content-disposition';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_DOC_BYTES = 50 * 1024 * 1024;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Origin of the page that hosts the Collabora iframe (receives its postMessages). */
function postMessageOrigin(): string {
  return process.env.WOPI_POSTMESSAGE_ORIGIN || config.corsOrigin.split(',')[0].trim();
}

function docFromRequest(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const { access_token: accessToken } = request.query as { access_token?: string };
  const doc = getWopiDocumentWithToken(id, accessToken);
  if (!doc) {
    // Same response for unknown IDs and bad tokens, so IDs can't be probed.
    reply.code(401).send({ error: 'Invalid or missing access token' });
    return null;
  }
  return doc;
}

export async function wopiRoutes(app: FastifyInstance): Promise<void> {
  // Collabora's putFile sends the raw document bytes (usually as
  // application/octet-stream). Scoped to this plugin; JSON and multipart keep
  // their own parsers.
  app.addContentTypeParser(
    '*',
    { parseAs: 'buffer', bodyLimit: MAX_DOC_BYTES },
    (_req, body, done) => done(null, body),
  );

  // --- WOPI checkFileInfo ---
  app.get('/wopi/files/:id', async (request, reply: FastifyReply) => {
    const doc = docFromRequest(request, reply);
    if (!doc) return;
    reply.send({
      BaseFileName: doc.filename,
      Size: doc.buffer.length,
      Version: String(doc.updatedAt),
      UserId: doc.userId,
      UserFriendlyName: 'BornoOCR Editor',
      UserCanWrite: true,
      CanWrite: true,
      ReadOnly: false,
      SupportsLocks: false,
      SupportsUpdate: true,
      OwnerId: doc.userId,
      PostMessageOrigin: postMessageOrigin(),
      LastModifiedTime: new Date(doc.updatedAt).toISOString(),
    });
  });

  // --- WOPI getFile ---
  app.get('/wopi/files/:id/contents', async (request, reply: FastifyReply) => {
    const doc = docFromRequest(request, reply);
    if (!doc) return;
    reply
      .header('Content-Type', DOCX_MIME)
      .header('Content-Disposition', contentDisposition(doc.filename, 'document.docx'))
      .send(doc.buffer);
  });

  // --- WOPI putFile ---
  app.post('/wopi/files/:id/contents', async (request, reply: FastifyReply) => {
    const doc = docFromRequest(request, reply);
    if (!doc) return;
    // The body is the raw file content
    const body = request.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      reply.code(400).send({ error: 'No file content received' });
      return;
    }
    updateWopiDocument(doc.id, body);
    reply.send({ status: 'ok' });
  });

  // --- Create WOPI session from uploaded DOCX ---
  // Frontend exports project to DOCX, uploads it here, gets back a WOPI file ID
  app.post('/api/wopi/create', { preHandler: authMiddleware }, async (request, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: 'No file uploaded' });
      return;
    }
    const buffer = await data.toBuffer();
    // SECURITY: DOCX files are ZIP containers — reject anything else.
    if (buffer.length < ZIP_MAGIC.length || !buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
      reply.code(415).send({ error: 'Only DOCX files are allowed' });
      return;
    }
    const filename = data.filename || 'document.docx';
    try {
      const { id, accessToken } = createWopiDocument(filename, buffer, request.user!.userId);
      reply.send({ fileId: id, filename, accessToken });
    } catch {
      reply.code(503).send({ error: 'Editor is busy, please try again later' });
    }
  });

  // --- Get edited DOCX back from WOPI store ---
  app.get('/api/wopi/:id/download', { preHandler: authMiddleware }, async (request, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = getWopiDocument(id);
    if (!doc || doc.userId !== request.user!.userId) {
      reply.code(404).send({ error: 'Document not found' });
      return;
    }
    reply
      .header('Content-Type', DOCX_MIME)
      .header('Content-Disposition', contentDisposition(doc.filename, 'document.docx'))
      .send(doc.buffer);
  });

  // --- Check if Collabora is available and get editor URL ---
  app.get('/api/wopi/status', async () => {
    try {
      const internalUrl = process.env.COLLABORA_INTERNAL_URL || 'http://collabora:9980';
      const publicUrl = process.env.COLLABORA_PUBLIC_URL || 'https://pdf.banglai.cloud';
      const res = await fetch(`${internalUrl}/hosting/discovery`);
      if (!res.ok) {
        return { available: false, url: null, editorUrl: null };
      }
      const xml = await res.text();
      const match = xml.match(
        /<app name="application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document"[^>]*>[\s\S]*?<action[^>]*name="edit"[^>]*urlsrc="([^"]+)"/
      );
      let editorUrl: string | null = null;
      if (match) {
        editorUrl = match[1].replace(/^https?:\/\/[^\/]+/, publicUrl);
      } else {
        const fallback = xml.match(/urlsrc="(https?:\/\/[^"]*cool\.html\?)"/);
        if (fallback) {
          editorUrl = fallback[1].replace(/^https?:\/\/[^\/]+/, publicUrl);
        }
      }
      return { available: true, url: publicUrl, editorUrl };
    } catch {
      return { available: false, url: null, editorUrl: null };
    }
  });
}
