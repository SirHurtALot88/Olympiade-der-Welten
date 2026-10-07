// VERIFIKATION H-C — DER TORWART ALS ERSTER PASSGEBER (07.10., docs/design/fable-ideen-feldspiel-
// 30-09.md §5 H-C). BEFUND: gebaut, gemessen, NICHT gemergt (Abbruchregel: Torwart-Rangtreue
// unveraendert), s. docs/design/hockey-hc-torwartpass-befund-07-10.md.
//
// Diese Sonde haelt fest, was gebaut ist UND warum es nichts bewegt:
//
//   (a) Formel: passQualitaetVon() liefert fuer den Torwart IM TOR (Hockey) seine TECHNIK, fuer
//       den gezogenen Torwart (imTor=false), jeden Feldspieler und jede andere Disziplin
//       zeichengleich AUFBAU.
//   (b) Zielwahl unberuehrt: offensterMitspieler() liest keinen Wert des Passgebers (nur seine
//       Position) — statisch am Quelltext geprueft. H-C ist damit eine Schwellen-, keine
//       Kaskadenaenderung.
//   (c) Hebel: wie oft spielt ein Torwart ueberhaupt einen Pass? Ueber die Kader-Familie
//       (5 Varianten x N Spiele) gezaehlt — das ist die Zahl, an der H-C scheitert.
//   (d) keine `pageerror`.
//
//   node scripts/verify-hockey-torwartpass-paket-07-10.mjs [spiele je Variante=24]
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const quelle = readFileSync(path.join(WURZEL, "public/mockups/battle-mode.engine.js"), "utf8");

let alleOk = true;
const pruefe = (name, ok, detail) => {
  console.log(`${ok ? "OK  " : "FEHL"}  ${name}${detail ? "  — " + detail : ""}`);
  if (!ok) alleOk = false;
};

// (b) statisch: Rumpf von offensterMitspieler bis zur naechsten Top-Level-Funktion
const start = quelle.indexOf("  function offensterMitspieler(mitspieler,von){");
const ende = quelle.indexOf("\n  function ", start + 10);
const rumpf = quelle.slice(start, ende).split("\n").filter((z) => !z.trim().startsWith("//")).join("\n");
pruefe("(b) offensterMitspieler liest keinen Wert des Passgebers",
  start > 0 && !/von\.(AUFBAU|TECHNIK|ABSCHLUSS|TEAMGEIST|PARADE)/.test(rumpf),
  "nur Position (offenheitFuerPass(von,m))");
const stellen = (quelle.match(/passQualitaetVon\(/g) || []).length;
pruefe("(a) passQualitaetVon an den drei Ketten-Stellen + Hook", stellen >= 4, `${stellen} Aufrufe/Definitionen`);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.hockeyPassQualitaet && window.__arena.spiele, null, { timeout: 30000 });

  // (a)
  const f = await seite.evaluate(() => {
    const q = window.__arena.hockeyPassQualitaet;
    const tw = { torwart: true, imTor: true, TECHNIK: 31, AUFBAU: 77 };
    return {
      twImTor: q(tw, "hockey"),
      twGezogen: q({ ...tw, imTor: false }, "hockey"),
      feld: q({ ...tw, torwart: false }, "hockey"),
      basketball: q(tw, "basketball"),
    };
  });
  pruefe("(a) Torwart im Tor (Hockey) -> TECHNIK", f.twImTor === 31, JSON.stringify(f));
  pruefe("(a) gezogener Torwart -> AUFBAU", f.twGezogen === 77);
  pruefe("(a) Feldspieler -> AUFBAU", f.feld === 77);
  pruefe("(a) andere Disziplin -> AUFBAU", f.basketball === 77);

  // (c)
  const z = await seite.evaluate(([vars, n]) => {
    let spiele = 0, paesse = 0, tore = 0, a1 = 0, a2 = 0;
    for (const v of vars) {
      window.__arena.kaderSetzen({ heim: v.heim, gast: v.gast });
      for (let i = 0; i < n; i++) {
        const x = window.__arena.hockeyTorwartPaesse(1337 + i * 7919);
        spiele++; paesse += x.paesse;
        for (const e of x.protokoll) {
          if (e.art !== "treffer") continue;
          tore++;
          if (e.passgeber && e.passgeber.torwart && e.passgeber.imTor !== false) a1++;
          if (e.zweitpassgeber && e.zweitpassgeber.torwart && e.zweitpassgeber.imTor !== false) a2++;
        }
      }
    }
    return { spiele, paesse, tore, a1, a2 };
  }, [familie.varianten, SPIELE]);
  console.log(`      Kader-Familie: ${z.spiele} Spiele, ${z.paesse} Torwartpaesse (${(z.paesse / z.spiele).toFixed(3)} je Spiel), ` +
    `${z.tore} Tore, davon A1 Torwart ${z.a1}, A2 Torwart ${z.a2}`);
  pruefe("(c) Torwartpaesse gezaehlt", z.spiele > 0);
  pruefe("(d) keine pageerror", fehler.length === 0, fehler.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
console.log(alleOk ? "\nALLE PRUEFUNGEN BESTANDEN" : "\nMINDESTENS EINE PRUEFUNG FEHLGESCHLAGEN");
process.exit(alleOk ? 0 : 1);
