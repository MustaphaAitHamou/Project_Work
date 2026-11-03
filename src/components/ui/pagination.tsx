import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  const t = useTranslations("common");
  if (totalPages <= 1) return null;
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const linkCls = "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted";
  return (
    <nav aria-label={t("pagination")} className="flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={linkCls} rel="prev" aria-label={t("previous")}>
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      )}
      {sorted.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && sorted[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Link
            href={hrefFor(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(linkCls, p === page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={linkCls} rel="next" aria-label={t("next")}>
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
