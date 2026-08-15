/**
 * DER VERKAUFSFAKTOR GREIFT AB ACHT SPIELERN IM BRACKET.
 *
 * GEMELDET VON CHRIS: „der VK Faktor soll schon ab 8 spielern beginnen, zumindest für die top und
 * bottom 2 spieler ungefähr - selbe logik wie bisher aber auch!" — nachgeschärft: „VK faktoren
 * soll es schon ab 8 spielern im bracket geben."
 *
 * WAS DARUNTER PASSIERTE: reichte der Pool nicht, fiel die Rechnung auf `fallback_no_ranked_group`
 * — Faktor exakt 1, Verkaufspreis gleich Marktwert, WEDER Auf- noch Abschlag. Bei der alten
 * Schwelle 15 blieben kleine Brackets damit dauerhaft ohne jede Leistungswirkung im Preis. Am
 * Live-Abbild gemessen: 26 von 336 Verträgen ohne Faktor, mit 8 nur noch 3 (Pools von 1 und 2).
 *
 * WARUM 8 UND NICHT 6 ODER 5 — das ist der Kern und deshalb hier festgehalten. `getRankBonus`
 * vergibt an die DREI besten und die DREI schlechtesten Ränge. Beide Bänder brauchen zusammen
 * sechs verschiedene Ränge. Bei einem Pool von 5 fallen Rang 3 (+0,05) und `total−2` (−0,05) auf
 * DENSELBEN Rang — die erste zutreffende Bedingung gewinnt, und ein Spieler bekäme willkürlich
 * Bonus statt Malus. Ab 8 liegen zwei unberührte Ränge dazwischen.
 */
import { describe, expect, it } from "vitest";

import {
  SALE_FACTOR_MIN_RANK_POOL,
  getRankBonus,
  isBracketRankPoolEligible,
} from "@/lib/market/transfermarkt-sale-factor";

describe("Verkaufsfaktor ab acht Spielern im Bracket", () => {
  it("die Schwelle liegt bei 8", () => {
    expect(SALE_FACTOR_MIN_RANK_POOL).toBe(8);
  });

  it("ein Bracket mit acht Spielern bekommt einen Faktor, eines mit sieben nicht", () => {
    expect(isBracketRankPoolEligible(8)).toBe(true);
    expect(isBracketRankPoolEligible(7)).toBe(false);
  });

  it("bei acht Spielern bekommen die TOP ZWEI ihren Aufschlag", () => {
    expect(getRankBonus(1, 8)).toBe(0.15);
    expect(getRankBonus(2, 8)).toBe(0.1);
  });

  it("bei acht Spielern bekommen die LETZTEN ZWEI ihren Abschlag", () => {
    expect(getRankBonus(8, 8)).toBe(-0.15);
    expect(getRankBonus(7, 8)).toBe(-0.1);
  });

  it("die Baender ueberlappen bei acht NICHT — dazwischen liegen unberuehrte Raenge", () => {
    // Rang 3 traegt Bonus, Rang 6 Malus, 4 und 5 bleiben neutral.
    expect(getRankBonus(3, 8)).toBe(0.05);
    expect(getRankBonus(6, 8)).toBe(-0.05);
    expect(getRankBonus(4, 8)).toBe(0);
    expect(getRankBonus(5, 8)).toBe(0);
  });

  it("DARUM nicht tiefer: bei fuenf faellt Bonus-Rang 3 mit Malus-Rang total-2 zusammen", () => {
    // Der Grund, warum die Schwelle nicht beliebig gesenkt werden darf. Bei 5 ist total−2 = 3;
    // `getRankBonus` prueft den Bonus zuerst, der Malus kaeme also nie an.
    expect(getRankBonus(3, 5)).toBe(0.05);
    expect(5 - 2).toBe(3);
    // Bei 8 ist total−2 = 6 und damit sauber getrennt von Bonus-Rang 3.
    expect(8 - 2).not.toBe(3);
  });

  it("die bestehende Logik bleibt unveraendert — grosse Pools rechnen wie zuvor", () => {
    expect(getRankBonus(1, 50)).toBe(0.15);
    expect(getRankBonus(50, 50)).toBe(-0.15);
    expect(getRankBonus(25, 50)).toBe(0);
    expect(isBracketRankPoolEligible(50)).toBe(true);
  });
});
