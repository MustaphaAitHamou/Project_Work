-- =============================================================================
-- Reference data required in every environment (production included).
-- No demo users, no administrators, no sample adverts are created here.
-- Paid publishing is DISABLED in every market until an administrator completes
-- the country compliance checklist (see docs/COMPLIANCE_CHECKLIST.md).
-- =============================================================================

insert into public.currencies (code, minor_units) values
  ('EUR', 2), ('USD', 2), ('CAD', 2), ('DZD', 2), ('CHF', 2), ('GBP', 2)
on conflict (code) do nothing;

insert into public.countries (code, default_currency, default_locale, phone_prefix, registry_identifier_types, sort_order) values
  ('FR', 'EUR', 'fr', '+33',  array['fr_siren'], 1),
  ('DZ', 'DZD', 'fr', '+213', array['dz_rc'], 2),
  ('CA', 'CAD', 'en', '+1',   array['ca_corporation', 'ca_neq', 'ca_provincial'], 3),
  ('US', 'USD', 'en', '+1',   array['us_state_file'], 4),
  ('CH', 'CHF', 'fr', '+41',  array['ch_uid'], 5),
  ('LU', 'EUR', 'fr', '+352', array['lu_rcs'], 6),
  ('ES', 'EUR', 'es', '+34',  array['es_nif'], 7),
  ('GB', 'GBP', 'en', '+44',  array['uk_crn'], 8),
  ('BE', 'EUR', 'fr', '+32',  array['be_kbo'], 9)
on conflict (code) do nothing;

insert into public.industries (code, sort_order) values
  ('it_software', 10), ('engineering', 20), ('healthcare', 30), ('education', 40), ('banking_finance', 50),
  ('insurance', 55), ('consulting', 60), ('marketing_communication', 70), ('retail_ecommerce', 80),
  ('hospitality_tourism', 90), ('construction', 100), ('manufacturing', 110), ('logistics_transport', 120),
  ('energy', 130), ('telecom', 140), ('legal', 150), ('human_resources', 160), ('customer_service', 170),
  ('public_sector', 180), ('nonprofit', 190), ('media_arts', 200), ('pharma_biotech', 210),
  ('real_estate', 220), ('research', 230), ('security', 240), ('agriculture', 250), ('automotive', 260),
  ('other', 999)
on conflict (code) do nothing;

insert into public.platform_settings (key, value, is_public, description) values
  ('consent.transmission_version', '"2026-11-01"', true, 'Version of the data-transmission notice shown before the first one-click application.'),
  ('terms.version', '"2026-11-01"', true, 'Version of the terms of use accepted at sign-up.'),
  ('applications.daily_limit', '60', false, 'Maximum applications per candidate per 24h (abuse protection).'),
  ('billing.grace_days', '3', true, 'Days an advert stays online after a failed renewal payment before suspension.'),
  ('retention.applications_months', '24', true, 'Months after an advert closes before its applications are anonymised.'),
  ('retention.verification_documents_days', '90', true, 'Days verification documents are kept after upload.'),
  ('retention.verification_days', '365', false, 'Days verification reports are kept.'),
  ('uploads.resume_max_bytes', '4194304', true, 'Maximum CV size in bytes (hard limit 4 MiB, platform constraint).'),
  ('uploads.verification_doc_max_bytes', '4194304', false, 'Maximum verification document size in bytes.'),
  ('reports.anonymous_allowed', 'true', true, 'Whether visitors without an account may report an advert.')
on conflict (key) do nothing;

-- Catalogue price of reference: 5.95 EUR per month per active advert (excluding applicable taxes).
-- Administrators may add per-country / per-currency plans from the back-office.
insert into public.pricing_plans (code, country_code, currency, unit_amount, billing_interval, tax_behavior, notes)
select 'job_monthly', null, 'EUR', 595, 'month', 'exclusive', 'Default catalogue price (all markets).'
where not exists (select 1 from public.pricing_plans where code = 'job_monthly' and country_code is null and currency = 'EUR');

-- Compliance checklist (same structure for every market; country-specific guidance in docs/COMPLIANCE_CHECKLIST.md)
insert into public.country_compliance_items (country_code, item_key, is_blocking)
select c.code, i.key, i.blocking
from public.countries c
cross join (values
  ('business_presence', true),
  ('placement_regulation', true),
  ('job_ad_rules', true),
  ('language_requirements', true),
  ('data_protection', true),
  ('data_transfers', true),
  ('privacy_representative', true),
  ('commercial_terms', true),
  ('tax_registration', true),
  ('payments_currency', true),
  ('cookies_ecommerce', true),
  ('e_invoicing', false),
  ('accessibility', false),
  ('trademark', false)
) as i(key, blocking)
on conflict (country_code, item_key) do nothing;

-- Moderation patterns (sent to human review, never auto-rejected). Applied to lower-case, accent-free text.
insert into public.moderation_terms (code, category, language, pattern, description) values
  -- French
  ('age', 'discrimination', 'fr', '\m(age|ages) (maximum|max|minimum|min|limite|requis)\M', 'Âge exigé'),
  ('age', 'discrimination', 'fr', '\m(moins|plus) de [0-9]{2} ans\M', 'Condition d''âge'),
  ('age', 'discrimination', 'fr', '\mentre [0-9]{2} et [0-9]{2} ans\M', 'Tranche d''âge'),
  ('age', 'discrimination', 'fr', '\mjeunes? (homme|femme|fille|garcon)s?\M', 'Jeune homme/femme'),
  ('gender', 'discrimination', 'fr', '\m(hommes?|femmes?) (uniquement|seulement|exclusivement)\M', 'Sexe exigé'),
  ('gender', 'discrimination', 'fr', '\m(uniquement|seulement|exclusivement) (des |pour )?(hommes?|femmes?)\M', 'Sexe exigé'),
  ('gender', 'discrimination', 'fr', '\msexe (masculin|feminin)\M', 'Sexe exigé'),
  ('nationality_origin', 'discrimination', 'fr', '\mnationalite [a-z]+ (exigee|obligatoire|requise|imperative|indispensable)\M', 'Nationalité exigée'),
  ('nationality_origin', 'discrimination', 'fr', '\mpas d.?etrangers?\M', 'Exclusion des étrangers'),
  ('nationality_origin', 'discrimination', 'fr', '\m(type|origine|profil) (europeen|africain|maghrebin|arabe|asiatique|caucasien)ne?s?\M', 'Origine supposée'),
  ('nationality_origin', 'discrimination', 'fr', '\m(de souche|bbr)\M', 'Critère d''origine codé'),
  ('nationality_origin', 'discrimination', 'fr', '\mpas de (maghrebins?|africains?|arabes?|noirs?|roms?)\M', 'Exclusion d''origine'),
  ('religion', 'discrimination', 'fr', '\m(religion|confession)\M', 'Critère religieux'),
  ('appearance', 'discrimination', 'fr', '\m(photo|cv avec photo) (obligatoire|exigee|requise)\M', 'Photo exigée'),
  ('appearance', 'discrimination', 'fr', '\m(belle presentation|physique (agreable|avantageux)|bonne apparence)\M', 'Apparence physique'),
  ('family_status', 'discrimination', 'fr', '\m(celibataire|sans enfants?|situation (familiale|de famille)|enceinte)\M', 'Situation de famille'),
  ('health_disability', 'discrimination', 'fr', '\m(pas de|sans) (handicap|maladie)\M', 'Santé / handicap'),
  ('language_origin', 'discrimination', 'fr', '\m(langue maternelle|sans accent)\M', 'Langue maternelle / accent'),
  ('payment_request', 'scam', 'fr', '\m(frais|caution|paiement|cheque) (d.?inscription|de formation|de dossier|a l.?avance)\M', 'Demande de paiement au candidat'),
  ('apply_elsewhere', 'external_redirect', 'fr', '\m(postulez|candidatez|postuler|candidater) (sur|via|directement sur) (notre|le|leur) site\M', 'Candidature hors plateforme'),
  ('apply_elsewhere', 'external_redirect', 'fr', '\menvoyez (votre |vos )?(cv|candidature)s? (a|par mail|par e-?mail|par courriel)\M', 'Candidature hors plateforme'),
  -- English
  ('age', 'discrimination', 'en', '\m(under|over|below|above|younger than|older than) [0-9]{2}( years)?\M', 'Age condition'),
  ('age', 'discrimination', 'en', '\m(age limit|age range|aged between|maximum age|minimum age)\M', 'Age condition'),
  ('age', 'discrimination', 'en', '\m(young (man|woman|men|women|person|people)|digital natives?)\M', 'Age-coded wording'),
  ('gender', 'discrimination', 'en', '\m(males?|females?|men|women) only\M', 'Gender requirement'),
  ('gender', 'discrimination', 'en', '\monly (males?|females?|men|women)\M', 'Gender requirement'),
  ('nationality_origin', 'discrimination', 'en', '\m(nationals?|citizens?) only\M', 'Nationality requirement (check right-to-work field instead)'),
  ('nationality_origin', 'discrimination', 'en', '\mno (foreigners|immigrants)\M', 'Exclusion of foreigners'),
  ('language_origin', 'discrimination', 'en', '\mnative (english |french |spanish )?speakers?\M', 'Native-speaker requirement'),
  ('religion', 'discrimination', 'en', '\m(christians?|muslims?|jews|jewish|catholics?|hindus?) only\M', 'Religious requirement'),
  ('appearance', 'discrimination', 'en', '\m(photo|picture|headshot) required\M', 'Photo required'),
  ('appearance', 'discrimination', 'en', '\m(attractive|good[- ]looking)\M', 'Physical appearance'),
  ('family_status', 'discrimination', 'en', '\m(no (kids|children)|unmarried|pregnan(t|cy))\M', 'Family status'),
  ('payment_request', 'scam', 'en', '\m((registration|training|application) fee|pay (upfront|in advance)|western union)\M', 'Payment requested from candidates'),
  ('apply_elsewhere', 'external_redirect', 'en', '\mapply (on|via|at|through) our (website|site|portal|careers page)\M', 'Application outside the platform'),
  ('apply_elsewhere', 'external_redirect', 'en', '\msend (your )?(cv|resume) to\M', 'Application outside the platform'),
  -- Spanish
  ('age', 'discrimination', 'es', '\m(menor|mayor|menores|mayores) de [0-9]{2} anos\M', 'Condición de edad'),
  ('age', 'discrimination', 'es', '\medad (maxima|minima|limite)\M', 'Condición de edad'),
  ('age', 'discrimination', 'es', '\mjovenes?\M', 'Edad codificada'),
  ('gender', 'discrimination', 'es', '\m(solo|solamente|unicamente) (hombres|mujeres)\M', 'Requisito de sexo'),
  ('gender', 'discrimination', 'es', '\m(hombres|mujeres) (solo|solamente|unicamente)\M', 'Requisito de sexo'),
  ('nationality_origin', 'discrimination', 'es', '\mnacionalidad [a-z]+ (obligatoria|imprescindible|requerida)\M', 'Nacionalidad exigida'),
  ('nationality_origin', 'discrimination', 'es', '\mno extranjeros\M', 'Exclusión de extranjeros'),
  ('appearance', 'discrimination', 'es', '\m(buena presencia|foto obligatoria)\M', 'Apariencia física'),
  ('payment_request', 'scam', 'es', '\m(cuota|pago) (de inscripcion|por adelantado)\M', 'Pago solicitado'),
  ('apply_elsewhere', 'external_redirect', 'es', '\m(envia|envie|enviar) (tu |su )?(cv|curriculum) a\M', 'Candidatura fuera de la plataforma'),
  -- Arabic (substring patterns: word boundaries are locale-dependent for Arabic script)
  ('gender', 'discrimination', 'ar', '(للرجال|للنساء|ذكور|اناث|إناث) فقط', 'اشتراط الجنس'),
  ('age', 'discrimination', 'ar', '(العمر|السن) (لا يتجاوز|لا يزيد|أقل من|اقل من|أكثر من|اكثر من)', 'اشتراط السن'),
  ('nationality_origin', 'discrimination', 'ar', 'جنسية [^ ]+ (فقط|شرط|إلزامية|الزامية)', 'اشتراط الجنسية'),
  ('appearance', 'discrimination', 'ar', '(حسن المظهر|صورة (شخصية )?(إلزامية|الزامية|مطلوبة))', 'المظهر / الصورة'),
  ('religion', 'discrimination', 'ar', '(مسلم|مسيحي|يهودي)(ين|ون)? فقط', 'اشتراط الدين');
