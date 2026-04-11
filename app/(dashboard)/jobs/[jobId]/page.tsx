'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

type ImageStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface JobImage {
  id: string
  file_name: string
  status: ImageStatus
  crack_detections: Array<{
    severity: string
    confidence: number
    description: string
  }> | null
}

interface JobDetail {
  id: string
  status: string
  image_count: number
  completed_count: number
  location_label: string | null
  created_at: string
  severity_summary: Record<string, number> | null
  analysis_images: JobImage[]
  reports: { storage_path: string }[]
}

const SEVERITY_COLOR: Record<string, string> = {
  safe: 'bg-green-100 text-green-700',
  low: 'bg-yellow-100 text-yellow-700',
  medium: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const SEVERITY_LABEL: Record<string, string> = {
  safe: '안전', low: '경미', medium: '보통', critical: '위험',
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const supabase = createClient()
  const [job, setJob] = useState<JobDetail | null>(null)

  async function loadJob() {
    const { data } = await supabase
      .from('analysis_jobs')
      .select('*, analysis_images(*), reports(storage_path)')
      .eq('id', jobId)
      .single()
    if (data) setJob(data as unknown as JobDetail)
  }

  useEffect(() => {
    loadJob()

    // Realtime: 이미지별 상태 변화 구독
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'analysis_images', filter: `job_id=eq.${jobId}` },
        () => loadJob()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'analysis_jobs', filter: `id=eq.${jobId}` },
        () => loadJob()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  async function downloadPdf() {
    // reports 테이블 우선, 없으면 storage path 직접 구성
    let storagePath = job?.reports?.[0]?.storage_path
    if (!storagePath) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      storagePath = `jobs/${user.id}/${jobId}/report.pdf`
    }
    const { data } = await supabase.storage
      .from('crack-images')
      .createSignedUrl(storagePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  if (!job) {
    return <div className="max-w-3xl mx-auto py-10 px-4 text-gray-400">로딩 중...</div>
  }

  const pct = job.image_count > 0
    ? Math.round((job.completed_count / job.image_count) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.location_label ?? '건물명 없음'}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {new Date(job.created_at).toLocaleDateString('ko-KR')} · {job.image_count}장
          </p>
        </div>
        {job.status === 'completed' && (
          <div className="flex gap-2">
            <Button onClick={downloadPdf}>PDF 보고서 다운로드</Button>
            <Button variant="outline" onClick={loadJob}>새로고침</Button>
          </div>
        )}
      </div>

      {/* 진행률 */}
      {job.status === 'processing' && (
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">분석 중...</span>
            <span className="text-gray-400">{job.completed_count}/{job.image_count}</span>
          </div>
          <Progress value={pct} />
        </div>
      )}

      {/* severity 요약 */}
      {job.severity_summary && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(job.severity_summary).map(([sev, count]) => (
            <span key={sev} className={`text-xs px-2 py-1 rounded-full font-medium ${SEVERITY_COLOR[sev] ?? ''}`}>
              {SEVERITY_LABEL[sev] ?? sev}: {count}
            </span>
          ))}
        </div>
      )}

      {/* 이미지별 결과 */}
      <div className="space-y-3">
        {job.analysis_images?.map((img) => (
          <div key={img.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium truncate max-w-xs">{img.file_name}</p>
              <Badge variant={img.status === 'completed' ? 'outline' : img.status === 'failed' ? 'destructive' : 'secondary'}>
                {img.status === 'completed' ? '완료' : img.status === 'failed' ? '실패' : img.status === 'processing' ? '분석 중' : '대기'}
              </Badge>
            </div>

            {img.crack_detections && img.crack_detections.length > 0 ? (
              <div className="space-y-1">
                {img.crack_detections.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${SEVERITY_COLOR[d.severity] ?? ''}`}>
                      {SEVERITY_LABEL[d.severity] ?? d.severity}
                    </span>
                    <span className="text-gray-600">{d.description}</span>
                    <span className="text-gray-400 shrink-0">{Math.round(d.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            ) : img.status === 'completed' ? (
              <p className="text-xs text-green-600">균열 없음</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
