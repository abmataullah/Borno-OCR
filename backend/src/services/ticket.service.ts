import { eq, desc } from 'drizzle-orm';
import { db, schema } from '../db';

export class TicketService {
  async createTicket(userId: string, subject: string, message: string) {
    const [ticket] = await db
      .insert(schema.supportTickets)
      .values({ userId, subject })
      .returning();

    await db.insert(schema.ticketMessages).values({
      ticketId: ticket.id,
      senderRole: 'customer',
      senderId: userId,
      body: message,
    });

    return ticket;
  }

  async listUserTickets(userId: string) {
    return db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.userId, userId))
      .orderBy(desc(schema.supportTickets.updatedAt));
  }

  async getTicketMessages(ticketId: string) {
    return db
      .select()
      .from(schema.ticketMessages)
      .where(eq(schema.ticketMessages.ticketId, ticketId))
      .orderBy(schema.ticketMessages.createdAt);
  }

  async getTicketById(ticketId: string) {
    const [ticket] = await db
      .select()
      .from(schema.supportTickets)
      .where(eq(schema.supportTickets.id, ticketId))
      .limit(1);
    return ticket ?? null;
  }

  async addMessage(ticketId: string, senderRole: 'customer' | 'admin', senderId: string, body: string) {
    const [message] = await db
      .insert(schema.ticketMessages)
      .values({ ticketId, senderRole, senderId, body })
      .returning();

    await db
      .update(schema.supportTickets)
      .set({
        updatedAt: new Date(),
        // Customer replies re-open a pending/closed ticket; admin replies mark it pending (awaiting customer)
        status: senderRole === 'customer' ? 'open' : 'pending',
      })
      .where(eq(schema.supportTickets.id, ticketId));

    return message;
  }

  async listAllTickets(limit = 50, offset = 0) {
    return db
      .select({
        id: schema.supportTickets.id,
        userId: schema.supportTickets.userId,
        subject: schema.supportTickets.subject,
        status: schema.supportTickets.status,
        createdAt: schema.supportTickets.createdAt,
        updatedAt: schema.supportTickets.updatedAt,
        userEmail: schema.users.email,
        userName: schema.users.name,
      })
      .from(schema.supportTickets)
      .leftJoin(schema.users, eq(schema.supportTickets.userId, schema.users.id))
      .orderBy(desc(schema.supportTickets.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  async updateStatus(ticketId: string, status: 'open' | 'pending' | 'closed') {
    await db
      .update(schema.supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.supportTickets.id, ticketId));
  }
}

export const ticketService = new TicketService();
