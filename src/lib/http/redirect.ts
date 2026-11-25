import { NextResponse } from "next/server";

/**
 * Redirect to a page of this site with a relative Location header. Behind a reverse proxy
 * (Nginx on our own server), the URL the application sees carries its internal address and
 * port (http://localhost:3000): an absolute redirect built from it would send the visitor
 * there. A relative Location is resolved by the browser against the address it really used.
 */
export function redirectToPath(path: string, status: 303 | 307 = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) throw new Error("redirectToPath: same-site path expected");
  return new NextResponse(null, { status, headers: { Location: path } });
}
