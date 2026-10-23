import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { settingsService } from '../services/settings.service';
import { adminMiddleware } from '../middleware/auth';

const gatewayConfigSchema = z.object({
  enabled: z.boolean().optional(),
  secretKey: z.string().optional(),
  appKey: z.string().optional(),
  appSecret: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  storeId: z.string().optional(),
  storePasswd: z.string().optional(),
  baseUrl: z.string().optional(),
});

const updateSettingsSchema = z.object({
  gateways: z
    .object({
      stripe: gatewayConfigSchema.optional(),
      bkash: gatewayConfigSchema.optional(),
      sslcommerz: gatewayConfigSchema.optional(),
    })
    .optional(),
  planOverrides: z
    .record(
      z.enum(['free', 'pro', 'business']),
      z.object({
        priceUsd: z.number().nonnegative().optional(),
        priceBdt: z.number().nonnegative().optional(),
      })
    )
    .optional(),
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', adminMiddleware);

  app.get('/admin/settings', async (_req: FastifyRequest, reply: FastifyReply) => {
    const settings = await settingsService.getSettings();
    return reply.send(settings);
  });

  app.patch('/admin/settings', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const updated = await settingsService.updateSettings(parsed.data as never);
    return reply.send(updated);
  });
}
