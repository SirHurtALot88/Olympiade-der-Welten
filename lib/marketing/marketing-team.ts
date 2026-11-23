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
  budgetRangFuer,
  fanProfilFuer,
  istVerletzt,
  kaderEinesTeams,
  ligaStufeFuer,
  marketingSpielerFuer,
  teamErfolgAusSnapshot,
  teamErfolgVorsaison,
  type TeamErfolg,
} from "@/lib/marketing/marketing-kontext";
import { FANPROFILE, KLASSEN_FARBE, type Fanfarbe } from "@/lib/marketing/marketing-daten";
import { MARKETING_KONFIG, anteile4, moralZuschlagAus, teammarkeAusRang, driftFanfarbe, driftSchritt, type FanProfil, type MarketingSpielerErgebnis } from "@/lib/marketing/marketing-modell";
import { gueltigerMarketingStempel, marketingAktiv, marketingRegelFuerNeueSaison } from "@/lib/marketing/marketing-regel";
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
  /** Teammarke (Sockel) je Saison, umgekehrt nach Budget-Rang gestaffelt (reich zahlt weniger). */
  teammarke: number;
  /** Summe der Team-Anteile vor dem Deckel; greift der Deckel, geht der Rest als Spieler-Anteil an die Moral. */
  teamAnteileVorDeckel: number;
  deckelGreift: boolean;
  /** Teammarke + Team-Anteile: der Marketing-Betrag je Saison in der Kasse. */
  ansKasse: number;
  /** Mittlerer Team-Anteil in Prozent des Werbegelds. */
  mittlererAnteilProzent: number;
};

const uebersichtCache = new WeakMap<object, Map<string, MarketingTeamUebersicht>>();
/**
 * DAUER-CACHE (Nachbesserung 22.11.): Team-Anteile und Moral werden einmal je Saison und Kaderstand gerechnet, nicht je Spieltag fuer
 * alle Teams neu. Schluessel = Saison, Team, Liga, Fanfarbe, Aushaengeschild-Wahl und ein Hash des Kaders (Spieler, Restlaufzeit,
 * Klausel, Rating, Gehalt, Verletzt-Status). Kauf, Verkauf, Verlaengerung und Klausel aendern den Hash und rechnen neu; je Spieltag wird nur 1/N gebucht.
 * Die Moral im Team-Anteil ist damit auf den Stand beim ersten Rechnen der Saison bzw. nach der Kaderaenderung eingefroren.
 */
const dauerCache = new Map<string, MarketingTeamUebersicht>();
const DAUER_CACHE_MAX = 4000;

export function marketingCacheSchluessel(gameState: GameState, teamId: string): string {
  const kader = kaderEinesTeams(gameState, teamId)
    .map(({ entry, player }) => `${player.id}:${entry.contractLength}:${entry.marketingKlausel ?? 0}:${player.rating}:${Math.round((entry.salary ?? 0) * 10)}:${istVerletzt(gameState, player.id, teamId) ? 1 : 0}`)
    .sort()
    .join(",");
  const stempel = gueltigerMarketingStempel(gameState);
  return [
    gameState.season?.id ?? "",
    teamId,
    ligaStufeFuer(gameState, teamId),
    stempel?.fanfarbe?.[teamId]?.join("/") ?? "start",
    gameState.seasonState?.marketingAushaengeschild?.[teamId]?.playerId ?? "",
    budgetRangFuer(gameState, teamId).rang,
    kader,
  ].join("|");
}

/** Leert den Dauer-Cache (Tests). */
export function leereMarketingCache(): void {
  dauerCache.clear();
}

/** Gecacht je Spielstand-Objekt (erste Stufe) und je Saison/Kaderstand (zweite Stufe). */
export function marketingTeamUebersicht(gameState: GameState, teamId: string, index?: MoraleLookupIndex): MarketingTeamUebersicht {
  let jeTeam = uebersichtCache.get(gameState);
  if (!jeTeam) {
    jeTeam = new Map();
    uebersichtCache.set(gameState, jeTeam);
  }
  const bekannt = jeTeam.get(teamId);
  if (bekannt) return bekannt;
  const key = marketingCacheSchluessel(gameState, teamId);
  let neu = dauerCache.get(key);
  if (!neu) {
    neu = berechneUebersicht(gameState, teamId, index);
    if (dauerCache.size >= DAUER_CACHE_MAX) dauerCache.clear();
    dauerCache.set(key, neu);
  }
  jeTeam.set(teamId, neu);
  return neu;
}

/** Moral-Zuschlag EINES Spielers aus der (gecachten, gedeckelten) Team-Uebersicht; 0, wenn er nicht im Kader steht. */
export function marketingMoralZuschlag(gameState: GameState, teamId: string, playerId: string): number {
  return marketingTeamUebersicht(gameState, teamId).zeilen.find((z) => z.playerId === playerId)?.ergebnis.moralZuschlag ?? 0;
}

function berechneUebersicht(gameState: GameState, teamId: string, index?: MoraleLookupIndex): MarketingTeamUebersicht {
  const ix = index ?? buildMoraleLookupIndex(gameState);
  const kader = kaderEinesTeams(gameState, teamId);
  const liga = ligaStufeFuer(gameState, teamId);
  const gesichtId = aushaengeschildFuer(gameState, teamId);
  let zeilen: MarketingKaderZeile[] = kader.map(({ entry, player }) => {
    const moralOhne = moralOhneWerbung(gameState, player.id, teamId, ix);
    const ergebnis = marketingSpielerFuer(gameState, teamId, player, entry, moralOhne);
    return zeileAus(player, entry, moralOhne, ergebnis, gesichtId === player.id);
  });
  const teamAnteileVorDeckel = zeilen.reduce((s, z) => s + z.ergebnis.ansTeam, 0);
  const deckelGreift = teamAnteileVorDeckel > MARKETING_KONFIG.teamAnteileDeckel + 1e-9;
  if (deckelGreift) {
    // Deckel (Schere reich/arm): die Team-Anteile werden gleichmaessig gekuerzt, der Rest geht als Spieler-Anteil an die Moral.
    const faktor = MARKETING_KONFIG.teamAnteileDeckel / teamAnteileVorDeckel;
    zeilen = zeilen.map((z) => {
      const ansTeam = z.ergebnis.ansTeam * faktor;
      const anIhn = z.ergebnis.werbegeld - ansTeam;
      return { ...z, ergebnis: { ...z.ergebnis, ansTeam, anIhn, moralZuschlag: moralZuschlagAus(anIhn, z.traits) } };
    });
  }
  let werbegeld = 0;
  let teamAnteile = 0;
  let spielerAnteile = 0;
  for (const z of zeilen) {
    werbegeld += z.ergebnis.werbegeld;
    teamAnteile += z.ergebnis.ansTeam;
    spielerAnteile += z.ergebnis.anIhn;
  }
  const budgetRang = budgetRangFuer(gameState, teamId);
  const teammarke = teammarkeAusRang(liga, budgetRang.rang, budgetRang.anzahl);
  return {
    teamId,
    profil: fanProfilFuer(gameState, teamId),
    liga,
    erfolg: teamErfolgVorsaison(gameState, teamId),
    gesichtId,
    zeilen,
    werbegeld,
    teamAnteile,
    spielerAnteile,
    teammarke,
    teamAnteileVorDeckel,
    deckelGreift,
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
