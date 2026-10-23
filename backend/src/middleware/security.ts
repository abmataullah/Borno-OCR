import type { FastifyRequest, FastifyReply } from 'fastify';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf'];
const ALLOWED_UPLOAD_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export function validateFileType(mimetype: string, allowImages = false): boolean {
  const allowed = allowImages ? ALLOWED_UPLOAD_MIME_TYPES : ALLOWED_MIME_TYPES;
  return allowed.includes(mimetype);
}

export function validateFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE;
}

const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b.*\b(from|into|table|database)\b)/i,
  /('|\")(\s)*(or|and)(\s)*('|\")/i,
  /--\s*$/m,
  /\/\*.*\*\//,
];

const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*"/gi,
  /on\w+\s*=\s*'/gi,
];

export function sanitizeInput(input: string): string {
  let sanitized = input;
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  return sanitized.trim();
}

export function detectSqlInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function detectXss(input: string): boolean {
  return XSS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Who may embed BornoOCR in an iframe: itself and Banglai Cloud (the
 * HomeMade Software integration). Used as CSP frame-ancestors.
 */
export const FRAME_ANCESTORS = ["'self'", 'https://banglai.cloud', 'https://*.banglai.cloud'];

export async function securityHeadersMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header('X-Content-Type-Options', 'nosniff');
  // NOTE: Content-Security-Policy is set by @fastify/helmet in app.ts (with
  // FRAME_ANCESTORS). Setting it here too would overwrite helmet's full policy.
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

export function validateProjectName(name: string): { valid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Project name is required' };
  }
  if (name.length > 255) {
    return { valid: false, error: 'Project name too long (max 255 characters)' };
  }
  if (detectSqlInjection(name)) {
    return { valid: false, error: 'Invalid characters in project name' };
  }
  if (detectXss(name)) {
    return { valid: false, error: 'Invalid characters in project name' };
  }
  return { valid: true };
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  if (email.length > 255) {
    return { valid: false, error: 'Email too long' };
  }
  return { valid: true };
}

const requestCounts = new Map<string, { count: number; resetTime: number }>();
const BURST_LIMIT = 10;
const BURST_WINDOW = 10 * 1000;

export function burstProtection(request: FastifyRequest): { allowed: boolean; remaining: number } {
  const ip = request.ip;
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + BURST_WINDOW });
    return { allowed: true, remaining: BURST_LIMIT - 1 };
  }

  entry.count++;
  if (entry.count > BURST_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: BURST_LIMIT - entry.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of requestCounts.entries()) {
    if (now > entry.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, 60 * 1000);

/**
 * SECURITY: Magic-byte (file signature) validation.
 * MIME types can be spoofed by the client — verify the actual file content.
 */
const FILE_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff] }],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF (WEBP at offset 8)
};

export function validateFileSignature(buffer: Buffer, claimedMime: string): boolean {
  const signatures = FILE_SIGNATURES[claimedMime];
  if (!signatures) return false;

  return signatures.some(({ bytes, offset = 0 }) => {
    if (buffer.length < offset + bytes.length) return false;
    for (let i = 0; i < bytes.length; i++) {
      if (buffer[offset + i] !== bytes[i]) return false;
    }
    // Extra check for WebP: RIFF container must contain WEBP fourcc
    if (claimedMime === 'image/webp') {
      return buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP';
    }
    return true;
  });
}

/**
 * SECURITY: Detect embedded JavaScript in PDFs (potential XSS/phishing vector).
 * Returns true if the PDF contains active content that warrants extra scrutiny.
 */
export function pdfContainsActiveContent(buffer: Buffer): boolean {
  // Only scan first 5MB for performance
  const scanLength = Math.min(buffer.length, 5 * 1024 * 1024);
  const content = buffer.toString('latin1', 0, scanLength);
  return (
    /\/JavaScript\s*\(/.test(content) ||
    /\/JS\s*\(/.test(content) ||
    /\/OpenAction\s*<</.test(content) ||
    /\/Launch\s*<</.test(content) ||
    /\/EmbeddedFile/.test(content)
  );
}

/**
 * SECURITY: Stricter rate limiting for auth endpoints (brute-force protection).
 * 5 attempts per 15 minutes per IP for login/register.
 */
const authAttempts = new Map<string, { count: number; resetTime: number }>();
const AUTH_LIMIT = 5;
const AUTH_WINDOW = 15 * 60 * 1000;

export function authRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (!entry || now > entry.resetTime) {
    authAttempts.set(ip, { count: 1, resetTime: now + AUTH_WINDOW });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count++;
  if (entry.count > AUTH_LIMIT) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetTime - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/** Reset auth attempts after successful login (avoid locking out legit users). */
export function resetAuthAttempts(ip: string): void {
  authAttempts.delete(ip);
}

/**
 * SECURITY: per-email limits, so OTP codes can't be guessed (or OTP emails
 * spammed) by rotating IPs. 5 code requests and 5 verify attempts per email
 * per 15 minutes. A successful verify clears the verify counter.
 */
const otpRequestsByEmail = new Map<string, { count: number; resetTime: number }>();
const otpVerifiesByEmail = new Map<string, { count: number; resetTime: number }>();

function emailLimit(
  store: Map<string, { count: number; resetTime: number }>,
  email: string,
): { allowed: boolean; retryAfterSeconds: number } {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + AUTH_WINDOW });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count++;
  if (entry.count > AUTH_LIMIT) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetTime - now) / 1000) };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function otpRequestRateLimit(email: string): { allowed: boolean; retryAfterSeconds: number } {
  return emailLimit(otpRequestsByEmail, email);
}

export function otpVerifyRateLimit(email: string): { allowed: boolean; retryAfterSeconds: number } {
  return emailLimit(otpVerifiesByEmail, email);
}

export function resetOtpVerifyAttempts(email: string): void {
  otpVerifiesByEmail.delete(email.trim().toLowerCase());
}

/** Test helper: clear every in-memory auth limiter. */
export function clearAuthRateLimits(): void {
  authAttempts.clear();
  otpRequestsByEmail.clear();
  otpVerifiesByEmail.clear();
}

setInterval(() => {
  const now = Date.now();
  for (const store of [authAttempts, otpRequestsByEmail, otpVerifiesByEmail]) {
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }
}, 60 * 1000).unref();
