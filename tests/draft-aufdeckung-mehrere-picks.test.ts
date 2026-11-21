/**
 * 3x-Tempo (19.11.): ein `ki_schritt` holt mehrere Picks, aufgedeckt wird nur der letzte. `zugFuerAufdeckung` liefert dafuer den
 * Zug (Top 3, Team) des LETZTEN Picks aus der Vorschau der Sicht vor dem Schritt und uebernimmt dessen Karten in die neue Sicht.
 */
import { describe, expect, it } from "vitest";

import { zugFuerAufdeckung } from "@/app/foundation/draft-modern/draft-daten";
import type { LigaDraftAnsicht, LigaDraftZugAnsicht } from "@/lib/draft/liga-draft-ansicht";
import type { LigaDraftEintrag } from "@/lib/data/olyDataTypes";

const zug = (teamId: string, top3: string[]): LigaDraftZugAnsicht => ({
  teamId,
  runde: 1,
  platz: 0,
  art: "ki",
  automatisch: true,
  ownerId: null,
  top3,
  top3Gruende: null,
  absicht: "pick",
});
const eintrag = (teamId: string, playerId: string, top3: string[]) =>
  ({ nr: 1, teamId, playerId, art: "pick", top3: top3.map((id) => ({ playerId: id, nutzen: 1 })) }) as unknown as LigaDraftEintrag;
const karte = (id: string) => ({ name: id }) as never;
const ansicht = (naechste: LigaDraftZugAnsicht[], spieler: string[]) =>
  ({ naechste, spieler: Object.fromEntries(spieler.map((id) => [id, karte(id)])) }) as unknown as LigaDraftAnsicht;

describe("zugFuerAufdeckung", () => {
  const alt = ansicht([zug("A", ["a1", "a2", "a3"]), zug("B", ["b1", "b2", "b3"]), zug("C", ["c1", "c2", "c3"])], ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"]);
  const neu = ansicht([zug("D", ["d1"])], ["d1"]);

  it("ein einzelner Pick: der Zug vor dem Schritt, unveraendert", () => {
    const e = eintrag("A", "a1", ["a1", "a2", "a3"]);
    const r = zugFuerAufdeckung(alt, alt.naechste[0]!, [e], e, neu);
    expect(r.zug).toBe(alt.naechste[0]);
    expect(r.spieler).toBeNull();
  });

  it("mehrere Picks: der Zug des letzten Picks, Karten der Top 3 aus der alten Sicht in der neuen", () => {
    const eintraege = [eintrag("A", "a1", ["a1", "a2", "a3"]), eintrag("B", "b2", ["b1", "b2", "b3"]), eintrag("C", "c1", ["c1", "c2", "c3"])];
    const r = zugFuerAufdeckung(alt, alt.naechste[0]!, eintraege, eintraege[2]!, neu);
    expect(r.zug.teamId).toBe("C");
    expect(r.zug.top3).toEqual(["c1", "c2", "c3"]);
    expect(Object.keys(r.spieler!.spieler)).toEqual(expect.arrayContaining(["c1", "c2", "c3", "d1"]));
  });

  it("stimmt das Team der Vorschau nicht, bleibt es beim Zug vor dem Schritt", () => {
    const eintraege = [eintrag("A", "a1", ["a1"]), eintrag("X", "x1", ["x1"])];
    const r = zugFuerAufdeckung(alt, alt.naechste[0]!, eintraege, eintraege[1]!, neu);
    expect(r.zug).toBe(alt.naechste[0]);
    expect(r.spieler).toBeNull();
  });
});
