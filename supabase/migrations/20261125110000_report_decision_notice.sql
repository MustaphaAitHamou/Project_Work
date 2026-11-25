-- Règlement (UE) 2022/2065 sur les services numériques, article 16, paragraphe 5 :
-- l'auteur d'un signalement est informé, sans retard injustifié, de la décision prise.
-- Il reçoit un e-mail quand le signalement est traité (« resolved ») ou classé (« dismissed »),
-- dans sa langue : celle de son compte, ou celle de la page pour un signalement sans compte.

alter table public.reports
  add column if not exists reporter_locale text check (reporter_locale is null or reporter_locale in ('fr', 'en', 'es', 'ar'));

create or replace function public.admin_handle_report(p_report_id uuid, p_status public.report_status, p_note text)
returns void
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
  v_payload jsonb;
  v_dedupe text;
begin
  perform app.require_permission('reports.handle');
  update public.reports set status = p_status, resolution_note = p_note, handled_by = auth.uid(), handled_at = now()
   where id = p_report_id
   returning * into v_report;
  if v_report.id is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform app.audit('report.handle', 'report', p_report_id::text, jsonb_build_object('status', p_status));

  if p_status in ('resolved', 'dismissed') then
    -- The internal resolution note is never sent to the reporter.
    v_payload := jsonb_build_object(
      'status', p_status,
      'reference', upper(left(p_report_id::text, 8)),
      'job_title', coalesce((select j.title from public.jobs j where j.id = v_report.job_id), '')
    );
    v_dedupe := 'report_decision:' || p_report_id || ':' || p_status;
    if v_report.reporter_id is not null then
      perform app.enqueue_email(v_report.reporter_id, 'report_decision', v_payload, v_dedupe);
    elsif v_report.reporter_email is not null then
      insert into public.email_outbox (user_id, to_email, locale, template, payload, dedupe_key)
      values (null, v_report.reporter_email, coalesce(v_report.reporter_locale, 'fr'), 'report_decision', v_payload, v_dedupe)
      on conflict (dedupe_key) do nothing;
    end if;
  end if;
end;
$$;
