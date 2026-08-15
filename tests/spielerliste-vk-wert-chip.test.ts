/**
 * GEMELDET (mit Screenshot der Spielerliste): „VK wert + wird hier falsch angezeigt, angeblich nur
 * geringes plus obwohl der Wert change eigentlich >12 mio oder so sein sollte."
 *
 * Auf dem Screenshot: MW 27,1 Mio, VK-Wert 41,5 Mio — und daneben ein Chip „+0,38". Die 14,4 Mio
 * Unterschied standen nirgends.
 *
 * DIE URSACHE. Der Chip zeigte `netProfitVsPurchase` = (Brutto − Rest-Buyout) − Kaufpreis, stand
 * aber neben dem BRUTTO-Preis. Der Buyout haengt am Vertrag und kommt in der Zeile gar nicht vor —
 * die Zahl war damit aus nichts Sichtbarem herleitbar. Am Spielstand nachgerechnet: bei einem
 * Spieler mit Brutto 92,8 und Kaufpreis 92,8 zeigte der Chip −28,32, und das war exakt der Buyout.
 *
 * Deshalb sah auf dem Screenshot ausgerechnet die zweite Zeile richtig aus (Vertrag 1J → Buyout 0
 * → Chip = Brutto − Kaufpreis = +7,4), die erste dagegen falsch (Vertrag 3J → grosser Buyout →
 * +0,38). Zwei Spieler mit demselben Wertzuwachs, zwei voellig verschiedene Chips, allein wegen
 * der Vertragslaenge.
 *
 * DIE ZUSAGE JETZT: der Chip ist der Aufschlag des Verkaufsfaktors, also VK-Wert − Marktwert.
 * Beide Zahlen stehen nebeneinander in derselben Zeile; die Rechnung geht auf dem Bildschirm auf.
 * Gemessen ueber alle 285 Kaderzeilen dieses Containers: die alte Zahl war in 3,5 % der Zeilen aus
 * MW und VK-Wert herleitbar, die neue in 100 %.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const quelle = readFileSync(join(process.cwd(), "app/foundation/players-table/FoundationPlayersTableNewLook.tsx"), "utf8");

/** Der Zellen-Block der VK-Wert-Spalte — sonst prueft man die Nachbarspalten mit. */
const zelle = (() => {
  const start = quelle.indexOf('{isColumnVisible("sellValue") ? (');
  expect(start).toBeGreaterThanOrEqual(0);
  const ende = quelle.indexOf('{isColumnVisible("salary") ? (', start);
  expect(ende).toBeGreaterThan(start);
  return quelle.slice(start, ende);
})();

describe("Der Chip neben dem VK-Wert ist nachrechenbar", () => {
  it("zeigt VK-Wert minus Marktwert", () => {
    expect(zelle).toContain("row.sellPreview.grossSalePrice - marketValue");
  });

  it("rechnet NICHT mehr mit dem Rest-Buyout, der in der Zeile nirgends steht", () => {
    // `profitVsPurchase` als CHIP-Wert war der Fehler: Netto minus Kaufpreis neben dem Brutto.
    expect(zelle).not.toContain("value={row.sellPreview.profitVsPurchase}");
  });

  it("nennt im Chip-Tooltip beide Summanden, damit die Rechnung nachvollziehbar ist", () => {
    expect(zelle).toContain("Aufschlag des Verkaufsfaktors");
    expect(zelle).toContain("Verkaufspreis − ");
    expect(zelle).toContain("Marktwert`");
  });

  /**
   * Nichts geht verloren: Buyout, Netto und der Gewinn gegenueber dem gezahlten Kaufpreis waren
   * echte Information. Sie steht weiter im Zellen-Tooltip — nur nicht mehr als Zahl, die neben
   * einem anderen Betrag steht und so tut, als gehoere sie dazu.
   */
  it("behaelt Buyout, Netto und Kaufpreis-Gewinn im Zellen-Tooltip", () => {
    expect(zelle).toContain("Rest-Buyout von");
    expect(zelle).toContain("netto.");
    expect(zelle).toContain("Gegenüber dem gezahlten Kaufpreis");
    expect(zelle).toContain("row.sellPreview.profitVsPurchase");
  });

  it("laesst den Chip weg, wenn kein Marktwert vorliegt, statt gegen 0 zu rechnen", () => {
    expect(zelle).toContain("marketValue == null || !Number.isFinite(marketValue)");
  });

  it("zeigt keinen Chip, wenn der Verkaufsfaktor nichts aendert", () => {
    // Wie die MW-Spalte nebenan. Im Browser gegengeprueft: in einem Spielstand mit Faktor 1,0
    // stand vorher in jeder Zeile ein Chip (−28,32 beim ersten Spieler), jetzt keiner.
    expect(zelle).toContain("Math.abs(aufschlag) < 0.005");
  });

  it("erklaert die Spalte im Kopf-Tooltip so, wie sie jetzt rechnet", () => {
    const kopf = quelle.slice(quelle.indexOf('id: "sellValue"'), quelle.indexOf('id: "salary"'));
    // „Saison-MW" statt „Marktwert" seit Report zuxbr3: gerechnet wird gegen den zum Saisonende
    // eingefrorenen Wert, nicht gegen den laufenden im Spielerprofil. Die Rechnung ist dieselbe
    // geblieben — nur hiessen beide Groessen vorher gleich.
    expect(kopf).toContain("VK-Wert minus Saison-MW");
    // Die alte Beschreibung versprach den Kaufpreis-Vergleich als Chip — genau die Zahl, die
    // nicht zum danebenstehenden Betrag passte.
    expect(kopf).not.toContain("Darunter Gewinn/Verlust gegenüber dem gezahlten Kaufpreis.");
  });
});
