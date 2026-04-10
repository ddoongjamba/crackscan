import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/jobs" className="font-bold text-lg">CrackScan</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/upload" className="text-gray-600 hover:text-gray-900">업로드</Link>
            <Link href="/jobs" className="text-gray-600 hover:text-gray-900">내역</Link>
            <Link href="/billing" className="text-gray-600 hover:text-gray-900">요금제</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
