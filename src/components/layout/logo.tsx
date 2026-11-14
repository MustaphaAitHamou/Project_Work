import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Tamurt Jobs logo (Tamurt Services art direction): the red TAMURT word with its ⵜⴰⵎⵓⵔⵜ line, then "Jobs" in work blue.
 * Files live in public/brand: one version for light backgrounds, one for dark (switched with the theme).
 */
export function Logo({ className, label = "Tamurt Jobs" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image src="/brand/wordmark.svg" alt={label} width={104} height={30} unoptimized priority className="h-[30px] w-auto dark:hidden" />
      <Image src="/brand/wordmark-sombre.svg" alt={label} width={104} height={30} unoptimized className="hidden h-[30px] w-auto dark:block" />
    </span>
  );
}
