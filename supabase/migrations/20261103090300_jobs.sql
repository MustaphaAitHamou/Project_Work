-- =============================================================================
-- Jobs, locations, moderation terms, saved jobs, job alerts.
-- =============================================================================

create table public.moderation_terms (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  category text not null check (category in ('discrimination', 'external_redirect', 'scam', 'other')),
  language text check (language in ('fr', 'en', 'es', 'ar')),
  pattern text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.moderation_terms is 'Administrable patterns (POSIX regex applied to accent-insensitive lower-case text) that send a job advert to human moderation. Nothing is rejected automatically.';

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default app.generate_public_id(10),
  slug text not null default 'job',
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(title) between 3 and 150),
  description text not null check (char_length(description) between 1 and 15000),
  missions text check (char_length(missions) <= 8000),
  profile_sought text check (char_length(profile_sought) <= 8000),
  required_skills text[] not null default '{}' check (cardinality(required_skills) <= 30),
  optional_skills text[] not null default '{}' check (cardinality(optional_skills) <= 30),
  contract_type public.contract_type not null,
  work_time public.work_time not null default 'full_time',
  work_mode public.work_mode not null default 'onsite',
  remote_scope public.remote_scope,
  remote_countries char(2)[] not null default '{}' check (cardinality(remote_countries) <= 60),
  salary_min numeric(12, 2) check (salary_min >= 0),
  salary_max numeric(12, 2) check (salary_max >= 0),
  salary_currency char(3) references public.currencies (code),
  salary_period public.salary_period,
  salary_min_annual numeric(14, 2),
  salary_max_annual numeric(14, 2),
  benefits text check (char_length(benefits) <= 3000),
  experience_level public.experience_level not null,
  industry text references public.industries (code),
  working_languages text[] not null default '{}' check (cardinality(working_languages) <= 10),
  work_authorization public.work_authorization not null default 'not_specified',
  eligibility_notes text check (char_length(eligibility_notes) <= 1000),
  start_date date,
  application_deadline date,
  positions_count smallint check (positions_count between 1 and 999),
  status public.job_status not null default 'draft',
  moderation_flags text[] not null default '{}',
  moderation_approved_hash text,
  rejection_reason text check (char_length(rejection_reason) <= 1000),
  suspension_reason text check (suspension_reason in ('payment_failed', 'moderation', 'company_suspended', 'admin')),
  published_at timestamptz,
  closed_at timestamptz,
  expired_at timestamptz,
  suspended_at timestamptz,
  paid_through timestamptz,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_max is null or salary_min is null or salary_max >= salary_min),
  check ((salary_min is null and salary_max is null) or (salary_currency is not null and salary_period is not null)),
  check (work_mode = 'onsite' or remote_scope is not null or status = 'draft')
);
comment on table public.jobs is 'Job adverts. Base table is private (company members/admins); visible adverts are exposed through public.public_jobs and public.search_jobs().';
comment on column public.jobs.remote_scope is 'employer_country: remote only from the job country; listed_countries: from remote_countries; worldwide: anywhere, subject to legal employment conditions.';
comment on column public.jobs.moderation_flags is 'Automated pre-publication checks. Flags send the advert to human review; they never reject automatically.';
comment on column public.jobs.paid_through is 'End of the current paid subscription period.';

create index jobs_company_idx on public.jobs (company_id, status, updated_at desc);
create index jobs_active_published_idx on public.jobs (published_at desc) where status = 'active';
create index jobs_status_idx on public.jobs (status, updated_at desc);
create index jobs_search_idx on public.jobs using gin (search_vector);
create index jobs_title_trgm on public.jobs using gin (app.normalize_text(title) extensions.gin_trgm_ops);
create index jobs_remote_countries_idx on public.jobs using gin (remote_countries);
create index jobs_required_skills_idx on public.jobs using gin (required_skills);

create table public.job_locations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  country_code char(2) not null references public.countries (code),
  region_code text,
  city text not null check (char_length(city) between 1 and 120),
  city_id integer references public.geo_cities (id) on delete set null,
  postal_code text check (char_length(postal_code) <= 20),
  address_line text check (char_length(address_line) <= 200),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.job_locations is 'Job locations. V1 uses exactly one primary location per job; the table supports several.';
create unique index job_locations_one_primary on public.job_locations (job_id) where is_primary;
create index job_locations_geo_idx on public.job_locations (country_code, region_code);
create index job_locations_city_idx on public.job_locations (country_code, (app.normalize_text(city)));
create index job_locations_latlng_idx on public.job_locations (latitude, longitude);
create trigger job_locations_touch before update on public.job_locations for each row execute function app.touch_updated_at();

create table public.saved_jobs (
  user_id uuid not null references public.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  criteria jsonb not null default '{}' check (jsonb_typeof(criteria) = 'object'),
  email_enabled boolean not null default true,
  frequency public.alert_frequency not null default 'daily',
  last_run_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.job_alerts is 'Saved searches. When email_enabled, new matching adverts are sent as a digest.';
create index job_alerts_user_idx on public.job_alerts (user_id);
create index job_alerts_due_idx on public.job_alerts (frequency, last_run_at) where email_enabled;
create trigger job_alerts_touch before update on public.job_alerts for each row execute function app.touch_updated_at();
create trigger job_alerts_quota before insert on public.job_alerts for each row execute function app.enforce_row_quota('20');
create trigger saved_jobs_quota before insert on public.saved_jobs for each row execute function app.enforce_row_quota('500');

-- -----------------------------------------------------------------------------
-- Job helper functions & triggers
-- -----------------------------------------------------------------------------
create or replace function app.ts_config_for_language(p_lang text)
returns regconfig
language sql immutable parallel safe
set search_path = ''
as $$
  select case p_lang
    when 'fr' then 'pg_catalog.french'::regconfig
    when 'en' then 'pg_catalog.english'::regconfig
    when 'es' then 'pg_catalog.spanish'::regconfig
    else 'pg_catalog.simple'::regconfig
  end
$$;

create or replace function app.annualize_salary(p_amount numeric, p_period public.salary_period)
returns numeric
language sql immutable parallel safe
set search_path = ''
as $$
  select case
    when p_amount is null or p_period is null then null
    when p_period = 'year' then p_amount
    when p_period = 'month' then p_amount * 12
    when p_period = 'day' then p_amount * 220   -- documented approximation (working days / year)
    when p_period = 'hour' then p_amount * 1607 -- documented approximation (35h week, FR legal annual duration)
  end
$$;

create or replace function app.job_content_hash(p_job public.jobs)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select md5(concat_ws('|',
    p_job.title, p_job.description, p_job.missions, p_job.profile_sought, p_job.benefits,
    p_job.eligibility_notes, array_to_string(p_job.required_skills, ','), array_to_string(p_job.optional_skills, ',')))
$$;

-- Returns distinct flag codes found in free text.
create or replace function app.moderation_scan(p_text text)
returns text[]
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_norm text := app.normalize_text(p_text);
  v_flags text[] := '{}';
  r record;
begin
  if v_norm = '' then
    return v_flags;
  end if;
  for r in select code, pattern from public.moderation_terms where is_active loop
    begin
      if v_norm ~* r.pattern then
        v_flags := array_append(v_flags, r.code);
      end if;
    exception when invalid_regular_expression then
      -- An invalid admin pattern must never block publication silently; it is ignored and logged.
      raise warning 'invalid moderation pattern %', r.code;
    end;
  end loop;
  -- Built-in checks: direct contact details or redirection outside the platform.
  if v_norm ~* '(https?://|www\.)[a-z0-9.-]+' then
    v_flags := array_append(v_flags, 'external_link');
  end if;
  if v_norm ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    v_flags := array_append(v_flags, 'contact_email');
  end if;
  if v_norm ~* '(\+|00)[0-9][0-9 .-]{7,}[0-9]' or v_norm ~* '(^|[^0-9])0[1-9]([ .-]?[0-9]{2}){4}([^0-9]|$)' then
    v_flags := array_append(v_flags, 'contact_phone');
  end if;
  return array(select distinct unnest(v_flags) order by 1);
end;
$$;

create or replace function app.moderation_scan_job(p_job public.jobs)
returns text[]
language sql stable
security definer
set search_path = ''
as $$
  select app.moderation_scan(concat_ws(E'\n',
    p_job.title, p_job.description, p_job.missions, p_job.profile_sought, p_job.benefits, p_job.eligibility_notes,
    array_to_string(p_job.required_skills, ', '), array_to_string(p_job.optional_skills, ', ')))
$$;

create or replace function app.jobs_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg regconfig;
  v_skills text;
  v_body text;
  v_content_changed boolean;
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'company_id_immutable' using errcode = 'P0001';
    end if;
    if new.public_id is distinct from old.public_id then
      raise exception 'public_id_immutable' using errcode = 'P0001';
    end if;
  end if;

  new.title := btrim(new.title);
  new.slug := app.slugify(new.title, 80);
  new.salary_min_annual := app.annualize_salary(new.salary_min, new.salary_period);
  new.salary_max_annual := app.annualize_salary(new.salary_max, new.salary_period);
  if new.work_mode = 'onsite' then
    new.remote_scope := null;
    new.remote_countries := '{}';
  elsif new.remote_scope is distinct from 'listed_countries' then
    new.remote_countries := '{}';
  end if;
  new.required_skills := array(select distinct btrim(s) from unnest(new.required_skills) s where btrim(s) <> '');
  new.optional_skills := array(select distinct btrim(s) from unnest(new.optional_skills) s where btrim(s) <> '');

  v_cfg := app.ts_config_for_language(coalesce(new.working_languages[1], 'fr'));
  v_skills := app.normalize_text(array_to_string(new.required_skills || new.optional_skills, ' '));
  v_body := app.normalize_text(concat_ws(' ', new.missions, new.profile_sought, new.description));
  new.search_vector :=
      setweight(to_tsvector('pg_catalog.simple', app.normalize_text(new.title)), 'A')
   || setweight(to_tsvector(v_cfg, app.normalize_text(new.title)), 'A')
   || setweight(to_tsvector('pg_catalog.simple', v_skills), 'B')
   || setweight(to_tsvector(v_cfg, v_skills), 'B')
   || setweight(to_tsvector(v_cfg, left(v_body, 60000)), 'C');

  -- Re-run automated checks whenever content changes on a submitted/live advert.
  v_content_changed := tg_op = 'INSERT' or app.job_content_hash(new) is distinct from app.job_content_hash(old);
  if v_content_changed then
    new.moderation_flags := app.moderation_scan_job(new);
    if tg_op = 'UPDATE'
       and new.status in ('active', 'pending_payment')
       and cardinality(new.moderation_flags) > 0
       and app.job_content_hash(new) is distinct from new.moderation_approved_hash then
      new.status := 'in_review';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_before_write before insert or update on public.jobs
  for each row execute function app.jobs_before_write();
create trigger jobs_touch before update on public.jobs for each row execute function app.touch_updated_at();

create or replace function app.job_locations_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_city record;
begin
  select company_id into new.company_id from public.jobs where id = new.job_id;
  if new.company_id is null then
    raise exception 'job_not_found' using errcode = 'P0001';
  end if;
  new.city := btrim(new.city);
  if new.city_id is not null then
    select country_code, region_code, latitude, longitude into v_city from public.geo_cities where id = new.city_id;
    if found and v_city.country_code = new.country_code then
      new.latitude := v_city.latitude;
      new.longitude := v_city.longitude;
      new.region_code := coalesce(new.region_code, v_city.region_code);
    else
      new.city_id := null;
    end if;
  end if;
  if new.region_code is not null and not exists (
    select 1 from public.geo_regions where country_code = new.country_code and code = new.region_code
  ) then
    new.region_code := null;
  end if;
  return new;
end;
$$;

create trigger job_locations_before_write before insert or update on public.job_locations
  for each row execute function app.job_locations_before_write();
