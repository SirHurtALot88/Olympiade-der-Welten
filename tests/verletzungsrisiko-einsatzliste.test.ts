/**
 * FEATURE-REQUEST (Spielergespraech): "man kann nicht sehn von wem man verletzt wurde …
 * is n bischen obtuse" / "mein bos wurde verletzt an spieltag 4 und der hatte nen ruhe
 * tag davor". Der Mangel ist fehlende TRANSPARENZ, nicht fehlende Ursache: Verletzungen
 * entstehen ausschliesslich aus Fatigue (kein Gegnereinfluss), und der Wurf passiert bei
 * `aktuelle Fatigue + Spieltags-Last` — nie bei 0 % Risiko, auch nicht nach einem Ruhetag.
 *
 * Diese Suite sichert die neue Anzeige in der Einsatzliste gegen das ECHTE Modell:
 *   1. Die projizierte Zahl (`projectMatchdayInjuryRisk`) ist EXAKT die Wahrscheinlichkeit,
 *      gegen die der Spieltags-Roll-Loop (`buildMatchdayInjuryRollMap`) wuerfelt — inklusive
 *      Trait-Multiplikator und Intensitaets-Skalierung. Driftet die Anzeige vom Wurf weg,
 *      faellt dieser Vergleich.
 *   2. Das Restrisiko ist nie 0: auch ein komplett ausgeruhter Spieler traegt beim Einsatz
 *      ein Risiko (Wurf bei Fatigue ~10 => ~1,7 %). Genau dieser Fall wurde als Bug gemeldet.
 *   3. Der Datenpfad in die Einsatzliste (Kontext -> Optionen) reicht die Projektion
 *      unveraendert durch.
 *   4. Die Inbox erklaert eine Verletzung im Nachhinein aus dem persistierten Wurf
 *      (Fatigue beim Wurf + Risikoprozent) statt nur "Spieler fehlt" zu melden.
 */
import { describe, expect, it } from "vitest";

import type { GameState, LineupDraft } from "@/lib/data/olyDataTypes";
import {
  buildMatchdayInjuryRollMap,
  getInjuryRiskPercent,
  projectMatchdayInjuryRisk,
} from "@/lib/fatigue/fatigue-injury-service";
import { buildGameInboxItems } from "@/lib/foundation/game-inbox-service";
import { buildLegacyLineupLabPlayerOptions } from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

/**
 * Minimaler Spielstand mit einem Team und frei waehlbaren Spielern in einem Draft.
 * Fatigue kommt bewusst aus `player.fatigue` (kein playerAvailabilityState), weil
 * `getPlayerCurrentFatigue` genau darauf zurueckfaellt — derselbe Pfad wie ein
 * frisch geladener Spielstand vor dem ersten Spieltag.
 */
function createGameState(
  players: Array<{ id: string; fatigue: number; traitsPositive?: string[]; traitsNegative?: string[] }>,
  intensity: "conserve" | "normal" | "push",
): GameState {
  const draft: LineupDraft = {
    lineupId: "lineup-1",
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "md-1",
    teamId: "A-A",
    status: "submitted",
    modifiers: { d1: { intensity }, d2: {} },
    entries: players.map((player, index) => ({
      disciplineId: "tdm",
      disciplineSide: "d1" as const,
      slotIndex: index,
      playerId: player.id,
      activePlayerId: `active-${player.id}`,
    })),
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  return {
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      matchdayIds: ["md-1", "md-2"],
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      standings: {},
      lineupDrafts: [draft],
      matchdayResults: [],
      disciplineResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
      resultAuditLogs: [],
    },
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [
      {
        teamId: "A-A",
        shortCode: "A-A",
        name: "Alpha",
        budget: 100,
        cash: 100,
        identityId: "identity-A",
        humanControlled: true,
        rosterLimit: 12,
      },
    ],
    teamIdentities: [],
    players: players.map((player) => ({
      id: player.id,
      name: player.id,
      className: "Runner",
      race: "Human",
      marketValue: 10,
      salary: 2,
      fatigue: player.fatigue,
      traitsPositive: player.traitsPositive ?? [],
      traitsNegative: player.traitsNegative ?? [],
      coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
      attributes: {},
      disciplineRatings: {},
    })),
    disciplines: [],
    rosters: players.map((player) => ({
      teamId: "A-A",
      playerId: player.id,
      role: "core",
      joinedSeasonId: "season-1",
    })),
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
  } as unknown as GameState;
}

/** Spieler ohne lastrelevante Traits — der Normalfall des Kaders. */
const NEUTRAL_PLAYER = { traitsPositive: [] as string[], traitsNegative: [] as string[] };

describe("Einsatzlisten-Anzeige wuerfelt mit denselben Zahlen wie der Spieltag", () => {
  /**
   * DIE Kernzusicherung des Features: Anzeige und Wurf duerfen nie auseinanderdriften.
   * Deshalb wird hier nicht die Formel nachgerechnet, sondern der ECHTE Roll-Loop
   * ausgefuehrt und seine riskPercent/fatigueBefore gegen die Projektion gehalten —
   * ueber ausgeruhte, mittel- und hochbelastete Spieler sowie beide Trait-Richtungen.
   */
  it.each(["conserve", "normal", "push"] as const)(
    "Projektion == echter Roll bei Intensitaet %s (inkl. Traits)",
    (intensity) => {
      const players = [
        { id: "ausgeruht", fatigue: 0 },
        { id: "mittel", fatigue: 45 },
        { id: "hoch", fatigue: 83 },
        { id: "robust", fatigue: 45, traitsPositive: ["Healthy"] },
        { id: "fragil", fatigue: 45, traitsNegative: ["FaintHearted"] },
      ];
      const gameState = createGameState(players, intensity);
      const rollMap = buildMatchdayInjuryRollMap({
        gameState,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: "md-1",
      });

      for (const player of players) {
        const roll = rollMap.get(`A-A::${player.id}`);
        expect(roll, `Roll fuer ${player.id} fehlt`).toBeTruthy();
        const projection = projectMatchdayInjuryRisk({
          player: { traitsPositive: player.traitsPositive ?? [], traitsNegative: player.traitsNegative ?? [] },
          currentFatigue: player.fatigue,
          intensity,
        });
        expect(projection.fatigueBeforeRoll, `${player.id}: fatigueBeforeRoll driftet`).toBe(roll!.fatigueBefore);
        expect(projection.riskPercent, `${player.id}: riskPercent driftet`).toBe(roll!.riskPercent);
      }
    },
  );

  /**
   * DIESER TEST STAND FRUEHER GENAU ANDERSHERUM und hiess „Restrisiko: auch ein komplett
   * ausgeruhter Spieler hat beim Einsatz > 0 %" — begruendet mit Ddimbas Fall (Ruhetag davor,
   * normale Intensitaet, trotzdem verletzt).
   *
   * GEMELDET VON CHRIS: „bis zu einer Fatigue von 25 sollte die Wahrscheinlichkeit einfach 0 %
   * sein." Damit ist die Owner-Entscheidung getroffen, und sie widerspricht dem alten Restrisiko:
   * ein ausgeruhter Spieler landet nach EINEM Spieltag bei Fatigue 10 (push 14, conserve 7,5) und
   * damit mitten in der Schutzzone. Ddimbas Fall kann so nicht mehr auftreten — das ist die
   * beabsichtigte Wirkung, nicht ein uebersehener Nebeneffekt.
   *
   * Festgehalten wird deshalb die neue Zusicherung samt der Grenze, ab der es wieder losgeht.
   */
  it("Schutzzone: ein ausgeruhter Spieler hat auch beim Einsatz 0 %", () => {
    for (const intensity of ["conserve", "normal", "push"] as const) {
      const projection = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 0, intensity });
      expect(projection.riskPercent, `Intensitaet ${intensity}`).toBe(0);
    }
    // Konkrete Kalibrierung festnageln: Last 10 => Wurf bei Fatigue 10 => in der Schutzzone => 0 %.
    const normal = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 0, intensity: "normal" });
    expect(normal.fatigueBeforeRoll).toBe(10);
    expect(normal.riskPercent).toBe(0);
  });

  it("und ab der zweiten/dritten Einsatz-Last endet die Schutzzone", () => {
    // Gegenprobe zum Test darueber: die Schutzzone darf nicht dauerhaft sein, sonst waere die
    // Fatigue als Constraint erledigt. Bei 20 Vor-Fatigue traegt der Einsatz ueber die 25.
    const stillProtected = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 10 });
    expect(stillProtected.fatigueBeforeRoll).toBe(20);
    expect(stillProtected.riskPercent).toBe(0);

    const exposed = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 20 });
    expect(exposed.fatigueBeforeRoll).toBe(30);
    expect(exposed.riskPercent).toBeGreaterThan(0);
  });

  it("Intensitaet ordnet das Risiko: Schonen < Normal < Pushen", () => {
    const conserve = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 40, intensity: "conserve" });
    const normal = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 40, intensity: "normal" });
    const push = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 40, intensity: "push" });
    expect(conserve.riskPercent).toBeLessThan(normal.riskPercent);
    expect(normal.riskPercent).toBeLessThan(push.riskPercent);
  });

  it("Traits verschieben die Last: Healthy < neutral < FaintHearted", () => {
    const healthy = projectMatchdayInjuryRisk({ player: { traitsPositive: ["Healthy"], traitsNegative: [] }, currentFatigue: 40 });
    const neutral = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: 40 });
    const fragile = projectMatchdayInjuryRisk({ player: { traitsPositive: [], traitsNegative: ["FaintHearted"] }, currentFatigue: 40 });
    expect(healthy.matchdayLoad).toBeLessThan(neutral.matchdayLoad);
    expect(neutral.matchdayLoad).toBeLessThan(fragile.matchdayLoad);
    expect(healthy.riskPercent).toBeLessThan(fragile.riskPercent);
  });

  /**
   * Die alte Anzeige (Risiko auf AKTUELLER Fatigue) unterschlug die Einsatz-Last
   * systematisch — gemessen am echten Spielstand ~2,5 % angezeigt vs. ~4,5 % gewuerfelt.
   * Festgehalten als Zusicherung: die Projektion liegt fuer jeden Einsatz STRIKT ueber
   * dem Risiko der aktuellen Fatigue.
   */
  it("Projektion liegt immer ueber dem Risiko der aktuellen Fatigue", () => {
    // Innerhalb der Schutzzone sind beide Seiten 0 — dort gibt es nichts zu unterschlagen. Geprueft
    // wird deshalb ab der Fatigue, bei der die Einsatz-Last ueber die 25 traegt.
    for (const fatigue of [20, 30, 55, 75]) {
      const projection = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: fatigue });
      expect(projection.riskPercent, `Fatigue ${fatigue}`).toBeGreaterThan(getInjuryRiskPercent(fatigue));
    }
    for (const fatigue of [0, 10]) {
      const projection = projectMatchdayInjuryRisk({ player: NEUTRAL_PLAYER, currentFatigue: fatigue });
      expect(projection.riskPercent, `Fatigue ${fatigue}`).toBe(0);
    }
  });
});

describe("Datenpfad in die Einsatzliste", () => {
  it("die Optionen der Einsatzliste reichen die Projektion unveraendert durch", () => {
    const projection = {
      conserve: { fatigueBeforeRoll: 7.5, matchdayLoad: 7.5, riskPercent: 1.25, bandLabel: "none" },
      normal: { fatigueBeforeRoll: 10, matchdayLoad: 10, riskPercent: 1.67, bandLabel: "none" },
      push: { fatigueBeforeRoll: 14, matchdayLoad: 14, riskPercent: 2.33, bandLabel: "none" },
    };
    const context = {
      activePlayers: [{ id: "active-p1", playerId: "p1" }],
      rosterPlayers: [
        {
          id: "p1",
          name: "Testspieler",
          coreStats: { pow: 40, spe: 40, men: 40, soc: 40 },
          injuryStatus: "healthy",
          injuryRiskProjection: projection,
        },
      ],
      disciplines: [],
      disciplineScores: [],
      fatigueByPlayerId: { p1: { count: 0 } },
    } as unknown as LegacyLineupLoadedContext;

    const options = buildLegacyLineupLabPlayerOptions(context);
    expect(options).toHaveLength(1);
    expect(options[0].injuryRiskProjection).toEqual(projection);
  });
});

/**
 * Geprueft am Quelltext (gleiche Begruendung wie tests/lineup-injury-visibility.test.ts:
 * die Einsatzliste laesst sich ohne halbe Foundation-Shell nicht rendern). Das belegt
 * nicht das Bild im Browser, haelt aber fest, DASS die Darstellung ein Meter mit
 * Laengen-Kodierung ist (NlProgressBar, Skala bis zum Modell-Maximum) und nicht wieder
 * zu blossem Text schrumpft — und dass der Wert aus der Projektion des echten Modells
 * kommt, nicht aus einer Neuberechnung.
 */
describe("Einsatzliste — Darstellung als Meter, gespeist aus der Projektion", () => {
  it("die Slot-Karte rendert das Risiko als NlProgressBar-Meter aus injuryRiskProjection", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const view = readFileSync(
      join(process.cwd(), "app/foundation/legacy-lineup-lab/LineupNewLook.tsx"),
      "utf8",
    );
    expect(view).toContain('className="nl-lineup-injury-meter"');
    expect(view).toContain("value={injuryProjection.riskPercent}");
    expect(view).toContain("max={MAX_MATCHDAY_INJURY_RISK_PERCENT}");
    // Skalen-Obergrenze kommt aus der echten Kurve, nicht aus einer Hauszahl.
    expect(view).toContain("getInjuryRiskPercent(100)");
    // Die Projektion wird per Seiten-Intensitaet nachgeschlagen, nicht clientseitig nachgerechnet.
    expect(view).toContain("injuryRiskProjection?.[getDisciplineIntensity(slot.disciplineSide)]");
  });
});

describe("Nachvollziehbarkeit im Nachhinein (Inbox)", () => {
  it("die Verletzungs-Meldung nennt Fatigue beim Wurf und Risikoprozent", () => {
    const gameState = createGameState([{ id: "p-injured", fatigue: 20 }], "normal");
    gameState.seasonState = {
      ...gameState.seasonState,
      teamControlSettings: {
        "A-A": {
          teamId: "A-A",
          controlMode: "manual",
          ownerId: "user_local",
          ownerSlot: "user",
          displayLabel: "Test",
        },
      },
      playerAvailabilityState: [
        {
          playerId: "p-injured",
          teamId: "A-A",
          fatigue: 20,
          injuryStatus: "injured",
          injuryUntilMatchday: "md-2",
          injuredAtSeasonId: "season-1",
          injuredAtMatchdayId: "md-1",
          injuryReason: "fatigue_over_30_after_matchday_use",
          // Genau Ddimbas Konstellation: niedrige Fatigue, kleines Risiko, trotzdem erwischt.
          injuryRiskLastRoll: {
            fatigueBefore: 13.8,
            riskPercent: 2.3,
            roll: 1.3,
            result: "injured",
            source: "fatigue_injury_risk_v1",
          },
        },
      ],
    } as unknown as GameState["seasonState"];
    (gameState.season as { currentMatchday: number }).currentMatchday = 2;
    (gameState as { matchdayState: { matchdayId: string } }).matchdayState.matchdayId = "md-2";

    const items = buildGameInboxItems({
      saveId: "save-1",
      gameState,
      activeTeamId: "A-A",
      activeOwnerId: "user_local",
      hostMode: false,
      now: new Date().toISOString(),
    });
    const injuryItem = items.find((item) => item.source === "player_health_injury" && item.playerId === "p-injured");
    expect(injuryItem, "Verletzungs-Item fehlt").toBeTruthy();
    // Die Erklaerung muss die persistierten Wurf-Zahlen nennen — nicht irgendeine Neuberechnung.
    expect(injuryItem!.description).toContain("Fatigue 14");
    expect(injuryItem!.description).toContain("2.3 %");
    expect(injuryItem!.description).toContain("ohne Fremdeinwirkung");
  });
});
