// =====================================================================================
// Spieltagswertung (neu, 18.11.) — Zeilen, Filter, Sortierung. Reine Funktionen, kein React.
// =====================================================================================
//
// GEZEIGT = GEBUCHT: nichts wird hier neu gerechnet. Jede Zahl stammt aus den Props der alten Wertung
// (`teamResults`, `standings`, `mutatorByTeam`, `modifiersByTeam`, `playersByTeam`) und folgt DERSELBEN
// Aufdeck-Regel wie `DisciplineStageMatchdayPanel` (verdeckte Seite = kein Wert, nie eine erfundene 0):
//   Punkte  = d1Points + d2Points der aufgedeckten Seiten      (= `sum` der alten Tabelle)
//   Mutator = Σ Mutator-PP der aufgedeckten Seiten              (= `mutPp`)
//   Gesamt  = Punkte + Mutator                                  (= `total`)
//   Form / Captain = Σ `formModifier` / `captainBonus` der aufgedeckten Seiten (Score, KEINE Punkte)
// Tagesrang und Saison-Rang-Spalte laufen über dieselben, bereits getesteten Helfer des alten Panels.

import {
  applySeasonRankColumn,
  resolveMatchdayRanks,
  type MatchdayPanelDiscipline,
  type MatchdayPanelMutatorEntry,
  type MatchdayPanelPlayerRow,
  type MatchdayPanelSideResult,
  type MatchdayPanelStandingRow,
  type MatchdayPanelTeamMeta,
  type MatchdayPanelTeamResult,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";
import type { MatchdayTeamModifiers } from "@/lib/foundation/matchday-team-modifiers";

export type WertungsSeite = "d1" | "d2";
export type WertungsLiga = "liga1" | "liga2";
export type WertungsFilter = "liga2" | "liga1" | "alle" | "gruppe" | "mensch";
export type WertungsSortierung = "ges" | "pkt" | "form" | "cap" | "mut" | "sai" | "d1" | "d2";

/** Eine Disziplin-Seite eines Teams, so wie Tabelle und Blatt sie brauchen. */
export type WertungsSeitenWerte = {
  /** Seite aufgedeckt? Sonst sind alle Werte `null` (kein Spoiler, keine erfundene 0). */
  aufgedeckt: boolean;
  /** Punkte dieser Seite (`d1Points`/`d2Points`), `null` = unbekannt oder verdeckt. */
  punkte: number | null;
  ergebnis: MatchdayPanelSideResult | null;
  formLabel: string | null;
  form: number | null;
  captain: number | null;
  captainName: string | null;
  mutator: number | null;
  mutatorSpieler: Array<{ name: string; pp: number }>;
  spieler: MatchdayPanelPlayerRow[];
  ausfallGrund: string | null;
};

export type WertungsZeile = {
  teamId: string;
  name: string;
  code: string;
  logoUrl: string | null;
  istEigen: boolean;
  /** Name des Menschen, der das Team steuert, sonst `null` (KI). */
  mensch: string | null;
  liga: WertungsLiga | null;
  /** Rang nur dieses Spieltags nach Gesamt. */
  tagesRang: number | null;
  d1: WertungsSeitenWerte;
  d2: WertungsSeitenWerte;
  punkte: number;
  mutator: number;
  gesamt: number;
  form: number;
  captain: number;
  hatForm: boolean;
  hatCaptain: boolean;
  vorRang: number | null;
  nachRang: number | null;
  /** Saison-Punkte vor / nach dem Spieltag (Standings-Preview), `null` wenn die Preview sie nicht trägt. */
  vorPunkte: number | null;
  nachPunkte: number | null;
  /** vorRang − nachRang: positiv = aufgestiegen. `null`, solange einer der beiden Ränge fehlt. */
  bewegung: number | null;
  missingLineup: boolean;
};

export type WertungsEingabe = {
  teamResults: MatchdayPanelTeamResult[];
  standings: MatchdayPanelStandingRow[];
  d1: MatchdayPanelDiscipline | null;
  d2: MatchdayPanelDiscipline | null;
  d1Revealed: boolean;
  d2Revealed: boolean;
  teamMetaById: Map<string, MatchdayPanelTeamMeta>;
  ownTeamId: string | null;
  mutatorByTeam?: Map<string, MatchdayPanelMutatorEntry> | null;
  playersByTeam?: Map<string, { d1: MatchdayPanelPlayerRow[]; d2: MatchdayPanelPlayerRow[] }> | null;
  modifiersByTeam?: Map<string, MatchdayTeamModifiers> | null;
  leagueByTeam?: Map<string, WertungsLiga> | null;
  humanLabelByTeam?: Map<string, string> | null;
};

function seitenWerte(
  seite: WertungsSeite,
  aufgedeckt: boolean,
  punkte: number | null,
  eingabe: WertungsEingabe,
  teamId: string,
  res: MatchdayPanelTeamResult | undefined,
): WertungsSeitenWerte {
  if (!aufgedeckt) {
    return {
      aufgedeckt: false,
      punkte: null,
      ergebnis: null,
      formLabel: null,
      form: null,
      captain: null,
      captainName: null,
      mutator: null,
      mutatorSpieler: [],
      spieler: [],
      ausfallGrund: null,
    };
  }
  const mods = eingabe.modifiersByTeam?.get(teamId)?.[seite] ?? null;
  const mut = eingabe.mutatorByTeam?.get(teamId);
  // Das Ergebnis in Worten hängt an der Disziplin-Zuordnung des Teams (wie die Punkte): liegt die gesuchte
  // Disziplin auf der anderen Seite des Team-Ergebnisses, kommt es von dort.
  const disziplin = seite === "d1" ? eingabe.d1 : eingabe.d2;
  const ergebnis =
    res == null
      ? null
      : res.d1DisciplineId === disziplin?.disciplineId
        ? res.d1Ergebnis ?? null
        : res.d2DisciplineId === disziplin?.disciplineId
          ? res.d2Ergebnis ?? null
          : null;
  return {
    aufgedeckt: true,
    punkte,
    ergebnis,
    formLabel: mods?.formCardLabel ?? null,
    form: mods?.formModifier ?? 0,
    captain: mods?.captainUsed ? mods.captainBonus ?? 0 : mods?.captainBonus ?? null,
    captainName: mods?.captainName ?? null,
    mutator: (seite === "d1" ? mut?.d1Pp : mut?.d2Pp) ?? 0,
    mutatorSpieler: (seite === "d1" ? mut?.d1Players : mut?.d2Players) ?? [],
    spieler: eingabe.playersByTeam?.get(teamId)?.[seite] ?? [],
    ausfallGrund: (seite === "d1" ? res?.d1ArenaAusfallGrund : res?.d2ArenaAusfallGrund) ?? null,
  };
}

export function baueWertungsZeilen(eingabe: WertungsEingabe): WertungsZeile[] {
  const resultByTeam = new Map(eingabe.teamResults.map((r) => [r.teamId, r]));
  const zeilen = eingabe.standings.map((s): WertungsZeile => {
    const res = resultByTeam.get(s.teamId);
    const d1Id = eingabe.d1?.disciplineId;
    const d2Id = eingabe.d2?.disciplineId;
    const d1Pts = res ? (res.d1DisciplineId === d1Id ? res.d1Points : res.d2DisciplineId === d1Id ? res.d2Points : null) : null;
    const d2Pts = res ? (res.d1DisciplineId === d2Id ? res.d1Points : res.d2DisciplineId === d2Id ? res.d2Points : null) : null;
    const d1 = seitenWerte("d1", eingabe.d1Revealed, d1Pts, eingabe, s.teamId, res);
    const d2 = seitenWerte("d2", eingabe.d2Revealed, d2Pts, eingabe, s.teamId, res);
    const punkte = (d1.aufgedeckt ? d1Pts ?? 0 : 0) + (d2.aufgedeckt ? d2Pts ?? 0 : 0);
    const mutator = (d1.mutator ?? 0) + (d2.mutator ?? 0);
    const form = (d1.form ?? 0) + (d2.form ?? 0);
    const captain = (d1.captain ?? 0) + (d2.captain ?? 0);
    const meta = eingabe.teamMetaById.get(s.teamId);
    return {
      teamId: s.teamId,
      name: meta?.name ?? meta?.code ?? s.teamId,
      code: meta?.code ?? s.teamId,
      logoUrl: meta?.logoUrl ?? null,
      istEigen: s.teamId === eingabe.ownTeamId,
      mensch: eingabe.humanLabelByTeam?.get(s.teamId) ?? null,
      liga: eingabe.leagueByTeam?.get(s.teamId) ?? null,
      tagesRang: null,
      d1,
      d2,
      punkte,
      mutator,
      gesamt: punkte + mutator,
      form,
      captain,
      hatForm: (d1.formLabel ?? d2.formLabel) != null,
      hatCaptain: d1.captain != null || d2.captain != null,
      vorRang: s.currentRank,
      nachRang: s.projectedRank,
      bewegung: null,
      vorPunkte: s.currentPoints,
      nachPunkte: s.projectedPoints,
      missingLineup: res?.missingLineup ?? false,
    };
  });

  // Tagesrang: dieselbe Funktion wie die alte Tabelle (`total` = Gesamt). Saison-Rang nach dem Spieltag:
  // aus der Engine, sonst aus Stand + Punkten abgeleitet (`applySeasonRankColumn`, braucht currentPoints).
  const ranks = resolveMatchdayRanks(zeilen.map((z) => ({ teamId: z.teamId, total: z.gesamt })));
  const standingById = new Map(eingabe.standings.map((s) => [s.teamId, s]));
  const rankInput = zeilen.map((z) => ({
    teamId: z.teamId,
    currentPoints: standingById.get(z.teamId)?.currentPoints ?? null,
    sum: z.punkte,
    projectedRank: z.nachRang,
  }));
  applySeasonRankColumn(rankInput);
  const nachById = new Map(rankInput.map((r) => [r.teamId, r.projectedRank]));
  const etwasGewertet = eingabe.d1Revealed || eingabe.d2Revealed;
  for (const z of zeilen) {
    z.tagesRang = etwasGewertet ? ranks.get(z.teamId) ?? null : null;
    z.nachRang = nachById.get(z.teamId) ?? null;
    z.bewegung = z.vorRang != null && z.nachRang != null ? z.vorRang - z.nachRang : null;
  }
  return sortiereWertungsZeilen(zeilen, "ges");
}

const SORT_WERT: Record<WertungsSortierung, (z: WertungsZeile) => number> = {
  ges: (z) => z.gesamt,
  pkt: (z) => z.punkte,
  form: (z) => z.form,
  cap: (z) => z.captain,
  mut: (z) => z.mutator,
  // Saison-Rang nach dem Spieltag: kleiner = besser, deshalb negiert; fehlender Rang ganz unten.
  sai: (z) => (z.nachRang != null ? -z.nachRang : Number.NEGATIVE_INFINITY),
  d1: (z) => z.d1.punkte ?? Number.NEGATIVE_INFINITY,
  d2: (z) => z.d2.punkte ?? Number.NEGATIVE_INFINITY,
};

/** Absteigend nach dem Schlüssel; Gleichstand nach Gesamt, dann Tagesrang, dann Name (stabil, deterministisch). */
export function sortiereWertungsZeilen(zeilen: WertungsZeile[], schluessel: WertungsSortierung): WertungsZeile[] {
  const wert = SORT_WERT[schluessel];
  return [...zeilen].sort(
    (a, b) =>
      wert(b) - wert(a) ||
      b.gesamt - a.gesamt ||
      (a.tagesRang ?? 999) - (b.tagesRang ?? 999) ||
      a.name.localeCompare(b.name, "de"),
  );
}

/** Die vier Teams der Vierergruppe des eigenen Teams (aus `miniDmPod`), `null` wenn es keine gibt. */
export function findeEigeneGruppe(zeilen: WertungsZeile[], ownTeamId: string | null): string[] | null {
  const eigen = zeilen.find((z) => z.teamId === ownTeamId);
  if (!eigen) return null;
  for (const seite of [eigen.d2, eigen.d1]) {
    if (seite.ergebnis?.art === "gruppe") return seite.ergebnis.teamIds;
  }
  return null;
}

export function hatLigaTrennung(zeilen: WertungsZeile[]): boolean {
  return zeilen.some((z) => z.liga === "liga1") && zeilen.some((z) => z.liga === "liga2");
}

export function filtereWertungsZeilen(
  zeilen: WertungsZeile[],
  filter: WertungsFilter,
  ownTeamId: string | null,
): WertungsZeile[] {
  switch (filter) {
    case "liga1":
      return zeilen.filter((z) => z.liga === "liga1");
    case "liga2":
      return zeilen.filter((z) => z.liga === "liga2");
    case "gruppe": {
      const gruppe = findeEigeneGruppe(zeilen, ownTeamId);
      return gruppe ? zeilen.filter((z) => gruppe.includes(z.teamId)) : [];
    }
    case "mensch":
      return zeilen.filter((z) => z.mensch != null);
    default:
      return zeilen;
  }
}

/** Start-Filter: die eigene Liga, wenn es eine Ligatrennung gibt, sonst alle. */
export function startFilter(zeilen: WertungsZeile[], ownTeamId: string | null): WertungsFilter {
  if (!hatLigaTrennung(zeilen)) return "alle";
  const liga = zeilen.find((z) => z.teamId === ownTeamId)?.liga;
  return liga === "liga1" ? "liga1" : liga === "liga2" ? "liga2" : "alle";
}

/** Ergebnis einer Seite in einem Satz (Blatt rechts), z. B. „Sieg 78 : 71 gegen Natures Wrath". */
export function beschreibeWertungsErgebnis(
  ergebnis: MatchdayPanelSideResult | null,
  teamName: (teamId: string) => string | null,
): string | null {
  if (!ergebnis) return null;
  if (ergebnis.art === "duell") {
    const wort = ergebnis.eigen > ergebnis.gegner ? "Sieg" : ergebnis.eigen < ergebnis.gegner ? "Niederlage" : "Unentschieden";
    const gegner = ergebnis.gegnerTeamId ? teamName(ergebnis.gegnerTeamId) : null;
    return `${wort} ${formatZahl(ergebnis.eigen)} : ${formatZahl(ergebnis.gegner)}${gegner ? ` gegen ${gegner}` : ""}`;
  }
  const wert = ergebnis.wert != null ? ` · Gruppenwert ${formatZahl(ergebnis.wert)}` : "";
  return `Platz ${ergebnis.platz} von ${ergebnis.teamIds.length}${wert}`;
}

/** Marke in der Tabellenzelle: S/N/U für Duelle, „1." bis „4." für Gruppen. */
export function wertungsMarke(ergebnis: MatchdayPanelSideResult | null): { text: string; ton: "s" | "z" | "n" } | null {
  if (!ergebnis) return null;
  if (ergebnis.art === "duell") {
    return ergebnis.eigen > ergebnis.gegner
      ? { text: "S", ton: "s" }
      : ergebnis.eigen < ergebnis.gegner
        ? { text: "N", ton: "n" }
        : { text: "U", ton: "z" };
  }
  return { text: `${ergebnis.platz}.`, ton: ergebnis.platz === 1 ? "s" : ergebnis.platz === 2 ? "z" : "n" };
}

function formatZahl(wert: number): string {
  return (Math.round(wert * 10) / 10).toString().replace(".", ",");
}
