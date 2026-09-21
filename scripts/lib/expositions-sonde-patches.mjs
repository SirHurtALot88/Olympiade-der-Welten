// ===================================================================================
// A1.0 — DIE EXPOSITIONS-SONDE (PM-Plan, docs/pm-briefings/projektmanager-plan-kampfmodell-
// umsetzung-20-09.md, Abschnitt 3.5). Sechs Varianten (A-E, P), ALLE reine Sondenpfad-
// Monkey-Patches auf einer TEMPORAEREN KOPIE von public/mockups/battle-mode.engine.js —
// die eingecheckte Datei wird an keiner Stelle dieses Moduls oder seiner Aufrufer
// beschrieben. Genau nach dem in der Auftragsbeschreibung genannten Vorbild
// docs/design/arena-zielwahl-umsetzung.md (dort: Engine-Text zur Messung veraendert, am
// Ende git-diff-frei) — hier textlich auf einer Kopie statt am Arbeitsbaum, damit ein
// abgebrochener Lauf niemals einen unfertigen Zustand im Repo hinterlassen kann.
//
// VARIANTE B — `cdKuerzung=(u)=>0`: die vor Chris' Tempo-Entscheidung (04.09.) geltende
// Rate-Haelfte seiner Formel (s. Kommentar an der Originalstelle, engine.js ~19765-19784).
// Die Zahlen 0,113/0,269/0,325 aus docs/design/arena-zielwahl-umsetzung.md sind auf dieser
// (damals einzigen) Formel UND der Fuenfer-Kaderfamilie gemessen — diese Sonde reproduziert
// die FORMEL zur Kontrolle, nicht die exakten alten Zahlen (andere Kaderfamilie, andere n).
//
// VARIANTE C — Zielwahl gleichverteilt (Round-Robin ueber die lebenden Gegner) statt
// geometrisch/additiv. Ersetzt chooseTarget()s gesamten Nicht-Kommando-Anteil (Offensivzwang/
// decken/flanke/zielP/Persoenlichkeits-Grundneigung/Schluss-Ruecfall — alles, was ueber
// nearest()/bedrohungVon()/hp-reduce() eine Standardpraeferenz herstellte) durch einen
// deterministischen, nach `id` sortierten Rundlauf. Rueckzug/Durchbruch/Zielansage/
// Ruecken-Reflex (u.lastHit) bleiben unveraendert, weil das Kommandos/Reflexe sind, keine
// additiven Geometrie-Scores. Voller Vorher-/Nachher-Text in
// expositions-sonde-choosetarget-original.txt / -variante-c.txt (dieses Verzeichnis).
//
// VARIANTE D — B und C zusammen (unabhaengige Textstellen, Reihenfolge ohne Wirkung).
//
// VARIANTE E — "alle Wahrscheinlichkeiten PRD-gebunden": NACHGEMESSEN (s. PR-Beschreibung /
// Bericht), dass es im gesamten Arena-Chassis (TDM/Mini-DM/Battlefield, build() bis zum
// MOTOREN[ad]-Objekt, Zeile ~19546-29279) GENAU ZWEI `rr()`-Aufrufe gibt (Fernkampf-
// Streuwinkel, `(rr()*2-1)*streu`), und `streu` steht an BEIDEN Stellen fest auf `0` — der
// Wurf ist ein No-Op, verbraucht zwar eine rr()-Ziehung, aendert aber nie das Ergebnis.
// `schlachtplan()` (KI-Zuteilung), `build()` und `stepSim()` rufen `rr()` nachweislich NICHT
// auf (grep-Beleg in der PR-Beschreibung). Es gibt in diesem Chassis also KEINE
// Wahrscheinlichkeitsentscheidung, an die sich PRD binden liesse — Variante E ist deshalb
// textlich IDENTISCH mit Variante A (keine Engine-Aenderung), und das Ergebnis (bit-identisch
// zu A) ist der eigentliche Befund dieser Variante, keine ausgelassene Implementierung.
//
// VARIANTE P — `place` gesetzt. NICHT NEU GEBAUT: uebernimmt unveraendert das Sondengeruest
// aus scripts/lib/aufstellungs-stufungen.ts (M1, PR #982) und den Aufruf-Weg aus
// scripts/miss-preis-der-aufstellung.ts. Kein Textpatch hier noetig — P laeuft auf dem
// unveraenderten Motor (Variante-A-Text), nur mit einer je Pairing individuell gesetzten
// `aufstellung` statt dem heutigen leeren Standardfall.
// ===================================================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));

const CD_KUERZUNG_ALT = "const cdKuerzung=(u)=>0.30*u.TMP/(u.TMP+120);";
const CD_KUERZUNG_NEU = "const cdKuerzung=(u)=>0;";

const BUILD_RESET_ALT =
  "seed=normalisiereSaat(saat);U=[];floats.length=0;t=0;done=false;freigabe=[false,false];pfeile=[];MESS={};";
const BUILD_RESET_NEU =
  BUILD_RESET_ALT + 'if(typeof __rrZielZaehler!=="undefined")__rrZielZaehler.clear();';

const CHOOSE_TARGET_ALT = readFileSync(
  path.join(HIER, "expositions-sonde-choosetarget-original.txt"),
  "utf8",
).replace(/\n$/, "");
const CHOOSE_TARGET_NEU = readFileSync(
  path.join(HIER, "expositions-sonde-choosetarget-variante-c.txt"),
  "utf8",
).replace(/\n$/, "");

/** Ersetzt `alt` durch `neu` in `src` — wirft, wenn `alt` nicht GENAU EINMAL vorkommt (kein
 * stillschweigend uebersprungener oder mehrfach getroffener Patch). */
function ersetzeGenauEinmal(src, alt, neu, label) {
  const teile = src.split(alt);
  if (teile.length !== 2) {
    throw new Error(
      `expositions-sonde-patches: Anker "${label}" kommt ${teile.length - 1}x vor (erwartet genau 1x). ` +
        `Engine-Quelle hat sich vermutlich geaendert — Patch pruefen, bevor gemessen wird.`,
    );
  }
  return teile[0] + neu + teile[1];
}

export function patchB(src) {
  return ersetzeGenauEinmal(src, CD_KUERZUNG_ALT, CD_KUERZUNG_NEU, "cdKuerzung (Variante B)");
}

export function patchC(src) {
  const mitReset = ersetzeGenauEinmal(src, BUILD_RESET_ALT, BUILD_RESET_NEU, "build()-Reset (Variante C)");
  return ersetzeGenauEinmal(mitReset, CHOOSE_TARGET_ALT, CHOOSE_TARGET_NEU, "chooseTarget (Variante C)");
}

export function patchD(src) {
  return patchC(patchB(src));
}

/** A und E sind textlich identisch mit der unveraenderten Engine — s. Kopfkommentar. */
export function patchA(src) {
  return src;
}
export function patchE(src) {
  return src;
}

export const EXPOSITIONS_VARIANTEN = ["A", "B", "C", "D", "E"];

export function baueEnginePatch(variante, src) {
  if (variante === "A") return patchA(src);
  if (variante === "B") return patchB(src);
  if (variante === "C") return patchC(src);
  if (variante === "D") return patchD(src);
  if (variante === "E") return patchE(src);
  throw new Error(`expositions-sonde-patches: unbekannte Variante "${variante}".`);
}
