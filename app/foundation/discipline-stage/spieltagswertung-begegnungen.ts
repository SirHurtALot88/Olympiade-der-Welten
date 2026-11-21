// =====================================================================================
// Begegnungen des Spieltags (21.11.): wer gegen wen, mit Ergebnis, Differenz und Skala.
// =====================================================================================
//
// Quelle sind dieselben gebuchten Seiten wie in der Tabelle (`WertungsZeile`): ein Duell steht in den Zeilen BEIDER
// Teams (jeweils aus eigener Sicht), eine Vierergruppe in den Zeilen aller vier. Hier wird jede Begegnung genau
// einmal gebildet, nichts neu gerechnet. Eine verdeckte Disziplin liefert keine Begegnung (kein Spoiler).

import type { DuellErgebnisAnzeige } from "@/lib/foundation/ergebnis-anzeige";
import type {
  WertungsLiga,
  WertungsSeite,
  WertungsZeile,
} from "@/app/foundation/discipline-stage/spieltagswertung-zeilen";

export type BegegnungTeam = {
  teamId: string;
  name: string;
  logoUrl: string | null;
  istEigen: boolean;
  mensch: string | null;
  /** Platzierungs-Punkte dieser Seite (ohne Mutator), `null` = unbekannt. */
  punkte: number | null;
  /** Ergebniswert als Text: Punkte, Zeit oder besiegte Gegner (Duell) bzw. Gruppenwert (Gruppe). */
  wert: string | null;
  /** E1-Skalenwert 0-10 dieses Teams (Duell: eigene Seite, Gruppe: Wert in der Gruppe), `null` ohne. */
  skala: number | null;
  /** Formkarte und Captain dieses Teams in dieser Disziplin (Score, keine Punkte); `null` = keine Karte / nicht gesetzt. */
  form: number | null;
  captain: number | null;
};

export type DuellBegegnung = {
  art: "duell";
  schluessel: string;
  /** Sieger bzw. bei Remis das zuerst gelistete Team steht links. */
  a: BegegnungTeam;
  b: BegegnungTeam;
  istEigen: boolean;
  liga: WertungsLiga | null;
  /** Ergebnis aus Sicht von `a` (`diff`: positiv = `a` vorn). */
  anzeige: DuellErgebnisAnzeige;
  verhaeltnis: number | null;
};

export type GruppenBegegnung = {
  art: "gruppe";
  schluessel: string;
  /** Nach Platz sortiert. */
  plaetze: Array<BegegnungTeam & { platz: number }>;
  istEigen: boolean;
  liga: WertungsLiga | null;
};

export type Begegnung = DuellBegegnung | GruppenBegegnung;

function teamVon(z: WertungsZeile, seite: WertungsSeite, wert: string | null, skala: number | null): BegegnungTeam {
  const s = z[seite];
  return {
    teamId: z.teamId,
    name: z.name,
    logoUrl: z.logoUrl,
    istEigen: z.istEigen,
    mensch: z.mensch,
    punkte: s.punkte,
    wert,
    skala,
    form: s.formLabel != null ? s.form : null,
    captain: s.captain,
  };
}

function eigeneSkala(z: WertungsZeile, seite: WertungsSeite): number | null {
  const e = z[seite].ergebnis;
  return e?.art === "duell" ? (e.skala?.[0] ?? null) : null;
}

/** Alle Begegnungen EINER Disziplin-Seite; die eigenen zuerst, dann in der Reihenfolge der Zeilen (nach Gesamt). */
export function baueBegegnungen(zeilen: WertungsZeile[], seite: WertungsSeite, ownTeamId: string | null): Begegnung[] {
  const byId = new Map(zeilen.map((z) => [z.teamId, z]));
  const gesehen = new Set<string>();
  const aus: Begegnung[] = [];
  for (const z of zeilen) {
    const s = z[seite];
    if (!s.aufgedeckt || !s.ergebnis) continue;
    if (s.ergebnis.art === "duell") {
      const gegnerId = s.ergebnis.gegnerTeamId;
      if (!gegnerId || !s.anzeige) continue;
      const schluessel = [z.teamId, gegnerId].sort().join("|");
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      const gegner = byId.get(gegnerId) ?? null;
      // Sieger links: verliert dieses Team und kennen wir die Zeile des Gegners, dreht die Begegnung um.
      const tauschen = s.anzeige.ausgang === "niederlage" && gegner != null && gegner[seite].anzeige != null;
      const links = tauschen ? gegner! : z;
      const rechts = tauschen ? z : gegner;
      const la = links[seite].anzeige!;
      const rechtsTeam: BegegnungTeam = rechts
        ? teamVon(rechts, seite, la.gegner, eigeneSkala(rechts, seite))
        : {
            teamId: tauschen ? z.teamId : gegnerId,
            name: gegnerId,
            logoUrl: null,
            istEigen: gegnerId === ownTeamId,
            mensch: null,
            punkte: null,
            wert: la.gegner,
            skala: links[seite].ergebnis?.art === "duell" ? (links[seite].ergebnis.skala?.[1] ?? null) : null,
            form: null,
            captain: null,
          };
      aus.push({
        art: "duell",
        schluessel,
        a: teamVon(links, seite, la.eigen, eigeneSkala(links, seite)),
        b: rechtsTeam,
        istEigen: z.istEigen || gegnerId === ownTeamId,
        liga: links.liga,
        anzeige: la,
        verhaeltnis: links[seite].verhaeltnis,
      });
    } else {
      const podId = s.ergebnis.podId;
      if (gesehen.has(podId)) continue;
      gesehen.add(podId);
      const plaetze = s.ergebnis.teamIds
        .map((id) => byId.get(id))
        .filter((m): m is WertungsZeile => m != null && m[seite].gruppe != null)
        .map((m) => ({ ...teamVon(m, seite, m[seite].gruppe!.wertText, m[seite].gruppe!.skala), platz: m[seite].gruppe!.platz }))
        .sort((x, y) => x.platz - y.platz || x.name.localeCompare(y.name, "de"));
      if (plaetze.length === 0) continue;
      aus.push({
        art: "gruppe",
        schluessel: podId,
        plaetze,
        istEigen: plaetze.some((p) => p.teamId === ownTeamId),
        liga: z.liga,
      });
    }
  }
  return [...aus.filter((b) => b.istEigen), ...aus.filter((b) => !b.istEigen)];
}
