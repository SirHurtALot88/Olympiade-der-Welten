/**
 * SCHRITT 6b: DIE ZWEI ZIELE — und was sie besser machen als die fünf Achsen.
 *
 * Der eine Unterschied, an dem alles hängt, und deshalb steht er ganz oben in dieser Suite:
 * **`p = 0`, also kein Sockelabzug.** Das alte Modell zog −p·G immer ab und zahlte bei Erfolg +G;
 * über die ganze Liga ergab die Zielzeile in Saison 1 −89,7 C bei 0 von 27 erreichten Zielen. Eine
 * Zeile, die praktisch nur kostet, ist kein Ziel, sondern eine Steuer.
 *
 * Der zweite: beide Ziele sind BINÄR und in einem Satz nachvollziehbar. Eine Teilerfüllung von 63 %
 * lässt sich niemandem erklären, der nicht die Formel kennt.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import {
  baueAchsenLatte,
  baueLeihZielKomponente,
  frischeAnteilPct,
  istLeihZiel,
  LEIH_ZIEL_ACHSENRANG,
  LEIH_ZIEL_FRISCHE,
  LEIH_ZIEL_FRISCHE_SCHWELLE,
  SPONSOR_LEIH_BONUS,
  werteLeihZiel,
} from "@/lib/sponsor/sponsor-leih-ziele";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";

function baueSpielstand(fatigueWerte: number[]): GameState {
  return {
    season: { id: "s1" },
    teams: [{ teamId: "M-M", name: "Mayhem", shortCode: "M-M", cash: 50, rosterLimit: 14 }],
    players: fatigueWerte.map((fatigue, index) => ({ id: `p-${index}`, name: `Spieler ${index}`, fatigue })),
    rosters: fatigueWerte.map((_, index) => ({ id: `r-${index}`, teamId: "M-M", playerId: `p-${index}` })),
    // `buildTeamSeasonOverviewRows` (fuer den Achsen-Rang) braucht einen vollstaendigen Spielstand.
    // Die leeren Listen sind kein Fuellmaterial: sie sind die ehrliche Ausgangslage „Saison noch
    // nicht gelaufen", und genau daran haengt der Test unten, dass es dann KEINEN Rang gibt.
    disciplines: [],
    teamIdentities: [],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    matchdayState: { matchdayId: "md-1", status: "planning", pendingTeamIds: [], resolvedFixtureIds: [] },
    seasonState: {
      seasonId: "s1",
      schedule: [],
      standings: {},
      matchdayResults: [],
      disciplineResults: [],
      playerAvailabilityState: fatigueWerte.map((fatigue, index) => ({
        playerId: `p-${index}`,
        teamId: "M-M",
        fatigue,
      })),
    },
  } as unknown as GameState;
}

describe("Frische", () => {
  it("zaehlt den Anteil des Kaders unter der Fatigue-Grenze", () => {
    // Sieben von zehn unter 45 — genau die Schwelle.
    expect(frischeAnteilPct(baueSpielstand([10, 10, 10, 10, 10, 10, 10, 90, 90, 90]), "M-M")).toBe(70);
    expect(frischeAnteilPct(baueSpielstand([90, 90, 90, 90]), "M-M")).toBe(0);
  });

  it("wertet BINAER: knapp verfehlt ist verfehlt", () => {
    const komponente = baueLeihZielKomponente({
      gameState: baueSpielstand([10]),
      teamId: "M-M",
      key: LEIH_ZIEL_FRISCHE,
    });

    // 70 % genau: geschafft.
    expect(werteLeihZiel(baueSpielstand([10, 10, 10, 10, 10, 10, 10, 90, 90, 90]), "M-M", komponente).fraction).toBe(1);
    // 60 %: nichts. Keine Teilerfuellung, keine Zwischenstufe.
    expect(werteLeihZiel(baueSpielstand([10, 10, 10, 10, 10, 10, 90, 90, 90, 90]), "M-M", komponente).fraction).toBe(0);
  });

  it("friert die Schwelle im Vertrag ein, statt sie spaeter neu zu lesen", () => {
    const komponente = baueLeihZielKomponente({
      gameState: baueSpielstand([10]),
      teamId: "M-M",
      key: LEIH_ZIEL_FRISCHE,
    });
    expect(komponente.targetValue).toBe(`frischeschwelle:${LEIH_ZIEL_FRISCHE_SCHWELLE}`);

    // Ein Vertrag mit einer ANDEREN eingefrorenen Schwelle rechnet auch gegen diese.
    const streng: SponsorOfferComponent = { ...komponente, targetValue: "frischeschwelle:90" };
    const spielstand = baueSpielstand([10, 10, 10, 10, 10, 10, 10, 10, 90, 90]);
    expect(werteLeihZiel(spielstand, "M-M", komponente).fraction).toBe(1);
    expect(werteLeihZiel(spielstand, "M-M", streng).fraction).toBe(0);
  });

  it("hat kein Team ohne Kader auf 100 %", () => {
    // Division durch die Kadergroesse: ohne Spieler waere jede Quote definierbar. 0 ist die einzige
    // Lesart, die kein Ziel verschenkt.
    expect(frischeAnteilPct(baueSpielstand([]), "M-M")).toBe(0);
  });
});

describe("Die Achsen-Latte", () => {
  it("gibt der Spitze Spielraum nach unten und verlangt vom Keller Bewegung", () => {
    // Die Richtung ist bewusst nicht symmetrisch: wer oben steht, kann kaum steigen; wer unten
    // steht, kann kaum fallen. Eine gleiche Latte fuer beide waere fuer den einen geschenkt und fuer
    // den anderen unerreichbar.
    expect(baueAchsenLatte(3)).toBe(5);
    expect(baueAchsenLatte(8)).toBe(10);
    expect(baueAchsenLatte(14)).toBe(14);
    expect(baueAchsenLatte(24)).toBe(24);
    expect(baueAchsenLatte(28)).toBe(26);
    expect(baueAchsenLatte(32)).toBe(30);
  });

  it("bleibt in der Tabelle", () => {
    for (let rang = 1; rang <= 32; rang += 1) {
      const latte = baueAchsenLatte(rang);
      expect(latte).toBeGreaterThanOrEqual(1);
      expect(latte).toBeLessThanOrEqual(32);
    }
  });

  it("verlangt nie einen Sprung nach oben", () => {
    // Die alte Zielfalle: eine Latte ueber dem eigenen Rang. Fuer die Spitze und die Mitte darf die
    // Latte deshalb nie besser sein als der Startrang selbst.
    for (let rang = 1; rang <= 24; rang += 1) {
      expect(baueAchsenLatte(rang), `Rang ${rang}`).toBeGreaterThanOrEqual(rang);
    }
  });
});

describe("Der Achsen-Rang als Ziel", () => {
  it("schenkt nichts, wenn es gar keinen Rang gibt", () => {
    // „Nichts geholt" ist etwas anderes als „letzter Platz" — und darf kein Ziel erfuellen.
    const komponente: SponsorOfferComponent = {
      componentId: "leih-ziel",
      kind: "special",
      specialKey: LEIH_ZIEL_ACHSENRANG,
      label: "Bonus",
      targetValue: "achse:pow;latte:16;start:16",
      rewardCash: 0,
    };
    // Ein Team, das gar nicht in der Liga steht, hat keine Zeile und damit keinen Rang.
    const stand = werteLeihZiel(baueSpielstand([]), "X-X", komponente);
    expect(stand.fraction).toBe(0);
    expect(stand.reachedLabel).toContain("kein Rang");
  });

  it("gibt einem Team mit NULL Achsenpunkten trotzdem einen Rang — Gleichstand zaehlt als letzter", () => {
    // Bewusst festgehalten, weil es beim Schreiben dieses Tests ueberrascht hat: 0 Punkte sind eine
    // gueltige Zahl, also bekommt das Team einen Rang. In einer echten Liga stehen vor dem ersten
    // Spieltag ALLE auf 0 — die Gleichstands-Regel aus `buildValueRanks` gibt dann jedem den
    // schlechtesten Rang der Gruppe, also den letzten Platz. Genau so zeigt es auch der Saisonstand.
    const komponente: SponsorOfferComponent = {
      componentId: "leih-ziel",
      kind: "special",
      specialKey: LEIH_ZIEL_ACHSENRANG,
      label: "Bonus",
      targetValue: "achse:pow;latte:16;start:16",
      rewardCash: 0,
    };
    const stand = werteLeihZiel(baueSpielstand([10]), "M-M", komponente);
    expect(stand.metric).toBe(1);
    expect(stand.reachedLabel).toContain("Kraft-Rang 1");
  });
});

describe("Der Bonus selbst", () => {
  it("ist fest und klein — ein Erfolgserlebnis, kein Etat-Hebel", () => {
    // Bei Kartenwerten zwischen 52 und 107 C sind 6 C rund 6 bis 10 %.
    expect(SPONSOR_LEIH_BONUS).toBe(6);
  });

  it("wird vom bestehenden Auswerter erkannt, ohne die Achsen anzufassen", () => {
    // Die Zielauswertung ist EINE Stelle. Der neue Zweig muss dort greifen, sonst laufen Anzeige und
    // Settlement auseinander — der Fehler, den dieses Projekt schon mehrfach hatte.
    expect(istLeihZiel(LEIH_ZIEL_FRISCHE)).toBe(true);
    expect(istLeihZiel(LEIH_ZIEL_ACHSENRANG)).toBe(true);
    expect(istLeihZiel("axis_v4_kaderpflege")).toBe(false);

    const komponente = baueLeihZielKomponente({
      gameState: baueSpielstand([10]),
      teamId: "M-M",
      key: LEIH_ZIEL_FRISCHE,
    });
    const stand = evaluateSpecialComponentStage(
      baueSpielstand([10, 10, 10, 10, 10, 10, 10, 90, 90, 90]),
      "M-M",
      komponente,
    );
    expect(stand.fraction).toBe(1);
    expect(stand.reachedLabel).toContain("70 %");
  });
});
