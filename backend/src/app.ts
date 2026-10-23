import type { FastifyInstance } from 'fastify';
import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/project.routes';
import { billingRoutes } from './routes/billing.routes';
import { jobRoutes } from './routes/job.routes';
import { adminRoutes } from './routes/admin.routes';
import { publicRoutes } from './routes/public.routes';
import { annotationRoutes } from './routes/annotation.routes';
import { batchRoutes } from './routes/batch.routes';
import { monitoringRoutes } from './routes/monitoring.routes';
import { wopiRoutes } from './routes/wopi.routes';
import { settingsRoutes } from './routes/settings.routes';
import { ticketRoutes, adminTicketRoutes } from './routes/ticket.routes';
import { config } from './config/env';
import { startScheduler, stopScheduler } from './services/scheduler.service';
import { securityHeadersMiddleware, FRAME_ANCESTORS } from './middleware/security';

const isProd = config.nodeEnv === 'production';
const collaboraOrigins = isProd ? [] : ['http://localhost:9980', 'ws://localhost:9980'];

export async function buildApp(app: FastifyInstance): Promise<void> {
  await app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: FRAME_ANCESTORS,
        frameSrc: ["'self'", ...collaboraOrigins.filter((o) => o.startsWith('http'))],
        connectSrc: ["'self'", ...collaboraOrigins],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    hsts: isProd
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
    xssFilter: true,
    noSniff: true,
    hidePoweredBy: true,
  });

  // Global security headers on every response
  app.addHook('onRequest', securityHeadersMiddleware);

  await app.register(import('@fastify/cors'), {
    origin: config.nodeEnv === 'production'
      ? config.corsOrigin.split(',').map((s: string) => s.trim()).filter(Boolean)
      : true,
    credentials: true,
  });

  await app.register(import('@fastify/rate-limit'), {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow,
    // Don't leak internals in the 429 response
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });

  await app.register(import('@fastify/cookie'));

  await app.register(import('@fastify/multipart'), {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redis: 'connected',
    },
  }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(projectRoutes, { prefix: '/api' });
  await app.register(billingRoutes, { prefix: '/api' });
  await app.register(jobRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });
  await app.register(publicRoutes, { prefix: '/api' });
  await app.register(annotationRoutes, { prefix: '/api' });
  await app.register(batchRoutes, { prefix: '/api' });
  await app.register(settingsRoutes, { prefix: '/api' });
  await app.register(ticketRoutes, { prefix: '/api' });
  await app.register(adminTicketRoutes, { prefix: '/api' });
  await app.register(monitoringRoutes);
  await app.register(wopiRoutes);
}

export async function startServer(): Promise<void> {
  const fastify = (await import('fastify')).default({
    logger: {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    },
    // SECURITY: correct client IPs behind reverse proxy (for rate limiting)
    trustProxy: isProd,
    // SECURITY: cap JSON/form body size (uploads go through multipart with own limit)
    bodyLimit: 5 * 1024 * 1024,
    // SECURITY: don't advertise server internals
    disableRequestLogging: false,
  });

  await buildApp(fastify);

  try {
    await fastify.listen({ port: config.port, host: config.host });
    fastify.log.info(`BornoOCR API running on http://${config.host}:${config.port}`);
    startScheduler();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
