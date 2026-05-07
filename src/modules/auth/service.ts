import { getSupabaseAdmin } from '../../config/supabase.js';
import { validateDocument } from '../../utils/document.js';
import { generateSlug } from '../../utils/slug.js';
import { generateTOTPSecret, verifyTOTPToken, generateQRCodeURL } from '../../utils/totp.js';
import { AppError, ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors.js';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../../config/env.js';
import QRCode from 'qrcode';

interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
  document: string;
  business_name: string;
}

interface CompleteRegistrationInput {
  userId: string;
  email: string;
  document: string;
  business_name: string;
  full_name?: string;
}

function signJWT(payload: { sub: string; role: string; business_id: string | null; email: string }) {
  const env = loadEnv();
  return jwt.sign(payload, env.SUPABASE_JWT_SECRET, { expiresIn: '7d' });
}

export async function registerUser(input: RegisterInput) {
  const supabase = getSupabaseAdmin();

  const docResult = validateDocument(input.document);
  if (!docResult.valid || !docResult.type) {
    throw new ValidationError('CPF/CNPJ invalido');
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('document', docResult.clean)
    .maybeSingle();

  if (existing) {
    throw new ConflictError('Ja existe uma conta com este CPF/CNPJ');
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: false,
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered')) {
      throw new ConflictError('Este email ja esta cadastrado');
    }
    throw new AppError(500, authError?.message || 'Erro ao criar usuario');
  }

  const userId = authData.user.id;

  const { data: basicPlan } = await supabase
    .from('plans')
    .select('id')
    .eq('name', 'Basico')
    .single();

  let slug = generateSlug(input.business_name);
  const { data: slugExists } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (slugExists) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({
      owner_id: userId,
      name: input.business_name,
      slug,
      plan_id: basicPlan?.id || null,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select('id')
    .single();

  if (bizError || !business) {
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Erro ao criar negocio');
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    full_name: input.full_name,
    document: docResult.clean,
    document_type: docResult.type,
    role: 'owner',
    business_id: business.id,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Erro ao criar perfil');
  }

  const token = signJWT({
    sub: userId,
    role: 'owner',
    business_id: business.id,
    email: input.email,
  });

  return { token, user: { id: userId, role: 'owner', business_id: business.id } };
}

export async function loginUser(email: string, password: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id, totp_enabled')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    throw new UnauthorizedError('Perfil nao encontrado');
  }

  if (profile.totp_enabled) {
    const env = loadEnv();
    const tempToken = jwt.sign(
      { sub: data.user.id, purpose: '2fa_verify' },
      env.SUPABASE_JWT_SECRET,
      { expiresIn: '5m' },
    );
    return { requires_2fa: true, temp_token: tempToken };
  }

  if (profile.role === 'owner' || profile.role === 'collaborator') {
    const { data: business } = await supabase
      .from('businesses')
      .select('subscription_status')
      .eq('id', profile.business_id)
      .single();

    if (business?.subscription_status === 'blocked') {
      return {
        blocked: true,
        message: 'Sua conta esta bloqueada. Realize o pagamento para continuar.',
      };
    }
  }

  const token = signJWT({
    sub: data.user.id,
    role: profile.role,
    business_id: profile.business_id,
    email,
  });

  return { token, user: { id: data.user.id, role: profile.role, business_id: profile.business_id } };
}

export async function verify2FA(tempToken: string, totpCode: string) {
  const env = loadEnv();
  const supabase = getSupabaseAdmin();

  let decoded: { sub: string; purpose: string };
  try {
    decoded = jwt.verify(tempToken, env.SUPABASE_JWT_SECRET) as typeof decoded;
  } catch {
    throw new UnauthorizedError('Token temporario invalido ou expirado');
  }

  if (decoded.purpose !== '2fa_verify') {
    throw new UnauthorizedError('Token invalido');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id, totp_secret')
    .eq('id', decoded.sub)
    .single();

  if (!profile || !profile.totp_secret) {
    throw new UnauthorizedError('2FA nao configurado');
  }

  if (!verifyTOTPToken(totpCode, profile.totp_secret)) {
    throw new UnauthorizedError('Codigo 2FA invalido');
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(decoded.sub);

  const token = signJWT({
    sub: decoded.sub,
    role: profile.role,
    business_id: profile.business_id,
    email: authUser.user?.email || '',
  });

  return { token, user: { id: decoded.sub, role: profile.role, business_id: profile.business_id } };
}

export async function setup2FA(userId: string) {
  const supabase = getSupabaseAdmin();

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser.user?.email || '';

  const secret = generateTOTPSecret();
  const otpauthUrl = generateQRCodeURL(secret, email, 'Sistematize');
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await supabase
    .from('profiles')
    .update({ totp_secret: secret })
    .eq('id', userId);

  return { qr_code: qrCodeDataUrl, secret };
}

export async function confirm2FA(userId: string, totpCode: string) {
  const supabase = getSupabaseAdmin();

  const { data: profile } = await supabase
    .from('profiles')
    .select('totp_secret')
    .eq('id', userId)
    .single();

  if (!profile?.totp_secret) {
    throw new ValidationError('Configure o 2FA primeiro (POST /api/auth/2fa/setup)');
  }

  if (!verifyTOTPToken(totpCode, profile.totp_secret)) {
    throw new ValidationError('Codigo invalido. Tente novamente.');
  }

  await supabase
    .from('profiles')
    .update({ totp_enabled: true })
    .eq('id', userId);

  return { enabled: true };
}

export async function completeGoogleRegistration(input: CompleteRegistrationInput) {
  const supabase = getSupabaseAdmin();

  const docResult = validateDocument(input.document);
  if (!docResult.valid || !docResult.type) {
    throw new ValidationError('CPF/CNPJ invalido');
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('document', docResult.clean)
    .maybeSingle();

  if (existing) {
    throw new ConflictError('Ja existe uma conta com este CPF/CNPJ');
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', input.userId)
    .maybeSingle();

  if (existingProfile) {
    throw new ConflictError('Cadastro ja foi completado');
  }

  const { data: basicPlan } = await supabase
    .from('plans')
    .select('id')
    .eq('name', 'Basico')
    .single();

  let slug = generateSlug(input.business_name);
  const { data: slugExists } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (slugExists) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({
      owner_id: input.userId,
      name: input.business_name,
      slug,
      plan_id: basicPlan?.id || null,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select('id')
    .single();

  if (bizError || !business) {
    throw new AppError(500, 'Erro ao criar negocio');
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(input.userId);
  const fullName = input.full_name || authUser.user?.user_metadata?.full_name || 'Usuario';

  const { error: profileError } = await supabase.from('profiles').insert({
    id: input.userId,
    full_name: fullName,
    document: docResult.clean,
    document_type: docResult.type,
    role: 'owner',
    business_id: business.id,
  });

  if (profileError) {
    throw new AppError(500, 'Erro ao criar perfil');
  }

  const token = signJWT({
    sub: input.userId,
    role: 'owner',
    business_id: business.id,
    email: input.email,
  });

  return { token, user: { id: input.userId, role: 'owner', business_id: business.id } };
}
