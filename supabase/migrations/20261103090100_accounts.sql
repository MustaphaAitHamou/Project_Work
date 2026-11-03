-- =============================================================================
-- Accounts: users (mirror of auth.users), admin roles, candidate profiles,
-- experiences, education, versioned resumes.
-- =============================================================================

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  account_type public.account_type not null,
  email text not null,
  first_name text not null default '' check (char_length(first_name) <= 100),
  last_name text not null default '' check (char_length(last_name) <= 100),
  locale text not null default 'fr' check (locale in ('fr', 'en', 'es', 'ar')),
  status public.user_status not null default 'active',
  suspended_reason text,
  notify_application_updates boolean not null default true,
  notify_job_alerts boolean not null default true,
  notify_billing boolean not null default true,
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.users is 'Application-level user record (1:1 with auth.users). account_type is fixed at sign-up and never user-editable.';
create index users_account_type_idx on public.users (account_type, created_at);
create index users_email_idx on public.users (lower(email));
create trigger users_touch before update on public.users for each row execute function app.touch_updated_at();

create table public.admin_roles (
  user_id uuid not null references public.users (id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid references public.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
comment on table public.admin_roles is 'Back-office roles. Granted only by a super_admin (or by the bootstrap script for the first super_admin).';

-- -----------------------------------------------------------------------------
-- Candidate profile
-- -----------------------------------------------------------------------------
create table public.candidate_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  headline text check (char_length(headline) <= 150),
  summary text check (char_length(summary) <= 3000),
  country_code char(2) references public.countries (code),
  region_code text,
  city text check (char_length(city) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ().-]{6,25}$'),
  skills text[] not null default '{}' check (cardinality(skills) <= 50),
  languages jsonb not null default '[]' check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) <= 15),
  desired_contract_types public.contract_type[] not null default '{}',
  desired_work_time public.work_time[] not null default '{}',
  remote_preference public.remote_preference not null default 'any',
  willing_to_relocate boolean not null default false,
  mobility_countries char(2)[] not null default '{}' check (cardinality(mobility_countries) <= 20),
  years_of_experience smallint check (years_of_experience between 0 and 60),
  transmission_consent_at timestamptz,
  transmission_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.candidate_profiles is 'Professional profile. Never exposed to employers directly: a snapshot is transmitted with each application.';
comment on column public.candidate_profiles.transmission_consent_at is 'When the candidate acknowledged which data is transmitted to recruiters (shown before the first one-click application).';
create index candidate_profiles_skills_idx on public.candidate_profiles using gin (skills);
create trigger candidate_profiles_touch before update on public.candidate_profiles for each row execute function app.touch_updated_at();

create table public.candidate_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 150),
  company_name text check (char_length(company_name) <= 150),
  location text check (char_length(location) <= 150),
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (not (is_current and end_date is not null))
);
create index candidate_experiences_user_idx on public.candidate_experiences (user_id, start_date desc);
create trigger candidate_experiences_touch before update on public.candidate_experiences for each row execute function app.touch_updated_at();

create table public.candidate_educations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.candidate_profiles (user_id) on delete cascade,
  degree text not null check (char_length(degree) between 1 and 150),
  school text check (char_length(school) <= 150),
  field_of_study text check (char_length(field_of_study) <= 150),
  start_date date,
  end_date date,
  description text check (char_length(description) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index candidate_educations_user_idx on public.candidate_educations (user_id, end_date desc nulls first);
create trigger candidate_educations_touch before update on public.candidate_educations for each row execute function app.touch_updated_at();

-- Guard against unbounded inserts through the Data API.
create or replace function app.enforce_row_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := tg_argv[0]::integer;
  v_count integer;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into v_count using new.user_id;
  if v_count >= v_limit then
    raise exception 'quota_exceeded' using errcode = 'P0001', detail = tg_table_name;
  end if;
  return new;
end;
$$;

create trigger candidate_experiences_quota before insert on public.candidate_experiences
  for each row execute function app.enforce_row_quota('30');
create trigger candidate_educations_quota before insert on public.candidate_educations
  for each row execute function app.enforce_row_quota('20');

-- -----------------------------------------------------------------------------
-- Resumes (logical documents) and immutable versions (files)
-- -----------------------------------------------------------------------------
create table public.candidate_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null default 'CV' check (char_length(label) between 1 and 100),
  is_primary boolean not null default false,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
comment on table public.candidate_resumes is 'A candidate CV. Replacing the file creates a new immutable version; versions sent with applications are kept per the retention policy.';
create unique index candidate_resumes_one_primary on public.candidate_resumes (user_id) where is_primary and deleted_at is null;
create index candidate_resumes_user_idx on public.candidate_resumes (user_id) where deleted_at is null;
create trigger candidate_resumes_touch before update on public.candidate_resumes for each row execute function app.touch_updated_at();

create table public.candidate_resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.candidate_resumes (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  scan_status public.resume_scan_status not null default 'pending',
  scan_details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  file_deleted_at timestamptz
);
comment on column public.candidate_resume_versions.file_deleted_at is 'Set when the stored file has been purged (metadata kept for audit).';
create index candidate_resume_versions_resume_idx on public.candidate_resume_versions (resume_id, created_at desc);
create index candidate_resume_versions_user_idx on public.candidate_resume_versions (user_id);

alter table public.candidate_resumes
  add constraint candidate_resumes_current_version_fk
  foreign key (current_version_id) references public.candidate_resume_versions (id)
  on delete set null deferrable initially deferred;

create trigger candidate_resumes_quota before insert on public.candidate_resumes
  for each row execute function app.enforce_row_quota('10');

-- -----------------------------------------------------------------------------
-- auth.users integration
-- -----------------------------------------------------------------------------
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type public.account_type;
  v_locale text := coalesce(nullif(v_meta ->> 'locale', ''), 'fr');
begin
  -- Only two self-service account types exist. Admin rights are never derived from metadata.
  v_type := case v_meta ->> 'account_type' when 'employer' then 'employer'::public.account_type else 'candidate'::public.account_type end;
  if v_locale not in ('fr', 'en', 'es', 'ar') then
    v_locale := 'fr';
  end if;

  insert into public.users (id, account_type, email, first_name, last_name, locale, terms_accepted_at, terms_version)
  values (
    new.id,
    v_type,
    coalesce(new.email, ''),
    left(btrim(coalesce(v_meta ->> 'first_name', '')), 100),
    left(btrim(coalesce(v_meta ->> 'last_name', '')), 100),
    v_locale,
    case when (v_meta ->> 'terms_accepted') = 'true' then now() end,
    left(v_meta ->> 'terms_version', 40)
  );

  if v_type = 'candidate' then
    insert into public.candidate_profiles (user_id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

create or replace function app.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function app.sync_auth_user_email();
