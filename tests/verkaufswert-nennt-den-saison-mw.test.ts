/**
 * DER VERKAUFSPREIS SAGT, GEGEN WELCHEN MARKTWERT ER GERECHNET IST — UND DER KAUFPREIS IST BEZAHLT.
 *
 * GEMELDET VON CHRIS (bug-2026-08-14T07-31-29-113Z-zuxbr3, Lava Golem, Team S-C, Verkaufspanel):
 * „Beim Verkauf vs Marktwert hat Lava Golem z.B. +10,7 oben angezeigt. Wenn ich in sein Profil
 * schaue, steht dort vs Marktwert +9,3 vs Kaufpreis … IN der Erklärung steht auch Gekauft für 18,8
 * jetzt MW 19,1 denke dann ist oben bei den auslaufenden veträgen die zahl falsch."
 *
 * DIE ZAHLEN WAREN ALLE RICHTIG. Am Live-Abbild nachgerechnet (`new-game-1786626914058-hwz8fk`):
 * Lava Golem hat einen eingefrorenen Saison-MW von 18,78 und einen laufenden Marktwert von 19,10.
 * Beide hiessen in der Oberflaeche „Marktwert". Das Verkaufspanel rechnet gegen den
 * EINGEFRORENEN (18,78 × Faktor 1,57 = 29,48 → +10,70), das Profil zeigt den LAUFENDEN. Chris hat
 * die 18,8 folgerichtig fuer einen Kaufpreis gehalten — zwei verschiedene Groessen unter einem
 * Namen, und keine Anzeige sagte welche.
 *
 * WIE VERBREITET: im eingefrorenen Save gehen 335 von 336 Kaderspielern auseinander (im Mittel
 * 0,39, groesste Differenz 1,70). In den vier Live-Saves VOR dem Saisonende-Freeze: null von je
 * ~340 — dort faellt `baseMarketValue` mangels Snapshot auf dieselbe Live-Rechnung. Der
 * Widerspruch entsteht also genau dann, wenn verkauft werden darf.
 *
 * CHRIS' ENTSCHEIDUNG: „der Faktor basierend auf dem snapshot ist korrekt und ist der verkaufswert
 * für die season". An der RECHNUNG aendert sich deshalb nichts — nur der Name sagt jetzt, welcher
 * der beiden Marktwerte gemeint ist.
 *
 * ZWEITER, GETRENNTER BEFUND (beim Nachverfolgen gefunden, NICHT die Ursache der Meldung): in
 * `resolvePlayerEconomyContract` stand der gezahlte Kaufpreis erst an dritter Stelle hinter zwei
 * Marktwerten. Da ein berechneter Marktwert praktisch immer existiert, gewann er immer — die
 * Quellen-Kennung `"active_purchase_price"` war ein toter Zweig. Die beiden Stellen, an denen
 * Chris nachgesehen hat, waren davon nicht betroffen (sie fragen zuerst den Kadereintrag); der
 * Fehler trifft, wer den Wert direkt liest, und jeden Fall ohne Kadereintrag.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { SAISON_MW_ERKLAERUNG } from "@/lib/market/transfermarkt-sale-factor";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

const MODAL = readFileSync(
  join(process.cwd(), "app/foundation/transfermarkt-v2/FoundationMarketSellShellHost.tsx"),
  "utf8",
);
const PEEK = readFileSync(
  join(process.cwd(), "app/foundation/teams-v2/FoundationRosterSellPeekDrawer.tsx"),
  "utf8",
);
const TABELLE = readFileSync(
  join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"),
  "utf8",
);
const OEKONOMIE = readFileSync(
  join(process.cwd(), "lib/foundation/player-economy-contract.ts"),
  "utf8",
);

describe("Verkaufswert: der Saison-MW ist als solcher benannt", () => {
  it("die Erklaerung nennt beide Groessen — sonst loest sie die Verwechslung nicht auf", () => {
    expect(SAISON_MW_ERKLAERUNG).toContain("eingefroren");
    expect(SAISON_MW_ERKLAERUNG).toContain("Verkaufsfaktor");
    // Der entscheidende Halbsatz: dass der Wert im Profil abweichen DARF und trotzdem nicht gilt.
    expect(SAISON_MW_ERKLAERUNG).toMatch(/laufende.{0,40}Spielerprofil/);
  });

  it("alle drei Anzeigen teilen DIESELBE Erklaerung — je eigene driften wieder auseinander", () => {
    for (const quelle of [MODAL, PEEK, TABELLE]) {
      expect(quelle).toContain("SAISON_MW_ERKLAERUNG");
    }
  });

  it("das Verkaufs-Modal nennt die Basis „Saison-MW\", nicht mehr blank „MW\"", () => {
    expect(MODAL).toContain("auf Saison-MW");
    expect(MODAL).toContain("vs. Saison-MW:");
    // Die alten, mehrdeutigen Zeilen duerfen nicht zurueckkehren.
    expect(MODAL).not.toContain("auf MW{\" \"}");
    expect(MODAL).not.toContain("vs. Marktwert: {mwDiffText}");
  });

  it("der Prozentsatz-Zusatz spricht ebenfalls vom Saison-MW", () => {
    expect(MODAL).toContain('"über" : "unter"} Saison-MW`');
  });

  it("die Kachel „MW aktuell\" bleibt der LAUFENDE Wert — beide Zahlen stehen weiter da", () => {
    // Die Reparatur benennt, sie versteckt nicht. Waere hier kuenftig der eingefrorene Wert
    // eingesetzt, gaebe es die Information „was ist er heute wert" nirgends mehr.
    expect(MODAL).toContain("<span>MW aktuell</span>");
    expect(MODAL).toContain("context?.currentMarketValue ?? preview.marketValueReference");
  });

  it("der Kader-Peek zieht mit — sonst widerspricht er dem Modal ueber denselben Spieler", () => {
    expect(PEEK).toContain('label="vs. Saison-MW"');
    expect(PEEK).toContain("Saison-MW × Verkaufsfaktor");
    expect(PEEK).not.toContain('label="vs. Marktwert"');
  });

  it("die Spielertabelle erklaert den Verkaufspreis mit derselben Basis", () => {
    expect(TABELLE).toContain("Verkaufspreis = Saison-MW × Verkaufsfaktor");
    expect(TABELLE).not.toContain("Verkaufspreis = Marktwert × Verkaufsfaktor");
  });
});

describe("Kaufpreis: der gezahlte Preis gewinnt", () => {
  const SPIELER = {
    id: "p-1",
    name: "Testspieler",
    marketValue: 19.1,
    displayMarketValue: 19.1,
  } as never;

  it("liegt ein gezahlter Preis vor, steht genau der da — auch wenn ein Marktwert existiert", () => {
    const ergebnis = resolvePlayerEconomyContract({
      playerId: "p-1",
      player: SPIELER,
      rosterEntry: { playerId: "p-1", purchasePrice: 18.78 } as never,
    });
    expect(ergebnis.purchasePrice).toBe(18.78);
    expect(ergebnis.purchasePriceSource).toBe("active_purchase_price");
  });

  it("die Quellen-Kennung „active_purchase_price\" ist kein toter Zweig mehr", () => {
    // Genau das war der Beleg fuer den Fehler: die Aufzaehlung sah den Zweig vor, erreicht wurde
    // er nie. Ein Test auf den WERT allein wuerde das nicht festhalten — 18,78 koennte auch
    // zufaellig aus einer Marktwert-Kette fallen.
    expect(OEKONOMIE).toMatch(/const purchasePrice =\s*\n\s*rosterPurchasePriceOnDisplayScale \?\?/);
  });

  it("ALTE Staende in Hundertstel-Skala fallen weiter auf den Marktwert zurueck", () => {
    // Das hat der Bestand aufgedeckt, nicht der Entwurf: `purchasePrice: 40000` meint in alten
    // Spielstaenden 40,0. Der erste Anlauf reichte den Rohwert durch — heraus kam 400, weil
    // `normalizeStoredEconomyValue` nur durch 100 teilt. Aus dem Rohwert allein ist die Skala
    // nicht rekonstruierbar; ueber 1000 ist er fuer den Kaufpreis unbrauchbar.
    const ergebnis = resolvePlayerEconomyContract({
      playerId: "p-alt",
      player: { id: "p-alt", marketValue: 40000, displayMarketValue: 40 } as never,
      rosterEntry: { playerId: "p-alt", purchasePrice: 40000 } as never,
    });
    expect(ergebnis.purchasePrice).not.toBe(400);
    expect(ergebnis.purchasePrice).toBeCloseTo(40, 0);
    expect(ergebnis.purchasePriceSource).not.toBe("active_purchase_price");
  });

  it("ohne gezahlten Preis bleibt der Marktwert-Rueckfall — Bestandsstaende aendern sich nicht", () => {
    const ergebnis = resolvePlayerEconomyContract({
      playerId: "p-1",
      player: SPIELER,
      rosterEntry: null,
    });
    expect(ergebnis.purchasePrice).not.toBeNull();
    expect(ergebnis.purchasePriceSource).not.toBe("active_purchase_price");
  });

  it("die MARKTWERT-Kette bleibt unberuehrt — dort gewinnt weiter die Rechnung", () => {
    // Wichtig als Abgrenzung: geaendert wurde NUR der Kaufpreis. Waere die Marktwert-Kette
    // mitgedreht worden, zeigte jede Marktwert-Anzeige ploetzlich Ablösesummen.
    const ergebnis = resolvePlayerEconomyContract({
      playerId: "p-1",
      player: SPIELER,
      rosterEntry: { playerId: "p-1", purchasePrice: 18.78 } as never,
    });
    expect(ergebnis.marketValueSource).not.toBe("active_purchase_price");
    expect(ergebnis.marketValue).not.toBe(18.78);
  });
});
