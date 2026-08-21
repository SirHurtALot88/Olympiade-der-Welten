/**
 * GEMELDET VON CHRIS: „so jetzt wollte ich xelara verlängern, verhandeln ging sie hat angenommen
 * aber die verlängerung hat nicht funktioniert - oder man sieht es nicht."
 *
 * Sie hatte funktioniert. Sie schrieb nur `LZ 0 -> 1`, und 1 heisst „auslaufend" — aus seiner
 * Sicht passierte damit nichts, und er verlaengerte ein zweites Mal. Aus den Vertragsereignissen
 * seines Spielstands:
 *
 *     19:27:02  Tick lief nach   -> Xelara LZ 0, Entscheidung offen
 *     19:27:20  Verlaengerung    -> LZ 0 -> 1   Gehalt 5,00 -> 5,50
 *     19:29:05  Verlaengerung    -> LZ 1 -> 1   Gehalt 5,50 -> 5,27
 *
 * Ursache war der Fallback `input.contractLength ?? rosterEntry.contractLength`: bei einem
 * Spieler, ueber den gerade entschieden wird, ist die vorhandene Laufzeit 0, und die Klemme
 * `Math.max(1, ...)` macht daraus die kuerzestmoegliche Bruecke. Der Fallback schrieb das
 * Gegenteil einer Verlaengerung — ausgerechnet dort, wo verlaengert werden sollte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DIENST = readFileSync(join(process.cwd(), "lib/contracts/contract-renewal-service.ts"), "utf8");

describe("Eine Verlängerung ohne Laufzeitangabe schreibt keine Brücke", () => {
  it("fällt nicht mehr auf die vorhandene Laufzeit zurück", () => {
    // Genau dieser Ausdruck erzeugte aus Laufzeit 0 eine 1.
    expect(DIENST).not.toContain("input.contractLength ?? rosterEntry.contractLength");
    expect(DIENST).not.toContain("input.contractLength ?? rosterEntry?.contractLength");
  });

  it("nimmt die Vorgabe des Verhandlungsfensters", () => {
    expect(DIENST).toContain("const STANDARD_VERTRAGSLAENGE = 2;");
    expect(DIENST).toContain("input.contractLength ?? STANDARD_VERTRAGSLAENGE");
  });

  it("rechnet in der Vorschau dieselbe Laufzeit wie beim Schreiben", () => {
    // Zwei verschiedene Vorgaben hiessen: die Vorschau zeigt etwas anderes, als unterschrieben wird.
    const treffer = DIENST.split("input.contractLength ?? STANDARD_VERTRAGSLAENGE").length - 1;
    expect(treffer).toBe(2);
  });
});

/**
 * GEMELDET VON CHRIS, im selben Atemzug: „verlängern und forderungen aktualisieren dauert
 * ungewöhnlich lange, auch das verlängern generell — dann steht da sehr lange wird verlängert…
 * keine ahnung ob es das wirklich wird oder nicht es hängt."
 *
 * Es hing nicht, es lud. Am Live-Abbild gemessen kostet EIN `getSaveById` 1965 ms, die
 * Vertragsrechnung darin 2 bis 64 ms. Ein Verlängern fuhr vier davon hintereinander: eigene
 * Vorschau, Buchung, und danach vier Nachladungen in einem `await` — die ganze Zeit stand
 * „Wird verlängert…".
 */
describe("Verlängern wartet nur auf das, was das Ergebnis verändert", () => {
  const SCOPE = readFileSync(
    join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
    "utf8",
  );

  function schreibweg() {
    const start = SCOPE.indexOf("async function runContractRenewalAction(");
    expect(start).toBeGreaterThanOrEqual(0);
    return SCOPE.slice(start, SCOPE.indexOf("function applyNewGamePreset(", start));
  }

  it("holt keine eigene Vorschau, wenn der Aufrufer schon einen Token hat", () => {
    expect(schreibweg()).toContain("let confirmToken = input.confirmToken ?? null;");
    expect(schreibweg()).toContain("if (!confirmToken) {");
  });

  it("blockiert nur auf den Spielstand, nicht auf Marktfeed und Historie", () => {
    const weg = schreibweg();
    expect(weg).toContain("await loadSave(activeSaveId);");
    // Die drei Nachladungen laufen nach — sie ändern am Ergebnis nichts.
    expect(weg).toContain("void Promise.all([");
    expect(weg).not.toContain("await Promise.all([\n        loadSave(activeSaveId),");
  });

  it("das Verhandlungsfenster gibt den Token seiner aktuellen Vorschau mit", () => {
    const MODAL = readFileSync(
      join(process.cwd(), "app/foundation/teams-v2/ContractRenewalNegotiationModal.tsx"),
      "utf8",
    );
    // Der Token vom ÖFFNEN wäre stale, sobald jemand am Gehalt dreht.
    expect(MODAL).toContain("confirmToken: summary?.confirmToken ?? subject.confirmToken ?? null,");
  });
});
