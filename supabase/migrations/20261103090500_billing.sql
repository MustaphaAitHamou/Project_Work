-- =============================================================================
-- Billing (Stripe Checkout + Billing): customers, one subscription per active
-- job advert, invoices, payment attempts, refunds, webhook event ledger.
-- All writes happen server-side (service role) from verified Stripe webhooks.
-- =============================================================================

create table public.billing_customers (
  company_id uuid primary key references public.companies (id) on delete restrict,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  job_id uuid not null references public.jobs (id) on delete restrict,
  pricing_plan_id uuid references public.pricing_plans (id),
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  stripe_price_id text,
  status text not null default 'checkout_pending' check (status in (
    'checkout_pending', 'checkout_expired', 'incomplete', 'incomplete_expired', 'trialing',
    'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  unit_amount integer check (unit_amount > 0),
  currency char(3) references public.currencies (code),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_requested_at timestamptz,
  canceled_at timestamptz,
  ended_at timestamptz,
  grace_until timestamptz,
  last_event_created timestamptz,
  livemode boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.subscriptions is 'One Stripe subscription per published job advert (monthly, auto-renewing, cancellable at any time).';
comment on column public.subscriptions.last_event_created is 'Created timestamp of the last Stripe event applied (guards against out-of-order delivery).';
create unique index subscriptions_one_live_per_job on public.subscriptions (job_id)
  where status in ('checkout_pending', 'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused');
create index subscriptions_company_idx on public.subscriptions (company_id, created_at desc);
create index subscriptions_status_idx on public.subscriptions (status);
create trigger subscriptions_touch before update on public.subscriptions for each row execute function app.touch_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  stripe_invoice_id text not null unique,
  number text,
  status text,
  billing_reason text,
  currency char(3),
  subtotal integer,
  tax integer,
  total integer,
  amount_due integer,
  amount_paid integer,
  amount_remaining integer,
  attempt_count integer,
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  stripe_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_company_idx on public.invoices (company_id, stripe_created_at desc);
create trigger invoices_touch before update on public.invoices for each row execute function app.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  job_id uuid references public.jobs (id) on delete set null,
  stripe_invoice_id text not null,
  attempt_number integer not null default 1,
  stripe_payment_intent_id text,
  amount integer not null check (amount >= 0),
  currency char(3) not null,
  status text not null check (status in ('succeeded', 'failed', 'refunded', 'partially_refunded')),
  amount_refunded integer not null default 0 check (amount_refunded >= 0),
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_invoice_id, attempt_number)
);
comment on table public.payments is 'Payment attempts per invoice (successful and failed), plus refund totals.';
create index payments_company_idx on public.payments (company_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);
create index payments_pi_idx on public.payments (stripe_payment_intent_id);
create trigger payments_touch before update on public.payments for each row execute function app.touch_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments (id) on delete set null,
  company_id uuid not null references public.companies (id) on delete restrict,
  stripe_refund_id text not null unique,
  stripe_payment_intent_id text,
  amount integer not null check (amount > 0),
  currency char(3) not null,
  status text,
  reason text,
  requested_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.refunds.reason is 'Mandatory justification for administrative refunds.';
create trigger refunds_touch before update on public.refunds for each row execute function app.touch_updated_at();

create table public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null,
  stripe_created timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  payload jsonb
);
comment on table public.stripe_events is 'Webhook ledger used for idempotency. Payloads are purged after the retention period.';
create index stripe_events_unprocessed_idx on public.stripe_events (received_at) where processed_at is null;
