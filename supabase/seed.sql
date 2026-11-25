-- LOCAL DEVELOPMENT ONLY (applied by `supabase db reset`, never by `supabase db push`).
-- Enables paid publishing in two markets so that the full flow can be exercised locally.
-- In production, markets are enabled from the back-office after the compliance review.
update public.countries set is_paid_publishing_enabled = true, compliance_status = 'in_progress',
  compliance_notes = 'Enabled by supabase/seed.sql for local development only.'
where code in ('FR', 'BE');

-- Back-office second factor: required on hosted projects (migration 20261125100000_admin_mfa.sql),
-- relaxed here so that local development and the automated tests can use admin accounts.
-- tests/e2e/admin-mfa.spec.ts and tests/integration/db/admin-mfa.test.ts switch it back on.
update public.platform_settings set value = 'false' where key = 'security.admin_mfa_required';
