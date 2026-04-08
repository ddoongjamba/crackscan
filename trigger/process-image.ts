import { task, logger } from '@trigger.dev/sdk/v3'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { detectCracks } from '@/lib/ml/claude-detector'
import { annotateImage } from '@/lib/ml/image-annotator'

// 워커 내부 전용 — 제네릭 없이 사용 (RPC·동적 테이블명 호환)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ProcessImagePayload {
  jobId: string
  imageId: string
  storagePath: string
  locale: 'ko' | 'ja'
}

export const processImageTask = task({
  id: 'process-image',
  queue: { concurrencyLimit: 3 }, // Claude API RPS 제한 대응
  run: async (payload: ProcessImagePayload) => {
    const { jobId, imageId, storagePath, locale } = payload

    // 1. status → processing
    await supabase
      .from('analysis_jobs' as any)
      .update({ status: 'processing' })
      .eq('id', imageId)

    // job_items 테이블 업데이트 (analysis_images → job_items 마이그레이션 후 변경)
    await supabase
      .from('analysis_images' as any)
      .update({ status: 'processing' })
      .eq('id', imageId)

    try {
      // 2. Supabase Storage 다운로드
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('crack-images')
        .download(storagePath)

      if (downloadError || !fileData) {
        throw new Error(`Download failed: ${downloadError?.message}`)
      }

      const buffer = Buffer.from(await fileData.arrayBuffer())

      // 3. sharp 리사이즈 (max 2048px)
      const resized = await sharp(buffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()

      // 4. Claude Vision API 균열 검출
      const { detections } = await detectCracks(resized, locale)
      logger.info('Crack detection done', { imageId, count: detections.length })

      // 5. @napi-rs/canvas bbox 어노테이션 이미지 생성
      const annotatedBuffer = await annotateImage(resized, detections)

      // 어노테이션 이미지 Storage 저장
      const annotatedPath = storagePath.replace('/original/', '/annotated/')
      await supabase.storage
        .from('crack-images')
        .upload(annotatedPath, annotatedBuffer, { contentType: 'image/jpeg', upsert: true })

      // 6. 결과 저장
      await supabase
        .from('analysis_images' as any)
        .update({
          status: 'completed',
          crack_detections: detections as any,
        })
        .eq('id', imageId)

      // 7. completed_count 원자적 증가
      await supabase.rpc('increment_job_completed_count' as any, { p_job_id: jobId })

      // 8. 모든 이미지 완료 시 generate-pdf 트리거
      const { data: job } = await supabase
        .from('analysis_jobs' as any)
        .select('image_count, completed_count')
        .eq('id', jobId)
        .single()

      if (job && (job as any).completed_count >= (job as any).image_count) {
        const { tasks } = await import('@trigger.dev/sdk/v3')
        await tasks.trigger('generate-pdf', { jobId })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logger.error('Image processing failed', { imageId, error: message })

      await supabase
        .from('analysis_images' as any)
        .update({ status: 'failed', error_message: message })
        .eq('id', imageId)
    }
  },
})
