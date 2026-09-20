// ===================================================================================
// GEMEINSAMER KERN der kaderfesten Rangtreue-Messung — herausgezogen aus
// scripts/miss-alle-disziplinen.mjs, damit scripts/pruefe-rangtreue-schranke.mjs (die
// CI-Schranke, docs/design/messgrundlage-kaderfest.md) dieselbe Rechnung benutzt statt einer
// zweiten, die auseinanderlaufen koennte.
//
// Hintergrund: docs/design/projekt-ueberwachung-opus.md Abschnitt 1.3. `disziplinProbe` mass
// bis 03.09.2026 IMMER denselben 17-Spieler-Testkader in derselben Paarung; Kaderwechsel bei
// UNVERAENDERTER Mechanik bewegten rho um bis zu 0,73. Seither misst `disziplinProbe` optional
// ueber eine KADER-FAMILIE (`opt.kaderFamilie`, s. battle-mode.engine.js) und dieses Modul
// bildet daraus Median und Spannweite je Disziplin.
// ===================================================================================
import { existsSync, readFileSync } from "node:fs";

// Spearman ueber Paare {eig, wert}. Bindungen bekommen den Durchschnittsrang, sonst
// verzerren gleiche Werte (bei Bahn-Platzierungen keine Seltenheit) das Ergebnis.
export function rho(paare) {
  const n = paare.length;
  if (n < 3) return NaN;
  const rang = (key) => {
    const s = paare.map((p, i) => ({ i, v: p[key] })).sort((a, b) => b.v - a.v);
    const r = new Array(n);
    let k = 0;
    while (k < n) {
      let j = k;
      while (j + 1 < n && s[j + 1].v === s[k].v) j++;
      const mittel = (k + j) / 2 + 1;
      for (let m = k; m <= j; m++) r[s[m].i] = mittel;
      k = j + 1;
    }
    return r;
  };
  const a = rang("eig"), b = rang("wert");
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    sab += da * db; sa += da * da; sb += db * db;
  }
  return sab / Math.sqrt(sa * sb || 1);
}

// rho je Spiel (gemittelt ueber alle Spiele) und rho ueber die Saison (Teilnehmer erst
// mitteln, dann einmal ordnen) fuer EINE `spiele`-Liste aus disziplinProbe.
export function auswerten(spieleListe) {
  const jeSpiel = spieleListe.map((s) => rho(s.teilnehmer)).filter((v) => !Number.isNaN(v));
  const agg = new Map();
  for (const s of spieleListe) for (const t of s.teilnehmer) {
    const a = agg.get(t.n) || { n: t.n, eig: 0, wert: 0, k: 0 };
    a.eig += t.eig; a.wert += t.wert; a.k++; agg.set(t.n, a);
  }
  const saison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
  return {
    spiel: jeSpiel.reduce((a, b) => a + b, 0) / Math.max(1, jeSpiel.length),
    saison, teilnehmer: agg.size,
  };
}

// Gibt `true` zurueck, wenn IRGENDEIN Teilnehmer in der Spieleliste als Torwart markiert
// ist (Fable-Recherche 1.1/3.1: Hockeys Torwart-Wert ist eine andere Formel als die der
// Feldspieler und schwankt je Spiel binomial staerker, als der reale Faehigkeitsunterschied
// zwischen bestem und schlechtestem Torwart ausmacht — die 0,80-Schranke soll ihn deshalb
// NICHT mitordnen). Fuer jede andere Disziplin ist `torwart` nie gesetzt, die Funktion
// liefert also `false` und die aufrufende Seite laesst die Feldspieler-Spalte einfach weg.
export function hatTorwart(spieleListe) {
  return spieleListe.some((s) => s.teilnehmer.some((t) => t.torwart === true));
}

// Dieselbe `spiele`-Liste OHNE die als Torwart markierten Teilnehmer — fuer `auswerten()`,
// wenn nur die Feldspieler geordnet werden sollen.
export function ohneTorwart(spieleListe) {
  return spieleListe.map((s) => ({ ...s, teilnehmer: s.teilnehmer.filter((t) => !t.torwart) }));
}

export function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const n = s.length, m = n >> 1;
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function spannweite(werte) {
  return Math.max(...werte) - Math.min(...werte);
}

// Deterministischer PRNG (identisch zum mulberry32 in scripts/ziehe-hockey-pps-referenz.ts u.a.)
// — bewusst NICHT Math.random(), damit derselbe Aufruf reproduzierbar dieselbe Zahl liefert
// (CLAUDE.md warnt an anderer Stelle genau davor: `zieheFormkarten` nahm z % n von einem LCG,
// dessen unterste Bits eine winzige Periode hatten — hier gilt: ueberhaupt kein LCG, sondern
// mulberry32 mit oberen Bits, und ein fester Seed statt einer Uhrzeit).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * M0 (20.09.2026, PM-Plan Wave 1): DRITTE Statistik neben Median/Spannweite — additiv, keine
 * bestehende Ausgabe aendert sich, solange der Aufrufer diese Funktion nicht selbst aufruft.
 *
 * Frage: ist der Median einer Kader-Familie eine PRAEZISE Zahl, oder haengt er stark davon ab,
 * WELCHE Paarungen zufaellig in der Familie stehen? Bei nur fuenf Paarungen (Arena bisher) kann
 * ein einziger Ausreisser den Median einer 5er-Familie kippen; bei sechzehn ist das viel
 * schwerer. Bootstrap beantwortet das ohne Annahme ueber die Verteilung: `wiederholungen`-mal
 * wird MIT Zuruecklegen aus den vorliegenden Paarungswerten (je Paarung EIN rho, z.B. `spiel` aus
 * `varianten`) eine gleich grosse Ersatz-Familie gezogen und ihr Median berechnet. Die Breite
 * eines zentralen `quantil`-Intervalls ueber diese Ersatz-Mediane ist die "Median-Unsicherheit":
 * klein heisst, der gemeldete Median waere auch mit einer anderen Ziehung aehnlich herausgekommen
 * — die Familie ist gross/konsistent genug, um zu MESSEN, nicht nur zu SCHAETZEN.
 *
 * Deterministisch (mulberry32 mit festem Default-Seed, kein Math.random) — derselbe Aufruf
 * liefert immer dieselbe Zahl, unabhaengig davon, wie oft oder wann er laeuft.
 */
export function bootstrapMedianUnsicherheit(werte, { wiederholungen = 2000, quantil = 0.90, saat = 1337 } = {}) {
  const n = werte.length;
  if (n < 2) return { breite: NaN, unten: NaN, oben: NaN, wiederholungen: 0, n };
  const zufall = mulberry32(saat);
  const mediane = new Array(wiederholungen);
  for (let r = 0; r < wiederholungen; r++) {
    const ziehung = new Array(n);
    for (let i = 0; i < n; i++) ziehung[i] = werte[Math.floor(zufall() * n)];
    mediane[r] = median(ziehung);
  }
  mediane.sort((a, b) => a - b);
  const alpha = (1 - quantil) / 2;
  const untenIdx = Math.max(0, Math.floor(alpha * wiederholungen));
  const obenIdx = Math.min(wiederholungen - 1, Math.ceil((1 - alpha) * wiederholungen) - 1);
  return { breite: mediane[obenIdx] - mediane[untenIdx], unten: mediane[untenIdx], oben: mediane[obenIdx], wiederholungen, n };
}

/**
 * Laedt die Kader-Familie aus einer gezogenen live-save-Datei (s. scripts/ziehe-kader-familie.ts).
 * Gibt `null` zurueck, wenn die Datei fehlt — der Aufrufer entscheidet dann ueber den
 * synthetischen Ausweichkader (`baueSynthetischeKaderFamilie`).
 */
export function ladeKaderFamilieAusDatei(pfad) {
  if (!existsSync(pfad)) return null;
  const roh = JSON.parse(readFileSync(pfad, "utf8"));
  return {
    familie: roh.varianten.map((v) => ({ label: v.label, heim: v.heim, gast: v.gast })),
    quelle: `live-save (${roh.quelle?.saveName ?? roh.quelle?.saveId ?? "?"}, gezogen ${roh.quelle?.gezogenAm ?? "?"})`,
  };
}

/**
 * KOMPROMISS ohne live-save-Zugriff (docs/design/messgrundlage-kaderfest.md): dieselben 17
 * Spieler aus dem hartkodierten SQUAD/OPP (`window.__arena.kader()`/`.opp()`), deterministisch
 * in vier weitere 8-gegen-8-Aufteilungen gemischt — die Methode aus dem Opus-Anhang
 * ("Kader-Sensitivitaetssonde"). Keine Verbesserung gegenueber der echten live-save-Familie,
 * nur ein Ausweg, wenn sie nicht gezogen werden konnte.
 */
export async function baueSynthetischeKaderFamilie(seite) {
  const { squad, opp } = await seite.evaluate(() => ({ squad: window.__arena.kader(), opp: window.__arena.opp() }));
  const alle = [...squad, ...opp].map(({ n, c, r, sub, tp, tn, d, a, groesse }) => ({ n, c, r, sub, tp, tn, d, a, groesse }));
  const mische = (schritt) => {
    const n = alle.length, out = [];
    let i = 0; const gesehen = new Set();
    while (out.length < n) { if (!gesehen.has(i)) { gesehen.add(i); out.push(alle[i]); } i = (i + schritt) % n; }
    return out;
  };
  const familie = [{ label: "original", heim: squad, gast: opp }];
  for (const schritt of [3, 5, 6, 7]) {
    const gemischt = mische(schritt);
    familie.push({ label: `mischung-${schritt}`, heim: gemischt.slice(0, 8), gast: gemischt.slice(8, 16) });
  }
  return { familie, quelle: "SYNTHETISCH (Kompromiss ohne live-save-Abbild)" };
}

/**
 * Feldspieler-only-Zusatz (Fable-Recherche 1.1/3.1): nur ausgefuellt, wenn IRGENDEINER der
 * Spieldurchlaeufe einen als Torwart markierten Teilnehmer enthaelt (heute nur Hockey) —
 * fuer jede andere Disziplin liefert das ein leeres Objekt, und `disziplinMessen` gibt
 * exakt dieselben Felder zurueck wie vorher. `gruppen` ist die Liste der Spieldurchlaeufe,
 * je Kader-Variante einer (oder ein einzelner Eintrag ohne Kaderfamilie).
 */
function feldOnlyZusatz(gruppen) {
  if (!gruppen.some((g) => hatTorwart(g.spiele))) return {};
  const ausw = gruppen.map((g) => ({ label: g.label, ...auswerten(ohneTorwart(g.spiele)) }))
    .filter((v) => !Number.isNaN(v.spiel));
  if (!ausw.length) return {};
  return {
    spielMedFeld: median(ausw.map((v) => v.spiel)), spielSpanFeld: spannweite(ausw.map((v) => v.spiel)),
    saisonMedFeld: median(ausw.map((v) => v.saison)), saisonSpanFeld: spannweite(ausw.map((v) => v.saison)),
    teilnehmerFeld: Math.round(ausw.reduce((a, v) => a + v.teilnehmer, 0) / ausw.length),
  };
}

/**
 * Misst EINE Disziplin ueber die gegebene Kader-Familie (oder ohne Familie den bisherigen
 * Einzelkader-Weg) und fasst sie zu Median/Spannweite zusammen. `seite` ist eine
 * Playwright-Page mit bereits geladenem `window.__arena`.
 */
export async function disziplinMessen(seite, d, { n, kaderFamilie, jeSeite }) {
  let x;
  try {
    x = await seite.evaluate(
      ([d, n, familie, js]) => window.__arena.disziplinProbe(d, {
        n, ...(familie ? { kaderFamilie: familie } : {}), ...(js ? { jeSeite: js } : {}),
      }),
      [d, n, kaderFamilie || null, jeSeite || null],
    );
  } catch (e) {
    return { d, fehler: String(e).slice(0, 60) };
  }
  if (x.fehler) return { d, fehler: x.fehler };

  if (x.varianten) {
    const ausw = x.varianten.map((v) => ({ label: v.label, ...auswerten(v.spiele) }))
      .filter((v) => !Number.isNaN(v.spiel));
    if (!ausw.length) return { d, fehler: "keine Spiele" };
    return {
      d, chassis: x.chassis,
      spielMed: median(ausw.map((v) => v.spiel)), spielSpan: spannweite(ausw.map((v) => v.spiel)),
      saisonMed: median(ausw.map((v) => v.saison)), saisonSpan: spannweite(ausw.map((v) => v.saison)),
      teilnehmer: Math.round(ausw.reduce((a, v) => a + v.teilnehmer, 0) / ausw.length),
      varianten: ausw,
      ...feldOnlyZusatz(x.varianten),
    };
  }
  if (!x.spiele.length) return { d, fehler: "keine Spiele" };
  const e = auswerten(x.spiele);
  return {
    d, chassis: x.chassis, spielMed: e.spiel, spielSpan: 0, saisonMed: e.saison, saisonSpan: 0, teilnehmer: e.teilnehmer,
    ...feldOnlyZusatz([{ label: null, spiele: x.spiele }]),
  };
}
