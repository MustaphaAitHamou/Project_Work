-- =============================================================================
-- Security helpers used by RLS policies and RPCs (schema `app`, not exposed).
-- Error convention: business errors are raised with SQLSTATE P0001 and a stable
-- machine-readable message (e.g. 'profile_incomplete'); authorisation errors use
-- SQLSTATE 42501 ('forbidden'). The application maps them to translated messages.
-- =============================================================================

create or replace function app.is_active_user()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users where id = auth.uid() and status = 'active')
$$;

create or replace function app.current_account_type()
returns public.account_type
language sql stable
security definer
set search_path = ''
as $$
  select account_type from public.users where id = auth.uid() and status = 'active'
$$;

create or replace function app.my_company_id()
returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select m.company_id
  from public.company_members m
  join public.users u on u.id = m.user_id
  where m.user_id = auth.uid() and u.status = 'active'
  limit 1
$$;

create or replace function app.my_company_role()
returns public.company_member_role
language sql stable
security definer
set search_path = ''
as $$
  select m.role
  from public.company_members m
  join public.users u on u.id = m.user_id
  where m.user_id = auth.uid() and u.status = 'active'
  limit 1
$$;

create or replace function app.is_member_of(p_company_id uuid, p_user_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m join public.users u on u.id = m.user_id
    where m.company_id = p_company_id and m.user_id = p_user_id and u.status = 'active'
  )
$$;

-- Permission matrix for back-office roles (single source of truth, mirrored in src/lib/auth/permissions.ts).
create or replace function app.permission_roles(p_permission text)
returns public.admin_role[]
language sql immutable parallel safe
set search_path = ''
as $$
  select (case p_permission
    when 'dashboard.view' then array['super_admin', 'verification_officer', 'moderator', 'finance', 'privacy_officer', 'support']
    when 'companies.view' then array['super_admin', 'verification_officer', 'moderator', 'support']
    when 'companies.verify' then array['super_admin', 'verification_officer']
    when 'jobs.view' then array['super_admin', 'moderator', 'verification_officer', 'support']
    when 'jobs.moderate' then array['super_admin', 'moderator']
    when 'reports.handle' then array['super_admin', 'moderator']
    when 'users.view' then array['super_admin', 'moderator', 'support', 'privacy_officer']
    when 'users.suspend' then array['super_admin', 'moderator']
    when 'countries.manage' then array['super_admin']
    when 'pricing.manage' then array['super_admin', 'finance']
    when 'payments.view' then array['super_admin', 'finance']
    when 'payments.refund' then array['super_admin', 'finance']
    when 'privacy.handle' then array['super_admin', 'privacy_officer']
    when 'emails.manage' then array['super_admin']
    when 'audit.view' then array['super_admin', 'privacy_officer']
    when 'roles.manage' then array['super_admin']
    when 'settings.manage' then array['super_admin']
    when 'service_clients.manage' then array['super_admin']
    when 'moderation_terms.manage' then array['super_admin', 'moderator']
    else array[]::text[]
  end)::public.admin_role[]
$$;

create or replace function app.has_permission(p_permission text)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_roles r
    join public.users u on u.id = r.user_id
    where r.user_id = auth.uid()
      and u.status = 'active'
      and r.role = any (app.permission_roles(p_permission))
  )
$$;

create or replace function app.is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_roles r join public.users u on u.id = r.user_id
    where r.user_id = auth.uid() and u.status = 'active'
  )
$$;

create or replace function app.require_permission(p_permission text)
returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not app.has_permission(p_permission) then
    raise exception 'forbidden' using errcode = '42501', detail = p_permission;
  end if;
end;
$$;

create or replace function app.audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_audit_logs (actor_id, actor_roles, action, target_type, target_id, details)
  values (
    auth.uid(),
    coalesce((select array_agg(role::text order by role) from public.admin_roles where user_id = auth.uid()), '{}'),
    p_action, p_target_type, p_target_id, coalesce(p_details, '{}')
  );
end;
$$;

create or replace function app.add_internal_note(p_target_type text, p_target_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_note is not null and btrim(p_note) <> '' then
    insert into public.admin_internal_notes (target_type, target_id, note, author_id)
    values (p_target_type, p_target_id, left(btrim(p_note), 4000), auth.uid());
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------
create or replace function app.setting_int(p_key text, p_default integer)
returns integer
language sql stable
security definer
set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.platform_settings where key = p_key), p_default)
$$;

create or replace function app.setting_text(p_key text, p_default text)
returns text
language sql stable
security definer
set search_path = ''
as $$
  select coalesce((select value #>> '{}' from public.platform_settings where key = p_key), p_default)
$$;

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the call is allowed.
-- -----------------------------------------------------------------------------
create or replace function app.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Notifications & transactional e-mail outbox
-- -----------------------------------------------------------------------------
create or replace function app.notify(p_user_id uuid, p_type text, p_data jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is not null then
    insert into public.notifications (user_id, type, data) values (p_user_id, p_type, coalesce(p_data, '{}'));
  end if;
end;
$$;

-- Enqueue an e-mail for a user (respecting account status). Idempotent through dedupe_key.
create or replace function app.enqueue_email(p_user_id uuid, p_template text, p_payload jsonb, p_dedupe_key text default null, p_delay interval default interval '0')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_locale text;
begin
  select email, locale into v_email, v_locale from public.users where id = p_user_id and status <> 'deleted';
  if v_email is null or v_email = '' or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return;
  end if;
  insert into public.email_outbox (user_id, to_email, locale, template, payload, dedupe_key, send_after)
  values (p_user_id, v_email, v_locale, p_template, coalesce(p_payload, '{}'), p_dedupe_key, now() + p_delay)
  on conflict (dedupe_key) do nothing;
end;
$$;

-- Notify every active member of a company (optionally filtered by an opt-in column).
create or replace function app.enqueue_company_email(p_company_id uuid, p_template text, p_payload jsonb, p_dedupe_prefix text, p_pref text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select u.id, u.notify_application_updates, u.notify_billing
    from public.company_members m join public.users u on u.id = m.user_id
    where m.company_id = p_company_id and u.status = 'active'
  loop
    if p_pref = 'application' and not r.notify_application_updates then continue; end if;
    if p_pref = 'billing' and not r.notify_billing then continue; end if;
    perform app.enqueue_email(r.id, p_template, p_payload, case when p_dedupe_prefix is null then null else p_dedupe_prefix || ':' || r.id end);
    perform app.notify(r.id, p_template, p_payload);
  end loop;
end;
$$;

-- Visibility of a job for the public (used by policies and functions).
create or replace function app.job_is_public(p_job_id uuid)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.jobs j join public.companies c on c.id = j.company_id
    where j.id = p_job_id and j.status = 'active'
      and c.verification_status = 'verified' and c.suspended_at is null
  )
$$;
