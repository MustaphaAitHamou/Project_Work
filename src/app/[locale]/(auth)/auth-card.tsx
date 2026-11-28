import { getTranslations } from "next-intl/server";
import { BadgeCheck, Globe2, MousePointerClick, Scale } from "lucide-react";

/**
 * Cadre des pages de compte (connexion, inscription, mot de passe, confirmation, sécurité) :
 * le formulaire à droite et, sur grand écran, un panneau de marque bleu nuit à gauche.
 */
export async function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  const t = await getTranslations("home");
  const points = [
    { icon: BadgeCheck, label: t("promise1Title") },
    { icon: MousePointerClick, label: t("promise2Title") },
    { icon: Globe2, label: t("promise3Title") },
    { icon: Scale, label: t("promise4Title") },
  ];
  return (
    <div className="container-page py-8 sm:py-14">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border bg-card shadow-lg lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden bg-[image:var(--brand-gradient)] p-10 text-brand-on lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -start-20 size-72 rounded-full bg-teal-bright/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -end-16 top-10 size-40 rounded-full bg-highlight/20 blur-2xl" />
          <div className="relative">
            <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">{t("badge")}</p>
            <p className="font-display mt-6 text-3xl leading-tight font-extrabold">{t("title")}</p>
          </div>
          <ul className="relative mt-10 space-y-3">
            {points.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm font-medium">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4 text-highlight" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </aside>
        <section className="p-6 sm:p-10">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
          <div className="mt-6 space-y-4">{children}</div>
          {footer && <div className="mt-8 border-t pt-5 text-center text-sm leading-relaxed text-muted-foreground">{footer}</div>}
        </section>
      </div>
    </div>
  );
}
