import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

const PROTECTED = /^\/(fr|en|es|ar)\/(candidate|employer|admin)(\/|$)/;

/**
 * Optional HTTP Basic protection of the pre-production site ("user:password",
 * ASCII). Never set it in production. API routes (Stripe webhook, scheduled jobs)
 * are outside this proxy and keep their own authentication.
 */
const PREPROD_BASIC_AUTH = process.env.PREPROD_BASIC_AUTH ?? "";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function basicAuthorized(request: NextRequest): boolean {
  if (!PREPROD_BASIC_AUTH) return true;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  try {
    return safeEqual(atob(header.slice(6).trim()), PREPROD_BASIC_AUTH);
  } catch {
    return false;
  }
}

/**
 * Proxy (formerly "middleware"): locale routing + Supabase session refresh.
 * Route protection here is a UX convenience only: every page, Server Action and
 * Route Handler re-checks authentication and authorisation server-side.
 */
export default async function proxy(request: NextRequest) {
  if (!basicAuthorized(request)) {
    return new NextResponse("Authentification requise (préproduction).", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Tamurt Jobs preprod", charset="UTF-8"', "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const response = handleI18nRouting(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session cookie when needed (do not remove).
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const match = request.nextUrl.pathname.match(PROTECTED);
  if (match && !isAuthenticated) {
    const locale = match[1];
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Skip API routes, auth callbacks, Next internals and static files.
  matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};
