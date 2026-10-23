import dotenv from 'dotenv';
dotenv.config();

// SECURITY: never run production with default secrets
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-in-production') {
    throw new Error('FATAL: JWT_SECRET must be set to a strong random value in production');
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production');
  }
  if (!process.env.CORS_ORIGIN) {
    throw new Error('FATAL: CORS_ORIGIN must be explicitly set in production');
  }
  if (!process.env.BORNOOCR_EMBED_SECRET || process.env.BORNOOCR_EMBED_SECRET === 'dev-bornoocr-embed-secret-change-me') {
    throw new Error('FATAL: BORNOOCR_EMBED_SECRET must be set to a strong random value in production (shared with Banglai Cloud)');
  }
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://bornoocr:bornoocr@localhost:5432/bornoocr',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  smtpHost: process.env.SMTP_HOST ?? 'localhost',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'noreply@bornoocr.local',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
  rateLimitWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES ?? 10),
  otpLength: 6,
} as const;
