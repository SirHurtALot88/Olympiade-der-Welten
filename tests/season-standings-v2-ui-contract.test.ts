/**
 * SAISONSTAND — welche Ansicht sich öffnet, und was es daneben gibt.
 *
 * WARUM DIESE DATEI UMGESCHRIEBEN WURDE. Sie bestand aus Zeichenketten-Suchen im
 * Quelltext (`toContain('const SEASON_V2_DEFAULT_MODE: SeasonV2ViewMode = "table"')`
 * und ähnlich). Solche Prüfungen sagen nichts über die Ansicht aus: sie kippen bei
 * jeder Umbenennung, und sie bleiben grün, wenn jemand die Ansicht kaputt macht,
 * solange nur die Buchstaben stehen bleiben. Genau das ist hier passiert — die
 * Modus-Namen wurden zu `NlStandingsMode = "board" | "daten" | "vereine"`, die
 * Datenansicht öffnet unverändert als erste. Die Zusicherung hing an drei Dateien
 * und zerbrach, obwohl das Verhalten stimmte.
 *
 * Die Zusicherungen stehen jetzt auf exportierten WERTEN (`NL_STANDINGS_DEFAULT_MODE`,
 * `NL_STANDINGS_MODE_ITEMS`, `TRANSFER_HISTORY_*`) — dieselbe Mechanik, die dieses
 * Repo schon bei `MATCHDAY_PANEL_DEFAULT_SORT` benutzt.
 */
import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  NL_STANDINGS_DEFAULT_MODE,
  NL_STANDINGS_MODE_ITEMS,
} from "@/app/foundation/season-v2/SeasonStandingsNewLook";
import {
  TRANSFER_HISTORY_DEFAULT_LAYOUT,
  TRANSFER_HISTORY_LAYOUT_ITEMS,
} from "@/app/foundation/transfer-history-v2/TransferHistoryV2NewLook";

describe("season standings v2 ui contract", () => {
  it("öffnet in der Datenansicht — nicht im Board und nicht bei den Vereinen", () => {
    expect(NL_STANDINGS_DEFAULT_MODE).toBe("daten");
    // Der Standard muss auch angeboten werden, sonst startet die Seite auf einem
    // Reiter, den es in der Leiste gar nicht gibt.
    expect(NL_STANDINGS_MODE_ITEMS.map((item) => item.id)).toContain(NL_STANDINGS_DEFAULT_MODE);
    // Angebotsreihenfolge: die Startansicht steht vorn.
    expect(NL_STANDINGS_MODE_ITEMS[0]?.id).toBe(NL_STANDINGS_DEFAULT_MODE);
  });

  it("bietet Board und Vereine daneben an — und keine Karten-Ansicht mehr", () => {
    const ids = NL_STANDINGS_MODE_ITEMS.map((item) => item.id);
    expect(ids).toEqual(["daten", "board", "vereine"]);
    // Die „Karten"-Ansicht ist abgeschafft; sie darf auch unter keinem Label
    // zurückkommen, ohne dass diese Zusicherung neu verhandelt wird.
    expect(ids).not.toContain("cards");
    expect(NL_STANDINGS_MODE_ITEMS.map((item) => item.label)).not.toContain("Karten");
    // Jeder Reiter trägt eine nicht-leere Beschriftung — ein leeres Label wäre ein
    // unsichtbarer Reiter.
    for (const item of NL_STANDINGS_MODE_ITEMS) {
      expect(item.label.trim().length, `Reiter ${item.id} ohne Beschriftung`).toBeGreaterThan(0);
    }
  });

  /**
   * ES GIBT NUR EINE UMSCHALT-EBENE. Die Sidebar reichte früher ein zweites
   * `{ id: "gms", label: "Manager" }` durch, das nichts steuerte (`viewMode` wurde
   * bis in den Client gereicht und nie gelesen). Diese tote Ebene ist entfernt —
   * belegt im Quelltext von FoundationShellRouterBody.tsx. Hier bleibt eine
   * Quelltext-Prüfung, weil die Aussage genau eine über den Quelltext ist:
   * die Zeile darf nicht zurückkommen.
   */
  it("die Sidebar baut keine zweite, tote Umschalt-Ebene über den Saisonstand", async () => {
    const body = await fs.readFile(
      path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"),
      "utf8",
    );
    expect(body).toContain("FoundationSeasonV2Panel");
    expect(body).not.toContain('{ id: "gms", label: "Manager" }');
    expect(body).not.toContain('{ id: "cards", label: "Karten" }');
  });

  it("der Deal-Strom lässt sich zwischen Timeline und Tabelle umschalten und startet auf Timeline", () => {
    expect(TRANSFER_HISTORY_DEFAULT_LAYOUT).toBe("timeline");
    expect(TRANSFER_HISTORY_LAYOUT_ITEMS.map((item) => item.id)).toEqual(["timeline", "table"]);
    expect(TRANSFER_HISTORY_LAYOUT_ITEMS.map((item) => item.id)).toContain(
      TRANSFER_HISTORY_DEFAULT_LAYOUT,
    );
  });
});

/**
 * GELÖSCHT, NICHT REPARIERT: „exposes sprint M form curve, mobile cards, prize preview,
 * and pinned sticky team".
 *
 * Die sechs gesuchten Marken (`season-v2-form-curve`, `season-v2-trend-arrow`,
 * `season-v2-mobile-cards-toggle`, `season-v2-mobile-card-grid`,
 * `season-v2-prize-preview`, `season-v2-pinned-team`) gehörten zum ALTEN Look. Der
 * wurde mit 32683df8 („physically remove dead legacy look") ausgebaut, weil er zu
 * dem Zeitpunkt bereits unerreichbar war — der Neue Look war dauerhaft an. Es ist
 * also kein Funktionsverlust an der Oberfläche, sondern das Entfernen eines Zweigs,
 * den seit Wochen niemand mehr zu sehen bekam.
 *
 * Die Zusicherung neu zu formulieren wäre falsch: der Neue Look hat kein
 * Form-Kurven-Sparkline und keine Mobil-Karten, er hat eigene Formkarten-Spalten
 * (`nl-standings-th-formcards`), die von tests/matchday-panel-form-column.test.ts und
 * den Formkarten-Tests abgedeckt sind. Ein Test, der eine nicht mehr gewollte
 * Gestaltung einfordert, meldet keinen Fehler, sondern hält eine Entscheidung auf.
 *
 * OFFEN FÜR CHRIS: die zugehörigen CSS-Regeln (`.season-v2-form-curve`,
 * `.season-v2-mobile-card-grid`, `.season-v2-prize-preview`) stehen weiterhin in
 * app/globals.css, obwohl sie niemand mehr benutzt — siehe
 * docs/ROTE_TESTS_TRIAGE.md.
 */
