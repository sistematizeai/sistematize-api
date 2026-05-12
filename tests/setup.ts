import { randomBytes } from 'crypto';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'test-jwt-secret-for-testing-only';
process.env.FRONTEND_ADMIN_URL = process.env.FRONTEND_ADMIN_URL || 'http://localhost:3000';
process.env.FRONTEND_DASHBOARD_URL = process.env.FRONTEND_DASHBOARD_URL || 'http://localhost:3001';
process.env.FRONTEND_PUBLIC_URL = process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3002';
process.env.TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || randomBytes(32).toString('hex');
process.env.ASAAS_ENCRYPTION_KEY = process.env.ASAAS_ENCRYPTION_KEY || randomBytes(32).toString('hex');
