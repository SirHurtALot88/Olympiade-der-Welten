/**
 * FORMKARTEN: DAS PAAR MUSS UNABHAENGIG GEZOGEN WERDEN.
 *
 * GEMELDET VON CHRIS: „es soll ne positive und ne negative sein aber beide sind random und
 * unabhaengig voneinander bei den formkarten!"
 *
 * Waren sie nicht. Jeder Spieler bekam ein exakt GESPIEGELTES Paar — +8/−8, +4/−4, +2/−2, 0/0 —
 * und zwar in 100,0 % der Faelle, nachgemessen ueber 20.000 Spieler. Im Live-Save steht genau das:
 * 680 Karten der Saison 2, Nennwertsumme exakt 0.
 *
 * URSACHE (kein Zufall, eine Kollision): `pickDeterministicCardValue` nahm `hashSeed(seed) % 4` und
 * behielt damit nur die untersten ZWEI Bits eines FNV-1a-Hashes. Modulo 4 haengt der Hash-Schritt
 * `h ← (h ⊕ c) · 16777619` nur an den untersten zwei Bits jedes Zeichens, und 16777619 ≡ 3 (mod 4).
 * In dieser Arithmetik laufen die Zustaende von „:positive" und „:negative" nach dem vierten
 * Zeichen zusammen — der Rest der beiden Woerter ist identisch, also bleiben sie es. Zwei
 * verschiedene Seeds, garantiert dasselbe Ergebnis.
 *
 * Behoben mit einem Lawinenschritt (murmur3 `fmix32`) vor dem Modulo. Diese Suite haelt das fest,
 * und zwar an der Eigenschaft, nicht an einzelnen Zahlen: eine spaetere Aenderung am Hash darf die
 * Werte gern verschieben, aber die Unabhaengigkeit nicht wieder verlieren.
 */
import { describe, expect, it } from "vitest";

import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { buildGeneratedFormCardRecordsForTeam } from "@/lib/lineups/legacy-lineup-modifiers";

/** Die vier moeglichen Nennwerte des Generators. */
const NENNWERTE = [0, 2, 4, 8];

function createPlayer(id: string): Player {
  return {
    id,
    name: id,
    rating: 50,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    pps: null,
    ovr: null,
    // „Berserker" steht im CLASS_COLOR_MAP (rot). Ohne Kartenfarbe erzeugt der Generator bewusst
    // gar keine Karte — der Test wuerde dann am falschen Ende messen.
    className: "Berserker",
    race: "Human",
    alignment: "N",
    gender: "f",
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    preferredDisciplineIds: [],
    disciplineRatings: { d1: 10, d2: 10 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: 0,
    portraitPath: null,
    portraitUrl: null,
  } as Player;
}

function createRosterEntry(playerId: string): RosterEntry {
  return { id: `r-${playerId}`, teamId: "A-A", playerId } as RosterEntry;
}

/** Ein Kader mit `count` Spielern — gross genug, dass eine Verteilung etwas aussagt. */
function buildGameState(count: number): GameState {
  const players = Array.from({ length: count }, (_, index) => createPlayer(`player-${index}`));
  return {
    players,
    rosters: players.map((player) => createRosterEntry(player.id)),
  } as unknown as GameState;
}

function zieheKartenpaare(count: number) {
  const cards = buildGeneratedFormCardRecordsForTeam(buildGameState(count), "save-1", "season-7", "A-A");
  const paare: Array<{ positiv: number; negativ: number }> = [];
  for (const card of cards) {
    if (!card.id.endsWith(":positive")) continue;
    const gegenstueck = cards.find((entry) => entry.id === card.id.replace(/:positive$/, ":negative"));
    expect(gegenstueck, `kein negatives Gegenstueck zu ${card.id}`).toBeDefined();
    paare.push({ positiv: card.cardValue, negativ: Math.abs(gegenstueck!.cardValue) });
  }
  return paare;
}

describe("Formkarten: positives und negatives Blatt werden getrennt gezogen", () => {
  const paare = zieheKartenpaare(1200);

  it("erzeugt zu jedem Spieler genau ein Paar aus positiver und negativer Karte", () => {
    const cards = buildGeneratedFormCardRecordsForTeam(buildGameState(20), "save-1", "season-7", "A-A");
    expect(cards).toHaveLength(40);
    expect(cards.filter((card) => card.cardValue > 0).length + cards.filter((card) => card.cardValue === 0).length).toBeGreaterThan(0);
    // Vorzeichen: die „positive" Karte ist nie negativ, die „negative" nie positiv.
    for (const card of cards) {
      if (card.id.endsWith(":positive")) expect(card.cardValue).toBeGreaterThanOrEqual(0);
      else expect(card.cardValue).toBeLessThanOrEqual(0);
    }
  });

  /**
   * DER KERN. Bei zwei unabhaengigen Ziehungen aus vier gleich wahrscheinlichen Werten sind rund
   * 25 % der Paare betragsgleich. Vorher waren es 100 %.
   *
   * Die Schranke ist bewusst weit (10 % bis 45 %): geprueft wird „unabhaengig", nicht „exakt 25,0",
   * damit der Test nicht bei jeder Hash-Aenderung umkippt. Der alte Zustand liegt weit ausserhalb.
   */
  it("zieht die Betraege unabhaengig voneinander — kein gespiegeltes Paar mehr", () => {
    const betragsgleich = paare.filter((paar) => paar.positiv === paar.negativ).length;
    const anteil = betragsgleich / paare.length;
    expect(paare.length).toBeGreaterThan(1000);
    expect(anteil, `betragsgleiche Paare: ${(anteil * 100).toFixed(1)}%`).toBeGreaterThan(0.1);
    expect(anteil, `betragsgleiche Paare: ${(anteil * 100).toFixed(1)}%`).toBeLessThan(0.45);
  });

  /**
   * Die Gegenprobe zur Unabhaengigkeit: alle 16 Kombinationen muessen ueberhaupt vorkommen. Waeren
   * die Ziehungen weiterhin gekoppelt, blieben nur die vier Diagonalfelder besetzt — genau das war
   * der Befund.
   */
  it("erreicht alle 16 Kombinationen aus positivem und negativem Nennwert", () => {
    const gesehen = new Set(paare.map((paar) => `${paar.positiv}/${paar.negativ}`));
    for (const positiv of NENNWERTE) {
      for (const negativ of NENNWERTE) {
        expect(gesehen.has(`${positiv}/${negativ}`), `Kombination ${positiv}/${negativ} kommt nie vor`).toBe(true);
      }
    }
  });

  /**
   * Und beide Seiten fuer sich muessen die vier Nennwerte ungefaehr gleich oft treffen. Ohne diese
   * Zeile koennte ein kaputter Hash die Unabhaengigkeit vortaeuschen, indem er eine Seite auf einen
   * Wert festnagelt und die andere streuen laesst.
   */
  it("streut beide Seiten ueber alle vier Nennwerte", () => {
    for (const seite of ["positiv", "negativ"] as const) {
      for (const wert of NENNWERTE) {
        const treffer = paare.filter((paar) => paar[seite] === wert).length;
        const anteil = treffer / paare.length;
        expect(anteil, `${seite} = ${wert}: ${(anteil * 100).toFixed(1)}%`).toBeGreaterThan(0.15);
        expect(anteil, `${seite} = ${wert}: ${(anteil * 100).toFixed(1)}%`).toBeLessThan(0.35);
      }
    }
  });

  /**
   * Deterministisch bleibt es trotzdem: derselbe Spielstand erzeugt dieselben Karten. Sonst
   * wuerde jeder Neustart die Hand des Spielers neu mischen.
   */
  it("bleibt bei gleichem Seed reproduzierbar", () => {
    const ersterLauf = buildGeneratedFormCardRecordsForTeam(buildGameState(30), "save-1", "season-7", "A-A");
    const zweiterLauf = buildGeneratedFormCardRecordsForTeam(buildGameState(30), "save-1", "season-7", "A-A");
    expect(zweiterLauf.map((card) => card.cardValue)).toEqual(ersterLauf.map((card) => card.cardValue));
  });
});
