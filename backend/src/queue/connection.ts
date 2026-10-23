import { config } from '../config/env';

export const redisConfig = {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const QUEUE_NAMES = {
  PDF_PROCESSING: 'pdf-processing',
  CONVERSION: 'conversion',
} as const;
