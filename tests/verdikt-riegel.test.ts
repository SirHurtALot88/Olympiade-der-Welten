/**
 * EIN ABGELEHNTES ANGEBOT DARF NICHT UNTERSCHRIEBEN WERDEN.
 *
 * Das Verdikt wurde berechnet, angezeigt — und beim Schreiben ignoriert. Am echten Spielstand
 * gemessen, bevor der Riegel drin war:
 *
 *     Angebot 18,39 (100 %)  verdict counter_money    canBuy true  blocker []
 *     Angebot  9,20 ( 50 %)  verdict reject_lowball   canBuy true  blocker []
 *     Angebot  3,68 ( 20 %)  verdict reject_lowball   canBuy true  blocker []
 *     Angebot  0,92 (  5 %)  verdict reject_lowball   canBuy true  blocker []
 *
 * Wer den Aufruf direkt absetzte, unterschrieb also einen Vertrag, den der Spieler gerade
 * abgelehnt hatte. Der Riegel haengt an derselben Stelle wie jeder andere Blocker, damit Vorschau
 * und Schreibweg dieselbe Antwort geben.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VERDIKT_ABGELEHNT_BLOCKER,
  istVerdiktAblehnung,
  verdiktBlocker,
  type NegotiationVerdict,
} from "@/lib/market/contract-negotiation-preview";

describe("Nur ein Nein ist ein Nein", () => {
  const ablehnungen: NegotiationVerdict[] = ["reject_lowball", "reject_not_about_money", "reject_affront"];
  const weiterreden: NegotiationVerdict[] = ["accept", "counter_money", "counter_conditions"];

  for (const verdict of ablehnungen) {
    it(`\`${verdict}\` blockiert`, () => {
      expect(istVerdiktAblehnung(verdict)).toBe(true);
      expect(verdiktBlocker(verdict)).toEqual([VERDIKT_ABGELEHNT_BLOCKER]);
    });
  }

  for (const verdict of weiterreden) {
    it(`\`${verdict}\` blockiert NICHT`, () => {
      // Ein Gegenangebot ist kein Nein — der Spieler redet weiter, und der Verhandlungsweg ist
      // genau dafuer gebaut. Selbst ein Angebot in Hoehe der vollen Forderung kommt beim Kauf als
      // `counter_money` zurueck; ein Riegel dagegen wuerde den normalen Kauf sperren.
      expect(istVerdiktAblehnung(verdict)).toBe(false);
      expect(verdiktBlocker(verdict)).toEqual([]);
    });
  }

  it("ohne Verdikt wird nicht blockiert", () => {
    // Nicht jeder Pfad verhandelt: die KI-Massenkaeufe bieten die volle Forderung und bauen gar
    // keine Verhandlungsvorschau. Kein Verdikt heisst dort „nichts abgelehnt", nicht „abgelehnt".
    expect(verdiktBlocker(null)).toEqual([]);
    expect(verdiktBlocker(undefined)).toEqual([]);
  });
});

describe("Beide Schreibwege halten sich daran", () => {
  const kauf = readFileSync(join(process.cwd(), "lib/market/transfermarkt-local-service.ts"), "utf8");
  const verlaengerung = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");

  it("der Kauf entscheidet `canBuy` erst NACH der Verhandlungsvorschau", () => {
    // Der eigentliche Fehler war die Reihenfolge: `canBuy` stand oberhalb der Vorschau, das
    // Verdikt konnte gar nicht einfliessen.
    // Seit 19.11. bucht der Liga-Draft zu Festkonditionen (Chris: „direkt gepickt zu den Konditionen, die
    // angegeben sind"); fuer alle anderen Kaeufe bleibt das Gehalt das der Verhandlungsvorschau.
    const indexVorschau = kauf.indexOf("(negotiationPreview.offeredSalary ?? salary);");
    const indexCanBuy = kauf.indexOf("const canBuy = blockingReasonsMitVerdikt.length === 0;");
    expect(indexVorschau).toBeGreaterThan(0);
    expect(indexCanBuy).toBeGreaterThan(indexVorschau);
  });

  it("nur der Liga-Draft (draftFestkonditionen) darf am Verdikt vorbei kaufen", () => {
    expect(kauf).toContain("const festkonditionen = params.draftFestkonditionen === true && salary != null;");
    expect(kauf).toContain(
      // Seit der Werbeklausel (23.11.) haengt dahinter noch der Klausel-Blocker; Festkonditionen bleiben davon frei.
      "const blockingReasonsMitVerdikt = festkonditionen ? [...blockingReasons] : [...blockingReasons, ...verdiktBlocker(negotiationPreview.verdict), ...klauselBlocker];",
    );
    const setzer = ["lib/draft/liga-draft-dienst.ts", "lib/market/transfermarkt-local-service.ts"];
    for (const datei of setzer) expect(readFileSync(join(process.cwd(), datei), "utf8")).toContain("draftFestkonditionen");
  });

  it("der Kauf nimmt den Verdikt-Blocker in seine Blockerliste auf", () => {
    expect(kauf).toContain("...verdiktBlocker(negotiationPreview.verdict)");
    expect(kauf).toContain("blockingReasons: blockingReasonsMitVerdikt,");
  });

  it("die Verlängerung zieht ihn in `ok` UND in die Blockerliste", () => {
    // `applyContractRenewalAction` haengt an `preview.ok` — beides muss stimmen, sonst meldet die
    // Vorschau einen Blocker, den der Schreibweg nicht kennt, oder umgekehrt.
    expect(verlaengerung).toContain("const verdiktBlockingReasons = verdiktBlocker(negotiationPreview?.verdict);");
    // Seit der Werbeklausel (23.11.) folgt in `ok` noch der Klausel-Blocker, daher `,` oder `&&`.
    expect(verlaengerung).toMatch(/verdiktBlockingReasons\.length === 0\s*(,|&&)/);
    expect(verlaengerung).toContain("klauselBlockingReasons.length === 0,");
    expect(verlaengerung).toContain("...verdiktBlockingReasons,");
  });
});
