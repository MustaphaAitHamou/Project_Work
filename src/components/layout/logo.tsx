import { cn } from "@/lib/utils";

/** Tamurt Jobs mark: a horizon line ("tamurt" = land) under a rising arc. Original artwork. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path d="M8 21.5h16" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 17.5a5 5 0 0 1 10 0" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="16" cy="9.5" r="2.1" className="fill-brand-warm" />
    </svg>
  );
}

export function Logo({ className, label = "Tamurt Jobs" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">
        Tamurt<span className="text-brand"> Jobs</span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
