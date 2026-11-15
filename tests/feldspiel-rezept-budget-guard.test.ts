// ===================================================================================
// BUDGET-KONSERVIERUNG ALS DAUERHAFTER CI-GUARD (14.11., Opus-PM-Praezisierung nach Chris'
// Football-Matrix-Ruecknahme-Auftrag).
//
// Chris, woertlich: "ja mach das rezept jetzt komplett über die matrix, für alle disziplinen!!
// also wie in 1. Das 2. ist genau das was zu problemen führt! Wenn du zb nur 26 power für die
// diszi zur verfügung hast gehen dann vllt nur 3 in laufkraft 15 in tackling usw" — die Budget-
// Methode (scripts/baue-feldspiel-rezept.mjs, Sinkhorn) verteilt jedes Attribut EXAKT auf 100 %
// seines Matrixgewichts ueber die Unterfertigkeiten. Das ist durch den Sinkhorn-Algorithmus
// selbst architektonisch garantiert -- ABER nur, wenn die ERLAUBT-Tabelle des Werkzeugs dem
// Attribut ueberhaupt mindestens EINE Zelle gibt. Zwei konkrete, bereits einmal passierte Fehler
// sind genau diese Garantie zu brechen:
//
//   (a) ein Matrix-Attribut (Gewicht > 0) bekommt in KEINER der acht Unterfertigkeiten eine
//       Zelle -- die Zeile ist unloesbar, das Attribut traegt FAKTISCH NULL, egal was die
//       Matrix verlangt (das war bei Football "awareness": komplett ausgesperrt, weil es auf
//       einer frueheren Kaderfamilie negativ mit der Eignung korrelierte -- eine rho-Sorge, die
//       nicht durch Aussperren aus der ZEILE geloest werden darf, sondern nur ueber die SPALTE,
//       s. Kommentar in scripts/baue-feldspiel-rezept.mjs).
//   (b) ein Attribut OHNE Matrixgewicht taucht trotzdem in einer Unterfertigkeit auf (bei
//       Football: `speed` in LAUFKRAFT, `dexterity` in PASSGENAUIGKEIT -- beide Gewicht 0 in der
//       Matrix, aber Gewicht 14/25 im inzwischen zurueckgebauten Spiel-Eignungs-Override).
//
// Dieser Test liest das COMMITTETE Rezept direkt aus public/mockups/battle-mode.engine.js (die
// einzige Quelle -- Football fuehrt sein Rezept weiterhin inline in FELDSPIEL_ART[dId].rezept,
// nicht in battle-mode.rezepte.js) und prueft genau diese zwei Eigenschaften strukturell, ohne
// einen Browser zu brauchen. Das ist die Haelfte der "Zeilensumme = Matrixgewicht"-Forderung, die
// sich aus einem STATISCHEN Dateicheck tatsaechlich beweisen laesst: die exakte NUMERISCHE
// Entsprechung (Sinkhorns p[a][s], auf 100 % des Attributbudgets normiert) existiert nur
// WAEHREND eines baue-feldspiel-rezept.mjs-Laufs und wird von diesem beim Schreiben der
// Prozentzahlen pro Unterfertigkeit (die der Motor als `mische()`-Gewichte liest) aufgeloest --
// eine nachtraegliche Zahlen-Rekonstruktion aus dem committeten Prozent-Text allein ist nicht
// moeglich (jede gleichmaessige Skalierung der Gewichte INNERHALB einer Unterfertigkeit aendert
// `mische()` nicht, also ist die absolute Spaltenmasse aus der committeten Zahl nicht mehr
// ablesbar). WAS SICH AUS DEM TEXT ALLEIN PRUEFEN LAESST -- und was die beiden oben genannten
// Fehler vollstaendig abdeckt, weil Sinkhorns Normierung (`p[a] /= summe(p[a])` nach jeder Runde)
// eine volle Zeilensumme fuer JEDES Attribut mit mindestens einer erlaubten Zelle architektonisch
// erzwingt -- ist genau die Praesenz/Abwesenz-Eigenschaft hier. Die numerische Pp-Abnahme
// (Ziel ≤0,5 Pp je Attribut, angestrebt ~0 in Summe) bleibt Sache von
// `node scripts/messe-arena-einfluss.mjs football 48` nach jedem Rezept-Rebuild, dokumentiert im
// Rezept-Kommentar selbst -- dieselbe Arbeitsteilung wie bei rho/Pp ueberall sonst im Projekt
// (CLAUDE.md: Browser-Messungen sind eigene, bewusst NICHT-vitest-gebundene Werkzeuge).
//
// FUER ALLE ZWANZIG DISZIPLINEN GEDACHT, HEUTE NUR FUER FOOTBALL SCHARF. Der Opus-PM-Rollout auf
// die anderen 19 ist eine eigene, noch offene Aufgabe; pending-Platzhalter unten, damit niemand
// vergisst, dass sie fehlen, ohne jetzt schon rot zu sein.
// ===================================================================================
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  officialDisciplineWeightMatrix,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";

const ENGINE_PATH = path.resolve(process.cwd(), "public/mockups/battle-mode.engine.js");

/** Klammer-bewusster Blockfang -- dieselbe Logik wie scripts/sondiere-feldspiel-subskills.mjs. */
function klammerBlock(quelle: string, von: number): string {
  let tiefe = 0;
  for (let i = von; i < quelle.length; i++) {
    if (quelle[i] === "{") tiefe++;
    else if (quelle[i] === "}") {
      tiefe--;
      if (tiefe === 0) return quelle.slice(von, i + 1);
    }
  }
  throw new Error(`Klammer nicht geschlossen ab Position ${von}`);
}

/**
 * Liest das inline `rezept:{...}` einer Feldspiel-Disziplin aus dem Motor und gibt
 * {UNTERFERTIGKEIT: {attribut: prozent}} zurueck -- dieselbe Extraktion wie
 * scripts/sondiere-feldspiel-subskills.mjs' Chassis-Eintrags-Zweig (dort wird sie nicht
 * exportiert, deshalb hier dieselbe kleine Logik noch einmal).
 */
function leseInlineRezept(disziplin: string): Record<string, Record<string, number>> {
  const engineQuelle = readFileSync(ENGINE_PATH, "utf8");
  const discRe = new RegExp(`\\n    ${disziplin}:\\{`, "g");
  let discM: RegExpExecArray | null;
  let discBlock: string | null = null;
  while ((discM = discRe.exec(engineQuelle))) {
    const kandidat = klammerBlock(engineQuelle, discM.index + discM[0].length - 1);
    if (kandidat.includes("rezept:{")) {
      discBlock = kandidat;
      break;
    }
  }
  if (!discBlock) {
    throw new Error(`Kein Chassis-Eintrag mit "rezept:{...}" fuer "${disziplin}" gefunden.`);
  }
  const rezeptIdx = discBlock.indexOf("rezept:{");
  const rezeptBlock = klammerBlock(discBlock, rezeptIdx + "rezept:".length);

  const rezept: Record<string, Record<string, number>> = {};
  const subRe = /([A-Z_]+):\s*\{([^{}]*)\}/g;
  let subM: RegExpExecArray | null;
  while ((subM = subRe.exec(rezeptBlock))) {
    const name = subM[1]!;
    const attrs: Record<string, number> = {};
    for (const paar of subM[2]!.matchAll(/([a-z]+):\s*([0-9.]+)/g)) {
      attrs[paar[1]!] = Number(paar[2]);
    }
    rezept[name] = attrs;
  }
  return rezept;
}

/**
 * Sub-Skills, die am Budget-Konservierungsgebot teilnehmen. `LAUFTEMPO` (und ein etwaiger
 * Torwart-`PARADE`-Kanal) sind bewusst ausgenommen -- disziplinuebergreifend erwartete,
 * NICHT-fachliche Rollen (Bewegungstempo bzw. Torwart-Slot bei Hockey), die laut
 * scripts/baue-feldspiel-rezept.mjs' eigener ERLAUBT-Tabelle nie Teil der Matrix-Zeilen-
 * Verteilung waren -- fuer KEINE der zwanzig Disziplinen, nicht nur Football.
 */
const AUSGENOMMENE_UNTERFERTIGKEITEN = new Set(["LAUFTEMPO", "PARADE"]);

function pruefeBudgetKonservierung(disziplinId: OfficialDisciplineWeightId) {
  const matrix = officialDisciplineWeightMatrix[disziplinId] as Partial<
    Record<PlayerGeneratorAttributeKey, number>
  >;
  const matrixAttribute = new Set(
    Object.entries(matrix)
      .filter(([, gewicht]) => (gewicht ?? 0) > 0)
      .map(([attribut]) => attribut),
  );

  const rezept = leseInlineRezept(disziplinId);
  const fachlicheUnterfertigkeiten = Object.keys(rezept).filter(
    (s) => !AUSGENOMMENE_UNTERFERTIGKEITEN.has(s),
  );
  expect(fachlicheUnterfertigkeiten.length).toBeGreaterThan(0);

  for (const attribut of matrixAttribute) {
    const kommtVor = fachlicheUnterfertigkeiten.some((s) => rezept[s]![attribut] != null);
    expect(
      kommtVor,
      `"${attribut}" traegt Matrixgewicht ${matrix[attribut as PlayerGeneratorAttributeKey]} ` +
        `bei "${disziplinId}", kommt aber in keiner der fachlichen Unterfertigkeiten ` +
        `(${fachlicheUnterfertigkeiten.join(", ")}) vor -- seine Zeile ist unloesbar, er traegt ` +
        `faktisch 0 statt seines vollen Matrixgewichts.`,
    ).toBe(true);
  }

  for (const s of fachlicheUnterfertigkeiten) {
    for (const attribut of Object.keys(rezept[s]!)) {
      expect(
        matrixAttribute.has(attribut),
        `Unterfertigkeit "${s}" bei "${disziplinId}" nutzt "${attribut}", das in der ` +
          `offiziellen Matrix kein Gewicht (> 0) traegt -- Sinkhorn kann ein solches Attribut ` +
          `nicht budget-konform speisen, es gehoert nicht ins Rezept.`,
      ).toBe(true);
    }
  }
}

describe("Budget-Konservierung je Attribut (Chris 14.11.: 'das rezept jetzt komplett über die matrix')", () => {
  it("football: jedes Matrix-Attribut kommt vor, kein attributfremdes Attribut kommt vor", () => {
    pruefeBudgetKonservierung("football");
  });

  // PENDING FUER DIE UEBRIGEN 19 DISZIPLINEN (Opus-PM-Rollout, noch nicht umgesetzt). `it.skip`
  // statt Weglassen, damit die Liste als TODO sichtbar bleibt, aber heute niemanden rot faerbt --
  // keine dieser neunzehn Rezepte ist bisher nach dieser Methode gebaut/geprueft worden.
  it.skip("tdm, mini-dm, battlefield, gewichtheben, climbing, staffel, time-trial, spurt, tennis, hockey, showcase, speed-schach, takeshis-castle, breaking, wettessen, basketball, eiskunstlauf, fechten, i-spy: noch nicht auf Budget-Konservierung umgestellt", () => {
    // Absichtlich leer -- Platzhalter fuer den Opus-PM-Rollout auf die restlichen 19
    // Disziplinen. Sobald eine Disziplin umgestellt ist, wandert sie aus diesem Platzhalter in
    // eine eigene `it(...)`, wie football oben.
  });
});
