// ===================================================================================
// BATTLEFIELD-POD-REFERENZ ZIEHEN — M90 + Spieler-PP-Perzentile je Kadergroesse k=2..6 (02.11.).
//
// Seit 02.11. abends bucht die Liga Battlefield-Pods ueber das GEFECHT JE ORT (bfffaGefecht in
// public/mockups/battle-mode.engine.js, docs/design/battlefield-pod-ffa-02-11.md Abschnitt 7).
// Die Buchungsformel (berechneBattlefieldPodOverride() in lib/resolve/mini-dm-pod-resolve.ts)
// braucht zwei Referenzen, die erst im Motor entstehen — deshalb Playwright, dieselbe Bauart wie
// scripts/ziehe-mini-dm-ffa-referenz.mjs:
//   - m90: 90. Perzentil der positiven PUNKTE-LUECKEN (Kontrollpunkt-Punkte) zwischen
//     aufeinanderfolgenden Plaetzen eines Pods — die Groesse, die berechneErgebnisNormiertNTeam()
//     als Marge in die 0-10-Wertung gibt.
//   - spieler.p50/p995: Perzentile der rohen Kampfrichterwertung (`roh`) EINES Kaempfers — gelesen
//     von ppAusBattlefieldPodWertung() fuer die Spieler-PP (Impact-Kurve wie pps_duell/Arena).
// Kaderfest ueber die zehn Teams der Kader-Familie (data/generated/kaderfamilie-live-save.json),
// alle C(10,4) = 210 Vierergruppen, zwei Saatstroeme.
//
//   node scripts/ziehe-battlefield-pod-referenz.mjs [kaempfe je Gruppe, Standard 6] [--k=2..6]
//        [--ausgabe=<datei>]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const wert = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const positionen = args.filter((a) => !a.startsWith("--"));
const SPIELE = Number(positionen[0] || 6);
const ZIEL = wert("ausgabe") ? path.resolve(wert("ausgabe")) : path.join(WURZEL, "data/generated/battlefield-pod-referenz.json");
const KS = (() => {
  const roh = wert("k");
  if (!roh) return [2, 3, 4, 5, 6];
  const b = roh.match(/^(\d+)\.\.(\d+)$/);
  if (b) return Array.from({ length: Number(b[2]) - Number(b[1]) + 1 }, (_, i) => Number(b[1]) + i);
  return roh.split(",").map(Number);
})();

const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8"));
const teamsNachName = new Map();
for (const v of familie.varianten) {
  if (!teamsNachName.has(v.heimName)) teamsNachName.set(v.heimName, v.heim);
  if (!teamsNachName.has(v.gastName)) teamsNachName.set(v.gastName, v.gast);
}
const KADER = [...teamsNachName.values()];
const GRUPPEN = [];
for (let a = 0; a < KADER.length; a++) for (let b = a + 1; b < KADER.length; b++) for (let c = b + 1; c < KADER.length; c++) for (let d = c + 1; d < KADER.length; d++) GRUPPEN.push([a, b, c, d]);

const perzentil = (werte, p) => {
  const s = [...werte].sort((x, y) => x - y);
  if (!s.length) return null;
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
};
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const bestehend = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, "utf8")) : { feldgroessen: {} };
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await seite.goto(pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.battlefieldPodSonde, null, { timeout: 60000 });
  for (const k of KS) {
    const luecken = [], roh = [];
    let pods = 0;
    for (const versatz of [0, 10000000]) {
      const ergebnis = await seite.evaluate(([kader, gruppen, n, versatz, k]) => {
        const st = window.setTimeout; window.setTimeout = () => 0;
        try { return window.__arena.battlefieldPodSonde(kader, { gruppen, n, versatz, jeSeite: k }); }
        finally { window.setTimeout = st; }
      }, [KADER, GRUPPEN, SPIELE, versatz, k]);
      for (const ev of ergebnis.events) {
        pods++;
        const nachPlatz = [...ev.teams].sort((x, y) => x.eventPlatz - y.eventPlatz);
        for (let i = 0; i + 1 < nachPlatz.length; i++) {
          const d = nachPlatz[i].punkte - nachPlatz[i + 1].punkte;
          if (d > 0) luecken.push(d);
        }
        for (const t of ev.teilnehmer) if (typeof t.roh === "number") roh.push(t.roh);
      }
    }
    bestehend.feldgroessen[String(k)] = {
      k, pods, luecken: luecken.length,
      m90: r2(perzentil(luecken, 90)), median: r2(perzentil(luecken, 50)), max: r2(Math.max(...luecken)),
      spieler: { p50: r2(perzentil(roh, 50)), p995: r2(perzentil(roh, 99.5)), stichprobe: roh.length },
    };
    console.log(`k=${k}: ${pods} Pods, m90 ${bestehend.feldgroessen[String(k)].m90}, Spieler p50 ${bestehend.feldgroessen[String(k)].spieler.p50} / p99,5 ${bestehend.feldgroessen[String(k)].spieler.p995}`);
  }
} finally {
  await browser.close();
}
bestehend.hinweis =
  "Referenz fuer die Buchung des Battlefield-Pods ueber das Gefecht je Ort (02.11., scripts/ziehe-battlefield-pod-referenz.mjs). " +
  "m90 = 90. Perzentil der positiven Kontrollpunkt-Punkte-Luecken zwischen aufeinanderfolgenden Pod-Plaetzen (resolveBattlefieldPodMargeReferenz), " +
  "spieler.p50/p995 = Perzentile der rohen Kampfrichterwertung je Kaempfer (resolveBattlefieldPodSpielerPpReferenz/ppAusBattlefieldPodWertung), " +
  "beides in lib/resolve/mini-dm-pod-resolve.ts. Neu ziehen, wenn BF_FFA_GRUND in battle-mode.engine.js geaendert wird.";
writeFileSync(ZIEL, JSON.stringify({ hinweis: bestehend.hinweis, feldgroessen: bestehend.feldgroessen }, null, 1) + "\n");
console.log(`geschrieben: ${path.relative(WURZEL, ZIEL)}`);
