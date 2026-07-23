type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  requestId?: string;
  userId?: string;
  module?: string;
  action?: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== 'production';

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(formatLog('info', message, context));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatLog('warn', message, context));
  },

  error: (message: string, context?: LogContext) => {
    console.error(formatLog('error', message, context));
  },

  debug: (message: string, context?: LogContext) => {
    if (isDev) {
      console.log(formatLog('debug', message, context));
    }
  },

  cache: {
    hit: (key: string, module?: string) => {
      logger.debug('Cache HIT', { module: module ?? 'cache', cacheKey: key });
    },
    miss: (key: string, module?: string) => {
      logger.debug('Cache MISS', { module: module ?? 'cache', cacheKey: key });
    },
    invalidate: (model: string, id?: string, module?: string) => {
      logger.debug('Cache INVALIDATE', { module: module ?? 'cache', model, id });
    },
  },
};
