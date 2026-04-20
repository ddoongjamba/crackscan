import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface CrackDetection {
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  severity: 'safe' | 'low' | 'medium' | 'critical'
  description: string
  crack_type: 'linear' | 'map'
  direction: 'vertical' | 'horizontal' | 'diagonal' | 'unknown'
  cause: 'over_stress' | 'corrosion' | 'general'
  width_mm: number
}

export interface DetectCracksResult {
  detections: CrackDetection[]
  rawText: string
}

const PROMPT: Record<string, string> = {
  ko: `이 건물 외벽 이미지를 분석하여 균열을 검출하세요. 아래 JSON 형식으로만 응답하세요(다른 텍스트 없이):
{"detections":[{"bbox":{"x":0.1,"y":0.2,"width":0.3,"height":0.1},"confidence":0.95,"severity":"medium","description":"수평 균열, 폭 약 0.3mm","crack_type":"linear","direction":"horizontal","cause":"general","width_mm":0.30}]}

severity 기준: safe=균열 없음, low=경미(폭<0.2mm), medium=보통(0.2~1mm), critical=위험(>1mm 또는 구조적)
crack_type: linear=선형/단방향 균열, map=망상/거북등 균열(2방향 이상)
direction: vertical=수직, horizontal=수평, diagonal=사선, unknown=판별불가
cause: over_stress=과응력균열(구조하중·침하), corrosion=부식균열(철근녹), general=일반균열(노화·건조수축)
width_mm: 이미지 픽셀 비율 기반 추정 균열폭(mm, 소수점 2자리)
균열이 없으면: {"detections":[]}`,

  ja: `この建物外壁の画像を分析して、ひび割れを検出してください。以下のJSON形式のみで回答してください（他のテキストなし）:
{"detections":[{"bbox":{"x":0.1,"y":0.2,"width":0.3,"height":0.1},"confidence":0.95,"severity":"medium","description":"水平方向のひび割れ、幅約0.3mm","crack_type":"linear","direction":"horizontal","cause":"general","width_mm":0.30}]}

severity基準: safe=なし, low=軽微(<0.2mm), medium=中程度(0.2~1mm), critical=危険(>1mm or 構造的)
crack_type: linear=線形/一方向ひび割れ, map=網状/亀甲状ひび割れ(2方向以上)
direction: vertical=垂直, horizontal=水平, diagonal=斜め, unknown=判別不可
cause: over_stress=過応力ひび割れ(構造荷重・沈下), corrosion=腐食ひび割れ(鉄筋錆), general=一般ひび割れ(経年劣化・乾燥収縮)
width_mm: 画像ピクセル比率に基づく推定ひび割れ幅(mm、小数点2桁)
ひび割れがない場合: {"detections":[]}`,
}

export async function detectCracks(
  imageBuffer: Buffer,
  locale: 'ko' | 'ja' = 'ko'
): Promise<DetectCracksResult> {
  const base64 = imageBuffer.toString('base64')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          { type: 'text', text: PROMPT[locale] ?? PROMPT.ko },
        ],
      },
    ],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

  let detections: CrackDetection[] = []
  try {
    // 응답에 JSON 외 텍스트가 섞인 경우 추출
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      detections = Array.isArray(parsed.detections) ? parsed.detections : []
    }
  } catch {
    // 파싱 실패 시 빈 배열 반환 (처리 중단하지 않음)
  }

  return { detections, rawText }
}
