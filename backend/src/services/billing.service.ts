import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { PlanId, PaymentProvider } from '../config/plans';
import { config } from '../config/env';
import { sendPaymentConfirmationEmail } from './email.service';
import { settingsService } from './settings.service';

export class BillingService {
  async createPaymentIntent(
    userId: string,
    provider: PaymentProvider,
    planId: PlanId,
    amount: number,
    currency: string,
    returnUrl: string
  ): Promise<{ paymentId: string; checkoutUrl: string }> {
    const [payment] = await db
      .insert(schema.payments)
      .values({
        userId,
        provider: provider as string,
        amount: Math.round(amount * 100),
        currency,
        status: 'pending',
        metadata: { planId, returnUrl },
      })
      .returning();

    switch (provider) {
      case 'stripe':
        return { paymentId: payment.id, checkoutUrl: await this.createStripeCheckout(payment.id, amount, currency, returnUrl) };
      case 'bkash':
        return { paymentId: payment.id, checkoutUrl: await this.createBkashCheckout(payment.id, amount, returnUrl) };
      case 'sslcommerz':
        return { paymentId: payment.id, checkoutUrl: await this.createSslCheckout(payment.id, amount, currency, returnUrl) };
      case 'manual':
        return { paymentId: payment.id, checkoutUrl: returnUrl };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  async handleWebhook(
    provider: PaymentProvider,
    payload: Record<string, unknown>,
    signature?: string
  ): Promise<{ success: boolean; userId?: string; planId?: PlanId }> {
    let verified = false;
    let externalId = '';
    let status: 'pending' | 'paid' | 'failed' | 'refunded' = 'pending';

    switch (provider) {
      case 'stripe':
        verified = this.verifyStripeWebhook(payload, signature);
        externalId = (payload.id as string) ?? '';
        status = payload.type === 'payment_intent.succeeded' ? 'paid' : 'pending';
        break;
      case 'bkash':
        verified = this.verifyBkashWebhook(payload);
        externalId = (payload.paymentID as string) ?? '';
        status = payload.status === 'completed' ? 'paid' : 'failed';
        break;
      case 'sslcommerz':
        verified = this.verifySslWebhook(payload);
        externalId = (payload.tran_id as string) ?? '';
        status = payload.status === 'VALID' ? 'paid' : 'failed';
        break;
      case 'manual':
        verified = true;
        externalId = (payload.paymentId as string) ?? '';
        status = 'paid';
        break;
    }

    if (!verified) {
      return { success: false };
    }

    const payments = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, externalId))
      .limit(1);

    if (payments.length === 0) {
      return { success: false };
    }

    const payment = payments[0];
    await db
      .update(schema.payments)
      .set({ status, providerPaymentId: externalId })
      .where(eq(schema.payments.id, payment.id));

    if (status === 'paid') {
      const metadata = payment.metadata as { planId: PlanId };
      await db
        .update(schema.users)
        .set({ plan: metadata.planId, updatedAt: new Date() })
        .where(eq(schema.users.id, payment.userId));

      await db
        .update(schema.subscriptions)
        .set({ status: 'active', plan: metadata.planId, updatedAt: new Date() })
        .where(eq(schema.subscriptions.userId, payment.userId));

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payment.userId))
        .limit(1);

      if (user?.email) {
        await sendPaymentConfirmationEmail(
          user.email,
          metadata.planId,
          payment.amount / 100,
          payment.currency,
          provider as string
        ).catch((err) => console.error('Payment email failed:', err));
      }

      return { success: true, userId: payment.userId, planId: metadata.planId };
    }

    return { success: true };
  }

  async getSubscription(userId: string) {
    const [sub] = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);
    return sub ?? null;
  }

  async getPaymentHistory(userId: string) {
    return db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.userId, userId))
      .orderBy(schema.payments.createdAt);
  }

  async assignPlan(userId: string, planId: PlanId, provider: PaymentProvider = 'manual', amount?: number): Promise<void> {
    await db
      .insert(schema.payments)
      .values({
        userId,
        provider: provider as string,
        amount: amount ? Math.round(amount * 100) : 0,
        currency: provider === 'stripe' ? 'USD' : 'BDT',
        status: 'paid',
        metadata: { planId, manual: true },
      })
      .returning();

    await db
      .update(schema.users)
      .set({ plan: planId, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    const existingSubs = await db
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);

    if (existingSubs.length > 0) {
      await db
        .update(schema.subscriptions)
        .set({ status: 'active', plan: planId, provider: provider as string, updatedAt: new Date() })
        .where(eq(schema.subscriptions.userId, userId));
    } else {
      await db
        .insert(schema.subscriptions)
        .values({
          userId,
          plan: planId,
          provider: provider as string,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    }
  }

  private async createStripeCheckout(paymentId: string, amount: number, currency: string, returnUrl: string): Promise<string> {
    const gw = await settingsService.getGatewayConfig('stripe');
    const key = (gw.enabled && gw.secretKey) ? gw.secretKey : (process.env.STRIPE_SECRET_KEY ?? '');
    if (!key) {
      return `${returnUrl}?payment_id=${paymentId}&provider=stripe&status=mock`;
    }

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'mode': 'payment',
        'success_url': `${returnUrl}?payment_id=${paymentId}&status=success`,
        'cancel_url': `${returnUrl}?payment_id=${paymentId}&status=cancelled`,
        'line_items[0][price_data][currency]': currency.toLowerCase(),
        'line_items[0][price_data][product_data][name]': 'BornoOCR Subscription',
        'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
        'line_items[0][quantity]': '1',
        'metadata[paymentId]': paymentId,
      }),
    });

    const session = await resp.json() as { url?: string };
    return session.url ?? returnUrl;
  }

  private async createBkashCheckout(paymentId: string, amount: number, returnUrl: string): Promise<string> {
    const gw = await settingsService.getGatewayConfig('bkash');
    const baseUrl = (gw.enabled && gw.baseUrl) ? gw.baseUrl : (process.env.BKASH_BASE_URL ?? 'https://tokenized.sandbox.bka.sh/v1.2.0-beta');
    const appKey = (gw.enabled && gw.appKey) ? gw.appKey : (process.env.BKASH_APP_KEY ?? '');
    const appSecret = (gw.enabled && gw.appSecret) ? gw.appSecret : (process.env.BKASH_APP_SECRET ?? '');
    const username = (gw.enabled && gw.username) ? gw.username : (process.env.BKASH_USERNAME ?? '');
    const password = (gw.enabled && gw.password) ? gw.password : (process.env.BKASH_PASSWORD ?? '');

    if (!appKey) {
      return `${returnUrl}?payment_id=${paymentId}&provider=bkash&status=mock`;
    }

    try {
      const tokenResp = await fetch(`${baseUrl}/tokenized/checkout/token/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          username,
          password,
        },
        body: JSON.stringify({ app_key: appKey, app_secret: appSecret }),
      });
      const tokenData = await tokenResp.json() as { id_token?: string };
      const token = tokenData.id_token;

      const createResp = await fetch(`${baseUrl}/tokenized/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          authorization: token ?? '',
          'x-app-key': appKey,
        },
        body: JSON.stringify({
          mode: '0011',
          payerReference: ' ',
          callbackURL: `${returnUrl}?payment_id=${paymentId}&provider=bkash`,
          amount: String(amount),
          currency: 'BDT',
          intent: 'sale',
          merchantInvoiceNumber: paymentId,
        }),
      });
      const createData = await createResp.json() as { bkashURL?: string };
      return createData.bkashURL ?? returnUrl;
    } catch {
      return returnUrl;
    }
  }

  private async createSslCheckout(paymentId: string, amount: number, currency: string, returnUrl: string): Promise<string> {
    const gw = await settingsService.getGatewayConfig('sslcommerz');
    const baseUrl = (gw.enabled && gw.baseUrl) ? gw.baseUrl : (process.env.SSL_BASE_URL ?? 'https://sandbox.sslcommerz.com/gwprocess/v3/api.php');
    const storeId = (gw.enabled && gw.storeId) ? gw.storeId : (process.env.SSL_STORE_ID ?? '');
    const storePasswd = (gw.enabled && gw.storePasswd) ? gw.storePasswd : (process.env.SSL_STORE_PASSWD ?? '');

    if (!storeId) {
      return `${returnUrl}?payment_id=${paymentId}&provider=sslcommerz&status=mock`;
    }

    const params = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePasswd,
      total_amount: String(amount),
      currency,
      tran_id: paymentId,
      success_url: `${returnUrl}?payment_id=${paymentId}&status=success`,
      fail_url: `${returnUrl}?payment_id=${paymentId}&status=failed`,
      cancel_url: `${returnUrl}?payment_id=${paymentId}&status=cancelled`,
      cus_name: 'BornoOCR User',
      cus_email: 'user@bornoocr.banglai.cloud',
      cus_phone: '00000000000',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      product_name: 'BornoOCR Subscription',
      product_category: 'subscription',
      product_profile: 'general',
    });

    try {
      const resp = await fetch(`${baseUrl}?${params.toString()}`, { method: 'POST' });
      const data = await resp.json() as { GatewayPageURL?: string };
      return data.GatewayPageURL ?? returnUrl;
    } catch {
      return returnUrl;
    }
  }

  private verifyStripeWebhook(payload: Record<string, unknown>, signature?: string): boolean {
    if (!signature) return false;
    return Boolean(payload.type && payload.data);
  }

  private verifyBkashWebhook(payload: Record<string, unknown>): boolean {
    return payload.status === 'completed' || payload.status === 'pending';
  }

  private verifySslWebhook(payload: Record<string, unknown>): boolean {
    return payload.status === 'VALID' || payload.status === 'FAILED';
  }
}

export const billingService = new BillingService();
