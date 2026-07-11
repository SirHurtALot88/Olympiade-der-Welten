/**
 * Showcase: Sponsor-Angebote pro Sterne-Tier (1–5) + Premium/Golden-Varianten.
 *
 * Usage: npx tsx scripts/sponsor-tier-showcase.ts
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import type { SponsorArchetype, SponsorStarTier } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildSponsorOffersForTeam } from "@/lib/sponsor/sponsor-offer-service";
import {
  buildOfferCashAmounts,
  buildMilestoneRankLabel,
  estimateExpectedPayout,
  getSponsorPayoutForFinalRankAndTier,
  getStarTierBaseMultiplier,
  getStarTierMilestoneMultiplier,
} from "@/lib/sponsor/sponsor-economy-calibration";
import {
  getSponsorBrandParentById,
  pickSponsorBrandForOffer,
} from "@/lib/sponsor/sponsor-brand-catalog";
import { pickVariantForParent } from "@/lib/sponsor/sponsor-brand-variants";
import { getDemandMultiplier } from "@/lib/sponsor/sponsor-tier-pool";

const ARCHETYPES: SponsorArchetype[] = ["security", "performance", "identity"];
const STAR_TIERS: SponsorStarTier[] = [1, 2, 3, 4, 5];

function pad(value: string | number, width: number) {
  return String(value).padStart(width);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function printOfferCard(input: {
  label: string;
  archetype: SponsorArchetype;
  starTier: SponsorStarTier;
  brandName: string;
  variantKey: string;
  flavor: string;
  salaryFactor: number;
  referenceRank: number;
}) {
  const cash = buildOfferCashAmounts({
    archetype: input.archetype,
    salaryFactor: input.salaryFactor,
    starTier: input.starTier,
  });
  const baseMult = getStarTierBaseMultiplier(input.starTier);
  const milestoneMult = getStarTierMilestoneMultiplier(input.starTier);
  const demandMult = getDemandMultiplier(input.starTier);
  const atRank32 = getSponsorPayoutForFinalRankAndTier(32, input.salaryFactor, input.starTier);
  const atRank28 = getSponsorPayoutForFinalRankAndTier(28, input.salaryFactor, input.starTier);
  const atRank1 = getSponsorPayoutForFinalRankAndTier(1, input.salaryFactor, input.starTier);

  console.log(`\n── ${input.label} ──`);
  console.log(`  Marke:     ${input.brandName}`);
  console.log(`  Variante:  ${input.variantKey.replace(/_/g, " ")}`);
  console.log(`  Archetyp:  ${input.archetype} · ★${input.starTier} · Stufen-Mult ×${milestoneMult.toFixed(2)} · Anspruch ×${demandMult.toFixed(2)}`);
  console.log(`  Flavor:    ${input.flavor.slice(0, 90)}${input.flavor.length > 90 ? "…" : ""}`);
  console.log(`  Basis:     ${cash.baseCash.toFixed(1)} C`);
  console.log(`  Stufen:    ${cash.rankCash.toFixed(1)} C (max)`);
  console.log(`  Sonder:    ${cash.specialCash.toFixed(1)} C`);
  console.log(`  Ziel-Rang: ${buildMilestoneRankLabel().slice(0, 72)}…`);
  console.log(`  Erwartung: Platz ${input.referenceRank} → ~${round1(atRank32)} C (32) / ~${round1(atRank28)} C (28) / ~${round1(atRank1)} C (Meister)`);
}

async function main() {
  const gs = createSingleplayerGameState();
  const team = gs.teams.find((entry) => entry.shortCode === "M-M") ?? gs.teams[0]!;
  const identity = gs.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
  const salaryFactor = gs.seasonState.seasonEconomyFactors?.[0]?.factor ?? 1.09;
  const referenceRank = 1;

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Sponsor-Tiers · M-M · Security/Performance/Identity         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`Salary Factor ×${salaryFactor} · Team ${team.name}\n`);

  console.log("=== Sterne-Tiers 1–5 (Performance · globaler Auto-Sponsor) ===");
  const autoParent = getSponsorBrandParentById("auto-motion") ?? getSponsorBrandParentById("golden-arches");
  for (const starTier of STAR_TIERS) {
    const variant =
      pickVariantForParent({
        parentId: autoParent?.id ?? "auto-motion",
        archetype: "performance",
        starTier,
        seasonId: gs.season.id,
        teamId: team.teamId,
        slotIndex: 1,
      }) ?? null;
    printOfferCard({
      label: `Performance ★${starTier}`,
      archetype: "performance",
      starTier,
      brandName: autoParent?.name ?? "Auto Motion",
      variantKey: variant?.variantKey ?? "performance_rank",
      flavor: variant?.flavor ?? "Leistungs-Paket",
      salaryFactor,
      referenceRank,
    });
  }

  console.log("\n\n=== Golden / Premium-Elite (5★ · global Food-Brand) ===");
  const goldenParent = getSponsorBrandParentById("golden-arches");
  if (goldenParent) {
    for (const archetype of ARCHETYPES) {
      const picked = pickSponsorBrandForOffer({
        seasonId: gs.season.id,
        teamId: team.teamId,
        team,
        identity,
        profile: null,
        archetype,
        starTier: 5,
        slotIndex: ARCHETYPES.indexOf(archetype),
      });
      const variant = pickVariantForParent({
        parentId: goldenParent.id,
        archetype,
        starTier: 5,
        seasonId: gs.season.id,
        teamId: team.teamId,
        slotIndex: ARCHETYPES.indexOf(archetype),
      });
      printOfferCard({
        label: `Golden Arches · ${archetype} · ★5`,
        archetype,
        starTier: 5,
        brandName: picked.parent.name,
        variantKey: variant?.variantKey ?? picked.brand.variantKey,
        flavor: picked.brand.flavor,
        salaryFactor,
        referenceRank,
      });
    }
  }

  console.log("\n\n=== Echte Saison-1-Angebote für M-M (aus Engine) ===");
  const offers = buildSponsorOffersForTeam({ gameState: gs, teamId: team.teamId });
  for (const offer of offers) {
    const expected = estimateExpectedPayout(offer, referenceRank);
    console.log(
      `\n  ${offer.archetype.toUpperCase()} · ★${offer.starTier} · ${offer.name}`,
    );
    console.log(`  Variante: ${offer.variantKey?.replace(/_/g, " ") ?? "—"} · EV ~${expected.toFixed(1)} C @ Platz ${referenceRank}`);
    for (const component of offer.components) {
      const value =
        typeof component.rewardCash === "number" ? `${component.rewardCash.toFixed(1)} C` : String(component.rewardCash);
      const shortLabel = component.label.length > 70 ? `${component.label.slice(0, 67)}…` : component.label;
      console.log(`    · ${shortLabel}: ${value}`);
    }
  }

  console.log("\nFertig.\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
