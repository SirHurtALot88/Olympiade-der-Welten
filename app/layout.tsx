import type { Metadata } from "next";

import "./globals.css";
import { AuthStatusBadge } from "@/components/auth/AuthStatusBadge";
import { isAuthEnabled } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: "Oly Room v0.1",
  description: "Turn-based Raumprototyp für Oly Umbau App v2",
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
