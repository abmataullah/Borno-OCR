import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { generateOtp, getOtpExpiry } from '../utils/otp';
import { sendOtpEmail } from './email.service';
import { signToken } from '../utils/jwt';
import { config } from '../config/env';
import type { User } from '../db/schema';

export class AuthService {
  async requestOtp(email: string): Promise<{ sent: boolean }> {
    const code = generateOtp(config.otpLength);
    const expiresAt = getOtpExpiry(config.otpExpiryMinutes);

    await db.insert(schema.otpCodes).values({
      email,
      code,
      expiresAt,
    });

    await sendOtpEmail(email, code);
    return { sent: true };
  }

  async verifyOtp(email: string, code: string, name?: string): Promise<{ token: string; user: User } | null> {
    const records = await db
      .select()
      .from(schema.otpCodes)
      .where(
        and(
          eq(schema.otpCodes.email, email),
          eq(schema.otpCodes.code, code),
          eq(schema.otpCodes.status, 'pending'),
        )
      )
      .orderBy(desc(schema.otpCodes.createdAt))
      .limit(1);

    if (records.length === 0) {
      return null;
    }

    const otpRecord = records[0];
    const expiresAt = new Date(otpRecord.expiresAt);
    const now = Date.now();
    const isExpired = now > expiresAt.getTime();

    console.log(`[OTP Verify] email=${email}, code=${code}, expiresAt=${expiresAt.toISOString()}, now=${new Date(now).toISOString()}, isExpired=${isExpired}`);

    if (isExpired) {
      await db
        .update(schema.otpCodes)
        .set({ status: 'expired' })
        .where(eq(schema.otpCodes.id, otpRecord.id));
      return null;
    }

    await db
      .update(schema.otpCodes)
      .set({ status: 'verified' })
      .where(eq(schema.otpCodes.id, otpRecord.id));

    let user = await this.findOrCreateUser(email, name);
    const token = signToken(user);
    return { token, user };
  }

  private async findOrCreateUser(email: string, name?: string): Promise<User> {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    const [newUser] = await db
      .insert(schema.users)
      .values({
        email,
        name: name ?? email.split('@')[0],
      })
      .returning();

    return newUser;
  }

  async getUserById(userId: string): Promise<User | null> {
    const result = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return result[0] ?? null;
  }
}

export const authService = new AuthService();
