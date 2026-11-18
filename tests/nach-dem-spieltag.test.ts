import { describe, expect, it } from "vitest";

import type { FormMeldung } from "@/lib/lineups/form-moral-anzeige";
import {
  baueHeissKalt,
  baueHinweise,
  baueMoralZeilen,
  baueNachDemSpieltag,
  baueSpieltagsDisziplinen,
  baueSpielerPp,
  verletzungsStand,
  formZeile,
  nameListe,
  zerlegeFormAenderung,
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

  it("Anteile ergeben für JEDE Zeile genau den Wert (Summe == gerundete Änderung)", () => {
    const faelle: Array<Partial<FormMeldung> & { vorher: number; nachher: number }> = [
      { vorher: 55, nachher: 33, eingesetzt: true, bremse: { art: "verletzung", punkte: 10 } },
      { vorher: 29, nachher: 40, eingesetzt: false, bremse: { art: "verletzung", punkte: 10 } },
      { vorher: 20, nachher: 0, eingesetzt: false, bremse: { art: "verletzung", punkte: 10 } },
      { vorher: 70, nachher: 66.4, eingesetzt: true, bremse: { art: "erschoepfung", punkte: 8.4 } },
      { vorher: 50, nachher: 58.3, eingesetzt: true, bremse: null },
      { vorher: 30, nachher: 34.5, eingesetzt: false, bremse: null },
      { vorher: 50, nachher: 49.6, eingesetzt: true, bremse: null },
      { vorher: 10, nachher: 0, eingesetzt: true, bremse: { art: "verletzung", punkte: 10 } },
    ];
    for (const f of faelle) {
      const teile = zerlegeFormAenderung(f);
      const summe = teile.reduce((a, t) => a + t.wert, 0);
      expect(summe + 0).toBe(Math.round(f.nachher - f.vorher) + 0);
      // über die fertige Zeile genauso
      const z = formZeile(meldung({ playerId: "x", ...f }), () => null);
      expect(z.anteile.reduce((a, t) => a + t.wert, 0) + 0).toBe(Math.round(z.delta) + 0);
    }
  });

  it("Verletzt UND gespielt: Leistung und Abzug stehen beide da (kein +11 bei \"10 Punkte Abzug\")", () => {
    // verletzt, nicht gespielt, Form 29: Zug zur Mitte +3, Abzug -10 -> Wert -7
    const t = zerlegeFormAenderung({ vorher: 29, nachher: 22, eingesetzt: false, bremse: { art: "verletzung", punkte: 10 } });
    expect(t.map((x) => x.id)).toEqual(["mitte", "verletzung"]);
    expect(t.find((x) => x.id === "verletzung")!.wert).toBe(-10);
    const g = formZeile(meldung({ playerId: "g", vorher: 55, nachher: 33, eingesetzt: true, leistungPerz: 20, erwartungPerz: 60, disziplinId: "bb", abstand: -40, bremse: { art: "verletzung", punkte: 10 } }), () => "Basketball");
    expect(g.warum).toMatch(/Leistung 20 gegen erwartete 60/);
    expect(g.warum).toMatch(/Verletzt: ausgefallen\. Die Form verliert zusätzlich 10 Punkte/);
    expect(g.anteile.map((x) => x.id)).toEqual(["leistung", "verletzung"]);
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
    expect(m[0]).toMatchObject({ name: "Kati", moral: 70, grund: "Sieg in Basketball", delta: 2, wort: "zufrieden", vorher: null });
  });

  it("Moral vorher → nachher aus dem gespeicherten Vorwert, nur wer sich bewegt hat", () => {
    const gs = spiel();
    gs.rosters.push({ playerId: "p3", teamId: "t1" } as never);
    gs.players.push({ id: "p3", name: "Gram", fatigue: 0 } as never);
    const st = gs.playerMoraleState!;
    st[0] = { ...st[0], vorher: { morale: 66.5, matchdayId: "md1" } } as never;
    st.push({ playerId: "p3", teamId: "t1", morale: 50, reasons: [], vorher: { morale: 50, matchdayId: "md1" } } as never);
    const m = baueMoralZeilen(gs, "t1", "md1");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ name: "Kati", vorher: 66.5, moral: 70, delta: 3.5 });
    // Vorwert eines anderen Spieltags zählt nicht
    expect(baueMoralZeilen(gs, "t1", "md2")[0]?.vorher ?? null).toBeNull();
  });

  it("ohne Verlauf: leere Meldungen, kein erfundener Wert", () => {
    const n = baueNachDemSpieltag(spiel(), "t1", "md1");
    expect(n?.form).toEqual([]);
    expect(n?.heiss).toEqual([]);
    expect(baueNachDemSpieltag(spiel(), null, "md1")).toBeNull();
  });
});

describe("Nach dem Spieltag: PP und Verletzung", () => {
  function pp(): GameState {
    const gs = spiel() as unknown as Record<string, unknown>;
    gs.season = { id: "s1", matchdayIds: ["m1", "m2"] };
    gs.players = ["p1", "p2", "p3"].map((id, i) => ({ id, name: `P${i + 1}`, fatigue: 0 }));
    gs.rosters = [{ playerId: "p1", teamId: "t1" }, { playerId: "p2", teamId: "t1" }, { playerId: "p3", teamId: "t2" }];
    gs.matchdayState = { matchdayId: "m2" };
    const perf = (id: string, playerId: string, teamId: string, m: string, score: number) => ({
      id, matchdayResultId: m === "m1" ? "r1" : "r2", teamId, playerId, activePlayerId: null, disciplineId: "bb", disciplineSide: "d1", slotIndex: 1,
      baseValue: score, finalPlayerScore: score, scoreContribution: score, rankInTeam: 1, rankInDiscipline: 1, isTop10: false, isMvpCandidate: false, storyWeight: null, createdAt: "",
    });
    gs.seasonState = {
      matchdayResults: [
        { id: "r1", seasonId: "s1", matchdayId: "m1", status: "preview_applied" },
        { id: "r2", seasonId: "s1", matchdayId: "m2", status: "preview_applied" },
      ],
      disciplineResults: ["r1", "r2"].flatMap((r) =>
        ["t1", "t2"].map((t) => ({ id: `${r}-${t}`, matchdayResultId: r, teamId: t, disciplineId: "bb", disciplineSide: "d1", rank: 1, baseScore: 100, totalScore: 100, readinessStatus: "ready", warnings: [], createdAt: "" })),
      ),
      playerDisciplinePerformances: [
        perf("a", "p1", "t1", "m1", 90), perf("b", "p2", "t1", "m1", 30), perf("c", "p3", "t2", "m1", 60),
        perf("d", "p1", "t1", "m2", 20), perf("e", "p2", "t1", "m2", 80), perf("f", "p3", "t2", "m2", 50),
      ],
      playerAvailabilityState: [{ playerId: "p2", teamId: "t1", fatigue: 10, injuryStatus: "injured", injuredAtMatchdayId: "m1", injuryUntilMatchday: "m2" }],
    };
    return gs as unknown as GameState;
  }

  it("PP: Tages- und Saisonrang kommen aus demselben Ledger; nur eigene Spieler", () => {
    const m = baueSpielerPp(pp(), "t1", "m2");
    expect([...m.keys()].sort()).toEqual(["p1", "p2"]);
    const p2 = m.get("p2")!;
    expect(p2.rangTag).toBe(1);
    expect(p2.vonTag).toBe(3);
    expect(p2.pp).toBeGreaterThan(m.get("p1")!.pp);
    expect(p2.ppSaison).toBeGreaterThan(p2.pp);
    expect(p2.vonSaison).toBe(3);
    expect(baueSpielerPp(pp(), "t1", "m1").get("p1")!.rangSaison).toBe(1);
  });

  it("Verletzt: nicht einsetzbar mit Restdauer aus der gespeicherten Sperre", () => {
    const s = verletzungsStand(pp(), "p2", "t1");
    expect(s).toEqual({ nichtEinsetzbar: true, nochSpieltage: 1 });
    expect(verletzungsStand(pp(), "p1", "t1")).toEqual({ nichtEinsetzbar: false, nochSpieltage: null });
    const z = formZeile(meldung({ playerId: "p2", vorher: 29, nachher: 22, eingesetzt: false, bremse: { art: "verletzung", punkte: 10 } }), () => null, s);
    expect(z.kurz).toBe("verletzt \u00b7 nicht einsetzbar (noch 1 Spieltag)");
    expect(z.warum).toMatch(/nicht einsetzbar \(noch 1 Spieltag\)/);
  });
});
