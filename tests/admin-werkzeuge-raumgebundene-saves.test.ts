/**
 * ADMIN-/KI-/SIMULATIONSWERKZEUGE AUF EINEM RAUMGEBUNDENEN SAVE — HARTE ABLEHNUNG.
 *
 * Coop-Absicherungsplan (`docs/design/coop-absicherung.md`), Risiko R4: fuenf Routen
 * (`admin/season-simulation`, `singleplayer-state/season-start-reset`, `ai/picks-import`,
 * `ai/picks-audit-reset`, `season/season-snapshot`) schreiben Spielstaende ueber lokale Services
 * DIREKT, am Team-Autorisierungs-Guard `authorizeServerRoomWrite` vorbei — sie kennen kein
 * `teamId`, sondern ersetzen Saison-/Save-Zustaende auf einen Schlag. Der gemeldete Unfall: ein
 * Klick auf "Saison simulieren" schob den Stand auf Saisonende, waehrend der Mitspieler noch
 * Spieltag 3 sah.
 *
 * Diese Suite prueft `assertSaveNotRoomBound` (`lib/room/assert-save-not-room-bound.ts`) an genau
 * der Stelle, an der ihn jede der fuenf Routen jetzt aufruft — mit einem ECHTEN Raum und zwei
 * echten SQLite-Test-Saves, ohne irgendetwas zu mocken. Pro Route drei Zusicherungen:
 *
 * 1. Raumgebundener Save + Schreibmodus (apply/execute/dryRun=false) -> 409 mit dem erwarteten,
 *    werkzeugspezifischen `reason`.
 * 2. GEGENPROBE: derselbe Schreibmodus auf einem Save OHNE aktiven Raum -> NICHT durch unseren
 *    Guard blockiert (kein `admin_write_blocked_room_bound_save:*`-Reason). Ohne diese Probe waere
 *    ein Guard, der das Werkzeug generell sperrt, faelschlich gruen.
 * 2b. GEGENPROBE: raumgebundener Save im Dry-Run/Preview-Modus -> ebenfalls nicht blockiert, sonst
 *    koennte im Koop-Raum niemand mehr eine Vorschau sehen.
 *
 * Die Gegenproben pruefen bewusst NICHT, dass der zugrundeliegende Fachvorgang gelingt (das ist
 * Sache der jeweiligen Service-Tests) — nur, dass unser neuer Guard nicht dazwischenfunkt.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { AI_PICK_AUDIT_RESET_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-audit-reset-contract";
import { AI_PICK_IMPORT_CONFIRM_TOKEN } from "@/lib/ai/ai-pick-import-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { SEASON_SNAPSHOT_CONFIRM_TOKEN } from "@/lib/season/season-snapshot-service";
import { erstelleCoopRaum, type CoopRaum } from "@/tests/_helpers/coop-room-harness";

const AUFBAU_ZEITGRENZE_MS = 180_000;

/** Der Marker, den `assertSaveNotRoomBound` in JEDE Ablehnung schreibt — werkzeugspezifisch per Suffix. */
const BLOCKED_MARKER = "admin_write_blocked_room_bound_save";

function seasonIdVon(saveId: string): string {
  const save = createPersistenceService().getSaveById(saveId);
  if (!save) throw new Error(`Save ${saveId} nicht gefunden — Aufbau unbrauchbar.`);
  return save.gameState.season.id;
}

describe("Admin-/KI-/Simulationswerkzeuge auf raumgebundenen Saves", () => {
  let raum: CoopRaum;
  /** Ein zweiter, echter Save OHNE jeden Raum — die Gegenprobe braucht ihn. */
  let freierSaveId: string;

  beforeAll(() => {
    resetDatabaseForTests();
    const raumSaveId = createPersistenceService().createFreshSeasonOneSave({ name: "Admin-Guard-Raum" }).saveId;
    raum = erstelleCoopRaum(raumSaveId);
    freierSaveId = createPersistenceService().createFreshSeasonOneSave({ name: "Admin-Guard-Frei" }).saveId;
  }, AUFBAU_ZEITGRENZE_MS);

  describe("admin/season-simulation", () => {
    const WERKZEUG = "admin_season_simulation";

    it(
      "raumgebundener Save + mode=apply -> 409 mit admin_write_blocked_room_bound_save",
      async () => {
        const { POST } = await import("@/app/api/admin/season-simulation/route");
        const antwort = await POST(
          new Request("http://localhost/api/admin/season-simulation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "start", saveId: raum.saveId, mode: "apply", seasonCount: 1 }),
          }),
        );
        const body = await antwort.json();

        expect(antwort.status).toBe(409);
        expect(body.error).toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(body.run).toBeNull();
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: Save OHNE Raum + mode=apply -> nicht durch den Raum-Guard blockiert",
      async () => {
        const { POST } = await import("@/app/api/admin/season-simulation/route");
        const antwort = await POST(
          new Request("http://localhost/api/admin/season-simulation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "start", saveId: freierSaveId, mode: "apply", seasonCount: 1 }),
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Werkzeug ohne Raum-Bindung faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: raumgebundener Save + mode=dry_run -> nicht blockiert (Vorschau bleibt moeglich)",
      async () => {
        const { POST } = await import("@/app/api/admin/season-simulation/route");
        const antwort = await POST(
          new Request("http://localhost/api/admin/season-simulation", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "start", saveId: raum.saveId, mode: "dry_run", seasonCount: 1 }),
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Dry-Run im Raum faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).toBe(200);
        expect(body.ok).toBe(true);
      },
      AUFBAU_ZEITGRENZE_MS,
    );
  });

  describe("singleplayer-state/season-start-reset", () => {
    const WERKZEUG = "season_start_reset";

    function anfrage(saveId: string, seasonId: string, body: Record<string, unknown>) {
      return new Request(
        `http://localhost/api/singleplayer-state/season-start-reset?saveId=${encodeURIComponent(saveId)}&seasonId=${encodeURIComponent(seasonId)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      );
    }

    it(
      "raumgebundener Save + dryRun=false -> 409 mit admin_write_blocked_room_bound_save",
      async () => {
        const { POST } = await import("@/app/api/singleplayer-state/season-start-reset/route");
        const antwort = await POST(
          anfrage(raum.saveId, seasonIdVon(raum.saveId), {
            dryRun: false,
            confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(antwort.status).toBe(409);
        expect(body.error).toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: Save OHNE Raum + dryRun=false -> nicht durch den Raum-Guard blockiert",
      async () => {
        const { POST } = await import("@/app/api/singleplayer-state/season-start-reset/route");
        const antwort = await POST(
          anfrage(freierSaveId, seasonIdVon(freierSaveId), {
            dryRun: false,
            confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Werkzeug ohne Raum-Bindung faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: raumgebundener Save + dryRun=true -> nicht blockiert (Vorschau bleibt moeglich)",
      async () => {
        const { POST } = await import("@/app/api/singleplayer-state/season-start-reset/route");
        const antwort = await POST(anfrage(raum.saveId, seasonIdVon(raum.saveId), { dryRun: true }));
        const body = await antwort.json();

        expect(body.error, "Dry-Run im Raum faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );
  });

  describe("ai/picks-import", () => {
    const WERKZEUG = "ai_picks_import";

    function anfrage(body: Record<string, unknown>) {
      return new Request("http://localhost/api/ai/picks-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it(
      "raumgebundener Ziel-Save + dryRun=false -> 409 mit admin_write_blocked_room_bound_save",
      async () => {
        const { POST } = await import("@/app/api/ai/picks-import/route");
        const antwort = await POST(
          anfrage({
            sourceSaveId: freierSaveId,
            targetSaveId: raum.saveId,
            seasonId: seasonIdVon(raum.saveId),
            dryRun: false,
            confirmToken: AI_PICK_IMPORT_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(antwort.status).toBe(409);
        expect(body.error).toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: Ziel-Save OHNE Raum + dryRun=false -> nicht durch den Raum-Guard blockiert",
      async () => {
        const { POST } = await import("@/app/api/ai/picks-import/route");
        const antwort = await POST(
          anfrage({
            sourceSaveId: raum.saveId,
            targetSaveId: freierSaveId,
            seasonId: seasonIdVon(freierSaveId),
            dryRun: false,
            confirmToken: AI_PICK_IMPORT_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Werkzeug ohne Raum-Bindung faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: raumgebundener Ziel-Save + dryRun=true -> nicht blockiert (Vorschau bleibt moeglich)",
      async () => {
        const { POST } = await import("@/app/api/ai/picks-import/route");
        const antwort = await POST(
          anfrage({
            sourceSaveId: freierSaveId,
            targetSaveId: raum.saveId,
            seasonId: seasonIdVon(raum.saveId),
            dryRun: true,
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Dry-Run im Raum faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );
  });

  describe("ai/picks-audit-reset", () => {
    const WERKZEUG = "ai_picks_audit_reset";

    function anfrage(saveId: string, seasonId: string, body: Record<string, unknown>) {
      return new Request(
        `http://localhost/api/ai/picks-audit-reset?saveId=${encodeURIComponent(saveId)}&seasonId=${encodeURIComponent(seasonId)}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      );
    }

    it(
      "raumgebundener Save + dryRun=false -> 409 mit admin_write_blocked_room_bound_save",
      async () => {
        const { POST } = await import("@/app/api/ai/picks-audit-reset/route");
        const antwort = await POST(
          anfrage(raum.saveId, seasonIdVon(raum.saveId), {
            dryRun: false,
            confirmToken: AI_PICK_AUDIT_RESET_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(antwort.status).toBe(409);
        expect(body.error).toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: Save OHNE Raum + dryRun=false -> nicht durch den Raum-Guard blockiert",
      async () => {
        const { POST } = await import("@/app/api/ai/picks-audit-reset/route");
        const antwort = await POST(
          anfrage(freierSaveId, seasonIdVon(freierSaveId), {
            dryRun: false,
            confirmToken: AI_PICK_AUDIT_RESET_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Werkzeug ohne Raum-Bindung faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: raumgebundener Save + dryRun=true -> nicht blockiert (Vorschau bleibt moeglich)",
      async () => {
        const { POST } = await import("@/app/api/ai/picks-audit-reset/route");
        const antwort = await POST(anfrage(raum.saveId, seasonIdVon(raum.saveId), { dryRun: true }));
        const body = await antwort.json();

        expect(body.error, "Dry-Run im Raum faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );
  });

  describe("season/season-snapshot", () => {
    const WERKZEUG = "season_snapshot";

    function anfrage(body: Record<string, unknown>) {
      return new Request("http://localhost/api/season/season-snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it(
      "raumgebundener Save + execute=true -> 409 mit admin_write_blocked_room_bound_save",
      async () => {
        const { POST } = await import("@/app/api/season/season-snapshot/route");
        const antwort = await POST(
          anfrage({
            saveId: raum.saveId,
            seasonId: seasonIdVon(raum.saveId),
            execute: true,
            confirmToken: SEASON_SNAPSHOT_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(antwort.status).toBe(409);
        expect(body.success).toBe(false);
        expect(body.error).toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: Save OHNE Raum + execute=true -> nicht durch den Raum-Guard blockiert",
      async () => {
        const { POST } = await import("@/app/api/season/season-snapshot/route");
        const antwort = await POST(
          anfrage({
            saveId: freierSaveId,
            seasonId: seasonIdVon(freierSaveId),
            execute: true,
            confirmToken: SEASON_SNAPSHOT_CONFIRM_TOKEN,
          }),
        );
        const body = await antwort.json();

        expect(body.error, "Werkzeug ohne Raum-Bindung faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );

    it(
      "GEGENPROBE: raumgebundener Save im Dry-Run (kein execute) -> nicht blockiert (Vorschau bleibt moeglich)",
      async () => {
        const { POST } = await import("@/app/api/season/season-snapshot/route");
        const antwort = await POST(anfrage({ saveId: raum.saveId, seasonId: seasonIdVon(raum.saveId) }));
        const body = await antwort.json();

        expect(body.error, "Dry-Run im Raum faelschlich blockiert").not.toBe(`${BLOCKED_MARKER}:${WERKZEUG}`);
        expect(antwort.status).not.toBe(409);
      },
      AUFBAU_ZEITGRENZE_MS,
    );
  });
});
