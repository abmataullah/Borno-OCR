import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ticketService } from '../services/ticket.service';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  message: z.string().min(1).max(5000),
});

const addMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'pending', 'closed']),
});

// Customer-facing support ticket routes
export async function ticketRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.post('/tickets', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const ticket = await ticketService.createTicket(req.user!.userId, parsed.data.subject, parsed.data.message);
    return reply.code(201).send(ticket);
  });

  app.get('/tickets', async (req: FastifyRequest, reply: FastifyReply) => {
    const tickets = await ticketService.listUserTickets(req.user!.userId);
    return reply.send(tickets);
  });

  app.get('/tickets/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const ticket = await ticketService.getTicketById(id);
    if (!ticket || ticket.userId !== req.user!.userId) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }
    const messages = await ticketService.getTicketMessages(id);
    return reply.send({ ticket, messages });
  });

  app.post('/tickets/:id/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const ticket = await ticketService.getTicketById(id);
    if (!ticket || ticket.userId !== req.user!.userId) {
      return reply.code(404).send({ error: 'Ticket not found' });
    }
    const parsed = addMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const message = await ticketService.addMessage(id, 'customer', req.user!.userId, parsed.data.body);
    return reply.code(201).send(message);
  });
}

// Admin-facing support ticket routes
export async function adminTicketRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', adminMiddleware);

  app.get('/admin/tickets', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? '50', 10);
    const offset = parseInt(query.offset ?? '0', 10);
    const tickets = await ticketService.listAllTickets(limit, offset);
    return reply.send(tickets);
  });

  app.get('/admin/tickets/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return reply.code(404).send({ error: 'Ticket not found' });
    const messages = await ticketService.getTicketMessages(id);
    return reply.send({ ticket, messages });
  });

  app.post('/admin/tickets/:id/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return reply.code(404).send({ error: 'Ticket not found' });
    const parsed = addMessageSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const message = await ticketService.addMessage(id, 'admin', req.user!.userId, parsed.data.body);
    return reply.code(201).send(message);
  });

  app.patch('/admin/tickets/:id', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return reply.code(404).send({ error: 'Ticket not found' });
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    await ticketService.updateStatus(id, parsed.data.status);
    return reply.send({ success: true });
  });
}
