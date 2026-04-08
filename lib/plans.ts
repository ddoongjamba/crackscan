import type { Plan } from './supabase/types'

export const PLAN_LIMITS: Record<Plan, number> = {
  free: 3,
  starter: 20,
  professional: 100,
  business: 500,
}

/** trial 중이면 프로 한도(100), 아니면 실제 plan 한도 */
export function getEffectiveLimit(plan: Plan, trialEndsAt: string | null): number {
  if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
    return PLAN_LIMITS['professional']
  }
  return PLAN_LIMITS[plan]
}
