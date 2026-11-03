import { companyLogoUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Company logo or initials (no photos of people are ever displayed on Tamurt Jobs). */
export function CompanyAvatar({ name, logoPath, className }: { name: string; logoPath?: string | null; className?: string }) {
  const url = companyLogoUrl(logoPath);
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className={cn("flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-secondary text-sm font-semibold text-secondary-foreground", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- small public logo, no optimisation needed
        <img src={url} alt="" className="size-full object-contain" loading="lazy" />
      ) : (
        <span aria-hidden>{letters}</span>
      )}
    </div>
  );
}
