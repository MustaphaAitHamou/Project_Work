# API interne Tamurt HQ

API en lecture seule permettant à Tamurt HQ de suivre l'activité de Tamurt Jobs à partir
d'**indicateurs agrégés uniquement**.

## Ce que l'API ne transmet jamais

Aucune donnée personnelle ni confidentielle ne quitte la plateforme par cette API :
pas de CV, pas de nom, d'adresse e-mail, de téléphone, de profil candidat, de contenu
de candidature, ni d'informations nominatives sur les entreprises. La réponse ne contient
que des **compteurs** et des **montants agrégés par devise et par pays**.

Toute extension de l'API à des données personnelles exigerait au préalable un besoin
démontré, une base juridique documentée (et, le cas échéant, un accord de
responsabilité conjointe ou de sous-traitance entre les entités concernées), ainsi
qu'une mise à jour de la politique de confidentialité. Cette extension n'est pas
implémentée.

Point d'attention : sur un petit marché, un compteur faible (par exemple
`verified_companies: 1`) peut, croisé avec d'autres sources, désigner une entreprise
précise. Tamurt HQ ne doit pas croiser ces chiffres avec des données nominatives.

## Authentification

1. Un **super administrateur** crée un client dans **Administration → Paramètres →
   Clients de l'API Tamurt HQ** (nom, adresses IP autorisées facultatives).
2. Le jeton (`tjhq_` suivi de 43 caractères) est affiché **une seule fois**. Seule son
   empreinte SHA-256 est conservée en base (`service_api_clients.token_hash`).
3. Chaque appel envoie l'en-tête `Authorization: Bearer <jeton>`.
4. Si une liste d'IP est définie (adresses ou plages CIDR, IPv4/IPv6), les appels
   provenant d'une autre adresse sont refusés (403). L'adresse source est lue dans
   `x-forwarded-for`, positionné par l'hébergeur (Vercel). Derrière un autre proxy,
   celui-ci doit écraser cet en-tête, sans quoi la liste d'IP n'apporte aucune garantie ;
   le jeton reste dans tous les cas le facteur d'authentification principal.
5. Rotation : créer un nouveau client, le déployer côté Tamurt HQ, puis **révoquer**
   l'ancien (refus immédiat). Création et révocation sont inscrites au journal d'audit.

## Point d'accès

```
GET /api/internal/hq/v1/metrics?from=2026-10-01&to=2026-11-01
Authorization: Bearer tjhq_…
```

| Paramètre | Format | Défaut | Contrainte |
|---|---|---|---|
| `from` | date ISO (`2026-10-01`) ou date-heure avec fuseau | `to` − 30 jours | `from` < `to` |
| `to` | idem | maintenant | période ≤ 366 jours |

Bornes : `from` incluse, `to` exclue. Les réponses portent `Cache-Control: no-store`.

### Limites de débit

- 120 requêtes par minute et par adresse IP (avant toute vérification du jeton) ;
- 60 requêtes par minute et par client authentifié.

Au-delà : `429` avec `Retry-After: 60`.

### Réponse (200)

```json
{
  "api_version": "v1",
  "period": { "from": "2026-10-01T00:00:00+00:00", "to": "2026-11-01T00:00:00+00:00" },
  "generated_at": "2026-11-06T13:33:48.388184+00:00",
  "companies": { "total": 32, "verified": 26, "new_in_period": 5 },
  "candidates": { "total": 41, "new_in_period": 12 },
  "jobs": { "active": 24, "published_in_period": 9 },
  "applications": { "total": 160, "in_period": 48 },
  "subscriptions": { "active": 8, "new_in_period": 3, "canceled_in_period": 1 },
  "revenue": [{ "currency": "EUR", "net_amount_minor": 1785 }],
  "mrr": [{ "currency": "EUR", "amount_minor": 4760 }],
  "geography": [
    { "country_code": "FR", "active_jobs": 21, "applications_in_period": 16, "verified_companies": 26 }
  ],
  "operations": {
    "verifications_pending": 1,
    "jobs_in_review": 1,
    "open_reports": 0,
    "email_backlog": 0,
    "payment_failures_in_period": 0,
    "webhook_errors": 0
  }
}
```

| Champ | Définition |
|---|---|
| `companies.total` / `verified` | Entreprises inscrites / au statut « vérifiée » |
| `candidates.total` | Comptes candidats non supprimés |
| `jobs.active` | Annonces actuellement publiées |
| `applications.in_period` | Candidatures créées sur la période |
| `subscriptions.active` | Abonnements `active`, `trialing` ou `past_due` |
| `revenue[].net_amount_minor` | Encaissements de la période, remboursements déduits, en unités mineures (centimes), par devise, sans conversion |
| `mrr[].amount_minor` | Somme des prix mensuels des abonnements actifs, par devise |
| `geography[]` | Par pays (pays de localisation principale de l'annonce ; pays d'immatriculation pour les entreprises) |
| `operations` | Files de travail et incidents (vérifications, modération, signalements, e-mails, paiements échoués, webhooks en erreur) |

Les montants proviennent exclusivement des événements Stripe signés reçus par le webhook.

### Erreurs

| Code | Corps | Cause |
|---|---|---|
| 400 | `{"error":"invalid_parameters"}` | `from`/`to` mal formés |
| 400 | `{"error":"invalid_range","max_days":366}` | période vide, inversée ou trop longue |
| 401 | `{"error":"unauthorized"}` | jeton absent, mal formé, inconnu ou révoqué |
| 403 | `{"error":"ip_not_allowed"}` | IP hors de la liste du client |
| 403 | `{"error":"insufficient_scope"}` | portée `metrics:read` absente |
| 429 | `{"error":"rate_limited"}` | limite de débit atteinte |
| 503 | `{"error":"unavailable"}` | base de données indisponible |

## Exemple

```bash
curl -sS "https://jobs.example.com/api/internal/hq/v1/metrics?from=2026-10-01&to=2026-11-01" \
  -H "Authorization: Bearer $TAMURT_HQ_TOKEN"
```

## Implémentation

- Route : `src/app/api/internal/hq/v1/metrics/route.ts`
- Authentification : `src/lib/hq/auth.ts` → `public.service_client_authenticate(hash, ip)`
  (exécutable par le rôle de service uniquement ; met à jour `last_used_at` pour les appels acceptés)
- Agrégats : `public.hq_metrics(from, to)` (rôle de service uniquement)
- Tests : `tests/e2e/admin.spec.ts` (« Tamurt HQ API ») — jeton affiché une fois, empreinte
  seule en base, 401/403/400, absence de données personnelles dans la réponse, révocation.
