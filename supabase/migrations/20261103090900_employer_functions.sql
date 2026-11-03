-- =============================================================================
-- Employer-side business functions: company onboarding & verification
-- bookkeeping, job lifecycle (submit / close / reopen), application handling.
-- =============================================================================

create or replace function app.unique_company_slug(p_name text)
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_base text := app.slugify(p_name, 60);
  v_slug text := v_base;
  i integer := 1;
begin
  while exists (select 1 from public.companies where slug = v_slug) loop
    i := i + 1;
    v_slug := v_base || '-' || i;
  end loop;
  return v_slug;
end;
$$;

-- Called by the server (service role) after authentication and country-specific
-- identifier validation. p_actor is the authenticated employer.
create or replace function public.create_company(p_actor uuid, p jsonb)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_country char(2) := upper(p ->> 'registration_country');
begin
  if not exists (select 1 from public.users where id = p_actor and status = 'active' and account_type = 'employer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.company_members where user_id = p_actor) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.countries where code = v_country and is_registration_open) then
    raise exception 'country_not_open' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.companies
    where registration_country = v_country
      and registration_id_type = p ->> 'registration_id_type'
      and registration_number = p ->> 'registration_number'
      and verification_status <> 'rejected'
  ) then
    raise exception 'company_already_registered' using errcode = 'P0001';
  end if;

  insert into public.companies (
    slug, legal_name, display_name, registration_country, registration_region, registration_id_type,
    registration_number, secondary_identifiers, hq_address_line1, hq_address_line2, hq_postal_code, hq_city,
    hq_region, hq_country, industry, website, description, size_range, created_by
  ) values (
    app.unique_company_slug(coalesce(nullif(p ->> 'display_name', ''), p ->> 'legal_name')),
    btrim(p ->> 'legal_name'),
    nullif(btrim(p ->> 'display_name'), ''),
    v_country,
    nullif(p ->> 'registration_region', ''),
    p ->> 'registration_id_type',
    p ->> 'registration_number',
    coalesce(p -> 'secondary_identifiers', '{}'),
    btrim(p ->> 'hq_address_line1'),
    nullif(btrim(p ->> 'hq_address_line2'), ''),
    nullif(btrim(p ->> 'hq_postal_code'), ''),
    btrim(p ->> 'hq_city'),
    nullif(btrim(p ->> 'hq_region'), ''),
    upper(coalesce(p ->> 'hq_country', v_country)),
    p ->> 'industry',
    nullif(p ->> 'website', ''),
    nullif(p ->> 'description', ''),
    nullif(p ->> 'size_range', ''),
    p_actor
  ) returning id into v_company_id;

  insert into public.company_members (company_id, user_id, role, job_title, phone, is_legal_representative)
  values (v_company_id, p_actor, 'owner', nullif(p ->> 'representative_title', ''), nullif(p ->> 'representative_phone', ''),
          coalesce((p ->> 'is_legal_representative')::boolean, false));

  return v_company_id;
end;
$$;

-- Employer edits of company registration data are only allowed before verification.
create or replace function public.update_company_registration(p_actor uuid, p_company_id uuid, p jsonb)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  if not app.is_member_of(p_company_id, p_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.companies set
    legal_name = btrim(p ->> 'legal_name'),
    registration_region = nullif(p ->> 'registration_region', ''),
    registration_id_type = p ->> 'registration_id_type',
    registration_number = p ->> 'registration_number',
    secondary_identifiers = coalesce(p -> 'secondary_identifiers', '{}'),
    hq_address_line1 = btrim(p ->> 'hq_address_line1'),
    hq_address_line2 = nullif(btrim(p ->> 'hq_address_line2'), ''),
    hq_postal_code = nullif(btrim(p ->> 'hq_postal_code'), ''),
    hq_city = btrim(p ->> 'hq_city'),
    hq_region = nullif(btrim(p ->> 'hq_region'), ''),
    verification_status = 'pending',
    verification_message = null
  where id = p_company_id and verification_status in ('pending', 'manual_review', 'rejected');
  if not found then
    raise exception 'company_locked' using errcode = 'P0001';
  end if;
  update public.company_members set
    job_title = nullif(p ->> 'representative_title', ''),
    phone = nullif(p ->> 'representative_phone', ''),
    is_legal_representative = coalesce((p ->> 'is_legal_representative')::boolean, false)
  where company_id = p_company_id and user_id = p_actor;
end;
$$;

create or replace function public.verification_start(p_actor uuid, p_company_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_member public.company_members;
  v_user public.users;
  v_email_confirmed boolean;
begin
  if not app.is_member_of(p_company_id, p_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not app.rate_limit_hit('verify:' || p_company_id::text, 10, 86400) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  update public.companies set verification_status = 'auto_check'
   where id = p_company_id and verification_status in ('pending', 'manual_review', 'rejected')
   returning * into v_company;
  if v_company.id is null then
    raise exception 'verification_not_allowed' using errcode = 'P0001';
  end if;
  select * into v_member from public.company_members where company_id = p_company_id and user_id = p_actor;
  select * into v_user from public.users where id = p_actor;
  select (email_confirmed_at is not null) into v_email_confirmed from auth.users where id = p_actor;
  return jsonb_build_object(
    'company', to_jsonb(v_company),
    'representative', jsonb_build_object(
      'first_name', v_user.first_name, 'last_name', v_user.last_name, 'email', v_user.email,
      'email_confirmed', coalesce(v_email_confirmed, false),
      'job_title', v_member.job_title, 'is_legal_representative', v_member.is_legal_representative),
    'auto_verification_enabled', (select auto_verification_enabled from public.countries where code = v_company.registration_country)
  );
end;
$$;

-- Records the automated verification report computed server-side and applies the outcome.
create or replace function public.verification_record_result(p_company_id uuid, p_outcome public.company_verification_status, p jsonb)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if p_outcome not in ('verified', 'manual_review', 'rejected') then
    raise exception 'invalid_outcome' using errcode = 'P0001';
  end if;
  select * into v_company from public.companies where id = p_company_id for update;
  if v_company.id is null or v_company.verification_status <> 'auto_check' then
    raise exception 'verification_not_in_progress' using errcode = 'P0001';
  end if;
  insert into public.company_verifications (
    company_id, outcome, method, provider, registry_found, registry_active, registry_name, registry_data,
    checks, risk_flags, score, decision_reason, submitted_by, purge_after)
  values (
    p_company_id, p_outcome, 'registry_api', p ->> 'provider', (p ->> 'registry_found')::boolean,
    (p ->> 'registry_active')::boolean, p ->> 'registry_name', coalesce(p -> 'registry_data', '{}'),
    coalesce(p -> 'checks', '[]'), coalesce(array(select jsonb_array_elements_text(p -> 'risk_flags')), '{}'),
    (p ->> 'score')::smallint, p ->> 'decision_reason', (p ->> 'submitted_by')::uuid,
    now() + make_interval(days => app.setting_int('retention.verification_days', 365)));

  update public.companies set
    verification_status = p_outcome,
    verification_message = p ->> 'message',
    verified_at = case when p_outcome = 'verified' then now() else null end
  where id = p_company_id;

  perform app.enqueue_company_email(p_company_id, 'company_verification_result',
    jsonb_build_object('outcome', p_outcome, 'company_name', coalesce(v_company.display_name, v_company.legal_name), 'message', p ->> 'message'),
    'company_verification:' || p_company_id || ':' || extract(epoch from now())::bigint);
end;
$$;

create or replace function public.verification_register_document(p_actor uuid, p_company_id uuid, p jsonb)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not app.is_member_of(p_company_id, p_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if (select count(*) from public.company_verification_documents where company_id = p_company_id and file_deleted_at is null) >= 10 then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;
  insert into public.company_verification_documents (id, company_id, doc_type, storage_path, original_filename, mime_type, size_bytes, sha256, uploaded_by, purge_after)
  values ((p ->> 'id')::uuid, p_company_id, p ->> 'doc_type', p ->> 'storage_path', left(p ->> 'filename', 255), p ->> 'mime_type',
          (p ->> 'size_bytes')::integer, p ->> 'sha256', p_actor,
          now() + make_interval(days => app.setting_int('retention.verification_documents_days', 90)))
  returning id into v_id;
  -- A document upload re-queues the file for human review.
  update public.companies set verification_status = 'manual_review'
   where id = p_company_id and verification_status in ('pending', 'rejected');
  return v_id;
end;
$$;

create or replace function public.authorize_verification_document(p_document_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_doc public.company_verification_documents;
begin
  perform app.require_permission('companies.verify');
  select * into v_doc from public.company_verification_documents where id = p_document_id and file_deleted_at is null;
  if v_doc.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action, context)
  values (auth.uid(), 'admin', 'verification_document', p_document_id, 'download', jsonb_build_object('company_id', v_doc.company_id));
  return jsonb_build_object('storage_path', v_doc.storage_path, 'filename', v_doc.original_filename, 'mime_type', v_doc.mime_type);
end;
$$;

-- -----------------------------------------------------------------------------
-- Job lifecycle
-- -----------------------------------------------------------------------------
create or replace function app.assert_job_member(p_job_id uuid)
returns public.jobs
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null or v_job.company_id is distinct from app.my_company_id() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_job;
end;
$$;

create or replace function app.close_open_applications(p_job_id uuid, p_actor text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select a.id, a.status, a.candidate_id, j.title, coalesce(c.display_name, c.legal_name) as company_name
    from public.applications a join public.jobs j on j.id = a.job_id join public.companies c on c.id = a.company_id
    where a.job_id = p_job_id and a.status in ('submitted', 'viewed', 'shortlisted')
    for update of a
  loop
    update public.applications set status = 'job_closed', status_changed_at = now() where id = r.id;
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor)
    values (r.id, r.status, 'job_closed', auth.uid(), p_actor);
    if r.candidate_id is not null and exists (select 1 from public.users where id = r.candidate_id and notify_application_updates) then
      perform app.enqueue_email(r.candidate_id, 'application_status_changed',
        jsonb_build_object('status', 'job_closed', 'job_title', r.title, 'company_name', r.company_name),
        'application_status:' || r.id || ':job_closed');
    end if;
    perform app.notify(r.candidate_id, 'application_status_changed',
      jsonb_build_object('status', 'job_closed', 'job_title', r.title, 'application_id', r.id));
  end loop;
end;
$$;

create or replace function app.request_subscription_cancellation(p_job_id uuid)
returns text[]
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_ids text[];
begin
  update public.subscriptions
     set cancel_requested_at = coalesce(cancel_requested_at, now())
   where job_id = p_job_id
     and status in ('trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete')
     and stripe_subscription_id is not null;
  select coalesce(array_agg(stripe_subscription_id), '{}') into v_ids
    from public.subscriptions
   where job_id = p_job_id and cancel_requested_at is not null and not cancel_at_period_end
     and status in ('trialing', 'active', 'past_due', 'unpaid', 'paused', 'incomplete')
     and stripe_subscription_id is not null;
  -- Abandon pending checkouts so they can never activate a closed advert.
  update public.subscriptions set status = 'checkout_expired'
   where job_id = p_job_id and status = 'checkout_pending';
  return v_ids;
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

  update public.jobs set
    status = v_next,
    moderation_flags = v_flags,
    rejection_reason = null,
    closed_at = null,
    expired_at = null,
    suspended_at = null,
    suspension_reason = null
  where id = p_job_id;

  return jsonb_build_object('status', v_next, 'flags', to_jsonb(v_flags));
end;
$$;

create or replace function public.close_job(p_job_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_ids text[];
begin
  v_job := app.assert_job_member(p_job_id);
  if v_job.status in ('closed', 'draft') then
    raise exception 'job_not_closable' using errcode = 'P0001';
  end if;
  update public.jobs set status = 'closed', closed_at = now() where id = p_job_id;
  perform app.close_open_applications(p_job_id, 'recruiter');
  v_ids := app.request_subscription_cancellation(p_job_id);
  return jsonb_build_object('status', 'closed', 'cancel_subscription_ids', to_jsonb(v_ids));
end;
$$;

-- Re-open a closed advert while its paid period is still running (renewal resumes).
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
  if v_sub.id is null then
    raise exception 'reopen_requires_payment' using errcode = 'P0001';
  end if;
  if (v_job.application_deadline is not null and v_job.application_deadline < current_date) then
    raise exception 'deadline_past' using errcode = 'P0001';
  end if;
  update public.jobs set status = 'active', closed_at = null where id = p_job_id;
  update public.subscriptions set cancel_requested_at = null where id = v_sub.id;
  return jsonb_build_object('status', 'active', 'resume_subscription_id', v_sub.stripe_subscription_id);
end;
$$;

create or replace function public.delete_draft_job(p_job_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
begin
  v_job := app.assert_job_member(p_job_id);
  if v_job.status not in ('draft', 'rejected')
     or exists (select 1 from public.subscriptions where job_id = p_job_id)
     or exists (select 1 from public.applications where job_id = p_job_id) then
    raise exception 'job_not_deletable' using errcode = 'P0001';
  end if;
  delete from public.jobs where id = p_job_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Recruiter handling of applications (no messaging; status changes only)
-- -----------------------------------------------------------------------------
create or replace function app.assert_application_access(p_application_id uuid)
returns public.applications
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_application_id for update;
  if v_app.id is null
     or v_app.company_id is distinct from app.my_company_id()
     or v_app.status = 'withdrawn'
     or v_app.anonymized_at is not null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_app;
end;
$$;

create or replace function app.application_status_notification(p_app public.applications, p_status public.application_status)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_company text;
begin
  select j.title, coalesce(c.display_name, c.legal_name) into v_title, v_company
    from public.jobs j join public.companies c on c.id = j.company_id where j.id = p_app.job_id;
  perform app.notify(p_app.candidate_id, 'application_status_changed',
    jsonb_build_object('status', p_status, 'job_title', v_title, 'application_id', p_app.id));
  if p_app.candidate_id is not null and exists (select 1 from public.users where id = p_app.candidate_id and notify_application_updates) then
    perform app.enqueue_email(p_app.candidate_id, 'application_status_changed',
      jsonb_build_object('status', p_status, 'job_title', v_title, 'company_name', v_company),
      'application_status:' || p_app.id || ':' || p_status);
  end if;
end;
$$;

-- Called when an authorised recruiter actually opens the application detail.
create or replace function public.recruiter_mark_viewed(p_application_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
begin
  v_app := app.assert_application_access(p_application_id);
  if v_app.first_viewed_at is null then
    update public.applications set first_viewed_at = now() where id = p_application_id;
    insert into public.data_access_logs (actor_id, actor_kind, resource_type, resource_id, action)
    values (auth.uid(), 'recruiter', 'application', p_application_id, 'view');
  end if;
  if v_app.status = 'submitted' then
    update public.applications set status = 'viewed', status_changed_at = now() where id = p_application_id;
    insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor)
    values (p_application_id, 'submitted', 'viewed', auth.uid(), 'recruiter');
    perform app.application_status_notification(v_app, 'viewed');
  end if;
end;
$$;

create or replace function public.recruiter_set_application_status(p_application_id uuid, p_status public.application_status)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_app public.applications;
  v_job_status public.job_status;
begin
  if p_status not in ('viewed', 'shortlisted', 'rejected', 'hired') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  v_app := app.assert_application_access(p_application_id);
  if v_app.status = p_status then
    return;
  end if;
  select status into v_job_status from public.jobs where id = v_app.job_id;
  if v_app.status = 'job_closed' and v_job_status <> 'active' and p_status not in ('rejected', 'hired') then
    raise exception 'job_closed' using errcode = 'P0001';
  end if;
  update public.applications
     set status = p_status, status_changed_at = now(), first_viewed_at = coalesce(first_viewed_at, now())
   where id = p_application_id;
  insert into public.application_status_history (application_id, from_status, to_status, changed_by, actor)
  values (p_application_id, v_app.status, p_status, auth.uid(), 'recruiter');
  perform app.application_status_notification(v_app, p_status);
end;
$$;

create or replace function public.recruiter_update_application(p_application_id uuid, p_rating smallint default null, p_archived boolean default null, p_clear_rating boolean default false)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.assert_application_access(p_application_id);
  update public.applications set
    recruiter_rating = case when p_clear_rating then null else coalesce(p_rating, recruiter_rating) end,
    is_archived = coalesce(p_archived, is_archived)
  where id = p_application_id;
end;
$$;
