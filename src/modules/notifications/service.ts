import { getSupabaseAdmin } from '../../config/supabase.js';
import { sendEmail, isEmailConfigured } from '../../utils/email.js';
import { confirmationTemplate, reminderTemplate, cancellationTemplate, trialExpiringTemplate, trialExpiredTemplate } from './templates.js';
import { loadEnv } from '../../config/env.js';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(time: string): string {
  return time.slice(0, 5);
}

interface AppointmentNotificationData {
  appointmentId: string;
  businessId: string;
}

type NotificationDeliveryLogInput = {
  businessId?: string | null;
  appointmentId?: string | null;
  channel: 'email' | 'whatsapp';
  type: string;
  recipient?: string | null;
  status: 'sent' | 'failed' | 'skipped';
  provider?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildPublicBusinessUrl(frontendPublicUrl: string, businessSlug: string): string {
  const baseUrl = frontendPublicUrl.replace(/\/+$/, '');
  const slug = businessSlug.replace(/^\/+/, '');
  return `${baseUrl}/${slug}`;
}

export function buildNotificationDeliveryLog(input: NotificationDeliveryLogInput) {
  return {
    business_id: input.businessId || null,
    appointment_id: input.appointmentId || null,
    channel: input.channel,
    type: input.type,
    recipient: input.recipient || null,
    status: input.status,
    provider: input.provider || null,
    error_message: input.errorMessage || null,
    metadata: input.metadata || {},
  };
}

async function recordNotificationDelivery(input: NotificationDeliveryLogInput) {
  try {
    await getSupabaseAdmin()
      .from('notification_delivery_logs')
      .insert(buildNotificationDeliveryLog(input));
  } catch {
    // Delivery logging must not break the user-facing notification flow.
  }
}

async function getAppointmentEmailData(data: AppointmentNotificationData) {
  const supabase = getSupabaseAdmin();

  const { data: apt } = await supabase
    .from('appointments')
    .select(`
      id, date, start_time, status, cancel_reason,
      client:clients(id, name, email, phone),
      collaborator:collaborators(id, name),
      appointment_services(service:services(id, name, duration_minutes, price))
    `)
    .eq('id', data.appointmentId)
    .eq('business_id', data.businessId)
    .single();

  if (!apt) return null;

  const client = apt.client as any;
  if (!client?.email) return null;

  const { data: biz } = await supabase
    .from('businesses')
    .select('name, slug, primary_color, notification_settings, logo_url')
    .eq('id', data.businessId)
    .single();

  if (!biz) return null;

  const services = (apt.appointment_services as any[]) || [];
  const serviceName = services.map((s: any) => s.service?.name).filter(Boolean).join(', ') || 'Servico';
  const totalDuration = services.reduce((acc: number, s: any) => acc + (s.service?.duration_minutes || 0), 0);
  const collaborator = apt.collaborator as any;

  return {
    clientEmail: client.email,
    clientName: client.name,
    businessName: biz.name,
    businessSlug: biz.slug,
    primaryColor: biz.primary_color || '#4F5AE5',
    notificationSettings: biz.notification_settings as any,
    serviceName,
    collaboratorName: collaborator?.name || 'Profissional',
    date: formatDate(apt.date),
    time: formatTime(apt.start_time),
    duration: `${totalDuration}min`,
    cancelReason: apt.cancel_reason,
  };
}

export async function sendAppointmentConfirmation(data: AppointmentNotificationData) {
  if (!isEmailConfigured()) {
    await recordNotificationDelivery({
      businessId: data.businessId,
      appointmentId: data.appointmentId,
      channel: 'email',
      type: 'appointment_confirmation',
      status: 'skipped',
      provider: 'resend',
      errorMessage: 'Email nao configurado',
    });
    return;
  }

  const emailData = await getAppointmentEmailData(data);
  if (!emailData) return;
  const env = loadEnv();

  const settings = emailData.notificationSettings;
  const customMessage = settings?.confirmation_template || null;

  const html = confirmationTemplate({
    clientName: emailData.clientName,
    businessName: emailData.businessName,
    serviceName: emailData.serviceName,
    collaboratorName: emailData.collaboratorName,
    date: emailData.date,
    time: emailData.time,
    duration: emailData.duration,
    primaryColor: emailData.primaryColor,
    customMessage,
    publicUrl: buildPublicBusinessUrl(env.FRONTEND_PUBLIC_URL, emailData.businessSlug),
  });

  const sent = await sendEmail({
    to: emailData.clientEmail,
    subject: `Agendamento confirmado - ${emailData.businessName}`,
    html,
  });
  await recordNotificationDelivery({
    businessId: data.businessId,
    appointmentId: data.appointmentId,
    channel: 'email',
    type: 'appointment_confirmation',
    recipient: emailData.clientEmail,
    status: sent ? 'sent' : 'failed',
    provider: 'resend',
  });
}

export async function sendAppointmentCancellation(data: AppointmentNotificationData) {
  if (!isEmailConfigured()) {
    await recordNotificationDelivery({
      businessId: data.businessId,
      appointmentId: data.appointmentId,
      channel: 'email',
      type: 'appointment_cancellation',
      status: 'skipped',
      provider: 'resend',
      errorMessage: 'Email nao configurado',
    });
    return;
  }

  const emailData = await getAppointmentEmailData(data);
  if (!emailData) return;
  const env = loadEnv();

  const html = cancellationTemplate({
    clientName: emailData.clientName,
    businessName: emailData.businessName,
    serviceName: emailData.serviceName,
    collaboratorName: emailData.collaboratorName,
    date: emailData.date,
    time: emailData.time,
    duration: emailData.duration,
    primaryColor: emailData.primaryColor,
    cancelReason: emailData.cancelReason || undefined,
    publicUrl: buildPublicBusinessUrl(env.FRONTEND_PUBLIC_URL, emailData.businessSlug),
  });

  const sent = await sendEmail({
    to: emailData.clientEmail,
    subject: `Agendamento cancelado - ${emailData.businessName}`,
    html,
  });
  await recordNotificationDelivery({
    businessId: data.businessId,
    appointmentId: data.appointmentId,
    channel: 'email',
    type: 'appointment_cancellation',
    recipient: emailData.clientEmail,
    status: sent ? 'sent' : 'failed',
    provider: 'resend',
  });
}

export async function sendAppointmentReminder(appointmentId: string, businessId: string) {
  if (!isEmailConfigured()) {
    await recordNotificationDelivery({
      businessId,
      appointmentId,
      channel: 'email',
      type: 'appointment_reminder',
      status: 'skipped',
      provider: 'resend',
      errorMessage: 'Email nao configurado',
    });
    return;
  }

  const emailData = await getAppointmentEmailData({ appointmentId, businessId });
  if (!emailData) return;

  const settings = emailData.notificationSettings;
  if (!settings?.email_reminder_enabled) return;

  const customMessage = settings?.reminder_template || null;

  const html = reminderTemplate({
    clientName: emailData.clientName,
    businessName: emailData.businessName,
    serviceName: emailData.serviceName,
    collaboratorName: emailData.collaboratorName,
    date: emailData.date,
    time: emailData.time,
    duration: emailData.duration,
    primaryColor: emailData.primaryColor,
    customMessage,
  });

  const sent = await sendEmail({
    to: emailData.clientEmail,
    subject: `Lembrete: agendamento amanha - ${emailData.businessName}`,
    html,
  });
  await recordNotificationDelivery({
    businessId,
    appointmentId,
    channel: 'email',
    type: 'appointment_reminder',
    recipient: emailData.clientEmail,
    status: sent ? 'sent' : 'failed',
    provider: 'resend',
  });
}

export async function sendPendingReminders() {
  if (!isEmailConfigured()) return { sent: 0 };

  const supabase = getSupabaseAdmin();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, business_id')
    .eq('date', tomorrowStr)
    .in('status', ['scheduled', 'confirmed']);

  if (!appointments || appointments.length === 0) return { sent: 0 };

  let sent = 0;
  for (const apt of appointments) {
    try {
      await sendAppointmentReminder(apt.id, apt.business_id);
      sent++;
    } catch {
      // skip failed reminders
    }
  }

  return { sent, total: appointments.length };
}

export async function sendTrialNotifications() {
  if (!isEmailConfigured()) return { expiring: 0, expired: 0 };

  const supabase = getSupabaseAdmin();
  const env = loadEnv();
  const now = new Date();

  const in3days = new Date(now);
  in3days.setDate(in3days.getDate() + 3);
  const in3daysStr = in3days.toISOString().split('T')[0];

  const in1day = new Date(now);
  in1day.setDate(in1day.getDate() + 1);
  const in1dayStr = in1day.toISOString().split('T')[0];

  const { data: expiringBizs } = await supabase
    .from('businesses')
    .select('id, name, owner_id, trial_ends_at')
    .eq('subscription_status', 'trial')
    .or(`trial_ends_at.gte.${in1dayStr},trial_ends_at.lte.${in3daysStr}T23:59:59`);

  let expiringSent = 0;
  for (const biz of expiringBizs || []) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(biz.owner_id);
      if (!user?.email) continue;

      const trialEnd = new Date(biz.trial_ends_at);
      const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      const html = trialExpiringTemplate({
        businessName: biz.name,
        ownerName: user.user_metadata?.full_name || user.email.split('@')[0],
        daysLeft,
        dashboardUrl: env.FRONTEND_DASHBOARD_URL,
      });

      await sendEmail({
        to: user.email,
        subject: `Seu trial expira em ${daysLeft} dia${daysLeft > 1 ? 's' : ''} - Sistematize`,
        html,
      });
      expiringSent++;
    } catch {
      // skip
    }
  }

  const { data: expiredBizs } = await supabase
    .from('businesses')
    .select('id, name, owner_id')
    .eq('subscription_status', 'blocked');

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  let expiredSent = 0;
  for (const biz of expiredBizs || []) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(biz.owner_id);
      if (!user?.email) continue;

      const html = trialExpiredTemplate({
        businessName: biz.name,
        ownerName: user.user_metadata?.full_name || user.email.split('@')[0],
        dashboardUrl: env.FRONTEND_DASHBOARD_URL,
      });

      await sendEmail({
        to: user.email,
        subject: `Seu trial expirou - ${biz.name}`,
        html,
      });
      expiredSent++;
    } catch {
      // skip
    }
  }

  return { expiring: expiringSent, expired: expiredSent };
}
