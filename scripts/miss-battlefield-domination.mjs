// ===================================================================================
// BATTLEFIELD-DOMINATION: ERobert JEDE ROLLE? ROTIEREN DIE SPIELER? (Task #198, 27.10.)
//
// Chris am 27.10.: „bei battlefield und 2 spielern müssen alle agieren, auch der commander und
// der spotter können und sollen ja felder einnehmen bzw es versuchen. Spieler müssen auch
// rotieren und taktisch agieren, es soll keine fixe aufteilung sein wer an welchem slot ist".
//
// Diese Sonde misst genau diese zwei Aussagen, je Kadergroesse k=2..6 und je Rolle:
//   amOrt     Sekunden im Radius irgendeines der drei Orte
//   halte     Sekunden an einem Ort, der gerade der eigenen Seite gehoert
//   erob      beigetragener Eroberungsbalken (1,0 = eine ganze Eroberung allein)
//   eroberungen  abgeschlossene Eroberungen, bei denen er am Ort stand
//   abwehr    zurueckgedraengter gegnerischer Teilfortschritt (Halten/Stoeren)
//   wechsel   Ortswechsel (Rotationen) der dynamischen Punktwahl
//   orte      wie viele VERSCHIEDENE der drei Orte er angesteuert hat
// dazu je Spiel: wie es endete (Elimination / Punktelimit / Punktestand) und wie oft Orte
// den Besitzer wechselten.
//
//   node scripts/miss-battlefield-domination.mjs [spiele je Kader] [k ...]
//   node scripts/miss-battlefield-domination.mjs 8 2 4 6
//
// Kader: die fuenf echten Paarungen aus data/generated/kaderfamilie-live-save.json (wie
// miss-alle-disziplinen.mjs); fehlt die Datei, der Beispielkader des Mockups.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADER_PFAD = process.env.OLY_KADER_FAMILIE || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const FEST = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const args = process.argv.slice(2).map(Number).filter((x) => Number.isFinite(x));
const SPIELE = args[0] || 8;
const K_LISTE = args.length > 1 ? args.slice(1) : [2, 3, 4, 5, 6];

const familie = existsSync(KADER_PFAD) ? JSON.parse(readFileSync(KADER_PFAD, "utf8")).varianten : [null];

const browser = await chromium.launch(existsSync(FEST) ? { executablePath: FEST } : {});
const seite = await browser.newPage();
await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
await seite.goto(SEITE);
await seite.waitForFunction(() => window.__arena && window.__arena.spieleArenaDomination);

const ergebnis = await seite.evaluate(([fam, spiele, kListe]) => {
  const A = window.__arena;
  const aus = {};
  for (const k of kListe) {
    const spieleK = [];
    fam.forEach((v, vi) => {
      if (v) A.kaderSetzen({ heim: v.heim, gast: v.gast });
      for (let i = 0; i < spiele; i++) {
        const e = A.spieleArenaDomination("battlefield", 1337 + vi * 100003 + i * 7919, { jeSeite: k });
        spieleK.push(e);
      }
    });
    aus[k] = spieleK;
  }
  return aus;
}, [familie, SPIELE, K_LISTE]);
await browser.close();

const mittel = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f = (x, n = 1) => x.toFixed(n).padStart(6);

for (const k of K_LISTE) {
  const spiele = ergebnis[k];
  const kaempfer = spiele.flatMap((s) => s.kaempfer);
  const rollen = [...new Set(kaempfer.map((x) => x.slot))];
  const enden = { elimination: 0, limit: 0, punkte: 0, unentschieden: 0 };
  for (const s of spiele) {
    const elim = s.ueberlebende[0] === 0 || s.ueberlebende[1] === 0;
    if (s.sieger == null) enden.unentschieden++;
    else if (elim) enden.elimination++;
    else if (Math.max(...s.punkte) >= 150) enden.limit++;
    else enden.punkte++;
  }
  const wechselOrte = mittel(spiele.map((s) => s.kaempfer.reduce((a, x) => a + x.eroberungen, 0)));
  console.log(`\nk=${k} (${spiele.length} Spiele, ${k} gegen ${k})  Dauer ${f(mittel(spiele.map((s) => s.dauer)))} s  ` +
    `Ende: Elimination ${enden.elimination}, Punktelimit ${enden.limit}, Punktestand ${enden.punkte}, offen ${enden.unentschieden}  ` +
    `Eroberungs-Teilnahmen/Spiel ${f(wechselOrte)}`);
  console.log("  Rolle            n   amOrt  halte   erob  Erob.  abwehr  wechsel  Orte  Anteil>0");
  for (const r of rollen) {
    const xs = kaempfer.filter((x) => x.slot === r);
    const mitEroberung = xs.filter((x) => x.erob > 0).length / xs.length;
    console.log(`  ${String(r).padEnd(14)} ${String(xs.length).padStart(3)} ${f(mittel(xs.map((x) => x.amOrt)))} ${f(mittel(xs.map((x) => x.halte)))} ` +
      `${f(mittel(xs.map((x) => x.erob)), 2)} ${f(mittel(xs.map((x) => x.eroberungen)), 2)} ${f(mittel(xs.map((x) => x.abwehr)), 2)} ` +
      `${f(mittel(xs.map((x) => x.wechsel)), 2)}  ${f(mittel(xs.map((x) => x.orte)), 2)}  ${f(mitEroberung * 100, 0)} %`);
  }
}
