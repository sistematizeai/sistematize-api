import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { getSupabaseAdmin } from '../config/supabase.js';

interface AuditEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
}

declare module 'fastify' {
  interface FastifyInstance {
    audit: (request: FastifyRequest, entry: AuditEntry) => Promise<void>;
  }
}

async function auditPluginFn(app: FastifyInstance) {
  app.decorate('audit', async function (request: FastifyRequest, entry: AuditEntry) {
    const supabase = getSupabaseAdmin();
    const ip = request.headers['x-forwarded-for'] as string || request.ip;

    const { error } = await supabase.from('audit_logs').insert({
      profile_id: request.user?.sub || null,
      business_id: request.user?.business_id || null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      old_data: entry.old_data || null,
      new_data: entry.new_data || null,
      ip_address: ip,
    });
    if (error) {
      request.log.error({ err: error }, 'Failed to write audit log');
    }
  });
}

export const auditPlugin = fp(auditPluginFn, { name: 'audit' });
