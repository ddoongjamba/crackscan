import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tasks } from '@trigger.dev/sdk/v3'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 잡 + 이미지 목록 조회
  const { data: job } = await supabase
    .from('analysis_jobs')
    .select('*, analysis_images(*)')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'pending') {
    return NextResponse.json({ error: 'Job already started' }, { status: 409 })
  }

  const images = (job as any).analysis_images as { id: string; storage_path: string }[]
  if (!images || images.length === 0) {
    return NextResponse.json({ error: 'No images to process' }, { status: 400 })
  }

  // 잡 상태 → processing
  await supabase
    .from('analysis_jobs')
    .update({ status: 'processing' })
    .eq('id', jobId)

  // 이미지 1장씩 Trigger.dev task 발행 (처리 로직은 여기 없음)
  await Promise.all(
    images.map((image) =>
      tasks.trigger('process-image', {
        jobId,
        imageId: image.id,
        storagePath: image.storage_path,
        locale: (job as any).locale ?? 'ko',
      })
    )
  )

  return NextResponse.json({ ok: true }, { status: 202 })
}
