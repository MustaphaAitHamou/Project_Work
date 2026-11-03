import "./globals.css";

// The <html> element is rendered by app/[locale]/layout.tsx (locale-aware lang/dir).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
