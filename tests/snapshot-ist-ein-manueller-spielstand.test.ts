/**
 * EIN SNAPSHOT, DEN JEMAND ANFORDERT, DARF NICHT MITROTIEREN.
 *
 * GEMESSEN (Koop-Audit, Abschnitt C): der Scratch-Snapshot war kurz nach dem Anlegen wieder weg,
 * und der naechste Zugriff auf seine ID kam als HTTP 500 "Save ... wurde nicht gefunden." zurueck.
 *
 * Die Ursache ist eine Vererbung, die an genau einer Stelle falsch ist. `buildScenarioMeta`
 * uebernimmt `saveCategory` der Quelle (scenario-meta.ts:103) — und das MUSS es, weil
 * `withScenarioMeta` bei jedem Schreibvorgang darueber laeuft und ein Spielstand sonst seine
 * Kategorie beim Speichern verloere. Nur beim ANLEGEN eines Snapshots kippt die Regel: der
 * Snapshot einer Vorsaison-Sicherung wurde selbst eine Vorsaison-Sicherung, landete damit in einer
 * rotierenden Fuenfergruppe (save-retention.ts) und war Freiwild, sobald ihm ein `activate` den
 * `active`-Schutz nahm.
 *
 * Der Rueckfall `saveCategory ?? "manual"` in persistence-service.ts sagt die richtige Absicht
 * schon lange — er lief nur nie, weil das geerbte Feld bereits gefuellt war.
 *
 * NACHGEMESSEN an einer Kopie von Chris' Datenbank (40 Spielstaende): das Anlegen EINES Snapshots
 * stutzte die Gruppe singleplayer:pre-season von sechs auf fuenf Zeilen — zwei fremde Spielstaende
 * vom 17. und 18.08. waren weg, ohne dass jemand ein Loeschen angefordert hatte.
 *
 * Der zweite Block unten ist die GEGENPROBE: er haelt das alte, erbende Verhalten fest und zeigt,
 * dass es genau die Kategorie ist, die den Unterschied macht — nicht die Reihenfolge, nicht der
 * Zeitstempel.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  isProtectedSaveRetentionCategory,
  parseSaveRetentionMetadata,
  resolveSaveRetentionBucket,
  resolveSaveRetentionCategory,
} from "@/lib/persistence/save-retention";
import { buildScenarioMeta } from "@/lib/persistence/scenario-meta";
import { getDatabase, resetDatabaseForTests } from "@/lib/persistence/sqlite";

beforeEach(() => {
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
});

/** Die Retention-Gruppe eines Spielstands, so wie `enforceRollingSaveRetention` sie bildet. */
function gruppeVon(saveId: string): string {
  const zeile = getDatabase()
    .prepare(
      `SELECT game_metadata.payload_json AS metadata_json
       FROM saves LEFT JOIN game_metadata ON game_metadata.save_id = saves.save_id
       WHERE saves.save_id = ?`,
    )
    .get(saveId) as { metadata_json: string | null } | undefined;
  const metadaten = parseSaveRetentionMetadata(zeile?.metadata_json ?? null);
  return `${resolveSaveRetentionBucket(metadaten)}:${resolveSaveRetentionCategory(metadaten)}`;
}

/**
 * Legt einen Snapshot exakt so an wie `app/api/singleplayer-state/route.ts` es tut — inklusive
 * der Kategorie-Entscheidung, um die es hier geht.
 */
function legeSnapshotAn(
  persistence: ReturnType<typeof createPersistenceService>,
  quelleId: string,
  name: string,
  kategorie: "manual" | undefined,
) {
  const quelle = persistence.getSaveById(quelleId);
  expect(quelle, `Quelle ${quelleId} fehlt`).toBeTruthy();
  return persistence.createScenarioSnapshot({
    sourceSaveId: quelleId,
    name,
    scenarioMeta: buildScenarioMeta({
      gameState: quelle!.gameState,
      label: name,
      sourceSaveId: quelleId,
      ...(kategorie ? { saveCategory: kategorie } : {}),
      isStableTestPoint: true,
    }),
  });
}

describe("Snapshot auf Anforderung", () => {
  it(
    "ist ein manueller Spielstand und verfaellt deshalb nicht — auch nicht nach dem naechsten activate",
    () => {
      const persistence = createPersistenceService();
      const basis = persistence.createSave("Basis");

      // Die rotierende Gruppe fuellen: fuenf Vorsaison-Sicherungen, wie sie die Saisonwende anlegt.
      const vorsaison = [1, 2, 3, 4, 5].map((n) =>
        persistence.createScenarioSnapshot({
          sourceSaveId: basis.saveId,
          name: `Vorsaison ${n}`,
          scenarioMeta: buildScenarioMeta({
            gameState: basis.gameState,
            label: `Vorsaison ${n}`,
            sourceSaveId: basis.saveId,
            saveCategory: "pre-season",
          }),
        }),
      );
      expect(vorsaison.every((save) => gruppeVon(save.saveId) === "singleplayer:pre-season")).toBe(true);

      // Und jetzt der Snapshot, den jemand ueber den Knopf in den Team-Einstellungen anfordert.
      // Seine Quelle ist eine Vorsaison-Sicherung — genau der Fall, der im Audit schieflief.
      const angefordert = legeSnapshotAn(persistence, vorsaison[4].saveId, "Mein Snapshot", "manual");

      expect(gruppeVon(angefordert.saveId), "Snapshot erbt die Kategorie der Quelle").toBe(
        "singleplayer:manual",
      );
      expect(isProtectedSaveRetentionCategory("manual"), "manual muss geschuetzt sein").toBe(true);

      // Er hat niemanden verdraengt: alle fuenf Vorsaison-Sicherungen sind noch da.
      for (const save of vorsaison) {
        expect(persistence.getSaveById(save.saveId), `Vorsaison-Sicherung ${save.name} wurde geloescht`).toBeTruthy();
      }

      // Und er ueberlebt den Schreibvorgang, der ihm seinen `active`-Schutz nimmt.
      persistence.activateSave(basis.saveId);
      expect(persistence.getSaveById(angefordert.saveId), "Snapshot nach activate weg").toBeTruthy();
    },
    240_000,
  );

  it(
    "GEGENPROBE: mit geerbter Kategorie waere derselbe Snapshot eine rotierende Zeile",
    () => {
      const persistence = createPersistenceService();
      const basis = persistence.createSave("Basis");
      const vorsaison = persistence.createScenarioSnapshot({
        sourceSaveId: basis.saveId,
        name: "Vorsaison",
        scenarioMeta: buildScenarioMeta({
          gameState: basis.gameState,
          label: "Vorsaison",
          sourceSaveId: basis.saveId,
          saveCategory: "pre-season",
        }),
      });

      // Ohne die gesetzte Kategorie zieht `buildScenarioMeta` die der Quelle nach — der Snapshot
      // ist dann selbst eine Vorsaison-Sicherung und rotiert mit.
      const geerbt = legeSnapshotAn(persistence, vorsaison.saveId, "Geerbt", undefined);
      expect(gruppeVon(geerbt.saveId)).toBe("singleplayer:pre-season");
      expect(isProtectedSaveRetentionCategory("pre-season")).toBe(false);
    },
    240_000,
  );

  it("die Snapshot-Route setzt die Kategorie, statt sie zu erben", () => {
    // Ein Vertragstest auf den Quelltext: die Route laeuft in der Next-Laufzeit und laesst sich in
    // dieser Testumgebung (environment "node") nicht laden. Die Regel selbst ist aber scharf
    // formulierbar — und ohne diese Zeile faellt der Fix beim naechsten Umbau lautlos wieder um.
    const quelle = readFileSync(join(process.cwd(), "app/api/singleplayer-state/route.ts"), "utf8");
    const block = quelle.slice(quelle.indexOf('body.action === "snapshot"'));
    const start = block.indexOf("buildScenarioMeta({");
    expect(start, "buildScenarioMeta-Aufruf im Snapshot-Zweig nicht gefunden").toBeGreaterThan(0);
    const bauAufruf = block.slice(start, block.indexOf("});", start));
    expect(bauAufruf, "Die Snapshot-Route setzt saveCategory nicht mehr").toContain('saveCategory: "manual"');
  });
});
