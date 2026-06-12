import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Oly Room v0.1",
  description: "Turn-based Raumprototyp fuer Oly Umbau App v2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
