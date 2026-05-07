import { FastifyInstance } from 'fastify';
import xss from 'xss';

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return xss(value.trim());
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val);
    }
    return sanitized;
  }
  return value;
}

export async function registerSanitizer(app: FastifyInstance) {
  app.addHook('preHandler', async (request) => {
    if (request.body && typeof request.body === 'object') {
      request.body = sanitizeValue(request.body) as typeof request.body;
    }
  });
}
