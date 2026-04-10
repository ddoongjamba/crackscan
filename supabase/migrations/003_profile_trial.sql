-- ============================================================
-- 003_profile_trial.sql
-- trial_ends_at을 subscriptions가 아닌 profiles에서 관리.
-- 회원가입 즉시 30일 무료 체험 부여 (카드 불필요).
-- ============================================================

-- profiles에 trial_ends_at 컬럼 추가
alter table public.profiles
  add column if not exists trial_ends_at timestamptz;

-- handle_new_user: 가입 시 trial_ends_at = now() + 30일 자동 설정
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, locale, trial_ends_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'locale', 'ko'),
    now() + interval '30 days'
  );
  return new;
end;
$$;
