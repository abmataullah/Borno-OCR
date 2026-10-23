import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jobService } from '../services/job.service';
import { authMiddleware } from '../middleware/auth';
import { verifyToken } from '../utils/jwt';
import { authService } from '../services/auth.service';
import { redisConfig } from '../queue/connection';
import IORedis from 'ioredis';

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.get('/jobs/:jobId', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await jobService.getById(request.user!.userId, jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }
    return reply.send(job);
  });

  app.get('/projects/:projectId/jobs', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { projectId } = request.params as { projectId: string };
    const jobs = await jobService.getByProject(request.user!.userId, projectId);
    return reply.send(jobs);
  });

  app.get('/jobs/:jobId/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = request.params as { jobId: string };

    const authHeader = request.headers.authorization;
    const queryToken = (request.query as { token?: string })?.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : queryToken;

    if (!token) {
      return reply.code(401).send({ error: 'Missing authorization' });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    const user = await authService.getUserById(payload.userId);
    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    const job = await jobService.getById(payload.userId, jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
    });

    if (job.status === 'completed' || job.status === 'failed') {
      reply.raw.end();
      return;
    }

    const redis = new IORedis(redisConfig.url, { maxRetriesPerRequest: null });
    let closed = false;

    request.raw.on('close', () => {
      closed = true;
      redis.disconnect();
    });

    const poll = async () => {
      while (!closed) {
        try {
          const updated = await jobService.getById(payload.userId, jobId);
          if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
            sendEvent({
              jobId: updated.id,
              status: updated.status,
              progress: updated.progress,
              result: updated.result,
              error: updated.error,
            });
            reply.raw.end();
            redis.disconnect();
            return;
          }

          if (updated) {
            sendEvent({
              jobId: updated.id,
              status: updated.status,
              progress: updated.progress,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
      redis.disconnect();
    };

    poll().catch(() => {
      if (!closed) reply.raw.end();
    });
  });
}
