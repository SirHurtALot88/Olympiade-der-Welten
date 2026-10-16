// BATTLE-E2E DER PPS-DUELL-BRUECKE (docs/design/pps-duell-bruecke-punkteverhaeltnis-16-10.md 5.2):
// frischer Battle-Save ueber den Wizard-Pfad (applyNewGameSetup), Liga-Draft, alle Teams KI, N
// Spieltage per Auto-Run, danach Pruefung der GEBUCHTEN Zeilen (0/1/2, Quellen, Fixture-Summen,
// Verhaeltnis) und der Tabelle. Schreibt NUR in die angegebene SQLite.
// Aufruf: OLY_APP_SQLITE_PATH=<neue datei> npx tsx scripts/e2e-battle-pps-duell.ts [spieltage] [saveId fuer reinen Bericht]
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { isBattleModeSave } from "@/lib/season/game-mode";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";

async function main() {
  const spieltage = Number(process.argv[2] ?? 3);
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const vorhanden = process.argv[3] ?? null;
  const angelegt = vorhanden ? { save: { saveId: vorhanden } } : applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const draft = vorhanden ? { status: "vorhanden", versuche: 0 } : await fuehreLigaSetupDraftAus({ persistence, saveId, seasonId: persistence.getSaveById(saveId)!.gameState.season.id, callerWritableTeamIds: null, excludeTeamIds: [], logPrefix: "[e2e]" });
  console.log("draft", draft.status, draft.versuche);
  const nachDraft = persistence.getSaveById(saveId)!;
  if (!vorhanden) persistence.saveSingleplayerState(saveId, applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }));
  const save = persistence.getSaveById(saveId)!;
  console.log("rosters", save.gameState.rosters.length);
  console.log("save", saveId, "battle", isBattleModeSave(save.gameState), "phase", save.gameState.gamePhase);
  for (let i = 0; i < spieltage; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId, seasonId, matchdayId, source: "sqlite", execute: true, dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
      },
      persistence,
    );
    console.log(matchdayId, "autoRun ok", lauf.ok, lauf.status, lauf.blockingReasons.slice(0, 5).join(" | "));
    if (!lauf.ok) break;
    const adv = await executeMatchdayAdvance({ saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN }, persistence);
    if (!adv.ok || !adv.applied) { console.log("advance blockiert", adv.blockingReasons.join(" | ")); break; }
  }
  const ende = persistence.getSaveById(saveId)!;
  const ss = ende.gameState.seasonState;
  const zeilen = ss.disciplineResults ?? [];
  const quellen = new Map<string, number>();
  let verletzt = 0;
  for (const z of zeilen) {
    quellen.set(`${z.resolutionSource}|${z.pointSource}`, (quellen.get(`${z.resolutionSource}|${z.pointSource}`) ?? 0) + 1);
    if (![0, 1, 2].includes(z.teamPoints as number)) verletzt += 1;
  }
  console.log("Disziplin-Zeilen", zeilen.length, "teamPoints ausserhalb {0,1,2}:", verletzt);
  console.log("Quellen", Object.fromEntries(quellen));
  const disziplinen = [...new Set(zeilen.map((z) => z.disciplineId))];
  console.log("Disziplinen", disziplinen.map((d) => `${d}${ARENA_RESOLVED_DISCIPLINE_IDS.has(d) ? "(arena-gewertet, Auto-Run ohne Arena -> Bruecke)" : ""}`).join(", "));
  // Je Fixture: Punkte-Summe 2, Verhaeltnis-Summe 0
  const proMd = new Map<string, typeof zeilen>();
  for (const z of zeilen) { const k = `${z.matchdayResultId}|${z.disciplineId}`; proMd.set(k, [...(proMd.get(k) ?? []), z]); }
  let fixtureFehler = 0; let fixtures = 0;
  for (const gruppe of proMd.values()) {
    const byTeam = new Map(gruppe.map((z) => [z.teamId, z] as const));
    for (const z of gruppe) {
      if (!z.opponentTeamId || z.teamId > z.opponentTeamId) continue;
      const g = byTeam.get(z.opponentTeamId)!;
      fixtures += 1;
      if ((z.teamPoints ?? 0) + (g.teamPoints ?? 0) !== 2 || (z.verhaeltnis ?? 0) + (g.verhaeltnis ?? 0) !== 0) fixtureFehler += 1;
    }
  }
  console.log("Fixtures", fixtures, "mit Summe != 2 oder Verhaeltnis != 0:", fixtureFehler);
  const dVerteilung = new Map<number, number>();
  for (const z of zeilen) if (z.verhaeltnis != null && z.verhaeltnis > 0) dVerteilung.set(z.verhaeltnis, (dVerteilung.get(z.verhaeltnis) ?? 0) + 1);
  console.log("D-Verteilung (Sieger)", Object.fromEntries([...dVerteilung].sort((a, b) => a[0] - b[0])));
  const warnRueckfall = zeilen.filter((z) => z.warnings.some((w) => w.startsWith("verhaeltnis_referenz_fehlt"))).length;
  console.log("Zeilen mit Rueckfall-D (keine Referenz):", warnRueckfall);
  const standings = Object.entries(ss.standings ?? {}).map(([teamId, r]) => ({ teamId, points: r.points, verhaeltnis: r.verhaeltnis, rank: r.rank }));
  const nichtGanz = standings.filter((s) => !Number.isInteger(s.points)).length;
  console.log("Tabelle: Teams", standings.length, "nicht-ganzzahlige Punkte:", nichtGanz);
  const liga1 = standings.filter((s) => ende.gameState.seasonState.leagueByTeamId?.[s.teamId] === "liga1").sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  console.log("Liga 1 (Rang/Punkte/Verhaeltnis):", liga1.map((s) => `${s.rank}:${s.teamId} ${s.points}/${s.verhaeltnis}`).join("  "));
  const verhSumme = (tier: string) => standings.filter((s) => ende.gameState.seasonState.leagueByTeamId?.[s.teamId] === tier).reduce((a, s) => a + (s.verhaeltnis ?? 0), 0);
  console.log("Verhaeltnis-Summe je Liga:", verhSumme("liga1"), verhSumme("liga2"));
  const ohneRang = standings.filter((s) => s.rank == null).length;
  console.log("Teams ohne Rang (block_on_tie):", ohneRang);
}

void main().catch((e) => { console.error(e); process.exitCode = 1; });
