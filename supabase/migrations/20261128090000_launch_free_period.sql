-- =============================================================================
-- Launch offer: publishing is FREE for every company until 31 December 2026 at
-- 23:59:59 (Europe/Paris). One common end date, not an individual trial. From
-- 1 January 2027 00:00 (Paris), a new advert needs a Stripe subscription (5.95 EUR
-- excl. VAT per month), as before.
--
-- * The end instant is a platform setting (exclusive bound), read by every check:
--   2027-01-01 00:00 Paris = 2026-12-31 23:00 UTC (Paris is UTC+1 in winter).
--   Tests move it to simulate the clock; the server clock is never changed.
-- * An advert published for free carries jobs.free_until. It stops being public,
--   searchable and open to applications AT that instant (every public read path and
--   apply_to_job compare it with now()), even if the scheduled maintenance runs late.
-- * The maintenance then records the clear state 'suspended' / 'free_period_ended'
--   (idempotent, protected against concurrent runs) and e-mails the company. Nothing is
--   deleted: the recruiter keeps the advert and its applications in the private space.
-- * Before the end, an advert can be converted: Stripe Checkout with a trial ending at
--   the end of the free period (no charge before 1 January 2027, explicit consent at
--   checkout). After the end, a suspended advert is reactivated by a normal subscription.
-- * Compliance (country checklist), company verification and moderation still apply.
-- =============================================================================

insert into public.platform_settings (key, value, is_public, description) values
  ('billing.free_publication_until', '"2027-01-01T00:00:00+01:00"', true,
   'Fin (exclue) de l''offre de lancement : publication gratuite jusqu''au 31/12/2026 23:59:59, heure de Paris. Ensuite, 5,95 EUR HT par mois et par annonce.')
on conflict (key) do nothing;

create or replace function app.free_publication_until()
returns timestamptz
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_raw text;
begin
  select value #>> '{}' into v_raw from public.platform_settings where key = 'billing.free_publication_until';
  return coalesce(v_raw::timestamptz, timestamptz '2027-01-01 00:00:00+01');
exception when others then
  -- Unreadable value (admin_update_setting validates it; this is a last safety net).
  return timestamptz '2027-01-01 00:00:00+01';
end;
$$;

-- Pure helper (explicit instant): used by tests with exact boundary instants.
create or replace function app.free_publication_open_at(p_at timestamptz)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_at < app.free_publication_until()
$$;

-- What the public pages display (banner, pricing).
create or replace function public.launch_offer()
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('free_until', app.free_publication_until(), 'open', now() < app.free_publication_until())
$$;
grant execute on function public.launch_offer() to anon, authenticated;

alter table public.jobs add column free_until timestamptz;
comment on column public.jobs.free_until is 'Launch offer: the advert is online without subscription until this instant (exclusive). Null when a subscription covers it.';
alter table public.jobs drop constraint if exists jobs_suspension_reason_check;
alter table public.jobs add constraint jobs_suspension_reason_check
  check (suspension_reason in ('payment_failed', 'moderation', 'company_suspended', 'admin', 'free_period_ended'));
create index jobs_free_until_idx on public.jobs (free_until) where status = 'active' and free_until is not null;

-- Public views: a free advert past its end is no longer live.
create or replace view public.public_companies with (security_barrier = true) as
select
  c.id,
  c.slug,
  coalesce(c.display_name, c.legal_name) as name,
  c.registration_country as country_code,
  c.hq_city,
  c.industry,
  c.website,
  c.description,
  c.logo_path,
  c.size_range,
  c.verified_at,
  (select count(*) from public.jobs j where j.company_id = c.id and (j.status = 'active' and (j.free_until is null or j.free_until > now()))) as active_jobs_count
from public.companies c
where c.verification_status = 'verified' and c.suspended_at is null;

create or replace view public.public_jobs with (security_barrier = true) as
select
  j.id, j.public_id, j.slug, j.title, j.description, j.missions, j.profile_sought,
  j.required_skills, j.optional_skills, j.contract_type, j.work_time, j.work_mode, j.remote_scope,
  j.remote_countries, j.salary_min, j.salary_max, j.salary_currency, j.salary_period, j.benefits,
  j.experience_level, coalesce(j.industry, c.industry) as industry, j.working_languages, j.work_authorization,
  j.eligibility_notes, j.start_date, j.application_deadline, j.positions_count,
  ((j.status = 'active' and (j.free_until is null or j.free_until > now())) and (j.application_deadline is null or j.application_deadline >= current_date)) as is_open,
  j.status, j.published_at, j.closed_at, j.expired_at, j.updated_at, j.paid_through,
  l.country_code, l.region_code, l.city, l.postal_code, l.address_line, l.latitude, l.longitude,
  c.id as company_id, c.slug as company_slug, coalesce(c.display_name, c.legal_name) as company_name,
  c.logo_path as company_logo_path, c.website as company_website,
  j.free_until
from public.jobs j
join public.job_locations l on l.job_id = j.id and l.is_primary
join public.companies c on c.id = j.company_id
where j.published_at is not null
  and c.verification_status = 'verified'
  and c.suspended_at is null
  and (
    (j.status = 'active' and (j.free_until is null or j.free_until > now()))
    or (j.status in ('closed', 'expired') and coalesce(j.closed_at, j.expired_at, j.updated_at) > now() - interval '90 days')
  );


create or replace function app.job_is_public(p_job_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j join public.companies c on c.id = j.company_id
    where j.id = p_job_id and (j.status = 'active' and (j.free_until is null or j.free_until > now()))
      and c.verification_status = 'verified' and c.suspended_at is null
  )
$$;

create or replace function public.search_jobs(
  p_q text default null,
  p_lang text default 'fr',
  p_country text default null,
  p_region text default null,
  p_city text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km integer default null,
  p_contract_types public.contract_type[] default null,
  p_work_modes public.work_mode[] default null,
  p_work_time public.work_time default null,
  p_remote_from text default null,
  p_experience_levels public.experience_level[] default null,
  p_salary_min_annual numeric default null,
  p_salary_currency text default null,
  p_posted_within_days integer default null,
  p_industry text default null,
  p_company_slug text default null,
  p_working_language text default null,
  p_published_after timestamptz default null,
  p_exclude_job_id uuid default null,
  p_sort text default 'relevance',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  public_id text,
  slug text,
  title text,
  company_name text,
  company_slug text,
  company_logo_path text,
  country_code char(2),
  region_code text,
  city text,
  contract_type public.contract_type,
  work_time public.work_time,
  work_mode public.work_mode,
  remote_scope public.remote_scope,
  remote_countries char(2)[],
  salary_min numeric,
  salary_max numeric,
  salary_currency char(3),
  salary_period public.salary_period,
  experience_level public.experience_level,
  required_skills text[],
  excerpt text,
  published_at timestamptz,
  rank real,
  distance_km double precision,
  total_count bigint
)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_tsq tsquery := app.build_tsquery(p_q, p_lang);
  v_qnorm text := app.normalize_text(p_q);
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 5000);
  v_radius double precision := least(greatest(coalesce(p_radius_km, 0), 0), 500);
  v_lat_delta double precision;
  v_lng_delta double precision;
begin
  if p_lat is not null and p_lng is not null and v_radius > 0 then
    v_lat_delta := v_radius / 111.0;
    v_lng_delta := v_radius / greatest(111.0 * cos(radians(p_lat)), 1.0);
  end if;

  return query
  with base as (
    select
      j.id, j.public_id, j.slug, j.title,
      coalesce(c.display_name, c.legal_name) as company_name, c.slug as company_slug, c.logo_path as company_logo_path,
      l.country_code, l.region_code, l.city,
      j.contract_type, j.work_time, j.work_mode, j.remote_scope, j.remote_countries,
      j.salary_min, j.salary_max, j.salary_currency, j.salary_period, j.experience_level, j.required_skills,
      left(regexp_replace(j.description, '\s+', ' ', 'g'), 220) as excerpt,
      j.published_at,
      (case
         when v_tsq is null then 0
         else ts_rank_cd(j.search_vector, v_tsq, 32)
              + case when app.normalize_text(j.title) like '%' || v_qnorm || '%' then 0.5 else 0 end
       end)::real as rank,
      case when v_lat_delta is not null then app.haversine_km(p_lat, p_lng, l.latitude, l.longitude) end as distance_km,
      j.salary_min_annual, j.salary_max_annual
    from public.jobs j
    join public.job_locations l on l.job_id = j.id and l.is_primary
    join public.companies c on c.id = j.company_id
    join public.countries co on co.code = l.country_code
    where (j.status = 'active' and (j.free_until is null or j.free_until > now()))
      and co.is_browsable
      and c.verification_status = 'verified'
      and c.suspended_at is null
      and (j.application_deadline is null or j.application_deadline >= current_date)
      and (v_tsq is null
           or j.search_vector @@ v_tsq
           or app.normalize_text(j.title) operator(extensions.%) v_qnorm)
      and (p_country is null or l.country_code = upper(p_country))
      and (p_region is null or l.region_code = p_region)
      and (p_city is null or app.normalize_text(l.city) = app.normalize_text(p_city))
      and (v_lat_delta is null or (
            l.latitude between p_lat - v_lat_delta and p_lat + v_lat_delta
            and l.longitude between p_lng - v_lng_delta and p_lng + v_lng_delta))
      and (p_contract_types is null or cardinality(p_contract_types) = 0 or j.contract_type = any (p_contract_types))
      and (p_work_modes is null or cardinality(p_work_modes) = 0 or j.work_mode = any (p_work_modes))
      and (p_work_time is null or j.work_time = p_work_time)
      and (p_remote_from is null or (
            j.work_mode = 'remote' and (
              j.remote_scope = 'worldwide'
              or (j.remote_scope = 'listed_countries' and upper(p_remote_from)::char(2) = any (j.remote_countries))
              or (j.remote_scope = 'employer_country' and l.country_code = upper(p_remote_from)))))
      and (p_experience_levels is null or cardinality(p_experience_levels) = 0 or j.experience_level = any (p_experience_levels))
      and (p_salary_min_annual is null or (
            j.salary_currency = upper(coalesce(p_salary_currency, j.salary_currency))
            and coalesce(j.salary_max_annual, j.salary_min_annual) >= p_salary_min_annual))
      and (p_salary_currency is null or j.salary_currency = upper(p_salary_currency))
      and (p_posted_within_days is null or j.published_at >= now() - make_interval(days => p_posted_within_days))
      and (p_published_after is null or j.published_at > p_published_after)
      and (p_industry is null or coalesce(j.industry, c.industry) = p_industry)
      and (p_company_slug is null or c.slug = p_company_slug)
      and (p_working_language is null or p_working_language = any (j.working_languages))
      and (p_exclude_job_id is null or j.id <> p_exclude_job_id)
  ),
  filtered as (
    select * from base b where v_lat_delta is null or (b.distance_km is not null and b.distance_km <= v_radius)
  )
  select
    f.id, f.public_id, f.slug, f.title, f.company_name, f.company_slug, f.company_logo_path,
    f.country_code, f.region_code, f.city, f.contract_type, f.work_time, f.work_mode, f.remote_scope,
    f.remote_countries, f.salary_min, f.salary_max, f.salary_currency, f.salary_period, f.experience_level,
    f.required_skills, f.excerpt, f.published_at, f.rank, f.distance_km,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'date' or v_tsq is null then null else f.rank end desc nulls last,
    case when p_sort = 'distance' then f.distance_km end asc nulls last,
    f.published_at desc,
    f.id
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.search_suggestions(p_prefix text, p_limit integer default 8)
returns table (suggestion text, kind text)
language sql stable
security definer
set search_path = ''
as $$
  with q as (select app.normalize_text(p_prefix) as v)
  (
    select distinct on (app.normalize_text(j.title)) j.title, 'title'
    from public.jobs j, q
    where (j.status = 'active' and (j.free_until is null or j.free_until > now())) and char_length(q.v) >= 2
      and app.normalize_text(j.title) like '%' || q.v || '%'
    order by app.normalize_text(j.title)
    limit least(greatest(p_limit, 1), 20)
  )
  union all
  (
    select distinct s, 'skill'
    from public.jobs j, q, unnest(j.required_skills) s
    where (j.status = 'active' and (j.free_until is null or j.free_until > now())) and char_length(q.v) >= 2 and app.normalize_text(s) like q.v || '%'
    limit 5
  )
$$;

create or replace function public.similar_jobs(p_job_id uuid, p_limit integer default 4)
returns table (id uuid, public_id text, slug text, title text, company_name text, city text, country_code char(2), contract_type public.contract_type, work_mode public.work_mode, published_at timestamptz)
language sql stable
security definer
set search_path = ''
as $$
  with ref as (
    select j.id, j.required_skills, j.industry, j.experience_level, l.country_code, j.search_vector,
           j.title
    from public.jobs j join public.job_locations l on l.job_id = j.id and l.is_primary
    where j.id = p_job_id
  )
  select j.id, j.public_id, j.slug, j.title, coalesce(c.display_name, c.legal_name), l.city, l.country_code, j.contract_type, j.work_mode, j.published_at
  from ref, public.jobs j
  join public.job_locations l on l.job_id = j.id and l.is_primary
  join public.companies c on c.id = j.company_id
  where (j.status = 'active' and (j.free_until is null or j.free_until > now())) and j.id <> ref.id
    and c.verification_status = 'verified' and c.suspended_at is null
    and (j.required_skills && ref.required_skills or j.industry = ref.industry
         or extensions.similarity(app.normalize_text(j.title), app.normalize_text(ref.title)) > 0.3)
  order by
    cardinality(array(select unnest(j.required_skills) intersect select unnest(ref.required_skills))) desc,
    (l.country_code = ref.country_code) desc,
    extensions.similarity(app.normalize_text(j.title), app.normalize_text(ref.title)) desc,
    j.published_at desc
  limit least(greatest(p_limit, 1), 12)
$$;

create or replace function public.apply_to_job(p_job_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_user public.users;
  v_job record;
  v_status jsonb;
  v_resume_version uuid;
  v_app_id uuid;
  v_existing uuid;
begin
  -- 1. Authentication and account checks
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_user from public.users where id = v_uid;
  if v_user.id is null or v_user.status <> 'active' then
    raise exception 'account_inactive' using errcode = 'P0001';
  end if;
  if v_user.account_type <> 'candidate' then
    raise exception 'not_candidate' using errcode = 'P0001';
  end if;

  -- Serialise concurrent submissions from the same candidate (double clicks, parallel tabs).
  perform pg_advisory_xact_lock(hashtextextended('apply:' || v_uid::text, 0));

  -- 4. Already applied? (idempotent success)
  select id into v_existing from public.applications where job_id = p_job_id and candidate_id = v_uid;
  if v_existing is not null then
    return jsonb_build_object('result', 'already_applied', 'application_id', v_existing);
  end if;

  -- 3. Job still open (row locked in share mode so it cannot be closed concurrently)
  select j.id, j.company_id, j.status, j.free_until, j.application_deadline, j.title, j.public_id, j.slug,
         c.verification_status, c.suspended_at, coalesce(c.display_name, c.legal_name) as company_name
    into v_job
    from public.jobs j
    join public.companies c on c.id = j.company_id
   where j.id = p_job_id
     for share of j;
  if v_job.id is null
     or v_job.status <> 'active'
     or (v_job.free_until is not null and v_job.free_until <= now())
     or v_job.verification_status <> 'verified'
     or v_job.suspended_at is not null
     or (v_job.application_deadline is not null and v_job.application_deadline < current_date) then
    raise exception 'job_not_open' using errcode = 'P0001';
  end if;

  -- 2. Profile complete and valid CV
  v_status := app.candidate_completeness(v_uid);
  if not (v_status ->> 'complete')::boolean then
    raise exception 'profile_incomplete' using errcode = 'P0001', detail = (v_status -> 'missing')::text;
  end if;
  if not (v_status ->> 'consent_given')::boolean then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  v_resume_version := app.primary_resume_version(v_uid);
  if v_resume_version is null then
    raise exception 'resume_missing' using errcode = 'P0001';
  end if;

  -- Abuse protection (configurable daily quota)
  if not app.rate_limit_hit('apply:' || v_uid::text, app.setting_int('applications.daily_limit', 60), 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  -- 5/6. Atomic insert bound to the exact CV version; the alias is generated by default.
  insert into public.applications (job_id, company_id, candidate_id, resume_version_id, candidate_snapshot, consent_version, job_title, company_name)
  values (p_job_id, v_job.company_id, v_uid, v_resume_version, app.build_candidate_snapshot(v_uid), v_status ->> 'consent_version',
          v_job.title, v_job.company_name)
  on conflict (job_id, candidate_id) do nothing
  returning id into v_app_id;

  if v_app_id is null then
    select id into v_existing from public.applications where job_id = p_job_id and candidate_id = v_uid;
    return jsonb_build_object('result', 'already_applied', 'application_id', v_existing);
  end if;

  -- Identity kept apart, disclosed only if the candidate accepts a reveal request.
  insert into public.application_identities (application_id, identity) values (v_app_id, app.build_candidate_identity(v_uid));

  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor)
  values (v_app_id, null, 'submitted', v_uid, 'candidate');

  -- 8. Notifications (outbox, same transaction); the recruiter's message carries no personal data.
  perform app.enqueue_email(v_uid, 'application_submitted',
    jsonb_build_object('job_title', v_job.title, 'company_name', v_job.company_name, 'job_path', v_job.slug || '-' || v_job.public_id),
    'application_submitted:' || v_app_id);
  perform app.notify(v_uid, 'application_submitted',
    jsonb_build_object('job_title', v_job.title, 'company_name', v_job.company_name, 'application_id', v_app_id));
  perform app.enqueue_company_email(v_job.company_id, 'new_application',
    jsonb_build_object('job_title', v_job.title, 'job_id', p_job_id, 'application_id', v_app_id),
    'new_application:' || v_app_id, 'application');

  return jsonb_build_object('result', 'created', 'application_id', v_app_id);
end;
$$;

create or replace function public.submit_job(p_job_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_company public.companies;
  v_loc public.job_locations;
  v_errors text[] := '{}';
  v_flags text[];
  v_next public.job_status;
begin
  v_job := app.assert_job_member(p_job_id);
  if v_job.status not in ('draft', 'rejected', 'closed', 'expired') then
    raise exception 'job_not_submittable' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.subscriptions where job_id = p_job_id
             and status in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) then
    raise exception 'job_has_live_subscription' using errcode = 'P0001';
  end if;

  select * into v_company from public.companies where id = v_job.company_id;
  if v_company.verification_status <> 'verified' or v_company.suspended_at is not null then
    raise exception 'company_not_verified' using errcode = 'P0001';
  end if;

  select * into v_loc from public.job_locations where job_id = p_job_id and is_primary;
  if v_loc.id is null then
    v_errors := array_append(v_errors, 'location');
  elsif not exists (select 1 from public.countries where code = v_loc.country_code and is_paid_publishing_enabled and is_browsable) then
    raise exception 'country_not_enabled' using errcode = 'P0001', detail = v_loc.country_code;
  end if;
  if not exists (select 1 from public.countries where code = v_company.registration_country and is_registration_open) then
    raise exception 'country_not_enabled' using errcode = 'P0001', detail = v_company.registration_country;
  end if;

  if char_length(v_job.description) < 80 then v_errors := array_append(v_errors, 'description_too_short'); end if;
  if v_job.work_mode <> 'onsite' and v_job.remote_scope is null then v_errors := array_append(v_errors, 'remote_scope'); end if;
  if v_job.remote_scope = 'listed_countries' and cardinality(v_job.remote_countries) = 0 then v_errors := array_append(v_errors, 'remote_countries'); end if;
  if v_job.application_deadline is not null and v_job.application_deadline < current_date then v_errors := array_append(v_errors, 'deadline_past'); end if;
  if cardinality(v_job.working_languages) = 0 then v_errors := array_append(v_errors, 'working_languages'); end if;
  if cardinality(v_errors) > 0 then
    raise exception 'job_incomplete' using errcode = 'P0001', detail = array_to_string(v_errors, ',');
  end if;

  v_flags := app.moderation_scan_job(v_job);
  if cardinality(v_flags) > 0 and app.job_content_hash(v_job) is distinct from v_job.moderation_approved_hash then
    v_next := 'in_review';
  else
    v_next := 'pending_payment';
  end if;

  -- Launch offer: while the free period runs, a clean advert goes online at once, for free.
  if v_next = 'pending_payment' and now() < app.free_publication_until() then
    v_next := 'active';
  end if;

  update public.jobs set
    status = v_next,
    moderation_flags = v_flags,
    rejection_reason = null,
    closed_at = null,
    expired_at = null,
    suspended_at = null,
    suspension_reason = null,
    published_at = case when v_next = 'active' then coalesce(published_at, now()) else published_at end,
    free_until = case when v_next = 'active' then app.free_publication_until() else null end
  where id = p_job_id;

  return jsonb_build_object('status', v_next, 'flags', to_jsonb(v_flags),
                            'free_until', case when v_next = 'active' then app.free_publication_until() end);
end;
$$;

create or replace function public.reopen_job(p_job_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_sub public.subscriptions;
begin
  v_job := app.assert_job_member(p_job_id);
  if v_job.status <> 'closed' then
    raise exception 'job_not_reopenable' using errcode = 'P0001';
  end if;
  select * into v_sub from public.subscriptions
   where job_id = p_job_id and status in ('active', 'trialing') and current_period_end > now()
   order by created_at desc limit 1;
  -- Without a running subscription, a closed advert can be reopened for free while the
  -- launch offer runs; afterwards it needs a new payment.
  if v_sub.id is null and now() >= app.free_publication_until() then
    raise exception 'reopen_requires_payment' using errcode = 'P0001';
  end if;
  if (v_job.application_deadline is not null and v_job.application_deadline < current_date) then
    raise exception 'deadline_past' using errcode = 'P0001';
  end if;
  update public.jobs set status = 'active', closed_at = null,
         free_until = case when v_sub.id is null then app.free_publication_until() else null end
   where id = p_job_id;
  if v_sub.id is not null then
    update public.subscriptions set cancel_requested_at = null where id = v_sub.id;
  end if;
  return jsonb_build_object('status', 'active', 'resume_subscription_id', v_sub.stripe_subscription_id);
end;
$$;

create or replace function public.admin_moderate_job(p_job_id uuid, p_decision text, p_reason text default null, p_internal_note text default null)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_live boolean;
  v_next public.job_status;
  v_ids text[] := '{}';
begin
  perform app.require_permission('jobs.moderate');
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select exists (select 1 from public.subscriptions where job_id = p_job_id and status in ('active', 'trialing', 'past_due'))
    into v_live;

  if p_decision = 'approve' then
    if v_job.status not in ('in_review', 'rejected') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    v_next := (case when v_live or now() < app.free_publication_until() then 'active' else 'pending_payment' end)::public.job_status;
    update public.jobs set status = v_next, rejection_reason = null,
           moderation_approved_hash = app.job_content_hash(v_job),
           published_at = case when v_next = 'active' then coalesce(published_at, now()) else published_at end,
           free_until = case when v_next = 'active' and not v_live then app.free_publication_until() else null end
     where id = p_job_id;
  elsif p_decision = 'reject' then
    if coalesce(btrim(p_reason), '') = '' then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    if v_job.status in ('draft', 'closed', 'expired') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    v_next := 'rejected';
    update public.jobs set status = 'rejected', rejection_reason = p_reason where id = p_job_id;
    perform app.close_open_applications(p_job_id, 'admin');
    v_ids := app.request_subscription_cancellation(p_job_id);
  elsif p_decision = 'suspend' then
    if v_job.status <> 'active' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    v_next := 'suspended';
    update public.jobs set status = 'suspended', suspended_at = now(), suspension_reason = 'moderation', rejection_reason = p_reason where id = p_job_id;
  elsif p_decision = 'reinstate' then
    if v_job.status <> 'suspended' or v_job.suspension_reason not in ('moderation', 'admin') then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    v_next := (case when v_live or now() < app.free_publication_until() then 'active' else 'pending_payment' end)::public.job_status;
    update public.jobs set status = v_next, suspended_at = null, suspension_reason = null, rejection_reason = null,
           free_until = case when v_next = 'active' and not v_live then app.free_publication_until() else null end
     where id = p_job_id;
  else
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;

  perform app.add_internal_note('job', p_job_id, p_internal_note);
  perform app.audit('job.' || p_decision, 'job', p_job_id::text,
                    jsonb_build_object('previous_status', v_job.status, 'new_status', v_next, 'reason', p_reason));
  perform app.enqueue_company_email(v_job.company_id, 'job_moderation_result',
    jsonb_build_object('decision', p_decision, 'job_title', v_job.title, 'job_id', p_job_id, 'reason', p_reason, 'status', v_next),
    'job_moderation:' || p_job_id || ':' || extract(epoch from now())::bigint);
  return jsonb_build_object('status', v_next, 'cancel_subscription_ids', to_jsonb(v_ids));
end;
$$;

create or replace function public.billing_prepare_checkout(p_actor uuid, p_job_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_company public.companies;
  v_loc public.job_locations;
  v_plan public.pricing_plans;
  v_customer text;
  v_expired text[];
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null or not app.is_member_of(v_job.company_id, p_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Payable: awaiting payment; online for free (conversion before the end of the launch
  -- offer: the subscription starts with a trial ending with it); free period over, whether
  -- the maintenance has already recorded the suspension or not yet.
  if not (v_job.status = 'pending_payment'
          or (v_job.status = 'active' and v_job.free_until is not null)
          or (v_job.status = 'suspended' and v_job.suspension_reason = 'free_period_ended')) then
    raise exception 'job_not_payable' using errcode = 'P0001';
  end if;
  select * into v_company from public.companies where id = v_job.company_id;
  if v_company.verification_status <> 'verified' or v_company.suspended_at is not null then
    raise exception 'company_not_verified' using errcode = 'P0001';
  end if;
  select * into v_loc from public.job_locations where job_id = p_job_id and is_primary;
  if not exists (select 1 from public.countries where code = v_loc.country_code and is_paid_publishing_enabled) then
    raise exception 'country_not_enabled' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.subscriptions where job_id = p_job_id
             and status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')) then
    raise exception 'job_has_live_subscription' using errcode = 'P0001';
  end if;
  if not app.rate_limit_hit('checkout:' || v_company.id::text, 30, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_plan := app.resolve_pricing_plan(v_loc.country_code);
  if v_plan.id is null then
    raise exception 'no_pricing_plan' using errcode = 'P0001';
  end if;

  select stripe_customer_id into v_customer from public.billing_customers where company_id = v_company.id;

  select coalesce(array_agg(stripe_checkout_session_id), '{}') into v_expired
    from public.subscriptions where job_id = p_job_id and status = 'checkout_pending' and stripe_checkout_session_id is not null;
  update public.subscriptions set status = 'checkout_expired' where job_id = p_job_id and status = 'checkout_pending';

  return jsonb_build_object(
    'job', jsonb_build_object('id', v_job.id, 'title', v_job.title, 'public_id', v_job.public_id, 'country_code', v_loc.country_code),
    'company', jsonb_build_object('id', v_company.id, 'name', coalesce(v_company.display_name, v_company.legal_name),
                                  'registration_country', v_company.registration_country),
    'plan', to_jsonb(v_plan),
    'stripe_customer_id', v_customer,
    'sessions_to_expire', to_jsonb(v_expired),
    'trial_until', case when v_job.status = 'active' and v_job.free_until > now() then v_job.free_until end
  );
end;
$$;

create or replace function app.billing_activate_job(p_job_id uuid, p_period_end timestamptz)
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_title text;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then
    return 'missing';
  end if;
  if p_period_end is not null then
    update public.jobs set paid_through = greatest(coalesce(paid_through, p_period_end), p_period_end) where id = p_job_id;
  end if;
  -- A subscription now covers the advert: it no longer depends on the launch offer.
  update public.jobs set free_until = null where id = p_job_id and free_until is not null;
  if v_job.status = 'pending_payment'
     or (v_job.status = 'suspended' and v_job.suspension_reason in ('payment_failed', 'free_period_ended')) then
    update public.jobs set
      status = 'active',
      published_at = coalesce(published_at, now()),
      suspended_at = null,
      suspension_reason = null
    where id = p_job_id;
    v_title := v_job.title;
    perform app.enqueue_company_email(v_job.company_id, 'job_published',
      jsonb_build_object('job_title', v_title, 'job_id', p_job_id, 'job_path', v_job.slug || '-' || v_job.public_id),
      'job_published:' || p_job_id || ':' || coalesce(extract(epoch from p_period_end)::bigint, 0), 'billing');
    return 'activated';
  end if;
  return v_job.status::text;
end;
$$;

create or replace function public.run_maintenance()
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  r record;
  v_cancel text[] := '{}';
  v_resume_purge jsonb := '[]';
  v_doc_purge jsonb := '[]';
  v_suspended integer := 0;
  v_expired integer := 0;
  v_anonymized integer := 0;
  v_retention_months integer := app.setting_int('retention.applications_months', 24);
  v_free_ended integer := 0;
  v_free_reminders integer := 0;
  v_milestone text;
begin
  -- One run at a time: a second, concurrent call returns at once.
  if not pg_try_advisory_xact_lock(hashtext('tamurt_jobs.run_maintenance')) then
    return jsonb_build_object('skipped', 'already_running');
  end if;

  -- 0. Launch offer over: free adverts without subscription are suspended (state kept apart
  -- from payment, moderation and voluntary closing). They already stopped being public at
  -- the exact end instant; this records it, once, and tells the company.
  update public.jobs j set free_until = null
   where j.status = 'active' and j.free_until is not null and j.free_until <= now()
     and exists (select 1 from public.subscriptions s where s.job_id = j.id and s.status in ('active', 'trialing', 'past_due'));
  for r in
    select j.id, j.company_id, j.title from public.jobs j
     where j.status = 'active' and j.free_until is not null and j.free_until <= now()
     for update skip locked
  loop
    update public.jobs set status = 'suspended', suspended_at = now(), suspension_reason = 'free_period_ended'
     where id = r.id and status = 'active';
    perform app.enqueue_company_email(r.company_id, 'free_period_ended', jsonb_build_object('job_title', r.title, 'job_id', r.id),
                                      'free_period_ended:' || r.id, 'billing');
    v_free_ended := v_free_ended + 1;
  end loop;

  -- 0 bis. Reminders 30 and 7 days before the end of a company's free adverts, once per
  -- company, milestone and end date (an extended offer gets its own reminders).
  for r in
    select j.company_id, min(j.free_until) as until from public.jobs j
     where j.status = 'active' and j.free_until is not null
       and j.free_until > now() and j.free_until <= now() + interval '30 days'
     group by j.company_id
  loop
    v_milestone := case when r.until <= now() + interval '7 days' then 'd7' else 'd30' end;
    perform app.enqueue_company_email(r.company_id, 'free_period_ending',
      jsonb_build_object('free_until', r.until, 'days_left', ceil(extract(epoch from r.until - now()) / 86400)),
      'free_period_ending:' || v_milestone || ':' || r.company_id || ':' || extract(epoch from r.until)::bigint, 'billing');
    v_free_reminders := v_free_reminders + 1;
  end loop;

  -- 1. Payment grace period elapsed -> suspend the advert (reactivated automatically when paid)
  for r in
    select j.id, j.company_id, j.title from public.subscriptions s join public.jobs j on j.id = s.job_id
    where s.status = 'past_due' and s.grace_until < now() and j.status = 'active'
  loop
    update public.jobs set status = 'suspended', suspended_at = now(), suspension_reason = 'payment_failed' where id = r.id;
    perform app.enqueue_company_email(r.company_id, 'job_suspended_payment', jsonb_build_object('job_title', r.title, 'job_id', r.id),
                                      'job_suspended_payment:' || r.id || ':' || current_date, 'billing');
    v_suspended := v_suspended + 1;
  end loop;

  -- 2. Application deadline passed -> the advert is no longer open; renewal stops
  for r in select id from public.jobs where status = 'active' and application_deadline < current_date loop
    update public.jobs set status = 'expired', expired_at = now() where id = r.id;
    perform app.close_open_applications(r.id, 'system');
    v_cancel := v_cancel || app.request_subscription_cancellation(r.id);
    v_expired := v_expired + 1;
  end loop;

  -- 3. Reconciliation: adverts no longer active whose renewal has not been stopped yet
  select v_cancel || coalesce(array_agg(s.stripe_subscription_id), '{}') into v_cancel
    from public.subscriptions s join public.jobs j on j.id = s.job_id
   where s.status in ('active', 'trialing', 'past_due', 'unpaid', 'paused') and not s.cancel_at_period_end
     and s.stripe_subscription_id is not null
     and (s.cancel_requested_at is not null or j.status in ('closed', 'expired', 'rejected'));

  -- 4. Retention: anonymise applications of adverts closed for longer than the retention period
  with targets as (
    select a.id from public.applications a join public.jobs j on j.id = a.job_id
    where a.anonymized_at is null
      and (
        (j.status in ('closed', 'expired', 'rejected') and coalesce(j.closed_at, j.expired_at, j.updated_at) < now() - make_interval(months => v_retention_months))
        or a.created_at < now() - make_interval(months => v_retention_months + 12)
      )
  )
  update public.applications a set
    candidate_snapshot = jsonb_build_object('anonymized', true),
    resume_version_id = null,
    candidate_id = null,
    anonymized_at = now()
  from targets t where a.id = t.id;
  get diagnostics v_anonymized = row_count;

  -- 5. Resume files no longer referenced by any live application (deleted CVs / replaced versions)
  select coalesce(jsonb_agg(jsonb_build_object('version_id', v.id, 'storage_path', v.storage_path)), '[]') into v_resume_purge
    from public.candidate_resume_versions v
    join public.candidate_resumes rr on rr.id = v.resume_id
   where v.file_deleted_at is null
     and (rr.deleted_at is not null or v.id is distinct from rr.current_version_id)
     and not exists (select 1 from public.applications a where a.resume_version_id = v.id and a.status <> 'withdrawn' and a.anonymized_at is null);

  -- 6. Verification documents past their retention date
  select coalesce(jsonb_agg(jsonb_build_object('document_id', d.id, 'storage_path', d.storage_path)), '[]') into v_doc_purge
    from public.company_verification_documents d
   where d.file_deleted_at is null and d.purge_after < now();

  -- 7. Housekeeping
  delete from public.rate_limits where window_start < now() - interval '2 days';
  update public.stripe_events set payload = null where payload is not null and received_at < now() - interval '90 days';
  delete from public.email_outbox where (status = 'sent' and sent_at < now() - interval '90 days')
                                     or (status in ('failed', 'cancelled') and created_at < now() - interval '30 days' and attempts >= 8);
  delete from public.notifications where read_at is not null and read_at < now() - interval '180 days';
  delete from public.company_verifications where purge_after < now();

  return jsonb_build_object(
    'free_period_ended', v_free_ended,
    'free_period_reminders', v_free_reminders,
    'suspended_for_payment', v_suspended,
    'expired_by_deadline', v_expired,
    'applications_anonymized', v_anonymized,
    'cancel_subscription_ids', to_jsonb(array(select distinct unnest(v_cancel))),
    'resume_files_to_delete', v_resume_purge,
    'verification_documents_to_delete', v_doc_purge
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Back-office: the end of the offer is an explicit instant with its UTC offset. Extending
-- it extends the adverts already online for free; shortening it only applies to new
-- publications (what was announced to the published adverts is kept).
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  perform app.require_permission('settings.manage');
  if p_key = 'billing.free_publication_until' then
    if jsonb_typeof(p_value) is distinct from 'string'
       or (p_value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$' then
      raise exception 'invalid_input' using errcode = 'P0001';
    end if;
    begin
      v_until := (p_value #>> '{}')::timestamptz;
    exception when others then
      raise exception 'invalid_input' using errcode = 'P0001';
    end;
  end if;
  update public.platform_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_until is not null then
    update public.jobs set free_until = v_until
     where status = 'active' and free_until is not null and free_until > now() and free_until < v_until;
  end if;
  perform app.audit('setting.update', 'setting', p_key, jsonb_build_object('value', p_value));
end;
$$;

-- -----------------------------------------------------------------------------
-- Checkout completed without payment (trial of a launch-offer conversion): recorded as
-- 'trialing', so that the recruiter is told "nothing charged before", not "payment confirmed".
-- -----------------------------------------------------------------------------
create or replace function public.billing_checkout_completed(p jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_job_id uuid := nullif(p ->> 'job_id', '')::uuid;
  v_result text := 'linked';
begin
  select * into v_sub from public.subscriptions where stripe_checkout_session_id = p ->> 'session_id' for update;
  if v_sub.id is null and p ->> 'subscription_id' is not null then
    select * into v_sub from public.subscriptions where stripe_subscription_id = p ->> 'subscription_id' for update;
  end if;
  if v_sub.id is null then
    if v_job_id is null or not exists (select 1 from public.jobs where id = v_job_id) then
      raise exception 'unknown_checkout_session' using errcode = 'P0001';
    end if;
    insert into public.subscriptions (company_id, job_id, stripe_checkout_session_id, status)
    select j.company_id, j.id, p ->> 'session_id', 'incomplete' from public.jobs j where j.id = v_job_id
    returning * into v_sub;
  end if;

  update public.subscriptions set
    stripe_subscription_id = coalesce(p ->> 'subscription_id', stripe_subscription_id),
    stripe_customer_id = coalesce(p ->> 'customer_id', stripe_customer_id),
    livemode = (p ->> 'livemode')::boolean,
    status = case when status in ('checkout_pending', 'checkout_expired') then 'incomplete' else status end
  where id = v_sub.id;

  if p ->> 'customer_id' is not null then
    perform public.billing_upsert_customer(v_sub.company_id, p ->> 'customer_id');
  end if;

  if p ->> 'payment_status' in ('paid', 'no_payment_required') then
    -- Nothing to pay at checkout: a subscription starting with a trial (launch offer
    -- conversion, first charge at the end of the free period). Stripe's own subscription
    -- events then keep the exact status.
    update public.subscriptions set status = case when p ->> 'payment_status' = 'no_payment_required' then 'trialing' else 'active' end
     where id = v_sub.id and status in ('incomplete', 'checkout_pending', 'checkout_expired');
    v_result := app.billing_activate_job(v_sub.job_id, null);
  end if;
  return jsonb_build_object('subscription_id', v_sub.id, 'job_id', v_sub.job_id, 'job_result', v_result);
end;
$$;
