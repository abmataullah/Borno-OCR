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
 */
import type { FastifyInstance, FastifyReply } from 'fastify';
import { createWopiDocument, getWopiDocument, updateWopiDocument } from '../services/wopi-store.service';

export async function wopiRoutes(app: FastifyInstance): Promise<void> {
  // --- WOPI checkFileInfo ---
  app.get('/wopi/files/:id', async (request, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = getWopiDocument(id);
    if (!doc) {
      reply.code(404).send({ error: 'Document not found' });
      return;
    }
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
      PostMessageOrigin: '*',
      LastModifiedTime: new Date(doc.updatedAt).toISOString(),
    });
  });

  // --- WOPI getFile ---
  app.get('/wopi/files/:id/contents', async (request, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = getWopiDocument(id);
    if (!doc) {
      reply.code(404).send({ error: 'Document not found' });
      return;
    }
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .header('Content-Disposition', `attachment; filename="${doc.filename}"`)
      .send(doc.buffer);
  });

  // --- WOPI putFile ---
  app.post('/wopi/files/:id/contents', async (request, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = getWopiDocument(id);
    if (!doc) {
      reply.code(404).send({ error: 'Document not found' });
      return;
    }
    // The body is the raw file content
    const body = request.body as Buffer;
    if (!body) {
      reply.code(400).send({ error: 'No file content received' });
      return;
    }
    updateWopiDocument(id, body);
    reply.send({ status: 'ok' });
  });

  // --- Create WOPI session from uploaded DOCX ---
  // Frontend exports project to DOCX, uploads it here, gets back a WOPI file ID
  app.post('/api/wopi/create', async (request, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      reply.code(400).send({ error: 'No file uploaded' });
      return;
    }
    const buffer = await data.toBuffer();
    const filename = data.filename || 'document.docx';
    const userId = 'bornoocr-user'; // In production, extract from auth
    const id = createWopiDocument(filename, buffer, userId);
    reply.send({ fileId: id, filename });
  });

  // --- Get edited DOCX back from WOPI store ---
  app.get('/api/wopi/:id/download', async (request, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const doc = getWopiDocument(id);
    if (!doc) {
      reply.code(404).send({ error: 'Document not found' });
      return;
    }
    reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      .header('Content-Disposition', `attachment; filename="${doc.filename}"`)
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
