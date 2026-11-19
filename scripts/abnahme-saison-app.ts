/**
 * ABNAHME „PICKEN + SAISON DURCHSPIELEN“ GEGEN DIE ECHTE APP (19.11., docs/design/abnahme-saison-19-11.md).
 *
 * Chris, woertlich: „kannst du das mit dem picken einmal wirklich in der app messen und bestätigen? und bei gelegenheit
 * prüfen dass die spieltage sauber durchlaufen? also man auch wirklich durch eine season durch kommt?“
 *
 * Anders als `scripts/abnahme-neues-spiel.ts` (ruft die Dienste direkt) schreibt dieser Lauf NUR ueber die HTTP-Routen
 * eines laufenden Produktionsservers (`next build` + `npm start`) — dieselben Aufrufe, in derselben Reihenfolge und mit
 * denselben Optionen wie die Oberflaeche (Arena: `commitThroughSide` d1/d2, `stopOnTie: false`, Quick-Sim; danach
 * „Spieltag abschliessen“; Saisonfinale: Abrechnung, Vertraege oeffnen, Saisonwechsel pruefen, Neue Saison starten).
 * Gelesen (gemessen) wird direkt aus derselben Wegwerf-SQLite.
 *
 * Server (eigenes Terminal, NIE gegen den echten Spielstand):
 *   env -u NODE_OPTIONS NODE_ENV=production PORT=3217 OLY_APP_SQLITE_PATH=/tmp/abnahme-19-11.sqlite \
 *     OLY_LIGA_DRAFT_MODUS=einzelschritt OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npx tsx server.ts
 * Lauf (Phasen einzeln, Zustand in <sqlite>.abnahme.json):
 *   OLY_APP_SQLITE_PATH=/tmp/abnahme-19-11.sqlite npx tsx scripts/abnahme-saison-app.ts anlegen
 *   flock /tmp/oly-aufnahme.lock ... draft          (Playwright: Draft-Seite, 1 eigener Pick, dann Auto-Draft)
 *   ... messen-draft | spieltage [bis] | saisonende | messen-fenster | aufnahmen
 */
import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { chromium, type Page } from "@playwright/test";

import { getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import type { GameState } from "@/lib/data/olyDataTypes";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { getTeamOutstandingDebt } from "@/lib/finance/loan-service";
import { GM_OPT_SENKUNG_MAX, getTeamGeneralManager, gmKaderOptAnpassung } from "@/lib/foundation/team-general-managers";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildStandingsTransferBalanceByTeamId } from "@/lib/season/transfer-standings-balance";

const SQLITE = process.env.OLY_APP_SQLITE_PATH ?? "";
const BASE = (process.env.ABNAHME_BASE_URL ?? "http://127.0.0.1:3217").replace(/\/$/, "");
const ZUSTAND_DATEI = `${SQLITE}.abnahme.json`;
const OUT_BILDER = path.join(process.cwd(), "docs", "design", "abnahme-saison-19-11");
// Zweiter Lauf (frisches Spiel nach den Fixes): `ABNAHME_LAUF=b` legt Daten unter …/lauf-b/ und Bilder mit Praefix „b-“ ab.
const LAUF = process.env.ABNAHME_LAUF ?? "";
const OUT_DATEN = path.join(process.cwd(), "data", "generated", "abnahme-saison-19-11", ...(LAUF ? [`lauf-${LAUF}`] : []));

type Zustand = { saveId: string; teamId: string; log: string[] };
const r2 = (v: number) => Math.round(v * 100) / 100;
const t0 = Date.now();
const log = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s] ${m}`);

function ladeZustand(): Zustand {
  return JSON.parse(fs.readFileSync(ZUSTAND_DATEI, "utf8")) as Zustand;
}
function schreibeZustand(z: Zustand) {
  fs.writeFileSync(ZUSTAND_DATEI, JSON.stringify(z, null, 2));
}
function schreibeDaten(name: string, daten: unknown) {
  fs.mkdirSync(OUT_DATEN, { recursive: true });
  fs.writeFileSync(path.join(OUT_DATEN, name), `${JSON.stringify(daten, null, 2)}\n`);
}

const persistence = () => createPersistenceService();
function gs(saveId: string): GameState {
  const save = persistence().getSaveById(saveId);
  if (!save) throw new Error(`Spielstand ${saveId} fehlt`);
  return save.gameState;
}

const netzfehler: string[] = [];

async function post<T = Record<string, unknown>>(route: string, body: unknown, query = ""): Promise<{ status: number; json: T }> {
  // Netzfehler (ECONNRESET: undici nimmt eine Keep-alive-Verbindung, die der Server gerade schliesst) zweimal wiederholen und
  // zaehlen — die Buchungsrouten sind je Seite wiederaufnehmbar (ein zweiter Lauf setzt auf dem gebuchten Stand auf).
  let res: Response | null = null;
  for (let versuch = 0; ; versuch += 1) {
    try {
      res = await fetch(`${BASE}${route}${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", connection: "close" },
        body: JSON.stringify(body),
      });
      break;
    } catch (e) {
      netzfehler.push(`${route}: ${String((e as Error).cause ?? e).slice(0, 120)}`);
      if (versuch >= 2) throw e;
      await delay(3000);
    }
  }
  const text = await res.text();
  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    json = { roh: text.slice(0, 400) } as T;
  }
  return { status: res.status, json };
}

function quantil(werte: number[], q: number): number {
  if (werte.length === 0) return NaN;
  const s = [...werte].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const u = Math.floor(pos);
  const o = Math.ceil(pos);
  return r2(s[u]! + (s[o]! - s[u]!) * (pos - u));
}

function kuerzel(g: GameState, teamId: string): string {
  const id = g.teamIdentities.find((i) => i.teamId === teamId) as unknown as Record<string, unknown> | undefined;
  return String(id?.shortName ?? id?.abbreviation ?? teamId);
}

function ligaVon(g: GameState, teamId: string): string {
  const t = g.teams.find((x) => x.teamId === teamId) as unknown as Record<string, unknown> | undefined;
  const id = g.teamIdentities.find((i) => i.teamId === teamId) as unknown as Record<string, unknown> | undefined;
  return String(t?.leagueTier ?? id?.leagueTier ?? (g.seasonState as unknown as Record<string, Record<string, unknown>>).leagueByTeamId?.[teamId] ?? "?");
}

// ------------------------------------------------------------------------------------------------ anlegen

async function anlegen() {
  for (const e of ["", "-wal", "-shm"]) if (fs.existsSync(`${SQLITE}${e}`) && process.argv.includes("--frisch")) fs.rmSync(`${SQLITE}${e}`);
  const vorschau = await post<{ preview?: Record<string, unknown>; error?: string }>("/api/new-game", {
    presetId: "solo_1",
    gameMode: "battle",
    saveName: "Abnahme 19.11. Battle",
    dryRun: true,
  });
  const preview = vorschau.json.preview as Record<string, unknown> | undefined;
  if (!preview) throw new Error(`Vorschau: ${vorschau.status} ${JSON.stringify(vorschau.json).slice(0, 300)}`);
  const chrisTeamIds = preview.chrisTeamIds as string[];
  log(`Vorschau ok, Chris-Team(s) ${chrisTeamIds.join(",")}, Token ${String(preview.confirmToken).slice(0, 12)}…`);
  const anlage = await post<{ result?: { save: { saveId: string } }; error?: string }>("/api/new-game", {
    presetId: "solo_1",
    gameMode: "battle",
    saveName: "Abnahme 19.11. Battle",
    chrisTeamIds,
    dryRun: false,
    confirmToken: preview.confirmToken,
  });
  const saveId = anlage.json.result?.save.saveId;
  if (!saveId) throw new Error(`Anlage: ${anlage.status} ${JSON.stringify(anlage.json).slice(0, 300)}`);
  const teamId = chrisTeamIds[0]!;
  log(`Spielstand ${saveId} angelegt, mein Team ${teamId}`);
  // Halbautomatik (Delegation 18.11.): Draft und Transfers selbst, Einsatzliste/Training/Gebaeude/Sponsor per KI.
  const deleg = await post("/api/team-settings/control", {
    saveId,
    teamId,
    source: "sqlite",
    control: { delegation: { stufe: "halbautomatik" } },
  });
  log(`Delegation Halbautomatik: ${deleg.status} ${JSON.stringify(deleg.json).slice(0, 160)}`);
  const g = gs(saveId);
  log(`Phase ${g.gamePhase}, Modus ${(g as unknown as Record<string, unknown>).gameMode ?? g.scenarioMeta?.gameMode ?? "?"}, leagueSetupStatus ${g.seasonState.leagueSetupStatus}, Draft ${g.seasonState.ligaDraft?.status ?? "—"}`);
  schreibeZustand({ saveId, teamId, log: [`anlegen ${new Date().toISOString()} ${saveId} ${teamId}`] });
}

// ------------------------------------------------------------------------------------------------ Browser-Helfer

async function neueSeite(breite = 1920, hoehe = 1080) {
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage", "--disable-gpu"] });
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const fehler: string[] = [];
  page.on("pageerror", (e) => fehler.push(String(e).slice(0, 240)));
  page.on("console", (m) => {
    if (m.type() === "error") fehler.push(`console: ${m.text().slice(0, 240)}`);
  });
  return { browser, page, fehler };
}

function url(z: Zustand, view?: string) {
  const u = new URL("/foundation", BASE);
  if (view) u.searchParams.set("view", view);
  u.searchParams.set("saveId", z.saveId);
  u.searchParams.set("team", z.teamId);
  return u.toString();
}

async function foto(page: Page, name: string) {
  fs.mkdirSync(OUT_BILDER, { recursive: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT_BILDER, LAUF ? `${LAUF}-${name}` : name) });
  log(`Bild ${name}`);
}

async function schliesseBriefing(page: Page) {
  for (let i = 0; i < 6; i += 1) {
    const backdrop = page.getByTestId("season-briefing-backdrop");
    if (!(await backdrop.isVisible().catch(() => false))) return;
    const knopf = page.getByRole("button", { name: /^(Erledigt|Später)$/ }).first();
    if (await knopf.isVisible().catch(() => false)) await knopf.click();
    await page.waitForTimeout(500);
  }
}

// ------------------------------------------------------------------------------------------------ Draft (Browser)

async function draft() {
  const z = ladeZustand();
  const { browser, page, fehler } = await neueSeite();
  try {
    await page.goto(url(z), { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.getByTestId("liga-draft-seite").waitFor({ state: "visible", timeout: 180_000 });
    await page.getByTestId("draft-zeile").first().waitFor({ state: "visible", timeout: 120_000 }).catch(() => undefined);
    await page.waitForTimeout(4000);
    const fortsetzen = process.argv.includes("--fortsetzen");
    if (!fortsetzen) await foto(page, "01-draft-live.png");
    // Warten, bis ich dran bin (die KI pickt live im Takt der Seite), dann EINEN Pick selbst (Vorschlag des GM).
    const amZug = page.getByTestId("draft-am-zug");
    const istDran = fortsetzen ? false : await amZug.waitFor({ state: "visible", timeout: 600_000 }).then(() => true).catch(() => false);
    log(`am Zug sichtbar: ${istDran}`);
    if (istDran) {
      await page.waitForTimeout(1500);
      await foto(page, "02-draft-du-bist-dran.png");
      const knopf = page.getByTestId("draft-mein-picken").first();
      if (await knopf.isVisible().catch(() => false)) {
        await knopf.click();
        log("eigener Pick (GM-Vorschlag) geklickt");
      } else {
        await page.getByTestId("draft-picken").first().click().catch(() => undefined);
        log("eigener Pick (erste Zeile) geklickt");
      }
      await page.waitForTimeout(3000);
    }
    // Rest: Variante B (Auto-Draft, mein GM pickt an meinem Platz). Wirkt der Klick nicht (Fehler F2: Stand-Konflikt wird
    // still verschluckt, solange die KI weiterpickt), klickt ein Mensch erneut — gezaehlt.
    for (let klick = 1; klick <= 6; klick += 1) {
      await page.getByTestId("draft-ueberspringen").click({ timeout: 60_000 });
      await page.getByTestId("draft-skip-b").click({ timeout: 30_000 });
      await page.waitForTimeout(2500);
      const an = gs(z.saveId).seasonState.ligaDraft?.teams[z.teamId]?.autoPick === true;
      log(`Ueberspringen → Variante B (Auto-Draft), Klick ${klick}: Auto-Pick ${an ? "AN" : "NICHT an"}`);
      if (an) break;
    }
    const ende = Date.now() + 1_800_000;
    while (Date.now() < ende) {
      if (await page.getByTestId("draft-ergebnis").isVisible().catch(() => false)) break;
      const d = gs(z.saveId).seasonState.ligaDraft;
      if (d?.status === "fertig") {
        await page.waitForTimeout(5000);
        if (await page.getByTestId("draft-ergebnis").isVisible().catch(() => false)) break;
      }
      await delay(5000);
    }
    const d = gs(z.saveId).seasonState.ligaDraft;
    log(`Draft-Status ${d?.status}, Eintraege ${d?.verlauf.length}, leagueSetupStatus ${gs(z.saveId).seasonState.leagueSetupStatus}`);
    await page.getByTestId("draft-ergebnis").waitFor({ state: "visible", timeout: 120_000 }).catch(() => log("Ergebnis-Ansicht NICHT sichtbar"));
    await foto(page, "03-draft-ergebnis.png");
    await page.getByTestId("draft-weiter").click({ timeout: 30_000 }).catch(() => log("Weiter-Knopf fehlt"));
    await page.waitForTimeout(8000);
    await schliesseBriefing(page);
    await foto(page, "04-nach-draft-start.png");
    log(`Browserfehler: ${fehler.length}`);
    schreibeDaten("draft-browserfehler.json", fehler);
  } finally {
    await browser.close();
  }
}

// ------------------------------------------------------------------------------------------------ Messen

function kader(g: GameState, teamId: string) {
  return g.rosters.filter((r) => r.teamId === teamId);
}

function gmOptVon(g: GameState, teamId: string, opt: number, min: number) {
  const anp = gmKaderOptAnpassung({ bias: getTeamGeneralManager(g, teamId)?.profile?.bias ?? null, opt, rosterMin: min });
  return { gmOpt: Math.max(anp.opt, opt - GM_OPT_SENKUNG_MAX, Math.min(opt, 9)), gmGrund: anp.grund };
}

function top20Ids(g: GameState): Set<string> {
  return new Set(
    [...g.players]
      .sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))
      .slice(0, 20)
      .map((p) => p.id),
  );
}

function messeDraft() {
  const z = ladeZustand();
  const g = gs(z.saveId);
  const draftZ = g.seasonState.ligaDraft;
  const sid = g.season.id;
  const top20 = top20Ids(g);
  const bilanz = buildStandingsTransferBalanceByTeamId(g, sid);
  const teams = g.teams.map((t) => {
    const k = kader(g, t.teamId);
    const id = g.teamIdentities.find((i) => i.teamId === t.teamId);
    const min = Math.max(8, id?.playerMin ?? 8);
    const opt = getTeamOptTarget(g, t.teamId);
    const { gmOpt, gmGrund } = gmOptVon(g, t.teamId, opt, min);
    const dt = draftZ?.teams[t.teamId];
    const eintraege = (draftZ?.verlauf ?? []).filter((e) => e.teamId === t.teamId);
    const picks = eintraege.filter((e) => e.art === "pick");
    const aus = eintraege.filter((e) => e.art === "aus").map((e) => e.grund ?? "");
    const gruende = eintraege.map((e) => e.grund ?? "").filter(Boolean);
    const notwege = gruende.flatMap((gr) => {
      const m = /kaderplan_notwege:([^\s]+)/.exec(gr);
      return m && m[1] !== "0" && m[1] !== "-" ? m[1].split(",") : [];
    });
    const notwegPicks = gruende.filter((gr) => /notweg/.test(gr) && !/kaderplan_notwege:(0|-)\b/.test(gr));
    // Das Ziel, mit dem der Kaderplan beim Ausstieg tatsaechlich geplant hat („Zielkader N erreicht“, nach GM-Senkung). Der
    // heutige `getTeamOptTarget` weicht davon ab, weil der Kaderstress-Anteil mit dem gefuellten Kader sinkt.
    const planOpt = gruende.map((gr) => Number(/Zielkader (\d+)/.exec(gr)?.[1])).filter((n) => Number.isFinite(n));
    const stand = berechneVorstandBudgetStand(g, t.teamId);
    return {
      teamId: t.teamId,
      kuerzel: kuerzel(g, t.teamId),
      liga: ligaVon(g, t.teamId),
      mensch: t.teamId === z.teamId,
      gm: getTeamGeneralManager(g, t.teamId)?.assignment?.gmId ?? null,
      kader: k.length,
      min,
      opt,
      gmOpt: planOpt.length ? Math.min(...planOpt) : gmOpt,
      gmGrund,
      fertigGrund: dt?.fertigGrund ?? null,
      ausGrund: aus[aus.length - 1] ?? null,
      picks: picks.length,
      quellen: [...new Set(picks.map((p) => p.quelle))].join(","),
      abloeseSumme: r2(picks.reduce((s, p) => s + (p.abloese ?? 0), 0)),
      teuerster: r2(Math.max(0, ...picks.map((p) => p.abloese ?? 0))),
      top20Gekauft: k.filter((r) => top20.has(r.playerId)).length,
      gehalt: r2(k.reduce((s, r) => s + (r.salary ?? 0), 0)),
      startKasse: r2(dt?.startKasse ?? NaN),
      kasse: r2(t.cash),
      notruecklage: stand.kaderpflicht?.notruecklage ?? null,
      kaderpflichtAktiv: stand.kaderpflicht?.aktiv ?? false,
      notwege,
      notwegPicks: notwegPicks.length,
      transferbilanzS1: bilanz[t.teamId]?.transferNet ?? null,
      kaderaufbauS1: (bilanz[t.teamId] as unknown as Record<string, unknown> | undefined)?.kaderaufbauNet ?? null,
    };
  });
  const gehaelter = teams.map((t) => t.gehalt);
  const zus = {
    saveId: z.saveId,
    saison: sid,
    draftStatus: draftZ?.status ?? null,
    leagueSetupStatus: g.seasonState.leagueSetupStatus ?? null,
    verlaufEintraege: draftZ?.verlauf.length ?? 0,
    picksGesamt: (draftZ?.verlauf ?? []).filter((e) => e.art === "pick").length,
    unter8: teams.filter((t) => t.kader < 8).map((t) => `${t.kuerzel}:${t.kader}`),
    bei8oder9OhneGmGrund: teams.filter((t) => (t.kader === 8 || t.kader === 9) && t.gmOpt > t.kader).map((t) => `${t.kuerzel}:${t.kader}/gmOpt ${t.gmOpt}`),
    unterOpt: teams.filter((t) => t.kader < t.opt).map((t) => `${t.kuerzel}:${t.kader}/${t.opt} (gmOpt ${t.gmOpt})`),
    unterGmOpt: teams.filter((t) => t.kader < t.gmOpt).map((t) => `${t.kuerzel}:${t.kader}/${t.gmOpt} ${t.fertigGrund ?? ""} ${t.ausGrund ?? ""}`),
    ueberZiel: teams.filter((t) => t.kader > Math.max(t.opt, t.gmOpt)).map((t) => `${t.kuerzel}:${t.kader}/opt ${t.opt}/ziel ${t.gmOpt}`),
    zielUeberOptHeute: teams.filter((t) => t.gmOpt > t.opt).map((t) => `${t.kuerzel}:ziel ${t.gmOpt}/opt heute ${t.opt}`),
    kaderVerteilung: Object.fromEntries([...new Set(teams.map((t) => t.kader))].sort((a, b) => a - b).map((k) => [k, teams.filter((t) => t.kader === k).length])),
    notwege: teams.flatMap((t) => t.notwege.map((n) => `${t.kuerzel}:${n}`)),
    notwegPicks: teams.reduce((s, t) => s + t.notwegPicks, 0),
    top20Gekauft: teams.filter((t) => t.top20Gekauft > 0).map((t) => `${t.kuerzel}:${t.top20Gekauft}`),
    top20Grenze: r2(Math.min(...[...top20Ids(g)].map((id) => g.players.find((p) => p.id === id)?.marketValue ?? 0))),
    teuersterKauf: r2(Math.max(...teams.map((t) => t.teuerster))),
    gehalt: {
      min: quantil(gehaelter, 0),
      median: quantil(gehaelter, 0.5),
      max: quantil(gehaelter, 1),
      in50bis70: gehaelter.filter((x) => x >= 50 && x <= 70).length,
      ueber70: gehaelter.filter((x) => x > 70).length,
      unter50: gehaelter.filter((x) => x < 50).length,
    },
    kasse: { min: quantil(teams.map((t) => t.kasse), 0), median: quantil(teams.map((t) => t.kasse), 0.5), negativ: teams.filter((t) => t.kasse < -0.01).length },
    kasseUnterNotruecklage: teams.filter((t) => t.notruecklage != null && t.kasse < t.notruecklage - 0.01).map((t) => `${t.kuerzel}:${t.kasse}<${t.notruecklage}`),
    transferbilanzS1NichtLeer: teams.filter((t) => t.transferbilanzS1 != null).map((t) => `${t.kuerzel}:${t.transferbilanzS1}`),
    fertigGruende: teams.reduce<Record<string, number>>((m, t) => ({ ...m, [t.fertigGrund ?? "—"]: (m[t.fertigGrund ?? "—"] ?? 0) + 1 }), {}),
    vertragsende: g.rosters.reduce<Record<string, number>>((m, r) => {
      const k = String(r.contractEndSeasonNumber ?? `len${r.contractLength}`);
      return { ...m, [k]: (m[k] ?? 0) + 1 };
    }, {}),
    vertragsendeMensch: kader(g, z.teamId).reduce<Record<string, number>>((m, r) => {
      const k = String(r.contractEndSeasonNumber ?? `len${r.contractLength}`);
      return { ...m, [k]: (m[k] ?? 0) + 1 };
    }, {}),
    sponsorvertraege: Object.keys((g.seasonState as unknown as { sponsorContractsByTeamId?: Record<string, unknown> }).sponsorContractsByTeamId ?? {}).length,
    mensch: teams.find((t) => t.mensch),
  };
  console.log(JSON.stringify(zus, null, 2));
  schreibeDaten("s1-draft.json", { zusammenfassung: zus, teams });
}

// ------------------------------------------------------------------------------------------------ Spieltage

type SpieltagProtokoll = {
  wertung: Record<string, number>;
  saison: string;
  matchdayId: string;
  nr: number;
  disziplinen: string[];
  prewarm: number;
  lineupTeams: number;
  verletzteEingesetzt: string[];
  fremdeEingesetzt: string[];
  d1: { status: number; ok: boolean; sek: number; polls: number; blocker: string[] };
  d2: { status: number; ok: boolean; sek: number; polls: number; blocker: string[] };
  abschluss: { status: number; applied: boolean; blocker: string[] };
  standAktualisiert: boolean;
  punkteSummeVorher: number;
  punkteSummeNachher: number;
  phaseNachher: string;
  naechster: string | null;
  fehler: string[];
};

function punkteSumme(g: GameState): number {
  const st = (g.seasonState.standings ?? {}) as Record<string, { points?: number }>;
  return r2(Object.values(st).reduce((s, x) => s + (x?.points ?? 0), 0));
}

function disziplinenVon(g: GameState, matchdayId: string): string[] {
  const plan = (g.seasonState as unknown as { disciplineSchedule?: Array<{ seasonId: string; matchdayId: string; discipline1?: { disciplineId: string }; discipline2?: { disciplineId: string } }> }).disciplineSchedule?.find(
    (e) => e.seasonId === g.season.id && e.matchdayId === matchdayId,
  );
  return [plan?.discipline1?.disciplineId ?? "?", plan?.discipline2?.disciplineId ?? "?"];
}

async function bucheSeite(z: Zustand, seasonId: string, matchdayId: string, side: "d1" | "d2") {
  const start = Date.now();
  let polls = 0;
  for (;;) {
    const r = await post<{ success?: boolean; summary?: { summary?: { standingsApplyAllowed?: boolean }; blockingReasons?: string[]; steps?: Array<{ key?: string; status?: string; blockingReasons?: string[] }> }; error?: string; blockingReasons?: string[] }>(
      "/api/season/matchday-auto-run",
      {
        saveId: z.saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        dryRun: false,
        execute: true,
        confirmToken: "RUN_LOCAL_MATCHDAY_AUTO",
        options: {
          includeWarningLineups: false,
          overwriteExistingLineups: false,
          stopOnTie: false,
          advanceAfterCashApply: false,
          commitThroughSide: side,
          submittedPreview: null,
          ...(polls === 0 ? { arenaQuickSim: true } : {}),
        },
      },
    );
    const blocker = [
      ...(r.json.summary?.blockingReasons ?? []),
      // Der Schritt „ai_lineups“ meldet `existing_lineup_requires_overwrite_confirm` je Team, sobald die Aufstellungen schon stehen
      // (wie in der Oberflaeche nach dem Vorwaermen) — das ist kein Blocker der Buchung.
      ...(r.json.summary?.steps ?? []).filter((s) => s.key !== "ai_lineups").flatMap((s) => s.blockingReasons ?? []),
      ...(r.json.blockingReasons ?? []),
      ...(r.json.error ? [r.json.error] : []),
    ];
    // Wie die Arena (`commitArenaDiscipline`): gebucht heisst `summary.summary.standingsApplyAllowed`.
    const ok = r.json.summary?.summary?.standingsApplyAllowed === true;
    if (!ok && (blocker.includes("arena_vorlauf_laeuft") || blocker.includes("arena_eingabe_divergenz")) && polls < 300) {
      polls += 1;
      await delay(3000);
      continue;
    }
    return { status: r.status, ok, sek: Math.round((Date.now() - start) / 1000), polls, blocker: [...new Set(blocker)] };
  }
}

async function spieltage() {
  const z = ladeZustand();
  const bis = Number(process.argv[3] ?? "99");
  const protokolle: SpieltagProtokoll[] = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(OUT_DATEN, "spieltage.json"), "utf8")) as SpieltagProtokoll[];
    } catch {
      return [];
    }
  })();
  for (let runde = 0; runde < bis; runde += 1) {
    const g = gs(z.saveId);
    if (g.gamePhase !== "season_active") {
      log(`Phase ${g.gamePhase} — keine Spieltage mehr`);
      break;
    }
    const seasonId = g.season.id;
    const matchdayId = g.matchdayState?.matchdayId ?? "";
    const nr = (g.season.matchdayIds ?? []).indexOf(matchdayId) + 1;
    const fehler: string[] = [];
    log(`--- ${seasonId} ${matchdayId} (Nr ${nr}) ---`);
    // Wie die Oberflaeche nach jedem Spieltag: KI-Aufstellungen im Hintergrund vorwaermen.
    const pw = await post("/api/lineups/legacy/ai-batch-prewarm", {}, `?saveId=${encodeURIComponent(z.saveId)}&seasonId=${encodeURIComponent(seasonId)}&matchdayId=${encodeURIComponent(matchdayId)}`);
    if (pw.status >= 400) fehler.push(`prewarm ${pw.status} ${JSON.stringify(pw.json).slice(0, 200)}`);
    // Einsatzlisten pruefen, bevor gebucht wird.
    const vor = gs(z.saveId);
    const drafts = (vor.seasonState.lineupDrafts ?? []).filter((l) => l.seasonId === seasonId && l.matchdayId === matchdayId);
    const verletzt: string[] = [];
    const fremd: string[] = [];
    // Schon gebuchte Seiten (z. B. D1 ueber die Arena-Oberflaeche) nicht pruefen: wer sich DORT verletzt hat, spielt diese
    // Disziplin regelgerecht mit 50 % zu Ende (docs/design/verletzung-regel-18-11.md) und ist danach „nicht verfuegbar“.
    const mdErgebnis = (vor.seasonState.matchdayResults ?? []).find((m) => m.seasonId === seasonId && m.matchdayId === matchdayId);
    const gebuchteSeiten = new Set((vor.seasonState.disciplineResults ?? []).filter((d) => d.matchdayResultId === mdErgebnis?.id).map((d) => d.disciplineSide));
    for (const l of drafts) {
      const kaderIds = new Set(kader(vor, l.teamId).map((r) => r.playerId));
      for (const e of l.entries) {
        if (gebuchteSeiten.has(e.disciplineSide)) continue;
        if (!kaderIds.has(e.playerId)) fremd.push(`${kuerzel(vor, l.teamId)}:${e.playerId}@${e.disciplineSide}`);
        const av = getPlayerAvailabilityView(vor, e.playerId, l.teamId, matchdayId);
        if (av.isUnavailable) verletzt.push(`${kuerzel(vor, l.teamId)}:${e.playerId}@${e.disciplineSide}`);
      }
    }
    const disziplinen = disziplinenVon(vor, matchdayId);
    const punkteVorher = punkteSumme(vor);
    const d1 = await bucheSeite(z, seasonId, matchdayId, "d1");
    log(`D1 ok=${d1.ok} ${d1.sek}s polls=${d1.polls} ${d1.blocker.join(",")}`);
    if (!d1.ok) fehler.push(`D1 nicht gebucht: ${d1.status} ${d1.blocker.join(",")}`);
    const d2 = d1.ok ? await bucheSeite(z, seasonId, matchdayId, "d2") : { status: 0, ok: false, sek: 0, polls: 0, blocker: ["d1_fehlt"] };
    log(`D2 ok=${d2.ok} ${d2.sek}s polls=${d2.polls} ${d2.blocker.join(",")}`);
    if (!d2.ok) fehler.push(`D2 nicht gebucht: ${d2.status} ${d2.blocker.join(",")}`);
    const nachBuchung = gs(z.saveId);
    const punkteNach = punkteSumme(nachBuchung);
    // Nach der Buchung, VOR dem Abschluss: die gebuchten Einsatzlisten erneut gegen Verletzte pruefen (Stand vor dem Spieltag
    // ist nicht mehr lesbar; die Vorab-Pruefung oben ist massgeblich, falls die Batch-Aufstellung erst im Lauf entstand).
    if (drafts.length === 0) {
      const gebucht = (nachBuchung.seasonState.lineupDrafts ?? []).filter((l) => l.seasonId === seasonId && l.matchdayId === matchdayId);
      fehler.push(`keine Einsatzlisten vor der Buchung (nach der Buchung: ${gebucht.length})`);
    }
    // „Spieltag abschliessen“
    const ab = d2.ok
      ? await post<{ applied?: boolean; blockingReasons?: string[]; error?: string }>("/api/season/advance-matchday", {
          saveId: z.saveId,
          seasonId,
          source: "sqlite",
          dryRun: false,
          execute: true,
          confirm: "ADVANCE_LOCAL_MATCHDAY",
        })
      : { status: 0, json: { applied: false, blockingReasons: ["nicht_versucht"] } };
    if (!ab.json.applied) fehler.push(`Abschluss: ${ab.status} ${JSON.stringify(ab.json.blockingReasons ?? ab.json.error ?? "").slice(0, 240)}`);
    const nach = gs(z.saveId);
    // Wie wurde gewertet? Zeilen dieses Spieltags mit `arenaAusfall` (PPS-Duell-Bruecke statt Arena-Ergebnis), je Grund.
    const ergebnisIds = new Set((nach.seasonState.matchdayResults ?? []).filter((m) => m.seasonId === seasonId && m.matchdayId === matchdayId).map((m) => m.id));
    const zeilen = (nach.seasonState.disciplineResults ?? []).filter((d) => ergebnisIds.has(d.matchdayResultId));
    const ausfall = zeilen.reduce<Record<string, number>>((m, d) => {
      const grund = (d as unknown as { arenaAusfall?: { grund?: string } | null }).arenaAusfall?.grund;
      const k = `${d.disciplineId}:${grund ?? "arena"}`;
      return { ...m, [k]: (m[k] ?? 0) + 1 };
    }, {});
    const p: SpieltagProtokoll = {
      wertung: ausfall,
      saison: seasonId,
      matchdayId,
      nr,
      disziplinen,
      prewarm: pw.status,
      lineupTeams: drafts.length,
      verletzteEingesetzt: verletzt,
      fremdeEingesetzt: fremd,
      d1,
      d2,
      abschluss: { status: ab.status, applied: ab.json.applied === true, blocker: ab.json.blockingReasons ?? (ab.json.error ? [ab.json.error] : []) },
      standAktualisiert: punkteNach > punkteVorher,
      punkteSummeVorher: punkteVorher,
      punkteSummeNachher: punkteNach,
      phaseNachher: String(nach.gamePhase),
      naechster: nach.matchdayState?.matchdayId ?? null,
      fehler: [...fehler, ...netzfehler.splice(0).map((n) => `netz (wiederholt): ${n}`)],
    };
    protokolle.push(p);
    schreibeDaten("spieltage.json", protokolle);
    log(`Wertung ${JSON.stringify(ausfall)}`);
    log(`Teams mit Einsatzliste ${drafts.length}, verletzt eingesetzt ${verletzt.length}, fremd ${fremd.length}, Punkte ${punkteVorher}→${punkteNach}, Phase ${nach.gamePhase}, weiter ${p.naechster}, Fehler ${fehler.length}`);
    if (fehler.length > 0 && !ab.json.applied) {
      log(`HALT: ${fehler.join(" | ")}`);
      break;
    }
  }
}

// ------------------------------------------------------------------------------------------------ Saisonende

async function saisonende() {
  const z = ladeZustand();
  const schritte: Array<{ schritt: string; status: number; ok: boolean; info: string }> = [];
  const merke = (schritt: string, status: number, ok: boolean, info: unknown) => {
    const text = typeof info === "string" ? info : JSON.stringify(info).slice(0, 400);
    schritte.push({ schritt, status, ok, info: text });
    log(`${schritt}: ${status} ok=${ok} ${text.slice(0, 200)}`);
  };
  let g = gs(z.saveId);
  const sid1 = g.season.id;
  log(`Start Saisonende: ${sid1} Phase ${g.gamePhase}`);
  // 1) „Saisonabrechnung buchen“ (Finale-Panel: runCockpitCashApply(true), phase season_end)
  const md = g.matchdayState?.matchdayId ?? g.season.matchdayIds?.[g.season.matchdayIds.length - 1] ?? "";
  const cash = await post<{ applied?: boolean; blockingReasons?: string[]; error?: string }>("/api/season/cash-prize-apply", {
    saveId: z.saveId,
    seasonId: sid1,
    matchdayId: md,
    source: "sqlite",
    phase: "season_end",
    dryRun: false,
    execute: true,
    confirm: "APPLY_LOCAL_CASH_PRIZE",
  });
  merke("Saisonabrechnung buchen", cash.status, cash.json.applied === true, cash.json.blockingReasons ?? cash.json.error ?? "");
  // 2) „Verträge öffnen“ (Saisonende-Kette bis zur Vertragsphase)
  const tw = await post<{ success?: boolean; blockingReasons?: string[]; error?: string; summary?: { transition?: { currentStep?: string } } }>("/api/season/transition", {
    saveId: z.saveId,
    source: "sqlite",
    dryRun: false,
    action: "open_transfer_window",
  });
  merke("Verträge öffnen", tw.status, tw.json.success === true, { blocker: tw.json.blockingReasons, err: tw.json.error, step: tw.json.summary?.transition?.currentStep });
  g = gs(z.saveId);
  log(`Phase jetzt ${g.gamePhase}`);
  // 3) „Saisonwechsel prüfen“ → 4) „Neue Saison starten“
  for (let versuch = 0; versuch < 6; versuch += 1) {
    const pv = await post<{ summary?: { steps?: Array<{ stepId: string; confirmToken?: string; status?: string; blockingReasons?: string[] }> }; blockingReasons?: string[]; error?: string }>("/api/season/preseason-workflow", {
      saveId: z.saveId,
      source: "sqlite",
      dryRun: true,
    });
    const schritt = pv.json.summary?.steps?.find((s) => s.stepId === "next_season_setup");
    merke(`Saisonwechsel prüfen (${versuch + 1})`, pv.status, Boolean(schritt?.confirmToken), { blocker: pv.json.blockingReasons, schritt: schritt ? { status: schritt.status, blocker: schritt.blockingReasons } : null, err: pv.json.error });
    const blocker = [...(pv.json.blockingReasons ?? []), ...(schritt?.blockingReasons ?? [])];
    if (schritt?.confirmToken && !(schritt.blockingReasons ?? []).length) {
      const start = await post<{ success?: boolean; blockingReasons?: string[]; error?: string }>("/api/season/preseason-workflow", {
        saveId: z.saveId,
        source: "sqlite",
        dryRun: false,
        stepId: "next_season_setup",
        confirmToken: schritt.confirmToken,
      });
      merke("Neue Saison starten", start.status, start.json.success === true, start.json.blockingReasons ?? start.json.error ?? "");
      if (start.json.success) break;
    }
    // Haengt die Kette noch in einer Saisonende-Station, schaltet das Cockpit sie weiter (Assistent „advance_step“).
    if (blocker.length) {
      const adv = await post<{ success?: boolean; blockingReasons?: string[]; error?: string }>("/api/season/transition", { saveId: z.saveId, source: "sqlite", dryRun: false, action: "advance_step" });
      merke("Saisonende-Assistent: nächster Schritt", adv.status, adv.json.success === true, adv.json.blockingReasons ?? adv.json.error ?? "");
    }
  }
  g = gs(z.saveId);
  log(`Danach: ${g.season.id} Phase ${g.gamePhase}, Spieltag ${g.matchdayState?.matchdayId}`);
  schreibeDaten("saisonende.json", { sid1, sid2: g.season.id, phase: g.gamePhase, schritte });
}

// ------------------------------------------------------------------------------------------------ Fenster S2 messen

async function messeFenster() {
  const z = ladeZustand();
  // Auf den Hintergrund-Kauflauf warten (angestossen von „Neue Saison starten“).
  let g = gs(z.saveId);
  const sid2 = g.season.id;
  for (let i = 0; i < 240; i += 1) {
    const lauf = g.seasonState.aiPreseasonAutomationRuns?.[sid2] as unknown as { status?: string } | undefined;
    if (lauf?.status === "completed" || lauf?.status === "failed") break;
    await delay(5000);
    g = gs(z.saveId);
  }
  const lauf = (g.seasonState.aiPreseasonAutomationRuns?.[sid2] ?? null) as unknown as Record<string, unknown> | null;
  const warn = ((lauf?.warnings as string[] | undefined) ?? []).map(String);
  log(`KI-Lauf ${String(lauf?.status)} Kaeufe ${String(lauf?.transferBuysApplied)} Verkaeufe ${String(lauf?.transferSellsApplied)} Warnungen ${warn.length}`);
  const sid1 = sid2.replace(/(\d+)$/, (m) => String(Number(m) - 1));
  const kaeufe = g.transferHistory.filter((e) => e.transferType === "buy" && (e as unknown as { seasonId?: string }).seasonId === sid2);
  const verkaeufe = g.transferHistory.filter((e) => e.transferType === "sell" && (e as unknown as { seasonId?: string }).seasonId === sid2);
  const bilanzS1 = buildStandingsTransferBalanceByTeamId(g, sid1);
  const bilanzS2 = buildStandingsTransferBalanceByTeamId(g, sid2);
  const teams = g.teams.map((t) => {
    const k = kader(g, t.teamId);
    const id = g.teamIdentities.find((i) => i.teamId === t.teamId);
    const min = Math.max(8, id?.playerMin ?? 8);
    const opt = getTeamOptTarget(g, t.teamId);
    const zeilen = warn.filter((w) => w.startsWith(`kaderplan:${t.teamId}:`));
    const planOpts = zeilen.map((w) => Number(/:opt=(\d+):/.exec(w)?.[1])).filter((n) => Number.isFinite(n));
    const notwege = zeilen.map((w) => /:notwege=(.*)$/.exec(w)?.[1] ?? "0").filter((n) => n !== "0").flatMap((n) => n.split(","));
    const stand = berechneVorstandBudgetStand(g, t.teamId);
    const kf = kaeufe.filter((e) => e.toTeamId === t.teamId);
    const vf = verkaeufe.filter((e) => e.fromTeamId === t.teamId);
    return {
      teamId: t.teamId,
      kuerzel: kuerzel(g, t.teamId),
      liga: ligaVon(g, t.teamId),
      mensch: t.teamId === z.teamId,
      kader: k.length,
      min,
      opt,
      gmOpt: planOpts.length ? Math.min(...planOpts) : gmOptVon(g, t.teamId, opt, min).gmOpt,
      gmGrund: warn.filter((w) => w.startsWith(`kaderplan_gm:${t.teamId}:`)).pop()?.split(":").slice(2).join(":") ?? null,
      kaderplanGrund: zeilen[zeilen.length - 1]?.split(":")[2] ?? null,
      notwege,
      kaeufe: kf.length,
      kaufSumme: r2(kf.reduce((s, e) => s + e.fee, 0)),
      fueller: kf.filter((e) => e.fee < 12).length,
      kaufQuellen: [...new Set(kf.map((e) => e.source ?? "?"))].join(","),
      verkaeufe: vf.length,
      verkaufSumme: r2(vf.reduce((s, e) => s + (e.netCashImpact ?? e.fee), 0)),
      gehalt: r2(k.reduce((s, r) => s + (r.salary ?? 0), 0)),
      kasse: r2(t.cash),
      notruecklage: stand.kaderpflicht?.notruecklage ?? null,
      kaderpflichtAktiv: stand.kaderpflicht?.aktiv ?? false,
      kaderpflichtText: stand.kaderpflicht?.text ?? null,
      schuld: r2(getTeamOutstandingDebt(g, t.teamId)),
      notkredit: warn.filter((w) => w.startsWith(`ai_notkredit:${t.teamId}:`)).length,
      notverkauf: warn.filter((w) => w.startsWith(`ai_notverkauf:${t.teamId}:`)).length,
      transferbilanzS1: bilanzS1[t.teamId]?.transferNet ?? null,
      transferbilanzS2: bilanzS2[t.teamId]?.transferNet ?? null,
    };
  });
  const gehaelter = teams.map((t) => t.gehalt);
  const zus = {
    saveId: z.saveId,
    saison: sid2,
    phase: g.gamePhase,
    laufStatus: lauf?.status ?? null,
    laufKaeufe: lauf?.transferBuysApplied ?? null,
    laufVerkaeufe: lauf?.transferSellsApplied ?? null,
    kaeufe: kaeufe.length,
    verkaeufe: verkaeufe.length,
    unter8: teams.filter((t) => t.kader < 8).map((t) => `${t.kuerzel}:${t.kader}${t.mensch ? " (Mensch)" : ""}`),
    bei8oder9OhneGmGrund: teams.filter((t) => (t.kader === 8 || t.kader === 9) && t.gmOpt > t.kader).map((t) => `${t.kuerzel}:${t.kader}/gmOpt ${t.gmOpt}${t.mensch ? " (Mensch)" : ""}`),
    unterOpt: teams.filter((t) => t.kader < t.opt).map((t) => `${t.kuerzel}:${t.kader}/${t.opt}`),
    unterGmOpt: teams.filter((t) => t.kader < t.gmOpt).map((t) => `${t.kuerzel}:${t.kader}/${t.gmOpt} ${t.kaderplanGrund ?? ""}${t.mensch ? " (Mensch)" : ""}`),
    kaderVerteilung: Object.fromEntries([...new Set(teams.map((t) => t.kader))].sort((a, b) => a - b).map((k) => [k, teams.filter((t) => t.kader === k).length])),
    fueller: teams.reduce((s, t) => s + t.fueller, 0),
    fuellerTeams: teams.filter((t) => t.fueller > 0).map((t) => `${t.kuerzel}:${t.fueller}`),
    notwege: teams.flatMap((t) => t.notwege.map((n) => `${t.kuerzel}:${n}`)),
    notkredite: teams.reduce((s, t) => s + t.notkredit, 0),
    notverkaeufe: teams.reduce((s, t) => s + t.notverkauf, 0),
    kaderpflichtAktivAmEnde: teams.filter((t) => t.kaderpflichtAktiv).map((t) => `${t.kuerzel}:${t.kaderpflichtText}`),
    kaderpflichtWarnungen: warn.filter((w) => /kaderpflicht/i.test(w)).slice(0, 40),
    kasseUnterNotruecklage: teams.filter((t) => t.notruecklage != null && t.kasse < t.notruecklage - 0.01).map((t) => `${t.kuerzel}:${t.kasse}<${t.notruecklage}`),
    negativeKassen: teams.filter((t) => t.kasse < -0.01).map((t) => `${t.kuerzel}:${t.kasse}`),
    gehalt: {
      min: quantil(gehaelter, 0),
      median: quantil(gehaelter, 0.5),
      max: quantil(gehaelter, 1),
      in50bis70: gehaelter.filter((x) => x >= 50 && x <= 70).length,
      ueber70: gehaelter.filter((x) => x > 70).length,
      unter50: gehaelter.filter((x) => x < 50).length,
    },
    transferbilanzS1NichtLeer: teams.filter((t) => t.transferbilanzS1 != null).length,
    bilanzS2: { median: quantil(teams.map((t) => t.transferbilanzS2 ?? 0), 0.5), positiv: teams.filter((t) => (t.transferbilanzS2 ?? 0) > 0).length, negativ: teams.filter((t) => (t.transferbilanzS2 ?? 0) < 0).length },
    warnungenAuszug: warn.filter((w) => /fenster|kassensturz|notkredit|notverkauf|AUSSTIEG|NOTWEG|fehl/i.test(w)).slice(0, 30),
    mensch: teams.find((t) => t.mensch),
  };
  console.log(JSON.stringify(zus, null, 2));
  schreibeDaten("s2-fenster.json", { zusammenfassung: zus, teams, laufWarnungen: warn });
}

// ------------------------------------------------------------------------------------------------ Aufnahmen

async function aufnahmen() {
  const z = ladeZustand();
  const welche = (process.argv[3] ?? "").split(",").filter(Boolean);
  const ansichten: Array<{ name: string; view: string; danach?: (p: Page) => Promise<void> }> = [
    { name: "finanzen", view: "finances" },
    {
      name: "saisonstand",
      view: "seasonV2",
      danach: async (p) => {
        await p.getByRole("button", { name: /^Verein$/ }).first().click().catch(() => undefined);
        await p.waitForTimeout(2500);
      },
    },
    { name: "historie", view: "historyV2" },
    { name: "transfermarkt", view: "marketV2" },
    { name: "kader", view: "team" },
    { name: "start", view: "home" },
  ];
  const { browser, page, fehler } = await neueSeite();
  try {
    for (const a of ansichten) {
      if (welche.length && !welche.some((w) => a.name.startsWith(w.split(":")[0]!))) continue;
      const praefix = welche.find((w) => a.name.startsWith(w.split(":")[0]!))?.split(":")[1] ?? "x";
      await page.goto(url(z, a.view), { waitUntil: "domcontentloaded", timeout: 300_000 });
      await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => undefined);
      await page.waitForTimeout(5000);
      await schliesseBriefing(page);
      if (a.danach) await a.danach(page);
      await foto(page, `${praefix}-${a.name}.png`);
    }
    schreibeDaten(`aufnahmen-browserfehler-${Date.now()}.json`, fehler);
    log(`Browserfehler: ${fehler.length} ${fehler.slice(0, 3).join(" | ")}`);
  } finally {
    await browser.close();
  }
}

/** „Weiter: Sponsor wählen“ — wie die Sponsorenseite: Angebote holen (Trockenlauf), dann das erste (Empfehlung) nehmen. */
async function sponsor() {
  const z = ladeZustand();
  const alle = (gs(z.saveId).seasonState as unknown as { sponsorOffersByTeamId?: Record<string, unknown> }).sponsorOffersByTeamId?.[z.teamId];
  const angebote = (Array.isArray(alle) ? alle : ((alle as { offers?: unknown[] } | undefined)?.offers ?? [])) as Array<Record<string, unknown>>;
  log(`Angebote ${angebote.length}: ${angebote.map((a) => `${String(a.offerId ?? a.id)}:${String(a.tier ?? a.label ?? a.name ?? "")}`).join(" | ").slice(0, 300)}`);
  const offerId = String(angebote[0]?.offerId ?? angebote[0]?.id ?? "");
  if (!offerId) throw new Error(`keine Angebote: ${JSON.stringify(alle).slice(0, 300)}`);
  const wahl = await post("/api/sponsor/choose", { saveId: z.saveId, teamId: z.teamId, source: "sqlite", dryRun: false, offerId });
  log(`Wahl ${offerId}: ${wahl.status} ${JSON.stringify(wahl.json).slice(0, 200)}`);
}

/**
 * Ein Spieltag in der echten Arena-Oberflaeche (fuer den Climbing-Canyon-Spieltag): Arena oeffnen, D1 starten, waehrend des
 * Laufs fotografieren, dann warten, bis die Oberflaeche selbst bucht. D2 und der Abschluss laufen danach ueber `spieltage`.
 */
async function arena() {
  const z = ladeZustand();
  const g0 = gs(z.saveId);
  const md = g0.matchdayState?.matchdayId ?? "";
  const diszis = disziplinenVon(g0, md);
  log(`Arena ${g0.season.id}/${md}: ${diszis.join(" + ")}`);
  // Wie die Oberflaeche nach „Spieltag abschliessen“ (startAiLineupPrewarm): KI-Aufstellungen vorwaermen. Der Abschluss lief hier
  // ueber HTTP, also stoesst der Lauf das Vorwaermen selbst an.
  const pw = await post("/api/lineups/legacy/ai-batch-prewarm", {}, `?saveId=${encodeURIComponent(z.saveId)}&seasonId=${encodeURIComponent(g0.season.id)}&matchdayId=${encodeURIComponent(md)}`);
  log(`Vorwaermen ${pw.status}`);
  const zeilenD = (g: GameState) => {
    const ids = new Set((g.seasonState.matchdayResults ?? []).filter((m) => m.seasonId === g.season.id && m.matchdayId === md).map((m) => m.id));
    return (g.seasonState.disciplineResults ?? []).filter((d) => ids.has(d.matchdayResultId) && d.disciplineId === diszis[0]).length;
  };
  const { browser, page, fehler } = await neueSeite();
  try {
    await page.goto(url(z, "matchday-arena"), { waitUntil: "domcontentloaded", timeout: 180_000 });
    await schliesseBriefing(page);
    await page.waitForFunction(() => !/WIRD GELADEN/i.test(document.body.innerText), undefined, { timeout: 180_000 }).catch(() => undefined);
    await page.waitForTimeout(6000);
    await foto(page, `${process.argv[3] ?? "x"}-arena-vorraum.png`);
    const zur = page.getByTestId("arena-prematch-start-cta");
    await zur.waitFor({ state: "visible", timeout: 120_000 }).catch(() => log("„Zur Battle Arena“ nicht sichtbar"));
    if (await zur.isVisible().catch(() => false)) await zur.click();
    await page.locator('.oly-arena-buehne[data-voll="1"]').first().waitFor({ state: "visible", timeout: 180_000 }).catch(() => log("Buehne nicht voll sichtbar"));
    await page.waitForTimeout(3000);
    await foto(page, `${process.argv[3] ?? "x"}-arena-vorstellung.png`);
    const start = page.getByTestId("arena-vorstellung-start");
    if (await start.isVisible().catch(() => false)) await start.click();
    await page.waitForTimeout(4000);
    // Die Buehne steht auf „Auf die Plaetze“ — START (Leertaste) laesst das Duell laufen.
    const los = page.getByRole("button", { name: /^START$/ }).first();
    if (await los.isVisible().catch(() => false)) await los.click();
    else await page.keyboard.press("Space");
    await page.waitForTimeout(20_000);
    await foto(page, `${process.argv[3] ?? "x"}-arena-live.png`);
    await page.waitForTimeout(20_000);
    await foto(page, `${process.argv[3] ?? "x"}-arena-live-2.png`);
    // Rest wie ein Spieler, der nicht zu Ende schauen will: Quick-Sim (bucht ueber denselben Weg wie die Buehne).
    const qs = page.getByTestId("oly-arena-buehne-quicksim");
    if (await qs.isVisible().catch(() => false)) {
      await qs.click();
      log("Quick-Sim geklickt");
    } else {
      await page.getByRole("button", { name: /Quick-Sim/ }).first().click().catch(() => log("Quick-Sim nicht gefunden"));
    }
    const ende = Date.now() + 900_000;
    while (Date.now() < ende && zeilenD(gs(z.saveId)) === 0) {
      const weiter = page.getByTestId("arena-wechsel-weiter");
      if (await weiter.isVisible().catch(() => false)) break;
      await delay(5000);
    }
    await page.waitForTimeout(4000);
    await foto(page, `${process.argv[3] ?? "x"}-arena-nach-d1.png`);
    log(`D1-Zeilen gebucht (durch die Oberflaeche): ${zeilenD(gs(z.saveId))}; Browserfehler ${fehler.length}`);
    schreibeDaten(`arena-browserfehler-${md}.json`, fehler);
  } finally {
    await browser.close();
  }
}

/** Je gebuchtem Spieltag: Disziplin-Zeilen nach Wertungsquelle (Arena oder PPS-Duell-Bruecke mit Ausfall-Grund). */
function wertung() {
  const z = ladeZustand();
  const g = gs(z.saveId);
  const zeilenJe = new Map<string, Record<string, number>>();
  const mdJe = new Map((g.seasonState.matchdayResults ?? []).map((m) => [m.id, `${m.seasonId}/${m.matchdayId}`] as const));
  for (const d of g.seasonState.disciplineResults ?? []) {
    const md = mdJe.get(d.matchdayResultId) ?? "?";
    const grund = (d as unknown as { arenaAusfall?: { grund?: string } | null }).arenaAusfall?.grund ?? "arena";
    const m = zeilenJe.get(md) ?? {};
    m[`${d.disciplineId}:${grund}`] = (m[`${d.disciplineId}:${grund}`] ?? 0) + 1;
    zeilenJe.set(md, m);
  }
  for (const [md, m] of zeilenJe) console.log(md, JSON.stringify(m));
}

/** Vertragsbilanz am Saisonwechsel: wer von den S1-Kadern ist noch da, verlaengert, per Vertragsende gegangen, verkauft. */
function vertraege() {
  const z = ladeZustand();
  const g = gs(z.saveId);
  const sid = g.season.id;
  const nr = Number(/(\d+)$/.exec(sid)?.[1] ?? 0);
  const exits = g.transferHistory.filter((e) => (e.transferType as string) === "contract_exit" || /contract_exit/.test(String(e.source ?? "")));
  const proTeam = g.teams.map((t) => {
    const k = kader(g, t.teamId);
    const draftIds = new Set((g.seasonState.ligaDraft?.verlauf ?? []).filter((e) => e.teamId === t.teamId && e.art === "pick").map((e) => e.playerId));
    const nochDa = k.filter((r) => draftIds.has(r.playerId));
    return {
      team: kuerzel(g, t.teamId),
      mensch: t.teamId === z.teamId,
      kader: k.length,
      ausS1Draft: draftIds.size,
      nochDa: nochDa.length,
      endsaisonen: k.reduce<Record<string, number>>((m, r) => ({ ...m, [String(r.contractEndSeasonNumber ?? `len${r.contractLength}`)]: (m[String(r.contractEndSeasonNumber ?? `len${r.contractLength}`)] ?? 0) + 1 }), {}),
      vertragsende: exits.filter((e) => e.fromTeamId === t.teamId).length,
      laeuftJetztAus: k.filter((r) => (r.contractEndSeasonNumber ?? 99) <= nr).length,
    };
  });
  console.log(JSON.stringify({ saison: sid, exitsGesamt: exits.length, exitTypen: [...new Set(exits.map((e) => `${e.transferType}/${e.source}`))], proTeam }, null, 1));
  schreibeDaten("s2-vertraege.json", { saison: sid, exitsGesamt: exits.length, proTeam });
}

function status() {
  const z = ladeZustand();
  const g = gs(z.saveId);
  const d = g.seasonState.ligaDraft;
  console.log(
    JSON.stringify({
      saison: g.season.id,
      phase: g.gamePhase,
      spieltag: g.matchdayState?.matchdayId,
      leagueSetupStatus: g.seasonState.leagueSetupStatus,
      draft: d ? { status: d.status, runde: d.runde, eintraege: d.verlauf.length, aktiv: Object.values(d.teams).filter((t) => t.status === "aktiv").length, aktualisiert: d.aktualisiertAm } : null,
      mein: d?.teams[z.teamId] ?? null,
      kiLauf: (g.seasonState.aiPreseasonAutomationRuns?.[g.season.id] as unknown as { status?: string } | undefined)?.status ?? null,
      sponsorMensch: (g.seasonState as unknown as { sponsorContractsByTeamId?: Record<string, { offerId?: string; seasonId?: string; signedAt?: string }> }).sponsorContractsByTeamId?.[z.teamId] ?? null,
      sponsorvertraege: Object.keys((g.seasonState as unknown as { sponsorContractsByTeamId?: Record<string, unknown> }).sponsorContractsByTeamId ?? {}).length,
      kasseMensch: g.teams.find((t) => t.teamId === z.teamId)?.cash ?? null,
      jetzt: new Date().toISOString(),
    }),
  );
}

// ------------------------------------------------------------------------------------------------ Draft ohne Browser

/** Schneller Draft fuer Folgelaeufe (nicht Gegenstand der Messung): Ueberspringen B (Auto-Draft) ueber die Route, dann warten. */
async function draftApi() {
  const z = ladeZustand();
  for (let i = 0; i < 60 && !gs(z.saveId).seasonState.ligaDraft; i += 1) await delay(2000);
  const nrVorher = gs(z.saveId).seasonState.ligaDraft?.verlauf.length ?? 0;
  const r = await post("/api/draft", { saveId: z.saveId, teamId: z.teamId, aktion: "ueberspringen", variante: "B", erwarteteNr: nrVorher });
  log(`Ueberspringen B: ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  const ende = Date.now() + 1_800_000;
  let letzte = -1;
  while (Date.now() < ende) {
    const d = gs(z.saveId).seasonState.ligaDraft;
    if (d?.status === "fertig") break;
    const nr = d?.verlauf.length ?? 0;
    log(`Draft ${d?.status} ${nr} Eintraege`);
    // Steht der Hintergrundlauf (kein Fortschritt seit dem letzten Blick), stoesst die Seite ihn an — hier dieselbe Route.
    if (nr === letzte) await post("/api/draft", { saveId: z.saveId, teamId: z.teamId, aktion: "ki_hintergrund", erwarteteNr: nr });
    letzte = nr;
    await delay(15_000);
  }
  const g = gs(z.saveId);
  log(`Draft ${g.seasonState.ligaDraft?.status}, leagueSetupStatus ${g.seasonState.leagueSetupStatus}, Phase ${g.gamePhase}`);
}

// ------------------------------------------------------------------------------------------------ Verlaengern oder freigeben

/**
 * VERLAENGERN ODER FREIGEBEN (Chris 19.11.) am Saisonende von S1, durch die Oberflaeche: Abrechnung und „Verträge öffnen“
 * wie im Finale, dann prueft der Lauf die Sperre (Vorschau und Buchung mit gueltigem Token), nimmt die Pflichtliste auf, gibt
 * einen Spieler im Browser frei (Bestaetigen-Dialog) und verlaengert einen ueber die Gehaltsverhandlung. Den Rest entscheidet
 * er ueber die Vertragsroute (abwechselnd), danach muss der Saisonwechsel durchgehen und S2 ohne `renewal_pending` beginnen.
 */
async function entscheidung() {
  const z = ladeZustand();
  const BILDER = path.join(process.cwd(), "docs", "design", "vertragsentscheidung-19-11");
  const bild = async (page: Page, name: string) => {
    fs.mkdirSync(BILDER, { recursive: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(BILDER, name) });
    log(`Bild ${name}`);
  };
  const bericht: Record<string, unknown> = {};
  let g = gs(z.saveId);
  const sid1 = g.season.id;
  const md = g.matchdayState?.matchdayId ?? g.season.matchdayIds?.[g.season.matchdayIds.length - 1] ?? "";
  const cash = await post<{ applied?: boolean }>("/api/season/cash-prize-apply", {
    saveId: z.saveId,
    seasonId: sid1,
    matchdayId: md,
    source: "sqlite",
    phase: "season_end",
    dryRun: false,
    execute: true,
    confirm: "APPLY_LOCAL_CASH_PRIZE",
  });
  log(`Abrechnung: ${cash.status} applied=${cash.json.applied}`);
  const tw = await post<{ success?: boolean }>("/api/season/transition", { saveId: z.saveId, source: "sqlite", dryRun: false, action: "open_transfer_window" });
  log(`Verträge öffnen: ${tw.status} success=${tw.json.success}`);
  g = gs(z.saveId);
  const offen = () => gs(z.saveId).rosters.filter((r) => r.teamId === z.teamId && r.contractStatus === "renewal_pending");
  bericht.phaseNachOeffnen = g.gamePhase;
  bericht.offenAmAnfang = offen().map((r) => r.playerId);
  log(`Phase ${g.gamePhase}, offen ${offen().length}`);

  type Vorschau = { summary?: { steps?: Array<{ stepId: string; confirmToken?: string; blockingReasons?: string[] }> } };
  const pv = async () => post<Vorschau>("/api/season/preseason-workflow", { saveId: z.saveId, source: "sqlite", dryRun: true });
  const v1 = await pv();
  const s1 = v1.json.summary?.steps?.find((s) => s.stepId === "next_season_setup");
  const versuch = await post<{ success?: boolean; summary?: { applied?: boolean; blockingReasons?: string[] } }>("/api/season/preseason-workflow", {
    saveId: z.saveId,
    source: "sqlite",
    dryRun: false,
    stepId: "next_season_setup",
    confirmToken: s1?.confirmToken,
  });
  bericht.sperreVorschau = s1?.blockingReasons ?? [];
  bericht.sperreBuchung = { status: versuch.status, success: versuch.json.success, blocker: versuch.json.summary?.blockingReasons };
  bericht.saisonNachSperrversuch = gs(z.saveId).season.id;
  log(`Sperre: Vorschau ${JSON.stringify(s1?.blockingReasons)}; Buchung ${versuch.status} success=${versuch.json.success}`);

  const kasse = () => gs(z.saveId).teams.find((t) => t.teamId === z.teamId)!.cash;
  const { browser, page, fehler } = await neueSeite(1600, 1000);
  try {
    page.on("dialog", (d) => {
      log(`Dialog: ${d.message().slice(0, 120)}`);
      void d.accept();
    });
    await page.goto(url(z, "seasonV2"), { waitUntil: "domcontentloaded", timeout: 180_000 });
    await schliesseBriefing(page);
    const liste = page.getByTestId("season-finale-vertragsentscheidungen");
    await liste.waitFor({ state: "visible", timeout: 180_000 });
    await liste.scrollIntoViewIfNeeded();
    await bild(page, "01-pflichtliste.png");
    bericht.listeZeilen = await liste.locator("li").count();
    bericht.startKnopfSichtbar = await page.getByRole("button", { name: "Neue Saison starten" }).isVisible().catch(() => false);

    const ersteZeile = liste.locator("li").first();
    const freiId = await ersteZeile.getAttribute("data-player");
    const kasseVor = kasse();
    await ersteZeile.getByTestId("season-finale-freigeben").click();
    for (let i = 0; i < 40 && gs(z.saveId).rosters.some((r) => r.teamId === z.teamId && r.playerId === freiId); i += 1) await delay(1000);
    const ereignis = (gs(z.saveId).seasonState.contractEvents ?? []).filter((e) => e.playerId === freiId).at(-1);
    bericht.freigabe = {
      playerId: freiId,
      kasseVor,
      kasseNach: kasse(),
      exitValue: ereignis?.exitValue,
      saleFactor: ereignis?.saleFactor,
      marketValueAtExit: ereignis?.marketValueAtExit,
      imKader: gs(z.saveId).rosters.some((r) => r.teamId === z.teamId && r.playerId === freiId),
    };
    log(`Freigegeben ${freiId}: Kasse ${kasseVor} -> ${kasse()}, Erlös ${ereignis?.exitValue}`);
    await page.waitForTimeout(3000);
    await bild(page, "02-nach-freigabe.png");

    const zweite = liste.locator("li").first();
    const verlId = await zweite.getAttribute("data-player");
    await zweite.getByTestId("season-finale-verlaengern").click();
    await page.waitForTimeout(5000);
    await bild(page, "03-verhandlung.png");
    const dialog = page.getByRole("dialog").last();
    const bestaetigen = dialog.getByRole("button", { name: /Angebot|Unterschreib|Verlänger|Bestätig/ }).last();
    await bestaetigen.click({ timeout: 30_000 }).catch((e) => log(`Bestätigen nicht klickbar: ${String(e).slice(0, 160)}`));
    for (let i = 0; i < 40 && gs(z.saveId).rosters.find((r) => r.teamId === z.teamId && r.playerId === verlId)?.contractStatus === "renewal_pending"; i += 1) {
      await delay(1000);
    }
    const verl = gs(z.saveId).rosters.find((r) => r.teamId === z.teamId && r.playerId === verlId);
    bericht.verlaengerung = { playerId: verlId, status: verl?.contractStatus, laufzeit: verl?.contractLength, endSaison: verl?.contractEndSeasonNumber, gehalt: verl?.salary };
    log(`Verlängert ${verlId}: ${JSON.stringify(bericht.verlaengerung)}`);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(3000);
    await bild(page, "04-nach-verlaengerung.png");

    let n = 0;
    for (const r of offen()) {
      const action = n % 2 === 0 ? "release" : "renew";
      const body = { saveId: z.saveId, teamId: z.teamId, playerId: r.playerId, action, contractLength: 2, source: "sqlite" };
      const vorschau = await post<{ summary?: { confirmToken?: string } }>("/api/contracts/renewal", { ...body, dryRun: true });
      const apply = await post<{ summary?: { applied?: boolean; blockingReasons?: string[] } }>("/api/contracts/renewal", {
        ...body,
        dryRun: false,
        confirmToken: vorschau.json.summary?.confirmToken,
      });
      log(`${action} ${r.playerId}: applied=${apply.json.summary?.applied} ${JSON.stringify(apply.json.summary?.blockingReasons ?? [])}`);
      n += 1;
    }
    bericht.offenNachRest = offen().map((r) => r.playerId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await schliesseBriefing(page);
    await page.locator("#season-finale").waitFor({ state: "visible", timeout: 120_000 }).catch(() => undefined);
    const pruefen = page.getByRole("button", { name: /prüfen/ }).first();
    if (await pruefen.isVisible().catch(() => false)) await pruefen.click();
    await page.getByRole("button", { name: "Neue Saison starten" }).waitFor({ state: "visible", timeout: 120_000 }).catch(() => log("Start-Knopf nicht sichtbar"));
    await page.locator("#season-finale").scrollIntoViewIfNeeded().catch(() => undefined);
    await bild(page, "05-alles-entschieden.png");
    bericht.browserfehler = fehler;
  } finally {
    await browser.close();
  }

  const v2 = await pv();
  const s2 = v2.json.summary?.steps?.find((s) => s.stepId === "next_season_setup");
  const start = await post<{ success?: boolean; summary?: { blockingReasons?: string[] } }>("/api/season/preseason-workflow", {
    saveId: z.saveId,
    source: "sqlite",
    dryRun: false,
    stepId: "next_season_setup",
    confirmToken: s2?.confirmToken,
  });
  g = gs(z.saveId);
  bericht.start = { status: start.status, success: start.json.success, blocker: start.json.summary?.blockingReasons, saison: g.season.id, phase: g.gamePhase };
  bericht.s2OhneVertrag = g.rosters
    .filter((r) => r.teamId === z.teamId && (r.contractStatus === "renewal_pending" || (r.contractLength ?? 0) <= 0))
    .map((r) => r.playerId);
  bericht.s2Kader = g.rosters.filter((r) => r.teamId === z.teamId).length;
  log(`Start: ${JSON.stringify(bericht.start)}; S2 ohne Vertrag: ${JSON.stringify(bericht.s2OhneVertrag)}`);
  fs.mkdirSync(BILDER, { recursive: true });
  fs.writeFileSync(path.join(BILDER, "bericht.json"), `${JSON.stringify(bericht, null, 2)}\n`);
}

const befehle: Record<string, () => unknown> = {
  status,
  wertung,
  vertraege,
  arena,
  sponsor,
  anlegen,
  draft,
  "messen-draft": messeDraft,
  spieltage,
  saisonende,
  "draft-api": draftApi,
  entscheidung,
  "messen-fenster": messeFenster,
  aufnahmen,
};

const befehl = process.argv[2] ?? "";
if (!SQLITE.startsWith("/tmp/")) {
  console.error("OLY_APP_SQLITE_PATH muss auf eine Wegwerf-Datei unter /tmp zeigen.");
  process.exit(2);
}
const fn = befehle[befehl];
if (!fn) {
  console.error(`Befehl fehlt: ${Object.keys(befehle).join(" | ")}`);
  process.exit(2);
}
Promise.resolve(fn()).then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
