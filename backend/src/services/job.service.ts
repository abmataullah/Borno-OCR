import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import type { Job } from '../db/schema';
import { pdfProcessingQueue, conversionQueue, type PdfProcessingJobData, type ConversionJobData } from '../queue/queues';
import { redisConfig } from '../queue/connection';
import IORedis from 'ioredis';
import { sendJobCompletionEmail } from './email.service';

let redisClient: IORedis | null = null;
function getRedis(): IORedis {
  if (!redisClient) {
    redisClient = new IORedis(redisConfig.url, {
      maxRetriesPerRequest: null,
    });
  }
  return redisClient;
}

export class JobService {
  async createProcessingJob(
    userId: string,
    projectId: string,
    pdfKey: string,
    options?: { runOcr?: boolean; runTableDetection?: boolean; ocrLang?: string; useHybridOcr?: boolean }
  ): Promise<Job> {
    const [job] = await db
      .insert(schema.jobs)
      .values({
        userId,
        projectId,
        type: 'pdf-processing',
        status: 'queued',
      })
      .returning();

    const jobData: PdfProcessingJobData = {
      projectId,
      pdfKey,
      userId,
      options: {
        runOcr: options?.runOcr ?? true,
        runTableDetection: options?.runTableDetection ?? true,
        ocrLang: options?.ocrLang ?? 'ben+eng',
        useHybridOcr: options?.useHybridOcr ?? false,
      },
    };

    const bullmqJob = await pdfProcessingQueue.add('process', jobData as never, {
      jobId: job.id,
    });

    await db
      .update(schema.jobs)
      .set({ bullmqJobId: bullmqJob.id ?? null })
      .where(eq(schema.jobs.id, job.id));

    return job;
  }

  async createConversionJob(
    userId: string,
    projectId: string,
    pdfKey: string,
    targetFormat: 'docx' | 'odt' | 'html'
  ): Promise<Job> {
    const [job] = await db
      .insert(schema.jobs)
      .values({
        userId,
        projectId,
        type: `convert-${targetFormat}`,
        status: 'queued',
      })
      .returning();

    const jobData: ConversionJobData = {
      projectId,
      userId,
      pdfKey,
      targetFormat,
    };

    const bullmqJob = await conversionQueue.add('convert', jobData as never, {
      jobId: job.id,
    });

    await db
      .update(schema.jobs)
      .set({ bullmqJobId: bullmqJob.id ?? null })
      .where(eq(schema.jobs.id, job.id));

    return job;
  }

  async getById(userId: string, jobId: string): Promise<Job | null> {
    const result = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.userId, userId)))
      .limit(1);

    const job = result[0] ?? null;

    if (job && (job.status === 'queued' || job.status === 'processing')) {
      const synced = await this._syncFromRedis(job);
      if (synced) {
        const updated = await db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.id, jobId))
          .limit(1);
        return updated[0] ?? job;
      }
    }

    return job;
  }

  private async _syncFromRedis(job: Job): Promise<boolean> {
    try {
      const redis = getRedis();
      const key = `docflow:job:${job.id}`;
      const data = await redis.hgetall(key);
      if (!data || !data.status) return false;

      const status = data.status as 'queued' | 'processing' | 'completed' | 'failed';
      const progress = parseInt(data.progress ?? '0', 10);
      const result = data.result ? JSON.parse(data.result) : undefined;
      const error = data.error ?? undefined;

      const wasInProgress = job.status === 'queued' || job.status === 'processing';
      const isNowDone = status === 'completed' || status === 'failed';

      await db
        .update(schema.jobs)
        .set({
          status,
          progress,
          result,
          error,
          updatedAt: new Date(),
        })
        .where(eq(schema.jobs.id, job.id));

      if (wasInProgress && isNowDone) {
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, job.userId))
          .limit(1);

        const [project] = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, job.projectId))
          .limit(1);

        if (user?.email && project) {
          await sendJobCompletionEmail(
            user.email,
            project.name,
            job.type,
            status === 'completed',
            error ?? undefined
          ).catch((err) => console.error('Job completion email failed:', err));
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async getByProject(userId: string, projectId: string): Promise<Job[]> {
    return db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.projectId, projectId), eq(schema.jobs.userId, userId)))
      .orderBy(desc(schema.jobs.createdAt));
  }

  async updateStatus(
    jobId: string,
    status: 'queued' | 'processing' | 'completed' | 'failed',
    updates?: { progress?: number; result?: Record<string, unknown>; error?: string }
  ): Promise<void> {
    await db
      .update(schema.jobs)
      .set({
        status,
        progress: updates?.progress ?? undefined,
        result: updates?.result ?? undefined,
        error: updates?.error ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, jobId));
  }
}

export const jobService = new JobService();
