/**
 * GEMELDET: „da gibts nix zu entscheiden! natürlich muss season 1 immer auch den salary factor von
 * der ersten season nehmen. das wird dem spieler ja am anfang zb auch angezeigt faktor 1,19 da geht
 * man ja davon aus dass es gut geld gibt - also bitte fixen!"
 *
 * Er hat recht, und der Fehler war groesser als die Anzeige. `seasonState.seasonEconomyFactors`
 * wurde NUR beim Saisonuebergang geschrieben — in Saison 1 war die Liste leer. Wer sie roh liest,
 * fiel auf `?? 1` zurueck; wer sie ueber `getSeasonEconomyFactorWindow` ableitet, sah den echten
 * Wurf. Das Ergebnis waren zwei Antworten auf dieselbe Frage:
 *
 *   Finanzen / Saisonstand / KI-Vorausschau   → 1.09  (abgeleitet)
 *   Sponsor-Angebote / Abrechnung / Apron     → 1.00  (Ersatzwert)
 *
 * Gemessen ueber alle sechs Spielstaende dieses Containers war das Fenster ausnahmslos leer, der
 * ableitbare Wert dagegen immer vorhanden (1.09 / 1.20 / 0.84 / 0.98 / 1.07 / 1.21). Die 1.00 war
 * also nie „der Faktor der ersten Saison", sondern das Fehlen jeder Antwort.
 *
 * Gefixt wird an der Quelle, nicht an den Lesern: das Fenster wird beim Laden gefuellt, an genau
 * einer Stelle, durch die jeder Spielstand kommt. Danach lesen alle drei Sponsor-Leser (es sind
 * wirklich drei gleichlautende Funktionen) dieselbe Zahl wie die Finanzseite.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getSeasonEconomyFactorWindow, SEASON_ECONOMY_FACTOR_WINDOW_SIZE } from "@/lib/season/season-economy-factors";
import { advanceSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { getCurrentSponsorSalaryFactor } from "@/lib/sponsor/sponsor-economy-calibration";
import { getSponsorV3SalaryFactor } from "@/lib/sponsor/sponsor-v3-offer-service";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

function zustandMitFenster(fenster: ReturnType<typeof getSeasonEconomyFactorWindow>): GameState {
  return { season: { id: "season-1" }, seasonState: { seasonEconomyFactors: fenster } } as unknown as GameState;
}

describe("Saison 1 hat einen echten Salary Factor", () => {
  const fenster = getSeasonEconomyFactorWindow({ saveId: "save-test", seasonId: "season-1" });

  it("liefert ein volles Fenster, auch wenn im Spielstand nichts steht", () => {
    expect(fenster).toHaveLength(SEASON_ECONOMY_FACTOR_WINDOW_SIZE);
    expect(fenster.every((eintrag) => eintrag.factor > 0)).toBe(true);
  });

  it("wuerfelt im vorgesehenen Band, statt auf 1.00 zu fallen", () => {
    // [0.82, 1.24] laut season-economy-factors.ts. Eine glatte 1.00 waere hier der Verdachtsfall.
    for (const eintrag of fenster) {
      expect(eintrag.factor).toBeGreaterThanOrEqual(0.82);
      expect(eintrag.factor).toBeLessThanOrEqual(1.24);
    }
  });

  it("gibt demselben Spielstand bei jedem Laden dieselben Faktoren", () => {
    // Sonst haette dieselbe Saison je nach Ladevorgang anderes Geld — und der Wert, den die
    // Karte beim Unterschreiben zeigte, waere beim Abrechnen ein anderer.
    const nochmal = getSeasonEconomyFactorWindow({ saveId: "save-test", seasonId: "season-1" });
    expect(nochmal.map((e) => e.factor)).toEqual(fenster.map((e) => e.factor));
  });

  it("gibt verschiedenen Spielstaenden verschiedene Faktoren", () => {
    const anderer = getSeasonEconomyFactorWindow({ saveId: "save-anders", seasonId: "season-1" });
    expect(anderer.map((e) => e.factor)).not.toEqual(fenster.map((e) => e.factor));
  });

  /**
   * DIE ZUSAMMENFUEHRUNG. Vorher lasen diese Funktionen 1.00, waehrend die Finanzseite den
   * gewuerfelten Wert zeigte. Steht das Fenster im Spielstand, sind es dieselben Zahlen.
   */
  it("laesst Sponsor-Pfad und Finanz-Pfad dieselbe Zahl lesen", () => {
    const zustand = zustandMitFenster(fenster);
    expect(getCurrentSponsorSalaryFactor(zustand)).toBe(fenster[0]!.factor);
    expect(getSponsorV3SalaryFactor(zustand)).toBe(fenster[0]!.factor);
  });

  it("haelt den gezeigten Faktor beim Saisonuebergang durch", () => {
    // Was in Saison 1 als „Season +1" stand, muss in Saison 2 der laufende Faktor sein — sonst
    // waere die Vorausschau auf der Sponsorkarte eine Zahl, die nie eintritt.
    const uebergang = advanceSeasonEconomyFactorWindow({
      saveId: "save-test",
      fromSeasonId: "season-1",
      toSeasonId: "season-2",
      seasonState: { seasonEconomyFactors: fenster },
    });
    expect(uebergang.nextWindow[0]!.factor).toBe(fenster[1]!.factor);
    expect(uebergang.nextWindow[1]!.factor).toBe(fenster[2]!.factor);
  });
});

describe("Das Fenster wird beim Laden gefuellt", () => {
  const repo = quelle("lib/persistence/save-repository.ts");

  it("hat den Seed im Ladepfad, durch den jeder Spielstand kommt", () => {
    expect(repo).toContain("function withSeededSeasonEconomyFactors");
    expect(repo).toContain("withSeededSeasonEconomyFactors(hydrated, saveId)");
  });

  it("setzt ihn VOR die Sponsor-Normalisierung, die den Faktor schon liest", () => {
    const kette = repo.slice(repo.indexOf("const gameStateWithoutBaseline ="));
    const seedPos = kette.indexOf("withSeededSeasonEconomyFactors");
    const sponsorPos = kette.indexOf("withMigratedSponsorLadders");
    expect(seedPos).toBeGreaterThanOrEqual(0);
    expect(sponsorPos).toBeGreaterThanOrEqual(0);
    // Die Kette ist von innen nach aussen geschachtelt: der innerste Aufruf steht im Quelltext
    // SPAETER. Der Seed muss innen liegen, also nach der Migration im Text stehen.
    expect(seedPos).toBeGreaterThan(sponsorPos);
  });

  it("laesst ein bereits vollstaendiges Fenster unangetastet", () => {
    expect(repo).toContain("const deckungsgleich =");
    expect(repo).toContain("if (deckungsgleich) {");
  });

  it("nutzt dieselbe Ableitung wie die Finanzseite, statt eine zweite zu bauen", () => {
    // HIER STAND DIE IMPORT-ZEILE WOERTLICH, einzeilig. Sie ist an einem zweiten Import aus
    // demselben Modul zerbrochen (der Konjunktur-Waechter braucht zusaetzlich
    // SEASON_ECONOMY_FACTOR_WINDOW_SIZE und parseSeasonNumber) — obwohl die Zusage, um die es hier
    // geht, unveraendert galt. Geprueft wird deshalb die ZUSAGE: die Ableitung kommt aus DEM
    // gemeinsamen Modul, und der Ladepfad wuerfelt nicht selbst.
    expect(repo).toContain("getSeasonEconomyFactorWindow");
    expect(repo).toContain('from "@/lib/season/season-economy-factors"');
    // Kein eigener Wurf im Ladepfad — sonst haette man wieder zwei Wahrheiten.
    expect(repo).not.toContain("SALARY_FACTOR_ROLL_MIN");
  });
});

describe("Die Basis-Kachel ist weg", () => {
  // GEMELDET: „Basis braucht auch keine sau, man sieht ja platz 32 waere ja die basis!"
  const karte = quelle("components/foundation/sponsor/SponsorOfferCardNewLook.tsx");

  it("faellt unter V3 immer weg, nicht nur bei zufaelligem Gleichstand", () => {
    expect(karte).toContain('if (component.kind === "base" && presentation.v3) {');
    // Der alte Betragsvergleich ist raus — er haette die Kachel bei einer Rundungsdifferenz
    // wieder auftauchen lassen.
    expect(karte).not.toContain("Math.abs(component.rewardCash - v3Floor)");
    expect(karte).not.toContain("const v3Floor");
  });

  it("bleibt bei Altangeboten stehen, wo sie die einzige Quelle ist", () => {
    // Ohne V3-Block gibt es kein „Garantiert auf jedem Platz" — dort waere das Entfernen
    // ein Informationsverlust, kein Aufraeumen.
    expect(karte).toContain("presentation.v3) {");
  });
});
