// ===================================================================================
// ERGEBNISSKALA E1: KALIBRIERUNG UND MESSUNG (18.11., docs/design/ergebnisskala-18-11.md).
//
// Liest JSON-Abzuege von scripts/miss-pp-skala.ts (mit `teamZeilen`, Modus `roh`: ungedeckelte alte
// Spieler-PP) und
//   --schreibe-kalibrierung  zieht die E1-Anker je (Disziplin, Format, Feldgroesse) und schreibt
//                            data/generated/ergebnis-skala-kalibrierung.json
//   (ohne Schalter)          misst vorher (gebuchte Werte der Skala vom 19.10.) gegen nachher (E1 mit den
//                            committeten Ankern, gerechnet mit lib/resolve/ergebnis-skala.ts selbst).
//
//   npx tsx scripts/werte-ergebnisskala-aus.ts --schreibe-kalibrierung <abzug.json> [...]
//   npx tsx scripts/werte-ergebnisskala-aus.ts <abzug.json> [...]
//
// Die Spieler-Leistung L einer Seite ist das Mittel der C2-PP ihrer Spieler: aus den roh-PP mit
// `skaliereUngedeckelt()` (lib/resolve/pp-skala.ts, committete Anker je Feldgroesse) gerechnet. Laeufe,
// die NICHT im Modus roh gefahren sind, werden so genommen, wie sie gebucht wurden (Modus an: schon C2).
// ===================================================================================
import { readFileSync, writeFileSync } from "node:fs";

import { berechneDuellErgebnisE1, berechnePodErgebnisE1, ERGEBNIS_LAGEN, margeFuerAnker } from "@/lib/resolve/ergebnis-skala";
import { skaliereUngedeckelt } from "@/lib/resolve/pp-skala";
import { berechneDuellVerhaeltnis, resolveNiveauReferenz } from "@/lib/resolve/battle-mode-pps-duell";
import {
  berechneErgebnisNormiertNTeam,
  MINI_DM_POD_TEAM_PUNKTE,
  resolveBattlefieldPodMargeReferenz,
  resolveMiniDmFfaMargeReferenz,
} from "@/lib/resolve/mini-dm-pod-resolve";
import { resolveBahnPodMargeReferenz } from "@/lib/resolve/bahn-pod-resolve";

// VORHER = die Skala vom 19.10., aus denselben gebuchten Zeilen NACHGERECHNET (Laeufe ab dem 18.11.
// buchen schon E1): Duell exakt wie `berechneDuellVerhaeltnis()` in der Engine; Pod ueber die Leiter
// `berechneErgebnisNormiertNTeam()` mit der Pod-Referenz des Formats und Niveau aus dem PPS-Score, Summe 0
// wie `berechneMiniDmPodOverride()` (Rohscores aus den gebuchten Luecken).
function altDuell(z: TeamZeile, feld: number | null, outcome: "win" | "draw" | "loss"): number {
  if (!z.seiten) return z.verhaeltnis ?? 0;
  return berechneDuellVerhaeltnis({
    quelle: z.aufloesung === "arena" ? "arena" : "pps",
    disciplineId: z.d,
    playerCount: feld,
    seiten: z.seiten,
    outcome,
  }).verhaeltnis;
}
function altPod(teams: TeamZeile[], feld: number | null): number[] {
  const d = teams[0]!.d;
  const quelle = teams[0]!.pod?.quelle;
  const m90 =
    quelle === "bahn"
      ? resolveBahnPodMargeReferenz(d, feld)?.m90
      : d === "mini-dm" && quelle === "ffa"
      ? resolveMiniDmFfaMargeReferenz(feld)?.m90
      : d === "battlefield" && quelle === "ffa"
      ? resolveBattlefieldPodMargeReferenz(feld)?.m90
      : null;
  let score = 0;
  const scores = teams.map((z, i) => (i === 0 ? 0 : (score -= Math.max(0, z.marge ?? 0))));
  const sortiert = teams.map((z, i) => ({
    teamId: z.team,
    score: scores[i]!,
    niveauScore: z.ppsScore,
    mindestLuecke: i < teams.length - 1 && MINI_DM_POD_TEAM_PUNKTE[i] !== MINI_DM_POD_TEAM_PUNKTE[i + 1] ? 1 : 0,
  }));
  const werte = berechneErgebnisNormiertNTeam({ sortiert, m90: m90 ?? null, niveauReferenz: resolveNiveauReferenz("pps", d, feld) });
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
  const drei = werte.slice(0, 3).map((w) => Math.round(w - mittel));
  return [...drei, -drei.reduce((a, b) => a + b, 0)];
}

type TeamZeile = {
  md: string;
  d: string;
  seite: string;
  team: string;
  liga: string;
  gegner: string | null;
  aufloesung: string;
  teamPunkte: number | null;
  ppsScore: number;
  seiten: [number, number] | null;
  marge: number | null;
  verhaeltnis: number | null;
  m90: number | null;
  ergebnis: [number, number] | null;
  /** "e1", wenn die Zeile schon nach E1 gebucht wurde (Lauf mit Skala an). */
  skala?: string | null;
  pod: { id: string; platz: number; wert: number; quelle: string; teamWert: number | null; runden: number | null; teams: string[] } | null;
  feld: number | null;
  pp: number[];
};

const args = process.argv.slice(2);
const schreibe = args.includes("--schreibe-kalibrierung");
const dateien = args.filter((a) => !a.startsWith("--"));
if (dateien.length === 0) {
  console.error("Aufruf: npx tsx scripts/werte-ergebnisskala-aus.ts [--schreibe-kalibrierung] <abzug.json> [...]");
  process.exit(1);
}

const q = (sortiert: number[], p: number) => {
  if (sortiert.length === 0) return NaN;
  const i = (sortiert.length - 1) * p;
  const u = Math.floor(i);
  const o = Math.ceil(i);
  return u === o ? sortiert[u]! : sortiert[u]! * (1 - (i - u)) + sortiert[o]! * (i - u);
};
const sort = (a: number[]) => [...a].sort((x, y) => x - y);
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1).replace(".", ",") : "–");
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2).replace(".", ",") : "–");
const pz = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)} %` : "–");
const runde = (x: number, n = 3) => Number(x.toFixed(n));

type Lauf = { datei: string; saveId: string; roh: boolean; zeilen: TeamZeile[] };
const laeufe: Lauf[] = dateien.map((datei) => {
  const j = JSON.parse(readFileSync(datei, "utf8"));
  if (!Array.isArray(j.teamZeilen)) throw new Error(`${datei}: keine teamZeilen (alte Sonde?)`);
  return { datei, saveId: j.saveId, roh: j.ppSkala === "roh", zeilen: j.teamZeilen };
});

// Feldgroesse je (Lauf, Spieltag, Disziplin): haeufigste Spielerzahl je Team-Seite.
function feldJeZelle(lauf: Lauf): Map<string, number | null> {
  const zaehler = new Map<string, Map<number, number>>();
  for (const z of lauf.zeilen) {
    if (z.feld == null) continue;
    const k = `${z.md}|${z.d}`;
    const m = zaehler.get(k) ?? new Map<number, number>();
    m.set(z.feld, (m.get(z.feld) ?? 0) + 1);
    zaehler.set(k, m);
  }
  return new Map([...zaehler].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null] as const));
}

type Duell = { lauf: number; md: string; d: string; feld: number | null; liga: string; heim: TeamZeile; gast: TeamZeile; lHeim: number; lGast: number };
type Pod = { lauf: number; md: string; d: string; feld: number | null; liga: string; teams: TeamZeile[]; leistung: number[] };

const duelle: Duell[] = [];
const pods: Pod[] = [];
laeufe.forEach((lauf, nr) => {
  const feld = feldJeZelle(lauf);
  const leistung = (z: TeamZeile, n: number | null) => {
    if (z.pp.length === 0) return 0;
    const pp = lauf.roh ? z.pp.map((x) => skaliereUngedeckelt(z.d, x, 0, { modus: "an", playerCount: n })) : z.pp;
    return pp.reduce((a, b) => a + b, 0) / pp.length;
  };
  const gesehen = new Set<string>();
  const podGruppen = new Map<string, TeamZeile[]>();
  for (const z of lauf.zeilen) {
    const n = feld.get(`${z.md}|${z.d}`) ?? null;
    if (z.pod) {
      const k = `${z.md}|${z.d}|${z.seite}|${z.pod.id}`;
      podGruppen.set(k, [...(podGruppen.get(k) ?? []), z]);
      continue;
    }
    if (typeof z.verhaeltnis !== "number" || !z.gegner) continue;
    const k = [z.md, z.d, z.seite, ...[z.team, z.gegner].sort()].join("|");
    if (gesehen.has(k)) continue;
    const gast = lauf.zeilen.find((x) => x.md === z.md && x.d === z.d && x.seite === z.seite && x.team === z.gegner);
    if (!gast) continue;
    gesehen.add(k);
    duelle.push({ lauf: nr, md: z.md, d: z.d, feld: n, liga: z.liga, heim: z, gast, lHeim: leistung(z, n), lGast: leistung(gast, n) });
  }
  for (const gruppe of podGruppen.values()) {
    const sortiert = [...gruppe].sort((a, b) => a.pod!.platz - b.pod!.platz);
    const n = feld.get(`${sortiert[0]!.md}|${sortiert[0]!.d}`) ?? null;
    pods.push({ lauf: nr, md: sortiert[0]!.md, d: sortiert[0]!.d, feld: n, liga: sortiert[0]!.liga, teams: sortiert, leistung: sortiert.map((z) => leistung(z, n)) });
  }
});

const disziplinen = [...new Set([...duelle.map((x) => x.d), ...pods.map((x) => x.d)])].sort();
console.log(`Quellen: ${laeufe.map((l) => `${l.datei} (${l.saveId}, ${l.roh ? "roh" : "gebucht"})`).join("; ")}`);
console.log(`${duelle.length} Duelle, ${pods.length} Vierergruppen, ${disziplinen.length} Disziplinen\n`);

// ---------------------------------------------------------------- Kalibrierung
const MIN_JE_FELD = 12; // Siege je (Disziplin, Feldgroesse), ab denen eigene Anker gezogen werden (ein Save liefert ~15)
const MIN_PODS_JE_FELD = 6;

function ankerAus(margen: number[], leistungen: number[], margeQuelle?: "marge" | "relativ" | "leistung") {
  const m = sort(margen);
  const l = sort(leistungen);
  if (m.length === 0 || l.length < 3) return null;
  return {
    ...(margeQuelle ? { margeQuelle } : {}),
    knoten: ERGEBNIS_LAGEN.map((u) => runde(q(m, u))),
    lP5: runde(q(l, 0.05)),
    lP50: runde(q(l, 0.5)),
    lP95: runde(q(l, 0.95)),
    n: m.length,
  };
}

// Liefert der Motor im Duell eine brauchbare Marge? Weniger als drei verschiedene Siegmargen (Zeitfahren
// 1:0, Platzpunkte) -> Leistungsabstand der Seiten statt Marge.
const MIN_STUFEN = 3;
const RELATIV_AB = 0.5;

if (schreibe) {
  const kalib: Record<string, Record<string, unknown>> = {};
  for (const d of disziplinen) {
    const eintrag: Record<string, unknown> = {};
    const dd = duelle.filter((x) => x.d === d);
    if (dd.length > 0) {
      const siege = dd.filter((x) => x.heim.verhaeltnis !== 0);
      const stufen = new Set(siege.map((x) => Math.abs(x.heim.marge ?? 0))).size;
      // Summen-Disziplinen mit stark wechselnder Groessenordnung (Variationskoeffizient der Seitensumme
      // ueber die Duelle > RELATIV_AB) -> relativer Abstand; sonst nativ; ohne Stufen -> Leistung.
      const summen = dd.map((x) => (x.heim.seiten ? Math.abs(x.heim.seiten[0]) + Math.abs(x.heim.seiten[1]) : NaN)).filter(Number.isFinite);
      const mittelSumme = summen.reduce((a, b) => a + b, 0) / Math.max(1, summen.length);
      const vk = summen.length > 1 && mittelSumme > 0 ? Math.sqrt(summen.reduce((a, b) => a + (b - mittelSumme) ** 2, 0) / summen.length) / mittelSumme : 0;
      const quelle = stufen < MIN_STUFEN ? "leistung" : vk > RELATIV_AB && summen.length === dd.length ? "relativ" : "marge";
      const siegMarge = (x: Duell) =>
        margeFuerAnker(
          { margeQuelle: quelle },
          { outcome: x.heim.verhaeltnis! > 0 ? "win" : "loss", marge: Math.abs(x.heim.marge ?? 0), seiten: x.heim.seiten, leistungEigen: x.lHeim, leistungGegner: x.lGast },
        );
      const gesamt = ankerAus(siege.map(siegMarge), dd.flatMap((x) => [x.lHeim, x.lGast]), quelle);
      const feldgroessen: Record<string, unknown> = {};
      for (const n of [...new Set(dd.map((x) => x.feld).filter((x): x is number => x != null))].sort((a, b) => a - b)) {
        const dn = dd.filter((x) => x.feld === n);
        const sn = dn.filter((x) => x.heim.verhaeltnis !== 0);
        if (sn.length < MIN_JE_FELD) continue;
        const a = ankerAus(sn.map(siegMarge), dn.flatMap((x) => [x.lHeim, x.lGast]));
        if (a) feldgroessen[String(n)] = a;
      }
      if (gesamt) eintrag.duell = { ...gesamt, ...(Object.keys(feldgroessen).length ? { feldgroessen } : {}) };
    }
    const pd = pods.filter((x) => x.d === d);
    if (pd.length > 0) {
      const spanne = (x: Pod) => x.teams.slice(1).reduce((s, z) => s + Math.max(0, z.marge ?? 0), 0);
      const gesamt = ankerAus(pd.map(spanne), pd.flatMap((x) => x.leistung));
      const feldgroessen: Record<string, unknown> = {};
      for (const n of [...new Set(pd.map((x) => x.feld).filter((x): x is number => x != null))].sort((a, b) => a - b)) {
        const pn = pd.filter((x) => x.feld === n);
        if (pn.length < MIN_PODS_JE_FELD) continue;
        const a = ankerAus(pn.map(spanne), pn.flatMap((x) => x.leistung));
        if (a) feldgroessen[String(n)] = a;
      }
      if (gesamt) eintrag.pod = { ...gesamt, ...(Object.keys(feldgroessen).length ? { feldgroessen } : {}) };
    }
    kalib[d] = eintrag;
  }
  const ziel = new URL("../data/generated/ergebnis-skala-kalibrierung.json", import.meta.url);
  writeFileSync(
    ziel,
    JSON.stringify(
      {
        hinweis:
          "Ergebnisskala E1 (docs/design/ergebnisskala-18-11.md, lib/resolve/ergebnis-skala.ts): je Disziplin und Format (duell | pod) knoten = Siegmarge (Duell) bzw. Spanne Platz 1 bis 4 (Pod) im nativen Motorwert an den Lagen 0,025/0,05/0,1/0,2/.../0,9/0,95/0,975 der gemessenen Verteilung (Median -> Abstand 3 bzw. Spanne 5, ab 0,975 -> 10); margeQuelle relativ = |a-b|/(a+b) fuer Seitensummen mit stark wechselnder Groessenordnung (Variationskoeffizient > 0,5); margeQuelle leistung = der Motor liefert im Duell weniger als 3 verschiedene Siegmargen, dann Leistungsabstand der Seiten (mittlere C2-PP Sieger minus Verlierer); lP5/lP50/lP95 = Perzentile der mittleren Spieler-PP (Skala C2) einer Seite -> Niveau 0,05/0,5/0,95. feldgroessen: dieselben Anker je Feldgroesse (ab 12 Siegen bzw. 6 Pods), sonst Disziplin-weit. Geschrieben von scripts/werte-ergebnisskala-aus.ts --schreibe-kalibrierung.",
        gemessenAm: new Date().toISOString().slice(0, 10),
        quellen: laeufe.map((l) => ({ saveId: l.saveId, modus: l.roh ? "roh" : "gebucht" })),
        disziplinen: kalib,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Kalibrierung geschrieben: ${ziel.pathname}`);
  process.exit(0);
}

// ---------------------------------------------------------------- Messung vorher / nachher
type Buchung = { lauf: number; liga: string; team: string; d: string; vorher: number; nachher: number };
const buchungen: Buchung[] = [];
const verletzt: string[] = [];
// GEZEIGT = GEBUCHT: Zeilen, die schon nach E1 gebucht wurden, muessen exakt dem entsprechen, was die
// Funktion aus denselben gebuchten Eingaben rechnet.
let gebuchtGeprueft = 0;
const gebuchtAbweichung: string[] = [];
type Verteilung = { dVorher: number[]; dNachher: number[]; ergebnisse: string[]; zehnNull: number; remis: number; podWerte: number[]; n: number };
const jeD = new Map<string, Verteilung>();
const vt = (d: string) => {
  if (!jeD.has(d)) jeD.set(d, { dVorher: [], dNachher: [], ergebnisse: [], zehnNull: 0, remis: 0, podWerte: [], n: 0 });
  return jeD.get(d)!;
};

for (const x of duelle) {
  const outcome = x.heim.verhaeltnis! > 0 ? "win" : x.heim.verhaeltnis! < 0 ? "loss" : "draw";
  const e = berechneDuellErgebnisE1({
    disciplineId: x.d,
    playerCount: x.feld,
    outcome,
    marge: x.heim.marge ?? 0,
    seiten: x.heim.seiten,
    leistungEigen: x.lHeim,
    leistungGegner: x.lGast,
  });
  const [w, v] = e.ergebnis;
  if (x.heim.skala === "e1") {
    gebuchtGeprueft += 1;
    if (x.heim.verhaeltnis !== e.verhaeltnis || String(x.heim.ergebnis) !== String(e.ergebnis)) {
      gebuchtAbweichung.push(`${x.d} ${x.md} ${x.heim.team}: gebucht ${x.heim.ergebnis} (${x.heim.verhaeltnis}), gerechnet ${e.ergebnis} (${e.verhaeltnis})`);
    }
  }
  if (outcome === "win" && !(w > v)) verletzt.push(`${x.d} ${x.md} Sieg Heim, Skala ${w}:${v}`);
  if (outcome === "loss" && !(w < v)) verletzt.push(`${x.d} ${x.md} Niederlage Heim, Skala ${w}:${v}`);
  if (outcome === "draw" && w !== v) verletzt.push(`${x.d} ${x.md} Remis, Skala ${w}:${v}`);
  const s = vt(x.d);
  s.n += 1;
  const altHeim = altDuell(x.heim, x.feld, outcome);
  s.dVorher.push(Math.abs(altHeim));
  s.dNachher.push(Math.abs(e.verhaeltnis));
  s.ergebnisse.push(`${Math.max(w, v)}:${Math.min(w, v)}`);
  if (Math.max(w, v) === 10 && Math.min(w, v) === 0) s.zehnNull += 1;
  if (outcome === "draw") s.remis += 1;
  buchungen.push({ lauf: x.lauf, liga: x.liga, team: x.heim.team, d: x.d, vorher: altHeim, nachher: e.verhaeltnis });
  buchungen.push({ lauf: x.lauf, liga: x.liga, team: x.gast.team, d: x.d, vorher: -altHeim, nachher: -e.verhaeltnis });
}
for (const p of pods) {
  const e = berechnePodErgebnisE1({
    disciplineId: p.d,
    playerCount: p.feld,
    sortiert: p.teams.map((z, i) => ({ luecke: i === 0 ? 0 : z.marge ?? 0, leistung: p.leistung[i] })),
  });
  for (let i = 1; i < e.werte.length; i += 1) {
    if (!(e.werte[i - 1]! > e.werte[i]!)) verletzt.push(`${p.d} ${p.md} Pod Platz ${i} vs ${i + 1}: ${e.werte.join("/")}`);
    if (!(e.verhaeltnisse[i - 1]! > e.verhaeltnisse[i]!)) verletzt.push(`${p.d} ${p.md} Pod-Verh. Platz ${i} vs ${i + 1}: ${e.verhaeltnisse.join("/")}`);
  }
  p.teams.forEach((z, i) => {
    if (z.skala !== "e1") return;
    gebuchtGeprueft += 1;
    if (z.verhaeltnis !== e.verhaeltnisse[i] || z.pod!.wert !== e.werte[i]) {
      gebuchtAbweichung.push(`${p.d} ${p.md} ${z.team}: gebucht ${z.pod!.wert} (${z.verhaeltnis}), gerechnet ${e.werte[i]} (${e.verhaeltnisse[i]})`);
    }
  });
  if (e.verhaeltnisse.reduce((a, b) => a + b, 0) !== 0) verletzt.push(`${p.d} ${p.md} Pod-Verh. Summe ${e.verhaeltnisse.join("/")}`);
  const s = vt(p.d);
  s.n += 1;
  s.podWerte.push(...e.werte);
  s.ergebnisse.push(e.werte.join("-"));
  const alt = altPod(p.teams, p.feld);
  p.teams.forEach((z, i) => {
    s.dVorher.push(Math.abs(alt[i] ?? 0));
    s.dNachher.push(Math.abs(e.verhaeltnisse[i] ?? 0));
    buchungen.push({ lauf: p.lauf, liga: p.liga, team: z.team, d: p.d, vorher: alt[i] ?? 0, nachher: e.verhaeltnisse[i] ?? 0 });
  });
}

console.log("## Garantien\n");
console.log(`Sieger/Remis/Platz-Reihenfolge verletzt: ${verletzt.length} (${duelle.length} Duelle, ${pods.length} Pods)`);
for (const v of verletzt.slice(0, 10)) console.log(`  - ${v}`);
// Nur aussagekraeftig, wenn alle Laeufe mit DENSELBEN Ankern gebucht haben (Ende-zu-Ende-Lauf mit Skala an,
// nach der Kalibrierung). Roh-Laeufe buchen mit den Ankern ihres Startzeitpunkts.
if (gebuchtGeprueft > 0 && laeufe.every((l) => !l.roh)) {
  console.log(`Gebuchte E1-Zeilen gegen Neurechnung: ${gebuchtGeprueft} geprueft, ${gebuchtAbweichung.length} Abweichungen`);
  for (const v of gebuchtAbweichung.slice(0, 10)) console.log(`  - ${v}`);
}

console.log("\n## Verteilung je Disziplin (|Verh.| je Team-Zeile; vorher = Skala 19.10. nachgerechnet; Duell = |D|, Pod nachher = Wert minus Mittel der Gegner)\n");
console.log("| Disziplin | Format | Begegnungen | vorher: Median |D| | vorher: Anteil 10 | vorher: Anteil 5 | nachher: Median |D| | nachher: Anteil 10 | haeufigste Ergebnisse nachher | 10:0 | Remis |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|---|---:|---:|");
for (const d of disziplinen) {
  const s = jeD.get(d)!;
  const format = pods.some((p) => p.d === d) ? (duelle.some((x) => x.d === d) ? "beides" : "Pod") : "Duell";
  const top = [...s.ergebnisse.reduce((m, e) => m.set(e, (m.get(e) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e, n]) => `${e} (${n})`)
    .join(", ");
  const anteil = (a: number[], w: number) => a.filter((x) => x === w).length / a.length;
  console.log(
    `| ${d} | ${format} | ${s.n} | ${f1(q(sort(s.dVorher), 0.5))} | ${pz(anteil(s.dVorher, 10))} | ${pz(anteil(s.dVorher, 5))} | ${f1(q(sort(s.dNachher), 0.5))} | ${pz(anteil(s.dNachher, 10))} | ${top} | ${s.zehnNull} | ${s.remis} |`,
  );
}

// Saison-Verhaeltnis je Team (je Lauf), Spannweite und Dominanz der groessten Disziplin.
console.log("\n## Punkteverhaeltnis ueber die Saison (je Lauf und Liga, 16 Teams)\n");
console.log("| Lauf | Liga | vorher: Spannweite (min..max) | vorher: Std | nachher: Spannweite | nachher: Std | vorher: groesste Disziplin (Anteil an Σ|Verh.|) | nachher: groesste Disziplin |");
console.log("|---|---|---|---:|---|---:|---|---|");
const std = (a: number[]) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
};
const dominanzGesamt = { vorher: new Map<string, number>(), nachher: new Map<string, number>() };
const teamAnteile = { vorher: [] as number[], nachher: [] as number[] };
for (const [nr, lauf] of laeufe.entries()) {
  for (const liga of [...new Set(buchungen.filter((b) => b.lauf === nr).map((b) => b.liga))].sort()) {
    const bs = buchungen.filter((b) => b.lauf === nr && b.liga === liga);
    const zeile: string[] = [`${nr + 1} (${lauf.saveId.slice(-6)})`, liga];
    const dominanz: string[] = [];
    const spalten: string[] = [];
    for (const art of ["vorher", "nachher"] as const) {
      const summe = new Map<string, number>();
      const absJeD = new Map<string, number>();
      const absJeTeamD = new Map<string, Map<string, number>>();
      for (const b of bs) {
        summe.set(b.team, (summe.get(b.team) ?? 0) + b[art]);
        absJeD.set(b.d, (absJeD.get(b.d) ?? 0) + Math.abs(b[art]));
        dominanzGesamt[art].set(b.d, (dominanzGesamt[art].get(b.d) ?? 0) + Math.abs(b[art]));
        const m = absJeTeamD.get(b.team) ?? new Map<string, number>();
        m.set(b.d, (m.get(b.d) ?? 0) + Math.abs(b[art]));
        absJeTeamD.set(b.team, m);
      }
      for (const m of absJeTeamD.values()) {
        const t = [...m.values()].reduce((a, b) => a + b, 0);
        if (t > 0) teamAnteile[art].push(Math.max(...m.values()) / t);
      }
      const werte = [...summe.values()];
      const gesamt = [...absJeD.values()].reduce((a, b) => a + b, 0);
      const [dMax, vMax] = [...absJeD].sort((a, b) => b[1] - a[1])[0] ?? ["–", 0];
      spalten.push(`${Math.round(Math.max(...werte) - Math.min(...werte))} (${Math.round(Math.min(...werte))}..${Math.round(Math.max(...werte))})`, f1(std(werte)));
      dominanz.push(`${dMax} ${pz(vMax / gesamt)}`);
    }
    console.log(`| ${[...zeile, ...spalten, ...dominanz].join(" | ")} |`);
  }
}
console.log("\n## Anteil der Disziplinen an Σ|Verh.| (alle Laeufe; gleichverteilt waere 1/Zahl der Disziplinen)\n");
console.log("| Disziplin | vorher | nachher |");
console.log("|---|---:|---:|");
const gv = [...dominanzGesamt.vorher.values()].reduce((a, b) => a + b, 0);
const gn = [...dominanzGesamt.nachher.values()].reduce((a, b) => a + b, 0);
for (const d of disziplinen) {
  console.log(`| ${d} | ${pz((dominanzGesamt.vorher.get(d) ?? 0) / gv)} | ${pz((dominanzGesamt.nachher.get(d) ?? 0) / gn)} |`);
}
const maxV = Math.max(...[...dominanzGesamt.vorher.values()].map((x) => x / gv));
const maxN = Math.max(...[...dominanzGesamt.nachher.values()].map((x) => x / gn));
const minV = Math.min(...[...dominanzGesamt.vorher.values()].map((x) => x / gv));
const minN = Math.min(...[...dominanzGesamt.nachher.values()].map((x) => x / gn));
console.log(`\nGroesster Anteil einer Disziplin: vorher ${pz(maxV)}, nachher ${pz(maxN)}; kleinster: vorher ${pz(minV)}, nachher ${pz(minN)}.`);
console.log(
  `Je Team: Anteil der groessten Disziplin an seinem Σ|Verh.|, Median vorher ${pz(q(sort(teamAnteile.vorher), 0.5))}, nachher ${pz(q(sort(teamAnteile.nachher), 0.5))}; Maximum vorher ${pz(Math.max(...teamAnteile.vorher))}, nachher ${pz(Math.max(...teamAnteile.nachher))}.`,
);
console.log(`\n(Mittlere Leistung je Seite, C2-PP: Median ${f2(q(sort(duelle.flatMap((x) => [x.lHeim, x.lGast])), 0.5))})`);
