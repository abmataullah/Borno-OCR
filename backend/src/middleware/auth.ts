import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../utils/jwt';
import { verifyEmbedToken } from '../utils/embed-token';
import { authService } from '../services/auth.service';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      plan: string;
    };
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  // 1. Try BornoOCR's own JWT first (standalone mode).
  const jwtPayload = verifyToken(token);
  if (jwtPayload) {
    const user = await authService.getUserById(jwtPayload.userId);
    if (!user) {
      reply.code(401).send({ error: 'User not found' });
      return;
    }
    request.user = {
      userId: jwtPayload.userId,
      email: jwtPayload.email,
      plan: user.plan,
    };
    return;
  }

  // 2. Fallback: try Banglai Cloud embed token (embed mode).
  // The embed token is HMAC-signed by Banglai Cloud and carries user identity +
  // plan. We trust it without a BornoOCR DB lookup — Banglai Cloud has already
  // authenticated the user via NextAuth and verified the subscription.
  const embedPayload = verifyEmbedToken(token);
  if (embedPayload) {
    request.user = {
      userId: embedPayload.uid,
      email: embedPayload.email,
      plan: embedPayload.plan,
    };
    return;
  }

  reply.code(401).send({ error: 'Invalid or expired token' });
}

export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;

  // Embed-mode users are never admins in BornoOCR (Banglai Cloud admins don't
  // need BornoOCR admin panel — they manage subscriptions from Banglai Cloud).
  const embedToken = request.headers.authorization?.slice(7) ?? '';
  if (verifyEmbedToken(embedToken)) {
    reply.code(403).send({ error: 'Admin access required' });
    return;
  }

  const user = await authService.getUserById(request.user!.userId);
  if (!user?.isAdmin) {
    reply.code(403).send({ error: 'Admin access required' });
    return;
  }
}
