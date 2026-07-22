/**
 * Sponsor — Standard-vs-Bonus / P4b-Vergleich (Headline-Deliverable)
 * ==================================================================
 * ZWECK (Owner-Vorgabe): EIN konkretes Worked-Example. Für EIN repräsentatives Mittelfeld-Team (Erwartungs-
 * rang ~14) wird pro Rarity ein Angebot unterschrieben und über die ECHTE Settlement-Leiter
 * (applySponsorSettlement / lockedRankPayoutLadder) an FIXEN Endrängen abgerechnet — NEU (P4b) neben
 * AKTUELL (bereits gemergte Logik). So sieht der Owner exakt, wie sich Zielerfüllung → Cash verändert und
 * wie Rarity den Modul-Mix (Basis-vs-Upside-Split) verschiebt. Anzeige == Settlement bleibt ehrlich, weil
 * die Zahlen aus dem Settlement-Pfad kommen, nicht aus Schätzungen.
 *
 * Ausführung:  npx tsx scripts/sponsor-standard-vs-bonus.ts
 *
 * Population/Fixtures identisch zum dryrun (createSingleplayerGameState + qualitäts-korreliertes Facility-Seed),
 * damit die Zahlen zur Liga-Kalibrierung passen.
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import type { GameState, SponsorCurveShape, SponsorOffer, SponsorRarity } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { buildLeagueTeamQualityRanks } from "@/lib/sponsor/sponsor-team-quality-rank";
import {
  buildSingleSponsorOfferForSim,
  chooseSponsorOffer,
} from "@/lib/sponsor/sponsor-offer-service";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { setSponsorP4bEnabled } from "@/lib/sponsor/sponsor-modules";
import { SPONSOR_CURVE_SHAPES, SPONSOR_RARITIES } from "@/lib/sponsor/sponsor-curve-shapes";
import type { FacilityId } from "@/lib/facilities/facility-catalog";

const FACILITY_IDS: FacilityId[] = [
  "training_center",
  "recovery_center",
  "scouting_office",
  "analytics_room",
  "fan_shop",
  "arena_upgrade",
  "academy",
  "specialist_wing",
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function round1(v: number) {
  return Number(v.toFixed(1));
}

/** Facility-Seed wie im dryrun, damit die Basis-Anker (4.-niedrigstes Gehalt + Unterhalt) identisch sind. */
function seedFacilities(gameState: GameState): GameState {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const qualityRanks = buildLeagueTeamQualityRanks(rows, gameState.seasonState.beliebtheitByTeamId);
  const teamFacilities: NonNullable<GameState["seasonState"]["teamFacilities"]> = {
    ...(gameState.seasonState.teamFacilities ?? {}),
  };
  const teamCount = Math.max(1, gameState.teams.length);
  for (const team of gameState.teams) {
    const pos = qualityRanks.get(team.teamId)?.leaguePosition ?? teamCount;
    const baseLevel = clamp(Math.round(5 - ((pos - 1) / (teamCount - 1)) * 4), 1, 5);
    const facilities: Record<string, { level: number; enabled: boolean; conditionPct: number }> = {};
    FACILITY_IDS.forEach((facilityId, index) => {
      const jitter = (index + pos) % 3 === 0 ? -1 : 0;
      facilities[facilityId] = { level: clamp(baseLevel + jitter, 1, 5), enabled: true, conditionPct: 100 };
    });
    teamFacilities[team.teamId] = { facilities: facilities as never };
  }
  return { ...gameState, seasonState: { ...gameState.seasonState, teamFacilities } };
}

function withStanding(gameState: GameState, teamId: string, finalRank: number, startRank: number): GameState {
  const standings = { ...(gameState.seasonState.standings ?? {}) };
  standings[teamId] = {
    ...(standings[teamId] ?? {}),
    rank: finalRank,
    startplatz: startRank,
    points: 100 - finalRank,
  } as never;
  return { ...gameState, seasonState: { ...gameState.seasonState, standings } };
}

function injectOffer(gameState: GameState, teamId: string, offer: SponsorOffer): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      sponsorOffersByTeamId: { ...(gameState.seasonState.sponsorOffersByTeamId ?? {}), [teamId]: [offer] },
      sponsorContractsByTeamId: {}, // sicherstellen: kein Alt-Vertrag blockiert
      sponsorPayoutLogs: [],
    },
  };
}

/** Rechnet ein Angebot über den ECHTEN Settlement-Pfad an einem fixen Endrang ab; liefert Cash je kind. */
function settle(
  base: GameState,
  teamId: string,
  offer: SponsorOffer,
  finalRank: number,
  startRank: number,
): { byKind: Record<string, number>; total: number } {
  let gs = withStanding(base, teamId, finalRank, startRank);
  gs = injectOffer(gs, teamId, offer);
  // deferBaseFirstPayout: true ⇒ Basis wird komplett am Saisonende gezahlt (voller Betrag im Preview).
  gs = chooseSponsorOffer({ gameState: gs, teamId, offerId: offer.offerId, deferBaseFirstPayout: true }).gameState;
  const preview = previewSponsorSettlement(gs, "season_end");
  const rows = preview.rows.filter((r) => r.teamId === teamId);
  const byKind: Record<string, number> = {};
  for (const r of rows) byKind[r.kind] = round1((byKind[r.kind] ?? 0) + r.cashDelta);
  const total = round1(rows.reduce((s, r) => s + r.cashDelta, 0));
  return { byKind, total };
}

function specialRewardSum(offer: SponsorOffer): number {
  return round1(offer.components.filter((c) => c.kind === "special").reduce((s, c) => s + c.rewardCash, 0));
}
function baseCashOf(offer: SponsorOffer): number {
  return offer.components.find((c) => c.kind === "base")?.rewardCash ?? 0;
}
function moduleSummary(offer: SponsorOffer): string {
  const cash = offer.components.map((c) => `${c.kind}${c.kind === "clause" ? `(−${c.penaltyCash})` : `(${c.rewardCash})`}`);
  return `${offer.components.length} Cash-Module: ${cash.join(" + ")}`;
}

function fmt(v: number, w = 8) {
  return String(round1(v)).padStart(w);
}
function padEnd(v: string, w: number) {
  return v.padEnd(w);
}

function main() {
  let gameState = createSingleplayerGameState();
  gameState = seedFacilities(gameState);

  const rows = buildTeamSeasonOverviewRows({ gameState });
  const qualityRanks = buildLeagueTeamQualityRanks(rows, gameState.seasonState.beliebtheitByTeamId);
  // Mittelfeld-Team wählen: qualityRank am nächsten an 14.
  let midTeamId = gameState.teams[0]!.teamId;
  let bestDelta = Infinity;
  for (const team of gameState.teams) {
    const qr = qualityRanks.get(team.teamId)?.qualityRank ?? 99;
    if (Math.abs(qr - 14) < bestDelta) {
      bestDelta = Math.abs(qr - 14);
      midTeamId = team.teamId;
    }
  }
  const midTeam = gameState.teams.find((t) => t.teamId === midTeamId)!;
  const expectedRank = qualityRanks.get(midTeamId)!.qualityRank;

  console.log("=".repeat(104));
  console.log(`SPONSOR P4b — Worked Example: ${midTeam.name} (${midTeam.shortCode}), Erwartungsrang #${expectedRank}`);
  console.log("Alle Zahlen aus dem ECHTEN Settlement-Pfad (lockedRankPayoutLadder + previewSponsorSettlement).");
  console.log("=".repeat(104));

  // Repräsentative Kurvenformen: "stetig" (Upside-Kontrast: rank/improvement/special/overperf) für den
  // Rarity-Split, "klassenerhalt" (sicherheit → Klausel-Modul) für das Klausel-/Abstiegs-Szenario.
  const upsideShape: SponsorCurveShape = "stetig";
  const safetyShape: SponsorCurveShape = "klassenerhalt";

  const rarities: SponsorRarity[] = ["gewöhnlich", "magisch", "selten", "legendär"];

  function buildOffer(rarity: SponsorRarity, curveShape: SponsorCurveShape, p4b: boolean): SponsorOffer {
    setSponsorP4bEnabled(p4b);
    const offer = buildSingleSponsorOfferForSim({ gameState, teamId: midTeamId, rarity, curveShape });
    setSponsorP4bEnabled(true);
    return offer!;
  }

  // ── Modul-Anzahl pro Rarity + Basis-vs-Upside-Split (P4b) ──────────────────────────────────────────
  console.log(`\n[A] Modul-Anzahl & Basis-Split — Kurvenform "${SPONSOR_CURVE_SHAPES[upsideShape].labelDe}" (P4b)`);
  console.log("-".repeat(104));
  console.log(`${padEnd("Rarity", 12)} Module   Zusammensetzung`);
  for (const rarity of rarities) {
    const offer = buildOffer(rarity, upsideShape, true);
    console.log(`${padEnd(SPONSOR_RARITIES[rarity].labelDe, 12)} ${String(offer.components.length).padStart(6)}   ${moduleSummary(offer)}`);
  }

  // ── Szenario-Leiter NEU (P4b) vs AKTUELL, pro Rarity ───────────────────────────────────────────────
  const scenarios = [
    { key: "standard", label: "nur Standard (Basis + Rang@#exp)" },
    { key: "special", label: "+ Sonderziel erfüllt" },
    { key: "overperf", label: "+ Überperformance (#exp−6)" },
    { key: "ceiling", label: "alles erreicht (Ceiling, #1)" },
  ] as const;

  for (const rarity of rarities) {
    const cur = buildOffer(rarity, upsideShape, false);
    const p4b = buildOffer(rarity, upsideShape, true);

    // Szenario-Cash je Logik.
    function ladder(offer: SponsorOffer) {
      const stdSettle = settle(gameState, midTeamId, offer, expectedRank, expectedRank);
      const standardOnly = round1((stdSettle.byKind.base ?? 0) + (stdSettle.byKind.rank ?? 0) + (stdSettle.byKind.clause ?? 0));
      const special = specialRewardSum(offer);
      const overSettle = settle(gameState, midTeamId, offer, Math.max(1, expectedRank - 6), expectedRank);
      const overNoSpecial = round1(
        (overSettle.byKind.base ?? 0) + (overSettle.byKind.rank ?? 0) + (overSettle.byKind.overperformance ?? 0) +
          (overSettle.byKind.improvement ?? 0) + (overSettle.byKind.clause ?? 0),
      );
      const ceilSettle = settle(gameState, midTeamId, offer, 1, 32);
      const ceilNoSpecial = round1(
        (ceilSettle.byKind.base ?? 0) + (ceilSettle.byKind.rank ?? 0) + (ceilSettle.byKind.overperformance ?? 0) +
          (ceilSettle.byKind.improvement ?? 0) + (ceilSettle.byKind.clause ?? 0),
      );
      // Honest full-EV (identische Definition für aktuell & P4b, damit die EV-Erhaltung sichtbar wird):
      // standard-only + attainment×Reward der Bonus-Module (Basis absorbiert bei P4b bereits die EV der
      // weggelassenen Module, daher kein Doppel-Zählen).
      const overperfReward = offer.components.find((c) => c.kind === "overperformance")?.rewardCash ?? 0;
      const improvementReward = offer.components.find((c) => c.kind === "improvement")?.rewardCash ?? 0;
      const fullEv = round1(standardOnly + 0.45 * special + 0.25 * overperfReward + 0.2 * improvementReward);
      return {
        standard: standardOnly,
        special: round1(standardOnly + special),
        overperf: overNoSpecial,
        ceiling: round1(ceilNoSpecial + special),
        base: baseCashOf(offer),
        fullEv,
      };
    }

    const curL = ladder(cur);
    const p4bL = ladder(p4b);
    console.log(`\n[B] Szenario-Leiter — ${SPONSOR_RARITIES[rarity].labelDe} · "${SPONSOR_CURVE_SHAPES[upsideShape].labelDe}"`);
    console.log(`    Basis: aktuell ${curL.base} → P4b ${p4bL.base}   |   full-EV: aktuell ${curL.fullEv} → P4b ${p4bL.fullEv}`);
    console.log("-".repeat(104));
    console.log(`    ${padEnd("Szenario", 36)} ${padEnd("Z=aktuell", 12)} ${padEnd("Y=P4b", 12)} ${padEnd("ΔY−Z", 10)}`);
    for (const s of scenarios) {
      const z = curL[s.key];
      const y = p4bL[s.key];
      console.log(`    ${padEnd(s.label, 36)} ${fmt(z, 12)} ${fmt(y, 12)} ${fmt(y - z, 10)}`);
    }
  }

  // ── Klausel-Demonstration (sicherheit-Familie, gewöhnlich): Abstiegs-Malus feuert nur in der Drop-Zone ─
  console.log(`\n[C] Klausel-Modul — gewöhnlich · "${SPONSOR_CURVE_SHAPES[safetyShape].labelDe}" (sicherheit)`);
  console.log("-".repeat(104));
  const clauseCur = buildOffer("gewöhnlich", safetyShape, false);
  const clauseP4b = buildOffer("gewöhnlich", safetyShape, true);
  console.log(`    aktuell: ${moduleSummary(clauseCur)}`);
  console.log(`    P4b:     ${moduleSummary(clauseP4b)}`);
  const safe = settle(gameState, midTeamId, clauseP4b, 20, 20); // Nicht-Drop-Zone
  const drop = settle(gameState, midTeamId, clauseP4b, 30, 20); // Drop-Zone
  console.log(`    P4b Settlement @#20 (kein Abstieg): total ${safe.total}  (clause ${safe.byKind.clause ?? 0})`);
  console.log(`    P4b Settlement @#30 (Abstiegszone):  total ${drop.total}  (clause ${drop.byKind.clause ?? 0})`);

  console.log("\n" + "=".repeat(104));
  console.log("Hinweis: 'Z=aktuell' = bereits gemergte P0–P5-Logik (OLY_SPONSOR_P4B=0), 'Y=P4b' = neue Komposition.");
  console.log("Liga-Sponsor-Summe (0..+5%-Band) siehe scripts/sponsor-economy-dryrun.ts (Fußnote).");
  console.log("=".repeat(104));
}

main();
