import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Vertragstest der neuen Transfermarkt-Seite (18.11.): hält am Quelltext fest, was Chris vorgegeben hat und was die
 * alte Seite schon konnte. Die Seite selbst ist reiner Client-Code; geprüft wird, was sich nicht still ändern darf.
 */
const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");
const ORDNER = "app/foundation/transfermarkt-modern";
const DATEIEN = ["TransfermarktModern.tsx", "VerhandlungsTisch.tsx", "KaderAnsichten.tsx", "VergleichDialog.tsx", "tm-format.ts"];
const alle = DATEIEN.map((d) => lies(`${ORDNER}/${d}`)).join("\n");
const modern = lies(`${ORDNER}/TransfermarktModern.tsx`);
const tisch = lies(`${ORDNER}/VerhandlungsTisch.tsx`);

describe("Transfermarkt neu: Scouting-Nebel", () => {
  it("liest vom Feed-Eintrag keine wahren Werte (Achsen, Gesamt, MVS) — alles läuft über die Sicht", () => {
    for (const quelle of [modern, lies(`${ORDNER}/VergleichDialog.tsx`)]) {
      expect(quelle).not.toMatch(/\bitem\.(pow|spe|men|soc|ovr|mvs|powTier|speTier|menTier|socTier)\b/);
      expect(quelle).not.toMatch(/\.attributeStatValues\b/);
      expect(quelle).not.toMatch(/\.disciplineRatings\b[^\n]*item/);
    }
  });

  it("sortiert über die Sicht, nicht über die Rohzeilen", () => {
    expect(modern).toContain("sortiereNachSicht(");
    expect(modern).not.toMatch(/\.sort\(\s*\(a,\s*b\)\s*=>[^)]*item\./);
  });
});

describe("Transfermarkt neu: Vorgaben von Chris (18.11.)", () => {
  it("Einheit überall C, nie Mio", () => {
    expect(alle).not.toMatch(/\bMio\b/);
    expect(alle).toContain('" C"');
  });

  it("Fit, Value als Chip, Bracket und gespeicherte Suchen entfallen (Value nur als Sortierung)", () => {
    // „market_bracket_factor_preview_pending" ist ein unterdrückter Server-Code, kein Bedienelement.
    expect(alle.replace(/market_bracket_factor_preview_pending/g, "")).not.toMatch(/fitDisplay|\.fit\b|bracket|Gespeicherte|filterPresets|Bracket/);
    expect(modern).toContain('value: "Value"');
  });

  it("Gehalt steht je Spieltag UND je Saison", () => {
    expect(modern).toContain("je Saison");
    expect(modern).toContain("jeSpieltag(");
    expect(tisch).toContain("je Spieltag");
    expect(tisch).toContain("je Saison");
    expect(lies(`${ORDNER}/KaderAnsichten.tsx`)).toContain("je Saison");
  });

  it("Kaderstärke über die besten 6, nicht über Einsatzplätze", () => {
    expect(lies("lib/market/transfermarkt-kaderstaerke.ts")).toContain("export const KADER_TOP_ANZAHL = 6;");
  });

  it("Verkauf und Verträge zeigen die Saison-Leistung (PP mit Liga-Rang)", () => {
    const kader = lies(`${ORDNER}/KaderAnsichten.tsx`);
    expect(kader).toContain("ppsSeasonRank");
    expect(kader).toContain("Saison-PP");
  });

  it("Draft ist nur ein Platzhalter-Reiter", () => {
    expect(modern).toContain("tm-draft-platzhalter");
    expect(modern).toContain("tm-reiter-draft");
  });

  it("zeigt die Wichtigkeit je Disziplin (Auftritte, Slots) und sortiert danach", () => {
    expect(modern).toContain("bedarfUrteil(");
    expect(modern).toContain("wichtigkeit");
    expect(modern).toContain("Slots");
  });
});

describe("Transfermarkt neu: Verhandlungstisch", () => {
  it("zwei Schritte: Vorschau (dryRun true), dann Abschluss (dryRun false) über dieselben Routen wie bisher", () => {
    expect(tisch).toContain("/api/transfermarkt/buy");
    expect(tisch).toContain("/api/contracts/renewal");
    expect(tisch).toContain("dryRun: true");
    expect(tisch).toContain("dryRun: false");
  });

  it("Abschluss ist bis zur Zusage gesperrt und hängt an der harten Freigabe-Sperre", () => {
    expect(tisch).toMatch(/kannAbschliessen = antwort\?\.art === "ja"[^;]*!gesperrt/);
    expect(tisch).toContain("freigabeSperreFuerBetrag(");
  });

  it("schreibt das Verhandlungsgedächtnis wie die alte Seite", () => {
    expect(tisch).toContain("contract-negotiation-outcome");
    for (const status of ["countered", "accepted_pending_confirm", "rejected_bad_experience"]) expect(tisch).toContain(status);
  });

  it("eine zweite Kauflogik gibt es nicht: kein eigener Preis, kein eigener Abschluss außerhalb der Routen", () => {
    expect(alle).not.toMatch(/executeLocalTransfermarktBuy|executeLocalTransfermarktSell|applyContractRenewalAction/);
  });
});

describe("Transfermarkt neu: Verkauf", () => {
  it("zweistufige Bestätigung und Idempotenz-Schlüssel", () => {
    const kader = lies(`${ORDNER}/KaderAnsichten.tsx`);
    expect(kader).toContain("setBestaetigen(true)");
    expect(kader).toContain("tm-verkauf-bestaetigen");
    expect(kader).toContain("idempotencyKey");
    expect(kader).toContain("/api/transfermarkt/sell");
  });
});
