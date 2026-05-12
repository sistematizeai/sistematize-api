import { describe, it, expect } from 'vitest';

describe('Appointments Module', () => {
  it('createAppointmentSchema requires all booking fields', async () => {
    const schemas = await import('../../src/modules/appointments/schemas.js');
    const required = schemas.createAppointmentSchema.body.required;
    expect(required).toContain('client_id');
    expect(required).toContain('collaborator_id');
    expect(required).toContain('date');
    expect(required).toContain('start_time');
    expect(required).toContain('service_ids');
  });

  it('service_ids must be non-empty array', async () => {
    const schemas = await import('../../src/modules/appointments/schemas.js');
    const serviceIds = schemas.createAppointmentSchema.body.properties.service_ids;
    expect(serviceIds.type).toBe('array');
    expect(serviceIds.minItems).toBe(1);
  });

  it('updateStatusSchema has all valid status transitions', async () => {
    const schemas = await import('../../src/modules/appointments/schemas.js');
    const statuses = schemas.updateStatusSchema.body.properties.status.enum;
    expect(statuses).toContain('scheduled');
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('cancelled');
    expect(statuses).toContain('no_show');
    expect(statuses).toHaveLength(6);
  });

  it('source field only accepts valid origins', async () => {
    const schemas = await import('../../src/modules/appointments/schemas.js');
    const sources = schemas.createAppointmentSchema.body.properties.source.enum;
    expect(sources).toContain('dashboard');
    expect(sources).toContain('public_page');
    expect(sources).toContain('whatsapp');
  });

  it('payment_method only accepts valid methods', async () => {
    const schemas = await import('../../src/modules/appointments/schemas.js');
    const methods = schemas.updateAppointmentSchema.body.properties.payment_method.enum;
    expect(methods).toContain('pix');
    expect(methods).toContain('credit');
    expect(methods).toContain('debit');
    expect(methods).toContain('cash');
  });

  it('handlers export all required functions', async () => {
    const handlers = await import('../../src/modules/appointments/handlers.js');
    expect(typeof handlers.listHandler).toBe('function');
    expect(typeof handlers.getHandler).toBe('function');
    expect(typeof handlers.createHandler).toBe('function');
    expect(typeof handlers.updateHandler).toBe('function');
    expect(typeof handlers.updateStatusHandler).toBe('function');
  });
});
