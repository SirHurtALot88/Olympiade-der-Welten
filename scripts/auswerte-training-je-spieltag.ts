/**
 * Auswertung des Messlaufs „Training je Spieltag" (vorher/nachher, scripts/miss-training-je-spieltag.ts).
 *
 *   npx tsx scripts/auswerte-training-je-spieltag.ts vorher.json nachher.json [--json out.json]
 *
 * Druckt Markdown-Tabellen: Zuwachs je Saison (Schwerpunkt, Summe; Median, P90, Rohdiamant), Ziel-Disziplinen
 * der KI, Formabzuege durch Ueberlastung, Marktwert-Drift, Kaderstaerke-Verlauf, Verletzungen, Laufzeit.
 */
import fs from "node:fs";

type SpielerSnap = { id: string; team: string; rating: number | null; potenzial: number | null; attr: number[]; mw: number; fatigue: number };
type Lauf = {
  saveId: string;
  schalter: { jeSpieltag: boolean; faktor: number };
  spieltageGesamt: number;
  gespielt?: number;
  start: { spieler: SpielerSnap[]; staerke: Record<string, number> };
  staerkeJeSpieltag: Array<Record<string, number>>;
  msJeSpieltag: number[];
  nachSpieltagen?: {
    spieler: SpielerSnap[];
    verlauf: Record<
      string,
      {
        verlauf: Array<{ m: string; s: "t" | "v"; d?: string; w?: number; q?: string; i?: string; z?: Record<string, number>; l?: number }>;
        modi: Record<string, string>;
        ueberlastung: Array<{ m: string; u: number }>;
        form: number | null;
      }
    >;
  };
  nachSaisonende?: {
    spieler: SpielerSnap[];
    events: Record<string, Array<{ a: string; t: number; s: number; p: number; r: number; von: number; nach: number }>>;
    staerke: Record<string, number>;
  };
  verletzungen?: number;
  laufzeitSekunden?: number;
};

const [vorherPfad, nachherPfad] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!vorherPfad || !nachherPfad) throw new Error("Aufruf: auswerte-training-je-spieltag.ts vorher.json nachher.json");
const vorher = JSON.parse(fs.readFileSync(vorherPfad, "utf8")) as Lauf;
const nachher = JSON.parse(fs.readFileSync(nachherPfad, "utf8")) as Lauf;

const f = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "–" : v.toFixed(d).replace(".", ","));
function quantil(werte: number[], q: number): number {
  if (werte.length === 0) return NaN;
  const s = [...werte].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const u = Math.floor(pos);
  return s[u]! + (s[Math.min(s.length - 1, u + 1)]! - s[u]!) * (pos - u);
}
const mittel = (w: number[]) => (w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN);

/** Rohdiamanten: die 10 % mit der groessten Potenzial-Luecke (Potenzial - Rating), Basis = Start. */
function rohdiamanten(lauf: Lauf): Set<string> {
  const mitLuecke = lauf.start.spieler
    .filter((s) => s.potenzial != null && s.rating != null)
    .map((s) => ({ id: s.id, luecke: (s.potenzial ?? 0) - (s.rating ?? 0) }))
    .sort((a, b) => b.luecke - a.luecke);
  return new Set(mitLuecke.slice(0, Math.max(5, Math.round(mitLuecke.length * 0.1))).map((e) => e.id));
}

/** Trainingszuwachs je Spieler und Attribut: je Spieltag gebucht (Verlauf) + am Saisonende gebucht (Event t+s). */
function trainingJeSpieler(lauf: Lauf): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  const add = (id: string, a: string, w: number) => {
    const r = out.get(id) ?? {};
    r[a] = (r[a] ?? 0) + w;
    out.set(id, r);
  };
  for (const [id, v] of Object.entries(lauf.nachSpieltagen?.verlauf ?? {})) {
    for (const e of v.verlauf) for (const [a, w] of Object.entries(e.z ?? {})) add(id, a, w);
    if (!out.has(id)) out.set(id, {});
  }
  for (const [id, ups] of Object.entries(lauf.nachSaisonende?.events ?? {})) for (const u of ups) add(id, u.a, u.t + u.s);
  return out;
}

function nettoJeSpieler(lauf: Lauf): Map<string, number[]> {
  const ende = new Map((lauf.nachSaisonende?.spieler ?? lauf.nachSpieltagen?.spieler ?? []).map((s) => [s.id, s] as const));
  const out = new Map<string, number[]>();
  for (const s of lauf.start.spieler) {
    const e = ende.get(s.id);
    if (!e) continue;
    out.set(s.id, s.attr.map((v, i) => (Number.isFinite(v) && Number.isFinite(e.attr[i]!) ? e.attr[i]! - v : 0)));
  }
  return out;
}

function zuwachsTabelle() {
  const zeilen: string[] = [];
  zeilen.push("| Größe | vorher (Saisonende, Klasse) | nachher (je Spieltag, Regel A) |");
  zeilen.push("|---|---:|---:|");
  const kennzahlen = (lauf: Lauf) => {
    const roh = rohdiamanten(lauf);
    const t = trainingJeSpieler(lauf);
    const schwer: number[] = [];
    const summe: number[] = [];
    const schwerRoh: number[] = [];
    for (const s of lauf.start.spieler) {
      const r = t.get(s.id);
      if (!r) continue;
      const werte = Object.values(r);
      const max = werte.length ? Math.max(...werte) : 0;
      schwer.push(max);
      summe.push(werte.reduce((a, b) => a + b, 0));
      if (roh.has(s.id)) schwerRoh.push(max);
    }
    const netto = nettoJeSpieler(lauf);
    const nettoSchwer: number[] = [];
    const nettoSumme: number[] = [];
    for (const d of netto.values()) {
      nettoSchwer.push(Math.max(...d));
      nettoSumme.push(d.reduce((a, b) => a + b, 0));
    }
    return { schwer, summe, schwerRoh, nettoSchwer, nettoSumme, n: schwer.length, nRoh: schwerRoh.length };
  };
  const a = kennzahlen(vorher);
  const b = kennzahlen(nachher);
  const z = (label: string, x: string, y: string) => zeilen.push(`| ${label} | ${x} | ${y} |`);
  z("Spieler (Kader)", String(a.n), String(b.n));
  z("Training im Schwerpunkt-Attribut, Median", f(quantil(a.schwer, 0.5)), f(quantil(b.schwer, 0.5)));
  z("Training im Schwerpunkt-Attribut, P90", f(quantil(a.schwer, 0.9)), f(quantil(b.schwer, 0.9)));
  z("Training im Schwerpunkt-Attribut, Maximum", f(Math.max(...a.schwer)), f(Math.max(...b.schwer)));
  z(`Rohdiamanten (Top 10 % Potenzial-Lücke, n=${b.nRoh}), Median`, f(quantil(a.schwerRoh, 0.5)), f(quantil(b.schwerRoh, 0.5)));
  z("Rohdiamanten, Maximum", f(Math.max(...a.schwerRoh)), f(Math.max(...b.schwerRoh)));
  z("Training Summe aller Attribute, Median", f(quantil(a.summe, 0.5)), f(quantil(b.summe, 0.5)));
  z("Training Summe aller Attribute, P90", f(quantil(a.summe, 0.9)), f(quantil(b.summe, 0.9)));
  z("Netto (Training + Leistung + Abbau) Schwerpunkt, Median", f(quantil(a.nettoSchwer, 0.5)), f(quantil(b.nettoSchwer, 0.5)));
  z("Netto Summe aller Attribute, Median", f(quantil(a.nettoSumme, 0.5)), f(quantil(b.nettoSumme, 0.5)));
  z("Netto Summe aller Attribute, Liga-Mittel", f(mittel(a.nettoSumme)), f(mittel(b.nettoSumme)));
  return zeilen.join("\n");
}

function zieleTabelle(lauf: Lauf) {
  const zaehl = new Map<string, number>();
  const wege = [0, 0, 0];
  let wechsel = 0;
  let spieler = 0;
  let manager = 0;
  for (const v of Object.values(lauf.nachSpieltagen?.verlauf ?? {})) {
    const trainiert = v.verlauf.filter((e) => e.s === "t" && e.d);
    if (trainiert.length === 0) continue;
    spieler += 1;
    const letzter = trainiert[trainiert.length - 1]!;
    zaehl.set(letzter.d!, (zaehl.get(letzter.d!) ?? 0) + 1);
    wege[letzter.w ?? 0]! += 1;
    if (letzter.q === "m") manager += 1;
    for (let i = 1; i < trainiert.length; i += 1) if (trainiert[i]!.d !== trainiert[i - 1]!.d) wechsel += 1;
  }
  const zeilen = ["| Ziel-Disziplin (letzter Spieltag) | Spieler | Anteil |", "|---|---:|---:|"];
  for (const [d, n] of [...zaehl.entries()].sort((a, b) => b[1] - a[1])) zeilen.push(`| ${d} | ${n} | ${f((100 * n) / Math.max(1, spieler), 1)} % |`);
  zeilen.push("");
  zeilen.push(`Spieler mit Ziel: ${spieler}, davon vom Manager gesetzt: ${manager}. Weg: Primärweg ${wege[0]}, Nebenweg ${wege[1]! + wege[2]!} (Platz 2: ${wege[1]}, Platz 3: ${wege[2]}). Zielwechsel über die Saison: ${wechsel} (${f(wechsel / Math.max(1, spieler), 2)} je Spieler).`);
  return zeilen.join("\n");
}

function ueberlastungTabelle(lauf: Lauf) {
  let eintraege = 0;
  let punkte = 0;
  const betroffen = new Set<string>();
  const hist = new Map<number, number>();
  let trainiertTage = 0;
  let verletztTage = 0;
  const modi = new Map<string, number>();
  for (const [id, v] of Object.entries(lauf.nachSpieltagen?.verlauf ?? {})) {
    for (const u of v.ueberlastung) {
      eintraege += 1;
      punkte += u.u;
      betroffen.add(id);
      hist.set(u.u, (hist.get(u.u) ?? 0) + 1);
    }
    trainiertTage += v.verlauf.filter((e) => e.s === "t").length;
    verletztTage += v.verlauf.filter((e) => e.s === "v").length;
    for (const m of Object.values(v.modi)) modi.set(m, (modi.get(m) ?? 0) + 1);
  }
  const verteilung = [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([p, n]) => `−${p}: ${n}`).join(", ");
  const modusText = [...modi.entries()].map(([m, n]) => `${m} ${n}`).join(", ");
  return [
    "| Größe | Wert |",
    "|---|---:|",
    `| Spieler-Spieltage trainiert | ${trainiertTage} |`,
    `| Spieler-Spieltage verletzt (kein Training) | ${verletztTage} |`,
    `| Formabzüge durch Überlastung (Einträge) | ${eintraege} (${f((100 * eintraege) / Math.max(1, trainiertTage), 1)} % der Trainingstage) |`,
    `| Summe Formpunkte | ${f(punkte, 0)} |`,
    `| betroffene Spieler | ${betroffen.size} |`,
    `| Verteilung | ${verteilung || "–"} |`,
    `| Intensität (Spieler-Spieltage) | ${modusText || "–"} |`,
  ].join("\n");
}

function marktwertTabelle() {
  const drift = (lauf: Lauf) => {
    const ende = new Map((lauf.nachSaisonende?.spieler ?? []).map((s) => [s.id, s] as const));
    const proz: number[] = [];
    let summeStart = 0;
    let summeEnde = 0;
    for (const s of lauf.start.spieler) {
      const e = ende.get(s.id);
      if (!e) continue;
      summeStart += s.mw;
      summeEnde += e.mw;
      if (s.mw > 0) proz.push((100 * (e.mw - s.mw)) / s.mw);
    }
    return { summeStart, summeEnde, median: quantil(proz, 0.5), p10: quantil(proz, 0.1), p90: quantil(proz, 0.9) };
  };
  const a = drift(vorher);
  const b = drift(nachher);
  return [
    "| Marktwert (Kaderspieler, Saisonstart → nach Saisonend-Progression) | vorher | nachher |",
    "|---|---:|---:|",
    `| Σ Marktwert Start | ${f(a.summeStart, 0)} | ${f(b.summeStart, 0)} |`,
    `| Σ Marktwert Ende | ${f(a.summeEnde, 0)} | ${f(b.summeEnde, 0)} |`,
    `| Veränderung je Spieler, Median | ${f(a.median, 1)} % | ${f(b.median, 1)} % |`,
    `| P10 / P90 | ${f(a.p10, 1)} / ${f(a.p90, 1)} % | ${f(b.p10, 1)} / ${f(b.p90, 1)} % |`,
  ].join("\n");
}

function staerkeTabelle() {
  const reihe = (lauf: Lauf) => {
    const punkte: Array<[string, Record<string, number>]> = [["Start", lauf.start.staerke]];
    lauf.staerkeJeSpieltag.forEach((s, i) => {
      if (s && ((i + 1) % 5 === 0 || i === 0)) punkte.push([`nach Spieltag ${i + 1}`, s]);
    });
    if (lauf.nachSaisonende) punkte.push(["nach Saisonende", lauf.nachSaisonende.staerke]);
    return punkte.map(([l, s]) => {
      const w = Object.values(s);
      return { l, m: mittel(w), min: Math.min(...w), max: Math.max(...w) };
    });
  };
  const a = reihe(vorher);
  const b = reihe(nachher);
  const zeilen = ["| Zeitpunkt | vorher Ø (min–max) | nachher Ø (min–max) |", "|---|---:|---:|"];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i];
    const y = b[i];
    zeilen.push(`| ${x?.l ?? y?.l} | ${x ? `${f(x.m)} (${f(x.min, 1)}–${f(x.max, 1)})` : "–"} | ${y ? `${f(y.m)} (${f(y.min, 1)}–${f(y.max, 1)})` : "–"} |`);
  }
  return zeilen.join("\n");
}

console.log(`Basis ${nachher.saveId}, Spieltage ${vorher.gespielt}/${vorher.spieltageGesamt} vorher, ${nachher.gespielt}/${nachher.spieltageGesamt} nachher; Schalter vorher ${JSON.stringify(vorher.schalter)}, nachher ${JSON.stringify(nachher.schalter)}.`);
console.log(`Verletzungen vorher ${vorher.verletzungen}, nachher ${nachher.verletzungen}. Laufzeit je Spieltag (Median) vorher ${f(quantil(vorher.msJeSpieltag.filter(Number.isFinite), 0.5) / 1000, 0)} s, nachher ${f(quantil(nachher.msJeSpieltag.filter(Number.isFinite), 0.5) / 1000, 0)} s.\n`);
console.log("### Zuwachs je Saison\n");
console.log(zuwachsTabelle());
console.log("\n### Ziel-Disziplinen der KI (nachher)\n");
console.log(zieleTabelle(nachher));
console.log("\n### Überlastung und Verletzte (nachher)\n");
console.log(ueberlastungTabelle(nachher));
console.log("\n### Marktwert-Drift\n");
console.log(marktwertTabelle());
console.log("\n### Kaderstärke (Ø Top-6-Eignung je Disziplin, 32 Teams)\n");
console.log(staerkeTabelle());
