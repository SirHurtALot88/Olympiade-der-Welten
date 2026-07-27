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
  getSponsorV2Terms, sponsorV2CardInvariants, sponsorV2GuaranteedLadder,
} from "@/lib/sponsor/sponsor-v2-offer-service";

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

console.log(`\nMittlere Leiter (ueber alle Karten) je Rang:`);
const n = rows[0].ladder.length;
for (let i = 0; i < n; i += 1) {
  const col = rows.map((r) => r.ladder[i]);
  console.log(`  Stufe ${String(i + 1).padStart(2)}:  Mittel ${(col.reduce((a, b) => a + b, 0) / col.length).toFixed(1).padStart(6)}   min ${Math.min(...col).toFixed(1).padStart(6)}   max ${Math.max(...col).toFixed(1).padStart(6)}`);
}
