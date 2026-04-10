import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PLAN_LIMITS } from '@/lib/plans'

const FEATURES = [
  {
    icon: '🔍',
    title: 'AI 자동 검출',
    desc: 'Claude Vision API가 외벽 사진에서 균열 위치와 심각도를 자동으로 분석합니다.',
  },
  {
    icon: '📄',
    title: '한국어 PDF 보고서',
    desc: '검출 결과를 전문 보고서로 자동 생성. bbox 어노테이션 이미지 포함.',
  },
  {
    icon: '⚡',
    title: '실시간 진행 확인',
    desc: '이미지별 분석 상태를 실시간으로 확인. 완료 시 이메일 알림 발송.',
  },
]

const PLANS = [
  { key: 'free' as const, name: '무료', price: '₩0', period: '', highlight: false, badge: null, cta: '시작하기' },
  { key: 'starter' as const, name: '스타터', price: '₩29,000', period: '/월', highlight: false, badge: null, cta: '구독하기' },
  { key: 'professional' as const, name: '프로', price: '₩89,000', period: '/월', highlight: true, badge: '30일 무료 체험', cta: '무료로 시작하기' },
  { key: 'business' as const, name: '비즈니스', price: '₩249,000', period: '/월', highlight: false, badge: null, cta: '구독하기' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 헤더 */}
      <header className="border-b sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-xl tracking-tight">CrackScan</span>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">로그인</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">무료 시작</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="py-24 px-4 text-center bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-3xl mx-auto space-y-6">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              30일 무료 체험 · 신용카드 불필요
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
              건물 외벽 균열,<br />AI가 자동으로 검출합니다
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              사진 업로드 한 번으로 균열 위치·심각도 분석 완료.
              전문 PDF 보고서를 자동으로 받아보세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto px-8">무료로 시작하기 →</Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">로그인</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* 워크플로우 */}
        <section className="py-12 px-4 border-y bg-gray-50">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 text-center text-sm font-medium text-gray-600">
            {['사진 업로드', 'AI 분석', '균열 검출', 'PDF 보고서'].map((step, i) => (
              <div key={step} className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-400">0{i + 1}</span>
                  <span>{step}</span>
                </div>
                {i < 3 && <span className="text-gray-300 hidden sm:block">→</span>}
              </div>
            ))}
          </div>
        </section>

        {/* 기능 소개 */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">검사 시간을 90% 단축하세요</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <Card key={f.title} className="border-0 shadow-sm">
                  <CardHeader>
                    <div className="text-3xl mb-2">{f.icon}</div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-500">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 요금제 */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">합리적인 요금제</h2>
            <p className="text-center text-gray-500 mb-12">프로 플랜 30일 무료 체험 후 결정하세요</p>
            <div className="grid sm:grid-cols-4 gap-4">
              {PLANS.map((plan) => (
                <Card key={plan.key} className={`relative ${plan.highlight ? 'border-blue-500 border-2 shadow-md' : ''}`}>
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-blue-600 text-white text-xs px-2 whitespace-nowrap">{plan.badge}</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-600">{plan.name}</CardTitle>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-sm text-gray-400">{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-500">{PLAN_LIMITS[plan.key]}건/월</p>
                    <Link href="/signup">
                      <Button className="w-full" variant={plan.highlight ? 'default' : 'outline'} size="sm">
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* 하단 CTA */}
        <section className="py-20 px-4 text-center">
          <div className="max-w-xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">지금 바로 시작하세요</h2>
            <p className="text-gray-500">30일 동안 무료로 사용해보고, 필요할 때 구독하세요.</p>
            <Link href="/signup">
              <Button size="lg" className="px-10">무료로 시작하기 →</Button>
            </Link>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        © 2026 CrackScan. All rights reserved.
      </footer>
    </div>
  )
}
