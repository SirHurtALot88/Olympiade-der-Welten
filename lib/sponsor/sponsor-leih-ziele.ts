/**
 * DIE ZWEI ZIELE — und was ersatzlos verschwindet.
 *
 * Chris: „diese ganzen bonus und extra ziele, da müssen wir uns auf ein paar wesentliche
 * beschränken wenn überhaupt und die sinnvoll und verständlich machen … was ich mir als ziel
 * vorstellen kann ist wie du meintest frische, ein gewisser platz in einer achse […] aber dann
 * passend zu dem was das team ggf. auch leisten kann! nicht wieder utopisch."
 *
 * ES BLEIBEN GENAU ZWEI, und beide sind ohne Taschenrechner nachvollziehbar:
 *
 *   FRISCHE — „mindestens 70 % deines Kaders sind am Saisonende frisch (Match-Fatigue ≤ 45)."
 *     Sie ist die EINZIGE Zielachse, die je funktioniert hat: Ø 44,3 % Erfüllung in der
 *     Saison-1-Messung, im Zielkorridor, ab Spieltag 1 über Rotation steuerbar. Neu ist nur die
 *     BINÄRE Auswertung — „70 % geschafft oder nicht" statt einer stufenlosen Quote.
 *
 *   ACHSEN-RANG — „halte deinen Rang in einer der vier Bereichsachsen." Die Latte kommt aus dem
 *     EIGENEN Rang bei Unterschrift, nie absolut gegen die Liga; drei Bänder (Spitze +2 halten,
 *     Mitte halten, Keller −2 erreichen). Das ist Chris' „passend zu dem, was das Team leisten
 *     kann".
 *
 * DREI UNTERSCHIEDE ZUM ABGELÖSTEN ACHSENSYSTEM, alle bewusst:
 *
 *   1. KEIN SOCKELABZUG. Der Bonus ist NICHT EV-fair eingepreist (`goalP = 0`): wer ihn verfehlt,
 *      verliert nichts. Das alte Modell zog −p·G immer ab und zahlte bei Erfolg +G — mit dem
 *      Ergebnis, dass die Zielzeile in Saison 1 über die ganze Liga −89,7 C betrug, bei 0 von 27
 *      erreichten Zielen. Eine Zeile, die praktisch immer nur kostet, ist kein Ziel, sondern eine
 *      Steuer.
 *   2. FESTE HÖHE statt Rarity-Staffel. Der Bonus ist ein Erfolgserlebnis von rund 6–10 % des
 *      Kartenwerts, kein Etat-Hebel. Damit braucht es auch keine Schwierigkeits-Bepreisung mehr —
 *      die 36 geschätzten `GOAL_PROBABILITY`-Werte („größter ungemessener Parameter des Systems")
 *      sind für Neuverträge gegenstandslos.
 *   3. NUR AUF GEBÄUDE-KARTEN. Die reine Cash-Karte trägt bewusst keins: sie ist die Karte für
 *      Teams, die planbares Geld brauchen, und ein Bonus mit Bedingung wäre dort das Gegenteil.
 *
 * Altverträge rechnen unverändert nach altem Recht weiter (Invariante 3) — dieser Zweig greift nur,
 * wo einer der beiden `specialKey` steht.
 */
import type { GameState, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { buildValueRanks } from "@/lib/season/season-value-ranks";

/**
 * Die Höhe des Bonus. Bewusst FEST und bewusst klein: bei Kartenwerten zwischen 52 und 107 C sind
 * 6 C rund 6–10 %. Gross genug, dass man ihn holen will; klein genug, dass eine verfehlte Latte den
 * Etat nicht verschiebt und die Karte weiterhin ueber Leiter und Gebaeude entschieden wird.
 */
export const SPONSOR_LEIH_BONUS = 6;

/** Ab welcher Match-Fatigue ein Spieler nicht mehr als frisch zaehlt. Dieselbe Grenze wie bisher. */
export const LEIH_ZIEL_FATIGUE_CAP = 45;

/** Welcher Anteil des Kaders frisch sein muss. Binaer: darunter 0, darauf oder darueber voll. */
export const LEIH_ZIEL_FRISCHE_SCHWELLE = 70;

export const LEIH_ZIEL_FRISCHE = "leih_frische";
export const LEIH_ZIEL_ACHSENRANG = "leih_achsenrang";

export type LeihZielKey = typeof LEIH_ZIEL_FRISCHE | typeof LEIH_ZIEL_ACHSENRANG;
export type LeihAchse = "pow" | "spe" | "men" | "soc";

const ACHSEN_LABEL: Record<LeihAchse, string> = {
  pow: "Kraft",
  spe: "Tempo",
  men: "Kopf",
  soc: "Team",
};

export function istLeihZiel(key: string | null | undefined): key is LeihZielKey {
  return key === LEIH_ZIEL_FRISCHE || key === LEIH_ZIEL_ACHSENRANG;
}

/** Anteil des Kaders mit Match-Fatigue ≤ 45, in Prozent. */
export function frischeAnteilPct(gameState: GameState, teamId: string): number {
  const kader = new Set(
    gameState.rosters.filter((eintrag) => eintrag.teamId === teamId).map((eintrag) => eintrag.playerId),
  );
  if (kader.size === 0) return 0;

  // Dieselbe Fatigue-Quelle, gegen die auch die Mechanik rechnet: die reine Match-Fatigue aus
  // `playerAvailabilityState`. `player.fatigue` traegt zusaetzlich die Trainingsschicht und wuerde
  // eine andere Groesse messen als die, die das Team tatsaechlich steuert.
  const fatigueJeSpieler = new Map<string, number>();
  for (const eintrag of gameState.seasonState.playerAvailabilityState ?? []) {
    if (eintrag.teamId === teamId) fatigueJeSpieler.set(eintrag.playerId, eintrag.fatigue);
  }

  const frisch = gameState.players.filter((spieler) => {
    if (!kader.has(spieler.id)) return false;
    const ausVerfuegbarkeit = fatigueJeSpieler.get(spieler.id);
    const matchFatigue =
      typeof ausVerfuegbarkeit === "number"
        ? ausVerfuegbarkeit
        : typeof spieler.fatigue === "number"
          ? spieler.fatigue
          : 0;
    return matchFatigue <= LEIH_ZIEL_FATIGUE_CAP;
  }).length;

  return Math.round((frisch / kader.size) * 1000) / 10;
}

/**
 * Der Liga-Rang eines Teams in einer der vier Bereichsachsen — dieselbe Rechnung, die der
 * Saisonstand zeigt (`buildValueRanks`). Zwei getrennte Rechnungen wuerden frueher oder spaeter
 * auseinanderlaufen, und der Spieler saehe eine Zielmarke, die seine eigene Tabelle nicht bestaetigt.
 */
export function achsenRang(gameState: GameState, teamId: string, achse: LeihAchse): number | null {
  const zeilen = buildTeamSeasonOverviewRows({ gameState });
  const feld = { pow: "ppsPow", spe: "ppsSpe", men: "ppsMen", soc: "ppsSoc" } as const;
  const raenge = buildValueRanks(
    zeilen,
    (zeile) => zeile.teamId,
    (zeile) => (zeile as unknown as Record<string, number | null>)[feld[achse]] ?? null,
  );
  return raenge.get(teamId) ?? null;
}

/**
 * DIE LATTE, „passend zu dem was das Team leisten kann" — aus dem eigenen Rang bei Unterschrift.
 *
 * Drei Baender, und die Richtung ist bewusst nicht symmetrisch: die Spitze bekommt Spielraum nach
 * unten (sie kann kaum steigen), der Keller muss sich bewegen (er kann kaum fallen). Die Mitte haelt
 * ihren Platz. ±2 Raenge als normale Saisonbewegung ist eine ANNAHME aus #490 und ungemessen — sie
 * steht als offener Punkt 3 in der Bauvorlage.
 */
export function baueAchsenLatte(startRang: number, leagueSize: number = 32): number {
  const geklammert = Math.max(1, Math.min(leagueSize, Math.round(startRang)));
  if (geklammert <= 8) return Math.min(leagueSize, geklammert + 2);
  if (geklammert <= 24) return geklammert;
  return Math.max(1, geklammert - 2);
}

/**
 * Die Zielkomponente einer Gebäude-Karte, bei Unterschrift eingefroren.
 *
 * Die Konditionen wandern in den `targetValue`, wie bei der abgeloesten Achse auch — damit Karte,
 * Anzeige und Settlement dieselbe Zahl lesen und ein spaeterer Zustandswechsel den Vertrag nicht
 * nachtraeglich verschiebt.
 */
export function baueLeihZielKomponente(input: {
  gameState: GameState;
  teamId: string;
  key: LeihZielKey;
  achse?: LeihAchse;
}): SponsorOfferComponent {
  if (input.key === LEIH_ZIEL_FRISCHE) {
    return {
      componentId: "leih-ziel",
      kind: "special",
      specialKey: LEIH_ZIEL_FRISCHE,
      label: `Bonus · ${LEIH_ZIEL_FRISCHE_SCHWELLE} % des Kaders frisch`,
      targetValue: `frischeschwelle:${LEIH_ZIEL_FRISCHE_SCHWELLE}`,
      stages: undefined,
      rewardCash: 0,
      penaltyCash: undefined,
    };
  }

  const achse = input.achse ?? "pow";
  const startRang = achsenRang(input.gameState, input.teamId, achse) ?? 16;
  const latte = baueAchsenLatte(startRang);
  return {
    componentId: "leih-ziel",
    kind: "special",
    specialKey: LEIH_ZIEL_ACHSENRANG,
    label: `Bonus · ${ACHSEN_LABEL[achse]}-Rang ${latte} oder besser`,
    targetValue: `achse:${achse};latte:${latte};start:${startRang}`,
    stages: undefined,
    rewardCash: 0,
    penaltyCash: undefined,
  };
}

export type LeihZielStand = {
  /** 0 oder 1 — beide Ziele sind binaer. */
  fraction: number;
  /** Der gemessene Ist-Wert (Frische in %, oder der Achsen-Rang). */
  metric: number | null;
  /** Was auf der Karte steht: „68 % frisch von 70 % noetig". */
  reachedLabel: string;
};

/** Liest die eingefrorenen Konditionen aus dem `targetValue` zurueck. */
function leseKonditionen(component: SponsorOfferComponent): Record<string, string> {
  const roh = typeof component.targetValue === "string" ? component.targetValue : "";
  const eintraege: Record<string, string> = {};
  for (const teil of roh.split(";")) {
    const [schluessel, wert] = teil.split(":");
    if (schluessel && wert != null) eintraege[schluessel] = wert;
  }
  return eintraege;
}

/**
 * Die Auswertung am Saisonende. BINAER: 1 oder 0, nie dazwischen.
 *
 * Das ist die verstaendlichste Form („geschafft oder nicht") und zugleich die ehrlichste: eine
 * Teilerfuellung von 63 % laesst sich niemandem erklaeren, der nicht die Formel kennt.
 */
export function werteLeihZiel(
  gameState: GameState,
  teamId: string,
  component: SponsorOfferComponent,
): LeihZielStand {
  const konditionen = leseKonditionen(component);

  if (component.specialKey === LEIH_ZIEL_FRISCHE) {
    const schwelle = Number(konditionen.frischeschwelle ?? LEIH_ZIEL_FRISCHE_SCHWELLE);
    const ist = frischeAnteilPct(gameState, teamId);
    return {
      fraction: ist >= schwelle ? 1 : 0,
      metric: ist,
      reachedLabel: `${ist.toFixed(0)} % frisch von ${schwelle} % noetig`,
    };
  }

  const achse = (konditionen.achse ?? "pow") as LeihAchse;
  const latte = Number(konditionen.latte ?? 16);
  const ist = achsenRang(gameState, teamId, achse);
  if (ist == null) {
    // Kein Rang heisst „nichts geholt" — das ist etwas anderes als der letzte Platz, und es soll
    // kein Ziel geschenkt bekommen.
    return { fraction: 0, metric: null, reachedLabel: `${ACHSEN_LABEL[achse]}: kein Rang` };
  }
  return {
    fraction: ist <= latte ? 1 : 0,
    metric: ist,
    reachedLabel: `${ACHSEN_LABEL[achse]}-Rang ${ist} von ${latte} noetig`,
  };
}
