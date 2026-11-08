// ===================================================================================
// WAS TREIBT DIE LEUTE AN? — die Abnahmemessung fuer den Arena-Entwurf.
//
// Chris' Grundsatz: "immer ueber die diszi gewichtungen gehen um zu schauen was die
// leute antreibt". Die Gewichtsmatrix einer Disziplin ist die Ansage; die Mechanik hat
// sie einzuloesen. Dieses Skript prueft, ob sie das tut — es hebt bei je einem
// Teilnehmer je ein Attribut an und misst, wie viel besser er dadurch abschneidet.
//
// Ausgegeben wird der Einflussvektor und die Abweichung zur Matrix in Prozentpunkten
// (Pp). Konkret: die Matrix sagt "Speed zaehlt im TDM 0 % zur Wertung". Gemessen trug
// Speed aber 43 % des Kampfergebnisses — eine Luecke von 43 Punkten bei nur diesem einen
// Attribut. Ueber alle zwoelf Attribute aufsummiert (Betraege, nicht Vorzeichen) ergibt
// das die Abweichung. NULL Pp hiesse: die Mechanik belohnt exakt das, was die Wertung
// bepreist. Je hoeher die Zahl, desto mehr belohnt die Mechanik etwas anderes.
//
//   node scripts/messe-arena-einfluss.mjs                → Serie + Spurt-Einfluss
//   node scripts/messe-arena-einfluss.mjs spurt 12       → nur Spurt, 12 Laeufe
//   node scripts/messe-arena-einfluss.mjs tdm 2          → TDM (dauert Minuten, s.u.)
//
// KOSTEN. Ein Rennen rechnet in Millisekunden, ein Teamfight in Sekunden. Die Messung
// braucht (Attribute x Teilnehmer x Laeufe) Durchgaenge — im Spurt sind das bei n=12
// rund 1150 Rennen in zwei Sekunden, im TDM bei n=2 rund 150 Kaempfe in gut zwei
// Minuten. Fuer TDM also klein anfangen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  buehneSchalterAusArgs, setzeBuehneSchalter, buehneSchalterText,
  staffelPaarSchalterAusArgs, setzeStaffelPaarSonde, staffelPaarSchalterText,
  generischeChassisWarnung,
} from "./lib/rangtreue-messung.mjs";

// Additive Schalter (29.09., MUTATOR ORGANISCH), in beliebiger Position, ohne sie unveraendertes
// Verhalten der Positionsargumente:
//   --mutatoren=je-lauf|aus|fest  wie die Mutator-Traits waehrend der Messung stehen (einflussVon,
//                                 battle-mode.engine.js; Standard der Engine: "je-lauf", gepaart)
//   --saat-versatz=N              zweiter, unabhaengiger Saatstrom (z.B. 10000000), wie im Handbuch
//                                 fuer die Pp-Abnahme gefordert
const schalter = process.argv.slice(2).filter((a) => a.startsWith("--"));
const positionen = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const schalterWert = (name) => schalter.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const MUTATOR_MODUS = schalterWert("mutatoren") ?? null;
const SAAT_VERSATZ = Number(schalterWert("saat-versatz") ?? 0);
// --je-seite=N (27.10., additiv): Kadergroesse einer ARENA-Disziplin fuer diese Messung (z.B.
// Battlefield 2/4/6 je Seite). Ohne den Schalter misst das Skript bei ARENA_ART[d].jeSeite wie bisher.
const JE_SEITE = Number(schalterWert("je-seite") ?? 0) || null;
// --kulisse=<id>|alle und --ziel=matrix|variante (Oberflaechen-Effekte 08.11., Konzept Abschnitt
// 7): pinnt die Kulissen-Variante fuer die ganze Messung; "alle" misst jede Variante der
// Disziplin einzeln. --ziel=variante misst gegen W_variante = Matrix + K[d][v] statt gegen die
// Matrix (ohne --kulisse wirkungslos). Ohne beide Schalter exakt wie vorher.
const KULISSE = schalterWert("kulisse") ?? null;
const ZIEL = schalterWert("ziel") ?? null;
// --flags=... / --haltung-heim=... / --haltung-gast=... (NACHT-PAKET-SCHALTER, 04./05.10., additiv),
// s. scripts/lib/rangtreue-messung.mjs. Ohne sie misst das Skript den Motor mit allen Flags aus.
const BUEHNE_SCHALTER = buehneSchalterAusArgs(schalter);
// --staffel-paare=zufall|alle|stufe:N (STAFFEL O7, 11.10., additiv), s. scripts/lib/rangtreue-messung.mjs.
const STAFFEL_PAAR_SCHALTER = staffelPaarSchalterAusArgs(schalter);
process.argv = [process.argv[0], process.argv[1], ...positionen];
const disziplin = process.argv[2] || "spurt";
// WIE VIELE LAEUFE ES BRAUCHT — nachgemessen, nicht gewaehlt.
//
// Zwoelf Laeufe sind zu wenig, und zwar nicht harmlos zu wenig: sie sind SYSTEMATISCH zu
// guenstig. Bei kleiner Stichprobe greifen ein paar Attribute den ganzen positiven Gewinn
// ab und der Rest liest null; weil die Anteile nur ueber die positiven Gewinne normiert
// werden, sieht das Ergebnis geordneter aus, als es ist. Gemessen: Spurt 40,9 Pp bei
// n = 12 gegen 54,7 Pp bei n = 48, Climbing 28,9 gegen 37,2.
//
// Noch groesser ist der Bedarf, wenn sich mehrere Teilnehmer EIN Ergebnis teilen. In der
// Staffel haengen sechs Laeufer an einer Teamzeit: dort las bei n = 12 jedes Attribut
// entweder 0 % oder einen Ausreisser (Charisma 40 % bei Matrixgewicht 10), und erst ab
// etwa 120 Laeufen wird die Reihenfolge stabil.
const VORGABE = { staffel: 144 };
const laeufe = Number(process.argv[3] || VORGABE[disziplin] || 48);
// Dritter Aufrufwert: ein anderer Entwurf. Nuetzlich, um eine lange TDM-Messung gegen
// eine eingefrorene Kopie laufen zu lassen, waehrend am Original weitergearbeitet wird.
//
// OHNE diesen Aufrufwert wird das Mockup RELATIV ZU DIESEM SKRIPT aufgeloest, nicht mehr
// ueber ein absolutes Literal auf den Haupt-Checkout. Das Literal war ein stiller Fehler,
// den ein Opus-Review am Hockey-Plan gefunden hat (01.09.): in einem Worktree — und jede
// Agenten-Runde arbeitet in einem — mass das Skript ohne vierten Aufrufwert klaglos die
// Datei des HAUPT-Checkouts statt der eigenen. Es schlug dabei nicht fehl, es mass nur das
// Falsche, und zwar genau dann, wenn man eine Aenderung abnehmen wollte. Die Abnahme der
// naechsten Hockey-Schritte haengt an diesem Werkzeug, deshalb steht die Reparatur vor
// ihnen (Plan Teil H.4, "PR -1"). pathToFileURL statt "file://"+pfad, damit Leerzeichen
// und Sonderzeichen im Pfad korrekt kodiert werden.
const pfad = process.argv[4]
  ? resolve(process.argv[4])
  : resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "mockups", "battle-mode.html");
const datei = pathToFileURL(pfad).href;

const FEST = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(FEST) ? { executablePath: FEST } : {});
const seite = await browser.newPage();
// KEIN AUDIOCONTEXT IM MESSLAUF (Speicherleck-Fix, 01.10.). einflussVon() laeuft als EIN
// synchroner evaluate()-Aufruf ueber (1 + 12 x Teilnehmer) x n Spiele. Die Ton-Schicht
// (sfx()/ton*, battle-mode.engine.js) baut dabei je Ereignis frische WebAudio-Knoten
// (Oszillator/Filter/Gain an ctx.destination) -- Breaking allein rund 600 sfx()-Aufrufe je
// Spiel (Herzschlag/Hieb/Freeze aus stepCypher()). Headless-Chromium startet den Kontext
// ohne Nutzergeste als "running"; abgelaufene Knoten gibt Chromium aber erst in einer
// Main-Thread-Aufgabe NACH dem laufenden Skript frei, und das kommt hier erst nach Minuten
// bis Stunden. Gemessen: ~2 GB Renderer-RSS je Lauf, bei n=12 der cgroup-OOM-Kill.
// Die Engine sieht den fehlenden Kontext bereits als Messfall vor ("ohne AudioContext
// (Messlaeufe) ist sfx() ohnehin ein No-Op", tonKontext() faengt den Fehler ab), und die
// Ton-Schicht ruft vertraglich nie rr() und schreibt nie auf Teilnehmer -- die Messwerte
// bleiben bit-identisch (nachgemessen, s. PR).
await seite.addInitScript(() => {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
});
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });
const schalterGesetzt = await setzeBuehneSchalter(seite, BUEHNE_SCHALTER);
const staffelPaarGesetzt = await setzeStaffelPaarSonde(seite, STAFFEL_PAAR_SCHALTER);

const motoren = await seite.evaluate(() => window.__arena.motoren());
if (!motoren.includes(disziplin)) {
  console.error(`Fuer "${disziplin}" ist kein Motor angemeldet. Vorhanden: ${motoren.join(", ")}`);
  await browser.close();
  process.exit(1);
}

// WARNUNG VOR DEM LANGEN MESSLAUF, NICHT NUR DANACH (Task #193, N4): wer das Skript
// abbricht oder nur den Anfang sieht, soll die Einschraenkung trotzdem sehen -- s.
// generischeChassisWarnung() in lib/rangtreue-messung.mjs.
const chassisWarnung = generischeChassisWarnung(disziplin);
if (chassisWarnung) console.log(chassisWarnung + "\n");

const profile = KULISSE ? await seite.evaluate(() => (window.__arena.kulisseProfile ? window.__arena.kulisseProfile() : {})) : {};
const kulissen = !KULISSE ? [null]
  : KULISSE === "alle" ? (profile[disziplin] ? profile[disziplin].varianten : [null])
  : [KULISSE];
for (const kulisse of kulissen) {
const opt = kulisse ? { kulisse, ...(ZIEL ? { ziel: ZIEL } : {}) } : undefined;
const start = Date.now();
const e = await seite.evaluate(
  ([d, n, versatz, modus, js, opt]) => {
    const st = window.setTimeout;
    window.setTimeout = () => 0;
    try {
      return window.__arena.einflussVon(d, n, undefined, versatz, modus ?? undefined, js ?? undefined, opt ?? undefined);
    } finally {
      window.setTimeout = st;
    }
  },
  [disziplin, laeufe, SAAT_VERSATZ, MUTATOR_MODUS, JE_SEITE, opt ?? null],
);
const dauer = ((Date.now() - start) / 1000).toFixed(0);

console.log(`Gemessene Datei: ${pfad}`);
console.log(`${e.disziplin} — ${e.laeufe} Laeufe, Anhebung +${e.anhebung}, ${dauer}s`
  + (e.mutatorModus ? `, Mutatoren ${e.mutatorModus}` : "") + (SAAT_VERSATZ ? `, Saatversatz ${SAAT_VERSATZ}` : ""));
if (kulisse) console.log(`Kulisse: ${kulisse} (Ziel: ${e.ziel === "variante" ? "W_variante = Matrix + Kulissen-Profil" : "Matrix"})`);
if (JE_SEITE) console.log(`Kadergroesse: ${JE_SEITE} je Seite (--je-seite)`);
if (schalterGesetzt) console.log(buehneSchalterText(schalterGesetzt));
if (staffelPaarGesetzt) console.log(staffelPaarSchalterText(staffelPaarGesetzt));
console.log(`Abweichung zur ${e.ziel === "variante" ? "Variantengewichtung" : "Matrix"}: ${e.abweichungPp} Pp\n`);
console.log(`Attribut          Anteil   ${e.ziel === "variante" ? "  Ziel" : "Matrix"}   Differenz`);
const matrix = e.zielGewichte || await seite.evaluate((d) => window.__arena.matrix(d), disziplin);
for (const r of e.reihen) {
  const soll = matrix[r.attribut] || 0;
  const diff = r.anteil - soll;
  console.log(
    `${r.attribut.padEnd(15)} ${String(r.anteil).padStart(6)} % ${String(soll).padStart(6)}   ` +
      `${(diff > 0 ? "+" : "") + diff.toFixed(1)}`,
  );
}
if (kulissen.length > 1) console.log("");
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
if (chassisWarnung) console.log("\n" + chassisWarnung);
await browser.close();
