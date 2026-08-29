/**
 * BATTLE-MODUS, TEIL 2: DIE DISZIPLIN-DOPPELRUNDE.
 *
 * Chris' Vorgabe: 20 Spieltage à 2 Disziplinen = 40 Plaetze, verteilt auf 20 Disziplinen — jede
 * also GENAU ZWEIMAL, aber keine Kombination zweimal. Geprueft wird beides, plus die Zusicherung,
 * dass die Spielerzahl einer Disziplin ueber beide Auftritte dieselbe bleibt (sie gehoert der
 * Saison, nicht dem Spieltag).
 *
 * Und, genauso wichtig: dass der MANAGEMENT-Weg dabei nichts abbekommt. Die Signatur unten ist an
 * der Ausgabe des Codes VOR dieser Aenderung genommen (verglichen ueber `git show HEAD:` gegen den
 * neuen Stand, 18 Save-/Saison-Kombinationen, 0 Abweichungen).
 */
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import {
  BATTLE_MODE_SCHEDULE_VERSION,
  buildSeasonSeededDisciplineSchedule,
  getRequiredSeasonDisciplineMatchdayCount,
  hasCompleteSeasonDisciplineSchedule,
  resolvePlayMode,
} from "@/lib/season/season-discipline-schedule";
import type { SeasonDisciplineScheduleEntry } from "@/lib/data/olyDataTypes";

function disziplinIds(entry: SeasonDisciplineScheduleEntry) {
  return [entry.discipline1?.disciplineId, entry.discipline2?.disciplineId].filter(
    (id): id is string => typeof id === "string",
  );
}

function kombination(entry: SeasonDisciplineScheduleEntry) {
  return [...disziplinIds(entry)].sort().join("|");
}

describe("resolvePlayMode: fehlt die Spielart, ist es Management", () => {
  it.each([[undefined], [null], ["management" as const]])("%s -> management", (wert) => {
    expect(resolvePlayMode(wert)).toBe("management");
  });

  it("nur „battle\" ist battle", () => {
    expect(resolvePlayMode("battle")).toBe("battle");
  });
});

describe("Zahl der Spieltage", () => {
  it("bleibt im Management-Modus ceil(20/2) = 10 — mit und ohne den neuen Parameter", () => {
    expect(getRequiredSeasonDisciplineMatchdayCount(foundationSeedDisciplines)).toBe(10);
    expect(getRequiredSeasonDisciplineMatchdayCount(foundationSeedDisciplines, "management")).toBe(10);
    expect(getRequiredSeasonDisciplineMatchdayCount(foundationSeedDisciplines, undefined)).toBe(10);
  });

  it("ist im Battle-Modus genau das Doppelte: 20", () => {
    expect(getRequiredSeasonDisciplineMatchdayCount(foundationSeedDisciplines, "battle")).toBe(20);
  });

  it("bleibt auch bei ungeradem Pool das Doppelte des Management-Werts", () => {
    const neunzehn = foundationSeedDisciplines.slice(0, 19);
    expect(getRequiredSeasonDisciplineMatchdayCount(neunzehn)).toBe(10);
    expect(getRequiredSeasonDisciplineMatchdayCount(neunzehn, "battle")).toBe(20);
  });
});

describe("Battle-Modus: die Doppelrunde der Disziplinen", () => {
  const ergebnis = buildSeasonSeededDisciplineSchedule({
    saveId: "test-battle-save",
    seasonId: "season-1",
    disciplines: foundationSeedDisciplines,
    playMode: "battle",
  });

  it("baut 20 Spieltage mit je zwei besetzten Disziplin-Plaetzen, ohne Warnung", () => {
    expect(ergebnis.warnings).toEqual([]);
    expect(ergebnis.entries).toHaveLength(20);
    expect(ergebnis.matchdayIds).toHaveLength(20);
    for (const entry of ergebnis.entries) {
      expect(disziplinIds(entry), entry.matchdayId).toHaveLength(2);
    }
  });

  it("setzt jede der 20 Disziplinen GENAU ZWEIMAL ein", () => {
    const zaehler = new Map<string, number>();
    for (const entry of ergebnis.entries) {
      for (const id of disziplinIds(entry)) {
        zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
      }
    }
    expect(zaehler.size).toBe(foundationSeedDisciplines.length);
    expect([...new Set(zaehler.values())]).toEqual([2]);
  });

  it("wiederholt KEINE Kombination — 20 Spieltage, 20 verschiedene Paarungen", () => {
    const kombinationen = ergebnis.entries.map(kombination);
    expect(new Set(kombinationen).size).toBe(20);
  });

  it("paart nie eine Disziplin mit sich selbst", () => {
    for (const entry of ergebnis.entries) {
      const [erste, zweite] = disziplinIds(entry);
      expect(erste, entry.matchdayId).not.toBe(zweite);
    }
  });

  it("legt die beiden Auftritte einer Disziplin in verschiedene Saisonhaelften", () => {
    // Folgt aus dem Bauprinzip (jede Haelfte verbraucht den Pool genau einmal) — und genau
    // deshalb wird es hier festgehalten: es ist eine Zusicherung, kein Zufall.
    const auftritte = new Map<string, number[]>();
    ergebnis.entries.forEach((entry) => {
      for (const id of disziplinIds(entry)) {
        auftritte.set(id, [...(auftritte.get(id) ?? []), entry.matchdayIndex]);
      }
    });
    for (const [disziplinId, indizes] of auftritte) {
      expect(indizes, disziplinId).toHaveLength(2);
      expect(indizes[0]!, disziplinId).toBeLessThanOrEqual(10);
      expect(indizes[1]!, disziplinId).toBeGreaterThan(10);
    }
  });

  it("gibt einer Disziplin ueber BEIDE Auftritte dieselbe Spielerzahl", () => {
    const spielerzahlen = new Map<string, Set<number | null>>();
    for (const entry of ergebnis.entries) {
      for (const slot of [entry.discipline1, entry.discipline2]) {
        if (!slot) continue;
        const bisher = spielerzahlen.get(slot.disciplineId) ?? new Set<number | null>();
        bisher.add(slot.playerCount);
        spielerzahlen.set(slot.disciplineId, bisher);
      }
    }
    for (const [disziplinId, werte] of spielerzahlen) {
      expect(werte.size, disziplinId).toBe(1);
      expect([...werte][0], disziplinId).toBeGreaterThanOrEqual(2);
      expect([...werte][0], disziplinId).toBeLessThanOrEqual(6);
    }
  });

  it("traegt die eigene Schedule-Version im Seed — Battle und Management losen nie gleich aus", () => {
    expect(ergebnis.scheduleSeed).toBe(`test-battle-save:season-1:${BATTLE_MODE_SCHEDULE_VERSION}`);
    const management = buildSeasonSeededDisciplineSchedule({
      saveId: "test-battle-save",
      seasonId: "season-1",
      disciplines: foundationSeedDisciplines,
    });
    expect(management.scheduleSeed).not.toBe(ergebnis.scheduleSeed);
    // Die ersten 10 Spieltage duerfen sich deshalb auch nicht zufaellig decken.
    expect(ergebnis.entries.slice(0, 10).map(kombination)).not.toEqual(management.entries.map(kombination));
  });

  it("ist deterministisch — derselbe Save, dieselbe Saison, derselbe Plan", () => {
    const nochmal = buildSeasonSeededDisciplineSchedule({
      saveId: "test-battle-save",
      seasonId: "season-1",
      disciplines: foundationSeedDisciplines,
      playMode: "battle",
    });
    expect(nochmal.entries).toEqual(ergebnis.entries);
  });

  it("haelt die Zusicherungen fuer 50 verschiedene Spielstaende durch", () => {
    for (let lauf = 0; lauf < 50; lauf += 1) {
      const plan = buildSeasonSeededDisciplineSchedule({
        saveId: `battle-save-${lauf}`,
        seasonId: `season-${(lauf % 6) + 1}`,
        disciplines: foundationSeedDisciplines,
        playMode: "battle",
      });
      expect(plan.warnings, `Lauf ${lauf}`).toEqual([]);
      const zaehler = new Map<string, number>();
      for (const entry of plan.entries) {
        for (const id of disziplinIds(entry)) zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
      }
      expect([...new Set(zaehler.values())], `Lauf ${lauf}`).toEqual([2]);
      expect(new Set(plan.entries.map(kombination)).size, `Lauf ${lauf}`).toBe(20);
    }
  });
});

describe("hasCompleteSeasonDisciplineSchedule kennt die Spielart", () => {
  const battle = buildSeasonSeededDisciplineSchedule({
    saveId: "test-battle-save",
    seasonId: "season-1",
    disciplines: foundationSeedDisciplines,
    playMode: "battle",
  }).entries;

  it("haelt einen 20er-Battle-Plan fuer vollstaendig", () => {
    expect(
      hasCompleteSeasonDisciplineSchedule({
        disciplines: foundationSeedDisciplines,
        disciplineSchedule: battle,
        seasonId: "season-1",
        playMode: "battle",
      }),
    ).toBe(true);
  });

  it("haelt die ersten 10 Spieltage eines Battle-Plans fuer UNvollstaendig", () => {
    // Ohne diese Pruefung schnitte `getSeasonDisciplineSchedule` einen Battle-Spielplan beim
    // naechsten Schreiben lautlos auf 10 Spieltage zurueck: die alte Regel („mindestens
    // ceil(20/2) Eintraege") haette 20 Eintraege durchgewunken und dann `.slice(0, 10)` genommen.
    expect(
      hasCompleteSeasonDisciplineSchedule({
        disciplines: foundationSeedDisciplines,
        disciplineSchedule: battle.slice(0, 10),
        seasonId: "season-1",
        playMode: "battle",
      }),
    ).toBe(false);
  });
});

describe("MANAGEMENT-REGRESSION: die Auslosung ist Zeichen fuer Zeichen die alte", () => {
  /**
   * Die beiden Signaturen sind am Stand VOR dieser Aenderung genommen: `git show HEAD:` auf
   * `lib/season/season-discipline-schedule.ts`, beide Fassungen nebeneinander laufen lassen, ueber
   * 6 Save-Ids × 3 Saisons verglichen — 0 Abweichungen. Aendert sich hier eine Ziffer, hat jemand
   * den Management-Spielplan angefasst; das waere ein Eingriff in JEDEN bestehenden Spielstand.
   */
  const signatur = (saveId: string) =>
    createHash("sha256")
      .update(
        JSON.stringify(
          buildSeasonSeededDisciplineSchedule({ saveId, seasonId: "season-1", disciplines: foundationSeedDisciplines })
            .entries,
        ),
      )
      .digest("hex")
      .slice(0, 16);

  it("liefert fuer den Foundation-Seed exakt den bekannten Spielplan", () => {
    expect(signatur("foundation-seed")).toBe("edda8bfd4ae22017");
  });

  it("liefert fuer den lokalen Standard-Seed exakt den bekannten Spielplan", () => {
    expect(signatur("local-game-state")).toBe("1d324f4b9af7cc78");
  });

  it("bleibt bei 10 Spieltagen, jede Disziplin genau einmal", () => {
    const plan = buildSeasonSeededDisciplineSchedule({
      saveId: "foundation-seed",
      seasonId: "season-1",
      disciplines: foundationSeedDisciplines,
    });
    expect(plan.entries).toHaveLength(10);
    const zaehler = new Map<string, number>();
    for (const entry of plan.entries) {
      for (const id of disziplinIds(entry)) zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
    }
    expect(zaehler.size).toBe(20);
    expect([...new Set(zaehler.values())]).toEqual([1]);
    expect(plan.scheduleSeed).toBe("foundation-seed:season-1:season-setup-v3-balanced-slot-buckets");
  });
});
