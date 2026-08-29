/**
 * BATTLE-MODUS, TEIL 3: DAS NEUE SPIEL UND DER WEG DURCH DIE PERSISTENZ.
 *
 * Zwei Fragen, und die zweite ist die wichtigere:
 *
 *  1. Baut ein Battle-Neuspiel wirklich, was Chris beschrieben hat? 16 Teams, 20 Spieltage, 160
 *     echte Begegnungen, jede Disziplin zweimal.
 *  2. UEBERLEBT `playMode` das Speichern und Laden? Das ist der stille Totalschaden, wenn es
 *     schiefgeht: faellt die Spielart beim Kaltladen weg, haelt `withNormalizedSeasonDisciplineSchedule`
 *     den Save fuer einen Management-Save und kuerzt seinen Spielplan beim naechsten Schreiben von
 *     20 auf 10 Spieltage. Ohne Fehlermeldung, ohne Rueckweg.
 *
 * Und ueber allem: der MANAGEMENT-Modus muss unangetastet bleiben. Er ist der Modus, in dem der
 * Live-Spielstand laeuft.
 */
import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { readSliceGameStateForSave } from "@/lib/persistence/save-repository";
import { buildNewGameStateFromBaseline, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { createFreshSeasonOneGameState } from "@/lib/game-state/singleplayer-state";
import {
  BATTLE_MODE_SPIELTAG_ANZAHL,
  BATTLE_MODE_TEAM_ANZAHL,
  paarSchluessel,
  waehleBattleModeTeamIds,
} from "@/lib/season/battle-mode-spielplan";
import { loadSourceTeams } from "@/lib/data/dataAdapter";

const JETZT = "2026-01-01T00:00:00.000Z";

describe("Battle-Neuspiel ueber den echten Service", () => {
  const battle = buildNewGameStateFromBaseline({
    presetId: "solo_1",
    playMode: "battle",
    saveId: "test-battle-neuspiel",
    now: JETZT,
  });

  it("stellt 16 Teams auf — die Platzhalter-Auswahl, nicht die 32er-Liga", () => {
    expect(battle.gameState.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    expect(battle.gameState.teams.map((team) => team.teamId).sort()).toEqual(
      waehleBattleModeTeamIds(loadSourceTeams()).sort(),
    );
  });

  it("traegt playMode: „battle\" im Zustand und in der Vorschau", () => {
    expect(battle.gameState.playMode).toBe("battle");
    expect(battle.preview.playMode).toBe("battle");
  });

  it("hat 20 Spieltage mit je zwei Disziplinen, jede Disziplin genau zweimal", () => {
    expect(battle.gameState.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    const schedule = battle.gameState.seasonState.disciplineSchedule ?? [];
    expect(schedule).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    const zaehler = new Map<string, number>();
    const kombinationen = new Set<string>();
    for (const entry of schedule) {
      const ids = [entry.discipline1?.disciplineId, entry.discipline2?.disciplineId].filter(
        (id): id is string => typeof id === "string",
      );
      expect(ids, entry.matchdayId).toHaveLength(2);
      for (const id of ids) zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
      kombinationen.add([...ids].sort().join("|"));
    }
    expect([...new Set(zaehler.values())]).toEqual([2]);
    expect(kombinationen.size).toBe(BATTLE_MODE_SPIELTAG_ANZAHL);
  });

  it("legt 160 echte Begegnungen in seasonState.schedule — jedes Team in genau 20", () => {
    const fixtures = battle.gameState.seasonState.schedule;
    expect(fixtures).toHaveLength(160);
    const einsaetze = new Map<string, number>();
    for (const fixture of fixtures) {
      einsaetze.set(fixture.homeTeamId, (einsaetze.get(fixture.homeTeamId) ?? 0) + 1);
      einsaetze.set(fixture.awayTeamId, (einsaetze.get(fixture.awayTeamId) ?? 0) + 1);
    }
    expect(einsaetze.size).toBe(BATTLE_MODE_TEAM_ANZAHL);
    expect([...new Set(einsaetze.values())]).toEqual([BATTLE_MODE_SPIELTAG_ANZAHL]);

    const pflicht = fixtures.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) <= 15);
    expect(new Set(pflicht.map((fixture) => paarSchluessel(fixture.homeTeamId, fixture.awayTeamId))).size).toBe(120);
  });

  it("meldet keine Startrang-Fehlalarme — die 32er-Referenzpruefung ist hier abgeschaltet", () => {
    expect(battle.preview.warnings).toEqual([]);
    expect(battle.preview.blockers).toEqual([]);
    expect(battle.preview.counts.total).toBe(BATTLE_MODE_TEAM_ANZAHL);
    expect(battle.preview.seasonSetup.matchdayCount).toBe(BATTLE_MODE_SPIELTAG_ANZAHL);
  });

  it("gibt jedem Team einen Startplatz aus 1..16 — die Standings kennen keine 32 mehr", () => {
    const raenge = Object.values(battle.gameState.seasonState.standings ?? {}).map((eintrag) => eintrag.startplatz);
    expect(raenge.sort((links, rechts) => (links ?? 0) - (rechts ?? 0))).toEqual(
      Array.from({ length: BATTLE_MODE_TEAM_ANZAHL }, (_, index) => index + 1),
    );
  });

  it("lost die Zusatzrunden JE SPIELSTAND aus, die Pflichtrunden aber fuer alle gleich", () => {
    const anderer = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      playMode: "battle",
      saveId: "test-battle-neuspiel-zwei",
      now: JETZT,
    });
    const pflicht = (gameState: typeof battle.gameState) =>
      gameState.seasonState.schedule.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) <= 15);
    const zusatz = (gameState: typeof battle.gameState) =>
      gameState.seasonState.schedule.filter((fixture) => Number(fixture.matchdayId.split("-")[1]) > 15);
    // Die Pflichtrunde ist reine Kombinatorik ueber die Teamliste — sie DARF nicht am Save haengen.
    expect(pflicht(anderer.gameState)).toEqual(pflicht(battle.gameState));
    // Der ausgeloste Teil dagegen schon, sonst startete jeder Battle-Spielstand identisch.
    expect(zusatz(anderer.gameState)).not.toEqual(zusatz(battle.gameState));
  });

  it("liefert ein anderes Bestaetigungs-Token als ein Management-Neuspiel", () => {
    const management = previewNewGameSetup({ presetId: "solo_1", saveId: "test-battle-neuspiel", now: JETZT });
    expect(battle.preview.confirmToken).not.toBe(management.confirmToken);
    expect(battle.preview.confirmToken).toContain(":battle:");
  });
});

describe("playMode ueberlebt Speichern und Laden", () => {
  const persistence = createPersistenceService();

  function legeAn(saveId: string, playMode: "management" | "battle") {
    const vorbereitet = buildNewGameStateFromBaseline({
      presetId: "solo_1",
      ...(playMode === "battle" ? { playMode } : {}),
      saveId,
      now: JETZT,
    });
    const angelegt = persistence.createFreshSeasonOneSave({ saveId, name: `Test ${playMode}` });
    persistence.saveSingleplayerState(angelegt.saveId, vorbereitet.gameState);
    return vorbereitet;
  }

  it("kommt beim Vollladen als „battle\" zurueck, mit 20 Spieltagen und 160 Begegnungen", () => {
    legeAn("battle-persist-1", "battle");
    const geladen = persistence.getSaveById("battle-persist-1");
    expect(geladen).not.toBeNull();
    expect(geladen!.gameState.playMode).toBe("battle");
    expect(geladen!.gameState.teams).toHaveLength(BATTLE_MODE_TEAM_ANZAHL);
    expect(geladen!.gameState.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(geladen!.gameState.seasonState.disciplineSchedule).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(geladen!.gameState.seasonState.schedule).toHaveLength(160);
  });

  it("kommt auch ueber den leichten Slice-Ladeweg als „battle\" zurueck", () => {
    legeAn("battle-persist-2", "battle");
    const slice = readSliceGameStateForSave("battle-persist-2");
    expect(slice?.playMode).toBe("battle");
    expect(slice?.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
  });

  it("verliert die 20 Spieltage auch nach mehrfachem Speichern nicht", () => {
    // GENAU DER FALL, den die Normalisierung beim Schreiben verursachen wuerde, wenn sie die
    // Spielart nicht kennt: erst waeren es 20 Spieltage, nach dem zweiten Schreiben nur noch 10.
    legeAn("battle-persist-3", "battle");
    for (let runde = 0; runde < 3; runde += 1) {
      const zwischenstand = persistence.getSaveById("battle-persist-3")!;
      persistence.saveSingleplayerState("battle-persist-3", zwischenstand.gameState);
    }
    const geladen = persistence.getSaveById("battle-persist-3")!;
    expect(geladen.gameState.playMode).toBe("battle");
    expect(geladen.gameState.season.matchdayIds).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
    expect(geladen.gameState.seasonState.disciplineSchedule).toHaveLength(BATTLE_MODE_SPIELTAG_ANZAHL);
  });

  it("laesst einen Management-Save ohne das Feld — und mit seinen 10 Spieltagen und 32 Teams", () => {
    legeAn("management-persist-1", "management");
    const geladen = persistence.getSaveById("management-persist-1")!;
    expect(geladen.gameState.playMode).toBeUndefined();
    expect(geladen.gameState.teams).toHaveLength(32);
    expect(geladen.gameState.season.matchdayIds).toHaveLength(10);
    expect(geladen.gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(readSliceGameStateForSave("management-persist-1")?.playMode).toBeUndefined();
  });
});

describe("MANAGEMENT-REGRESSION: das Neuspiel ohne playMode ist unveraendert", () => {
  const ohneFeld = buildNewGameStateFromBaseline({ presetId: "solo_1", saveId: "regression", now: JETZT });
  const mitManagement = buildNewGameStateFromBaseline({
    presetId: "solo_1",
    playMode: "management",
    saveId: "regression",
    now: JETZT,
  });

  it("traegt das Feld GAR NICHT — nicht `\"management\"`, sondern nichts", () => {
    // Wichtiger Unterschied: ein gesetztes `playMode: "management"` waere ein zusaetzliches Feld
    // in jedem Save, jeder Signatur und jedem Vergleich. „Fehlt = Management" heisst, dass ein
    // bestehender Spielstand sich buchstaeblich nicht aendert.
    expect(ohneFeld.gameState.playMode).toBeUndefined();
    expect("playMode" in ohneFeld.gameState).toBe(false);
    expect(mitManagement.gameState.playMode).toBeUndefined();
  });

  it("ist mit und ohne ausdrueckliches „management\" bis aufs Zeichen derselbe Zustand", () => {
    /**
     * ZEITSTEMPEL RAUS, SONST MISST DIESER TEST DIE UHR.
     *
     * Ein frisch gebauter Neuspiel-Zustand traegt an vier Stellen die AKTUELLE Zeit — die
     * Log-Id (`log-new-game-${Date.now()}`), `mappingReport.generatedAt`, `generatedAt` der
     * Konjunktur-Reihe und `computedAt` an jeder Player-Baseline. Zwei Aufrufe hintereinander
     * unterscheiden sich darin IMMER, auch bei voellig identischer Eingabe (nachgemessen). Nach
     * dem Maskieren bleibt genau das uebrig, was der Code entscheidet.
     *
     * `playerBaselines` bleibt ganz draussen und nicht nur maskiert: die Baseline-PRUEFSUMME wird
     * ueber den Datensatz INKLUSIVE seiner Zeitstempel gebildet, sie ist damit in zwei Aufrufen
     * garantiert verschieden (nachgemessen — auch bei buchstaeblich identischer Eingabe). Statt
     * ihres Inhalts wird ihre Laenge geprueft; ihr Inhalt haengt ohnehin an keiner Spielart.
     */
    const vergleichbar = (gameState: typeof ohneFeld.gameState) => {
      const rest = { ...gameState, playerBaselines: undefined };
      return JSON.stringify(rest)
        .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<zeitstempel>")
        .replace(/log-new-game-\d+/g, "log-new-game-<zeitstempel>");
    };
    expect(vergleichbar(mitManagement.gameState)).toBe(vergleichbar(ohneFeld.gameState));
    expect(mitManagement.gameState.playerBaselines).toHaveLength(ohneFeld.gameState.playerBaselines?.length ?? 0);
    expect(mitManagement.preview.confirmToken).toBe(ohneFeld.preview.confirmToken);
  });

  it("hat weiterhin 32 Teams, 10 Spieltage und die zwei vestigialen Seed-Fixtures", () => {
    expect(ohneFeld.gameState.teams).toHaveLength(32);
    expect(ohneFeld.gameState.season.matchdayIds).toEqual(
      Array.from({ length: 10 }, (_, index) => `matchday-${index + 1}`),
    );
    expect(ohneFeld.gameState.seasonState.disciplineSchedule).toHaveLength(10);
    expect(ohneFeld.gameState.seasonState.schedule.map((fixture) => fixture.id)).toEqual(["fixture-1", "fixture-2"]);
  });

  it("behaelt die Startrang-Referenzpruefung (M-M auf 1, R-R auf 32) — sie soll ja anschlagen koennen", () => {
    expect(ohneFeld.preview.warnings).toEqual([]);
    expect(ohneFeld.preview.confirmToken).toContain("M-M:1|R-R:32");
  });

  it("liefert denselben frischen Saison-1-Zustand wie der direkte Weg ohne Optionen", () => {
    const direkt = createFreshSeasonOneGameState("regression");
    const mitLeererOption = createFreshSeasonOneGameState("regression", {});
    expect(JSON.stringify(mitLeererOption.season)).toBe(JSON.stringify(direkt.season));
    expect(JSON.stringify(mitLeererOption.seasonState.disciplineSchedule)).toBe(
      JSON.stringify(direkt.seasonState.disciplineSchedule),
    );
    expect(mitLeererOption.teams).toHaveLength(32);
    expect(direkt.playMode).toBeUndefined();
  });
});
