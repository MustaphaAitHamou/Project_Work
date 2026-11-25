import type { ErrorEvent } from "@sentry/nextjs";

/** Sentry is enabled only when a DSN is configured (no DSN: nothing is loaded or sent). */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || undefined;

export const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? process.env.VERCEL_ENV ?? "development";

const SECRET_PARAMS = /([?&](?:token|code|access_token|refresh_token|session_id|key)=)[^&#]*/gi;

/**
 * No personal data leaves the platform: no cookies, headers, IP address, user
 * identity or form bodies; secrets are stripped from URLs.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    if (event.request.url) event.request.url = event.request.url.replace(SECRET_PARAMS, "$1[filtered]");
    if (typeof event.request.query_string === "string") event.request.query_string = event.request.query_string.replace(SECRET_PARAMS, "$1[filtered]");
  }
  for (const b of event.breadcrumbs ?? []) {
    if (typeof b.data?.url === "string") b.data.url = b.data.url.replace(SECRET_PARAMS, "$1[filtered]");
  }
  return event;
}
