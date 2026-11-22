// ===================================================================================
// AUSRUESTUNG, PHASE 0: MESSGERUEST "SPIEGELKADER" (22.11., docs/design/ausruestung-pilot-bauplan-22-11.md)
//
// Frage des Bauplans: was bringt ein Ausruestungs-Aufschlag an Siegquote, und ab wann ist er vom Rauschen
// zu trennen? Gemessen wird nicht gegen einen fremden Kader, sondern gegen sich selbst:
//
//   SPIEGELKADER   Beide Seiten sind derselbe Kader (die zweite Seite traegt umbenannte Kopien). Ein Unterschied
//                  im Ergebnis kommt deshalb NUR von der Ausruestung, nicht von der Kaderstaerke.
//   GEPAARTE SAATEN Jede Bedingung laeuft ueber dieselben Spielsaaten (Formkarten, Mutatoren, Bau). Die Ausruestung
//                  steckt einmal auf der Heimseite und einmal auf der Gastseite (Seitentausch), damit eine
//                  Heim-/Gast-Asymmetrie des Motors nicht als Wirkung zaehlt.
//   RAUSCHBODEN    Dieselbe Messung OHNE Ausruestung (Kontrolle). Alles, was nicht deutlich ueber deren Streuung
//                  liegt, ist von Null nicht zu unterscheiden. Standard und Selten werden deshalb als "typischer
//                  Kader" gemessen (viele Traeger, mehrere Paarungen), nicht je Teil.
//
// SIEGQUOTE = W + 1/2 U ueber die Summe der Spielerwerte je Seite (`wert` der Motor-Sonde). Das ist ein Naeherungswert
// fuer das Spielergebnis (Feldspiele: Punkte, Buehne: Punkte, Bahn: Wertung); Phase 2 misst mit den echten Ergebnissen.
//
// WIRKUNG DER AUSRUESTUNG im Messkader = genau die Formel der Konzepte: Attributaufschlag `a += delta` (gekappt je
// `--kappe`) und flacher Eignungsschritt `d += Summe(delta * Matrixgewicht / 100)`; die Rangtabelle wird NICHT neu
// gerechnet (Bauplan A.1, wie `eigHebung()` im Motor).
//
//   env -u NODE_OPTIONS node scripts/miss-ausruestung-spiegel.mjs --node [spiele] [disziplin ...]
//
//   --stufe=standard|selten|episch|legendaer   Attributpunkte je Traeger: 3 / 8 / 15 / 26 (Konzept 61), Standard selten
//   --teile=N                                  Teile je Traeger (Vielfaches der Punkte, 1 oder 2), Standard 1
//   --traeger=alle|N                           alle zwoelf oder die besten N nach Eignung der Disziplin, Standard alle
//   --verteilung=beste|typisch                 beste = alle Punkte auf das Attribut mit dem hoechsten Matrixgewicht
//                                              (bester Wurf), typisch = auf zwei Attribute der Familie gestreut
//                                              (60 % bevorzugt, 40 % beliebig; deterministisch gewuerfelt)
//   --kappe=100|130|keine                      Kappung des Attributs, Standard 100 (wie der Adapter heute)
//   --varianten=K                              wie viele Paarungen der Kader-Familie (1..5), Standard 3
//   --sonde-a130                               SONDE: rechnen die Rezepte bei a > 100 sauber? (siehe unten)
//   --json=<pfad>                              Ergebnis zusaetzlich als JSON
//
// SONDE a > 100 (Bauplan Phase 0, Risiko 1): je Disziplin drei Bedingungen ueber dieselben Saaten:
//   BASIS  Spiegel ohne Aufschlag (in der Auswertung die Kontrolle).
//   A      Aufschlag bis a = 130 (delta = min(30, 130 - a) auf jedes Attribut mit Gewicht), d um die gewichtete Summe.
//   B      derselbe Aufschlag, a aber bei 100 gekappt (der Ueberschuss wirkt nur ueber den Eignungsschritt d).
// Geprueft wird: (1) alle Werte endlich und >= 0 (kein NaN, kein Unendlich, kein Vorzeichenbruch), (2) Siegquote A und B
// gegen Basis (A > 50 %: der Aufschlag wirkt in der richtigen Richtung), (3) A - B: wirkt der Teil ueber 100 zusaetzlich
// (Rezept nutzt a ueber 100) oder ist er wirkungslos (Rezept kappt selbst), (4) die Rangtreue rho (Eignung gegen Wert,
// Median ueber die Spiele) in BASIS und in A: bricht sie ein, rechnet das Rezept bei a > 100 falsch.
// ===================================================================================
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { oeffneNodeSeite } from "./lib/node-arena-seite.mjs";
import { officialDisciplineWeightMatrix, officialDisciplineWeightOrder } from "../lib/player-generator/official-discipline-weights.ts";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (!args.includes("--node")) {
  console.error("Nur ueber den Node-Motor: --node angeben (Chromium wird hier nicht gebraucht).");
  process.exit(2);
}
const wert = (name, vorgabe) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? vorgabe;
const STUFE = wert("stufe", "standard");
const TEILE = Number(wert("teile", "1"));
const TRAEGER = wert("traeger", "alle");
const VERTEILUNG = wert("verteilung", "beste");
const KAPPE = wert("kappe", "100");
const K_VARIANTEN = Math.max(1, Math.min(5, Number(wert("varianten", "3"))));
const SONDE_A130 = args.includes("--sonde-a130");
const JSON_PFAD = wert("json", null);
const rest = args.filter((a) => !a.startsWith("--"));
const SPIELE = Number(rest[0] || 12);
const NUR = rest.slice(1);

const STUFEN_PUNKTE = { standard: 3, selten: 8, episch: 15, legendaer: 26 };
if (!STUFEN_PUNKTE[STUFE]) { console.error(`Unbekannte Stufe: ${STUFE}`); process.exit(2); }
const PUNKTE = STUFEN_PUNKTE[STUFE] * TEILE;
const KAPPEN = { 100: 100, 130: 130, keine: Infinity };
if (!(KAPPE in KAPPEN)) { console.error(`Unbekannte Kappe: ${KAPPE}`); process.exit(2); }

// ---- kleine Bausteine -----------------------------------------------------------------------------------------------

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const runde2 = (x) => Math.round(x * 100) / 100;

/** Familien-Vorzugsattribute fuer `typisch` (Konzept 59, vereinfacht auf feste Paare). */
const FAMILIEN_PAARE = [
  ["dexterity", "speed"], ["health", "power"], ["intelligence", "will"], ["power", "dexterity"],
  ["speed", "stamina"], ["awareness", "determination"], ["charisma", "spirit"], ["will", "torment"],
];
const ATTRIBUTE = ["power", "health", "determination", "stamina", "speed", "dexterity", "awareness", "intelligence", "will", "charisma", "spirit", "torment"];

/** Verteilt `punkte` Attributpunkte auf Attribute; liefert { attribut: delta }. */
function verteile(spieler, disziplin, punkte, art) {
  const gew = officialDisciplineWeightMatrix[disziplin] ?? {};
  if (art === "beste") {
    const top = Object.entries(gew).sort((a, b) => b[1] - a[1])[0];
    return top ? { [top[0]]: punkte } : {};
  }
  // typisch: Bloecke zu je 1 Punkt-Drittel; je Block wuerfelt die Saat des Spielers ein Attribut, 60 % aus dem Familienpaar.
  const out = {};
  const bloecke = Math.max(1, Math.round(punkte / 3));
  const je = punkte / bloecke;
  const familie = FAMILIEN_PAARE[hash(spieler.id ?? spieler.n) % FAMILIEN_PAARE.length];
  for (let i = 0; i < bloecke; i += 1) {
    const h = hash(`${spieler.id ?? spieler.n}|${disziplin}|${i}`);
    const attr = (h % 100) < 60 ? familie[(h >>> 8) % 2] : ATTRIBUTE[(h >>> 8) % ATTRIBUTE.length];
    out[attr] = (out[attr] ?? 0) + je;
  }
  return out;
}

/** Wendet ein Delta-Paket auf eine Kopie des Spielers an. Rein. */
function mitAusruestung(spieler, disziplin, deltas, kappe) {
  const gew = officialDisciplineWeightMatrix[disziplin] ?? {};
  const a = { ...spieler.a };
  let eigDelta = 0;
  for (const [attr, dRoh] of Object.entries(deltas)) {
    const vorher = a[attr] ?? 0;
    const nachher = Math.min(kappe, vorher + dRoh);
    a[attr] = nachher;
    // Eignungsschritt: gewichtetes Delta, UNGEKAPPT (die Rangtabelle wird nicht neu gerechnet).
    eigDelta += (dRoh * (gew[attr] ?? 0)) / 100;
  }
  const d = { ...spieler.d, [disziplin]: runde2((spieler.d?.[disziplin] ?? 0) + eigDelta) };
  return { ...spieler, a, d, _eigDelta: eigDelta };
}

function umbenennen(spieler) {
  return spieler.map((p) => ({ ...p, n: `${p.n} II`, id: `${p.id}-II` }));
}

function waehleTraeger(kader, disziplin) {
  if (TRAEGER === "alle") return new Set(kader.map((p) => p.n));
  const n = Number(TRAEGER);
  const sortiert = [...kader].sort((x, y) => (y.d?.[disziplin] ?? 0) - (x.d?.[disziplin] ?? 0));
  return new Set(sortiert.slice(0, n).map((p) => p.n));
}

/** Kader mit Ausruestung: `punkteFn(spieler)` gibt die Deltas, `kappe` die Attributkappe. */
function ruesteAus(kader, disziplin, traeger, deltasFn, kappe) {
  return kader.map((p) => (traeger.has(p.n) ? mitAusruestung(p, disziplin, deltasFn(p), kappe) : p));
}

// ---- Auswertung ------------------------------------------------------------------------------------------------------

function rangKorrelation(xs, ys) {
  const rang = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1;
      const mittel = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) r[idx[k][1]] = mittel;
      i = j + 1;
    }
    return r;
  };
  const rx = rang(xs), ry = rang(ys);
  const n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (rx[i] - mx) * (ry[i] - my); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}
const median = (v) => { const s = [...v].filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

/** Siegpunkte der Seite `seite` (1, 0,5, 0) je Spiel plus Pruefwerte. */
function spielAuswerten(spiel, seite) {
  const summe = [0, 0];
  let unendlich = 0, negativ = 0, eigMax = -Infinity, wertMax = -Infinity;
  for (const t of spiel.teilnehmer) {
    const w = t.wert, e = t.eig;
    if (!Number.isFinite(w) || !Number.isFinite(e)) unendlich += 1;
    if (w < 0) negativ += 1;
    if (Number.isFinite(e)) eigMax = Math.max(eigMax, e);
    if (Number.isFinite(w)) wertMax = Math.max(wertMax, w);
    summe[t.seite === 1 ? 1 : 0] += Number.isFinite(w) ? w : 0;
  }
  const diff = summe[seite] - summe[1 - seite];
  const punkt = Math.abs(diff) < 1e-9 ? 0.5 : diff > 0 ? 1 : 0;
  return { punkt, diff, unendlich, negativ, eigMax, wertMax, rho: rangKorrelation(spiel.teilnehmer.map((t) => t.eig), spiel.teilnehmer.map((t) => t.wert)) };
}

/** Rand (Summe eigene Seite minus Summe Gegenseite) je Spiel, nach Paarung geordnet: Schluessel `<qi>:<spielindex>`. */
function randMap(varianten, label, seite) {
  const m = new Map();
  for (const v of varianten.filter((x) => x.label.startsWith(label))) {
    const qi = v.label.split("|")[2];
    v.spiele.forEach((sp, i) => m.set(`${qi}:${i}`, spielAuswerten(sp, seite).diff));
  }
  return m;
}
const normalVert = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

/**
 * BIAS-BEREINIGTE QUOTE: ein Spiegelkader hat eine feste Sitz-Verzerrung (Gleichstand geht an die Heimseite u. ae.).
 * Je Spiel wird der Rand MIT Ausruestung vom Rand der KONTROLLE auf demselben Sitz abgezogen (gepaarte Saat); das
 * Mittel dieser Differenzen geteilt durch die Streuung des Kontroll-Rands ergibt die Siegwahrscheinlichkeit
 * Phi(mittel / streuung). Naeherung (Normalverteilung), aber ohne die Sitz-Verzerrung der rohen Quote.
 */
function bereinigt(varianten, name) {
  const kHeim = randMap(varianten, "kontrolle|heim", 0);
  const aHeim = randMap(varianten, `${name}|heim`, 0);
  const aGast = randMap(varianten, `${name}|gast`, 1);
  const diffs = [];
  for (const [k, v] of aHeim) if (kHeim.has(k)) diffs.push(v - kHeim.get(k));
  // Kontrolle aus Sicht der Gastseite = Gegenstueck des Heim-Rands.
  for (const [k, v] of aGast) if (kHeim.has(k)) diffs.push(v - (-kHeim.get(k)));
  const n = diffs.length;
  if (!n) return { quote: NaN, mittel: NaN, streuung: NaN, n: 0 };
  const mittel = diffs.reduce((a, b) => a + b, 0) / n;
  const alleK = [...kHeim.values()];
  const mk = alleK.reduce((a, b) => a + b, 0) / alleK.length;
  const streuung = Math.sqrt(alleK.reduce((a, b) => a + (b - mk) ** 2, 0) / Math.max(1, alleK.length - 1)) || 1;
  return { quote: normalVert(mittel / streuung), mittel, streuung, n };
}

function bedingung(varianten, label, seite) {
  const spiele = varianten.filter((v) => v.label.startsWith(label)).flatMap((v) => v.spiele);
  const e = spiele.map((s) => spielAuswerten(s, seite));
  const n = e.length;
  const quote = e.reduce((a, x) => a + x.punkt, 0) / (n || 1);
  return {
    n, quote, diff: e.reduce((a, x) => a + x.diff, 0) / (n || 1),
    unendlich: e.reduce((a, x) => a + x.unendlich, 0), negativ: e.reduce((a, x) => a + x.negativ, 0),
    eigMax: Math.max(...e.map((x) => x.eigMax)), wertMax: Math.max(...e.map((x) => x.wertMax)),
    rho: median(e.map((x) => x.rho)),
  };
}

// ---- Lauf ------------------------------------------------------------------------------------------------------------

const familieAlle = JSON.parse(readFileSync(path.join(WURZEL, "data/generated/kaderfamilie-live-save.json"), "utf8")).varianten;
const quellen = familieAlle.slice(0, K_VARIANTEN);
const seite = await oeffneNodeSeite(path.join(WURZEL, "public/mockups"));
const alleDisz = NUR.length ? NUR : officialDisciplineWeightOrder;

function baueVarianten(disziplin, bedingungen) {
  const out = [];
  quellen.forEach((q, qi) => {
    const basis = q.heim;
    const spiegel = umbenennen(basis);
    const traeger = waehleTraeger(basis, disziplin);
    for (const b of bedingungen) {
      const deltas = b.deltas ? (p) => b.deltas(p, disziplin) : null;
      const eigen = deltas ? ruesteAus(basis, disziplin, traeger, deltas, b.kappe) : basis;
      const gegen = deltas ? ruesteAus(spiegel, disziplin, new Set([...traeger].map((n) => `${n} II`)), deltas, b.kappe) : spiegel;
      // Ausruestung auf der Heimseite (Seite 0) und, getauscht, auf der Gastseite (Seite 1).
      out.push({ label: `${b.name}|heim|${qi}`, heim: eigen, gast: spiegel });
      // Die Kontrolle hat keinen Aufschlag: der Seitentausch waere dieselbe Paarung noch einmal.
      if (deltas) out.push({ label: `${b.name}|gast|${qi}`, heim: basis, gast: gegen });
    }
  });
  return out;
}

async function probe(disziplin, bedingungen) {
  const varianten = baueVarianten(disziplin, bedingungen);
  const x = await seite.evaluate(([d, fam, n]) => window.__arena.disziplinProbe(d, { n, kaderFamilie: fam }), [disziplin, varianten, SPIELE]);
  if (x.fehler) return { fehler: x.fehler };
  return { chassis: x.chassis, varianten: x.varianten };
}

/** Zusammenfassung einer Bedingung ueber beide Seitentausche: Quote der ausgeruesteten Seite. */
function zusammen(varianten, name) {
  const h = bedingung(varianten, `${name}|heim`, 0);
  const g = bedingung(varianten, `${name}|gast`, 1);
  if (g.n === 0) return { ...h, heimQuote: h.quote, gastQuote: NaN };
  const n = h.n + g.n;
  return {
    n, quote: (h.quote * h.n + g.quote * g.n) / n,
    heimQuote: h.quote, gastQuote: g.quote,
    diff: (h.diff * h.n + g.diff * g.n) / n,
    unendlich: h.unendlich + g.unendlich, negativ: h.negativ + g.negativ,
    eigMax: Math.max(h.eigMax, g.eigMax), wertMax: Math.max(h.wertMax, g.wertMax),
    rho: median([h.rho, g.rho]),
  };
}

const prozent = (x) => `${(x * 100).toFixed(1)}%`.padStart(6);
const zeilen = [];
const t0 = Date.now();

if (!SONDE_A130) {
  console.log(`Spiegelkader-Messung · ${SPIELE} Spiele je Paarung, ${quellen.length} Paarung(en), je Bedingung ${SPIELE * quellen.length * 2} gepaarte Spiele`);
  console.log(`Stufe ${STUFE} (${PUNKTE} Attributpunkte je Traeger), Traeger ${TRAEGER}, Verteilung ${VERTEILUNG}, Kappe ${KAPPE}\n`);
  console.log("Disziplin        Chassis     Sitz-Verzerrung (Heim, Kontrolle)   roh   bereinigt   Aufschlag (bereinigt)   SE    eig-Hub  Wirkung");
  for (const d of alleDisz) {
    const bed = [
      { name: "kontrolle", deltas: null },
      { name: "ausruestung", deltas: (p, disz) => verteile(p, disz, PUNKTE, VERTEILUNG), kappe: KAPPEN[KAPPE] },
    ];
    const r = await probe(d, bed);
    if (r.fehler) { console.log(d.padEnd(16) + "— " + r.fehler); continue; }
    const k = zusammen(r.varianten, "kontrolle");
    // Rauschboden = Heimquote der Kontrolle (Seite 0 ohne Aufschlag), Abstand zu 50 % ist die Motor-Asymmetrie.
    const a = zusammen(r.varianten, "ausruestung");
    const heimKontrolle = bedingung(r.varianten, "kontrolle|heim", 0).quote;
    const se = Math.sqrt(0.25 / a.n);
    // mittlerer Eignungs-Hub der Traeger
    const q = quellen[0].heim;
    const tr = waehleTraeger(q, d);
    const hub = q.filter((p) => tr.has(p.n)).map((p) => mitAusruestung(p, d, verteile(p, d, PUNKTE, VERTEILUNG), KAPPEN[KAPPE])._eigDelta);
    const eigHub = hub.reduce((x, y) => x + y, 0) / (hub.length || 1);
    const ber = bereinigt(r.varianten, "ausruestung");
    const aufschlag = ber.quote - 0.5;
    const urteil = !Number.isFinite(aufschlag) ? "keine Auswertung" : Math.abs(aufschlag) < 2 * se ? "vom Rauschen nicht zu trennen" : aufschlag > 0 ? "wirkt" : "WIRKT FALSCH HERUM";
    console.log(`${d.padEnd(16)} ${(r.chassis || "").padEnd(11)} ${prozent(heimKontrolle)}                              ${prozent(a.quote)}   ${prozent(ber.quote)}      ${(aufschlag * 100).toFixed(1).padStart(6)}pp          ${(se * 100).toFixed(1)}   ${eigHub.toFixed(2).padStart(6)}   ${urteil}`);
    zeilen.push({ disziplin: d, chassis: r.chassis, kontrolleHeim: heimKontrolle, kontrolle: k.quote, ausruestungRoh: a.quote, ausruestungBereinigt: ber.quote, se, eigHub, urteil });
  }
} else {
  console.log(`SONDE a > 100 · ${SPIELE} Spiele je Paarung, ${quellen.length} Paarung(en), je Bedingung ${SPIELE * quellen.length * 2} gepaarte Spiele`);
  console.log("Aufschlag: +30 auf jedes Attribut mit Matrixgewicht, a bis 130 (A) bzw. bei 100 gekappt (B), d um die gewichtete Summe\n");
  console.log("Disziplin        Chassis     Quote A  Quote B  zA     zB      rho Basis  rho A   eig max (Basis/A)  nicht endlich  negativ (Basis/A)  Befund");
  for (const d of alleDisz) {
    const gew = officialDisciplineWeightMatrix[d] ?? {};
    const alle30 = (p) => {
      const o = {};
      for (const attr of Object.keys(gew)) o[attr] = Math.min(30, Math.max(0, 130 - (p.a?.[attr] ?? 0)));
      return o;
    };
    const bed = [
      { name: "kontrolle", deltas: null },
      { name: "A", deltas: alle30, kappe: 130 },
      { name: "B", deltas: alle30, kappe: 100 },
    ];
    const r = await probe(d, bed);
    if (r.fehler) { console.log(d.padEnd(16) + "— " + r.fehler); continue; }
    const basis = zusammen(r.varianten, "kontrolle");
    const A = zusammen(r.varianten, "A");
    const B = zusammen(r.varianten, "B");
    const se = Math.sqrt(0.25 / A.n);
    // Effektgroessen (bias-bereinigter Rand in Streuungen der Kontrolle): die rohen Quoten saettigen bei 100 %, die Raender nicht.
    const bA = bereinigt(r.varianten, "A"), bB = bereinigt(r.varianten, "B");
    // `bereinigt` zieht die Kontrolle "kontrolle|heim" ab;
    const zA = bA.mittel / bA.streuung, zB = bB.mittel / bB.streuung;
    const probleme = [];
    if (A.unendlich + B.unendlich > 0) probleme.push("NICHT ENDLICH");
    // Bahn-Disziplinen werten in Zeiten (Werte von Natur aus negativ): ein Vorzeichenbruch ist nur ein Befund, wenn die Basis keinen hat.
    if (basis.negativ === 0 && A.negativ + B.negativ > 0) probleme.push("VORZEICHENBRUCH");
    if (!(zA > 0)) probleme.push("Aufschlag wirkt nicht (Rand A <= 0)");
    if (A.rho < basis.rho - 0.1) probleme.push(`rho bricht ein (${basis.rho.toFixed(2)} -> ${A.rho.toFixed(2)})`);
    const ueber = zA - zB;
    const befund = probleme.length ? probleme.join("; ") : Math.abs(ueber) < 0.25 ? "sauber, Teil ueber 100 wirkt nicht zusaetzlich" : ueber > 0 ? "sauber, Teil ueber 100 wirkt zusaetzlich" : "sauber, Teil ueber 100 wirkt GEGEN den Traeger";
    console.log(`${d.padEnd(16)} ${(r.chassis || "").padEnd(11)} ${prozent(A.quote)}  ${prozent(B.quote)}  ${zA.toFixed(2).padStart(6)} ${zB.toFixed(2).padStart(6)}  ${basis.rho.toFixed(2).padStart(6)}   ${A.rho.toFixed(2).padStart(5)}   ${basis.eigMax.toFixed(0).padStart(4)} / ${A.eigMax.toFixed(0).padEnd(4)}       ${String(A.unendlich + B.unendlich).padStart(4)}          ${String(basis.negativ).padStart(4)} / ${String(A.negativ).padEnd(4)}   ${befund}`);
    zeilen.push({ disziplin: d, chassis: r.chassis, quoteA: A.quote, quoteB: B.quote, zA, zB, rhoBasis: basis.rho, rhoA: A.rho, eigMaxBasis: basis.eigMax, eigMaxA: A.eigMax, unendlich: A.unendlich + B.unendlich, negativBasis: basis.negativ, negativA: A.negativ, se, befund });
  }
}

seite.schliessen();
console.log(`\nLaufzeit ${((Date.now() - t0) / 1000).toFixed(0)} s. SE = Standardfehler der Siegquote bei ${SPIELE * quellen.length * 2} Spielen (konservativ, p = 50 %).`);
if (JSON_PFAD) writeFileSync(path.resolve(WURZEL, JSON_PFAD), JSON.stringify({ stufe: STUFE, punkte: PUNKTE, traeger: TRAEGER, verteilung: VERTEILUNG, kappe: KAPPE, spiele: SPIELE, varianten: quellen.length, sonde: SONDE_A130 ? "a130" : "stufe", zeilen }, null, 2));
