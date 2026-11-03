-- =============================================================================
-- Companies, members, verification records and private verification documents.
-- =============================================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  legal_name text not null check (char_length(legal_name) between 2 and 200),
  display_name text check (char_length(display_name) <= 200),
  registration_country char(2) not null references public.countries (code),
  registration_region text check (char_length(registration_region) <= 80),
  registration_id_type text not null check (registration_id_type ~ '^[a-z0-9_]{2,30}$'),
  registration_number text not null check (char_length(registration_number) between 2 and 40),
  -- Additional identifiers (SIRET, VAT, NIF, NIS, BN, EIN...). Private: never exposed publicly.
  secondary_identifiers jsonb not null default '{}' check (jsonb_typeof(secondary_identifiers) = 'object'),
  hq_address_line1 text not null check (char_length(hq_address_line1) between 2 and 200),
  hq_address_line2 text check (char_length(hq_address_line2) <= 200),
  hq_postal_code text check (char_length(hq_postal_code) <= 20),
  hq_city text not null check (char_length(hq_city) between 1 and 120),
  hq_region text check (char_length(hq_region) <= 120),
  hq_country char(2) not null references public.countries (code),
  industry text not null references public.industries (code),
  website text check (website is null or website ~* '^https?://[^\s/$.?#].[^\s]*$'),
  description text check (char_length(description) <= 5000),
  logo_path text,
  size_range text check (size_range in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  verification_status public.company_verification_status not null default 'pending',
  verification_message text,
  verified_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.companies is 'Employer organisations. Base table is private (members/admins); public data is exposed through public.public_companies.';
comment on column public.companies.verification_message is 'Message shown to the company members about the verification outcome (never internal notes).';
create unique index companies_registration_unique
  on public.companies (registration_country, registration_id_type, registration_number)
  where verification_status <> 'rejected';
create index companies_status_idx on public.companies (verification_status, created_at);
create trigger companies_touch before update on public.companies for each row execute function app.touch_updated_at();

create table public.company_members (
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.company_member_role not null default 'recruiter',
  job_title text check (char_length(job_title) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ().-]{6,25}$'),
  is_legal_representative boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);
comment on table public.company_members is 'Recruiters belonging to a company. V1: one company per user.';
create unique index company_members_one_company_per_user on public.company_members (user_id);

create table public.company_verifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  outcome public.company_verification_status not null,
  method text not null check (method in ('registry_api', 'manual')),
  provider text,
  registry_found boolean,
  registry_active boolean,
  registry_name text,
  registry_data jsonb not null default '{}',
  checks jsonb not null default '[]' check (jsonb_typeof(checks) = 'array'),
  risk_flags text[] not null default '{}',
  score smallint check (score between 0 and 100),
  decision_reason text,
  submitted_by uuid references public.users (id) on delete set null,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  purge_after timestamptz
);
comment on table public.company_verifications is 'Verification attempts (automated registry checks and manual reviews). Admin-only.';
create index company_verifications_company_idx on public.company_verifications (company_id, created_at desc);

create table public.company_verification_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  doc_type text not null check (doc_type in ('registry_extract', 'authority_proof', 'other')),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  purge_after timestamptz,
  file_deleted_at timestamptz
);
comment on table public.company_verification_documents is 'Supporting documents for manual verification (private bucket, limited retention).';
create index company_verification_documents_company_idx on public.company_verification_documents (company_id, created_at desc);
