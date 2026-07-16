import type { Metadata } from "next";

import "./globals.css";
import { AuthStatusBadge } from "@/components/auth/AuthStatusBadge";
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
        {children}
      </body>
    </html>
  );
}
