import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import type { User } from '../db/schema';

export interface JwtPayload {
  userId: string;
  email: string;
  plan: string;
}

export function signToken(user: Pick<User, 'id' | 'email' | 'plan'>): string {
  return jwt.sign(
    { userId: user.id, email: user.email, plan: user.plan } satisfies JwtPayload,
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}
