-- LOCAL DEVELOPMENT ONLY (applied by `supabase db reset`, never by `supabase db push`).
-- Enables paid publishing in two markets so that the full flow can be exercised locally.
-- In production, markets are enabled from the back-office after the compliance review.
update public.countries set is_paid_publishing_enabled = true, compliance_status = 'in_progress',
  compliance_notes = 'Enabled by supabase/seed.sql for local development only.'
where code in ('FR', 'BE');
