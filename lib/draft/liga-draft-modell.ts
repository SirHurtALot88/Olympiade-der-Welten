/**
 * LIGA-DRAFT IM EINZELSCHRITT — die Regeln als reine Funktionen (Draft-Neubau, Stufe Kern, 18.11.).
 *
 * Konzept und Mockup: docs/design/draft-modern-18-11.md, public/mockups/draft-modern-18-11.html; Bau und Schnittstelle:
 * docs/design/draft-neubau-kern-18-11.md. Chris' Regeln (18.11. abends):
 *  - Jede Runde beginnt beim SCHWAECHSTEN Team (keine Schlange, kein Los). Schwaeche = Kaderstaerke ueber die besten
 *    sechs je Disziplin, gemittelt ueber alle Disziplinen (dieselbe Formel wie `transfermarkt-kaderstaerke.ts`).
 *    Gleichstand (in Runde 1 sind alle Kader leer): weniger Kasse zuerst, danach die Saat.
 *  - Hoechstens 16 Runden, hoechstens 14 Picks je Team; ein Team darf einen Pick AUSLASSEN.
 *  - Der Draft wartet auf Menschen (keine Uhr); Auto-Pick je Mensch einschaltbar.
 *
 * Nichts hier liest die Ablage oder kauft — das macht `liga-draft-dienst.ts`. Diese Datei rechnet nur: wer ist dran, wie
 * sieht die naechste Runde aus, was aendert ein Eintrag am Zustand.
 */
import type {
  GameState,
  LigaDraftEintrag,
  LigaDraftFertigGrund,
  LigaDraftTeamZustand,
  LigaDraftZustand,
} from "@/lib/data/olyDataTypes";
import { draftUnit } from "@/lib/ai/market-pick-engine/slot-sequence";
import { berechneStaerke } from "@/lib/market/transfermarkt-kaderstaerke";

export const LIGA_DRAFT_MAX_RUNDEN = 16;
export const LIGA_DRAFT_MAX_PICKS_JE_TEAM = 14;
export const LIGA_DRAFT_MIN_KADER = 8;

/** Kaderstaerke eines Teams: Ø ueber alle Disziplinen der besten-sechs-Staerke (fehlende Plaetze zaehlen mit 20). */
export function kaderStaerkeFuerReihenfolge(gameState: Pick<GameState, "rosters" | "players" | "disciplines">, teamId: string): number {
  const disziplinIds = (gameState.disciplines ?? []).map((d) => d.id);
  if (disziplinIds.length === 0) return 0;
  const spielerById = new Map((gameState.players ?? []).map((p) => [p.id, p]));
  const kader = (gameState.rosters ?? [])
    .filter((eintrag) => eintrag.teamId === teamId)
    .map((eintrag) => spielerById.get(eintrag.playerId))
    .filter((spieler): spieler is NonNullable<typeof spieler> => spieler != null);
  let summe = 0;
  for (const disziplinId of disziplinIds) {
    const werte: number[] = [];
    for (const spieler of kader) {
      const wert = spieler.disciplineRatings?.[disziplinId];
      if (typeof wert === "number" && Number.isFinite(wert)) werte.push(wert);
    }
    summe += berechneStaerke(werte);
  }
  return summe / disziplinIds.length;
}

/**
 * Reihenfolge einer Runde: schwaechstes Team zuerst. Gleichstand: weniger Kasse zuerst (das aermere Team gilt als das
 * schwaechere), danach die Saat (reproduzierbar je Spielstand und Runde, kein Math.random).
 */
export function berechneRundenReihenfolge(input: {
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">;
  teamIds: readonly string[];
  seed: string;
  runde: number;
}): string[] {
  const kasse = new Map(input.gameState.teams.map((team) => [team.teamId, team.cash ?? 0]));
  const zeilen = input.teamIds.map((teamId) => ({
    teamId,
    staerke: Math.round(kaderStaerkeFuerReihenfolge(input.gameState, teamId) * 1000) / 1000,
    kasse: kasse.get(teamId) ?? 0,
    los: draftUnit(`${input.seed}:runde-${input.runde}:${teamId}`),
  }));
  zeilen.sort((a, b) => a.staerke - b.staerke || a.kasse - b.kasse || a.los - b.los || a.teamId.localeCompare(b.teamId));
  return zeilen.map((zeile) => zeile.teamId);
}

export function istTeamPickbereit(draft: LigaDraftZustand, teamId: string): boolean {
  const team = draft.teams[teamId];
  return Boolean(team && team.status === "aktiv" && team.picks < draft.regeln.maxPicksJeTeam);
}

export type LigaDraftZug = {
  teamId: string;
  runde: number;
  /** 1-basiert. */
  platz: number;
  /** Pickt der GM (KI-Team oder Mensch mit Auto-Pick) oder wartet der Draft auf einen Menschen? */
  automatisch: boolean;
};

/** Wer ist jetzt dran? `null`, wenn der Draft in der geordneten Phase nichts mehr zu vergeben hat. */
export function werIstDran(draft: LigaDraftZustand): LigaDraftZug | null {
  if (draft.status !== "laeuft") return null;
  for (let index = draft.platz; index < draft.reihenfolge.length; index += 1) {
    const teamId = draft.reihenfolge[index]!;
    if (!istTeamPickbereit(draft, teamId)) continue;
    const team = draft.teams[teamId]!;
    return { teamId, runde: draft.runde, platz: index + 1, automatisch: team.art === "ki" || team.autoPick };
  }
  return null;
}

/** Die naechsten `anzahl` Zuege ab jetzt (laufende Runde, danach die naechste in der heutigen Staerke-Reihenfolge). */
export function naechsteZuege(
  draft: LigaDraftZustand,
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">,
  anzahl: number,
): LigaDraftZug[] {
  const zuege: LigaDraftZug[] = [];
  if (draft.status !== "laeuft") return zuege;
  const sammle = (reihenfolge: readonly string[], ab: number, runde: number) => {
    for (let index = ab; index < reihenfolge.length && zuege.length < anzahl; index += 1) {
      const teamId = reihenfolge[index]!;
      if (!istTeamPickbereit(draft, teamId)) continue;
      const team = draft.teams[teamId]!;
      zuege.push({ teamId, runde, platz: index + 1, automatisch: team.art === "ki" || team.autoPick });
    }
  };
  sammle(draft.reihenfolge, draft.platz, draft.runde);
  if (zuege.length < anzahl && draft.runde < draft.regeln.maxRunden) {
    // Vorschau: die naechste Runde nach heutigem Stand (sie wird beim echten Rundenstart neu berechnet).
    const aktive = Object.values(draft.teams)
      .filter((team) => istTeamPickbereit(draft, team.teamId))
      .map((team) => team.teamId);
    sammle(berechneRundenReihenfolge({ gameState, teamIds: aktive, seed: draft.seed, runde: draft.runde + 1 }), 0, draft.runde + 1);
  }
  return zuege;
}

/** Neuen Zustand anlegen (Runde 1 berechnet). */
export function erzeugeLigaDraft(input: {
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams" | "season">;
  teams: LigaDraftTeamZustand[];
  seed: string;
  jetzt: string;
  regeln?: Partial<LigaDraftZustand["regeln"]>;
}): LigaDraftZustand {
  const regeln = {
    maxRunden: input.regeln?.maxRunden ?? LIGA_DRAFT_MAX_RUNDEN,
    maxPicksJeTeam: input.regeln?.maxPicksJeTeam ?? LIGA_DRAFT_MAX_PICKS_JE_TEAM,
    minKader: input.regeln?.minKader ?? LIGA_DRAFT_MIN_KADER,
  };
  const teams: Record<string, LigaDraftTeamZustand> = {};
  for (const team of input.teams) teams[team.teamId] = team;
  const draft: LigaDraftZustand = {
    version: 1,
    saisonId: input.gameState.season.id,
    status: "laeuft",
    seed: input.seed,
    regeln,
    runde: 0,
    reihenfolge: [],
    platz: 0,
    teams,
    verlauf: [],
    erstelltAm: input.jetzt,
    aktualisiertAm: input.jetzt,
    beendetAm: null,
  };
  return normalisiereZug(draft, input.gameState, input.jetzt);
}

/**
 * Bringt den Zeiger auf das naechste pickbereite Team: ueberspringt fertige/Nachzug-Teams, beginnt bei Rundenende die
 * naechste Runde (neue Reihenfolge nach heutiger Staerke) und schliesst den Draft, wenn nichts mehr zu vergeben ist.
 */
export function normalisiereZug(
  draft: LigaDraftZustand,
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">,
  jetzt: string,
): LigaDraftZustand {
  if (draft.status !== "laeuft") return draft;
  let aktuell = draft;
  for (let schutz = 0; schutz <= aktuell.regeln.maxRunden + 1; schutz += 1) {
    if (aktuell.runde >= 1) {
      let index = aktuell.platz;
      while (index < aktuell.reihenfolge.length && !istTeamPickbereit(aktuell, aktuell.reihenfolge[index]!)) index += 1;
      if (index < aktuell.reihenfolge.length) {
        return index === aktuell.platz ? aktuell : { ...aktuell, platz: index };
      }
    }
    const aktive = Object.values(aktuell.teams)
      .filter((team) => istTeamPickbereit(aktuell, team.teamId))
      .map((team) => team.teamId);
    if (aktive.length === 0 || aktuell.runde >= aktuell.regeln.maxRunden) {
      return beendeGeordnetenTeil(aktuell, jetzt);
    }
    const runde = aktuell.runde + 1;
    aktuell = {
      ...aktuell,
      runde,
      reihenfolge: berechneRundenReihenfolge({ gameState, teamIds: aktive, seed: aktuell.seed, runde }),
      platz: 0,
    };
  }
  return beendeGeordnetenTeil(aktuell, jetzt);
}

/**
 * Ende der geordneten Phase: noch aktive Teams sind fertig („draft_ende“). Gibt es Teams im Nachzug, die noch nicht
 * fertig sind, geht der Draft in den Nachzug, sonst ist er fertig.
 */
function beendeGeordnetenTeil(draft: LigaDraftZustand, jetzt: string): LigaDraftZustand {
  const teams: Record<string, LigaDraftTeamZustand> = {};
  for (const [teamId, team] of Object.entries(draft.teams)) {
    teams[teamId] = team.status === "aktiv" ? { ...team, status: "fertig", fertigGrund: team.fertigGrund ?? "draft_ende" } : team;
  }
  const nachzugOffen = Object.values(teams).some((team) => team.status === "nachzug");
  return {
    ...draft,
    teams,
    status: nachzugOffen ? "nachzug" : "fertig",
    platz: draft.reihenfolge.length,
    aktualisiertAm: jetzt,
    beendetAm: nachzugOffen ? null : jetzt,
  };
}

/** Schliesst den Nachzug, sobald kein Team mehr im Nachzug ist. */
export function pruefeNachzugEnde(draft: LigaDraftZustand, jetzt: string): LigaDraftZustand {
  if (draft.status !== "nachzug") return draft;
  if (Object.values(draft.teams).some((team) => team.status === "nachzug")) return draft;
  return { ...draft, status: "fertig", beendetAm: jetzt, aktualisiertAm: jetzt };
}

function neuerEintrag(
  draft: LigaDraftZustand,
  eintrag: Omit<LigaDraftEintrag, "nr" | "pickNr" | "zeit">,
  jetzt: string,
): LigaDraftEintrag {
  const bisherigePicks = draft.verlauf.filter((e) => e.art === "pick").length;
  return {
    ...eintrag,
    nr: draft.verlauf.length + 1,
    pickNr: eintrag.art === "pick" ? bisherigePicks + 1 : null,
    zeit: jetzt,
  };
}

function mitTeam(draft: LigaDraftZustand, teamId: string, aenderung: Partial<LigaDraftTeamZustand>): LigaDraftZustand {
  const team = draft.teams[teamId];
  if (!team) return draft;
  return { ...draft, teams: { ...draft.teams, [teamId]: { ...team, ...aenderung } } };
}

/** Ein gebuchter Pick (geordnet oder im Nachzug). Fuehrt den Zeiger weiter. */
export function bucheDraftPick(input: {
  draft: LigaDraftZustand;
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">;
  teamId: string;
  playerId: string;
  quelle: LigaDraftEintrag["quelle"];
  abloese: number | null;
  gehalt: number | null;
  transferId: string | null;
  top3: LigaDraftEintrag["top3"];
  grund?: string | null;
  jetzt: string;
}): LigaDraftZustand {
  const { draft, jetzt } = input;
  const team = draft.teams[input.teamId]!;
  const imNachzug = team.status === "nachzug";
  const eintrag = neuerEintrag(
    draft,
    {
      runde: draft.runde,
      platz: imNachzug ? null : draft.platz + 1,
      teamId: input.teamId,
      art: "pick",
      playerId: input.playerId,
      quelle: input.quelle,
      abloese: input.abloese,
      gehalt: input.gehalt,
      transferId: input.transferId,
      top3: input.top3,
      grund: input.grund ?? null,
    },
    jetzt,
  );
  const picks = team.picks + 1;
  let naechster = mitTeam({ ...draft, verlauf: [...draft.verlauf, eintrag], aktualisiertAm: jetzt }, input.teamId, { picks });
  if (picks >= naechster.regeln.maxPicksJeTeam && !imNachzug) {
    naechster = mitTeam(naechster, input.teamId, { status: "fertig", fertigGrund: "max_picks" });
  }
  if (imNachzug) return naechster;
  return normalisiereZug({ ...naechster, platz: draft.platz + 1 }, input.gameState, jetzt);
}

/**
 * Der Mensch am Zug laesst diesen Pick aus — nur solange `darfAuslassen` gilt (Kader aus `gameState.rosters`;
 * `nichtsLeistbar` rechnet der Dienst, der die freien Spieler kennt). Sonst Fehler `auslassen_unter_mindestkader`.
 */
export function bucheAuslassen(input: {
  draft: LigaDraftZustand;
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">;
  teamId: string;
  nichtsLeistbar?: boolean;
  jetzt: string;
}): LigaDraftZustand {
  const { draft, jetzt } = input;
  const team = draft.teams[input.teamId]!;
  const kader = (input.gameState.rosters ?? []).filter((eintrag) => eintrag.teamId === input.teamId).length;
  if (!darfAuslassen(draft, kader, input.nichtsLeistbar)) throw new Error("auslassen_unter_mindestkader");
  const eintrag = neuerEintrag(
    draft,
    {
      runde: draft.runde,
      platz: draft.platz + 1,
      teamId: input.teamId,
      art: "auslassen",
      playerId: null,
      quelle: "mensch",
      abloese: null,
      gehalt: null,
      transferId: null,
      top3: null,
      grund: null,
    },
    jetzt,
  );
  const naechster = mitTeam({ ...draft, verlauf: [...draft.verlauf, eintrag], aktualisiertAm: jetzt }, input.teamId, {
    auslassungen: team.auslassungen + 1,
  });
  return normalisiereZug({ ...naechster, platz: draft.platz + 1 }, input.gameState, jetzt);
}

/** Ein Team hoert auf (KI-Stop, Mensch „Ich bin fertig“, nichts leistbar …). Im Nachzug schliesst das ggf. den Draft. */
export function bucheAusstieg(input: {
  draft: LigaDraftZustand;
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">;
  teamId: string;
  grund: LigaDraftFertigGrund;
  quelle: LigaDraftEintrag["quelle"];
  top3?: LigaDraftEintrag["top3"];
  jetzt: string;
}): LigaDraftZustand {
  const { draft, jetzt } = input;
  const team = draft.teams[input.teamId]!;
  const imNachzug = team.status === "nachzug";
  const amZug = !imNachzug && werIstDran(draft)?.teamId === input.teamId;
  const eintrag = neuerEintrag(
    draft,
    {
      runde: draft.runde,
      platz: amZug ? draft.platz + 1 : null,
      teamId: input.teamId,
      art: "aus",
      playerId: null,
      quelle: input.quelle,
      abloese: null,
      gehalt: null,
      transferId: null,
      top3: input.top3 ?? null,
      grund: input.grund,
    },
    jetzt,
  );
  const naechster = mitTeam({ ...draft, verlauf: [...draft.verlauf, eintrag], aktualisiertAm: jetzt }, input.teamId, {
    status: "fertig",
    fertigGrund: input.grund,
  });
  if (imNachzug) return pruefeNachzugEnde(naechster, jetzt);
  // Wer am Zug aussteigt, gibt den Platz weiter; wer ausserhalb seines Zugs aussteigt, aendert nur seinen Status.
  return normalisiereZug(amZug ? { ...naechster, platz: draft.platz + 1 } : naechster, input.gameState, jetzt);
}

/**
 * Ueberspringen. Variante A: das Team verlaesst die Reihenfolge und pickt nach dem Draft im Nachzug. Variante B: der
 * eigene GM pickt ab jetzt mit (Auto-Pick an), das Team bleibt in der Reihenfolge.
 */
export function bucheUeberspringen(input: {
  draft: LigaDraftZustand;
  gameState: Pick<GameState, "rosters" | "players" | "disciplines" | "teams">;
  teamId: string;
  variante: "A" | "B";
  jetzt: string;
}): LigaDraftZustand {
  const { draft, jetzt } = input;
  const eintrag = neuerEintrag(
    draft,
    {
      runde: draft.runde,
      platz: null,
      teamId: input.teamId,
      art: "ueberspringen",
      playerId: null,
      quelle: "mensch",
      abloese: null,
      gehalt: null,
      transferId: null,
      top3: null,
      grund: `variante_${input.variante}`,
    },
    jetzt,
  );
  const mitEintrag = { ...draft, verlauf: [...draft.verlauf, eintrag], aktualisiertAm: jetzt };
  if (input.variante === "B") {
    return mitTeam(mitEintrag, input.teamId, { autoPick: true });
  }
  return normalisiereZug(mitTeam(mitEintrag, input.teamId, { status: "nachzug" }), input.gameState, jetzt);
}

export function setzeAutoPick(draft: LigaDraftZustand, teamId: string, an: boolean, jetzt: string): LigaDraftZustand {
  return { ...mitTeam(draft, teamId, { autoPick: an }), aktualisiertAm: jetzt };
}

/**
 * Darf ein Mensch diesen Pick auslassen? Auslassen ist je Pick erlaubt, aber nicht bis unter den Mindestkader: nach dem
 * Auslassen muessen die restlichen Runden noch reichen, um auf `minKader` zu kommen (ein Pick je Runde). Ausnahme: es
 * ist nichts mehr leistbar — dann kann das Team ohnehin nicht weiter auffuellen. (Review #1619, A5: kein Draft-Ende mit
 * 0 Spielern durch wiederholtes Auslassen.)
 */
export function darfAuslassen(draft: Pick<LigaDraftZustand, "runde" | "regeln">, kader: number, nichtsLeistbar = false): boolean {
  const fehlend = draft.regeln.minKader - kader;
  if (fehlend <= 0 || nichtsLeistbar) return true;
  const restRunden = draft.regeln.maxRunden - draft.runde;
  return restRunden >= fehlend;
}

/**
 * Bricht den Draft ab (Gastgeber): alle noch aktiven oder im Nachzug stehenden Teams sind fertig (`abgebrochen`), der
 * Draft ist `fertig` und sperrt damit nichts mehr.
 */
export function bricheLigaDraftAb(draft: LigaDraftZustand, jetzt: string): LigaDraftZustand {
  if (draft.status === "fertig") return draft;
  const teams: Record<string, LigaDraftTeamZustand> = {};
  for (const [teamId, team] of Object.entries(draft.teams)) {
    teams[teamId] = team.status === "fertig" ? team : { ...team, status: "fertig", fertigGrund: "abgebrochen" };
  }
  return { ...draft, teams, status: "fertig", platz: draft.reihenfolge.length, aktualisiertAm: jetzt, beendetAm: jetzt };
}

/**
 * Schalter: `OLY_LIGA_DRAFT_MODUS=einzelschritt` startet beim Anlegen einer Liga den neuen Draft statt des alten. Steht
 * hier (und nicht nur im Dienst), damit die Sperren unten ihn ohne den schweren Importgraph des Dienstes lesen.
 */
export function istEinzelschrittDraftAktiv(): boolean {
  return process.env.OLY_LIGA_DRAFT_MODUS === "einzelschritt";
}

/** Der Draft-Zustand der laufenden Saison, falls es einen gibt (egal welcher Status). */
export function ligaDraftDieserSaison(gameState: Pick<GameState, "seasonState" | "season">): LigaDraftZustand | null {
  const draft = gameState.seasonState?.ligaDraft;
  return draft && draft.saisonId === gameState.season?.id ? draft : null;
}

/**
 * „LIGA-DRAFT LAEUFT“ — die eine Frage, an der alle KI-Kaufwege neben dem Draft haengen (Review #1619, A1):
 * Preseason-Lauf (`fuehreKiPreseasonLaufAus`), KI-Kaderlauf (`runAiPicksExecutePreview`, `/api/ai/picks-run`) und
 * Auto-Auffuellen (`/api/ai/roster-fill`). Laeuft = Schalter an UND ein Draft dieser Saison, der noch nicht `fertig` ist
 * (geordnete Phase ODER Nachzug — im Nachzug picken Menschen noch aus dem Rest, da kauft keine KI dazwischen).
 * Schalter aus: immer `false` — ein liegengebliebener Draft sperrt dann nichts (A2).
 */
export function ligaDraftLaeuft(gameState: Pick<GameState, "seasonState" | "season">): boolean {
  if (!istEinzelschrittDraftAktiv()) return false;
  const draft = ligaDraftDieserSaison(gameState);
  return Boolean(draft && draft.status !== "fertig");
}

/** Ein KI-Kaufweg wurde abgelehnt, weil der Liga-Draft laeuft (`ligaDraftLaeuft`). Routen antworten 409 `liga_draft_laeuft`. */
export class LigaDraftLaeuftFehler extends Error {
  readonly code = "liga_draft_laeuft";
  readonly httpStatus = 409;
  constructor() {
    super("liga_draft_laeuft");
    this.name = "LigaDraftLaeuftFehler";
  }
}

/**
 * Sperrt der laufende Draft den freien Markt fuer Menschen? Nur in der geordneten Phase (im Nachzug kauft ein fertiges
 * Team wieder normal ein) und nur mit Schalter an — Schalter aus: ein liegengebliebener Draft sperrt den Markt nicht.
 */
export function ligaDraftSperrtMarktkauf(gameState: Pick<GameState, "seasonState" | "season">): boolean {
  if (!istEinzelschrittDraftAktiv()) return false;
  return ligaDraftDieserSaison(gameState)?.status === "laeuft";
}
