/**
 * KI-KAUF MIT NACHRUECKEN (Review #1619, Befund A4).
 *
 * Vorher gab die KI nach drei gescheiterten Kaeufen (ihren Top 3) auf und stieg mit `kauf_blockiert` aus — auch unter
 * dem Mindestkader, obwohl noch Leistbares frei war. `kaufeMitNachruecken` haelt jetzt:
 *  - gescheiterte Spieler fallen raus, die Rangliste wird aufgeweitet (3 -> 20 -> 200);
 *  - unter 8 danach die billigsten leistbaren freien Spieler (`notfall`);
 *  - aufgegeben wird erst, wenn wirklich nichts kaufbar ist (`erschoepft`) oder ein teamweiter Grund jeden weiteren
 *    Versuch sinnlos macht bzw. die Versuchsgrenze erreicht ist (`blockiert`).
 */
import { describe, expect, it } from "vitest";

import { kaufeMitNachruecken, type LigaDraftKaufVersuch } from "@/lib/draft/liga-draft-dienst";

const rangliste = (ids: string[]) => (topN: number) => ids.slice(0, topN);

function kaeufer(kaufbar: Set<string>, grund = "vorstand_abgelehnt") {
  const versuche: string[] = [];
  const kaufe = (playerId: string): LigaDraftKaufVersuch<{ playerId: string }> => {
    versuche.push(playerId);
    return kaufbar.has(playerId) ? { ok: true, ergebnis: { playerId } } : { ok: false, grund };
  };
  return { versuche, kaufe };
}

describe("kaufeMitNachruecken", () => {
  it("nach drei gescheiterten Kaeufen rueckt Platz 4 der aufgeweiteten Rangliste nach (statt aufzugeben)", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `p${i + 1}`);
    const { versuche, kaufe } = kaeufer(new Set(["p4"]));
    const ergebnis = kaufeMitNachruecken({ rangliste: rangliste(ids), notfall: () => [], kaufe });
    expect(ergebnis).toMatchObject({ ok: true, playerId: "p4", ausNotfall: false, fehlgeschlagen: ["p1", "p2", "p3"] });
    expect(versuche).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("gescheiterte Spieler werden nicht doppelt versucht, wenn die Rangliste aufgeweitet wird", () => {
    const ids = Array.from({ length: 25 }, (_, i) => `p${i + 1}`);
    const { versuche, kaufe } = kaeufer(new Set(["p22"]));
    const ergebnis = kaufeMitNachruecken({ rangliste: rangliste(ids), notfall: () => [], kaufe });
    expect(ergebnis).toMatchObject({ ok: true, playerId: "p22" });
    expect(new Set(versuche).size).toBe(versuche.length);
    expect(versuche).toHaveLength(22);
  });

  it("unter dem Mindestkader: ist die Rangliste erschoepft, kauft die KI den billigsten leistbaren freien Spieler", () => {
    const { versuche, kaufe } = kaeufer(new Set(["billig2"]));
    const ergebnis = kaufeMitNachruecken({
      rangliste: rangliste(["a", "b"]),
      notfall: () => ["a", "billig1", "billig2", "billig3"],
      kaufe,
    });
    expect(ergebnis).toMatchObject({ ok: true, playerId: "billig2", ausNotfall: true });
    // `a` stand schon in der Rangliste und wird im Notfall nicht noch einmal versucht.
    expect(versuche).toEqual(["a", "b", "billig1", "billig2"]);
  });

  it("aufgegeben wird erst, wenn wirklich nichts kaufbar ist (`erschoepft`)", () => {
    const { versuche, kaufe } = kaeufer(new Set());
    const ergebnis = kaufeMitNachruecken({ rangliste: rangliste(["a", "b", "c", "d"]), notfall: () => ["e"], kaufe });
    expect(ergebnis).toMatchObject({ ok: false, grund: "erschoepft", letzterKaufgrund: "vorstand_abgelehnt" });
    expect(versuche).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("ein teamweiter Grund (Kader voll, Phase zu) beendet sofort — der naechste Kandidat hilft dann nicht", () => {
    const { versuche, kaufe } = kaeufer(new Set(["b"]), "phase_blocked:buy_players:season_active");
    const ergebnis = kaufeMitNachruecken({ rangliste: rangliste(["a", "b"]), notfall: () => [], kaufe });
    expect(ergebnis).toMatchObject({ ok: false, grund: "blockiert" });
    expect(versuche).toEqual(["a"]);
  });

  it("Versuchsgrenze: hoechstens `maxVersuche` gescheiterte Kaeufe je Zug", () => {
    const ids = Array.from({ length: 300 }, (_, i) => `p${i + 1}`);
    const { versuche, kaufe } = kaeufer(new Set(["p299"]));
    const ergebnis = kaufeMitNachruecken({ rangliste: rangliste(ids), notfall: () => [], kaufe, maxVersuche: 10 });
    expect(ergebnis).toMatchObject({ ok: false, grund: "blockiert" });
    expect(versuche).toHaveLength(10);
  });
});
