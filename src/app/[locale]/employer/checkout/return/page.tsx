import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireEmployer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { CheckoutStatus } from "@/components/employer/checkout-status";
import { offerFirstPaidDay } from "@/lib/billing/offer";

export default async function CheckoutReturnPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireEmployer(locale);
  const sp = await searchParams;
  const t = await getTranslations("billing");
  const supabase = await createClient();
  const sessionId = /^cs_[A-Za-z0-9_]{8,200}$/.test(sp.session_id ?? "") ? sp.session_id! : null;
  const { data: sub } = sessionId
    ? await supabase.from("subscriptions").select("job_id, status, current_period_end").eq("stripe_checkout_session_id", sessionId).maybeSingle()
    : { data: null };
  const { data: job } = sub ? await supabase.from("jobs").select("id, status").eq("id", sub.job_id).maybeSingle() : { data: null };
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("returnTitle")} />
      <Card>
        <CardContent className="py-10">
          {/* Confirmed only once the signed webhook has recorded the subscription (an advert
              converted during the launch offer was already online before the checkout). */}
          <CheckoutStatus
            jobId={job?.id ?? null}
            active={job?.status === "active" && ["active", "trialing"].includes(sub?.status ?? "")}
            firstChargeOn={sub?.status === "trialing" && sub.current_period_end ? offerFirstPaidDay(sub.current_period_end, locale) : null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
