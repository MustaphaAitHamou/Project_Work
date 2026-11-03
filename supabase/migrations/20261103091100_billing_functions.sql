-- =============================================================================
-- Billing functions. Executable by the service role only (called by the server
-- after authenticating the employer, and by the verified Stripe webhook).
-- A job advert is activated ONLY from confirmed payment events, never from the
-- Checkout success URL.
-- =============================================================================

create or replace function app.resolve_pricing_plan(p_country char(2))
returns public.pricing_plans
language sql stable
security definer
set search_path = ''
as $$
  select p.*
  from public.pricing_plans p
  left join public.countries c on c.code = p_country
  where p.is_active and p.code = 'job_monthly'
    and (p.country_code = p_country or p.country_code is null)
  order by (p.country_code is not null) desc, (p.currency = c.default_currency) desc, p.created_at desc
  limit 1
$$;

-- Public price display (landing pages, job form). Returns the plan that applies to a country.
create or replace function public.get_job_price(p_country text default null)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select case when p.id is null then null else jsonb_build_object(
    'plan_id', p.id, 'currency', p.currency, 'unit_amount', p.unit_amount,
    'interval', p.billing_interval, 'tax_behavior', p.tax_behavior) end
  from app.resolve_pricing_plan(upper(p_country)::char(2)) p
$$;

create or replace function public.billing_prepare_checkout(p_actor uuid, p_job_id uuid)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_company public.companies;
  v_loc public.job_locations;
  v_plan public.pricing_plans;
  v_customer text;
  v_expired text[];
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null or not app.is_member_of(v_job.company_id, p_actor) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status <> 'pending_payment' then
    raise exception 'job_not_payable' using errcode = 'P0001';
  end if;
  select * into v_company from public.companies where id = v_job.company_id;
  if v_company.verification_status <> 'verified' or v_company.suspended_at is not null then
    raise exception 'company_not_verified' using errcode = 'P0001';
  end if;
  select * into v_loc from public.job_locations where job_id = p_job_id and is_primary;
  if not exists (select 1 from public.countries where code = v_loc.country_code and is_paid_publishing_enabled) then
    raise exception 'country_not_enabled' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.subscriptions where job_id = p_job_id
             and status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')) then
    raise exception 'job_has_live_subscription' using errcode = 'P0001';
  end if;
  if not app.rate_limit_hit('checkout:' || v_company.id::text, 30, 3600) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  v_plan := app.resolve_pricing_plan(v_loc.country_code);
  if v_plan.id is null then
    raise exception 'no_pricing_plan' using errcode = 'P0001';
  end if;

  select stripe_customer_id into v_customer from public.billing_customers where company_id = v_company.id;

  select coalesce(array_agg(stripe_checkout_session_id), '{}') into v_expired
    from public.subscriptions where job_id = p_job_id and status = 'checkout_pending' and stripe_checkout_session_id is not null;
  update public.subscriptions set status = 'checkout_expired' where job_id = p_job_id and status = 'checkout_pending';

  return jsonb_build_object(
    'job', jsonb_build_object('id', v_job.id, 'title', v_job.title, 'public_id', v_job.public_id, 'country_code', v_loc.country_code),
    'company', jsonb_build_object('id', v_company.id, 'name', coalesce(v_company.display_name, v_company.legal_name),
                                  'registration_country', v_company.registration_country),
    'plan', to_jsonb(v_plan),
    'stripe_customer_id', v_customer,
    'sessions_to_expire', to_jsonb(v_expired)
  );
end;
$$;

create or replace function public.billing_upsert_customer(p_company_id uuid, p_customer_id text)
returns void
language sql volatile
security definer
set search_path = ''
as $$
  insert into public.billing_customers (company_id, stripe_customer_id) values (p_company_id, p_customer_id)
  on conflict (company_id) do nothing
$$;

create or replace function public.billing_register_checkout(p_job_id uuid, p_plan_id uuid, p_session_id text, p_customer_id text)
returns uuid
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_plan public.pricing_plans;
  v_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id;
  select * into v_plan from public.pricing_plans where id = p_plan_id;
  insert into public.subscriptions (company_id, job_id, pricing_plan_id, stripe_checkout_session_id, stripe_customer_id,
                                    stripe_price_id, status, unit_amount, currency)
  values (v_job.company_id, p_job_id, p_plan_id, p_session_id, p_customer_id, v_plan.stripe_price_id, 'checkout_pending',
          v_plan.unit_amount, v_plan.currency)
  returning id into v_id;
  return v_id;
end;
$$;

-- Idempotency ledger
create or replace function public.billing_begin_event(p_id text, p_type text, p_livemode boolean, p_created timestamptz, p_payload jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_event public.stripe_events;
begin
  insert into public.stripe_events (id, type, livemode, stripe_created, payload)
  values (p_id, p_type, p_livemode, p_created, p_payload)
  on conflict (id) do nothing;
  update public.stripe_events set attempts = attempts + 1 where id = p_id returning * into v_event;
  return jsonb_build_object('already_processed', v_event.processed_at is not null, 'attempts', v_event.attempts);
end;
$$;

create or replace function public.billing_finish_event(p_id text, p_error text default null)
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.stripe_events
     set processed_at = case when p_error is null then now() else processed_at end,
         last_error = p_error
   where id = p_id
$$;

-- Activation from a confirmed payment. Idempotent.
create or replace function app.billing_activate_job(p_job_id uuid, p_period_end timestamptz)
returns text
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_title text;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then
    return 'missing';
  end if;
  if p_period_end is not null then
    update public.jobs set paid_through = greatest(coalesce(paid_through, p_period_end), p_period_end) where id = p_job_id;
  end if;
  if v_job.status = 'pending_payment'
     or (v_job.status = 'suspended' and v_job.suspension_reason = 'payment_failed') then
    update public.jobs set
      status = 'active',
      published_at = coalesce(published_at, now()),
      suspended_at = null,
      suspension_reason = null
    where id = p_job_id;
    v_title := v_job.title;
    perform app.enqueue_company_email(v_job.company_id, 'job_published',
      jsonb_build_object('job_title', v_title, 'job_id', p_job_id, 'job_path', v_job.slug || '-' || v_job.public_id),
      'job_published:' || p_job_id || ':' || coalesce(extract(epoch from p_period_end)::bigint, 0), 'billing');
    return 'activated';
  end if;
  return v_job.status::text;
end;
$$;

create or replace function public.billing_checkout_completed(p jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_job_id uuid := nullif(p ->> 'job_id', '')::uuid;
  v_result text := 'linked';
begin
  select * into v_sub from public.subscriptions where stripe_checkout_session_id = p ->> 'session_id' for update;
  if v_sub.id is null and p ->> 'subscription_id' is not null then
    select * into v_sub from public.subscriptions where stripe_subscription_id = p ->> 'subscription_id' for update;
  end if;
  if v_sub.id is null then
    if v_job_id is null or not exists (select 1 from public.jobs where id = v_job_id) then
      raise exception 'unknown_checkout_session' using errcode = 'P0001';
    end if;
    insert into public.subscriptions (company_id, job_id, stripe_checkout_session_id, status)
    select j.company_id, j.id, p ->> 'session_id', 'incomplete' from public.jobs j where j.id = v_job_id
    returning * into v_sub;
  end if;

  update public.subscriptions set
    stripe_subscription_id = coalesce(p ->> 'subscription_id', stripe_subscription_id),
    stripe_customer_id = coalesce(p ->> 'customer_id', stripe_customer_id),
    livemode = (p ->> 'livemode')::boolean,
    status = case when status in ('checkout_pending', 'checkout_expired') then 'incomplete' else status end
  where id = v_sub.id;

  if p ->> 'customer_id' is not null then
    perform public.billing_upsert_customer(v_sub.company_id, p ->> 'customer_id');
  end if;

  if p ->> 'payment_status' in ('paid', 'no_payment_required') then
    update public.subscriptions set status = 'active' where id = v_sub.id and status in ('incomplete', 'checkout_pending', 'checkout_expired');
    v_result := app.billing_activate_job(v_sub.job_id, null);
  end if;
  return jsonb_build_object('subscription_id', v_sub.id, 'job_id', v_sub.job_id, 'job_result', v_result);
end;
$$;

-- Apply a Stripe subscription state (from customer.subscription.* events).
create or replace function public.billing_sync_subscription(p jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_job public.jobs;
  v_event_created timestamptz := (p ->> 'event_created')::timestamptz;
  v_status text := p ->> 'status';
  v_job_id uuid := nullif(p ->> 'job_id', '')::uuid;
  v_period_end timestamptz := (p ->> 'current_period_end')::timestamptz;
  v_result text := 'synced';
  v_grace integer := app.setting_int('billing.grace_days', 3);
begin
  select * into v_sub from public.subscriptions where stripe_subscription_id = p ->> 'stripe_subscription_id' for update;
  if v_sub.id is null and v_job_id is not null then
    select * into v_sub from public.subscriptions
     where job_id = v_job_id and stripe_subscription_id is null and status in ('checkout_pending', 'checkout_expired', 'incomplete')
     order by created_at desc limit 1 for update;
  end if;
  if v_sub.id is null then
    if v_job_id is null or not exists (select 1 from public.jobs where id = v_job_id) then
      return jsonb_build_object('result', 'ignored_unknown_subscription');
    end if;
    insert into public.subscriptions (company_id, job_id, stripe_subscription_id, status)
    select j.company_id, j.id, p ->> 'stripe_subscription_id', 'incomplete' from public.jobs j where j.id = v_job_id
    returning * into v_sub;
  end if;

  -- Out-of-order protection
  if v_sub.last_event_created is not null and v_event_created is not null and v_event_created < v_sub.last_event_created then
    return jsonb_build_object('result', 'ignored_stale_event', 'subscription_id', v_sub.id);
  end if;

  update public.subscriptions set
    stripe_subscription_id = p ->> 'stripe_subscription_id',
    stripe_customer_id = coalesce(p ->> 'stripe_customer_id', stripe_customer_id),
    stripe_price_id = coalesce(p ->> 'price_id', stripe_price_id),
    unit_amount = coalesce((p ->> 'unit_amount')::integer, unit_amount),
    currency = coalesce(upper(p ->> 'currency'), currency),
    status = v_status,
    current_period_start = coalesce((p ->> 'current_period_start')::timestamptz, current_period_start),
    current_period_end = coalesce(v_period_end, current_period_end),
    cancel_at_period_end = coalesce((p ->> 'cancel_at_period_end')::boolean, false),
    canceled_at = (p ->> 'canceled_at')::timestamptz,
    ended_at = (p ->> 'ended_at')::timestamptz,
    grace_until = case
      when v_status = 'past_due' then coalesce(grace_until, now() + make_interval(days => v_grace))
      when v_status in ('active', 'trialing') then null
      else grace_until end,
    livemode = coalesce((p ->> 'livemode')::boolean, livemode),
    last_event_created = coalesce(v_event_created, last_event_created)
  where id = v_sub.id
  returning * into v_sub;

  if (p ->> 'stripe_customer_id') is not null then
    perform public.billing_upsert_customer(v_sub.company_id, p ->> 'stripe_customer_id');
  end if;

  select * into v_job from public.jobs where id = v_sub.job_id for update;

  if v_status in ('active', 'trialing') then
    v_result := app.billing_activate_job(v_sub.job_id, v_period_end);
  elsif v_status in ('unpaid', 'paused') then
    if v_job.status = 'active' then
      update public.jobs set status = 'suspended', suspended_at = now(), suspension_reason = 'payment_failed' where id = v_job.id;
      v_result := 'suspended';
    end if;
  elsif v_status in ('canceled', 'incomplete_expired') then
    if v_job.status in ('active', 'suspended', 'pending_payment') then
      update public.jobs set status = 'expired', expired_at = now() where id = v_job.id;
      perform app.close_open_applications(v_job.id, 'system');
      perform app.enqueue_company_email(v_job.company_id, 'job_expired',
        jsonb_build_object('job_title', v_job.title, 'job_id', v_job.id), 'job_expired:' || v_sub.id, 'billing');
      v_result := 'expired';
    end if;
  end if;

  return jsonb_build_object('result', v_result, 'subscription_id', v_sub.id, 'job_id', v_sub.job_id, 'job_status', (select status from public.jobs where id = v_sub.job_id));
end;
$$;

create or replace function public.billing_record_invoice(p jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_company uuid;
begin
  select * into v_sub from public.subscriptions where stripe_subscription_id = p ->> 'stripe_subscription_id';
  v_company := coalesce(v_sub.company_id, (select company_id from public.billing_customers where stripe_customer_id = p ->> 'stripe_customer_id'));
  if v_company is null then
    return jsonb_build_object('result', 'ignored_unknown_customer');
  end if;
  insert into public.invoices (company_id, subscription_id, job_id, stripe_invoice_id, number, status, billing_reason, currency,
                               subtotal, tax, total, amount_due, amount_paid, amount_remaining, attempt_count,
                               hosted_invoice_url, invoice_pdf, period_start, period_end, stripe_created_at)
  values (v_company, v_sub.id, v_sub.job_id, p ->> 'stripe_invoice_id', p ->> 'number', p ->> 'status', p ->> 'billing_reason',
          upper(p ->> 'currency'), (p ->> 'subtotal')::integer, (p ->> 'tax')::integer, (p ->> 'total')::integer,
          (p ->> 'amount_due')::integer, (p ->> 'amount_paid')::integer, (p ->> 'amount_remaining')::integer,
          (p ->> 'attempt_count')::integer, p ->> 'hosted_invoice_url', p ->> 'invoice_pdf',
          (p ->> 'period_start')::timestamptz, (p ->> 'period_end')::timestamptz, (p ->> 'created')::timestamptz)
  on conflict (stripe_invoice_id) do update set
    number = coalesce(excluded.number, public.invoices.number),
    status = excluded.status,
    subtotal = excluded.subtotal, tax = excluded.tax, total = excluded.total,
    amount_due = excluded.amount_due, amount_paid = excluded.amount_paid, amount_remaining = excluded.amount_remaining,
    attempt_count = excluded.attempt_count,
    hosted_invoice_url = coalesce(excluded.hosted_invoice_url, public.invoices.hosted_invoice_url),
    invoice_pdf = coalesce(excluded.invoice_pdf, public.invoices.invoice_pdf),
    period_start = coalesce(excluded.period_start, public.invoices.period_start),
    period_end = coalesce(excluded.period_end, public.invoices.period_end),
    subscription_id = coalesce(public.invoices.subscription_id, excluded.subscription_id),
    job_id = coalesce(public.invoices.job_id, excluded.job_id);
  return jsonb_build_object('result', 'recorded', 'subscription_id', v_sub.id, 'job_id', v_sub.job_id, 'company_id', v_company);
end;
$$;

-- Records a payment attempt (invoice.paid / invoice.payment_failed).
create or replace function public.billing_record_payment(p jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions;
  v_company uuid;
  v_status text := p ->> 'status';
  v_job public.jobs;
  v_result text := 'recorded';
  v_grace integer := app.setting_int('billing.grace_days', 3);
begin
  select * into v_sub from public.subscriptions where stripe_subscription_id = p ->> 'stripe_subscription_id' for update;
  v_company := coalesce(v_sub.company_id, (select company_id from public.billing_customers where stripe_customer_id = p ->> 'stripe_customer_id'));
  if v_company is null then
    return jsonb_build_object('result', 'ignored_unknown_customer');
  end if;

  insert into public.payments (company_id, subscription_id, job_id, stripe_invoice_id, attempt_number, stripe_payment_intent_id,
                               amount, currency, status, failure_code, failure_message)
  values (v_company, v_sub.id, v_sub.job_id, p ->> 'stripe_invoice_id', greatest(coalesce((p ->> 'attempt_number')::integer, 1), 1),
          p ->> 'payment_intent_id', coalesce((p ->> 'amount')::integer, 0), upper(p ->> 'currency'), v_status,
          p ->> 'failure_code', left(p ->> 'failure_message', 500))
  on conflict (stripe_invoice_id, attempt_number) do update set
    status = case when public.payments.status in ('refunded', 'partially_refunded') then public.payments.status else excluded.status end,
    stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, public.payments.stripe_payment_intent_id),
    failure_code = excluded.failure_code,
    failure_message = excluded.failure_message;

  if v_sub.id is null then
    return jsonb_build_object('result', v_result);
  end if;
  select * into v_job from public.jobs where id = v_sub.job_id;

  if v_status = 'succeeded' then
    update public.subscriptions set status = case when status in ('incomplete', 'past_due', 'unpaid', 'checkout_pending', 'checkout_expired') then 'active' else status end,
                                    grace_until = null
     where id = v_sub.id;
    v_result := app.billing_activate_job(v_sub.job_id, (p ->> 'period_end')::timestamptz);
  elsif v_status = 'failed' then
    update public.subscriptions set grace_until = coalesce(grace_until, now() + make_interval(days => v_grace)) where id = v_sub.id;
    perform app.enqueue_company_email(v_company, 'payment_failed',
      jsonb_build_object('job_title', v_job.title, 'job_id', v_job.id, 'grace_days', v_grace,
                         'amount', p ->> 'amount', 'currency', upper(p ->> 'currency')),
      'payment_failed:' || (p ->> 'stripe_invoice_id') || ':' || coalesce(p ->> 'attempt_number', '1'), 'billing');
    v_result := 'failure_recorded';
  end if;
  return jsonb_build_object('result', v_result, 'subscription_id', v_sub.id, 'job_id', v_sub.job_id);
end;
$$;

create or replace function public.billing_record_refund(p jsonb)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_total integer;
begin
  select * into v_payment from public.payments
   where stripe_payment_intent_id = p ->> 'payment_intent_id' and status in ('succeeded', 'refunded', 'partially_refunded')
   order by created_at desc limit 1 for update;
  if v_payment.id is null then
    return jsonb_build_object('result', 'ignored_unknown_payment');
  end if;
  insert into public.refunds (payment_id, company_id, stripe_refund_id, stripe_payment_intent_id, amount, currency, status, reason, requested_by)
  values (v_payment.id, v_payment.company_id, p ->> 'stripe_refund_id', p ->> 'payment_intent_id', (p ->> 'amount')::integer,
          upper(p ->> 'currency'), p ->> 'status', p ->> 'reason', nullif(p ->> 'requested_by', '')::uuid)
  on conflict (stripe_refund_id) do update set
    status = excluded.status,
    reason = coalesce(public.refunds.reason, excluded.reason),
    requested_by = coalesce(public.refunds.requested_by, excluded.requested_by);
  select coalesce(sum(amount), 0) into v_total from public.refunds
   where payment_id = v_payment.id and coalesce(status, 'succeeded') not in ('failed', 'canceled');
  update public.payments set
    amount_refunded = least(v_total, amount),
    status = case when v_total >= amount then 'refunded' when v_total > 0 then 'partially_refunded' else status end
  where id = v_payment.id;
  return jsonb_build_object('result', 'recorded', 'payment_id', v_payment.id, 'refunded_total', v_total);
end;
$$;

-- Used by the webhook to decide whether a renewal invoice must be stopped.
create or replace function public.billing_job_state_for_subscription(p_stripe_subscription_id text)
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('subscription_id', s.id, 'job_id', j.id, 'job_status', j.status,
                            'cancel_requested', s.cancel_requested_at is not null)
  from public.subscriptions s join public.jobs j on j.id = s.job_id
  where s.stripe_subscription_id = p_stripe_subscription_id
$$;

create or replace function public.billing_mark_cancel_at_period_end(p_stripe_subscription_id text, p_value boolean)
returns void
language sql volatile
security definer
set search_path = ''
as $$
  update public.subscriptions
     set cancel_at_period_end = p_value,
         cancel_requested_at = case when p_value then coalesce(cancel_requested_at, now()) else null end
   where stripe_subscription_id = p_stripe_subscription_id
$$;
