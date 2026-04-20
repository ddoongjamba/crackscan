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
  page: { padding: 40, fontFamily: 'NotoSansKR', fontSize: 20, color: '#1a1a1a' },
  pageJa: { padding: 40, fontFamily: 'NotoSansJP', fontSize: 20, color: '#1a1a1a' },
  label: { fontSize: 16, color: '#888', marginBottom: 4 },
  imageWrapper: { position: 'relative', marginBottom: 12 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontSize: 16, color: '#fff' },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  divider: { borderBottom: '1pt solid #e5e5e5', marginVertical: 16 },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 16, color: '#aaa' },
  disclaimer: { position: 'absolute', bottom: 36, left: 40, right: 120, fontSize: 14, color: '#aaa', lineHeight: 1.4 },
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

function crackTypeLabel(crack_type: string | undefined, locale: string) {
  if (!crack_type) return null
  const map: Record<string, Record<string, string>> = {
    ko: { linear: '선형균열', map: '망상균열' },
    ja: { linear: '線形ひび割れ', map: '網状ひび割れ' },
  }
  return map[locale]?.[crack_type] ?? crack_type
}

function directionLabel(direction: string | undefined, locale: string) {
  if (!direction || direction === 'unknown') return null
  const map: Record<string, Record<string, string>> = {
    ko: { vertical: '수직', horizontal: '수평', diagonal: '사선' },
    ja: { vertical: '垂直', horizontal: '水平', diagonal: '斜め' },
  }
  return map[locale]?.[direction] ?? direction
}

function causeLabel(cause: string | undefined, locale: string) {
  if (!cause) return null
  const map: Record<string, Record<string, string>> = {
    ko: { over_stress: '과응력', corrosion: '부식', general: '일반노화' },
    ja: { over_stress: '過応力', corrosion: '腐食', general: '一般劣化' },
  }
  return map[locale]?.[cause] ?? cause
}

// 국토안전관리원 균열등급 기준: A(<0.1mm) B(0.1~0.3) C(0.3~0.5) D(0.5~1.0) E(≥1.0)
function gradeFromWidth(width_mm: number | undefined, severity: string): string {
  if (width_mm != null) {
    if (width_mm < 0.1) return 'A'
    if (width_mm < 0.3) return 'B'
    if (width_mm < 0.5) return 'C'
    if (width_mm < 1.0) return 'D'
    return 'E'
  }
  const fallback: Record<string, string> = { safe: 'A', low: 'B', medium: 'C', critical: 'E' }
  return fallback[severity] ?? 'C'
}

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444',
}

interface Detection {
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  severity: string
  description: string
  crack_type?: 'linear' | 'map'
  direction?: 'vertical' | 'horizontal' | 'diagonal' | 'unknown'
  cause?: 'over_stress' | 'corrosion' | 'general'
  width_mm?: number
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
    gps_lat?: number | null
    gps_lng?: number | null
    gps_altitude?: number | null
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
    disclaimer: isJa
      ? '本レポートはAI解析による参考データであり、法的判断の根拠として使用することはできません。最終的な安全審査の責任は、図面を承認する専門技術者にあります。'
      : '본 보고서는 AI 분석을 통한 참고용 데이터로 법적 판단의 근거로 사용될 수 없으며, 최종 안전 검토의 책임은 도면을 승인하는 전문 기술자에게 있습니다.',
    crackType: isJa ? 'ひび割れ形態' : '균열 형태',
    direction: isJa ? '方向' : '방향',
    cause: isJa ? '原因' : '원인',
    widthMm: isJa ? '推定幅' : '추정 폭',
    grade: isJa ? '等級' : '등급',
    gpsCoord: isJa ? '撮影座標' : '촬영 좌표',
    altitude: isJa ? '高度' : '고도',
    compliance: isJa
      ? '国土安全管理院基準準拠レポート'
      : '국토안전관리원 기준 준수 보고서',
  }

  const formattedDate = new Date(job.created_at).toLocaleDateString(
    isJa ? 'ja-JP' : 'ko-KR',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )

  const gradeTable = [
    { grade: 'A', range: '< 0.1mm', label: isJa ? '安全' : '안전' },
    { grade: 'B', range: '0.1~0.3mm', label: isJa ? '軽微' : '경미' },
    { grade: 'C', range: '0.3~0.5mm', label: isJa ? '中程度' : '보통' },
    { grade: 'D', range: '0.5~1.0mm', label: isJa ? '重大' : '심각' },
    { grade: 'E', range: '≥ 1.0mm', label: isJa ? '危険' : '위험' },
  ]

  return (
    <Document>
      {/* ── 표지 (padding 0으로 풀블리드 헤더) ── */}
      <Page size="A4" style={{ ...pageStyle, padding: 0 }}>

        {/* 헤더 밴드 */}
        <View style={{ backgroundColor: '#1e3a5f', paddingTop: 44, paddingBottom: 32, paddingLeft: 40, paddingRight: 40 }}>
          <Text style={{ fontSize: 16, color: '#93c5fd', marginBottom: 10, letterSpacing: 1 }}>
            CRACKSCAN  ·  AI CRACK INSPECTION REPORT
          </Text>
          <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#ffffff', marginBottom: 8 }}>
            {labels.title}
          </Text>
          <Text style={{ fontSize: 20, color: '#93c5fd', marginBottom: 18 }}>
            {labels.subtitle}
          </Text>
          <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 16, color: '#fff' }}>{labels.compliance}</Text>
          </View>
        </View>

        {/* 본문 */}
        <View style={{ paddingTop: 28, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

          {/* 건물명 */}
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.label}>{labels.location}</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1a1a1a' }}>
              {job.location_label ?? '—'}
            </Text>
          </View>

          {/* 날짜 + 이미지 수 */}
          <View style={{ flexDirection: 'row', gap: 40, marginBottom: 24 }}>
            <View>
              <Text style={styles.label}>{labels.date}</Text>
              <Text style={{ fontSize: 20 }}>{formattedDate}</Text>
            </View>
            <View>
              <Text style={styles.label}>{labels.totalImages}</Text>
              <Text style={{ fontSize: 20 }}>{images.length}{isJa ? '枚' : '장'}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 심각도 통계 카드 */}
          {job.severity_summary && (
            <View style={{ marginBottom: 28 }}>
              <Text style={{ ...styles.label, marginBottom: 12 }}>{labels.detectionSummary}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(['safe', 'low', 'medium', 'critical'] as const).map((sev) => {
                  const count = job.severity_summary?.[sev] ?? 0
                  return (
                    <View
                      key={sev}
                      style={{
                        flex: 1,
                        backgroundColor: SEVERITY_COLORS[sev],
                        borderRadius: 6,
                        paddingTop: 16,
                        paddingBottom: 16,
                        paddingLeft: 8,
                        paddingRight: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 4 }}>
                        {count}
                      </Text>
                      <Text style={{ fontSize: 14, color: '#fff' }}>
                        {severityLabel(sev, locale)}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* A~E 등급 기준표 */}
          <View>
            <Text style={{ ...styles.label, marginBottom: 12 }}>
              {isJa ? 'ひび割れ等級基準 (国土安全管理院)' : '균열 등급 기준 (국토안전관리원)'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {gradeTable.map(({ grade, range, label: gl }) => (
                <View
                  key={grade}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: '#e5e5e5',
                    borderRadius: 5,
                    paddingTop: 12,
                    paddingBottom: 12,
                    paddingLeft: 6,
                    paddingRight: 6,
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: GRADE_COLORS[grade],
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>{grade}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: '#444', marginBottom: 3 }}>{gl}</Text>
                  <Text style={{ fontSize: 12, color: '#999' }}>{range}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.disclaimer} fixed>{labels.disclaimer}</Text>
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
            <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 10 }}>
              {labels.imageDetail} {idx + 1} — {img.file_name}
            </Text>
            <View style={styles.divider} />

            {/* GPS 좌표 (드론 촬영 이미지) */}
            {img.gps_lat != null && img.gps_lng != null && (
              <View style={{ flexDirection: 'row', gap: 24, marginBottom: 10 }}>
                <View>
                  <Text style={styles.label}>{labels.gpsCoord}</Text>
                  <Text style={{ fontSize: 16 }}>
                    {img.gps_lat.toFixed(6)}, {img.gps_lng.toFixed(6)}
                  </Text>
                </View>
                {img.gps_altitude != null && (
                  <View>
                    <Text style={styles.label}>{labels.altitude}</Text>
                    <Text style={{ fontSize: 16 }}>{img.gps_altitude.toFixed(1)} m</Text>
                  </View>
                )}
              </View>
            )}

            {/* 어노테이션 이미지 */}
            {imgSrc && (
              <View style={styles.imageWrapper}>
                <Image src={imgSrc} style={{ width: '100%' }} />
              </View>
            )}

            {/* 검출 목록 */}
            {detections.length === 0 ? (
              <Text style={{ color: '#22c55e', marginTop: 10, fontSize: 20 }}>{labels.noDetection}</Text>
            ) : (
              detections.map((d, i) => {
                const ctLabel = crackTypeLabel(d.crack_type, locale)
                const dirLabel = directionLabel(d.direction, locale)
                const csLabel = causeLabel(d.cause, locale)
                const grade = gradeFromWidth(d.width_mm, d.severity)
                return (
                  <View
                    key={i}
                    style={{
                      marginBottom: 10,
                      paddingTop: 10, paddingBottom: 10, paddingLeft: 14, paddingRight: 10,
                      backgroundColor: '#f8fafc',
                      borderLeftWidth: 4,
                      borderLeftColor: GRADE_COLORS[grade] ?? '#888',
                      borderRadius: 3,
                    }}
                  >
                    <View style={styles.row}>
                      <View style={{ ...styles.chip, backgroundColor: SEVERITY_COLORS[d.severity] ?? '#888' }}>
                        <Text>{severityLabel(d.severity, locale)}</Text>
                      </View>
                      <View style={{ ...styles.chip, backgroundColor: GRADE_COLORS[grade] ?? '#888' }}>
                        <Text>{labels.grade} {grade}</Text>
                      </View>
                      <Text style={{ fontSize: 18, color: '#555' }}>
                        {labels.confidence}: {Math.round(d.confidence * 100)}%
                      </Text>
                    </View>
                    <Text style={{ fontSize: 18, marginBottom: 4 }}>{d.description}</Text>
                    {(ctLabel || dirLabel) && (
                      <Text style={{ fontSize: 16, color: '#666', marginTop: 3 }}>
                        {ctLabel ? `${labels.crackType}: ${ctLabel}` : ''}{ctLabel && dirLabel ? '  |  ' : ''}{dirLabel ? `${labels.direction}: ${dirLabel}` : ''}
                      </Text>
                    )}
                    {(csLabel || d.width_mm != null) && (
                      <Text style={{ fontSize: 16, color: '#666', marginTop: 3 }}>
                        {csLabel ? `${labels.cause}: ${csLabel}` : ''}{csLabel && d.width_mm != null ? '  |  ' : ''}{d.width_mm != null ? `${labels.widthMm}: ${d.width_mm.toFixed(2)}mm` : ''}
                      </Text>
                    )}
                  </View>
                )
              })
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
