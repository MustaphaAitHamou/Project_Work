-- =============================================================================
-- Public read models and the job search engine.
-- Public views expose only safe columns of verified, non-suspended companies and
-- of published adverts. They intentionally run with the view owner's rights
-- (bypassing base-table RLS) and filter visibility themselves.
-- =============================================================================

create view public.public_companies with (security_barrier = true) as
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
  (select count(*) from public.jobs j where j.company_id = c.id and j.status = 'active') as active_jobs_count
from public.companies c
where c.verification_status = 'verified' and c.suspended_at is null;

comment on view public.public_companies is 'Verified companies, public profile fields only.';

create view public.public_jobs with (security_barrier = true) as
select
  j.id, j.public_id, j.slug, j.title, j.description, j.missions, j.profile_sought,
  j.required_skills, j.optional_skills, j.contract_type, j.work_time, j.work_mode, j.remote_scope,
  j.remote_countries, j.salary_min, j.salary_max, j.salary_currency, j.salary_period, j.benefits,
  j.experience_level, coalesce(j.industry, c.industry) as industry, j.working_languages, j.work_authorization,
  j.eligibility_notes, j.start_date, j.application_deadline, j.positions_count,
  (j.status = 'active' and (j.application_deadline is null or j.application_deadline >= current_date)) as is_open,
  j.status, j.published_at, j.closed_at, j.expired_at, j.updated_at, j.paid_through,
  l.country_code, l.region_code, l.city, l.postal_code, l.address_line, l.latitude, l.longitude,
  c.id as company_id, c.slug as company_slug, coalesce(c.display_name, c.legal_name) as company_name,
  c.logo_path as company_logo_path, c.website as company_website
from public.jobs j
join public.job_locations l on l.job_id = j.id and l.is_primary
join public.companies c on c.id = j.company_id
where j.published_at is not null
  and c.verification_status = 'verified'
  and c.suspended_at is null
  and (
    j.status = 'active'
    or (j.status in ('closed', 'expired') and coalesce(j.closed_at, j.expired_at, j.updated_at) > now() - interval '90 days')
  );

comment on view public.public_jobs is 'Published adverts (active, or closed/expired within 90 days so that the page can state the position is no longer open).';

-- -----------------------------------------------------------------------------
-- Search
-- -----------------------------------------------------------------------------
create or replace function app.build_tsquery(p_q text, p_lang text)
returns tsquery
language plpgsql immutable
set search_path = ''
as $$
declare
  v_norm text := app.normalize_text(p_q);
  v_simple tsquery;
  v_lang tsquery;
begin
  if v_norm = '' then
    return null;
  end if;
  v_simple := websearch_to_tsquery('pg_catalog.simple', v_norm);
  v_lang := websearch_to_tsquery(app.ts_config_for_language(p_lang), v_norm);
  if v_simple::text = '' then
    return nullif(v_lang::text, '')::tsquery;
  end if;
  if v_lang::text = '' then
    return v_simple;
  end if;
  return v_simple || v_lang;
end;
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
    where j.status = 'active'
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

comment on function public.search_jobs is 'Job search: full-text (title > skills > description) with recency tie-break. No sponsored ranking, no personal characteristics used.';

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
    where j.status = 'active' and char_length(q.v) >= 2
      and app.normalize_text(j.title) like '%' || q.v || '%'
    order by app.normalize_text(j.title)
    limit least(greatest(p_limit, 1), 20)
  )
  union all
  (
    select distinct s, 'skill'
    from public.jobs j, q, unnest(j.required_skills) s
    where j.status = 'active' and char_length(q.v) >= 2 and app.normalize_text(s) like q.v || '%'
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
  where j.status = 'active' and j.id <> ref.id
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

create or replace function public.search_cities(p_query text, p_country text default null, p_limit integer default 10)
returns table (id integer, name text, region_code text, region_name text, country_code char(2), latitude double precision, longitude double precision)
language sql stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.region_code, r.name, g.country_code, g.latitude, g.longitude
  from public.geo_cities g
  left join public.geo_regions r on r.country_code = g.country_code and r.code = g.region_code
  where char_length(app.normalize_text(p_query)) >= 2
    and (p_country is null or g.country_code = upper(p_country))
    and g.name_normalized like app.normalize_text(p_query) || '%'
  order by (g.name_normalized = app.normalize_text(p_query)) desc, char_length(g.name), g.name
  limit least(greatest(p_limit, 1), 25)
$$;
