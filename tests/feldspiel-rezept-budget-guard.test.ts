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
// SCHARF FUER FOOTBALL, BASKETBALL, HOCKEY UND DIE FUENF BAHNEN (seit 15./16.11.); die neun
// Buehnen-Disziplinen prueft tests/buehne-rezept-budget-guard.test.ts, die drei Arena-Formate
// haben kein Sub-Skill-Rezept (s. Kommentar am Ende der Datei).
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

const REZEPTE_PATH = path.resolve(process.cwd(), "public/mockups/battle-mode.rezepte.js");

/** Zeilenkommentare entfernen (ohne `://` in URLs zu treffen) -- sie duerfen Klammern enthalten. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/(^|[^:"'])\/\/[^\n]*/gm, "$1");
}

/**
 * Liest das WIRKSAME Rezept einer Disziplin und gibt {UNTERFERTIGKEIT: {attribut: prozent}}
 * zurueck. Reihenfolge wie im Motor (`rezeptAus()`/`rezepteNachziehen()`): steht die Disziplin in
 * der Daten-Datei public/mockups/battle-mode.rezepte.js (`window.__ARENA_REZEPTE`, heute
 * Basketball/Hockey), gilt DIESES Rezept; sonst das inline `rezept:{...}` ihres Chassis-Eintrags
 * im Motor (Football, die fuenf Bahnen). Disziplin-IDs mit Bindestrich stehen in Anfuehrungs-
 * zeichen ("time-trial", "takeshis-castle") -- die Suche ist quote-tolerant (15.11.).
 */
function leseInlineRezept(disziplin: string): Record<string, Record<string, number>> {
  let rezeptBlock: string | null = null;

  const rezepteQuelle = ohneKommentare(readFileSync(REZEPTE_PATH, "utf8"));
  const datenM = new RegExp(`\\n  "?${disziplin}"?:\\s*\\{`).exec(rezepteQuelle);
  if (datenM) rezeptBlock = klammerBlock(rezepteQuelle, datenM.index + datenM[0].length - 1);

  if (!rezeptBlock) {
    const engineQuelle = ohneKommentare(readFileSync(ENGINE_PATH, "utf8"));
    const discRe = new RegExp(`\\n    "?${disziplin}"?:\\{`, "g");
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
    rezeptBlock = klammerBlock(discBlock, rezeptIdx + "rezept:".length);
  }

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

  // SCHARF SEIT 15./16.11. (Chris: "budget konservierung sollte eigentlich jetzt fuer alle 20
  // diszis schon gelten!"): die beiden uebrigen Feldspiel-Disziplinen (Rezept aus
  // battle-mode.rezepte.js) und die fuenf Bahnen (inline in BAHN_ART, Befund PR #1472: dieselbe
  // {SUB_SKILL:{attribut:gewicht}}-Form). Alle sieben erfuellten die Struktur-Eigenschaft schon;
  // ihre numerische Budget-Treue steht als frische Pp-Messung in data/generated/disziplin-abnahme.json.
  it.each([
    "basketball",
    "hockey",
    "staffel",
    "takeshis-castle",
    "time-trial",
    "spurt",
    "climbing",
  ] as const)("%s: jedes Matrix-Attribut kommt vor, kein attributfremdes Attribut kommt vor", (disziplinId) => {
    pruefeBudgetKonservierung(disziplinId);
  });

  // NICHT HIER, UND WARUM: die neun Buehnen-Disziplinen haben ihren eigenen, ebenfalls scharfen
  // Guard (tests/buehne-rezept-budget-guard.test.ts). tdm/battlefield/mini-dm werden in ihren
  // gewerteten Formaten (tdmGefecht, Battlefield-Gefecht je Ort, Mini-DM-FFA) nicht ueber ein
  // Sub-Skill-Rezept entschieden, sondern lesen jedes Matrixgewicht direkt als benannten Kanal mit
  // seinem Gewicht als Staerke -- dort gibt es keine Zeile, die verwaisen koennte; ihre
  // Budget-Treue belegt allein die Pp-Messung (alle drei unter 15, disziplin-abnahme.json).
});
