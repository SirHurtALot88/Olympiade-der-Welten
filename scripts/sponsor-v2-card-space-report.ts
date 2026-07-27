/**
 * KARTENRAUM-BERICHT — druckt die tatsaechliche Auszahlungsverteilung ueber alle 160 Karten, die der
 * Knopf "Neues Spiel" erzeugt: Untergrenze, Obergrenze, Spreizung, Sonderziel-Anteil, je Seltenheit
 * und je Rangstufe.
 *
 * Aufruf:  npx tsx scripts/sponsor-v2-card-space-report.ts
 *
 * WOFUER: `tests/sponsor-v2-card-space.test.ts` beantwortet "haelt die Schranke?" mit ja/nein. Dieser
 * Bericht beantwortet "wo genau liegen die Betraege?" — die Frage, die man vor und nach jeder
 * Balancing-Aenderung braucht. Beide gehen denselben Weg wie POST /api/new-game, damit gemessen wird,
 * was der Spieler wirklich bekommt, und nicht eine konstruierte Karte.
 *
 * Er geht ueber buildNewGameStateFromBaseline, ist read-only und schreibt nichts in die Datenbank.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import type { SponsorOffer } from "@/lib/data/olyDataTypes";
import { buildNewGameStateFromBaseline } from "@/lib/game/new-game-setup-service";
import {
  getSponsorV2Terms, sponsorV2CardInvariants, sponsorV2GuaranteedLadder, sponsorV2Settle,
} from "@/lib/sponsor/sponsor-v2-offer-service";
import { SPONSOR_V2_EVALUABLE_CLAUSES } from "@/lib/sponsor/sponsor-v2-clause-evaluator";

const gs = buildNewGameStateFromBaseline({ presetId: "solo_1", chrisTeamIds: ["P-S"] }).gameState;
const offers: SponsorOffer[] = Object.values(gs.seasonState.sponsorOffersByTeamId ?? {}).flat();
console.log(`Karten: ${offers.length}`);

type Row = { name: string; rarity: string; profile: string; curve: string; exp: number; ladder: number[]; goalShare: number };
const rows: Row[] = offers.map((o) => {
  const t = getSponsorV2Terms(o)!;
  const inv = sponsorV2CardInvariants(t);
  return {
    name: o.name, rarity: String(t.rarity), profile: String(t.profileName), curve: String(t.curveName),
    exp: Number(t.expectedRank), ladder: sponsorV2GuaranteedLadder(t), goalShare: inv.goalShare,
  };
});

const mins = rows.map((r) => Math.min(...r.ladder));
const maxs = rows.map((r) => Math.max(...r.ladder));
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };

console.log(`\nUNTERGRENZE ueber alle Karten:  min ${Math.min(...mins).toFixed(1)}  p10 ${q(mins, .1).toFixed(1)}  median ${q(mins, .5).toFixed(1)}  max ${Math.max(...mins).toFixed(1)}`);
console.log(`OBERGRENZE   ueber alle Karten:  min ${Math.min(...maxs).toFixed(1)}  median ${q(maxs, .5).toFixed(1)}  p90 ${q(maxs, .9).toFixed(1)}  max ${Math.max(...maxs).toFixed(1)}`);
const spreads = rows.map((r) => Math.max(...r.ladder) - Math.min(...r.ladder));
console.log(`SPREIZUNG:                       min ${Math.min(...spreads).toFixed(1)}  median ${q(spreads, .5).toFixed(1)}  max ${Math.max(...spreads).toFixed(1)}`);
console.log(`SONDERZIEL-ANTEIL:               max ${(Math.max(...rows.map((r) => r.goalShare)) * 100).toFixed(1)} %`);
console.log(`Karten unter 35 C Untergrenze:   ${mins.filter((m) => m < 35 - 1e-6).length} von ${rows.length}`);
console.log(`Karten unter 40 C Untergrenze:   ${mins.filter((m) => m < 40 - 1e-6).length} von ${rows.length}`);

console.log(`\nUntergrenze nach Seltenheit:`);
for (const rarity of [...new Set(rows.map((r) => r.rarity))]) {
  const sub = rows.filter((r) => r.rarity === rarity);
  const m = sub.map((r) => Math.min(...r.ladder));
  const M = sub.map((r) => Math.max(...r.ladder));
  console.log(`  ${rarity.padEnd(12)} n=${String(sub.length).padStart(3)}  Boden ${Math.min(...m).toFixed(1)}–${Math.max(...m).toFixed(1)}   Decke ${Math.min(...M).toFixed(1)}–${Math.max(...M).toFixed(1)}`);
}

console.log(`\nDie 10 Karten mit der niedrigsten Untergrenze:`);
[...rows].sort((a, b) => Math.min(...a.ladder) - Math.min(...b.ladder)).slice(0, 10).forEach((r) => {
  console.log(`  ${Math.min(...r.ladder).toFixed(1).padStart(6)} C  …  Decke ${Math.max(...r.ladder).toFixed(1).padStart(6)} C   ${r.rarity}/${r.profile}/${r.curve} E#${r.exp}  ${r.name}`);
});

/**
 * DIE ABNAHMEZAHL DES WIRTSCHAFTSZIELS. Die garantierte Leiter oben ist nur der Sockel; was ein Team
 * wirklich bekommt, ist Leiter + Klausel + Sonderziel. Das Ziel lautet: der Meister landet bei
 * Gehaltsfaktor 1.0 inklusive aller Boni zwischen 90 und 100 C. Gemessen wird deshalb ueber die
 * Karten, die ein Spitzenteam ueberhaupt bekommt (Erwartungsrang <= 8), nicht ueber alle 160 —
 * eine Kellerkarte auf Platz 1 sagt ueber dieses Ziel nichts aus.
 */
const best = (t: ReturnType<typeof getSponsorV2Terms>, rank: number) => sponsorV2Settle(t!, rank, true, 1);
const worst = (t: ReturnType<typeof getSponsorV2Terms>, rank: number) => sponsorV2Settle(t!, rank, false, 0);
const terms = offers.map((o) => getSponsorV2Terms(o)!);
const topCards = terms.filter((t) => Number(t.expectedRank) <= 8);
const botCards = terms.filter((t) => Number(t.expectedRank) >= 25);
const stat = (a: number[]) => `min ${Math.min(...a).toFixed(1)}  median ${q(a, .5).toFixed(1)}  max ${Math.max(...a).toFixed(1)}  Mittel ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}`;

console.log(`\nWIRTSCHAFTSZIEL — was wirklich ausgezahlt wird (Leiter + Klausel + Sonderziel):`);
console.log(`  Meister (Platz 1), alles erfuellt, Karten fuer Spitzenteams (E#<=8, n=${topCards.length}):`);
console.log(`    ${stat(topCards.map((t) => best(t, 1)))}     Ziel 90–100`);
console.log(`  Meister (Platz 1), alles erfuellt, ueber ALLE Karten (n=${terms.length}):`);
console.log(`    ${stat(terms.map((t) => best(t, 1)))}`);
console.log(`  Platz 32, nichts erfuellt, Karten fuer Kellerteams (E#>=25, n=${botCards.length}):`);
console.log(`    ${stat(botCards.map((t) => worst(t, 32)))}     Ziel >= 35`);
console.log(`  Platz 32, nichts erfuellt, ueber ALLE Karten:`);
console.log(`    ${stat(terms.map((t) => worst(t, 32)))}`);
console.log(`  Absturz Meisterkarte auf Platz 32 (E#<=8, nichts erfuellt) — "darf nicht gleich insolvent sein":`);
console.log(`    ${stat(topCards.map((t) => worst(t, 32)))}`);

/**
 * REALISTISCH statt Bestfall: Klausel und Sonderziel werden nicht immer erfuellt. Der Erwartungswert
 * auf Platz 1 gewichtet die vier Faelle mit ihren echten Wahrscheinlichkeiten. Das ist die Zahl, gegen
 * die "90–100 als Meister" zu lesen ist — "alles erfuellt" ist die Obergrenze eines guten Jahres.
 */
const clauseP = (t: ReturnType<typeof getSponsorV2Terms>) =>
  SPONSOR_V2_EVALUABLE_CLAUSES.find((c) => c.name === t!.clauseName)?.p ?? 0.5;
const expectedAt = (t: ReturnType<typeof getSponsorV2Terms>, rank: number) => {
  const P = clauseP(t), p = Number(t!.goalProbability);
  return (1 - P) * (1 - p) * sponsorV2Settle(t!, rank, false, 0)
    + P * (1 - p) * sponsorV2Settle(t!, rank, true, 0)
    + (1 - P) * p * sponsorV2Settle(t!, rank, false, 1)
    + P * p * sponsorV2Settle(t!, rank, true, 1);
};
console.log(`  Meister (Platz 1), ERWARTUNGSWERT mit echten Wahrscheinlichkeiten (E#<=8):`);
console.log(`    ${stat(topCards.map((t) => expectedAt(t, 1)))}     Ziel 90–100`);

console.log(`\nMittlere Leiter (ueber alle Karten) je Rang:`);
const n = rows[0].ladder.length;
for (let i = 0; i < n; i += 1) {
  const col = rows.map((r) => r.ladder[i]);
  console.log(`  Stufe ${String(i + 1).padStart(2)}:  Mittel ${(col.reduce((a, b) => a + b, 0) / col.length).toFixed(1).padStart(6)}   min ${Math.min(...col).toFixed(1).padStart(6)}   max ${Math.max(...col).toFixed(1).padStart(6)}`);
}
