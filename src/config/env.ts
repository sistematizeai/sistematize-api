export interface Env {
  PORT: number;
  HOST: string;
  NODE_ENV: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  FRONTEND_ADMIN_URL: string;
  FRONTEND_DASHBOARD_URL: string;
  FRONTEND_PUBLIC_URL: string;
  TOTP_ENCRYPTION_KEY: string;
  ASAAS_ENCRYPTION_KEY: string;
  ASAAS_PLATFORM_API_KEY: string;
  ASAAS_PLATFORM_ENV: 'sandbox' | 'production';
  ASAAS_PLATFORM_WALLET_ID: string;
  CRON_SECRET: string;
  EMAIL_PROVIDER: 'resend' | 'smtp' | 'gmail_api';
  RESEND_API_KEY: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  FROM_EMAIL: string;
  REPLY_TO_EMAIL: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadEnv(): Env {
  return {
    PORT: parseInt(process.env.PORT || '3001', 10),
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'development',
    SUPABASE_URL: requireEnv('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_JWT_SECRET: requireEnv('SUPABASE_JWT_SECRET'),
    FRONTEND_ADMIN_URL: requireEnv('FRONTEND_ADMIN_URL'),
    FRONTEND_DASHBOARD_URL: requireEnv('FRONTEND_DASHBOARD_URL'),
    FRONTEND_PUBLIC_URL: requireEnv('FRONTEND_PUBLIC_URL'),
    TOTP_ENCRYPTION_KEY: requireEnv('TOTP_ENCRYPTION_KEY'),
    ASAAS_ENCRYPTION_KEY: requireEnv('ASAAS_ENCRYPTION_KEY'),
    ASAAS_PLATFORM_API_KEY: process.env.ASAAS_PLATFORM_API_KEY || '',
    ASAAS_PLATFORM_ENV: (process.env.ASAAS_PLATFORM_ENV || 'sandbox') as 'sandbox' | 'production',
    ASAAS_PLATFORM_WALLET_ID: process.env.ASAAS_PLATFORM_WALLET_ID || '',
    CRON_SECRET: process.env.CRON_SECRET || '',
    EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || 'resend') as 'resend' | 'smtp' | 'gmail_api',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
    FROM_EMAIL: process.env.FROM_EMAIL || 'Sistematize <noreply@sistematize.com>',
    REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL || '',
  };
}
