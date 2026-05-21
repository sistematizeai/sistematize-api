import { getSupabaseAdmin, getSupabaseAuth } from '../../config/supabase.js';
import { validateDocument } from '../../utils/document.js';
import { generateSlug } from '../../utils/slug.js';
import { generateTOTPSecret, verifyTOTPToken, generateQRCodeURL, encryptSecret } from '../../utils/totp.js';
import { AppError, ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors.js';
import { sendEmail } from '../../utils/email.js';
import { emailConfirmationTemplate } from '../notifications/templates.js';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../../config/env.js';
import QRCode from 'qrcode';

interface RegisterInput {
  full_name: string;
  email: string;
  password: string;
  document: string;
  business_name: string;
  segment: string;
  business_type: string;
  city: string;
  state: string;
  whatsapp: string;
  instagram?: string;
  professionals_count: string;
  monthly_appointments_range: string;
  current_scheduling_method: string;
  current_system_usage: string;
  main_difficulty: string;
  monthly_revenue_range: string;
  main_goal: string;
  whatsapp_automation_interest: string;
  public_booking_page_interest: string;
  digital_catalog_interest: string;
  best_contact_time: string;
  accepted_terms: boolean;
  accepted_marketing?: boolean;
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
  return jwt.sign(payload, env.SUPABASE_JWT_SECRET, { expiresIn: '24h', issuer: 'sistematize-api', audience: 'sistematize' });
}

export async function registerUser(input: RegisterInput) {
  const supabase = getSupabaseAdmin();
  const env = loadEnv();

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

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    full_name: input.full_name,
    document: docResult.clean,
    document_type: docResult.type,
    role: 'owner',
    business_id: null,
    onboarding_completed: false,
  });

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Erro ao criar perfil');
  }

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .insert({
      owner_id: userId,
      name: input.business_name,
      slug,
      plan_id: basicPlan?.id || null,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
      segment: input.segment,
      business_type: input.business_type,
      city: input.city,
      state: input.state,
      whatsapp: input.whatsapp,
      instagram: input.instagram || '',
    })
    .select('id')
    .single();

  if (bizError || !business) {
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Erro ao criar negocio');
  }

  const { error: linkError } = await supabase.from('profiles').update({ business_id: business.id }).eq('id', userId);

  if (linkError) {
    await supabase.from('businesses').delete().eq('id', business.id);
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError(500, 'Erro ao vincular perfil ao negocio');
  }

  await supabase.from('onboarding_answers').insert({
    user_id: userId,
    business_id: business.id,
    professionals_count: input.professionals_count,
    monthly_appointments_range: input.monthly_appointments_range,
    current_scheduling_method: input.current_scheduling_method,
    current_system_usage: input.current_system_usage,
    main_difficulty: input.main_difficulty,
    monthly_revenue_range: input.monthly_revenue_range,
    main_goal: input.main_goal,
    whatsapp_automation_interest: input.whatsapp_automation_interest,
    public_booking_page_interest: input.public_booking_page_interest,
    digital_catalog_interest: input.digital_catalog_interest,
    best_contact_time: input.best_contact_time,
    accepted_terms: input.accepted_terms,
    accepted_marketing: input.accepted_marketing || false,
  });

  const confirmToken = jwt.sign(
    { sub: userId, purpose: 'email_confirm', email: input.email },
    env.SUPABASE_JWT_SECRET,
    { expiresIn: '24h' },
  );

  const confirmUrl = `${env.FRONTEND_DASHBOARD_URL}/auth/callback?token=${confirmToken}`;

  const confirmationSent = await sendEmail({
    to: input.email,
    subject: 'Confirme seu email — Sistematize',
    html: emailConfirmationTemplate({ userName: input.full_name, confirmUrl }),
  });

  if (!confirmationSent) {
    throw new AppError(
      502,
      'Conta criada, mas nao foi possivel enviar o email de confirmacao. Sem dominio verificado no Resend, o remetente de teste so envia para o email da conta Resend.',
      'EMAIL_DELIVERY_FAILED',
    );
  }

  return { success: true, email: input.email };
}

export async function resendConfirmation(email: string) {
  const supabase = getSupabaseAdmin();
  const env = loadEnv();

  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return { success: true };

  const user = users.find(u => u.email === email);
  if (!user || user.email_confirmed_at) {
    return { success: true };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const confirmToken = jwt.sign(
    { sub: user.id, purpose: 'email_confirm', email },
    env.SUPABASE_JWT_SECRET,
    { expiresIn: '24h' },
  );

  const confirmUrl = `${env.FRONTEND_DASHBOARD_URL}/auth/callback?token=${confirmToken}`;

  const confirmationSent = await sendEmail({
    to: email,
    subject: 'Confirme seu email — Sistematize',
    html: emailConfirmationTemplate({
      userName: profile?.full_name || 'Usuario',
      confirmUrl,
    }),
  });

  if (!confirmationSent) {
    throw new AppError(
      502,
      'Nao foi possivel reenviar o email de confirmacao. Sem dominio verificado no Resend, o remetente de teste so envia para o email da conta Resend.',
      'EMAIL_DELIVERY_FAILED',
    );
  }

  return { success: true };
}

export async function confirmEmail(token: string) {
  const env = loadEnv();
  const supabase = getSupabaseAdmin();

  let decoded: { sub: string; purpose: string; email: string };
  try {
    decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as typeof decoded;
  } catch {
    throw new UnauthorizedError('Token invalido ou expirado');
  }

  if (decoded.purpose !== 'email_confirm') {
    throw new UnauthorizedError('Token invalido');
  }

  const { error } = await supabase.auth.admin.updateUserById(decoded.sub, {
    email_confirm: true,
  });

  if (error) {
    throw new AppError(500, 'Erro ao confirmar email');
  }

  return { confirmed: true, email: decoded.email };
}

export async function loginUser(email: string, password: string) {
  const supabase = getSupabaseAdmin();
  const supabaseAuth = getSupabaseAuth();

  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message === 'Email not confirmed') {
      throw new UnauthorizedError('EMAIL_NOT_CONFIRMED');
    }
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  if (!data.user) {
    throw new UnauthorizedError('Email ou senha incorretos');
  }

  if (!data.user.email_confirmed_at) {
    throw new UnauthorizedError('EMAIL_NOT_CONFIRMED');
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

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('totp_enabled')
    .eq('id', userId)
    .single();

  if (existingProfile?.totp_enabled) {
    throw new ValidationError('2FA ja esta ativo. Desative antes de reconfigurar.');
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser.user?.email || '';

  const secret = generateTOTPSecret();
  const otpauthUrl = generateQRCodeURL(secret, email, 'Sistematize');
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  const encrypted = encryptSecret(secret);
  await supabase
    .from('profiles')
    .update({ totp_secret: encrypted })
    .eq('id', userId);

  return { qr_code: qrCodeDataUrl };
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

  const { data: authUser } = await supabase.auth.admin.getUserById(input.userId);
  const fullName = input.full_name || authUser.user?.user_metadata?.full_name || 'Usuario';

  const { error: profileError } = await supabase.from('profiles').insert({
    id: input.userId,
    full_name: fullName,
    document: docResult.clean,
    document_type: docResult.type,
    role: 'owner',
    business_id: null,
  });

  if (profileError) {
    throw new AppError(500, 'Erro ao criar perfil');
  }

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
    await supabase.from('profiles').delete().eq('id', input.userId);
    throw new AppError(500, 'Erro ao criar negocio');
  }

  const { error: linkError } = await supabase.from('profiles').update({ business_id: business.id }).eq('id', input.userId);

  if (linkError) {
    await supabase.from('businesses').delete().eq('id', business.id);
    await supabase.from('profiles').delete().eq('id', input.userId);
    throw new AppError(500, 'Erro ao vincular perfil ao negocio');
  }

  const token = signJWT({
    sub: input.userId,
    role: 'owner',
    business_id: business.id,
    email: input.email,
  });

  return { token, user: { id: input.userId, role: 'owner', business_id: business.id } };
}
