// Messung: wie lange rechnet der Arena-Vorlauf eines Spieltags, bis die Arena erscheinen kann?
// Anlass: Chris' Live-Befund 18.11. ("lange Wartezeit nach Einsatzliste abgeben, bis die Arena
// erscheint", Spieltag 1 = Climbing + Battlefield). Legt in einem WEGWERF-Store (OLY_APP_SQLITE_PATH,
// nie den echten!) einen Battle-Mode-Spielstand an, gibt allen Teams die KI-Aufstellung fuer den
// ersten Spieltag und faehrt den Vorlauf ueber den Node-Weg (`beschleunigeArenaVorlaufPerQuickSim`,
// derselbe Motor wie die Buchung, ohne Chromium). Ausgabe: Wandzeit gesamt und je Disziplin
// (`dauerMs` aus dem Vorlauf-Datensatz).
//
// Aufruf (cwd = Repo):
//   OLY_APP_SQLITE_PATH=<wegwerf.sqlite> OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 \
//     npx tsx scripts/messe-arena-vorlauf-wartezeit.ts [disziplin]
// [disziplin] (z.B. climbing): misst den ersten Spieltag, an dem sie ansteht (Standard: Spieltag 1).
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";
import { beschleunigeArenaVorlaufPerQuickSim } from "@/lib/battle/arena-vorlauf-service";
import { ensureMatchdayResolveSnapshot, readArenaVorlaufRecord } from "@/lib/foundation/matchday-resolve-snapshot";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { runBattleModeArenaMatchday } from "@/lib/resolve/battle-mode-arena-team-points";
import { runArenaFixturesNode } from "@/lib/battle/arena-node-runner";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "@/lib/battle/arena-resolved-disciplines";

async function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Wegwerf-Store) fehlt.");
  const gesuchteDisziplin = process.argv[2] || null;
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
    logPrefix: "[mess]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  const save0 = persistence.getSaveById(saveId)!;
  const seasonId = save0.gameState.season.id;
  const plan = getSeasonDisciplineSchedule(save0.gameState, { saveId });
  const eintrag = gesuchteDisziplin
    ? plan.find((e) => e.discipline1?.disciplineId === gesuchteDisziplin || e.discipline2?.disciplineId === gesuchteDisziplin)
    : null;
  const matchdayId = eintrag?.matchdayId ?? save0.gameState.matchdayState.matchdayId;
  const nummer = plan.findIndex((e) => e.matchdayId === matchdayId) + 1;
  const tag = plan.find((e) => e.matchdayId === matchdayId);
  console.log(`Spieltag ${nummer} (${matchdayId}): ${tag?.discipline1?.disciplineId} + ${tag?.discipline2?.disciplineId}`);
  applyAiLegacyLineupBatchLocally(
    { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
    persistence,
  );
  const scope = { saveId, seasonId, matchdayId };
  // Bewusst KEIN kickoffArenaVorlauf(): der startet den Chromium-Weg im Hintergrund. Der Quick-Sim
  // beginnt den Vorlauf selbst und rechnet ihn per Node. Zuerst der Spieltags-Schnappschuss (den der
  // Vorlauf sonst selbst anlegt), getrennt gemessen.
  const tSnap = Date.now();
  ensureMatchdayResolveSnapshot(scope, persistence);
  const snapMs = Date.now() - tSnap;
  const t0 = Date.now();
  const ergebnis = await beschleunigeArenaVorlaufPerQuickSim(scope, {}, persistence);
  const gesamtMs = Date.now() - t0;
  const record = readArenaVorlaufRecord(persistence.getSaveById(saveId)!.gameState, scope);
  const eintraege = Object.entries(record?.disziplinen ?? {});
  const rechnen = eintraege.reduce((a, [, e]) => a + (e.dauerMs ?? 0), 0);
  const je = eintraege.map(([d, e]) => `${d} ${e.status} ${e.dauerMs ?? "?"} ms`).join(" · ");
  console.log(`Schnappschuss ${snapMs} ms | Vorlauf weg=${ergebnis.weg} status=${ergebnis.status} gesamt ${gesamtMs} ms`
    + ` (Motor ${rechnen} ms, Rest ${gesamtMs - rechnen} ms) | ${je}`);
  // Spieltage nach dem aktuellen haben noch keinen Schnappschuss (der Vorlauf rechnet nur den laufenden
  // Spieltag). Fuer sie misst das Skript den MOTORANTEIL je Disziplin direkt -- derselbe Node-Weg, den
  // der Vorlauf je Duell-Disziplin nimmt (`runBattleModeArenaMatchday` + `runArenaFixturesNode`).
  if (ergebnis.weg === "kein_snapshot") {
    const stand = persistence.getSaveById(saveId)!.gameState;
    for (const d of [tag?.discipline1?.disciplineId, tag?.discipline2?.disciplineId]) {
      if (!d || !ARENA_RESOLVED_DISCIPLINE_IDS.has(d)) continue;
      const t = Date.now();
      const r = await runBattleModeArenaMatchday({
        gameState: stand, saveId, seasonId, matchdayId, disciplineId: d, runArenaFixturesImpl: runArenaFixturesNode,
      });
      console.log(`Motor direkt ${d}: ${Date.now() - t} ms (${r.overridesByTeamId.size} Teams, Warnungen ${r.warnings.length})`);
    }
  }
}

void main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
