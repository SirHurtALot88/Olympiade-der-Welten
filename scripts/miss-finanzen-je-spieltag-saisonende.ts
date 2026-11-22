/**
 * PAARWEISE MESSUNG DES SAISONENDES: Finanzen je Spieltag gegen alten Weg bei GLEICHEM Saisonverlauf
 * (docs/design/finanzen-je-spieltag-22-11.md, Abschnitt 8).
 *
 * Die Spieltage laufen nicht reproduzierbar (zwei Laeufe desselben Draft-Standes enden auf verschiedenen Raengen), ein
 * Vergleich zweier Komplettlaeufe misst deshalb Wuerfelrauschen. Hier wird EIN gespielter Stand (nach Spieltag N, Stempel
 * "je Spieltag", Ledger gefuellt) auf zwei Wegen abgeschlossen:
 *
 *   neu  der Stand, wie er ist: Saisonabschluss bucht den Rest (Rang, Sonderziel, Apron, Ziele, Kredit)
 *   alt  derselbe Stand, zurueckgebaut auf "alles am Saisonende": Kasse minus Summe der Spieltagsbuchungen, Ledger leer,
 *        Stempel weg — danach laeuft der unveraenderte alte Saisonabschluss
 *
 * Bei gleichem Verlauf muss die Kasse nach dem Abschluss identisch sein (Rundung 0,1 je Fluss).
 *
 *   OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/miss-finanzen-je-spieltag-saisonende.ts <saveId> neu|alt <out.json> [kauf]
 *
 * Mit `kauf` folgt nach der Saisonende-Kette der Saisonwechsel und die KI-Kaufphase der Folgesaison (derselbe Dienst wie die
 * Route /api/ai/preseason-background): damit laesst sich messen, ob die KI mit dem neuen Kassenverlauf anders kauft. Fuer
 * den Weg "alt" dazu OLY_FINANZEN_JE_SPIELTAG=aus setzen, sonst stempelt der Saisonwechsel die Folgesaison.
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { fuehreKiPreseasonLaufAus } from "@/lib/ai/ai-preseason-background-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";
import { advanceSeasonTransitionStep } from "@/lib/season/season-transition-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";

const [saveId, modus, out, kauf] = process.argv.slice(2);
if (!saveId || (modus !== "neu" && modus !== "alt") || !out) throw new Error("Aufruf: <saveId> neu|alt <out.json>");
if (!process.env.OLY_APP_SQLITE_PATH) throw new Error("OLY_APP_SQLITE_PATH (Kopie!) setzen.");

const r1 = (x: number) => Math.round(x * 10) / 10;

async function main() {
  const persistence = createPersistenceService();
  persistence.bootstrapSingleplayerSave();
  const get = () => persistence.getSaveById(saveId!)!;
  let gs: GameState = get().gameState;
  const sid = gs.season.id;
  const ledger = (gs.seasonState.spieltagFinanzen ?? []).filter((z) => z.seasonId === sid);
  const jeTeam = new Map<string, number>();
  for (const z of ledger) jeTeam.set(z.teamId, (jeTeam.get(z.teamId) ?? 0) + z.cashDelta);
  const vorher = Object.fromEntries(gs.teams.map((t) => [t.teamId, t.cash]));
  console.log(`Stand: ${gs.matchdayState.matchdayId}, Stempel ${JSON.stringify(gs.seasonState.finanzenJeSpieltag)}, Ledger-Zeilen ${ledger.length}`);

  if (modus === "alt") {
    gs = {
      ...gs,
      teams: gs.teams.map((t) => ({ ...t, cash: r1(t.cash - (jeTeam.get(t.teamId) ?? 0)) })),
      seasonState: { ...gs.seasonState, spieltagFinanzen: [], finanzenJeSpieltag: null },
    };
    persistence.saveSingleplayerState(saveId!, gs);
    console.log("zurueckgebaut auf alten Weg");
  }
  const kasseVorAbschluss = Object.fromEntries(get().gameState.teams.map((t) => [t.teamId, t.cash]));

  const comp = await runLocalSeasonCompletion(
    { saveId: saveId!, seasonId: sid, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
    persistence,
  );
  console.log(`Saisonabschluss: ok=${comp.ok} applied=${comp.applied} ${comp.blockingReasons?.join("|") ?? ""}`);
  const nachAbschluss = get().gameState;
  const kasseNachAbschluss = Object.fromEntries(nachAbschluss.teams.map((t) => [t.teamId, t.cash]));
  const rang = Object.fromEntries(nachAbschluss.teams.map((t) => [t.teamId, nachAbschluss.seasonState.standings?.[t.teamId]?.rank ?? null]));

  for (let hop = 1; hop <= 12; hop += 1) {
    const aktuell = get();
    if (!isSeasonEndPhase(aktuell.gameState.gamePhase)) break;
    const erg = await advanceSeasonTransitionStep(aktuell, persistence);
    if (!erg.applied) break;
  }
  const ende = get().gameState;
  const kasseEndeKette = Object.fromEntries(ende.teams.map((t) => [t.teamId, t.cash]));
  let kaufphase: unknown = null;
  if (kauf === "kauf") {
    const { applyPreSeasonNextSeasonSetupLightweight, buildPreSeasonNextSeasonSetupToken } = await import("@/lib/season/preseason-workflow-service");
    const tok = buildPreSeasonNextSeasonSetupToken(get()).confirmToken;
    const wechsel = applyPreSeasonNextSeasonSetupLightweight(get(), tok, persistence);
    console.log(`Saisonwechsel: applied=${wechsel.applied}`);
    const neu = get().gameState;
    const kader0 = Object.fromEntries(neu.teams.map((t) => [t.teamId, neu.rosters.filter((r) => r.teamId === t.teamId).length]));
    const lauf = await fuehreKiPreseasonLaufAus({ saveId: saveId!, seasonId: neu.season.id, scope: { room: null, participant: null, activeOwnerId: null }, persistence });
    const nach = get().gameState;
    kaufphase = {
      stempelFolgesaison: neu.seasonState.finanzenJeSpieltag ?? null,
      kaeufe: lauf.body.run?.transferBuysApplied,
      verkaeufe: lauf.body.run?.transferSellsApplied,
      aktionen: lauf.body.run?.managerActionsApplied,
      kaderDelta: Object.fromEntries(nach.teams.map((t) => [t.teamId, nach.rosters.filter((r) => r.teamId === t.teamId).length - (kader0[t.teamId] ?? 0)])),
      kasseVor: Object.fromEntries(neu.teams.map((t) => [t.teamId, t.cash])),
      kasseNach: Object.fromEntries(nach.teams.map((t) => [t.teamId, t.cash])),
    };
    console.log("Kaufphase", JSON.stringify({ kaeufe: (kaufphase as { kaeufe?: number }).kaeufe, verkaeufe: (kaufphase as { verkaeufe?: number }).verkaeufe }));
  }
  fs.writeFileSync(out!, JSON.stringify({ modus, saveId, vorher, kasseVorAbschluss, kasseNachAbschluss, kasseEndeKette, rang, ledgerJeTeam: Object.fromEntries(jeTeam), kaufphase }));
  console.log("fertig", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
