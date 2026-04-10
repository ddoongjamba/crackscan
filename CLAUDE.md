# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CrackScan** — 건물 외벽 균열 검출 SaaS. 사용자가 외벽 사진을 업로드하면 AI가 균열을 검출하고 PDF 보고서를 반환한다.

**타겟 시장:** 한국(KRW) + 일본(JPY)
**목표 매출:** 1억 KRW/년

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth / DB / Storage:** Supabase (PostgreSQL + RLS + Storage)
- **ML (MVP):** Claude Vision API (`claude-sonnet-4-5`) — 균열 bbox + 심각도 JSON 반환
- **ML (V2):** YOLOv8 on Modal.com — 픽셀 세그먼테이션
- **이미지 리사이즈:** `sharp` (Vercel 배포 시 linux-x64 바이너리 명시 필수)
- **어노테이션:** `@napi-rs/canvas` (Rust 기반) — bbox 이미지 렌더링. **`canvas` / `@vercel/node-canvas` 사용 금지** (Cairo/Pango native 의존성으로 Vercel 런타임 에러 유발)
- **PDF 생성:** `@react-pdf/renderer` + Noto Sans KR TTF `Font.register()` — **Puppeteer 사용 금지** (Vercel 250MB 빌드 용량 초과)
- **비동기 잡 큐:** **Trigger.dev** — 이미지별 태스크 분리, Vercel 타임아웃 우회. 대안: Upstash QStash, Inngest (무료 티어·설정 난이도 비교 후 확정)
- **i18n:** `next-intl` (App Router 지원) — 지원 로케일: `ko`, `ja`
- **Payment:** Polar.sh — 1개월 무료 trial 후 구독 전환 (한국·일본 모두 Polar.sh 사용)
- **이메일:** Resend — 알림 전용 (PDF 첨부 없음, 대시보드 링크만 발송)
- **배포:** Vercel (API Route는 큐 발행만, 실제 처리는 Trigger.dev 워커)

## Common Commands

> ⚠️ **모든 명령어는 반드시 프로젝트 루트에서 실행할 것**
> ```bash
> cd /Volumes/My_SSD/developer/concretecrack/crackscan
> ```

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run lint         # ESLint
npm run type-check   # tsc --noEmit

# Supabase
supabase start                    # 로컬 Supabase 실행
supabase db reset                 # 마이그레이션 재적용
supabase migration new <name>     # 새 마이그레이션 파일 생성
supabase test db                  # RLS 정책 테스트
npx supabase db push              # 클라우드 DB에 마이그레이션 적용

# Trigger.dev
npm run trigger:dev               # 로컬 워커 실행 (npm run dev와 병행)
npm run trigger:deploy            # 워커 프로덕션 배포

# Modal (V2 ML 서비스)
modal deploy modal-service/main.py

# sharp Vercel 배포용 linux-x64 바이너리 강제 설치 (CI/CD 또는 최초 셋업 시 실행)
npm install --os=linux --cpu=x64 sharp
```

## Architecture

### Processing Pipeline

```
사용자 업로드
    ↓
POST /api/jobs → analysis_jobs 생성 (status: pending)
    ↓
POST /api/images/upload → Supabase presigned URL 발급 (Vercel 4.5MB 제한 우회)
    ↓
[클라이언트 → Supabase Storage 직접 업로드]
    ↓
POST /api/jobs/[id]/process → Message Queue(Trigger.dev)에 이미지별 task 발행 → 즉시 202 응답
    ↓
[워커] process-image (이미지 1장씩, concurrencyLimit: 3 — Claude API RPS 제한 대응)
  1. job_items.status → 'processing'
  2. Supabase Storage 다운로드
  3. sharp 리사이즈 (max 2048px)
  4. Claude Vision API → crack_detections JSON
  5. @napi-rs/canvas로 bbox 어노테이션 이미지 생성
  6. job_items.status → 'completed', crack_detections 저장
  7. analysis_jobs.completed_count 증가
  8. completed_count == image_count → generate-pdf task 트리거
    ↓
[워커] generate-pdf
  9. @react-pdf/renderer + Noto Sans KR → PDF Buffer
  10. Supabase Storage 저장
  11. analysis_jobs.status → 'completed'
  12. Resend 이메일 발송 (알림 전용, 대시보드 링크)
    ↓
클라이언트: Supabase Realtime으로 job_items.status 및 analysis_jobs.status 변화 구독
```

### Key Directories

```
app/
  (auth)/           — 로그인/회원가입/OAuth 콜백
  (dashboard)/      — 인증된 사용자 영역 (업로드, 결과, 결제)
  (marketing)/      — 랜딩/가격 페이지
  api/
    jobs/                      — 잡 생성·조회
    jobs/[jobId]/process/      — Trigger.dev task 발행 (처리 로직 없음)
    images/upload/             — presigned URL 발급
    webhooks/polar/            — Polar 구독 이벤트 처리

trigger/
  process-image.ts   — 이미지 1장 처리 태스크 (Claude API + DB 업데이트)
  generate-pdf.ts    — PDF 생성 태스크 (모든 이미지 완료 후 실행)

lib/
  ml/
    claude-detector.ts   — Claude Vision API 호출 및 JSON 파싱 (핵심 파일)
    image-annotator.ts   — @napi-rs/canvas bbox 어노테이션 이미지 생성
    yolo-detector.ts     — Modal + YOLOv8 클라이언트 (V2)
  pdf/
    report-generator.ts
    components/
      ReportDocument.tsx   — @react-pdf/renderer 문서 루트
  polar/webhooks.ts
  supabase/client.ts|server.ts

supabase/migrations/
modal-service/main.py    — V2 YOLOv8 Python 서비스
```

### Database Schema (핵심 테이블)

| 테이블 | 용도 |
|--------|------|
| `profiles` | 사용자 (plan: free/starter/professional/business, locale: ko/ja) |
| `subscriptions` | Polar 구독 (webhook으로 동기화, trial_ends_at 포함) |
| `usage` | 월별 사용량 집계 (키: `user_id` + `YYYY-MM`) |
| `analysis_jobs` | 검사 작업 (status, image_count, completed_count, severity_summary JSONB) |
| `job_items` | 이미지별 처리 상태 (`status`: pending/processing/completed/failed) + `crack_detections` JSONB — Supabase Realtime 구독 대상 |
| `reports` | 생성된 PDF storage_path |

Storage 경로: `jobs/{user_id}/{job_id}/original/{filename}`, `jobs/{user_id}/{job_id}/report.pdf`

모든 테이블에 RLS 적용 — `auth.uid() = user_id` 패턴.

`profiles.locale` 컬럼으로 사용자 언어 저장 → PDF 보고서 언어 결정에 사용.

### Pricing & Trial 전략

**1개월 무료 trial (카드 불필요)** — 회원가입 즉시 30일 프로 한도 부여.
Polar는 trial 없이 순수 유료 결제만 담당. trial 만료 후 자동으로 free(3건/월) 적용.

| 플랜 | 가격 (KRW) | 가격 (JPY) | 한도 |
|------|-----------|-----------|------|
| Free | 0 | 0 | 3건/월 |
| 스타터 | ₩29,000/월 | ¥3,200/월 | 20건 |
| 프로 | ₩89,000/월 | ¥9,800/월 | 100건 |
| 비즈니스 | ₩249,000/월 | ¥27,000/월 | 500건 |

**Trial 구현 방식:**
- `profiles.trial_ends_at` — `handle_new_user()` DB 트리거에서 `now() + 30 days` 자동 설정
- `/api/jobs` POST: `profiles.trial_ends_at`이 미래이면 프로 한도(100건) 적용
- Polar webhook: trial 로직 없음 — 구독 시 `profiles.plan`만 업데이트
- Polar 상품에 `trial_period_days` 설정 불필요 (0 또는 미설정)

## Critical Implementation Rules

1. **PDF: `@react-pdf/renderer`만 사용** — Puppeteer(Headless Chrome)는 Vercel 배포 시 250MB 용량 제한으로 사용 불가
2. **한글 폰트** — Noto Sans KR TTF를 `Font.register()`로 명시적 등록 필수. 미등록 시 한글 깨짐
3. **어노테이션 캔버스** — 반드시 `@napi-rs/canvas`(Rust 기반) 사용. `canvas` / `@vercel/node-canvas`는 Vercel Serverless에서 네이티브 바이너리 의존성 문제로 런타임 에러 유발 — 사용 엄격 금지
4. **비동기 처리 파이프라인 강제** — 다수 이미지 업로드 시 Vercel 실행 타임아웃 초과. API Route에서 동기식 이미지 처리 루프 직접 실행 금지. 반드시 Message Queue(Trigger.dev 등)로 작업 단위 분리 후 즉시 202 응답
5. **Claude API Rate Limit 대응** — 워커 큐 설정 시 `concurrencyLimit: 3` 부여. 동시 다발 호출 시 Anthropic RPS 제한(429) 방지
6. **이미지 전처리** — Claude Vision API 호출 전 `sharp`로 max 2048px 리사이즈 필수 (토큰 비용 절감 및 처리 속도 최적화)
7. **`sharp` 바이너리 환경 호환성** — `package.json` `optionalDependencies`에 `@img/sharp-linux-x64` 추가. CI/CD에 `npm install --os=linux --cpu=x64 sharp` 명시하여 Vercel(Amazon Linux) 바이너리 충돌 방지
8. **결제** — Polar.sh만 사용 (한국·일본 모두). Lemon Squeezy 사용 배제. `trial_period_days: 30` 설정으로 무료 체험 제공
9. **잡 한도 체크** — `/api/jobs` POST 시 `usage` 테이블 조회 후 구독 플랜 한도 초과 시 사전 차단. trial 중이면 프로 한도(100건/월) 적용
10. **`job_items.status` 필드 필수** — Phase 1 스키마부터 반드시 포함. 워커가 `pending → processing → completed/failed`로 업데이트해야 Supabase Realtime 이미지별 진행률 구독 가능

## Development Roadmap

### Phase 1 — MVP (1~6주): 첫 유료 고객 목표
- [x] Next.js 15 프로젝트 초기화 (TypeScript + Tailwind + App Router)
- [x] 의존성 설치 — Supabase, Trigger.dev, @react-pdf/renderer, sharp, next-intl, Resend, Polar, @anthropic-ai/sdk
- [x] Supabase 스키마 마이그레이션 파일 작성 (`job_items.status` 포함 — `supabase/migrations/001`, `002`)
- [x] `lib/supabase/client.ts` / `server.ts` / `types.ts` — Supabase 클라이언트 및 DB 타입
- [x] `lib/plans.ts` — 플랜별 한도 + trial 중 프로 한도 적용 로직
- [x] `lib/i18n.ts` + `messages/ko.json` / `ja.json` — next-intl 설정 및 ko/ja 번역
- [x] `middleware.ts` — 인증 보호 라우트 처리
- [x] `app/api/jobs/` — 잡 생성(한도 체크 포함) + 목록 조회
- [x] `app/api/images/upload/` — presigned URL 발급
- [x] `app/api/jobs/[jobId]/process/` — Trigger.dev task 발행 → 즉시 202
- [x] `app/api/webhooks/polar/` — 구독 생성 시 `trial_ends_at = now()+30d` 저장
- [x] `trigger/process-image.ts` — Claude Vision API 분석 + DB 업데이트 (concurrencyLimit: 3)
- [x] `trigger/generate-pdf.ts` — PDF 생성 + Resend 이메일 알림
- [x] `lib/pdf/components/ReportDocument.tsx` — @react-pdf/renderer + Noto Sans KR/JP
- [x] `next.config.ts` — next-intl + sharp/react-pdf serverComponentsExternalPackages
- [x] `.env.local.example` — 환경변수 템플릿
- [x] `lib/ml/claude-detector.ts` — Claude Vision API 호출 독립 모듈 + JSON 파싱 강화
- [x] `lib/ml/image-annotator.ts` — `@napi-rs/canvas` bbox 어노테이션 이미지 생성
- [x] `trigger/process-image.ts` — claude-detector + image-annotator 모듈 사용하도록 리팩터
- [x] **Auth UI** — 로그인/회원가입 화면 + Google OAuth + `/auth/callback` (`app/(auth)/`)
- [x] **업로드 UI** — 드래그앤드롭 + XHR 파일별 진행률 + 한도 초과 에러 처리 (`app/(dashboard)/upload/`)
- [x] **잡 목록** — Supabase Realtime 상태 구독 (`app/(dashboard)/jobs/`)
- [x] **잡 상세** — 이미지별 검출 결과 + PDF 다운로드 (`app/(dashboard)/jobs/[jobId]/`)
- [x] **대시보드 레이아웃** — 공통 헤더 + 인증 guard (`app/(dashboard)/layout.tsx`)
- [x] **결제 페이지** — 플랜 현황 + trial 만료일 + Polar checkout 연동 (`app/(dashboard)/billing/`)
- [x] `vercel.json` — `sharp` linux-x64 빌드 명령, API maxDuration 설정, 환경변수 참조
- [x] **랜딩 페이지** — Hero + 워크플로우 + 기능 소개 + 요금제 테이블 (`app/page.tsx`)
- [x] **마케팅 레이아웃** — 공통 헤더/푸터 (`app/(marketing)/layout.tsx`)
- [x] **trigger.config.ts Project Ref 설정** — Trigger.dev 대시보드에서 복사
- [x] **TRIGGER_SECRET_KEY 환경변수 설정** — `.env.local` 입력 완료
- [x] **`npm run trigger:deploy`** — Trigger.dev task 프로덕션 배포
- [x] **Supabase 마이그레이션 실제 적용** — SQL Editor에서 001~003 순서대로 실행
- [x] **Supabase Storage 버킷 생성** (`crack-images`, Public OFF) + Storage RLS 정책
- [x] **Supabase Realtime 활성화** — `analysis_jobs`, `analysis_images` 테이블
- [ ] **Resend API Key 설정** + `crackscan.io` 도메인 DNS 인증
- [ ] **Polar 상품 3개 생성** (Starter/Pro/Business) + Product ID 환경변수 등록
- [ ] **Polar Access Token + Webhook Secret** 환경변수 등록
- [ ] **Vercel 환경변수 전체 입력** + `git push` 배포
- [ ] **배포 후** `NEXT_PUBLIC_APP_URL` 실제 URL로 업데이트 + Polar Webhook URL 등록

### Phase 2 — 제품화 (7~12주): 유료 고객 10개 목표
- [ ] 3단계 요금제 전체 + `usage` 테이블 기반 한도 적용
- [ ] Supabase Realtime 잡 상태 알림 (워커의 `job_items` DB 업데이트 감지 기반, 폴링 제거)
- [ ] 드래그앤드롭 업로드 + 파일별 진행률 표시
- [ ] Resend 완료 이메일 발송 (알림 전용, 대시보드 링크)
- [ ] 한국어 랜딩 페이지 + 가격 페이지
- [ ] 잡 이력 대시보드 + 월별 사용량 바

### Phase 3 — 스케일 (13~20주): ₩5M MRR 목표
- [ ] Modal.com + YOLOv8-crack-seg 픽셀 세그먼테이션 연동
- [ ] Claude(텍스트 설명) + YOLOv8(검출) 하이브리드 파이프라인
- [ ] Enterprise API 액세스 티어
- [ ] 화이트라벨 보고서 (고객사 로고 삽입)
- [ ] 건물별 검사 이력 관리 (날짜별 균열 비교)
- [ ] 관리자 대시보드 (사용자 관리, 매출 현황)

### Phase 4 — Enterprise (6개월+): 1억 KRW/년 달성
- [ ] 멀티유저 팀 워크스페이스
- [ ] 모바일 앱 (React Native) — 현장 촬영 즉시 분석
- [ ] 공공기관 컴플라이언스 기능 (건축법 기준 참조)
- [ ] CAD/BIM 툴 연동

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
POLAR_ACCESS_TOKEN
POLAR_WEBHOOK_SECRET
NEXT_PUBLIC_POLAR_PRODUCT_ID_STARTER
NEXT_PUBLIC_POLAR_PRODUCT_ID_PRO
NEXT_PUBLIC_POLAR_PRODUCT_ID_BUSINESS
RESEND_API_KEY
TRIGGER_SECRET_KEY
MODAL_TOKEN_ID           # V2
MODAL_TOKEN_SECRET       # V2
MODAL_CRACK_DETECTOR_URL # V2
```
