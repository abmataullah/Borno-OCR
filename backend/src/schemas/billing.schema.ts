import { z } from 'zod';

export const createPaymentSchema = z.object({
  provider: z.enum(['stripe', 'bkash', 'sslcommerz', 'manual']),
  planId: z.enum(['free', 'pro', 'business']),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'BDT']).default('USD'),
  returnUrl: z.string().url(),
});

export const webhookSchema = z.object({
  provider: z.enum(['stripe', 'bkash', 'sslcommerz', 'manual']),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
});

export const planIdSchema = z.object({
  planId: z.enum(['free', 'pro', 'business']),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type WebhookInput = z.infer<typeof webhookSchema>;
