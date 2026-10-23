import { eq, desc, count, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { PlanId, PaymentProvider } from '../config/plans';
import { billingService } from './billing.service';

export class AdminService {
  async getStats() {
    const [userCount] = await db.select({ count: count() }).from(schema.users);
    const [projectCount] = await db.select({ count: count() }).from(schema.projects);
    const [paymentCount] = await db.select({ count: count() }).from(schema.payments);

    const planDistribution = await db
      .select({ plan: schema.users.plan, count: count() })
      .from(schema.users)
      .groupBy(schema.users.plan);

    const revenueResult = await db
      .select({ total: sql<number>`sum(${schema.payments.amount})` })
      .from(schema.payments)
      .where(eq(schema.payments.status, 'paid'));

    return {
      users: userCount.count,
      projects: projectCount.count,
      payments: paymentCount.count,
      revenue: revenueResult[0]?.total ?? 0,
      planDistribution: planDistribution.reduce((acc, r) => {
        acc[r.plan] = r.count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  async listUsers(limit = 50, offset = 0) {
    return db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        plan: schema.users.plan,
        isAdmin: schema.users.isAdmin,
        storageQuotaMb: schema.users.storageQuotaMb,
        storageUsedMb: schema.users.storageUsedMb,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUserById(userId: string) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return user ?? null;
  }

  async updateUserPlan(userId: string, planId: PlanId, storageQuotaMb?: number): Promise<void> {
    const updates: Record<string, unknown> = { plan: planId, updatedAt: new Date() };
    if (storageQuotaMb !== undefined) {
      updates.storageQuotaMb = storageQuotaMb;
    }
    await db.update(schema.users).set(updates).where(eq(schema.users.id, userId));
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    await db
      .update(schema.users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async addManualPayment(
    userId: string,
    planId: PlanId,
    amount: number,
    provider: PaymentProvider = 'manual',
    note?: string
  ): Promise<void> {
    await billingService.assignPlan(userId, planId, provider, amount);

    if (note) {
      const [payment] = await db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.userId, userId))
        .orderBy(desc(schema.payments.createdAt))
        .limit(1);

      if (payment) {
        const metadata = (payment.metadata as Record<string, unknown>) ?? {};
        metadata.note = note;
        await db
          .update(schema.payments)
          .set({ metadata })
          .where(eq(schema.payments.id, payment.id));
      }
    }
  }

  async listAllProjects(limit = 50, offset = 0) {
    return db
      .select({
        id: schema.projects.id,
        userId: schema.projects.userId,
        name: schema.projects.name,
        pageCount: schema.projects.pageCount,
        fileSizeKb: schema.projects.fileSizeKb,
        isShared: schema.projects.isShared,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects)
      .orderBy(desc(schema.projects.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  async listAllPayments(limit = 50, offset = 0) {
    return db
      .select({
        id: schema.payments.id,
        userId: schema.payments.userId,
        amount: schema.payments.amount,
        currency: schema.payments.currency,
        provider: schema.payments.provider,
        status: schema.payments.status,
        metadata: schema.payments.metadata,
        createdAt: schema.payments.createdAt,
      })
      .from(schema.payments)
      .orderBy(desc(schema.payments.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(schema.payments).where(eq(schema.payments.userId, userId));
    await db.delete(schema.subscriptions).where(eq(schema.subscriptions.userId, userId));
    await db.delete(schema.projects).where(eq(schema.projects.userId, userId));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));
  }
}

export const adminService = new AdminService();
