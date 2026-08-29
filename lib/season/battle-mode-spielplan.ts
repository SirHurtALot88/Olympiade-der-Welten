/**
 * BATTLE-MODUS — DER SPIELPLAN. 16 Teams, 20 Spieltage, echte Kopf-an-Kopf-Paarungen.
 *
 * Diese Datei baut NUR den Plan. Wer gegen wen spielt, an welchem Spieltag, mit welchem Heimrecht.
 * Sie wertet nichts aus, sie rechnet keine Tabelle, sie kennt keine Disziplin — die Auslosung der
 * Disziplinen liegt weiterhin in `season-discipline-schedule.ts` (dort die Doppelrunde), die
 * Auswertung von Spieltagen ist Phase 3/4 und existiert noch nicht.
 *
 * Der Plan hat zwei Teile, und die sind bewusst verschieden gebaut:
 *
 *  1. 15 ROUND-ROBIN-RUNDEN (Spieltage 1..15). Jedes Team gegen jedes andere genau einmal.
 *     16 ist gerade, es gibt also kein spielfreies Team; das Kreisverfahren liefert die Runden
 *     ohne Zufall und ohne Suche. Dieser Teil haengt an NICHTS ausser der Teamliste — er ist
 *     dieselbe Auslosung, egal wie stark oder schwach die Teams gerade sind.
 *
 *  2. 5 ZUSATZRUNDEN (Spieltage 16..20). Hier ist die Round-Robin-Pflicht erfuellt, also muss
 *     etwas anderes entscheiden. Chris' Vorgabe: „ausgeglichen" — nach Teamwert (Kadermarktwert +
 *     Kasse) in Staerkebaender einsortieren und moeglichst innerhalb bzw. dicht am eigenen Band
 *     paaren. Das Ziel dabei ist ausdruecklich NICHT „schwach gegen schwach", sondern: kein
 *     kleines Team bekommt fuenf Spieltage am Stueck die Spitze vorgesetzt.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * OFFENE FRAGE AN CHRIS — DIE VORGABE WIDERSPRICHT SICH HIER, und zwar nachweisbar:
 *
 * Woertlich hiess es, die 5 Zusatzrunden sollen jedes Team gegen einen Gegner setzen, „den es in
 * den 15 Round-Robin-Runden noch NICHT hatte". Das kann es nicht geben. 15 volle Round-Robin-
 * Runden verbrauchen ALLE C(16,2) = 120 moeglichen Paarungen — nach Spieltag 15 hat jedes Team
 * jedes andere schon gespielt, es ist kein unverbrauchtes Paar mehr uebrig.
 *
 * WAS HIER STATTDESSEN GILT (die einzige widerspruchsfreie Lesart): in den 5 Zusatzrunden darf
 * sich keine Paarung WIEDERHOLEN. Jedes Paar trifft sich also hoechstens zweimal in der Saison —
 * einmal in der Pflichtrunde, hoechstens einmal als Zusatz. `bereitsGepaarteSchluessel` traegt
 * genau diese Sperre und ist deshalb ein Parameter geblieben: sollte Chris den Plan spaeter auf
 * eine Ligagroesse umstellen, bei der nach der Pflichtrunde noch Paarungen uebrig sind (z. B. 12
 * Teams à 11 Pflichtrunden), reicht es, die Round-Robin-Paare hier hineinzugeben.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 */
import type { Fixture, Player, PlayMode, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { createSeededRandom, resolvePlayMode } from "@/lib/season/season-discipline-schedule";

/** 16 Teams — Chris' Vorgabe fuer den Battle-Modus (Management bleibt bei 32). */
export const BATTLE_MODE_TEAM_ANZAHL = 16;
/** 20 Spieltage: 15 Pflichtrunden + 5 Zusatzrunden. */
export const BATTLE_MODE_SPIELTAG_ANZAHL = 20;
/** C(16,2)/8 = 15 Runden, in denen jedes Team jedes andere genau einmal trifft. */
export const BATTLE_MODE_ROUND_ROBIN_RUNDEN = BATTLE_MODE_TEAM_ANZAHL - 1;
/** Der Rest bis 20. */
export const BATTLE_MODE_ZUSATZRUNDEN = BATTLE_MODE_SPIELTAG_ANZAHL - BATTLE_MODE_ROUND_ROBIN_RUNDEN;
/**
 * Vier Baender à vier Teams. Vier ist die groesste Bandzahl, bei der ein Band noch mehr als eine
 * Paarung hergibt (4 Teams ⇒ 3 verschiedene Rundenpaarungen); bei 8 Baendern à 2 Teams waere nach
 * EINER Zusatzrunde jedes Band verbraucht und alles Weitere zwangslaeufig bandfremd.
 */
export const BATTLE_MODE_BAND_ANZAHL = 4;

/**
 * ═══ PLATZHALTER — WELCHE 16 TEAMS, ENTSCHEIDET CHRIS ═══════════════════════════════════════
 *
 * Bis diese Entscheidung da ist, sind es schlicht die ersten 16 der 32 Teams, nach `teamId`
 * alphabetisch sortiert. Das ist bewusst eine STUMPFE, nachvollziehbare Regel und kein Versuch,
 * die richtige Antwort zu erraten: eine Auswahl „nach Staerke" oder „nach Beliebtheit" saehe wie
 * eine Entscheidung aus, waere aber nur geraten und wuerde spaeter niemandem auffallen.
 *
 * Konkret ergibt das heute:
 *   A-A, B-B, B-P, C-C, C-S, D-L, D-P, G-G, H-R, L-K, L-R, M-M, M-S, N-N, N-W, P-C
 *
 * ZUM AUSTAUSCHEN: die Funktion durch eine feste Liste ersetzen —
 *   const BATTLE_MODE_TEAM_IDS = ["M-M", "D-P", ...];
 *   return teams.filter((team) => BATTLE_MODE_TEAM_IDS.includes(team.teamId)).map(...)
 * Sonst aendert sich nichts: alle Aufrufer nehmen nur die zurueckgegebene Liste.
 *
 * Nebenwirkung, die man kennen sollte: `R-R` (Startrang 32 der 32er-Liga) und `Z-H` (hoechstes
 * Budget) sind in dieser Platzhalter-Auswahl NICHT dabei, `M-M` (das Standard-Team der Solo-
 * Presets) schon. Deshalb ueberspringt `new-game-setup-service.ts` seine beiden Startrang-
 * Referenzpruefungen im Battle-Modus — sie messen gegen die 32er-Liga.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */
export function waehleBattleModeTeamIds(teams: Array<Pick<Team, "teamId">>): string[] {
  return [...teams]
    .map((team) => team.teamId)
    .sort((links, rechts) => links.localeCompare(rechts))
    .slice(0, BATTLE_MODE_TEAM_ANZAHL);
}

/** Ungeordneter Schluessel einer Paarung — A gegen B ist dieselbe Paarung wie B gegen A. */
export function paarSchluessel(teamA: string, teamB: string): string {
  return teamA < teamB ? `${teamA}|${teamB}` : `${teamB}|${teamA}`;
}

/** Eine Runde ist eine vollstaendige Paarung aller Teams: [Heim, Auswaerts]. */
export type BattleModeRunde = Array<[string, string]>;

/**
 * DIE PFLICHTRUNDE — Kreisverfahren, ohne Zufall.
 *
 * Ein Team bleibt stehen, die uebrigen n−1 rotieren um es herum; in Runde r spielt das stehende
 * Team gegen das erste der rotierten Liste, und der Rest wird von aussen nach innen gepaart. Bei
 * gerader Teamzahl geht das ohne spielfreies Team auf — genau deshalb sind 16 Teams hier so
 * angenehm, ein 15er- oder 17er-Feld braeuchte eine Freilos-Sonderregel.
 *
 * KEIN SEED, KEIN ZUFALL: dieser Teil des Plans soll fuer eine gegebene Teamliste immer derselbe
 * sein. Er wird beim Nach-Schnappschuss (siehe `erneuereBattleModeZusatzrunden`) unveraendert neu
 * erzeugt — wuerde er wuerfeln, verschoebe sich mit jedem Nachlauf die halbe Saison.
 *
 * Das Heimrecht wechselt fuer das stehende Team von Runde zu Runde. Ohne diesen Wechsel haette es
 * als einziges Team 15 Heimspiele oder 15 Auswaertsspiele. Heimrecht ist heute noch folgenlos
 * (Spieltags-Auswertung ist Phase 3/4), soll aber nicht schon schief im Save stehen, wenn sie
 * kommt.
 */
export function baueRoundRobinRunden(teamIds: string[]): BattleModeRunde[] {
  if (teamIds.length < 2 || teamIds.length % 2 !== 0) {
    return [];
  }
  const stehend = teamIds[0]!;
  const rotierend = teamIds.slice(1);
  const runden: BattleModeRunde[] = [];

  for (let runde = 0; runde < rotierend.length; runde += 1) {
    const gedreht = [...rotierend.slice(runde), ...rotierend.slice(0, runde)];
    const partner = gedreht[0]!;
    const paare: BattleModeRunde =
      runde % 2 === 0 ? [[stehend, partner]] : [[partner, stehend]];
    for (let index = 1; index < gedreht.length - index; index += 1) {
      paare.push([gedreht[index]!, gedreht[gedreht.length - index]!]);
    }
    runden.push(paare);
  }

  return runden;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// TEAMWERT-SCHNAPPSCHUSS
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * WANN der Schnappschuss genommen wurde. Der Wert steht mit im Ergebnis, weil dieselbe Rechnung zu
 * verschiedenen Zeitpunkten voellig verschiedene Zahlen liefert und man sonst nicht mehr sagen
 * kann, welche man vor sich hat.
 *
 * new_game_seed       — beim Anlegen des Spielstands. Die Kader sind hier NOCH LEER, der Teamwert
 *                       ist damit reine Kasse. Der daraus gebaute Plan ist VORLAEUFIG.
 * league_setup_ready  — direkt nachdem der KI-Draft die Season-1-Kader gefuellt hat
 *                       (`leagueSetupStatus` springt auf "ready"). Das ist der Zeitpunkt, den
 *                       Chris fuer Saison 1 gemeint hat.
 * transfer_buy_phase  — der Aequivalent-Zeitpunkt ab Saison 2 (nach dem Kauffenster). Noch nicht
 *                       verdrahtet — Saison 2+ ist nicht Teil dieser Phase —, steht hier aber
 *                       schon, damit die Funktion nicht auf Saison 1 zugeschnitten ist.
 */
export type BattleModeTeamwertQuelle = "new_game_seed" | "league_setup_ready" | "transfer_buy_phase";

export type BattleModeTeamwertEintrag = {
  teamId: string;
  /** Summe der Marktwerte aller Kaderspieler. 0, solange kein Kader existiert. */
  kaderMarktwert: number;
  cash: number;
  /** kaderMarktwert + cash — Chris' „Teamwert". */
  teamwert: number;
  /** 1 = staerkstes Team. */
  rang: number;
  /** 1 = staerkstes Band. */
  band: number;
};

export type BattleModeTeamwertSchnappschuss = {
  seasonId: string;
  quelle: BattleModeTeamwertQuelle;
  erstelltAm: string;
  bandAnzahl: number;
  /** Nach Teamwert absteigend, Gleichstand nach teamId — damit der Plan reproduzierbar bleibt. */
  eintraege: BattleModeTeamwertEintrag[];
};

/**
 * TEAMWERT = KADERMARKTWERT + KASSE, einmal festgehalten.
 *
 * BEWUSST OHNE `GameState`-Parameter: die Funktion bekommt nur Teams, Kader und Spieler. Damit
 * laesst sie sich an jedem Zeitpunkt aufrufen, an dem diese drei Listen vorliegen — beim Anlegen
 * des Spielstands, nach dem Draft, nach dem Kauffenster der naechsten Saison —, ohne dass irgendwo
 * eine Saison-1-Annahme in der Signatur klebt. Sie ist rein: kein Zufall, kein IO, kein Datum
 * ausser dem uebergebenen.
 *
 * Der Spielerwert kommt aus `player.marketValue`; nur wenn der Spieler in der Spielerliste fehlt,
 * greift `roster.currentValue` als Rueckfall. Andersherum waere es falsch: `currentValue` ist der
 * am Kadereintrag mitgeschriebene Wert und kann hinter dem echten Marktwert herhinken.
 */
export function baueBattleModeTeamwertSchnappschuss(input: {
  seasonId: string;
  quelle: BattleModeTeamwertQuelle;
  teams: Array<Pick<Team, "teamId" | "cash">>;
  rosters: Array<Pick<RosterEntry, "teamId" | "playerId" | "currentValue">>;
  players: Array<Pick<Player, "id" | "marketValue">>;
  /** Auf diese Teams einschraenken (sonst: alle uebergebenen Teams). */
  teamIds?: string[] | null;
  erstelltAm?: string;
  bandAnzahl?: number;
}): BattleModeTeamwertSchnappschuss {
  const erlaubteTeamIds = input.teamIds ? new Set(input.teamIds) : null;
  const marktwertByPlayerId = new Map(input.players.map((player) => [player.id, player.marketValue] as const));
  const kaderwertByTeamId = new Map<string, number>();

  for (const eintrag of input.rosters) {
    if (erlaubteTeamIds && !erlaubteTeamIds.has(eintrag.teamId)) {
      continue;
    }
    const wert = marktwertByPlayerId.get(eintrag.playerId) ?? eintrag.currentValue ?? 0;
    kaderwertByTeamId.set(eintrag.teamId, (kaderwertByTeamId.get(eintrag.teamId) ?? 0) + (Number.isFinite(wert) ? wert : 0));
  }

  const bandAnzahl = Math.max(1, input.bandAnzahl ?? BATTLE_MODE_BAND_ANZAHL);
  const relevanteTeams = input.teams.filter((team) => !erlaubteTeamIds || erlaubteTeamIds.has(team.teamId));
  const teamsProBand = Math.max(1, Math.ceil(relevanteTeams.length / bandAnzahl));

  const eintraege = relevanteTeams
    .map((team) => {
      const kaderMarktwert = kaderwertByTeamId.get(team.teamId) ?? 0;
      const cash = Number.isFinite(team.cash) ? team.cash : 0;
      return { teamId: team.teamId, kaderMarktwert, cash, teamwert: kaderMarktwert + cash };
    })
    .sort((links, rechts) => rechts.teamwert - links.teamwert || links.teamId.localeCompare(rechts.teamId))
    .map((eintrag, index) => ({
      ...eintrag,
      rang: index + 1,
      band: Math.min(bandAnzahl, Math.floor(index / teamsProBand) + 1),
    }));

  return {
    seasonId: input.seasonId,
    quelle: input.quelle,
    erstelltAm: input.erstelltAm ?? new Date().toISOString(),
    bandAnzahl,
    eintraege,
  };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// DIE AUSGEGLICHENEN ZUSATZRUNDEN
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Gewicht des Bandabstands in den Paarungskosten. Absichtlich riesig gegenueber allem anderen:
 * ein Bandwechsel soll NIE gegen eine bessere Rangnaehe eingetauscht werden koennen, sondern nur
 * dann passieren, wenn im eigenen Band nichts mehr frei ist.
 */
const KOSTEN_JE_BAND = 1000;
/**
 * Wie stark der Seed innerhalb desselben Bandes mischt. Die Rangabstaende innerhalb eines Bandes
 * aus 4 Teams liegen bei 1..3 — mit einem Zufallsanteil aus [0, 3) ist die Wahl im Band damit
 * echt gemischt und nicht jedes Mal „der Rangnachbar". Genau das meinte Chris mit „Mix": nicht
 * dieselbe Paarung nach demselben Muster, nur eben nicht Band 1 gegen Band 4.
 */
const KOSTEN_STREUUNG = 3;

/**
 * FUENF RUNDEN, IN DENEN JEDES TEAM EINEN GEGNER AUS DEM EIGENEN ODER DEM NACHBARBAND BEKOMMT.
 *
 * Verfahren: je Runde eine vollstaendige Paarung suchen, per Backtracking. Es wird immer das
 * ranghoechste noch offene Team zuerst verheiratet, und seine Kandidaten werden nach Kosten
 * sortiert probiert (Bandabstand ≫ Rangabstand + Seed-Streuung). Scheitert ein Zweig, wird
 * zurueckgesetzt statt abgebrochen — eine gierige Paarung ohne Backtracking laeuft sich hier
 * regelmaessig fest, weil die letzten zwei uebrigen Teams sich schon in einer frueheren Runde
 * getroffen haben koennen.
 *
 * VERWORFEN — perfektes Matching mit minimalen Gesamtkosten (Blossom/Ungarisch): waere die
 * „richtige" Loesung, wenn es hier um Optimalitaet ginge. Geht es nicht: gefragt ist eine
 * plausible, gemischte Auslosung fuer 16 Teams, keine beweisbar beste. Der Backtracker ist
 * dreissig Zeilen statt dreihundert und laeuft in Millisekunden.
 *
 * Findet sich mit dem erlaubten Bandabstand keine Runde, wird er schrittweise geweitet (1 → 2 →
 * …) und eine Warnung gesetzt. Das ist die ehrliche Reissleine: lieber eine unsauber
 * ausgeglichene Runde mit Vermerk als ein Spielplan mit einem Loch darin.
 */
export function baueAusgeglicheneZusatzrunden(input: {
  schnappschuss: BattleModeTeamwertSchnappschuss;
  rundenAnzahl: number;
  seed: string;
  /** Paarungen (siehe `paarSchluessel`), die nicht mehr vorkommen duerfen. Siehe Kopfkommentar. */
  bereitsGepaarteSchluessel?: Iterable<string>;
  /** Erlaubter Bandabstand im ersten Anlauf. Default 1 = eigenes Band oder Nachbarband. */
  maxBandAbstand?: number;
}): { runden: BattleModeRunde[]; warnings: string[] } {
  const eintraege = [...input.schnappschuss.eintraege].sort((links, rechts) => links.rang - rechts.rang);
  const teamIds = eintraege.map((eintrag) => eintrag.teamId);
  const warnings: string[] = [];

  if (teamIds.length < 2 || teamIds.length % 2 !== 0) {
    return { runden: [], warnings: ["battle_mode_zusatzrunden_ungerade_teamzahl"] };
  }

  const rangById = new Map(eintraege.map((eintrag) => [eintrag.teamId, eintrag.rang] as const));
  const bandById = new Map(eintraege.map((eintrag) => [eintrag.teamId, eintrag.band] as const));
  const verboten = new Set(input.bereitsGepaarteSchluessel ?? []);
  const bandAbstandStart = Math.max(0, input.maxBandAbstand ?? 1);
  const bandAbstandMax = Math.max(bandAbstandStart, input.schnappschuss.bandAnzahl - 1);

  const bandAbstand = (teamA: string, teamB: string) =>
    Math.abs((bandById.get(teamA) ?? 1) - (bandById.get(teamB) ?? 1));
  const rangAbstand = (teamA: string, teamB: string) =>
    Math.abs((rangById.get(teamA) ?? 0) - (rangById.get(teamB) ?? 0));

  const runden: BattleModeRunde[] = [];

  for (let rundeIndex = 0; rundeIndex < input.rundenAnzahl; rundeIndex += 1) {
    const rundenSeed = `${input.seed}:zusatzrunde-${rundeIndex + 1}`;
    let runde: BattleModeRunde | null = null;

    for (let erlaubterBandAbstand = bandAbstandStart; erlaubterBandAbstand <= bandAbstandMax; erlaubterBandAbstand += 1) {
      runde = suchePaarungFuerRunde({
        teamIds,
        verboten,
        erlaubterBandAbstand,
        bandAbstand,
        rangAbstand,
        seed: rundenSeed,
      });
      if (runde) {
        if (erlaubterBandAbstand > bandAbstandStart) {
          warnings.push(`battle_mode_zusatzrunde_band_geweitet:${rundeIndex + 1}:${erlaubterBandAbstand}`);
        }
        break;
      }
    }

    if (!runde) {
      warnings.push(`battle_mode_zusatzrunde_ohne_paarung:${rundeIndex + 1}`);
      break;
    }

    for (const [heim, auswaerts] of runde) {
      verboten.add(paarSchluessel(heim, auswaerts));
    }
    // Heimrecht wechselt von Zusatzrunde zu Zusatzrunde, damit nicht immer das ranghoehere Team
    // Heimrecht hat (der Backtracker verheiratet grundsaetzlich von oben nach unten).
    runden.push(rundeIndex % 2 === 0 ? runde : runde.map(([heim, auswaerts]) => [auswaerts, heim] as [string, string]));
  }

  return { runden, warnings: Array.from(new Set(warnings)) };
}

/** Obergrenze fuer den Backtracker — eine Notbremse, kein erwarteter Fall (16 Teams). */
const MAX_BACKTRACK_SCHRITTE = 200_000;

function suchePaarungFuerRunde(input: {
  teamIds: string[];
  verboten: ReadonlySet<string>;
  erlaubterBandAbstand: number;
  bandAbstand: (teamA: string, teamB: string) => number;
  rangAbstand: (teamA: string, teamB: string) => number;
  seed: string;
}): BattleModeRunde | null {
  const gewaehlt: BattleModeRunde = [];
  let schritte = 0;

  const kosten = (teamA: string, teamB: string) => {
    const streuung = createSeededRandom(`${input.seed}:${paarSchluessel(teamA, teamB)}`)() * KOSTEN_STREUUNG;
    return input.bandAbstand(teamA, teamB) * KOSTEN_JE_BAND + input.rangAbstand(teamA, teamB) + streuung;
  };

  const rekursion = (offen: string[]): boolean => {
    if (offen.length === 0) {
      return true;
    }
    if (schritte >= MAX_BACKTRACK_SCHRITTE) {
      return false;
    }
    schritte += 1;

    const erster = offen[0]!;
    const uebrige = offen.slice(1);
    const kandidaten = uebrige
      .filter(
        (teamId) =>
          !input.verboten.has(paarSchluessel(erster, teamId)) &&
          input.bandAbstand(erster, teamId) <= input.erlaubterBandAbstand,
      )
      .map((teamId) => ({ teamId, kosten: kosten(erster, teamId) }))
      .sort((links, rechts) => links.kosten - rechts.kosten || links.teamId.localeCompare(rechts.teamId));

    for (const kandidat of kandidaten) {
      gewaehlt.push([erster, kandidat.teamId]);
      if (rekursion(uebrige.filter((teamId) => teamId !== kandidat.teamId))) {
        return true;
      }
      gewaehlt.pop();
    }
    return false;
  };

  return rekursion(input.teamIds) ? gewaehlt : null;
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// DER FERTIGE FIXTURE-PLAN
// ───────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Setzt beide Teile zusammen und giesst sie in `Fixture`-Zeilen.
 *
 * `Fixture` gibt es laengst (`olyDataTypes.ts`) und `SeasonState.schedule` haelt sie auch heute
 * schon — im Management-Modus allerdings als zwei erfundene Zeilen, die niemand liest ausser ueber
 * `.length`. Der Battle-Modus ist der erste Nutzer, der dort echte Paarungen ablegt. Der Typ
 * bleibt deshalb unveraendert; einen zweiten, parallelen Paarungstyp zu erfinden waere die
 * schlechtere Haelfte beider Welten.
 *
 * Die Fixture-Id haengt an der Spieltags-Id (`matchday-7-fixture-3`) und nicht an einem Zaehler
 * ueber die ganze Saison: so bleibt sie stabil, wenn spaeter einmal nur die Zusatzrunden neu
 * gezogen werden (`erneuereBattleModeZusatzrunden`).
 */
export function baueBattleModeFixtures(input: {
  teamIds: string[];
  matchdayIds: string[];
  schnappschuss: BattleModeTeamwertSchnappschuss;
  seed: string;
}): { fixtures: Fixture[]; warnings: string[] } {
  /**
   * ALPHABETISCH SORTIERT, BEVOR DAS KREISVERFAHREN LAEUFT — und das ist kein Schoenheitsschritt.
   *
   * `baueRoundRobinRunden` nimmt die Reihenfolge, die es bekommt: eine andere Reihenfolge ergibt
   * einen anderen (genauso gueltigen) Plan. Die Teamliste erreicht diese Funktion aber ueber ZWEI
   * Wege mit unterschiedlicher Sortierung — beim Anlegen in der Reihenfolge von
   * `data/source/teams.json` (die NICHT alphabetisch ist: dort steht B-P vor C-S vor C-C), beim
   * Nach-Schnappschuss aus `gameState.teams`, das aus SQLite nach `team_id` sortiert
   * zurueckkommt. Ohne diese Zeile verschoeben sich beim Nachziehen der Zusatzrunden auch die
   * Spieltage 1..15, obwohl an der Pflichtrunde gar nichts neu zu entscheiden ist. Der Test
   * „laesst die Spieltage 1..15 buchstabengleich" hat genau das aufgedeckt.
   */
  const geordneteTeamIds = [...input.teamIds].sort((links, rechts) => links.localeCompare(rechts));
  const pflichtrunden = baueRoundRobinRunden(geordneteTeamIds);
  const zusatzrundenAnzahl = Math.max(0, input.matchdayIds.length - pflichtrunden.length);
  const zusatz = baueAusgeglicheneZusatzrunden({
    schnappschuss: input.schnappschuss,
    rundenAnzahl: zusatzrundenAnzahl,
    seed: input.seed,
    // BEWUSST LEER: nach 15 vollen Round-Robin-Runden ist jede der 120 Paarungen verbraucht, eine
    // Sperre darauf machte jede Zusatzrunde unmoeglich. Siehe „OFFENE FRAGE AN CHRIS" im Kopf.
    bereitsGepaarteSchluessel: [],
  });

  const alleRunden = [...pflichtrunden, ...zusatz.runden];
  const fixtures: Fixture[] = [];
  const warnings = [...zusatz.warnings];

  if (alleRunden.length < input.matchdayIds.length) {
    warnings.push(`battle_mode_spielplan_unvollstaendig:${alleRunden.length}/${input.matchdayIds.length}`);
  }

  input.matchdayIds.forEach((matchdayId, index) => {
    const runde = alleRunden[index];
    if (!runde) {
      return;
    }
    runde.forEach(([homeTeamId, awayTeamId], paarIndex) => {
      fixtures.push({
        id: `${matchdayId}-fixture-${paarIndex + 1}`,
        homeTeamId,
        awayTeamId,
        matchdayId,
        status: "scheduled",
      });
    });
  });

  return { fixtures, warnings: Array.from(new Set(warnings)) };
}

/**
 * Der Weg, den `dataAdapter.ts` beim Anlegen eines Battle-Spielstands nimmt: Schnappschuss und
 * Fixtures in einem Schritt, mit der Quelle sauber vermerkt.
 */
export function baueBattleModeSpielplan(input: {
  seasonId: string;
  matchdayIds: string[];
  teams: Array<Pick<Team, "teamId" | "cash">>;
  rosters: Array<Pick<RosterEntry, "teamId" | "playerId" | "currentValue">>;
  players: Array<Pick<Player, "id" | "marketValue">>;
  teamIds?: string[] | null;
  quelle: BattleModeTeamwertQuelle;
  seed: string;
  erstelltAm?: string;
}): { fixtures: Fixture[]; schnappschuss: BattleModeTeamwertSchnappschuss; warnings: string[] } {
  const teamIds = input.teamIds ?? input.teams.map((team) => team.teamId);
  const schnappschuss = baueBattleModeTeamwertSchnappschuss({
    seasonId: input.seasonId,
    quelle: input.quelle,
    teams: input.teams,
    rosters: input.rosters,
    players: input.players,
    teamIds,
    erstelltAm: input.erstelltAm,
  });
  const { fixtures, warnings } = baueBattleModeFixtures({
    // Die Pflichtrunde soll NICHT an der Tagesform haengen: sie laeuft ueber die Teamliste in
    // ihrer stabilen Reihenfolge, nicht ueber die Teamwert-Rangfolge. Sonst waeren nach dem
    // Nach-Schnappschuss (Kader gefuellt) auch die Spieltage 1..15 andere.
    teamIds,
    matchdayIds: input.matchdayIds,
    schnappschuss,
    seed: input.seed,
  });
  return { fixtures, schnappschuss, warnings };
}

/**
 * DER NACH-SCHNAPPSCHUSS. Zieht die 5 Zusatzrunden neu, sobald die Kader wirklich stehen.
 *
 * Warum das noetig ist: beim Anlegen des Spielstands sind alle Kader LEER — der Teamwert ist dort
 * reine Kasse, und die Baender bilden nur die Startbudgets ab. Chris' Vorgabe war ausdruecklich
 * „direkt nachdem die Kader stehen", also nach dem KI-Draft (`leagueSetupStatus` = "ready").
 * Erst dann sagt „Kadermarktwert + Kasse" etwas ueber Staerke aus.
 *
 * Die Spieltage 1..15 bleiben dabei Zeichen fuer Zeichen dieselben: sie kommen aus
 * `baueRoundRobinRunden` und haengen nur an der Teamliste. Neu gezogen wird ausschliesslich der
 * Schwanz ab Spieltag 16.
 *
 * Gibt bei `playMode !== "battle"` DIESELBE Referenz zurueck — der Aufrufer muss nicht wissen,
 * welche Spielart er gerade in der Hand hat.
 */
export function erneuereBattleModeZusatzrunden<
  T extends {
    playMode?: PlayMode;
    season: { id: string; matchdayIds: string[] };
    seasonState: { schedule: Fixture[] };
    teams: Array<Pick<Team, "teamId" | "cash">>;
    rosters: Array<Pick<RosterEntry, "teamId" | "playerId" | "currentValue">>;
    players: Array<Pick<Player, "id" | "marketValue">>;
  },
>(gameState: T, input: { saveId: string; quelle?: BattleModeTeamwertQuelle; erstelltAm?: string }): T {
  if (resolvePlayMode(gameState.playMode) !== "battle") {
    return gameState;
  }

  const teamIds = gameState.teams.map((team) => team.teamId);
  const { fixtures } = baueBattleModeSpielplan({
    seasonId: gameState.season.id,
    matchdayIds: gameState.season.matchdayIds,
    teams: gameState.teams,
    rosters: gameState.rosters,
    players: gameState.players,
    teamIds,
    quelle: input.quelle ?? "league_setup_ready",
    seed: `${input.saveId}:${gameState.season.id}:battle-mode-fixtures`,
    erstelltAm: input.erstelltAm,
  });

  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, schedule: fixtures },
  };
}
