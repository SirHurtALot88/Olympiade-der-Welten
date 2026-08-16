/**
 * BEFUND B3 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md), Regression aus Stufe 0.3.
 *
 * `lib/auth/session.ts:86` (`resolveAuthoritativeWriteOwnerId`) liefert mit aktivem Login
 * (`OLY_AUTH_ENABLED=1`) fuer Franky seine echte Sitzungs-ID (`franky_remote_placeholder`,
 * `FRANKY_OWNER_ID`). Solo-Saves legen ihre Teams aber IMMER auf den generischen Standard-Platz
 * `DEFAULT_ACTIVE_OWNER_ID` — unabhaengig davon, wer den Save angelegt hat
 * (`lib/game/new-game-setup-service.ts`: jedes Solo-Preset schreibt `chrisTeamIds`, nie eine
 * sitzungsabhaengige Zuordnung). Franky war damit selbst aus seinem EIGENEN Solo-Save
 * ausgesperrt: jeder team-bezogene Schreibvorgang endete mit 403
 * (`local_team_not_owned_or_ai_controlled`), auch wenn er ihn selbst angelegt hatte.
 *
 * Diese Suite mockt NUR `resolveAuthoritativeWriteOwnerId` — dieselbe Stelle, an der eine echte
 * Session in Produktion die Identitaet liefert (die Route selbst importiert nichts anderes aus
 * `lib/auth/session.ts` fuer diesen Zweck). Alles andere laeuft ueber die echte Route und den
 * echten Guard (`lib/room/server-authoritative-write-guard.ts`), kein Guard-Mock.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ACTIVE_OWNER_ID,
  FRANKY_OWNER_ID,
  createChrisFrankyTeamControlSetting,
} from "@/lib/foundation/team-control-settings";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { erstelleCoopRaum, schreibKontext } from "@/tests/_helpers/coop-room-harness";

const resolveAuthoritativeWriteOwnerId = vi.fn(async (): Promise<string> => DEFAULT_ACTIVE_OWNER_ID);
vi.mock("@/lib/auth/session", () => ({ resolveAuthoritativeWriteOwnerId }));

function anfrage(pfad: string, koerper: Record<string, unknown>) {
  return new Request(`http://localhost/api/${pfad}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(koerper),
  });
}

/**
 * Baut einen Solo-Save, den FRANKY angelegt hat (`createdBy` traegt seine ownerId, exakt wie
 * `app/api/new-game/route.ts` es fuer eine echte Anlage durch ihn taete) — dessen Team aber, wie
 * bei JEDEM Solo-Preset, auf dem generischen Standard-Platz `DEFAULT_ACTIVE_OWNER_ID` sitzt.
 */
function baueEigenenSoloSaveVonFranky(name: string) {
  const persistence = createPersistenceService();
  const angelegt = persistence.createFreshSeasonOneSave({ name, ownerId: FRANKY_OWNER_ID });
  const team = angelegt.gameState.teams[0]!;
  const nextControlSettings = {
    ...angelegt.gameState.seasonState.teamControlSettings,
    [team.teamId]: createChrisFrankyTeamControlSetting(team, "chris"),
  };
  const gespeichert = persistence.saveSingleplayerState(angelegt.saveId, {
    ...angelegt.gameState,
    seasonState: { ...angelegt.gameState.seasonState, teamControlSettings: nextControlSettings },
  });
  return { saveId: gespeichert.saveId, teamId: team.teamId };
}

describe("Franky in seinem eigenen Solo-Save (Befund B3)", () => {
  beforeEach(() => {
    resetDatabaseForTests();
    resolveAuthoritativeWriteOwnerId.mockReset();
    resolveAuthoritativeWriteOwnerId.mockResolvedValue(DEFAULT_ACTIVE_OWNER_ID);
  });

  it("darf mit aktivem Login sein EIGENES Solo-Team bespielen, obwohl dessen Ownership-Slot der generische Standard ist", async () => {
    const { saveId, teamId } = baueEigenenSoloSaveVonFranky("Frankys Solo-Save");

    // Franky ist eingeloggt -- `resolveAuthoritativeWriteOwnerId` liefert seine ownerId, exakt
    // wie bei OLY_AUTH_ENABLED=1.
    resolveAuthoritativeWriteOwnerId.mockResolvedValue(FRANKY_OWNER_ID);

    const { POST } = await import("@/app/api/team-settings/control/route");
    const antwort = await POST(
      anfrage("team-settings/control", {
        saveId,
        teamId,
        control: { notes: "Frankys eigene Notiz" },
      }),
    );

    expect(antwort.status, "Franky durfte in seinem eigenen Solo-Save nicht schreiben").toBe(200);
    const body = await antwort.json();
    expect(body.success).toBe(true);
  });

  it("Gegenprobe: ein FREMDER Solo-Save (von Chris angelegt) bleibt fuer Franky gesperrt", async () => {
    // Derselbe Aufbau, aber OHNE Frankys ownerId beim Anlegen -- created_by bleibt der Standard
    // (DEFAULT_ACTIVE_OWNER_ID/"Chris", siehe resolveCreatingOwnerId in save-repository.ts).
    const persistence = createPersistenceService();
    const angelegt = persistence.createFreshSeasonOneSave({ name: "Chris' Solo-Save" });
    const team = angelegt.gameState.teams[0]!;
    const gespeichert = persistence.saveSingleplayerState(angelegt.saveId, {
      ...angelegt.gameState,
      seasonState: {
        ...angelegt.gameState.seasonState,
        teamControlSettings: {
          ...angelegt.gameState.seasonState.teamControlSettings,
          [team.teamId]: createChrisFrankyTeamControlSetting(team, "chris"),
        },
      },
    });

    resolveAuthoritativeWriteOwnerId.mockResolvedValue(FRANKY_OWNER_ID);

    const { POST } = await import("@/app/api/team-settings/control/route");
    const antwort = await POST(
      anfrage("team-settings/control", {
        saveId: gespeichert.saveId,
        teamId: team.teamId,
        control: { notes: "Franky versucht es trotzdem" },
      }),
    );

    expect(antwort.status, "ein fremder Solo-Save (nicht von Franky angelegt) darf nicht aufgehen").toBe(403);
  });

  it("bleibt bei Frankys Zugriff auf Chris' Raum-Team gesperrt, auch mit aktivem Login (Sitz-Token entscheidet, nicht die Sitzung)", async () => {
    const persistence = createPersistenceService();
    const saveId = persistence.createFreshSeasonOneSave({ name: "Koop-Raum-Save" }).saveId;
    const raum = erstelleCoopRaum(saveId);

    // Franky ist eingeloggt -- im Raum entscheidet trotzdem ausschliesslich das Sitz-Token
    // (siehe Kommentar an `activeOwnerId`, server-authoritative-write-guard.ts): dieser Fix
    // aendert NICHTS am Raum-Pfad, nur am raumlosen Solo-Pfad.
    resolveAuthoritativeWriteOwnerId.mockResolvedValue(FRANKY_OWNER_ID);

    const { POST } = await import("@/app/api/contracts/dissolution/route");
    const antwort = await POST(
      anfrage("contracts/dissolution", {
        saveId: raum.saveId,
        seasonId: "season-1",
        teamId: raum.chrisTeam,
        playerId: "spieler-existiert-nicht",
        decision: "declined",
        ...schreibKontext(raum, raum.franky),
      }),
    );

    expect(antwort.status, "Frankys Sitz-Token auf Chris' Raum-Team darf trotz aktivem Login nicht aufgehen").toBe(403);
  }, 120_000);
});
