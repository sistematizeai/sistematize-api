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
  };
}
