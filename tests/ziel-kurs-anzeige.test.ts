/**
 * Anzeige-Kurs der Vorstandsziele (Review 22.11., Befund 3.9): mitten in der Saison hochgerechnet,
 * "verfehlt" erst, wenn rechnerisch nicht mehr erreichbar. Der gespeicherte Status bleibt unberührt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, TeamSeasonObjectiveRecord } from "@/lib/data/olyDataTypes";
import { berechneZielKurs, kursZuStatus } from "@/lib/board/ziel-kurs";
import { besterDuellsiegAus, duellAbstand } from "@/lib/foundation/startseite-modern";
import { TAKT_WARUM } from "@/lib/foundation/foundation-takt-plan";
import { GAME_ENCYCLOPEDIA_ENTRIES, getGameEncyclopediaEntry } from "@/lib/ui/game-encyclopedia";

const TOTAL = 20;

function stand(opts: { gespielt: number; punkte: Record<string, number> }): GameState {
  const matchdayIds = Array.from({ length: TOTAL }, (_, i) => `md-${i + 1}`);
  return {
    season: { id: "s1", matchdayIds },
    scenarioMeta: { gameMode: "battle" },
    teams: Object.keys(opts.punkte).map((teamId) => ({ teamId })),
    seasonState: {
      matchdayResults: Array.from({ length: opts.gespielt }, (_, i) => ({ id: `r${i}`, seasonId: "s1", matchdayId: matchdayIds[i] })),
      standings: Object.fromEntries(Object.entries(opts.punkte).map(([id, points]) => [id, { points }])),
      leagueByTeamId: Object.fromEntries(Object.keys(opts.punkte).map((id) => [id, "liga1"])),
    },
  } as unknown as GameState;
}

function ziel(over: Partial<TeamSeasonObjectiveRecord>): TeamSeasonObjectiveRecord {
  return {
    seasonId: "s1",
    teamId: "T",
    objectiveId: "expectation-rank",
    category: "sport",
    label: "Rangziel",
    targetValue: "Top 3",
    currentValue: 9,
    status: "failed",
    source: "test",
    ...over,
  } as TeamSeasonObjectiveRecord;
}

describe("Vorstandsziel: Kurs statt früh 'verfehlt'", () => {
  it("Rangziel nach Spieltag 7: aktuell weit darunter, aber erreichbar -> gefährdet, nicht verfehlt", () => {
    const gs = stand({ gespielt: 7, punkte: { A: 14, B: 12, C: 11, D: 10, E: 9, F: 8, G: 7, H: 6, I: 5, T: 4 } });
    const kurs = berechneZielKurs(gs, ziel({}));
    expect(kurs.kurs).toBe("gefaehrdet");
    expect(kursZuStatus(kurs.kurs)).toBe("at_risk");
    expect(kurs.verbleibendeSpieltage).toBe(13);
  });

  it("Rangziel: verfehlt erst, wenn selbst mit allen Punkten (4 je Spieltag) zu viele davor bleiben", () => {
    // 1 Spieltag offen -> höchstens 4 Punkte. T hat 4 -> maximal 8; vier Teams haben schon mehr als 8.
    const gs = stand({ gespielt: 19, punkte: { A: 40, B: 39, C: 38, D: 37, E: 20, T: 4 } });
    const kurs = berechneZielKurs(gs, ziel({ targetValue: "Top 3" }));
    expect(kurs.kurs).toBe("verfehlt");
    expect(kurs.begruendung).toContain("Platz 3");
  });

  it("Rangziel: Gleichstand mit dem Maximum bleibt offen", () => {
    const gs = stand({ gespielt: 19, punkte: { A: 12, B: 11, C: 8, T: 4 } });
    // T kann 8 erreichen, C hat 8: nicht strikt davor -> bester Platz 3, Ziel Platz 3 erreichbar.
    expect(berechneZielKurs(gs, ziel({ targetValue: "Top 3" })).kurs).toBe("gefaehrdet");
  });

  it("am Saisonende gilt der gespeicherte Status", () => {
    const gs = stand({ gespielt: TOTAL, punkte: { A: 40, T: 4 } });
    expect(berechneZielKurs(gs, ziel({ status: "failed" })).kurs).toBe("verfehlt");
    expect(berechneZielKurs(gs, ziel({ status: "completed" })).kurs).toBe("erreicht");
  });

  it("Kassenziel mitten in der Saison: nie verfehlt, höchstens gefährdet", () => {
    const gs = stand({ gespielt: 5, punkte: { T: 4, A: 8 } });
    const k = berechneZielKurs(gs, ziel({ objectiveId: "finance-rebuild-cash-buffer", status: "failed", targetValue: 17.5, currentValue: 7.1 }));
    expect(k.kurs).toBe("gefaehrdet");
  });

  it("Zähler, deren Status schon die Erreichbarkeit prüft, bleiben verfehlt", () => {
    const gs = stand({ gespielt: 18, punkte: { T: 4, A: 8 } });
    expect(berechneZielKurs(gs, ziel({ objectiveId: "sport-signature-wins", status: "failed" })).kurs).toBe("verfehlt");
  });

  it("jetzt erfülltes Rangziel ist 'auf Kurs', ein Zähler schon 'erfüllt'", () => {
    const gs = stand({ gespielt: 6, punkte: { T: 12, A: 8 } });
    expect(berechneZielKurs(gs, ziel({ status: "completed" })).kurs).toBe("auf-kurs");
    expect(berechneZielKurs(gs, ziel({ objectiveId: "sport-matchday-medals", status: "completed" })).kurs).toBe("erreicht");
  });

  it("verändert den gespeicherten Status nicht", () => {
    const z = ziel({});
    berechneZielKurs(stand({ gespielt: 3, punkte: { T: 1, A: 5 } }), z);
    expect(z.status).toBe("failed");
  });
});

describe("Das Beste des Spieltags (Startseite)", () => {
  it("höchster Duellsieg nach Abstand der Ergebnisskala, Niederlagen und Gruppenplätze zählen nicht", () => {
    expect(duellAbstand("7 : 4")).toBe(3);
    expect(duellAbstand(null)).toBe(0);
    const m = (id: string, ergebnis: string | null, punkte: number) => ({ id, disziplin: id, text: "", ergebnis, punkte, ton: "plus" as const });
    expect(besterDuellsiegAus([m("a", "7 : 4", 2), m("b", "9 : 1", 2), m("c", "2 : 8", 0)])?.id).toBe("b");
    expect(besterDuellsiegAus([m("a", "2 : 8", 0), m("p", null, 2)])).toBeNull();
    expect(besterDuellsiegAus(null)).toBeNull();
  });
});

describe("Taktgeber und Lexikon", () => {
  it("jeder Schritt des Spieltagsablaufs hat einen Warum-Satz", () => {
    for (const id of ["set_lineup", "assign_formcards", "confirm_lineup", "run_reveal", "review_matchday_results", "advance_to_next_matchday", "check_training"]) {
      expect(TAKT_WARUM[id]?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("neue Mechaniken stehen im Lexikon und veraltete Einträge sind raus", () => {
    for (const term of ["Duellpunkte", "Kaderstärke", "Papierform", "Resistenz", "Auf- und Abstieg", "Halbautomatik", "Form und Moral", "Verletzung", "Vorstandsfreigabe", "Zwei Töpfe", "Rang-Abschlag"]) {
      expect(getGameEncyclopediaEntry(term), term).not.toBeNull();
    }
    expect(getGameEncyclopediaEntry("Powers")).toBeNull();
    const text = JSON.stringify(GAME_ENCYCLOPEDIA_ENTRIES);
    expect(text).not.toContain("Rank→Punkte");
    expect(text).not.toMatch(/Preisgeld/);
    expect(text).not.toMatch(/Alterung|"Alter"/);
    expect(new Set(GAME_ENCYCLOPEDIA_ENTRIES.map((e) => e.id)).size).toBe(GAME_ENCYCLOPEDIA_ENTRIES.length);
  });
});
