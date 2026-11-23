/**
 * MARKETING JE TEAM (22.11.): die Zeilen des eigenen Kaders, die Summen und der Betrag fuer die Kasse. Die Seite `MarketingModern`,
 * die Buchung je Spieltag und die Prognose lesen genau diese Funktion (gezeigt = gebucht).
 *
 * Kasse: Teammarke + Summe der Team-Anteile (Spieler-Anteil geht NIE in die Kasse, er hebt die Moral). Alles je Saison; gebucht wird
 * je Spieltag ein N-tel (`bucheSpieltagFinanzen`, Posten "Marketing").
 */
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import {
  aushaengeschildFuer,
  fanProfilFuer,
  kaderEinesTeams,
  ligaStufeFuer,
  marketingSpielerFuer,
  teamErfolgAusSnapshot,
  teamErfolgVorsaison,
  type TeamErfolg,
} from "@/lib/marketing/marketing-kontext";
import { FANPROFILE, KLASSEN_FARBE, type Fanfarbe } from "@/lib/marketing/marketing-daten";
import { MARKETING_KONFIG, anteile4, driftFanfarbe, driftSchritt, type FanProfil, type MarketingSpielerErgebnis } from "@/lib/marketing/marketing-modell";
import { marketingAktiv, marketingRegelFuerNeueSaison } from "@/lib/marketing/marketing-regel";
import { summeSpieltagBuchungen, ungebuchterAnteil } from "@/lib/finance/finanzen-je-spieltag";
import { buildMoraleLookupIndex, moralOhneWerbung, type MoraleLookupIndex } from "@/lib/morale/player-morale-service";

export type MarketingKaderZeile = {
  playerId: string;
  name: string;
  className: string;
  race: string;
  portraitUrl: string | null;
  rating: number;
  gehalt: number;
  restlaufzeit: number | null;
  klausel: -1 | 0 | 1;
  moralOhne: number | null;
  traits: string[];
  istGesicht: boolean;
  ergebnis: MarketingSpielerErgebnis;
};

export type MarketingTeamUebersicht = {
  teamId: string;
  profil: FanProfil;
  liga: 1 | 2;
  erfolg: TeamErfolg;
  gesichtId: string | null;
  zeilen: MarketingKaderZeile[];
  /** Werbegeld aller Spieler je Saison. */
  werbegeld: number;
  /** Summe der Team-Anteile je Saison (geht in die Kasse). */
  teamAnteile: number;
  /** Summe der Spieler-Anteile je Saison (hebt die Moral, nie die Kasse). */
  spielerAnteile: number;
  /** Teammarke (Sockel) je Saison. */
  teammarke: number;
  /** Teammarke + Team-Anteile: der Marketing-Betrag je Saison in der Kasse. */
  ansKasse: number;
  /** Mittlerer Team-Anteil in Prozent des Werbegelds. */
  mittlererAnteilProzent: number;
};

const uebersichtCache = new WeakMap<object, Map<string, MarketingTeamUebersicht>>();

/** Gecacht je Spielstand-Objekt und Team: GuV, Seite und Buchung lesen im selben Zustand dieselbe Zahl, ohne die Moral mehrfach zu rechnen. */
export function marketingTeamUebersicht(gameState: GameState, teamId: string, index?: MoraleLookupIndex): MarketingTeamUebersicht {
  let jeTeam = uebersichtCache.get(gameState);
  if (!jeTeam) {
    jeTeam = new Map();
    uebersichtCache.set(gameState, jeTeam);
  }
  const bekannt = jeTeam.get(teamId);
  if (bekannt) return bekannt;
  const neu = berechneUebersicht(gameState, teamId, index);
  jeTeam.set(teamId, neu);
  return neu;
}

function berechneUebersicht(gameState: GameState, teamId: string, index?: MoraleLookupIndex): MarketingTeamUebersicht {
  const ix = index ?? buildMoraleLookupIndex(gameState);
  const kader = kaderEinesTeams(gameState, teamId);
  const liga = ligaStufeFuer(gameState, teamId);
  const zeilen: MarketingKaderZeile[] = kader.map(({ entry, player }) => {
    const moralOhne = moralOhneWerbung(gameState, player.id, teamId, ix);
    const ergebnis = marketingSpielerFuer(gameState, teamId, player, entry, moralOhne);
    return zeileAus(player, entry, moralOhne, ergebnis, aushaengeschildFuer(gameState, teamId) === player.id);
  });
  let werbegeld = 0;
  let teamAnteile = 0;
  let spielerAnteile = 0;
  for (const z of zeilen) {
    werbegeld += z.ergebnis.werbegeld;
    teamAnteile += z.ergebnis.ansTeam;
    spielerAnteile += z.ergebnis.anIhn;
  }
  const teammarke = MARKETING_KONFIG.teammarke[liga];
  return {
    teamId,
    profil: fanProfilFuer(gameState, teamId),
    liga,
    erfolg: teamErfolgVorsaison(gameState, teamId),
    gesichtId: aushaengeschildFuer(gameState, teamId),
    zeilen,
    werbegeld,
    teamAnteile,
    spielerAnteile,
    teammarke,
    ansKasse: teammarke + teamAnteile,
    mittlererAnteilProzent: werbegeld > 0 ? Math.round((teamAnteile / werbegeld) * 100) : 0,
  };
}

function zeileAus(player: Player, entry: RosterEntry, moralOhne: number | null, ergebnis: MarketingSpielerErgebnis, istGesicht: boolean): MarketingKaderZeile {
  return {
    playerId: player.id,
    name: player.name,
    className: player.className,
    race: player.race,
    portraitUrl: player.portraitUrl ?? player.portraitPath ?? null,
    rating: player.rating,
    gehalt: entry.salary,
    restlaufzeit: Number.isFinite(entry.contractLength) ? entry.contractLength : null,
    klausel: entry.marketingKlausel ?? 0,
    moralOhne,
    traits: [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])],
    istGesicht,
    ergebnis,
  };
}

/** Jahresbetrag fuer die Kasse (Teammarke + Team-Anteile) zum heutigen Stand; 0 ohne gueltige Regel. */
export function marketingJahresbetrag(gameState: GameState, teamId: string, index?: MoraleLookupIndex): number {
  if (!marketingAktiv(gameState)) return 0;
  return marketingTeamUebersicht(gameState, teamId, index).ansKasse;
}

/**
 * Marketing-Betrag der GANZEN Saison fuer die GuV: was je Spieltag schon gebucht ist plus der noch ungebuchte Anteil zum heutigen Stand.
 * Am Saisonende (nichts mehr offen) genau die Summe der gebuchten Zeilen. 0 ohne gueltige Regel.
 */
export function marketingSaisonbetrag(gameState: GameState, teamId: string, index?: MoraleLookupIndex): number {
  if (!marketingAktiv(gameState)) return 0;
  const gebucht = summeSpieltagBuchungen(gameState, teamId).marketing;
  const offen = ungebuchterAnteil(gameState, teamId);
  const rest = offen > 0 ? offen * marketingJahresbetrag(gameState, teamId, index) : 0;
  return Math.round((gebucht + rest) * 100) / 100;
}

/**
 * SAISONWECHSEL: der Stempel der neuen Saison mit gedrifteter Fanfarbe (Konzept 3.2) und fortgeschriebenem Verlauf.
 * `gameState` ist der Stand NACH der abgelaufenen Saison (Snapshot der Saison liegt vor, Kader noch der der alten Saison).
 * Kader-Anteil = Klassenfarben des Kaders am Saisonende (vereinfacht: gleich gewichtet statt nach Einsaetzen), Erfolgs-Anteil = die
 * Punkte des Teams nach Disziplinfarbe aus dem Saison-Snapshot. Schritt 10 / 15 / 20 % je nach Teamerfolg.
 */
export function marketingStempelFuerSaisonwechsel(
  gameState: GameState,
  abgelaufeneSaisonId: string,
  naechsteSaisonId: string,
): NonNullable<GameState["seasonState"]["marketingRegel"]> {
  const alt = gameState.seasonState.marketingRegel;
  const teamIds = gameState.teams.map((t) => t.teamId);
  if (!alt || alt.regel !== "an" || alt.seasonId !== abgelaufeneSaisonId) {
    // Vorsaison lief ohne Marketing (bestehender Spielstand oder Rueckweg): die Farbe startet frisch bei den Stammdaten.
    return marketingRegelFuerNeueSaison(naechsteSaisonId, teamIds, alt?.verlauf ? { verlauf: alt.verlauf } : undefined);
  }
  const snap = (gameState.seasonState.seasonSnapshots ?? []).find((s) => s.seasonId === abgelaufeneSaisonId);
  const fanfarbe: Record<string, Fanfarbe> = {};
  const verlauf: NonNullable<typeof alt.verlauf> = { ...(alt.verlauf ?? {}) };
  for (const teamId of teamIds) {
    const start = FANPROFILE[teamId]?.farbeStart ?? ([5, 5, 5, 5] as Fanfarbe);
    const vorher = alt.fanfarbe?.[teamId] ?? start;
    const kader: [number, number, number, number] = [0, 0, 0, 0];
    for (const { player } of kaderEinesTeams(gameState, teamId)) {
      const idx = KLASSEN_FARBE[player.className];
      if (idx != null) kader[idx] += 1;
    }
    const zeile = snap?.finalStandings?.find((z) => z.teamId === teamId);
    const erfolg: [number, number, number, number] = [
      zeile?.disciplinePointsByArea?.pow ?? 0,
      zeile?.disciplinePointsByArea?.spe ?? 0,
      zeile?.disciplinePointsByArea?.men ?? 0,
      zeile?.disciplinePointsByArea?.soc ?? 0,
    ];
    const ergebnis = teamErfolgAusSnapshot(snap, teamId);
    const stufe = ergebnis.stufe === "titel" ? "titel" : ergebnis.stufe === "erreicht" ? "erreicht" : "verfehlt";
    const neu = driftFanfarbe(vorher, start, anteile4(kader), anteile4(erfolg), driftSchritt(stufe));
    fanfarbe[teamId] = neu;
    const liste = verlauf[teamId] ?? [{ seasonId: abgelaufeneSaisonId, farbe: [...vorher] as Fanfarbe, grund: "Start" }];
    verlauf[teamId] = [...liste, { seasonId: naechsteSaisonId, farbe: neu, grund: ergebnis.grund }];
  }
  return marketingRegelFuerNeueSaison(naechsteSaisonId, teamIds, { fanfarbe, verlauf });
}
