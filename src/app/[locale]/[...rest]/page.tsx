import { notFound } from "next/navigation";

/**
 * Any unknown address under a language (/es/pagina-inexistente): the 404 page of that language
 * ([locale]/not-found.tsx), with the site's header, footer and translations, instead of the
 * bare root page meant for addresses outside the site's languages.
 */
export default function UnknownPage() {
  notFound();
}
