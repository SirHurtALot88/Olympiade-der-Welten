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
  gleicheLigaWie,
  istVerletzt,
  kaderEinesTeams,
  leistungsPerzentile,
  ligaStufeFuer,
  marketingSpielerFuer,
  teamErfolgAusSnapshot,
  teamErfolgVorsaison,
  type TeamErfolg,
} from "@/lib/marketing/marketing-kontext";
import { FANPROFILE, KLASSEN_FARBE, type Fanfarbe } from "@/lib/marketing/marketing-daten";
import { MARKETING_KONFIG, anteile4, moralZuschlagAus, teammarkeAusRang, driftFanfarbe, driftSchritt, type FanProfil, type MarketingSpielerErgebnis } from "@/lib/marketing/marketing-modell";
import { gueltigerMarketingStempel, marketingAktiv, marketingRegelFuerNeueSaison, marketingSchalter } from "@/lib/marketing/marketing-regel";
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
  /** true: kein gueltiger Marketing-Stand (Saisonbeginn oder Kader seit dem letzten Buchen geaendert); heutige Werte, die Buchung rechnet neu. */
  vorschau: boolean;
};

const uebersichtCache = new WeakMap<object, Map<string, MarketingTeamUebersicht>>();

type MarketingStandEintrag = NonNullable<NonNullable<GameState["seasonState"]["marketingStand"]>[string]>;

/**
 * KADER-HASH: Spieler, Restlaufzeit, Klausel, Rating, Gehalt, Verletzt-Status und die Aushaengeschild-Wahl. Aendert er sich, ist der
 * Marketing-Stand des Teams veraltet; der Server rechnet ihn beim naechsten Buchen neu (Kauf, Verkauf, Verlaengerung, Klausel, Verletzung).
 */
export function marketingKaderHash(gameState: GameState, teamId: string): string {
  const kader = kaderEinesTeams(gameState, teamId)
    .map(({ entry, player }) => `${player.id}:${entry.contractLength}:${entry.marketingKlausel ?? 0}:${player.rating}:${Math.round((entry.salary ?? 0) * 10)}:${istVerletzt(gameState, player.id, teamId) ? 1 : 0}`)
    .sort()
    .join(",");
  return [teamId, gameState.seasonState?.marketingAushaengeschild?.[teamId]?.playerId ?? "", kader].join("|");
}

/** Der Marketing-Stand des Teams in der laufenden Saison (egal ob der Kader-Hash noch passt), sonst `null`. */
export function marketingStandFuer(gameState: GameState, teamId: string): MarketingStandEintrag | null {
  const stand = gameState.seasonState?.marketingStand?.[teamId];
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  return stand && stand.seasonId === seasonId ? stand : null;
}

/**
 * Die Team-Uebersicht fuer Seite, Prognose und Buchung. Mit gueltigem Stand (Kader-Hash passt) rechnet sie NUR mit den eingefrorenen
 * Eingaben des Standes (Moral, Leistungsperzentil, Teamerfolg aus dem Stempel): Server, Browser und Neustart ergeben dieselbe Zahl.
 * Ohne Stand oder bei geaendertem Kader ist es eine Vorschau (`vorschau: true`) mit den heutigen Werten. Kein modulweiter Cache mit
 * Zustandswirkung, nur ein Memo je Spielstand-Objekt.
 */
export function marketingTeamUebersicht(gameState: GameState, teamId: string, index?: MoraleLookupIndex): MarketingTeamUebersicht {
  let jeTeam = uebersichtCache.get(gameState);
  if (!jeTeam) {
    jeTeam = new Map();
    uebersichtCache.set(gameState, jeTeam);
  }
  const bekannt = jeTeam.get(teamId);
  if (bekannt) return bekannt;
  const stand = marketingStandFuer(gameState, teamId);
  const gueltig = stand != null && stand.kaderHash === marketingKaderHash(gameState, teamId);
  const neu = berechneUebersicht(gameState, teamId, gueltig ? stand : null, index);
  jeTeam.set(teamId, { ...neu, vorschau: !gueltig });
  return jeTeam.get(teamId)!;
}

/** Moral-Zuschlag EINES Spielers aus dem Marketing-Stand des Teams; 0 ohne Stand oder wenn er nicht im Stand steht. */
export function marketingMoralZuschlag(gameState: GameState, teamId: string, playerId: string): number {
  return marketingStandFuer(gameState, teamId)?.moralZuschlag?.[playerId] ?? 0;
}

/**
 * Schreibt den Marketing-Stand (nur Server, aus `bucheSpieltagFinanzen`): beim ersten Spieltag der Saison und neu, wenn sich der
 * Kader-Hash eines Teams geaendert hat. Moral und Leistungsperzentil werden dabei mit dem Stand dieses Spieltags eingefroren.
 * Spiegelt ausserdem die Notbremse in den Stempel. Gibt den Spielstand unveraendert zurueck, wenn nichts zu tun ist.
 */
export function aktualisiereMarketingStand(gameState: GameState, spieltagIndex: number): GameState {
  const stempel = gueltigerMarketingStempel(gameState);
  if (!stempel || stempel.regel !== "an") return gameState;
  let naechster = gameState;
  if (marketingSchalter() === "aus-sofort") {
    if (stempel.notbremse) return gameState;
    return { ...gameState, seasonState: { ...gameState.seasonState, marketingRegel: { ...stempel, notbremse: true } } };
  }
  if (!marketingAktiv(gameState)) return gameState;
  const seasonId = gameState.seasonState.seasonId ?? gameState.season.id;
  // Frische Huelle ohne Stand: alle Lesewege (Perzentil, Moral) rechnen mit den heutigen Werten.
  const live: GameState = { ...gameState, seasonState: { ...gameState.seasonState, marketingStand: null } };
  const ix = buildMoraleLookupIndex(live);
  const neuerStand: NonNullable<GameState["seasonState"]["marketingStand"]> = { ...(gameState.seasonState.marketingStand ?? {}) };
  let geaendert = false;
  for (const team of gameState.teams) {
    const hash = marketingKaderHash(gameState, team.teamId);
    const alt = marketingStandFuer(gameState, team.teamId);
    if (alt && alt.kaderHash === hash) continue;
    const u = berechneUebersicht(live, team.teamId, null, ix);
    const perz = leistungsPerzentile(live);
    const moralOhne: Record<string, number | null> = {};
    const leistungPerz: Record<string, number> = {};
    const moralZuschlag: Record<string, number> = {};
    for (const z of u.zeilen) {
      moralOhne[z.playerId] = z.moralOhne;
      leistungPerz[z.playerId] = perz.get(z.playerId) ?? 0;
      moralZuschlag[z.playerId] = z.ergebnis.moralZuschlag;
    }
    neuerStand[team.teamId] = { seasonId, kaderHash: hash, berechnetAmSpieltag: spieltagIndex, ansKasse: u.ansKasse, moralOhne, leistungPerz, moralZuschlag };
    geaendert = true;
  }
  if (geaendert) naechster = { ...gameState, seasonState: { ...gameState.seasonState, marketingStand: neuerStand } };
  return naechster;
}

function berechneUebersicht(gameState: GameState, teamId: string, stand: MarketingStandEintrag | null, index?: MoraleLookupIndex): MarketingTeamUebersicht {
  // Eingefroren: nur wenn ein Stand die Moral des Spielers kennt, sonst der heutige Wert (Vorschau).
  let ixLazy = index;
  const ix = () => (ixLazy ??= buildMoraleLookupIndex(gameState));
  const kader = kaderEinesTeams(gameState, teamId);
  const liga = ligaStufeFuer(gameState, teamId);
  const gesichtId = aushaengeschildFuer(gameState, teamId);
  let zeilen: MarketingKaderZeile[] = kader.map(({ entry, player }) => {
    const moralOhne = stand && player.id in stand.moralOhne ? stand.moralOhne[player.id]! : moralOhneWerbung(gameState, player.id, teamId, ix());
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
    vorschau: false,
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

/**
 * Jahresbetrag fuer die Kasse (Teammarke + Team-Anteile): der Marketing-Stand, sonst (vor dem ersten Buchen) die Vorschau; 0 ohne
 * gueltige Regel. Die Buchung schreibt den Stand VOR dem Lesen, so dass sie nie eine Vorschau bucht.
 */
export function marketingJahresbetrag(gameState: GameState, teamId: string, index?: MoraleLookupIndex): number {
  if (!marketingAktiv(gameState)) return 0;
  const stand = marketingStandFuer(gameState, teamId);
  if (stand) return stand.ansKasse;
  return marketingTeamUebersicht(gameState, teamId, index).ansKasse;
}

/**
 * Marketing-Betrag der GANZEN Saison fuer die GuV: was je Spieltag schon gebucht ist (zaehlt IMMER, auch nach der Notbremse) plus der
 * noch ungebuchte Anteil zum Stand (nur bei aktivem Marketing). Am Saisonende genau die Summe der gebuchten Zeilen.
 */
export function marketingSaisonbetrag(gameState: GameState, teamId: string, index?: MoraleLookupIndex): number {
  const gebucht = summeSpieltagBuchungen(gameState, teamId).marketing;
  const offen = marketingAktiv(gameState) ? ungebuchterAnteil(gameState, teamId) : 0;
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
    return marketingRegelFuerNeueSaison(naechsteSaisonId, teamIds, {
      ...(alt?.verlauf ? { verlauf: alt.verlauf } : {}),
      teamErfolg: erfolgJeTeam(gameState, abgelaufeneSaisonId, teamIds),
    });
  }
  const snap = (gameState.seasonState.seasonSnapshots ?? []).find((s) => s.seasonId === abgelaufeneSaisonId);
  const fanfarbe: Record<string, Fanfarbe> = {};
  const verlauf: NonNullable<typeof alt.verlauf> = { ...(alt.verlauf ?? {}) };
  const teamErfolg: Record<string, TeamErfolg> = {};
  // Aushaengeschild und gewachsene Vorliebe (23.11.): zweimal derselbe in Folge -> seine Klasse ersetzt die fruehere Vorliebe (ein Zugang je Team).
  const klausel = alt.version === "klausel-v2";
  const gesichtVorsaison: Record<string, string> = {};
  const klassenVorliebe: NonNullable<typeof alt.klassenVorliebe> = { ...(alt.klassenVorliebe ?? {}) };
  for (const teamId of teamIds) {
    if (!klausel) break;
    const gesicht = aushaengeschildFuer(gameState, teamId);
    if (!gesicht) continue;
    gesichtVorsaison[teamId] = gesicht;
    if (alt.gesichtVorsaison?.[teamId] === gesicht) {
      const klasse = gameState.players.find((p) => p.id === gesicht)?.className;
      if (klasse) klassenVorliebe[teamId] = { klasse, seitSaisonId: naechsteSaisonId };
    }
  }
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
    const ergebnis = teamErfolgAusSnapshot(snap, teamId, gleicheLigaWie(gameState, teamId));
    teamErfolg[teamId] = ergebnis;
    const stufe = ergebnis.stufe === "titel" ? "titel" : ergebnis.stufe === "erreicht" ? "erreicht" : "verfehlt";
    const neu = driftFanfarbe(vorher, start, anteile4(kader), anteile4(erfolg), driftSchritt(stufe));
    fanfarbe[teamId] = neu;
    const liste = verlauf[teamId] ?? [{ seasonId: abgelaufeneSaisonId, farbe: [...vorher] as Fanfarbe, grund: "Start" }];
    verlauf[teamId] = [...liste, { seasonId: naechsteSaisonId, farbe: neu, grund: ergebnis.grund }];
  }
  return marketingRegelFuerNeueSaison(naechsteSaisonId, teamIds, { fanfarbe, verlauf, teamErfolg, gesichtVorsaison, klassenVorliebe });
}

function erfolgJeTeam(gameState: GameState, abgelaufeneSaisonId: string, teamIds: readonly string[]): Record<string, TeamErfolg> {
  const snap = (gameState.seasonState.seasonSnapshots ?? []).find((s) => s.seasonId === abgelaufeneSaisonId);
  return Object.fromEntries(teamIds.map((id) => [id, teamErfolgAusSnapshot(snap, id, gleicheLigaWie(gameState, id))]));
}
