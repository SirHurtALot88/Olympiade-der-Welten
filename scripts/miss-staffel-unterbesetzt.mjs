// ===================================================================================
// STAFFEL UNTERBESETZT: A/B-MESSUNG (02.11., docs/design/bahn-pod-vier-teams-01-11.md 6.8).
//
// Seit "fehlende Laeufer laufen doppelt" laufen alle Seiten dieselbe Beinzahl, und wer doppelt
// laeuft, behaelt seine Erschoepfung. Abnahme: Unterbesetzung muss ein spuerbarer NACHTEIL sein
// (Chris: wie 5 gegen 6 im Kampf), monoton in der Kopfzahl. Gemessen als A/B: DASSELBE Team einmal
// voll, einmal nur mit seinen BESTEN m nach Staffel-Eignung (strengster Fall: die Unterbesetzten
// haben im Schnitt die hoehere Eignung je Laeufer), sonst identische Eingaben.
//
//   duell  echtes spieleBahn (Duell-Rezept), Aufstellung ueber __olyArenaKader wie im Runner. Gast
//          setzt m, Heim laeuft voll. Je Familienpaarung beide Richtungen. -> Siegquote Gast je m,
//          dazu Gast-Siege je Paarung (Monotonie je Paarung).
//   pod    spieleBahnPod, k = 6, Vierergruppen der Kader-Familie, das unterbesetzte Team rotiert
//          ueber die vier Positionen. -> Zielzeit-Verlust, mittlerer Platz, Siege je m, und rho je
//          Rennen (Basis-Eignung d.staffel gegen Boxscore-Wert) -- bleibt die Einzelwertung heil?
//
// AUFRUF: node scripts/miss-staffel-unterbesetzt.mjs <duell|pod> [--saaten=n] [--gruppen=n]
//         [--wurzel=<anderer Checkout>]   (z. B. ein Worktree am Stand VOR der Aenderung)
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const args = new Map(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
  const [k, v] = a.slice(2).split("=", 2); return [k, v ?? "1"];
}));
const MODUS = process.argv.slice(2).find((a) => !a.startsWith("--")) || "pod";
const WURZEL = args.get("wurzel") || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAATEN = Number(args.get("saaten") || (MODUS === "duell" ? 30 : 3));
const GRUPPEN = Number(args.get("gruppen") || 40);
const SLOTS = ["startrunner", "tempolink", "batontech", "curverunner", "chaserunner", "anchor"];
const KOEPFE = [6, 5, 4, 3, 2, 1];

const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const FEST = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(FEST) ? { executablePath: FEST } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e.stack || e)));
// Dieselben Schutzmassnahmen wie messe-arena-einfluss.mjs: kein AudioContext, setTimeout als
// No-Op waehrend der langen synchronen Aufrufe (s. bahn-pod-vier-teams-01-11.md 3.4).
await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
await seite.goto("file://" + path.join(WURZEL, "public/mockups/battle-mode.html"));
await seite.waitForFunction(() => window.__arena && window.__arena.spieleBahnPod, null, { timeout: 120000 });
const mittel = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const besteM = (kader, m) => [...kader].sort((a, b) => (b.d.staffel || 0) - (a.d.staffel || 0)).slice(0, m);
const aufstellung = (spieler) => Object.fromEntries(spieler.map((p, i) => [p.n, { d: "staffel", slot: SLOTS[i] }]));

console.log(`Wurzel ${WURZEL} — Modus ${MODUS}`);
if (MODUS === "duell") {
  const paare = familie.flatMap((v) => [[v.heim, v.gast], [v.gast, v.heim]]);
  const siege = {}, jePaar = {};
  for (const [heim, gast] of paare) {
    for (const m of KOEPFE) {
      await seite.evaluate((k) => {
        window.__olyArenaKader = k; delete window.__arena;
        document.querySelectorAll("script[data-oly-headless-engine]").forEach((el) => el.remove());
        const s = document.createElement("script"); s.src = "battle-mode.engine.js"; s.setAttribute("data-oly-headless-engine", "1");
        document.body.appendChild(s);
      }, { heim, gast, aufstellung: aufstellung(besteM(gast, m)), mutatoren: [] });
      await seite.waitForFunction(() => window.__arena && window.__arena.spieleBahn, null, { timeout: 120000 });
      const n = await seite.evaluate((NS) => {
        const sT = window.setTimeout; window.setTimeout = () => 0;
        try { let g = 0; for (let s = 1; s <= NS; s++) { const e = window.__arena.spieleBahn("staffel", 7000 + s * 31); if (e.seiten[1] > e.seiten[0]) g++; } return g; }
        finally { window.setTimeout = sT; }
      }, SAATEN);
      siege[m] = (siege[m] || 0) + n; (jePaar[m] = jePaar[m] || []).push(n);
    }
  }
  const je = paare.length * SAATEN;
  for (const m of KOEPFE) console.log(`Gast setzt ${m}: Siegquote ${(100 * siege[m] / je).toFixed(1)} % (${siege[m]}/${je}) — je Paarung ${jePaar[m].join(" ")}`);
} else {
  const m = new Map(); for (const v of familie) { if (!m.has(v.heimName)) m.set(v.heimName, v.heim); if (!m.has(v.gastName)) m.set(v.gastName, v.gast); }
  const KADER = [...m.values()];
  const alle = []; for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) for (let c = b + 1; c < 10; c++) for (let d = c + 1; d < 10; d++) alle.push([a, b, c, d]);
  const schritt = Math.max(1, Math.floor(alle.length / GRUPPEN));
  const gruppen = alle.filter((_, i) => i % schritt === 0).slice(0, GRUPPEN);
  const r = await seite.evaluate(([KADER, gruppen, NS, SLOTS, KOEPFE]) => {
    const sT = window.setTimeout; window.setTimeout = () => 0;
    const rang = (w) => { const i = w.map((x, j) => [x, j]).sort((a, b) => a[0] - b[0]); const r = []; let k = 0; while (k < i.length) { let j = k; while (j + 1 < i.length && i[j + 1][0] === i[k][0]) j++; for (let q = k; q <= j; q++) r[i[q][1]] = (k + j) / 2; k = j + 1; } return r; };
    const rho = (a, b) => { const ra = rang(a), rb = rang(b), n = a.length, ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n; let nu = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { nu += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; } return da && db ? nu / Math.sqrt(da * db) : null; };
    const aus = {};
    try {
      for (const [gi, g] of gruppen.entries()) {
        const teams = g.map((i) => KADER[i]);
        const eig = new Map(teams.flat().map((p) => [p.n, p.d.staffel || 0]));
        const X = gi % teams.length;
        const beste = [...teams[X]].sort((a, b) => (b.d.staffel || 0) - (a.d.staffel || 0));
        for (let s = 1; s <= NS; s++) {
          const saat = 1000 * s + g.reduce((a, b) => a * 11 + b, 7);
          for (const mm of KOEPFE) {
            const pl = {}; beste.slice(0, mm).forEach((p, i) => { pl[p.n] = { d: "staffel", slot: SLOTS[i] }; });
            const e = window.__arena.spieleBahnPod("staffel", teams, saat, teams.map((_, i) => (i === X && mm < 6 ? pl : null)), { formSaat: saat, k: 6 });
            const z = (aus[mm] = aus[mm] || { zeit: [], platz: [], rho: [] });
            z.zeit.push(e.teams[X].zielzeit ?? 99); z.platz.push(e.teams[X].eventPlatz);
            const rr = rho(e.boxscore.map((b) => eig.get(b.name)), e.boxscore.map((b) => b.wert));
            if (rr != null) z.rho.push(rr);
          }
        }
      }
    } finally { window.setTimeout = sT; }
    return aus;
  }, [KADER, gruppen, SAATEN, SLOTS, KOEPFE]);
  const voll = r[6];
  console.log(`${gruppen.length} Gruppen × ${SAATEN} Saaten, k = 6, das unterbesetzte Team rotiert ueber die Positionen`);
  for (const mm of KOEPFE) {
    const z = r[mm];
    const dZeit = mittel(z.zeit.map((t, i) => t - voll.zeit[i]));
    console.log(`m=${mm}: Zielzeit ${dZeit >= 0 ? "+" : ""}${dZeit.toFixed(3)} s gegen voll, mittlerer Platz ${mittel(z.platz).toFixed(2)}, Siege ${z.platz.filter((p) => p === 1).length}/${z.platz.length}, rho je Rennen Median ${median(z.rho).toFixed(3)}`);
  }
}
console.log("Seitenfehler:", fehler.length ? fehler.slice(0, 3) : "keine");
await browser.close();
