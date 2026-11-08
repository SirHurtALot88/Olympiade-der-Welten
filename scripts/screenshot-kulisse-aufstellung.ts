// ===================================================================================
// SICHTPROBE OBERFLAECHEN-EFFEKTE IN DER AUFSTELLUNG (08.11., lib/lineups/lineup-kulisse.ts).
//
// Baut einen frischen Battle-Save (derselbe Wizard-Pfad wie scripts/screenshot-mini-dm-pod-
// spieltage.ts), spielt per Auto-Run bis VOR den ersten Tennis-Spieltag der Saison, startet den
// Dev-Server gegen genau diese SQLite und screenshottet die Einsatzliste: die Kulissen-Zeile am
// Tennis-Block und die Chips "Sand ++" / "Rasen -" an gesetzten Spielern und Kandidaten.
// Native title-Tooltips erscheinen in keinem Screenshot -- der Tooltip-Text eines Chips wird
// deshalb zusaetzlich als Einblendung ins Bild gelegt und auf der Konsole ausgegeben.
//
// AUFRUF: OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npx tsx scripts/screenshot-kulisse-aufstellung.ts
// ===================================================================================
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium, type Browser, type Page } from "@playwright/test";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { buildLineupKulisseAnzeige } from "@/lib/lineups/lineup-kulisse";

const PORT = process.env.PORT ?? "3123";
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "kulisse-aufstellung");
const SQLITE_PATH = path.join(process.cwd(), "tmp-kulisse-aufstellung.sqlite");
const DISZIPLIN = process.argv[2] ?? "tennis";
const MAX_SPIELTAGE = 30;

async function baueSaveVorTennis() {
  process.env.OLY_APP_SQLITE_PATH = SQLITE_PATH;
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: "[screenshot-kulisse]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  const teamId = nachDraft.gameState.teams[0]!.teamId;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const schedule = getSeasonDisciplineSchedule(persistence.getSaveById(saveId)!.gameState);
  const eintrag = schedule.find(
    (e) => e.discipline1?.disciplineId === DISZIPLIN || e.discipline2?.disciplineId === DISZIPLIN,
  );
  if (!eintrag) throw new Error(`Kein ${DISZIPLIN}-Spieltag in dieser Saison.`);
  const seite = eintrag.discipline1?.disciplineId === DISZIPLIN ? "d1" : "d2";
  console.log(`[screenshot-kulisse] ${DISZIPLIN}-Spieltag: ${eintrag.matchdayId} (${seite})`);

  for (let i = 0; i < MAX_SPIELTAGE; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    if (matchdayId === eintrag.matchdayId) break;
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
      },
      persistence,
    );
    if (!lauf.ok) throw new Error(`${matchdayId} autoRun blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!adv.ok || !adv.applied) throw new Error(`Spieltagswechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
    console.log(`[screenshot-kulisse] ${matchdayId} gespielt`);
  }
  const gs = persistence.getSaveById(saveId)!.gameState;
  // Das Team mit dem deutlichsten Platz-Spezialisten zeigen (wenn moeglich ein "++"), nicht
  // einfach das erste -- die Variante haengt an der Begegnung, ein Spieltag zeigt mehrere Plaetze.
  const kandidaten = gs.teams.map((t) => ({
    teamId: t.teamId,
    anzeige: buildLineupKulisseAnzeige({
      gameState: gs, saveId, seasonId: gs.season.id, matchdayId: gs.matchdayState.matchdayId, teamId: t.teamId, disciplineId: DISZIPLIN,
    }),
  })).filter((k) => k.anzeige);
  const staerke = (k: (typeof kandidaten)[number]) => Math.max(0, ...Object.values(k.anzeige!.spieler).map((s) => s.ow));
  kandidaten.sort((a, b) => staerke(b) - staerke(a));
  const wahl = kandidaten[0] ?? { teamId, anzeige: null };
  for (const k of kandidaten.slice(0, 5)) {
    console.log(`[screenshot-kulisse] ${k.teamId}: ${k.anzeige!.label}, Tendenzen ${Object.values(k.anzeige!.spieler).map((s) => s.tendenz).join(" ")}`);
  }
  console.log(`[screenshot-kulisse] Gezeigt: ${wahl.teamId} (${wahl.anzeige?.label ?? "keine Kulisse"})`);
  return { saveId, teamId: wahl.teamId, seite };
}

function startDevServer(): ChildProcessWithoutNullStreams {
  const child = spawn("npm", ["run", "dev"], {
    env: { ...process.env, OLY_APP_SQLITE_PATH: SQLITE_PATH, PORT, OLY_AUTO_EXPORT_SAVES: "0", OLY_AUTO_EXPORT_PUSH: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => undefined);
  child.stderr.on("data", (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return child;
}

async function waitForServer(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE_URL}/foundation`, { cache: "no-store" });
      if (r.status < 500) return;
    } catch {
      // weiter warten
    }
    await delay(2000);
  }
  throw new Error("Dev-Server nicht erreichbar.");
}

async function dismissOverlays(page: Page) {
  for (const name of [/^Erledigt$/, /^Später$/, /^Schließen$/]) {
    const b = page.getByRole("button", { name });
    if (await b.first().isVisible().catch(() => false)) await b.first().click().catch(() => undefined);
  }
  await page.waitForTimeout(400);
}

async function zeigeTooltip(page: Page, chip: import("@playwright/test").Locator) {
  const text = await chip.getAttribute("title");
  console.log(`[screenshot-kulisse] Tooltip "${await chip.innerText()}":\n${text}`);
  await chip.evaluate((el, t) => {
    const r = el.getBoundingClientRect();
    const box = document.createElement("div");
    box.setAttribute("data-sichtprobe", "1");
    box.textContent = t;
    Object.assign(box.style, {
      position: "fixed", left: `${Math.max(8, r.left)}px`, top: `${r.bottom + 6}px`, zIndex: "99999",
      whiteSpace: "pre", font: "12px system-ui, sans-serif", background: "#111", color: "#eee",
      border: "1px solid #666", borderRadius: "6px", padding: "6px 8px", boxShadow: "0 4px 16px rgba(0,0,0,.5)",
    });
    document.body.appendChild(box);
  }, text ?? "");
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const endung of ["", "-wal", "-shm"]) await fs.rm(SQLITE_PATH + endung, { force: true });
  const { saveId, teamId, seite } = await baueSaveVorTennis();
  const server = startDevServer();
  let browser: Browser | null = null;
  try {
    await waitForServer(180_000);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1500, height: 1200 }, colorScheme: "dark" });
    const url = new URL("/foundation", BASE_URL);
    url.searchParams.set("view", "lineup-v2");
    url.searchParams.set("team", teamId);
    url.searchParams.set("saveId", saveId);
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
    await dismissOverlays(page);
    const zeile = page.getByTestId(`nl-lineup-kulisse-${seite}`);
    await zeile.waitFor({ state: "visible", timeout: 120_000 });
    await dismissOverlays(page);
    await page.waitForTimeout(1500);
    console.log(`[screenshot-kulisse] Kulissen-Zeile: ${(await zeile.innerText()).replace(/\n/g, " | ")}`);
    console.log(`[screenshot-kulisse] Tooltip Zeile: ${await zeile.getAttribute("title")}`);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "01-einsatzliste-gesamt.png"), fullPage: false });

    // Den ersten Slot der Tennis-Seite fokussieren, damit die Kandidatenliste Tennis zeigt.
    const slot = page.locator(`[id^="lineup-slot-"][id*="${seite}"]`).first();
    if (await slot.isVisible().catch(() => false)) {
      await slot.locator(".nl-lineup-slot-hit").click().catch(() => undefined);
      await page.waitForTimeout(1200);
    }
    const block = zeile.locator("xpath=ancestor::section[1]");
    const chips = page.getByTestId("nl-lineup-kulisse-chip");
    console.log(`[screenshot-kulisse] Chips sichtbar: ${await chips.count()}`);
    const kandidatChip = page.locator(".nl-lineup-candidate-list").getByTestId("nl-lineup-kulisse-chip").first();
    if (await kandidatChip.isVisible().catch(() => false)) {
      await kandidatChip.scrollIntoViewIfNeeded();
      await zeigeTooltip(page, kandidatChip);
    } else if (await chips.first().isVisible().catch(() => false)) {
      await zeigeTooltip(page, chips.first());
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "02-kandidaten-chip-tooltip.png"), fullPage: false });
    if (await block.isVisible().catch(() => false)) {
      await page.locator("[data-sichtprobe]").evaluateAll((els) => els.forEach((e) => e.remove()));
      await block.screenshot({ path: path.join(OUTPUT_DIR, "03-tennis-block.png") }).catch(() => undefined);
    }
    console.log(`[screenshot-kulisse] fertig, Screenshots in ${OUTPUT_DIR}`);
  } finally {
    await browser?.close().catch(() => undefined);
    server.kill("SIGTERM");
    await delay(500);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
