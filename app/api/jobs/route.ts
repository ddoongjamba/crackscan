import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveLimit } from '@/lib/plans'
import type { Plan } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { imageCount, locationLabel } = body as { imageCount: number; locationLabel?: string }

  if (!imageCount || imageCount < 1 || imageCount > 10) {
    return NextResponse.json({ error: 'imageCount must be 1–10' }, { status: 400 })
  }

  // ── 플랜 한도 체크 ────────────────────────────────────────
  const period = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  const [profileRes, usageRes] = await Promise.all([
    db.from('profiles').select('plan, trial_ends_at, locale').eq('id', user.id).single(),
    db.from('usage').select('job_count').eq('user_id', user.id).eq('period', period).maybeSingle(),
  ])

  const plan: Plan = profileRes.data?.plan ?? 'free'
  const trialEndsAt: string | null = profileRes.data?.trial_ends_at ?? null
  const usedCount: number = usageRes.data?.job_count ?? 0
  const limit = getEffectiveLimit(plan, trialEndsAt)

  if (usedCount >= limit) {
    return NextResponse.json(
      { error: 'monthly_limit_exceeded', limit, used: usedCount },
      { status: 403 }
    )
  }

  // ── 잡 생성 ───────────────────────────────────────────────
  const { data: job, error } = await db
    .from('analysis_jobs')
    .insert({
      user_id: user.id,
      image_count: imageCount,
      location_label: locationLabel ?? null,
      locale: profileRes.data?.locale ?? 'ko',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── usage 증가 ───────────────────────────────────────────
  await db.rpc('increment_usage', { p_user_id: user.id, p_period: period })

  return NextResponse.json({ job }, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: jobs, error } = await db
    .from('analysis_jobs')
    .select('*, reports(storage_path)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ jobs })
}
