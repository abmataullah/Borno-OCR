import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redisConfig } from '../queue/connection';
import IORedis from 'ioredis';
import { db, schema } from '../db';
import { count } from 'drizzle-orm';

export async function monitoringRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, { status: string; latencyMs?: number; details?: unknown }> = {};

    const pgStart = Date.now();
    try {
      const userCount = await db.select({ count: count() }).from(schema.users);
      checks.database = {
        status: 'healthy',
        latencyMs: Date.now() - pgStart,
        details: { users: userCount[0]?.count ?? 0 },
      };
    } catch (err) {
      checks.database = { status: 'unhealthy', latencyMs: Date.now() - pgStart, details: { error: String(err) } };
    }

    const redisStart = Date.now();
    try {
      const redis = new IORedis(redisConfig.url, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
      await redis.ping();
      redis.disconnect();
      checks.redis = { status: 'healthy', latencyMs: Date.now() - redisStart };
    } catch (err) {
      checks.redis = { status: 'unhealthy', latencyMs: Date.now() - redisStart, details: { error: String(err) } };
    }

    checks.api = { status: 'healthy', details: { uptime: process.uptime(), memory: process.memoryUsage().heapUsed } };

    const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');
    return reply.code(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  app.get('/health/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return reply.send({
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: memUsage.rss,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
      },
    });
  });
}
