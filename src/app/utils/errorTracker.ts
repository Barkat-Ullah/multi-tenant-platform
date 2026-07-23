import { Request } from 'express';
import { redis } from '../../lib/redis';

// ─────────────────────────────────────────────────────────────────────────────
// Error Tracker — captures, stores, and optionally exports errors
//
// Storage: In-memory ring buffer (last 500 errors) + optional Redis list
// Export:  Hook function for external services (Sentry, Datadog, etc.)
// ─────────────────────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface ErrorReport {
  id: string;
  timestamp: string;
  severity: Severity;
  message: string;
  name: string;
  stack?: string;
  statusCode: number;
  request: {
    method: string;
    url: string;
    ip: string;
    userId?: string;
    userAgent?: string;
    correlationId?: string;
  };
  context?: Record<string, unknown>;
}

// ─── In-Memory Ring Buffer ───────────────────────────────────────────────────

const MAX_ERRORS = 500;
const errorBuffer: ErrorReport[] = [];
let errorCounter = 0;

// ─── Severity Classification ─────────────────────────────────────────────────

function classifySeverity(statusCode: number, errName: string): Severity {
  if (statusCode >= 500) return 'critical';
  if (statusCode >= 400 && statusCode < 500) {
    if (statusCode === 401 || statusCode === 403) return 'high';
    if (statusCode === 429) return 'medium';
    return 'low';
  }
  if (errName === 'TypeError' || errName === 'ReferenceError') return 'critical';
  return 'medium';
}

// ─── Request Context Extraction ──────────────────────────────────────────────

function extractRequestContext(req: Request): ErrorReport['request'] {
  const user = (req as any).user;
  return {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown',
    userId: user?.id,
    userAgent: req.headers['user-agent'],
    correlationId: (req as any).correlationId,
  };
}

// ─── Core: Track an Error ────────────────────────────────────────────────────

export function trackError(
  err: any,
  req: Request,
  statusCode: number,
  context?: Record<string, unknown>,
): ErrorReport {
  const id = `err_${Date.now()}_${++errorCounter}`;
  const severity = classifySeverity(statusCode, err?.name || 'Error');

  const report: ErrorReport = {
    id,
    timestamp: new Date().toISOString(),
    severity,
    message: err?.message || 'Unknown error',
    name: err?.name || 'Error',
    stack: err?.stack,
    statusCode,
    request: extractRequestContext(req),
    context,
  };

  // Ring buffer (never grows past MAX_ERRORS)
  if (errorBuffer.length >= MAX_ERRORS) {
    errorBuffer.shift();
  }
  errorBuffer.push(report);

  // Fire-and-forget: persist critical errors to Redis (survives restarts)
  if (severity === 'critical') {
    persistToRedis(report).catch(() => {});
  }

  return report;
}

// ─── Redis Persistence (critical errors only) ────────────────────────────────

async function persistToRedis(report: ErrorReport): Promise<void> {
  try {
    const key = `errors:${report.severity}:${new Date().toISOString().split('T')[0]}`;
    await redis.lpush(key, JSON.stringify(report));
    await redis.expire(key, 60 * 60 * 24 * 7); // 7 days
    await redis.ltrim(key, 0, 99); // keep last 100 per severity per day
  } catch {
    // Redis unavailable — errors are still in memory buffer
  }
}

// ─── Query: Get Recent Errors ────────────────────────────────────────────────

export function getRecentErrors(limit = 50): ErrorReport[] {
  return errorBuffer.slice(-limit).reverse();
}

export function getErrorsBySeverity(severity: Severity, limit = 50): ErrorReport[] {
  return errorBuffer.filter(e => e.severity === severity).slice(-limit).reverse();
}

export function getErrorStats(): Record<Severity, number> {
  const stats: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const err of errorBuffer) {
    stats[err.severity]++;
  }
  return stats;
}

// ─── Export Hook (for external services) ─────────────────────────────────────

type ErrorExporter = (report: ErrorReport) => void | Promise<void>;
const exporters: ErrorExporter[] = [];

export function registerErrorExporter(exporter: ErrorExporter): void {
  exporters.push(exporter);
}

export async function exportError(report: ErrorReport): Promise<void> {
  for (const exporter of exporters) {
    try {
      await exporter(report);
    } catch {
      // Never let an exporter crash the app
    }
  }
}
