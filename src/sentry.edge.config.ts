import * as Sentry from "@sentry/nextjs";
import { scrubEvent, SENTRY_DSN, SENTRY_ENVIRONMENT } from "./sentry.shared";

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    // No personal data: no user identity, cookies, headers, request bodies or query strings.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    beforeSend: scrubEvent,
  });
}
