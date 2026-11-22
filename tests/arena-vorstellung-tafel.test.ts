import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import {
  baueVorstellungsTafel,
  eignungImSlot,
  kulisseFuerVorstellung,
  vorstellungZeilenName,
  VORSTELLUNG_FOOTBALL_SLOT_SKALA,
} from "@/lib/foundation/battle-arena/arena-vorstellung-tafel";
import { berechneSlotAufschlag, resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";

/**
 * Tafel der Arena-Vorstellung (Rework 22.11.): Ausrichtung (eine Zeile = ein Slot), Pod, Leerzelle,
 * Gegner exakt (roh + Slot-Bonus) ohne Modifikatoren, gegnerische Formkarte verdeckt, Verletzte nie in
 * einer Zelle, aktives Team aus `ownTeamId`. Quelle der Formel: docs/design/arena-vorstellung-rework-22-11.md.
 */

// Die Verletzungssperre kommt aus dem Spielstand; hier steuerbar, ohne einen ganzen Verletzungsstand zu bauen.
const gesperrteSpieler = new Set<string>();
vi.mock("@/lib/fatigue/fatigue-injury-service", () => ({
  ermittleVerletzungsgesperrteAmSpieltag: () => gesperrteSpieler,
}));

const MD = "md-1";
const ATTR = ["power", "health", "stamina", "intelligence", "awareness", "determination", "speed", "dexterity", "charisma", "will", "spirit", "torment"] as const;

function bogen(basis: number, ueberhoehung: Partial<Record<(typeof ATTR)[number], number>> = {}) {
  return Object.fromEntries(ATTR.map((a) => [a, basis + (ueberhoehung[a] ?? 0)]));
}

type Eintrag = { disziplin: string; slot: number; spieler: string };

function bauSpielstand(opts: {
  teams: Record<string, Array<{ id: string; name: string; rating: number; bogen?: Record<string, number>; klasse?: string }>>;
  drafts: Record<string, Eintrag[]>;
  form?: Record<string, number>;
  moral?: Record<string, number>;
}): GameState {
  const teamIds = Object.keys(opts.teams);
  const players = teamIds.flatMap((t) =>
    opts.teams[t]!.map((p) => ({
      id: p.id,
      name: p.name,
      className: p.klasse ?? "Berserker",
      race: "Human",
      disciplineRatings: { hockey: p.rating, battlefield: p.rating, fechten: p.rating, football: p.rating },
      attributeSheetStats: p.bogen ?? bogen(50),
      fatigue: 0,
    })),
  );
  const rosters = teamIds.flatMap((t) => opts.teams[t]!.map((p) => ({ id: `roster-${p.id}`, teamId: t, playerId: p.id })));
  return {
    teams: teamIds.map((id) => ({ teamId: id, name: `Team ${id}`, shortCode: id.slice(0, 3).toUpperCase() })),
    players,
    rosters,
    disciplines: [],
    scenarioMeta: { gameMode: "battle" },
    season: { id: "s1", matchdayIds: [MD], currentMatchday: 1 },
    seasonState: {
      standings: {},
      lineupDrafts: teamIds.map((t) => ({
        lineupId: `l-${t}`,
        saveId: "save",
        seasonId: "s1",
        matchdayId: MD,
        teamId: t,
        status: "locked",
        entries: (opts.drafts[t] ?? []).map((e) => ({
          disciplineId: e.disziplin,
          disciplineSide: "d1",
          slotIndex: e.slot,
          playerId: e.spieler,
          activePlayerId: `roster-${e.spieler}`,
        })),
        createdAt: "",
        updatedAt: "",
      })),
    },
    playerFormState: Object.entries(opts.form ?? {}).map(([playerId, form]) => ({ playerId, form })),
    playerMoraleState: Object.entries(opts.moral ?? {}).map(([playerId, morale]) => ({ playerId, morale })),
  } as unknown as GameState;
}

const kader = (praefix: string, werte: number[]) => werte.map((rating, i) => ({ id: `player-${praefix}${i}-${praefix}${i}`, name: `${praefix.toUpperCase()}${i}`, rating }));
const eintraege = (disziplin: string, teamPraefix: string, slots: number[]): Eintrag[] =>
  slots.map((slot) => ({ disziplin, slot, spieler: `player-${teamPraefix}${slot}-${teamPraefix}${slot}` }));

describe("Ausrichtung: eine Zeile = ein Slot", () => {
  it("Zeilen folgen der Slot-Reihenfolge der Einsatzliste, k = 1 bis 6 (Hockey)", () => {
    for (let k = 1; k <= 6; k += 1) {
      const gs = bauSpielstand({
        teams: { a: kader("a", [70, 60, 50, 40, 30, 20]), b: kader("b", [70, 60, 50, 40, 30, 20]) },
        drafts: { a: eintraege("hockey", "a", Array.from({ length: k }, (_, i) => i)), b: eintraege("hockey", "b", Array.from({ length: k }, (_, i) => i)) },
      });
      const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "hockey", matchdayId: MD, art: "duell" });
      expect(tafel.k).toBe(k);
      expect(tafel.slots.map((s) => s.label)).toEqual(resolveSlotRolesForDiscipline("hockey", null, k).map((r) => r.label));
      expect(tafel.teams.every((t) => t.zellen.length === k)).toBe(true);
    }
  });

  it("gleicher Slot = gleicher Zeilenindex in beiden Teams, auch bei anderer Eintragsreihenfolge", () => {
    const gs = bauSpielstand({
      teams: { a: kader("a", [70, 60, 50, 40]), b: kader("b", [30, 40, 50, 60]) },
      drafts: {
        a: eintraege("hockey", "a", [0, 1, 2, 3]),
        b: eintraege("hockey", "b", [3, 1, 0, 2]),
      },
    });
    const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "hockey", matchdayId: MD, art: "duell" });
    for (let i = 0; i < 4; i += 1) {
      expect(tafel.teams[0]!.zellen[i]?.name).toBe(`A${i}`);
      expect(tafel.teams[1]!.zellen[i]?.name).toBe(`B${i}`);
    }
  });

  it("ein unbesetzter Slot ist eine Leerzelle, nichts rutscht nach", () => {
    const gs = bauSpielstand({
      teams: { a: kader("a", [70, 60, 50, 40]), b: kader("b", [30, 40, 50, 60]) },
      drafts: { a: eintraege("hockey", "a", [0, 1, 2, 3]), b: eintraege("hockey", "b", [0, 1, 3]) },
    });
    const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "hockey", matchdayId: MD, art: "duell" });
    expect(tafel.teams[1]!.zellen[2]).toBeNull();
    expect(tafel.teams[1]!.zellen[3]?.name).toBe("B3");
    expect(tafel.vergleich[2]).toEqual({ art: "duell", stand: "offen", abstand: null });
  });
});

describe("Vierergruppe (Pod)", () => {
  const gs = bauSpielstand({
    teams: { a: kader("a", [60, 60, 60, 60, 60]), b: kader("b", [50, 50, 50, 50, 50]), c: kader("c", [40, 40, 40, 40, 40]), d: kader("d", [30, 30, 30, 30, 30]) },
    drafts: {
      a: eintraege("battlefield", "a", [0, 1, 2, 3, 4]),
      b: eintraege("battlefield", "b", [0, 1, 2, 3, 4]),
      c: eintraege("battlefield", "c", [0, 1, 2, 3, 4]),
      d: eintraege("battlefield", "d", [0, 1, 2, 4]),
    },
  });

  it("vier Spalten, eigenes Team zuerst, gleiche Slots gleiche Zeile (Rollen je Kopfzahl 5)", () => {
    const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["b", "c", "a", "d"], ownTeamId: "a", disciplineId: "battlefield", matchdayId: MD, art: "pod" });
    expect(tafel.teams.map((t) => t.teamId)).toEqual(["a", "b", "c", "d"]);
    expect(tafel.k).toBe(5);
    expect(tafel.slots.map((s) => s.label)).toEqual(resolveSlotRolesForDiscipline("battlefield", null, 5).map((r) => r.label));
    tafel.teams.forEach((t) => expect(t.zellen).toHaveLength(5));
    expect(tafel.teams[3]!.zellen[3]).toBeNull();
    expect(tafel.teams[3]!.zellen[4]?.name).toBe("D4");
  });

  it("Vergleich im Pod: gegen wie viele der anderen der eigene Slot vorn liegt", () => {
    const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b", "c", "d"], ownTeamId: "a", disciplineId: "battlefield", matchdayId: MD, art: "pod" });
    expect(tafel.vergleich[0]).toEqual({ art: "pod", vorn: 3, von: 3 });
    expect(tafel.vergleich[3]).toEqual({ art: "pod", vorn: 2, von: 2 });
  });
});

describe("Aktives Team kommt aus ownTeamId, nie fest", () => {
  it("wer als eigenes Team uebergeben wird, steht zuerst und traegt die Eigen-Infos", () => {
    const gs = bauSpielstand({
      teams: { a: kader("a", [70, 60]), b: kader("b", [30, 40]) },
      drafts: { a: eintraege("hockey", "a", [0, 1]), b: eintraege("hockey", "b", [0, 1]) },
    });
    const alsB = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "b", disciplineId: "hockey", matchdayId: MD, art: "duell" });
    expect(alsB.teams.map((t) => t.teamId)).toEqual(["b", "a"]);
    expect(alsB.teams[0]!.eigen).toBe(true);
    expect(alsB.teams[0]!.eigenInfo).not.toBeNull();
    expect(alsB.teams[1]!.eigenInfo).toBeNull();
  });
});

describe("Gegner: exakt, roh + Slot-Bonus, ohne Tagesmodifikatoren; Formkarte verdeckt", () => {
  const rolle = resolveSlotRolesForDiscipline("hockey", null, 2)[0]!;
  const gegnerBogen = bogen(40, { power: 40, torment: 30 });
  const gs = bauSpielstand({
    teams: {
      a: [{ id: "player-a0-a0", name: "A0", rating: 55 }, { id: "player-a1-a1", name: "A1", rating: 50 }],
      b: [{ id: "player-b0-b0", name: "B0", rating: 61, bogen: gegnerBogen }, { id: "player-b1-b1", name: "B1", rating: 44 }],
    },
    drafts: { a: eintraege("hockey", "a", [0, 1]), b: eintraege("hockey", "b", [0, 1]) },
    // Form und Moral des Gegners auf Anschlag: duerfen die gezeigte Zahl NICHT bewegen.
    form: { "player-b0-b0": 95, "player-a0-a0": 95 },
    moral: { "player-b0-b0": 100, "player-a0-a0": 100 },
  });
  const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "hockey", matchdayId: MD, art: "duell" });

  it("Gegnerzahl = gerundete rohe Eignung + Slot-Bonus der Rolle, nichts weiter", () => {
    const bonus = berechneSlotAufschlag(rolle, gegnerBogen as never);
    expect(bonus).not.toBeNull();
    expect(Math.abs(bonus!)).toBeGreaterThan(0);
    expect(tafel.teams[1]!.zellen[0]!.eignung).toBe(Math.round(61 + bonus!));
    expect(tafel.teams[1]!.zellen[0]!.roh).toBe(61);
  });

  it("Gegner traegt weder Form noch Moral noch Karte, und keine Eigen-Infos (Karte verdeckt)", () => {
    const gegner = tafel.teams[1]!;
    for (const zelle of gegner.zellen) {
      expect(zelle?.form).toBeNull();
      expect(zelle?.moral).toBeNull();
      expect(zelle?.karte).toBeNull();
      expect(zelle?.captain).toBe(false);
    }
    expect(gegner.eigenInfo).toBeNull();
  });

  it("das eigene Team zeigt Form und Moral zusaetzlich, die Eignungszahl bleibt dieselbe Formel", () => {
    const eigen = tafel.teams[0]!.zellen[0]!;
    expect(eigen.form).not.toBeNull();
    expect(eigen.moral).toBe(100);
    const bonusEigen = berechneSlotAufschlag(rolle, bogen(50) as never);
    expect(eigen.eignung).toBe(Math.round(55 + (bonusEigen ?? 0)));
  });

  it("der Vergleich nutzt die gezeigten Zahlen beider Seiten", () => {
    const a = tafel.teams[0]!.zellen[1]!.eignung!;
    const b = tafel.teams[1]!.zellen[1]!.eignung!;
    const v = tafel.vergleich[1]!;
    expect(v.art).toBe("duell");
    if (v.art === "duell") expect(v.stand).toBe(a > b ? "vorn" : a < b ? "hinten" : "gleich");
  });
});

describe("Verletzte nie in einer Zelle", () => {
  it("ein verletzungsgesperrter Spieler steht in keiner Zelle und erscheint unter Nicht aufgestellt", () => {
    const gs = bauSpielstand({
      teams: { a: kader("a", [70, 60, 50]), b: kader("b", [30, 40, 50]) },
      drafts: { a: eintraege("hockey", "a", [0, 1, 2]), b: eintraege("hockey", "b", [0, 1, 2]) },
    });
    gesperrteSpieler.add("a::player-a1-a1");
    try {
      const tafel = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "hockey", matchdayId: MD, art: "duell" });
      expect(tafel.teams[0]!.zellen[1]).toBeNull();
      expect(tafel.teams[0]!.zellen.some((z) => z?.playerId === "player-a1-a1")).toBe(false);
      const bank = tafel.teams[0]!.eigenInfo!.nichtAufgestellt;
      expect(bank.find((b) => b.playerId === "player-a1-a1")?.grund).toBe("verletzt");
    } finally {
      gesperrteSpieler.clear();
    }
  });
});

describe("Slot-Bonus und Feldplan", () => {
  it("eignungImSlot: roh + Slot-Bonus, gerundet; ohne gespeicherten Wert Rueckfall auf das Grundprofil", () => {
    const rolle = resolveSlotRolesForDiscipline("hockey", null, 6)[0]!;
    const stats = bogen(40, { power: 40 }) as never;
    const mit = eignungImSlot({ disciplineId: "hockey", player: { disciplineRatings: { hockey: 60 } } as never, stats, role: rolle });
    expect(mit.roh).toBe(60);
    expect(mit.eignung).toBe(Math.round(60 + (berechneSlotAufschlag(rolle, stats) ?? 0)));
    const ohne = eignungImSlot({ disciplineId: "hockey", player: { disciplineRatings: {} } as never, stats, role: rolle });
    expect(ohne.roh).not.toBeNull();
  });

  it("Football rechnet den Slot-Bonus mit der Motor-Skala 0,35 (Drift-Wacht gegen battle-mode.engine.js)", () => {
    const motor = readFileSync(path.join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");
    expect(motor).toContain(`FOOTBALL_SLOT_AUFSCHLAG_SKALA=${VORSTELLUNG_FOOTBALL_SLOT_SKALA}`);
    const rolle = resolveSlotRolesForDiscipline("football", null, 6)[0]!;
    const stats = bogen(40, { power: 50, speed: -30 }) as never;
    const voll = berechneSlotAufschlag(rolle, stats, 1)!;
    const football = eignungImSlot({ disciplineId: "football", player: { disciplineRatings: { football: 50 } } as never, stats, role: rolle });
    expect(football.slotBonus).toBe(berechneSlotAufschlag(rolle, stats, 0.35));
    expect(Math.abs(football.slotBonus!)).toBeLessThanOrEqual(Math.abs(voll));
  });

  it("Feldplan nur in Feldspielen: Hockey hat Positionen aus der Formation, Fechten keinen", () => {
    const gs = bauSpielstand({
      teams: { a: kader("a", [70, 60, 50]), b: kader("b", [30, 40, 50]) },
      drafts: { a: [...eintraege("hockey", "a", [0, 1, 2]), ...eintraege("fechten", "a", [0, 1, 2])], b: [...eintraege("hockey", "b", [0, 1, 2]), ...eintraege("fechten", "b", [0, 1, 2])] },
    });
    const hockey = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "hockey", matchdayId: MD, art: "duell" });
    expect(hockey.slots.every((s) => s.feldplan != null)).toBe(true);
    expect(hockey.slots[0]!.feldplan!.feld).toBe("eis");
    const fechten = baueVorstellungsTafel({ gameState: gs, teamIds: ["a", "b"], ownTeamId: "a", disciplineId: "fechten", matchdayId: MD, art: "duell" });
    expect(fechten.slots.every((s) => s.feldplan == null)).toBe(true);
    expect(fechten.zeilenName).toBe("Gefecht");
  });
});

describe("Zeilenname und Kulisse", () => {
  it("Gefecht bei Buehnen mit Slot-Paarung, Laeufer bei der Bahn, sonst Slot", () => {
    expect(vorstellungZeilenName("fechten").name).toBe("Gefecht");
    expect(vorstellungZeilenName("staffel").name).toBe("Läufer");
    expect(vorstellungZeilenName("hockey").name).toBe("Slot");
  });
  it("Kulisse: gebuchte Variante, sonst die erste; keine Kulisse ohne Eintrag", () => {
    expect(kulisseFuerVorstellung("hockey", "bergsee")?.bild).toBe("/sprites/kulissen/hockey/bergsee.jpg");
    expect(kulisseFuerVorstellung("hockey", "gibt-es-nicht")?.bild).toMatch(/^\/sprites\/kulissen\/hockey\//);
    expect(kulisseFuerVorstellung("unbekannt")).toBeNull();
  });
});
