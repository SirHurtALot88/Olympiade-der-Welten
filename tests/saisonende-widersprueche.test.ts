import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LIGA_WERTUNG_ABGESCHLOSSEN,
  LIGA_WERTUNG_ARCHIV,
  LIGA_WERTUNG_LAEUFT,
  resolveLigaWertungKopfzeile,
} from "@/lib/foundation/liga-wertung-kopfzeile";

/**
 * ZWEI WIDERSPRUECHE VOM SAISONABSCHLUSS — Befunde B3 und B5 aus
 * `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „mach mit B3 und B5 weiter."
 *
 * Beide gehoeren zusammen: sie standen auf DEMSELBEN Bildschirm und beide entstanden dadurch,
 * dass zwei verschiedene Dinge mit einem Wort beschrieben wurden.
 */

const root = process.cwd();

describe("B5 · Die Liga-Wertung kennt drei Zustände, nicht zwei", () => {
  /**
   * Im Audit stand oben „SAISON ABGESCHLOSSEN · Platz 20 zum Saisonende" und weiter unten auf
   * derselben Seite „LIGA-WERTUNG · SAISON LÄUFT".
   *
   * Die Beschriftung war ein Zweizeiler: Archiv oder laufend. Die Saison des Spielstands ist
   * aber nicht archiviert UND trotzdem durch — dieser Fall fiel in den Zweig „laeuft".
   */
  it("nennt eine abgeschlossene Saison abgeschlossen, nicht laufend", () => {
    expect(resolveLigaWertungKopfzeile({ istArchiv: false, istAbgeschlossen: true })).toBe(
      LIGA_WERTUNG_ABGESCHLOSSEN,
    );
    expect(resolveLigaWertungKopfzeile({ istArchiv: false, istAbgeschlossen: true })).not.toBe(
      LIGA_WERTUNG_LAEUFT,
    );
  });

  it("laesst die beiden bekannten Zustände unveraendert", () => {
    expect(resolveLigaWertungKopfzeile({ istArchiv: false, istAbgeschlossen: false })).toBe(LIGA_WERTUNG_LAEUFT);
    // Archiv schlaegt alles: eine archivierte Saison ist immer abgeschlossen, die Herkunft ist
    // die interessantere Aussage.
    expect(resolveLigaWertungKopfzeile({ istArchiv: true, istAbgeschlossen: true })).toBe(LIGA_WERTUNG_ARCHIV);
    expect(resolveLigaWertungKopfzeile({ istArchiv: true, istAbgeschlossen: false })).toBe(LIGA_WERTUNG_ARCHIV);
  });

  it("die Beschriftung wird nirgends mehr nachgetippt", () => {
    /*
     * Die Zeile stand wortgleich an ZWEI Stellen — im Saisonstand und in den Rängen. Genau
     * deshalb fehlte der dritte Zustand an beiden. Ein zweiter getippter Vorkommen wäre die
     * Vorbereitung der nächsten Abweichung.
     */
    const stellen = [
      "app/foundation/season-v2/SeasonStandingsNewLook.tsx",
      "app/foundation/FoundationShellRouterBody.tsx",
    ];
    for (const stelle of stellen) {
      const quelle = readFileSync(join(root, stelle), "utf8");
      expect({ stelle, getippt: quelle.includes(`"${LIGA_WERTUNG_LAEUFT}"`) }).toEqual({ stelle, getippt: false });
      expect({ stelle, ruft: quelle.includes("resolveLigaWertungKopfzeile(") }).toEqual({ stelle, ruft: true });
    }
  });
});

describe("B3 · Ein Schritt beschreibt sich, nicht sein Fenster", () => {
  /**
   * Im Audit: „Verkäufe & Verträge öffnen — **Offen** — Verträge verlängern und Spieler
   * verkaufen." mit dem Statuschip **erledigt** daneben.
   *
   * Beides stimmte, aber ueber verschiedene Dinge: „Offen" beschrieb das VERKAUFSFENSTER,
   * „erledigt" den SCHRITT, es zu oeffnen. In einer Zeile gelesen ist das ein Widerspruch.
   */
  const panel = readFileSync(join(root, "app/foundation/season-v2/FoundationSeasonFinalePanel.tsx"), "utf8");

  it("der erledigte Schritt sagt nicht mehr „Offen“", () => {
    // Ohne Kommentare pruefen — die Begruendung darueber nennt das alte Wort naturgemaess.
    const ohneKommentare = panel.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(ohneKommentare).not.toContain('"Offen — Verträge verlängern');
  });

  it("er sagt stattdessen, was jetzt möglich ist", () => {
    expect(panel).toContain("Freigeschaltet — du kannst jetzt Verträge verlängern und Spieler verkaufen.");
  });

  it("die Einschränkung bleibt erhalten — Kaufen ist weiterhin zu", () => {
    // Der Widerspruch war das Problem, nicht die Information. Sie darf nicht mit verschwinden.
    expect(panel).toContain("Gekauft wird noch nicht: die Kaufphase kommt in der neuen Saison");
  });
});
