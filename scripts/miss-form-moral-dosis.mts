// ===================================================================================
// FORM + MORAL: WIE VIEL KOSTET DIE DOSIS AN RANGTREUE? (docs/design/form-moral-17-11.md, Abschnitt 7)
//
// Misst je Disziplin rho je Spiel (Median ueber die Kader-Familie, wie miss-alle-disziplinen.mjs) bei
// mehreren Dosen. Jeder Spieler der Kader-Familie bekommt Form und Moral aus der Verteilung
// data/generated/form-moral-verteilung.json (Form: Monte-Carlo ueber die echte Fortschreibung; Moral:
// echte Werte des Spielstand-Abbilds), zugeordnet per Namens-Hash (deterministisch). Der Multiplikator
// kommt aus DERSELBEN Funktion wie im Spiel (calculateFormMoralSignal) und wird mit
// scaleArenaPlayerByMultiplier auf Eignung UND Attribute der Kader-Spieler angewandt.
//
// ZAEHLWEISE: rho wird gegen die Eignung OHNE Modifikator gemessen (Basislauf, Dosis 0, gleiche Saaten,
// je Spiel und Name). Das ist die ehrliche Kostenfrage: der Modifikator weicht ABSICHTLICH von der
// Basis-Eignung ab (wie der Mutator), die Abnahme soll das sehen, nicht wegrechnen. Zusatzspalte:
// rho gegen die eigene (modifizierte) Eignung des Laufs.
//
//   npx tsx scripts/miss-form-moral-dosis.ts <spiele> <dosen,komma> <ausgabe.json> [disziplin ...]
//   Dosis = Prozent je Form-Stufe (0 = Basis; 1,5 = Vorschlag => Form +-3 % plus Moral +-1 %).
//   Dosen mit Suffix "k" fahren den Worst-Case "Karte": jeder Spieler mit positiver Form
//   bekommt eine passende 8er-Karte (Verstaerkung x1,5), z. B. 1.5k.
// ===================================================================================
import { chromium } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { median, rho } from "./lib/rangtreue-messung.mjs";
import { calculateFormMoralSignal, scaleArenaPlayerByMultiplier } from "../lib/morale/form-moral-modifikator";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = new URL("file://" + path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const [spieleArg, dosenArg, ausgabe, ...nur] = process.argv.slice(2);
const SPIELE = Number(spieleArg || 12);
const DOSEN = (dosenArg || "0,1,1.5,2.5").split(",");

type Spieler = { n: string; d: Record<string, number>; a: Record<string, number> } & Record<string, unknown>;
const familie = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten as Array<{
  label: string;
  heim: Spieler[];
  gast: Spieler[];
}>;
const verteilung = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/form-moral-verteilung.json"), "utf8"));
const formPool: number[] = verteilung.form.werte;
const moralPool: number[] = verteilung.morale.werte;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function dosisFamilie(dosisText: string) {
  const karte = dosisText.endsWith("k");
  const dosis = Number(dosisText.replace("k", ""));
  if (dosis === 0) return familie;
  const wende = (liste: Spieler[], label: string) =>
    liste.map((s) => {
      // zwei unabhaengige Ziehungen aus den Pools (Form, Moral), je Name + Variante
      const form = formPool[hash(`form|${label}|${s.n}`) % formPool.length];
      const moral = moralPool[hash(`moral|${label}|${s.n}`) % moralPool.length];
      const signal = calculateFormMoralSignal({ form, morale: moral, dosisPct: dosis, formVerstaerkung: karte ? 1.5 : 1 });
      return scaleArenaPlayerByMultiplier(s, signal.multiplier);
    });
  return familie.map((v) => ({ ...v, heim: wende(v.heim, v.label), gast: wende(v.gast, v.label) }));
}

type Teiln = { n: string; eig: number; wert: number };
type Spiel = { teilnehmer: Teiln[] };

function rhoJeSpiel(spiele: Spiel[], eigVon: (spielIndex: number, t: Teiln) => number): number {
  const werte = spiele
    .map((s, i) => rho(s.teilnehmer.map((t) => ({ eig: eigVon(i, t), wert: t.wert }))))
    .filter((v: number) => !Number.isNaN(v));
  return werte.reduce((a: number, b: number) => a + b, 0) / Math.max(1, werte.length);
}

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ergebnis: Record<string, Record<string, unknown>> = {};
try {
  const seite = await browser.newPage();
  const fehler: string[] = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => (window as any).__arena && (window as any).__arena.disziplinProbe, null, { timeout: 30000 });
  const alle: string[] = nur.length ? nur : await seite.evaluate(() => (window as any).__arena.motoren());

  // OLY_SHARD="i/n": nur jede n-te Disziplin ab Index i (zum Parallelfahren)
  const [si, sn] = (process.env.OLY_SHARD ?? "0/1").split("/").map(Number);
  for (const d of alle.filter((_, i) => i % sn === si)) {
    const zeile: Record<string, unknown> = {};
    let basis: Array<{ label: string; spiele: Spiel[] }> | null = null;
    for (const dosisText of DOSEN) {
      const fam = dosisFamilie(dosisText);
      const x = await seite.evaluate(
        ([d, n, f]) => (window as any).__arena.disziplinProbe(d, { n, kaderFamilie: f }),
        [d, SPIELE, fam] as [string, number, unknown],
      );
      if (x.fehler || !x.varianten) {
        zeile[dosisText] = { fehler: x.fehler ?? "keine Varianten" };
        continue;
      }
      const varianten = x.varianten as Array<{ label: string; spiele: Spiel[] }>;
      if (Number(dosisText.replace("k", "")) === 0) basis = varianten;
      const jeVarianteBasis: number[] = [];
      const jeVarianteEigen: number[] = [];
      let fehlend = 0;
      let gesamt = 0;
      varianten.forEach((v, vi) => {
        jeVarianteEigen.push(rhoJeSpiel(v.spiele, (_i, t) => t.eig));
        const b = basis?.[vi]?.spiele;
        jeVarianteBasis.push(
          rhoJeSpiel(v.spiele, (i, t) => {
            gesamt++;
            const ref = b?.[i]?.teilnehmer.find((bt) => bt.n === t.n);
            if (!ref) fehlend++;
            return ref ? ref.eig : t.eig;
          }),
        );
      });
      zeile[dosisText] = {
        rhoGegenBasis: median(jeVarianteBasis),
        rhoGegenEigene: median(jeVarianteEigen),
        ohneBasisEignungProzent: gesamt ? Math.round((fehlend / gesamt) * 1000) / 10 : 0,
      };
    }
    ergebnis[d] = zeile;
    const t = DOSEN.map((k) => {
      const z = zeile[k] as { rhoGegenBasis?: number; fehler?: string };
      return `${k}: ${z.rhoGegenBasis != null ? z.rhoGegenBasis.toFixed(3) : z.fehler}`;
    }).join("   ");
    console.log(d.padEnd(18) + t);
  }
  if (fehler.length) console.log("Seitenfehler:", fehler.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
if (ausgabe) writeFileSync(ausgabe, JSON.stringify({ spiele: SPIELE, dosen: DOSEN, ergebnis }, null, 1));
