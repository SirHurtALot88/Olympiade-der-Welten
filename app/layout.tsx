import type { Metadata } from "next";

import "./globals.css";
import { AuthStatusBadge } from "@/components/auth/AuthStatusBadge";
import { BugReportFlag } from "@/components/feedback/BugReportFlag";
import { isAuthEnabled } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: "Olympiade der Welten",
  description: "Olympiade der Welten – Manager-Spiel, solo oder online zu zweit.",
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
