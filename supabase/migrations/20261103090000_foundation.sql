-- =============================================================================
-- Tamurt Jobs — Foundation: schemas, extensions, enums, utility functions,
-- reference tables (currencies, countries, regions, cities, industries,
-- platform settings, pricing plans, per-country compliance checklist).
--
-- Security model reminder (see docs/ARCHITECTURE.md):
--   * `public` holds tables, safe public views and the RPC entry points that the
--     Data API (PostgREST) exposes. Every grant is explicit (see *_rls_and_grants.sql).
--   * `app` holds internal helpers, trigger functions and privileged logic. It is
--     NOT exposed through the Data API.
-- =============================================================================

create schema if not exists app;
comment on schema app is 'Internal helpers and privileged logic for Tamurt Jobs (not exposed via the Data API).';

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
create type public.account_type as enum ('candidate', 'employer');
create type public.user_status as enum ('active', 'suspended', 'deleted');
create type public.admin_role as enum ('super_admin', 'verification_officer', 'moderator', 'finance', 'privacy_officer', 'support');
create type public.contract_type as enum ('permanent', 'fixed_term', 'temporary', 'internship', 'apprenticeship', 'freelance', 'seasonal');
create type public.work_time as enum ('full_time', 'part_time');
create type public.work_mode as enum ('onsite', 'hybrid', 'remote');
create type public.remote_scope as enum ('employer_country', 'listed_countries', 'worldwide');
create type public.experience_level as enum ('entry', 'junior', 'mid', 'senior', 'lead', 'executive');
create type public.salary_period as enum ('hour', 'day', 'month', 'year');
create type public.work_authorization as enum ('not_specified', 'required', 'sponsorship_available');
create type public.job_status as enum ('draft', 'pending_payment', 'in_review', 'active', 'suspended', 'expired', 'closed', 'rejected');
create type public.application_status as enum ('submitted', 'viewed', 'shortlisted', 'rejected', 'hired', 'job_closed', 'withdrawn');
create type public.company_verification_status as enum ('pending', 'auto_check', 'manual_review', 'verified', 'rejected', 'suspended');
create type public.company_member_role as enum ('owner', 'admin', 'recruiter');
create type public.resume_scan_status as enum ('pending', 'clean', 'rejected');
create type public.report_reason as enum ('discrimination', 'fraud', 'scam', 'misleading', 'illegal_content', 'external_redirect', 'other');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'dismissed');
create type public.privacy_request_type as enum ('export', 'deletion', 'rectification', 'objection', 'restriction', 'other');
create type public.privacy_request_status as enum ('open', 'in_progress', 'completed', 'rejected');
create type public.email_status as enum ('pending', 'sending', 'sent', 'failed', 'cancelled');
create type public.compliance_item_status as enum ('todo', 'in_progress', 'done', 'not_applicable');
create type public.alert_frequency as enum ('daily', 'weekly');
create type public.remote_preference as enum ('onsite', 'hybrid', 'remote', 'any');

-- -----------------------------------------------------------------------------
-- Utility functions (immutable / pure)
-- -----------------------------------------------------------------------------
create or replace function app.immutable_unaccent(p text)
returns text
language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, p) $$;

create or replace function app.normalize_text(p text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$ select lower(app.immutable_unaccent(btrim(coalesce(p, '')))) $$;

comment on function app.normalize_text(text) is 'Lower-case, accent-insensitive normalisation used for search and matching.';

create or replace function app.slugify(p text, p_max integer default 80)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select coalesce(
    nullif(
      left(
        btrim(regexp_replace(app.normalize_text(p), '[^a-z0-9]+', '-', 'g'), '-'),
        p_max
      ),
      ''
    ),
    'item'
  )
$$;

-- Short public identifier (base32 Crockford-like alphabet, no ambiguous chars).
create or replace function app.generate_public_id(p_length integer default 10)
returns text
language plpgsql volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  bytes bytea := extensions.gen_random_bytes(p_length);
  result text := '';
begin
  for i in 0 .. p_length - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Great-circle distance in kilometres.
create or replace function app.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable parallel safe
set search_path = ''
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else 6371.0 * 2 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end
$$;

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reference data
-- -----------------------------------------------------------------------------
create table public.currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  minor_units smallint not null default 2 check (minor_units between 0 and 4),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.currencies is 'Currencies supported for salaries and billing (ISO 4217).';

create table public.countries (
  code char(2) primary key check (code ~ '^[A-Z]{2}$'),
  default_currency char(3) not null references public.currencies (code),
  default_locale text not null check (default_locale in ('fr', 'en', 'es', 'ar')),
  phone_prefix text,
  -- Market switches, managed by administrators (see country compliance checklist).
  is_browsable boolean not null default true,
  is_registration_open boolean not null default true,
  is_paid_publishing_enabled boolean not null default false,
  auto_verification_enabled boolean not null default false,
  compliance_status text not null default 'review_required'
    check (compliance_status in ('review_required', 'in_progress', 'validated', 'blocked')),
  compliance_notes text,
  registry_identifier_types text[] not null default '{}',
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.countries is 'Markets. Paid publishing stays disabled until the compliance checklist is validated by an administrator.';
comment on column public.countries.is_paid_publishing_enabled is 'Jobs located in this country can be published (paid). Default false: requires a documented compliance review.';
comment on column public.countries.auto_verification_enabled is 'When true, employers that pass every automated registry check are verified without manual review.';
create trigger countries_touch before update on public.countries for each row execute function app.touch_updated_at();

create table public.geo_regions (
  country_code char(2) not null references public.countries (code) on delete cascade,
  code text not null,
  name text not null,
  primary key (country_code, code)
);
comment on table public.geo_regions is 'First-level administrative divisions (regions, provinces, states, cantons, wilayas). Source: GeoNames (CC BY 4.0).';

create table public.geo_cities (
  id integer generated always as identity primary key,
  country_code char(2) not null references public.countries (code) on delete cascade,
  region_code text,
  name text not null,
  name_normalized text generated always as (app.normalize_text(name)) stored,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  foreign key (country_code, region_code) references public.geo_regions (country_code, code) on delete set null (region_code)
);
comment on table public.geo_cities is 'Cities with coordinates for autocomplete and distance search. Source: GeoNames via cities.json (CC BY 4.0).';
create index geo_cities_name_trgm on public.geo_cities using gin (name_normalized extensions.gin_trgm_ops);
create index geo_cities_country_name on public.geo_cities (country_code, name_normalized text_pattern_ops);

create table public.industries (
  code text primary key check (code ~ '^[a-z_]{2,40}$'),
  sort_order smallint not null default 100,
  is_active boolean not null default true
);
comment on table public.industries is 'Business sectors. Labels are translated in the application message files (industries.<code>).';

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]{2,80}$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
comment on table public.platform_settings is 'Administrable platform parameters (limits, retention, consent versions...).';

create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null default 'job_monthly' check (code ~ '^[a-z0-9_]{2,40}$'),
  country_code char(2) references public.countries (code),
  currency char(3) not null references public.currencies (code),
  unit_amount integer not null check (unit_amount > 0),
  billing_interval text not null default 'month' check (billing_interval in ('month')),
  tax_behavior text not null default 'exclusive' check (tax_behavior in ('exclusive', 'inclusive')),
  stripe_product_id text,
  stripe_price_id text unique,
  is_active boolean not null default true,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.pricing_plans is 'Price catalogue for one job advert subscription. country_code NULL = default plan. Amounts in minor units (595 = 5.95).';
create unique index pricing_plans_one_active_per_scope
  on public.pricing_plans (code, coalesce(country_code, '**'), currency) where is_active;
create trigger pricing_plans_touch before update on public.pricing_plans for each row execute function app.touch_updated_at();

create table public.country_compliance_items (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null references public.countries (code) on delete cascade,
  item_key text not null check (item_key ~ '^[a-z0-9_]{2,60}$'),
  is_blocking boolean not null default true,
  status public.compliance_item_status not null default 'todo',
  notes text,
  evidence_url text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (country_code, item_key)
);
comment on table public.country_compliance_items is 'Per-country legal/compliance checklist. Blocking items must be done or not applicable before enabling paid publishing.';
