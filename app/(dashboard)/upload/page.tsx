'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface UploadFile {
  file: File
  progress: number // 0~100
  status: 'idle' | 'uploading' | 'done' | 'error'
}

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()

  const [files, setFiles] = useState<UploadFile[]>([])
  const [locationLabel, setLocationLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const MAX_FILES = 10

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_FILES)
    setFiles(selected.map((f) => ({ file: f, progress: 0, status: 'idle' })))
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, MAX_FILES)
    setFiles(dropped.map((f) => ({ file: f, progress: 0, status: 'idle' })))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return
    setSubmitting(true)
    setError('')

    // 1. 잡 생성
    const jobRes = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageCount: files.length, locationLabel }),
    })

    if (!jobRes.ok) {
      const data = await jobRes.json()
      setError(
        data.error === 'monthly_limit_exceeded'
          ? `이번 달 분석 한도(${data.limit}건)를 초과했습니다.`
          : data.error ?? '잡 생성에 실패했습니다.'
      )
      setSubmitting(false)
      return
    }

    const { job } = await jobRes.json()
    const jobId: string = job.id

    // 2. 이미지별 presigned URL 발급 → Supabase Storage 직접 업로드
    const uploadResults = await Promise.all(
      files.map(async (item, idx) => {
        const urlRes = await fetch('/api/images/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            fileName: item.file.name,
            contentType: item.file.type,
          }),
        })
        if (!urlRes.ok) return false

        const { signedUrl } = await urlRes.json()

        // XMLHttpRequest로 진행률 추적
        return new Promise<boolean>((resolve) => {
          const xhr = new XMLHttpRequest()
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.round((ev.loaded / ev.total) * 100)
              setFiles((prev) =>
                prev.map((f, i) => (i === idx ? { ...f, progress: pct, status: 'uploading' } : f))
              )
            }
          }
          xhr.onload = () => {
            setFiles((prev) =>
              prev.map((f, i) => (i === idx ? { ...f, progress: 100, status: 'done' } : f))
            )
            resolve(xhr.status < 300)
          }
          xhr.onerror = () => {
            setFiles((prev) =>
              prev.map((f, i) => (i === idx ? { ...f, status: 'error' } : f))
            )
            resolve(false)
          }
          xhr.open('PUT', signedUrl)
          xhr.setRequestHeader('Content-Type', item.file.type)
          xhr.send(item.file)
        })
      })
    )

    if (uploadResults.some((r) => r === false)) {
      setError('일부 이미지 업로드에 실패했습니다. 다시 시도해주세요.')
      setSubmitting(false)
      return
    }

    // 3. 분석 시작 (Trigger.dev task 발행)
    await fetch(`/api/jobs/${jobId}/process`, { method: 'POST' })

    router.push(`/jobs/${jobId}`)
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-6">외벽 사진 업로드</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 드래그앤드롭 영역 */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFileChange}
          />
          <p className="text-gray-500">
            {files.length > 0
              ? `${files.length}장 선택됨`
              : '사진을 드래그하거나 클릭하여 업로드'}
          </p>
          <p className="text-xs text-gray-400 mt-1">최대 10장 · JPG, PNG, HEIC</p>
        </div>

        {/* 파일별 진행률 */}
        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((item, i) => (
              <div key={i} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="truncate max-w-xs text-gray-600">{item.file.name}</span>
                  <span className="text-gray-400 ml-2">
                    {item.status === 'done' ? '완료' : item.status === 'error' ? '실패' : `${item.progress}%`}
                  </span>
                </div>
                <Progress value={item.progress} className="h-1" />
              </div>
            ))}
          </div>
        )}

        {/* 건물명 */}
        <div className="space-y-1">
          <Label htmlFor="location">건물명 (선택)</Label>
          <Input
            id="location"
            type="text"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="예: 강남 A아파트 201동"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting || files.length === 0}>
          {submitting ? '분석 중...' : `${files.length}장 분석 시작`}
        </Button>
      </form>
    </div>
  )
}
