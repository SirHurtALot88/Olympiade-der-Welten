/**
 * PRUEFSTAND der Historie-Seiten (18.11.): die ECHTEN Komponenten (Saison-Archiv, Transfers, Ewige Tabelle) in einem
 * Browser-Bundle mit erfundenen, aber stimmigen Daten — 32 echte Teams (`oly-teams.json`), vier Saisons, Deals.
 * Ohne Shell und ohne Spielstand: Aufnahme mit `scripts/historie-pruefstand/aufnahme.mjs`. Nichts davon laeuft in der App.
 */

import type { TransferHistoryV2Row } from "@/app/foundation/transfer-history-v2/TransferHistoryV2Client";
import teamsRaw from "@/data/generated/oly-teams.json";
import playersRaw from "@/data/generated/oly-player-stats.json";
import { getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { FoundationSeasonHistoryEntry, FoundationSeasonHistoryTeamEntry } from "@/lib/persistence/foundation-season-history-projection";

// ---------------------------------------------------------------------------------------------- Zufall
let saat = 20241118;
const zufall = () => {
  saat = (saat * 1664525 + 1013904223) % 4294967296;
  return saat / 4294967296;
};
const mische = <T,>(liste: readonly T[]): T[] => {
  const kopie = [...liste];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
  }
  return kopie;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

export const TEAMS = (teamsRaw as Array<{ teamId: string; shortCode: string; name: string }>).map((team) => ({
  teamId: team.teamId,
  shortCode: team.shortCode,
  name: team.name,
}));
export const EIGEN = "V-W";

// ---------------------------------------------------------------------------------------------- Saisons
const ARCHIVIERT = 3;
let liga1 = mische(TEAMS.map((team) => team.teamId)).slice(0, 16);
const SAISONS: FoundationSeasonHistoryEntry[] = [];
let vorherPlatz = new Map<string, number>();
for (let n = 1; n <= ARCHIVIERT; n++) {
  const inLiga1 = new Set(liga1);
  const jeLiga = (liga: 1 | 2) => TEAMS.map((team) => team.teamId).filter((id) => (liga === 1 ? inLiga1.has(id) : !inLiga1.has(id)));
  const teams: FoundationSeasonHistoryTeamEntry[] = [];
  const platzNachTeam = new Map<string, number>();
  for (const liga of [1, 2] as const) {
    const staerke = new Map(jeLiga(liga).map((id) => [id, zufall() * 40 + (liga === 1 ? 70 : 55)] as const));
    const start = mische(jeLiga(liga));
    const reihe = [...staerke.entries()].sort((a, b) => b[1] - a[1]);
    reihe.forEach(([teamId, punkte], index) => {
      const team = TEAMS.find((eintrag) => eintrag.teamId === teamId)!;
      const rank = index + 1;
      const startplatz = start.indexOf(teamId) + 1;
      const anteil = [0.28, 0.26, 0.24, 0.22];
      const kasse = r1(40 + zufall() * 90);
      const mw = r1(250 + zufall() * 200 + (liga === 1 ? 80 : 0));
      platzNachTeam.set(teamId, rank + (liga === 2 ? 16 : 0));
      teams.push({
        teamId,
        teamCode: team.shortCode,
        teamName: team.name,
        rank,
        points: r1(punkte),
        disciplinePoints: r1(punkte),
        disciplinePointsByArea: { pow: Math.round(punkte * anteil[0]!), spe: Math.round(punkte * anteil[1]!), men: Math.round(punkte * anteil[2]!), soc: Math.round(punkte * anteil[3]!) },
        cashEnd: null,
        cashTotal: null,
        cashEntry: null,
        cashCarryOver: null,
        salaryEnd: null,
        salaryTotalEnd: null,
        marketValueEnd: null,
        marketValueSeasonEnd: mw,
        cashSeasonEnd: kasse,
        salarySeasonEnd: r1(mw * 0.09),
        rosterSeasonEnd: 11,
        marketValueTotalEnd: mw,
        guv: r1((zufall() - 0.45) * 30),
        startplatz,
        rankDiff: startplatz - rank,
        transferNet: n === 1 ? null : r1((zufall() - 0.6) * 140),
        kaderaufbauNet: n === 1 ? -r1(300 + zufall() * 150) : null,
        leagueTier: liga === 1 ? "liga1" : "liga2",
      });
    });
  }
  SAISONS.push({
    seasonId: `season-${n}`,
    seasonName: `Season ${n}`,
    status: "completed",
    archivedAt: `2026-0${n}-01T00:00:00Z`,
    entryRosterPatchedAt: null,
    teams,
    teamDisciplineRanks: [],
    players: [],
    transfers: [],
  });
  vorherPlatz = platzNachTeam;
  // Auf- und Abstieg: 3 runter, 3 hoch.
  const l1 = teams.filter((t) => t.leagueTier === "liga1").sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const l2 = teams.filter((t) => t.leagueTier === "liga2").sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const bleiben = l1.slice(0, 13).map((t) => t.teamId);
  const hoch = l2.slice(0, 3).map((t) => t.teamId);
  liga1 = [...bleiben, ...hoch];
}
void vorherPlatz;

export const GAME_STATE = {
  season: { id: "season-4", name: "Season 4", year: 2030, currentMatchday: 6, matchdayIds: Array.from({ length: 20 }, (_, i) => `season-4-matchday-${i + 1}`) },
  seasonState: { seasonSnapshots: [], foundationSeasonHistory: SAISONS },
  teams: TEAMS,
  transferHistory: [],
  players: [],
} as unknown as GameState;

// ---------------------------------------------------------------------------------------------- Deals
export const SPIELER = (playersRaw as Array<{ id: string; name: string; className: string; marketValue: number; salaryDemand: number }>).slice(0, 700);
export const QUELLEN = ["Manuell · Chris", "Manuell · Franky", "Manuell · Ramona", "KI", "KI", "KI"];
let dealId = 0;
function neuerDeal(teil: Partial<TransferHistoryV2Row> & Pick<TransferHistoryV2Row, "type">): TransferHistoryV2Row {
  const spieler = SPIELER[(dealId * 7 + 3) % SPIELER.length]!;
  dealId += 1;
  const mw = r1(spieler.marketValue / 4 + 2);
  const fee = r1(mw * (0.85 + zufall() * 0.4));
  const portrait = getPlayerPortraitBrowserUrl(spieler.id, null, null);
  return {
    transferId: `d${dealId}`,
    playerId: spieler.id,
    playerName: spieler.name,
    portraitUrl: portrait,
    portraitInitials: spieler.name.slice(0, 2).toUpperCase(),
    seasonId: "season-1",
    seasonLabel: "Season 1",
    fromTeamId: null,
    fromTeamName: null,
    toTeamId: null,
    toTeamName: null,
    fee,
    salary: r1(mw * 0.18),
    marketValue: mw,
    guv: null,
    className: spieler.className,
    race: null,
    pow: null,
    spe: null,
    men: null,
    soc: null,
    sourceLabel: QUELLEN[Math.floor(zufall() * QUELLEN.length)]!,
    happenedAt: new Date(Date.UTC(2030, 0, 1) + dealId * 3600_000).toISOString(),
    matchdayId: "season-1-matchday-1",
    remainingContractLength: 1 + Math.floor(zufall() * 3),
    buchungsArt: "transfer",
    ...teil,
  } as TransferHistoryV2Row;
}
const teamName = (id: string) => TEAMS.find((team) => team.teamId === id)?.name ?? id;
export const DEALS: TransferHistoryV2Row[] = [];
const nimm = () => TEAMS[Math.floor(zufall() * TEAMS.length)]!.teamId;
// Kaderaufbau (Fenster vor Saison 1): Picks je Team.
for (const team of TEAMS) {
  const picks = team.teamId === EIGEN ? 11 : 4 + Math.floor(zufall() * 3);
  for (let i = 0; i < picks; i++) {
    DEALS.push(neuerDeal({ type: "buy", toTeamId: team.teamId, toTeamName: team.name, buchungsArt: "kaderaufbau", fee: r1(20 + zufall() * 60) }));
  }
}
// Fenster 2 bis 4.
for (let fenster = 2; fenster <= 4; fenster++) {
  const anzahl = fenster === 4 ? 30 : 40 + fenster * 2;
  for (let i = 0; i < anzahl; i++) {
    const art = zufall();
    const team = i % 5 === 0 ? EIGEN : nimm();
    const label = `Season ${fenster}`;
    const basis = { seasonId: `season-${fenster}`, seasonLabel: label, matchdayId: `season-${fenster}-matchday-1` };
    if (art < 0.34) {
      DEALS.push(
        neuerDeal({
          type: "sell",
          fromTeamId: team,
          fromTeamName: teamName(team),
          seasonId: `season-${fenster - 1}`,
          seasonLabel: label,
          matchdayId: `season-${fenster - 1}-matchday-20`,
          guv: r1((zufall() - 0.4) * 12),
        }),
      );
    } else if (art < 0.86) {
      DEALS.push(neuerDeal({ type: "buy", toTeamId: team, toTeamName: teamName(team), ...basis, buchungsArt: "transfer" }));
    } else {
      DEALS.push(
        neuerDeal({
          type: "contract_exit",
          fromTeamId: team,
          fromTeamName: teamName(team),
          seasonId: `season-${fenster - 1}`,
          seasonLabel: label,
          matchdayId: `season-${fenster - 1}-matchday-20`,
          fee: 0,
          buchungsArt: "vertragsende",
        }),
      );
    }
  }
}
for (const deal of DEALS) {
  if (deal.type === "sell") deal.buchungsArt = "transfer";
}

