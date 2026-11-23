/**
 * MARKETING: DER SPIELSTAND-KONTEXT (22.11.). Holt aus dem GameState, was die reine Rechnung (`marketing-modell.ts`) braucht:
 * Fanprofil des Teams (mit gedriftetem Farbstand), Liga, Teamerfolg der Vorsaison, Leistungsperzentil, Aushaengeschild.
 *
 * Importiert bewusst KEINEN Moral-Dienst: der Moral-Dienst ruft `marketingSpielerFuer` auf (er reicht die Moral OHNE Werbe-Zuschlag
 * hinein), die Team-Summen und die Buchung stehen in `marketing-team.ts`.
 */
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { FANPROFILE, type Fanfarbe } from "@/lib/marketing/marketing-daten";
import {
  berechneMarketing,
  tonDerFans,
  type FanProfil,
  type MarketingSpielerErgebnis,
  type MarketingTeamEingabe,
} from "@/lib/marketing/marketing-modell";
import { gueltigerMarketingStempel } from "@/lib/marketing/marketing-regel";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { LEAGUE_SIZE, getLeagueOf } from "@/lib/season/league-split";

/** Fanprofil eines Teams; ein Team ohne Eintrag (Testkader) bekommt ein neutrales Profil. */
export function fanProfilFuer(gameState: Pick<GameState, "seasonState" | "season">, teamId: string): FanProfil {
  const daten = FANPROFILE[teamId];
  const stempel = gueltigerMarketingStempel(gameState);
  const start: Fanfarbe = daten ? [...daten.farbeStart] : [5, 5, 5, 5];
  return {
    teamId,
    name: daten?.name ?? teamId,
    ton: daten ? tonDerFans(daten.manners) : 0,
    zielgruppe: daten?.zielgruppe ?? "Gemischtes Publikum",
    mag: daten?.mag ?? { rassen: [], klassen: [], traits: [] },
    meidet: daten?.meidet ?? { rassen: [], klassen: [], traits: [] },
    fanfarbe: stempel?.fanfarbe?.[teamId] ?? start,
  };
}

export function ligaStufeFuer(gameState: GameState, teamId: string): 1 | 2 {
  return getLeagueOf(gameState, teamId) === "liga2" ? 2 : 1;
}

/** Budget-Rang des Teams im eigenen Ligakreis (1 = reichstes Team; `team.budget` ist die Basis, nicht die Kasse) und die Groesse des Kreises. */
export function budgetRangFuer(gameState: GameState, teamId: string): { rang: number; anzahl: number } {
  const liga = getLeagueOf(gameState, teamId);
  const kreis = gameState.teams.filter((t) => !liga || getLeagueOf(gameState, t.teamId) === liga);
  const eigenes = gameState.teams.find((t) => t.teamId === teamId)?.budget ?? 0;
  const davor = kreis.filter((t) => t.budget > eigenes || (t.budget === eigenes && t.teamId < teamId)).length;
  return { rang: davor + 1, anzahl: Math.max(1, kreis.length) };
}

export type TeamErfolg = { punkte: number; grund: string; stufe: "verfehlt" | "erreicht" | "titel" | "keiner" };

/**
 * Teamerfolg der Vorsaison (Konzept 4.2): Saisonziel verfehlt -3, erreicht +3, Titel oder Farb-Meister +6; in Saison 1 0. Angenommen
 * wird: Saisonziel erreicht = obere Haelfte der Liga, Titel = Rang 1, Farb-Meister = meiste Punkte einer Farbe in der Liga.
 */
export function teamErfolgVorsaison(gameState: GameState, teamId: string): TeamErfolg {
  // Der Stempel traegt den Teamerfolg (beim Saisonwechsel aus dem Snapshot geschrieben): Server und Browser rechnen damit gleich, auch
  // wenn die Kompaktladung keine Snapshots mitbringt. Nur ein Stempel OHNE das Feld faellt auf den Snapshot zurueck.
  const stempel = gueltigerMarketingStempel(gameState);
  const gespeichert = stempel?.teamErfolg?.[teamId];
  if (gespeichert) return gespeichert;
  if (stempel?.teamErfolg) return { punkte: 0, grund: "erste Saison, noch kein Teamerfolg", stufe: "keiner" };
  const aktuell = gameState.seasonState?.seasonId ?? gameState.season?.id;
  const snaps = (gameState.seasonState?.seasonSnapshots ?? []).filter((s) => s.seasonId !== aktuell);
  return teamErfolgAusSnapshot(snaps[snaps.length - 1], teamId, gleicheLigaWie(gameState, teamId));
}

/** Prueft, ob ein anderes Team in derselben Liga spielt wie `teamId` (Farb-Meister zaehlt nur dort). */
export function gleicheLigaWie(gameState: GameState, teamId: string): (anderes: string) => boolean {
  const liga = getLeagueOf(gameState, teamId);
  return (anderes) => !liga || getLeagueOf(gameState, anderes) === liga;
}

export function teamErfolgAusSnapshot(
  snap: NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number] | undefined,
  teamId: string,
  /** Ligazugehoerigkeit je Team (der Farb-Meister zaehlt nur in der eigenen Liga); ohne sie zaehlen alle. */
  gleicheLiga?: (anderesTeamId: string) => boolean,
): TeamErfolg {
  const zeile = snap?.finalStandings?.find((z) => z.teamId === teamId);
  if (!snap || !zeile || zeile.rank == null) return { punkte: 0, grund: "erste Saison, noch kein Teamerfolg", stufe: "keiner" };
  const farben = ["pow", "spe", "men", "soc"] as const;
  const nameDe = { pow: "POW", spe: "SPE", men: "MEN", soc: "SOC" } as const;
  for (const f of farben) {
    const meiste = Math.max(...snap.finalStandings.filter((z) => !gleicheLiga || gleicheLiga(z.teamId)).map((z) => z.disciplinePointsByArea?.[f] ?? -Infinity));
    if ((zeile.disciplinePointsByArea?.[f] ?? -Infinity) === meiste && meiste > 0) {
      return { punkte: 6, grund: `Farb-Meister ${nameDe[f]} in der Vorsaison`, stufe: "titel" };
    }
  }
  if (zeile.rank === 1) return { punkte: 6, grund: "Titel in der Vorsaison", stufe: "titel" };
  if (zeile.rank <= LEAGUE_SIZE / 2) return { punkte: 3, grund: "Saisonziel erreicht", stufe: "erreicht" };
  return { punkte: -3, grund: "Saisonziel verfehlt", stufe: "verfehlt" };
}

type PercentilCache = { quelle: readonly Player[]; perz: Map<string, number> };
let percentilCache: PercentilCache | null = null;

/** Leistungsperzentil 0..100 je Spieler: Rating im Pool; mit Saison-PP zur Haelfte das PP-Perzentil (Konzept 2.1). Gecacht je Spielerliste. */
export function leistungsPerzentile(gameState: Pick<GameState, "players">): Map<string, number> {
  if (percentilCache && percentilCache.quelle === gameState.players) return percentilCache.perz;
  const spieler = gameState.players;
  const rangiere = (wert: (p: Player) => number | null) => {
    const liste = spieler.map((p) => ({ id: p.id, w: wert(p) })).filter((x): x is { id: string; w: number } => x.w != null);
    liste.sort((a, b) => a.w - b.w);
    const aus = new Map<string, number>();
    const n = liste.length;
    liste.forEach((x, i) => aus.set(x.id, n > 1 ? (i / (n - 1)) * 100 : 50));
    return aus;
  };
  const rating = rangiere((p) => (Number.isFinite(p.rating) ? p.rating : null));
  const pp = rangiere((p) => (typeof p.pps === "number" && Number.isFinite(p.pps) && p.pps > 0 ? p.pps : null));
  const perz = new Map<string, number>();
  for (const p of spieler) {
    const a = rating.get(p.id) ?? 0;
    const b = pp.get(p.id);
    perz.set(p.id, b == null ? a : 0.5 * a + 0.5 * b);
  }
  percentilCache = { quelle: gameState.players, perz };
  return perz;
}

/** Leistungsperzentil eines Spielers: der eingefrorene Wert aus dem Marketing-Stand des Teams, sonst der heutige Stand. */
export function perzentilFuer(gameState: GameState, teamId: string, playerId: string): number {
  const stand = gameState.seasonState?.marketingStand?.[teamId];
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  const fest = stand && stand.seasonId === seasonId ? stand.leistungPerz[playerId] : undefined;
  return fest ?? leistungsPerzentile(gameState).get(playerId) ?? 0;
}

export function istVerletzt(gameState: Pick<GameState, "seasonState">, playerId: string, teamId: string): boolean {
  return (gameState.seasonState?.playerAvailabilityState ?? []).some(
    (e) => e.playerId === playerId && e.teamId === teamId && (e.injuryStatus === "injured" || (e as { status?: string }).status === "injured"),
  );
}

function jahresgehalt(player: Player | null, entry: RosterEntry): number {
  return resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? entry.salary ?? 0;
}

type RosterIndexCache = { quelle: readonly RosterEntry[]; jeTeam: Map<string, RosterEntry[]>; spieler: Map<string, Player> ; spielerQuelle: readonly Player[] };
let rosterCache: RosterIndexCache | null = null;
function indizes(gameState: Pick<GameState, "rosters" | "players">) {
  if (rosterCache && rosterCache.quelle === gameState.rosters && rosterCache.spielerQuelle === gameState.players) return rosterCache;
  const jeTeam = new Map<string, RosterEntry[]>();
  for (const e of gameState.rosters) (jeTeam.get(e.teamId) ?? jeTeam.set(e.teamId, []).get(e.teamId)!).push(e);
  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  rosterCache = { quelle: gameState.rosters, jeTeam, spieler, spielerQuelle: gameState.players };
  return rosterCache;
}

export function kaderEinesTeams(gameState: Pick<GameState, "rosters" | "players">, teamId: string): Array<{ entry: RosterEntry; player: Player }> {
  const ix = indizes(gameState);
  const aus: Array<{ entry: RosterEntry; player: Player }> = [];
  for (const entry of ix.jeTeam.get(teamId) ?? []) {
    const player = ix.spieler.get(entry.playerId);
    if (player) aus.push({ entry, player });
  }
  return aus;
}

function alleTraits(p: Player): string[] {
  return [...(p.traitsPositive ?? []), ...(p.traitsNegative ?? [])];
}

/** Marketability des Spielers bei diesem Team, OHNE Team-Anteil-Details (reicht fuer die Aushaengeschild-Wahl und die Markt-Spalte). */
export function marketabilityFuer(gameState: GameState, teamId: string, player: Player): number {
  const e = berechneMarketing(
    {
      race: player.race,
      className: player.className,
      alignment: player.alignment,
      traits: alleTraits(player),
      leistungPerz: perzentilFuer(gameState, teamId, player.id),
      gehalt: 0,
    },
    teamEingabe(gameState, teamId),
  );
  return e.marketability;
}

const erfolgCache = new WeakMap<object, Map<string, TeamErfolg>>();
function teamEingabe(gameState: GameState, teamId: string): MarketingTeamEingabe {
  let jeTeam = erfolgCache.get(gameState);
  if (!jeTeam) {
    jeTeam = new Map();
    erfolgCache.set(gameState, jeTeam);
  }
  let erfolg = jeTeam.get(teamId);
  if (!erfolg) {
    erfolg = teamErfolgVorsaison(gameState, teamId);
    jeTeam.set(teamId, erfolg);
  }
  return { profil: fanProfilFuer(gameState, teamId), liga: ligaStufeFuer(gameState, teamId), erfolgPunkte: erfolg.punkte, erfolgGrund: erfolg.grund };
}

const gesichtCache = new WeakMap<object, Map<string, string | null>>();

/**
 * Aushaengeschild des Teams: die Manager-Wahl (`seasonState.marketingAushaengeschild`), sonst die KI-Regel -- hoechste Marketability
 * unter den sechs besten (nach Rating) des Kaders. `null` bei leerem Kader.
 */
export function aushaengeschildFuer(gameState: GameState, teamId: string): string | null {
  let jeTeam = gesichtCache.get(gameState);
  if (!jeTeam) {
    jeTeam = new Map();
    gesichtCache.set(gameState, jeTeam);
  }
  if (jeTeam.has(teamId)) return jeTeam.get(teamId)!;
  const kader = kaderEinesTeams(gameState, teamId);
  const wahl = gameState.seasonState?.marketingAushaengeschild?.[teamId];
  let id: string | null = null;
  if (wahl && wahl.seasonId === gameState.seasonState.seasonId && kader.some((k) => k.player.id === wahl.playerId)) {
    id = wahl.playerId;
  } else {
    const beste = [...kader].sort((a, b) => b.player.rating - a.player.rating || a.player.id.localeCompare(b.player.id)).slice(0, 6);
    let besterWert = -1;
    for (const k of beste) {
      const m = marketabilityFuer(gameState, teamId, k.player);
      if (m > besterWert) {
        besterWert = m;
        id = k.player.id;
      }
    }
  }
  jeTeam.set(teamId, id);
  return id;
}

/**
 * Die volle Marketing-Zerlegung EINES Spielers im Kader eines Teams. `moralOhne` = Moral OHNE den Werbe-Zuschlag (der Moral-Dienst
 * reicht sie hinein, damit der Team-Anteil sich nicht selbst hochzieht).
 */
export function marketingSpielerFuer(
  gameState: GameState,
  teamId: string,
  player: Player,
  entry: RosterEntry,
  moralOhne: number | null,
): MarketingSpielerErgebnis {
  return berechneMarketing(
    {
      race: player.race,
      className: player.className,
      alignment: player.alignment,
      traits: alleTraits(player),
      leistungPerz: perzentilFuer(gameState, teamId, player.id),
      gehalt: jahresgehalt(player, entry),
      moralOhne,
      restlaufzeit: Number.isFinite(entry.contractLength) ? entry.contractLength : null,
      klausel: entry.marketingKlausel ?? 0,
      // Verletzte zaehlen zur Haelfte; der Verfuegbarkeitsstatus steht im Kader-Hash des Dauer-Caches (marketing-team.ts).
      verletzt: istVerletzt(gameState, player.id, teamId),
      istGesicht: aushaengeschildFuer(gameState, teamId) === player.id,
    },
    teamEingabe(gameState, teamId),
  );
}
