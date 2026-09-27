import { NextResponse } from "next/server";

import { kartenZugriff } from "@/lib/kartenschmiede/besitzer";
import {
  type Art,
  istGueltigeKartenId,
  ladeEintrag,
  ladeFaehigkeiten,
  listeGruppen,
  listeKarten,
  loescheEintrag,
  speichereEintrag,
  speichereFaehigkeiten,
} from "@/lib/kartenschmiede/karten-store";

/** Gemeinsame Handler für /api/kartenschmiede/karten und /api/kartenschmiede/gruppen. */
type Kontext = { params: Promise<{ id: string }> };
const nichtEingeloggt = () => NextResponse.json({ ok: false, error: "nicht_eingeloggt" }, { status: 401 });

export function listenRoute(art: Art) {
  return async function GET() {
    const zugriff = await kartenZugriff();
    if (!zugriff) return nichtEingeloggt();
    const eintraege = art === "karten" ? listeKarten(zugriff.sammlung) : listeGruppen(zugriff.sammlung);
    return NextResponse.json({ ok: true, [art]: eintraege });
  };
}

export function eintragRouten(art: Art) {
  async function vorpruefen(kontext: Kontext) {
    const zugriff = await kartenZugriff();
    if (!zugriff) return { fehler: nichtEingeloggt() };
    const { id } = await kontext.params;
    if (!istGueltigeKartenId(id)) return { fehler: NextResponse.json({ ok: false, error: "ungueltige_id" }, { status: 400 }) };
    return { sammlung: zugriff.sammlung, wer: zugriff.wer, id };
  }
  return {
    async GET(_request: Request, kontext: Kontext) {
      const v = await vorpruefen(kontext);
      if ("fehler" in v) return v.fehler;
      const inhalt = ladeEintrag(v.sammlung, art, v.id);
      if (!inhalt) return NextResponse.json({ ok: false, error: "nicht_gefunden" }, { status: 404 });
      return NextResponse.json({ ok: true, inhalt, karte: inhalt });
    },
    async PUT(request: Request, kontext: Kontext) {
      const v = await vorpruefen(kontext);
      if ("fehler" in v) return v.fehler;
      try {
        const body = (await request.json()) as { inhalt?: unknown; karte?: unknown; vorschau?: unknown };
        speichereEintrag(v.sammlung, art, v.id, body.inhalt ?? body.karte, body.vorschau, v.wer);
        return NextResponse.json({ ok: true });
      } catch (error) {
        const meldung = error instanceof Error ? error.message : "speichern_fehlgeschlagen";
        const status = meldung === "zu_gross" ? 413 : meldung === "inhalt_fehlt" ? 400 : 500;
        return NextResponse.json({ ok: false, error: meldung }, { status });
      }
    },
    async DELETE(_request: Request, kontext: Kontext) {
      const v = await vorpruefen(kontext);
      if ("fehler" in v) return v.fehler;
      return NextResponse.json({ ok: true, geloescht: loescheEintrag(v.sammlung, art, v.id) });
    },
  };
}

export const faehigkeitenRouten = {
  async GET() {
    const zugriff = await kartenZugriff();
    if (!zugriff) return nichtEingeloggt();
    return NextResponse.json({ ok: true, faehigkeiten: ladeFaehigkeiten(zugriff.sammlung) });
  },
  async PUT(request: Request) {
    const zugriff = await kartenZugriff();
    if (!zugriff) return nichtEingeloggt();
    try {
      const body = (await request.json()) as { faehigkeiten?: unknown };
      return NextResponse.json({ ok: true, faehigkeiten: speichereFaehigkeiten(zugriff.sammlung, body.faehigkeiten) });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "speichern_fehlgeschlagen" }, { status: 400 });
    }
  },
};
