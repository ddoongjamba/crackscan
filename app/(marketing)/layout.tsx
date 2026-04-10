import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 헤더 */}
      <header className="border-b sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl tracking-tight">
            CrackScan
          </Link>
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

      {/* 본문 */}
      <main className="flex-1">{children}</main>

      {/* 푸터 */}
      <footer className="border-t py-8 text-center text-sm text-gray-400">
        © 2026 CrackScan. All rights reserved.
      </footer>
    </div>
  )
}
