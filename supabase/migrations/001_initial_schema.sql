-- ============================================================
-- 001_initial_schema.sql
-- CrackScan 초기 스키마
-- ============================================================

-- ── profiles ──────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  full_name    text,
  locale       text not null default 'ko' check (locale in ('ko', 'ja')),
  plan         text not null default 'free'
               check (plan in ('free', 'starter', 'professional', 'business')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: 본인만 조회" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: 본인만 수정" on public.profiles
  for update using (auth.uid() = id);

-- 신규 회원가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, locale)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'locale', 'ko')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── subscriptions ─────────────────────────────────────────
create table public.subscriptions (
  id                  text primary key,          -- Polar subscription ID
  user_id             uuid not null references public.profiles(id) on delete cascade,
  plan                text not null,
  status              text not null,             -- active / canceled / past_due
  polar_product_id    text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  trial_ends_at       timestamptz,               -- 30일 무료 trial 종료 시각
  canceled_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions: 본인만 조회" on public.subscriptions
  for select using (auth.uid() = user_id);


-- ── usage ─────────────────────────────────────────────────
create table public.usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  period      text not null,                     -- 'YYYY-MM'
  job_count   int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, period)
);

alter table public.usage enable row level security;

create policy "usage: 본인만 조회" on public.usage
  for select using (auth.uid() = user_id);


-- ── analysis_jobs ─────────────────────────────────────────
create table public.analysis_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending', 'processing', 'completed', 'failed')),
  image_count      int not null default 0,
  completed_count  int not null default 0,
  severity_summary jsonb,                        -- {safe: n, low: n, medium: n, critical: n}
  location_label   text,                         -- 건물명 등 사용자 입력
  locale           text not null default 'ko',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.analysis_jobs enable row level security;

create policy "analysis_jobs: 본인만 조회" on public.analysis_jobs
  for select using (auth.uid() = user_id);

create policy "analysis_jobs: 본인만 생성" on public.analysis_jobs
  for insert with check (auth.uid() = user_id);

create index analysis_jobs_user_id_created_at on public.analysis_jobs (user_id, created_at desc);


-- ── analysis_images ───────────────────────────────────────
create table public.analysis_images (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.analysis_jobs(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  storage_path     text not null,                -- Supabase Storage 원본 경로
  file_name        text not null,
  status           text not null default 'pending'
                   check (status in ('pending', 'processing', 'completed', 'failed')),
  crack_detections jsonb,                        -- [{bbox, confidence, severity, description}]
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.analysis_images enable row level security;

create policy "analysis_images: 본인만 조회" on public.analysis_images
  for select using (auth.uid() = user_id);

create policy "analysis_images: 본인만 생성" on public.analysis_images
  for insert with check (auth.uid() = user_id);

create index analysis_images_job_id on public.analysis_images (job_id);


-- ── reports ───────────────────────────────────────────────
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null unique references public.analysis_jobs(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,                    -- jobs/{user_id}/{job_id}/report.pdf
  created_at   timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports: 본인만 조회" on public.reports
  for select using (auth.uid() = user_id);


-- ── updated_at 자동 갱신 ──────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.usage
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.analysis_jobs
  for each row execute procedure public.set_updated_at();
create trigger set_updated_at before update on public.analysis_images
  for each row execute procedure public.set_updated_at();
