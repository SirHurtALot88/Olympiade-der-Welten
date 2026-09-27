export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import { listeKarten } from "@/lib/kartenschmiede/karten-store";

export async function GET() {
  const zugriff = await kartenZugriff();
  if (!zugriff) return NextResponse.json({ ok: false, error: "nicht_eingeloggt" }, { status: 401 });
  return NextResponse.json({ ok: true, karten: listeKarten(zugriff.sammlung) });
}
