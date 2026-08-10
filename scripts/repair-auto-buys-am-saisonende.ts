/* eslint-disable no-console */
/**
 * Nimmt AUTOMATISCHE Kaeufe aus einem Spielstand zurueck — und prueft vorher, was ueberhaupt
 * passiert ist.
 *
 * GEMELDET: „Was zur hölle ist passiert mit meinem save am season ende, dass ich plötzlich 3 neue
 * spieler habe? Wieso wird für mich gepickt und gedraftet??? Bitte die 3 käufe rückgängig machen,
 * eigentlich müsste hier nur verkauft werden auch von den AI teams!"
 *
 * URSACHE (behoben, siehe `lib/ai/preseason-batch-pick-rebuild-service.ts` und
 * `lib/ai/ai-transfer-window-session-service.ts`): der Preseason-Kauf-Batch filterte nie nach dem
 * Kontrollmodus und kaufte deshalb auch fuer menschlich gesteuerte Teams. Der Code ist repariert;
 * dieses Skript raeumt auf, was der Fehler in bestehenden Spielstaenden hinterlassen hat.
 *
 * ES WIRD NICHTS GESCHRIEBEN, solange `--apply` fehlt. Ohne den Schalter gibt es nur den Bericht:
 * welche Kaeufe, welche Verkaeufe, welche Quelle, welches Team, wie viel Geld.
 *
 * Nutzung:
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts                      # nur Bericht (aktiver Save)
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts --save <saveId>      # anderer Spielstand
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts --season season-3    # nur diese Saison
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts --nur-mein-team      # nur das menschliche Team
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts --ab 2026-08-05      # nur ab diesem Zeitpunkt
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts --nur-quelle ai_roster_fill   # nur diese Quelle
 *   npx tsx scripts/repair-auto-buys-am-saisonende.ts --apply              # SCHREIBT (Backup vorher)
 *
 * Umgekehrt wird genau das, was `applyLocalTransfermarktBuy` schreibt
 * (`lib/market/transfermarkt-local-service.ts`):
 *   team.cash        -= Ablöse      →  wird zurueckgebucht
 *   rosters          += Kadereintrag →  wird entfernt
 *   transferHistory  += Eintrag      →  wird entfernt
 *   Transferbudget-Reservierung      →  wird zurueckgebucht, wenn eine existiert
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import type { GameState, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import fs from "node:fs";
import path from "node:path";

/**
 * NUR diese Quellen werden zurueckgenommen — eine Positivliste, keine Ausschlussliste.
 *
 * Die Vorfassung nahm „alles, was nicht `manual_transfermarkt_buy` ist". Am echten Spielstand
 * gemessen waeren das 347 Kaeufe gewesen — davon 343 mit der Quelle `ai_roster_fill`, also der
 * ERSTMALIGE LIGA-DRAFT: die Startkader aller 32 Teams. Ein `--apply` haette die komplette Liga
 * ausgeleert. Nur 4 Kaeufe stammten tatsaechlich vom gemeldeten Preseason-Lauf.
 *
 * Deshalb andersherum: hier steht ausschliesslich das drin, was der gemeldete Fehler erzeugt hat.
 * Eine neue KI-Quelle wird damit NICHT automatisch zurueckgenommen — sie taucht im Bericht unter
 * „nicht zurueckgenommen" auf und jemand entscheidet bewusst, ob sie dazugehoert. Bei einem
 * Werkzeug, das in einen echten Spielstand schreibt, ist Vergessen die harmlosere Richtung.
 */
const RUECKNEHMBARE_KAUF_QUELLEN = new Set(["ai_preseason_market_buy"]);

/**
 * Quellen, die NUR zusammen mit `--ab <zeitpunkt>` zurueckgenommen werden duerfen.
 *
 * `ai_roster_fill` traegt zwei voellig verschiedene Dinge: den echten Erst-Draft beim Anlegen des
 * Spielstands (muss bleiben — sonst steht die halbe Liga ohne Kader da) und die faelschlich
 * spaeter gelaufenen Wiederholungen (`use-foundation-shell-router-body-scope.tsx`, Auto-Finish am
 * Saisonende). An der Quelle sind die beiden nicht zu unterscheiden, nur an der ZEIT.
 *
 * Am echten Spielstand: 329 Eintraege vom Anlegetag, 14+ vom Tag darauf. Ohne `--ab` verweigert
 * das Skript diese Quelle deshalb komplett, statt zu raten.
 */
const NUR_MIT_ZEITGRENZE = new Set(["ai_roster_fill"]);

/** Der erstmalige Liga-Draft. Steht hier nur, damit der Bericht ihn benennen kann. */
const LIGA_DRAFT_QUELLE = "ai_roster_fill";

/**
 * Eintraege OHNE Quelle werden NICHT zurueckgenommen.
 *
 * Aeltere Spielstaende haben Historien-Zeilen ohne `source` (im Bericht als `[undefined]`
 * sichtbar). Ob so eine Zeile ein KI-Kauf oder ein Kauf des Spielers von damals war, laesst sich
 * nicht mehr entscheiden — und dieses Skript schreibt in einen echten Spielstand. Im Zweifel also
 * nichts anfassen: solche Zeilen werden getrennt ausgewiesen, damit der Mensch entscheidet, statt
 * sie stillschweigend mitzuloeschen.
 */
function hatKeineQuelle(entry: TransferHistoryEntry) {
  const source = entry.source == null ? "" : String(entry.source).trim();
  return source === "" || source === "undefined" || source === "null";
}

/**
 * Warum eine Quelle stehen blieb — und was zu tun ist, wenn das nicht gewollt war.
 *
 * GEBRAUCHT, WEIL DER ALTE HINWEIS IN DIE IRRE FUEHRTE: bei `ai_roster_fill` stand pauschal
 * „erstmaliger Liga-Draft, MUSS stehen bleiben". In Saison 1 stimmt das. Am echten Spielstand
 * (`new-game-1785823388048-1hf25q`) lagen die 329 Draft-Kaeufe aber in `season-1` vom 04.08., und
 * die 74 zu entfernenden Fueller in `season-2` vom 08.08. — der Aufruf war auf `season-2` verengt,
 * der Erst-Draft also gar nicht in Reichweite. Trotzdem behauptete das Skript, es schuetze ihn
 * gerade, und schloss mit „nichts zurueckzunehmen". Das liest sich wie „alles in Ordnung", war
 * aber eine Verweigerung mit falscher Begruendung.
 *
 * Der Grund fuer die Verweigerung ist in Wahrheit immer derselbe und steht in `NUR_MIT_ZEITGRENZE`:
 * ohne `--ab` laesst sich echter Draft nicht von spaeterer Wiederholung trennen. Also sagt der
 * Hinweis das jetzt — samt dem Schalter, der fehlt.
 */
function hinweisZurQuelle(quelle: string, seasonId: string, ab: string | null) {
  if (quelle !== LIGA_DRAFT_QUELLE) return "";
  if (ab != null) return "  ← ausserhalb der Zeitgrenze --ab";
  const istErsteSaison = seasonId === "season-1";
  return istErsteSaison
    ? "  ← erstmaliger Liga-Draft; nur mit --ab <zeitpunkt> zurueckzunehmen"
    : `  ← braucht --ab <zeitpunkt>; in ${seasonId} ist das NICHT der erstmalige Liga-Draft`;
}

function istRuecknehmbarerKauf(entry: TransferHistoryEntry, ab: string | null, nurQuelle: string | null) {
  if (entry.transferType !== "buy") return false;
  if (hatKeineQuelle(entry)) return false;
  const source = String(entry.source);
  /**
   * `--nur-quelle` schneidet die Ruecknahme auf EINE Quelle zu.
   *
   * GEBRAUCHT FUER: „schau mal die neuen spieler bei N-N sind alles so filler … wir müssen die
   * noch mal raus nehmen im save". Ohne diesen Schalter nahm derselbe Aufruf auch die GUTEN
   * organischen Zugaenge mit — im Bericht am Live-Spielstand waren das Hel 43.57, Phoenix 27.13,
   * Lady Yueqin 32.73, Beast Keeper Morga 43.83 und Noir 36.87, alle `ai_preseason_market_buy`.
   * Genau die sollen bleiben; raus soll nur, was der Fuell-Lauf eingekauft hat.
   */
  if (nurQuelle != null && source !== nurQuelle) return false;
  if (ab != null && (entry.happenedAt ?? "") < ab) return false;
  if (NUR_MIT_ZEITGRENZE.has(source)) return ab != null;
  return RUECKNEHMBARE_KAUF_QUELLEN.has(source);
}

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let seasonId: string | null = null;
  let apply = false;
  let nurMeinTeam = false;
  let ab: string | null = null;
  let nurQuelle: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--nur-mein-team") nurMeinTeam = true;
    else if (arg === "--save") saveId = argv[++i] ?? null;
    else if (arg === "--season") seasonId = argv[++i] ?? null;
    else if (arg === "--ab") ab = argv[++i] ?? null;
    else if (arg === "--nur-quelle") nurQuelle = argv[++i] ?? null;
  }
  return { saveId, seasonId, apply, nurMeinTeam, ab, nurQuelle };
}

function istManuellGesteuert(gameState: GameState, teamId: string) {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  const controlMode = getTeamControlSettings(gameState, teamId)?.controlMode ?? (team?.humanControlled ? "manual" : "ai");
  return controlMode !== "ai";
}

function runde(value: number) {
  return Number(value.toFixed(2));
}

async function main() {
  const { saveId: saveIdArg, seasonId: seasonArg, apply, nurMeinTeam, ab, nurQuelle } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();

  const saveId = saveIdArg ?? persistence.getActiveSave()?.saveId ?? null;
  if (!saveId) {
    console.error("Kein Spielstand angegeben und kein aktiver gefunden. Bitte --save <saveId> nutzen.");
    process.exit(1);
  }
  const save = persistence.getSaveById(saveId);
  if (!save) {
    console.error(`Spielstand nicht gefunden: ${saveId}`);
    process.exit(1);
  }

  const gameState = save.gameState;
  const seasonId = seasonArg ?? gameState.season.id;
  const historie = gameState.transferHistory ?? [];
  const derSaison = historie.filter((entry) => entry.seasonId === seasonId);

  console.log(`\nSpielstand : ${saveId}`);
  console.log(`Saison     : ${seasonId} (${gameState.season.name ?? "?"}), Phase ${gameState.gamePhase ?? "?"}`);
  console.log(`Historie   : ${historie.length} Eintraege gesamt, ${derSaison.length} in dieser Saison\n`);

  // ---- Bericht: was ist in dieser Saison gelaufen? -------------------------------------------
  const kaeufe = derSaison.filter((entry) => entry.transferType === "buy");
  const verkaeufe = derSaison.filter((entry) => entry.transferType === "sell");
  const quellen = new Map<string, number>();
  for (const entry of derSaison) {
    const key = `${entry.transferType}:${entry.source ?? "?"}`;
    quellen.set(key, (quellen.get(key) ?? 0) + 1);
  }
  console.log(`Kaeufe ${kaeufe.length} | Verkaeufe ${verkaeufe.length}`);
  console.log("Nach Quelle:");
  for (const [key, count] of [...quellen.entries()].sort()) {
    console.log(`  ${String(count).padStart(4)}  ${key}`);
  }

  const menschlicheTeams = gameState.teams.filter((team) => istManuellGesteuert(gameState, team.teamId));
  console.log(
    `\nMenschlich gesteuert: ${menschlicheTeams.map((t) => `${t.name} (${t.teamId})`).join(", ") || "— keins"}`,
  );

  // ---- Verkaufsbild: die Vorbereitung fuer den naechsten Schritt ------------------------------
  // Der fehlende Kontrollmodus-Filter in `scopeTeam` betraf nicht nur die Kaufpfade, sondern auch
  // die Saisonende-Verkaufsschleife. Ein automatischer Verkauf AUS einem menschlich gesteuerten
  // Team heraus ist derselbe Uebergriff wie ein Kauf hinein — deshalb steht er hier als eigene
  // Zeile, auch wenn dieses Skript ihn (noch) nicht zurueckninmt.
  if (verkaeufe.length > 0) {
    const verkaufProTeam = new Map<string, TransferHistoryEntry[]>();
    for (const entry of verkaeufe) {
      const key = entry.fromTeamId ?? "?";
      if (!verkaufProTeam.has(key)) verkaufProTeam.set(key, []);
      verkaufProTeam.get(key)!.push(entry);
    }
    const teamNameKurz = (teamId: string | null) =>
      gameState.teams.find((t) => t.teamId === teamId)?.name ?? teamId ?? "?";
    console.log(`\n${"-".repeat(78)}\nVERKAEUFE je Team (Bestandsaufnahme, wird NICHT angefasst)`);
    const auffaellig: string[] = [];
    for (const [teamId, list] of [...verkaufProTeam.entries()].sort()) {
      const summe = runde(list.reduce((sum, e) => sum + (e.fee ?? 0), 0));
      const automatisch = list.filter((e) => !String(e.source ?? "").startsWith("manual_")).length;
      const manuell = list.length - automatisch;
      const istMeins = istManuellGesteuert(gameState, teamId);
      const markierung = istMeins ? "  ← DEIN TEAM" : "";
      console.log(
        `  ${teamNameKurz(teamId).padEnd(24)} ${String(list.length).padStart(3)} Verkaeufe` +
          ` (${automatisch} automatisch, ${manuell} manuell), ${summe} Mio${markierung}`,
      );
      if (istMeins && automatisch > 0) {
        auffaellig.push(`${teamNameKurz(teamId)}: ${automatisch} AUTOMATISCHE Verkaeufe aus deinem Team`);
      }
    }
    if (auffaellig.length > 0) {
      console.log("\n  ACHTUNG:");
      for (const zeile of auffaellig) console.log(`    - ${zeile}`);
      console.log("    Das ist derselbe Fehler wie bei den Kaeufen, nur andersherum.");
    }
    console.log("-".repeat(78));
  }

  // ---- Auswahl: was wird zurueckgenommen? ----------------------------------------------------
  const ohneQuelle = derSaison.filter((entry) => entry.transferType === "buy" && hatKeineQuelle(entry));
  if (ohneQuelle.length > 0) {
    console.log(
      `\nHINWEIS: ${ohneQuelle.length} Kaeufe ohne erkennbare Quelle — die bleiben unangetastet.\n` +
        `  Bei denen laesst sich nicht mehr entscheiden, ob KI oder du. Im Zweifel nichts anfassen.`,
    );
  }

  const nichtAngefasst = derSaison.filter(
    (entry) => entry.transferType === "buy" && !hatKeineQuelle(entry) && !istRuecknehmbarerKauf(entry, ab, nurQuelle),
  );
  if (nichtAngefasst.length > 0) {
    const proQuelle = new Map<string, number>();
    for (const entry of nichtAngefasst) {
      const key = String(entry.source);
      proQuelle.set(key, (proQuelle.get(key) ?? 0) + 1);
    }
    console.log("\nNICHT zurueckgenommen (keine Quelle des gemeldeten Fehlers):");
    for (const [quelle, anzahl] of [...proQuelle.entries()].sort()) {
      console.log(`  ${String(anzahl).padStart(4)}  ${quelle}${hinweisZurQuelle(quelle, seasonId, ab)}`);
    }
  }

  let ruecknahme = derSaison.filter((entry) => istRuecknehmbarerKauf(entry, ab, nurQuelle));
  if (nurMeinTeam) {
    const ids = new Set(menschlicheTeams.map((t) => t.teamId));
    ruecknahme = ruecknahme.filter((entry) => entry.toTeamId && ids.has(entry.toTeamId));
  }

  if (ruecknahme.length === 0) {
    /**
     * Ein leeres Ergebnis hat ZWEI ganz verschiedene Gruende, und der alte Text nannte nur den
     * harmlosen: „nichts zurueckzunehmen" liest sich wie „alles in Ordnung". Am echten Spielstand
     * lagen aber 74 Fueller bereit und das Skript hatte sie bloss ohne `--ab` verweigert. Wer das
     * fuer Erfolg haelt, spielt mit dem Schrott weiter.
     */
    const verweigert = nichtAngefasst.filter((entry) => NUR_MIT_ZEITGRENZE.has(String(entry.source)));
    if (verweigert.length > 0 && ab == null) {
      console.log(
        `\nNICHTS GETAN — aber nicht, weil nichts da waere: ${verweigert.length} Kaeufe der Quelle ` +
          `${LIGA_DRAFT_QUELLE} liegen in ${seasonId} und brauchen eine Zeitgrenze.\n` +
          "  Ohne --ab laesst sich der echte Erst-Draft nicht von einer spaeteren Wiederholung\n" +
          "  trennen, deshalb fasst das Skript die Quelle gar nicht an. Zeitpunkt setzen und\n" +
          "  denselben Aufruf wiederholen, zum Beispiel: --ab 2026-08-05",
      );
      return;
    }
    console.log("\nKeine automatischen Kaeufe in dieser Saison — nichts zurueckzunehmen.");
    return;
  }

  const spielerName = (playerId: string) =>
    gameState.players.find((p) => p.id === playerId)?.name ?? playerId;
  const teamName = (teamId: string | null) =>
    gameState.teams.find((t) => t.teamId === teamId)?.name ?? teamId ?? "?";

  console.log(`\n${"=".repeat(78)}\nRUECKNAHME — ${ruecknahme.length} automatische Kaeufe\n${"=".repeat(78)}`);
  const proTeam = new Map<string, TransferHistoryEntry[]>();
  for (const entry of ruecknahme) {
    const key = entry.toTeamId ?? "?";
    if (!proTeam.has(key)) proTeam.set(key, []);
    proTeam.get(key)!.push(entry);
  }
  for (const [teamId, list] of proTeam) {
    const summe = runde(list.reduce((sum, e) => sum + (e.fee ?? 0), 0));
    const markierung = istManuellGesteuert(gameState, teamId) ? "  ← DEIN TEAM" : "";
    console.log(`\n${teamName(teamId)} (${teamId}) — ${list.length} Kaeufe, ${summe} Mio zurueck${markierung}`);
    for (const e of list) {
      console.log(`   - ${spielerName(e.playerId)}  Ablöse ${e.fee ?? 0}  Gehalt ${e.salary ?? 0}  [${e.source}]`);
    }
  }

  if (!apply) {
    console.log(
      `\n${"-".repeat(78)}\nNUR BERICHT — es wurde nichts geschrieben.\n` +
        `Zum Anwenden denselben Aufruf mit --apply wiederholen.\n${"-".repeat(78)}`,
    );
    return;
  }

  // ---- Anwenden --------------------------------------------------------------------------------
  const backupDir = path.join(process.cwd(), "data", "save-backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${saveId}-vor-ruecknahme-${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(save, null, 2));
  console.log(`\nBackup geschrieben: ${backupPath}`);

  const zurueck = new Set(ruecknahme.map((e) => e.id));
  const cashProTeam = new Map<string, number>();
  const rosterWeg = new Set<string>();

  for (const entry of ruecknahme) {
    const teamId = entry.toTeamId;
    if (!teamId) continue;
    cashProTeam.set(teamId, runde((cashProTeam.get(teamId) ?? 0) + (entry.fee ?? 0)));
    // Genau EIN Kadereintrag je Kauf — der des gekauften Spielers bei diesem Team.
    const roster = gameState.rosters.find(
      (r) => r.teamId === teamId && r.playerId === entry.playerId && !rosterWeg.has(r.id),
    );
    if (roster) rosterWeg.add(roster.id);
    else console.warn(`  ! Kein Kadereintrag fuer ${spielerName(entry.playerId)} bei ${teamId} — nur Historie/Cash.`);
  }

  const naechsterStand: GameState = {
    ...gameState,
    teams: gameState.teams.map((team) =>
      cashProTeam.has(team.teamId) ? { ...team, cash: runde(team.cash + cashProTeam.get(team.teamId)!) } : team,
    ),
    rosters: gameState.rosters.filter((r) => !rosterWeg.has(r.id)),
    transferHistory: gameState.transferHistory.filter((e) => !zurueck.has(e.id)),
  };

  persistence.saveSingleplayerState(saveId, naechsterStand);

  console.log(`\n${"=".repeat(78)}\nERLEDIGT`);
  console.log(`  Kaeufe zurueckgenommen : ${ruecknahme.length}`);
  console.log(`  Kadereintraege entfernt: ${rosterWeg.size}`);
  for (const [teamId, betrag] of cashProTeam) {
    const team = naechsterStand.teams.find((t) => t.teamId === teamId);
    console.log(`  ${teamName(teamId)}: +${betrag} Mio  → Cash jetzt ${team?.cash}`);
  }
  console.log(`${"=".repeat(78)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
