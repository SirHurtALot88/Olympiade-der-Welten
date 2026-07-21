/* eslint-disable no-console */
// Drives the two-step human "Verhandeln" buy flow in the real UI:
//   candidate card → Deal öffnen → Schritt 1 "Verhandeln" (negotiateBuy) → Annahme → Schritt 2
//   "Kauf final abschließen" → Signed-Banner. Verifies Step 2 is gated behind a successful
//   negotiation (disabled + "Erst verhandeln" reason before Step 1). Requires the dev server on :3000.
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SAVE_ID = process.env.FLOW_SAVE ?? "fresh-season-1-1784625881771";
const TEAM_ID = process.env.FLOW_TEAM ?? "A-A";
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

async function dismissSeasonBriefing(page: Page) {
  const backdrop = page.getByTestId("season-briefing-backdrop");
  // The briefing mounts asynchronously on season entry — give it a moment to appear, then close it.
  await backdrop.first().waitFor({ state: "visible", timeout: 6_000 }).catch(() => {});
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await backdrop.count()) === 0 || !(await backdrop.first().isVisible().catch(() => false))) return;
    const done = page.getByRole("button", { name: /^Erledigt$/ });
    await done.first().waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
    await done.first().click({ timeout: 8_000, force: true }).catch(() => {});
    const gone = await backdrop.first().waitFor({ state: "hidden", timeout: 8_000 }).then(() => true).catch(() => false);
    if (gone) return;
  }
}

async function openView(page: Page) {
  const url = `${BASE}/foundation?view=marketV2&team=${TEAM_ID}&saveId=${SAVE_ID}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.getByTestId("foundation-sidebar").waitFor({ state: "visible", timeout: 90_000 });
  await dismissSeasonBriefing(page);
  // Deep-link may resolve to Home on cold start; click the Transfermarkt nav item like a human.
  const marketNav = page.getByTestId("foundation-nav-marketV2");
  await marketNav.waitFor({ state: "visible", timeout: 90_000 });
  await marketNav.click();
  await dismissSeasonBriefing(page);
  await page.getByTestId("transfer-candidate-card").first().waitFor({ state: "visible", timeout: 90_000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM_PATH });
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  const steps: string[] = [];
  const log = (s: string) => {
    steps.push(s);
    console.log(s);
  };
  let signed = false;
  let gateVerified = false;

  try {
    await openView(page);
    const cardCount = await page.getByTestId("transfer-candidate-card").count();
    log(`OK marktseite geladen — ${cardCount} Kandidaten-Karten sichtbar.`);

    const maxTries = Math.min(cardCount, 8);
    for (let i = 0; i < maxTries && !signed; i += 1) {
      // Re-open the market for each attempt (a rejected/aborted deal returns to the list).
      if (i > 0) await openView(page);
      const card = page.getByTestId("transfer-candidate-card").nth(i);
      await card.click(); // selects the candidate; the deal panel + open button render afterward
      const dealOpen = page.getByTestId("transfer-deal-open-button");
      try {
        await dealOpen.first().waitFor({ state: "visible", timeout: 8_000 });
      } catch {
        log(`SKIP Kandidat ${i}: kein "Deal öffnen"-Button (evtl. nicht kaufbar/kein Slot).`);
        continue;
      }
      await dealOpen.first().click();

      const offerPage = page.getByTestId("transfer-offer-page");
      await offerPage.waitFor({ state: "visible", timeout: 30_000 });

      const confirm = page.getByTestId("transfer-buy-confirm-button");
      await confirm.waitFor({ state: "visible", timeout: 30_000 });

      // Gate assertion (only needs to pass once): Step 2 disabled + "erst verhandeln" reason BEFORE Step 1.
      if (!gateVerified) {
        // let the preview settle
        await page.waitForTimeout(1500);
        const disabledBefore = await confirm.isDisabled();
        const reason = (await page.getByTestId("transfer-buy-disabled-reason").textContent().catch(() => "")) ?? "";
        if (disabledBefore && /verhandeln/i.test(reason)) {
          gateVerified = true;
          log(`OK Gate: "Kauf final abschließen" ist VOR dem Verhandeln gesperrt — Grund: „${reason.trim()}".`);
        } else {
          log(`INFO Gate-Check bei Kandidat ${i}: disabled=${disabledBefore} reason="${reason.trim()}" (Preview evtl. noch am Rechnen).`);
        }
      }

      // Step 1: Verhandeln (the primary button, matched by its label — it has no testid).
      const negotiate = page.getByRole("button", { name: /Schritt 1: Verhandeln|Annahme liegt vor|erneut verhandeln/i });
      await negotiate.waitFor({ state: "visible", timeout: 15_000 });
      if (await negotiate.isDisabled()) {
        log(`SKIP Kandidat ${i}: Verhandeln-Button gesperrt (kein kaufbarer Deal).`);
        continue;
      }
      await negotiate.click();

      // Wait for negotiation outcome: acceptance flips the button label to "Annahme liegt vor",
      // rejection shows the rejection banner.
      const accepted = page.getByRole("button", { name: /Annahme liegt vor/i });
      const rejected = page.getByTestId("transfer-buy-rejection-reason");
      const outcome = await Promise.race([
        accepted.waitFor({ state: "visible", timeout: 20_000 }).then(() => "accepted" as const).catch(() => null),
        rejected.waitFor({ state: "visible", timeout: 20_000 }).then(() => "rejected" as const).catch(() => null),
      ]);

      if (outcome === "rejected") {
        const msg = (await rejected.textContent().catch(() => "")) ?? "";
        log(`INFO Kandidat ${i}: Verhandlung abgelehnt — „${msg.trim().slice(0, 90)}". Nächster Kandidat.`);
        continue;
      }
      if (outcome !== "accepted") {
        log(`INFO Kandidat ${i}: kein klares Verhandlungsergebnis, nächster Kandidat.`);
        continue;
      }

      log(`OK Schritt 1 erfolgreich — Verhandlung angenommen ("Annahme liegt vor").`);

      // Step 2 must now be enabled.
      await page.waitForTimeout(500);
      const nowEnabled = !(await confirm.isDisabled());
      log(`${nowEnabled ? "OK" : "FAIL"} Schritt 2 nach Annahme ${nowEnabled ? "freigeschaltet" : "weiterhin gesperrt"}.`);
      if (!nowEnabled) continue;

      await confirm.click();
      const signedBanner = page.getByTestId("market-v2-buy-signed");
      await signedBanner.waitFor({ state: "visible", timeout: 30_000 });
      const bannerText = (await signedBanner.textContent().catch(() => "")) ?? "";
      log(`OK Schritt 2 erfolgreich — Signed-Banner: „${bannerText.replace(/\s+/g, " ").trim().slice(0, 120)}".`);
      signed = true;
    }

    const ok = signed && gateVerified;
    console.log(`\n===== NEGOTIATE-BUY-UI ${ok ? "OK" : signed ? "OK (Kauf ok, Gate-Assert nicht bestätigt)" : "FAIL"} =====`);
    if (!signed) process.exitCode = 1;
  } catch (err) {
    console.error("FAIL", err instanceof Error ? err.stack ?? err.message : String(err));
    await page.screenshot({ path: "/tmp/claude-0/-home-user-Olympiade-der-Welten/f6ea86eb-701a-5c1b-b8c7-92aa0885d601/scratchpad/negotiate-fail.png" }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
