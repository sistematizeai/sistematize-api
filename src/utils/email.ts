import { Resend } from 'resend';
import { loadEnv } from '../config/env.js';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const env = loadEnv();
  if (!env.RESEND_API_KEY) return null;
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const env = loadEnv();
  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || env.REPLY_TO_EMAIL || undefined,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL] Falha ao enviar email:', err);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!loadEnv().RESEND_API_KEY;
}
