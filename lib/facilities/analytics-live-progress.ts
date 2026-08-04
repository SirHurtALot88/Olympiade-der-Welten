/**
 * ANALYTICS ROOM — LIVE-FORTSCHRITT AUF SPONSOR-ACHSE UND BOARD-ZIELEN.
 *
 * WARUM ES DIESE DATEI GIBT. Der Analytics Room hatte bis hierher keinen einzigen Zahleneffekt.
 * `getAnalyticsForecastQuality` (facility-effects.ts) gab ein Label zurueck, das an zwei Stellen als
 * reiner Text gelesen wurde; die Prognose-Pipeline kennt ueberhaupt keinen Konfidenzbegriff, an den
 * eine "Forecast Quality" andocken koennte. Real war am Gebaeude nur zweierlei: die Team-Power ab
 * Stufe 2 und die ab Stufe 4. Stufe 1, 3 und 5 waren reine Kosten — Stufe 5 kostete 42 Cash Bau und
 * 3,6 Cash Unterhalt fuer exakt null zusaetzliche Wirkung. Genau das war die Beschwerde.
 *
 * WAS DAS GEBAEUDE JETZT TUT. Die Sponsor-Achse misst den Fortschritt gegen die bei Vertragsabschluss
 * eingefrorene eigene Ausgangslage, und `evaluateSponsorV4Axis` kann diesen Fortschritt JEDERZEIT
 * waehrend der Saison berechnen. Aufgerufen wurde sie aber nur aus dem Settlement-Pfad — der Spieler
 * erfuhr sein Ergebnis erst am Saisonende. Blindflug. Der Analytics Room schaltet diesen bereits
 * existierenden Zwischenstand stufenweise frei, dazu die Zahlen hinter den Board-Zielen.
 *
 * DREI EIGENSCHAFTEN TRAGEN DIESE UMSETZUNG:
 *
 * 1. NICHTS WIRD GESPEICHERT UND KEINE BALANCE-ZAHL ANGEFASST. Diese Datei liest Zustand und
 *    formatiert ihn. Achsen-Skalen, Board-Ziel-Schwellen, Bau- und Unterhaltskosten bleiben, wie sie
 *    sind. Ein bestehender Spielstand aendert sich durch dieses Feature um kein Byte; wer den
 *    Analytics Room nicht gebaut hat, sieht schlicht nichts.
 *
 * 2. ANZEIGE UND ABRECHNUNG SIND DIESELBE RECHNUNG, NICHT ZWEI GLEICH AUSSEHENDE. Der Sponsor-Teil
 *    liest die Vertragskomponente, die auch das Settlement liest (`kind === "special"`), leitet die
 *    Konditionen mit derselben exportierten Funktion ab (`sponsorV4AxisTermsFromComponent`) und
 *    rechnet mit derselben Funktion (`evaluateSponsorV4Axis`). Es gibt keinen zweiten Rechenweg, der
 *    driften koennte. Der Board-Teil liest `getTeamObjectives` — genau die Records, aus denen
 *    `buildTeamSeasonObjectiveSettlement` spaeter Praemie und Strafe ableitet.
 *
 * 3. EHRLICHE ANZEIGE STATT IRREFUEHRENDER NULL. Sobald ein Zwischenstand sichtbar ist, wird jeder
 *    Wert daran gemessen. Zwei Achsen liefern zu bestimmten Zeitpunkten SYSTEMATISCH keine
 *    belastbare Zahl (siehe `resolveAxisReliability`). Die wuerden als "0 % erfuellt" wie ein
 *    Spielerfehler aussehen, obwohl sie eine Eigenheit der Messung sind. Solche Faelle werden hier
 *    ausdruecklich als "noch keine belastbare Zahl" ausgewiesen — lieber keine Zahl als eine falsche.
 */
import type {
  GameState, SponsorOfferComponent, TeamSeasonObjectiveRecord, TeamSeasonObjectiveStatus,
} from "@/lib/data/olyDataTypes";
import { getTeamObjectives } from "@/lib/board/team-season-objectives-service";
import { FACILITY_CATALOG_BY_ID } from "@/lib/facilities/facility-catalog";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  evaluateSpecialComponentStage, sponsorV4AxisTermsFromComponent,
} from "@/lib/sponsor/sponsor-objective-evaluator";
import { evaluateSponsorV4Axis, type SponsorV4AxisKey } from "@/lib/sponsor/sponsor-v4-axes";

/* -------------------------------------------------------------------------------------------------
 * DIE STUFENLEITER
 * ---------------------------------------------------------------------------------------------- */

/** Wie genau die Sponsor-Achse gezeigt wird. Jede Stufe schliesst die vorige ein. */
export type AnalyticsSponsorDetail = "none" | "band" | "percent" | "full";
/** Wie genau die Board-Ziele gezeigt werden. Jede Stufe schliesst die vorige ein. */
export type AnalyticsBoardDetail = "none" | "stand" | "full";

/**
 * DIE LEITER, UND WARUM SIE SO LIEGT.
 *
 * Zwei Regeln haben sie festgelegt:
 *
 * (a) JEDE STUFE MUSS ETWAS AENDERN. Das war der Kern der Beschwerde — Stufe 1, 3 und 5 waren reine
 *     Kosten. Deshalb schaltet hier jede der fuenf Stufen genau EINE neue Information frei, keine
 *     zwei Stufen sind gleich.
 *
 * (b) ZUERST DIE SPONSOR-ACHSE, DANN DIE BOARD-ZIELE. Nicht willkuerlich: die Achse ist heute
 *     WAEHREND der Saison vollstaendig unsichtbar — sie wird ausschliesslich im Settlement gerechnet.
 *     Der Status der Board-Ziele ist dagegen schon frei sichtbar (Board-Ziel-Liste auf der
 *     Sponsorenseite zeigt Label, Zielwert und Status ohne jedes Gebaeude). Der Informationsgewinn
 *     ist bei der Achse also groesser, und er gehoert an die billigen Stufen. Was das Gebaeude bei
 *     den Board-Zielen ergaenzt, ist nur noch der Zwischenstand und der Abstand — echter, aber
 *     kleinerer Zugewinn, also die teuren Stufen.
 *
 * Daraus folgt die Kaufentscheidung, die es vorher nicht gab: wer nur seine Sponsor-Achse steuern
 * will, ist bei Stufe 3 fertig und spart 69 Cash Bau plus 6 Cash Unterhalt pro Saison. Wer die
 * Board-Ziele mitrechnen will, baut weiter. Die beiden Team-Powers auf Stufe 2 und 4 bleiben
 * unveraendert obendrauf.
 *
 * | Stufe | neu freigeschaltet                                                          |
 * |-------|-----------------------------------------------------------------------------|
 * | 0     | nichts — ohne das Gebaeude gibt es keinen Live-Fortschritt                   |
 * | 1     | Sponsor-Achse: grobe Einordnung ("auf Kurs", "knapp", "im Rueckstand")       |
 * | 2     | Sponsor-Achse: der exakte Erfuellungsgrad in Prozent                         |
 * | 3     | Sponsor-Achse: Ist-/Zielwert in der Einheit der Achse samt Restbedarf        |
 * | 4     | Board-Ziele: der Zwischenstand je Ziel neben dem Zielwert                    |
 * | 5     | Board-Ziele: der Abstand zum Zielwert je Ziel                                |
 */
const ANALYTICS_SPONSOR_DETAIL_BY_LEVEL: readonly AnalyticsSponsorDetail[] = [
  "none", "band", "percent", "full", "full", "full",
];
const ANALYTICS_BOARD_DETAIL_BY_LEVEL: readonly AnalyticsBoardDetail[] = [
  "none", "none", "none", "none", "stand", "full",
];

/**
 * Ein Satz je Stufe, GELESEN AUS DEM KATALOG statt daneben gepflegt. Genau daran ist der Raum vorher
 * gescheitert: der Katalog bewarb fuenf Forecast-Stufen, die es nirgends gab. Die Werbung und die
 * Wirkung stehen jetzt nicht mehr an zwei Stellen — der Katalogtext IST die Beschreibung der Stufe,
 * und `tests/analytics-live-fortschritt.test.ts` haelt beide aneinander.
 */
export const ANALYTICS_LIVE_LEVEL_SUMMARY: readonly string[] = [
  "kein Live-Fortschritt",
  ...FACILITY_CATALOG_BY_ID.analytics_room.levels.map((entry) => entry.effectDescription),
];

export type AnalyticsLiveUnlock = {
  /** Wirksame Stufe des Analytics Room (0, wenn nicht gebaut, abgeschaltet oder verfallen). */
  level: number;
  sponsor: AnalyticsSponsorDetail;
  board: AnalyticsBoardDetail;
};

/**
 * Was die aktuelle Stufe dieses Teams freischaltet. Liest die Stufe ueber `getFacilityLevel`, also
 * inklusive der bestehenden Regeln: abgeschaltet oder auf Zustand 0 verfallen zaehlt als Stufe 0.
 */
export function getAnalyticsLiveUnlock(gameState: GameState, teamId: string): AnalyticsLiveUnlock {
  const level = getFacilityLevel(getTeamFacilityState(gameState, teamId), "analytics_room");
  return {
    level,
    sponsor: ANALYTICS_SPONSOR_DETAIL_BY_LEVEL[level] ?? "none",
    board: ANALYTICS_BOARD_DETAIL_BY_LEVEL[level] ?? "none",
  };
}

/* -------------------------------------------------------------------------------------------------
 * EHRLICHKEIT: WANN EINE ACHSE KEINE BELASTBARE ZAHL LIEFERT
 * ---------------------------------------------------------------------------------------------- */

export type AnalyticsUnreliableReason =
  | "wachstum_methodenwechsel_s1"
  | "wachstum_ohne_ausgangslage"
  | "entwicklung_erst_zur_abrechnung"
  | "kaderpflege_ohne_kader";

/** Warum an dieser Stelle keine Zahl steht — im Klartext, damit es nicht nach Spielerfehler aussieht. */
export const ANALYTICS_UNRELIABLE_TEXT: Readonly<Record<AnalyticsUnreliableReason, string>> = {
  wachstum_methodenwechsel_s1:
    "In Saison 1 wird jeder Marktwert zur Saisonabrechnung einmalig nach einer anderen Methode neu " +
    "gesetzt als bei Vertragsabschluss. Ein Zwischenstand wäre hier eine Aussage über den " +
    "Methodenwechsel, nicht über deine Arbeit.",
  wachstum_ohne_ausgangslage:
    "Für diesen Vertrag steht kein Kaderwert als Ausgangslage — ohne Ausgangslage gibt es keinen " +
    "prozentualen Zuwachs, gegen den gemessen werden könnte.",
  entwicklung_erst_zur_abrechnung:
    "Marktwertsprünge werden erst bei der Saisonabrechnung gebucht. Vorher steht die Zählung " +
    "zwangsläufig auf null — das ist kein Rückstand, sondern noch keine Messung.",
  kaderpflege_ohne_kader:
    "Ohne Kaderspieler gibt es keinen Frische-Anteil, der sich messen ließe.",
};

/**
 * IST DIE ACHSE ZU DIESEM ZEITPUNKT UEBERHAUPT MESSBAR?
 *
 * Hier steht KEINE neue Balance-Regel. Jede der vier Ausnahmen ist die Anzeigeseite einer Eigenheit,
 * die im Regelwerk schon dokumentiert ist:
 *
 * - `wachstum` in Saison 1: `player.marketValue` traegt bis zur Saisonabrechnung die heuristische
 *   Draft-Schaetzung und wird dann fuer jeden Spieler einmalig durch den rang-basierten Wert ersetzt.
 *   Baseline und Endwert stehen also auf verschiedenen Skalen; gemessen wurden −29,9 % im Schnitt,
 *   kein einziger Vertrag positiv. Genau deshalb wird die Achse in Saison 1 gar nicht mehr angeboten
 *   (`offerable` in sponsor-v4-axes.ts). In einem Altvertrag kann sie trotzdem noch liegen — dann
 *   waere ein Live-Prozentwert die irrefuehrendste Zahl im ganzen Spiel.
 * - `wachstum` ohne positive Ausgangslage: `metric` liefert dann konstruktionsbedingt 0.
 * - `entwicklung`: zaehlt Spieler mit Marktwertsprung aus `playerProgressionEvents`. Die entstehen
 *   ausschliesslich in der Saisonend-Progression (`season-end-xp-apply-service.ts`, Quellen
 *   `manual_season_end_xp_spend` / `organic_season_progression`). Waehrend der Saison ist die Liste
 *   fuer die laufende Saison leer — die Achse steht also zwingend auf 0, egal wie gut das Team ist.
 * - `kaderpflege` ohne Kader: `freshSharePct` gibt 0 zurueck, was nach 0 % Frische aussieht, aber
 *   "keine Grundlage" heisst. Dieselbe Bedingung filtert die Achse auch aus dem Angebot.
 *
 * `ausbau` und `soliditaet` sind zu jedem Zeitpunkt echt messbar und stehen deshalb nicht hier.
 */
function resolveAxisReliability(
  gameState: GameState, teamId: string, key: SponsorV4AxisKey, baseline: number,
): AnalyticsUnreliableReason | null {
  switch (key) {
    case "wachstum":
      if (gameState.season.id === "season-1") return "wachstum_methodenwechsel_s1";
      return baseline > 0 ? null : "wachstum_ohne_ausgangslage";
    case "entwicklung": {
      const hatMessung = (gameState.playerProgressionEvents ?? []).some(
        (event) => event.seasonId === gameState.season.id,
      );
      return hatMessung ? null : "entwicklung_erst_zur_abrechnung";
    }
    case "kaderpflege":
      return gameState.rosters.some((entry) => entry.teamId === teamId) ? null : "kaderpflege_ohne_kader";
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------------------------------
 * SPONSOR-ACHSE
 * ---------------------------------------------------------------------------------------------- */

/**
 * Die grobe Einordnung der Stufe 1. REINE ANZEIGE-SCHUBLADEN, keine Balance-Schwellen: sie
 * entscheiden nichts, sie beschreiben nur einen Erfuellungsgrad, den das Settlement ohnehin so
 * rechnet. `kein_fortschritt` steht bewusst getrennt von `rueckstand` — eine auf 0 geklammerte Achse
 * ist etwas anderes als eine, die sich bewegt hat.
 */
export type AnalyticsLiveBand = "erfuellt" | "auf_kurs" | "knapp" | "rueckstand" | "kein_fortschritt";

export const ANALYTICS_BAND_TEXT: Readonly<Record<AnalyticsLiveBand, string>> = {
  erfuellt: "erfüllt",
  auf_kurs: "auf Kurs",
  knapp: "knapp",
  rueckstand: "im Rückstand",
  kein_fortschritt: "kein Fortschritt",
};

function bandForFraction(fraction: number): AnalyticsLiveBand {
  if (fraction >= 1) return "erfuellt";
  if (fraction >= 0.75) return "auf_kurs";
  if (fraction >= 0.4) return "knapp";
  if (fraction > 0) return "rueckstand";
  return "kein_fortschritt";
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

export type AnalyticsSponsorAxisLive = {
  /** Wirksame Stufe des Analytics Room, aus der diese Anzeige stammt. */
  analyticsLevel: number;
  /** Freigeschaltete Detailtiefe — "band" | "percent" | "full". */
  detail: Exclude<AnalyticsSponsorDetail, "none">;
  achse: SponsorV4AxisKey;
  label: string;
  /** false = die Achse liefert zu diesem Zeitpunkt keine belastbare Zahl. Dann sind alle Zahlen null. */
  belastbar: boolean;
  /** Warum nicht belastbar — null, wenn belastbar. */
  grund: AnalyticsUnreliableReason | null;
  /** Grobe Einordnung. Ab Stufe 1, null wenn nicht belastbar. */
  band: AnalyticsLiveBand | null;
  /** Erfuellungsgrad in Prozent (0..100). Ab Stufe 2. */
  erfuellungPct: number | null;
  /** Ist-Wert in der Einheit der Achse. Ab Stufe 3. */
  stand: number | null;
  /** Wert, der volle Erfuellung bedeutet. Ab Stufe 3. */
  ziel: number | null;
  /** Was bis zur vollen Erfuellung fehlt (0, wenn erfuellt). Ab Stufe 3. */
  rest: number | null;
  einheit: string | null;
  /** Fertige Anzeigezeile — genau so viel, wie die Stufe hergibt. */
  text: string;
};

/**
 * DER LIVE-ZWISCHENSTAND DER SPONSOR-ACHSE, oder null, wenn es nichts zu zeigen gibt: kein
 * Analytics Room, kein laufender Vertrag, oder ein Vertrag ohne Achse (Basiskarte / Altvertrag mit
 * einem Katalog-Sonderziel).
 *
 * Die Komponente wird GENAUSO ausgewaehlt wie im Settlement (`buildSponsorV3SeasonEndRows`:
 * `components.find(kind === "special")`) und mit derselben Term-Ableitung gelesen. Damit ist die
 * Uebereinstimmung strukturell und nicht nur zufaellig — es gibt nur eine Rechnung.
 */
export function buildAnalyticsSponsorAxisLive(
  gameState: GameState, teamId: string,
): AnalyticsSponsorAxisLive | null {
  const unlock = getAnalyticsLiveUnlock(gameState, teamId);
  if (unlock.sponsor === "none") return null;

  const contract = getTeamSponsorContract(gameState, teamId);
  const goalComponent: SponsorOfferComponent | null =
    contract?.components.find((component) => component.kind === "special") ?? null;
  if (!goalComponent) return null;

  const terms = sponsorV4AxisTermsFromComponent(goalComponent);
  if (!terms) return null;

  const progress = evaluateSponsorV4Axis(gameState, teamId, terms);
  const grund = resolveAxisReliability(gameState, teamId, terms.key, terms.baseline);

  const gemeinsam = {
    analyticsLevel: unlock.level,
    detail: unlock.sponsor,
    achse: terms.key,
    label: progress.label,
    einheit: progress.unit,
  };

  if (grund) {
    // KEINE ZAHL, AUCH NICHT AUF STUFE 5. Eine Achse ohne Messgrundlage bekommt hier keinen
    // Prozentwert — sonst stuende dort "0 % erfuellt" und der Spieler suchte einen Fehler bei sich.
    return {
      ...gemeinsam,
      belastbar: false,
      grund,
      band: null,
      erfuellungPct: null,
      stand: null,
      ziel: null,
      rest: null,
      text: `${progress.label}: noch keine belastbare Zahl — ${ANALYTICS_UNRELIABLE_TEXT[grund]}`,
    };
  }

  const band = bandForFraction(progress.fraction);
  const erfuellungPct = Math.round(progress.fraction * 100);
  const rest = Math.max(0, Math.round((progress.target - progress.metric) * 100) / 100);

  if (unlock.sponsor === "band") {
    return {
      ...gemeinsam,
      belastbar: true,
      grund: null,
      band,
      erfuellungPct: null,
      stand: null,
      ziel: null,
      rest: null,
      text: `${progress.label}: ${ANALYTICS_BAND_TEXT[band]}`,
    };
  }

  if (unlock.sponsor === "percent") {
    return {
      ...gemeinsam,
      belastbar: true,
      grund: null,
      band,
      erfuellungPct,
      stand: null,
      ziel: null,
      rest: null,
      text: `${progress.label}: ${erfuellungPct} % erfüllt (${ANALYTICS_BAND_TEXT[band]})`,
    };
  }

  return {
    ...gemeinsam,
    belastbar: true,
    grund: null,
    band,
    erfuellungPct,
    stand: progress.metric,
    ziel: progress.target,
    rest,
    text:
      `${progress.label}: ${formatNumber(progress.metric)}${progress.unit} von ` +
      `${formatNumber(progress.target)}${progress.unit} — ${erfuellungPct} % erfüllt, ` +
      (rest > 0 ? `noch ${formatNumber(rest)}${progress.unit}` : "Ziel erreicht"),
  };
}

/**
 * GEGENPROBE GEGEN DIE ABRECHNUNG. Liefert den Erfuellungsgrad, mit dem das Settlement diesen
 * Vertrag am Saisonende bezahlen wuerde, wenn die Saison in diesem Zustand endete — gerechnet ueber
 * exakt den Aufruf aus `sponsor-settlement-service.ts`.
 *
 * Diese Funktion ist NICHT der Anzeigepfad; sie existiert, damit ein Test die Anzeige gegen die
 * Abrechnung stellen kann, ohne dass der Test dabei die Anzeige-Implementierung nachbaut.
 */
export function sponsorSettlementGoalFraction(gameState: GameState, teamId: string): number | null {
  const contract = getTeamSponsorContract(gameState, teamId);
  const goalComponent = contract?.components.find((component) => component.kind === "special") ?? null;
  if (!goalComponent) return null;
  return Math.max(0, Math.min(1, evaluateSpecialComponentStage(gameState, teamId, goalComponent).fraction));
}

/* -------------------------------------------------------------------------------------------------
 * BOARD-ZIELE
 * ---------------------------------------------------------------------------------------------- */

export type AnalyticsBoardGoalLive = {
  objectiveId: string;
  label: string;
  /** Genau der Status, aus dem das Board-Settlement spaeter Praemie und Strafe ableitet. */
  status: TeamSeasonObjectiveStatus;
  /** Zielwert, wie er im Ziel steht — auch als Text ("> 0"), wenn das Ziel keine Zahlenskala hat. */
  ziel: string | null;
  /** Zwischenstand. Ab Stufe 4. */
  stand: string | null;
  /** Abstand zwischen Stand und Ziel. Ab Stufe 5, und nur wenn beide Zahlen sind. */
  abstand: number | null;
  /**
   * false = fuer dieses Ziel laesst sich kein Abstand rechnen, weil Stand oder Ziel keine Zahl sind
   * (z. B. "Cash positiv halten" mit Ziel "> 0"). Dann bleibt es beim Status.
   */
  abstandBelastbar: boolean;
  text: string;
};

function objectiveValueText(value: TeamSeasonObjectiveRecord["targetValue"]): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (typeof value === "number") return Number.isFinite(value) ? formatNumber(value) : null;
  const text = value.trim();
  return text === "" ? null : text;
}

function objectiveNumber(value: TeamSeasonObjectiveRecord["targetValue"]): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * DER LIVE-ZWISCHENSTAND DER BOARD-ZIELE. Leer unterhalb Stufe 4 — dort schaltet das Gebaeude fuer
 * die Board-Ziele noch nichts frei.
 *
 * Quelle sind die Objective-Records selbst (`getTeamObjectives`), also genau die Saetze, aus denen
 * `buildTeamSeasonObjectiveSettlement` am Saisonende Cash und Vorstandsvertrauen ableitet.
 *
 * WARUM HIER KEIN PROZENTWERT STEHT. Die Records tragen die RICHTUNG des Ziels nicht mit: bei
 * "Rang <= 6" ist kleiner besser, bei "Transfergewinn >= 10" groesser (`rankTarget` wird beim
 * Speichern absichtlich verworfen). Eine Erfuellungsquote liesse sich also nur aus einer geratenen
 * Richtung bilden, und die waere bei jedem zweiten Ziel verkehrt herum. Der ABSTAND ist dagegen
 * richtungsfrei und stimmt immer. Deshalb: Stand, Ziel, Abstand — keine erfundene Quote.
 */
export function buildAnalyticsBoardGoalsLive(
  gameState: GameState, teamId: string,
): AnalyticsBoardGoalLive[] {
  const unlock = getAnalyticsLiveUnlock(gameState, teamId);
  if (unlock.board === "none") return [];

  return getTeamObjectives(gameState, teamId).map((objective) => {
    const zielText = objectiveValueText(objective.targetValue);
    const standText = objectiveValueText(objective.currentValue);
    const zielZahl = objectiveNumber(objective.targetValue);
    const standZahl = objectiveNumber(objective.currentValue);
    const abstandBelastbar = zielZahl != null && standZahl != null;
    const abstand =
      unlock.board === "full" && abstandBelastbar
        ? Math.round(Math.abs(zielZahl - standZahl) * 100) / 100
        : null;

    const teile: string[] = [];
    if (standText != null) teile.push(`Stand ${standText}`);
    if (zielText != null) teile.push(`Ziel ${zielText}`);
    if (abstand != null) {
      // RICHTUNGSFREI FORMULIERT: ob "noch" oder "Puffer" gilt, sagt der Status — nicht das
      // Vorzeichen, das ohne bekannte Richtung nichts bedeutet.
      teile.push(objective.status === "completed" ? `${formatNumber(abstand)} Puffer` : `${formatNumber(abstand)} Abstand`);
    } else if (unlock.board === "full" && !abstandBelastbar) {
      teile.push("kein Zahlenabstand — nur Status");
    }

    return {
      objectiveId: objective.objectiveId,
      label: objective.label,
      status: objective.status,
      ziel: zielText,
      stand: standText,
      abstand,
      abstandBelastbar,
      text: teile.length > 0 ? `${objective.label}: ${teile.join(" · ")}` : objective.label,
    };
  });
}
