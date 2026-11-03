// Fallback for non-localised URLs that do not match any route.
export default function GlobalNotFound() {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>404</h1>
        <p>
          Page introuvable · Page not found · <a href="/fr">Tamurt Jobs</a>
        </p>
      </body>
    </html>
  );
}
