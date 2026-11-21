/**
 * KI-MERKLISTE (Chris, 21.11.: „ja, KI soll eine Merkliste fremder Spieler bekommen"; Runde 2, 21.11.: „KI Teams koennen auch
 * Spieler vom Transfermarkt UND anderen Spielern auf die Liste setzen und wir hatten das Limit ja aufgehoben, nur das Scouting,
 * wie viele parallel aufgedeckt werden von ihren Stats, ist limitiert").
 *
 * Jedes KI-Team fuehrt eine Liste von Spielern, die seine Kaderplanung ankaufen wuerde: FREIE Spieler des Transfermarkts und
 * Spieler ANDERER Teams, nie die eigenen. Es gibt dafuer KEINE eigene Heuristik: bewertet wird mit genau der Funktion, nach der
 * die KI beim Kauf waehlt (`buyUtility`, `lib/ai/organic-squad/utility.ts`), im Zustand des Teams (Kader, Bedarf je Disziplin,
 * Kasse, Forecast, Identitaet und GM-Gewichte aus `buildOrganicDraftFrame`). Ein Spieler kommt nur auf die Liste, wenn
 *   - er nicht zum eigenen Kader gehoert,
 *   - der Kaufnutzen den Stop-Nutzen des Teams uebertrifft (`stopUtility`: „lieber nichts tun" verliert), und
 *   - das Team ihn zahlen koennte (Ablöse <= Kasse und <= freier Investitionstopf des Vorstands).
 * Ohne Zufall: gleiche Eingabe, gleiche Liste (kein Jitter-Saatgut, Gleichstand nach `playerId`).
 *
 * KEIN LISTEN-LIMIT, WIE BEIM MENSCHEN. Die Liste wird nicht auf eine Handvoll gekappt (nur `KI_MERKLISTE_TECHNIK_MAX` als
 * Speicherschutz). Begrenzt ist das SCOUTING: wie viele Spieler parallel gescoutet (ihre Stats aufgedeckt) werden, entscheidet
 * dieselbe Queue wie beim Menschen (`getScoutingWishlistQueue`, `getScoutingWishlistSlotLimit`: die obersten X nicht fertig
 * gescouteten Eintraege). Die KI belegt sie nach Stufe, Wunschziel zuerst (`priorityRank`).
 *
 * EINE WAHRHEIT. Die Liste liegt im selben Speicher wie die des Menschen (`seasonState.transferWishlist`, Eintraege mit
 * `ki`-Zusatz; Scouting-Fortschritt in `scoutIntelByTeamId`), nicht in einer Parallelstruktur. `seasonState.kiMerkliste` ist nur
 * noch Lese-Huelle fuer Spielstaende aus Runde 1 und wird bei der ersten Neuberechnung uebernommen und entfernt.
 *
 * WIRKUNG AUF KAEUFE: keine. Die KI-Kaufentscheidung ist unveraendert; damit der gemeinsame Speicher das nicht verschiebt,
 * zaehlen Eintraege aus der KI-Merkliste in `ai-market-plan-apply-service.ts` weder als „Watch"-Bonus noch als Scouting-Intel
 * (siehe `docs/design/ki-merkliste-21-11.md`).
 *
 * Neu berechnet beim Spieltagsabschluss (`aktualisiereKiMerkliste`).
 */
import { buildOrganicDraftFrame } from "@/lib/ai/organic-squad/draft-adapter";
import { buildStepTeamState, createOrganicPlanStepState } from "@/lib/ai/organic-squad/draft-builder";
import { SOLIDE_THRESHOLD } from "@/lib/ai/organic-squad/types";
import { buyUtility, stopUtility } from "@/lib/ai/organic-squad/utility";
import type { GameState, KiMerklisteEintrag, KiMerklisteStufe, Player, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import { KI_MERKLISTE_STUFEN_AB, KI_MERKLISTE_TECHNIK_MAX, kiMerklisteFuerTeam } from "@/lib/ai/ki-merkliste-lesen";
import { refreshScoutPipeline } from "@/lib/scouting/facility-scout-pipeline-service";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";

export function istKiTeam(gameState: GameState, teamId: string): boolean {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return false;
  const modus = getTeamControlSettings(gameState, teamId)?.controlMode ?? (team.humanControlled ? "manual" : "ai");
  return modus === "ai";
}

function stufeFuer(vorsprung: number, bester: number): KiMerklisteStufe {
  const anteil = bester > 0 ? vorsprung / bester : 0;
  return (KI_MERKLISTE_STUFEN_AB.find((zeile) => anteil >= zeile.anteil) ?? KI_MERKLISTE_STUFEN_AB[KI_MERKLISTE_STUFEN_AB.length - 1]!).stufe;
}

/**
 * Die Merkliste EINES Teams, frisch gerechnet (rein, schreibt nichts), absteigend nach Vorsprung. `vorher` traegt `seit` fort, wenn der Spieler schon
 * auf der alten Liste stand.
 */
export function berechneKiMerklisteFuerTeam(
  gameState: GameState,
  teamId: string,
  vorher: readonly KiMerklisteEintrag[] = [],
): KiMerklisteEintrag[] {
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  if (!team) return [];
  // Kandidaten: alle Spieler, die nicht zum eigenen Kader gehoeren — Spieler anderer Teams UND freie Spieler des Marktes.
  const besitzerJeSpieler = new Map<string, string>();
  const eigene = new Set<string>();
  for (const eintrag of gameState.rosters) {
    if (eintrag.teamId === teamId) eigene.add(eintrag.playerId);
    else besitzerJeSpieler.set(eintrag.playerId, eintrag.teamId);
  }
  const startkader: Player[] = [];
  const kandidaten: Player[] = [];
  for (const spieler of gameState.players) {
    if (eigene.has(spieler.id)) startkader.push(spieler);
    else kandidaten.push(spieler);
  }
  if (kandidaten.length === 0) return [];

  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  // Ohne draftSeed: kein Jitter, die Liste ist reine Funktion des Spielstands.
  const frame = buildOrganicDraftFrame({ gameState, team, identity, startingSquad: startkader, candidates: kandidaten, draftSeed: null });
  const planInput = frame.planInput;
  const zustand = buildStepTeamState(planInput, createOrganicPlanStepState(planInput));
  const stopp = stopUtility(zustand);
  const kasse = planInput.economy.cash;
  const topf = planInput.economy.feeCap;

  const bewertet = planInput.candidates
    .filter((kandidat) => kandidat.marketValue <= kasse && (topf == null || kandidat.marketValue <= topf))
    .map((kandidat) => ({ kandidat, vorsprung: buyUtility(kandidat, zustand) - stopp }))
    .filter((zeile) => zeile.vorsprung > 0)
    .sort((a, b) => b.vorsprung - a.vorsprung || (a.kandidat.playerId < b.kandidat.playerId ? -1 : 1))
    .slice(0, KI_MERKLISTE_TECHNIK_MAX);
  if (bewertet.length === 0) return [];

  const bester = bewertet[0]!.vorsprung;
  const vorherJeSpieler = new Map(vorher.map((eintrag) => [eintrag.playerId, eintrag] as const));
  const matchdayId = gameState.matchdayState?.matchdayId ?? null;
  return bewertet.map(({ kandidat, vorsprung }) => {
    // Grund: die Disziplin, in der der Spieler dem Team am meisten bringt (Bedarf x Wert ueber der Solide-Schwelle).
    let besteDisziplin: string | null = null;
    let besterWert = 0;
    let abgedeckt = 0;
    for (const need of zustand.disciplineNeeds) {
      const wert = kandidat.disciplineRatings[need.disciplineId] ?? 0;
      if (wert <= SOLIDE_THRESHOLD) continue;
      const punkte = need.needWeight * wert;
      if (punkte > besterWert) {
        besterWert = punkte;
        besteDisziplin = need.disciplineId;
        abgedeckt = need.coveredCount;
      }
    }
    return {
      playerId: kandidat.playerId,
      besitzerTeamId: besitzerJeSpieler.get(kandidat.playerId) ?? null,
      stufe: stufeFuer(vorsprung, bester),
      vorsprung: Math.round(vorsprung * 1000) / 1000,
      disziplinId: besteDisziplin,
      abgedeckt,
      seit: vorherJeSpieler.get(kandidat.playerId)?.seit ?? matchdayId,
      stand: matchdayId,
    };
  });
}

function wunschEintrag(
  gameState: GameState,
  spielerJeId: ReadonlyMap<string, Player>,
  saveId: string,
  teamId: string,
  eintrag: KiMerklisteEintrag,
  rang: number,
  createdAt: string,
): TransferWishlistEntry {
  const { playerId, ...meta } = eintrag;
  const spieler = spielerJeId.get(playerId);
  return {
    id: `ki-wunsch-${teamId}-${playerId}`,
    saveId,
    seasonId: gameState.season.id,
    playerId,
    playerName: spieler?.name ?? playerId,
    className: spieler?.className ?? "",
    race: spieler?.race ?? "",
    marketValue: spieler?.marketValue ?? null,
    salary: spieler?.salaryDemand ?? null,
    bracket: null,
    teamId,
    createdAt,
    priorityRank: rang,
    ki: meta,
  };
}

/**
 * Rechnet die Merkliste aller KI-Teams neu und schreibt sie in die Wunschliste des Teams (`seasonState.transferWishlist`,
 * Eintraege mit `ki`; Reihenfolge = `priorityRank` = Stufe, dann Vorsprung), danach rechnet `refreshScoutPipeline` die
 * Scouting-Plaetze des Teams neu — genau der Weg, den auch der Mensch nimmt. Aufgerufen beim Spieltagsabschluss;
 * `OLY_KI_MERKLISTE=0` schaltet ab (dann bleibt der Spielstand unveraendert). Menschlich gefuehrte Teams bekommen keine Liste,
 * ihre Eintraege bleiben unberuehrt. Eintraege, die ein KI-Team selbst (ohne `ki`) auf seiner Wunschliste hat, gehen vor.
 */
export function aktualisiereKiMerkliste(gameState: GameState, saveId: string = "ki-merkliste"): GameState {
  if (process.env.OLY_KI_MERKLISTE === "0") return gameState;
  const vorhanden = gameState.seasonState.transferWishlist ?? [];
  const eigeneEintraege = vorhanden.filter((zeile) => !zeile.ki);
  const kiTeams = gameState.teams.filter((team) => istKiTeam(gameState, team.teamId));
  const createdAtJeSchluessel = new Map<string, string>();
  for (const zeile of vorhanden) if (zeile.ki && zeile.teamId) createdAtJeSchluessel.set(`${zeile.teamId}|${zeile.playerId}`, zeile.createdAt);
  const jetzt = new Date().toISOString();
  const spielerJeId = new Map<string, Player>(gameState.players.map((spieler) => [spieler.id, spieler]));

  const neueZeilen: TransferWishlistEntry[] = [];
  for (const team of kiTeams) {
    // Vorher: neue Form, sonst die Lese-Huelle aus Runde 1 — fuer `seit`.
    const vorher = kiMerklisteFuerTeam(gameState, team.teamId);
    const liste = berechneKiMerklisteFuerTeam(gameState, team.teamId, vorher);
    const handPlaetze = eigeneEintraege.filter((zeile) => zeile.teamId === team.teamId);
    const handSpieler = new Set(handPlaetze.map((zeile) => zeile.playerId));
    const ersterRang = handPlaetze.reduce((max, zeile) => Math.max(max, (zeile.priorityRank ?? -1) + 1), 0);
    // Reihenfolge: Stufe (Wunschziel zuerst), dann Vorsprung, dann Kennung — das ist die Reihenfolge der Scouting-Queue.
    const geordnet = liste
      .filter((eintrag) => !handSpieler.has(eintrag.playerId))
      .sort((a, b) => b.stufe - a.stufe || b.vorsprung - a.vorsprung || (a.playerId < b.playerId ? -1 : 1));
    geordnet.forEach((eintrag, index) => {
      neueZeilen.push(wunschEintrag(gameState, spielerJeId, saveId, team.teamId, eintrag, ersterRang + index, createdAtJeSchluessel.get(`${team.teamId}|${eintrag.playerId}`) ?? jetzt));
    });
  }

  const { kiMerkliste: _alteForm, ...seasonStateOhneHuelle } = gameState.seasonState;
  void _alteForm;
  let naechster: GameState = {
    ...gameState,
    seasonState: {
      ...seasonStateOhneHuelle,
      transferWishlist: [...eigeneEintraege, ...neueZeilen],
      kiMerklisteStand: { seasonId: gameState.season.id, matchdayId: gameState.matchdayState?.matchdayId ?? null },
    },
  };
  for (const team of kiTeams) naechster = refreshScoutPipeline(naechster, team.teamId);
  return naechster;
}
