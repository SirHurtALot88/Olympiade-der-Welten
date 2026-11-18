import { describe, expect, it } from "vitest";

import type { FormMeldung } from "@/lib/lineups/form-moral-anzeige";
import {
  baueHeissKalt,
  baueHinweise,
  baueMoralZeilen,
  baueNachDemSpieltag,
  baueSpieltagsDisziplinen,
  formZeile,
  nameListe,
} from "@/lib/lineups/nach-dem-spieltag";
import type { GameState } from "@/lib/data/olyDataTypes";

function meldung(over: Partial<FormMeldung> & { playerId: string; vorher: number; nachher: number }): FormMeldung {
  const delta = over.nachher - over.vorher;
  return {
    name: over.playerId.toUpperCase(),
    teamId: "t1",
    stufeVorher: 0,
    stufeNachher: 0,
    delta,
    richtung: delta > 0.05 ? "gestiegen" : delta < -0.05 ? "gefallen" : "gleich",
    grund: "x",
    eingesetzt: true,
    ...over,
  } as FormMeldung;
}

describe("Nach dem Spieltag: Ableitungen", () => {
  it("heiß und kalt kommen aus der Form NACH dem Spieltag, stärkste zuerst", () => {
    const l = [
      meldung({ playerId: "a", vorher: 60, nachher: 72 }),
      meldung({ playerId: "b", vorher: 60, nachher: 80 }),
      meldung({ playerId: "c", vorher: 50, nachher: 50 }),
      meldung({ playerId: "d", vorher: 50, nachher: 36 }),
      meldung({ playerId: "e", vorher: 50, nachher: 25 }),
    ];
    const { heiss, kalt } = baueHeissKalt(l);
    expect(heiss.map((h) => h.playerId)).toEqual(["b", "a"]);
    expect(kalt.map((h) => h.playerId)).toEqual(["e", "d"]);
  });

  it("Form-Zeile: Kurzzeile und Kopf folgen den Verlaufsdaten", () => {
    const dn = (id: string) => (id === "bb" ? "Basketball" : null);
    const z = formZeile(meldung({ playerId: "a", vorher: 50, nachher: 58, stufeVorher: 0, stufeNachher: 1, disziplinId: "bb", abstand: 19 }), dn);
    expect(z.kurz).toBe("Basketball +19");
    expect(z.kopf).toBe("Form gestiegen");
    expect(z.titel).toBe("A: von normal auf gut drauf");
    expect(formZeile(meldung({ playerId: "b", vorher: 50, nachher: 45, eingesetzt: false }), dn).kurz).toBe("kein Einsatz");
    expect(formZeile(meldung({ playerId: "c", vorher: 50, nachher: 40, bremse: { art: "verletzung", punkte: 10 } }), dn).kurz).toBe("verletzt");
    const m = formZeile(meldung({ playerId: "d", vorher: 50, nachher: 46, disziplinId: "bb", abstand: -4, bremse: { art: "erschoepfung", punkte: 3 } }), dn);
    expect(m.erschoepfungBremse).toBe(3);
    expect(m.kurz).toBe("Basketball −4");
  });

  it("Hinweise: nur was ein gespeicherter Wert trägt", () => {
    const form = [
      formZeile(meldung({ playerId: "k", vorher: 50, nachher: 44, bremse: { art: "erschoepfung", punkte: 3 }, stufeNachher: -1 }), () => null),
      formZeile(meldung({ playerId: "v", vorher: 50, nachher: 40, bremse: { art: "verletzung", punkte: 10 } }), () => null),
    ];
    const kalt = [
      { playerId: "k", name: "K", form: 44, formPct: null },
      { playerId: "g", name: "G", form: 30, formPct: null },
      { playerId: "v", name: "V", form: 40, formPct: null },
    ];
    const moral = [{ playerId: "g", name: "G", moral: 31, wort: "unzufrieden", grund: "Starter-Zusage nicht eingelöst", delta: -4 }];
    const h = baueHinweise({ form, moral, kalt });
    expect(h.map((x) => x.id)).toEqual(["erschoepfung", "verletzung", "kalt", "moral"]);
    // Erschöpfte und Verletzte stehen nicht doppelt im Kalt-Hinweis
    expect(h.find((x) => x.id === "kalt")!.namen).toEqual(["G"]);
    expect(h.find((x) => x.id === "moral")!.text).toContain("Starter-Zusage");
    expect(baueHinweise({ form: [], moral: [], kalt: [] })).toEqual([]);
  });

  it("nameListe", () => {
    expect(nameListe(["A"])).toBe("A");
    expect(nameListe(["A", "B", "C"])).toBe("A, B und C");
  });
});

function spiel(): GameState {
  const zeile = (teamId: string, side: "d1" | "d2", disciplineId: string, rank: number, extra: Record<string, unknown> = {}) => ({
    id: `${teamId}-${side}`, matchdayResultId: "mr1", teamId, disciplineId, disciplineSide: side, rank, totalScore: 0, ...extra,
  });
  return {
    season: { id: "s1" },
    teams: [{ teamId: "t1", name: "Eins" }, { teamId: "t2", name: "Zwei" }, { teamId: "t3", name: "Drei" }],
    players: [{ id: "p1", name: "Kati", fatigue: 10 }, { id: "p2", name: "Aerin", fatigue: 10 }],
    rosters: [{ playerId: "p1", teamId: "t1" }, { playerId: "p2", teamId: "t2" }],
    disciplines: [{ id: "bb", name: "Basketball" }, { id: "sp", name: "Spurt" }],
    playerMoraleState: [
      { playerId: "p1", teamId: "t1", morale: 70, reasons: [{ reasonId: "a", label: "Sieg in Basketball", valueDelta: 2, source: "x" }, { reasonId: "b", label: "Kleiner Grund", valueDelta: 0.2, source: "x" }] },
      { playerId: "p2", teamId: "t2", morale: 20, reasons: [{ reasonId: "a", label: "fremd", valueDelta: -3, source: "x" }] },
    ],
    seasonState: {
      matchdayResults: [{ id: "mr1", seasonId: "s1", matchdayId: "md1", status: "preview_applied" }],
      disciplineResults: [
        zeile("t1", "d1", "bb", 1, { opponentTeamId: "t2", teamPoints: 2, duellSeiten: [412, 396] }),
        zeile("t2", "d1", "bb", 2, { opponentTeamId: "t1", teamPoints: 0, duellSeiten: [396, 412] }),
        zeile("t1", "d2", "sp", 3),
        zeile("t2", "d2", "sp", 1),
        zeile("t3", "d2", "sp", 2),
      ],
    },
  } as unknown as GameState;
}

describe("Nach dem Spieltag: gebuchte Ergebnisse und Moral", () => {
  it("Duell: Sieg mit Stand; Rangdisziplin: Platz von N", () => {
    const d = baueSpieltagsDisziplinen(spiel(), "t1", "md1");
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ side: "d1", art: "duell", ausgang: "sieg", wort: "Sieg", detail: "412 : 396", gegnerName: "Zwei" });
    expect(d[1]).toMatchObject({ side: "d2", art: "platz", wort: "Platz 3", detail: "von 3" });
    expect(baueSpieltagsDisziplinen(spiel(), "t2", "md1")[0].ausgang).toBe("niederlage");
    expect(baueSpieltagsDisziplinen(spiel(), "t1", "mdX")).toEqual([]);
  });

  it("Moral: nur eigene Spieler, stärkster gespeicherter Grund, kleine Gründe fallen weg", () => {
    const m = baueMoralZeilen(spiel(), "t1");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ name: "Kati", moral: 70, grund: "Sieg in Basketball", delta: 2, wort: "zufrieden" });
  });

  it("ohne Verlauf: leere Meldungen, kein erfundener Wert", () => {
    const n = baueNachDemSpieltag(spiel(), "t1", "md1");
    expect(n?.form).toEqual([]);
    expect(n?.heiss).toEqual([]);
    expect(baueNachDemSpieltag(spiel(), null, "md1")).toBeNull();
  });
});
