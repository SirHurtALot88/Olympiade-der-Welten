/**
 * FRANKYS BROWSER KENNT SEINE TEAMS — Auftragspaket 1 + 2 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md).
 *
 * BEFUND, selbst nachgeprueft: `activeOwnerId` im Foundation-Client fiel bislang IMMER auf
 * `DEFAULT_ACTIVE_OWNER_ID` ("Chris") zurueck, sobald kein Login aktiv war (Standard, siehe
 * CLAUDE.md/docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md „Entscheidungen") — auch in Frankys eigenem
 * Browser, der ueber einen Raum-Kontext (`roomContext` in der URL) laengst wusste, wer da sitzt.
 * `lib/foundation/tabs/use-foundation-page-state.ts:408` fragte den Raum-Kontext dafuer nie ab.
 *
 * Diese Suite haelt die EIGENSCHAFTEN der Behebung fest:
 * - `resolveInitialFoundationActiveOwnerId` (lib/foundation/tabs/foundation-page-module-helpers.tsx)
 *   — die Rangfolge Sitzung -> Raum-Kontext -> lokaler Speicher -> Standard.
 * - `resolveRoomParticipantActiveOwnerId` (lib/room/online-room-model.ts) — die serverseitig
 *   vergebene Sitzrolle als Quelle fuer die im Raum-Kontext mitgegebene `ownerId`.
 * - `canManageTeamId`/`selectedTeamCanManage` (use-foundation-shell-router-body-scope.tsx,
 *   Stufe 2.4) — reduziert nach dem Fix auf exakt dieselbe Regel, die der Server anwendet.
 *
 * KEIN JSDOM in diesem Projekt (vitest.config.ts: environment "node") — `window` wird deshalb
 * ueber `vi.stubGlobal` nachgebaut, dieselbe Technik wie in `tests/navigation-coalescing.test.ts`.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { Team } from "@/lib/data/olyDataTypes";
import {
  DEFAULT_ACTIVE_OWNER_ID,
  FRANKY_OWNER_ID,
  canOwnerManageTeam,
  createChrisFrankyTeamControlSetting,
} from "@/lib/foundation/team-control-settings";
import { FOUNDATION_ACTIVE_OWNER_STORAGE_KEY } from "@/lib/foundation/tabs/foundation-page-types";
import { resolveInitialFoundationActiveOwnerId } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import { resolveRoomParticipantActiveOwnerId } from "@/lib/room/online-room-model";

function makeTeam(teamId: string, humanControlled: boolean): Team {
  return {
    teamId,
    shortCode: teamId,
    name: `${teamId} Team`,
    budget: 100,
    cash: 100,
    identityId: teamId,
    humanControlled,
    rosterLimit: 12,
    logoPath: null,
  };
}

/**
 * Baut denselben `window`-Ausschnitt nach, den `readFoundationRoomContextFromLocation`
 * (lib/room/foundation-room-context-client.ts) und `readStoredFoundationActiveOwnerId`
 * (lib/foundation/tabs/foundation-page-module-helpers.tsx) tatsaechlich anfassen: `location.search`
 * und `localStorage`. Kein Mock der Funktionen selbst — die Suite ruft den echten Produktionscode.
 */
function stubBrowserWindow(input: { search?: string; storage?: Record<string, string> }) {
  const store = new Map<string, string>(Object.entries(input.storage ?? {}));
  vi.stubGlobal("window", {
    location: { search: input.search ?? "" },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
}

function franksRoomSearch(overrides: Record<string, string> = {}) {
  return new URLSearchParams({
    roomCode: "ABCD",
    participantId: "participant-franky",
    // Absichtlich EIN von "franky_remote_placeholder" verschiedener Wert: ohne Login (Standard)
    // ist `userId` ein zufaelliger `user-<uuid>`-String (room-store.ts) -- genau der Fall, den
    // `resolveRoomParticipantActiveOwnerId` statt `userId` selbst aufloest.
    userId: "user-7f2c1a9e-irgendwas-zufaelliges",
    seatToken: "seat-franky",
    saveId: "save-room-1",
    ownerId: FRANKY_OWNER_ID,
    ...overrides,
  }).toString();
}

describe("Frankys Browser kennt seine Teams", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Eigenschaft 1: mit Raum-Kontext fuer den Gast ist der aktive Besitzer NICHT der Standardwert", () => {
    stubBrowserWindow({ search: `?${franksRoomSearch()}` });

    const resolved = resolveInitialFoundationActiveOwnerId(null);

    expect(resolved).toBe(FRANKY_OWNER_ID);
    expect(resolved, "Frankys Browser haelt sich sonst weiter fuer Chris").not.toBe(DEFAULT_ACTIVE_OWNER_ID);
  });

  it("Eigenschaft 2: ein alter Wert im lokalen Speicher ueberschreibt den Raum-Wert nicht", () => {
    // DIESER Browser hat frueher schon einmal Chris' Teams verwaltet (z. B. bevor er Franky
    // beigetreten ist) -- genau der Alt-Eintrag, der den Raum-Wert nicht mehr verdraengen darf.
    stubBrowserWindow({
      search: `?${franksRoomSearch()}`,
      storage: {
        [FOUNDATION_ACTIVE_OWNER_STORAGE_KEY]: JSON.stringify({
          version: 1,
          ownerId: DEFAULT_ACTIVE_OWNER_ID,
          updatedAt: "2020-01-01T00:00:00.000Z",
        }),
      },
    });

    expect(resolveInitialFoundationActiveOwnerId(null)).toBe(FRANKY_OWNER_ID);
  });

  it("Eigenschaft 3 (Regression): Solo ohne Raum bleibt beim bisherigen Verhalten", () => {
    stubBrowserWindow({});

    // Ohne Raum-Kontext und ohne lokalen Eintrag: Standard-Owner (Chris), unveraendert.
    expect(resolveInitialFoundationActiveOwnerId(null)).toBe(DEFAULT_ACTIVE_OWNER_ID);

    // Ein vorhandener lokaler Eintrag greift weiterhin, wenn kein Raum-Kontext vorliegt.
    stubBrowserWindow({
      storage: {
        [FOUNDATION_ACTIVE_OWNER_STORAGE_KEY]: JSON.stringify({
          version: 1,
          ownerId: FRANKY_OWNER_ID,
          updatedAt: "2020-01-01T00:00:00.000Z",
        }),
      },
    });
    expect(resolveInitialFoundationActiveOwnerId(null)).toBe(FRANKY_OWNER_ID);

    // Eine aktive Sitzung (Phase-1-Login) gewinnt weiterhin gegen alles andere.
    stubBrowserWindow({ search: `?${franksRoomSearch()}` });
    expect(resolveInitialFoundationActiveOwnerId(DEFAULT_ACTIVE_OWNER_ID)).toBe(DEFAULT_ACTIVE_OWNER_ID);
  });

  it("Eigenschaft 4: canManageTeamId erlaubt fuer Franky genau die Teams, die auch der Server erlaubt", () => {
    const chrisTeam = createChrisFrankyTeamControlSetting(makeTeam("C-C", true), "chris");
    const frankyTeam = createChrisFrankyTeamControlSetting(makeTeam("F-F", true), "franky");

    // Nach Stufe 2.4 reduziert `canManageTeamId`/`selectedTeamCanManage`
    // (use-foundation-shell-router-body-scope.tsx) auf exakt `canOwnerManageTeam` -- dieselbe
    // Funktion, die der Server ueber `canLocalUserManageTeam` aufruft
    // (server-authoritative-write-guard.ts). Diese Pruefung haelt die EIGENSCHAFT fest, die der
    // React-Hook ohne Renderer nicht isoliert aufrufbar macht (siehe Eigenschaft 4b fuer die
    // Verdrahtung selbst).
    expect(canOwnerManageTeam(frankyTeam, FRANKY_OWNER_ID)).toBe(true);
    expect(canOwnerManageTeam(chrisTeam, FRANKY_OWNER_ID), "Franky durfte Chris' Team nicht verwalten").toBe(false);
    expect(canOwnerManageTeam(chrisTeam, DEFAULT_ACTIVE_OWNER_ID)).toBe(true);
    expect(canOwnerManageTeam(frankyTeam, DEFAULT_ACTIVE_OWNER_ID), "Chris durfte Frankys Team nicht verwalten").toBe(false);
  });

  it("Eigenschaft 4b (Verdrahtung): die Oberflaeche nutzt fuer canManageTeamId nur noch die Server-Regel", async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
      "utf8",
    );
    // Kommentarzeilen raus (der Befund-Kommentar dort nennt den entfernten Namen absichtlich beim
    // Namen) — geprueft wird der AUSGEFUEHRTE Code, exakt wie in tests/manager-team-picker-scope.test.ts.
    const executedSource = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");

    // Der zweite, grosszuegigere Zweig (`ownerSlot === "user"` / `displayLabel === "Chris"`,
    // unabhaengig von `effectiveActiveOwnerId`) ist komplett raus -- nicht nur umbenannt.
    expect(executedSource).not.toContain("isLocalUserManualTeam");
    expect(executedSource).toContain("canOwnerManageTeam(selectedTeamControl, effectiveActiveOwnerId)");
    expect(executedSource).toContain("canOwnerManageTeam(settings, effectiveActiveOwnerId)");
  });

  it("resolveRoomParticipantActiveOwnerId ordnet die Sitzrolle korrekt zu (host->Chris-Platzhalter, player->Franky-Platzhalter)", () => {
    expect(resolveRoomParticipantActiveOwnerId("host")).toBe(DEFAULT_ACTIVE_OWNER_ID);
    expect(resolveRoomParticipantActiveOwnerId("player")).toBe(FRANKY_OWNER_ID);
    expect(resolveRoomParticipantActiveOwnerId("spectator")).toBeNull();
  });
});
