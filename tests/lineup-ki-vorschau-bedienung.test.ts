import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  describeAiPreviewStatus,
  getAiPreviewStatusTone,
} from "@/lib/ai/ai-legacy-lineup-batch-types";

/**
 * „KI VORSCHAU -> BEDIENUNG ZURÜCK" (Entscheidung von Chris aus der Test-Triage)
 *
 * Der Befund davor: im Lab-Client lag die komplette Mechanik der KI-Vorschau — sechs Handler,
 * ein Panel-Zustand, zwei API-Aufrufe — und KEIN EINZIGER Handler hatte einen Aufrufer. Die
 * Vorschau liess sich also gar nicht ausloesen; `isAiPreviewPanelOpen` wurde gesetzt und nirgends
 * gelesen.
 *
 * Das ist der Fehlertyp, der in diesem Projekt am haeufigsten durchrutscht: die Rechnung
 * existiert, der gezeichnete Pfad bekommt sie nur nie. Weder der Typpruefer noch ein Wertetest
 * schlagen dabei an — ungenutzte Funktionen sind syntaktisch tadellos.
 */

const root = process.cwd();
const clientPath = path.join(root, "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");
const panelPath = path.join(root, "app/foundation/legacy-lineup-lab/LineupAiPreviewPanel.tsx");

/**
 * Die sechs Einstiege der KI-Vorschau. Jeder von ihnen war tot.
 */
const HANDLER = [
  "handleAiPreview",
  "handleAiPreviewAllTeams",
  "handleAdoptAiPreview",
  "handleSaveAiPreview",
  "handleOpenAiBatchDetails",
  "handleAiBatchApply",
];

/**
 * Zaehlt Erwaehnungen eines Bezeichners ABZUEGLICH seiner eigenen Deklaration. Bleibt 0 uebrig,
 * ist die Funktion tot — genau der Zustand, den dieser Test verhindert.
 *
 * Bewusst keine Pruefung auf eine bestimmte Zeichenkette im Markup: WIE die Bedienung aussieht,
 * darf sich aendern, DASS sie erreichbar ist, nicht.
 */
function countCallers(source: string, name: string): number {
  const alle = source.match(new RegExp(`\\b${name}\\b`, "g")) ?? [];
  const deklarationen = source.match(new RegExp(`function\\s+${name}\\b`, "g")) ?? [];
  return alle.length - deklarationen.length;
}

describe("KI-Vorschau in der Einsatzliste: die Bedienung ist erreichbar", () => {
  it("jeder Handler der KI-Vorschau hat mindestens einen Aufrufer", async () => {
    const source = await fs.readFile(clientPath, "utf8");
    const tot = HANDLER.filter((name) => countCallers(source, name) === 0);
    expect(tot).toEqual([]);
  });

  it("der Panel-Zustand wird nicht nur gesetzt, sondern auch gelesen", async () => {
    const source = await fs.readFile(clientPath, "utf8");
    // `setIsAiPreviewPanelOpen` schrieb an vier Stellen — gelesen wurde der Wert nirgends.
    // Die Deklaration selbst faellt durch den Lookahead heraus (dort folgt das Komma des
    // Destrukturierens), der Setzer durch die Grossschreibung von `setIs…`.
    const lesend = source.match(/\bisAiPreviewPanelOpen\b(?!\s*[,\]])/g) ?? [];
    expect(lesend.length).toBeGreaterThan(0);
  });

  it("die Bedienung liegt in der Anzeige, nicht nur im Zustand", async () => {
    const [clientSource, panelSource] = await Promise.all([
      fs.readFile(clientPath, "utf8"),
      fs.readFile(panelPath, "utf8"),
    ]);
    // Der Client reicht die Handler an die Anzeige durch …
    expect(clientSource).toContain("<LineupAiPreviewPanel");
    // … und die Anzeige haengt sie an Schaltflaechen. Ohne `onClick` waere das Panel nur ein Bild.
    expect(panelSource.match(/onClick=/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});

/**
 * DAS STATUS-WORT. Chris hat denselben Fehler an anderer Stelle gemeldet („hier stand blank
 * `lineup_draft_is_locked`"): ein roher Bezeichner auf dem Schirm ist von einem Absturz nicht zu
 * unterscheiden. Die Stapelvorschau haette ihn an bis zu 32 Zeilen gleichzeitig gezeigt.
 */
describe("KI-Vorschau: Status und Ton", () => {
  it("uebersetzt die Roh-Status in lesbare Worte", () => {
    expect(describeAiPreviewStatus("ready")).toBe("bereit");
    expect(describeAiPreviewStatus("incomplete_roster")).toBe("Kader zu klein");
    expect(describeAiPreviewStatus("missing_scores")).toBe("Werte fehlen");
    expect(describeAiPreviewStatus("blocked")).toBe("blockiert");
  });

  it("gibt einen unbekannten Status unveraendert zurueck, statt ihn zu verschlucken", () => {
    // Lieber ein unschoenes Wort als eine leere Zelle: eine Luecke sieht aus wie „nichts los".
    expect(describeAiPreviewStatus("irgendwas_neues")).toBe("irgendwas_neues");
  });

  it("stuft blockierte Teams als blockiert ein — auch wenn der Status „ready“ sagt", () => {
    // Der Blockiergrund gewinnt gegen den Status. Andersherum sagte die Zeile „bereit“ zu einem
    // Team, das nicht antreten kann.
    expect(
      getAiPreviewStatusTone({ status: "ready", warnings: [], blockingReasons: ["kein Kader"] }),
    ).toBe("blocked");
  });

  it("trennt Hinweis von bereit — ein Vorschlag mit offenen Punkten ist nicht grün", () => {
    expect(getAiPreviewStatusTone({ status: "ready", warnings: ["Spieler müde"], blockingReasons: [] })).toBe(
      "warning",
    );
    expect(getAiPreviewStatusTone({ status: "ready", warnings: [], blockingReasons: [] })).toBe("ready");
    expect(getAiPreviewStatusTone({ status: "incomplete_roster", warnings: [], blockingReasons: [] })).toBe(
      "warning",
    );
  });
});
