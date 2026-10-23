import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { adminService } from '../services/admin.service';
import { adminMiddleware } from '../middleware/auth';
import { z } from 'zod';

const assignPlanSchema = z.object({
  planId: z.enum(['free', 'pro', 'business']),
  storageQuotaMb: z.number().int().min(0).optional(),
});

const manualPaymentSchema = z.object({
  userId: z.string().uuid(),
  planId: z.enum(['free', 'pro', 'business']),
  amount: z.number().positive(),
  provider: z.enum(['stripe', 'bkash', 'sslcommerz', 'manual']).default('manual'),
  note: z.string().max(500).optional(),
});

const updateAdminSchema = z.object({
  isAdmin: z.boolean(),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', adminMiddleware);

  app.get('/admin/stats', async (_req: FastifyRequest, reply: FastifyReply) => {
    const stats = await adminService.getStats();
    return reply.send(stats);
  });

  app.get('/admin/users', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? '50', 10);
    const offset = parseInt(query.offset ?? '0', 10);
    const users = await adminService.listUsers(limit, offset);
    return reply.send(users);
  });

  app.get('/admin/users/:userId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };
    const user = await adminService.getUserById(userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });
    return reply.send(user);
  });

  app.patch('/admin/users/:userId/plan', async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };
    const parsed = assignPlanSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    await adminService.updateUserPlan(userId, parsed.data.planId, parsed.data.storageQuotaMb);
    return reply.send({ success: true });
  });

  app.patch('/admin/users/:userId/admin', async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };
    const parsed = updateAdminSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    await adminService.setUserAdmin(userId, parsed.data.isAdmin);
    return reply.send({ success: true });
  });

  app.delete('/admin/users/:userId', async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req.params as { userId: string };
    if (userId === req.user!.userId) {
      return reply.code(400).send({ error: 'Cannot delete yourself' });
    }
    await adminService.deleteUser(userId);
    return reply.code(204).send();
  });

  app.post('/admin/payments/manual', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = manualPaymentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const user = await adminService.getUserById(parsed.data.userId);
    if (!user) return reply.code(404).send({ error: 'User not found' });

    await adminService.addManualPayment(
      parsed.data.userId,
      parsed.data.planId,
      parsed.data.amount,
      parsed.data.provider,
      parsed.data.note
    );

    return reply.code(201).send({ success: true });
  });

  app.get('/admin/projects', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? '50', 10);
    const offset = parseInt(query.offset ?? '0', 10);
    const projects = await adminService.listAllProjects(limit, offset);
    return reply.send(projects);
  });

  app.get('/admin/payments', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? '50', 10);
    const offset = parseInt(query.offset ?? '0', 10);
    const payments = await adminService.listAllPayments(limit, offset);
    return reply.send(payments);
  });
}
