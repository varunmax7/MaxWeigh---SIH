import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

/** Structured logger for the worker process (implementation.md §2). */
export const logger = pino({
  name: 'tula-worker',
  level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
});
