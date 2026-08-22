import type {
  GameState,
  SeasonSnapshotRecord,
  SeasonSnapshotPlayerPerformanceRecord,
  PlayerProgressionSpendEventRecord,
} from "@/lib/data/olyDataTypes";
import { formatTrainingAttributeLabel } from "@/lib/foundation/player-attribute-history";
import { leseSaisonSchnappschuesse } from "@/lib/persistence/foundation-season-history-projection";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/**
 * SAISON-SPOTLIGHT — der Rueckblick auf die eigene Trainingsarbeit, gewuenscht von Chris
 * (Meldung `5hcq2p`, Ansicht „Team · Training"):
 *
 *   „es müsste irgendwie noch mehr eigene team highlights geben wenn man in die neue season
 *    kommt, dass man irgendwo sehen kann wie sich das trainnig entwickelt hat, dass man sieht
 *    ob spieler ihre klasse gewechselt haben, welche spieler sich in stats und in MW verbessert
 *    haben usw - da müsste man mal so ein spotlight designen"
 *
 * Der Entwurf stammt von Fable und wurde von Chris so freigegeben. Vier Entscheidungen daraus
 * stecken hier im Code, damit spaetere Leser sie nicht fuer Zufall halten:
 *
 * 1. NUR DER EIGENE KADER. Gezeigt werden Spieler, die JETZT im Team stehen und in der Vorsaison
 *    ein Trainingsereignis hatten. Wer verkauft wurde, faellt heraus — der Block sitzt auf der
 *    Trainingsansicht und beantwortet „womit arbeite ich weiter", nicht „was war einmal".
 *    NACHGEMESSEN an `swnjlk`: von neun trainierten Spielern stehen noch vier im Kader. Der
 *    groesste Zuwachs der Vorsaison (XR-KAROT-01, +5,0 SP, Tank -> Berserker) ist verkauft und
 *    erscheint deshalb NICHT. Das ist die bewusste Folge der Regel, kein Fehler.
 *
 * 2. SORTIERT NACH SP NETTO, nicht nach Marktwert. Setpoints sind die Waehrung, die Training
 *    bewegt; der Marktwert enthaelt auch Markt- und Leistungseffekte und wuerde das Urteil ueber
 *    den Trainingsplan verzerren. Der Marktwert steht daneben, weil er die Zahl ist, die Chris
 *    fuehlt.
 *
 * 3. KEINE OVR-SPALTE. Der Event-Snapshot schreibt vor und nach denselben OVR (nachgemessen an
 *    Lulu: 54,07 -> 54,07), und der Saison-Snapshot fuehrt `ovrNormalized` auf Liga-Skala — mit
 *    `player.ovr` nicht vergleichbar. Eine Spalte, in der ueberall „—" steht, ist schlechter als
 *    keine Spalte. Sie kann kommen, sobald der After-Snapshot den OVR sauber traegt.
 *
 * 4. HOECHSTENS FUENF ZEILEN, der Rest als Zahl. Und Neuzugaenge sind eine eigene Kategorie:
 *    wer in der Vorsaison vereinslos war, hat kein Trainingsereignis — dort ist kein Delta
 *    behauptbar, also steht dort auch keines.
 *
 * EINE ABWEICHUNG VOM ENTWURF, bewusst: Fable beschriftete die Marktwert-Kachel mit „durch
 * Training". Das ist nicht belegbar — der Marktwert-Zuwachs ist im Save nicht nach Herkunft
 * zerlegt (nur die Attribute sind es, ueber `originTraining`/`originPerformance`/…). Die Kachel
 * heisst deshalb schlicht „Marktwert-Zuwachs".
 */

export type SpotlightAttributeGain = {
  attribute: string;
  label: string;
  fromValue: number;
  toValue: number;
  delta: number;
};

export type SpotlightPlayerRow = {
  playerId: string;
  playerName: string;
  /** `organicMeta.netSetpoints` der Vorsaison. Kann negativ sein (Regression). */
  netSetpoints: number;
  /** Groesster Einzelzuwachs unter den Attributen; null, wenn kein Attribut zulegte. */
  bestAttribute: SpotlightAttributeGain | null;
  /** Marktwert bei Saisoneintritt (`playerPerformances.purchasePrice`). */
  marketValueFrom: number | null;
  /** Marktwert am Saisonende (`playerPerformances.marketValue`). */
  marketValueTo: number | null;
  appearances: number | null;
  trainingMode: "leicht" | "mittel" | "hart" | null;
  /** Nur gesetzt, wenn sich die Klasse wirklich geaendert hat. */
  classChange: { from: string; to: string } | null;
};

export type SpotlightNewcomer = {
  playerId: string;
  playerName: string;
  className: string | null;
  marketValue: number | null;
};

export type SaisonSpotlightModel = {
  teamId: string;
  teamName: string;
  /** Die abgeschlossene Saison, auf die zurueckgeblickt wird. */
  seasonIdFrom: string;
  seasonLabelFrom: string;
  /** Die laufende Saison. */
  seasonIdTo: string;
  seasonLabelTo: string;
  rank: number | null;
  teamCount: number | null;
  startRank: number | null;
  /** Positiv = Plaetze gutgemacht. */
  rankDelta: number | null;
  /** Summe ueber ALLE Kader-Spieler mit Ereignis, nicht nur ueber die gezeigten Zeilen. */
  netSetpointsTotal: number;
  classChangeCount: number;
  marketValueGain: number | null;
  /** Hoechstens fuenf, sortiert nach `netSetpoints` absteigend. */
  rows: SpotlightPlayerRow[];
  /** Wie viele trainierte Kader-Spieler die Tabelle nicht zeigt. */
  moreRowCount: number;
  newcomers: SpotlightNewcomer[];
  leagueBestTrainer: { playerName: string; teamName: string | null; netSetpoints: number } | null;
  leagueClassChangeCount: number;
};

export const SPOTLIGHT_MAX_ROWS = 5;

function runde(wert: number, stellen = 2): number {
  return Number(wert.toFixed(stellen));
}

function endlich(wert: unknown): number | null {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

function besteAttributSteigerung(event: PlayerProgressionSpendEventRecord): SpotlightAttributeGain | null {
  let beste: SpotlightAttributeGain | null = null;
  for (const upgrade of event.upgrades ?? []) {
    const von = endlich(upgrade.fromValue);
    const nach = endlich(upgrade.toValue);
    if (von == null || nach == null) continue;
    const delta = runde(nach - von, 2);
    if (delta <= 0) continue;
    if (!beste || delta > beste.delta) {
      beste = {
        attribute: upgrade.attribute,
        label: formatTrainingAttributeLabel(upgrade.attribute),
        fromValue: von,
        toValue: nach,
        delta,
      };
    }
  }
  return beste;
}

function vorherigeSaison(snapshots: SeasonSnapshotRecord[], laufendeSaisonId: string | null): SeasonSnapshotRecord | null {
  const abgeschlossen = [...snapshots]
    .filter((snapshot) => snapshot.seasonId && snapshot.seasonId !== laufendeSaisonId)
    .sort((links, rechts) => links.seasonId.localeCompare(rechts.seasonId, "de", { numeric: true }));
  return abgeschlossen[abgeschlossen.length - 1] ?? null;
}

export interface BuildSaisonSpotlightInput {
  gameState: GameState;
  teamId: string | null | undefined;
  /** Laufende Saison; ohne Angabe wird die letzte archivierte Saison als Rueckblick genommen. */
  currentSeasonId?: string | null;
}

/**
 * Liefert `null`, wenn es nichts Belegtes zu zeigen gibt — keine Vorsaison, kein Team, oder der
 * Kader hat weder ein Trainingsereignis noch einen Neuzugang. Der Block erscheint dann gar nicht,
 * statt mit leeren Kacheln dazustehen.
 */
export function buildSaisonSpotlight(input: BuildSaisonSpotlightInput): SaisonSpotlightModel | null {
  const { gameState, teamId } = input;
  if (!teamId) return null;
  const team = (gameState.teams ?? []).find((eintrag) => eintrag.teamId === teamId);
  if (!team) return null;

  // `seasonState.seasonId` ist die laufende Saison — NICHT `currentSeasonId`, das Feld gibt es
  // nicht. Mit dem falschen Namen lief alles still in den Rueckfall und der Kopf las
  // „Season 1 -> Season 1"; am Save aufgefallen, nicht im Typ.
  const laufendeSaisonId = input.currentSeasonId ?? gameState.seasonState?.seasonId ?? null;
  const snapshot = vorherigeSaison(leseSaisonSchnappschuesse(gameState), laufendeSaisonId);
  if (!snapshot) return null;

  const kader = new Set(
    (gameState.rosters ?? []).filter((eintrag) => eintrag.teamId === teamId).map((eintrag) => eintrag.playerId),
  );
  if (kader.size === 0) return null;

  const ereignisseDerSaison = (gameState.playerProgressionEvents ?? []).filter(
    (event) => event.seasonId === snapshot.seasonId && event.organicMeta,
  );
  const meineEreignisse = ereignisseDerSaison.filter(
    (event) => event.teamId === teamId && kader.has(event.playerId),
  );

  const leistungNachId = new Map<string, SeasonSnapshotPlayerPerformanceRecord>(
    (snapshot.playerPerformances ?? []).map((eintrag) => [eintrag.playerId, eintrag]),
  );
  const spielerNachId = new Map((gameState.players ?? []).map((spieler) => [spieler.id, spieler]));

  const alleZeilen: SpotlightPlayerRow[] = meineEreignisse.map((event) => {
    const leistung = leistungNachId.get(event.playerId);
    const meta = event.organicMeta!;
    const klasseVorher = meta.classBefore;
    const klasseNachher = meta.classAfter;
    return {
      playerId: event.playerId,
      playerName: spielerNachId.get(event.playerId)?.name ?? leistung?.playerName ?? event.playerId,
      netSetpoints: runde(endlich(meta.netSetpoints) ?? 0, 2),
      bestAttribute: besteAttributSteigerung(event),
      marketValueFrom: endlich(leistung?.purchasePrice),
      marketValueTo: endlich(leistung?.marketValue),
      appearances: endlich(leistung?.appearances),
      trainingMode: meta.trainingMode ?? null,
      classChange:
        klasseVorher && klasseNachher && klasseVorher !== klasseNachher
          ? { from: klasseVorher, to: klasseNachher }
          : null,
    };
  });
  alleZeilen.sort((links, rechts) => rechts.netSetpoints - links.netSetpoints);

  const neuzugaenge: SpotlightNewcomer[] = [...kader]
    .filter((playerId) => !meineEreignisse.some((event) => event.playerId === playerId))
    .map((playerId) => {
      const spieler = spielerNachId.get(playerId);
      return {
        playerId,
        playerName: spieler?.name ?? playerId,
        className: (spieler as { className?: string | null } | undefined)?.className ?? null,
        marketValue: endlich(spieler?.marketValue),
      };
    })
    .sort((links, rechts) => (rechts.marketValue ?? 0) - (links.marketValue ?? 0));

  if (alleZeilen.length === 0 && neuzugaenge.length === 0) return null;

  const teamStand = (snapshot.teamSnapshots ?? []).find((eintrag) => eintrag.teamId === teamId);

  // Marktwert-Zuwachs nur ueber Spieler, bei denen BEIDE Enden bekannt sind — sonst waere die
  // Summe eine Mischung aus echten Deltas und stillschweigenden Nullen.
  const mitBeidenEnden = alleZeilen.filter(
    (zeile) => zeile.marketValueFrom != null && zeile.marketValueTo != null,
  );
  const marktwertZuwachs = mitBeidenEnden.length
    ? runde(
        mitBeidenEnden.reduce((summe, zeile) => summe + (zeile.marketValueTo! - zeile.marketValueFrom!), 0),
        2,
      )
    : null;

  const bester = [...ereignisseDerSaison].sort(
    (links, rechts) => (rechts.organicMeta?.netSetpoints ?? 0) - (links.organicMeta?.netSetpoints ?? 0),
  )[0];

  return {
    teamId,
    teamName: team.name ?? teamId,
    seasonIdFrom: snapshot.seasonId,
    seasonLabelFrom: getCanonicalSeasonLabel({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName ?? null }),
    seasonIdTo: laufendeSaisonId ?? snapshot.seasonId,
    seasonLabelTo: laufendeSaisonId
      ? getCanonicalSeasonLabel({ seasonId: laufendeSaisonId })
      : getCanonicalSeasonLabel({ seasonId: snapshot.seasonId }),
    rank: endlich(teamStand?.rank),
    teamCount: (snapshot.teamSnapshots ?? []).length || null,
    startRank: endlich(teamStand?.startplatz),
    rankDelta: endlich(teamStand?.rankDiff),
    netSetpointsTotal: runde(
      alleZeilen.reduce((summe, zeile) => summe + zeile.netSetpoints, 0),
      2,
    ),
    classChangeCount: alleZeilen.filter((zeile) => zeile.classChange).length,
    marketValueGain: marktwertZuwachs,
    rows: alleZeilen.slice(0, SPOTLIGHT_MAX_ROWS),
    moreRowCount: Math.max(0, alleZeilen.length - SPOTLIGHT_MAX_ROWS),
    newcomers: neuzugaenge,
    leagueBestTrainer: bester?.organicMeta
      ? {
          playerName: spielerNachId.get(bester.playerId)?.name ?? bester.playerId,
          teamName: (gameState.teams ?? []).find((eintrag) => eintrag.teamId === bester.teamId)?.name ?? null,
          netSetpoints: runde(bester.organicMeta.netSetpoints ?? 0, 2),
        }
      : null,
    leagueClassChangeCount: ereignisseDerSaison.filter(
      (event) => event.organicMeta && event.organicMeta.classBefore !== event.organicMeta.classAfter,
    ).length,
  };
}
