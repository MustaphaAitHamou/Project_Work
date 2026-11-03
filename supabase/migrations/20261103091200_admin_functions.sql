-- =============================================================================
-- Back-office functions (permission-checked, audited atomically), dashboard
-- statistics, Tamurt HQ aggregate metrics, maintenance & retention, account
-- deletion preparation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Companies
-- -----------------------------------------------------------------------------
create or replace function public.admin_review_company(p_company_id uuid, p_decision text, p_message text default null, p_internal_note text default null)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_outcome public.company_verification_status;
begin
  perform app.require_permission('companies.verify');
  if p_decision not in ('verified', 'rejected', 'manual_review') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and coalesce(btrim(p_message), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_company from public.companies where id = p_company_id for update;
  if v_company.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  v_outcome := p_decision::public.company_verification_status;

  update public.companies set
    verification_status = v_outcome,
    verification_message = nullif(btrim(p_message), ''),
    verified_at = case when v_outcome = 'verified' then now() else null end
  where id = p_company_id;

  insert into public.company_verifications (company_id, outcome, method, decision_reason, reviewed_by, reviewed_at, purge_after)
  values (p_company_id, v_outcome, 'manual', nullif(btrim(p_message), ''), auth.uid(), now(),
          now() + make_interval(days => app.setting_int('retention.verification_days', 365)));

  perform app.add_internal_note('company', p_company_id, p_internal_note);
  perform app.audit('company.review', 'company', p_company_id::text,
    jsonb_build_object('decision', p_decision, 'previous_status', v_company.verification_status));
  perform app.enqueue_company_email(p_company_id, 'company_verification_result',
    jsonb_build_object('outcome', v_outcome, 'company_name', coalesce(v_company.display_name, v_company.legal_name), 'message', p_message),
    'company_verification:' || p_company_id || ':' || extract(epoch from now())::bigint);
end;
$$;

create or replace function public.admin_set_company_suspension(p_company_id uuid, p_suspend boolean, p_reason text, p_internal_note text default null)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_ids text[] := '{}';
  r record;
begin
  perform app.require_permission('companies.verify');
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_company from public.companies where id = p_company_id for update;
  if v_company.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_suspend then
    update public.companies set suspended_at = now(), suspension_reason = p_reason, verification_status = 'suspended' where id = p_company_id;
    for r in select id from public.jobs where company_id = p_company_id and status in ('active', 'pending_payment', 'in_review') loop
      update public.jobs set status = 'suspended', suspended_at = now(), suspension_reason = 'company_suspended' where id = r.id;
      v_ids := v_ids || app.request_subscription_cancellation(r.id);
    end loop;
  else
    update public.companies set suspended_at = null, suspension_reason = null, verification_status = 'verified',
                                verified_at = coalesce(verified_at, now())
     where id = p_company_id;
  end if;
  perform app.add_internal_note('company', p_company_id, p_internal_note);
  perform app.audit(case when p_suspend then 'company.suspend' else 'company.unsuspend' end, 'company', p_company_id::text,
                    jsonb_build_object('reason', p_reason));
  return jsonb_build_object('cancel_subscription_ids', to_jsonb(v_ids));
end;
$$;

-- -----------------------------------------------------------------------------
-- Job moderation
-- -----------------------------------------------------------------------------
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
    v_next := (case when v_live then 'active' else 'pending_payment' end)::public.job_status;
    update public.jobs set status = v_next, rejection_reason = null,
           moderation_approved_hash = app.job_content_hash(v_job),
           published_at = case when v_next = 'active' then coalesce(published_at, now()) else published_at end
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
    v_next := (case when v_live then 'active' else 'pending_payment' end)::public.job_status;
    update public.jobs set status = v_next, suspended_at = null, suspension_reason = null, rejection_reason = null where id = p_job_id;
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

-- -----------------------------------------------------------------------------
-- Users & roles
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_status(p_user_id uuid, p_status public.user_status, p_reason text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_user public.users;
begin
  perform app.require_permission('users.suspend');
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_target_self' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.admin_roles where user_id = p_user_id and role = 'super_admin')
     and not exists (select 1 from public.admin_roles where user_id = auth.uid() and role = 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_user from public.users where id = p_user_id for update;
  if v_user.id is null or v_user.status = 'deleted' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.users set status = p_status, suspended_reason = case when p_status = 'suspended' then p_reason end where id = p_user_id;
  perform app.audit(case when p_status = 'suspended' then 'user.suspend' else 'user.reactivate' end, 'user', p_user_id::text,
                    jsonb_build_object('reason', p_reason));
  if p_status = 'suspended' then
    perform app.enqueue_email(p_user_id, 'account_suspended', jsonb_build_object('reason', p_reason), 'account_suspended:' || p_user_id || ':' || extract(epoch from now())::bigint);
  end if;
end;
$$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.admin_role, p_grant boolean)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('roles.manage');
  if not exists (select 1 from public.users where id = p_user_id and status = 'active') then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_grant then
    insert into public.admin_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid()) on conflict do nothing;
  else
    if p_role = 'super_admin' and (select count(*) from public.admin_roles where role = 'super_admin') <= 1 then
      raise exception 'last_super_admin' using errcode = 'P0001';
    end if;
    delete from public.admin_roles where user_id = p_user_id and role = p_role;
  end if;
  perform app.audit(case when p_grant then 'role.grant' else 'role.revoke' end, 'user', p_user_id::text, jsonb_build_object('role', p_role));
end;
$$;

-- Bootstrap: grant the very first super_admin (service role only, used by scripts/grant-admin.ts).
create or replace function public.bootstrap_super_admin(p_email text)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.users where lower(email) = lower(p_email) and status = 'active';
  if v_id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  insert into public.admin_roles (user_id, role) values (v_id, 'super_admin') on conflict do nothing;
  insert into public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  values (null, 'role.bootstrap', 'user', v_id::text, jsonb_build_object('role', 'super_admin'));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Countries & compliance
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_country(p_code text, p jsonb, p_override_justification text default null)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_country public.countries;
  v_enable_paid boolean := coalesce((p ->> 'is_paid_publishing_enabled')::boolean, false);
  v_open_items integer;
begin
  perform app.require_permission('countries.manage');
  select * into v_country from public.countries where code = upper(p_code) for update;
  if v_country.code is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_enable_paid and not v_country.is_paid_publishing_enabled then
    select count(*) into v_open_items from public.country_compliance_items
     where country_code = v_country.code and is_blocking and status not in ('done', 'not_applicable');
    if v_open_items > 0 and char_length(coalesce(btrim(p_override_justification), '')) < 30 then
      raise exception 'compliance_incomplete' using errcode = 'P0001', detail = v_open_items::text;
    end if;
  end if;
  update public.countries set
    is_browsable = coalesce((p ->> 'is_browsable')::boolean, is_browsable),
    is_registration_open = coalesce((p ->> 'is_registration_open')::boolean, is_registration_open),
    is_paid_publishing_enabled = v_enable_paid,
    auto_verification_enabled = coalesce((p ->> 'auto_verification_enabled')::boolean, auto_verification_enabled),
    compliance_status = coalesce(p ->> 'compliance_status', compliance_status),
    compliance_notes = coalesce(p ->> 'compliance_notes', compliance_notes)
  where code = v_country.code;
  perform app.audit('country.update', 'country', v_country.code,
    jsonb_build_object('changes', p, 'override_justification', p_override_justification, 'open_blocking_items', v_open_items));
end;
$$;

create or replace function public.admin_update_compliance_item(p_id uuid, p_status public.compliance_item_status, p_notes text, p_evidence_url text default null)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('countries.manage');
  update public.country_compliance_items
     set status = p_status, notes = p_notes, evidence_url = nullif(btrim(p_evidence_url), ''), updated_by = auth.uid(), updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform app.audit('compliance.update', 'compliance_item', p_id::text, jsonb_build_object('status', p_status));
end;
$$;

-- -----------------------------------------------------------------------------
-- Pricing (no hard-coded price in the UI: everything comes from this catalogue)
-- -----------------------------------------------------------------------------
create or replace function public.admin_upsert_pricing_plan(p_country text, p_currency text, p_unit_amount integer, p_tax_behavior text, p_notes text default null)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_old public.pricing_plans;
begin
  perform app.require_permission('pricing.manage');
  if p_unit_amount is null or p_unit_amount <= 0 or p_unit_amount > 1000000 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  select * into v_old from public.pricing_plans
   where is_active and code = 'job_monthly' and coalesce(country_code, '**') = coalesce(upper(p_country), '**') and currency = upper(p_currency)
   for update;
  -- Prices are immutable once used: a change creates a new plan; existing subscriptions keep their price.
  update public.pricing_plans set is_active = false where id = v_old.id;
  insert into public.pricing_plans (code, country_code, currency, unit_amount, tax_behavior, notes, created_by)
  values ('job_monthly', nullif(upper(p_country), ''), upper(p_currency), p_unit_amount, coalesce(p_tax_behavior, 'exclusive'), p_notes, auth.uid())
  returning id into v_id;
  perform app.audit('pricing.upsert', 'pricing_plan', v_id::text,
    jsonb_build_object('country', p_country, 'currency', p_currency, 'unit_amount', p_unit_amount, 'previous_plan', v_old.id, 'previous_amount', v_old.unit_amount));
  return v_id;
end;
$$;

create or replace function public.admin_deactivate_pricing_plan(p_plan_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('pricing.manage');
  update public.pricing_plans set is_active = false where id = p_plan_id;
  perform app.audit('pricing.deactivate', 'pricing_plan', p_plan_id::text, '{}');
end;
$$;

create or replace function public.billing_set_plan_stripe_ids(p_plan_id uuid, p_product_id text, p_price_id text)
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.pricing_plans set stripe_product_id = p_product_id, stripe_price_id = p_price_id where id = p_plan_id
$$;

-- -----------------------------------------------------------------------------
-- Reports, privacy requests, templates, moderation terms, settings
-- -----------------------------------------------------------------------------
create or replace function public.admin_handle_report(p_report_id uuid, p_status public.report_status, p_note text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('reports.handle');
  update public.reports set status = p_status, resolution_note = p_note, handled_by = auth.uid(), handled_at = now()
   where id = p_report_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform app.audit('report.handle', 'report', p_report_id::text, jsonb_build_object('status', p_status));
end;
$$;

create or replace function public.admin_handle_privacy_request(p_request_id uuid, p_status public.privacy_request_status, p_response text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_req public.privacy_requests;
begin
  perform app.require_permission('privacy.handle');
  update public.privacy_requests set status = p_status, response = p_response, handled_by = auth.uid(), handled_at = now()
   where id = p_request_id returning * into v_req;
  if v_req.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform app.audit('privacy_request.handle', 'privacy_request', p_request_id::text, jsonb_build_object('status', p_status));
  if p_status in ('completed', 'rejected') and v_req.user_id is not null then
    perform app.enqueue_email(v_req.user_id, 'privacy_request_update',
      jsonb_build_object('type', v_req.type, 'status', p_status, 'response', p_response),
      'privacy_request:' || p_request_id || ':' || p_status);
  end if;
end;
$$;

create or replace function public.admin_upsert_email_template(p_template text, p_locale text, p_subject text, p_body text, p_is_active boolean)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('emails.manage');
  insert into public.email_templates (template, locale, subject, body, is_active, updated_by, updated_at)
  values (p_template, p_locale, p_subject, p_body, p_is_active, auth.uid(), now())
  on conflict (template, locale) do update set subject = excluded.subject, body = excluded.body,
    is_active = excluded.is_active, updated_by = excluded.updated_by, updated_at = now();
  perform app.audit('email_template.upsert', 'email_template', p_template || ':' || p_locale, jsonb_build_object('active', p_is_active));
end;
$$;

create or replace function public.admin_delete_email_template(p_template text, p_locale text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('emails.manage');
  delete from public.email_templates where template = p_template and locale = p_locale;
  perform app.audit('email_template.delete', 'email_template', p_template || ':' || p_locale, '{}');
end;
$$;

create or replace function public.admin_upsert_moderation_term(p_id uuid, p_code text, p_category text, p_language text, p_pattern text, p_description text, p_is_active boolean)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.require_permission('moderation_terms.manage');
  perform regexp_like('', p_pattern);  -- validates the regular expression
  if p_id is null then
    insert into public.moderation_terms (code, category, language, pattern, description, is_active, created_by)
    values (p_code, p_category, nullif(p_language, ''), p_pattern, p_description, p_is_active, auth.uid()) returning id into v_id;
  else
    update public.moderation_terms set code = p_code, category = p_category, language = nullif(p_language, ''),
      pattern = p_pattern, description = p_description, is_active = p_is_active where id = p_id returning id into v_id;
  end if;
  perform app.audit('moderation_term.upsert', 'moderation_term', v_id::text, jsonb_build_object('code', p_code, 'active', p_is_active));
  return v_id;
end;
$$;

create or replace function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('settings.manage');
  update public.platform_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform app.audit('setting.update', 'setting', p_key, jsonb_build_object('value', p_value));
end;
$$;

-- -----------------------------------------------------------------------------
-- Service API clients (Tamurt HQ)
-- -----------------------------------------------------------------------------
create or replace function public.admin_create_service_client(p_name text, p_token_prefix text, p_token_hash text, p_scopes text[], p_allowed_ips text[] default '{}')
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.require_permission('service_clients.manage');
  if exists (select 1 from unnest(p_scopes) s where s not in ('metrics:read')) then
    raise exception 'invalid_scope' using errcode = 'P0001';
  end if;
  insert into public.service_api_clients (name, token_prefix, token_hash, scopes, allowed_ips, created_by)
  values (p_name, p_token_prefix, p_token_hash, p_scopes, coalesce(p_allowed_ips, '{}'), auth.uid()) returning id into v_id;
  perform app.audit('service_client.create', 'service_client', v_id::text, jsonb_build_object('name', p_name, 'scopes', p_scopes));
  return v_id;
end;
$$;

create or replace function public.admin_revoke_service_client(p_id uuid)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('service_clients.manage');
  update public.service_api_clients set revoked_at = now() where id = p_id and revoked_at is null;
  perform app.audit('service_client.revoke', 'service_client', p_id::text, '{}');
end;
$$;

create or replace function public.service_client_authenticate(p_token_hash text)
returns jsonb
language sql volatile
security definer
set search_path = ''
as $$
  update public.service_api_clients set last_used_at = now()
   where token_hash = p_token_hash and revoked_at is null
  returning jsonb_build_object('id', id, 'name', name, 'scopes', scopes, 'allowed_ips', allowed_ips)
$$;

-- -----------------------------------------------------------------------------
-- Dashboard statistics
-- -----------------------------------------------------------------------------
create or replace function app.money_by_currency(p_rows jsonb)
returns jsonb
language sql immutable
set search_path = ''
as $$ select coalesce(p_rows, '[]'::jsonb) $$;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform app.require_permission('dashboard.view');
  select jsonb_build_object(
    'generated_at', now(),
    'candidates', (select count(*) from public.users where account_type = 'candidate' and status <> 'deleted'),
    'employers', (select count(*) from public.users where account_type = 'employer' and status <> 'deleted'),
    'companies_total', (select count(*) from public.companies),
    'companies_verified', (select count(*) from public.companies where verification_status = 'verified'),
    'verifications_pending', (select count(*) from public.companies where verification_status in ('pending', 'auto_check', 'manual_review')),
    'jobs_active', (select count(*) from public.jobs where status = 'active'),
    'jobs_in_review', (select count(*) from public.jobs where status = 'in_review'),
    'jobs_expired', (select count(*) from public.jobs where status = 'expired'),
    'jobs_closed', (select count(*) from public.jobs where status = 'closed'),
    'applications_total', (select count(*) from public.applications),
    'applications_30d', (select count(*) from public.applications where created_at > now() - interval '30 days'),
    'applications_by_country', coalesce((
      select jsonb_agg(jsonb_build_object('country_code', country_code, 'count', n) order by n desc)
      from (select l.country_code, count(*) as n from public.applications a
            join public.job_locations l on l.job_id = a.job_id and l.is_primary group by l.country_code) t), '[]'),
    'subscriptions_active', (select count(*) from public.subscriptions where status in ('active', 'trialing', 'past_due')),
    'subscriptions_new_30d', (select count(*) from public.subscriptions where stripe_subscription_id is not null and created_at > now() - interval '30 days'),
    'cancellations_30d', (select count(*) from public.subscriptions where canceled_at > now() - interval '30 days'),
    'mrr', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount))
      from (select currency, sum(unit_amount) as amount from public.subscriptions
            where status in ('active', 'trialing', 'past_due') and currency is not null group by currency) t), '[]'),
    'revenue_30d', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount))
      from (select currency, sum(amount - amount_refunded) as amount from public.payments
            where status in ('succeeded', 'partially_refunded', 'refunded') and created_at > now() - interval '30 days' group by currency) t), '[]'),
    'revenue_total', coalesce((
      select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount))
      from (select currency, sum(amount - amount_refunded) as amount from public.payments
            where status in ('succeeded', 'partially_refunded', 'refunded') group by currency) t), '[]'),
    'payments_failed_30d', (select count(*) from public.payments where status = 'failed' and created_at > now() - interval '30 days'),
    'reports_open', (select count(*) from public.reports where status in ('open', 'in_review')),
    'privacy_requests_open', (select count(*) from public.privacy_requests where status in ('open', 'in_progress')),
    'email_backlog', (select count(*) from public.email_outbox where status in ('pending', 'failed') and attempts < 8),
    'webhook_errors_7d', (select count(*) from public.stripe_events where last_error is not null and processed_at is null and received_at > now() - interval '7 days')
  ) into v;
  return v;
end;
$$;

create or replace function public.admin_timeseries(p_weeks integer default 12)
returns table (week_start date, candidates bigint, employers bigint, jobs_published bigint, applications bigint, subscriptions bigint, revenue jsonb)
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  perform app.require_permission('dashboard.view');
  return query
  with weeks as (
    select generate_series(date_trunc('week', now()) - make_interval(weeks => least(greatest(p_weeks, 1), 104) - 1),
                           date_trunc('week', now()), interval '1 week')::date as ws
  )
  select w.ws,
    (select count(*) from public.users u where u.account_type = 'candidate' and u.created_at >= w.ws and u.created_at < w.ws + 7),
    (select count(*) from public.users u where u.account_type = 'employer' and u.created_at >= w.ws and u.created_at < w.ws + 7),
    (select count(*) from public.jobs j where j.published_at >= w.ws and j.published_at < w.ws + 7),
    (select count(*) from public.applications a where a.created_at >= w.ws and a.created_at < w.ws + 7),
    (select count(*) from public.subscriptions s where s.stripe_subscription_id is not null and s.created_at >= w.ws and s.created_at < w.ws + 7),
    coalesce((select jsonb_object_agg(t.currency, t.amount) from (
      select p.currency, sum(p.amount - p.amount_refunded) as amount from public.payments p
      where p.status in ('succeeded', 'partially_refunded', 'refunded') and p.created_at >= w.ws and p.created_at < w.ws + 7
      group by p.currency) t), '{}'::jsonb)
  from weeks w
  order by w.ws;
end;
$$;

-- Aggregates only (no personal data) for Tamurt HQ. Service role only.
create or replace function public.hq_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'generated_at', now(),
    'companies', jsonb_build_object(
      'total', (select count(*) from public.companies),
      'verified', (select count(*) from public.companies where verification_status = 'verified'),
      'new_in_period', (select count(*) from public.companies where created_at >= p_from and created_at < p_to)),
    'candidates', jsonb_build_object(
      'total', (select count(*) from public.users where account_type = 'candidate' and status <> 'deleted'),
      'new_in_period', (select count(*) from public.users where account_type = 'candidate' and created_at >= p_from and created_at < p_to)),
    'jobs', jsonb_build_object(
      'active', (select count(*) from public.jobs where status = 'active'),
      'published_in_period', (select count(*) from public.jobs where published_at >= p_from and published_at < p_to)),
    'applications', jsonb_build_object(
      'total', (select count(*) from public.applications),
      'in_period', (select count(*) from public.applications where created_at >= p_from and created_at < p_to)),
    'subscriptions', jsonb_build_object(
      'active', (select count(*) from public.subscriptions where status in ('active', 'trialing', 'past_due')),
      'new_in_period', (select count(*) from public.subscriptions where stripe_subscription_id is not null and created_at >= p_from and created_at < p_to),
      'canceled_in_period', (select count(*) from public.subscriptions where canceled_at >= p_from and canceled_at < p_to)),
    'revenue', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'net_amount_minor', amount))
      from (select currency, sum(amount - amount_refunded) as amount from public.payments
            where status in ('succeeded', 'partially_refunded', 'refunded') and created_at >= p_from and created_at < p_to group by currency) t), '[]'),
    'mrr', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount_minor', amount))
      from (select currency, sum(unit_amount) as amount from public.subscriptions
            where status in ('active', 'trialing', 'past_due') and currency is not null group by currency) t), '[]'),
    'geography', coalesce((select jsonb_agg(jsonb_build_object('country_code', c.code, 'active_jobs', coalesce(a.n, 0),
                                                               'applications_in_period', coalesce(b.n, 0),
                                                               'verified_companies', coalesce(v.n, 0)) order by c.sort_order)
      from public.countries c
      left join (select l.country_code, count(*) n from public.jobs j join public.job_locations l on l.job_id = j.id and l.is_primary
                 where j.status = 'active' group by l.country_code) a on a.country_code = c.code
      left join (select l.country_code, count(*) n from public.applications ap join public.job_locations l on l.job_id = ap.job_id and l.is_primary
                 where ap.created_at >= p_from and ap.created_at < p_to group by l.country_code) b on b.country_code = c.code
      left join (select registration_country, count(*) n from public.companies where verification_status = 'verified' group by registration_country) v
             on v.registration_country = c.code), '[]'),
    'operations', jsonb_build_object(
      'verifications_pending', (select count(*) from public.companies where verification_status in ('pending', 'auto_check', 'manual_review')),
      'jobs_in_review', (select count(*) from public.jobs where status = 'in_review'),
      'open_reports', (select count(*) from public.reports where status in ('open', 'in_review')),
      'email_backlog', (select count(*) from public.email_outbox where status in ('pending', 'failed') and attempts < 8),
      'payment_failures_in_period', (select count(*) from public.payments where status = 'failed' and created_at >= p_from and created_at < p_to),
      'webhook_errors', (select count(*) from public.stripe_events where last_error is not null and processed_at is null))
  )
$$;

-- -----------------------------------------------------------------------------
-- E-mail outbox processing (service role)
-- -----------------------------------------------------------------------------
create or replace function public.email_claim_batch(p_limit integer default 25)
returns setof public.email_outbox
language sql volatile
security definer
set search_path = ''
as $$
  update public.email_outbox o set status = 'sending', locked_at = now(), attempts = o.attempts + 1
  where o.id in (
    select id from public.email_outbox
    where (status = 'pending' or (status = 'failed' and attempts < 8)
           or (status = 'sending' and locked_at < now() - interval '10 minutes'))
      and send_after <= now()
    order by created_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  returning o.*
$$;

create or replace function public.email_complete(p_id uuid, p_ok boolean, p_error text, p_provider text, p_provider_message_id text)
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.email_outbox set
    status = case when p_ok then 'sent'::public.email_status else 'failed'::public.email_status end,
    sent_at = case when p_ok then now() else null end,
    last_error = case when p_ok then null else left(p_error, 1000) end,
    provider = p_provider,
    provider_message_id = p_provider_message_id,
    locked_at = null,
    -- exponential backoff for retries: 1, 2, 4, 8... minutes
    send_after = case when p_ok then send_after else now() + make_interval(mins => power(2, least(attempts, 10))::integer) end
  where id = p_id
$$;

-- -----------------------------------------------------------------------------
-- Maintenance & retention (service role, run by the scheduled job)
-- -----------------------------------------------------------------------------
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
begin
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
    'suspended_for_payment', v_suspended,
    'expired_by_deadline', v_expired,
    'applications_anonymized', v_anonymized,
    'cancel_subscription_ids', to_jsonb(array(select distinct unnest(v_cancel))),
    'resume_files_to_delete', v_resume_purge,
    'verification_documents_to_delete', v_doc_purge
  );
end;
$$;

create or replace function public.verification_documents_mark_deleted(p_ids uuid[])
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.company_verification_documents set file_deleted_at = now() where id = any (p_ids) and file_deleted_at is null
$$;

-- -----------------------------------------------------------------------------
-- Account deletion (right to erasure). Prepares the deletion; the server then
-- deletes the storage files and the auth user (which cascades).
-- -----------------------------------------------------------------------------
create or replace function public.privacy_prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_user public.users;
  v_files jsonb;
  v_cancel text[] := '{}';
  v_company uuid;
  r record;
begin
  select * into v_user from public.users where id = p_user_id for update;
  if v_user.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  -- Candidate: anonymise applications (recruiters lose access) and collect CV files.
  update public.applications set
    status = case when status in ('submitted', 'viewed', 'shortlisted') then 'withdrawn'::public.application_status else status end,
    withdrawn_at = coalesce(withdrawn_at, now()),
    candidate_snapshot = jsonb_build_object('anonymized', true),
    resume_version_id = null,
    anonymized_at = now()
  where candidate_id = p_user_id;

  select coalesce(jsonb_agg(storage_path), '[]') into v_files
    from public.candidate_resume_versions where user_id = p_user_id and file_deleted_at is null;

  -- Employer: when the user is the last member, the company's adverts are closed and renewals stopped.
  select company_id into v_company from public.company_members where user_id = p_user_id;
  if v_company is not null and not exists (
    select 1 from public.company_members m join public.users u on u.id = m.user_id
    where m.company_id = v_company and m.user_id <> p_user_id and u.status = 'active') then
    for r in select id from public.jobs where company_id = v_company and status in ('active', 'pending_payment', 'in_review', 'suspended') loop
      update public.jobs set status = 'closed', closed_at = now() where id = r.id;
      perform app.close_open_applications(r.id, 'system');
      v_cancel := v_cancel || app.request_subscription_cancellation(r.id);
    end loop;
  end if;

  update public.users set status = 'deleted', deleted_at = now() where id = p_user_id;
  insert into public.admin_audit_logs (actor_id, action, target_type, target_id, details)
  values (null, 'user.delete', 'user', p_user_id::text, jsonb_build_object('account_type', v_user.account_type));

  return jsonb_build_object('resume_files', v_files, 'cancel_subscription_ids', to_jsonb(v_cancel));
end;
$$;
