import { describe, it, expect } from 'vitest';

describe('Notification Templates', () => {
  it('confirmationTemplate generates valid HTML with all fields', async () => {
    const { confirmationTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = confirmationTemplate({
      clientName: 'Maria',
      businessName: 'Salao Top',
      serviceName: 'Corte',
      collaboratorName: 'Ana',
      date: '15/06/2026',
      time: '10:00',
      duration: '30min',
    });
    expect(html).toContain('Maria');
    expect(html).toContain('Salao Top');
    expect(html).toContain('Corte');
    expect(html).toContain('Ana');
    expect(html).toContain('15/06/2026');
    expect(html).toContain('10:00');
    expect(html).toContain('Agendamento Confirmado');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('reminderTemplate generates reminder HTML', async () => {
    const { reminderTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = reminderTemplate({
      clientName: 'Joao',
      businessName: 'Barbearia',
      serviceName: 'Barba',
      collaboratorName: 'Carlos',
      date: '16/06/2026',
      time: '14:00',
      duration: '20min',
    });
    expect(html).toContain('Lembrete de Agendamento');
    expect(html).toContain('Joao');
    expect(html).toContain('Barba');
  });

  it('cancellationTemplate includes cancel reason when provided', async () => {
    const { cancellationTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = cancellationTemplate({
      clientName: 'Ana',
      businessName: 'Salao',
      serviceName: 'Manicure',
      collaboratorName: 'Paula',
      date: '17/06/2026',
      time: '16:00',
      duration: '45min',
      cancelReason: 'Profissional indisponivel',
    });
    expect(html).toContain('Agendamento Cancelado');
    expect(html).toContain('Profissional indisponivel');
    expect(html).toContain('#EF4444');
  });

  it('cancellationTemplate omits reason div when no reason', async () => {
    const { cancellationTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = cancellationTemplate({
      clientName: 'Ana',
      businessName: 'Salao',
      serviceName: 'Manicure',
      collaboratorName: 'Paula',
      date: '17/06/2026',
      time: '16:00',
      duration: '45min',
    });
    expect(html).not.toContain('Motivo:');
  });

  it('trialExpiringTemplate shows days left', async () => {
    const { trialExpiringTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = trialExpiringTemplate({
      businessName: 'Salao da Maria',
      ownerName: 'Maria',
      daysLeft: 3,
      dashboardUrl: 'https://dash.example.com',
    });
    expect(html).toContain('3 dias');
    expect(html).toContain('trial esta acabando');
    expect(html).toContain('Ver Planos');
    expect(html).toContain('https://dash.example.com/dashboard/subscription');
  });

  it('trialExpiringTemplate handles singular day', async () => {
    const { trialExpiringTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = trialExpiringTemplate({
      businessName: 'Test',
      ownerName: 'Owner',
      daysLeft: 1,
      dashboardUrl: 'https://dash.example.com',
    });
    expect(html).toContain('1 dia');
    expect(html).not.toContain('1 dias');
  });

  it('trialExpiredTemplate shows blocked message', async () => {
    const { trialExpiredTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = trialExpiredTemplate({
      businessName: 'Barbearia',
      ownerName: 'Carlos',
      dashboardUrl: 'https://dash.example.com',
    });
    expect(html).toContain('trial expirou');
    expect(html).toContain('bloqueado');
    expect(html).toContain('Assinar Agora');
  });

  it('confirmationTemplate includes custom message when provided', async () => {
    const { confirmationTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = confirmationTemplate({
      clientName: 'Ana',
      businessName: 'Salao',
      serviceName: 'Corte',
      collaboratorName: 'Paula',
      date: '15/06/2026',
      time: '10:00',
      duration: '30min',
      customMessage: 'Traga toalha propria',
    });
    expect(html).toContain('Traga toalha propria');
  });

  it('confirmationTemplate uses custom primary color', async () => {
    const { confirmationTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = confirmationTemplate({
      clientName: 'Ana',
      businessName: 'Salao',
      serviceName: 'Corte',
      collaboratorName: 'Paula',
      date: '15/06/2026',
      time: '10:00',
      duration: '30min',
      primaryColor: '#FF6600',
    });
    expect(html).toContain('#FF6600');
  });

  it('emailConfirmationTemplate explains temporary Resend sender and support email', async () => {
    const { emailConfirmationTemplate } = await import('../../src/modules/notifications/templates.js');
    const html = emailConfirmationTemplate({
      userName: 'Filipe',
      confirmUrl: 'https://sistematize-dashboard.vercel.app/auth/callback?token=abc',
    });

    expect(html).toContain('Confirmar Email');
    expect(html).toContain('onboarding@resend.dev');
    expect(html).toContain('sistematizeai@gmail.com');
    expect(html).toContain('https://sistematize-dashboard.vercel.app/auth/callback?token=abc');
  });
});

describe('Email Utility', () => {
  it('exports sendEmail and isEmailConfigured functions', async () => {
    const email = await import('../../src/utils/email.js');
    expect(typeof email.sendEmail).toBe('function');
    expect(typeof email.isEmailConfigured).toBe('function');
  });

  it('documents Gmail SMTP configuration keys for production email', async () => {
    const fs = await import('node:fs');
    const envExample = fs.readFileSync('.env.example', 'utf8');
    expect(envExample).toContain('EMAIL_PROVIDER=gmail_api');
    expect(envExample).toContain('GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com');
    expect(envExample).toContain('GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret');
    expect(envExample).toContain('GOOGLE_REFRESH_TOKEN=your-google-oauth-refresh-token');
    expect(envExample).toContain('SMTP_HOST=smtp.gmail.com');
    expect(envExample).toContain('SMTP_USER=sistematizeai@gmail.com');
    expect(envExample).toContain('FROM_EMAIL=Sistematize <sistematizeai@gmail.com>');
  });

  it('supports Gmail API OAuth configuration without app passwords', async () => {
    const previous = {
      EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
      FROM_EMAIL: process.env.FROM_EMAIL,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
    };

    process.env.EMAIL_PROVIDER = 'gmail_api';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REFRESH_TOKEN = 'test-refresh-token';
    process.env.FROM_EMAIL = 'Sistematize <sistematizeai@gmail.com>';
    delete process.env.RESEND_API_KEY;

    try {
      const email = await import('../../src/utils/email.js');
      expect(email.isEmailConfigured()).toBe(true);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});

describe('Notification Service', () => {
  it('builds public business URLs from configured public frontend URL', async () => {
    const service = await import('../../src/modules/notifications/service.js');
    expect(service.buildPublicBusinessUrl('https://public.example.com/', 'salao-top')).toBe('https://public.example.com/salao-top');
    expect(service.buildPublicBusinessUrl('https://public.example.com/base', 'salao-top')).toBe('https://public.example.com/base/salao-top');
  });

  it('builds notification delivery log payloads consistently', async () => {
    const service = await import('../../src/modules/notifications/service.js');
    expect(service.buildNotificationDeliveryLog({
      businessId: 'biz-1',
      appointmentId: 'apt-1',
      channel: 'email',
      type: 'appointment_reminder',
      recipient: 'cliente@example.com',
      status: 'sent',
      provider: 'resend',
    })).toEqual({
      business_id: 'biz-1',
      appointment_id: 'apt-1',
      channel: 'email',
      type: 'appointment_reminder',
      recipient: 'cliente@example.com',
      status: 'sent',
      provider: 'resend',
      error_message: null,
      metadata: {},
    });
  });
});
