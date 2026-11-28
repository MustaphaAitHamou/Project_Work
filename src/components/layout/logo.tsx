import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Tamurt Jobs logo (Tamurt Services art direction): the red TAMURT word with its ⵜⴰⵎⵓⵔⵜ line, then "Jobs"
 * in royal blue, drawn from Plus Jakarta Sans ExtraBold (the heading typeface, November 2026 redesign).
 * Files live in public/brand: one version for light backgrounds, one for dark (switched with the theme).
 */
export function Logo({ className, label = "Tamurt Jobs", onDark = false }: { className?: string; label?: string; onDark?: boolean }) {
  // On the night-blue surfaces (footer), always the version for dark backgrounds.
  if (onDark) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Image src="/brand/wordmark-sombre.svg" alt={label} width={112} height={32} unoptimized className="h-8 w-auto" />
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image src="/brand/wordmark.svg" alt={label} width={112} height={32} unoptimized priority className="h-7 w-auto min-[380px]:h-8 dark:hidden" />
      <Image src="/brand/wordmark-sombre.svg" alt={label} width={112} height={32} unoptimized className="hidden h-7 w-auto min-[380px]:h-8 dark:block" />
    </span>
  );
}
