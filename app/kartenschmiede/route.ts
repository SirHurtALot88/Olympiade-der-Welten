export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import { kartenschmiedeDokument } from "@/lib/kartenschmiede/seite";

/** Die Kartenschmiede ist eine eigenständige HTML-Seite (apps/kartenschmiede), hinter demselben Login wie das Spiel. */
export async function GET(request: Request) {
  if ((await kartenZugriff()) === null) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return new NextResponse(kartenschmiedeDokument(), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" },
  });
}
