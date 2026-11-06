-- =============================================================================
-- Back-office support and Tamurt HQ API hardening.
-- =============================================================================

-- Authoritative permission check for server-side operations that use the service
-- role afterwards (refunds, Stripe plan sync, account erasure on request).
create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql stable
security definer
set search_path = ''
as $$ select auth.uid() is not null and app.has_permission(p_permission) $$;

revoke execute on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated, service_role;

-- Escapes LIKE wildcards in user input.
create or replace function app.like_escape(p text)
returns text
language sql immutable
set search_path = ''
as $$ select replace(replace(replace(coalesce(p, ''), '\', '\\'), '%', '\%'), '_', '\_') $$;

-- Admin user search (users.view): e-mail / name lookup without exposing auth tables.
create or replace function public.admin_search_users(p_query text, p_limit integer default 50)
returns table (id uuid, email text, first_name text, last_name text, account_type public.account_type, status public.user_status, created_at timestamptz, roles text[], company_name text)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  perform app.require_permission('users.view');
  return query
  select u.id, u.email, u.first_name, u.last_name, u.account_type, u.status, u.created_at,
         coalesce((select array_agg(r.role::text order by r.role) from public.admin_roles r where r.user_id = u.id), '{}'),
         (select coalesce(c.display_name, c.legal_name) from public.company_members m join public.companies c on c.id = m.company_id where m.user_id = u.id limit 1)
  from public.users u
  where v_q = ''
     or lower(u.email) like '%' || app.like_escape(lower(v_q)) || '%'
     or app.normalize_text(u.first_name || ' ' || u.last_name) like '%' || app.like_escape(app.normalize_text(v_q)) || '%'
  order by u.created_at desc
  limit least(greatest(p_limit, 1), 200);
end;
$$;

revoke execute on function public.admin_search_users(text, integer) from public, anon;
grant execute on function public.admin_search_users(text, integer) to authenticated, service_role;

-- Service clients: allowed IPs must be valid addresses or CIDR ranges.
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
  begin
    perform a::inet from unnest(coalesce(p_allowed_ips, '{}')) a;
  exception when invalid_text_representation then
    raise exception 'invalid_input' using errcode = 'P0001';
  end;
  insert into public.service_api_clients (name, token_prefix, token_hash, scopes, allowed_ips, created_by)
  values (p_name, p_token_prefix, p_token_hash, p_scopes, coalesce(p_allowed_ips, '{}'), auth.uid()) returning id into v_id;
  perform app.audit('service_client.create', 'service_client', v_id::text,
    jsonb_build_object('name', p_name, 'scopes', p_scopes, 'allowed_ips', p_allowed_ips));
  return v_id;
end;
$$;

-- Authentication of internal API clients: token hash + source IP. last_used_at is
-- only updated for accepted calls; a call from a non-allowed IP is refused.
drop function if exists public.service_client_authenticate(text);
create function public.service_client_authenticate(p_token_hash text, p_ip text)
returns jsonb
language plpgsql volatile
security definer
set search_path = ''
as $$
declare
  v public.service_api_clients;
  v_ip inet;
begin
  select * into v from public.service_api_clients where token_hash = p_token_hash and revoked_at is null;
  if v.id is null then
    return null;
  end if;
  if cardinality(v.allowed_ips) > 0 then
    begin
      v_ip := p_ip::inet;
    exception when others then
      v_ip := null;
    end;
    if v_ip is null or not exists (select 1 from unnest(v.allowed_ips) a where v_ip <<= a::inet) then
      return jsonb_build_object('id', v.id, 'denied', 'ip_not_allowed');
    end if;
  end if;
  update public.service_api_clients set last_used_at = now() where id = v.id;
  return jsonb_build_object('id', v.id, 'name', v.name, 'scopes', v.scopes);
end;
$$;

revoke execute on function public.service_client_authenticate(text, text) from public, anon, authenticated;
grant execute on function public.service_client_authenticate(text, text) to service_role;
