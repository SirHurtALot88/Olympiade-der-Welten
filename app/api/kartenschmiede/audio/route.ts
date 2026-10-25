export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import { listeAudio } from "@/lib/kartenschmiede/karten-store";

/** Liste der hochgeladenen Audio-Cues (Spielmodus im Reiter „Szenarien“). */
export async function GET() {
  const zugriff = await kartenZugriff();
  if (!zugriff) return NextResponse.json({ ok: false, error: "nicht_eingeloggt" }, { status: 401 });
  return NextResponse.json({ ok: true, audio: listeAudio(zugriff.sammlung) });
}
