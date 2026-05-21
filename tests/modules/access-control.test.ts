import { describe, expect, it } from 'vitest';
import { evaluateBusinessAccess, evaluatePlanLimit } from '../../src/modules/modules/access-control.js';

const activeBusiness = {
  id: 'biz-1',
  is_active: true,
  subscription_status: 'active',
  plan_id: 'plan-1',
};

describe('plan and module access control', () => {
  it('blocks inactive or financially blocked businesses', () => {
    expect(() => evaluateBusinessAccess({
      business: { ...activeBusiness, subscription_status: 'blocked' },
      moduleSlug: 'services',
      planModuleActive: true,
    })).toThrow('Conta bloqueada');

    expect(() => evaluateBusinessAccess({
      business: { ...activeBusiness, is_active: false },
      moduleSlug: 'services',
      planModuleActive: true,
    })).toThrow('Conta inativa');
  });

  it('blocks overdue businesses until the subscription is regularized', () => {
    expect(() => evaluateBusinessAccess({
      business: { ...activeBusiness, subscription_status: 'overdue' },
      moduleSlug: 'services',
      planModuleActive: true,
    })).toThrow('Conta bloqueada');
  });

  it('allows module access from an active plan module', () => {
    expect(evaluateBusinessAccess({
      business: activeBusiness,
      moduleSlug: 'services',
      planModuleActive: true,
    })).toEqual({ allowed: true });
  });

  it('denies module access when the plan does not include the module', () => {
    expect(() => evaluateBusinessAccess({
      business: activeBusiness,
      moduleSlug: 'financial',
      planModuleActive: false,
    })).toThrow('Modulo financial nao liberado para este plano');
  });

  it('lets an individual active override grant a module outside the plan', () => {
    expect(evaluateBusinessAccess({
      business: activeBusiness,
      moduleSlug: 'financial',
      planModuleActive: false,
      userOverrideActive: true,
    })).toEqual({ allowed: true });
  });

  it('lets an individual inactive override deny a module included in the plan', () => {
    expect(() => evaluateBusinessAccess({
      business: activeBusiness,
      moduleSlug: 'services',
      planModuleActive: true,
      userOverrideActive: false,
    })).toThrow('Modulo services bloqueado para este usuario');
  });

  it('blocks creation when a plan usage limit is reached', () => {
    expect(() => evaluatePlanLimit({
      limitName: 'max_services',
      currentUsage: 10,
      maxAllowed: 10,
    })).toThrow('Limite max_services atingido');
  });

  it('allows creation while usage is below the plan limit', () => {
    expect(evaluatePlanLimit({
      limitName: 'max_collaborators',
      currentUsage: 4,
      maxAllowed: 5,
    })).toEqual({ allowed: true });
  });
});
