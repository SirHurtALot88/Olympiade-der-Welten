/**
 * POTENZIAL-DRIFT WIRD IN DER TRAININGSHISTORIE SICHTBAR.
 *
 * GEMELDET VON CHRIS: „sollte potential sich nicht leicht über die seasons ändern können? was
 * wäre da sinnvoll?"
 *
 * BEFUND: Es ändert sich längst. `applySeasonEndPotentialUpdate` driftet an jedem Saisonende um
 * ±2 Punkte aus dem Spieler-Seed, gerichtet durch den Wachstums-Ausblick (breakout +1,
 * regression_risk −1) und nie auf 0. Nur SEHEN konnte man es nirgends. Am Live-Spielstand
 * nachgemessen (n=2984): 1586 Spieler hoch, 1367 herunter, 31 durch die 35–99-Klammer
 * unverändert; Lyraeth Vael 78 → 77 am Ende von Saison 1. Genau dieser Punkt erklärt, warum
 * dieselbe Spielerin in der Folgesaison vom gleichen Trainingsbudget weniger mitnimmt.
 *
 * Diese Suite pinnt die EIGENSCHAFT, nicht die Formel: der Drift landet an der Saison, für die
 * er im Spielstand vermerkt ist — und an keiner anderen. Der Spielstand hält nur den jeweils
 * letzten Übergang (`lastSeasonSnapshot`); ältere Saisons bleiben deshalb leer, statt eine Zahl
 * zu erfinden.
 *
 * Warum für die Anzeige Quelltext-Prüfungen: das Projekt fährt vitest ohne jsdom, für den Drawer
 * gibt es keinen Render-Pfad ohne kompletten GameState (siehe
 * `trainingshistorie-herkunft-leistung.test.ts`).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildPlayerTrainingHistoryRows } from "@/lib/foundation/player-training-history";

const drawer = readFileSync(join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function ereignis(seasonId: string) {
  return {
    eventId: `evt-${seasonId}`,
    playerId: "p-1",
    seasonId,
    source: "organic_season_progression",
    timestamp: `2026-0${seasonId.endsWith("1") ? 1 : 2}-01T00:00:00.000Z`,
    upgrades: [{ attribute: "power", fromValue: 60, toValue: 61 }],
  } as never;
}

describe("Trainingshistorie · Potenzial-Drift je Saison", () => {
  it("trägt den Drift an genau der Saison, für die er vermerkt ist", () => {
    const rows = buildPlayerTrainingHistoryRows({
      progressionEvents: [ereignis("season-1"), ereignis("season-2")],
      potentialRecord: {
        hiddenPotentialScore: 77,
        lastSeasonSnapshot: { seasonId: "season-1", hiddenPotentialScore: 78 },
      },
    });
    const s1 = rows.find((row) => row.seasonId === "season-1");
    const s2 = rows.find((row) => row.seasonId === "season-2");
    expect(s1?.potentialBefore).toBe(78);
    expect(s1?.potentialAfter).toBe(77);
    // Saison 2 hat KEINEN vermerkten Übergang — und bekommt deshalb auch keinen.
    expect(s2?.potentialBefore).toBeNull();
    expect(s2?.potentialAfter).toBeNull();
  });

  it("erfindet ohne Potenzial-Record nichts", () => {
    const rows = buildPlayerTrainingHistoryRows({ progressionEvents: [ereignis("season-1")] });
    expect(rows[0]?.potentialBefore).toBeNull();
    expect(rows[0]?.potentialAfter).toBeNull();
  });

  it("lässt den Drift weg, wenn nur eine der beiden Zahlen dasteht", () => {
    // Halbe Angabe wäre schlimmer als keine: „78 → —" liest sich wie ein Verlust auf 0.
    const rows = buildPlayerTrainingHistoryRows({
      progressionEvents: [ereignis("season-1")],
      potentialRecord: {
        hiddenPotentialScore: null,
        lastSeasonSnapshot: { seasonId: "season-1", hiddenPotentialScore: 78 },
      },
    });
    expect(rows[0]?.potentialAfter).toBeNull();
  });

  it("hält den Anstieg genauso fest wie den Rückgang", () => {
    const rows = buildPlayerTrainingHistoryRows({
      progressionEvents: [ereignis("season-1")],
      potentialRecord: {
        hiddenPotentialScore: 81,
        lastSeasonSnapshot: { seasonId: "season-1", hiddenPotentialScore: 79 },
      },
    });
    expect(rows[0]?.potentialAfter! - rows[0]?.potentialBefore!).toBe(2);
  });
});

describe("Trainingshistorie · der Drift ist auch zu sehen", () => {
  it("steht in der zugeklappten Saisonzeile, nicht erst nach dem Klick", () => {
    // Er erklärt die FOLGE-Saison — dafür darf er nicht hinter einem Aufklapp-Chevron liegen.
    const zeile = drawer.slice(
      drawer.indexOf("player-drawer-training-season-toggle"),
      drawer.indexOf("player-drawer-training-origin-row"),
    );
    expect(zeile).toContain("player-drawer-training-season-potential");
    expect(zeile).toContain("entry.potentialDrift");
  });

  it("zeigt beide Zahlen, nicht nur die Differenz", () => {
    expect(drawer).toContain("PO {entry.potentialDrift.before}→{entry.potentialDrift.after}");
  });

  it("färbt Anstieg und Rückgang unterschiedlich", () => {
    expect(css).toContain(".player-drawer-training-season-potential.is-positive");
    expect(css).toContain(".player-drawer-training-season-potential.is-negative");
  });

  it("erklärt in der aufgeklappten Saison, dass der Drift die NÄCHSTE Saison betrifft", () => {
    // Ohne diesen Satz liest sich „PO −1" als Bewertung der abgelaufenen Saison.
    const notiz = drawer.slice(drawer.indexOf("player-drawer-training-season-potential-note"));
    expect(notiz.slice(0, 900)).toContain("nächsten");
  });

  it("sagt bei fehlendem Vorher-Wert, warum dort nichts steht", () => {
    // Chris' Regel: bei 0 wird erklärt, nicht versteckt — hier ist es „nicht festgehalten".
    expect(drawer).toContain("gespeichert wird nur der jeweils letzte Übergang");
  });

  it("rechnet den Drift nicht in die Netto-Summe der Saison", () => {
    // Potenzial ist die Obergrenze, keine Attributänderung. Landete es in Σ, stünde dort eine
    // Zahl, die kein Attribut je gesehen hat.
    expect(drawer).not.toMatch(/net:\s*row\.netSetpoints\s*\+/);
  });
});
