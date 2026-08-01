/**
 * WAS MACHT EINEN SPIELER LEGENDÄR — die Definition, nicht die Anzeige.
 *
 * GEWÜNSCHT: „Legendäre spieler definieren".
 *
 * Das ist eine Definitionsfrage. Bisher hieß „legendär" schlicht: steht in den Top 25 der
 * Karriere-PPs. Das ist keine Definition, das ist eine Sortierung — und sie hat einen Haken: in
 * einer Liste der besten 25 sind IMMER 25 Spieler, auch am ersten Spieltag der ersten Saison.
 * Ein Status, den man nicht verlieren und nicht verfehlen kann, ist keiner.
 *
 * Legende ist deshalb ein VERLIEHENER Status mit prüfbaren Kriterien. Die Bestenliste bleibt
 * daneben bestehen — sie beantwortet „wer hat am meisten", nicht „wer ist unsterblich".
 *
 * DIE SCHWELLEN SIND RELATIV, nicht absolut. Die Liga hat 32 Teams, rund 330 Kaderspieler und
 * höchstens ~20 Einsätze je Spieler und Saison. Feste Zahlen („500 PPs") würden beim nächsten
 * Balancing falsch; ein Perzentil verschiebt sich mit.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildLeagueSeasonAwards, type LeagueSeasonAwards } from "@/lib/foundation/league-season-awards";
import type { PlayerCareerLeaderRow } from "@/lib/foundation/league-records-hall-of-fame";

export type LegendCriterionId = "dauer" | "volumen" | "dominanz" | "titel" | "einzigartigkeit";

export type LegendCriterion = {
  id: LegendCriterionId;
  /** Kurzform in Alltagssprache — die Kriterien-Tafel zeigt genau diese Sätze. */
  label: string;
  erklaerung: string;
  erfuellt: boolean;
  /** Fortschritt in Worten, z. B. „1 von 3 Saisons" — auch wenn noch nicht erfüllt. */
  stand: string;
};

export type LegendCandidate = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  totalPps: number;
  appearances: number;
  seasonsPlayed: number;
  criteria: LegendCriterion[];
  /** Wie viele der fünf Kriterien erfüllt sind. */
  erfuellteAnzahl: number;
  /** Trägt den Status wirklich — siehe `LEGEND_RULE`. */
  istLegende: boolean;
};

export type LeagueLegends = {
  /** Spieler, die den Status tragen (kann leer sein — in Saison 1 ist er unerreichbar). */
  legends: LegendCandidate[];
  /** Die aktuell besten Anwärter mit Fortschritts-Checkliste. */
  anwaerter: LegendCandidate[];
  /** Sind Legenden überhaupt schon möglich? Vor Saison 3 nicht — Kriterium „Dauer". */
  moeglichAbSaison: number;
  aktuelleSaison: number;
};

/**
 * Mindestdauer: Einsätze in drei Saisons.
 *
 * Begründung: Eine Legende ist keine Eintagsfliege. Drei Saisons sind bei 10 Spieltagen je
 * Saison die kürzeste Spanne, in der „Ära" ein ehrliches Wort ist. Und es ist genau das
 * Kriterium, das den Status in Saison 1 unerreichbar macht — absichtlich: wäre er sofort zu
 * haben, wäre jeder Saison-1-Leader „Legende" und der Titel wertlos.
 */
export const LEGEND_MIN_SEASONS = 3;

/** Volumen: Karriere-PPs in den besten 1 % aller Spieler, die je gepunktet haben. */
export const LEGEND_VOLUME_PERCENTILE = 0.01;

/**
 * Die Regel: Dauer ist PFLICHT, dazu mindestens zwei der übrigen vier.
 *
 * Dauer als Pflicht und nicht als eines von fünf: ohne sie könnte ein einziger überragender
 * Saisonlauf reichen. Zwei weitere statt einem, weil ein einzelnes Kriterium (etwa „stand im
 * Kader eines Meisters") auch einen Mitläufer trifft.
 */
export const LEGEND_RULE = { pflicht: "dauer" as const, zusaetzlichMindestens: 2 };

function saisonNummer(seasonId: string): number {
  const treffer = seasonId.match(/(\d+)$/);
  return treffer ? Number(treffer[1]) : 1;
}

/**
 * Der Schwellenwert für „gehört zu den Größten": die Karriere-PPs an der 1-%-Grenze.
 *
 * Perzentil statt Festwert — bei ~330 Kaderspielern sind das die besten drei bis vier, und die
 * Grenze wandert mit, wenn Ligagröße oder Punkteniveau sich ändern.
 */
function volumenSchwelle(alle: PlayerCareerLeaderRow[]): number {
  const werte = alle.map((row) => row.totalPps).sort((links, rechts) => rechts - links);
  if (werte.length === 0) return Number.POSITIVE_INFINITY;
  const index = Math.max(0, Math.ceil(werte.length * LEGEND_VOLUME_PERCENTILE) - 1);
  return werte[index] ?? werte[werte.length - 1];
}

export function buildLeagueLegends(
  gameState: GameState,
  karriere: PlayerCareerLeaderRow[],
  awardsInput?: LeagueSeasonAwards,
): LeagueLegends {
  const aktuelleSaison = saisonNummer(gameState.season.id);
  const awards = awardsInput ?? buildLeagueSeasonAwards(gameState);
  const awardHalter = new Set(awards.awards.map((award) => award.playerId));
  const schwelle = volumenSchwelle(karriere);

  /**
   * „Hat eine Saison geprägt": Führung einer Leader-Kategorie oder MVP-Führung.
   *
   * In der laufenden Saison ist das direkt ablesbar — wer die Karriere-PPs-Liste anführt und
   * wer die meisten MVP-Auftritte hat. Über Archive hinweg käme dieselbe Frage aus den
   * Snapshots; solange es keine gibt, ist die laufende Saison die ganze Historie.
   */
  const ppsFuehrender = karriere[0]?.playerId ?? null;
  const mvpFuehrender = [...karriere].sort((links, rechts) => rechts.mvpTotal - links.mvpTotal)[0] ?? null;

  const kandidaten: LegendCandidate[] = karriere.map((row) => {
    const dauer = row.seasonsPlayed >= LEGEND_MIN_SEASONS;
    const volumen = row.totalPps >= schwelle && row.totalPps > 0;
    const dominanz =
      row.playerId === ppsFuehrender || (mvpFuehrender != null && mvpFuehrender.mvpTotal > 0 && row.playerId === mvpFuehrender.playerId);
    const titel = awardHalter.has(row.playerId);
    // „Hat einen Rekord gehalten" — ein Saison-Award IST ein Rekordeintrag in diesem Sinne;
    // solange es kein Archiv gibt, gibt es keine weitere Quelle dafür. Bewusst NICHT geraten:
    // ohne Beleg bleibt das Kriterium unerfüllt statt wohlwollend angenommen.
    const einzigartigkeit = awardHalter.has(row.playerId) && row.mvpTotal > 0;

    const criteria: LegendCriterion[] = [
      {
        id: "dauer",
        label: "Dauer",
        erklaerung: `Einsätze in mindestens ${LEGEND_MIN_SEASONS} Saisons.`,
        erfuellt: dauer,
        stand: `${row.seasonsPlayed} von ${LEGEND_MIN_SEASONS} Saisons`,
      },
      {
        id: "volumen",
        label: "Volumen",
        erklaerung: "Karriere-Punkte im besten Prozent der Liga.",
        erfuellt: volumen,
        stand: Number.isFinite(schwelle)
          ? `${row.totalPps.toFixed(1)} von ${schwelle.toFixed(1)} PPs`
          : `${row.totalPps.toFixed(1)} PPs`,
      },
      {
        id: "dominanz",
        label: "Dominanz",
        erklaerung: "Hat eine Saison angeführt — in Punkten oder MVP-Auftritten.",
        erfuellt: dominanz,
        stand: dominanz ? "führt eine Wertung an" : "keine Wertung angeführt",
      },
      {
        id: "titel",
        label: "Auszeichnung",
        erklaerung: "Hat einen Saison-Award gewonnen.",
        erfuellt: titel,
        stand: titel ? "Award-Träger" : "noch kein Award",
      },
      {
        id: "einzigartigkeit",
        label: "Einzigartigkeit",
        erklaerung: "Award-Träger UND MVP-Auftritte — beides zusammen.",
        erfuellt: einzigartigkeit,
        stand: einzigartigkeit ? "Award + MVP" : `${row.mvpTotal} MVP-Auftritte`,
      },
    ];

    const erfuellteAnzahl = criteria.filter((kriterium) => kriterium.erfuellt).length;
    const zusaetzlich = criteria.filter((kriterium) => kriterium.id !== LEGEND_RULE.pflicht && kriterium.erfuellt).length;

    return {
      playerId: row.playerId,
      playerName: row.playerName,
      teamName: row.teamName,
      totalPps: row.totalPps,
      appearances: row.appearances,
      seasonsPlayed: row.seasonsPlayed,
      criteria,
      erfuellteAnzahl,
      istLegende: dauer && zusaetzlich >= LEGEND_RULE.zusaetzlichMindestens,
    } satisfies LegendCandidate;
  });

  /**
   * Anwärter sortieren nach ERFÜLLTEN KRITERIEN, dann nach Punkten.
   *
   * Nicht nach Punkten allein: die Frage des Reiters ist „wer ist auf dem Weg, unsterblich zu
   * werden", nicht „wer hat am meisten". Ein Spieler mit drei erfüllten Kriterien ist näher dran
   * als einer mit mehr Punkten und einem.
   */
  const sortiert = [...kandidaten].sort((links, rechts) => {
    if (rechts.erfuellteAnzahl !== links.erfuellteAnzahl) return rechts.erfuellteAnzahl - links.erfuellteAnzahl;
    return rechts.totalPps - links.totalPps;
  });

  return {
    legends: sortiert.filter((kandidat) => kandidat.istLegende),
    anwaerter: sortiert.filter((kandidat) => !kandidat.istLegende).slice(0, 10),
    moeglichAbSaison: LEGEND_MIN_SEASONS,
    aktuelleSaison,
  };
}
