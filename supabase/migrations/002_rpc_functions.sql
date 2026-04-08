-- ============================================================
-- 002_rpc_functions.sql
-- API Route / Trigger.dev 워커에서 호출하는 RPC 함수
-- ============================================================

-- 월별 usage 증가 (upsert)
create or replace function public.increment_usage(p_user_id uuid, p_period text)
returns void language plpgsql security definer as $$
begin
  insert into public.usage (user_id, period, job_count)
  values (p_user_id, p_period, 1)
  on conflict (user_id, period)
  do update set job_count = public.usage.job_count + 1,
                updated_at = now();
end;
$$;

-- 잡의 completed_count 원자적 증가
create or replace function public.increment_job_completed_count(p_job_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.analysis_jobs
  set completed_count = completed_count + 1,
      updated_at = now()
  where id = p_job_id;
end;
$$;
