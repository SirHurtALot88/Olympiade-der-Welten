import { describe, expect, it } from "vitest";

import {
  AI_MANAGER_WRITE_OWNERSHIP,
  buildAiManagerIntegrationContract,
} from "@/lib/ai/ai-manager-integration-contract";

const REQUIRED_MODULES = [
  "Team Doctrine",
  "Season Strategy",
  "Roster Blueprint",
  "Market Board",
  "Budget Buckets",
  "Training Plan",
  "Facility Plan",
  "Contract Plan",
  "Potential/Scouting",
  "Manager Memory",
  "Season Review",
  "Lifecycle Orchestrator",
  "Chunked Redraft",
  "AI Market",
  "Lineup AI",
];

const REQUIRED_PHASES = [
  "preseason_review",
  "preseason_strategy",
  "preseason_market",
  "preseason_facilities",
  "preseason_training_setup",
  "matchday_preparation",
  "matchday_resolve",
  "matchday_review",
  "midseason_check",
  "season_end_review",
  "postseason_management",
  "season_transition",
];

describe("ai manager integration contract", () => {
  it("defines every requested module with a clear interface", () => {
    const contract = buildAiManagerIntegrationContract();
    const modules = contract.modules.map((module) => module.module);

    expect(modules).toEqual(REQUIRED_MODULES);
    expect(contract.acceptance.allModulesHaveInterface).toBe(true);
    for (const module of contract.modules) {
      expect(module.inputs.length).toBeGreaterThan(0);
      expect(module.outputs.length).toBeGreaterThan(0);
      expect(module.sourceOfTruth.length).toBeGreaterThan(0);
      expect(module.phases.length).toBeGreaterThan(0);
    }
  });

  it("documents all requested data-flow chains", () => {
    const contract = buildAiManagerIntegrationContract();
    const flowIds = contract.dataFlows.map((flow) => flow.chainId);

    expect(flowIds).toContain("doctrine-strategy-blueprint-market-pick");
    expect(flowIds).toContain("budget-to-market-buildings-training");
    expect(flowIds).toContain("potential-to-market-training-development-renewal");
    expect(flowIds).toContain("season-review-memory-next-strategy");
    expect(flowIds).toContain("lifecycle-phase-to-allowed-writes");
    expect(flowIds).toContain("ai-apply-to-official-services");
    expect(flowIds).toContain("manager-plan-to-ui");
    expect(contract.acceptance.seasonReviewToNextStrategyExists).toBe(true);
  });

  it("locks write ownership to official services and blocks Manager-AI bypasses", () => {
    const domains = AI_MANAGER_WRITE_OWNERSHIP.map((entry) => entry.domain);

    expect(domains).toEqual(["Kaeufe", "Verkaeufe", "Gebaeude", "Training", "Lineups", "Seasonwechsel"]);
    expect(AI_MANAGER_WRITE_OWNERSHIP.every((entry) => entry.managerAiRole !== "read_only" || entry.forbiddenBypass.length > 0)).toBe(true);
    expect(AI_MANAGER_WRITE_OWNERSHIP.every((entry) => entry.forbiddenBypass.some((bypass) => bypass.includes("direct") || bypass.includes("bypass")))).toBe(true);
  });

  it("defines phase permissions, performance budgets and cache contracts for all lifecycle phases", () => {
    const contract = buildAiManagerIntegrationContract();
    const phases = contract.phasePermissions.map((phase) => phase.phase);

    expect(phases).toEqual(REQUIRED_PHASES);
    expect(contract.cacheContracts.map((cache) => cache.phase)).toEqual(REQUIRED_PHASES);
    expect(contract.acceptance.lifecyclePhasesClear).toBe(true);
    expect(contract.acceptance.cacheContractExists).toBe(true);
    for (const phase of contract.phasePermissions) {
      expect(phase.allowedActions.length).toBeGreaterThan(0);
      expect(phase.blockedActions.length).toBeGreaterThan(0);
      expect(phase.requiredInputs.length).toBeGreaterThan(0);
      expect(phase.producedOutputs.length).toBeGreaterThan(0);
      expect(phase.performanceBudget.targetMs).toBeGreaterThan(0);
      expect(phase.performanceBudget.hardCapMs).toBeGreaterThanOrEqual(phase.performanceBudget.targetMs);
    }
  });

  it("keeps heavy audit data out of normal UI load and exposes UI handoff fields", () => {
    const contract = buildAiManagerIntegrationContract();
    const uiFields = contract.uiContracts.map((row) => row.field);

    expect(uiFields).toContain("aktuelle AI-Phase");
    expect(uiFields).toContain("Manager Strategy");
    expect(uiFields).toContain("Roster Blueprint");
    expect(uiFields).toContain("warum spart/kauft/baut/trainiert ein Team");
    expect(contract.cacheContracts.every((cache) => cache.excludedFromNormalUiLoad.includes("debug/audit CSV rows"))).toBe(true);
  });

  it("passes all acceptance checks", () => {
    const contract = buildAiManagerIntegrationContract();

    expect(contract.acceptance).toEqual({
      allModulesHaveInterface: true,
      noDuplicateWriteLogic: true,
      managerAiBypassBlocked: true,
      lifecyclePhasesClear: true,
      seasonReviewToNextStrategyExists: true,
      cacheContractExists: true,
      remoteWritesForbidden: true,
    });
  });
});
