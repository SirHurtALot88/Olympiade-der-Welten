/**
 * HISTORIE (Mockup 18.11., `docs/design/historie-modern-18-11.md`) — die eine Rechenstelle fuer Saison-Archiv,
 * Zeitleiste und das Team-Blatt. Rein, ohne React; liest nur die Kurzfassung `FoundationSeasonHistoryEntry`
 * (`leseSaisonHistorie`), die im Browser wie auf dem Server vorliegt.
 *
 * ENTSCHEIDUNGEN VON CHRIS (18.11., alle „ja" auf die Empfehlungen):
 *   3. MEISTER ist nur Platz 1 der Liga 1. Der Erste der Liga 2 heisst „Meister Liga 2" und zaehlt als AUFSTIEG,
 *      nicht als Titel. Ohne Liga-Trennung (Manager Mode, Altstand) ist Platz 1 der Meister.
 *   4. „Ø Platz" und „Bester Platz" rechnen ueber BEIDE Ligen (Liga 2 zaehlt ab Platz 17): `toLeagueSpanningPosition`.
 *
 * AUF- UND ABSTIEG: Wechselt das Team in der Folgesaison die Liga, entscheidet das. Fehlt die Folgesaison (die zuletzt
 * archivierte), gilt die Tabellenregel (Liga 1 Platz 14–16 steigen ab, Liga 2 Platz 1–3 auf; `RELEGATION_COUNT`).
 */
import type { FoundationSeasonHistoryEntry, FoundationSeasonHistoryTeamEntry } from "@/lib/persistence/foundation-season-history-projection";
import { getLeagueLevel, toLeagueSpanningPosition } from "@/lib/season/league-history";
import { LEAGUE_SIZE, RELEGATION_COUNT } from "@/lib/season/league-split";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";
import { saisonNummer } from "@/lib/foundation/transfer-window-zuordnung";

export type HistorieTeamSaison = {
  teamId: string;
  teamCode: string;
  teamName: string;
  seasonId: string;
  seasonNummer: number | null;
  /** 1, 2, … — `null` ohne Liga-Trennung. */
  liga: number | null;
  rank: number | null;
  points: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  startplatz: number | null;
  rankDiff: number | null;
  /** Kasse am Saisonende (Rueckfaelle wie in der Ewigen Tabelle). */
  cash: number | null;
  salary: number | null;
  marketValue: number | null;
  guv: number | null;
  /** Transferbilanz nach der Buchungsregel (#1634); `null` in Saison 1. */
  transferNet: number | null;
  kaderaufbauNet: number | null;
  meister: boolean;
  meisterLiga2: boolean;
  aufstieg: boolean;
  abstieg: boolean;
  /** Platz ueber beide Ligen (Liga 2 ab 17). */
  position: number | null;
};

export type HistorieLiga = { liga: number | null; zeilen: HistorieTeamSaison[] };

export type HistorieSaison = {
  seasonId: string;
  nummer: number | null;
  label: string;
  ligen: HistorieLiga[];
  meister: HistorieTeamSaison | null;
  meisterLiga2: HistorieTeamSaison | null;
  aufsteiger: HistorieTeamSaison[];
  absteiger: HistorieTeamSaison[];
  /** Groesste Platzgewinne (positiv) und -verluste (negativ) aus `rankDiff`, je hoechstens `limit`. */
  kletterer: HistorieTeamSaison[];
  absturz: HistorieTeamSaison[];
};

function zahl(wert: number | null | undefined): number | null {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

/** Kasse/MW/Gehalt: dieselbe Rueckfallkette wie die Ewige Tabelle (Saisonende vor Eintrittsstand). */
function kasseAusEintrag(team: FoundationSeasonHistoryTeamEntry): number | null {
  return zahl(team.cashSeasonEnd) ?? zahl(team.cashCarryOver) ?? zahl(team.cashEntry) ?? zahl(team.cashEnd) ?? zahl(team.cashTotal);
}

function marktwertAusEintrag(team: FoundationSeasonHistoryTeamEntry): number | null {
  return zahl(team.marketValueSeasonEnd) ?? zahl(team.marketValueTotalEnd) ?? zahl(team.marketValueEnd);
}

function gehaltAusEintrag(team: FoundationSeasonHistoryTeamEntry): number | null {
  return zahl(team.salarySeasonEnd) ?? zahl(team.salaryTotalEnd) ?? zahl(team.salaryEnd);
}

/** Ist Platz `rank` in `liga` ein Aufstiegs-/Abstiegsplatz nach der Tabellenregel? */
export function tabellenRegel(liga: number | null, rank: number | null): { aufstieg: boolean; abstieg: boolean } {
  if (liga == null || rank == null) return { aufstieg: false, abstieg: false };
  if (liga === 1) return { aufstieg: false, abstieg: rank > LEAGUE_SIZE - RELEGATION_COUNT };
  return { aufstieg: rank <= RELEGATION_COUNT, abstieg: false };
}

export function baueHistorieSaisons(historie: readonly FoundationSeasonHistoryEntry[], limit = 6): HistorieSaison[] {
  const sortiert = [...historie].sort((a, b) => a.seasonId.localeCompare(b.seasonId, "de", { numeric: true }));
  const ligaNachSaisonUndTeam = new Map<string, number | null>();
  for (const eintrag of sortiert) {
    for (const team of eintrag.teams) {
      ligaNachSaisonUndTeam.set(`${eintrag.seasonId}|${team.teamId}`, getLeagueLevel(team.leagueTier));
    }
  }

  return sortiert.map((eintrag, index) => {
    const folge = sortiert[index + 1] ?? null;
    const zeilen: HistorieTeamSaison[] = eintrag.teams.map((team) => {
      const liga = getLeagueLevel(team.leagueTier);
      const rank = zahl(team.rank);
      const regel = tabellenRegel(liga, rank);
      const ligaFolge = folge ? (ligaNachSaisonUndTeam.get(`${folge.seasonId}|${team.teamId}`) ?? null) : null;
      let aufstieg = regel.aufstieg;
      let abstieg = regel.abstieg;
      if (liga != null && ligaFolge != null) {
        aufstieg = ligaFolge < liga;
        abstieg = ligaFolge > liga;
      }
      const meister = rank === 1 && (liga ?? 1) === 1;
      return {
        teamId: team.teamId,
        teamCode: team.teamCode ?? team.teamId,
        teamName: team.teamName ?? team.teamId,
        seasonId: eintrag.seasonId,
        seasonNummer: saisonNummer(eintrag.seasonId),
        liga,
        rank,
        points: zahl(team.points),
        pow: zahl(team.disciplinePointsByArea?.pow),
        spe: zahl(team.disciplinePointsByArea?.spe),
        men: zahl(team.disciplinePointsByArea?.men),
        soc: zahl(team.disciplinePointsByArea?.soc),
        startplatz: zahl(team.startplatz),
        rankDiff: zahl(team.rankDiff),
        cash: kasseAusEintrag(team),
        salary: gehaltAusEintrag(team),
        marketValue: marktwertAusEintrag(team),
        guv: zahl(team.guv),
        transferNet: zahl(team.transferNet),
        kaderaufbauNet: zahl(team.kaderaufbauNet),
        meister,
        meisterLiga2: rank === 1 && liga === 2,
        aufstieg,
        abstieg,
        position: toLeagueSpanningPosition(rank, team.leagueTier ?? null),
      };
    });

    const ligenStufen = [...new Set(zeilen.map((zeile) => zeile.liga))].sort((a, b) => (a ?? 0) - (b ?? 0));
    const ligen: HistorieLiga[] = ligenStufen.map((liga) => ({
      liga,
      zeilen: zeilen
        .filter((zeile) => zeile.liga === liga)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.teamName.localeCompare(b.teamName, "de")),
    }));

    const mitDiff = zeilen.filter((zeile) => zeile.rankDiff != null && zeile.rankDiff !== 0);
    return {
      seasonId: eintrag.seasonId,
      nummer: saisonNummer(eintrag.seasonId),
      label: getCanonicalSeasonLabel({ seasonId: eintrag.seasonId, seasonName: eintrag.seasonName }),
      ligen,
      meister: zeilen.find((zeile) => zeile.meister) ?? null,
      meisterLiga2: zeilen.find((zeile) => zeile.meisterLiga2) ?? null,
      aufsteiger: zeilen.filter((zeile) => zeile.aufstieg).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)),
      absteiger: zeilen.filter((zeile) => zeile.abstieg).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)),
      kletterer: mitDiff
        .filter((zeile) => (zeile.rankDiff ?? 0) > 0)
        .sort((a, b) => (b.rankDiff ?? 0) - (a.rankDiff ?? 0))
        .slice(0, limit),
      absturz: mitDiff
        .filter((zeile) => (zeile.rankDiff ?? 0) < 0)
        .sort((a, b) => (a.rankDiff ?? 0) - (b.rankDiff ?? 0))
        .slice(0, limit),
    };
  });
}

export type HistorieTeamVerlauf = {
  teamId: string;
  teamName: string;
  teamCode: string;
  /** Meistertitel der Liga 1. */
  titel: number;
  titelLiga2: number;
  aufstiege: number;
  abstiege: number;
  /** Bester Platz ueber beide Ligen (Liga 2 ab 17) — Entscheidung 4. */
  besterPosition: number | null;
  saisons: HistorieTeamSaison[];
};

export function baueTeamVerlauf(saisons: readonly HistorieSaison[], teamId: string): HistorieTeamVerlauf | null {
  const zeilen: HistorieTeamSaison[] = [];
  for (const saison of saisons) {
    for (const liga of saison.ligen) {
      const zeile = liga.zeilen.find((eintrag) => eintrag.teamId === teamId);
      if (zeile) zeilen.push(zeile);
    }
  }
  if (zeilen.length === 0) return null;
  const positionen = zeilen.map((zeile) => zeile.position).filter((wert): wert is number => wert != null);
  const letzte = zeilen[zeilen.length - 1]!;
  return {
    teamId,
    teamName: letzte.teamName,
    teamCode: letzte.teamCode,
    titel: zeilen.filter((zeile) => zeile.meister).length,
    titelLiga2: zeilen.filter((zeile) => zeile.meisterLiga2).length,
    aufstiege: zeilen.filter((zeile) => zeile.aufstieg).length,
    abstiege: zeilen.filter((zeile) => zeile.abstieg).length,
    besterPosition: positionen.length > 0 ? Math.min(...positionen) : null,
    saisons: zeilen,
  };
}

/** „L1 · 11." bzw. „11." ohne Liga. */
export function platzMitLiga(zeile: Pick<HistorieTeamSaison, "liga" | "rank">): string {
  if (zeile.rank == null) return "—";
  return zeile.liga != null ? `L${zeile.liga} · ${zeile.rank}.` : `${zeile.rank}.`;
}

/** Der Verein mit den meisten Meistertiteln der Liga 1; bei Gleichstand der mit dem juengsten Titel. `null` ohne Titel. */
export function rekordmeister(saisons: readonly HistorieSaison[]): { teamId: string; teamName: string; teamCode: string; titel: number } | null {
  const zaehler = new Map<string, { teamId: string; teamName: string; teamCode: string; titel: number; zuletzt: number }>();
  saisons.forEach((saison, index) => {
    const meister = saison.meister;
    if (!meister) return;
    const eintrag = zaehler.get(meister.teamId) ?? {
      teamId: meister.teamId,
      teamName: meister.teamName,
      teamCode: meister.teamCode,
      titel: 0,
      zuletzt: -1,
    };
    eintrag.titel += 1;
    eintrag.zuletzt = index;
    zaehler.set(meister.teamId, eintrag);
  });
  const beste = [...zaehler.values()].sort((a, b) => b.titel - a.titel || b.zuletzt - a.zuletzt)[0];
  return beste ? { teamId: beste.teamId, teamName: beste.teamName, teamCode: beste.teamCode, titel: beste.titel } : null;
}
