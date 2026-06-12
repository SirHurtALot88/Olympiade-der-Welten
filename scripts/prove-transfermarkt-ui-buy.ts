import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const baseUrl = process.env.OLY_BASE_URL ?? "http://localhost:3000";
const teamId = process.env.OLY_UI_BUY_TEAM_ID ?? "A-A";
const proofDir = path.join(process.cwd(), "tmp");
const proofJsonPath = path.join(proofDir, "transfermarkt-ui-buy-proof.json");
const proofScreenshotPath = path.join(proofDir, "transfermarkt-ui-buy-proof.png");

type BuyApiCapture = {
  url: string;
  status: number;
  requestBody: unknown;
  responseBody: unknown;
};

function getSaveSnapshot(saveId: string, targetTeamId: string) {
  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    throw new Error(`Save ${saveId} not found`);
  }

  const roster = save.gameState.rosters.filter((entry) => entry.teamId === targetTeamId);
  const team = save.gameState.teams.find((entry) => entry.teamId === targetTeamId);
  const playerById = new Map(save.gameState.players.map((entry) => [entry.id, entry] as const));
  const activeRosterPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const teamSalary = roster.reduce((sum, entry) => sum + (Number.isFinite(entry.salary) ? entry.salary : 0), 0);

  return {
    saveId,
    saveName: save.name,
    teamId: targetTeamId,
    teamName: team?.name ?? null,
    cash: team?.cash ?? null,
    rosterCount: roster.length,
    teamSalary,
    rosterPlayerIds: roster.map((entry) => entry.playerId),
    activeRosterPlayerIds: [...activeRosterPlayerIds],
    transferHistoryCount: save.gameState.transferHistory.length,
    transferHistory: save.gameState.transferHistory.map((entry) => ({
      id: entry.id,
      playerId: entry.playerId,
      playerName: playerById.get(entry.playerId)?.name ?? entry.playerId,
      type: entry.transferType,
      source: entry.source,
      toTeamId: entry.toTeamId,
      fromTeamId: entry.fromTeamId,
      fee: entry.fee,
      salary: entry.salary,
      seasonId: entry.seasonId,
    })),
  };
}

async function pickTeam(page: Page, targetTeamId: string) {
  const selected = await page.evaluate((teamId) => {
    const selects = Array.from(document.querySelectorAll("select"));
    const candidates = selects.filter((select) => Array.from(select.options).some((option) => option.value === teamId));
    const transfermarktTeamSelect =
      candidates.find((select) => Array.from(select.options).some((option) => option.textContent?.includes("Team waehlen"))) ??
      candidates.find((select) => Array.from(select.options).some((option) => option.textContent?.includes("·"))) ??
      candidates[0];

    if (!transfermarktTeamSelect) {
      return null;
    }

    transfermarktTeamSelect.value = teamId;
    transfermarktTeamSelect.dispatchEvent(new Event("input", { bubbles: true }));
    transfermarktTeamSelect.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      value: transfermarktTeamSelect.value,
      optionCount: transfermarktTeamSelect.options.length,
      text: transfermarktTeamSelect.textContent?.slice(0, 200) ?? "",
    };
  }, targetTeamId);

  await page.waitForTimeout(900);
  const hasEnabledBuy = await page
    .locator(".transfer-market-table-shell tbody tr .transfermarkt-inline-actions button", { hasText: "Buy" })
    .first()
    .isEnabled()
    .catch(() => false);

  if (hasEnabledBuy) {
    return;
  }

  throw new Error(
    `Team select for ${targetTeamId} was not usable in the visible Transfermarkt UI. Selected=${JSON.stringify(selected)} buyEnabled=${hasEnabledBuy}`,
  );
}

async function buyFromVisibleModal(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Kaufdialog" });
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  const dialogTextBeforeConfirm = await dialog.innerText();
  const confirm = dialog.getByRole("button", { name: /Kauf bestaetigen|Kauf bestätigen/ });
  if (await confirm.isDisabled()) {
    throw new Error(`Buy confirm is disabled. Dialog:\n${dialogTextBeforeConfirm}`);
  }
  await confirm.click();
  await dialog.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1_200);
  return dialogTextBeforeConfirm;
}

async function buyFirstVisibleRow(page: Page) {
  const buyButton = page
    .locator(".transfer-market-table-shell tbody tr .transfermarkt-inline-actions button")
    .filter({ hasText: /^Buy$/ })
    .first();
  await buyButton.waitFor({ state: "visible", timeout: 60_000 });
  const row = buyButton.locator("xpath=ancestor::tr[1]");
  const playerName = (await row.locator(".table-player-cell strong").first().textContent())?.trim() ?? "unknown";
  await buyButton.click();
  const dialogText = await buyFromVisibleModal(page);
  return { playerName, dialogText };
}

async function buyFirstVisibleWishlistEntry(page: Page) {
  const wishlistButton = page
    .locator(".transfer-market-table-shell tbody tr .transfermarkt-inline-actions button")
    .filter({ hasText: /^Merken$/ })
    .first();
  await wishlistButton.waitFor({ state: "visible", timeout: 60_000 });
  const row = wishlistButton.locator("xpath=ancestor::tr[1]");
  const playerName = (await row.locator(".table-player-cell strong").first().textContent())?.trim() ?? "unknown";
  await wishlistButton.click();
  await page.waitForTimeout(700);

  const wishlistCard = page.locator(".transfer-wishlist-card").filter({ hasText: playerName }).first();
  await wishlistCard.waitFor({ state: "visible", timeout: 15_000 });
  await wishlistCard.getByRole("button", { name: "Buy" }).click();
  const dialogText = await buyFromVisibleModal(page);
  return { playerName, dialogText };
}

function summarizePurchase(snapshot: ReturnType<typeof getSaveSnapshot>, transferId: string | null | undefined) {
  const transfer = transferId
    ? snapshot.transferHistory.find((entry) => entry.id === transferId)
    : null;
  const playerId = transfer?.playerId ?? null;
  return {
    transfer,
    playerInRoster: playerId ? snapshot.rosterPlayerIds.includes(playerId) : false,
    playerStillFreeAgent: playerId ? !snapshot.activeRosterPlayerIds.includes(playerId) : null,
  };
}

async function main() {
  fs.mkdirSync(proofDir, { recursive: true });

  const persistence = createPersistenceService();
  const previousActiveSaveId = persistence.getActiveSave()?.saveId ?? null;
  const save = persistence.createFreshSeasonOneSave({
    name: `UI Buy Proof ${new Date().toISOString()}`,
  });
  const saveId = save.saveId;
  const before = getSaveSnapshot(saveId, teamId);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1300 } });
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(90_000);
  const buyApiCaptures: BuyApiCapture[] = [];

  page.on("request", async (request) => {
    if (!request.url().includes("/api/transfermarkt/buy")) {
      return;
    }
    const capture: BuyApiCapture = {
      url: request.url(),
      status: 0,
      requestBody: request.postDataJSON?.() ?? request.postData(),
      responseBody: null,
    };
    buyApiCaptures.push(capture);
  });
  page.on("response", async (response) => {
    if (!response.url().includes("/api/transfermarkt/buy")) {
      return;
    }
    const capture = [...buyApiCaptures].reverse().find((entry) => entry.url === response.url() && entry.status === 0);
    if (!capture) {
      return;
    }
    capture.status = response.status();
    try {
      capture.responseBody = await response.json();
    } catch {
      capture.responseBody = await response.text().catch(() => null);
    }
  });

  let tableBuy: Awaited<ReturnType<typeof buyFirstVisibleRow>> | null = null;
  let wishlistBuy: Awaited<ReturnType<typeof buyFirstVisibleWishlistEntry>> | null = null;
  let after = before;

  try {
    await page.goto(`${baseUrl}/foundation?view=market&team=${encodeURIComponent(teamId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.getByRole("heading", { name: "Transfermarkt" }).waitFor({ state: "visible", timeout: 60_000 });
    await pickTeam(page, teamId);
    tableBuy = await buyFirstVisibleRow(page);

    await page.goto(`${baseUrl}/foundation?view=market&team=${encodeURIComponent(teamId)}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.getByRole("heading", { name: "Transfermarkt" }).waitFor({ state: "visible", timeout: 60_000 });
    await pickTeam(page, teamId);
    wishlistBuy = await buyFirstVisibleWishlistEntry(page);

    await page.screenshot({ path: proofScreenshotPath, fullPage: true });
    after = getSaveSnapshot(saveId, teamId);
  } finally {
    await browser.close().catch(() => undefined);
    if (previousActiveSaveId) {
      createPersistenceService().activateSave(previousActiveSaveId);
    }
  }
  const executeResponses = buyApiCaptures
    .map((capture) => {
      const body = capture.responseBody as { summary?: { transferCreated?: boolean; transferId?: string | null } } | null;
      const requestBody = capture.requestBody as { dryRun?: boolean } | null;
      return {
        ...capture,
        dryRun: requestBody?.dryRun !== false,
        transferCreated: body?.summary?.transferCreated ?? false,
        transferId: body?.summary?.transferId ?? null,
      };
    })
    .filter((capture) => !capture.dryRun);

  const result = {
    saveId,
    teamId,
    tableBuy,
    wishlistBuy,
    before,
    after,
    buyApiCaptures,
    executeProof: executeResponses.map((capture) => ({
      transferId: capture.transferId,
      transferCreated: capture.transferCreated,
      requestBody: capture.requestBody,
      responseScope: (capture.responseBody as { scope?: unknown } | null)?.scope ?? null,
      saveProof: summarizePurchase(after, capture.transferId),
    })),
    checks: {
      transferCreatedResponses: executeResponses.every((capture) => capture.transferCreated),
      rosterPlusTwo: after.rosterCount === before.rosterCount + executeResponses.length,
      historyPlusTwo: after.transferHistoryCount === before.transferHistoryCount + executeResponses.length,
      cashDecreased: after.cash != null && before.cash != null ? after.cash < before.cash : false,
      salaryIncreased: after.teamSalary > before.teamSalary,
      allTransfersInRoster: executeResponses.every((capture) => summarizePurchase(after, capture.transferId).playerInRoster),
      allExecuteResponsesSameSave: executeResponses.every((capture) => {
        const requestBody = capture.requestBody as { saveId?: string } | null;
        return requestBody?.saveId === saveId;
      }),
    },
    artifacts: {
      json: proofJsonPath,
      screenshot: proofScreenshotPath,
    },
  };

  fs.writeFileSync(proofJsonPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));

  if (!Object.values(result.checks).every(Boolean)) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
