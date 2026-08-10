/* eslint-disable no-console */
/**
 * E2E: DIE SAISONENDE-KETTE AN EINEM ECHTEN SPIELSTAND-ABBILD.
 *
 * WARUM ES DAS BRAUCHT: alle Tests zum Saisonende laufen auf Fixtures — zwei Teams, ein leerer
 * Spielplan, keine Historie. Die Fehler, die Chris gemeldet hat, entstanden aber genau da, wo
 * Fixtures nichts aussagen: 32 Teams, 3000 Spieler, eine gewachsene Transferhistorie und ein
 * Spielstand, der schon halb durch die Kette gelaufen ist. Zwei Beispiele, die kein Fixture hatte:
 *
 *   - `gamePhase: "preseason_management"` bei Spieltag 10 (die Doppeldeutigkeit, die den Liga-Draft
 *     erneut ausloeste)
 *   - `seasonTransition.currentStep` mit dem ALTEN Schrittnamen, den die umbenannte Kette nicht mehr
 *     kennt
 *
 * Dieses Skript faehrt die Kette am Abbild durch und prueft, was dabei herauskommen MUSS. Es
 * schreibt ausschliesslich in die Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt — bitte auf eine
 * KOPIE zeigen lassen, nicht auf einen Spielstand, der noch gespielt wird.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite \
 *     npx tsx scripts/e2e-saisonende-am-save-abbild.ts --save <saveId>
 *
 * Ohne `--save` wird der aktive Spielstand genommen.
 *
 * Ein Abbild bekommt man ueber den Branch `live-save` (siehe deploy/hetzner/push-live-save.sh):
 *   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > abbild.gz
 *   gunzip -c abbild.gz > kopie.sqlite
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { advanceSeasonTransitionStep, buildSeasonTransitionPreview } from "@/lib/season/season-transition-service";

type Befund = { ok: boolean; text: string };

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1];
      i += 1;
    }
  }
  return { saveId };
}

function zaehleQuelle(gameState: GameState, quelle: string) {
  return (gameState.transferHistory as Array<{ source?: string | null }>).filter((entry) => entry.source === quelle)
    .length;
}

function leseRohePhase(saveId: string): string | null {
  try {
    const row = getDatabase()
      .prepare("SELECT payload_json FROM game_metadata WHERE save_id = ?")
      .get(saveId) as { payload_json?: string } | undefined;
    if (!row?.payload_json) return null;
    return (JSON.parse(row.payload_json) as { gamePhase?: string }).gamePhase ?? null;
  } catch {
    return null;
  }
}

function zustand(gameState: GameState) {
  return {
    phase: gameState.gamePhase ?? "(keine)",
    schritt: gameState.seasonTransition?.currentStep ?? "(keiner)",
    rosterFill: zaehleQuelle(gameState, "ai_roster_fill"),
    preseasonBuy: zaehleQuelle(gameState, "ai_preseason_market_buy"),
    kader: gameState.rosters.length,
  };
}

async function main() {
  const { saveId: gewaehlt } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const start = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!start) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH pruefen.");
    process.exit(2);
    return;
  }
  const saveId = start.saveId;

  console.log(`Abbild     : ${process.env.OLY_APP_SQLITE_PATH ?? "(Standardpfad)"}`);
  console.log(`Spielstand : ${saveId} — ${start.name}`);

  // Der ROHWERT auf der Platte, absichtlich am Repository vorbei gelesen: die Ladekante schreibt
  // Altstaende um (`migrateLegacyPreseasonManagementPhase`), und genau diese Umschrift soll hier
  // nachgewiesen werden. Ueber `getSaveById` waere sie unsichtbar.
  const rohePhase = leseRohePhase(saveId);
  const vorher = zustand(start.gameState);
  console.log(
    `Ausgang    : Phase ${vorher.phase} | Schritt ${vorher.schritt} | ` +
      `ai_roster_fill ${vorher.rosterFill} | ai_preseason_market_buy ${vorher.preseasonBuy} | Kader ${vorher.kader}`,
  );

  if (!isSeasonEndPhase(start.gameState.gamePhase)) {
    console.error(
      `\nDieser Spielstand steht nicht am Saisonende (Phase ${vorher.phase}). ` +
        `Das Skript prueft die Saisonende-Kette und hat hier nichts zu messen.`,
    );
    process.exit(2);
    return;
  }

  // Bis zu so vielen Stationen, wie die Kette lang ist — die Schleife bricht ohnehin ab, sobald ein
  // Schritt nicht mehr anwendet.
  const stationen: string[] = [];
  let verkaufsMeldungen: string[] = [];
  for (let hop = 1; hop <= 9; hop += 1) {
    const aktuell = persistence.getSaveById(saveId);
    if (!aktuell) break;
    const vorschau = buildSeasonTransitionPreview(aktuell);
    const von = String(vorschau.transition.currentStep);
    const t0 = Date.now();
    const ergebnis = await advanceSeasonTransitionStep(aktuell, persistence);
    const dauer = ((Date.now() - t0) / 1000).toFixed(1);
    if (!ergebnis.applied) {
      console.log(`Hop ${hop}      : "${von}" haelt an — ${ergebnis.blockingReasons.join(", ") || "kein Grund genannt"}`);
      break;
    }
    stationen.push(`${von} → ${ergebnis.transition.currentStep}`);
    console.log(`Hop ${hop}      : ${von} → ${ergebnis.transition.currentStep}  (${dauer}s)`);
    verkaufsMeldungen = ergebnis.transition.warnings.filter((warnung) => warnung.startsWith("ai_season_end_sells"));
  }

  const ende = persistence.getSaveById(saveId);
  if (!ende) {
    console.error("Spielstand nach dem Durchlauf nicht mehr lesbar.");
    process.exit(1);
    return;
  }
  const nachher = zustand(ende.gameState);
  console.log(
    `Ende       : Phase ${nachher.phase} | ai_roster_fill ${nachher.rosterFill} | ` +
      `ai_preseason_market_buy ${nachher.preseasonBuy} | Kader ${nachher.kader}`,
  );

  const verkauft = vorher.kader - nachher.kader;
  const angewandt = verkaufsMeldungen.find((warnung) => warnung.startsWith("ai_season_end_sells_applied:"));
  const gescheitert = verkaufsMeldungen.find((warnung) => warnung.startsWith("ai_season_end_sells_failed:"));

  const befunde: Befund[] = [
    {
      // Der Kern: der Spielstand muss ueberhaupt bis ans Ende der Kette kommen. Genau das ging
      // nicht — "wir kommen nicht ueber das Saisonende hinaus".
      ok: nachher.phase === "next_season_ready",
      text: `Kette laeuft bis next_season_ready durch (steht auf ${nachher.phase})`,
    },
    {
      // Die Doppeldeutigkeit: ein Altstand traegt `preseason_management` auf der Platte, obwohl er
      // am Saisonende steht. Geprueft wird deshalb der ROHWERT gegen den aufgeloesten — ein
      // Vergleich nur auf dem geladenen Zustand koennte nie fehlschlagen, weil die Migration an der
      // Ladekante immer schon gelaufen ist.
      ok: rohePhase !== "preseason_management" || vorher.phase === "season_end_management",
      text:
        rohePhase === "preseason_management"
          ? `Altstand umgeschrieben: auf der Platte ${rohePhase} → geladen ${vorher.phase}`
          : `Phase auf der Platte bereits eindeutig (${rohePhase ?? "(keine)"})`,
    },
    {
      // Der gemeldete Fehler: der Liga-Draft feuerte am Saisonende erneut.
      ok: nachher.rosterFill === vorher.rosterFill,
      text: `kein neuer Liga-Draft (ai_roster_fill ${vorher.rosterFill} → ${nachher.rosterFill})`,
    },
    {
      ok: nachher.preseasonBuy === vorher.preseasonBuy,
      text: `keine KI-Kaeufe am Saisonende (ai_preseason_market_buy ${vorher.preseasonBuy} → ${nachher.preseasonBuy})`,
    },
    {
      // Der Schritt "Verkaeufe" war bis 0.4.11 eine reine Ankuendigung.
      ok: Boolean(angewandt) && !gescheitert,
      text: `KI-Verkaeufe sind gelaufen (${angewandt ?? gescheitert ?? "keine Meldung"}, ${verkauft} Kaderplaetze frei)`,
    },
  ];

  console.log("\n------------------------------------------------------------------");
  for (const befund of befunde) console.log(`${befund.ok ? "  OK  " : " FEHL "} ${befund.text}`);
  console.log("------------------------------------------------------------------");

  const gefallen = befunde.filter((befund) => !befund.ok);
  if (gefallen.length > 0) {
    console.error(`\n${gefallen.length} Prüfung(en) gefallen.`);
    process.exit(1);
  }
  console.log("\nAlle Prüfungen bestanden — der Spielstand kommt über das Saisonende.");
}

void main();
