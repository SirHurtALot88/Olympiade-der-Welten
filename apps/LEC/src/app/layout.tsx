import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LEC Cockpit",
  description: "Lord Enterich Cards — Shop-Analytics",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
