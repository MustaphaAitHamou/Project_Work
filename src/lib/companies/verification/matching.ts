/** Matching helpers used by the verification engine (pure, unit-tested). */
const LEGAL_FORMS = new Set([
  "sa", "sas", "sasu", "sarl", "eurl", "sci", "snc", "scop", "selarl", "scs", "sca", "ei", "eirl", "micro",
  "ltd", "limited", "plc", "llp", "lp", "llc", "inc", "incorporated", "corp", "corporation", "co", "company",
  "gmbh", "ag", "sagl", "sarl", "srl", "spa", "sl", "slu", "sociedad", "limitada", "anonima", "bv", "nv", "bvba", "sprl", "srl",
  "asbl", "vzw", "eurl", "spa", "sas", "sasu", "groupe", "group", "holding", "the", "et", "and", "de", "du", "des", "la", "le", "les", "of",
]);

export function normalizeName(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !LEGAL_FORMS.has(t));
}

/** Token-set similarity in [0, 1] (Jaccard, with containment bonus). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a));
  const tb = new Set(normalizeName(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = inter / union;
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment * 0.9);
}

/** True when every token of the person's first and last names appears in the officer name. */
export function personMatches(firstName: string, lastName: string, officerName: string): boolean {
  const officer = new Set(normalizeName(officerName.replace(",", " ")));
  const wanted = [...normalizeName(firstName).slice(0, 1), ...normalizeName(lastName)];
  return wanted.length > 0 && wanted.every((t) => officer.has(t));
}

const FREE_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.fr", "yahoo.es", "yahoo.co.uk", "ymail.com", "hotmail.com", "hotmail.fr",
  "hotmail.es", "hotmail.co.uk", "outlook.com", "outlook.fr", "outlook.es", "live.com", "live.fr", "msn.com", "icloud.com", "me.com",
  "mac.com", "aol.com", "gmx.com", "gmx.fr", "gmx.de", "gmx.net", "web.de", "laposte.net", "orange.fr", "wanadoo.fr", "free.fr",
  "sfr.fr", "neuf.fr", "bbox.fr", "yandex.com", "yandex.ru", "mail.ru", "proton.me", "protonmail.com", "pm.me", "zoho.com",
  "tutanota.com", "mail.com", "skynet.be", "telenet.be", "bluewin.ch", "hispeed.ch", "videotron.ca", "sympatico.ca", "rogers.com",
  "shaw.ca", "telus.net", "btinternet.com", "sky.com", "virginmedia.com", "comcast.net", "verizon.net", "att.net", "djaweb.dz",
];

export function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() ?? "";
}

export function isFreeEmail(email: string): boolean {
  return FREE_EMAIL_DOMAINS.includes(emailDomain(email));
}

/** Registrable domain (naive public-suffix handling for common two-level suffixes). */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const twoLevel = ["co.uk", "org.uk", "ac.uk", "gov.uk", "com.dz", "gov.dz", "co.ca", "com.es", "nom.es", "org.es", "com.fr", "asso.fr", "gouv.fr"];
  const lastTwo = parts.slice(-2).join(".");
  return twoLevel.includes(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

export function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    return registrableDomain(new URL(website).hostname);
  } catch {
    return null;
  }
}

export function normalizePostalCode(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "");
}
