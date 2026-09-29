export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import { kartenschmiedeDokument } from "@/lib/kartenschmiede/seite";

/** Die Kartenschmiede ist eine eigenständige HTML-Seite (apps/kartenschmiede), hinter demselben Login wie das Spiel. */
export async function GET() {
  if ((await kartenZugriff()) === null) {
    // Relativ weiterleiten: request.url trägt hinter dem Reverse-Proxy die interne Adresse (http://0.0.0.0:3000),
    // eine absolute URL daraus schickte den Browser ins Leere.
    return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  }
  return new NextResponse(kartenschmiedeDokument(), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" },
  });
}
