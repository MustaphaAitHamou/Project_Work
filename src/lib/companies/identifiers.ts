/**
 * Company identifiers per market: format normalisation and checksum validation.
 * Pure functions (unit-tested). Where no public checksum algorithm is documented,
 * only the format is checked and the file goes to manual verification.
 */
export type IdTypeCode =
  | "fr_siren"
  | "dz_rc"
  | "ca_corporation"
  | "ca_neq"
  | "ca_provincial"
  | "us_state_file"
  | "ch_uid"
  | "lu_rcs"
  | "es_nif"
  | "uk_crn"
  | "be_kbo";

export type SecondaryCode = "fr_siret" | "fr_vat" | "dz_nif" | "dz_nis" | "ca_bn" | "us_ein" | "lu_vat" | "eu_vat";

export interface IdTypeDefinition {
  code: IdTypeCode;
  country: string;
  /** Requires a registration region (US state, Canadian province). */
  requiresRegion?: boolean;
  placeholder: string;
  normalize(raw: string): string;
  validate(normalized: string): boolean;
  secondary: SecondaryCode[];
}

const digitsOnly = (s: string) => s.replace(/[\s.\-/]/g, "");
const upperAlnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function luhn(num: string): boolean {
  if (!/^\d+$/.test(num)) return false;
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** SIREN (9 digits, Luhn). */
export function isValidSiren(siren: string): boolean {
  return /^\d{9}$/.test(siren) && luhn(siren);
}

/** SIRET (14 digits, Luhn; La Poste establishments use a sum divisible by 5). */
export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  if (siret.startsWith("356000000")) return siret.split("").reduce((s, d) => s + Number(d), 0) % 5 === 0;
  return luhn(siret);
}

/** French intra-community VAT number derived from the SIREN. */
export function frenchVatFromSiren(siren: string): string {
  const key = (12 + 3 * (Number(siren) % 97)) % 97;
  return `FR${String(key).padStart(2, "0")}${siren}`;
}

/** Swiss UID (CHE-123.456.789), modulo 11 with weights 5,4,3,2,7,6,5,4. */
export function isValidSwissUid(uid: string): boolean {
  const m = /^CHE(\d{9})$/.exec(uid);
  if (!m) return false;
  const d = m[1].split("").map(Number);
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  const sum = weights.reduce((s, w, i) => s + w * d[i], 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === d[8];
}

/** Belgian enterprise number (BCE/KBO): 10 digits, last two = 97 - (first eight mod 97). */
export function isValidBelgianEnterprise(num: string): boolean {
  if (!/^[01]\d{9}$/.test(num)) return false;
  const base = Number(num.slice(0, 8));
  return 97 - (base % 97) === Number(num.slice(8));
}

/** Luxembourg VAT (LU + 8 digits, first six mod 89 = last two). */
export function isValidLuxembourgVat(vat: string): boolean {
  const m = /^LU(\d{8})$/.exec(vat);
  if (!m) return false;
  return Number(m[1].slice(0, 6)) % 89 === Number(m[1].slice(6));
}

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
/** Spanish NIF: CIF (companies), DNI or NIE (self-employed). */
export function isValidSpanishNif(value: string): boolean {
  const v = value.toUpperCase();
  if (/^\d{8}[A-Z]$/.test(v)) return DNI_LETTERS[Number(v.slice(0, 8)) % 23] === v[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const n = Number(String("XYZ".indexOf(v[0])) + v.slice(1, 8));
    return DNI_LETTERS[n % 23] === v[8];
  }
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v);
  if (!m) return false;
  const digits = m[2].split("").map(Number);
  let sum = 0;
  digits.forEach((d, i) => {
    if (i % 2 === 1) sum += d;
    else {
      const x = d * 2;
      sum += Math.floor(x / 10) + (x % 10);
    }
  });
  const controlDigit = (10 - (sum % 10)) % 10;
  const controlLetter = "JABCDEFGHI"[controlDigit];
  const c = m[3];
  if ("PQRSNW".includes(m[1])) return c === controlLetter;
  if ("ABEH".includes(m[1])) return c === String(controlDigit);
  return c === String(controlDigit) || c === controlLetter;
}

/** UK Companies House registration number: 8 digits or 2-letter prefix + 6 digits. */
export function normalizeUkCrn(raw: string): string {
  const v = upperAlnum(raw);
  return /^\d{1,8}$/.test(v) ? v.padStart(8, "0") : v;
}
export function isValidUkCrn(v: string): boolean {
  return /^(\d{8}|(SC|NI|OC|SO|NC|SL|SE|SP|IP|SR|RC|FC|GE|LP|NL|NF|NO|NP|NR|NZ|R0|ES|ZC|LS|SA|NA|IC|SG|SI|SZ|AC|CE|CS|GS|IS|RS|SF)\d{6})$/.test(v);
}

export const ID_TYPES: Record<IdTypeCode, IdTypeDefinition> = {
  fr_siren: {
    code: "fr_siren",
    country: "FR",
    placeholder: "552 100 554",
    normalize: (s) => digitsOnly(s).slice(0, 14).slice(0, 9),
    validate: isValidSiren,
    secondary: ["fr_siret", "fr_vat"],
  },
  dz_rc: {
    code: "dz_rc",
    country: "DZ",
    placeholder: "16/00-1234567 B 12",
    normalize: (s) => s.toUpperCase().replace(/\s+/g, " ").trim(),
    validate: (v) => /^[0-9A-Z][0-9A-Z /-]{4,28}[0-9A-Z]$/.test(v),
    secondary: ["dz_nif", "dz_nis"],
  },
  ca_corporation: {
    code: "ca_corporation",
    country: "CA",
    placeholder: "1234567",
    normalize: (s) => digitsOnly(s),
    validate: (v) => /^\d{6,8}$/.test(v),
    secondary: ["ca_bn"],
  },
  ca_neq: {
    code: "ca_neq",
    country: "CA",
    placeholder: "1171234567",
    normalize: (s) => digitsOnly(s),
    validate: (v) => /^\d{10}$/.test(v),
    secondary: ["ca_bn"],
  },
  ca_provincial: {
    code: "ca_provincial",
    country: "CA",
    requiresRegion: true,
    placeholder: "BC1234567",
    normalize: upperAlnum,
    validate: (v) => /^[A-Z0-9]{4,15}$/.test(v),
    secondary: ["ca_bn"],
  },
  us_state_file: {
    code: "us_state_file",
    country: "US",
    requiresRegion: true,
    placeholder: "7286832",
    normalize: (s) => s.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
    validate: (v) => /^[A-Z0-9-]{3,20}$/.test(v),
    secondary: ["us_ein"],
  },
  ch_uid: {
    code: "ch_uid",
    country: "CH",
    placeholder: "CHE-123.456.788",
    normalize: (s) => {
      const v = upperAlnum(s);
      return /^\d{9}$/.test(v) ? `CHE${v}` : v;
    },
    validate: isValidSwissUid,
    secondary: [],
  },
  lu_rcs: {
    code: "lu_rcs",
    country: "LU",
    placeholder: "B123456",
    normalize: upperAlnum,
    validate: (v) => /^[A-Z]\d{1,7}$/.test(v),
    secondary: ["lu_vat"],
  },
  es_nif: {
    code: "es_nif",
    country: "ES",
    placeholder: "B12345674",
    normalize: (s) => upperAlnum(s).replace(/^ES/, ""),
    validate: isValidSpanishNif,
    secondary: [],
  },
  uk_crn: {
    code: "uk_crn",
    country: "GB",
    placeholder: "00000006",
    normalize: normalizeUkCrn,
    validate: isValidUkCrn,
    secondary: [],
  },
  be_kbo: {
    code: "be_kbo",
    country: "BE",
    placeholder: "0403.170.701",
    normalize: (s) => {
      const v = digitsOnly(upperAlnum(s).replace(/^BE/, ""));
      return v.length === 9 ? `0${v}` : v;
    },
    validate: isValidBelgianEnterprise,
    secondary: [],
  },
};

export const SECONDARY_IDS: Record<SecondaryCode, { normalize(s: string): string; validate(v: string): boolean; private?: boolean }> = {
  fr_siret: { normalize: digitsOnly, validate: isValidSiret },
  fr_vat: { normalize: upperAlnum, validate: (v) => /^FR[0-9A-Z]{2}\d{9}$/.test(v) },
  dz_nif: { normalize: digitsOnly, validate: (v) => /^\d{15,20}$/.test(v) },
  dz_nis: { normalize: digitsOnly, validate: (v) => /^\d{12,20}$/.test(v) },
  ca_bn: { normalize: upperAlnum, validate: (v) => /^\d{9}([A-Z]{2}\d{4})?$/.test(v) },
  us_ein: { normalize: digitsOnly, validate: (v) => /^\d{9}$/.test(v), private: true },
  lu_vat: { normalize: (s) => (upperAlnum(s).startsWith("LU") ? upperAlnum(s) : `LU${digitsOnly(s)}`), validate: isValidLuxembourgVat },
  eu_vat: { normalize: upperAlnum, validate: (v) => /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v) },
};

export function idTypesForCountry(country: string): IdTypeDefinition[] {
  return Object.values(ID_TYPES).filter((d) => d.country === country);
}

export function validateIdentifier(type: string, raw: string): { ok: true; normalized: string } | { ok: false } {
  const def = ID_TYPES[type as IdTypeCode];
  if (!def) return { ok: false };
  const normalized = def.normalize(raw);
  return def.validate(normalized) ? { ok: true, normalized } : { ok: false };
}

export function validateSecondary(code: string, raw: string): { ok: true; normalized: string } | { ok: false } {
  const def = SECONDARY_IDS[code as SecondaryCode];
  if (!def) return { ok: false };
  const normalized = def.normalize(raw);
  return def.validate(normalized) ? { ok: true, normalized } : { ok: false };
}
