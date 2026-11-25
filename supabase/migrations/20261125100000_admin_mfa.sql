-- Double authentification (TOTP) obligatoire pour le back-office.
--
-- Toute permission d'administration (app.has_permission, app.is_admin) exige désormais
-- une session de niveau aal2, c'est-à-dire vérifiée par un second facteur. Le contrôle
-- s'applique dans la base elle-même : un jeton volé ou une session sans second facteur
-- ne permet aucune action d'administration, même en appelant directement l'API.
--
-- Réglage security.admin_mfa_required : vrai par défaut (projets hébergés). Il n'est
-- désactivé que par supabase/seed.sql, en développement local et en CI. Le modifier
-- exige lui-même la permission settings.manage, donc une session aal2.

insert into public.platform_settings (key, value, is_public, description) values
  ('security.admin_mfa_required', 'true', false, 'Exige la double authentification (application TOTP) pour toute action du back-office. Ne jamais désactiver hors développement local.')
on conflict (key) do nothing;

create or replace function app.admin_mfa_satisfied()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select coalesce((select (s.value #>> '{}')::boolean from public.platform_settings s where s.key = 'security.admin_mfa_required'), true) is false
      or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

create or replace function app.has_permission(p_permission text)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select app.admin_mfa_satisfied() and exists (
    select 1
    from public.admin_roles r
    join public.users u on u.id = r.user_id
    where r.user_id = auth.uid()
      and u.status = 'active'
      and r.role = any (app.permission_roles(p_permission))
  )
$$;

create or replace function app.is_admin()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select app.admin_mfa_satisfied() and exists (
    select 1 from public.admin_roles r join public.users u on u.id = r.user_id
    where r.user_id = auth.uid() and u.status = 'active'
  )
$$;

-- For the application: is a second factor required, and is the current session verified with it?
create or replace function public.admin_mfa_status()
returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'required', coalesce((select (s.value #>> '{}')::boolean from public.platform_settings s where s.key = 'security.admin_mfa_required'), true),
    'aal', coalesce(auth.jwt() ->> 'aal', 'aal1')
  )
$$;

revoke execute on function app.admin_mfa_satisfied() from public, anon;
grant execute on function app.admin_mfa_satisfied() to authenticated, service_role;
revoke execute on function public.admin_mfa_status() from public, anon;
grant execute on function public.admin_mfa_status() to authenticated, service_role;
