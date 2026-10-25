export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import fs from "node:fs";

import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import { audioDatei, istGueltigeAudioId, loescheAudio, speichereAudio } from "@/lib/kartenschmiede/karten-store";

/**
 * Ein Audio-Cue: GET spielt ihn ab (mit Range, damit Browser spulen können), PUT lädt ihn hoch (Rohdaten im Body,
 * Typ im Content-Type, Dateiname im Header x-dateiname), DELETE entfernt ihn.
 */
type Kontext = { params: Promise<{ id: string }> };
const nichtEingeloggt = () => NextResponse.json({ ok: false, error: "nicht_eingeloggt" }, { status: 401 });

export async function GET(request: Request, kontext: Kontext) {
  const zugriff = await kartenZugriff();
  if (!zugriff) return nichtEingeloggt();
  const { id } = await kontext.params;
  const datei = audioDatei(zugriff.sammlung, id);
  if (!datei) return NextResponse.json({ ok: false, error: "nicht_gefunden" }, { status: 404 });
  const groesse = fs.statSync(datei.pfad).size;
  const kopf = { "Content-Type": datei.eintrag.typ, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  const bereich = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (bereich && (bereich[1] || bereich[2])) {
    const start = bereich[1] ? Number(bereich[1]) : Math.max(0, groesse - Number(bereich[2]));
    const ende = bereich[1] && bereich[2] ? Math.min(Number(bereich[2]), groesse - 1) : groesse - 1;
    if (start >= groesse || start > ende) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${groesse}` } });
    const teil = Buffer.alloc(ende - start + 1);
    const fd = fs.openSync(datei.pfad, "r");
    try {
      fs.readSync(fd, teil, 0, teil.length, start);
    } finally {
      fs.closeSync(fd);
    }
    return new NextResponse(teil, { status: 206, headers: { ...kopf, "Content-Range": `bytes ${start}-${ende}/${groesse}`, "Content-Length": String(teil.length) } });
  }
  return new NextResponse(fs.readFileSync(datei.pfad), { headers: { ...kopf, "Content-Length": String(groesse) } });
}

export async function PUT(request: Request, kontext: Kontext) {
  const zugriff = await kartenZugriff();
  if (!zugriff) return nichtEingeloggt();
  const { id } = await kontext.params;
  if (!istGueltigeAudioId(id)) return NextResponse.json({ ok: false, error: "ungueltige_id" }, { status: 400 });
  try {
    const daten = Buffer.from(await request.arrayBuffer());
    const name = decodeURIComponent(request.headers.get("x-dateiname") || "");
    const eintrag = speichereAudio(zugriff.sammlung, id, daten, request.headers.get("content-type") || "", name, zugriff.wer);
    return NextResponse.json({ ok: true, eintrag });
  } catch (error) {
    const meldung = error instanceof Error ? error.message : "speichern_fehlgeschlagen";
    const status = meldung === "zu_gross" ? 413 : ["kein_audio", "inhalt_fehlt", "ungueltige_id"].includes(meldung) ? 400 : 500;
    return NextResponse.json({ ok: false, error: meldung }, { status });
  }
}

export async function DELETE(_request: Request, kontext: Kontext) {
  const zugriff = await kartenZugriff();
  if (!zugriff) return nichtEingeloggt();
  const { id } = await kontext.params;
  return NextResponse.json({ ok: true, geloescht: loescheAudio(zugriff.sammlung, id) });
}
