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

export function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const n = s.length, m = n >> 1;
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function spannweite(werte) {
  return Math.max(...werte) - Math.min(...werte);
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
    };
  }
  if (!x.spiele.length) return { d, fehler: "keine Spiele" };
  const e = auswerten(x.spiele);
  return { d, chassis: x.chassis, spielMed: e.spiel, spielSpan: 0, saisonMed: e.saison, saisonSpan: 0, teilnehmer: e.teilnehmer };
}
