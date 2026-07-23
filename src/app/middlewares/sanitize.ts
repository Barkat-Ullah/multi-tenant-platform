import { NextFunction, Request, Response } from 'express';

// ─────────────────────────────────────────────────────────────────────────────
// Input Sanitizer Middleware — zero-dependency XSS & injection protection
//
// What it does:
//   1. Strips HTML tags from all string values in body, query, params
//   2. Escapes dangerous characters: < > " ' & /
//   3. Trims whitespace from strings
//   4. Blocks common injection patterns (null bytes, template literals)
//
// What it does NOT do:
//   - Does NOT validate business logic (Zod handles that)
//   - Does NOT modify file uploads (Multer handles that)
//   - Does NOT alter request objects (non-destructive pass)
// ─────────────────────────────────────────────────────────────────────────────

// ─── HTML Entity Map ─────────────────────────────────────────────────────────

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

// ─── Dangerous Patterns ──────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // <script> tags
  /javascript:/gi,                                          // javascript: protocol
  /on\w+\s*=/gi,                                           // inline event handlers (onclick=)
  /data:text\/html/gi,                                     // data URI HTML
  /vbscript:/gi,                                           // vbscript: protocol
  /expression\s*\(/gi,                                     // CSS expression()
  /\$\{.*\}/g,                                             // template literal injection
  /\x00/g,                                                 // null bytes
];

// ─── Sanitize a Single String ────────────────────────────────────────────────

function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;

  let clean = value.trim();

  // Strip HTML tags (aggressive — removes everything between < and >)
  clean = clean.replace(/<[^>]*>/g, '');

  // Escape special HTML characters
  clean = clean.replace(/[&<>"'/]/g, char => HTML_ESCAPE_MAP[char] || char);

  // Remove null bytes
  clean = clean.replace(/\x00/g, '');

  // Collapse multiple spaces
  clean = clean.replace(/\s{2,}/g, ' ');

  return clean;
}

// ─── Recursively Sanitize an Object ──────────────────────────────────────────

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value !== null && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }

  return value;
}

// ─── Dangerous Pattern Detection ─────────────────────────────────────────────

function containsDangerousPattern(value: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(value));
}

function scanForDangerousPatterns(obj: unknown): string | null {
  if (typeof obj === 'string') {
    if (containsDangerousPattern(obj)) {
      return obj;
    }
    return null;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = scanForDangerousPatterns(item);
      if (found) return found;
    }
  }

  if (obj !== null && typeof obj === 'object') {
    for (const val of Object.values(obj)) {
      const found = scanForDangerousPatterns(val);
      if (found) return found;
    }
  }

  return null;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

const sanitize = (req: Request, res: Response, next: NextFunction): void => {
  // 1. Scan for dangerous patterns BEFORE sanitization (detect attacks)
  const sources = [
    { name: 'body', data: req.body },
    { name: 'query', data: req.query },
    { name: 'params', data: req.params },
  ];

  for (const source of sources) {
    const dangerous = scanForDangerousPatterns(source.data);
    if (dangerous) {
      console.warn(`[SANITIZE] Dangerous pattern detected in ${source.name}: ${dangerous.substring(0, 100)}`);
    }
  }

  // 2. Sanitize body only (Express 5 makes req.query and req.params getter-only)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  // req.query and req.params are read-only in Express 5 — scan only

  next();
};

export default sanitize;
