-- Company suspension / reinstatement now notifies the company members by e-mail
-- (the decision is explained to the persons concerned, as for adverts and accounts).
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
  perform app.enqueue_company_email(p_company_id, 'company_suspension',
    jsonb_build_object('suspended', p_suspend, 'reason', p_reason,
                       'company_name', coalesce(v_company.display_name, v_company.legal_name)),
    'company_suspension:' || p_company_id || ':' || p_suspend || ':' || extract(epoch from now())::bigint);
  return jsonb_build_object('cancel_subscription_ids', to_jsonb(v_ids));
end;
$$;
