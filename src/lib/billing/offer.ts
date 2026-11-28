/**
 * Offre de lancement (publication gratuite jusqu'au 31 décembre 2026, heure de Paris) :
 * dates affichées et fin d'essai Stripe. L'instant de fin lui-même vient de la base
 * (réglage billing.free_publication_until, borne exclue) ; rien ici ne dépend de l'heure
 * du serveur, sauf `now` passé explicitement.
 */
export const OFFER_TIME_ZONE = "Europe/Paris";

const intlLocale = (locale: string) => (locale === "ar" ? "ar-u-nu-latn" : locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "fr-FR");

function parisDay(at: Date, locale: string): string {
  const text = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: OFFER_TIME_ZONE, day: "numeric", month: "long", year: "numeric" }).format(at);
  // Ordinal français du premier jour du mois : « 1er janvier 2027 ».
  return locale === "fr" ? text.replace(/^1(?=\s)/, "1er") : text;
}

/** Dernier jour gratuit, heure de Paris (la fin est exclue) : « 31 décembre 2026 ». */
export function offerLastDay(until: string | Date, locale: string): string {
  return parisDay(new Date(new Date(until).getTime() - 1), locale);
}

/** Premier jour payant, heure de Paris : « 1er janvier 2027 ». */
export function offerFirstPaidDay(until: string | Date, locale: string): string {
  return parisDay(new Date(until), locale);
}

/** Stripe Checkout n'accepte qu'une période d'essai finissant au moins 48 heures après la création de la session. */
export const STRIPE_MIN_TRIAL_MS = 48 * 3600_000;

/**
 * Fin de la période d'essai d'un abonnement souscrit pendant que l'annonce est en ligne
 * gratuitement : la fin de sa gratuité, pour que rien ne soit prélevé avant. Dans les
 * dernières 48 heures (plus une marge), le premier instant accepté par Stripe : un peu plus
 * tard, jamais plus tôt. `null` si la gratuité est déjà terminée (abonnement normal).
 */
export function conversionTrialEnd(freeUntil: string | Date, now: Date, marginMs = 3600_000): Date | null {
  const end = new Date(freeUntil).getTime();
  if (!(end > now.getTime())) return null;
  return new Date(Math.max(end, now.getTime() + STRIPE_MIN_TRIAL_MS + marginMs));
}
