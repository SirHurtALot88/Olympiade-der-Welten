/**
 * EIN TESTCONTAINER DARF KEINEN FREMDEN SPIELSTAND LOESCHEN.
 *
 * BEFUND: `data/online-saves/` enthaelt ueber die gesamte Repo-Historie ausschliesslich
 * Testartefakte — „Auto Run Smoke", „Whole Season DryRun Smoke", „Balance Audit". Kein einziger
 * echter Spielstand. Der Grund steht im Auto-Export: der Timer laeuft in JEDER Umgebung, die den
 * Server startet, rief `exportOnlineSaves()` ohne Filter auf, und der Voll-Export loescht jede
 * Datei, die der eigene Store nicht kennt — anschliessend wird nach `main` gepusht.
 *
 * Ein Container mit Smoke-Saves raeumte damit den Ordner leer und ersetzte das Manifest durch
 * seine eigene Liste. Fuer den Importeur, der NUR das Manifest liest, war ein fremder Spielstand
 * danach unsichtbar, selbst wenn die Datei noch dagelegen haette.
 *
 * Diese Suite haelt beide Haelften fest: Datei behalten UND Eintrag behalten.
 */
import { describe, expect, it } from "vitest";

import { mergeManifestForUnattendedExport, type OnlineSaveManifestEntry } from "@/lib/persistence/online-save-export";

function eintrag(saveId: string, name: string): OnlineSaveManifestEntry {
  return { saveId, name, status: "archived", file: `${saveId}.json.gz`, uncompressedBytes: 10, gzipBytes: 5 };
}

const CHRIS = eintrag("save-chris", "Chris' Karriere");
const SMOKE = eintrag("save-smoke", "Auto Run Smoke");

describe("Unbeaufsichtigter Export: fremde Spielstaende bleiben im Manifest", () => {
  it("behaelt den fremden Eintrag, wenn seine Datei noch da ist", () => {
    const ergebnis = mergeManifestForUnattendedExport({
      ownEntries: [SMOKE],
      ownActiveSaveId: "save-smoke",
      existingEntries: [CHRIS],
      existingActiveSaveId: "save-chris",
      fileExists: () => true,
    });

    expect(ergebnis.saves.map((entry) => entry.saveId)).toEqual(["save-smoke", "save-chris"]);
    expect(ergebnis.keptForeignEntries).toBe(1);
  });

  it("kapert den aktiven Spielstand nicht — der Zeiger bleibt auf dem fremden Stand", () => {
    const ergebnis = mergeManifestForUnattendedExport({
      ownEntries: [SMOKE],
      ownActiveSaveId: "save-smoke",
      existingEntries: [CHRIS],
      existingActiveSaveId: "save-chris",
      fileExists: () => true,
    });

    // Ohne diese Regel zeigt das Manifest nach jedem Smoke-Lauf auf einen Testspielstand, und der
    // Import aktiviert genau den.
    expect(ergebnis.activeSaveId).toBe("save-chris");
  });

  it("laesst einen Eintrag fallen, dessen Datei wirklich fehlt", () => {
    const ergebnis = mergeManifestForUnattendedExport({
      ownEntries: [SMOKE],
      ownActiveSaveId: "save-smoke",
      existingEntries: [CHRIS],
      existingActiveSaveId: "save-chris",
      fileExists: () => false,
    });

    expect(ergebnis.saves.map((entry) => entry.saveId)).toEqual(["save-smoke"]);
    expect(ergebnis.keptForeignEntries).toBe(0);
    // Kein fremder Stand mehr da → der eigene Zeiger darf wieder gelten.
    expect(ergebnis.activeSaveId).toBe("save-smoke");
  });

  it("bevorzugt die eigene Fassung, wenn beide Seiten denselben Spielstand kennen", () => {
    const eigeneNeuereFassung = { ...CHRIS, name: "Chris' Karriere (neuer)", gzipBytes: 99 };
    const ergebnis = mergeManifestForUnattendedExport({
      ownEntries: [eigeneNeuereFassung],
      ownActiveSaveId: "save-chris",
      existingEntries: [CHRIS],
      existingActiveSaveId: "save-chris",
      fileExists: () => true,
    });

    expect(ergebnis.saves).toHaveLength(1);
    expect(ergebnis.saves[0]?.gzipBytes).toBe(99);
    expect(ergebnis.activeSaveId).toBe("save-chris");
  });

  it("aendert nichts, wenn die Umgebung ohnehin alles kennt", () => {
    const ergebnis = mergeManifestForUnattendedExport({
      ownEntries: [CHRIS, SMOKE],
      ownActiveSaveId: "save-chris",
      existingEntries: [CHRIS, SMOKE],
      existingActiveSaveId: "save-chris",
      fileExists: () => true,
    });

    expect(ergebnis.keptForeignEntries).toBe(0);
    expect(ergebnis.saves.map((entry) => entry.saveId)).toEqual(["save-chris", "save-smoke"]);
    expect(ergebnis.activeSaveId).toBe("save-chris");
  });
});
