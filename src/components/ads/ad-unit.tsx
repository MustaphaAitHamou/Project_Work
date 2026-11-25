"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * One AdSense unit. Space is reserved (no layout shift), the unit is requested only
 * when it comes near the viewport, and it collapses when Google has no ad to show.
 * Consent is handled by Google's certified CMP (Privacy & messaging), loaded by the
 * AdSense tag: without consent, only non-personalised or limited ads are served.
 */
export function AdUnit({ client, slot, label, placement }: { client: string; slot: string; label: string; placement: string }) {
  const ref = useRef<HTMLModElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || requested.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (requested.current || !entries.some((e) => e.isIntersecting)) return;
        requested.current = true;
        observer.disconnect();
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch {
          /* blocked by the browser or an extension: the slot stays empty */
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <aside aria-label={label} className="ad-slot my-10" data-ad-placement={placement}>
      <p className="mb-1 text-center text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="ad-slot-box overflow-hidden rounded-md">
        <ins
          ref={ref}
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
      <Script
        id="adsbygoogle-js"
        async
        strategy="afterInteractive"
        crossOrigin="anonymous"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      />
    </aside>
  );
}
