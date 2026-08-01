/**
 * SAISON-AWARDS — Auszeichnungen, die eine ROLLE erzählen, nicht nur die höchste Zahl.
 *
 * GEWÜNSCHT: „kannst du hier auch noch mal überlegen ob wir hier noch mehr awards vergeben
 * könnten für spieler basierend auf ihren achievements? überleg mal was."
 *
 * Die Leader-Kacheln beantworten bereits „wer hat am meisten". Das ist eine Frage, und sie ist
 * achtmal gestellt (PPs, vier Bereiche, OVR, MVS, Training). Was fehlte, war die andere Sorte:
 * *wie* jemand zu seinen Punkten kam. Der Spezialist, der in genau einer Disziplin unschlagbar
 * ist, sieht in jeder Gesamtwertung mittelmäßig aus — und ist trotzdem eine Geschichte.
 *
 * QUELLEN (alle bereits vorhanden, nichts wird persistiert):
 * - `seasonPointsLedger` — die EINE Quelle für alles Auftrittsbezogene: normalisierte PPs,
 *   `pointsByDiscipline`, `pointsByArea`, `pointsByTeamId`, `appearances` und je Eintrag auch
 *   `rankInDiscipline`, `isTop10`, `isMvpCandidate`, `mutatorPpsBonus`. Die Rohdaten aus
 *   `playerDisciplinePerformances` werden hier bewusst NICHT ein zweites Mal gelesen — der
 *   Ledger hat die Saison bereits gefiltert, ein eigener Filter daneben würde irgendwann
 *   andere Auftritte zählen als die Punkte.
 * - `transferHistory` — Transferwege der laufenden Saison
 *
 * Weil der Saison-Snapshot dieselben Felder 1:1 archiviert (`season-snapshot-service`), kann
 * derselbe Selector später die Awards jeder archivierten Saison nachrechnen. Awards müssen
 * deshalb NICHT gespeichert werden — gespeicherte Awards wären eine zweite Wahrheit neben den
 * Daten, aus denen sie entstanden.
 *
 * BEWUSST WEGGELASSEN: ein Form-Award auf Spielerebene. `formModifier` existiert nur pro TEAM
 * und Disziplin (`DisciplineResultRecord.formModifier`) — ein Spieler-Form-Award wäre erfunden.
 */
import type { DisciplineCategory, GameState } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger, type SeasonPointsLedger } from "@/lib/foundation/season-points-ledger";

/**
 * Mindestzahl an Einsätzen für Awards, die einen DURCHSCHNITT oder eine SCHWANKUNG messen.
 *
 * Eine Saison hat 10 Spieltage à 2 Disziplinseiten, ein Spieler kommt also auf höchstens ~20
 * Einsätze. Ohne Schwelle gewänne „Mr. Zuverlässig" der Spieler mit genau einem Auftritt: eine
 * einzelne Zahl schwankt nicht. Sechs Einsätze sind rund ein Drittel des Maximums — genug, dass
 * Konstanz etwas heißt, wenig genug, dass Rotationsspieler nicht ausgeschlossen sind.
 *
 * Reine ZÄHLER (Siege, Top-10-Auftritte) brauchen keine Schwelle: wer öfter gewinnt, hat öfter
 * gespielt — das ist Teil der Leistung, kein Messfehler.
 */
export const SEASON_AWARD_MIN_APPEARANCES = 6;

/** „Mr. Zuverlässig" verlangt Präsenz über die Saison, nicht nur Einsätze. */
export const SEASON_AWARD_MIN_MATCHDAYS_FOR_CONSISTENCY = 8;

export type LeagueSeasonAwardId =
  | "spezialist"
  | "allrounder"
  | "zuverlaessig"
  | "big_match"
  | "disziplin_dominator"
  | "top10_dauergast"
  | "mvp_kandidat"
  | "neuzugang"
  | "schnaeppchen"
  | "dauerbrenner"
  | "mutator_profiteur";

export type LeagueSeasonAward = {
  id: LeagueSeasonAwardId;
  /** Kurzer Titel in Alltagssprache. */
  label: string;
  /** Ein Satz: wofür der Award steht — erscheint als Erklärung an der Karte. */
  bedingung: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string | null;
  /** Der ausschlaggebende Wert, fertig formatiert. */
  displayValue: string;
  /** Zusatzzeile mit dem Kontext (Disziplin, Anzahl Teams, …) — oder `null`. */
  kontext: string | null;
};

export type LeagueSeasonAwards = {
  /** Bis zu wie viele Spieltage bereits gespielt sind — für die Beschriftung „Stand Spieltag X". */
  matchdaysPlayed: number;
  awards: LeagueSeasonAward[];
};

type Kandidat = {
  playerId: string;
  appearances: number;
  totalPoints: number;
  pointsByDiscipline: Record<string, number>;
  pointsByArea: Record<DisciplineCategory, number>;
  pointsByTeamId: Record<string, number>;
  /** Punktsumme je Spieltag — Grundlage für Konstanz und Ausreißer. */
  punkteJeSpieltag: Map<string, number>;
  /** Siege (`rankInDiscipline === 1`) je Disziplin. */
  siegeJeDisziplin: Map<string, number>;
  top10: number;
  mvp: number;
  mutatorBonus: number;
};

function runde(value: number, stellen = 1) {
  return Number(value.toFixed(stellen));
}

function formatZahl(value: number, stellen = 1) {
  return runde(value, stellen).toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

/**
 * Der Median der Saison-PPs über alle Spieler mit mindestens einem Auftritt.
 *
 * Mehrere Awards verlangen „gehört zur oberen Hälfte", damit nicht ein Spieler mit drei Punkten
 * gewinnt, nur weil alle drei aus derselben Disziplin kamen. Median statt Mittelwert: ein
 * einzelner Ausreißer nach oben soll die Schwelle nicht verschieben.
 */
function medianPunkte(kandidaten: Kandidat[]): number {
  const werte = kandidaten.map((k) => k.totalPoints).sort((a, b) => a - b);
  if (werte.length === 0) return 0;
  const mitte = Math.floor(werte.length / 2);
  return werte.length % 2 === 0 ? (werte[mitte - 1] + werte[mitte]) / 2 : werte[mitte];
}

function baueKandidaten(gameState: GameState, ledger: SeasonPointsLedger): Kandidat[] {
  const matchdayIdByResultId = new Map(
    (gameState.seasonState.matchdayResults ?? []).map((result) => [result.id, result.matchdayId] as const),
  );

  const proSpieler = new Map<string, Kandidat>();
  const leer = (playerId: string): Kandidat => ({
    playerId,
    appearances: 0,
    totalPoints: 0,
    pointsByDiscipline: {},
    pointsByArea: { power: 0, speed: 0, mental: 0, social: 0 },
    pointsByTeamId: {},
    punkteJeSpieltag: new Map(),
    siegeJeDisziplin: new Map(),
    top10: 0,
    mvp: 0,
    mutatorBonus: 0,
  });

  for (const [playerId, summary] of ledger.playerSummariesByPlayerId.entries()) {
    const kandidat = leer(playerId);
    kandidat.appearances = summary.appearances;
    kandidat.totalPoints = summary.totalPoints;
    kandidat.pointsByDiscipline = summary.pointsByDiscipline;
    kandidat.pointsByArea = summary.pointsByArea;
    kandidat.pointsByTeamId = summary.pointsByTeamId;
    proSpieler.set(playerId, kandidat);
  }

  /**
   * ALLES Weitere kommt aus denselben Ledger-Einträgen.
   *
   * Naheliegend wäre gewesen, Ränge/Top-10/MVP aus `playerDisciplinePerformances` zu lesen —
   * dort stehen sie schließlich ursprünglich. Der Ledger reicht sie aber unverändert durch UND
   * hat die Saison bereits gefiltert und die Punkte normalisiert. Ein zweiter Durchgang über
   * die Rohdaten wäre eine zweite Filterlogik neben der ersten: sobald sich die Saisonauswahl
   * im Ledger ändert, zählten Awards und Punkte verschiedene Auftritte.
   */
  for (const entry of ledger.pointEntries) {
    const kandidat = proSpieler.get(entry.playerId);
    if (!kandidat) continue;

    const matchdayId = entry.matchdayId ?? matchdayIdByResultId.get(entry.matchdayResultId) ?? null;
    if (matchdayId) {
      kandidat.punkteJeSpieltag.set(
        matchdayId,
        runde((kandidat.punkteJeSpieltag.get(matchdayId) ?? 0) + entry.points, 4),
      );
    }

    if (entry.rankInDiscipline === 1) {
      kandidat.siegeJeDisziplin.set(
        entry.disciplineId,
        (kandidat.siegeJeDisziplin.get(entry.disciplineId) ?? 0) + 1,
      );
    }
    if (entry.isTop10) kandidat.top10 += 1;
    if (entry.isMvpCandidate) kandidat.mvp += 1;
    if (Number.isFinite(entry.mutatorPpsBonus)) {
      kandidat.mutatorBonus = runde(kandidat.mutatorBonus + entry.mutatorPpsBonus, 4);
    }
  }

  return [...proSpieler.values()].filter((kandidat) => kandidat.appearances > 0);
}

/**
 * Gewinner einer Wertung.
 *
 * Bei Gleichstand entscheidet der höhere Saison-PPs-Wert, danach der Name — sonst hinge der
 * Award an der Reihenfolge, in der die Spieler zufällig im Spielstand liegen, und wechselte
 * ohne Spielgeschehen den Halter.
 */
function besterNach(
  kandidaten: Kandidat[],
  wert: (kandidat: Kandidat) => number | null,
  nameVon: (playerId: string) => string,
): { kandidat: Kandidat; wert: number } | null {
  let beste: { kandidat: Kandidat; wert: number } | null = null;
  for (const kandidat of kandidaten) {
    const kandidatenWert = wert(kandidat);
    if (kandidatenWert == null || !Number.isFinite(kandidatenWert)) continue;
    if (beste == null) {
      beste = { kandidat, wert: kandidatenWert };
      continue;
    }
    if (kandidatenWert > beste.wert) {
      beste = { kandidat, wert: kandidatenWert };
      continue;
    }
    if (kandidatenWert === beste.wert) {
      if (kandidat.totalPoints > beste.kandidat.totalPoints) {
        beste = { kandidat, wert: kandidatenWert };
      } else if (
        kandidat.totalPoints === beste.kandidat.totalPoints &&
        nameVon(kandidat.playerId).localeCompare(nameVon(beste.kandidat.playerId), "de") < 0
      ) {
        beste = { kandidat, wert: kandidatenWert };
      }
    }
  }
  return beste;
}

/** Variationskoeffizient = Streuung ÷ Mittelwert — vergleichbar über verschiedene Punktniveaus. */
function variationskoeffizient(werte: number[]): number | null {
  if (werte.length < 2) return null;
  const mittel = werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
  if (mittel <= 0) return null;
  const varianz = werte.reduce((summe, wert) => summe + (wert - mittel) ** 2, 0) / werte.length;
  return Math.sqrt(varianz) / mittel;
}

export function buildLeagueSeasonAwards(gameState: GameState, ledgerInput?: SeasonPointsLedger): LeagueSeasonAwards {
  const ledger = ledgerInput ?? buildSeasonPointsLedger(gameState);
  const kandidaten = baueKandidaten(gameState, ledger);

  const spielerNamen = new Map((gameState.players ?? []).map((player) => [player.id, player.name] as const));
  const teamVonSpieler = new Map((gameState.rosters ?? []).map((entry) => [entry.playerId, entry.teamId] as const));
  const teams = new Map((gameState.teams ?? []).map((team) => [team.teamId, team] as const));
  const disziplinNamen = new Map((gameState.disciplines ?? []).map((d) => [d.id, d.name] as const));
  const nameVon = (playerId: string) => spielerNamen.get(playerId) ?? playerId;

  const matchdaysPlayed = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((result) => result.seasonId === gameState.season.id)
      .map((result) => result.matchdayId),
  ).size;

  const median = medianPunkte(kandidaten);
  const ueberMedian = kandidaten.filter((kandidat) => kandidat.totalPoints >= median);
  const mitMindesteinsaetzen = kandidaten.filter(
    (kandidat) => kandidat.appearances >= SEASON_AWARD_MIN_APPEARANCES,
  );

  const awards: LeagueSeasonAward[] = [];
  const lege = (
    id: LeagueSeasonAwardId,
    label: string,
    bedingung: string,
    treffer: { kandidat: Kandidat; wert: number } | null,
    darstellung: (treffer: { kandidat: Kandidat; wert: number }) => { displayValue: string; kontext: string | null },
  ) => {
    if (!treffer) return;
    const teamId = teamVonSpieler.get(treffer.kandidat.playerId) ?? null;
    const team = teamId ? teams.get(teamId) ?? null : null;
    const { displayValue, kontext } = darstellung(treffer);
    awards.push({
      id,
      label,
      bedingung,
      playerId: treffer.kandidat.playerId,
      playerName: nameVon(treffer.kandidat.playerId),
      teamId,
      teamCode: team?.shortCode ?? null,
      teamName: team?.name ?? null,
      displayValue,
      kontext,
    });
  };

  // --- Der Spezialist ---------------------------------------------------
  // Höchster Anteil EINER Disziplin an den eigenen Punkten. Ohne Median-Schwelle gewänne, wer
  // insgesamt kaum punktete und dessen wenige Punkte zufällig aus einer Disziplin stammen.
  const spezialistAnteil = (kandidat: Kandidat) => {
    if (kandidat.totalPoints <= 0) return null;
    const beste = Object.entries(kandidat.pointsByDiscipline).sort((a, b) => b[1] - a[1])[0];
    if (!beste || beste[1] <= 0) return null;
    return beste[1] / kandidat.totalPoints;
  };
  lege(
    "spezialist",
    "Der Spezialist",
    "Größter Anteil einer einzigen Disziplin an den eigenen Punkten (obere Hälfte der Liga).",
    besterNach(ueberMedian, spezialistAnteil, nameVon),
    (treffer) => {
      const beste = Object.entries(treffer.kandidat.pointsByDiscipline).sort((a, b) => b[1] - a[1])[0];
      return {
        displayValue: `${formatZahl(treffer.wert * 100, 0)} %`,
        kontext: beste ? disziplinNamen.get(beste[0]) ?? beste[0] : null,
      };
    },
  );

  // --- Der Allrounder ---------------------------------------------------
  // Das Gegenstück: der größte KLEINSTE Bereichsanteil. Wer in seinem schwächsten Bereich noch
  // viel holt, ist überall verlässlich — ein reiner Summen-Vergleich fände hier den Spezialisten.
  const allrounderWert = (kandidat: Kandidat) => {
    if (kandidat.totalPoints <= 0) return null;
    const bereiche = Object.values(kandidat.pointsByArea);
    if (bereiche.length < 4 || bereiche.some((wert) => wert <= 0)) return null;
    return Math.min(...bereiche) / kandidat.totalPoints;
  };
  lege(
    "allrounder",
    "Der Allrounder",
    `Punktet in allen vier Bereichen; gewertet wird der schwächste Bereich (ab ${SEASON_AWARD_MIN_APPEARANCES} Einsätzen).`,
    besterNach(mitMindesteinsaetzen, allrounderWert, nameVon),
    (treffer) => ({
      displayValue: `${formatZahl(treffer.wert * 100, 0)} %`,
      kontext: "schwächster Bereich",
    }),
  );

  // --- Mr. Zuverlässig --------------------------------------------------
  // Kleinste Schwankung, deshalb NEGATIV gewertet (`besterNach` sucht das Maximum).
  const konstanzKandidaten = kandidaten.filter(
    (kandidat) =>
      kandidat.punkteJeSpieltag.size >= SEASON_AWARD_MIN_MATCHDAYS_FOR_CONSISTENCY &&
      kandidat.totalPoints >= median,
  );
  lege(
    "zuverlaessig",
    "Mr. Zuverlässig",
    `Kleinste Schwankung der Spieltagswerte (ab ${SEASON_AWARD_MIN_MATCHDAYS_FOR_CONSISTENCY} Spieltagen, obere Hälfte der Liga).`,
    besterNach(
      konstanzKandidaten,
      (kandidat) => {
        const koeffizient = variationskoeffizient([...kandidat.punkteJeSpieltag.values()]);
        return koeffizient == null ? null : -koeffizient;
      },
      nameVon,
    ),
    (treffer) => ({
      displayValue: `± ${formatZahl(-treffer.wert * 100, 0)} %`,
      kontext: `${treffer.kandidat.punkteJeSpieltag.size} Spieltage`,
    }),
  );

  // --- Big-Match-Spieler ------------------------------------------------
  lege(
    "big_match",
    "Big-Match-Spieler",
    `Bester Spieltag im Verhältnis zum eigenen Schnitt (ab ${SEASON_AWARD_MIN_APPEARANCES} Einsätzen).`,
    besterNach(
      mitMindesteinsaetzen,
      (kandidat) => {
        const werte = [...kandidat.punkteJeSpieltag.values()];
        if (werte.length < 2) return null;
        const schnitt = werte.reduce((summe, wert) => summe + wert, 0) / werte.length;
        if (schnitt <= 0) return null;
        return Math.max(...werte) / schnitt;
      },
      nameVon,
    ),
    (treffer) => ({
      displayValue: `${formatZahl(treffer.wert, 1)}×`,
      kontext: "bester Spieltag ÷ Schnitt",
    }),
  );

  // --- Der Disziplinsieger ----------------------------------------------
  /**
   * Die meisten Disziplinsiege der Saison.
   *
   * Der Entwurf verlangte hier ursprünglich zwei Siege in DERSELBEN Disziplin („Seriensieger
   * auf einer Bühne"). Am echten Spielstand gemessen ist das praktisch unerreichbar: eine Saison
   * vergibt ligaweit genau 20 Disziplinsiege (10 Spieltage × 2 ausgetragene Disziplinen), und
   * dieselbe Disziplin wird selten zweimal ausgetragen. Höchster gemessener Wert über die
   * gesamte Saison: 1.
   *
   * Ein Award, der nie vergeben wird, erzählt nichts. Gewertet wird deshalb die Gesamtzahl der
   * Siege — 2 von 20 ligaweit vergebenen ist eine echte Auszeichnung. Die Disziplin des ersten
   * Siegs steht als Kontext daneben, damit die Geschichte („und zwar im Eiskunstlauf") bleibt.
   */
  lege(
    "disziplin_dominator",
    "Der Disziplinsieger",
    "Die meisten Disziplinsiege der Saison — ligaweit gibt es davon nur 20 zu holen.",
    besterNach(
      kandidaten,
      (kandidat) => {
        const siege = [...kandidat.siegeJeDisziplin.values()].reduce((summe, wert) => summe + wert, 0);
        return siege > 0 ? siege : null;
      },
      nameVon,
    ),
    (treffer) => {
      const beste = [...treffer.kandidat.siegeJeDisziplin.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        displayValue: treffer.wert === 1 ? "1 Sieg" : `${formatZahl(treffer.wert, 0)} Siege`,
        kontext: beste ? disziplinNamen.get(beste[0]) ?? beste[0] : null,
      };
    },
  );

  // --- Top-10-Dauergast --------------------------------------------------
  lege(
    "top10_dauergast",
    "Top-10-Dauergast",
    "Die meisten Auftritte unter den besten zehn einer Disziplin.",
    besterNach(kandidaten, (kandidat) => (kandidat.top10 > 0 ? kandidat.top10 : null), nameVon),
    (treffer) => ({ displayValue: `${formatZahl(treffer.wert, 0)}×`, kontext: "in den Top 10" }),
  );

  // --- MVP-Kandidat der Saison -------------------------------------------
  lege(
    "mvp_kandidat",
    "MVP-Kandidat der Saison",
    "Die meisten Spieltage als MVP-Kandidat.",
    besterNach(kandidaten, (kandidat) => (kandidat.mvp > 0 ? kandidat.mvp : null), nameVon),
    (treffer) => ({ displayValue: `${formatZahl(treffer.wert, 0)}×`, kontext: "MVP-Kandidat" }),
  );

  // --- Neuzugang & Schnäppchen -------------------------------------------
  // Gewertet werden NUR die Punkte, die der Spieler für seinen KÄUFER geholt hat
  // (`pointsByTeamId[toTeamId]`) — was er vorher woanders sammelte, ist nicht das Verdienst
  // des Transfers.
  const kaeufeDieserSaison = (gameState.transferHistory ?? []).filter(
    (transfer) =>
      transfer.seasonId === gameState.season.id &&
      transfer.transferType === "buy" &&
      transfer.toTeamId != null,
  );
  const punkteFuerKaeufer = new Map<string, { punkte: number; fee: number | null }>();
  for (const transfer of kaeufeDieserSaison) {
    const kandidat = kandidaten.find((eintrag) => eintrag.playerId === transfer.playerId);
    if (!kandidat || !transfer.toTeamId) continue;
    const punkte = kandidat.pointsByTeamId[transfer.toTeamId] ?? 0;
    if (punkte <= 0) continue;
    const bisher = punkteFuerKaeufer.get(transfer.playerId);
    // Mehrfach gekauft in einer Saison: der teuerste Kauf ist der aussagekräftige.
    if (bisher == null || (transfer.fee ?? 0) > (bisher.fee ?? 0)) {
      punkteFuerKaeufer.set(transfer.playerId, { punkte, fee: transfer.fee ?? null });
    }
  }
  const neuzugaenge = kandidaten.filter((kandidat) => punkteFuerKaeufer.has(kandidat.playerId));

  lege(
    "neuzugang",
    "Neuzugang der Saison",
    "Die meisten Punkte, die ein gekaufter Spieler für seinen neuen Verein geholt hat.",
    besterNach(neuzugaenge, (kandidat) => punkteFuerKaeufer.get(kandidat.playerId)?.punkte ?? null, nameVon),
    (treffer) => ({ displayValue: `${formatZahl(treffer.wert, 1)} PPs`, kontext: "für den neuen Verein" }),
  );

  lege(
    "schnaeppchen",
    "Das Schnäppchen",
    "Die meisten Punkte je gezahlter Ablöse.",
    besterNach(
      neuzugaenge,
      (kandidat) => {
        const eintrag = punkteFuerKaeufer.get(kandidat.playerId);
        if (!eintrag || eintrag.fee == null || eintrag.fee <= 0) return null;
        return eintrag.punkte / eintrag.fee;
      },
      nameVon,
    ),
    (treffer) => {
      const eintrag = punkteFuerKaeufer.get(treffer.kandidat.playerId);
      return {
        displayValue: `${formatZahl(treffer.wert, 2)} PPs/Mio`,
        kontext: eintrag?.fee != null ? `${formatZahl(eintrag.fee, 1)} Mio Ablöse` : null,
      };
    },
  );

  /**
   * NICHT UMGESETZT: „Der Wanderpokal" (Punkte für mehrere Teams in einer Saison).
   *
   * Der Entwurf sah ihn über `pointsByTeamId` mit mindestens zwei Teams vor. Am echten
   * Spielstand: null Spieler erfüllen das — und zwar nicht aus Zufall. Transfers laufen in
   * diesem Spiel im Transferfenster zwischen den Saisons (`transfer-window-policy`), ein
   * Wechsel MITTEN in einer laufenden Saison kommt im normalen Ablauf nicht vor. Der Award
   * könnte also nie vergeben werden.
   *
   * „Für wie viele Teams hat er gepunktet" ist damit eine KARRIERE-Frage, keine Saison-Frage —
   * sie gehört in die Ewige Tabelle, nicht hierher. `pointsByTeamId` bleibt trotzdem in
   * Gebrauch: „Neuzugang" und „Schnäppchen" werten damit genau die Punkte, die ein Gekaufter
   * für seinen KÄUFER geholt hat.
   */

  // --- Der Dauerbrenner ---------------------------------------------------
  lege(
    "dauerbrenner",
    "Der Dauerbrenner",
    "Die meisten Einsätze der Saison.",
    besterNach(kandidaten, (kandidat) => kandidat.appearances, nameVon),
    (treffer) => ({ displayValue: `${formatZahl(treffer.wert, 0)} Einsätze`, kontext: null }),
  );

  // --- Mutator-Profiteur --------------------------------------------------
  lege(
    "mutator_profiteur",
    "Mutator-Profiteur",
    "Der größte Punktgewinn aus Sonderregeln der Disziplinen.",
    besterNach(kandidaten, (kandidat) => (kandidat.mutatorBonus > 0 ? kandidat.mutatorBonus : null), nameVon),
    (treffer) => ({ displayValue: `+${formatZahl(treffer.wert, 1)} PPs`, kontext: "durch Mutatoren" }),
  );

  return { matchdaysPlayed, awards };
}
