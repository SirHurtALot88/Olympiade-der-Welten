/**
 * RANKS: DIE SPALTEN FOLGEN DER AUSGEWÜRFELTEN SAISON, UND DIE KADERGRÖSSE STEHT DANEBEN.
 *
 * GEMELDET VON CHRIS, zwei Dinge in einem Zug:
 *
 *   „es wäre cool wenn wir auf der ranks seite vor TOT noch ne spalte hätten wo wir die anzahl
 *    der spieler im team sehen könnten einfach als #"
 *
 *   „die spaltenreihenfolge soll doch pro saison dynamisch sein. sobald der spielplan
 *    ausgewürfelt wurde soll die reihenfolge angepasst werden. zb sind hockey und time trial die
 *    6er diszis. Dann sollten die im rot bzw grün an erster stelle stehen!"
 *
 * BEFUND zur Reihenfolge: die Sortierung lief über `discipline.playerCount` — die KATALOG-Zahl
 * aus dem Startzustand. Der Spielplan würfelt die Spielerzahl aber jede Saison neu aus, und
 * dieselbe Zahl steuert auch die Punkteverteilung; sie ist also die für die Saison gültige.
 * Am Live-Spielstand nachgemessen wich JEDER der vier Bereiche ab:
 *
 *   POWER   Katalog GEW(6)·HOC(5)·BRE(4)·TDM(3)·MIN(2) → Saison GEW(6)·TDM(5)·BRE(4)·HOC(3)·MIN(2)
 *   SPEED   Katalog CLI(6)·FEC(5)·TIM(4)·STA(3)·SPU(2) → Saison STA(6)·CLI(5)·SPU(4)·TIM(3)·FEC(2)
 *   MENTAL  Katalog ISP(6)·WET(5)·TAK(4)·TEN(3)·SCH(2) → Saison WET(6)·TEN(5)·SCH(4)·TAK(3)·ISP(2)
 *   SOCIAL  Katalog BAS(6)·SHO(5)·FOO(4)·EIS(3)·BAT(2) → Saison SHO(6)·BAS(5)·BAT(4)·EIS(3)·FOO(2)
 *
 * `buildSeasonAwareDisciplineAreaGroups` gab es dafür schon — nur benutzt hat sie niemand.
 *
 * Gepinnt wird die EIGENSCHAFT: innerhalb eines Bereichs steht die Disziplin mit den meisten
 * Spielern DIESER Saison vorn, und die Bereichsgrenzen bleiben unangetastet.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonDisciplinePlayerCountMap } from "@/lib/season/season-discipline-schedule";

/**
 * Der Sortier-Kern der Ranks-Spalten, wortgleich zu `disciplineRanksColumns` im Shell-Scope.
 * Bewusst hier nachgebaut: der Hook selbst braucht den kompletten Foundation-Zustand, und das
 * Projekt fährt vitest ohne jsdom.
 */
function spaltenReihenfolge(gameState: GameState) {
  const saison = buildSeasonDisciplinePlayerCountMap(gameState);
  const bereichsOrdnung: string[] = [];
  for (const disziplin of gameState.disciplines) {
    if (!bereichsOrdnung.includes(disziplin.category)) bereichsOrdnung.push(disziplin.category);
  }
  const zahl = (d: { id: string; playerCount?: number | null }) =>
    saison.get(d.id) ?? d.playerCount ?? 0;
  return [...gameState.disciplines].sort((links, rechts) => {
    const bereich = bereichsOrdnung.indexOf(links.category) - bereichsOrdnung.indexOf(rechts.category);
    if (bereich !== 0) return bereich;
    return zahl(rechts) - zahl(links);
  });
}

/** Katalog sagt A(6) B(5), der Spielplan dreht es auf B(6) A(5). */
function zustand(): GameState {
  return {
    season: { id: "season-1", matchdayIds: ["matchday-1"] },
    matchdayState: { matchdayId: "matchday-1" },
    disciplines: [
      { id: "a", name: "Alpha", category: "power", playerCount: 6 },
      { id: "b", name: "Bravo", category: "power", playerCount: 5 },
      { id: "c", name: "Charlie", category: "speed", playerCount: 4 },
      { id: "d", name: "Delta", category: "speed", playerCount: 3 },
    ],
    seasonState: {
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "matchday-1",
          discipline1: { disciplineId: "b", playerCount: 6 },
          discipline2: { disciplineId: "a", playerCount: 5 },
        },
        {
          seasonId: "season-1",
          matchdayId: "matchday-2",
          discipline1: { disciplineId: "d", playerCount: 6 },
          discipline2: { disciplineId: "c", playerCount: 2 },
        },
      ],
    },
  } as unknown as GameState;
}

describe("Ranks · Spaltenordnung folgt der ausgewürfelten Saison", () => {
  it("stellt die Disziplin mit den meisten Spielern DIESER Saison nach vorn", () => {
    // Katalog sagt Alpha(6) vor Bravo(5) — der Spielplan dreht es um.
    expect(spaltenReihenfolge(zustand()).map((d) => d.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("lässt die Bereichsgrenzen unangetastet", () => {
    // Die farbige Gruppierung im Kopf haengt daran: erst alle POWER, dann alle SPEED.
    const bereiche = spaltenReihenfolge(zustand()).map((d) => d.category);
    expect(bereiche).toEqual(["power", "power", "speed", "speed"]);
  });

  it("lässt keine Disziplin ohne Zahl — sonst rutschte sie stumm ans Ende", () => {
    // `buildSeasonDisciplinePlayerCountMap` traegt fuer JEDE Katalog-Disziplin einen Wert nach.
    // Ohne diese Zusage bekaeme eine Disziplin ohne Spielplan-Eintrag eine 0 und stuende ohne
    // erkennbaren Grund ganz hinten. (Einen leeren Spielplan gibt es dabei nicht:
    // `getSeasonDisciplineSchedule` wuerfelt deterministisch einen, wenn keiner gespeichert ist.)
    const saison = buildSeasonDisciplinePlayerCountMap(zustand());
    for (const disziplin of zustand().disciplines) {
      const wert = saison.get(disziplin.id);
      expect(wert, `${disziplin.id} ohne Spielerzahl`).not.toBeNull();
      expect(wert, `${disziplin.id} ohne Spielerzahl`).toBeGreaterThan(0);
    }
  });

  it("nimmt dieselbe Zahl, die auch die Punkte verteilt", () => {
    // Zwei Quellen fuer „wie viele Spieler hat diese Disziplin" waeren wieder der alte Fehler.
    const saison = buildSeasonDisciplinePlayerCountMap(zustand());
    expect(saison.get("b")).toBe(6);
    expect(saison.get("a")).toBe(5);
  });
});

describe("Ranks · die Kadergröße steht vor TOT", () => {
  it("hat die Spalte, und zwar links von TOT", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const quelle = fs.readFileSync("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx", "utf8");
    const roster = quelle.indexOf('id: "rosterSize"');
    const tot = quelle.indexOf('id: "totalRank"');
    expect(roster).toBeGreaterThan(-1);
    expect(roster).toBeLessThan(tot);
  });

  it("zählt die Kader-Einträge, nicht irgendeine zweite Ableitung", () => {
    // Es muss dieselbe Menge sein, aus der die Einsatzliste ihre Kandidaten nimmt.
    const fs = require("node:fs") as typeof import("node:fs");
    const quelle = fs.readFileSync("lib/foundation/tabs/use-foundation-cross-tab-discipline-ranks.ts", "utf8");
    expect(quelle).toContain("input.gameState.rosters");
    expect(quelle).toContain("rosterSize: rosterSizeByTeamId.get(rowCore.teamId) ?? 0");
  });

  it("erklärt die Spalte im Tooltip — „#“ allein sagt nichts", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const quelle = fs.readFileSync("app/foundation/FoundationShellRouterBody.tsx", "utf8");
    expect(quelle).toContain("rosterSize:");
    expect(quelle).toContain("Spieler im Kader dieses Teams");
  });
});
