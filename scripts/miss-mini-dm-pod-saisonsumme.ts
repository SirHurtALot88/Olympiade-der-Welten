// ===================================================================================
// SAISONSUMMEN-SONDE FUER DEN MINI-DM-POD-RESOLVE (19.10., Chris: "3 -> umbauen dass die 4er
// teams da drin sind!!!"). Vorlage: scripts/miss-battle-pp-saisonsumme.ts (PR #1296, PP-Budget).
//
// Fuehrt einen echten Battle-Mode-Save ueber denselben Wizard-/Auto-Run-Pfad wie ein echtes Spiel
// durch mehrere Spieltage (mindestens zwei Mini-DM-Vorkommen je Saison) und prueft:
//   - JEDE Mini-DM-Zeile in einem Battle-Save traegt `resolutionSource: "mini_dm_pod"` -- NIE mehr
//     "pps_duell" (der alte, falsch gepaarte Zwei-Team-Weg) oder "pps" (Rangtabelle).
//   - Jeder Pod hat GENAU die Plaetze 1,2,3,4 (je einmal), Liga-Punkte 2-1-0-0, Summe 3.
//   - Die 0-10-Normierung (`miniDmPod.wert`) ist je Pod monoton nicht-steigend mit dem Platz
//     (Ordnungsgarantie, `berechneErgebnisNormiertNTeam()`) -- am ECHTEN Save, nicht nur im Unit-Test.
//   - Tabellenpunkte je Team bleiben exakt Σ (2-1-0-0-Anteile ueber alle Pods + 2/1/0 ueber alle
//     Duelle) -- dieselbe Entkopplung von `teamSummary.totalPoints` gegen die Spieler-PP wie bei
//     PR #1296, jetzt auch fuer Mini-DM-Pod-Zeilen.
//
// AUFRUF (frische, lokale SQLite -- NIE den Produktions-/Abbild-Store):
//   OLY_APP_SQLITE_PATH=/tmp/oly-miss-minidm-$$.sqlite npx tsx scripts/miss-mini-dm-pod-saisonsumme.ts \
//     [spieltage=20]
// ===================================================================================
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyNewGameSetup, previewNewGameSetup } from "@/lib/game/new-game-setup-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import { fuehreLigaSetupDraftAus } from "@/lib/game/league-setup-draft-service";
import { applyGameModeOwnership } from "@/lib/foundation/team-control-settings";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { MINI_DM_POD_TEAM_PUNKTE } from "@/lib/resolve/mini-dm-pod-resolve";

const MINI_DM = "mini-dm";
const spieltage = Number(process.argv[2] ?? 20);

async function main() {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const input = { presetId: "solo_1" as const, gameMode: "battle" as const };
  const preview = previewNewGameSetup(input);
  const angelegt = applyNewGameSetup({ ...input, confirmToken: preview.confirmToken }, persistence, { ownerId: null });
  const saveId = angelegt.save.saveId;
  const draft = await fuehreLigaSetupDraftAus({
    persistence,
    saveId,
    seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
    callerWritableTeamIds: null,
    excludeTeamIds: [],
    logPrefix: "[miss-mini-dm-pod]",
  });
  const nachDraft = persistence.getSaveById(saveId)!;
  persistence.saveSingleplayerState(
    saveId,
    applyGameModeOwnership(nachDraft.gameState, { saveMode: "solo_1", chrisTeamIds: [], frankyTeamIds: [] }),
  );
  console.log(`save=${saveId} draft=${draft.status}/${draft.versuche}`);

  let gespielt = 0;
  for (let i = 0; i < spieltage; i += 1) {
    const aktuell = persistence.getSaveById(saveId)!;
    const seasonId = aktuell.gameState.season.id;
    const matchdayId = aktuell.gameState.matchdayState.matchdayId;
    const lauf = await runLocalMatchdayAutoRun(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: { includeWarningLineups: true, overwriteExistingLineups: true, stopOnTie: false, advanceAfterCashApply: false },
      },
      persistence,
    );
    if (!lauf.ok) {
      console.log(`${matchdayId} autoRun blockiert: ${lauf.blockingReasons.slice(0, 3).join(" | ")}`);
      break;
    }
    const adv = await executeMatchdayAdvance(
      { saveId, seasonId, source: "sqlite", execute: true, confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN },
      persistence,
    );
    if (!adv.ok || !adv.applied) {
      console.log(`Spieltagswechsel blockiert: ${adv.blockingReasons.join(" | ")}`);
      break;
    }
    gespielt += 1;
  }

  const ende = persistence.getSaveById(saveId)!;
  const gs = ende.gameState;
  const zeilen = (gs.seasonState.disciplineResults ?? []).filter((z) => z.disciplineId === MINI_DM);
  console.log(`Spieltage gespielt=${gespielt} Mini-DM-Zeilen=${zeilen.length}`);

  let nichtPod = 0;
  const podGruppen = new Map<string, typeof zeilen>();
  for (const z of zeilen) {
    if (z.resolutionSource !== "mini_dm_pod" || !z.miniDmPod) {
      nichtPod += 1;
      continue;
    }
    const gruppe = podGruppen.get(z.miniDmPod.podId) ?? [];
    gruppe.push(z);
    podGruppen.set(z.miniDmPod.podId, gruppe);
  }

  let podsFalscheGroesse = 0;
  let podsFalschePlaetze = 0;
  let podsFalschePunkte = 0;
  let podsOrdnungsverletzung = 0;
  for (const [podId, gruppe] of podGruppen) {
    if (gruppe.length !== 4) {
      podsFalscheGroesse += 1;
      console.log(`Pod ${podId}: ${gruppe.length} Zeilen statt 4`);
      continue;
    }
    const plaetze = gruppe.map((z) => z.miniDmPod!.platz).sort((a, b) => a - b);
    if (JSON.stringify(plaetze) !== JSON.stringify([1, 2, 3, 4])) {
      podsFalschePlaetze += 1;
      console.log(`Pod ${podId}: Plaetze ${JSON.stringify(plaetze)} statt [1,2,3,4]`);
    }
    const summePunkte = gruppe.reduce((sum, z) => sum + (z.teamPoints ?? 0), 0);
    if (summePunkte !== 3) {
      podsFalschePunkte += 1;
      console.log(`Pod ${podId}: Summe Liga-Punkte ${summePunkte} statt 3`);
    }
    for (const z of gruppe) {
      const erwartetePunkte = MINI_DM_POD_TEAM_PUNKTE[z.miniDmPod!.platz - 1];
      if (z.teamPoints !== erwartetePunkte) {
        podsFalschePunkte += 1;
        console.log(`Pod ${podId}, Team ${z.teamId}: Platz ${z.miniDmPod!.platz} hat ${z.teamPoints} Pkt statt ${erwartetePunkte}`);
      }
    }
    // ORDNUNGSGARANTIE am echten Save: `wert` monoton nicht-steigend mit dem Platz.
    const nachPlatz = [...gruppe].sort((a, b) => a.miniDmPod!.platz - b.miniDmPod!.platz);
    for (let i = 0; i < nachPlatz.length - 1; i += 1) {
      const wertBesser = nachPlatz[i]!.miniDmPod!.wert;
      const wertSchlechter = nachPlatz[i + 1]!.miniDmPod!.wert;
      if (wertBesser < wertSchlechter) {
        podsOrdnungsverletzung += 1;
        console.log(`Pod ${podId}: Ordnungsverletzung Platz ${i + 1} (${wertBesser}) < Platz ${i + 2} (${wertSchlechter})`);
      }
    }
  }

  // TABELLEN-KONSISTENZ (analog PR #1296): Σ aller gebuchten Duell-/Pod-Punkte je Team muss exakt
  // `teamSummary.totalPoints` ergeben -- unabhaengig von den leistungsbasierten Spieler-PP.
  const ledger = buildSeasonPointsLedger(gs, gs.season.id);
  const sumByTeam = new Map<string, number>();
  for (const z of gs.seasonState.disciplineResults ?? []) {
    if (z.resolutionSource === "arena" || z.resolutionSource === "pps_duell" || z.resolutionSource === "mini_dm_pod") {
      sumByTeam.set(z.teamId, (sumByTeam.get(z.teamId) ?? 0) + (z.teamPoints ?? 0));
    }
  }
  let tabelleFalsch = 0;
  for (const team of gs.teams) {
    const summary = ledger.teamSummariesByTeamId.get(team.teamId);
    const erwartet = sumByTeam.get(team.teamId) ?? 0;
    if (Math.abs((summary?.totalPoints ?? 0) - erwartet) > 1e-6) {
      tabelleFalsch += 1;
      console.log(`Team ${team.teamId}: Tabelle ${summary?.totalPoints} statt erwartet ${erwartet}`);
    }
  }

  console.log("=".repeat(70));
  console.log(
    `Pods gesamt=${podGruppen.size} falsche-Groesse=${podsFalscheGroesse} falsche-Plaetze=${podsFalschePlaetze} ` +
      `falsche-Punkte=${podsFalschePunkte} Ordnungsverletzungen=${podsOrdnungsverletzung} nicht-Pod-Zeilen=${nichtPod} ` +
      `Tabellen-Abweichungen=${tabelleFalsch}`,
  );
  const bestanden =
    podGruppen.size > 0 &&
    nichtPod === 0 &&
    podsFalscheGroesse === 0 &&
    podsFalschePlaetze === 0 &&
    podsFalschePunkte === 0 &&
    podsOrdnungsverletzung === 0 &&
    tabelleFalsch === 0;
  console.log(bestanden ? "ABNAHME: bestanden" : "ABNAHME: NICHT bestanden -- s. Werte oben");
  process.exitCode = bestanden ? 0 : 1;
}

void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
