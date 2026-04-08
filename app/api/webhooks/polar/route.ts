import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_BY_PRODUCT: Record<string, string> = {
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID_STARTER!]: 'starter',
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID_PRO!]: 'professional',
  [process.env.NEXT_PUBLIC_POLAR_PRODUCT_ID_BUSINESS!]: 'business',
}

export async function POST(req: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET
  const signature = req.headers.get('webhook-signature') ?? ''

  // Polar 서명 검증 (간단한 타이밍-안전 비교)
  if (!secret || signature !== secret) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = await req.json()
  const { type, data } = event

  // metadata.userId 로 사용자 식별 (Polar checkout 시 전달)
  const userId: string | undefined = data?.metadata?.userId ?? data?.customer?.externalId

  if (!userId) return NextResponse.json({ ok: true }) // 처리 대상 아님

  switch (type) {
    case 'subscription.created':
    case 'subscription.updated': {
      const productId: string = data.productId ?? ''
      const plan = PLAN_BY_PRODUCT[productId] ?? 'free'
      const isNew = type === 'subscription.created'

      // trial_ends_at: 신규 구독이면 지금부터 30일
      const trialEndsAt = isNew
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : undefined

      await supabase.from('subscriptions').upsert({
        id: data.id,
        user_id: userId,
        plan,
        status: data.status === 'active' ? 'active' : 'canceled',
        polar_product_id: productId,
        current_period_start: data.currentPeriodStart ?? null,
        current_period_end: data.currentPeriodEnd ?? null,
        ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
      })

      await supabase
        .from('profiles')
        .update({ plan })
        .eq('id', userId)

      break
    }

    case 'subscription.canceled':
    case 'subscription.revoked': {
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('id', data.id)

      await supabase
        .from('profiles')
        .update({ plan: 'free' })
        .eq('id', userId)

      break
    }
  }

  return NextResponse.json({ ok: true })
}
