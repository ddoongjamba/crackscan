import { task, logger } from '@trigger.dev/sdk/v3'
import { renderToBuffer, Font } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { ReportDocument } from '@/lib/pdf/components/ReportDocument'
import { NOTO_SANS_KR_B64, NOTO_SANS_JP_B64 } from '@/lib/pdf/fonts-base64'
import fs from 'fs'
import os from 'os'
import path from 'path'

// 폰트를 /tmp/에 파일로 쓰고 Font.register — base64는 esbuild 번들에 포함됨
function setupFonts() {
  const tmpDir = os.tmpdir()
  const krPath = path.join(tmpDir, 'NotoSansKR-Regular.ttf')
  const jpPath = path.join(tmpDir, 'NotoSansJP-Regular.ttf')

  const strip = (b64: string) => b64.replace(/^data:font\/ttf;base64,/, '')
  if (!fs.existsSync(krPath)) fs.writeFileSync(krPath, Buffer.from(strip(NOTO_SANS_KR_B64), 'base64'))
  if (!fs.existsSync(jpPath)) fs.writeFileSync(jpPath, Buffer.from(strip(NOTO_SANS_JP_B64), 'base64'))

  Font.register({ family: 'NotoSansKR', src: krPath })
  Font.register({ family: 'NotoSansJP', src: jpPath })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export const generatePdfTask = task({
  id: 'generate-pdf',
  run: async ({ jobId }: { jobId: string }) => {
    setupFonts()

    // 잡 + 이미지 전체 로드
    const { data: job, error } = await supabase
      .from('analysis_jobs')
      .select('*, analysis_images(*), profiles(email, full_name, locale)')
      .eq('id', jobId)
      .single()

    if (error || !job) throw new Error(`Job not found: ${jobId}`)

    const images = (job as any).analysis_images as any[]
    const profile = (job as any).profiles

    // PDF 생성 (@react-pdf/renderer)
    const pdfBuffer = await renderToBuffer(
      ReportDocument({ job: job as any, images, locale: profile?.locale ?? 'ko' })
    )

    // Supabase Storage 저장
    const reportPath = `jobs/${job.user_id}/${jobId}/report.pdf`
    const { error: uploadError } = await supabase.storage
      .from('crack-images')
      .upload(reportPath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`)

    // reports 테이블 저장
    const { error: reportError } = await supabase.from('reports').upsert({
      job_id: jobId,
      user_id: job.user_id,
      storage_path: reportPath,
    })
    if (reportError) logger.warn('reports upsert failed', { reportError })

    // severity_summary 집계
    const summary = { safe: 0, low: 0, medium: 0, critical: 0 }
    for (const img of images) {
      const detections: any[] = img.crack_detections ?? []
      for (const d of detections) {
        const s = d.severity as keyof typeof summary
        if (s in summary) summary[s]++
      }
    }

    // 잡 완료 처리
    await supabase
      .from('analysis_jobs')
      .update({ status: 'completed', severity_summary: summary })
      .eq('id', jobId)

    // 이메일 알림 (PDF 첨부 없음 — 대시보드 링크만)
    if (profile?.email) {
      try {
        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/jobs/${jobId}`
        const isJa = (profile.locale ?? 'ko') === 'ja'

        await resend.emails.send({
          from: 'CrackScan <noreply@crackscan.io>',
          to: profile.email,
          subject: isJa ? '【CrackScan】ひび割れ分析が完了しました' : '[CrackScan] 균열 분석이 완료되었습니다',
          html: isJa
            ? `<p>分析が完了しました。<a href="${dashboardUrl}">ダッシュボード</a>からPDFレポートをダウンロードしてください。</p>`
            : `<p>분석이 완료되었습니다. <a href="${dashboardUrl}">대시보드</a>에서 PDF 보고서를 다운로드하세요.</p>`,
        })
      } catch (emailError) {
        logger.warn('Email send failed', { emailError })
      }
    }

    logger.info('PDF generated', { jobId, reportPath })
  },
})
