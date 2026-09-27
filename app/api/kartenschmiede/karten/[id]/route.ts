export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import { istGueltigeKartenId, ladeKarte, loescheKarte, speichereKarte } from "@/lib/kartenschmiede/karten-store";

type Kontext = { params: Promise<{ id: string }> };

async function vorpruefen(kontext: Kontext) {
  const zugriff = await kartenZugriff();
  if (!zugriff) return { fehler: NextResponse.json({ ok: false, error: "nicht_eingeloggt" }, { status: 401 }) };
  const { id } = await kontext.params;
  if (!istGueltigeKartenId(id)) return { fehler: NextResponse.json({ ok: false, error: "ungueltige_karten_id" }, { status: 400 }) };
  return { besitzer: zugriff.sammlung, wer: zugriff.wer, id };
}

export async function GET(_request: Request, kontext: Kontext) {
  const v = await vorpruefen(kontext);
  if ("fehler" in v) return v.fehler;
  const karte = ladeKarte(v.besitzer, v.id);
  if (!karte) return NextResponse.json({ ok: false, error: "nicht_gefunden" }, { status: 404 });
  return NextResponse.json({ ok: true, karte });
}

export async function PUT(request: Request, kontext: Kontext) {
  const v = await vorpruefen(kontext);
  if ("fehler" in v) return v.fehler;
  try {
    const body = (await request.json()) as { karte?: unknown; vorschau?: unknown };
    const eintrag = speichereKarte(v.besitzer, v.id, body.karte, body.vorschau, v.wer);
    return NextResponse.json({ ok: true, eintrag });
  } catch (error) {
    const meldung = error instanceof Error ? error.message : "speichern_fehlgeschlagen";
    const status = meldung === "karte_zu_gross" ? 413 : meldung === "karte_fehlt" ? 400 : 500;
    return NextResponse.json({ ok: false, error: meldung }, { status });
  }
}

export async function DELETE(_request: Request, kontext: Kontext) {
  const v = await vorpruefen(kontext);
  if ("fehler" in v) return v.fehler;
  return NextResponse.json({ ok: true, geloescht: loescheKarte(v.besitzer, v.id) });
}
