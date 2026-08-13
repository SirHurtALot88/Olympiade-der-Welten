import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  buildLegacyLineupEntriesFromSelections,
  buildLegacyLineupLabPlayerOptions,
  buildLegacyLineupLabSlots,
  findDuplicateActivePlayerSelections,
} from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";

const context: LegacyLineupLoadedContext = {
  saveId: "save-1",
  seasonId: "season-1",
  matchdayId: "matchday-1",
  teamId: "A-A",
  entries: [],
  disciplinePlayerCounts: {
    tdm: 2,
    fechten: 1,
  },
  activePlayers: [
    { id: "active-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-1" },
    { id: "active-2", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-2" },
    { id: "active-3", saveId: "save-1", seasonId: "season-1", teamId: "A-A", playerId: "player-3" },
  ],
  disciplineScores: [],
  save: { id: "save-1", name: "Save 1", status: "active" },
  season: { id: "season-1", saveId: "save-1", name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
  matchday: { id: "matchday-1", seasonId: "season-1", index: 1, label: "Spieltag 1", status: "planning" },
  team: { id: "A-A", shortCode: "A-A", name: "Alpha" },
  teamSeasonState: { id: "tss-1", saveId: "save-1", seasonId: "season-1", teamId: "A-A", cash: 100, budget: 100, rosterLimit: 6, playerOpt: 6 },
  teamIdentity: { pow: 10, spe: 10, men: 10, soc: 10 },
  rosterPlayers: [
    { id: "player-1", name: "Player 1", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
    { id: "player-2", name: "Player 2", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
    { id: "player-3", name: "Player 3", coreStats: { pow: 1, spe: 1, men: 1, soc: 1 } },
  ],
  disciplines: [
    { id: "tdm", name: "TDM", category: "tactics" },
    { id: "fechten", name: "Fechten", category: "speed" },
  ],
  disciplineWeights: [],
  seasonDisciplineConfigs: [],
  existingDraft: null,
  contextMeta: {
    saveId: "save-1",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    teamId: "A-A",
    d1DisciplineId: "tdm",
    d2DisciplineId: "fechten",
  },
};

describe("legacy lineup lab helpers", () => {
  it("builds slots from the loaded context", () => {
    const slots = buildLegacyLineupLabSlots(context);

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => slot.key)).toEqual([
      "tdm::d1::0",
      "tdm::d1::1",
      "fechten::d2::0",
    ]);
  });

  it("follows the season schedule slot counts per side, not the static base playerCount", () => {
    // Bug: die Einsatzliste baute Slots aus dem statischen Basis-playerCount
    // (tdm:2, fechten:1), während Validator/Readiness/AI die saisonal gewürfelten
    // Schedule-Werte nutzen — bei 3/2 fehlten/überzählten Slots.
    const scheduleContext: LegacyLineupLoadedContext = {
      ...context,
      disciplineSidePlayerCounts: { "tdm::d1": 3, "fechten::d2": 2 },
    };
    const slots = buildLegacyLineupLabSlots(scheduleContext);
    expect(slots.filter((slot) => slot.disciplineSide === "d1")).toHaveLength(3);
    expect(slots.filter((slot) => slot.disciplineSide === "d2")).toHaveLength(2);
    expect(slots.map((slot) => slot.key)).toEqual([
      "tdm::d1::0",
      "tdm::d1::1",
      "tdm::d1::2",
      "fechten::d2::0",
      "fechten::d2::1",
    ]);
  });

  it("builds player options from active players and roster players", () => {
    const options = buildLegacyLineupLabPlayerOptions(context);

    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({
      activePlayerId: "active-1",
      playerId: "player-1",
      name: "Player 1",
      disciplineScores: {
        tdm: null,
        fechten: null,
      },
      fatigueCount: null,
      injuryStatus: "healthy",
      injuryUntilMatchday: null,
      injuryRiskPercent: null,
      injuryRiskBand: null,
      injuryRiskLabel: null,
      // NEU mit dem Fatigue-Umbau (#510): die Einsatzliste zeigt neben dem AKTUELLEN
      // Risiko auch das Risiko NACH dem geplanten Einsatz. Ohne Spielerdaten ist es
      // `null` — und genau das gehoert in die Vollstaendigkeits-Zusicherung, sonst
      // faellt eine still verschwundene Projektion hier nie auf.
      injuryRiskProjection: null,
    });
  });

  /**
   * Die Projektion ist kein Dekor: sie ist der Grund, warum ein Spieler ueberhaupt
   * geschont wird. Deshalb wird sie nicht nur als Feld gezaehlt, sondern durchgereicht.
   */
  it("reicht die Einsatz-Projektion des Verletzungsrisikos durch", () => {
    const mitProjektion = {
      ...context,
      rosterPlayers: context.rosterPlayers.map((player, index) =>
        index === 0
          ? {
              ...player,
              injuryRiskProjection: { percent: 12, band: "elevated", label: "erhöht" },
            }
          : player,
      ),
    } as typeof context;
    const options = buildLegacyLineupLabPlayerOptions(mitProjektion);
    expect(options[0]?.injuryRiskProjection).toEqual({ percent: 12, band: "elevated", label: "erhöht" });
    // Wer keine Projektion hat, bekommt keine erfunden.
    expect(options[1]?.injuryRiskProjection).toBeNull();
  });

  it("builds entry payloads from selections", () => {
    const slots = buildLegacyLineupLabSlots(context);
    const options = buildLegacyLineupLabPlayerOptions(context);
    const entries = buildLegacyLineupEntriesFromSelections({
      slots,
      playerOptions: options,
      selections: {
        "tdm::d1::0": "active-1",
        "tdm::d1::1": "active-2",
        "fechten::d2::0": "active-3",
      },
    });

    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({
      disciplineId: "tdm",
      disciplineSide: "d1",
      slotIndex: 0,
      playerId: "player-1",
      activePlayerId: "active-1",
    });
  });

  it("detects duplicate active player selections", () => {
    const duplicates = findDuplicateActivePlayerSelections({
      "tdm::d1::0": "active-1",
      "tdm::d1::1": "active-2",
      "fechten::d2::0": "active-1",
    });

    expect(duplicates).toEqual(["active-1"]);
  });

  /**
   * HIER LAG DIE GROESSTE ZEICHENKETTEN-HALDE DER SUITE: rund 180
   * `toContain`-Zusicherungen auf Markup von LegacyLineupLabClient.tsx, davon 55
   * inzwischen falsch. Sie trugen einen Namen („ai preview adoption bleibt im lokalen
   * UI-Entwurf, ohne automatisch zu speichern") und pruefte darunter alles Moegliche:
   * Arena-Reveal-Beschriftungen, Teamdeck-Sortierung, Tabellen-Voreinstellungen,
   * Expertenmodus, Drag-Preview-Texte. Das ist kein Test, das ist eine Inventarliste
   * der Oberflaeche von 2026-06 — sie faellt bei jeder Umgestaltung und sagt nie,
   * WAS kaputt ist.
   *
   * DREI GRUENDE, WARUM SIE ROT WAR (alle nachgemessen, keiner ein Fehler im Spiel):
   *  1. `Erweiterte Technikoptionen`, `Expert Modus`, `legacy-lineup-focus-switch` &
   *     Verwandte kamen mit 32683df8 („physically remove dead legacy look") weg. Der
   *     alte Look war zu dem Zeitpunkt schon unerreichbar — kein Verlust an der
   *     Oberflaeche, nur das Entfernen eines toten Zweigs.
   *  2. Der Expertenmodus wurde 2026-08-09 auf Chris' Entscheidung ausgebaut.
   *  3. Die AI-Vorschau-Bedienelemente („Vorschlag uebernehmen", „AI Vorschlag alle
   *     Teams", der Batch-Dialog) sind aus dem Markup verschwunden.
   *
   * PUNKT 3 IST EIN BEFUND, KEIN TESTPROBLEM — und er steht in
   * docs/ROTE_TESTS_TRIAGE.md als offene Frage an Chris: die Funktionen dahinter
   * (`handleAdoptAiPreview`, `handleAiPreview`, `handleAiBatchApply`,
   * `handleOpenAiBatchDetails`, `handleSaveAiPreview`) stehen weiterhin in der Datei,
   * haben aber KEINEN Aufrufer mehr. Sie sind unerreichbar. Entweder gehoert die
   * Bedienung zurueck oder der Code weg; beides ist eine Entscheidung, keine Reparatur.
   *
   * WAS HIER BLEIBT, ist der Kern, den der Name verspricht und der weiterhin lebt: der
   * Uebernahme-Pfad schreibt in den lokalen Entwurf und ruft dabei NICHT die Speicher-
   * Route. Das ist die Zusicherung, deren Bruch wehtut (eine ungewollte Speicherung
   * ueberschreibt die Aufstellung des Spielers) — und sie ist genau hier pruefbar.
   */
  it("der Uebernahme-Pfad schreibt in den lokalen Entwurf und speichert dabei nicht", async () => {
    const fileText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );

    // Uebernehmen heisst: Auswahl und Captains im lokalen Zustand setzen …
    expect(fileText).toContain("applyAiPreviewToUiDraft");
    expect(fileText).toContain("setSelections(nextDraft.selections);");
    expect(fileText).toContain("setCaptains(nextDraft.captains);");
    // … und dabei die automatische Sicherung ueberspringen.
    expect(fileText).toContain("skipNextAutoPersistRef");
    // Der Zustand wird ausdruecklich als ungespeichert gemeldet.
    expect(fileText).toContain("noch nicht gespeichert");

    // DIE NEGATIVE HAELFTE — sie ist die eigentliche Zusicherung: kein Schreibweg im
    // Uebernehmen. Ein `fetch` auf die Speicher- oder Apply-Route waere genau der
    // Fehler, gegen den dieser Test steht.
    const uebernahme = fileText.slice(
      fileText.indexOf("function applyAiPreviewToUiDraft"),
      fileText.indexOf("function handleAdoptAiPreview"),
    );
    expect(uebernahme.length, "Uebernahme-Block nicht gefunden — Marken passen nicht mehr").toBeGreaterThan(200);
    expect(uebernahme).not.toContain("fetch(");
    expect(fileText).not.toContain('fetch("/api/lineups/legacy/ai-apply"');

    // Der Referenzmodus bleibt schreibgeschuetzt — sonst schriebe ein Blick in einen
    // fremden Spielstand zurueck.
    expect(fileText).toContain('if (source === "prisma" || isReadOnly)');
  });
});
