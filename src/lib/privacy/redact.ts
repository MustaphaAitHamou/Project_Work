/**
 * Removal of personal data from CV text (anonymous preselection).
 *
 * Rule-based and conservative: it prefers hiding a little too much over leaving a
 * direct identifier. It cannot guarantee anonymity (a rare job title or a small
 * employer can still point to someone): the candidate reviews and corrects the
 * result before it is shown to recruiters, and the database applies a second,
 * simpler mask (app.mask_personal_text) to whatever is saved.
 */

export const REDACTION_CATEGORIES = ["name", "email", "phone", "link", "address", "birth", "age", "personal"] as const;
export type RedactionCategory = (typeof REDACTION_CATEGORIES)[number];

export type RedactionLabels = Record<RedactionCategory, string>;

export interface RedactionOptions {
  /** First and last names of the person (each part of a compound name is also hidden). */
  names?: readonly string[];
  /** Other exact values to hide (e-mail address, phone number…). */
  knownValues?: readonly string[];
  /** Replacement shown in place of each category, e.g. "[e-mail masqué]". */
  labels: RedactionLabels;
}

export interface RedactionResult {
  text: string;
  /** How many items were hidden, per category (never the hidden values). */
  counts: Partial<Record<RedactionCategory, number>>;
}

/** Lines at the top of a CV that usually hold the personal details. */
const HEADER_LINES = 12;

const ACCENTS: Record<string, string> = {
  a: "aàáâãäåā",
  c: "cçć",
  e: "eèéêëē",
  i: "iìíîïī",
  n: "nñ",
  o: "oòóôõöō",
  s: "sšś",
  u: "uùúûüū",
  y: "yýÿ",
  z: "zžź",
};

// "-" is left alone: outside a character class it is literal, and "\-" is invalid in Unicode mode.
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const stripAccents = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "");

/** Case- and accent-insensitive pattern for a name; separators match any space, hyphen or apostrophe. */
function namePattern(name: string): string {
  return stripAccents(name.trim().toLowerCase())
    .split(/[\s'’-]+/u)
    .filter(Boolean)
    .map((part) => [...part].map((ch) => (ACCENTS[ch] ? `[${ACCENTS[ch]}]` : escapeRegExp(ch))).join(""))
    .join("[\\s'’-]+");
}

/** Full names, then each part of 3 letters or more; longest first. */
export function nameVariants(names: readonly string[]): string[] {
  const out = new Set<string>();
  const clean = names.map((n) => n.trim()).filter((n) => n.length >= 2);
  for (const n of clean) out.add(n);
  if (clean.length >= 2) out.add(clean.join(" "));
  for (const n of clean) for (const part of n.split(/[\s'’-]+/u)) if (part.length >= 3) out.add(part);
  return [...out].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

// "Not preceded / followed by a letter or digit" (JavaScript's \b only knows ASCII).
const B = "(?<![\\p{L}\\p{N}])";
const E = "(?![\\p{L}\\p{N}])";
const re = (source: string, flags = "giu") => new RegExp(source, flags);

const EMAIL = re("[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)*\\.\\p{L}{2,}");
const URL_RE = re(`${B}(?:https?://|www\\.)[^\\s<>"')\\]]+`);
const SOCIAL = re(
  `${B}(?:linkedin|github|gitlab|twitter|x|facebook|instagram|tiktok|youtube|behance|dribbble|malt|viadeo|t|wa)\\.(?:com|me|fr|io)/[^\\s<>"')\\]]*`,
);
const HANDLE = re("(?<=^|[\\s(])@[\\p{L}\\p{N}_.]{2,}", "gmu");
// 9 digits or more (phones, social security or ID numbers). Year ranges such as
// 2018-2021 or 01/2018-06/2021 are kept: "/" is not accepted inside a number.
const PHONE = re(`${B}\\+?\\(?\\d(?:[ .()-]{0,2}\\d){8,}(?![\\p{N}])`, "gu");

// "Label : value" lines (French, English, Spanish, Arabic) whose value is personal.
const LINE_START = "^(\\s*[-•*]?\\s*)";
const SEP = "(\\s*[:：-]\\s*|\\s+)";
const COLON = "(\\s*[:：-]\\s*)";
const LABELLED: Array<[RegExp, RedactionCategory]> = [
  [
    re(
      `${LINE_START}(date\\s+(?:et\\s+lieu\\s+)?de\\s+naissance|lieu\\s+de\\s+naissance|date\\s+of\\s+birth|place\\s+of\\s+birth|birth\\s*date|d\\.?o\\.?b\\.?|fecha\\s+de\\s+nacimiento|lugar\\s+de\\s+nacimiento|تاريخ\\s+الميلاد|مكان\\s+الميلاد)${SEP}(.+)$`,
      "iu",
    ),
    "birth",
  ],
  [re(`${LINE_START}(âge|age|edad|العمر|السن)${SEP}(.+)$`, "iu"), "age"],
  [
    re(
      `${LINE_START}(adresse(?!\\s+(?:e-?mail|mail|électronique|electronique))(?:\\s+postale)?|domicile|address|home\\s+address|dirección|domicilio|العنوان)${SEP}(.+)$`,
      "iu",
    ),
    "address",
  ],
  [re(`${LINE_START}(sexe|genre|sex|gender|sexo|género|الجنس)${COLON}(.+)$`, "iu"), "personal"],
  [re(`${LINE_START}(nationalités?|nationality|nationalities|citizenship|nacionalidad|الجنسية)${SEP}(.+)$`, "iu"), "personal"],
  [
    re(
      `${LINE_START}(situation\\s+(?:familiale|de\\s+famille|matrimoniale)|état\\s+civil|marital\\s+status|family\\s+status|estado\\s+civil|الحالة\\s+(?:الاجتماعية|العائلية))${SEP}(.+)$`,
      "iu",
    ),
    "personal",
  ],
  [
    re(
      `${LINE_START}(religion|religión|الديانة|photo|numéro\\s+de\\s+sécurité\\s+sociale|n°\\s*de\\s+sécurité\\s+sociale|social\\s+security\\s+number|ssn|passeport|passport|pasaporte|carte\\s+d['’]identité|id\\s+card|dni|nie)${COLON}(.+)$`,
      "iu",
    ),
    "personal",
  ],
];

// Inline personal details anywhere in the text.
const INLINE: Array<[RegExp, RedactionCategory]> = [
  [re(`${B}(?:née?|nee)\\s+(?:le|en|à|a)\\s+[^\\n,;.]{1,40}`), "birth"],
  [re(`${B}born\\s+(?:on|in)\\s+[^\\n,;.]{1,40}`), "birth"],
  [re(`${B}nacid[oa]\\s+(?:el|en)\\s+[^\\n,;.]{1,40}`), "birth"],
  [re(`${B}(?:âgée?|agée?|aged)\\s+(?:de\\s+)?\\d{2}(?:\\s*(?:ans|years))?${E}`), "age"],
  [re(`${B}\\d{2}\\s*(?:years?\\s+old|ans\\s+révolus|años\\s+de\\s+edad)${E}`), "age"],
  [re(`${B}de\\s+nationalité\\s+[\\p{L}-]+(?:\\s+et\\s+[\\p{L}-]+)?`), "personal"],
  // Spanish identity numbers (DNI / NIE).
  [re(`${B}(?:\\d{8}|[XYZ]\\d{7})[A-HJ-NP-TV-Z]${E}`, "gu"), "personal"],
  // Street address with a number, in the main languages of the nine markets.
  [
    re(
      `${B}\\d{1,4}(?:\\s?(?:bis|ter))?,?\\s+(?:rue|avenue|av\\.|bd|boulevard|chemin|impasse|allée|route|quai|résidence|lotissement|street|st\\.|road|rd\\.|lane|avenida|avda\\.|calle|plaza|paseo)${E}[^\\n]{0,60}`,
    ),
    "address",
  ],
  // Spanish and Portuguese order: street type, name, then number ("Calle Mayor 5").
  [re(`${B}(?:calle|c/|avenida|avda\\.|paseo|plaza|carrer|rua|travessa)\\s+[^\\n,;]{2,40}?\\s\\d{1,4}${E}`), "address"],
  [re(`${B}(?:L|CH|B|F)-\\d{4,5}${E}(?:\\s+\\p{Lu}[\\p{L}'’ -]{1,40})?`, "gu"), "address"],
  // Postal code followed by a town ("75002 Paris", "1000 Bruxelles" has 4 digits and is left alone).
  [re(`${B}\\d{5}\\s+\\p{Lu}[\\p{L}'’-]+(?:[ -]\\p{Lu}[\\p{L}'’-]+){0,3}${E}`, "gu"), "address"],
  [re(`${B}[A-Z]\\d[A-Z]\\s?\\d[A-Z]\\d${E}`, "gu"), "address"], // Canadian postal code
  [re(`${B}[A-Z]{1,2}\\d[A-Z\\d]?\\s\\d[A-Z]{2}${E}`, "gu"), "address"], // UK postcode
  // Civility titles reveal the gender.
  [re(`${B}(?:M\\.|Mr\\.?|Mrs\\.?|Ms\\.?|Mme\\.?|Mlle\\.?|Monsieur|Madame|Mademoiselle|Sr\\.|Sra\\.|Srta\\.)(?=\\s+\\p{Lu})`, "gu"), "personal"],
];

// Details that only mean something at the top of the CV (where the personal block is).
const SEGMENT_START = "(?<=^|[,;|•·]\\s*)";
const SEGMENT_END = "(?=\\s*(?:$|[,;|•·.]))";
const HEADER_ONLY: Array<[RegExp, RedactionCategory]> = [
  [re(`${B}\\d{1,2}[/.-]\\d{1,2}[/.-](?:19|20)\\d{2}(?![\\p{N}])`, "gu"), "birth"],
  [
    re(
      `${B}\\d{1,2}\\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+(?:19|20)\\d{2}(?![\\p{N}])`,
    ),
    "birth",
  ],
  [re(`${SEGMENT_START}[1-7]\\d\\s*(?:ans|years|años)${SEGMENT_END}`, "gimu"), "age"],
  [
    re(
      `${SEGMENT_START}(?:mariée?|célibataire|pacsée?|divorcée?|veu(?:f|ve)|en\\s+couple|married|single|divorced|widowed|casad[oa]|solter[oa]|divorciad[oa]|\\d+\\s+enfants?|\\d+\\s+children|\\d+\\s+hij[oa]s?|homme|femme|male|female|hombre|mujer)${SEGMENT_END}`,
      "gimu",
    ),
    "personal",
  ],
];

/**
 * While rules run, each hidden item is a sentinel made of private-use characters
 * only (no letter, digit or space), so that later rules can never match inside a
 * label — e.g. the name "Liên" inside "[lien masqué]".
 */
const OPEN = "";
const CLOSE = "";
const encode = (n: number) => [...String(n)].map((d) => String.fromCharCode(0xe100 + Number(d))).join("");
const SENTINEL = /([-]+)/g;
const SENTINEL_ONLY = /^\s*(?:[-]+\s*)+$/;

/** Hides direct identifiers in a CV text. Pure function: same input, same output. */
export function redactPersonalData(input: string, options: RedactionOptions): RedactionResult {
  const counts: RedactionResult["counts"] = {};
  const hidden: RedactionCategory[] = [];
  const mark = (category: RedactionCategory) => {
    counts[category] = (counts[category] ?? 0) + 1;
    hidden.push(category);
    return `${OPEN}${encode(hidden.length - 1)}${CLOSE}`;
  };
  const apply = (text: string, pattern: RegExp, category: RedactionCategory) => text.replace(pattern, () => mark(category));
  const labelValues = new Set(Object.values(options.labels));

  let text = input
    .replace(/\r\n?/g, "\n")
    .replace(/[   ]/g, " ")
    .replace(/[-]/g, "") // no private-use characters from the source
    .replace(/[ \t]+\n/g, "\n");

  // 1. Exact known values first (e-mail, phone as typed in the profile).
  for (const value of options.knownValues ?? []) {
    const v = value.trim();
    if (v.length < 4) continue;
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 8 && /^[\d\s+().-]+$/.test(v)) {
      text = apply(text, new RegExp(`${[...digits].join("[\\s.()-]{0,2}")}(?!\\d)`, "g"), "phone");
    } else {
      text = apply(text, new RegExp(escapeRegExp(v), "giu"), v.includes("@") ? "email" : "personal");
    }
  }

  // 2. Contact details and links.
  text = apply(text, EMAIL, "email");
  text = apply(text, URL_RE, "link");
  text = apply(text, SOCIAL, "link");
  text = apply(text, HANDLE, "link");
  text = apply(text, PHONE, "phone");

  // 3. Labelled personal details, line by line (the label stays, the value goes).
  text = text
    .split("\n")
    .map((line) => {
      for (const [pattern, category] of LABELLED) {
        const m = pattern.exec(line);
        if (!m) continue;
        // A value that is already hidden stays as it is (running twice changes nothing).
        if (SENTINEL_ONLY.test(m[4]) || labelValues.has(m[4].trim())) return line;
        return `${m[1]}${m[2]}${m[3]}${mark(category)}`;
      }
      return line;
    })
    .join("\n");

  // 4. Inline details anywhere, then those that only make sense in the header.
  for (const [pattern, category] of INLINE) text = apply(text, pattern, category);
  const lines = text.split("\n");
  let header = lines.slice(0, HEADER_LINES).join("\n");
  for (const [pattern, category] of HEADER_ONLY) header = apply(header, pattern, category);
  text = [header, ...lines.slice(HEADER_LINES)].join("\n");

  // 5. The person's names.
  for (const name of nameVariants(options.names ?? [])) {
    text = apply(text, re(`${B}${namePattern(name)}${E}`), "name");
  }

  // 6. Labels, then tidy up (no runs of blank lines or spaces).
  text = text
    .replace(SENTINEL, (_, code: string) => {
      const index = Number([...code].map((c) => c.charCodeAt(0) - 0xe100).join(""));
      return options.labels[hidden[index]];
    })
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .trim();
  return { text, counts };
}

/** Total number of hidden items. */
export function redactionTotal(counts: RedactionResult["counts"]): number {
  return Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
}
