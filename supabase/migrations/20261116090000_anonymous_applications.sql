-- =============================================================================
-- Anonymous applications — "Le talent avant les préjugés".
--
-- Phase 1 (preselection): the recruiter sees a professional profile under an
-- alias that belongs to ONE application ("Candidat #TJ-7K4Q9M"). Names, contact
-- details, the city, the original CV file and every identifier that could link
-- two applications of the same person (candidate id, CV version id, status
-- history actors) are withheld.
-- Phase 2 (on request): the recruiter asks for the identity; the candidate
-- accepts or refuses — a refusal never rejects the application — and can later
-- revoke the access. Every step is logged in data_access_logs.
--
-- Recruiters no longer read public.applications or its history directly: every
-- recruiter read goes through the SECURITY DEFINER functions below, which apply
-- these rules server-side. Candidates keep reading their own rows through RLS.
--
-- Existing data is preserved: identity fields move from the snapshot to the
-- protected table; applications created before this migration keep the
-- identity visible (the consent given at the time covered it), recorded as a
-- 'legacy_consent' reveal that the candidate can revoke.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Text helpers: masking of personal data in free text (safety net, the CV
--    redaction itself is done server-side in TypeScript, src/lib/privacy).
-- -----------------------------------------------------------------------------
create or replace function app.regex_escape(p text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$ select regexp_replace(coalesce(p, ''), '([^[:alnum:][:space:]])', '\\\1', 'g') $$;

-- Case- and accent-insensitive pattern for a name ("Amélie" also matches "AMELIE").
create or replace function app.name_pattern(p text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select regexp_replace(
    replace(replace(replace(replace(replace(replace(replace(replace(
      app.regex_escape(lower(app.immutable_unaccent(btrim(coalesce(p, ''))))),
      'a', '[aàáâãäå]'), 'e', '[eèéêë]'), 'i', '[iìíîï]'), 'o', '[oòóôõö]'),
      'u', '[uùúûü]'), 'c', '[cç]'), 'n', '[nñ]'), 'y', '[yýÿ]'),
    '(\\[-''’]|[[:space:]])+', '[-[:space:]''’]+', 'g')
$$;

-- Names to hide for a person: full first and last names, and each part of a compound name.
create or replace function app.identity_terms(p_first_name text, p_last_name text)
returns text[]
language sql immutable parallel safe
set search_path = ''
as $$
  -- Longest first, so that "Jean-Pierre" is masked as one item before "Jean" and "Pierre".
  select coalesce(array_agg(t order by char_length(t) desc, t), '{}')
  from (
    select distinct t from (
      select btrim(p_first_name) as t where char_length(btrim(coalesce(p_first_name, ''))) >= 2
      union all
      select btrim(p_last_name) where char_length(btrim(coalesce(p_last_name, ''))) >= 2
      union all
      select btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''))
      where char_length(btrim(coalesce(p_first_name, ''))) >= 2 and char_length(btrim(coalesce(p_last_name, ''))) >= 2
      union all
      select part from unnest(regexp_split_to_array(btrim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, '')), '[-[:space:]''’]+')) part
      where char_length(part) >= 3
    ) raw
  ) s
$$;

comment on function app.identity_terms(text, text) is 'Name variants masked from the professional profile and the anonymised CV.';

create or replace function app.mask_personal_text(p_text text, p_terms text[] default '{}')
returns text
language plpgsql stable parallel safe
set search_path = ''
as $$
declare
  v text := p_text;
  v_term text;
begin
  if v is null or btrim(v) = '' then
    return v;
  end if;
  -- E-mail addresses
  v := regexp_replace(v, '[[:alnum:]._%+-]+@[[:alnum:]-]+(\.[[:alnum:]-]+)*\.[[:alpha:]]{2,}', '[…]', 'g');
  -- Links and social profiles
  v := regexp_replace(v, '(https?://|www\.)[^[:space:]]+', '[…]', 'gi');
  v := regexp_replace(v, '\m(linkedin|github|gitlab|twitter|x|facebook|instagram|tiktok|youtube|behance|dribbble|malt|viadeo|t|wa)\.(com|me|fr|io)/[^[:space:]]*', '[…]', 'gi');
  -- Phone numbers and other long numbers (9 digits or more; year ranges such as 2018-2021 are kept)
  v := regexp_replace(v, '\+?[0-9](?:[ .\-/()]{0,2}[0-9]){8,}', '[…]', 'g');
  -- @handles
  v := regexp_replace(v, '(^|[[:space:](])@[[:alnum:]_.]{2,}', '\1[…]', 'g');
  -- The person's own names
  foreach v_term in array coalesce(p_terms, '{}') loop
    v := regexp_replace(v, '(?<![[:alnum:]])' || app.name_pattern(v_term) || '(?![[:alnum:]])', '[…]', 'gi');
  end loop;
  return v;
end;
$$;

comment on function app.mask_personal_text(text, text[]) is 'Masks e-mails, links, phone numbers, handles and the given names in free text. Safety net: it cannot guarantee anonymity.';

-- -----------------------------------------------------------------------------
-- 2. Per-application alias (random, never derived from the candidate)
-- -----------------------------------------------------------------------------
create or replace function app.new_application_alias()
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  -- No 0/O, 1/I/L or U: easy to read aloud and to type.
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea;
  v_alias text;
begin
  loop
    v_bytes := uuid_send(gen_random_uuid());
    v_alias := 'TJ-';
    for i in 0..5 loop
      v_alias := v_alias || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
    end loop;
    exit when not exists (select 1 from public.applications where public_alias = v_alias);
  end loop;
  return v_alias;
end;
$$;

alter table public.applications add column public_alias text;
do $$
declare
  r record;
begin
  -- One statement per row so that each new alias is checked against the previous ones.
  for r in select id from public.applications where public_alias is null loop
    update public.applications set public_alias = app.new_application_alias() where id = r.id;
  end loop;
end;
$$;
alter table public.applications
  alter column public_alias set default app.new_application_alias(),
  alter column public_alias set not null,
  add constraint applications_public_alias_key unique (public_alias),
  add constraint applications_public_alias_format check (public_alias ~ '^TJ-[0-9A-Z]{6}$');
comment on column public.applications.public_alias is 'Alias shown to the recruiter during the anonymous phase. Random and specific to this application (two applications of the same candidate have unrelated aliases).';
comment on column public.applications.candidate_snapshot is 'Professional profile transmitted with the application (free text masked). The identity is stored separately in application_identities.';

-- -----------------------------------------------------------------------------
-- 3. Identity, stored apart from the professional data
-- -----------------------------------------------------------------------------
create table public.application_identities (
  application_id uuid primary key references public.applications (id) on delete cascade,
  identity jsonb not null check (jsonb_typeof(identity) = 'object'),
  created_at timestamptz not null default now()
);
comment on table public.application_identities is 'Identity part of an application (names, e-mail, phone, city). No direct access for anon/authenticated: disclosed by recruiter_get_application() only while an accepted reveal is in force. Deleted when the application is anonymised.';
alter table public.application_identities enable row level security;
revoke all on public.application_identities from anon, authenticated;
grant all on public.application_identities to service_role;

-- Move the identity out of the existing snapshots (nothing is deleted: it is relocated).
insert into public.application_identities (application_id, identity, created_at)
select a.id,
       jsonb_strip_nulls(jsonb_build_object(
         'first_name', a.candidate_snapshot ->> 'first_name',
         'last_name', a.candidate_snapshot ->> 'last_name',
         'email', a.candidate_snapshot ->> 'email',
         'phone', a.candidate_snapshot ->> 'phone',
         'city', a.candidate_snapshot ->> 'city')),
       a.created_at
from public.applications a
where a.anonymized_at is null and a.candidate_snapshot ?| array['first_name', 'last_name', 'email', 'phone', 'city'];

update public.applications
   set candidate_snapshot = candidate_snapshot - array['first_name', 'last_name', 'email', 'phone', 'city']
 where candidate_snapshot ?| array['first_name', 'last_name', 'email', 'phone', 'city'];

create or replace function app.purge_application_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.anonymized_at is not null and old.anonymized_at is null then
    delete from public.application_identities where application_id = new.id;
  end if;
  return new;
end;
$$;

create trigger applications_purge_identity after update of anonymized_at on public.applications
  for each row execute function app.purge_application_identity();

-- -----------------------------------------------------------------------------
-- 4. Reveal requests (identity disclosure, decided by the candidate)
-- -----------------------------------------------------------------------------
create type public.identity_reveal_status as enum ('pending', 'accepted', 'refused', 'revoked', 'expired');

create table public.application_identity_reveals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  status public.identity_reveal_status not null default 'pending',
  origin text not null default 'recruiter_request' check (origin in ('recruiter_request', 'legacy_consent')),
  requested_by uuid references public.users (id) on delete set null,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);
comment on table public.application_identity_reveals is 'Requests to lift the anonymity of an application. Kept with the application as the trace of the decision (no personal data besides the requesting recruiter id).';
create unique index application_identity_reveals_live_idx on public.application_identity_reveals (application_id)
  where status in ('pending', 'accepted');
create index application_identity_reveals_app_idx on public.application_identity_reveals (application_id, requested_at desc);
create trigger application_identity_reveals_touch before update on public.application_identity_reveals
  for each row execute function app.touch_updated_at();

alter table public.application_identity_reveals enable row level security;
revoke all on public.application_identity_reveals from anon, authenticated;
grant all on public.application_identity_reveals to service_role;
-- Candidates see the requests about their own applications (not who asked).
grant select (id, application_id, status, origin, requested_at, expires_at, responded_at, revoked_at)
  on public.application_identity_reveals to authenticated;
create policy identity_reveals_candidate_read on public.application_identity_reveals for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and a.candidate_id = (select auth.uid())));

-- Applications that existed before anonymisation: identity already shared under the previous consent.
insert into public.application_identity_reveals (application_id, status, origin, requested_at, expires_at, responded_at)
select a.id, 'accepted', 'legacy_consent', a.created_at, a.created_at, a.created_at
from public.applications a
where exists (select 1 from public.application_identities i where i.application_id = a.id);

insert into public.platform_settings (key, value, is_public, description) values
  ('anonymity.request_ttl_days', '14', true, 'Days a request to lift the anonymity of an application stays open before expiring.'),
  ('anonymity.request_cooldown_days', '30', true, 'Days before a recruiter may ask again after a refusal or a revocation.'),
  ('anonymity.daily_requests_per_company', '50', false, 'Maximum identity requests per company per 24h (abuse protection).')
on conflict (key) do nothing;

-- The data-transmission notice changes (two phases): candidates confirm it again once.
update public.platform_settings set value = '"2026-11-16"', updated_at = now() where key = 'consent.transmission_version';

-- Traceability of the new events.
alter table public.data_access_logs drop constraint data_access_logs_resource_type_check;
alter table public.data_access_logs add constraint data_access_logs_resource_type_check
  check (resource_type in ('resume_version', 'verification_document', 'application', 'data_export', 'application_identity'));
alter table public.data_access_logs drop constraint data_access_logs_action_check;
alter table public.data_access_logs add constraint data_access_logs_action_check
  check (action in ('view', 'download', 'export', 'reveal_request', 'reveal_accept', 'reveal_refuse', 'reveal_revoke'));

-- -----------------------------------------------------------------------------
-- 5. Anonymised CV (text extracted from the file, personal data removed,
--    verified by the candidate). The original file is never shown before the reveal.
-- -----------------------------------------------------------------------------
alter table public.candidate_resume_versions
  add column anonymized_text text check (char_length(anonymized_text) <= 30000),
  add column anonymized_status text not null default 'pending'
    check (anonymized_status in ('pending', 'to_review', 'approved', 'unavailable')),
  add column anonymized_summary jsonb not null default '{}' check (jsonb_typeof(anonymized_summary) = 'object'),
  add column anonymized_updated_at timestamptz,
  add column anonymized_approved_at timestamptz;
comment on column public.candidate_resume_versions.anonymized_text is 'Anonymised text of this CV version, shown to recruiters during the anonymous phase once the candidate has approved it (anonymized_status = approved).';
comment on column public.candidate_resume_versions.anonymized_summary is 'Number of masked items per category (never the masked values).';

-- Stores the automatic draft computed by the server after an upload (service role only).
create or replace function public.resume_store_anonymized_draft(p_user_id uuid, p_version_id uuid, p_text text, p_summary jsonb default '{}')
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_user public.users;
  v_text text;
  v_status text;
begin
  select * into v_user from public.users where id = p_user_id;
  if v_user.id is null or not exists (select 1 from public.candidate_resume_versions where id = p_version_id and user_id = p_user_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  v_text := left(btrim(app.mask_personal_text(coalesce(p_text, ''), app.identity_terms(v_user.first_name, v_user.last_name))), 30000);
  v_status := case when v_text = '' then 'unavailable' else 'to_review' end;
  update public.candidate_resume_versions
     set anonymized_text = nullif(v_text, ''), anonymized_status = v_status,
         anonymized_summary = coalesce(p_summary, '{}'), anonymized_updated_at = now(), anonymized_approved_at = null
   where id = p_version_id;
  return v_status;
end;
$$;

-- The candidate corrects and approves the anonymised version of one of their CVs.
create or replace function public.resume_save_anonymized_text(p_version_id uuid, p_text text, p_approve boolean)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_user public.users;
  v_input text := left(btrim(coalesce(p_text, '')), 30000);
  v_masked text;
  v_status text;
begin
  select * into v_user from public.users where id = auth.uid();
  if v_user.id is null or v_user.status <> 'active' or v_user.account_type <> 'candidate' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.candidate_resume_versions where id = p_version_id and user_id = v_user.id and file_deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  v_masked := app.mask_personal_text(v_input, app.identity_terms(v_user.first_name, v_user.last_name));
  -- Approval is refused while personal data is still detected: the masked text is saved for review.
  v_status := case
    when v_masked = '' then 'unavailable'
    when p_approve and v_masked = v_input then 'approved'
    else 'to_review'
  end;
  update public.candidate_resume_versions
     set anonymized_text = nullif(v_masked, ''), anonymized_status = v_status, anonymized_updated_at = now(),
         anonymized_approved_at = case when v_status = 'approved' then now() end
   where id = p_version_id;
  return jsonb_build_object('status', v_status, 'changed', v_masked is distinct from v_input);
end;
$$;

-- CV files purged by the retention job: the derived anonymised text goes with them.
create or replace function public.resume_mark_files_deleted(p_version_ids uuid[])
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.candidate_resume_versions
     set file_deleted_at = now(), anonymized_text = null, anonymized_status = 'unavailable', anonymized_approved_at = null
  where id = any (p_version_ids) and file_deleted_at is null
$$;

-- -----------------------------------------------------------------------------
-- 6. Snapshot = professional profile only; identity built separately
-- -----------------------------------------------------------------------------
create or replace function app.build_candidate_snapshot(p_user_id uuid)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  with person as (
    select u.id, app.identity_terms(u.first_name, u.last_name) as terms
    from public.users u where u.id = p_user_id
  )
  select jsonb_build_object(
    'snapshot_version', 2,
    'headline', app.mask_personal_text(p.headline, person.terms),
    'summary', app.mask_personal_text(p.summary, person.terms),
    'country_code', p.country_code,
    'region_code', p.region_code,
    'skills', to_jsonb(p.skills),
    'languages', p.languages,
    'years_of_experience', p.years_of_experience,
    'desired_contract_types', to_jsonb(p.desired_contract_types),
    'remote_preference', p.remote_preference,
    'willing_to_relocate', p.willing_to_relocate,
    'mobility_countries', to_jsonb(p.mobility_countries),
    'experiences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', app.mask_personal_text(e.title, person.terms), 'company_name', e.company_name, 'location', e.location,
        'start_date', e.start_date, 'end_date', e.end_date, 'is_current', e.is_current,
        'description', app.mask_personal_text(e.description, person.terms))
        order by e.is_current desc, e.start_date desc)
      from public.candidate_experiences e where e.user_id = p_user_id), '[]'::jsonb),
    -- Graduation dates are left out of the anonymous profile: they hint at the age.
    'educations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'degree', app.mask_personal_text(d.degree, person.terms), 'school', d.school, 'field_of_study', d.field_of_study,
        'description', app.mask_personal_text(d.description, person.terms))
        order by d.end_date desc nulls first)
      from public.candidate_educations d where d.user_id = p_user_id), '[]'::jsonb)
  )
  from person
  join public.candidate_profiles p on p.user_id = person.id
$$;

comment on function app.build_candidate_snapshot(uuid) is 'Professional profile transmitted with an application: no name, contact detail, city or birth-related data; free text masked.';

create or replace function app.build_candidate_identity(p_user_id uuid)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'first_name', u.first_name, 'last_name', u.last_name, 'email', u.email,
    'phone', nullif(btrim(p.phone), ''), 'city', nullif(btrim(p.city), '')))
  from public.users u
  join public.candidate_profiles p on p.user_id = u.id
  where u.id = p_user_id
$$;

-- One-click application (unchanged behaviour), now storing the identity apart.
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
  select j.id, j.company_id, j.status, j.application_deadline, j.title, j.public_id, j.slug,
         c.verification_status, c.suspended_at, coalesce(c.display_name, c.legal_name) as company_name
    into v_job
    from public.jobs j
    join public.companies c on c.id = j.company_id
   where j.id = p_job_id
     for share of j;
  if v_job.id is null
     or v_job.status <> 'active'
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

-- -----------------------------------------------------------------------------
-- 7. Access rules
-- -----------------------------------------------------------------------------
-- Recruiters lose direct access to the table and to the status history (whose
-- "changed_by" column would link the applications of one candidate).
drop policy applications_company_read on public.applications;
drop policy application_history_read on public.application_status_history;
create policy application_history_read on public.application_status_history for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_id and a.candidate_id = (select auth.uid())));

-- Effective status of a reveal (a pending request past its deadline counts as expired).
create or replace function app.reveal_effective_status(p_status public.identity_reveal_status, p_expires_at timestamptz)
returns public.identity_reveal_status
language sql stable
set search_path = ''
as $$ select case when p_status = 'pending' and p_expires_at < now() then 'expired'::public.identity_reveal_status else p_status end $$;

-- True when the recruiter may see the identity and the original CV of this application.
create or replace function app.identity_access_granted(p_application_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    join public.application_identity_reveals r on r.application_id = a.id and r.status = 'accepted'
    where a.id = p_application_id
      and a.anonymized_at is null
      and a.status not in ('withdrawn', 'rejected')
  )
$$;

comment on function app.identity_access_granted(uuid) is 'Identity disclosure rule: an accepted (not revoked) reveal, on an application that is neither withdrawn, rejected nor anonymised.';

-- Application readable by the caller as a recruiter (same company, not withdrawn, not anonymised).
create or replace function app.recruiter_application(p_application_id uuid)
returns public.applications
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id;
  if v_app.id is null
     or app.current_account_type() is distinct from 'employer'
     or v_app.company_id is distinct from app.my_company_id()
     or v_app.status = 'withdrawn'
     or v_app.anonymized_at is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_app;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Recruiter reads
-- -----------------------------------------------------------------------------
create or replace function public.recruiter_application_counts()
returns table (job_id uuid, total integer, fresh integer)
language sql stable
security definer
set search_path = ''
as $$
  select a.job_id, count(*)::integer, (count(*) filter (where a.status = 'submitted'))::integer
  from public.applications a
  where app.current_account_type() = 'employer'
    and a.company_id = app.my_company_id()
    and a.status <> 'withdrawn' and a.anonymized_at is null
  group by a.job_id
$$;

create or replace function public.recruiter_list_applications(
  p_job_id uuid,
  p_status public.application_status default null,
  p_archived boolean default false
)
returns table (
  id uuid,
  alias text,
  status public.application_status,
  created_at timestamptz,
  recruiter_rating smallint,
  is_archived boolean,
  first_viewed_at timestamptz,
  headline text,
  country_code text,
  region_code text,
  skills text[],
  reveal_status public.identity_reveal_status,
  identity_revealed boolean,
  display_name text
)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if app.current_account_type() is distinct from 'employer'
     or not exists (select 1 from public.jobs j where j.id = p_job_id and j.company_id = app.my_company_id()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select a.id, a.public_alias, a.status, a.created_at, a.recruiter_rating, a.is_archived, a.first_viewed_at,
         a.candidate_snapshot ->> 'headline', a.candidate_snapshot ->> 'country_code', a.candidate_snapshot ->> 'region_code',
         coalesce(array(select jsonb_array_elements_text(coalesce(a.candidate_snapshot -> 'skills', '[]'::jsonb))), '{}'),
         app.reveal_effective_status(r.status, r.expires_at),
         g.granted,
         case when g.granted then nullif(btrim(concat_ws(' ', i.identity ->> 'first_name', i.identity ->> 'last_name')), '') end
  from public.applications a
  left join lateral (
    select rr.status, rr.expires_at from public.application_identity_reveals rr
    where rr.application_id = a.id order by rr.requested_at desc limit 1
  ) r on true
  cross join lateral (select app.identity_access_granted(a.id) as granted) g
  left join public.application_identities i on i.application_id = a.id and g.granted
  where a.job_id = p_job_id
    and a.company_id = app.my_company_id()
    and a.status <> 'withdrawn'
    and a.anonymized_at is null
    and a.is_archived = coalesce(p_archived, false)
    and (p_status is null or a.status = p_status)
  order by a.created_at desc
  limit 500;
end;
$$;

comment on function public.recruiter_list_applications(uuid, public.application_status, boolean) is 'Applications of one advert for its recruiters: alias and professional summary; the name only when the identity has been disclosed.';

create or replace function public.recruiter_get_application(p_application_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_job record;
  v_reveal public.application_identity_reveals;
  v_granted boolean;
  v_identity jsonb;
  v_version public.candidate_resume_versions;
  v_cooldown integer := app.setting_int('anonymity.request_cooldown_days', 30);
  v_effective public.identity_reveal_status;
  v_next_request timestamptz;
begin
  v_app := app.recruiter_application(p_application_id);
  select j.id, j.title, j.required_skills into v_job from public.jobs j where j.id = v_app.job_id;
  select r.* into v_reveal from public.application_identity_reveals r
   where r.application_id = v_app.id order by r.requested_at desc limit 1;
  v_effective := case when v_reveal.id is null then null else app.reveal_effective_status(v_reveal.status, v_reveal.expires_at) end;
  v_granted := app.identity_access_granted(v_app.id);
  if v_effective in ('refused', 'revoked') then
    v_next_request := coalesce(v_reveal.revoked_at, v_reveal.responded_at, v_reveal.requested_at) + make_interval(days => v_cooldown);
  end if;

  if v_granted then
    select i.identity into v_identity from public.application_identities i where i.application_id = v_app.id;
    -- Trace identity views (at most once a day per recruiter and application).
    if not exists (
      select 1 from public.data_access_logs l
      where l.resource_type = 'application_identity' and l.resource_id = v_app.id and l.action = 'view'
        and l.actor_id = auth.uid() and l.created_at > now() - interval '1 day') then
      insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action)
      values (auth.uid(), 'recruiter', 'application_identity', v_app.id, 'view');
    end if;
  end if;

  if v_app.resume_version_id is not null then
    select * into v_version from public.candidate_resume_versions where id = v_app.resume_version_id;
  end if;

  return jsonb_build_object(
    'id', v_app.id,
    'alias', v_app.public_alias,
    'status', v_app.status,
    'created_at', v_app.created_at,
    'recruiter_rating', v_app.recruiter_rating,
    'is_archived', v_app.is_archived,
    'job', jsonb_build_object('id', v_job.id, 'title', v_job.title, 'required_skills', to_jsonb(coalesce(v_job.required_skills, '{}'))),
    'profile', v_app.candidate_snapshot,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('to_status', h.to_status, 'actor', h.actor, 'created_at', h.created_at) order by h.created_at, h.id)
      from public.application_status_history h where h.application_id = v_app.id), '[]'::jsonb),
    'reveal', jsonb_build_object(
      'status', coalesce(v_effective::text, 'none'),
      'origin', v_reveal.origin,
      'requested_at', v_reveal.requested_at,
      'expires_at', v_reveal.expires_at,
      'responded_at', v_reveal.responded_at,
      'revoked_at', v_reveal.revoked_at,
      'can_request', not v_granted
                     and v_app.status not in ('withdrawn', 'rejected')
                     and coalesce(v_effective::text, 'none') not in ('pending', 'accepted')
                     and (v_next_request is null or v_next_request <= now()),
      'next_request_at', case when v_next_request > now() then v_next_request end),
    'identity', case when v_granted then v_identity end,
    'resume', jsonb_build_object(
      'available', v_version.id is not null and v_version.file_deleted_at is null,
      'downloadable', v_granted and v_version.id is not null and v_version.file_deleted_at is null,
      'anonymized_status', v_version.anonymized_status,
      'anonymized_text', case when v_version.anonymized_status = 'approved' and v_version.file_deleted_at is null then v_version.anonymized_text end)
  );
end;
$$;

comment on function public.recruiter_get_application(uuid) is 'One application for its recruiters: professional profile, anonymised CV (approved by the candidate), history, reveal state; identity only while disclosure is granted.';

-- Download of the original CV by the recruiter: only once the identity is disclosed.
create or replace function public.authorize_application_resume_download(p_application_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_version public.candidate_resume_versions;
begin
  if auth.uid() is null or not app.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_app := app.recruiter_application(p_application_id);
  if not app.identity_access_granted(v_app.id) or v_app.resume_version_id is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_version from public.candidate_resume_versions where id = v_app.resume_version_id;
  if v_version.id is null or v_version.file_deleted_at is not null or v_version.scan_status <> 'clean' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.applications set resume_first_downloaded_at = coalesce(resume_first_downloaded_at, now()) where id = v_app.id;
  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action, context)
  values (auth.uid(), 'recruiter', 'resume_version', v_version.id, 'download', jsonb_build_object('application_id', v_app.id));
  return jsonb_build_object('storage_path', v_version.storage_path, 'filename', v_version.original_filename, 'mime_type', v_version.mime_type);
end;
$$;

-- Download by CV version: the owner, or a recruiter whose access to the identity is granted.
create or replace function public.authorize_resume_download(p_version_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_version public.candidate_resume_versions;
  v_app_id uuid;
  v_kind text;
begin
  if v_uid is null or not app.is_active_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_version from public.candidate_resume_versions where id = p_version_id;
  if v_version.id is null or v_version.file_deleted_at is not null or v_version.scan_status <> 'clean' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_version.user_id = v_uid then
    v_kind := 'candidate';
  else
    select a.id into v_app_id
      from public.applications a
     where a.resume_version_id = p_version_id
       and a.company_id = app.my_company_id()
       and app.identity_access_granted(a.id)
     order by a.created_at desc
     limit 1;
    if v_app_id is null then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    v_kind := 'recruiter';
    update public.applications
       set resume_first_downloaded_at = coalesce(resume_first_downloaded_at, now())
     where id = v_app_id;
  end if;

  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action, context)
  values (v_uid, v_kind, 'resume_version', p_version_id, 'download',
          case when v_app_id is null then '{}'::jsonb else jsonb_build_object('application_id', v_app_id) end);

  return jsonb_build_object(
    'storage_path', v_version.storage_path,
    'filename', v_version.original_filename,
    'mime_type', v_version.mime_type,
    'actor_kind', v_kind
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Reveal workflow
-- -----------------------------------------------------------------------------
create or replace function public.recruiter_request_identity(p_application_id uuid)
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_last public.application_identity_reveals;
  v_effective public.identity_reveal_status;
  v_request_id uuid;
  v_company text;
begin
  v_app := app.recruiter_application(p_application_id);
  if v_app.status = 'rejected' then
    raise exception 'application_rejected' using errcode = 'P0001';
  end if;
  perform 1 from public.applications where id = v_app.id for update;
  select r.* into v_last from public.application_identity_reveals r
   where r.application_id = v_app.id order by r.requested_at desc limit 1;
  if v_last.id is not null then
    v_effective := app.reveal_effective_status(v_last.status, v_last.expires_at);
    if v_effective = 'accepted' then
      return 'already_granted';
    end if;
    if v_effective = 'pending' then
      return 'already_pending';
    end if;
    if v_last.status = 'pending' then
      update public.application_identity_reveals set status = 'expired' where id = v_last.id;
    end if;
    if v_effective in ('refused', 'revoked')
       and coalesce(v_last.revoked_at, v_last.responded_at, v_last.requested_at)
           + make_interval(days => app.setting_int('anonymity.request_cooldown_days', 30)) > now() then
      raise exception 'request_cooldown' using errcode = 'P0001';
    end if;
  end if;
  if not app.rate_limit_hit('reveal:' || v_app.company_id::text, app.setting_int('anonymity.daily_requests_per_company', 50), 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.application_identity_reveals (application_id, status, requested_by, expires_at)
  values (v_app.id, 'pending', auth.uid(), now() + make_interval(days => app.setting_int('anonymity.request_ttl_days', 14)))
  returning id into v_request_id;
  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action, context)
  values (auth.uid(), 'recruiter', 'application_identity', v_app.id, 'reveal_request', jsonb_build_object('request_id', v_request_id));

  -- A request for consent: always sent (it is not a marketing or status notification).
  select coalesce(c.display_name, c.legal_name) into v_company from public.companies c where c.id = v_app.company_id;
  perform app.notify(v_app.candidate_id, 'identity_reveal_requested',
    jsonb_build_object('job_title', v_app.job_title, 'company_name', v_company, 'application_id', v_app.id));
  perform app.enqueue_email(v_app.candidate_id, 'identity_reveal_requested',
    jsonb_build_object('job_title', v_app.job_title, 'company_name', v_company,
                       'days', app.setting_int('anonymity.request_ttl_days', 14)),
    'identity_reveal_requested:' || v_request_id);
  return 'requested';
end;
$$;

create or replace function public.candidate_answer_identity_request(p_application_id uuid, p_accept boolean)
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_request public.application_identity_reveals;
  v_outcome public.identity_reveal_status :=
    case when p_accept then 'accepted'::public.identity_reveal_status else 'refused'::public.identity_reveal_status end;
begin
  select * into v_app from public.applications where id = p_application_id and candidate_id = auth.uid() for update;
  if v_app.id is null or app.current_account_type() is distinct from 'candidate' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into v_request from public.application_identity_reveals
   where application_id = v_app.id and status = 'pending' order by requested_at desc limit 1 for update;
  if v_request.id is null then
    raise exception 'no_pending_request' using errcode = 'P0001';
  end if;
  if v_request.expires_at < now() then
    raise exception 'request_expired' using errcode = 'P0001';
  end if;
  if p_accept and (v_app.status in ('withdrawn', 'rejected') or v_app.anonymized_at is not null) then
    raise exception 'application_closed' using errcode = 'P0001';
  end if;

  update public.application_identity_reveals set status = v_outcome, responded_at = now() where id = v_request.id;
  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action, context)
  values (auth.uid(), 'candidate', 'application_identity', v_app.id,
          case when p_accept then 'reveal_accept' else 'reveal_refuse' end, jsonb_build_object('request_id', v_request.id));
  -- The recruiter is told the answer under the alias only (no personal data in e-mails).
  perform app.enqueue_company_email(v_app.company_id, 'identity_reveal_answered',
    jsonb_build_object('outcome', v_outcome, 'alias', v_app.public_alias, 'job_title', v_app.job_title, 'application_id', v_app.id),
    'identity_reveal_answered:' || v_request.id, 'application');
  return v_outcome::text;
end;
$$;

create or replace function public.candidate_revoke_identity_access(p_application_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_reveal public.application_identity_reveals;
begin
  select * into v_app from public.applications where id = p_application_id and candidate_id = auth.uid() for update;
  if v_app.id is null or app.current_account_type() is distinct from 'candidate' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  select * into v_reveal from public.application_identity_reveals
   where application_id = v_app.id and status = 'accepted' for update;
  if v_reveal.id is null then
    raise exception 'nothing_to_revoke' using errcode = 'P0001';
  end if;
  update public.application_identity_reveals set status = 'revoked', revoked_at = now() where id = v_reveal.id;
  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action, context)
  values (auth.uid(), 'candidate', 'application_identity', v_app.id, 'reveal_revoke', jsonb_build_object('request_id', v_reveal.id));
  perform app.enqueue_company_email(v_app.company_id, 'identity_reveal_answered',
    jsonb_build_object('outcome', 'revoked', 'alias', v_app.public_alias, 'job_title', v_app.job_title, 'application_id', v_app.id),
    'identity_reveal_revoked:' || v_reveal.id, 'application');
end;
$$;

-- Scheduled job (service role): pending requests past their deadline become 'expired'.
create or replace function public.expire_identity_requests()
returns integer
language sql volatile
security definer
set search_path = ''
as $$
  with expired as (
    update public.application_identity_reveals set status = 'expired'
    where status = 'pending' and expires_at < now()
    returning 1
  )
  select count(*)::integer from expired
$$;

-- -----------------------------------------------------------------------------
-- 10. Personal data export: what was transmitted, what was disclosed and when
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_company uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_company := app.my_company_id();

  select jsonb_build_object(
    'generated_at', now(),
    'account', (select to_jsonb(u) - 'suspended_reason' from public.users u where u.id = v_uid),
    'candidate_profile', (select to_jsonb(p) from public.candidate_profiles p where p.user_id = v_uid),
    'experiences', coalesce((select jsonb_agg(to_jsonb(e) order by e.start_date desc) from public.candidate_experiences e where e.user_id = v_uid), '[]'),
    'educations', coalesce((select jsonb_agg(to_jsonb(d)) from public.candidate_educations d where d.user_id = v_uid), '[]'),
    'resumes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'label', r.label, 'is_primary', r.is_primary, 'created_at', r.created_at, 'deleted_at', r.deleted_at,
        'versions', (select coalesce(jsonb_agg(jsonb_build_object(
            'id', v.id, 'filename', v.original_filename, 'mime_type', v.mime_type, 'size_bytes', v.size_bytes,
            'sha256', v.sha256, 'created_at', v.created_at, 'file_deleted_at', v.file_deleted_at,
            'anonymized_status', v.anonymized_status, 'anonymized_text', v.anonymized_text)), '[]')
          from public.candidate_resume_versions v where v.resume_id = r.id)))
      from public.candidate_resumes r where r.user_id = v_uid), '[]'),
    'applications', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'alias', a.public_alias, 'job_title', j.title, 'company', coalesce(c.display_name, c.legal_name), 'status', a.status,
        'created_at', a.created_at, 'first_viewed_at', a.first_viewed_at, 'withdrawn_at', a.withdrawn_at,
        'transmitted_data', a.candidate_snapshot, 'consent_version', a.consent_version,
        'identity_disclosed_on_acceptance', (select i.identity from public.application_identities i where i.application_id = a.id),
        'identity_requests', (select coalesce(jsonb_agg(jsonb_build_object(
            'status', app.reveal_effective_status(rv.status, rv.expires_at), 'origin', rv.origin, 'requested_at', rv.requested_at,
            'responded_at', rv.responded_at, 'revoked_at', rv.revoked_at) order by rv.requested_at), '[]')
          from public.application_identity_reveals rv where rv.application_id = a.id),
        'history', (select coalesce(jsonb_agg(jsonb_build_object('from', h.from_status, 'to', h.to_status, 'at', h.created_at, 'actor', h.actor) order by h.created_at), '[]')
                    from public.application_status_history h where h.application_id = a.id))
        order by a.created_at desc)
      from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = a.company_id
      where a.candidate_id = v_uid), '[]'),
    'saved_jobs', coalesce((select jsonb_agg(jsonb_build_object('job_id', s.job_id, 'saved_at', s.created_at)) from public.saved_jobs s where s.user_id = v_uid), '[]'),
    'job_alerts', coalesce((select jsonb_agg(to_jsonb(al)) from public.job_alerts al where al.user_id = v_uid), '[]'),
    'notifications', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.notifications n where n.user_id = v_uid), '[]'),
    'privacy_requests', coalesce((select jsonb_agg(to_jsonb(pr) - 'handled_by') from public.privacy_requests pr where pr.user_id = v_uid), '[]'),
    'company_membership', (select to_jsonb(m) from public.company_members m where m.user_id = v_uid),
    'company', case when v_company is null then null else (
      select to_jsonb(c) from public.companies c where c.id = v_company) end,
    'data_access_log', coalesce((select jsonb_agg(jsonb_build_object('resource_type', l.resource_type, 'action', l.action, 'actor_kind', l.actor_kind, 'at', l.created_at) order by l.created_at desc)
      from public.data_access_logs l
      where (l.resource_type = 'resume_version'
             and l.resource_id in (select v.id from public.candidate_resume_versions v where v.user_id = v_uid))
         or (l.resource_type in ('application', 'application_identity')
             and l.resource_id in (select a.id from public.applications a where a.candidate_id = v_uid))), '[]')
  ) into v_result;

  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action)
  values (v_uid, case when app.current_account_type() = 'employer' then 'recruiter' else 'candidate' end, 'data_export', v_uid, 'export');

  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Privileges for the new entry points (deny by default, see rls_and_grants)
-- -----------------------------------------------------------------------------
revoke execute on function
  app.regex_escape(text), app.name_pattern(text), app.identity_terms(text, text), app.mask_personal_text(text, text[]),
  app.new_application_alias(), app.purge_application_identity(), app.build_candidate_identity(uuid),
  app.reveal_effective_status(public.identity_reveal_status, timestamptz), app.identity_access_granted(uuid),
  app.recruiter_application(uuid),
  public.recruiter_application_counts(), public.recruiter_list_applications(uuid, public.application_status, boolean),
  public.recruiter_get_application(uuid), public.authorize_application_resume_download(uuid),
  public.recruiter_request_identity(uuid), public.candidate_answer_identity_request(uuid, boolean),
  public.candidate_revoke_identity_access(uuid), public.resume_save_anonymized_text(uuid, text, boolean),
  public.resume_store_anonymized_draft(uuid, uuid, text, jsonb), public.expire_identity_requests()
from public, anon, authenticated;

grant execute on function
  app.regex_escape(text), app.name_pattern(text), app.identity_terms(text, text), app.mask_personal_text(text, text[]),
  app.new_application_alias(), app.purge_application_identity(), app.build_candidate_identity(uuid),
  app.reveal_effective_status(public.identity_reveal_status, timestamptz), app.identity_access_granted(uuid),
  app.recruiter_application(uuid),
  public.recruiter_application_counts(), public.recruiter_list_applications(uuid, public.application_status, boolean),
  public.recruiter_get_application(uuid), public.authorize_application_resume_download(uuid),
  public.recruiter_request_identity(uuid), public.candidate_answer_identity_request(uuid, boolean),
  public.candidate_revoke_identity_access(uuid), public.resume_save_anonymized_text(uuid, text, boolean),
  public.resume_store_anonymized_draft(uuid, uuid, text, jsonb), public.expire_identity_requests()
to service_role;

-- User entry points (each function re-checks identity, role and ownership).
grant execute on function
  public.recruiter_application_counts(), public.recruiter_list_applications(uuid, public.application_status, boolean),
  public.recruiter_get_application(uuid), public.authorize_application_resume_download(uuid),
  public.recruiter_request_identity(uuid), public.candidate_answer_identity_request(uuid, boolean),
  public.candidate_revoke_identity_access(uuid), public.resume_save_anonymized_text(uuid, text, boolean)
to authenticated;
