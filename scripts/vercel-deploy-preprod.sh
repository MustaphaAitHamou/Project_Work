#!/usr/bin/env bash
# Déploie UN commit de la branche de préproduction sur le projet Vercel de préproduction, puis
# vérifie le résultat. Vercel compile lui-même ce commit depuis GitHub (source Git), avec les
# réglages et les secrets du projet Vercel : rien de sensible ne transite par GitHub Actions.
#
# Utilisé par .github/workflows/preprod-vercel.yml (après la CI) et utilisable à la main.
#
# Variables requises :
#   VERCEL_TOKEN        jeton Vercel (équipe du projet) — jamais affiché
#   VERCEL_ORG_ID       identifiant de l'équipe Vercel (team_…)
#   VERCEL_PROJECT_ID   identifiant du projet Vercel (prj_…)
#   GIT_REPOSITORY      propriétaire/dépôt GitHub (ex. MustaphaAitHamou/Project_Work)
#   GIT_REF             branche (ex. claude/jobs-lancement)
#   GIT_SHA             commit exact à déployer
# Facultatives :
#   PREPROD_URL                       https://<projet>.vercel.app (alias de préproduction à vérifier)
#   VERCEL_AUTOMATION_BYPASS_SECRET   contournement « Protection Bypass for Automation » : permet
#                                     de vérifier /api/health et noindex derrière Vercel
#                                     Authentication, qui reste activée
#   SKIP_DEPLOYMENT_URL_CHECKS=1      seulement depuis un poste dont le réseau ne joint que l'alias
#                                     (proxy) : l'adresse unique du déploiement n'est alors pas
#                                     contrôlée, et le résumé le dit. Jamais dans GitHub Actions.
#   GITHUB_STEP_SUMMARY, GITHUB_OUTPUT (fournies par GitHub Actions)
#
# Code de sortie non nul dès qu'une vérification échoue : un déploiement n'est annoncé que s'il
# est READY, sur ce commit, servi par l'alias de préproduction, et toujours protégé.
set -euo pipefail

for name in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID GIT_REPOSITORY GIT_REF GIT_SHA; do
  if [ -z "${!name:-}" ]; then echo "::error::Variable manquante : $name" >&2; exit 2; fi
done

summary() { if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$*" >> "$GITHUB_STEP_SUMMARY"; fi; }
output() { if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1=$2" >> "$GITHUB_OUTPUT"; fi; }
fail() { echo "::error::$*" >&2; summary "- ÉCHEC : $*"; exit 1; }

# Appel de l'API Vercel : corps JSON sur stdout ; échec explicite (code et message de Vercel,
# jamais le jeton) si la réponse n'est pas 2xx.
vercel_api() {
  local method=$1 path=$2 body=${3:-} sep='?' response code
  [[ $path == *\?* ]] && sep='&'
  local args=(-sS -X "$method" -H "Authorization: Bearer $VERCEL_TOKEN" -w $'\n%{http_code}')
  if [ -n "$body" ]; then args+=(-H "Content-Type: application/json" --data-binary "$body"); fi
  response=$(curl "${args[@]}" "https://api.vercel.com${path}${sep}teamId=${VERCEL_ORG_ID}") || fail "API Vercel injoignable ($method ${path%%\?*})"
  code=${response##*$'\n'}
  response=${response%$'\n'*}
  if [[ $code != 2* ]]; then
    fail "API Vercel $method ${path%%\?*} : HTTP $code $(echo "$response" | jq -r '[.error.code, .error.message] | map(select(. != null)) | join(" — ")' 2>/dev/null || true)"
  fi
  printf '%s' "$response"
}

summary "### Préproduction Vercel"

# 1. Le jeton voit bien le projet (échoue tôt et clairement sinon).
project=$(vercel_api GET "/v9/projects/${VERCEL_PROJECT_ID}")
project_name=$(echo "$project" | jq -r '.name')
echo "Projet Vercel : $project_name"

# 2. Déploiement du commit exact, compilé par Vercel.
owner=${GIT_REPOSITORY%%/*}
repo=${GIT_REPOSITORY#*/}
body=$(jq -n --arg name "$project_name" --arg project "$VERCEL_PROJECT_ID" --arg org "$owner" --arg repo "$repo" \
  --arg ref "$GIT_REF" --arg sha "$GIT_SHA" \
  '{name: $name, project: $project, target: "production",
    gitSource: {type: "github", org: $org, repo: $repo, ref: $ref, sha: $sha},
    meta: {commit: $sha, source: "github-actions"}}')
created=$(vercel_api POST "/v13/deployments" "$body")
id=$(echo "$created" | jq -r '.id')
url="https://$(echo "$created" | jq -r '.url')"
echo "Déploiement créé : $id ($url)"
output id "$id"
output url "$url"

# 3. Attente de la compilation (20 minutes au plus).
state=""
for _ in $(seq 1 120); do
  deployment=$(vercel_api GET "/v13/deployments/${id}")
  state=$(echo "$deployment" | jq -r '.readyState')
  case "$state" in
    READY) break ;;
    ERROR | CANCELED) fail "Déploiement $id : $state ($(echo "$deployment" | jq -r '.errorMessage // .errorCode // "voir les journaux de compilation Vercel"'))" ;;
  esac
  sleep 10
done
[ "$state" = "READY" ] || fail "Déploiement $id non prêt après 20 minutes (état : $state)"

# 4. C'est bien ce commit.
commit=$(echo "$deployment" | jq -r '.meta.commit // empty')
source_sha=$(echo "$deployment" | jq -r '.gitSource.sha // .meta.githubCommitSha // empty')
[ "$commit" = "$GIT_SHA" ] || fail "Commit déployé « $commit » différent de $GIT_SHA"
if [ -n "$source_sha" ] && [ "$source_sha" != "$GIT_SHA" ]; then fail "Source Git « $source_sha » différente de $GIT_SHA"; fi
summary "- Déploiement : $url ($id), état READY"
summary "- Commit : $GIT_SHA"

# 5. L'alias de préproduction sert ce déploiement.
if [ -n "${PREPROD_URL:-}" ]; then
  host=${PREPROD_URL#https://}
  host=${host%%/*}
  aliased=""
  for _ in $(seq 1 30); do
    aliased=$(vercel_api GET "/v4/aliases/${host}" | jq -r '.deploymentId // .deployment.id // empty')
    [ "$aliased" = "$id" ] && break
    sleep 5
  done
  [ "$aliased" = "$id" ] || fail "L'alias $host sert « $aliased », pas $id"
  summary "- Alias : $PREPROD_URL → $id"
fi

# 6. Vercel Authentication refuse toujours un visiteur anonyme (alias et adresse du déploiement).
targets=()
[ -n "${PREPROD_URL:-}" ] && targets+=("$PREPROD_URL")
if [ "${SKIP_DEPLOYMENT_URL_CHECKS:-}" = "1" ]; then
  echo "::warning::Adresse unique du déploiement non contrôlée (SKIP_DEPLOYMENT_URL_CHECKS=1)."
  summary "- Adresse unique du déploiement : non contrôlée depuis ce poste (réseau limité à l'alias)"
else
  targets+=("$url")
fi
[ "${#targets[@]}" -gt 0 ] || fail "Aucune adresse à contrôler"
for target in "${targets[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$target/fr" || true)
  case "$code" in
    401 | 403 | 302 | 307) echo "Protection active sur $target ($code)" ;;
    000 | "") fail "$target injoignable depuis ce poste (réseau ou proxy) : protection non vérifiée" ;;
    *) fail "$target/fr répond $code sans authentification : la protection Vercel n'est plus active" ;;
  esac
done
summary "- Protection Vercel Authentication : active (${targets[*]})"

# 7. Santé et non-indexation, à travers la protection (contournement réservé à l'automatisation),
#    sur l'alias quand il est connu (il sert ce déploiement, vérifié au point 5).
check_url=${PREPROD_URL:-$url}
if [ -z "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]; then
  echo "::warning::Santé non vérifiée : VERCEL_AUTOMATION_BYPASS_SECRET absent (le site reste protégé)."
  summary "- Santé HTTP : non vérifiée (secret de contournement absent)"
  exit 0
fi
bypass=(-H "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}")
health=""
for _ in $(seq 1 10); do
  health=$(curl -sS --max-time 15 "${bypass[@]}" "$check_url/api/health" || true)
  if echo "$health" | jq -e '.database == "ok"' > /dev/null 2>&1; then break; fi
  health=""
  sleep 6
done
[ -n "$health" ] || fail "$check_url/api/health ne répond pas « database: ok »"
robots=$(curl -sSI "${bypass[@]}" "$check_url/fr" | tr -d '\r' | grep -i '^x-robots-tag:' || true)
echo "$robots" | grep -qi noindex || fail "En-tête noindex absent sur la préproduction"
summary "- Santé HTTP ($check_url) : $(echo "$health" | jq -c '{status, database}')"
summary "- Indexation : ${robots}"
echo "Préproduction déployée et vérifiée : $url"
