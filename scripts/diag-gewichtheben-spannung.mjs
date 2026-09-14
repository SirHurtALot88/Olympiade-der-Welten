// DIAGNOSE SPANNUNG IM GEWICHTHEBEN-DUELL (Chris' Fund 13.09., woertlich: "man sieht ja am
// anfang schon der eine hebt hoehere gewichte als der andere von anfang an und das wird dann
// auch der sein der am ende gewinnt").
//
//   node scripts/diag-gewichtheben-spannung.mjs [spiele]
//
// Misst NICHT die Rangtreue (dafuer gibt es miss-alle-disziplinen.mjs) und nicht den
// IWF-Korridor (miss-gewichtheben-korridor.mjs), sondern die DRAMATURGIE eines Duells:
// wie frueh steht der Sieger fest, wie oft wechselt die Fuehrung, und wie viel Risiko
// traegt der Fuehrende im dritten Versuch.
//
// Die Reihenfolge der Versuche im Protokoll ist zugleich die Enthuellungsreihenfolge auf
// der Buehne (buehneQueue in baueHebenDuelle nimmt runden[v] beider Heber je v):
//   runden[0..2] = Reissen 1./2./3. Versuch, runden[3..5] = Stossen 1./2./3.
// "Stand nach Schritt v" ist damit genau das, was der Zuschauer nach v+1 Versuchen sieht.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 200);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 30000 });

const roh = await seite.evaluate((n) => {
  const A = window.__arena, spiele = [];
  for (let i = 0; i < n; i++) spiele.push(A.spiele("gewichtheben", 1337 + i * 7919).protokoll);
  return spiele;
}, SPIELE);
await browser.close();

// Stand eines Hebers nach Schritt v (0..5): bestes gueltiges Reissen plus bestes gueltiges
// Stossen unter den bis dahin enthuellten Versuchen.
const standNach = (u, v) => {
  let r = 0, s = 0;
  for (let k = 0; k <= v; k++) {
    const x = u.runden[k];
    if (!x || !x.gueltig) continue;
    if (x.uebung === "reissen") r = Math.max(r, x.kg); else s = Math.max(s, x.kg);
  }
  return r + s;
};
const ansage = (u, v) => (u.runden[v] ? u.runden[v].kg : 0);

let duelle = 0;
let fruehFuehrerGewinnt = 0, fruehGleich = 0;       // Stand nach Versuch 1
let eroeffnungHoeherGewinnt = 0, eroeffnungGleich = 0; // hoehere Eroeffnungs-ANSAGE
let wechselSumme = 0, mitWechsel = 0, wechselNachHalbzeit = 0;
let spaetEntschieden = 0;                            // Fuehrung kippt noch im letzten Versuch
let ueberholtNie = 0;                                // Schwaecherer liegt nie einmal vorn
let dominanz = 0;                                    // Eroeffnung A > hoechster Versuch B ueberhaupt
let abstandKlein = 0, abstandSehrKlein = 0;
const abstaende = [];
// Dritter Versuch: Risiko des Fuehrenden gegen das des Zurueckliegenden.
const dritt = { fuehrend: [0, 0], zurueck: [0, 0], gleich: [0, 0] };
// Wie stark steigt die Ansage im dritten Versuch gegenueber dem zweiten?
const sprungDritt = { fuehrend: [], zurueck: [] };

for (const prot of roh) {
  const nachNr = new Map();
  for (const u of prot) {
    const k = u.duellNr ?? -1;
    if (!nachNr.has(k)) nachNr.set(k, []);
    nachNr.get(k).push(u);
  }
  for (const [, paar] of nachNr) {
    if (paar.length !== 2) continue;
    const [a, b] = paar;
    if (!a.runden || a.runden.length < 6 || !b.runden || b.runden.length < 6) continue;
    duelle++;

    const siegerIstA = !!a.duellGewonnen;
    const abst = Math.abs(a.zweikampf - b.zweikampf);
    abstaende.push(abst);
    if (abst < 10) abstandKlein++;
    if (abst < 5) abstandSehrKlein++;

    // (1) Stand nach dem allerersten Versuch.
    const s1a = standNach(a, 0), s1b = standNach(b, 0);
    if (s1a === s1b) fruehGleich++;
    else if ((s1a > s1b) === siegerIstA) fruehFuehrerGewinnt++;

    // (2) Die reine ANSAGE des ersten Versuchs — das, was Chris sieht, BEVOR gehoben wird.
    const e1a = ansage(a, 0), e1b = ansage(b, 0);
    if (e1a === e1b) eroeffnungGleich++;
    else if ((e1a > e1b) === siegerIstA) eroeffnungHoeherGewinnt++;

    // (3) Dominanz: liegt die Eroeffnungsansage des einen schon ueber JEDEM Versuch des
    // anderen? Dann hebt er woertlich "von Anfang an hoehere Gewichte".
    const maxA = Math.max(...a.runden.map((x) => x.kg));
    const maxB = Math.max(...b.runden.map((x) => x.kg));
    if (e1a > maxB || e1b > maxA) dominanz++;

    // (4) Fuehrungswechsel ueber die sechs Enthuellungsschritte.
    let wechsel = 0, spaet = 0, vorn = 0, schwaecherWarVorn = false;
    const schwaecherIstA = a.zweikampf < b.zweikampf;
    for (let v = 0; v < 6; v++) {
      const sa = standNach(a, v), sb = standNach(b, v);
      const neu = sa === sb ? 0 : sa > sb ? 1 : -1;
      if (neu !== 0 && vorn !== 0 && neu !== vorn) { wechsel++; if (v >= 3) spaet++; }
      if (neu !== 0) vorn = neu;
      if (neu !== 0 && ((neu === 1) === schwaecherIstA)) schwaecherWarVorn = true;
    }
    wechselSumme += wechsel;
    if (wechsel > 0) mitWechsel++;
    if (spaet > 0) wechselNachHalbzeit++;
    if (!schwaecherWarVorn) ueberholtNie++;

    // (5) Kippt die Fuehrung noch im ALLERLETZTEN Versuch (Stossen 3.)?
    const v4a = standNach(a, 4), v4b = standNach(b, 4);
    const vorher = v4a === v4b ? 0 : v4a > v4b ? 1 : -1;
    const nachher = a.zweikampf === b.zweikampf ? 0 : a.zweikampf > b.zweikampf ? 1 : -1;
    if (vorher !== 0 && nachher !== 0 && vorher !== nachher) spaetEntschieden++;

    // (6) Der dritte Versuch je Uebung: wer fuehrt da, und wie geht er aus?
    for (const uebung of ["reissen", "stossen"]) {
      const off = uebung === "reissen" ? 0 : 3;
      for (const [u, g] of [[a, b], [b, a]]) {
        // Stand VOR dem dritten Versuch dieser Uebung (also nach off+1).
        const su = standNach(u, off + 1), sg = standNach(g, off + 1);
        const lage = su === sg ? "gleich" : su > sg ? "fuehrend" : "zurueck";
        const r3 = u.runden[off + 2];
        dritt[lage][1]++;
        if (r3.gueltig) dritt[lage][0]++;
        if (lage !== "gleich") {
          const r2 = u.runden[off + 1];
          if (r2.kg > 0) sprungDritt[lage].push(100 * (r3.kg / r2.kg - 1));
        }
      }
    }
  }
}

const pz = (t, n) => (100 * t / Math.max(1, n)).toFixed(1) + " %";
const quote = (a) => (100 * a[0] / Math.max(1, a[1])).toFixed(1) + " %";
const mittel = (a) => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length));
const zeile = (was, ist) => `${was.padEnd(52)} ${String(ist).padStart(10)}`;

console.log(`Gewichtheben — Spannung im Duellverlauf, ${SPIELE} Spiele, ${duelle} Duelle\n`);
console.log("WIE FRUEH STEHT DER SIEGER FEST");
console.log(zeile("Fuehrender nach dem 1. Versuch gewinnt", pz(fruehFuehrerGewinnt, duelle - fruehGleich)));
console.log(zeile("  (davon Gleichstand nach Versuch 1)", pz(fruehGleich, duelle)));
console.log(zeile("Hoehere EROEFFNUNGSANSAGE gewinnt", pz(eroeffnungHoeherGewinnt, duelle - eroeffnungGleich)));
console.log(zeile("  (davon gleiche Eroeffnungsansage)", pz(eroeffnungGleich, duelle)));
console.log(zeile("Eroeffnung > jeder Versuch des Gegners", pz(dominanz, duelle)));
console.log("\nFUEHRUNGSWECHSEL");
console.log(zeile("Wechsel je Duell (Mittel, 6 Schritte)", (wechselSumme / Math.max(1, duelle)).toFixed(2)));
console.log(zeile("Duelle mit mindestens einem Wechsel", pz(mitWechsel, duelle)));
console.log(zeile("Duelle mit Wechsel im Stossen", pz(wechselNachHalbzeit, duelle)));
console.log(zeile("Entscheidung erst im LETZTEN Versuch", pz(spaetEntschieden, duelle)));
console.log(zeile("Schwaecherer lag NIE auch nur einmal vorn", pz(ueberholtNie, duelle)));
console.log("\nKNAPPHEIT");
console.log(zeile("Abstand < 10 Sinclair-kg", pz(abstandKlein, duelle)));
console.log(zeile("Abstand < 5 Sinclair-kg", pz(abstandSehrKlein, duelle)));
console.log(zeile("Abstand Mittel (Sinclair-kg)", mittel(abstaende).toFixed(1)));
console.log("\nDER DRITTE VERSUCH — RISIKO NACH LAGE");
console.log(zeile("Gelingen, wenn FUEHREND", quote(dritt.fuehrend) + "  n=" + dritt.fuehrend[1]));
console.log(zeile("Gelingen, wenn ZURUECK", quote(dritt.zurueck) + "  n=" + dritt.zurueck[1]));
console.log(zeile("Gelingen, wenn GLEICH", quote(dritt.gleich) + "  n=" + dritt.gleich[1]));
console.log(zeile("Steigerung 2.->3. Versuch, FUEHREND", mittel(sprungDritt.fuehrend).toFixed(2) + " %"));
console.log(zeile("Steigerung 2.->3. Versuch, ZURUECK", mittel(sprungDritt.zurueck).toFixed(2) + " %"));

// NACH KRAEFTEVERHAELTNIS. Die Paarung laeuft ueber den SLOT, nicht ueber die Staerke
// (baueHebenDuelle: "mein Power Opener gegen ihren Power Opener") — ein 470-kg-Heber kann
// also auf einen 200-kg-Heber treffen. Eine Spannungs-Massnahme darf so ein Duell NICHT
// kippen; die Frage ist, wie es in den Duellen aussieht, die ueberhaupt offen sind.
// Tagesmax hier aus LAST/ANSAGE nachgerechnet wie in baueHebenDuelle (HEBEN_KG_BASIS 100,
// HEBEN_KG_PRO_LAST 3,8, HEBEN_TAGESMAX_ANSAGE_K 0,0045).
const tmax = (u) => (100 + u.LAST * 3.8) * (1 + (u.ANSAGE - 50) * 0.0045);
const eimer = [
  { was: "sehr eng   (Tagesmax-Abstand < 3 %)", bis: 0.03, n: 0, fuehrerGewinnt: 0, gleich: 0, wechsel: 0, letzter: 0, abst: [] },
  { was: "eng        (3 bis 10 %)", bis: 0.10, n: 0, fuehrerGewinnt: 0, gleich: 0, wechsel: 0, letzter: 0, abst: [] },
  { was: "deutlich   (10 bis 25 %)", bis: 0.25, n: 0, fuehrerGewinnt: 0, gleich: 0, wechsel: 0, letzter: 0, abst: [] },
  { was: "Missverh.  (ueber 25 %)", bis: 99, n: 0, fuehrerGewinnt: 0, gleich: 0, wechsel: 0, letzter: 0, abst: [] },
];
let nullwertungDuelle = 0;
for (const prot of roh) {
  const nachNr = new Map();
  for (const u of prot) {
    const k = u.duellNr ?? -1;
    if (!nachNr.has(k)) nachNr.set(k, []);
    nachNr.get(k).push(u);
  }
  for (const [, paar] of nachNr) {
    if (paar.length !== 2) continue;
    const [a, b] = paar;
    if (!a.runden || a.runden.length < 6 || !b.runden || b.runden.length < 6) continue;
    if (a.nullwertung || b.nullwertung) nullwertungDuelle++;
    const ta = tmax(a), tb = tmax(b);
    const rel = Math.abs(ta - tb) / Math.max(ta, tb);
    const e = eimer.find((x) => rel < x.bis) || eimer[eimer.length - 1];
    e.n++;
    e.abst.push(Math.abs(a.zweikampf - b.zweikampf));
    const s1a = standNach(a, 0), s1b = standNach(b, 0);
    if (s1a === s1b) e.gleich++;
    else if ((s1a > s1b) === !!a.duellGewonnen) e.fuehrerGewinnt++;
    let w = 0, vorn = 0;
    for (let v = 0; v < 6; v++) {
      const sa = standNach(a, v), sb = standNach(b, v);
      const neu = sa === sb ? 0 : sa > sb ? 1 : -1;
      if (neu !== 0 && vorn !== 0 && neu !== vorn) w++;
      if (neu !== 0) vorn = neu;
    }
    if (w > 0) e.wechsel++;
    const v4a = standNach(a, 4), v4b = standNach(b, 4);
    const vor = v4a === v4b ? 0 : v4a > v4b ? 1 : -1;
    const nach = a.zweikampf === b.zweikampf ? 0 : a.zweikampf > b.zweikampf ? 1 : -1;
    if (vor !== 0 && nach !== 0 && vor !== nach) e.letzter++;
  }
}
console.log("\nNACH KRAEFTEVERHAELTNIS (Paarung laeuft ueber den Slot, nicht die Staerke)");
console.log("Lage                                  Anteil   Fuehrer(V1) gew.  m. Wechsel  letzter Vers.  Abst.Mittel");
for (const e of eimer) {
  console.log(e.was.padEnd(36)
    + pz(e.n, duelle).padStart(8)
    + pz(e.fuehrerGewinnt, Math.max(1, e.n - e.gleich)).padStart(18)
    + pz(e.wechsel, e.n).padStart(12)
    + pz(e.letzter, e.n).padStart(15)
    + mittel(e.abst).toFixed(1).padStart(13));
}
console.log(zeile("\nDuelle mit mindestens einer Nullwertung", pz(nullwertungDuelle, duelle)));

console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
