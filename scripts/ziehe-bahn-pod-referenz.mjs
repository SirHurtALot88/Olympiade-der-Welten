// ===================================================================================
// BAHN-POD-REFERENZ ZIEHEN — m90 + Spieler-PP-Perzentile je Disziplin und Kadergroesse k=2..6
// (Liga-Verdrahtung 02.11., docs/design/bahn-pod-vier-teams-01-11.md Abschnitt 6).
//
// Befuellt data/generated/bahn-pod-referenz.json, gelesen von resolveBahnPodMargeReferenz()/
// resolveBahnPodSpielerPpReferenz() in lib/resolve/bahn-pod-resolve.ts. Dieselbe Bauart wie
// scripts/ziehe-mini-dm-ffa-referenz.mjs: kaderfeste Simulation ueber die Kader-Familie
// (data/generated/kaderfamilie-live-save.json, zehn echte Teams, alle C(10,4) = 210 Vierergruppen),
// zwei unabhaengige Saatstroeme, ueber den PRODUKTIONS-Einstieg `__arena.spieleBahnPod` (dieselbe
// Funktion, die runBahnPodFixtures() im Liga-Vorlauf aufruft; formSaat = Saat, k = Kopfzahl).
//
// WAS GEZOGEN WIRD, je Disziplin und k:
//   - m90: 90. Perzentil der positiven Teamwert-Luecken zwischen aufeinanderfolgenden Plaetzen
//     (nach eventPlatz) -- Takeshi in Burgpunkten, Staffel in Sekunden Zielzeit-Abstand. Das ist die
//     Groesse, die berechneBahnPodOverride() als `differenz` an berechneVerhaeltnisBetrag() gibt.
//   - spieler.p50/p995: Perzentile des Laeuferwerts im Boxscore (Burgpunkte bzw. Rangpunkte der
//     Etappe ueber alle 4k Laeufer) -- die Groesse, die ppAusBahnPodWert() in Spieler-PP umrechnet.
//
//   node scripts/ziehe-bahn-pod-referenz.mjs [rennen-je-gruppe-und-strom] [--disziplin=staffel,takeshis-castle]
//        [--k=2..6] [--ausgabe=<datei>]
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
const RENNEN = Number(positionen[0] || 4);
const DISZIPLINEN = (wert("disziplin") || "takeshis-castle,staffel").split(",");
const ZIEL = wert("ausgabe") ? path.resolve(wert("ausgabe")) : path.join(WURZEL, "data/generated/bahn-pod-referenz.json");
const kRoh = wert("k") || "2..6";
const kBereich = kRoh.match(/^(\d+)\.\.(\d+)$/);
const K_LISTE = kBereich
  ? Array.from({ length: Number(kBereich[2]) - Number(kBereich[1]) + 1 }, (_, i) => Number(kBereich[1]) + i)
  : kRoh.split(",").map(Number);
const STROEME = [0, 10_000_000];

const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const KADER = [...teamsNachName.values()];
const GRUPPEN = [];
for (let a = 0; a < KADER.length; a++) for (let b = a + 1; b < KADER.length; b++)
  for (let c = b + 1; c < KADER.length; c++) for (let d = c + 1; d < KADER.length; d++) GRUPPEN.push([a, b, c, d]);

const perzentil = (werte, q) => {
  if (!werte.length) return null;
  const s = [...werte].sort((x, y) => x - y);
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const bestehend = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, "utf8")) : {};
const ausgabe = { ...bestehend, disziplinen: { ...(bestehend.disziplinen || {}) } };
try {
  const seite = await browser.newPage();
  // Speicherleck-Schutz wie miss-bahn-pod-abnahme.mjs (kein AudioContext, setTimeout still).
  await seite.addInitScript((k) => {
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    // Bootstrap-Kader wie runBahnPodFixtures(): ein gueltiges Paar, KEIN Mutator (mutatoren: []).
    window.__olyArenaKader = { heim: k[0], gast: k[1], aufstellung: {}, mutatoren: [] };
  }, KADER);
  await seite.goto(pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href);
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleBahnPod, null, { timeout: 60000 });
  for (const bd of DISZIPLINEN) {
    const feldgroessen = { ...((ausgabe.disziplinen[bd] || {}).feldgroessen || {}) };
    for (const k of K_LISTE) {
      const t0 = Date.now();
      const luecken = [], spieler = [];
      let rennen = 0, ohneZiel = 0;
      for (const versatz of STROEME) {
        const roh = await seite.evaluate(([bd, kader, gruppen, n, versatz, k]) => {
          const st = window.setTimeout; window.setTimeout = () => 0;
          try {
            const out = [];
            gruppen.forEach((gr, g) => {
              const teams = gr.map((i) => kader[i]);
              for (let i = 0; i < n; i++) {
                const saat = (424242 + versatz + g * 104729 + i * 7919) >>> 0;
                const r = window.__arena.spieleBahnPod(bd, teams, saat, null, { formSaat: saat, k });
                out.push({ teams: r.teams.map((t) => [t.eventPlatz, t.wert, t.zielzeit]), werte: r.boxscore.map((b) => b.wert) });
              }
            });
            return out;
          } finally { window.setTimeout = st; }
        }, [bd, KADER, GRUPPEN, RENNEN, versatz, k]);
        for (const r of roh) {
          rennen++;
          spieler.push(...r.werte);
          const sortiert = [...r.teams].sort((a, b) => a[0] - b[0]);
          const wertVon = (t) => (bd === "staffel" ? (t[2] == null ? null : -t[2]) : t[1]);
          for (let i = 0; i + 1 < sortiert.length; i++) {
            const a = wertVon(sortiert[i]), b = wertVon(sortiert[i + 1]);
            if (a == null || b == null) { ohneZiel++; continue; }
            if (a - b > 0) luecken.push(a - b);
          }
        }
      }
      feldgroessen[String(k)] = {
        k, rennen, luecken: luecken.length,
        m90: r2(perzentil(luecken, 0.9)), median: r2(perzentil(luecken, 0.5)), p95: r2(perzentil(luecken, 0.95)),
        spieler: { p50: r2(perzentil(spieler, 0.5)), p995: r2(perzentil(spieler, 0.995)), stichprobe: spieler.length },
        ...(ohneZiel ? { lueckenOhneZiel: ohneZiel } : {}),
      };
      console.log(`${bd} k=${k}: ${rennen} Rennen, m90 ${feldgroessen[String(k)].m90}, Spieler p50 ${feldgroessen[String(k)].spieler.p50} / p995 ${feldgroessen[String(k)].spieler.p995} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    ausgabe.disziplinen[bd] = { feldgroessen };
  }
} finally {
  await browser.close();
}
let commit = null;
try { commit = execSync("git rev-parse HEAD", { cwd: WURZEL }).toString().trim(); } catch {}
ausgabe.hinweis =
  "BAHN-POD-REFERENZ (02.11., scripts/ziehe-bahn-pod-referenz.mjs). Je Disziplin und Kadergroesse k: m90 = 90. Perzentil " +
  "der positiven Teamwert-Luecken zwischen Nachbarplaetzen eines Vier-Team-Rennens (Takeshi Burgpunkte, Staffel Sekunden " +
  "Zielzeit-Abstand) -- gelesen von resolveBahnPodMargeReferenz(); spieler.p50/p995 = Perzentile des Laeuferwerts im " +
  "Boxscore (Burgpunkte bzw. Rangpunkte der Etappe ueber 4k Laeufer) -- gelesen von resolveBahnPodSpielerPpReferenz() " +
  "(lib/resolve/bahn-pod-resolve.ts). Kaderfest ueber die Kader-Familie (210 Vierergruppen, zwei Saatstroeme), " +
  "__arena.spieleBahnPod mit formSaat und k wie im Liga-Vorlauf, ohne Mutator. Neu ziehen nach jeder Aenderung an " +
  "BAHN_ART.staffel/takeshis-castle, bauSpurt/stepSpurt oder dem Pod-Einstieg.";
ausgabe.gezogenAm = new Date().toISOString();
ausgabe.repoCommit = commit;
ausgabe.rennenJeGruppeUndStrom = RENNEN;
writeFileSync(ZIEL, JSON.stringify(ausgabe, null, 1) + "\n");
console.log(`geschrieben: ${ZIEL}`);
