const { test, expect } = require("@playwright/test");

const BASE_URL = "http://localhost:3000";
const SQLITE_SOURCE = "sqlite";
const STEP_TIMEOUT_MS = 15000;
const POLL_TIMEOUT_MS = 20000;

async function apiJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function loadActiveSave() {
  const body = await apiJson("/api/singleplayer-state");
  return body.save;
}

async function persistSave(save) {
  return apiJson("/api/singleplayer-state", {
    method: "PUT",
    body: JSON.stringify({
      saveId: save.saveId,
      gameState: save.gameState,
    }),
  });
}

function getTeamSnapshot(save, teamId) {
  const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) {
    throw new Error(`Team ${teamId} missing in active save ${save.saveId}.`);
  }

  const rosterEntries = save.gameState.rosters.filter((entry) => entry.teamId === teamId);
  const playerById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const salaryTotal = rosterEntries.reduce((sum, entry) => sum + (entry.salary ?? 0), 0);
  const marketValueTotal = rosterEntries.reduce((sum, entry) => {
    const player = playerById.get(entry.playerId);
    return sum + (player?.marketValue ?? 0);
  }, 0);

  return {
    teamId,
    teamName: team.name,
    cash: team.cash,
    budget: team.budget,
    rosterCount: rosterEntries.length,
    salaryTotal,
    marketValueTotal,
  };
}

function combinations(items, count) {
  if (count === 0) return [[]];
  if (items.length < count) return [];

  const result = [];
  for (let index = 0; index <= items.length - count; index += 1) {
    const head = items[index];
    const tails = combinations(items.slice(index + 1), count - 1);
    for (const tail of tails) {
      result.push([head, ...tail]);
    }
  }
  return result;
}

function sumScores(entries) {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
}

function buildEntriesForSide({ disciplineId, disciplineSide, candidates }) {
  return candidates.map((candidate, index) => ({
    disciplineId,
    disciplineSide,
    slotIndex: index,
    playerId: candidate.playerId,
    activePlayerId: candidate.activePlayerId,
    isCaptain: index === 0,
  }));
}

function selectBestDisjointLineup({ d1PlayerCount, d2PlayerCount, d1Candidates, d2Candidates }) {
  const d1Combos = combinations(d1Candidates, d1PlayerCount);
  const d2Combos = combinations(d2Candidates, d2PlayerCount);
  let best = null;

  for (const d1 of d1Combos) {
    const used = new Set(d1.map((entry) => entry.activePlayerId));
    for (const d2 of d2Combos) {
      if (d2.some((entry) => used.has(entry.activePlayerId))) continue;
      const total = sumScores(d1) + sumScores(d2);
      if (!best || total > best.total) {
        best = { d1, d2, total };
      }
    }
  }

  return best;
}

async function seedReadyLineupsForActiveSave(save) {
  const seasonId = save.gameState.season.id;
  const matchdayId = save.gameState.matchdayState.matchdayId;
  const errors = [];

  for (const team of save.gameState.teams) {
    const query = new URLSearchParams({
      saveId: save.saveId,
      seasonId,
      matchdayId,
      teamId: team.teamId,
      source: SQLITE_SOURCE,
    });
    const contextPayload = await apiJson(`/api/lineups/legacy/lab-context?${query.toString()}`);
    const context = contextPayload.context;
    const d1 = context?.matchdayContract?.discipline1;
    const d2 = context?.matchdayContract?.discipline2;

    if (!context || !d1 || !d2 || !d1.requiredPlayers || !d2.requiredPlayers) {
      errors.push(`${team.teamId}: missing_matchday_contract`);
      continue;
    }

    const scoreMap = new Map(
      context.disciplineScores.map((score) => [`${score.playerId}::${score.disciplineId}`, score.score]),
    );

    const d1Candidates = context.activePlayers
      .map((player) => ({
        activePlayerId: player.id,
        playerId: player.playerId,
        score: scoreMap.get(`${player.playerId}::${d1.disciplineId}`),
      }))
      .filter((entry) => typeof entry.score === "number")
      .sort((left, right) => right.score - left.score);

    const d2Candidates = context.activePlayers
      .map((player) => ({
        activePlayerId: player.id,
        playerId: player.playerId,
        score: scoreMap.get(`${player.playerId}::${d2.disciplineId}`),
      }))
      .filter((entry) => typeof entry.score === "number")
      .sort((left, right) => right.score - left.score);

    const best = selectBestDisjointLineup({
      d1PlayerCount: d1.requiredPlayers,
      d2PlayerCount: d2.requiredPlayers,
      d1Candidates,
      d2Candidates,
    });

    if (!best) {
      errors.push(`${team.teamId}: no_disjoint_lineup`);
      continue;
    }

    const entries = [
      ...buildEntriesForSide({ disciplineId: d1.disciplineId, disciplineSide: "d1", candidates: best.d1 }),
      ...buildEntriesForSide({ disciplineId: d2.disciplineId, disciplineSide: "d2", candidates: best.d2 }),
    ];

    await apiJson(`/api/lineups/legacy?${query.toString()}`, {
      method: "PUT",
      body: JSON.stringify({ entries }),
    });
  }

  if (errors.length > 0) {
    throw new Error(`Lineup seed failed: ${errors.join(" | ")}`);
  }
}

async function topUpRostersForLineups(save) {
  const seasonId = save.gameState.season.id;
  const matchdayId = save.gameState.matchdayState.matchdayId;
  const sampleTeamId = save.gameState.teams[0]?.teamId;
  if (!sampleTeamId) {
    throw new Error(`Save ${save.saveId} has no teams for lineup top-up.`);
  }

  const query = new URLSearchParams({
    saveId: save.saveId,
    seasonId,
    matchdayId,
    teamId: sampleTeamId,
    source: SQLITE_SOURCE,
  });
  const sampleContextPayload = await apiJson(`/api/lineups/legacy/lab-context?${query.toString()}`);
  const d1 = sampleContextPayload.context?.matchdayContract?.discipline1;
  const d2 = sampleContextPayload.context?.matchdayContract?.discipline2;
  const requiredUniquePlayers = (d1?.requiredPlayers ?? 0) + (d2?.requiredPlayers ?? 0);

  if (requiredUniquePlayers <= 0) {
    return save;
  }

  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayerPool = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const rosterEntries = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - rosterEntries.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayerPool[poolIndex];
      if (!player) {
        throw new Error(`Save ${save.saveId} could not be topped up with enough players.`);
      }
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `ui-playtest-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(player.salaryDemand),
        upkeep: Math.round(player.salaryDemand),
        purchasePrice: Math.round(player.marketValue),
        currentValue: Math.round(player.marketValue),
        roleTag: "bench",
        joinedSeasonId: seasonId,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) {
    await persistSave(save);
    return loadActiveSave();
  }

  return save;
}

async function runDryRunAndApply(page, sectionHeading, applyButtonName) {
  const section = page.locator("article").filter({
    has: page.getByRole("heading", { name: sectionHeading }),
  });

  console.log(`[ui-cockpit] section ${sectionHeading}: dry run start`);
  await expect(section).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  const dryRunButton = section.getByRole("button", { name: /DryRun/ });
  await expect(dryRunButton).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  await expect(dryRunButton).toBeEnabled({ timeout: STEP_TIMEOUT_MS });
  await dryRunButton.click({ timeout: STEP_TIMEOUT_MS });
  if (applyButtonName === "Matchday abschliessen") {
    await page.waitForTimeout(400);
  } else {
    await expect.poll(async () => {
      const text = await section.textContent();
      return text?.includes("Audit:") || text?.includes("Geplante Writes:") || text?.includes("Planned Changes:");
    }, { timeout: POLL_TIMEOUT_MS }).toBeTruthy();
  }

  const applyButton = section.getByRole("button", { name: applyButtonName });
  await expect(applyButton).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  await expect(applyButton).toBeEnabled({ timeout: STEP_TIMEOUT_MS });
  console.log(`[ui-cockpit] section ${sectionHeading}: apply ${applyButtonName}`);
  await applyButton.click({ timeout: STEP_TIMEOUT_MS });
}

test("local cockpit flow is playable through the UI", async ({ page }) => {
  test.setTimeout(180000);
  page.on("dialog", (dialog) => dialog.accept());
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(STEP_TIMEOUT_MS);

  console.log("[ui-cockpit] open cockpit");
  await page.goto(`${BASE_URL}/foundation?view=cockpit`);
  await expect(page.getByTestId("foundation-cockpit")).toBeVisible({ timeout: STEP_TIMEOUT_MS });

  const initialSave = await loadActiveSave();

  const freshSection = page.getByTestId("cockpit-step-fresh-season");
  console.log("[ui-cockpit] start fresh season");
  await freshSection.getByTestId("cockpit-fresh-season-start").click({ timeout: STEP_TIMEOUT_MS });

  let freshSave = null;
  await expect.poll(async () => {
    const save = await loadActiveSave();
    freshSave = save;
    return save.saveId !== initialSave.saveId;
  }, { timeout: POLL_TIMEOUT_MS }).toBeTruthy();

  expect(freshSave.gameState.teams).toHaveLength(32);
  expect(
    freshSave.gameState.teams.every((team) => Number(team.cash.toFixed(2)) === Number(team.budget.toFixed(2))),
  ).toBe(true);
  expect(
    Object.values(freshSave.gameState.seasonState.standings ?? {}).every((entry) => (entry?.points ?? 0) === 0),
  ).toBe(true);

  console.log("[ui-cockpit] open season view");
  await page.getByTestId("foundation-nav-season").click({ timeout: STEP_TIMEOUT_MS });
  await expect(page).toHaveURL(/view=season/);
  await expect(page.locator(".season-standings-table tbody tr")).toHaveCount(32, { timeout: STEP_TIMEOUT_MS });

  console.log("[ui-cockpit] open market view");
  await page.goto(`${BASE_URL}/foundation?view=market`);
  await expect(page).toHaveURL(/view=market/);
  const marketSection = page.getByTestId("transfer-market");

  const teamSelect = marketSection.getByTestId("transfer-market-team-select");
  const teamOptionValue = await teamSelect.locator("option").nth(1).getAttribute("value");
  expect(teamOptionValue).toBeTruthy();
  await teamSelect.selectOption(teamOptionValue);
  await expect.poll(
    async () => marketSection.getByTestId("transfer-buy-open-button").count(),
    { timeout: POLL_TIMEOUT_MS },
  ).toBeGreaterThan(0);

  const saveBeforeBuy = await loadActiveSave();
  const teamBeforeBuy = getTeamSnapshot(saveBeforeBuy, teamOptionValue);
  const freeAgentsBeforeBuy = await apiJson(
    `/api/transfermarkt/free-agents?${new URLSearchParams({
      saveId: saveBeforeBuy.saveId,
      seasonId: saveBeforeBuy.gameState.season.id,
      teamId: teamOptionValue,
      source: SQLITE_SOURCE,
    }).toString()}`,
  );
  expect(freeAgentsBeforeBuy.items.length).toBeGreaterThan(0);

  console.log("[ui-cockpit] buy dialog");
  await marketSection.getByTestId("transfer-buy-open-button").first().click();
  const buyDialog = page.getByRole("dialog", { name: "Kaufdialog" });
  await expect(buyDialog).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  const chosenPlayerName = (await buyDialog.locator(".transfer-modal-player-head strong").first().innerText()).trim();
  expect(chosenPlayerName.length).toBeGreaterThan(0);
  await expect(buyDialog.getByTestId("transfer-buy-confirm")).toBeEnabled({ timeout: STEP_TIMEOUT_MS });
  console.log("[ui-cockpit] confirm buy");
  await buyDialog.getByTestId("transfer-buy-confirm").click({ timeout: STEP_TIMEOUT_MS });

  await expect.poll(async () => {
    const save = await loadActiveSave();
    return getTeamSnapshot(save, teamOptionValue).rosterCount;
  }, { timeout: POLL_TIMEOUT_MS }).toBe(teamBeforeBuy.rosterCount + 1);

  const saveAfterBuy = await loadActiveSave();
  const teamAfterBuy = getTeamSnapshot(saveAfterBuy, teamOptionValue);
  expect(teamAfterBuy.cash).toBeLessThan(teamBeforeBuy.cash);
  expect(teamAfterBuy.salaryTotal).toBeGreaterThan(teamBeforeBuy.salaryTotal);
  expect(teamAfterBuy.marketValueTotal).toBeGreaterThan(teamBeforeBuy.marketValueTotal);

  const freeAgentsAfterBuy = await apiJson(
    `/api/transfermarkt/free-agents?${new URLSearchParams({
      saveId: saveAfterBuy.saveId,
      seasonId: saveAfterBuy.gameState.season.id,
      teamId: teamOptionValue,
      source: SQLITE_SOURCE,
    }).toString()}`,
  );
  expect(freeAgentsAfterBuy.items.some((item) => item.name === chosenPlayerName)).toBe(false);

  console.log("[ui-cockpit] open lineup view");
  await page.goto(`${BASE_URL}/foundation?view=lineup`);
  await expect(page).toHaveURL(/view=lineup/);
  const lineupSection = page.getByTestId("foundation-lineup");
  await expect(lineupSection.getByRole("heading", { name: "Einsatzliste" }).first()).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  await expect(lineupSection.getByRole("button", { name: "Lineup speichern" })).toBeVisible({ timeout: STEP_TIMEOUT_MS });

  console.log("[ui-cockpit] seed lineups");
  const toppedUpSave = await topUpRostersForLineups(saveAfterBuy);
  await seedReadyLineupsForActiveSave(toppedUpSave);

  console.log("[ui-cockpit] back to cockpit");
  await page.goto(`${BASE_URL}/foundation?view=cockpit`);
  await expect(page).toHaveURL(/view=cockpit/);
  await expect(page.getByTestId("foundation-cockpit")).toBeVisible({ timeout: STEP_TIMEOUT_MS });

  const resolveSection = page.locator("article").filter({
    has: page.getByRole("heading", { name: "5. Resolve Preview" }),
  });
  console.log("[ui-cockpit] resolve preview");
  await resolveSection.getByRole("button", { name: "Resolve Preview berechnen" }).click({ timeout: STEP_TIMEOUT_MS });
  await expect.poll(async () => {
    const text = await resolveSection.textContent();
    return text?.includes("Resolve Preview ist bereit") || text?.includes("Status: ready");
  }, { timeout: POLL_TIMEOUT_MS }).toBeTruthy();

  await runDryRunAndApply(page, "6. Result Apply", "Result lokal anwenden");
  await expect.poll(async () => {
    const save = await loadActiveSave();
    return save.gameState.seasonState.matchdayResults?.length ?? 0;
  }, { timeout: POLL_TIMEOUT_MS }).toBeGreaterThan(0);

  const standingsPreviewSection = page.locator("article").filter({
    has: page.getByRole("heading", { name: "7. Standings Preview" }),
  });
  console.log("[ui-cockpit] standings preview");
  await standingsPreviewSection.getByRole("button", { name: "Standings Preview laden" }).click({ timeout: STEP_TIMEOUT_MS });
  await expect.poll(async () => {
    const text = await standingsPreviewSection.textContent();
    return text?.includes("Ready Teams:");
  }, { timeout: POLL_TIMEOUT_MS }).toBeTruthy();

  await runDryRunAndApply(page, "8. Standings Apply", "Standings lokal anwenden");
  await expect.poll(async () => {
    const save = await loadActiveSave();
    return save.gameState.seasonState.standingsApplyLogs?.length ?? 0;
  }, { timeout: POLL_TIMEOUT_MS }).toBeGreaterThan(0);

  const prizePreviewSection = page.locator("article").filter({
    has: page.getByRole("heading", { name: "9. Preisgeld Preview" }),
  });
  console.log("[ui-cockpit] prize preview");
  await prizePreviewSection.getByRole("button", { name: "Preisgeld Preview laden" }).click({ timeout: STEP_TIMEOUT_MS });
  await expect.poll(async () => {
    const text = await prizePreviewSection.textContent();
    return text?.includes("Berechenbar:");
  }, { timeout: POLL_TIMEOUT_MS }).toBeTruthy();

  await runDryRunAndApply(page, "10. Cash Apply", "Cash lokal anwenden");
  await expect.poll(async () => {
    const save = await loadActiveSave();
    return save.gameState.seasonState.cashPrizeApplyLogs?.length ?? 0;
  }, { timeout: POLL_TIMEOUT_MS }).toBeGreaterThan(0);

  await runDryRunAndApply(page, "11. Abschlussstatus Spieltag", "Matchday abschliessen");
  await expect.poll(async () => {
    const save = await loadActiveSave();
    return save.gameState.matchdayState.matchdayId;
  }, { timeout: POLL_TIMEOUT_MS }).toBe("matchday-2");

  const advancedSave = await loadActiveSave();
  expect(advancedSave.gameState.matchdayState.matchdayId).toBe("matchday-2");
  await expect(page.locator("#foundation-cockpit").getByText("Spieltag 2", { exact: false }).first()).toBeVisible({ timeout: STEP_TIMEOUT_MS });
  console.log("[ui-cockpit] test finished");
});
