import Image from "next/image";
import { env } from "@/lib/env";

/**
 * The yaz button: the red square with the white yaz, at the top right of every Tamurt app.
 * It leads back to Tamurt Services, which presents the whole family of apps.
 * Rendered only when TAMURT_SERVICES_URL is set: never a dead link.
 */
export function TamurtYaz() {
  const href = env().TAMURT_SERVICES_URL;
  if (!href) return null;
  return (
    <a
      href={href}
      title="Tamurt Services"
      aria-label="Tamurt Services"
      className="group grid size-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Image src="/brand/tamurt-yaz.svg" alt="" width={34} height={34} unoptimized className="size-[34px] transition-transform duration-200 group-hover:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
    </a>
  );
}
