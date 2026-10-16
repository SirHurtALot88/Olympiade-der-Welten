/**
 * TASK #164 — CI-INVARIANTENTEST (Plan `docs/design/battle-arena-auto-run-anbindung-plan-16-10.md`
 * Abschnitt 6.1/7, PR 0): ein SCHMALER Strukturtest für Battle-Saves, der NUR Strukturregeln prüft,
 * keine Balance-Schwellen — er darf nie wegen Spielbalance rot werden. Läuft im normalen CI
 * (`.github/workflows/ci.yml` Job `full-test-suite` über `npm test`), NICHT im abgeschalteten
 * Nightly-Job (`.github/workflows/ci-nightly.yml` Job `full-season-playthrough`, nur
 * `workflow_dispatch`, s. Kommentar dort).
 *
 * Fährt den echten Wizard-Pfad (`applyNewGameSetup`) + Liga-Draft + zwei Spieltage über den echten
 * Auto-Run (`runLocalMatchdayAutoRun`) — denselben Pfad wie `scripts/e2e-battle-pps-duell.ts` und
 * `scripts/multi-season-smoke.ts --game-mode=battle` (dieser Test ist ihre CI-gebundene, schlanke
 * Variante, lokal gegenprobiert gegen `scripts/e2e-battle-pps-duell.ts 2`). Anders als
 * `tests/battle-mode-pps-duell.test.ts` (konstruierte `LegacyLineupLoadedContext`-Objekte, prüft
 * die Formel) geht dieser Test über den VOLLEN Schreibweg — echte SQLite, `persistence.getSaveById`
 * nach dem Schreiben, nicht das In-Memory-Rückgabeobjekt.
 *
 * GEPRÜFT WIRD NUR, WAS DER PLAN IN ABSCHNITT 6.1/6.2 ALS STRUKTURREGEL NENNT:
 *  - `matchdayIds.length === 20` (die konfigurierte Saisonlänge für Battle Mode)
 *  - 160 Fixtures je Liga im generierten Spielplan (320 insgesamt, 2 Ligen) — steht schon nach
 *    `applyNewGameSetup`, kein Spieltag muss dafür gespielt werden
 *  - jede gebuchte Disziplin-Zeile: `teamPoints ∈ {0,1,2}`
 *  - KEINE Zeile mit `resolutionSource: "pps"` (Rangtabellen-Pfad) in einem Battle-Save, egal ob
 *    arena-aufgelöst oder nicht — das ist die eine Invariante, die K1 (Arena nie am Auto-Run) NICHT
 *    verletzt: die PPS-Duell-Brücke bucht immer 0/1/2, nie die Rangtabelle
 *  - je Fixture: Punkte-Summe genau 2, Verhältnis-Summe genau 0
 *  - Verhältnis-Summe je Liga in der Tabelle = 0
 *
 * BEWUSST NICHT GEPRÜFT: ob eine Disziplin über die Arena oder die Brücke lief (das ist Balance/K1,
 * nicht Struktur) — dafür gibt es `tests/battle-mode-arena-ausfall-sichtbar.test.ts` (PR 1).
 */
import { describe, expect, it } from "vitest";

import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { isBattleModeSave } from "@/lib/season/game-mode";
import type { DisciplineResultRecord } from "@/lib/data/olyDataTypes";

// Zwei Spieltage reichen für die Strukturprüfung (die 20/160/160-Zahlen stehen ohnehin schon nach
// dem Setup, s.o.) und halten die CI-Laufzeit niedrig — lokal gegen 2 und 3 Spieltage gemessen,
// beide ~2:50–3:05 min (die AI-Draft-Zuteilung für 32 Teams dominiert, nicht die Spieltagszahl).
const SPIELTAGE = 2;

function frischerDienst() {
  process.env.OLY_APP_SQLITE_PATH = `/tmp/oly-battle-invarianten-${Math.random().toString(36).slice(2)}.sqlite`;
  return createPersistenceService();
}

describe("Task #164 · Battle-Save-Invarianten über den echten Wizard-/Auto-Run-Pfad", () => {
  it(
    "20 Spieltage, 160 Fixtures je Liga, teamPoints ∈ {0,1,2}, nie rank_to_points, Verhältnis-Summe 0",
    async () => {
      const persistence = frischerDienst();
      persistence.bootstrapSingleplayerSave();
      const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
      const preview = previewNewGameSetup(input);
      expect(preview.blockers).toEqual([]);
      const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
      const saveId = angelegt.save.saveId;

      // STRUKTUR SOFORT NACH DEM ANLEGEN — der ganze Spielplan steht schon beim Setup
      // (lib/season/season-fixture-schedule.ts), kein Spieltag muss dafür gespielt werden.
      const frisch = persistence.getSaveById(saveId)!;
      expect(isBattleModeSave(frisch.gameState)).toBe(true);
      expect(frisch.gameState.season.matchdayIds.length).toBe(20);
      const schedule = (frisch.gameState.seasonState.schedule ?? []) as Array<{ leagueTier?: string | null }>;
      const fixturesProLiga = new Map<string, number>();
      for (const fixture of schedule) {
        const tier = fixture.leagueTier ?? "unbekannt";
        fixturesProLiga.set(tier, (fixturesProLiga.get(tier) ?? 0) + 1);
      }
      expect(fixturesProLiga.get("liga1")).toBe(160);
      expect(fixturesProLiga.get("liga2")).toBe(160);

      // Liga-Draft (AI befüllt alle 32 Kader) — derselbe Weg wie
      // app/api/new-game/route.ts (kickoffLeagueSetupDraft), hier synchron für den Test.
      const draft = await fuehreLigaSetupDraftAus({
        persistence,
        saveId,
        seasonId: frisch.gameState.season.id,
        callerWritableTeamIds: null,
        excludeTeamIds: [],
        logPrefix: "[test-164]",
      });
      expect(draft.status).toBe("ready");
      const nachDraft = persistence.getSaveById(saveId)!;
      expect(nachDraft.gameState.rosters.length).toBeGreaterThan(0);
      persistence.saveSingleplayerState(
        saveId,
        applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
      );

      for (let index = 0; index < SPIELTAGE; index += 1) {
        const aktuell = persistence.getSaveById(saveId)!;
        const seasonId = aktuell.gameState.season.id;
        const matchdayId = aktuell.gameState.matchdayState.matchdayId;
        const lauf = await runLocalMatchdayAutoRun(
          {
            saveId,
            seasonId,
            matchdayId,
            source: "sqlite",
            execute: true,
            dryRun: false,
            confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
            options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
          },
          persistence,
        );
        expect(lauf.ok, `Auto-Run Spieltag ${index + 1} (${matchdayId}): ${lauf.blockingReasons.join(" | ")}`).toBe(true);

        const adv = await executeMatchdayAdvance(
          { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
          persistence,
        );
        expect(adv.ok && adv.applied, `Spieltagswechsel nach ${matchdayId}: ${adv.blockingReasons?.join(" | ") ?? ""}`).toBe(true);
      }

      const ende = persistence.getSaveById(saveId)!;
      const zeilen = ende.gameState.seasonState.disciplineResults ?? [];
      expect(zeilen.length).toBeGreaterThan(0);

      // KEINE Zeile mit teamPoints außerhalb {0,1,2}.
      const verletztTeamPoints = zeilen.filter((zeile) => !([0, 1, 2] as const).includes(zeile.teamPoints as 0 | 1 | 2));
      expect(verletztTeamPoints, JSON.stringify(verletztTeamPoints.slice(0, 3))).toHaveLength(0);

      // KEINE Zeile mit resolutionSource "pps" (Rangtabellen-Pfad) in einem Battle-Save.
      const rangpfadZeilen = zeilen.filter((zeile) => zeile.resolutionSource === "pps");
      expect(rangpfadZeilen, JSON.stringify(rangpfadZeilen.slice(0, 3))).toHaveLength(0);
      // ... und kein pointSource, der mit "rank_to_points" beginnt (derselbe Rangpfad, andere Spur).
      const rankToPointsZeilen = zeilen.filter((zeile) => (zeile.pointSource ?? "").startsWith("rank_to_points"));
      expect(rankToPointsZeilen, JSON.stringify(rankToPointsZeilen.slice(0, 3))).toHaveLength(0);

      // Je Fixture: Punkte-Summe genau 2, Verhältnis-Summe genau 0.
      const proFixture = new Map<string, DisciplineResultRecord[]>();
      for (const zeile of zeilen) {
        const schluessel = `${zeile.matchdayResultId}|${zeile.disciplineId}`;
        proFixture.set(schluessel, [...(proFixture.get(schluessel) ?? []), zeile]);
      }
      let gepruefteFixtures = 0;
      let fixtureFehler = 0;
      for (const gruppe of proFixture.values()) {
        const byTeam = new Map(gruppe.map((zeile) => [zeile.teamId, zeile] as const));
        for (const zeile of gruppe) {
          if (!zeile.opponentTeamId || zeile.teamId > zeile.opponentTeamId) continue;
          const gegner = byTeam.get(zeile.opponentTeamId);
          if (!gegner) continue;
          gepruefteFixtures += 1;
          const punkteSumme = (zeile.teamPoints ?? 0) + (gegner.teamPoints ?? 0);
          const verhaeltnisSumme = (zeile.verhaeltnis ?? 0) + (gegner.verhaeltnis ?? 0);
          if (punkteSumme !== 2 || verhaeltnisSumme !== 0) fixtureFehler += 1;
        }
      }
      expect(gepruefteFixtures).toBeGreaterThan(0);
      expect(fixtureFehler).toBe(0);

      // Verhältnis-Summe je Liga in der Tabelle = 0.
      const standings = ende.gameState.seasonState.standings ?? {};
      const leagueByTeamId = ende.gameState.seasonState.leagueByTeamId ?? {};
      const summeJeLiga = new Map<string, number>();
      for (const [teamId, zeile] of Object.entries(standings)) {
        const tier = leagueByTeamId[teamId] ?? "unbekannt";
        summeJeLiga.set(tier, (summeJeLiga.get(tier) ?? 0) + (zeile.verhaeltnis ?? 0));
      }
      expect(summeJeLiga.get("liga1")).toBe(0);
      expect(summeJeLiga.get("liga2")).toBe(0);
    },
    300_000,
  );
});
