// ===================================================================================
// BUDGET-KONSERVIERUNG ALS DAUERHAFTER CI-GUARD, BUEHNEN-SEITE (14.11., Chris' Auftrag
// "mach das rezept jetzt komplett über die matrix, für alle disziplinen!!" — s. CLAUDE.md
// "Die Eignungsmatrix ist gesperrt" — und dessen erste Umsetzung fuer Feldspiel/Football in
// tests/feldspiel-rezept-budget-guard.test.ts, an dem dieses Pendant sich ausdruecklich
// orientiert).
//
// DIESELBE GARANTIE, DIESELBE GRENZE. Die Budget-Methode (scripts/baue-buehne-rezept.mjs,
// Sinkhorn) verteilt jedes Attribut EXAKT auf 100 % seines Matrixgewichts ueber die
// Unterfertigkeiten einer Buehnen-Disziplin. Das ist architektonisch garantiert -- ABER nur,
// wenn die ERLAUBT-Tabelle des Werkzeugs dem Attribut ueberhaupt mindestens EINE Zelle gibt.
// Zwei konkrete Fehler wuerden genau diese Garantie brechen, exakt wie beim Feldspiel-Pendant:
//
//   (a) ein Matrix-Attribut (Gewicht > 0) bekommt in KEINER Unterfertigkeit eine Zelle --
//       die Zeile ist unloesbar, das Attribut traegt FAKTISCH NULL, egal was die Matrix
//       verlangt. GEFUNDEN beim Bau dieses Werkzeugs: "breaking" (torment/will/health/power/
//       determination/stamina/dexterity sind im heute committeten Rezept vertreten, aber
//       intelligence -- Matrixgewicht 2 -- kommt in KEINER der sieben Unterfertigkeiten vor,
//       s. BUEHNE_ART.breaking.rezept in public/mockups/battle-mode.engine.js). Genau der
//       Fall, den dieser Test einfangen soll. BEHOBEN 15.11. (Task #133): intelligence sitzt
//       jetzt in NERVEN, s. Kommentar am Rezept.
//   (b) ein Attribut OHNE Matrixgewicht taucht trotzdem in einer Unterfertigkeit auf.
//
// Dieser Test liest das COMMITTETE Rezept direkt aus public/mockups/battle-mode.engine.js --
// genauer: aus `const BUEHNE_ART={...}`, NICHT aus irgendeiner anderen Chassis-Tabelle
// (ARENA_ART/FELDSPIEL_ART/BAHN_ART). Disziplin-IDs mit Bindestrich stehen dort in
// Anfuehrungszeichen ("i-spy":{...}, "speed-schach":{...}) -- die Suche ist deshalb
// quote-tolerant, dieselbe `"?...`"?`-Technik wie scripts/kalibriere-buehne-rezept.mjs's
// liesMotor(). Und sie prueft genau die zwei Eigenschaften oben strukturell, ohne einen
// Browser zu brauchen -- aus demselben Grund wie beim Feldspiel-Pendant: die exakte
// NUMERISCHE Entsprechung (Sinkhorns p[a][s], auf 100 % des Attributbudgets normiert)
// existiert nur WAEHREND eines scripts/baue-buehne-rezept.mjs-Laufs; eine nachtraegliche
// Zahlen-Rekonstruktion aus dem committeten Prozent-Text allein ist nicht moeglich (jede
// gleichmaessige Skalierung der Gewichte INNERHALB einer Unterfertigkeit aendert mische()
// in battle-mode.engine.js nicht). Die numerische Pp-Abnahme (Ziel ≤0,5 Pp je Attribut)
// bleibt Sache von `node scripts/messe-arena-einfluss.mjs <disziplin> 48` nach jedem
// Rezept-Rebuild -- dieselbe Arbeitsteilung wie ueberall sonst im Projekt.
//
// KEINE AUSGENOMMENEN UNTERFERTIGKEITEN, ANDERS ALS BEIM FELDSPIEL. Dessen Pendant nimmt
// LAUFTEMPO/PARADE aus der Pruefung aus -- disziplinuebergreifend erwartete, NICHT-fachliche
// Rollen (Bewegungstempo bzw. Torwart-Slot), die nie Teil der Matrix-Zeilen-Verteilung waren.
// Keine Buehnen-Unterfertigkeit hat dieses Muster: GRUNDLAGE/SPITZENMOMENT/TECHNIK/NERVEN/
// PUBLIKUM/AUSDAUER/WAGNIS (die geteilte Sieben-Rollen-Formel), gewichtheben
// (LAST/TECHNIK/NERVEN/ANSAGE/ERHOLUNG) und i-spy (SPUERSINN/LOGIK/MENSCHENKENNTNIS/
// FINGERFERTIGKEIT/NERVEN/TEAMGEIST/AUSDAUER) sind laut den jeweiligen BUEHNE_ART-Kommentaren
// allesamt disziplinspezifische Fachrollen -- jede traegt (oder soll tragen) echtes
// Matrixgewicht, keine ist ein generischer Nicht-Fach-Kanal.
//
// FUER ALLE NEUN BUEHNEN-DISZIPLINEN SCHARF (seit 15.11., Task #133). Die bestehenden
// Rezepte sind handkalibrierte Ergebnisse von scripts/kalibriere-buehne-rezept.mjs's
// Grid-Suche (rho-getrieben) bzw. frueherer Pp-Nachziehrunden, keine Sinkhorn-Ausgaben -- die
// Struktur-Eigenschaft erfuellten trotzdem acht von neun schon, breaking wurde nachgezogen.
// Die NUMERISCHE Budget-Treue jeder Disziplin steht als frische Pp-Messung in
// data/generated/disziplin-abnahme.json.
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

/** Klammer-bewusster Blockfang -- dieselbe Logik wie scripts/kalibriere-buehne-rezept.mjs. */
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
 * Liest das inline `rezept:{...}` einer Buehnen-Disziplin aus `const BUEHNE_ART={...}` in
 * battle-mode.engine.js und gibt {UNTERFERTIGKEIT: {attribut: prozent}} zurueck.
 * Quote-tolerant (Bindestrich-IDs wie "i-spy"/"speed-schach" stehen dort in
 * Anfuehrungszeichen) und ausdruecklich nur innerhalb von BUEHNE_ART gesucht -- derselbe
 * Fund, der scripts/sondiere-buehne-subskills.mjs noetig machte (s. dessen Kopfkommentar).
 */
function leseBuehneRezept(disziplin: string): Record<string, Record<string, number>> {
  const engineQuelle = readFileSync(ENGINE_PATH, "utf8");
  const artIdx = engineQuelle.indexOf("const BUEHNE_ART={");
  if (artIdx < 0) throw new Error("const BUEHNE_ART={ nicht in battle-mode.engine.js gefunden.");
  const artBlock = klammerBlock(engineQuelle, artIdx + "const BUEHNE_ART=".length);

  const discRe = new RegExp(`\\n    "?${disziplin}"?:\\{`, "g");
  let discM: RegExpExecArray | null;
  let discBlock: string | null = null;
  while ((discM = discRe.exec(artBlock))) {
    const kandidat = klammerBlock(artBlock, discM.index + discM[0].length - 1);
    if (kandidat.includes("rezept:{")) {
      discBlock = kandidat;
      break;
    }
  }
  if (!discBlock) {
    throw new Error(`Kein BUEHNE_ART-Eintrag mit "rezept:{...}" fuer "${disziplin}" gefunden.`);
  }
  const ohneKommentare = discBlock.replace(/\/\/[^\n]*/g, "");
  const rezeptIdx = ohneKommentare.indexOf("rezept:{");
  const rezeptBlock = klammerBlock(ohneKommentare, rezeptIdx + "rezept:".length);

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

// SCHARF FUER ALLE NEUN seit 15.11. (Task #133, s. unten).
function pruefeBudgetKonservierung(disziplinId: OfficialDisciplineWeightId) {
  const matrix = officialDisciplineWeightMatrix[disziplinId] as Partial<
    Record<PlayerGeneratorAttributeKey, number>
  >;
  const matrixAttribute = new Set(
    Object.entries(matrix)
      .filter(([, gewicht]) => (gewicht ?? 0) > 0)
      .map(([attribut]) => attribut),
  );

  const rezept = leseBuehneRezept(disziplinId);
  const unterfertigkeiten = Object.keys(rezept);
  expect(unterfertigkeiten.length).toBeGreaterThan(0);

  for (const attribut of matrixAttribute) {
    const kommtVor = unterfertigkeiten.some((s) => rezept[s]![attribut] != null);
    expect(
      kommtVor,
      `"${attribut}" traegt Matrixgewicht ${matrix[attribut as PlayerGeneratorAttributeKey]} ` +
        `bei "${disziplinId}", kommt aber in keiner der Unterfertigkeiten ` +
        `(${unterfertigkeiten.join(", ")}) vor -- seine Zeile ist unloesbar, er traegt ` +
        `faktisch 0 statt seines vollen Matrixgewichts.`,
    ).toBe(true);
  }

  for (const s of unterfertigkeiten) {
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

const BUEHNEN_DISZIPLINEN: OfficialDisciplineWeightId[] = [
  "tennis",
  "fechten",
  "gewichtheben",
  "speed-schach",
  "breaking",
  "showcase",
  "wettessen",
  "eiskunstlauf",
  "i-spy",
];

describe("Budget-Konservierung je Attribut, Buehne (Chris 14.11.: 'das rezept jetzt komplett über die matrix')", () => {
  // Sanity-Check der Extraktion selbst (kein `it.skip`): wenn leseBuehneRezept() fuer eine
  // einzige dieser neun IDs nichts findet oder ein leeres Rezept liefert, ist das ein Fehler
  // im TEST (oder eine Strukturaenderung in battle-mode.engine.js), kein Rezept-Befund -- der
  // sollte unabhaengig davon auffallen, ob die Budget-Pruefung selbst (noch) scharf ist.
  it.each(BUEHNEN_DISZIPLINEN)("%s: das Rezept laesst sich aus BUEHNE_ART lesen", (disziplinId) => {
    const rezept = leseBuehneRezept(disziplinId);
    expect(Object.keys(rezept).length).toBeGreaterThan(0);
  });

  // SCHARF FUER ALLE NEUN BUEHNEN-DISZIPLINEN (15.11., Task #133, Chris: "budget konservierung
  // sollte eigentlich jetzt fuer alle 20 diszis schon gelten!"). Acht der neun Rezepte erfuellten
  // die Struktur-Eigenschaft schon (jedes Matrixattribut hat eine Zelle, kein attributfremdes
  // Attribut) -- ihre numerische Budget-Treue steht als frische Pp-Messung in
  // data/generated/disziplin-abnahme.json (alle <= 25, Task #136). Der einzige Ausreisser war
  // breaking (intelligence, Matrixgewicht 2, ohne Zelle); seit dem Rezeptschritt vom 15.11.
  // (BUEHNE_ART.breaking.rezept, NERVEN) besteht auch breaking. Ab hier faellt jede kuenftige
  // Rezeptaenderung, die ein Matrixattribut verwaist oder ein fremdes einschleust, in CI auf.
  it.each(BUEHNEN_DISZIPLINEN)("%s: jedes Matrixattribut hat eine Zelle, kein fremdes Attribut", (disziplinId) => {
    pruefeBudgetKonservierung(disziplinId);
  });
});
