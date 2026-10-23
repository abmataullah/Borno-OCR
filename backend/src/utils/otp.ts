import { randomInt } from 'crypto';

export function generateOtp(length: number = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(randomInt(min, max + 1)).padStart(length, '0');
}

export function isOtpExpired(expiresAt: Date): boolean {
  return Date.now() > expiresAt.getTime();
}

export function getOtpExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}
