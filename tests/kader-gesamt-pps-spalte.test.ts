/**
 * GEMELDET: „Und mir fehlt noch eine Spalte für die Gesamt PPs die der spieler geholt hat."
 *
 * Die Kader-/Verträge-Tabelle hatte eine PPs-Zelle — die zeigte aber die vier Achsen einzeln
 * (POW/SPE/MEN/SOC) plus einen Aufklapper für die Disziplin-PPs. Die Summe stand nirgends, und
 * vier Balken im Kopf zu addieren ist keine Antwort auf „wie viel hat der Spieler geholt".
 *
 * WICHTIG ist dabei die Quelle: die Summe kommt aus `playerPps` (Season-Points-Ledger) —
 * derselben Zahl, die die Spielerliste als „PPs" führt. Die vier Achsenwerte nachzuaddieren
 * waere eine zweite Rechnung fuer dieselbe Groesse und damit die naechste Stelle, an der zwei
 * Ansichten verschiedene Zahlen fuer denselben Spieler zeigen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const QUELLE = readFileSync(join(process.cwd(), "app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx"), "utf8");

describe("Kader-Tabelle: Spalte für die Gesamt-PPs", () => {
  it("führt eine eigene Spalte mit sprechendem Kopf", () => {
    expect(QUELLE).toContain('key: "ppsTotal"');
    expect(QUELLE).toContain('label: "PPs ges."');
  });

  it("liest die Summe aus dem Ledger statt die vier Achsen nachzuaddieren", () => {
    const zelle = QUELLE.slice(QUELLE.indexOf('case "ppsTotal": {'), QUELLE.indexOf('case "pps": {'));
    expect(zelle).toContain("playerPps");
    for (const achse of ["ppPow", "ppSpe", "ppMen", "ppSoc"]) {
      expect(zelle).not.toContain(achse);
    }
  });

  it("bleibt sortierbar — sonst nuetzt die Zahl beim Kadervergleich nichts", () => {
    const sortierung = QUELLE.slice(QUELLE.indexOf('case "ppsTotal":'), QUELLE.indexOf('case "ppsTotal": {'));
    expect(sortierung).toContain("playerPps");
  });

  it("sagt Gedankenstrich statt einer erfundenen Null, wenn der Spieler keine PPs hat", () => {
    const zelle = QUELLE.slice(QUELLE.indexOf('case "ppsTotal": {'), QUELLE.indexOf('case "pps": {'));
    expect(zelle).toContain('return "—"');
  });

  it("laesst die Achsen-Aufschluesselung daneben unangetastet", () => {
    // Die neue Spalte ergaenzt, sie ersetzt nicht: die vier Chips und der Disziplin-Aufklapper
    // bleiben, denn sie beantworten eine andere Frage (wo kamen die Punkte her).
    expect(QUELLE).toContain('key: "pps"');
    expect(QUELLE).toContain("selected-roster-pps-diszi-toggle");
  });
});
