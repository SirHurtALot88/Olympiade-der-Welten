import type { Metadata, Viewport } from "next";

import "./globals.css";
import { AuthStatusBadge } from "@/components/auth/AuthStatusBadge";
import { BugReportFlag } from "@/components/feedback/BugReportFlag";
import { isAuthEnabled } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: "Olympiade der Welten",
  description: "Olympiade der Welten – Manager-Spiel, solo oder online zu zweit.",
  // Das Manifest liegt in `app/manifest.ts` und macht die Anwendung installierbar:
  // eigenes Fenster, eigenes Icon, keine Adressleiste.
  manifest: "/manifest.webmanifest",
  applicationName: "Olympiade",
  appleWebApp: {
    // iOS kennt kein Manifest — dort entsteht das Fenster ohne Leiste ueber diese Angaben.
    capable: true,
    title: "Olympiade",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/app-icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // Faerbt die Systemleiste im installierten Fenster, damit der Rahmen nicht heller
  // ist als die Anwendung darin.
  themeColor: "#0B1018",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <AuthStatusBadge authEnabled={isAuthEnabled()} />
        {/* Immer erreichbar, unabhaengig vom Login: melden koennen soll man auch auf einer
            Seite, die gerade halb kaputt ist. */}
        <BugReportFlag />
        {children}
      </body>
    </html>
  );
}
