import { createCanvas, loadImage } from '@napi-rs/canvas'
import type { CrackDetection } from './claude-detector'

const SEVERITY_COLORS: Record<string, string> = {
  safe: '#22c55e',
  low: '#eab308',
  medium: '#f97316',
  critical: '#ef4444',
}

/**
 * 원본 이미지 버퍼에 bbox 사각형을 그려 어노테이션된 JPEG 버퍼를 반환한다.
 * @napi-rs/canvas 사용 — Vercel Serverless 환경에서 네이티브 바이너리 문제 없음
 */
export async function annotateImage(
  imageBuffer: Buffer,
  detections: CrackDetection[]
): Promise<Buffer> {
  const img = await loadImage(imageBuffer)
  const { width, height } = img

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  // 원본 이미지 그리기
  ctx.drawImage(img, 0, 0)

  if (detections.length === 0) {
    return canvas.toBuffer('image/jpeg', 90)
  }

  for (const d of detections) {
    const color = SEVERITY_COLORS[d.severity] ?? '#ff0000'
    const x = d.bbox.x * width
    const y = d.bbox.y * height
    const w = d.bbox.width * width
    const h = d.bbox.height * height

    // bbox 사각형
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, width * 0.003)
    ctx.strokeRect(x, y, w, h)

    // 신뢰도 레이블 배경
    const label = `${Math.round(d.confidence * 100)}%`
    const fontSize = Math.max(12, width * 0.018)
    ctx.font = `bold ${fontSize}px sans-serif`
    const textMetrics = ctx.measureText(label)
    const padX = 4
    const padY = 2
    const labelW = textMetrics.width + padX * 2
    const labelH = fontSize + padY * 2

    ctx.fillStyle = color
    ctx.fillRect(x, y - labelH, labelW, labelH)

    // 레이블 텍스트
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + padX, y - padY)
  }

  return canvas.toBuffer('image/jpeg', 90)
}
