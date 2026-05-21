import { getSupabaseAdmin } from '../../config/supabase.js';
import { ForbiddenError, NotFoundError } from '../../utils/errors.js';

type BusinessAccessContext = {
  business: {
    id: string;
    is_active: boolean;
    subscription_status: string;
    plan_id: string | null;
  };
  moduleSlug: string;
  planModuleActive: boolean;
  userOverrideActive?: boolean;
};

type PlanLimitContext = {
  limitName: string;
  currentUsage: number;
  maxAllowed: number | null | undefined;
};

type BusinessPlan = {
  id: string;
  is_active: boolean;
  subscription_status: string;
  plan_id: string | null;
  plan?: {
    max_collaborators?: number;
    max_services?: number;
    max_appointments_month?: number;
  } | null;
};

export function evaluateBusinessAccess(context: BusinessAccessContext) {
  if (!context.business.is_active) {
    throw new ForbiddenError('Conta inativa. Acesso bloqueado.');
  }

  if (['blocked', 'cancelled', 'overdue'].includes(context.business.subscription_status)) {
    throw new ForbiddenError('Conta bloqueada. Regularize a assinatura para continuar.');
  }

  if (context.userOverrideActive === false) {
    throw new ForbiddenError(`Modulo ${context.moduleSlug} bloqueado para este usuario.`);
  }

  if (context.userOverrideActive === true) {
    return { allowed: true };
  }

  if (!context.business.plan_id || !context.planModuleActive) {
    throw new ForbiddenError(`Modulo ${context.moduleSlug} nao liberado para este plano.`);
  }

  return { allowed: true };
}

export function evaluatePlanLimit(context: PlanLimitContext) {
  if (context.maxAllowed == null) {
    return { allowed: true };
  }

  if (context.currentUsage >= context.maxAllowed) {
    throw new ForbiddenError(`Limite ${context.limitName} atingido para o plano atual.`);
  }

  return { allowed: true };
}

export async function assertBusinessCanUseModule(
  businessId: string,
  moduleSlug: string,
  profileId?: string,
) {
  const business = await getBusinessPlan(businessId);

  let userOverrideActive: boolean | undefined;
  if (profileId) {
    userOverrideActive = await getUserModuleOverride(businessId, profileId, moduleSlug);
  }

  const planModuleActive = business.plan_id
    ? await isPlanModuleActive(business.plan_id, moduleSlug)
    : false;

  evaluateBusinessAccess({
    business,
    moduleSlug,
    planModuleActive,
    userOverrideActive,
  });

  return business;
}

export async function assertPlanLimitAvailable(
  businessId: string,
  limitName: 'max_services' | 'max_collaborators' | 'max_appointments_month',
  currentUsage: number,
) {
  const business = await getBusinessPlan(businessId);
  const maxAllowed = business.plan?.[limitName];
  return evaluatePlanLimit({ limitName, currentUsage, maxAllowed });
}

export async function assertCanCreateService(businessId: string, profileId?: string) {
  const supabase = getSupabaseAdmin();
  await assertBusinessCanUseModule(businessId, 'services', profileId);

  const { count, error } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (error) throw error;
  return assertPlanLimitAvailable(businessId, 'max_services', count || 0);
}

export async function assertCanCreateCollaborator(businessId: string, profileId?: string) {
  const supabase = getSupabaseAdmin();
  await assertBusinessCanUseModule(businessId, 'collaborators', profileId);

  const { count, error } = await supabase
    .from('collaborators')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true);

  if (error) throw error;
  return assertPlanLimitAvailable(businessId, 'max_collaborators', count || 0);
}

export async function assertCanCreateAppointment(businessId: string, profileId?: string) {
  const supabase = getSupabaseAdmin();
  await assertBusinessCanUseModule(businessId, 'appointments', profileId);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  const { count, error } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', monthStart)
    .lt('created_at', nextMonthStart);

  if (error) throw error;
  return assertPlanLimitAvailable(businessId, 'max_appointments_month', count || 0);
}

async function getBusinessPlan(businessId: string): Promise<BusinessPlan> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('businesses')
    .select('id, is_active, subscription_status, plan_id, plan:plans(max_collaborators, max_services, max_appointments_month)')
    .eq('id', businessId)
    .single();

  if (error || !data) {
    throw new NotFoundError('Empresa nao encontrada.');
  }

  return data as BusinessPlan;
}

async function isPlanModuleActive(planId: string, moduleSlug: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('plan_modules')
    .select('is_active, module:modules!inner(slug, is_active)')
    .eq('plan_id', planId)
    .eq('is_active', true)
    .eq('module.slug', moduleSlug)
    .eq('module.is_active', true)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function getUserModuleOverride(
  businessId: string,
  profileId: string,
  moduleSlug: string,
) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_modules')
    .select('is_active, module:modules!inner(slug)')
    .eq('business_id', businessId)
    .eq('profile_id', profileId)
    .eq('module.slug', moduleSlug)
    .maybeSingle();

  if (error) throw error;
  return data ? Boolean(data.is_active) : undefined;
}
