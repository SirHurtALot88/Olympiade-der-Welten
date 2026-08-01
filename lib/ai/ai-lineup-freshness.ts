/**
 * IST EINE VORGEPLANTE KI-AUFSTELLUNG FUER DIESEN SPIELTAG NOCH GUELTIG?
 *
 * Die KI plant vorab. Das ist so gewollt — eine grobe Vorausplanung spart Rechenzeit und macht die
 * Arena-Vorschau stabil. Sie reagiert dabei aber NICHT dynamisch: Zwischen dem Aufstellen und dem
 * Spieltag vergeht Zeit, und in dieser Zeit aendert sich der Kader. Ein Spieler verletzt sich, ein
 * anderer laeuft in die Fatigue. Der Plan weiss davon nichts.
 *
 * WAS DAS ANGERICHTET HAT (Meldung 32k3rk, Save `new-game-1785476771457-e4yvyl`, Saison 1 / MD1):
 * Zwei KI-Teams (H-R, P-C) hatten je einen verletzten Spieler in ihrer bereits abgegebenen
 * Aufstellung. Beim Aufloesen fiel der Verletzte heraus, die Disziplin stand bei 2 von 3 Plaetzen,
 * die Ergebniszeile bekam `invalid_lineup` — und der Standings-Apply verweigerte daraufhin die
 * Uebernahme des GESAMTEN Spieltags. Der Spieltag war damit nicht mehr abschliessbar, und auf dem
 * Bildschirm stand nur "Standings Apply fehlt noch fuer diesen Spieltag". Zwei KI-Teams haben die
 * ganze Liga blockiert, wegen einer Verletzung.
 *
 * Der Ausloeser fuer die Nachpruefung ist bewusst das SPEICHERN der Spieler-Aufstellung
 * (`app/api/lineups/legacy/route.ts`): Dort geben die KI-Teams ohnehin ab, dort steht das Feld fest,
 * und dort ist der letzte Moment, in dem eine Korrektur noch etwas aendert. Danach wird gerechnet.
 *
 * Diese Datei entscheidet NUR, ob ein vorhandener Entwurf noch zum aktuellen Kaderzustand passt.
 * Sie stellt selbst nichts auf und waehlt keine Ersatzspieler aus — das macht die bestehende
 * KI-Aufstellung, die anschliessend regulaer neu laeuft. Die Trennung ist Absicht: Wer entscheidet,
 * OB neu gerechnet wird, soll nicht zugleich entscheiden, WAS herauskommt.
 *
 * Die Fatigue-Schwelle ist NICHT hier erfunden, sondern die bereits kalibrierte Schoner-Schwelle aus
 * `lib/fatigue/fatigue-rest-propensity.ts` — kaderabhaengig, weil ein duenner Kader frueher schont
 * als einer mit Ersatzbank. Damit sagt die Nachpruefung dasselbe wie der Rest des Spiels: Ab dieser
 * Fatigue gehoert der Spieler eigentlich geschont.
 */
import { resolveFatigueRestFloor } from "@/lib/fatigue/fatigue-rest-propensity";

/** Warum ein vorgeplanter Entwurf nicht mehr passt. */
export type StaleAiLineupReason =
  /** Verletzt / nicht einsatzfaehig — faellt beim Aufloesen heraus und reisst ein Loch. */
  | "player_unavailable"
  /** Ueber der kaderabhaengigen Schoner-Schwelle — spielt geschwaecht, gehoert rotiert. */
  | "player_over_rest_floor";

export type StaleAiLineupFinding = {
  playerId: string;
  reason: StaleAiLineupReason;
  fatigue: number | null;
};

type FreshnessPlayer = {
  id: string;
  fatigue?: number | null;
  injuryStatus?: "healthy" | "injured" | "recovering" | null;
  availabilityBlocker?: "player_injured_unavailable" | null;
};

/**
 * Nicht einsatzfaehig heisst: faellt beim Aufloesen tatsaechlich heraus. `recovering` zaehlt
 * bewusst NICHT dazu — wer zurueck ist, darf spielen; ihn auszutauschen waere eine
 * Leistungsentscheidung, keine Verfuegbarkeitsfrage.
 */
function isUnavailable(player: FreshnessPlayer): boolean {
  return player.availabilityBlocker === "player_injured_unavailable" || player.injuryStatus === "injured";
}

/**
 * Findet die Spieler eines vorhandenen Entwurfs, die nicht mehr passen.
 *
 * Leeres Ergebnis = der Entwurf darf unangetastet bleiben. Das ist der haeufige Fall, und er ist
 * billig: Es wird nur ueber die aufgestellten Spieler gelaufen, keine Aufstellung gerechnet.
 *
 * `rosterSize` bestimmt die Fatigue-Schwelle (duenner Kader schont frueher). Fehlt die Kadergroesse,
 * faellt die Funktion auf die Anzahl der uebergebenen Kaderspieler zurueck.
 */
export function findStaleAiLineupEntries(input: {
  entryPlayerIds: readonly string[];
  rosterPlayers: readonly FreshnessPlayer[];
  rosterSize?: number;
  startingSlots?: number;
}): StaleAiLineupFinding[] {
  if (input.entryPlayerIds.length === 0) return [];

  const byId = new Map<string, FreshnessPlayer>();
  for (const player of input.rosterPlayers) {
    if (player?.id) byId.set(player.id, player);
  }

  const restFloor = resolveFatigueRestFloor({
    rosterSize: input.rosterSize ?? input.rosterPlayers.length,
    startingSlots: input.startingSlots,
  });

  const findings: StaleAiLineupFinding[] = [];
  const seen = new Set<string>();

  for (const playerId of input.entryPlayerIds) {
    if (!playerId || seen.has(playerId)) continue;
    seen.add(playerId);

    const player = byId.get(playerId);
    // Ein aufgestellter Spieler, der gar nicht mehr im Kader ist (verkauft, Vertrag aus), reisst
    // dasselbe Loch wie ein verletzter. Unbekannt heisst hier deshalb: nicht mehr einsetzbar.
    if (player == null) {
      findings.push({ playerId, reason: "player_unavailable", fatigue: null });
      continue;
    }

    const fatigue = typeof player.fatigue === "number" && Number.isFinite(player.fatigue) ? player.fatigue : null;

    if (isUnavailable(player)) {
      findings.push({ playerId, reason: "player_unavailable", fatigue });
      continue;
    }

    if (fatigue != null && fatigue >= restFloor) {
      findings.push({ playerId, reason: "player_over_rest_floor", fatigue });
    }
  }

  return findings;
}

/** Kurzform fuer die Stelle, die nur wissen muss: neu rechnen, ja oder nein? */
export function isAiLineupDraftStale(input: Parameters<typeof findStaleAiLineupEntries>[0]): boolean {
  return findStaleAiLineupEntries(input).length > 0;
}

/**
 * DARF EIN VORHANDENER ENTWURF UEBERSPRUNGEN WERDEN?
 *
 * Diese Bedingung steht im Batch an ZWEI Stellen — einmal vor der Generierung (billig, spart die
 * Rechenzeit) und einmal nach der Validierung (verwirft das Ergebnis). Sie muessen dieselbe Antwort
 * geben: Wird nur das erste Tor geoeffnet, rechnet der Batch die Aufstellung zwar neu, verwirft sie
 * am zweiten aber wieder — der Fehler bliebe bestehen, nur teurer. Wird nur das zweite geoeffnet,
 * wird jedes Mal umsonst gerechnet.
 *
 * Deshalb liegt die Regel hier als EINE Funktion und nicht zweimal als Ausdruck. Genau diese
 * Verdopplung war der Grund, warum die Frischepruefung beim ersten Anlauf wirkungslos geblieben
 * waere.
 */
export function shouldSkipExistingAiDraft(input: {
  hasCompleteExistingDraft: boolean;
  overwriteExisting: boolean;
  staleFindingCount: number;
}): boolean {
  return input.hasCompleteExistingDraft && !input.overwriteExisting && input.staleFindingCount === 0;
}
