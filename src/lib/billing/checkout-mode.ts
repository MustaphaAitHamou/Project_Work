/**
 * Ce que le paiement d'une annonce va faire, selon son état (même règle que
 * billing_prepare_checkout côté base) :
 * - publish : en attente de paiement ;
 * - convert : en ligne gratuitement (offre de lancement), l'abonnement prend le relais à la
 *   fin de la gratuité, sans prélèvement avant ;
 * - reactivate : gratuité terminée (suspension enregistrée ou pas encore), l'abonnement la
 *   remet en ligne dès le paiement.
 * `null` : rien à payer.
 */
export type CheckoutMode = "publish" | "convert" | "reactivate";

export function checkoutMode(job: { status: string; free_until: string | null; suspension_reason: string | null }, now: Date): CheckoutMode | null {
  if (job.status === "pending_payment") return "publish";
  if (job.status === "active" && job.free_until) return new Date(job.free_until) > now ? "convert" : "reactivate";
  if (job.status === "suspended" && job.suspension_reason === "free_period_ended") return "reactivate";
  return null;
}
