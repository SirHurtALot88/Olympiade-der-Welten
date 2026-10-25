// ===================================================================================
// MINI-DM-FFA-REFERENZ ZIEHEN — M90 + Spieler-PP-Perzentile je Kadergroesse k=2..6.
//
// PR 3 des 6-PR-Opus-Plans (21.10., Mini-DM-6-Rollen-Umbau). Befuellt
// data/generated/mini-dm-ffa-referenz.json real -- die Datei kam aus PR 4 (Commit dca6815c)
// als Platzhalter (`feldgroessen: {}`), s. ihr "hinweis"-Feld dort und die Kopfkommentare an
// resolveMiniDmFfaMargeReferenz()/resolveMiniDmFfaSpielerPpReferenz() in
// lib/resolve/mini-dm-pod-resolve.ts. Dieses Skript zieht die beiden referenzierten Groessen
// REAL aus Simulationslaeufen des FFA-Kampfmotors -- nicht aus den vier alten Werten kopiert.
//
// WARUM PLAYWRIGHT STATT DER LIVE-SAVE-SQLITE (anders als scripts/ziehe-verhaeltnis-referenz.ts):
// die Groesse, die hier referenziert wird (v_t = R_t/k + B_t/(k*1e6), s.
// berechneMiniDmFfaPodOverride() in mini-dm-pod-resolve.ts), ENTSTEHT erst im
// FFA-Kampfmotor (`spieleMiniDmFfaEvent()`/`miniDmFfaSonde()`, public/mockups/
// battle-mode.engine.js) -- einem reinen Browser-Chassis ohne Node-Pendant (s. Kopfkommentar
// an scripts/miss-mini-dm-ffa-abnahme.mjs, derselbe Grund, warum JENES Skript schon
// Playwright nutzt). Dieses Skript ist die Referenz-Ziehung fuer GENAU dieselbe Mechanik,
// deshalb derselbe Mechanismus: kaderfeste Simulation ueber die Kader-Familie
// (data/generated/kaderfamilie-live-save.json, zehn echte Teams, C(10,4) = 210 Vierergruppen),
// zwei unabhaengige Saatstroeme (CLAUDE.md-Pflicht fuer die begleitende Pp-Abnahme).
//
// WAS GEZOGEN WIRD, je Kadergroesse k:
//   - m90: 90. Perzentil der LUECKEN zwischen aufeinanderfolgenden Plaetzen (sortiert nach
//     v_t absteigend) ueber alle Pods -- genau die Groesse, die
//     berechneErgebnisNormiertNTeam() als `differenz` an berechneVerhaeltnisBetrag() uebergibt
//     (drei Luecken je Pod: Platz 1->2, 2->3, 3->4, alle positiven Luecken gepoolt).
//   - spieler.p50/p995: Perzentile des ROHEN `beitrag` (= `wert` in diesem Skript, derselbe
//     Wert wie `beta(t,r)` in mini-dm-pod-resolve.ts) EINER Runde EINES Teilnehmers -- gepoolt
//     ueber ALLE Teilnehmer und Runden (nicht R_t/B_t-Summen), weil ppAusMiniDmFfaBeitrag()
//     je EINZELNER Runde aufgerufen wird (s. dessen Kopfkommentar).
//
//   OLY_KADER_FAMILIE=<pfad> node scripts/ziehe-mini-dm-ffa-referenz.mjs [spiele] [--k=2..6]
//        [--seite=<pfad zu battle-mode.html>] [--ausgabe=<datei>]
//
// Ohne --k: 2..6 (alle fuenf). Ohne --spiele: 24 Events je Gruppe und Saatstrom (mehr als die
// 6 der Abnahme-Sonde -- die Referenz braucht eine glattere Verteilung als die Abnahme selbst,
// die nur noch gegen eine FESTE Referenz vergleicht). Schreibt/mergt
// data/generated/mini-dm-ffa-referenz.json -- ein bestehender Eintrag zu einem ANDEREN k bleibt
// unberuehrt, ein Lauf fuer dasselbe k ersetzt ihn.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wert = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const positionen = args.filter((a) => !a.startsWith("--"));
const SPIELE = Number(positionen[0] || 24);
const SEITE = pathToFileURL(wert("seite") || path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const ZIEL = wert("ausgabe") ? path.resolve(wert("ausgabe")) : path.join(WURZEL, "data/generated/mini-dm-ffa-referenz.json");

function parseKListe(roh) {
  if (!roh) return [2, 3, 4, 5, 6];
  const bereich = roh.match(/^(\d+)\.\.(\d+)$/);
  if (bereich) {
    const [von, bis] = [Number(bereich[1]), Number(bereich[2])];
    return Array.from({ length: bis - von + 1 }, (_, i) => von + i);
  }
  return roh.split(",").map((s) => Number(s.trim()));
}
const K_LISTE = parseKListe(wert("k"));
for (const k of K_LISTE) {
  if (!Number.isInteger(k) || k < 2 || k > 6) throw new Error(`--k: unbekannte Mini-DM-Kadergroesse ${k} -- erwartet 2..6.`);
}
const STROEME = [0, 10_000_000];
const MATRIX_MINI_DM = { torment: 24, health: 20, power: 16, stamina: 16, will: 14, dexterity: 10 };

// --- Kader: zehn Teams aus der Familie (identisch zu miss-mini-dm-ffa-abnahme.mjs) ---------
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const familie = JSON.parse(readFileSync(KADERFAMILIE_PFAD, "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const TEAMNAMEN = [...teamsNachName.keys()];
const roheKader = TEAMNAMEN.map((n) => teamsNachName.get(n));
const GRUPPEN = [];
for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) for (let c = b + 1; c < 10; c++) for (let d = c + 1; d < 10; d++) GRUPPEN.push([a, b, c, d]);

// EIGNUNG UNTER DEM OVERRIDE -- s. miss-mini-dm-ffa-abnahme.mjs Kopfkommentar, identische Logik.
function rohsumme(a, w) { let s = 0, g = 0; for (const k in w) { s += (a[k] || 0) * w[k]; g += w[k]; } return g ? s / g : 0; }
function eignungNeu(kader, gewichte) {
  const gleich = Object.keys({ ...gewichte, ...MATRIX_MINI_DM }).every((k) => (gewichte[k] || 0) === (MATRIX_MINI_DM[k] || 0));
  if (gleich) return kader;
  const punkte = [];
  for (const k of kader) for (const p of k) punkte.push([rohsumme(p.a, MATRIX_MINI_DM), p.d["mini-dm"]]);
  punkte.sort((x, y) => x[0] - y[0]);
  const lies = (x) => {
    if (x <= punkte[0][0]) return punkte[0][1] + (x - punkte[0][0]) * ((punkte[1][1] - punkte[0][1]) / Math.max(1e-9, punkte[1][0] - punkte[0][0]));
    const l = punkte.length - 1;
    if (x >= punkte[l][0]) return punkte[l][1] + (x - punkte[l][0]) * ((punkte[l][1] - punkte[l - 1][1]) / Math.max(1e-9, punkte[l][0] - punkte[l - 1][0]));
    let i = 1; while (punkte[i][0] < x) i++;
    const [x0, y0] = punkte[i - 1], [x1, y1] = punkte[i];
    return x1 === x0 ? (y0 + y1) / 2 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  };
  return kader.map((k) => k.map((p) => ({ ...p, d: { ...p.d, "mini-dm": Math.round(lies(rohsumme(p.a, gewichte)) * 100) / 100 } })));
}

function quantil(sortiert, p) {
  if (sortiert.length === 0) return 0;
  const index = (sortiert.length - 1) * p;
  const unten = Math.floor(index), oben = Math.ceil(index);
  if (unten === oben) return sortiert[unten];
  return sortiert[unten] * (1 - (index - unten)) + sortiert[oben] * (index - unten);
}
const r2 = (v) => Math.round(v * 100) / 100;

// v_t = R_t/k + B_t/(k*1e6) -- EXAKT dieselbe Formel wie `sortiert.map(...)` in
// berechneMiniDmFfaPodOverride() (lib/resolve/mini-dm-pod-resolve.ts).
function auswertenReferenz(events, k) {
  const luecken = [];
  const spielerWerte = [];
  for (const ev of events) {
    const bJeSide = [0, 0, 0, 0];
    for (const runde of ev.runden) {
      for (const t of runde.teilnehmer) {
        bJeSide[t.side] += t.wert;
        spielerWerte.push(t.wert);
      }
    }
    const vJeSide = [0, 1, 2, 3].map((side) => {
      const team = ev.teams.find((x) => x.side === side);
      return (team.rundenPunkte) / k + bJeSide[side] / (k * 1_000_000);
    });
    const sortiert = [...vJeSide].sort((a, b) => b - a);
    for (let i = 0; i < sortiert.length - 1; i++) {
      const differenz = sortiert[i] - sortiert[i + 1];
      if (differenz > 0) luecken.push(differenz);
    }
  }
  return { luecken, spielerWerte };
}

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
const feldgroessen = {};
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.miniDmFfaSonde, null, { timeout: 60000 });
  const gewichte = await seite.evaluate(() => window.__arena.matrix("mini-dm"));
  const kader = eignungNeu(roheKader, gewichte);

  for (const k of K_LISTE) {
    const t0 = Date.now();
    const alleLuecken = [], alleSpielerWerte = [];
    for (const versatz of STROEME) {
      const events = (await seite.evaluate(({ kader, gruppen, n, versatz, k }) =>
        window.__arena.miniDmFfaSonde(kader, { gruppen, n, versatz, k }),
        { kader, gruppen: GRUPPEN, n: SPIELE, versatz, k })).events;
      const { luecken, spielerWerte } = auswertenReferenz(events, k);
      alleLuecken.push(...luecken);
      alleSpielerWerte.push(...spielerWerte);
    }
    alleLuecken.sort((a, b) => a - b);
    alleSpielerWerte.sort((a, b) => a - b);
    feldgroessen[String(k)] = {
      k,
      fixtures: GRUPPEN.length * SPIELE * STROEME.length,
      luecken: alleLuecken.length,
      m90: r2(quantil(alleLuecken, 0.9)),
      median: r2(quantil(alleLuecken, 0.5)),
      p75: r2(quantil(alleLuecken, 0.75)),
      p95: r2(quantil(alleLuecken, 0.95)),
      max: r2(alleLuecken[alleLuecken.length - 1] ?? 0),
      spieler: {
        p50: r2(quantil(alleSpielerWerte, 0.5)),
        p995: r2(quantil(alleSpielerWerte, 0.995)),
        stichprobe: alleSpielerWerte.length,
      },
    };
    console.error(`[mini-dm-ffa-referenz] k=${k}: ${feldgroessen[String(k)].fixtures} Events, ` +
      `${alleLuecken.length} Luecken, m90=${feldgroessen[String(k)].m90}, ` +
      `spieler p50=${feldgroessen[String(k)].spieler.p50} p99.5=${feldgroessen[String(k)].spieler.p995} ` +
      `(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
} finally {
  await browser.close();
}

const bestehend = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, "utf8")) : {};
const commit = (() => {
  try { return execSync("git rev-parse HEAD", { cwd: WURZEL, encoding: "utf8" }).trim(); } catch { return "unbekannt"; }
})();
const ausgabe = {
  hinweis:
    "ECHTE Referenz (PR 3 des 6-PR-Opus-Plans, 21.10., scripts/ziehe-mini-dm-ffa-referenz.mjs) -- " +
    "ersetzt den Platzhalter aus PR 4 (Commit dca6815c, 'feldgroessen: {}'). " +
    "m90 = 90. Perzentil der v_t-Luecken (v_t = R_t/k + B_t/(k*1e6)) zwischen aufeinanderfolgenden " +
    "Pod-Plaetzen -- gelesen von resolveMiniDmFfaMargeReferenz() in lib/resolve/mini-dm-pod-resolve.ts. " +
    "spieler.p50/p995 = Perzentile des rohen Einzelrunden-`beitrag` -- gelesen von " +
    "resolveMiniDmFfaSpielerPpReferenz()/ppAusMiniDmFfaBeitrag() in derselben Datei. " +
    "PR 4 hat KEINEN produktiven Aufrufer, der FFA-Rohdaten liefert (das ist PR 5) -- diese Datei " +
    "bleibt bis dahin toter Code, s. docs/design/stand-aller-disziplinen.md.",
  feldgroessen: { ...(bestehend.feldgroessen ?? {}), ...feldgroessen },
  provenienz: {
    ...(bestehend.provenienz ?? {}),
    [new Date().toISOString()]: {
      repoCommit: commit,
      kWerte: K_LISTE,
      mechanismus: "window.__arena.miniDmFfaSonde(kader,{k,...}) -- kaderfeste Simulation, " +
        `${GRUPPEN.length} Vierergruppen aus data/generated/kaderfamilie-live-save.json, ` +
        `${SPIELE} Events je Gruppe und Saatstrom, ${STROEME.length} Saatstroeme`,
      skript: "scripts/ziehe-mini-dm-ffa-referenz.mjs",
    },
  },
};
writeFileSync(ZIEL, `${JSON.stringify(ausgabe, null, 1)}\n`);
console.error(`[mini-dm-ffa-referenz] geschrieben: ${ZIEL}`);
console.error("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
