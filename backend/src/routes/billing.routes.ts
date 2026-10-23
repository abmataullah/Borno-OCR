import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { billingService } from '../services/billing.service';
import { settingsService } from '../services/settings.service';
import type { PlanId, PaymentProvider } from '../config/plans';
import { createPaymentSchema, webhookSchema } from '../schemas/billing.schema';
import { authMiddleware } from '../middleware/auth';

export async function billingRoutes(app: FastifyInstance) {
  // Webhook endpoint — no auth (called by payment providers)
  app.post('/billing/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = webhookSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const result = await billingService.handleWebhook(
      parsed.data.provider as PaymentProvider,
      parsed.data.payload,
      parsed.data.signature
    );

    return reply.send(result);
  });

  // All other billing routes require auth (per-route to avoid webhook)
  app.get('/billing/plans', { preHandler: authMiddleware }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const plans = await settingsService.getEffectivePlans();
    return reply.send({ plans: Object.values(plans) });
  });

  app.get('/billing/subscription', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const sub = await billingService.getSubscription(req.user!.userId);
    return reply.send(sub);
  });

  app.get('/billing/history', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const history = await billingService.getPaymentHistory(req.user!.userId);
    return reply.send(history);
  });

  app.post('/billing/create-payment', { preHandler: authMiddleware }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { provider, planId, currency, returnUrl } = parsed.data;
    const amount = await settingsService.getEffectivePlanPrice(planId as PlanId, currency as 'USD' | 'BDT');

    const result = await billingService.createPaymentIntent(
      req.user!.userId,
      provider as PaymentProvider,
      planId as PlanId,
      amount,
      currency,
      returnUrl
    );

    return reply.code(201).send(result);
  });
}
