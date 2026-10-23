import { eq, lt, and } from 'drizzle-orm';
import { db, schema } from '../db';
import IORedis from 'ioredis';
import { config } from '../config/env';

const CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let schedulerTimer: NodeJS.Timeout | null = null;
let redisClient: IORedis | null = null;

function getRedis(): IORedis {
  if (!redisClient) {
    redisClient = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return redisClient;
}

async function cleanupExpiredOtps(): Promise<void> {
  const now = new Date();
  await db
    .update(schema.otpCodes)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.otpCodes.status, 'pending'),
        lt(schema.otpCodes.expiresAt, now)
      )
    );

  // Delete OTP records older than 24 hours
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const expired = await db
    .delete(schema.otpCodes)
    .where(lt(schema.otpCodes.expiresAt, cutoff))
    .returning();
  if (expired.length > 0) {
    console.log(`[scheduler] Cleaned up ${expired.length} expired OTP records`);
  }
}

async function cleanupStaleJobs(): Promise<void> {
  // Mark jobs that have been queued/processing for more than 1 hour as failed
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const stale = await db
    .update(schema.jobs)
    .set({ status: 'failed', error: 'Job timed out', updatedAt: new Date() })
    .where(
      eq(schema.jobs.status, 'processing')
    )
    .returning();
  if (stale.length > 0) {
    console.log(`[scheduler] Marked ${stale.length} stale jobs as failed`);
  }
}

async function cleanupRedisJobs(): Promise<void> {
  try {
    const redis = getRedis();
    // Clean up job status hashes older than 1 hour
    const keys = await redis.keys('docflow:job:*');
    let cleaned = 0;
    for (const key of keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // No expiry set — set one
        await redis.expire(key, 3600);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[scheduler] Set TTL on ${cleaned} Redis job keys`);
    }
  } catch (err) {
    console.error('[scheduler] Redis cleanup failed:', err);
  }
}

async function runSchedulerTasks(): Promise<void> {
  try {
    await cleanupExpiredOtps();
    await cleanupStaleJobs();
    await cleanupRedisJobs();
  } catch (err) {
    console.error('[scheduler] Task error:', err);
  }
}

export function startScheduler(): void {
  if (schedulerTimer) {
    console.log('[scheduler] Already running');
    return;
  }
  console.log('[scheduler] Starting hourly cleanup scheduler');
  schedulerTimer = setInterval(() => {
    runSchedulerTasks().catch(console.error);
  }, CRON_INTERVAL_MS);

  // Run once on startup after 30 seconds
  setTimeout(() => {
    runSchedulerTasks().catch(console.error);
  }, 30000);
}

export function stopScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('[scheduler] Stopped');
  }
}
