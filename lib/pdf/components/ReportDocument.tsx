import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
} from '@react-pdf/renderer'

// 폰트 등록은 generate-pdf.ts의 setupFonts()에서 수행 (Trigger.dev 런타임 환경 대응)

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'NotoSansKR', fontSize: 10, color: '#1a1a1a' },
  pageJa: { padding: 40, fontFamily: 'NotoSansJP', fontSize: 10, color: '#1a1a1a' },
  coverTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
  coverSub: { fontSize: 14, color: '#555', marginBottom: 32 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: '#888', marginBottom: 2 },
  value: { fontSize: 11 },
  imageWrapper: { position: 'relative', marginBottom: 12 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 8, color: '#fff' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  divider: { borderBottom: '1pt solid #e5e5e5', marginVertical: 12 },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 8, color: '#aaa' },
})

const SEVERITY_COLORS: Record<string, string> = {
  safe: '#22c55e',
  low: '#eab308',
  medium: '#f97316',
  critical: '#ef4444',
}

function severityLabel(severity: string, locale: string) {
  const map: Record<string, Record<string, string>> = {
    ko: { safe: '안전', low: '경미', medium: '보통', critical: '위험' },
    ja: { safe: '安全', low: '軽微', medium: '中程度', critical: '危険' },
  }
  return map[locale]?.[severity] ?? severity
}

interface Detection {
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  severity: string
  description: string
}

interface ReportDocumentProps {
  job: {
    id: string
    location_label: string | null
    created_at: string
    severity_summary: Record<string, number> | null
  }
  images: Array<{
    id: string
    file_name: string
    storage_path: string
    crack_detections: Detection[] | null
    status: string
  }>
  locale: 'ko' | 'ja'
  imageDataMap?: Record<string, string> // imageId → base64 data URL
}

export function ReportDocument({ job, images, locale, imageDataMap = {} }: ReportDocumentProps) {
  const isJa = locale === 'ja'
  const fontFamily = isJa ? 'NotoSansJP' : 'NotoSansKR'
  const pageStyle = { ...styles.page, fontFamily }

  const labels = {
    title: isJa ? 'ひび割れ検査レポート' : '균열 검사 보고서',
    subtitle: isJa ? 'CrackScan 自動解析システム' : 'CrackScan 자동 분석 시스템',
    location: isJa ? '建物名' : '건물명',
    date: isJa ? '検査日' : '검사일',
    totalImages: isJa ? '検査画像数' : '검사 이미지 수',
    detectionSummary: isJa ? '検出サマリー' : '검출 요약',
    imageDetail: isJa ? '画像詳細' : '이미지 상세',
    noDetection: isJa ? '異常なし' : '이상 없음',
    confidence: isJa ? '信頼度' : '신뢰도',
  }

  const formattedDate = new Date(job.created_at).toLocaleDateString(
    isJa ? 'ja-JP' : 'ko-KR',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )

  return (
    <Document>
      {/* ── 표지 ── */}
      <Page size="A4" style={pageStyle}>
        <View style={{ marginBottom: 40 }}>
          <Text style={styles.coverTitle}>{labels.title}</Text>
          <Text style={styles.coverSub}>{labels.subtitle}</Text>
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.label}>{labels.location}</Text>
            <Text style={styles.value}>{job.location_label ?? '—'}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>{labels.date}</Text>
            <Text style={styles.value}>{formattedDate}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>{labels.totalImages}</Text>
            <Text style={styles.value}>{images.length}</Text>
          </View>
        </View>

        {/* severity 요약 */}
        {job.severity_summary && (
          <View>
            <Text style={{ ...styles.label, marginBottom: 8 }}>{labels.detectionSummary}</Text>
            <View style={styles.row}>
              {Object.entries(job.severity_summary).map(([sev, count]) => (
                <View
                  key={sev}
                  style={{
                    ...styles.chip,
                    backgroundColor: SEVERITY_COLORS[sev] ?? '#888',
                  }}
                >
                  <Text>{severityLabel(sev, locale)}: {count}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>

      {/* ── 이미지별 상세 페이지 ── */}
      {images.map((img, idx) => {
        const detections: Detection[] = img.crack_detections ?? []
        const imgSrc = imageDataMap[img.id]

        return (
          <Page key={img.id} size="A4" style={pageStyle}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>
              {labels.imageDetail} {idx + 1} — {img.file_name}
            </Text>
            <View style={styles.divider} />

            {/* 어노테이션 이미지 (bbox가 이미 그려진 이미지) */}
            {imgSrc && (
              <View style={styles.imageWrapper}>
                <Image src={imgSrc} style={{ width: '100%' }} />
              </View>
            )}

            {/* 검출 목록 */}
            {detections.length === 0 ? (
              <Text style={{ color: '#22c55e', marginTop: 8 }}>{labels.noDetection}</Text>
            ) : (
              detections.map((d, i) => (
                <View key={i} style={{ marginBottom: 8, padding: 8, backgroundColor: '#f9f9f9' }}>
                  <View style={styles.row}>
                    <View style={{ ...styles.chip, backgroundColor: SEVERITY_COLORS[d.severity] ?? '#888' }}>
                      <Text>{severityLabel(d.severity, locale)}</Text>
                    </View>
                    <Text style={{ fontSize: 9, color: '#555' }}>
                      {labels.confidence}: {Math.round(d.confidence * 100)}%
                    </Text>
                  </View>
                  <Text style={{ fontSize: 9 }}>{d.description}</Text>
                </View>
              ))
            )}

            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
              fixed
            />
          </Page>
        )
      })}
    </Document>
  )
}
