// ===================================================================================
// WAS TREIBT DIE LEUTE AN? — die Abnahmemessung fuer den Arena-Entwurf.
//
// Chris' Grundsatz: "immer ueber die diszi gewichtungen gehen um zu schauen was die
// leute antreibt". Die Gewichtsmatrix einer Disziplin ist die Ansage; die Mechanik hat
// sie einzuloesen. Dieses Skript prueft, ob sie das tut — es hebt bei je einem
// Teilnehmer je ein Attribut an und misst, wie viel besser er dadurch abschneidet.
//
// Ausgegeben wird der Einflussvektor und die Abweichung zur Matrix in Prozentpunkten.
// Null hiesse: die Mechanik belohnt exakt das, was die Wertung bepreist.
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
const pfad = process.argv[4] || "/home/user/Olympiade-der-Welten/public/mockups/battle-mode.html";
const datei = "file://" + pfad;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(datei, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena, null, { timeout: 30000 });

const motoren = await seite.evaluate(() => window.__arena.motoren());
if (!motoren.includes(disziplin)) {
  console.error(`Fuer "${disziplin}" ist kein Motor angemeldet. Vorhanden: ${motoren.join(", ")}`);
  await browser.close();
  process.exit(1);
}

const start = Date.now();
const e = await seite.evaluate(([d, n]) => window.__arena.einflussVon(d, n), [disziplin, laeufe]);
const dauer = ((Date.now() - start) / 1000).toFixed(0);

console.log(`${e.disziplin} — ${e.laeufe} Laeufe, Anhebung +${e.anhebung}, ${dauer}s`);
console.log(`Abweichung zur Matrix: ${e.abweichungPp} Pp\n`);
console.log("Attribut          Anteil   Matrix   Differenz");
const matrix = await seite.evaluate((d) => window.__arena.matrix(d), disziplin);
for (const r of e.reihen) {
  const soll = matrix[r.attribut] || 0;
  const diff = r.anteil - soll;
  console.log(
    `${r.attribut.padEnd(15)} ${String(r.anteil).padStart(6)} % ${String(soll).padStart(6)}   ` +
      `${(diff > 0 ? "+" : "") + diff.toFixed(1)}`,
  );
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
await browser.close();
