import { pgTable, uuid, varchar, timestamp, integer, boolean, text, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';

export const planEnum = pgEnum('plan', ['free', 'pro', 'business']);
export const otpStatusEnum = pgEnum('otp_status', ['pending', 'verified', 'expired']);
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  plan: planEnum('plan').default('free').notNull(),
  isAdmin: boolean('is_admin').default(false).notNull(),
  storageQuotaMb: integer('storage_quota_mb').default(100).notNull(),
  storageUsedMb: integer('storage_used_mb').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  status: otpStatusEnum('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  emailStatusIdx: index('idx_otp_codes_email_status').on(t.email, t.status),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  token: varchar('token', { length: 512 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  originalPdfKey: varchar('original_pdf_key', { length: 512 }),
  projectData: jsonb('project_data'),
  pageCount: integer('page_count').default(0).notNull(),
  fileSizeKb: integer('file_size_kb').default(0).notNull(),
  isShared: boolean('is_shared').default(false).notNull(),
  shareToken: varchar('share_token', { length: 255 }),
  tags: text('tags').array().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_projects_user_id').on(t.userId),
  shareTokenIdx: index('idx_projects_share_token').on(t.shareToken),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  plan: planEnum('plan').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerSubscriptionId: varchar('provider_subscription_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  amount: integer('amount').notNull(),
  currency: varchar('currency', { length: 3 }).default('BDT').notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  providerPaymentId: varchar('provider_payment_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobStatusEnum = pgEnum('job_status', ['queued', 'processing', 'completed', 'failed']);

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  status: jobStatusEnum('status').default('queued').notNull(),
  progress: integer('progress').default(0).notNull(),
  result: jsonb('result'),
  error: text('error'),
  bullmqJobId: varchar('bullmq_job_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  projectIdIdx: index('idx_jobs_project_id').on(t.projectId),
  userIdIdx: index('idx_jobs_user_id').on(t.userId),
  statusIdx: index('jobs_status_idx').on(t.status),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type OtpCode = typeof otpCodes.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export const annotations = pgTable('annotations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  pageIndex: integer('page_index').notNull(),
  annotationType: varchar('annotation_type', { length: 50 }).default('note').notNull(),
  content: text('content'),
  bbox: jsonb('bbox'),
  color: varchar('color', { length: 20 }).default('#d4af37').notNull(),
  resolved: boolean('resolved').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  projectIdIdx: index('idx_annotations_project_id').on(t.projectId),
  pageIdx: index('idx_annotations_page').on(t.projectId, t.pageIndex),
}));

export type Annotation = typeof annotations.$inferSelect;
export type NewAnnotation = typeof annotations.$inferInsert;

// --- App settings (payment gateway config, plan price overrides) ---
export const appSettings = pgTable('app_settings', {
  id: varchar('id', { length: 50 }).primaryKey().default('global'),
  data: jsonb('data').notNull().default({}),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;

// --- Support ticket system ---
export const ticketStatusEnum = pgEnum('ticket_status', ['open', 'pending', 'closed']);
export const ticketSenderEnum = pgEnum('ticket_sender', ['customer', 'admin']);

export const supportTickets = pgTable('support_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  status: ticketStatusEnum('status').default('open').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('idx_support_tickets_user_id').on(t.userId),
  statusIdx: index('idx_support_tickets_status').on(t.status),
}));

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id').references(() => supportTickets.id).notNull(),
  senderRole: ticketSenderEnum('sender_role').notNull(),
  senderId: uuid('sender_id'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  ticketIdIdx: index('idx_ticket_messages_ticket_id').on(t.ticketId),
}));

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type NewTicketMessage = typeof ticketMessages.$inferInsert;
