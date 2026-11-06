/**
 * France — "API Recherche d'entreprises" (recherche-entreprises.api.gouv.fr), the
 * free public API of the French administration (DINUM) built on SIRENE/RNE data.
 * No key required. Documented fields used: siren, nom_complet, nom_raison_sociale,
 * etat_administratif ("A" active / "C" ceased), siege.{adresse, code_postal,
 * libelle_commune}, dirigeants[].{nom, prenoms, qualite, type_dirigeant, denomination}.
 */
import { getJson, RegistryHttpError } from "../http";
import type { Fetcher, ProviderOutcome, RegistryRecord } from "../types";

interface ApiDirigeant {
  nom?: string | null;
  prenoms?: string | null;
  qualite?: string | null;
  type_dirigeant?: string | null;
  denomination?: string | null;
}
interface ApiResult {
  siren: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  etat_administratif?: string | null;
  date_fermeture?: string | null;
  nature_juridique?: string | null;
  activite_principale?: string | null;
  siege?: { adresse?: string | null; code_postal?: string | null; libelle_commune?: string | null; etat_administratif?: string | null; siret?: string | null } | null;
  dirigeants?: ApiDirigeant[] | null;
}
interface ApiResponse {
  results?: ApiResult[];
  total_results?: number;
}

export const PROVIDER = "fr_recherche_entreprises";
const BASE = "https://recherche-entreprises.api.gouv.fr/search";

export function parseRechercheEntreprises(siren: string, body: ApiResponse): RegistryRecord {
  const r = body.results?.find((x) => x.siren === siren);
  if (!r) return { found: false, active: null };
  const officers = (r.dirigeants ?? [])
    .map((d) =>
      d.type_dirigeant === "personne morale"
        ? { name: d.denomination ?? "", role: d.qualite ?? undefined }
        : { name: `${d.prenoms ?? ""} ${d.nom ?? ""}`.trim(), role: d.qualite ?? undefined },
    )
    .filter((o) => o.name);
  return {
    found: true,
    active: r.etat_administratif === "A" ? true : r.etat_administratif === "C" ? false : null,
    legalName: r.nom_raison_sociale ?? r.nom_complet ?? undefined,
    address: { line: r.siege?.adresse ?? undefined, postalCode: r.siege?.code_postal ?? undefined, city: r.siege?.libelle_commune ?? undefined, country: "FR" },
    officers,
    extract: {
      siren: r.siren,
      nom_complet: r.nom_complet,
      etat_administratif: r.etat_administratif,
      date_fermeture: r.date_fermeture,
      nature_juridique: r.nature_juridique,
      activite_principale: r.activite_principale,
      siege_code_postal: r.siege?.code_postal,
      siege_commune: r.siege?.libelle_commune,
      dirigeants_count: officers.length,
    },
  };
}

export async function lookupFrance(siren: string, fetcher: Fetcher, timeoutMs: number): Promise<ProviderOutcome> {
  try {
    const body = await getJson<ApiResponse>(fetcher, `${BASE}?q=${encodeURIComponent(siren)}&page=1&per_page=5`, { timeoutMs });
    return { status: "ok", provider: PROVIDER, record: parseRechercheEntreprises(siren, body) };
  } catch (e) {
    if (e instanceof RegistryHttpError) {
      if (e.kind === "not_found") return { status: "ok", provider: PROVIDER, record: { found: false, active: null } };
      if (e.kind === "bad_response") return { status: "error", provider: PROVIDER, reason: e.message };
      return { status: "unavailable", provider: PROVIDER, reason: e.kind };
    }
    return { status: "error", provider: PROVIDER, reason: String(e) };
  }
}
