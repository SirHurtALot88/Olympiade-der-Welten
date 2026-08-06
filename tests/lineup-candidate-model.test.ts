/**
 * CHARAKTERISIERUNGSTEST fuer den Rechenkern der Einsatzliste, der aus
 * `app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx` nach
 * `lib/lineups/lineup-candidate-model.ts` und `lib/lineups/lineup-audit.ts` verschoben wurde
 * (reine `useMemo`-Koerper -> exportierte, parametrisierte Funktionen; die Komponente behaelt nur
 * noch duenne `useMemo`-Huellen, die dieselben Eingaben durchreichen).
 *
 * Haelt exakt das fest, was der Umbau nicht anfassen darf:
 *   - die Kandidaten-Reihenfolge je Slot (`slotCandidateSummaryByKey`, `teamdeckCandidateEntries`)
 *     — genau die Sortier-Regel, die entscheidet, wer beim Druecken von "1" im Teamdeck landet.
 *     Eine still veraenderte Regel wirft keine Exception, sie setzt nur einen anderen Spieler.
 *   - `slotIssuesByKey` und `lineupMiniAudit` — das Gate vor dem Speichern. Ein hier verlorenes
 *     Blocking-Item liesse eine ungueltige Aufstellung in einen Spieltag, der danach nicht mehr
 *     korrigierbar ist.
 *   - `matchdayPreviewCards` — die aggregierten Zahlen, auf denen Flow-Summary und Save-CTA
 *     aufbauen.
 *
 * Die Fixture (tests/fixtures/lineup-candidate-fixture.ts) ist bewusst klein, deckt aber gezielt
 * die Faelle ab, die beim Verschieben am leichtesten kaputtgehen: ein verletzter Spieler
 * (muss "Verletzt" statt generisch "blockiert" zeigen), ein Spieler mit erhoehter Fatigue
 * (muss in die "fatigue"-Gruppe fallen, nicht "instant"), ein offener Slot, eine erfuellte und
 * eine unerfuellte Forderung.
 *
 * Vorbild fuer den Fixture-Stil: tests/legacy-lineup-context-loader.test.ts (Loader in
 * lib/lineups/legacy-lineup-context-loader.ts) — hier wird der Kontext aus denselben Gruenden wie
 * dort direkt (nicht ueber eine Fake-DB) gebaut: der Rechenkern braucht nur die Form von
 * `LegacyLineupLoadedContext`, nicht die Prisma-Mechanik dahinter.
 *
 * Die erwarteten Werte in diesem Test stammen aus dem unveraenderten Verhalten: eine Cross-
 * Validierung waehrend der Entwicklung dieses Umbaus hat dieselbe Fixture parallel durch eine
 * woertliche Kopie der ORIGINALEN (noch nicht verschobenen) `useMemo`-Koerper laufen lassen und
 * byte-genaue Gleichheit mit den hier geprueften lib-Funktionen bestaetigt (matchdayRosterCards,
 * slotPreviewByKey, slotCandidateSummaryByKey, teamdeckCandidateEntries, slotIssuesByKey).
 */
import { describe, expect, it } from "vitest";

import { buildLegacyLineupEntriesFromSelections, buildLegacyLineupLabPlayerOptions, buildLegacyLineupLabSlots, findDuplicateActivePlayerSelections } from "@/lib/lineups/legacy-lineup-lab";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";

import {
  buildActiveSlotCandidateByActivePlayerId,
  buildMatchdayRosterCards,
  buildPlayerBestSlotSummaryByActivePlayerId,
  buildSlotCandidateSummaryByKey,
  buildSlotPreviewByKey,
  buildTeamdeckCandidateEntries,
  buildTeamdeckCandidateGroups,
} from "@/lib/lineups/lineup-candidate-model";
import {
  buildLineupFlowSummary,
  buildLineupMiniAudit,
  buildLineupSaveCta,
  buildMatchdayPreviewCards,
  buildSlotIssuesByKey,
  computeLineupReadyToSave,
} from "@/lib/lineups/lineup-audit";

import { buildFixture } from "./fixtures/lineup-candidate-fixture";

// ---------------------------------------------------------------------------
// Verdrahtung — bildet exakt nach, wie LegacyLineupLabClient.tsx die Eingaben fuer die
// verschobenen Funktionen zusammensetzt (slots/playerOptions ueber die echten, unveraenderten
// Builder aus lib/lineups/legacy-lineup-lab.ts; Rollen ueber resolveSlotRolesForDiscipline).
// ---------------------------------------------------------------------------

const fixture = buildFixture();
const { context, selections, captains, activeSlotKey } = fixture;
const typedContext = context as LegacyLineupLoadedContext;

const slots = buildLegacyLineupLabSlots(typedContext);
const playerOptions = buildLegacyLineupLabPlayerOptions(typedContext);
const disciplineWeightInfo = { d1: [], d2: [] };
const discipline1Label = typedContext.matchdayContract?.discipline1?.displayName ?? "D1";
const discipline2Label = typedContext.matchdayContract?.discipline2?.displayName ?? "D2";
const intensityBySide = { d1: "normal" as const, d2: "normal" as const };
const rivalryPressureByDiscipline: Record<string, number> = {};
const resolvedPreview = null;

const matchdayRosterCards = buildMatchdayRosterCards({
  playerRows: fixture.playerRows,
  selections,
  slots,
  discipline1Label,
  discipline2Label,
  disciplineWeightInfo,
});
const rosterCardByActivePlayerId = new Map(
  matchdayRosterCards.filter((player) => Boolean(player.activePlayerId)).map((player) => [player.activePlayerId as string, player]),
);
const slotRoleByKey = new Map(
  slots.map((slot) => {
    const d1Roles = resolveSlotRolesForDiscipline(
      typedContext.matchdayContract?.discipline1?.disciplineId ?? null,
      typedContext.matchdayContract?.discipline1?.displayName ?? null,
      typedContext.matchdayContract?.discipline1?.requiredPlayers ?? null,
    );
    const d2Roles = resolveSlotRolesForDiscipline(
      typedContext.matchdayContract?.discipline2?.disciplineId ?? null,
      typedContext.matchdayContract?.discipline2?.displayName ?? null,
      typedContext.matchdayContract?.discipline2?.requiredPlayers ?? null,
    );
    const role = slot.disciplineSide === "d1" ? d1Roles[slot.slotIndex] ?? null : d2Roles[slot.slotIndex] ?? null;
    return [slot.key, role] as const;
  }),
);
const captainSideByActivePlayerId = new Map<string, "d1" | "d2">();
if (captains.d1) captainSideByActivePlayerId.set(captains.d1, "d1");
if (captains.d2) captainSideByActivePlayerId.set(captains.d2, "d2");

const slotPreviewByKey = buildSlotPreviewByKey({
  slots,
  selections,
  playerOptions,
  rosterCardByActivePlayerId,
  resolvedPreview,
  slotRoleByKey,
  intensityBySide,
  context: typedContext,
  captains,
  rivalryPressureByDiscipline,
});
const slotCandidateSummaryByKey = buildSlotCandidateSummaryByKey({
  slots,
  selections,
  playerOptions,
  slotPreviewByKey,
  slotRoleByKey,
  rosterCardByActivePlayerId,
  captainSideByActivePlayerId,
  context: typedContext,
  intensityBySide,
  rivalryPressureByDiscipline,
});
const playerBestSlotSummaryByActivePlayerId = buildPlayerBestSlotSummaryByActivePlayerId({
  playerOptions,
  slots,
  rosterCardByActivePlayerId,
  slotRoleByKey,
  context: typedContext,
  intensityBySide,
  rivalryPressureByDiscipline,
  slotPreviewByKey,
});
const activeSlot = slots.find((slot) => slot.key === activeSlotKey) ?? null;
const activeSlotCandidateByActivePlayerId = buildActiveSlotCandidateByActivePlayerId({
  activeSlot,
  captainSideByActivePlayerId,
  context: typedContext,
  intensityBySide,
  playerOptions,
  rosterCardByActivePlayerId,
  slotPreviewByKey,
  slotRoleByKey,
  rivalryPressureByDiscipline,
});
const activeSlotCandidateSummary = activeSlot ? slotCandidateSummaryByKey.get(activeSlot.key) ?? null : null;
const teamdeckCandidateEntries = buildTeamdeckCandidateEntries({
  activeSlot,
  selections,
  activeSlotCandidateSummary,
  activeSlotCandidateByActivePlayerId,
  matchdayRosterCards,
  playerBestSlotSummaryByActivePlayerId,
  context: typedContext,
  focusedDisciplineSide: "d2",
  teamdeckFilterMode: "all",
  teamdeckSortMode: "top",
});
const teamdeckCandidateGroups = buildTeamdeckCandidateGroups({
  teamdeckCandidateEntries,
  showOnlyTopSlotCandidates: false,
  teamdeckFilterMode: "all",
});

const entries = buildLegacyLineupEntriesFromSelections({ slots, selections, playerOptions });
const duplicateSelections = findDuplicateActivePlayerSelections(selections);
const duplicateSelectionIds = new Set(duplicateSelections);
const allAvailablePlayersDeployed = (() => {
  const totalActive = typedContext.activePlayers?.length ?? 0;
  if (totalActive === 0) return false;
  const assignedIds = new Set(entries.map((entry) => entry.activePlayerId).filter(Boolean));
  return assignedIds.size >= totalActive;
})();

// Captain-Budget: Aria ist D1-Captain in diesem Draft, keine Vorbelastung aus der Saison.
const captainUsedBeforeCurrentDraft = 0;
const captainDraftUsedCount = 1; // nur d1 hat einen Captain gesetzt
const captainSeasonLimit = 3;
const captainSeasonUsedWithDraft = Math.min(captainSeasonLimit, captainUsedBeforeCurrentDraft + captainDraftUsedCount);
const captainBudgetExceeded = captainUsedBeforeCurrentDraft + captainDraftUsedCount > captainSeasonLimit;

const matchdayPreviewCards = buildMatchdayPreviewCards({
  resolvedPreview,
  slots,
  slotPreviewByKey,
  d1RequiredPlayers: typedContext.matchdayContract?.discipline1?.requiredPlayers ?? 0,
  d2RequiredPlayers: typedContext.matchdayContract?.discipline2?.requiredPlayers ?? 0,
  lineupMetaD1Selected: fixture.lineupMeta.d1Selected,
  lineupMetaD2Selected: fixture.lineupMeta.d2Selected,
});

const lineupReadyToSave = computeLineupReadyToSave({
  openSlots: matchdayPreviewCards.openSlots,
  allAvailablePlayersDeployed,
  duplicateSelectionsCount: duplicateSelections.length,
  captainBudgetExceeded,
  entriesCount: entries.length,
});

// Wie `lineupMoraleSummary` im Original (nicht Teil dieses Verschiebe-Schritts): aus dem
// flachen Forderungs-Ergebnis in der Fixture berechnet, nicht frei erfunden.
const flatMoraleDecisions = Array.from(fixture.moraleDecisionsByActivePlayerId.values()).flat();
const moraleAtRiskCount = flatMoraleDecisions.filter((decision) => !decision.fulfilled && decision.isRelevant).length;
const moraleNetDelta = Number(flatMoraleDecisions.reduce((sum, decision) => sum + decision.moraleDelta, 0).toFixed(1));

const lineupFlowSummary = buildLineupFlowSummary({
  activeSlot,
  captainBudgetExceeded,
  captainDraftUsedCount,
  captainSeasonLimit,
  captainUsedBeforeCurrentDraft,
  captains,
  d1RequiredPlayers: typedContext.matchdayContract?.discipline1?.requiredPlayers ?? 0,
  d2RequiredPlayers: typedContext.matchdayContract?.discipline2?.requiredPlayers ?? 0,
  hasDraft: false,
  duplicateSelectionsCount: duplicateSelections.length,
  lineupMetaD1Selected: fixture.lineupMeta.d1Selected,
  lineupMetaD2Selected: fixture.lineupMeta.d2Selected,
  moraleAtRiskCount,
  moraleNetDelta,
  lineupReadyToSave,
  openSlots: matchdayPreviewCards.openSlots,
});

// Wie `previewPanelWarnings` im Original: Basis-Warnungen (hier keine) + je Slot die
// projizierten Warnungen, dedupliziert.
const previewPanelWarnings = Array.from(new Set(Array.from(slotPreviewByKey.values()).flatMap((preview) => preview.projected.warnings)));

const missingSeasonFormCards = true; // context.formCards ist in der Fixture nicht gesetzt

const lineupMiniAudit = buildLineupMiniAudit({
  openSlots: matchdayPreviewCards.openSlots,
  allAvailablePlayersDeployed,
  selectedCount: lineupFlowSummary.selectedCount,
  totalRequired: lineupFlowSummary.totalRequired,
  duplicateSelectionsCount: duplicateSelections.length,
  captainBudgetExceeded,
  captainUsedBeforeCurrentDraft,
  captainDraftUsedCount,
  captainSeasonLimit,
  captains,
  d1Label: discipline1Label,
  d2Label: discipline2Label,
  captainSeasonUsedWithDraft,
  missingSeasonFormCards,
  moraleAtRiskCount,
  moraleNetDelta,
  previewWarningsCount: previewPanelWarnings.length,
});

const slotIssuesByKey = buildSlotIssuesByKey({
  slots,
  selections,
  playerOptions,
  rosterCardByActivePlayerId,
  slotPreviewByKey,
  duplicateSelectionIds,
  moraleDecisionsByActivePlayerId: fixture.moraleDecisionsByActivePlayerId,
  activeSlotKey,
});

const lineupSaveCta = buildLineupSaveCta({
  openSlots: matchdayPreviewCards.openSlots,
  allAvailablePlayersDeployed,
  captainBudgetExceeded,
  captainUsedBeforeCurrentDraft,
  captainDraftUsedCount,
  captainSeasonLimit,
  duplicateSelectionsCount: duplicateSelections.length,
  hasDraft: false,
  lineupReadyToSave,
  captains,
});

// ---------------------------------------------------------------------------
// Charakterisierung
// ---------------------------------------------------------------------------

describe("Rechenkern der Einsatzliste (lib/lineups/lineup-candidate-model.ts + lineup-audit.ts)", () => {
  it("matchdayRosterCards: Sortier-Reihenfolge (gesetzt vor Bank, dann Fit-Bucket, dann Top-Score)", () => {
    expect(matchdayRosterCards.map((player) => ({ id: player.activePlayerId, name: player.name, selectedSides: player.selectedSides, fitLane: player.fitLane }))).toEqual([
      { id: "active-1", name: "Aria Nox", selectedSides: ["d1"], fitLane: "d1" },
      { id: "active-2", name: "Bo Reyn", selectedSides: ["d1"], fitLane: "d1" },
      { id: "active-3", name: "Cato Vale", selectedSides: ["d2"], fitLane: "d2" },
      { id: "active-5", name: "Enzo Kade", selectedSides: [], fitLane: "flex" },
      { id: "active-4", name: "Dee Marsh", selectedSides: [], fitLane: "d2" },
      { id: "active-6", name: "Fia Rook", selectedSides: [], fitLane: "d2" },
    ]);
  });

  it("slotCandidateSummaryByKey: Kandidaten-Reihenfolge fuer den offenen Slot (Mini DM, Slot 2)", () => {
    const summary = slotCandidateSummaryByKey.get("mini-dm::d2::1");
    expect(summary?.currentProjected).toBeNull();
    // Fia (sauberer Fit, geringe Fatigue) VOR Enzo (aehnlicher Skill, aber hohe Fatigue drueckt den
    // projizierten Score). Cato ist in D2 schon gesetzt, Dee verletzt, Aria/Bo sind D1-Basiswert-los
    // fuer Mini DM (kein Score) — alle vier tauchen hier nicht als Top-3-Kandidat auf.
    expect(summary?.topCandidates.map((entry) => ({ id: entry.activePlayerId, name: entry.name, projectedScore: entry.projectedScore }))).toEqual([
      { id: "active-6", name: "Fia Rook", projectedScore: 55 },
      { id: "active-5", name: "Enzo Kade", projectedScore: 46 },
    ]);
    expect(summary?.topCandidates[1].warnings).toEqual(["Fatigue 72 kostet bereits 23% Leistung"]);
  });

  it("teamdeckCandidateEntries: Sortier-Regel, die entscheidet, wer beim Druecken von '1' landet", () => {
    // DER KERN dieses Tests: die exakte Reihenfolge + Gruppierung. Eine still veraenderte
    // Sortier-Regel hier wirft keine Exception — sie setzt nur einen anderen Spieler.
    expect(teamdeckCandidateEntries.map((entry) => ({ id: entry.player.activePlayerId, name: entry.player.name, groupKey: entry.groupKey, fitTier: entry.fitTier }))).toEqual([
      { id: "active-6", name: "Fia Rook", groupKey: "instant", fitTier: "best" },
      { id: "active-5", name: "Enzo Kade", groupKey: "fatigue", fitTier: "okay" },
      { id: "active-3", name: "Cato Vale", groupKey: "blocked", fitTier: "blocked" },
      { id: "active-4", name: "Dee Marsh", groupKey: "blocked", fitTier: "blocked" },
      { id: "active-2", name: "Bo Reyn", groupKey: "blocked", fitTier: "blocked" },
      { id: "active-1", name: "Aria Nox", groupKey: "blocked", fitTier: "blocked" },
    ]);
    // Verletzung muss als "Verletzt" erkennbar sein, nicht als generisches "blockiert"
    // (GEMELDET, siehe tests/lineup-injury-visibility.test.ts).
    const dee = teamdeckCandidateEntries.find((entry) => entry.player.activePlayerId === "active-4");
    expect(dee?.shortReason).toBe("Verletzt");
    expect(dee?.detail).toContain("Verletzt");
  });

  it("teamdeckCandidateGroups: fasst dieselbe Reihenfolge nur gruppiert zusammen", () => {
    expect(teamdeckCandidateGroups.map((group) => group.key)).toEqual(["instant", "fatigue", "blocked"]);
    expect(teamdeckCandidateGroups.flatMap((group) => group.entries.map((entry) => entry.player.activePlayerId))).toEqual(
      teamdeckCandidateEntries.map((entry) => entry.player.activePlayerId),
    );
  });

  it("slotIssuesByKey: offener Slot blockiert, erfuellte/unerfuellte Forderungen zeigen sich am richtigen Slot", () => {
    expect(Object.fromEntries(slotIssuesByKey)).toEqual({
      "tdm::d1::0": [{ tone: "ready", label: "Forderung erfüllt", detail: "Aria Nox: Captain-Rolle (+4,0 Moral)" }],
      "tdm::d1::1": [],
      "mini-dm::d2::0": [],
      "mini-dm::d2::1": [
        { tone: "blocked", label: "Hier weiter", detail: "D2-2 wartet noch auf einen Spieler." },
        { tone: "warning", label: "Hinweis", detail: "Projected Range ohne Base Score nicht möglich" },
      ],
    });
  });

  it("matchdayPreviewCards: ein offener Slot, Risiko hoch", () => {
    expect(matchdayPreviewCards.openSlots).toBe(1);
    expect(matchdayPreviewCards.riskLevel).toBe("hoch");
    expect(matchdayPreviewCards.d1Projected).toBeCloseTo(158.8, 5);
    expect(matchdayPreviewCards.d2Projected).toBeCloseTo(76.3, 5);
  });

  it("lineupMiniAudit: gatet das Speichern — der offene Slot ist ein Blocking-Item", () => {
    expect(lineupMiniAudit.status).toBe("blocked");
    expect(lineupMiniAudit.blockingItems).toEqual([{ key: "open-slots", label: "Slots", detail: "1 offen", tone: "blocked" }]);
    expect(lineupMiniAudit.items.map((item) => item.key)).toEqual(["open-slots", "captain", "form-source", "morale", "preview"]);
  });

  it("lineupReadyToSave/lineupSaveCta: nicht speicherbereit, solange der Slot offen ist", () => {
    expect(lineupReadyToSave).toBe(false);
    expect(lineupSaveCta.tone).toBe("warning");
    expect(lineupSaveCta.detail).toContain("Slot");
  });
});
