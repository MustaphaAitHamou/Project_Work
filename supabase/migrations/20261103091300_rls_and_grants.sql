-- =============================================================================
-- Row Level Security and explicit privileges.
-- Principle: deny by default. Every table has RLS enabled; anon/authenticated
-- receive only the privileges listed here (column-level where relevant).
-- Business state transitions (statuses, verification, billing) are never
-- writable directly: they go through SECURITY DEFINER functions.
-- =============================================================================

-- 0. Reset privileges (independent of the platform's default privileges)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on schema app from public, anon, authenticated;
revoke execute on all functions in schema app from public, anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema app to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema app to service_role;

-- Helpers evaluated inside RLS policies / defaults / generated columns.
grant execute on function
  app.is_active_user(), app.current_account_type(), app.my_company_id(), app.my_company_role(),
  app.has_permission(text), app.permission_roles(text), app.is_admin(), app.job_is_public(uuid),
  app.normalize_text(text), app.immutable_unaccent(text), app.generate_public_id(integer), app.slugify(text, integer),
  app.touch_updated_at(), app.haversine_km(double precision, double precision, double precision, double precision),
  app.is_member_of(uuid, uuid)
to anon, authenticated;

-- 1. Enable RLS everywhere
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Reference data (public read)
-- -----------------------------------------------------------------------------
grant select on public.currencies, public.countries, public.geo_regions, public.geo_cities, public.industries to anon, authenticated;
create policy currencies_read on public.currencies for select to anon, authenticated using (true);
create policy countries_read on public.countries for select to anon, authenticated using (true);
create policy geo_regions_read on public.geo_regions for select to anon, authenticated using (true);
create policy geo_cities_read on public.geo_cities for select to anon, authenticated using (true);
create policy industries_read on public.industries for select to anon, authenticated using (true);

grant select on public.pricing_plans to anon, authenticated;
create policy pricing_plans_read on public.pricing_plans for select to anon, authenticated
  using (is_active or (select app.has_permission('pricing.manage')));

grant select on public.platform_settings to anon, authenticated;
create policy platform_settings_read on public.platform_settings for select to anon, authenticated
  using (is_public or (select app.has_permission('settings.manage')));

grant select on public.country_compliance_items to authenticated;
create policy compliance_items_admin_read on public.country_compliance_items for select to authenticated
  using ((select app.has_permission('countries.manage')) or (select app.has_permission('dashboard.view')));

-- -----------------------------------------------------------------------------
-- 3. Users & roles
-- -----------------------------------------------------------------------------
grant select on public.users to authenticated;
grant update (first_name, last_name, locale, notify_application_updates, notify_job_alerts, notify_billing) on public.users to authenticated;
create policy users_self_read on public.users for select to authenticated
  using (id = (select auth.uid()) or (select app.has_permission('users.view')));
create policy users_self_update on public.users for update to authenticated
  using (id = (select auth.uid()) and status = 'active')
  with check (id = (select auth.uid()));

grant select on public.admin_roles to authenticated;
create policy admin_roles_read on public.admin_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select app.has_permission('roles.manage')));

-- -----------------------------------------------------------------------------
-- 4. Candidate data (owner only; recruiters receive snapshots via applications)
-- -----------------------------------------------------------------------------
grant select on public.candidate_profiles to authenticated;
grant update (headline, summary, country_code, region_code, city, phone, skills, languages, desired_contract_types,
              desired_work_time, remote_preference, willing_to_relocate, mobility_countries, years_of_experience)
  on public.candidate_profiles to authenticated;
create policy candidate_profiles_owner_read on public.candidate_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy candidate_profiles_owner_update on public.candidate_profiles for update to authenticated
  using (user_id = (select auth.uid()) and (select app.is_active_user()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.candidate_experiences, public.candidate_educations to authenticated;
create policy candidate_experiences_owner on public.candidate_experiences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select app.is_active_user()));
create policy candidate_educations_owner on public.candidate_educations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select app.is_active_user()));

grant select on public.candidate_resumes, public.candidate_resume_versions to authenticated;
grant update (label) on public.candidate_resumes to authenticated;
create policy candidate_resumes_owner_read on public.candidate_resumes for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);
create policy candidate_resumes_owner_update on public.candidate_resumes for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null)
  with check (user_id = (select auth.uid()));
create policy candidate_resume_versions_owner_read on public.candidate_resume_versions for select to authenticated
  using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. Companies (members & admins). Public data: public.public_companies view.
-- -----------------------------------------------------------------------------
grant select on public.companies to authenticated;
grant update (display_name, industry, website, description, size_range, logo_path) on public.companies to authenticated;
create policy companies_member_read on public.companies for select to authenticated
  using (id = (select app.my_company_id()) or (select app.has_permission('companies.view')));
create policy companies_member_update on public.companies for update to authenticated
  using (id = (select app.my_company_id()) and (select app.my_company_role()) in ('owner', 'admin') and suspended_at is null)
  with check (id = (select app.my_company_id()));

grant select on public.company_members to authenticated;
create policy company_members_read on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or company_id = (select app.my_company_id()) or (select app.has_permission('companies.view')));

grant select on public.company_verifications, public.company_verification_documents to authenticated;
create policy company_verifications_admin_read on public.company_verifications for select to authenticated
  using ((select app.has_permission('companies.verify')));
create policy company_verification_documents_read on public.company_verification_documents for select to authenticated
  using ((select app.has_permission('companies.verify')) or company_id = (select app.my_company_id()));

-- -----------------------------------------------------------------------------
-- 6. Jobs (members & admins). Public data: public.public_jobs & search_jobs().
-- -----------------------------------------------------------------------------
grant select on public.jobs to authenticated;
grant insert (company_id, title, description, missions, profile_sought, required_skills, optional_skills, contract_type,
              work_time, work_mode, remote_scope, remote_countries, salary_min, salary_max, salary_currency, salary_period,
              benefits, experience_level, industry, working_languages, work_authorization, eligibility_notes, start_date,
              application_deadline, positions_count, created_by)
  on public.jobs to authenticated;
grant update (title, description, missions, profile_sought, required_skills, optional_skills, contract_type, work_time,
              work_mode, remote_scope, remote_countries, salary_min, salary_max, salary_currency, salary_period, benefits,
              experience_level, industry, working_languages, work_authorization, eligibility_notes, start_date,
              application_deadline, positions_count)
  on public.jobs to authenticated;
create policy jobs_member_read on public.jobs for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('jobs.view')));
create policy jobs_member_insert on public.jobs for insert to authenticated
  with check (company_id = (select app.my_company_id()) and created_by = (select auth.uid()) and status = 'draft');
create policy jobs_member_update on public.jobs for update to authenticated
  using (company_id = (select app.my_company_id()) and status in ('draft', 'pending_payment', 'in_review', 'rejected', 'active'))
  with check (company_id = (select app.my_company_id()));

grant select, insert, update, delete on public.job_locations to authenticated;
create policy job_locations_member_read on public.job_locations for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('jobs.view')));
create policy job_locations_member_write on public.job_locations for insert to authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.company_id = (select app.my_company_id())
                      and j.status in ('draft', 'pending_payment', 'in_review', 'rejected', 'active')));
create policy job_locations_member_update on public.job_locations for update to authenticated
  using (company_id = (select app.my_company_id())
         and exists (select 1 from public.jobs j where j.id = job_id and j.status in ('draft', 'pending_payment', 'in_review', 'rejected', 'active')))
  with check (company_id = (select app.my_company_id()));
create policy job_locations_member_delete on public.job_locations for delete to authenticated
  using (company_id = (select app.my_company_id())
         and exists (select 1 from public.jobs j where j.id = job_id and j.status in ('draft', 'rejected')));

grant select on public.public_jobs, public.public_companies to anon, authenticated;

grant select, insert, delete on public.saved_jobs to authenticated;
create policy saved_jobs_owner_read on public.saved_jobs for select to authenticated using (user_id = (select auth.uid()));
create policy saved_jobs_owner_insert on public.saved_jobs for insert to authenticated
  with check (user_id = (select auth.uid()) and (select app.is_active_user()) and app.job_is_public(job_id));
create policy saved_jobs_owner_delete on public.saved_jobs for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.job_alerts to authenticated;
create policy job_alerts_owner on public.job_alerts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select app.is_active_user()));

grant select on public.moderation_terms to authenticated;
create policy moderation_terms_admin_read on public.moderation_terms for select to authenticated
  using ((select app.has_permission('jobs.moderate')) or (select app.has_permission('moderation_terms.manage')));

-- -----------------------------------------------------------------------------
-- 7. Applications
-- -----------------------------------------------------------------------------
grant select on public.applications, public.application_status_history to authenticated;
create policy applications_candidate_read on public.applications for select to authenticated
  using (candidate_id = (select auth.uid()));
create policy applications_company_read on public.applications for select to authenticated
  using (company_id = (select app.my_company_id()) and status <> 'withdrawn' and anonymized_at is null);
create policy application_history_read on public.application_status_history for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.candidate_id = (select auth.uid())
           or (a.company_id = (select app.my_company_id()) and a.status <> 'withdrawn' and a.anonymized_at is null))));

-- -----------------------------------------------------------------------------
-- 8. Billing (read-only for company members and finance admins)
-- -----------------------------------------------------------------------------
grant select on public.billing_customers, public.subscriptions, public.invoices, public.payments, public.refunds to authenticated;
create policy billing_customers_read on public.billing_customers for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('payments.view')));
create policy subscriptions_read on public.subscriptions for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('payments.view')));
create policy invoices_read on public.invoices for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('payments.view')));
create policy payments_read on public.payments for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('payments.view')));
create policy refunds_read on public.refunds for select to authenticated
  using (company_id = (select app.my_company_id()) or (select app.has_permission('payments.view')));

grant select on public.stripe_events to authenticated;
create policy stripe_events_admin_read on public.stripe_events for select to authenticated
  using ((select app.has_permission('payments.view')));

-- -----------------------------------------------------------------------------
-- 9. Platform tables
-- -----------------------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_owner_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_owner_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select on public.email_templates to authenticated;
create policy email_templates_admin_read on public.email_templates for select to authenticated
  using ((select app.has_permission('emails.manage')));

grant select on public.reports to authenticated;
create policy reports_admin_read on public.reports for select to authenticated
  using ((select app.has_permission('reports.handle')) or reporter_id = (select auth.uid()));

grant select on public.privacy_requests to authenticated;
create policy privacy_requests_read on public.privacy_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select app.has_permission('privacy.handle')));
create policy privacy_requests_insert on public.privacy_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'open'
              and email = (select u.email from public.users u where u.id = (select auth.uid())));
grant insert (user_id, email, type, details) on public.privacy_requests to authenticated;

grant select on public.admin_internal_notes to authenticated;
create policy internal_notes_admin_read on public.admin_internal_notes for select to authenticated
  using ((select app.is_admin()));

grant select on public.admin_audit_logs to authenticated;
create policy audit_logs_admin_read on public.admin_audit_logs for select to authenticated
  using ((select app.has_permission('audit.view')));

grant select on public.data_access_logs to authenticated;
create policy data_access_logs_read on public.data_access_logs for select to authenticated
  using ((select app.has_permission('audit.view')) or actor_id = (select auth.uid()));

grant select on public.service_api_clients to authenticated;
create policy service_clients_admin_read on public.service_api_clients for select to authenticated
  using ((select app.has_permission('service_clients.manage')));

-- email_outbox, rate_limits: no privileges for anon/authenticated (service role only).

-- -----------------------------------------------------------------------------
-- 10. RPC entry points
-- -----------------------------------------------------------------------------
-- Public (anonymous visitors included)
grant execute on function public.search_jobs, public.search_suggestions(text, integer), public.similar_jobs(uuid, integer),
  public.search_cities(text, text, integer), public.get_job_price(text)
to anon, authenticated;

-- Authenticated users (each function re-checks identity, role and ownership)
grant execute on function
  public.get_my_candidate_status(), public.give_transmission_consent(text), public.apply_to_job(uuid),
  public.withdraw_application(uuid), public.set_primary_resume(uuid), public.authorize_resume_download(uuid),
  public.export_my_data(),
  public.submit_job(uuid), public.close_job(uuid), public.reopen_job(uuid), public.delete_draft_job(uuid),
  public.recruiter_mark_viewed(uuid), public.recruiter_set_application_status(uuid, public.application_status),
  public.recruiter_update_application(uuid, smallint, boolean, boolean),
  public.authorize_verification_document(uuid),
  public.admin_review_company(uuid, text, text, text), public.admin_set_company_suspension(uuid, boolean, text, text),
  public.admin_moderate_job(uuid, text, text, text), public.admin_set_user_status(uuid, public.user_status, text),
  public.admin_set_role(uuid, public.admin_role, boolean), public.admin_update_country(text, jsonb, text),
  public.admin_update_compliance_item(uuid, public.compliance_item_status, text, text),
  public.admin_upsert_pricing_plan(text, text, integer, text, text), public.admin_deactivate_pricing_plan(uuid),
  public.admin_handle_report(uuid, public.report_status, text),
  public.admin_handle_privacy_request(uuid, public.privacy_request_status, text),
  public.admin_upsert_email_template(text, text, text, text, boolean), public.admin_delete_email_template(text, text),
  public.admin_upsert_moderation_term(uuid, text, text, text, text, text, boolean),
  public.admin_update_setting(text, jsonb),
  public.admin_create_service_client(text, text, text, text[], text[]), public.admin_revoke_service_client(uuid),
  public.admin_dashboard_stats(), public.admin_timeseries(integer)
to authenticated;

-- Everything else in public (billing_*, create_company, verification_*, resume_register_version, resume_delete,
-- run_maintenance, email_*, hq_metrics, bootstrap_super_admin, privacy_prepare_account_deletion, ...) is
-- executable by service_role only (granted above).
