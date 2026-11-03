-- =============================================================================
-- Platform: notifications, e-mail outbox & templates, reports, privacy requests,
-- internal notes, audit logs, sensitive data access logs, rate limits,
-- service API clients (Tamurt HQ integration).
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]{2,60}$'),
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'In-app notification feed (no messaging between users).';
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  to_email text not null check (to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  locale text not null default 'fr' check (locale in ('fr', 'en', 'es', 'ar')),
  template text not null check (template ~ '^[a-z_]{2,60}$'),
  payload jsonb not null default '{}',
  status public.email_status not null default 'pending',
  attempts smallint not null default 0,
  last_error text,
  provider text,
  provider_message_id text,
  dedupe_key text unique,
  send_after timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.email_outbox is 'Transactional outbox: e-mails are enqueued in the same transaction as the business event and delivered asynchronously.';
create index email_outbox_pending_idx on public.email_outbox (send_after) where status in ('pending', 'failed');

create table public.email_templates (
  template text not null check (template ~ '^[a-z_]{2,60}$'),
  locale text not null check (locale in ('fr', 'en', 'es', 'ar')),
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  is_active boolean not null default true,
  updated_by uuid references public.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (template, locale)
);
comment on table public.email_templates is 'Administrator overrides of the default (translated) transactional e-mail templates. {{placeholders}} are HTML-escaped at render time.';

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  reporter_id uuid references public.users (id) on delete set null,
  reporter_email text check (reporter_email is null or reporter_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  reason public.report_reason not null,
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolution_note text check (char_length(resolution_note) <= 2000),
  handled_by uuid references public.users (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_job_idx on public.reports (job_id);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  email text not null,
  type public.privacy_request_type not null,
  details text check (char_length(details) <= 3000),
  status public.privacy_request_status not null default 'open',
  response text check (char_length(response) <= 3000),
  handled_by uuid references public.users (id) on delete set null,
  handled_at timestamptz,
  due_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now()
);
comment on table public.privacy_requests is 'Data subject requests (GDPR/UK GDPR/nLPD/PIPEDA/CCPA/Law 18-07...). Default due date: 30 days.';
create index privacy_requests_status_idx on public.privacy_requests (status, due_at);

create table public.admin_internal_notes (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('company', 'job', 'user', 'report', 'privacy_request', 'payment')),
  target_id uuid not null,
  note text not null check (char_length(note) between 1 and 4000),
  author_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.admin_internal_notes is 'Internal justifications (never shown to users).';
create index admin_internal_notes_target_idx on public.admin_internal_notes (target_type, target_id, created_at desc);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.users (id) on delete set null,
  actor_roles text[] not null default '{}',
  action text not null check (action ~ '^[a-z_.]{2,80}$'),
  target_type text,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
comment on table public.admin_audit_logs is 'Append-only journal of sensitive administrative actions.';
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_target_idx on public.admin_audit_logs (target_type, target_id);

create table public.data_access_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('candidate', 'recruiter', 'admin', 'system')),
  resource_type text not null check (resource_type in ('resume_version', 'verification_document', 'application', 'data_export')),
  resource_id uuid not null,
  action text not null check (action in ('view', 'download', 'export')),
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);
comment on table public.data_access_logs is 'Traceability of access to sensitive personal data (CV downloads, verification documents, exports).';
create index data_access_logs_resource_idx on public.data_access_logs (resource_type, resource_id, created_at desc);
create index data_access_logs_actor_idx on public.data_access_logs (actor_id, created_at desc);

create or replace function app.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only_table' using errcode = 'P0001', detail = tg_table_name;
end;
$$;

create trigger admin_audit_logs_append_only before update or delete on public.admin_audit_logs
  for each row execute function app.prevent_mutation();
create trigger data_access_logs_append_only before update on public.data_access_logs
  for each row execute function app.prevent_mutation();

create unlogged table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);
comment on table public.rate_limits is 'Fixed-window counters for abuse protection (unlogged: losing counters on crash is acceptable).';

create table public.service_api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  token_prefix text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default '{metrics:read}',
  allowed_ips text[] not null default '{}',
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
comment on table public.service_api_clients is 'Machine clients of the internal API (e.g. Tamurt HQ). Only SHA-256 token hashes are stored.';
