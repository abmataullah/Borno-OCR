import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { requestOtpSchema, verifyOtpSchema } from '../schemas/auth.schema';
import { authMiddleware } from '../middleware/auth';
import {
  authRateLimit,
  resetAuthAttempts,
  otpRequestRateLimit,
  otpVerifyRateLimit,
  resetOtpVerifyAttempts,
} from '../middleware/security';

function tooManyAttempts(reply: FastifyReply, retryAfterSeconds: number) {
  return reply.code(429).header('Retry-After', String(retryAfterSeconds)).send({
    error: 'Too many attempts. Please try again later.',
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/request-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const rateCheck = authRateLimit(request.ip);
    if (!rateCheck.allowed) {
      return reply.code(429).header('Retry-After', String(rateCheck.retryAfterSeconds)).send({
        error: 'Too many attempts. Please try again later.',
      });
    }

    const parsed = requestOtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const emailCheck = otpRequestRateLimit(parsed.data.email);
    if (!emailCheck.allowed) {
      return tooManyAttempts(reply, emailCheck.retryAfterSeconds);
    }

    try {
      const result = await authService.requestOtp(parsed.data.email);
      return reply.code(200).send(result);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Failed to send OTP' });
    }
  });

  app.post('/auth/verify-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const rateCheck = authRateLimit(request.ip);
    if (!rateCheck.allowed) {
      return reply.code(429).header('Retry-After', String(rateCheck.retryAfterSeconds)).send({
        error: 'Too many attempts. Please try again later.',
      });
    }

    const parsed = verifyOtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const emailCheck = otpVerifyRateLimit(parsed.data.email);
    if (!emailCheck.allowed) {
      return tooManyAttempts(reply, emailCheck.retryAfterSeconds);
    }

    try {
      const result = await authService.verifyOtp(parsed.data.email, parsed.data.code, parsed.data.name);
      if (!result) {
        return reply.code(401).send({ error: 'Invalid or expired OTP' });
      }
      resetAuthAttempts(request.ip);
      resetOtpVerifyAttempts(parsed.data.email);
      return reply.code(200).send({
        token: result.token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          plan: result.user.plan,
          isAdmin: result.user.isAdmin,
          storageQuotaMb: result.user.storageQuotaMb,
          storageUsedMb: result.user.storageUsedMb,
        },
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: 'Verification failed' });
    }
  });

  app.get('/auth/me', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authService.getUserById(request.user!.userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.code(200).send({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      isAdmin: user.isAdmin,
      storageQuotaMb: user.storageQuotaMb,
      storageUsedMb: user.storageUsedMb,
    });
  });
}
