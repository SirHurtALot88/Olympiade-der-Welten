/**
 * AUSWERTUNG SPONSOR-TOPF (24.11., docs/design/sponsoren-rework-bau-24-11.md): liest die Rohdaten von `scripts/miss-teamfinanzen-saison.ts`
 * (`--out`) und rechnet die Abnahme aus Konzept 5.6 und Entscheidung 1 (23.11.).
 *
 *   npx tsx scripts/auswerte-sponsor-topf.ts <label>=<datei.json> [<label>=<datei.json> ...]
 *
 * Je Lauf und Saison:
 *   - Liga-Wert = Summe Kasse + Summe Kaderwert zum Saisonstart (nach der Kaufphase), Drift gegen den Vorgaenger in Prozent (Ziel +-3 %)
 *   - operative GuV je Team (Mittel gesamt, Liga 1, Liga 2, Teams >= 0, Streuung), "nach Kader-Ersatz" (minus K_E / 32)
 *   - Sponsor-Summe, Verhaeltnis Liga 1 : Liga 2, Kaderstaerke (Mittel Top-6) und Kadergroesse zum Saisonstart
 *   - Topf: Summe der Grundbetraege + Farb-Toepfe + Treue gegen den Topf; Farb-Toepfe verteilt = Topf auf 0,1; Vertragsarten
 *   - Phase 0 (Modell gegen gebaute Regel): je Team |gebuchte Sponsor-Summe - (Grundbetrag + Treue + Farb-Anteil + Leistungsteil + Ziel)| ist
 *     in den Zeilen selbst enthalten; hier geprueft wird die Summe je Liga von Grundbetrag + Farb-Toepfe gegen den Topf.
 */
import fs from "node:fs";

import { berechneTopf } from "@/lib/sponsors/sponsor-topf-modell";

type Snap = {
  teamId: string; liga: string | null; budget?: number; cash: number; marktwert: number; kader: number; staerke: number; rank: number | null;
  sponsorTopf?: { grundbetrag: number; treue: number; hebel: number; vertragsart: string | null; erwartungsrang: number; farben: string[]; liga: number } | null;
};
type Phase = {
  snap?: Record<string, Snap>;
  guv?: Record<string, { guv: { guv: number }; parts: { sponsorCash?: number | null } }>;
  sponsorTopf?: { topf: number; hauptTopf: number; farbTopf: [number, number]; treueSumme: number; kaderErsatz: number; ligaWert?: number; ligaWertDrift?: number | null; wertKorrektur?: number; betriebsteil: number; betriebsteilRoh: number; uebertrag: number; faktor: number; sigma: number; teams: Record<string, { teamId: string; grundbetrag: number; treue: number; liga: 1 | 2; vertragsart: string | null; erwartungsrang: number; beliebtheit: number; passung: number; kosten: number; planEinnahmen: number; kaderwert: number }> } | null;
  sponsorCashJeTeam?: Record<string, number>;
  farbToepfe?: Array<{ liga: number; farbe: string; topf: number; teilnehmer: number; verteilt: number }> | null;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const pct = (x: number) => `${x >= 0 ? "+" : ""}${(Math.round(x * 1000) / 10).toFixed(1)} %`;

function auswerten(label: string, file: string) {
  const run = JSON.parse(fs.readFileSync(file, "utf8")) as { phasen: Record<string, Phase> };
  const ph = run.phasen;
  const saisons = [...new Set(Object.keys(ph).map((k) => /^s(\d+)_/.exec(k)?.[1]).filter(Boolean))].map(Number).sort((a, b) => a - b);
  console.log(`\n## ${label}  (${file})\n`);
  console.log("| Saison | Liga-Wert Start (Kasse + Kader) | Drift | Kasse Σ | Kader Σ | Kader Ø | Staerke Ø | GuV Ø | Liga 1 | Liga 2 | nach K_E Ø | Teams >= 0 | sd | Sponsor Σ | L1 : L2 |");
  console.log("|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  let vorher: number | null = null;
  for (const s of saisons) {
    const start = ph[`s${s}_02_saisonstart`]?.snap;
    const ab = ph[`s${s}_04_nach_abschluss`];
    const topf = ph[`s${s}_03_nach_spieltagen`]?.sponsorTopf ?? null;
    const teams = start ? Object.values(start) : [];
    const kasse = sum(teams.map((t) => t.cash));
    const kader = sum(teams.map((t) => t.marktwert));
    const wert = kasse + kader;
    const drift = vorher == null ? null : wert / vorher - 1;
    vorher = wert;
    // Ligazugehoerigkeit der SAISON (Stichtag), nicht des Schnappschusses nach Auf- und Abstieg
    const stichtagTeams = topf?.teams ?? {};
    const ligaDerSaison = (id: string) => (stichtagTeams[id] ? (stichtagTeams[id]!.liga === 1 ? "liga1" : "liga2") : ph[`s${s}_04_nach_abschluss`]?.snap?.[id]?.liga ?? null);
    const guv = ab?.guv ? Object.entries(ab.guv).map(([id, g]) => ({ id, g: g.guv.guv, liga: ligaDerSaison(id), sp: ab.sponsorCashJeTeam?.[id] ?? g.parts.sponsorCash ?? 0 })) : [];
    const l1 = guv.filter((x) => x.liga === "liga1");
    const l2 = guv.filter((x) => x.liga === "liga2");
    const ke = topf ? topf.kaderErsatz / Math.max(1, guv.length) : 0;
    console.log(
      `| ${s} | ${f1(wert)} | ${drift == null ? "–" : pct(drift)} | ${f1(kasse)} | ${f1(kader)} | ${f1(mean(teams.map((t) => t.kader)))} | ${f1(mean(teams.map((t) => t.staerke)))} | ${guv.length ? f1(mean(guv.map((x) => x.g))) : "–"} | ${l1.length ? f1(mean(l1.map((x) => x.g))) : "–"} | ${l2.length ? f1(mean(l2.map((x) => x.g))) : "–"} | ${guv.length ? f1(mean(guv.map((x) => x.g)) - ke) : "–"} | ${guv.filter((x) => x.g - ke >= 0).length} | ${guv.length ? f1(sd(guv.map((x) => x.g))) : "–"} | ${guv.length ? f1(sum(guv.map((x) => x.sp))) : "–"} | ${l1.length && l2.length ? (mean(l1.map((x) => x.sp)) / Math.max(0.1, mean(l2.map((x) => x.sp)))).toFixed(2) : "–"} |`,
    );
  }
  const modellZeilen: string[] = [];
  console.log("\nSchere (bei Erwartung = GuV - Kader-Ersatz/32 - Leistungsteil - Ziel - Abweichung des Farb-Anteils vom Mittel): reichstes minus aermstes Budget-Viertel, Sponsorgeld Liga 1 : Liga 2\n");
  console.log("| Saison | reichstes Viertel | aermstes Viertel | Differenz | Sponsor Liga 1 Ø | Liga 2 Ø | Verhaeltnis | Σ Leistung+Ziel Liga 1 | Liga 2 |");
  console.log("|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const s of saisons) {
    const start = ph[`s${s}_02_saisonstart`]?.snap;
    const ab = ph[`s${s}_04_nach_abschluss`];
    const t = ph[`s${s}_03_nach_spieltagen`]?.sponsorTopf;
    if (!start || !ab?.guv || !t || !ab.sponsorCashJeTeam) continue;
    const ke = t.kaderErsatz / Object.keys(t.teams).length;
    const zeilen = Object.entries(t.teams).map(([id, x]) => {
      const sp = ab.sponsorCashJeTeam![id] ?? 0;
      const farbMittel = (4 * t.farbTopf[x.liga - 1]!) / 16;
      const rest = sp - (x.grundbetrag + x.treue + farbMittel);
      return { id, liga: x.liga, budget: start[id]?.budget ?? 0, bei: ab.guv![id]!.guv.guv - ke - rest, sp, rest };
    }).sort((a, b) => b.budget - a.budget);
    const v = Math.floor(zeilen.length / 4);
    const reich = mean(zeilen.slice(0, v).map((x) => x.bei));
    const arm = mean(zeilen.slice(-v).map((x) => x.bei));
    const spL = (l: number) => mean(zeilen.filter((x) => x.liga === l).map((x) => x.sp));
    const restL = (l: number) => sum(zeilen.filter((x) => x.liga === l).map((x) => x.rest));
    console.log(`| ${s} | ${f1(reich)} | ${f1(arm)} | ${f1(reich - arm)} | ${f1(spL(1))} | ${f1(spL(2))} | ${(spL(1) / Math.max(0.1, spL(2))).toFixed(2)} | ${f1(restL(1))} | ${f1(restL(2))} |`);
  }
  console.log("\nTopf je Saison:\n");
  console.log("| Saison | F | K_B (roh) | K_E | Uebertrag | Wert-Korrektur (Drift) | Topf T | Σ Grund + Farb + Treue | Abweichung | Farb-Toepfe verteilt = Topf | Vertragsarten fest/leistung/praemie |");
  console.log("|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|");
  for (const s of saisons) {
    const t = ph[`s${s}_03_nach_spieltagen`]?.sponsorTopf;
    if (!t) { console.log(`| ${s} | (kein Topf-Stand) | | | | | | | | | |`); continue; }
    const g = sum(Object.values(t.teams).map((x) => x.grundbetrag));
    const gesamt = g + 4 * (t.farbTopf[0] + t.farbTopf[1]) + t.treueSumme;
    const farb = ph[`s${s}_04_nach_abschluss`]?.farbToepfe ?? [];
    const farbOk = farb.length === 8 && farb.every((x) => Math.round(x.verteilt * 10) === Math.round(x.topf * 10));
    const arten = ["fest", "leistung", "praemie"].map((a) => Object.values(t.teams).filter((x) => x.vertragsart === a).length).join("/");
    // Phase 0: das Modell gegen die gebaute Regel -- dieselben eingefrorenen Eingaben noch einmal durch `berechneTopf` (ohne Vorab-Zusage)
    const teamsEin = Object.values(t.teams).map((x) => ({ teamId: x.teamId, liga: x.liga, erwartungsrang: x.erwartungsrang, beliebtheit: x.beliebtheit, passungRoh: x.passung, treue: x.treue, kosten: x.kosten, planEinnahmen: x.planEinnahmen, kaderwert: x.kaderwert }));
    // den (geklammerten) Betriebsteil des Standes erzwingen: Kosten der ersten Zeile so verschieben, dass Summe (B - P) = K_B und die Klammer nichts tut
    if (teamsEin[0]) teamsEin[0].kosten += t.betriebsteil - t.betriebsteilRoh;
    const modell = berechneTopf({ teams: teamsEin, faktor: t.faktor, saison1: s === 1, kaderErsatz: 1, betriebsteilVorjahr: t.betriebsteil, uebertrag: t.uebertrag, wertKorrektur: t.wertKorrektur ?? 0 });
    const abw = Object.values(t.teams).map((x) => x.grundbetrag - (modell.teams[x.teamId]?.grundbetrag ?? 0));
    const gehoben = abw.filter((d) => d > 0.05).length;
    modellZeilen.push(`| ${s} | ${f1(modell.topf)} | ${f1(t.topf)} | ${f1(Math.max(...abw.map(Math.abs)))} | ${gehoben} (Zusage) |`);
    console.log(`| ${s} | ${t.faktor.toFixed(3)} | ${f1(t.betriebsteil)} (${f1(t.betriebsteilRoh)}) | ${f1(t.kaderErsatz)} | ${f1(t.uebertrag)} | ${f1(t.wertKorrektur ?? 0)} (${t.ligaWertDrift == null ? "–" : f1(t.ligaWertDrift)}) | ${f1(t.topf)} | ${f1(gesamt)} | ${f1(gesamt - t.topf)} | ${farb.length ? (farbOk ? "ja" : "NEIN") : "–"} | ${arten} |`);
  }
  modellTabelle(modellZeilen);
}

const args = process.argv.slice(2);
function modellTabelle(zeilen: string[]) {
  if (zeilen.length === 0) return;
  console.log("\nPhase 0, Modell gegen gebaute Regel (gleiche eingefrorene Eingaben, ohne Vorab-Zusage): Topf, groesste Abweichung des Grundbetrags in C\n");
  console.log("| Saison | Topf Modell | Topf gebaut | max abs Abweichung Grundbetrag | Teams ueber dem Modell |");
  console.log("|---:|---:|---:|---:|---|");
  for (const z of zeilen) console.log(z);
}
if (args.length === 0) { console.error("Aufruf: npx tsx scripts/auswerte-sponsor-topf.ts <label>=<datei.json> ..."); process.exit(1); }
for (const a of args) {
  const [label, file] = a.includes("=") ? (a.split("=") as [string, string]) : [a, a];
  auswerten(label, file);
}
