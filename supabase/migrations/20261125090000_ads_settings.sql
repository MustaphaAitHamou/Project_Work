-- Publicité Google AdSense (pages publiques uniquement).
-- Désactivée par défaut : l'activation se fait depuis le back-office (Paramètres), une fois
-- le site validé par Google, le message de consentement publié et les textes mis à jour.
-- L'identifiant éditeur (ca-pub-…) est une variable d'environnement (NEXT_PUBLIC_ADSENSE_CLIENT),
-- car il conditionne la politique de sécurité du contenu et le fichier ads.txt.
insert into public.platform_settings (key, value, is_public, description) values
  ('ads.enabled', 'false', true, 'Affiche les emplacements publicitaires AdSense sur les pages publiques (jamais dans les espaces privés, l''authentification, le paiement ni les pages juridiques).'),
  ('ads.slots', '{}', true, 'Identifiants des blocs d''annonces AdSense par emplacement, par exemple {"home": "1234567890", "jobs": "…", "job": "…", "companies": "…", "company": "…"}.')
on conflict (key) do nothing;
