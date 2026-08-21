/**
 * GEMELDET VON CHRIS: „momentan lädt es endlos."
 *
 * Es war keine Endlosschleife — der Effekt loest sich sauber auf, seine Abhaengigkeiten sind
 * `[draftSalary, draftLength, draftShape]`, und keine Antwort erzeugt eine neue Anfrage.
 *
 * Es war eine EINBAHNSTRASSE: `previewBusy` wurde synchron auf true gesetzt und nur im
 * Erfolgspfad wieder geloest. Kein `catch`, kein `finally`, kein Timeout. Bleibt eine Antwort
 * aus, steht das Fenster dauerhaft auf „Die Verhandlungsvorschau wird aktualisiert" — und beide
 * Knoepfe haengen an `previewBusy`, sind also tot.
 *
 * Und Antworten blieben aus: `better-sqlite3` ist synchron, jeder Voll-Load des Spielstands
 * blockiert den ganzen Node-Prozess. Ein Bestaetigen stiess fuenf davon an, drei im Hintergrund.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const MODAL = readFileSync(
  join(process.cwd(), "app/foundation/teams-v2/ContractRenewalNegotiationModal.tsx"),
  "utf8",
);
const SCOPE = readFileSync(
  join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
  "utf8",
);

describe("Das Verhandlungsfenster bleibt nicht auf „lädt“ stehen", () => {
  it("löst den Ladezustand in einem finally, nicht im Erfolgspfad", () => {
    expect(MODAL).toContain(".finally(() => {");
    expect(MODAL).toContain("setPreviewBusy(false);");
    // Der alte Weg: setPreviewBusy(false) stand IM then, direkt nach setSummary.
    expect(MODAL).not.toContain("        setSummary(payload.summary);\n        }\n        setPreviewBusy(false);");
  });

  it("fängt auch einen abgestürzten Aufruf ab, damit finally garantiert greift", () => {
    expect(MODAL).toContain(".catch(() => {");
  });

  it("lässt nur die jüngste Anfrage entsperren", () => {
    // Sonst gäbe eine überholte Antwort frei, während die neuere noch läuft.
    const block = MODAL.slice(MODAL.indexOf(".finally(() => {"));
    expect(block).toContain("if (requestSeqRef.current === seq) {");
  });
});

describe("Verlängern blockiert den Server nicht mehr mit Nebendaten", () => {
  function schreibweg() {
    const start = SCOPE.indexOf("async function runContractRenewalAction(");
    expect(start).toBeGreaterThanOrEqual(0);
    return SCOPE.slice(start, SCOPE.indexOf("function applyNewGamePreset(", start));
  }

  it("lädt nach dem Verlängern nur noch den Spielstand", () => {
    const weg = schreibweg();
    expect(weg).toContain("await loadSave(activeSaveId);");
    // Marktfeed, Historie und Saison-Übersicht materialisieren JEDE für sich den ganzen
    // Spielstand — synchron, also den ganzen Prozess blockierend, für Daten die im
    // Verhandlungsfenster niemand sieht.
    expect(weg).not.toContain("reloadHistoryFeed()");
    expect(weg).not.toContain("reloadSeasonManagementOverview()");
  });

  it("merkt sich trotzdem, dass die Feeds veraltet sind", () => {
    // Ohne den Marker sähe man beim nächsten Blick auf den Markt alte Zahlen.
    expect(schreibweg()).toContain("setMarketReloadToken((current) => current + 1);");
  });
});
