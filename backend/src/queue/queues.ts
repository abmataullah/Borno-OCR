import { Queue, QueueEvents } from 'bullmq';
import { redisConfig, QUEUE_NAMES } from './connection';

export interface PdfProcessingJobData {
  projectId: string;
  pdfKey: string;
  userId: string;
  options?: {
    runOcr?: boolean;
    runTableDetection?: boolean;
    ocrLang?: string;
    useHybridOcr?: boolean;
  };
}

export interface ConversionJobData {
  projectId: string;
  userId: string;
  pdfKey: string;
  targetFormat: 'docx' | 'odt' | 'html';
}

export const pdfProcessingQueue = new Queue(QUEUE_NAMES.PDF_PROCESSING, {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const conversionQueue = new Queue(QUEUE_NAMES.CONVERSION, {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 20 },
  },
});

export const pdfProcessingEvents = new QueueEvents(QUEUE_NAMES.PDF_PROCESSING, {
  connection: redisConfig as any,
});

export const conversionEvents = new QueueEvents(QUEUE_NAMES.CONVERSION, {
  connection: redisConfig as any,
});
