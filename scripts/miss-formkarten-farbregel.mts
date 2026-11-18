// ===================================================================================
// FORMKARTEN-FARBREGEL: ALT GEGEN NEU, rho je Disziplin UND Pp (docs/design/form-moral-17-11.md Abschnitt 6)
//
// Misst mit dem Modus "echt" (wie docs/design/formkarten-motor-p4-11-11.md) denselben Kartenzug je Spiel
// unter vier Regeln: alt (heute: alle gleich, x2 bei Disziplinfarbe) | pm (PM-Faktoren 0,5/1,0 + 0,5
// Farbtraeger) | schmal (0,5/0,75 + 0,5) | pm+form (pm, Farbtraeger in Form ▲/▲▲ um 12,5 % je Stufe
// verstaerkt). Der Motor bleibt unangetastet: gemessen wird eine KOPIE von public/mockups in einem
// Temp-Ordner, in der eine Zeile auf `window.__formHook` umgeleitet ist (scripts/lib/
// formkarten-farbregel-hook.mjs). Gleiche Saaten in allen Laeufen.
//
//   npx tsx scripts/miss-formkarten-farbregel.mts <spiele> <ausgabe.json> [disziplin ...]
//   OLY_SHARD=i/n verteilt die Disziplinen. Mit OLY_PP=1 laeuft zusaetzlich die Pp-Messung
//   (einflussVon, Budget-Methode, zwei Saatstroeme) fuer jede Regel.
// ===================================================================================
import { chromium } from "playwright";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { median, rho } from "./lib/rangtreue-messung.mjs";
import { erzeugeFormHook } from "./lib/formkarten-farbregel-hook.mjs";
import { FARBREGEL_PM, FARBREGEL_SCHMAL, FORM_TRAEGER_HEBEL } from "../lib/lineups/formkarten-farbregel";
import { formToStufe } from "../lib/morale/form-moral-modifikator";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const [spieleArg, ausgabe, ...nur] = process.argv.slice(2);
const SPIELE = Number(spieleArg || 12);

const KLASSENFARBE: Record<string, string> = {
  Berserker: "red", Warlord: "red", Tank: "red", Sprinter: "green", Rogue: "green", Charger: "green",
  Mage: "blue", Overseer: "blue", Templar: "blue", Bard: "yellow", Hero: "yellow", Badass: "yellow", Tactician: "yellow",
};
const DISZ_FARBE: Record<string, string> = {
  "mini-dm": "red", tdm: "red", gewichtheben: "red", hockey: "red", breaking: "red",
  "time-trial": "green", spurt: "green", staffel: "green", climbing: "green", fechten: "green",
  tennis: "blue", wettessen: "blue", "speed-schach": "blue", "takeshis-castle": "blue", "i-spy": "blue",
  showcase: "yellow", basketball: "yellow", battlefield: "yellow", football: "yellow", eiskunstlauf: "yellow",
};

// Temp-Kopie des Mockup-Ordners mit EINER umgeleiteten Zeile (die Quelle im Repo bleibt unberuehrt).
const kopie = mkdtempSync(path.join(os.tmpdir(), "oly-mockups-"));
cpSync(path.join(WURZEL, "public/mockups"), kopie, { recursive: true });
const enginePfad = path.join(kopie, "battle-mode.engine.js");
const original = 'FORM_MESS=FORM_MESS_MODUS==="echt"?zieheFormSzenarioEcht((saat^0x5bd1e995)>>>0,[SQUAD,OPP]):null;';
const umgeleitet =
  'FORM_MESS=FORM_MESS_MODUS==="echt"?(window.__formHook?window.__formHook(saat,[SQUAD,OPP]):zieheFormSzenarioEcht((saat^0x5bd1e995)>>>0,[SQUAD,OPP])):null;';
const text = readFileSync(enginePfad, "utf8");
if (!text.includes(original)) throw new Error("Anker im Motor nicht gefunden (Zeile mit zieheFormSzenarioEcht)");
writeFileSync(enginePfad, text.replace(original, umgeleitet));
const SEITE = new URL("file://" + path.join(kopie, "battle-mode.html")).href;

const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const formPool: number[] = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/form-moral-verteilung.json"), "utf8")).form.werte;
function hash(t: string) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const stufeVon: Record<string, number> = {};
for (const v of familie) for (const s of [...v.heim, ...v.gast]) stufeVon[s.n] = formToStufe(formPool[hash(`form|${s.n}`) % formPool.length]);

type Teiln = { n: string; eig: number; wert: number };
const REGELN: Record<string, unknown> = {
  alt: "alt",
  pm: { regel: FARBREGEL_PM },
  schmal: { regel: FARBREGEL_SCHMAL },
  "pm+form": { regel: FARBREGEL_PM, stufe: stufeVon },
};

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ergebnis: Record<string, Record<string, unknown>> = {};
try {
  const seite = await browser.newPage();
  const fehler: string[] = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => (window as any).__arena && (window as any).__arena.disziplinProbe, null, { timeout: 30000 });
  await seite.evaluate(() => (window as any).__arena.formModusMessung("echt"));
  const alle: string[] = nur.length ? nur : await seite.evaluate(() => (window as any).__arena.motoren());
  const [si, sn] = (process.env.OLY_SHARD ?? "0/1").split("/").map(Number);

  for (const d of alle.filter((_, i) => i % sn === si)) {
    const zeile: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(REGELN)) {
      const cfg = {
        regel: def === "alt" ? "alt" : (def as any).regel,
        stufe: def === "alt" ? null : (def as any).stufe ?? null,
        hebel: FORM_TRAEGER_HEBEL,
        dFarbe: DISZ_FARBE[d] ?? null,
        klassenFarbe: KLASSENFARBE,
      };
      await seite.evaluate(
        ({ src, cfg }) => { (window as any).__formHook = (new Function("return " + src))()(cfg); },
        { src: erzeugeFormHook.toString(), cfg },
      );
      const x = await seite.evaluate(([d, n, f]) => (window as any).__arena.disziplinProbe(d, { n, kaderFamilie: f }), [d, SPIELE, familie] as [string, number, unknown]);
      if (x.fehler || !x.varianten) { zeile[name] = { fehler: x.fehler ?? "keine Varianten" }; continue; }
      const jeVariante = (x.varianten as Array<{ spiele: Array<{ teilnehmer: Teiln[] }> }>).map((v) => {
        const werte = v.spiele.map((s) => rho(s.teilnehmer)).filter((q: number) => !Number.isNaN(q));
        return werte.reduce((a: number, b: number) => a + b, 0) / Math.max(1, werte.length);
      });
      const entry: Record<string, unknown> = { rho: median(jeVariante), spannweite: Math.max(...jeVariante) - Math.min(...jeVariante) };
      if (process.env.OLY_PP === "1" && (name === "alt" || name === "pm")) {
        const pp = [] as number[];
        for (const versatz of (process.env.OLY_PP_VERSATZ ? [0] : [0, 10000000])) {
          const e = await seite.evaluate(([d, n, v]) => {
            const st = window.setTimeout;
            (window as any).setTimeout = () => 0;
            try { return (window as any).__arena.einflussVon(d, n, undefined, v); } finally { window.setTimeout = st; }
          }, [d, Number(process.env.OLY_PP_LAEUFE ?? 48), versatz] as [string, number, number]);
          pp.push(e && typeof e.abweichungPp === "number" ? e.abweichungPp : NaN);
        }
        entry.pp = pp;
      }
      zeile[name] = entry;
    }
    ergebnis[d] = zeile;
    console.log(d.padEnd(18) + Object.keys(REGELN).map((k) => `${k}: ${((zeile[k] as any).rho ?? NaN).toFixed(3)}`).join("   "));
  }
  if (fehler.length) console.log("Seitenfehler:", fehler.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
if (ausgabe) writeFileSync(ausgabe, JSON.stringify({ spiele: SPIELE, ergebnis }, null, 1));
