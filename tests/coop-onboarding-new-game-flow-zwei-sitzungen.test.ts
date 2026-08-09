/**
 * KOOP-ONBOARDING MIT ZWEI SITZUNGEN AM `seasonState.newGameFlow`.
 *
 * ECHTER Raum ueber `lib/room/room-store.ts` (createRoom -> joinRoom -> beide ready ->
 * startRoom), echter Koop-Save ueber `createRoomCoopSave` (kein Mock), echte
 * `/api/singleplayer-state`-Route mit Raum-Kontext fuer beide Sitzungen — genau der Weg, den
 * die Foundation-Shell beim Abschliessen eines Einstiegsschritts geht
 * (`persistNewGameFlowStepStatus` in use-foundation-shell-router-body-scope.tsx).
 *
 * MESSBEFUND (gegen den unveraenderten Stand vor dieser Aenderung, per `git stash` nachvollzogen
 * und im Abschlussbericht dokumentiert): am gemeinsamen, EINEN `newGameFlow`-Objekt fuer den ganzen
 * Save brach konkret:
 * 1. `selectedTeamId` war "last writer wins" ueber BEIDE Sitzungen hinweg.
 * 2. Ein team-loser Schritt (`season_intro`) galt nach EINEM Abschluss faelschlich fuer BEIDE.
 * 3. Die Server-Route rechnete `isHandled` zwar aus, schrieb `active`/`dismissed` aber ohnehin
 *    hart auf `true`/`false` — der Einstiegs-Flow konnte fuer KEINEN Raum-Teilnehmer je schliessen
 *    (der generische Full-State-Write, der das bei Solo unauffaellig selbst heilt, ist fuer
 *    Raum-Saves mit 409 `room_save_generic_write_forbidden` gesperrt).
 * 4. `ai-preseason-manual-team-guard.getProtectedHumanTeamIds` liest `selectedTeamId` zwar mit,
 *    aber im 4v4-Koop-Preset stehen ALLE acht Menschen-Teams zusaetzlich ueber
 *    `team.humanControlled` UND `teamControlSettings[...].controlMode === "manual"` im
 *    Schutz-Set — das macht `selectedTeamId` dort redundant, ein Datenschaden trat NICHT ein.
 * 5. `scouting-wishlist-slots.isTeamSetupDraftWishlistPhase` ist fuer JEDEN frischen Save (Solo
 *    wie Koop) bereits durch das eigene `gamePhase !== "preseason_management"`-Gate blockiert,
 *    weil ein frischer Save mit `gamePhase: "season_active"` startet — die Draft-Wunschlisten-
 *    Grenze wird beim aktuellen Einstieg gar nicht erst wirksam. Vorbestehend, unabhaengig von
 *    Koop, hier nicht angefasst.
 *
 * Diese Suite belegt jetzt den FIX: pro-Teilnehmer-Fortschritt in
 * `newGameFlow.byParticipant[participantId]` (siehe `lib/game/new-game-flow-scope.ts` und den
 * Migrationskommentar an `NewGameFlowState.byParticipant` in `lib/data/olyDataTypes.ts`).
 */
import { describe, expect, it } from "vitest";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { createRoom, joinRoom, setParticipantReadyState, startRoom } from "@/lib/room/room-store";
import { getProtectedHumanTeamIds } from "@/lib/ai/ai-preseason-manual-team-guard";
import { resolveScopedNewGameFlow } from "@/lib/game/new-game-flow-scope";
import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import type { NewGameFlowStepId } from "@/lib/data/olyDataTypes";

/** Ein frischer Koop-Save baut ebenso wie ein Solo-Save die komplette Baseline neu auf. */
const AUFBAU_ZEITGRENZE_MS = 120_000;

function anfrage(koerper: Record<string, unknown>) {
  return new Request("http://localhost/api/singleplayer-state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

function flowSchrittBody(input: {
  saveId: string;
  stepId: NewGameFlowStepId;
  status: "completed" | "skipped";
  selectedTeamId: string | null;
  roomCode: string;
  participantId: string;
  seatToken: string;
}) {
  return {
    action: "new-game-flow-step" as const,
    saveId: input.saveId,
    stepId: input.stepId,
    status: input.status,
    selectedTeamId: input.selectedTeamId,
    roomCode: input.roomCode,
    participantId: input.participantId,
    seatToken: input.seatToken,
  };
}

async function baueRaum() {
  const persistence = createPersistenceService();
  const created = createRoom("socket-flow-a", { displayName: "Chris" });
  const joined = joinRoom(created.room.roomCode, "socket-flow-b", { displayName: "Franky" });
  if (!joined.ok) throw new Error("Franky konnte dem Raum nicht beitreten — Aufbau unbrauchbar.");

  expect(setParticipantReadyState(created.room.roomCode, created.seat.seatToken, true).ok).toBe(true);
  expect(setParticipantReadyState(created.room.roomCode, joined.seat.seatToken, true).ok).toBe(true);

  // ECHTE Persistenz (sqlite), nicht der Fake aus room-store.test.ts — nur so landet der
  // Koop-Save dort, wo die echte Route (`/api/singleplayer-state`) ihn per getSaveById findet.
  const started = startRoom(created.room.roomCode, created.seat.seatToken, { persistence });
  if (!started.ok) throw new Error(`startRoom fehlgeschlagen: ${started.error}`);

  const roomCode = started.room.roomCode;
  const saveId = started.room.state.multiplayerRoom.saveId!;
  const chris = { participantId: started.room.state.roomParticipants[0]!.participantId, seatToken: created.seat.seatToken };
  const franky = { participantId: started.room.state.roomParticipants[1]!.participantId, seatToken: joined.seat.seatToken };

  const ownership = started.room.state.teamOwnership;
  const chrisTeam = ownership.find((entry) => entry.controllerType === "human" && entry.participantId === chris.participantId)!.teamId;
  const frankyTeam = ownership.find((entry) => entry.controllerType === "human" && entry.participantId === franky.participantId)!.teamId;

  return { persistence, roomCode, saveId, chris, franky, chrisTeam, frankyTeam };
}

describe("Koop-Onboarding: zwei Sitzungen am newGameFlow (Fix: byParticipant)", () => {
  it("Ausgangszustand: EIN Save, ein einzelner geteilter newGameFlow — noch ohne byParticipant", async () => {
    const { saveId, chrisTeam } = await baueRaum();
    const save = createPersistenceService().getSaveById(saveId);
    const flow = save?.gameState.seasonState.newGameFlow;
    expect(flow?.active).toBe(true);
    expect(flow?.selectedTeamId).toBe(chrisTeam);
    expect(flow?.steps?.every((step) => step.status === "open")).toBe(true);
    expect(flow?.byParticipant).toBeUndefined();
  }, AUFBAU_ZEITGRENZE_MS);

  it("1) selectedTeamId: Frankys eigener Schritt kontaminiert NICHT mehr Chris' Sicht (und umgekehrt)", async () => {
    const { saveId, roomCode, chris, franky, chrisTeam, frankyTeam } = await baueRaum();
    const { POST } = await import("@/app/api/singleplayer-state/route");

    // Chris bestaetigt sein eigenes Team (season_intro hat noch keinen Team-Bezug im Save, aber
    // das Foundation-UI hat `selectedTeamId` zu diesem Zeitpunkt schon aus der Raum-URL geloest).
    expect(
      (
        await POST(
          anfrage(
            flowSchrittBody({
              saveId,
              stepId: "season_intro",
              status: "completed",
              selectedTeamId: chrisTeam,
              roomCode,
              participantId: chris.participantId,
              seatToken: chris.seatToken,
            }),
          ),
        )
      ).status,
    ).toBe(200);

    // Franky bestaetigt DANACH sein eigenes Team fuer seinen eigenen Schritt — ein voellig
    // legitimer Schreibzugriff auf sein EIGENES Team, den der Ownership-Guard erlaubt.
    expect(
      (
        await POST(
          anfrage(
            flowSchrittBody({
              saveId,
              stepId: "roster_review",
              status: "completed",
              selectedTeamId: frankyTeam,
              roomCode,
              participantId: franky.participantId,
              seatToken: franky.seatToken,
            }),
          ),
        )
      ).status,
    ).toBe(200);

    const save = createPersistenceService().getSaveById(saveId)!;
    const flow = save.gameState.seasonState.newGameFlow;

    // BELEG DES FIXES: jeder liest seinen EIGENEN Bucket, keiner ueberschreibt den anderen.
    expect(resolveScopedNewGameFlow(flow, chris.participantId)?.selectedTeamId).toBe(chrisTeam);
    expect(resolveScopedNewGameFlow(flow, franky.participantId)?.selectedTeamId).toBe(frankyTeam);

    // Das TOP-LEVEL-Feld (Alt-Save-Fallback) bleibt auf seinem Anfangszustand eingefroren — es
    // wird fuer einen Raum-Save nicht mehr angefasst, kein Feld wird doppelt gepflegt.
    expect(flow?.selectedTeamId).toBe(chrisTeam);
  }, AUFBAU_ZEITGRENZE_MS);

  it("2) ein team-loser Schritt (season_intro) gilt nicht mehr faelschlich fuer den anderen Teilnehmer", async () => {
    const { saveId, roomCode, chris, franky, chrisTeam } = await baueRaum();
    const { POST } = await import("@/app/api/singleplayer-state/route");

    expect(
      (
        await POST(
          anfrage(
            flowSchrittBody({
              saveId,
              stepId: "season_intro",
              status: "completed",
              selectedTeamId: chrisTeam,
              roomCode,
              participantId: chris.participantId,
              seatToken: chris.seatToken,
            }),
          ),
        )
      ).status,
    ).toBe(200);

    const save = createPersistenceService().getSaveById(saveId)!;
    const flow = save.gameState.seasonState.newGameFlow;

    const chrisSeasonIntro = resolveScopedNewGameFlow(flow, chris.participantId)?.steps?.find((step) => step.stepId === "season_intro");
    const frankySeasonIntro = resolveScopedNewGameFlow(flow, franky.participantId)?.steps?.find((step) => step.stepId === "season_intro");
    expect(chrisSeasonIntro?.status).toBe("completed");
    // BELEG DES FIXES: Franky hat das Intro-Briefing nie gesehen/weggeklickt — sein eigener Status
    // bleibt "open", `shouldSuppressSeasonBriefingReopen()` wuerde es ihm also weiterhin zeigen.
    expect(frankySeasonIntro?.status ?? "open").toBe("open");
  }, AUFBAU_ZEITGRENZE_MS);

  it("3) active/dismissed schliessen jetzt PRO Teilnehmer — Franky bleibt aktiv, obwohl Chris fertig ist", async () => {
    const { saveId, roomCode, chris, franky, chrisTeam } = await baueRaum();
    const { POST } = await import("@/app/api/singleplayer-state/route");

    const alleSchritte: NewGameFlowStepId[] = [
      "season_intro",
      "team_confirm",
      "roster_review",
      "appoint_captain",
      "first_transfers",
      "fill_roster",
      "training_facilities",
      "set_lineup",
    ];
    for (const stepId of alleSchritte) {
      const antwort = await POST(
        anfrage(
          flowSchrittBody({
            saveId,
            stepId,
            status: "completed",
            selectedTeamId: chrisTeam,
            roomCode,
            participantId: chris.participantId,
            seatToken: chris.seatToken,
          }),
        ),
      );
      expect(antwort.status, `Chris' Abschluss von ${stepId} wurde abgewiesen`).toBe(200);
    }

    const save = createPersistenceService().getSaveById(saveId)!;
    const flow = save.gameState.seasonState.newGameFlow;

    const chrisFlow = resolveScopedNewGameFlow(flow, chris.participantId);
    expect(chrisFlow?.active).toBe(false);
    expect(chrisFlow?.dismissed).toBe(true);
    expect(chrisFlow?.completedAt).toBeTruthy();

    // BELEG DES FIXES: Franky hat noch KEINEN einzigen Schritt gemacht — sein eigener Flow bleibt
    // aktiv (Fallback auf das Top-Level-Objekt, das fuer ihn noch nie ueberschrieben wurde).
    const frankyFlow = resolveScopedNewGameFlow(flow, franky.participantId);
    expect(frankyFlow?.active).toBe(true);
    expect(frankyFlow?.dismissed).not.toBe(true);
  }, AUFBAU_ZEITGRENZE_MS);

  it("4) ai-preseason-manual-team-guard: beide Teams bleiben unabhaengig vom Flow-Zustand geschuetzt", async () => {
    const { saveId, roomCode, franky, chrisTeam, frankyTeam } = await baueRaum();
    const { POST } = await import("@/app/api/singleplayer-state/route");

    expect(
      (
        await POST(
          anfrage(
            flowSchrittBody({
              saveId,
              stepId: "roster_review",
              status: "completed",
              selectedTeamId: frankyTeam,
              roomCode,
              participantId: franky.participantId,
              seatToken: franky.seatToken,
            }),
          ),
        )
      ).status,
    ).toBe(200);

    const save = createPersistenceService().getSaveById(saveId)!;
    // Bewusst NICHT ueber `resolveScopedNewGameFlow` geprueft: `getProtectedHumanTeamIds` liest
    // weiterhin nur das TOP-LEVEL-`selectedTeamId` (unveraendert, siehe Bericht) — das ist hier in
    // Ordnung, weil `humanControlled`/`teamControlSettings` fuer BEIDE Teams unabhaengig davon
    // schuetzen (Redundanz, siehe Messbefund #4).
    const protectedTeamIds = getProtectedHumanTeamIds(save.gameState);
    expect(protectedTeamIds.has(chrisTeam)).toBe(true);
    expect(protectedTeamIds.has(frankyTeam)).toBe(true);
  }, AUFBAU_ZEITGRENZE_MS);

  it("5) Solo (kein Raum-Kontext) bleibt exakt beim alten Verhalten — byParticipant bleibt leer", async () => {
    resetDatabaseForTests();
    const persistence = createPersistenceService();
    // ECHTER Solo-"Neues Spiel"-Pfad (wie der Wizard, `applyNewGameSetup`) statt des blanken
    // `createFreshSeasonOneSave`-Test-Seeds — der hat noch KEIN Team auf "manual" gesetzt (alle
    // 32 Teams sind dort AI), das waere fuer eine Solo-Regression kein brauchbarer Aufbau.
    const soloSaveId = `solo-regression-${Date.now()}`;
    const prepared = buildNewGameStateFromBaseline({ presetId: "solo_1", saveId: soloSaveId });
    persistence.createFreshSeasonOneSave({ saveId: soloSaveId, name: "Solo-Regression" });
    persistence.saveSingleplayerState(soloSaveId, prepared.gameState);
    const soloSave = persistence.getSaveById(soloSaveId)!;
    const soloTeamId = soloSave.gameState.teams.find((team) => team.humanControlled)?.teamId;
    expect(soloTeamId, "Solo-Save ohne menschlich gesteuertes Team — Aufbau unbrauchbar.").toBeTruthy();
    const { POST } = await import("@/app/api/singleplayer-state/route");

    const antwort = await POST(
      anfrage({
        action: "new-game-flow-step",
        saveId: soloSave.saveId,
        stepId: "season_intro",
        status: "completed",
        selectedTeamId: soloTeamId,
        // Bewusst KEIN roomCode/participantId/seatToken — Solo hat keinen Raum-Kontext.
      }),
    );
    expect(antwort.status).toBe(200);

    const save = persistence.getSaveById(soloSave.saveId)!;
    const flow = save.gameState.seasonState.newGameFlow;
    // Exakt das alte (bekannt "grosszuegige") Solo-Verhalten: `active`/`dismissed` bleiben hart
    // `true`/`false`, unabhaengig von `isHandled` — der naechste generische Full-State-Write (fuer
    // Solo nicht gesperrt) korrigiert das aus dem lokal korrekt berechneten Client-Zustand.
    expect(flow?.active).toBe(true);
    expect(flow?.dismissed).toBe(false);
    expect(flow?.selectedTeamId).toBe(soloTeamId);
    expect(flow?.steps?.find((step) => step.stepId === "season_intro")?.status).toBe("completed");
    // Kein Koop-Feld wird fuer Solo je befuellt.
    expect(flow?.byParticipant).toBeUndefined();
  }, AUFBAU_ZEITGRENZE_MS);
});
