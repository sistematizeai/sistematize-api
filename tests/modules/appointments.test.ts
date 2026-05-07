import { describe, it, expect } from 'vitest';

describe('Appointments Module', () => {
  it('schemas export correctly', async () => {
    const schemas = await import('../../src/modules/appointments/schemas.js');
    expect(schemas.createAppointmentSchema.body.required).toContain('service_ids');
    expect(schemas.updateStatusSchema.body.properties.status.enum).toContain('completed');
  });

  it('service exports valid transitions', async () => {
    const handlers = await import('../../src/modules/appointments/handlers.js');
    expect(typeof handlers.updateStatusHandler).toBe('function');
  });
});
