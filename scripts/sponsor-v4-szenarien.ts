/**
 * SZENARIO-RECHNUNG SPONSOR V4 — reine Analyse, kein Produktivcode.
 *
 * Zeigt, wo Top/Mid/Bottom mit dem umgebauten System landen: neue Auszahlungskurve (flacher Sockel),
 * Achsenkarten statt Risikoprofilen, Vorschuss als zweite Dimension. Gerechnet mit den ECHTEN
 * Produktionsfunktionen auf den 32 ECHTEN Gehaeltern des Live-Saves.
 *
 * Aufruf: npx tsx scripts/sponsor-v4-szenarien.ts
 */
import { buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";
import {
  SPONSOR_V4_ADVANCE_FEE_RATE,
  SPONSOR_V4_ADVANCE_SHARE,
  SPONSOR_V4_AXIS_SIZE_BY_RARITY,
  buildSponsorV3TermsCore,
  sponsorV3CardByKey,
  sponsorV3Settle,
  sponsorV4AxisSizeFor,
  type SponsorV3Rarity,
} from "@/lib/sponsor/sponsor-v3-model";
import { SPONSOR_V3_FLOOR_C } from "@/lib/sponsor/sponsor-v3-offer-service";
import { SPONSOR_LIVE_SAVE_S1_TEAMS } from "../tests/_fixtures/sponsor-live-save-s1.fixture";

const SALARY_FACTORS = [1.24, 1.03, 0.82] as const; // Wurfbereich: Boden, Median, Decke
const RARITY: SponsorV3Rarity = "magisch";

const salaries = SPONSOR_LIVE_SAVE_S1_TEAMS.map((team) => team.salary);
const byStartRank = [...SPONSOR_LIVE_SAVE_S1_TEAMS].sort((left, right) => left.startRank - right.startRank);
const fmt = (value: number) => (value >= 0 ? "+" : "") + value.toFixed(1);
const pad = (text: string, width: number) => text.padEnd(width);
const padL = (text: string, width: number) => text.padStart(width);

const SPOTS = [
  { label: "TOP", team: byStartRank[0]! },
  { label: "MID", team: byStartRank[15]! },
  { label: "BOT", team: byStartRank[31]! },
];

console.log("");
console.log(`SPONSOR V4 — 32 echte Teams, Gehaltssumme ${salaries.reduce((a, b) => a + b, 0).toFixed(0)} C`);
console.log(`Rarity ${RARITY} · Achsenhebel G = ${SPONSOR_V4_AXIS_SIZE_BY_RARITY[RARITY]} C`);
console.log("");

for (const factor of SALARY_FACTORS) {
  const curve = buildPrizeMoneyTable(salaries, factor).map((row) => row.totalPrizeMoney);
  console.log("=".repeat(104));
  console.log(
    `GEHALTSFAKTOR ${factor.toFixed(2)}  —  Rang 1 ${curve[0]!.toFixed(1)} C · Rang 16 ${curve[15]!.toFixed(1)} C · ` +
      `Rang 32 ${curve[31]!.toFixed(1)} C · Schere ${(curve[0]! / curve[31]!).toFixed(2)}x`,
  );
  console.log("=".repeat(104));

  for (const spot of SPOTS) {
    const startRank = spot.team.startRank;
    const basis = buildSponsorV3TermsCore({
      prizeCurve: curve,
      placementBonus: getPrizePlacementBonus,
      startRank,
      rarity: RARITY,
      card: sponsorV3CardByKey("basis"),
      goalKey: null,
      salaryFactor: factor,
      floor: SPONSOR_V3_FLOOR_C,
    });
    const achse = buildSponsorV3TermsCore({
      prizeCurve: curve,
      placementBonus: getPrizePlacementBonus,
      startRank,
      rarity: RARITY,
      card: sponsorV3CardByKey("achse"),
      goalKey: null,
      axis: { key: "ausbau", baseline: 0, scale: 2, offset: 0 },
      axisSize: sponsorV4AxisSizeFor(RARITY),
      salaryFactor: factor,
      floor: SPONSOR_V3_FLOOR_C,
      withAdvance: true,
    });

    const gehalt = spot.team.salary;
    console.log("");
    console.log(`  ${spot.label}  ${spot.team.code}  Startrang ${startRank} · Gehalt ${gehalt.toFixed(1)} C`);
    console.log(
      "  " + pad("Endrang", 22) + padL("BASIS", 12) + padL("ACHSE verfehlt", 16) + padL("ACHSE getroffen", 17) +
        padL("Netto Basis", 14),
    );
    for (const [label, finalRank] of [
      ["wie erwartet", startRank],
      ["5 Plaetze besser", Math.max(1, startRank - 5)],
      ["5 Plaetze schlechter", Math.min(32, startRank + 5)],
    ] as const) {
      const b = sponsorV3Settle(basis, finalRank, 0);
      console.log(
        "  " + pad(`${label} (${finalRank})`, 22) + padL(b.toFixed(1), 12) +
          padL(sponsorV3Settle(achse, finalRank, 0).toFixed(1), 16) +
          padL(sponsorV3Settle(achse, finalRank, 1).toFixed(1), 17) +
          padL(fmt(b - gehalt), 14),
      );
    }
    const spanne = sponsorV3Settle(achse, startRank, 1) - sponsorV3Settle(achse, startRank, 0);
    console.log(
      `  Spannweite der Achsenwahl ${spanne.toFixed(1)} C` +
        (achse.advance ? ` · Vorschuss ${achse.advance.amount.toFixed(1)} C (Gebuehr ${achse.advance.fee.toFixed(1)} C)` : ""),
    );
  }
  console.log("");
}

console.log(
  `Vorschuss = ${(SPONSOR_V4_ADVANCE_SHARE * 100).toFixed(0)} % des Leiterbodens, Gebuehr ` +
    `${(SPONSOR_V4_ADVANCE_FEE_RATE * 100).toFixed(0)} % — guenstiger als der billigste Kredit (7 %).`,
);
console.log("");
