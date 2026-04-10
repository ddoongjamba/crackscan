import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { jobId, fileName, contentType } = body as {
    jobId: string
    fileName: string
    contentType: string
  }

  if (!jobId || !fileName || !contentType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 잡이 본인 소유인지 확인
  const { data: job } = await db
    .from('analysis_jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const storagePath = `jobs/${user.id}/${jobId}/original/${Date.now()}_${fileName}`

  // Supabase Storage presigned upload URL 발급 (Vercel 4.5MB body 제한 우회)
  const { data, error } = await supabase.storage
    .from('crack-images')
    .createSignedUploadUrl(storagePath)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // analysis_images 레코드 생성
  await db.from('analysis_images').insert({
    job_id: jobId,
    user_id: user.id,
    storage_path: storagePath,
    file_name: fileName,
  })

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath })
}
