/**
 * AUSWERTUNG: Liga-Draft alt (Blocklauf) gegen neu (Einzelschritt), paarweise auf derselben Anlage.
 *
 * Eingaben sind zwei Rohdaten-Dateien von `scripts/miss-teamfinanzen-saison.ts` (einmal `--draft block`, einmal
 * `--draft einzelschritt`, beide `--von-anlage` derselben Basis-SQLite). Ausgabe: Markdown-Tabellen fuer
 * docs/design/draft-neubau-kern-18-11.md.
 *
 *   npx tsx scripts/auswerte-liga-draft-alt-neu.ts <alt.json> <neu.json> [weitere-alt.json weitere-neu.json ...]
 *
 * Gemessen je Team: Kaderstaerke (Top-6 je Disziplin, Mittel ueber 20), Kadergroesse, Gehalt, Kasse nach dem Draft,
 * Kasse nach Saison 1 (nach 20 Spieltagen, falls gelaufen), Abdeckung (Disziplinen mit mindestens einem bzw. drei
 * soliden Spielern > 60), Laufzeit des Drafts. Dazu die Frage, die der Auftrag stellt: kauft die KI durch die
 * Pick-Reihenfolge systematisch schlechter? -> Differenz neu − alt je Team, nach Platz in Runde 1 gedrittelt.
 */
import fs from "node:fs";

type Snap = { cash: number; kader: number; gehaltIst: number; marktwert: number; staerke: number };
type Lauf = {
  label: string;
  draftArt?: string;
  draftLaufzeitMs?: number;
  draftZuege?: number;
  draftAbdeckung?: Record<string, { mitEinem: number; mitDrei: number; schwaechsteTop6: number }>;
  ligaDraft?: { verlauf: Array<[number, number | null, string, string, string | null, number | null]> } | null;
  phasen: Record<string, { snap?: Record<string, Snap> }>;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const mittel = (werte: number[]) => (werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : 0);
const median = (werte: number[]) => {
  const s = [...werte].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

function lies(datei: string): Lauf {
  return JSON.parse(fs.readFileSync(datei, "utf8")) as Lauf;
}

function kasseNachS1(lauf: Lauf): Record<string, Snap> | null {
  return lauf.phasen["s1_03_nach_spieltagen"]?.snap ?? null;
}

const dateien = process.argv.slice(2);
if (dateien.length < 2 || dateien.length % 2 !== 0) {
  console.error("Aufruf: auswerte-liga-draft-alt-neu.ts <alt.json> <neu.json> [<alt2.json> <neu2.json> ...]");
  process.exit(1);
}

type Zeile = {
  paar: number;
  teamId: string;
  platz: number | null;
  alt: Snap;
  neu: Snap;
  altS1: Snap | null;
  neuS1: Snap | null;
  altAb: { mitEinem: number; mitDrei: number; schwaechsteTop6: number } | null;
  neuAb: { mitEinem: number; mitDrei: number; schwaechsteTop6: number } | null;
};
const zeilen: Zeile[] = [];
const laufzeiten: Array<{ paar: number; alt: number; neu: number; zuege: number | null }> = [];

for (let i = 0; i < dateien.length; i += 2) {
  const alt = lies(dateien[i]!);
  const neu = lies(dateien[i + 1]!);
  const paar = i / 2 + 1;
  const altDraft = alt.phasen["s1_01_nach_draft"]!.snap!;
  const neuDraft = neu.phasen["s1_01_nach_draft"]!.snap!;
  const platz = new Map<string, number>();
  for (const [runde, p, teamId, art] of neu.ligaDraft?.verlauf ?? []) {
    if (runde === 1 && p != null && art !== "ueberspringen" && !platz.has(teamId)) platz.set(teamId, p);
  }
  laufzeiten.push({ paar, alt: alt.draftLaufzeitMs ?? NaN, neu: neu.draftLaufzeitMs ?? NaN, zuege: neu.draftZuege ?? null });
  for (const teamId of Object.keys(altDraft)) {
    zeilen.push({
      paar,
      teamId,
      platz: platz.get(teamId) ?? null,
      alt: altDraft[teamId]!,
      neu: neuDraft[teamId]!,
      altS1: kasseNachS1(alt)?.[teamId] ?? null,
      neuS1: kasseNachS1(neu)?.[teamId] ?? null,
      altAb: alt.draftAbdeckung?.[teamId] ?? null,
      neuAb: neu.draftAbdeckung?.[teamId] ?? null,
    });
  }
}

const groessen: Array<[string, (z: Zeile, seite: "alt" | "neu") => number | null]> = [
  ["Kaderstaerke (Top-6, Ø 20 Disz.)", (z, s) => z[s].staerke],
  ["Kader (Spieler)", (z, s) => z[s].kader],
  ["Gehalt (Summe)", (z, s) => z[s].gehaltIst],
  ["Marktwert Kader", (z, s) => z[s].marktwert],
  ["Kasse nach Draft", (z, s) => z[s].cash],
  ["Kasse nach S1 (20 Spieltage)", (z, s) => (s === "alt" ? z.altS1?.cash : z.neuS1?.cash) ?? null],
  ["Staerke nach S1", (z, s) => (s === "alt" ? z.altS1?.staerke : z.neuS1?.staerke) ?? null],
  ["Disziplinen mit ≥1 solidem Spieler (von 20)", (z, s) => (s === "alt" ? z.altAb?.mitEinem : z.neuAb?.mitEinem) ?? null],
  ["Disziplinen mit ≥3 soliden Spielern (von 20)", (z, s) => (s === "alt" ? z.altAb?.mitDrei : z.neuAb?.mitDrei) ?? null],
  ["Schwaechste Disziplin (Top-6)", (z, s) => (s === "alt" ? z.altAb?.schwaechsteTop6 : z.neuAb?.schwaechsteTop6) ?? null],
];

console.log(`## Liga-Draft alt gegen neu — ${dateien.length / 2} Paar(e), ${zeilen.length} Team-Zeilen\n`);
console.log("| Groesse | alt Ø | neu Ø | alt Median | neu Median | Δ Ø (neu − alt) | Teams neu schlechter / besser | alt min | neu min |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const [name, wert] of groessen) {
  const paare = zeilen
    .map((z) => [wert(z, "alt"), wert(z, "neu")] as const)
    .filter((p): p is readonly [number, number] => p[0] != null && p[1] != null);
  if (paare.length === 0) continue;
  const alt = paare.map((p) => p[0]);
  const neu = paare.map((p) => p[1]);
  const schlechter = paare.filter((p) => p[1] < p[0] - 1e-9).length;
  const besser = paare.filter((p) => p[1] > p[0] + 1e-9).length;
  console.log(
    `| ${name} | ${r1(mittel(alt))} | ${r1(mittel(neu))} | ${r1(median(alt))} | ${r1(median(neu))} | ${r1(mittel(neu) - mittel(alt))} | ${schlechter} / ${besser} | ${r1(Math.min(...alt))} | ${r1(Math.min(...neu))} |`,
  );
}

console.log("\n### Pick-Reihenfolge: Δ Kaderstaerke (neu − alt) nach Platz in Runde 1\n");
console.log("| Platz in Runde 1 | Teams | Δ Staerke Ø | Δ Kader Ø | Δ Kasse nach Draft Ø | Δ Kasse nach S1 Ø |");
console.log("|---|---:|---:|---:|---:|---:|");
const mitPlatz = zeilen.filter((z) => z.platz != null);
const n = Math.max(...mitPlatz.map((z) => z.platz!), 1);
for (const [label, von, bis] of [
  ["vorne (1–11)", 1, Math.ceil(n / 3)],
  ["Mitte", Math.ceil(n / 3) + 1, Math.ceil((2 * n) / 3)],
  ["hinten", Math.ceil((2 * n) / 3) + 1, n],
] as Array<[string, number, number]>) {
  const gruppe = mitPlatz.filter((z) => z.platz! >= von && z.platz! <= bis);
  const s1 = gruppe.filter((z) => z.altS1 && z.neuS1);
  console.log(
    `| ${label.replace("1–11", `${von}–${bis}`)} | ${gruppe.length} | ${r1(mittel(gruppe.map((z) => z.neu.staerke - z.alt.staerke)))} | ${r1(mittel(gruppe.map((z) => z.neu.kader - z.alt.kader)))} | ${r1(mittel(gruppe.map((z) => z.neu.cash - z.alt.cash)))} | ${s1.length ? r1(mittel(s1.map((z) => z.neuS1!.cash - z.altS1!.cash))) : "–"} |`,
  );
}

console.log("\n### Laufzeit des Drafts (Wanduhr, ganze Liga)\n");
console.log("| Paar | alt (Blocklauf, 1 Schreibvorgang je Team) | neu (Einzelschritt, 1 Schreibvorgang je Zug) | Zuege neu | je Zug |");
console.log("|---|---:|---:|---:|---:|");
for (const l of laufzeiten) {
  console.log(`| ${l.paar} | ${r1(l.alt / 1000)} s | ${r1(l.neu / 1000)} s | ${l.zuege ?? "–"} | ${l.zuege ? `${Math.round(l.neu / l.zuege)} ms` : "–"} |`);
}

console.log("\n### Je Team (Paar 1)\n");
console.log("| Team | Platz R1 | Staerke alt → neu | Kader alt → neu | Gehalt alt → neu | Kasse Draft alt → neu | Kasse S1 alt → neu | ≥3 solide alt → neu |");
console.log("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const z of zeilen.filter((z) => z.paar === 1).sort((a, b) => (a.platz ?? 99) - (b.platz ?? 99))) {
  console.log(
    `| ${z.teamId} | ${z.platz ?? "–"} | ${r1(z.alt.staerke)} → ${r1(z.neu.staerke)} | ${z.alt.kader} → ${z.neu.kader} | ${r1(z.alt.gehaltIst)} → ${r1(z.neu.gehaltIst)} | ${r1(z.alt.cash)} → ${r1(z.neu.cash)} | ${z.altS1 ? r1(z.altS1.cash) : "–"} → ${z.neuS1 ? r1(z.neuS1.cash) : "–"} | ${z.altAb?.mitDrei ?? "–"} → ${z.neuAb?.mitDrei ?? "–"} |`,
  );
}
