-- =============================================================================
-- Candidate-side business functions: profile completeness, consent, one-click
-- application (atomic), withdrawal, resume version management, data export.
-- =============================================================================

create or replace function app.current_consent_version()
returns text
language sql stable
security definer
set search_path = ''
as $$ select app.setting_text('consent.transmission_version', '2026-11-01') $$;

create or replace function app.primary_resume_version(p_user_id uuid)
returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select r.current_version_id
  from public.candidate_resumes r
  join public.candidate_resume_versions v on v.id = r.current_version_id
  where r.user_id = p_user_id and r.is_primary and r.deleted_at is null
    and v.scan_status = 'clean' and v.file_deleted_at is null
  limit 1
$$;

create or replace function app.candidate_completeness(p_user_id uuid)
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_user public.users;
  v_profile public.candidate_profiles;
  v_missing text[] := '{}';
begin
  select * into v_user from public.users where id = p_user_id;
  select * into v_profile from public.candidate_profiles where user_id = p_user_id;
  if v_user.id is null or v_profile.user_id is null then
    return jsonb_build_object('complete', false, 'missing', jsonb_build_array('profile'), 'consent_given', false);
  end if;
  if btrim(v_user.first_name) = '' then v_missing := array_append(v_missing, 'first_name'); end if;
  if btrim(v_user.last_name) = '' then v_missing := array_append(v_missing, 'last_name'); end if;
  if coalesce(btrim(v_profile.headline), '') = '' then v_missing := array_append(v_missing, 'headline'); end if;
  if v_profile.country_code is null then v_missing := array_append(v_missing, 'country'); end if;
  if coalesce(btrim(v_profile.city), '') = '' then v_missing := array_append(v_missing, 'city'); end if;
  if cardinality(v_profile.skills) = 0 then v_missing := array_append(v_missing, 'skills'); end if;
  if app.primary_resume_version(p_user_id) is null then v_missing := array_append(v_missing, 'resume'); end if;
  return jsonb_build_object(
    'complete', cardinality(v_missing) = 0,
    'missing', to_jsonb(v_missing),
    'consent_given', v_profile.transmission_consent_at is not null
                     and v_profile.transmission_consent_version = app.current_consent_version(),
    'consent_version', app.current_consent_version()
  );
end;
$$;

-- Status used by the UI to decide between "Postuler en 1 clic" and the guided flow.
create or replace function public.get_my_candidate_status()
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or app.current_account_type() is distinct from 'candidate' then
    return jsonb_build_object('is_candidate', false);
  end if;
  return app.candidate_completeness(auth.uid()) || jsonb_build_object('is_candidate', true);
end;
$$;

create or replace function public.give_transmission_consent(p_version text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or app.current_account_type() is distinct from 'candidate' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_version is distinct from app.current_consent_version() then
    raise exception 'consent_version_mismatch' using errcode = 'P0001';
  end if;
  update public.candidate_profiles
     set transmission_consent_at = now(), transmission_consent_version = p_version
   where user_id = auth.uid();
end;
$$;

-- Data transmitted to the recruiter with an application (documented in the consent dialog).
create or replace function app.build_candidate_snapshot(p_user_id uuid)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name', u.first_name,
    'last_name', u.last_name,
    'email', u.email,
    'phone', p.phone,
    'headline', p.headline,
    'summary', p.summary,
    'country_code', p.country_code,
    'region_code', p.region_code,
    'city', p.city,
    'skills', to_jsonb(p.skills),
    'languages', p.languages,
    'years_of_experience', p.years_of_experience,
    'desired_contract_types', to_jsonb(p.desired_contract_types),
    'remote_preference', p.remote_preference,
    'willing_to_relocate', p.willing_to_relocate,
    'mobility_countries', to_jsonb(p.mobility_countries),
    'experiences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', e.title, 'company_name', e.company_name, 'location', e.location,
        'start_date', e.start_date, 'end_date', e.end_date, 'is_current', e.is_current, 'description', e.description)
        order by e.is_current desc, e.start_date desc)
      from public.candidate_experiences e where e.user_id = p_user_id), '[]'::jsonb),
    'educations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'degree', d.degree, 'school', d.school, 'field_of_study', d.field_of_study,
        'start_date', d.start_date, 'end_date', d.end_date, 'description', d.description)
        order by d.end_date desc nulls first)
      from public.candidate_educations d where d.user_id = p_user_id), '[]'::jsonb)
  )
  from public.users u
  join public.candidate_profiles p on p.user_id = u.id
  where u.id = p_user_id
$$;

-- -----------------------------------------------------------------------------
-- One-click application — the core feature. Fully atomic and idempotent.
-- -----------------------------------------------------------------------------
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

  -- 5/6. Atomic insert bound to the exact CV version
  insert into public.applications (job_id, company_id, candidate_id, resume_version_id, candidate_snapshot, consent_version, job_title, company_name)
  values (p_job_id, v_job.company_id, v_uid, v_resume_version, app.build_candidate_snapshot(v_uid), v_status ->> 'consent_version',
          v_job.title, v_job.company_name)
  on conflict (job_id, candidate_id) do nothing
  returning id into v_app_id;

  if v_app_id is null then
    select id into v_existing from public.applications where job_id = p_job_id and candidate_id = v_uid;
    return jsonb_build_object('result', 'already_applied', 'application_id', v_existing);
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor)
  values (v_app_id, null, 'submitted', v_uid, 'candidate');

  -- 8. Notifications (outbox, same transaction)
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

comment on function public.apply_to_job(uuid) is 'One-click application: checks auth, CV, job status, duplicates; inserts atomically; enqueues notifications.';

create or replace function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id and candidate_id = auth.uid() for update;
  if v_app.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_app.status = 'withdrawn' then
    return;
  end if;
  update public.applications
     set status = 'withdrawn', withdrawn_at = now(), status_changed_at = now()
   where id = p_application_id;
  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor)
  values (p_application_id, v_app.status, 'withdrawn', auth.uid(), 'candidate');
end;
$$;

-- -----------------------------------------------------------------------------
-- Resume management (called by the server with the service role after file
-- validation; the actor is passed explicitly and re-checked).
-- -----------------------------------------------------------------------------
create or replace function app.unreferenced_versions(p_resume_id uuid)
returns table (version_id uuid, storage_path text)
language sql stable
security definer
set search_path = ''
as $$
  select v.id, v.storage_path
  from public.candidate_resume_versions v
  join public.candidate_resumes r on r.id = v.resume_id
  where v.resume_id = p_resume_id
    and v.file_deleted_at is null
    and (r.deleted_at is not null or v.id is distinct from r.current_version_id)
    and not exists (
      select 1 from public.applications a
      where a.resume_version_id = v.id and a.status <> 'withdrawn' and a.anonymized_at is null
    )
$$;

create or replace function public.resume_register_version(
  p_user_id uuid,
  p_resume_id uuid,
  p_label text,
  p_version_id uuid,
  p_storage_path text,
  p_filename text,
  p_mime_type text,
  p_size_bytes integer,
  p_sha256 text,
  p_scan_details jsonb default '{}'
)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_resume public.candidate_resumes;
  v_is_first boolean;
  v_purge jsonb;
begin
  if not exists (select 1 from public.users where id = p_user_id and status = 'active' and account_type = 'candidate') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_resume_id is null then
    select not exists (select 1 from public.candidate_resumes where user_id = p_user_id and deleted_at is null) into v_is_first;
    insert into public.candidate_resumes (user_id, label, is_primary)
    values (p_user_id, coalesce(nullif(btrim(p_label), ''), 'CV'), v_is_first)
    returning * into v_resume;
  else
    select * into v_resume from public.candidate_resumes
     where id = p_resume_id and user_id = p_user_id and deleted_at is null for update;
    if v_resume.id is null then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if p_label is not null and btrim(p_label) <> '' then
      update public.candidate_resumes set label = left(btrim(p_label), 100) where id = v_resume.id;
    end if;
  end if;

  insert into public.candidate_resume_versions (id, resume_id, user_id, storage_path, original_filename, mime_type, size_bytes, sha256, scan_status, scan_details)
  values (p_version_id, v_resume.id, p_user_id, p_storage_path, left(p_filename, 255), p_mime_type, p_size_bytes, p_sha256, 'clean', coalesce(p_scan_details, '{}'));

  update public.candidate_resumes set current_version_id = p_version_id where id = v_resume.id;

  select coalesce(jsonb_agg(jsonb_build_object('version_id', u.version_id, 'storage_path', u.storage_path)), '[]'::jsonb)
    into v_purge from app.unreferenced_versions(v_resume.id) u;

  return jsonb_build_object('resume_id', v_resume.id, 'version_id', p_version_id, 'purge', v_purge);
end;
$$;

create or replace function public.resume_delete(p_user_id uuid, p_resume_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_resume public.candidate_resumes;
  v_purge jsonb;
  v_next uuid;
begin
  select * into v_resume from public.candidate_resumes
   where id = p_resume_id and user_id = p_user_id and deleted_at is null for update;
  if v_resume.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.candidate_resumes set deleted_at = now(), is_primary = false where id = p_resume_id;
  if v_resume.is_primary then
    select id into v_next from public.candidate_resumes
     where user_id = p_user_id and deleted_at is null and current_version_id is not null
     order by updated_at desc limit 1;
    if v_next is not null then
      update public.candidate_resumes set is_primary = true where id = v_next;
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('version_id', u.version_id, 'storage_path', u.storage_path)), '[]'::jsonb)
    into v_purge from app.unreferenced_versions(p_resume_id) u;
  return jsonb_build_object('purge', v_purge, 'new_primary', v_next);
end;
$$;

create or replace function public.resume_mark_files_deleted(p_version_ids uuid[])
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.candidate_resume_versions set file_deleted_at = now()
  where id = any (p_version_ids) and file_deleted_at is null
$$;

create or replace function public.set_primary_resume(p_resume_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.candidate_resumes
    where id = p_resume_id and user_id = auth.uid() and deleted_at is null and current_version_id is not null
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.candidate_resumes set is_primary = false where user_id = auth.uid() and is_primary and id <> p_resume_id;
  update public.candidate_resumes set is_primary = true where id = p_resume_id;
end;
$$;

-- Authorise a resume download and log it. Returns the storage location; the
-- server then issues a short-lived signed URL. Raises 'forbidden' otherwise.
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
       and a.status <> 'withdrawn'
       and a.anonymized_at is null
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
-- Personal data export (right of access / portability)
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
            'sha256', v.sha256, 'created_at', v.created_at, 'file_deleted_at', v.file_deleted_at)), '[]')
          from public.candidate_resume_versions v where v.resume_id = r.id)))
      from public.candidate_resumes r where r.user_id = v_uid), '[]'),
    'applications', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'job_title', j.title, 'company', coalesce(c.display_name, c.legal_name), 'status', a.status,
        'created_at', a.created_at, 'first_viewed_at', a.first_viewed_at, 'withdrawn_at', a.withdrawn_at,
        'transmitted_data', a.candidate_snapshot, 'consent_version', a.consent_version,
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
      where l.resource_type = 'resume_version'
        and l.resource_id in (select v.id from public.candidate_resume_versions v where v.user_id = v_uid)), '[]')
  ) into v_result;

  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action)
  values (v_uid, case when app.current_account_type() = 'employer' then 'recruiter' else 'candidate' end, 'data_export', v_uid, 'export');

  return v_result;
end;
$$;
