'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAN_LIMITS } from '@/lib/plans'

type Plan = 'free' | 'starter' | 'professional' | 'business'

interface Profile {
  plan: Plan
  trial_ends_at: string | null
}

const PLANS: Array<{
  key: Plan
  name: string
  priceKRW: string
  priceJPY: string
  envKey: string
}> = [
  { key: 'starter', name: '스타터', priceKRW: '₩29,000/월', priceJPY: '¥3,200/월', envKey: 'NEXT_PUBLIC_POLAR_PRODUCT_ID_STARTER' },
  { key: 'professional', name: '프로', priceKRW: '₩89,000/월', priceJPY: '¥9,800/월', envKey: 'NEXT_PUBLIC_POLAR_PRODUCT_ID_PRO' },
  { key: 'business', name: '비즈니스', priceKRW: '₩249,000/월', priceJPY: '¥27,000/월', envKey: 'NEXT_PUBLIC_POLAR_PRODUCT_ID_BUSINESS' },
]

export default function BillingPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState('')
  const [period, setPeriod] = useState('')
  const [usedCount, setUsedCount] = useState(0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const [profileRes, usageRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('plan, trial_ends_at')
          .eq('id', user.id)
          .single(),
        supabase
          .from('usage')
          .select('job_count')
          .eq('user_id', user.id)
          .eq('period', new Date().toISOString().slice(0, 7))
          .maybeSingle(),
      ])

      if (profileRes.data) setProfile(profileRes.data as unknown as Profile)
      setUsedCount(usageRes.data?.job_count ?? 0)
      setPeriod(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' }))
    }
    load()
  }, [supabase])

  function handleCheckout(productId: string) {
    const url = `https://buy.polar.sh/${productId}?metadata[userId]=${userId}`
    window.open(url, '_blank')
  }

  const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null
  const isTrialActive = trialEndsAt && trialEndsAt > new Date()
  const effectivePlan = isTrialActive ? 'professional' : (profile?.plan ?? 'free')
  const limit = PLAN_LIMITS[effectivePlan as Plan]

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-2xl font-bold">요금제</h1>

      {/* 현재 상태 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재 플랜</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isTrialActive && (
            <div className="bg-blue-50 text-blue-700 rounded px-3 py-2 font-medium">
              30일 무료 체험 중 — {trialEndsAt?.toLocaleDateString('ko-KR')} 종료
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">플랜</span>
            <span className="font-medium capitalize">
              {isTrialActive ? '프로 (체험)' : profile?.plan ?? 'Free'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{period} 사용량</span>
            <span className="font-medium">{usedCount} / {limit}건</span>
          </div>
        </CardContent>
      </Card>

      {/* 플랜 목록 */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrentBase = profile?.plan === p.key && !isTrialActive
          const isTrialPlan = isTrialActive && p.key === 'professional'
          const highlighted = isCurrentBase || isTrialPlan
          return (
            <Card key={p.key} className={highlighted ? 'ring-2 ring-blue-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  {isTrialPlan && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      체험 중
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-lg font-bold whitespace-nowrap">{p.priceKRW}</p>
                  <p className="text-sm text-gray-400 whitespace-nowrap">{p.priceJPY}</p>
                </div>
                <p className="text-sm text-gray-500">{PLAN_LIMITS[p.key]}건/월</p>
                {isCurrentBase ? (
                  <Button variant="outline" className="w-full" disabled>현재 플랜</Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      const id = process.env[`NEXT_PUBLIC_POLAR_PRODUCT_ID_${p.key.toUpperCase()}`] ?? ''
                      handleCheckout(id)
                    }}
                  >
                    {profile?.plan === 'free' || isTrialActive ? '구독하기' : '변경하기'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
