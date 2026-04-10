'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface Job {
  id: string
  status: JobStatus
  image_count: number
  completed_count: number
  location_label: string | null
  created_at: string
  severity_summary: Record<string, number> | null
  reports: { storage_path: string }[] | null
}

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: '대기',
  processing: '분석 중',
  completed: '완료',
  failed: '실패',
}

const STATUS_VARIANT: Record<JobStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  processing: 'default',
  completed: 'outline',
  failed: 'destructive',
}

export default function JobsPage() {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 초기 로드
    fetch('/api/jobs')
      .then((r) => r.json())
      .then(({ jobs }) => {
        setJobs(jobs ?? [])
        setLoading(false)
      })

    // Supabase Realtime — 진행 중인 잡 상태 변화 구독
    const channel = supabase
      .channel('jobs-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'analysis_jobs' },
        (payload) => {
          setJobs((prev) =>
            prev.map((j) => (j.id === payload.new.id ? { ...j, ...payload.new } : j))
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  if (loading) {
    return <div className="max-w-3xl mx-auto py-10 px-4 text-gray-400">로딩 중...</div>
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">검사 내역</h1>
        <Link href="/upload">
          <Button>새 검사 시작</Button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p>검사 내역이 없습니다.</p>
          <Link href="/upload">
            <Button className="mt-4">첫 검사 시작하기</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{job.location_label ?? '건물명 없음'}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(job.created_at).toLocaleDateString('ko-KR')} ·{' '}
                      {job.image_count}장
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === 'processing' && (
                      <span className="text-xs text-gray-400">
                        {job.completed_count}/{job.image_count}
                      </span>
                    )}
                    <Badge variant={STATUS_VARIANT[job.status]}>
                      {STATUS_LABEL[job.status]}
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
