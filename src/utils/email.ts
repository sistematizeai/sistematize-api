import { Resend } from 'resend';
import nodemailer from 'nodemailer';
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
  const env = loadEnv();
  if (env.EMAIL_PROVIDER === 'gmail_api') {
    return sendWithGmailApi(options);
  }

  if (env.EMAIL_PROVIDER === 'smtp') {
    return sendWithSmtp(options);
  }

  const resend = getResend();
  if (!resend) return false;

  try {
    const result = await resend.emails.send({
      from: env.FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || env.REPLY_TO_EMAIL || undefined,
    });

    if (result.error) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'email_send_failed',
        provider: 'resend',
        to: options.to,
        subject: options.subject,
        error: result.error.message,
        code: result.error.name,
        status_code: result.error.statusCode,
      }));
      return false;
    }

    return true;
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'email_send_failed',
      provider: 'resend',
      to: options.to,
      subject: options.subject,
      error: err instanceof Error ? err.message : 'Unknown email error',
    }));
    return false;
  }
}

export function isEmailConfigured(): boolean {
  const env = loadEnv();
  if (env.EMAIL_PROVIDER === 'gmail_api') {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN && env.FROM_EMAIL);
  }

  if (env.EMAIL_PROVIDER === 'smtp') {
    return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.FROM_EMAIL);
  }

  return Boolean(env.RESEND_API_KEY && env.FROM_EMAIL);
}

async function sendWithSmtp(options: SendEmailOptions): Promise<boolean> {
  const env = loadEnv();
  if (!isEmailConfigured()) return false;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: env.FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || env.REPLY_TO_EMAIL || undefined,
    });
    return true;
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'email_send_failed',
      provider: 'smtp',
      to: options.to,
      subject: options.subject,
      error: err instanceof Error ? err.message : 'Unknown email error',
    }));
    return false;
  }
}

async function sendWithGmailApi(options: SendEmailOptions): Promise<boolean> {
  const env = loadEnv();
  if (!isEmailConfigured()) return false;

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Gmail OAuth token refresh failed: ${tokenResponse.status} ${errorText}`);
    }

    const tokenPayload = await tokenResponse.json() as { access_token?: string };
    if (!tokenPayload.access_token) {
      throw new Error('Gmail OAuth token refresh did not return access_token');
    }

    const message = buildGmailRawMessage({
      from: env.FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo || env.REPLY_TO_EMAIL || undefined,
    });

    const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${tokenPayload.access_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw: message }),
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Gmail API send failed: ${sendResponse.status} ${errorText}`);
    }

    return true;
  } catch (err) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'email_send_failed',
      provider: 'gmail_api',
      to: options.to,
      subject: options.subject,
      error: err instanceof Error ? err.message : 'Unknown email error',
    }));
    return false;
  }
}

function buildGmailRawMessage(input: {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): string {
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];
  if (input.replyTo) headers.push(`Reply-To: ${input.replyTo}`);

  const mimeMessage = `${headers.join('\r\n')}\r\n\r\n${input.html}`;
  return Buffer.from(mimeMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodeMimeHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}
