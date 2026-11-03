-- =============================================================================
-- Applications and status history.
-- =============================================================================

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  candidate_id uuid references public.users (id) on delete set null,
  resume_version_id uuid references public.candidate_resume_versions (id) on delete set null,
  status public.application_status not null default 'submitted',
  candidate_snapshot jsonb not null check (jsonb_typeof(candidate_snapshot) = 'object'),
  job_title text not null default '',
  company_name text not null default '',
  consent_version text not null,
  recruiter_rating smallint check (recruiter_rating between 1 and 5),
  is_archived boolean not null default false,
  first_viewed_at timestamptz,
  resume_first_downloaded_at timestamptz,
  status_changed_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);
comment on table public.applications is 'One-click applications. Created only through public.apply_to_job(). The snapshot is the data transmitted to the recruiter.';
comment on column public.applications.first_viewed_at is 'Set only when an authorised recruiter actually opens the application.';
create index applications_candidate_idx on public.applications (candidate_id, created_at desc);
create index applications_job_idx on public.applications (job_id, created_at desc);
create index applications_company_idx on public.applications (company_id, status, created_at desc);
create index applications_resume_version_idx on public.applications (resume_version_id);
create trigger applications_touch before update on public.applications for each row execute function app.touch_updated_at();

create table public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  changed_by uuid references public.users (id) on delete set null,
  actor text not null check (actor in ('candidate', 'recruiter', 'system', 'admin')),
  created_at timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id, created_at);
