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
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";
import { runAiPicksExecutePreview } from "@/lib/ai/ai-picks-run-service";
import { kickoffLeagueSetupDraft } from "@/lib/game/league-setup-draft-service";
import { chooseSponsorOfferForAiTeams } from "@/lib/sponsor/sponsor-offer-service";
import { CASH_PRIZE_APPLY_CONFIRM_TOKEN, executeCashPrizeApply } from "@/lib/season/cash-prize-apply-service";
import {
  applyPreSeasonNextSeasonSetup,
  buildPreSeasonWorkflowPreview,
} from "@/lib/season/preseason-workflow-service";
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
  const nachDraft = kickoffLeagueSetupDraft({ persistence, saveId, logPrefix: "[abnahme]" });
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

  // ---------------------------------------------------------------- Sponsoren
  //
  // OHNE SPONSOREN IST DIE FINANZPRUEFUNG WERTLOS — genau das hat Chris zurueckgefragt: "wie
  // willst du die finanzen pruefen wenn kein team sponsoren in S1 hatte?". Er hat recht.
  //
  // Die Angebote entstehen NICHT von selbst: `ensureSeasonSponsorOffers` erzeugt sie erst, wenn
  // sie jemand anfordert — im Browser tut das die Sponsoren-Ansicht, im kopflosen Lauf niemand.
  // Gemessen: vor dem Aufruf 0 Teams mit Angeboten, danach 32 mit je 5. Der Lauf muss also tun,
  // was ein Spieler tut, sonst misst er eine Liga ohne Einnahmenseite.
  console.log("--- Sponsoren ---");
  const mitSponsoren = chooseSponsorOfferForAiTeams(persistence.getSaveById(saveId)!.gameState);
  persistence.saveSingleplayerState(saveId, mitSponsoren, {} as never);
  gameState = persistence.getSaveById(saveId)!.gameState;
  const vertraegeS1 = Object.keys(
    (gameState.seasonState as unknown as Record<string, Record<string, unknown>>).sponsorContractsByTeamId ?? {},
  ).length;
  console.log(`  Teams mit Sponsorvertrag: ${vertraegeS1} von 32`);
  if (vertraegeS1 < 32) {
    fehler.push(`Nur ${vertraegeS1} von 32 Teams haben einen Sponsorvertrag — ohne Einnahmenseite ist die Finanzpruefung wertlos`);
  }

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

  /**
   * RANGPRUEFUNG MIT PUNKTGLEICHHEIT.
   *
   * Vorher wurde stur nach Punkten sortiert und Position gegen gebuchten Rang gehalten. Bei
   * Gleichstand ist das keine Pruefung, sondern Zufall: `Array.prototype.sort` ist stabil und
   * laesst punktgleiche Teams in der Reihenfolge von `gameState.teams` stehen (alphabetisch),
   * waehrend die echte Tabelle eine Feinwertung anlegt. Ein einziger Gleichstand meldete damit
   * ZWEI Abweichungen, ohne dass irgendetwas falsch war — gemessen an einem Lauf, in dem T-T und
   * M-M beide auf 130,3 Punkte kamen. Der Schnappschuss derselben Saison zeigte 0 Abweichungen.
   *
   * Richtig ist: punktgleiche Teams duerfen die Raenge ihrer Gruppe UNTEREINANDER frei verteilen.
   * Gemeldet wird nur, wenn ein Team einen Rang AUSSERHALB des Blocks bekommt, den seine
   * Punktzahl beansprucht — das waere ein echter Fehler.
   */
  const sortiert = [...gameState.teams].sort((a, b) => (stand[b.teamId]?.points ?? 0) - (stand[a.teamId]?.points ?? 0));
  let rangFalsch = 0;
  for (let start = 0; start < sortiert.length; ) {
    const punkte = stand[sortiert[start]!.teamId]?.points ?? 0;
    let ende = start;
    while (ende < sortiert.length && (stand[sortiert[ende]!.teamId]?.points ?? 0) === punkte) ende += 1;
    const erlaubteRaenge = new Set<number>();
    for (let position = start; position < ende; position += 1) erlaubteRaenge.add(position + 1);
    for (let position = start; position < ende; position += 1) {
      if (!erlaubteRaenge.has(stand[sortiert[position]!.teamId]?.rank ?? 0)) rangFalsch += 1;
    }
    start = ende;
  }
  console.log(`Tabellenraenge gegen unabhaengige Sortierung: ${rangFalsch} von 32 abweichend`);
  if (rangFalsch > 2) auffaellig.push(`Tabelle: ${rangFalsch} Raenge weichen von der reinen Punktsortierung ab (Gleichstandsregeln?)`);

  // ---------------------------------------------------------------- Saisonende-Abrechnung
  //
  // DIE KETTE HAT HIER EIN TOR, UND ES IST EIN GUTES: der Schritt "Finanzen" ist blockiert,
  // solange Sponsorgeld, Preisgeld, Gebaeudeunterhalt und Apron nicht gebucht sind
  // (`season_end_cash_settlement_pending`). Frueher liess sich der Schritt einfach
  // weiterklicken — dann lief die Kette bis in die neue Saison, OHNE dass je Geld geflossen
  // waere, und der eingefrorene Kontostand hielt eine Zahl fest, die es nie gab.
  // Der Abnahmelauf muss also dasselbe tun wie ein Spieler: erst abrechnen, dann weiter.
  console.log("\n--- Saisonende-Abrechnung ---");
  const abrechnung = await executeCashPrizeApply({
    saveId,
    seasonId,
    source: "sqlite",
    confirm: CASH_PRIZE_APPLY_CONFIRM_TOKEN,
  } as never).catch((error) => {
    fehler.push(`Saisonende-Abrechnung warf: ${(error as Error).message.slice(0, 160)}`);
    return null;
  });
  if (abrechnung) {
    const r = abrechnung as unknown as Record<string, unknown>;
    console.log(`  gebucht: ${String(r.applied)}${r.blockingReasons && (r.blockingReasons as unknown[]).length ? `  << ${(r.blockingReasons as unknown[]).slice(0, 3).join(" | ")}` : ""}`);
    if (r.applied !== true) fehler.push(`Saisonende-Abrechnung nicht gebucht: ${JSON.stringify(r.blockingReasons ?? r.warnings ?? "ohne Begruendung").slice(0, 160)}`);
  }
  const kasseNachAbrechnung = new Map(persistence.getSaveById(saveId)!.gameState.teams.map((t) => [t.teamId, t.cash] as const));
  let bewegt = 0;
  for (const [teamId, cash] of kasseNachAbrechnung) {
    if (Math.abs(cash - (startKasse.get(teamId) ?? 0)) > 0.01) bewegt += 1;
  }
  console.log(`  Kassen bewegt: ${bewegt} von 32`);
  if (bewegt === 0) fehler.push("Die Saisonende-Abrechnung hat keine einzige Kasse bewegt");

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

  // ---------------------------------------------------------------- Neue Saison starten
  //
  // Die Kette endet bei `next_season_ready` und wartet auf eine Bestaetigung
  // (`next_season_apply_requires_preseason_confirm`) — das ist der Knopf, den ein Spieler drueckt.
  // Ohne ihn gibt es keine Saison 2, und damit auch keine Kaufphase, in der sich die Kader wieder
  // fuellen. Der Lauf holt sich das Token aus der Vorschau, statt eins zu erfinden.
  console.log("\n--- Neue Saison starten ---");
  const vorSaison2 = persistence.getSaveById(saveId)!;
  const vorschau = await buildPreSeasonWorkflowPreview(vorSaison2, persistence).catch((error) => {
    fehler.push(`Preseason-Vorschau warf: ${(error as Error).message.slice(0, 160)}`);
    return null;
  });
  const token = vorschau?.steps.find((schritt) => schritt.stepId === "next_season_setup")?.confirmToken ?? null;
  if (!token) {
    fehler.push("Kein Bestaetigungs-Token fuer den Saisonstart — die neue Saison ist von hier nicht erreichbar");
  } else {
    const gestartet = await applyPreSeasonNextSeasonSetup(vorSaison2, token, persistence).catch((error) => {
      fehler.push(`Saisonstart warf: ${(error as Error).message.slice(0, 160)}`);
      return null;
    });
    if (gestartet && gestartet.applied !== true) {
      fehler.push(`Saisonstart nicht angewandt: ${(gestartet.blockingReasons ?? []).slice(0, 3).join(" | ")}`);
    }
  }
  gameState = persistence.getSaveById(saveId)!.gameState;
  console.log(`  Saison jetzt: ${gameState.season.id} | Phase ${gameState.gamePhase}`);

  // Sponsoren der NEUEN Saison — dieselbe Frage wie in Saison 1: picken die Teams wieder?
  const mitSponsoren2 = chooseSponsorOfferForAiTeams(gameState);
  persistence.saveSingleplayerState(saveId, mitSponsoren2, {} as never);
  gameState = persistence.getSaveById(saveId)!.gameState;
  const vertraege2 = Object.entries(
    (gameState.seasonState as unknown as Record<string, Record<string, { seasonId?: string }>>).sponsorContractsByTeamId ?? {},
  );
  const inNeuerSaison = vertraege2.filter(([, vertrag]) => vertrag?.seasonId === gameState.season.id).length;
  console.log(`  Sponsorvertraege in ${gameState.season.id}: ${inNeuerSaison} von 32`);
  if (inNeuerSaison < 32) {
    fehler.push(`Nur ${inNeuerSaison} von 32 Teams haben in ${gameState.season.id} einen Sponsorvertrag`);
  }

  // Der zweite Schnappschuss: das Transferfenster S1/S2 ist erst nach den Kaeufen der neuen Saison
  // zu (Chris' Regel). Hier steht, was danach im Archiv liegt.
  const schnappschuesse = (gameState.seasonState.seasonSnapshots ?? []) as { seasonId?: string }[];
  console.log(`  Schnappschuesse im Archiv: ${schnappschuesse.length} (${schnappschuesse.map((eintrag) => eintrag.seasonId).join(", ")})`);

  // ---------------------------------------------------------------- Kauffenster der neuen Saison
  //
  // HIER LAG DER KUENSTLICHE TEIL MEINES LAUFS, und Chris hat es sofort gesehen: "in deinem kauf
  // ist auf jeden fall noch n fake lauf drin weil organic wuerde so nicht picken". Stimmt. Der
  // Lauf hat die Kader ueber den Liga-Draft gefuellt und danach NIE wieder eingekauft — waehrend
  // im echten Spiel der Preseason-Hintergrundlauf `runAiPicksExecutePreview` je Team faehrt
  // (`app/api/ai/preseason-background/route.ts`, `runMode: "season1_optimum_execute"`,
  // 12 Schritte je Team). Genau dieser Lauf fuellt die Kader nach den Verkaeufen wieder auf.
  //
  // Ohne ihn war die Meldung "11 Teams unter 6 Spielern" eine Aussage ueber mein Skript, nicht
  // ueber das Spiel. Jetzt laeuft derselbe Weg wie in der Anwendung — mit denselben Parametern,
  // je Team einzeln, damit ein Team, das haengt, die anderen nicht mitreisst.
  console.log("\n--- Kauffenster der neuen Saison (KI-Picks) ---");
  const kiTeams = gameState.teams
    .filter((team) => {
      const modus = gameState.seasonState.teamControlSettings?.[team.teamId]?.controlMode;
      return modus !== "manual" && !team.humanControlled;
    })
    .map((team) => team.teamId);
  let gepickt = 0;
  for (const teamId of kiTeams) {
    const lauf = await runAiPicksExecutePreview(
      {
        source: "sqlite",
        saveId,
        seasonId: persistence.getSaveById(saveId)!.gameState.season.id,
        dryRun: false,
        confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
        teamScope: "ai",
        teamIds: [teamId],
        stepsPerTeam: 12,
        runMode: "season1_optimum_execute",
        draftSeed: `${saveId}:preseason:${teamId}`,
      },
      persistence,
    ).catch((error) => {
      auffaellig.push(`KI-Picks ${teamId}: ${(error as Error).message.slice(0, 120)}`);
      return null;
    });
    if (lauf) gepickt += 1;
  }
  console.log(`  KI-Pick-Laeufe: ${gepickt} von ${kiTeams.length} Teams`);
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

  // Was wurde tatsaechlich gebucht? Nach Komponente aufgeschluesselt — eine Gesamtsumme verdeckt,
  // wenn eine ganze Seite fehlt (genau so ist mir die fehlende Sponsoreinnahme durchgerutscht).
  const buchungen = ((gameState.seasonState as unknown as Record<string, unknown>).sponsorPayoutLogs ?? []) as {
    componentId?: string;
    cashDelta?: number;
  }[];
  const jeKomponente = new Map<string, { anzahl: number; summe: number }>();
  for (const eintrag of buchungen) {
    // Nur das Suffix (`base`/`rank`/`special`/`salary_deduct`) — der volle Vertragsschluessel
    // erzeugt 32 Einzelzeilen und verdeckt genau das Muster, das man sehen will.
    const schluessel = (eintrag.componentId ?? "?").split(":").pop() ?? "?";
    const wert = jeKomponente.get(schluessel) ?? { anzahl: 0, summe: 0 };
    wert.anzahl += 1;
    wert.summe += eintrag.cashDelta ?? 0;
    jeKomponente.set(schluessel, wert);
  }
  console.log("Saisonende-Buchungen nach Komponente:");
  for (const [schluessel, wert] of [...jeKomponente].sort((a, b) => b[1].anzahl - a[1].anzahl)) {
    console.log(`  ${schluessel.padEnd(18)} ${String(wert.anzahl).padStart(3)} Zeilen  Summe ${z(wert.summe)}`);
  }
  // EINNAHME GEGEN ABZUG, getrennt gezaehlt. Vorsicht mit der Erkennung: die Komponenten heissen
  // NICHT "sponsor…", sondern tragen den ganzen Vertragsschluessel
  // (`season-1:N-N:security:gewoehnlich:1:v3:base`). Meine erste Fassung suchte nach dem Wort
  // "sponsor" im Schluessel, fand es nie und meldete "die Einnahmenseite fehlt" — obwohl sie da
  // war. Deshalb wird jetzt am VORZEICHEN unterschieden, nicht am Namen.
  const einnahme = buchungen.filter((eintrag) => (eintrag.cashDelta ?? 0) > 0);
  const abzug = buchungen.filter((eintrag) => (eintrag.cashDelta ?? 0) < 0);
  const einnahmeSumme = einnahme.reduce((summe, eintrag) => summe + (eintrag.cashDelta ?? 0), 0);
  const abzugSumme = abzug.reduce((summe, eintrag) => summe + (eintrag.cashDelta ?? 0), 0);
  console.log(
    `  davon EINNAHMEN ${einnahme.length} Zeilen / ${z(einnahmeSumme)}` +
      `  ·  ABZUEGE ${abzug.length} Zeilen / ${z(abzugSumme)}` +
      `  ·  netto ${z(einnahmeSumme + abzugSumme)}`,
  );
  const teamsMitEinnahme = new Set(
    (buchungen as { teamId?: string; cashDelta?: number }[])
      .filter((eintrag) => (eintrag.cashDelta ?? 0) > 0)
      .map((eintrag) => eintrag.teamId)
      .filter(Boolean),
  );
  console.log(`  Teams mit Sponsor-Einnahme: ${teamsMitEinnahme.size} von 32`);
  if (einnahme.length === 0) {
    fehler.push("Keine Sponsor-EINNAHME gebucht — nur Abzuege. Die Einnahmenseite fehlt.");
  } else if (teamsMitEinnahme.size < 32) {
    auffaellig.push(`Nur ${teamsMitEinnahme.size} von 32 Teams haben eine Sponsor-Einnahme gebucht`);
  }

  const apron = ((gameState.seasonState as unknown as Record<string, unknown>).apronSettlementLogs ?? []) as {
    cashDelta?: number;
  }[];
  const apronSumme = apron.reduce((summe, eintrag) => summe + (eintrag.cashDelta ?? 0), 0);
  console.log(`Apron: ${apron.length} Zeilen, Summe ${apronSumme.toFixed(4)} (der Topf verteilt nur um, muss 0 sein)`);
  if (apron.length > 0 && Math.abs(apronSumme) > 0.05) {
    fehler.push(`Apron-Summe ${apronSumme.toFixed(4)} statt 0 — der Topf verteilt nicht nur um`);
  }
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
