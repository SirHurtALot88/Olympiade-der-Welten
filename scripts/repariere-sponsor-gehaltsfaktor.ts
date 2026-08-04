/**
 * REPARATUR: Sponsorvertraege, die mit dem Standard-Gehaltsfaktor 1,0 eingefroren wurden, obwohl
 * die Saison mit einem anderen Faktor lief.
 *
 * URSACHE (behoben in `lib/game/new-game-setup-service.ts`): die Sponsorangebote entstanden im
 * Neuspiel-Setup, das Gehaltsfaktor-Fenster wurde aber erst danach in der Persistenzschicht gesaet.
 * `getSponsorV3SalaryFactor` fand keinen Faktor und nahm 1,0. Die Leiter friert bei Unterschrift
 * ein — und blieb auf 1,0, waehrend die Saison mit dem echten Faktor lief.
 *
 * GEMESSEN am Live-Spielstand vom 4.8.: Faktor 1,18, alle 32 Vertraege auf 1,0 eingefroren. Der
 * Liga fehlten rund 371 C, und 12 von 32 Teams standen nach einem GUTEN Jahr im Minus.
 *
 * DIE RECHNUNG. In der eingefrorenen Leiter steckt `Leiter(f) = Kurve(f) + Platzierungsbonus`.
 * Nur die KURVE haengt am Gehaltsfaktor, der Platzierungsbonus nicht. Der Ausgleich ist deshalb
 *     neu(f) = (Leiter(f) − Bonus) * echterFaktor + Bonus
 * und wird als eigene Zeile gutgeschrieben. Das Sonderziel bleibt unberuehrt: es haengt an der
 * Erfuellung, nicht am Faktor, und wurde bereits richtig abgerechnet.
 *
 * BEWUSST OHNE das aktuelle Sponsormodell gerechnet: der Spielstand traegt Vertraege eines
 * frueheren Standes. Wuerde die Reparatur mit der heutigen Leiter neu bauen, schriebe sie die
 * gespielte Saison auf ein anderes Modell um, statt den einen Fehler zu beheben.
 *
 * IDEMPOTENT ueber `componentId: "salary_factor_repair"` — ein zweiter Lauf findet die Buchung und
 * laesst alles in Ruhe.
 *
 * Aufruf (erst pruefen, dann buchen):
 *   OLY_APP_SQLITE_PATH=<pfad.sqlite> npx tsx scripts/repariere-sponsor-gehaltsfaktor.ts --save-id <ID>
 *   OLY_APP_SQLITE_PATH=<pfad.sqlite> npx tsx scripts/repariere-sponsor-gehaltsfaktor.ts --save-id <ID> --anwenden
 */
import { randomUUID } from "node:crypto";

import type { GameState, SponsorPayoutLogRecord } from "@/lib/data/olyDataTypes";
import { PRIZE_PLACEMENT_SHEET_TABLE } from "@/lib/season/prize-placement-table";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const REPAIR_COMPONENT_ID = "salary_factor_repair";
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Der Platzierungsbonus, wie er zum UNTERSCHRIFTSZEITPUNKT galt — ungekappt, direkt aus der
 * Sheet-Tabelle. Die spaeter eingefuehrte Kappung bei sechs Plaetzen darf hier nicht greifen: was
 * herausgerechnet wird, muss exakt das sein, was damals eingerechnet wurde.
 */
function bonusBeiUnterschrift(rankDelta: number): number {
  const clamped = Math.max(-31, Math.min(31, Math.round(rankDelta)));
  return PRIZE_PLACEMENT_SHEET_TABLE.get(clamped) ?? 0;
}

const args = process.argv.slice(2);
const saveId = args[args.indexOf("--save-id") + 1];
const anwenden = args.includes("--anwenden");
if (!saveId || saveId.startsWith("--")) {
  console.error("Aufruf: --save-id <ID> [--anwenden]");
  process.exit(1);
}

const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId);
if (!save) {
  console.error(`Spielstand ${saveId} nicht gefunden.`);
  process.exit(1);
}

const gameState = save.gameState as GameState;
const seasonId = gameState.season.id;
const echterFaktor = gameState.seasonState.seasonEconomyFactors?.[0]?.factor ?? 1;
const logs = gameState.seasonState.sponsorPayoutLogs ?? [];
const standings = gameState.seasonState.standings ?? {};
const vertraege = gameState.seasonState.sponsorContractsByTeamId ?? {};

console.log(`\nSpielstand ${saveId} · Saison ${seasonId} · echter Gehaltsfaktor ${echterFaktor}`);
if (logs.some((log) => log.seasonId === seasonId && log.componentId === REPAIR_COMPONENT_ID)) {
  console.log("Ausgleich fuer diese Saison ist bereits gebucht — nichts zu tun.\n");
  process.exit(0);
}

type Zeile = { teamId: string; rang: number; alt: number; neu: number; delta: number };
const zeilen: Zeile[] = [];

for (const team of gameState.teams) {
  const terms = (vertraege[team.teamId] as { sponsorV3?: Record<string, unknown> } | undefined)?.sponsorV3;
  if (!terms) continue;
  const vertragsFaktor = Number(terms.salaryFactor ?? 1);
  if (Math.abs(vertragsFaktor - echterFaktor) < 1e-9) continue;

  const leiter = terms.rankLadder as number[] | undefined;
  const startRank = Number(terms.startRank ?? 0);
  const floor = Number(terms.floor ?? 0);
  const rang = standings[team.teamId]?.rank ?? null;
  if (!leiter || leiter.length !== 32 || !rang || !startRank) continue;

  const bonus = bonusBeiUnterschrift(startRank - rang);
  const kurve = leiter[rang - 1]! - bonus;
  const alt = Math.max(floor, leiter[rang - 1]!);
  const neu = Math.max(floor, (kurve * echterFaktor) / vertragsFaktor + bonus);
  const delta = round1(neu - alt);
  if (delta === 0) continue;
  zeilen.push({ teamId: team.teamId, rang, alt, neu, delta });
}

if (zeilen.length === 0) {
  console.log("Kein Vertrag weicht vom Saisonfaktor ab — nichts zu tun.\n");
  process.exit(0);
}

console.log(`\n${"Team".padEnd(6)}${"Rang".padStart(5)}${"gezahlt".padStart(10)}${"richtig".padStart(10)}${"Ausgleich".padStart(11)}`);
for (const z of [...zeilen].sort((left, right) => right.delta - left.delta)) {
  console.log(
    z.teamId.padEnd(6) + String(z.rang).padStart(5) + z.alt.toFixed(1).padStart(10) +
    z.neu.toFixed(1).padStart(10) + ((z.delta >= 0 ? "+" : "") + z.delta.toFixed(1)).padStart(11),
  );
}
const summe = round1(zeilen.reduce((sum, z) => sum + z.delta, 0));
const deltaByTeam = new Map(zeilen.map((z) => [z.teamId, z.delta] as const));
const negVorher = gameState.teams.filter((team) => team.cash < 0).length;
const negNachher = gameState.teams.filter((team) => team.cash + (deltaByTeam.get(team.teamId) ?? 0) < 0).length;
console.log(`\n${zeilen.length} Teams · Ausgleich gesamt ${summe >= 0 ? "+" : ""}${summe.toFixed(1)} C`);
console.log(`Teams im Minus: ${negVorher} -> ${negNachher}`);

if (!anwenden) {
  console.log("\nPRUEFLAUF — nichts geschrieben. Mit --anwenden buchen.\n");
  process.exit(0);
}

const jetzt = new Date().toISOString();
const neueLogs: SponsorPayoutLogRecord[] = zeilen.map((z) => ({
  id: `sponsor-payout:${seasonId}:${z.teamId}:${REPAIR_COMPONENT_ID}:${randomUUID()}`,
  saveId,
  seasonId,
  teamId: z.teamId,
  phase: "season_end" as const,
  componentId: REPAIR_COMPONENT_ID,
  cashDelta: z.delta,
  action: "apply" as const,
  createdAt: jetzt,
}));

persistence.saveSingleplayerState(saveId, {
  ...gameState,
  teams: gameState.teams.map((team) => {
    const delta = deltaByTeam.get(team.teamId) ?? 0;
    return delta === 0 ? team : { ...team, cash: round1(team.cash + delta) };
  }),
  seasonState: { ...gameState.seasonState, sponsorPayoutLogs: [...neueLogs, ...logs] },
});
console.log(`\nGEBUCHT: ${zeilen.length} Ausgleichszahlungen, ${summe >= 0 ? "+" : ""}${summe.toFixed(1)} C.\n`);
