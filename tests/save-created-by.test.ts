import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_ACTIVE_OWNER_ID, FRANKY_OWNER_ID, resolveOwnerDisplayLabel } from "@/lib/foundation/team-control-settings";

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

/**
 * "Kannst du hier immer dazu schreiben bei den Saves, welcher User das Save-File
 * erstellt hat?"
 *
 * Die Saves-Tabelle kannte bisher nur `created_at` und `updated_at` — WER angelegt hat,
 * stand nirgends. `active_saves` sieht danach aus, ist aber etwas anderes: ein Zeiger je
 * Benutzer auf dessen aktuell geladenen Spielstand, kein Urheber-Vermerk.
 */
describe("Spielstände: Urheber wird festgeschrieben", () => {
  const repository = read("lib/persistence/save-repository.ts");
  const sqlite = read("lib/persistence/sqlite.ts");
  const service = read("lib/persistence/persistence-service.ts");

  it("legt die Spalte additiv an, ohne bestehende Spielstände anzufassen", () => {
    // Gleicher Mechanismus wie für die übrigen Save-Spalten: ALTER TABLE mit Default,
    // kein Neuschreiben der Datei.
    expect(sqlite).toContain('["created_by", "TEXT NOT NULL DEFAULT \'\'"]');
  });

  /**
   * Der Kern: JEDER Schreibvorgang eines Spielstands — jeder Spielzug, jede
   * Spieltagsauswertung — läuft durch denselben Upsert. Stünde `created_by` im
   * UPDATE-Zweig, wäre daraus binnen einer Minute "wer zuletzt gespeichert hat".
   */
  it("schreibt den Urheber NUR beim Anlegen, nie beim Speichern", () => {
    const upsert = repository.slice(
      repository.indexOf("INSERT INTO saves ("),
      repository.indexOf("const transferHistoryCount ="),
    );
    expect(upsert).toContain("created_by");
    expect(upsert).toContain("@createdBy");

    const updateBranch = upsert.slice(upsert.indexOf("ON CONFLICT(save_id) DO UPDATE SET"));
    expect(updateBranch).not.toContain("created_by = excluded.created_by");
    expect(updateBranch).not.toContain("created_by =");
  });

  it("bucht der laufende Speicherpfad keinen Urheber", () => {
    // `saveGameState` ist der Pfad jedes normalen Spielzugs — er übergibt bewusst kein
    // `createdBy`, der Wert kommt dort als "" an und der UPDATE-Zweig ignoriert ihn.
    const saveGameState = repository.slice(
      repository.indexOf("saveGameState({ saveId, name, status, gameState })"),
      repository.indexOf("deleteSaves(saveIds: string[])"),
    );
    expect(saveGameState).not.toContain("createdBy");
  });

  it("vermerkt ihn auf allen drei Wegen, auf denen ein Spielstand entsteht", () => {
    // Seed (neues Spiel), Klon und Snapshot — alle drei legen einen NEUEN Spielstand an.
    expect(repository.match(/createdBy: resolveCreatingOwnerId\(ownerId\)/g)?.length).toBe(3);
    // Und der Service reicht die Session-Identität dorthin durch.
    expect(service).toContain("seedData: loadSeedData(),\n        ownerId,");
    expect(service).toContain("seedData: loadFreshSeasonOneSeedData(),\n        ownerId: input?.ownerId,");
  });

  it("benennt ohne Login den einen lokalen Benutzer statt niemanden", () => {
    // `resolveSessionOwnerId()` liefert bei ausgeschaltetem Login null. Es sitzt trotzdem
    // genau ein Mensch an der Tastatur — denselben kennt das Team-Control-System als
    // DEFAULT_ACTIVE_OWNER_ID. Ohne den Fallback stünde auf jedem neuen Save "unbekannt".
    expect(repository).toContain("function resolveCreatingOwnerId(ownerId: string | null | undefined): string {");
    expect(repository).toContain("return ownerId ?? DEFAULT_ACTIVE_OWNER_ID;");
  });

  it("reicht den Wert bis in die Save-Liste durch", () => {
    expect(repository).toContain("created_by FROM saves ORDER BY updated_at DESC");
    // Leerstring ist "kein Vermerk", nicht "Urheber mit leerem Namen".
    expect(repository).toContain("createdBy: row.created_by ? row.created_by : null,");
  });
});

describe("Urheber-Anzeige: Klarname statt Owner-ID", () => {
  it("löst die bekannten Benutzer auf", () => {
    expect(resolveOwnerDisplayLabel(DEFAULT_ACTIVE_OWNER_ID)).toBe("Chris");
    expect(resolveOwnerDisplayLabel(FRANKY_OWNER_ID)).toBe("Franky");
  });

  it("hält 'kein Vermerk' von 'unbekannte ID' auseinander", () => {
    // Kein Vermerk → null, die Anzeigestelle benennt das selbst.
    expect(resolveOwnerDisplayLabel(null)).toBeNull();
    expect(resolveOwnerDisplayLabel("")).toBeNull();
    // Unbekannte ID → roh durchreichen. Beim Nachsehen ist die ID brauchbarer als
    // ein Platzhalter, der jede ID gleich aussehen lässt.
    expect(resolveOwnerDisplayLabel("someone_else")).toBe("someone_else");
  });

  it("zeigt die Save-Karte den Urheber und sagt, wenn keiner hinterlegt ist", () => {
    const view = read("app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx");
    expect(view).toContain("const createdByLabel = resolveOwnerDisplayLabel(save.createdBy);");
    expect(view).toContain('{createdByLabel ?? "Urheber unbekannt"}');
    // Getrennt von "Update", damit Urheberschaft nicht mit "zuletzt gespeichert"
    // verwechselt wird — der Tooltip sagt den Unterschied ausdrücklich.
    expect(view).toContain('Das ist die Urheberschaft — wer zuletzt gespeichert hat, steht in „Update".');
  });
});
