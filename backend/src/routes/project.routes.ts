import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { projectService } from '../services/project.service';
import { jobService } from '../services/job.service';
import { getStorage } from '../services/storage.service';
import { createProjectSchema, updateProjectSchema, shareProjectSchema } from '../schemas/project.schema';
import { authMiddleware } from '../middleware/auth';
import { validateFileSignature, validateFileSize } from '../middleware/security';
import { contentDisposition } from '../utils/content-disposition';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.post('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const project = await projectService.create(request.user!.userId, parsed.data);
    return reply.code(201).send(project);
  });

  app.get('/projects', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query as { q?: string })?.q;
    if (query && query.trim()) {
      const results = await projectService.search(request.user!.userId, query.trim());
      return reply.code(200).send(results);
    }
    const projects = await projectService.listByUser(request.user!.userId);
    return reply.code(200).send(projects);
  });

  app.get('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const project = await projectService.getById(request.user!.userId, id);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    return reply.code(200).send(project);
  });

  app.patch('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = updateProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const project = await projectService.update(request.user!.userId, id, parsed.data);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    return reply.code(200).send(project);
  });

  app.delete('/projects/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deleted = await projectService.delete(request.user!.userId, id);
    if (!deleted) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    return reply.code(204).send();
  });

  app.post('/projects/:id/share', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = shareProjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const project = await projectService.generateShareToken(request.user!.userId, id, parsed.data.isShared);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    return reply.code(200).send({ shareToken: project.shareToken, isShared: project.isShared });
  });

  app.post('/projects/:id/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const project = await projectService.getById(request.user!.userId, id);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();

    // SECURITY: validate file size
    if (!validateFileSize(buffer.length)) {
      return reply.code(413).send({ error: 'File too large (max 50 MB)' });
    }

    // SECURITY: verify magic bytes match claimed MIME type (prevent disguised uploads)
    if (!validateFileSignature(buffer, data.mimetype)) {
      return reply.code(415).send({ error: 'File content does not match claimed type. Only PDF files are allowed.' });
    }

    const key = `projects/${id}/original.pdf`;
    const storage = getStorage();
    await storage.upload(key, buffer, data.mimetype);

    const updated = await projectService.update(request.user!.userId, id, {
      originalPdfKey: key,
      fileSizeKb: Math.round(buffer.length / 1024),
    });

    return reply.code(200).send(updated);
  });

  app.post('/projects/:id/process', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const project = await projectService.getById(request.user!.userId, id);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    if (!project.originalPdfKey) {
      return reply.code(400).send({ error: 'No PDF uploaded for this project' });
    }

    const body = request.body as { runOcr?: boolean; runTableDetection?: boolean; ocrLang?: string; useHybridOcr?: boolean } | null;
    const job = await jobService.createProcessingJob(
      request.user!.userId,
      id,
      project.originalPdfKey,
      {
        runOcr: body?.runOcr,
        runTableDetection: body?.runTableDetection,
        ocrLang: body?.ocrLang,
        useHybridOcr: body?.useHybridOcr,
      }
    );

    return reply.code(201).send(job);
  });

  app.post('/projects/:id/convert', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const project = await projectService.getById(request.user!.userId, id);
    if (!project) {
      return reply.code(404).send({ error: 'Project not found' });
    }
    if (!project.originalPdfKey) {
      return reply.code(400).send({ error: 'No PDF uploaded for this project' });
    }

    const body = request.body as { targetFormat?: 'docx' | 'odt' | 'html' } | null;
    const targetFormat = body?.targetFormat ?? 'docx';
    if (!['docx', 'odt', 'html'].includes(targetFormat)) {
      return reply.code(400).send({ error: 'Invalid target format' });
    }

    const job = await jobService.createConversionJob(
      request.user!.userId,
      id,
      project.originalPdfKey,
      targetFormat
    );

    return reply.code(201).send(job);
  });

  app.get('/projects/:id/download', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const project = await projectService.getById(request.user!.userId, id);
    if (!project?.originalPdfKey) {
      return reply.code(404).send({ error: 'File not found' });
    }

    const storage = getStorage();
    const buffer = await storage.download(project.originalPdfKey);
    return reply
      .code(200)
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', contentDisposition(`${project.name}.pdf`))
      .send(buffer);
  });

  app.get('/files/*', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = (request.params as { '*': string })['*'];

    // SECURITY: only serve files under a project the caller owns. Keys look
    // like `projects/<projectId>/<file>`; anything else (including `..`
    // segments) is rejected before touching storage.
    const match = /^projects\/([0-9a-f-]{36})\/([A-Za-z0-9._-]+)$/i.exec(key);
    if (!match || match[2].startsWith('.')) {
      return reply.code(404).send({ error: 'File not found' });
    }
    const project = await projectService.getById(request.user!.userId, match[1]);
    if (!project) {
      return reply.code(404).send({ error: 'File not found' });
    }

    const storage = getStorage();
    try {
      const buffer = await storage.download(key);
      return reply.code(200).header('Content-Type', 'application/octet-stream').send(buffer);
    } catch {
      return reply.code(404).send({ error: 'File not found' });
    }
  });
}
