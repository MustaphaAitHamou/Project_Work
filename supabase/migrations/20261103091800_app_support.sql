-- =============================================================================
-- Application support functions (service role only).
-- =============================================================================

-- Rate limiting entry point for server code (login, sign-up, uploads, reports...).
create or replace function public.rate_limit_check(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language sql volatile
security definer
set search_path = ''
as $$ select app.rate_limit_hit(left(p_key, 200), greatest(p_limit, 1), greatest(p_window_seconds, 1)) $$;

revoke execute on function public.rate_limit_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, integer) to service_role;
