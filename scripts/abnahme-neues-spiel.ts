/* eslint-disable no-console */
/**
 * ABNAHMELAUF: LAEUFT EIN NEUES SPIEL?
 *
 * DAS ZIEL DES EIGENTUEMERS (Chris), woertlich: „main target ist es das durch zu bekommen und wenn
 * das sauber drin ist und funktioniert ich endlich mal n spiel starten kann was halbwegs
 * funktioniert mit passenden kaeufen verkaeufen finanzen und punkten".
 *
 * WARUM ES DAS BRAUCHT: bisher ist jede Reparatur EINZELN geprueft worden — die Sponsorleiter
 * stimmt, die Punkte stimmen, die Kassen schliessen. Ein Haufen gruener Einzeltests ist aber kein
 * funktionierendes Spiel. Dieser Lauf legt ein FRISCHES Spiel an, spielt eine ganze Saison und
 * fuehrt sie ueber den Saisonwechsel — und misst dabei genau die vier Dinge, die Chris genannt hat.
 *
 * JEDE ZAHL WIRD ZWEIMAL HERGELEITET. Nicht dieselbe Funktion zweimal fragen, sondern gegen die
 * Rohdaten rechnen — genau daran sind hier schon mehrfach Fehler durchgerutscht.
 *
 * FEHLER GEGEN AUFFAELLIGKEIT: eine Kasse, die sich nicht schliesst, ist ein FEHLER. Ein Team, das
 * tief ins Minus rutscht, ist AUFFAELLIG — das schaut sich Chris an und entscheidet.
 *
 * Nutzung (immer auf eine Wegwerf-Datei zeigen lassen):
 *   OLY_APP_SQLITE_PATH=/tmp/abnahme.sqlite npx tsx scripts/abnahme-neues-spiel.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getRankToPointsValue, resolveDisciplinePlayerCount } from "@/lib/resolve/rank-to-points";
import { MATCHDAY_AUTO_RUN_CONFIRM_TOKEN, runLocalMatchdayAutoRun } from "@/lib/season/matchday-auto-run-service";
import { kickoffLeagueSetupDraft } from "@/lib/game/league-setup-draft-service";
import { isSeasonEndPhase } from "@/lib/season/season-transition-chain";
import { advanceSeasonTransitionStep } from "@/lib/season/season-transition-service";

const fehler: string[] = [];
const auffaellig: string[] = [];

function z(wert: number, stellen = 2) {
  return wert.toFixed(stellen);
}

/** Punkte je Team, unabhaengig aus den gebuchten Disziplin-Zeilen nachgerechnet. */
function punkteAusRohdaten(gameState: GameState): Map<string, number> {
  const proTeam = new Map<string, number>();
  // Die Spieleranzahl steht NICHT an der Ergebniszeile — sie kommt aus dem Disziplin-Spielplan.
  // (Beim ersten Anlauf habe ich sie an der Zeile gesucht, `undefined` bekommen und daraufhin fuer
  // alle 32 Teams 0 Punkte "nachgerechnet" — eine zweite Herleitung, die nichts herleitet, ist
  // schlimmer als keine.)
  const spieltagIdJeErgebnis = new Map(
    (gameState.seasonState.matchdayResults ?? []).map((eintrag) => [eintrag.id, eintrag.matchdayId] as const),
  );
  for (const zeile of gameState.seasonState.disciplineResults ?? []) {
    const matchdayId = spieltagIdJeErgebnis.get(zeile.matchdayResultId) ?? null;
    if (!matchdayId) continue;
    const anzahl = resolveDisciplinePlayerCount(gameState, {
      matchdayId,
      disciplineId: zeile.disciplineId,
      disciplineSide: zeile.disciplineSide,
    });
    const rang = zeile.rank ?? null;
    if (anzahl == null || rang == null) continue;
    const punkte = getRankToPointsValue(anzahl, rang) ?? 0;
    proTeam.set(zeile.teamId, (proTeam.get(zeile.teamId) ?? 0) + punkte);
  }
  return proTeam;
}

async function main() {
  const persistence = createPersistenceService();

  console.log("=== ABNAHMELAUF: NEUES SPIEL ===\n");
  const save = persistence.createFreshSeasonOneSave({ name: "Abnahmelauf" });
  const saveId = save.saveId;
  let gameState = save.gameState;
  const seasonId = gameState.season.id;
  console.log(`Spielstand ${saveId} | Saison ${seasonId} | Teams ${gameState.teams.length} | Spieler ${gameState.players.length}`);

  // ---------------------------------------------------------------- Liga-Draft
  //
  // EIN FRISCHER SPIELSTAND HAT LEERE KADER — der Grundstock entsteht erst durch den
  // Whole-League-Draft. Ohne ihn tritt niemand an, und der Lauf misst nur das eigene Versaeumnis.
  // (Genau darauf bin ich beim ersten Anlauf hereingefallen: 1 Spieler je Team, alle Spieltage
  // scheiterten an "Only 0/3 players available".)
  console.log("--- Liga-Draft ---");
  const nachDraft = kickoffLeagueSetupDraft({ persistence, saveId });
  if (!nachDraft) {
    fehler.push("Liga-Draft nicht angelaufen — ohne Kader ist der Rest des Laufs wertlos");
  }
  // Der Draft laeuft im Hintergrund; auf den Abschluss warten, statt blind weiterzumachen.
  for (let versuch = 0; versuch < 120; versuch += 1) {
    const stand = persistence.getSaveById(saveId)?.gameState.seasonState.leagueSetupStatus ?? null;
    if (stand === "ready" || stand === "failed") {
      console.log(`  Draft ${stand} nach ${versuch} Runden Warten`);
      if (stand === "failed") fehler.push("Liga-Draft gescheitert");
      break;
    }
    await new Promise((fertig) => setTimeout(fertig, 1000));
  }
  gameState = persistence.getSaveById(saveId)!.gameState;

  const startKasse = new Map(gameState.teams.map((team) => [team.teamId, team.cash] as const));
  const startKader = new Map<string, number>();
  for (const eintrag of gameState.rosters) {
    startKader.set(eintrag.teamId, (startKader.get(eintrag.teamId) ?? 0) + 1);
  }
  console.log(
    `Startkasse: min ${z(Math.min(...startKasse.values()))} / max ${z(Math.max(...startKasse.values()))}` +
      ` | Kadergroesse: min ${Math.min(...startKader.values())} / max ${Math.max(...startKader.values())}\n`,
  );

  // ---------------------------------------------------------------- Saison spielen
  //
  // `runLocalMatchdayAutoRun` stellt die KI-Aufstellungen SELBST (es ruft intern
  // `applyAiLegacyLineupBatchLocally` und `prepareGameStateForMatchdayResolve`) — hier also nur
  // Spieltag fuer Spieltag durchbuchen und den Fortschritt lesen, statt danebenzubauen.
  const spieltagIds = gameState.season.matchdayIds ?? [];
  console.log(`Spielplan: ${spieltagIds.length} Spieltage\n--- Saison wird gespielt ---`);

  let gespielt = 0;
  for (let runde = 0; runde < spieltagIds.length; runde += 1) {
    const aktuell = persistence.getSaveById(saveId);
    if (!aktuell) break;
    const matchdayId = aktuell.gameState.matchdayState?.matchdayId ?? null;
    if (!matchdayId || !spieltagIds.includes(matchdayId)) {
      auffaellig.push(`Kein gueltiger aktueller Spieltag mehr nach ${gespielt} Runden (${matchdayId ?? "keiner"})`);
      break;
    }

    const ergebnis = await runLocalMatchdayAutoRun({
      saveId,
      seasonId,
      matchdayId,
      source: "sqlite",
      execute: true,
      confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: { includeWarningLineups: true, overwriteExistingLineups: false, stopOnTie: false },
    }).catch((error) => {
      fehler.push(`Spieltag ${matchdayId} warf: ${(error as Error).message.slice(0, 160)}`);
      return null;
    });
    if (!ergebnis) break;
    if (!ergebnis.ok) {
      fehler.push(`Spieltag ${matchdayId} nicht gebucht: ${(ergebnis.warnings ?? []).slice(0, 3).join(" | ")}`);
      break;
    }
    gespielt += 1;
    if (gespielt % 3 === 0 || gespielt === spieltagIds.length) {
      console.log(`  ${gespielt}/${spieltagIds.length} Spieltage gebucht`);
    }
  }

  gameState = persistence.getSaveById(saveId)!.gameState;
  console.log(`\nGespielt: ${gespielt} von ${spieltagIds.length} Spieltagen.\n`);

  // ---------------------------------------------------------------- Block 4: Punkte
  console.log("=== PUNKTE ===");
  const stand = gameState.seasonState.standings ?? {};
  const roh = punkteAusRohdaten(gameState);
  let punkteAbweichend = 0;
  let maxPunkteDelta = 0;
  for (const team of gameState.teams) {
    const gebucht = stand[team.teamId]?.points ?? 0;
    const nachgerechnet = roh.get(team.teamId) ?? 0;
    const delta = Math.abs(gebucht - nachgerechnet);
    if (delta > 0.2) punkteAbweichend += 1;
    maxPunkteDelta = Math.max(maxPunkteDelta, delta);
  }
  console.log(`Teampunkte gegen unabhaengige Nachrechnung: ${punkteAbweichend} von 32 abweichend, max ${z(maxPunkteDelta)}`);
  if (punkteAbweichend > 0) fehler.push(`Punkte: ${punkteAbweichend} von 32 Teams weichen ab (max ${z(maxPunkteDelta)})`);

  const sortiert = [...gameState.teams].sort((a, b) => (stand[b.teamId]?.points ?? 0) - (stand[a.teamId]?.points ?? 0));
  const rangFalsch = sortiert.filter((team, index) => (stand[team.teamId]?.rank ?? 0) !== index + 1).length;
  console.log(`Tabellenraenge gegen unabhaengige Sortierung: ${rangFalsch} von 32 abweichend`);
  if (rangFalsch > 2) auffaellig.push(`Tabelle: ${rangFalsch} Raenge weichen von der reinen Punktsortierung ab (Gleichstandsregeln?)`);

  // ---------------------------------------------------------------- Saisonwechsel
  console.log("\n--- Saisonwechsel ---");
  let schritte = 0;
  while (isSeasonEndPhase(persistence.getSaveById(saveId)!.gameState.gamePhase) && schritte < 20) {
    const vorher = persistence.getSaveById(saveId)!;
    const ergebnis = await advanceSeasonTransitionStep(vorher, persistence).catch((error) => {
      fehler.push(`Saisonwechsel gestoppt: ${(error as Error).message.slice(0, 160)}`);
      return null;
    });
    if (!ergebnis) break;
    schritte += 1;
    const nachher = persistence.getSaveById(saveId)!.gameState;
    const rueckmeldung = ergebnis as unknown as Record<string, unknown>;
    const hinweise = [
      rueckmeldung.blockers,
      rueckmeldung.warnings,
      rueckmeldung.issues,
      rueckmeldung.reason,
      rueckmeldung.message,
    ]
      .filter(Boolean)
      .map((wert) => (Array.isArray(wert) ? wert.slice(0, 3).join(" | ") : String(wert)))
      .filter((text) => text.length > 0);
    console.log(
      `  Schritt ${schritte}: Phase ${nachher.gamePhase}` +
        `${hinweise.length > 0 ? `  << ${hinweise.join(" ; ").slice(0, 200)}` : ""}`,
    );
    if (schritte > 1 && nachher.gamePhase === vorher.gameState.gamePhase) {
      // Steht die Kette, ist das entweder ein Tor, das auf eine Eingabe wartet, oder ein Fehler.
      // Beides gehoert benannt — nicht stillschweigend als "durchgelaufen" verbucht.
      auffaellig.push(
        `Saisonwechsel bleibt bei Phase ${nachher.gamePhase} stehen (Schritt ${schritte})` +
          `${hinweise.length > 0 ? `: ${hinweise.join(" ; ").slice(0, 200)}` : " — ohne Begruendung in der Rueckmeldung"}`,
      );
      break;
    }
  }
  gameState = persistence.getSaveById(saveId)!.gameState;

  // ---------------------------------------------------------------- Bloecke 1+2: Kaeufe/Verkaeufe
  console.log("\n=== KAEUFE UND VERKAEUFE ===");
  const historie = gameState.transferHistory ?? [];
  const proTyp = new Map<string, number>();
  for (const eintrag of historie) {
    const typ = String((eintrag as unknown as Record<string, unknown>).transferType ?? (eintrag as unknown as Record<string, unknown>).type ?? "?");
    proTyp.set(typ, (proTyp.get(typ) ?? 0) + 1);
  }
  console.log(`Transferhistorie: ${historie.length} Eintraege`);
  for (const [typ, anzahl] of [...proTyp].sort((a, b) => b[1] - a[1])) console.log(`  ${anzahl}x ${typ}`);

  const kaderJetzt = new Map<string, number>();
  for (const eintrag of gameState.rosters) kaderJetzt.set(eintrag.teamId, (kaderJetzt.get(eintrag.teamId) ?? 0) + 1);
  const zuKlein = gameState.teams.filter((team) => (kaderJetzt.get(team.teamId) ?? 0) < 6);
  console.log(
    `Kadergroesse nach dem Wechsel: min ${Math.min(...kaderJetzt.values())} / max ${Math.max(...kaderJetzt.values())}` +
      ` | unter 6 Spielern: ${zuKlein.length}`,
  );
  if (zuKlein.length > 0) {
    fehler.push(`Kader: ${zuKlein.length} Teams unter 6 Spielern (${zuKlein.map((t) => t.teamId).join(", ")}) — die Wiederauffuellung greift nicht`);
  }

  // ---------------------------------------------------------------- Block 3: Finanzen
  console.log("\n=== FINANZEN ===");
  const kasseJetzt = new Map(gameState.teams.map((team) => [team.teamId, team.cash] as const));
  let pleite = 0;
  let tiefstes = 0;
  for (const [teamId, cash] of kasseJetzt) {
    if (cash < 0) {
      pleite += 1;
      tiefstes = Math.min(tiefstes, cash);
      if (cash < -50) auffaellig.push(`${teamId} steht bei ${z(cash)} — tief im Minus`);
    }
  }
  console.log(`Kasse: min ${z(Math.min(...kasseJetzt.values()))} / max ${z(Math.max(...kasseJetzt.values()))} | negativ: ${pleite} Teams`);
  if (pleite > 8) auffaellig.push(`${pleite} von 32 Teams stehen im Minus (tiefstes ${z(tiefstes)})`);

  // ---------------------------------------------------------------- Fazit
  console.log("\n=== FEHLER ===");
  console.log(fehler.length === 0 ? "keine" : fehler.map((zeile) => `  ! ${zeile}`).join("\n"));
  console.log("\n=== AUFFAELLIG (Zahlen fuer Chris, keine Fehler) ===");
  console.log(auffaellig.length === 0 ? "keine" : auffaellig.slice(0, 12).map((zeile) => `  ? ${zeile}`).join("\n"));

  console.log(`\nWuerde ich auf diesem Stand ein Spiel anfangen? ${fehler.length === 0 ? "JA" : "NEIN"} — begruendet durch die Zahlen oben.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
