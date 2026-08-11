/**
 * SIEBEN GESCOPTE SCHREIB-ROUTEN GABEN DIE NEUE SAVEVERSION NICHT ZURÜCK.
 *
 * GEMELDET, mit Bild: „AKTION — Training nicht gespeichert. Save-Konflikt erkannt. Stand wird neu
 * geladen." `saveSingleplayerState` zählt `saveVersion` bei JEDEM Schreiben hoch (siehe
 * `lib/persistence/persistence-service.ts`), unabhängig davon, über welche Route geschrieben wird.
 * Der Client merkt sich seine zuletzt bekannte Version aber NUR aus eigenen erfolgreichen PUTs und
 * aus vollen Loads (`noteKnownSaveVersion`, `use-foundation-persistence-actions.ts`). Sieben Routen
 * — `sponsor/choose`, `sponsor/event`, `sponsor/uebernahme`, `scouting/watchlist`,
 * `player-generator/commit`, `ai/preseason-background`, `admin/season-simulation` — schrieben den
 * Save (und zählten die Version damit hoch), gaben die neue Version in ihrer Antwort aber NICHT
 * zurück. Der nächste generische PUT (`/api/singleplayer-state`) rechnete dadurch mit der ALTEN
 * Version und bekam 409 `save_version_conflict` — für eine Änderung, die der Client selbst gerade
 * über eine dieser sieben Routen ausgelöst hatte.
 *
 * Pro Route zwei Fälle: (a) die Antwort trägt die neue Version, (b) der eigentliche Nachweis —
 * zwei aufeinanderfolgende Schreibvorgänge (erst die gescopte Route, dann ein generischer PUT mit
 * der von ihr zurückgegebenen `expectedSaveVersion`) gehen OHNE 409 durch. Echte Persistenz
 * (sqlite, `resetDatabaseForTests()`), kein Mock von `persistence-service` — sonst würde der Test
 * die reale Versions-Buchhaltung gar nicht prüfen.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import type { GameState, PlayerGeneratorDraft, SponsorUebernahmeAngebot } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { ensureSeasonSponsorOffers, getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";

// Nur der teure Mehr-Saison-Simulationskern wird gemockt (er würde sonst reale Matchdays über
// mehrere Phasen rechnen) — `createPersistenceService` bleibt ECHT, damit der Nachweis (Teil b)
// dieselbe Versions-Buchhaltung trifft wie in Produktion.
vi.mock("@/lib/admin/season-simulation-runner", () => ({
  readAdminSeasonSimulation: vi.fn(() => null),
  setAdminSeasonSimulationStatus: vi.fn(),
  startAdminSeasonSimulation: vi.fn(),
  tickAdminSeasonSimulation: vi.fn(),
}));

const AUFBAU_ZEITGRENZE_MS = 60_000;

let saveId: string;

function persistence() {
  return createPersistenceService();
}

function aktuelleVersion(): number {
  return persistence().getSaveById(saveId)!.gameState.saveVersion ?? 0;
}

function aktuellerGameState(): GameState {
  return persistence().getSaveById(saveId)!.gameState;
}

/**
 * Der eigentliche Nachweis (Teil b): baut aus dem FRISCH gelesenen Spielstand einen generischen
 * PUT-Body mit `expectedSaveVersion` auf die von der gescopten Route zurückgegebene Version — genau
 * das, was der Client nach `noteKnownSaveVersion(saveVersion)` beim nächsten Speichern schickt.
 */
async function putOhne409(erwarteteVersion: number) {
  const { PUT } = await import("@/app/api/singleplayer-state/route");
  const response = await PUT(
    new Request("http://localhost/api/singleplayer-state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saveId,
        gameState: aktuellerGameState(),
        expectedSaveVersion: erwarteteVersion,
      }),
    }),
  );
  return response;
}

beforeAll(() => {
  resetDatabaseForTests();
  saveId = persistence().bootstrapSingleplayerSave().save.saveId;

  // Der Guard (`authorizeServerRoomWrite` -> `authorizeLocalSingleplayerTeamWrite`) lehnt
  // Team-Schreibvorgänge auf KI-gesteuerten Teams ab (`local_team_not_owned_or_ai_controlled`) —
  // der Bootstrap-Seed startet alle 32 Teams auf "ai". Das erste Team wird hier einmalig auf
  // "manual" (menschlich gesteuert) umgestellt, damit die Tests unten für dieses Team schreiben
  // dürfen — dieselbe Voraussetzung, die im echten Spiel ein selbst gesteuertes Team erfüllt.
  const gameState = aktuellerGameState();
  const teamId = gameState.teams[0]!.teamId;
  persistence().saveSingleplayerState(saveId, {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamControlSettings: {
        ...(gameState.seasonState.teamControlSettings ?? {}),
        [teamId]: { ...(gameState.seasonState.teamControlSettings?.[teamId] ?? {}), teamId, controlMode: "manual" },
      },
    },
  });
}, AUFBAU_ZEITGRENZE_MS);

describe("sponsor/choose gibt saveVersion zurück", () => {
  it("die Antwort trägt die neue Version", async () => {
    const teamId = aktuellerGameState().teams[0]!.teamId;
    const preparedOffers = ensureSeasonSponsorOffers(aktuellerGameState());
    persistence().saveSingleplayerState(saveId, preparedOffers);
    const offerId = getTeamSponsorOffers(aktuellerGameState(), teamId)[0]!.offerId;

    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/sponsor/choose/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/choose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saveId, teamId, offerId, dryRun: false, source: "sqlite" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.saveVersion).toBe(vorher + 1);
    expect(body.saveVersion).toBe(aktuelleVersion());
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
    const putBody = await putResponse.json();
    expect(putBody.save.saveVersion).toBe(aktuelleVersion());
  });
});

describe("sponsor/event gibt saveVersion zurück", () => {
  const eventId = "event-open-test";

  beforeAll(() => {
    const teamId = aktuellerGameState().teams[0]!.teamId;
    persistence().saveSingleplayerState(saveId, {
      ...aktuellerGameState(),
      seasonState: {
        ...aktuellerGameState().seasonState,
        sponsorEvents: [
          {
            eventId,
            saveId,
            seasonId: aktuellerGameState().season.id,
            teamId,
            matchday: 1,
            eventType: "activation_bonus",
            sponsorName: "Acme",
            cashDelta: 4,
            status: "open",
            createdAt: "2026-06-27T00:00:00.000Z",
            message: "Bonus",
          },
        ],
      },
    });
  });

  it("die Antwort trägt die neue Version", async () => {
    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/sponsor/event/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saveId, eventId, action: "accept", dryRun: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.saveVersion).toBe(vorher + 1);
    expect(body.saveVersion).toBe(aktuelleVersion());
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
  });
});

describe("sponsor/uebernahme gibt saveVersion zurück", () => {
  const facilityId = "scouting_office";

  beforeAll(() => {
    const teamId = aktuellerGameState().teams[0]!.teamId;
    const angebot: SponsorUebernahmeAngebot = {
      teamId,
      seasonId: aktuellerGameState().season.id,
      facilityId,
      stufe: 2,
      zustandPct: 80,
      preis: 5,
      offerId: "sponsor-offer-test",
    };
    persistence().saveSingleplayerState(saveId, {
      ...aktuellerGameState(),
      seasonState: {
        ...aktuellerGameState().seasonState,
        sponsorUebernahmeAngeboteByTeamId: { [teamId]: [angebot] },
      },
    });
  });

  it("die Antwort trägt die neue Version", async () => {
    const teamId = aktuellerGameState().teams[0]!.teamId;
    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/sponsor/uebernahme/route");
    const response = await POST(
      new Request("http://localhost/api/sponsor/uebernahme", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saveId, teamId, facilityId, action: "annehmen", dryRun: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.saveVersion).toBe(vorher + 1);
    expect(body.saveVersion).toBe(aktuelleVersion());
    // Nebenbei belegt: die im Client gepatchten Felder (Kasse, Gebäude) stehen tatsächlich in der
    // Antwort — sonst könnte der Aufrufer sie gar nicht übernehmen (siehe
    // `use-foundation-shell-router-body-scope.tsx`, `handleSponsorUebernahme`).
    expect(body.summary.teamCash).not.toBeNull();
    expect(body.summary.facility?.data?.level).toBe(2);
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
  });
});

describe("scouting/watchlist gibt saveVersion zurück", () => {
  it("die Antwort trägt die neue Version", async () => {
    const teamId = aktuellerGameState().teams[0]!.teamId;
    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/scouting/watchlist/route");
    const response = await POST(
      new Request("http://localhost/api/scouting/watchlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saveId, teamId, playerId: "watchlist-test-player", action: "add", dryRun: false }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.saveVersion).toBe(vorher + 1);
    expect(body.saveVersion).toBe(aktuelleVersion());
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
  });
});

describe("player-generator/commit gibt saveVersion zurück", () => {
  function baueDraft(): PlayerGeneratorDraft {
    return {
      draftId: "player-draft-saveversion-test",
      input: {
        name: "Draft Hero SaveVersion",
        roleIntent: "allround",
        strengthTier: "strong",
        axisIntent: { pow: 4, spe: 3, men: 4, soc: 2 },
        randomness: "medium",
        preferredArchetype: "warrior",
        raceHint: null,
        classHint: null,
        traitHint: null,
        seed: "draft-seed-saveversion-test",
      },
      generated: {
        name: "Draft Hero SaveVersion",
        race: "Human",
        className: "Warrior",
        classSuggestion: { className: "Warrior", fitScore: 74.5, reasons: [], warnings: [] },
        subclasses: ["Captain"],
        traitsPositive: ["Clutch"],
        traitsNegative: ["Stur"],
        attributes: {
          power: 78,
          health: 72,
          stamina: 69,
          intelligence: 54,
          awareness: 58,
          determination: 70,
          speed: 61,
          dexterity: 60,
          charisma: 49,
          will: 57,
          spirit: 51,
          torment: 63,
        },
        axes: { pow: 73, spe: 59.7, men: 59.8, soc: 54.3 },
        disciplineRatings: { tdm: 71.2 },
        ovr: 61.7,
        pps: 71.2,
        potential: 65,
        marketValue: 12,
        salary: 3,
        marketValueStatus: "ready",
        salaryStatus: "ready",
        formulaStatus: {
          attributeSalaryModifiersStatus: "ready",
          traitSalaryFactorsStatus: "ready",
          rankMarketValueStatus: "ready",
          classFactorsStatus: "ready",
          marketValueEngineStatus: "ready",
          salaryEngineStatus: "ready_if_market_value_input_present",
          classEngineStatus: "heuristic",
          warnings: [],
        },
        diagnostics: {
          archetypeMatch: "ok",
          roleMatch: "ok",
          statSilhouette: "ok",
          engineStatus: {
            marketValueEngine: "ready",
            salaryEngine: "ready",
            classEngine: "heuristic",
            potentialEngine: "ready",
          },
          draftStatus: { ovr: "draft_preview", pps: "draft_preview" },
          saveStatus: { save: "draft_only", commit: "enabled", commitReasons: [] },
          qualityWarnings: [],
          statSpread: 29,
          flatAttributeCount: 3,
          resolvedAxisIntent: { pow: 4, spe: 3, men: 4, soc: 2 },
          axisIntentSources: { pow: "user", spe: "user", men: "user", soc: "user" },
          peakAttributes: ["power", "health", "stamina"],
          weakAttributes: ["charisma", "spirit", "will"],
          archetypeSummary: ["Archetyp Warrior: Human / Warrior / Warrior, Guardian"],
          roleSummary: ["Defensive Kernwerte muessen deutlich ueber dem Rest liegen."],
        },
      },
      warnings: [],
      validationStatus: "ready_for_review",
      createdAt: "2026-06-06T12:00:00.000Z",
      updatedAt: "2026-06-06T12:00:00.000Z",
    };
  }

  it("die Antwort trägt die neue Version", async () => {
    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/player-generator/commit/route");
    const response = await POST(
      new Request("http://localhost/api/player-generator/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saveId, draft: baueDraft(), dryRun: false, source: "sqlite" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.saveVersion).toBe(vorher + 1);
    expect(body.saveVersion).toBe(aktuelleVersion());
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
  });
});

describe("ai/preseason-background gibt saveVersion zurück", () => {
  beforeAll(() => {
    // Alle Teams auf "manual" — das ist der billige `no_ai_teams`-Skip-Pfad: statt einer
    // Marktsimulation für 32 Teams schreibt die Route nur `writeRunRecord` (plus ggf. einmalig
    // `protectManualPlayerTeams`, falls es an dem frisch umgestellten Zustand etwas normalisiert).
    // Ausreichend, um zu belegen, dass die Route ihre tatsächlich aktuelle Version zurückgibt; die
    // vollständige Kauf/Draft-Logik hat eigene Tests (z. B. `preseason-hintergrundlauf-kauffenster.test.ts`).
    const gameState = aktuellerGameState();
    const controlSettings = Object.fromEntries(
      gameState.teams.map((team) => [
        team.teamId,
        { ...(gameState.seasonState.teamControlSettings?.[team.teamId] ?? {}), teamId: team.teamId, controlMode: "manual" as const },
      ]),
    );
    persistence().saveSingleplayerState(saveId, {
      ...gameState,
      seasonState: { ...gameState.seasonState, teamControlSettings: controlSettings },
    });
  });

  it("die Antwort trägt die neue Version", async () => {
    const seasonId = aktuellerGameState().season.id;
    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/ai/preseason-background/route");
    const response = await POST(
      new Request(`http://localhost/api/ai/preseason-background?saveId=${saveId}&seasonId=${seasonId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.reason).toBe("no_ai_teams");
    // Mindestens der `writeRunRecord`-Schreibvorgang, ggf. plus ein vorgelagertes
    // `protectManualPlayerTeams` — die exakte Zahl ist Implementierungsdetail, entscheidend ist
    // NUR, dass die Antwort mit dem tatsächlich aktuell gespeicherten Stand übereinstimmt.
    expect(body.saveVersion).toBeGreaterThan(vorher);
    expect(body.saveVersion).toBe(aktuelleVersion());
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
  });
});

describe("admin/season-simulation gibt saveVersion zurück", () => {
  it("die Antwort trägt die neue Version nach einem apply-Tick", async () => {
    const { tickAdminSeasonSimulation } = await import("@/lib/admin/season-simulation-runner");
    // Nur der Simulationskern ist gemockt (siehe Kommentar oben) — der Tick schreibt trotzdem ECHT
    // über die reale Persistenz, exakt wie ein produktiver `apply`-Tick es täte, nur ohne die vielen
    // Saison-Phasen dazwischen.
    (tickAdminSeasonSimulation as unknown as Mock).mockImplementation(async () => {
      const current = persistence().getSaveById(saveId)!.gameState;
      persistence().saveSingleplayerState(saveId, { ...current, gamePhase: "season_active" });
      return {
        runId: "run-saveversion-test",
        saveId,
        requestedSeasons: 1,
        mode: "apply",
        fullChurnStress: false,
        injuriesTestMode: false,
        status: "completed",
        activePhase: "done",
        activeSeasonId: current.season.id,
        activeMatchdayId: null,
        activeTeamId: null,
        currentOperation: "fertig",
        startedAt: "2026-06-27T00:00:00.000Z",
        updatedAt: "2026-06-27T00:00:00.000Z",
        heartbeatAt: "2026-06-27T00:00:00.000Z",
        completedAt: "2026-06-27T00:00:00.000Z",
        durationMs: 1,
        progressPct: 100,
        completedUnits: 1,
        estimatedTotalUnits: 1,
        cursor: { seasonIndex: 0, phaseIndex: 0, matchdayIndex: 0 },
        reports: { directory: "test", jsonl: "test.jsonl", summary: "test.txt" },
        logs: [],
        issues: [],
      };
    });

    const vorher = aktuelleVersion();
    const { POST } = await import("@/app/api/admin/season-simulation/route");
    const response = await POST(
      new Request("http://localhost/api/admin/season-simulation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "tick", runId: "run-saveversion-test" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.saveVersion).toBe(vorher + 1);
    expect(body.saveVersion).toBe(aktuelleVersion());
  });

  it("ein generischer PUT direkt danach geht ohne 409 durch", async () => {
    const putResponse = await putOhne409(aktuelleVersion());
    expect(putResponse.status).toBe(200);
  });
});
