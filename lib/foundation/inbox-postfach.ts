/**
 * POSTFACH-MODELL (Chris, 21.11.): macht aus den Meldungen des Spiels (`buildGameInboxItems`) die Anordnung des Mockups
 * `public/mockups/inbox-modern-21-11.html`: zwei Bahnen (Handeln | Info), Absender, Gelesen je Manager, Ordner, Sortierung.
 *
 * Reine Funktionen ohne React. Die Zuordnung zu den Bahnen bleibt in `inbox-lanes.ts` („Handeln ≠ Wissen“); hier steht nur,
 * wie die drei Räume auf zwei Bahnen fallen (Info = „Im Blick behalten“ + „Berichte“) und was den Spieltag aufhält.
 */
import type { DelegationBereich, GameInboxItem, GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { istMeldungUngelesen } from "@/lib/foundation/inbox-gelesen";
import { resolveInboxLane } from "@/lib/foundation/inbox-lanes";
import { DELEGATION_STUFE_LABEL, isBereichDelegiert, resolveTeamDelegation } from "@/lib/foundation/team-delegation";
import { getTrainingModeDemandTerms } from "@/lib/training/training-mode-demand-service";
import { FATIGUE_LOAD_BY_MODE, getTrainingSetpointsJeSpieltag } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export type PostfachAbsenderId =
  | "kabine"
  | "teamarzt"
  | "vorstand"
  | "sponsor"
  | "markt"
  | "vertrag"
  | "spieltag"
  | "gebaeude";

export const POSTFACH_ABSENDER: ReadonlyArray<{ id: PostfachAbsenderId; label: string; kurz: string }> = [
  { id: "kabine", label: "Kabine", kurz: "Kabine" },
  { id: "teamarzt", label: "Teamarzt", kurz: "Teamarzt" },
  { id: "vorstand", label: "Vorstand", kurz: "Vorstand" },
  { id: "sponsor", label: "Sponsor", kurz: "Sponsor" },
  { id: "markt", label: "Markt & Scouting", kurz: "Markt & Scouting" },
  { id: "vertrag", label: "Verträge", kurz: "Verträge" },
  { id: "spieltag", label: "Liga & Spieltag", kurz: "Liga & Spieltag" },
  { id: "gebaeude", label: "Gebäude", kurz: "Gebäude" },
];

const KABINE_QUELLEN = new Set(["player_training_wish", "player_training_mode", "moral_gekippt", "contract_dissolution_offer", "team_captain_missing", "team_captain_upgrade"]);
const VORSTAND_QUELLEN = new Set(["team_season_objectives", "vorstand_freigabe", "facility_finance_forecast"]);
const VERTRAG_QUELLEN = new Set(["roster_contracts", "roster_value_contract_cash"]);
const MARKT_QUELLEN = new Set(["scout_intel_pipeline", "roster_cash_transfer_window", "transfer_history"]);

/** Wer „schreibt“ diese Meldung. Rein aus Quelle und Kategorie, kein neues Datum. */
export function absenderFuerMeldung(item: GameInboxItem): PostfachAbsenderId {
  const quelle = item.source;
  if (quelle.startsWith("player_health_") || quelle === "player_return") return "teamarzt";
  if (KABINE_QUELLEN.has(quelle) || quelle.startsWith("story:player_")) return "kabine";
  if (VORSTAND_QUELLEN.has(quelle) || item.itemId.startsWith("board_objective")) return "vorstand";
  if (quelle.startsWith("sponsor")) return "sponsor";
  if (VERTRAG_QUELLEN.has(quelle)) return "vertrag";
  if (MARKT_QUELLEN.has(quelle)) return "markt";
  if (quelle.startsWith("facility")) return "gebaeude";
  switch (item.category) {
    case "finance":
      return "vorstand";
    case "facility":
      return "gebaeude";
    case "contract":
      return "vertrag";
    case "sponsor":
      return "sponsor";
    case "transfer":
      return "markt";
    case "training":
      return "kabine";
    default:
      return "spieltag";
  }
}

export type PostfachBahn = "handeln" | "info";
export type PostfachAbschnitt = "haelt" | "vorher" | "blick" | "bericht";

/** Hält diese Meldung den Spieltag auf? Nur offene, kritische Handeln-Meldungen; Trainingswünsche nie (Entscheidung 5). */
export function haeltSpieltagAuf(item: GameInboxItem): boolean {
  if (item.status !== "open") return false;
  if (item.source === "player_training_wish") return false;
  return resolveInboxLane(item) === "act" && item.severity === "critical";
}

/**
 * Welcher Bereich der Delegation steht hinter dieser Meldung? Nur Bereiche, die die KI wirklich selbst erledigt (Einsatzliste,
 * Training, Sponsor). Käufe/Verträge bleiben beim Menschen auch in der Halbautomatik und kommen hier nicht vor.
 */
export function delegierterBereichFuerMeldung(item: GameInboxItem): DelegationBereich | null {
  const id = item.itemId;
  if (id.startsWith("lineup_missing:") || id.startsWith("lineup_not_submitted:") || id.startsWith("formcards_open:") || id.startsWith("formcards_negative_open:")) {
    return "einsatzliste";
  }
  if (id.startsWith("sponsor_choice_missing:")) return "sponsor";
  if (id.startsWith("training_missing:") || item.source === "player_training_wish" || item.source === "player_training_mode") return "training";
  return null;
}

/** Erledigt die KI diese Meldung für das Team? (Mensch überschreibt: ein selbst trainierter Spieler bleibt Sache des Menschen.) */
export function istVonKiUebernommen(item: GameInboxItem, settings: TeamControlSettings | null | undefined): boolean {
  if (item.status !== "open" || !item.teamId) return false;
  const bereich = delegierterBereichFuerMeldung(item);
  if (!bereich || !isBereichDelegiert(settings, bereich)) return false;
  if (bereich === "training" && item.playerId && resolveTeamDelegation(settings).trainingSelbstSpielerIds.includes(item.playerId)) {
    return false;
  }
  return true;
}

export type PostfachEintrag = {
  item: GameInboxItem;
  absender: PostfachAbsenderId;
  bahn: PostfachBahn;
  abschnitt: PostfachAbschnitt;
  ungelesen: boolean;
  haelt: boolean;
  /** Aus einem an die KI delegierten Bereich: erscheint als Bericht „KI hat erledigt“ (Entscheidung 7). */
  kiErledigt: boolean;
};

export type PostfachOrdner = "post" | "erledigt";
export type PostfachSortierung = "dring" | "neu" | "absender";

export type PostfachZaehler = {
  /** Ungelesen im Posteingang dieses Teams. */
  ungelesen: number;
  handeln: number;
  haelt: number;
  info: number;
  posteingang: number;
  erledigt: number;
};

export type PostfachModell = {
  haelt: PostfachEintrag[];
  vorher: PostfachEintrag[];
  blick: PostfachEintrag[];
  bericht: PostfachEintrag[];
  zaehler: PostfachZaehler;
  /** Zahl je Absender im gewählten Ordner (vor dem Absender-Filter). */
  jeAbsender: Record<PostfachAbsenderId, number>;
  alle: PostfachEintrag[];
};

export type PostfachEingabe = {
  items: GameInboxItem[];
  gelesen: ReadonlySet<string>;
  settings?: TeamControlSettings | null;
  ordner: PostfachOrdner;
  absender: PostfachAbsenderId | "alle";
  sortierung: PostfachSortierung;
  nurUngelesen: boolean;
};

function eintragFuer(item: GameInboxItem, gelesen: ReadonlySet<string>, settings: TeamControlSettings | null | undefined): PostfachEintrag {
  const kiErledigt = istVonKiUebernommen(item, settings);
  // Erledigtes verlangt nichts mehr: für die Bahn zählt, was es als offene Meldung gewesen wäre.
  const lane = resolveInboxLane({ ...item, status: "open" });
  const haelt = !kiErledigt && haeltSpieltagAuf(item);
  let bahn: PostfachBahn = lane === "act" ? "handeln" : "info";
  let abschnitt: PostfachAbschnitt = lane === "act" ? (haelt ? "haelt" : "vorher") : lane === "report" ? "bericht" : "blick";
  if (kiErledigt) {
    bahn = "info";
    abschnitt = "bericht";
  }
  return {
    item,
    absender: absenderFuerMeldung(item),
    bahn,
    abschnitt,
    ungelesen: istMeldungUngelesen(item, gelesen),
    haelt,
    kiErledigt,
  };
}

function matchdayNummer(item: GameInboxItem): number {
  const treffer = /(\d+)\s*$/.exec(String(item.matchday ?? ""));
  return treffer ? Number(treffer[1]) : 0;
}

function sortiere(liste: PostfachEintrag[], modus: PostfachSortierung): PostfachEintrag[] {
  const kopie = [...liste];
  if (modus === "neu") {
    return kopie.sort(
      (a, b) => matchdayNummer(b.item) - matchdayNummer(a.item) || Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt),
    );
  }
  if (modus === "absender") {
    const reihenfolge = new Map(POSTFACH_ABSENDER.map((eintrag, index) => [eintrag.id, index] as const));
    return kopie.sort((a, b) => (reihenfolge.get(a.absender) ?? 99) - (reihenfolge.get(b.absender) ?? 99));
  }
  // „Dringend“: die Reihenfolge des Dienstes (Schwere, dann Zeit). Bewusst NICHT „Ungelesenes zuerst“: Lesen darf die Liste nicht
  // umsortieren, sonst springt die gewählte Meldung unter dem Zeiger weg.
  return kopie;
}

/** Das ganze Postfach eines Teams. `items` sind schon die Meldungen dieses Teams (Besitz prüft der Aufrufer). */
export function baueModell(eingabe: PostfachEingabe): PostfachModell {
  const alleEintraege = eingabe.items.map((item) => eintragFuer(item, eingabe.gelesen, eingabe.settings));
  const offen = alleEintraege.filter((eintrag) => eintrag.item.status === "open");
  const erledigt = alleEintraege.filter((eintrag) => eintrag.item.status !== "open");
  const imOrdner = eingabe.ordner === "post" ? offen : erledigt;

  const jeAbsender = Object.fromEntries(POSTFACH_ABSENDER.map((a) => [a.id, 0])) as Record<PostfachAbsenderId, number>;
  for (const eintrag of imOrdner) jeAbsender[eintrag.absender] += 1;

  const sichtbar = imOrdner.filter(
    (eintrag) =>
      (eingabe.absender === "alle" || eintrag.absender === eingabe.absender) && (!eingabe.nurUngelesen || eintrag.ungelesen),
  );
  const sortiert = sortiere(sichtbar, eingabe.sortierung);
  const abschnitt = (name: PostfachAbschnitt) => sortiert.filter((eintrag) => eintrag.abschnitt === name);

  return {
    haelt: abschnitt("haelt"),
    vorher: abschnitt("vorher"),
    blick: abschnitt("blick"),
    bericht: abschnitt("bericht"),
    jeAbsender,
    alle: sortiert,
    zaehler: {
      ungelesen: offen.filter((eintrag) => eintrag.ungelesen).length,
      handeln: offen.filter((eintrag) => eintrag.bahn === "handeln").length,
      haelt: offen.filter((eintrag) => eintrag.haelt).length,
      info: offen.filter((eintrag) => eintrag.bahn === "info").length,
      posteingang: offen.length,
      erledigt: erledigt.length,
    },
  };
}

/** Ungelesene Meldungen über mehrere eigene Teams (Zahl an der Icon-Schiene, Entscheidung 6). */
export function zaehleUngelesen(items: GameInboxItem[], gelesen: ReadonlySet<string>): number {
  return items.filter((item) => istMeldungUngelesen(item, gelesen)).length;
}

/** Zeitpunkt der Meldung als kurzer Text: „vor ST 18“ für Aufgaben, „ST 17“ für Berichte. */
export function meldungsZeit(item: GameInboxItem, gameState: GameState): string {
  const ids = gameState.season.matchdayIds ?? [];
  const index = ids.findIndex((id) => id === String(item.matchday ?? ""));
  if (item.itemId.startsWith("room_")) return "jetzt";
  if (index < 0) return "";
  const nummer = index + 1;
  return resolveInboxLane({ ...item, status: "open" }) === "report" ? `ST ${nummer}` : `vor ST ${nummer}`;
}

export type WunschFolgen = {
  /** Moral-Änderung dieser Wahl: erfüllt = Zuschlag, abgelehnt = Abzug (aus `getTrainingModeDemandTerms`). */
  moral: number;
  /** Belastung je Trainingstag gegenüber heute (Punkte). */
  belastung: number;
  /** Entwicklung je Spieltag gegenüber heute (XP). */
  entwicklung: number;
};

/** Die Folgen der beiden Antworten auf einen Trainingswunsch, aus denselben Funktionen, die buchen (gezeigt = gebucht). */
export function trainingsWunschFolgen(aktuell: PlayerTrainingMode, wunsch: PlayerTrainingMode): { erfuellen: WunschFolgen; ablehnen: WunschFolgen } {
  const bedingungen = getTrainingModeDemandTerms(aktuell, wunsch);
  return {
    erfuellen: {
      moral: bedingungen.moraleReward,
      belastung: FATIGUE_LOAD_BY_MODE[wunsch] - FATIGUE_LOAD_BY_MODE[aktuell],
      entwicklung: Math.round((getTrainingSetpointsJeSpieltag(wunsch) - getTrainingSetpointsJeSpieltag(aktuell)) * 1000) / 1000,
    },
    ablehnen: { moral: bedingungen.moralePenalty, belastung: 0, entwicklung: 0 },
  };
}

export function istTrainingsModus(wert: unknown): wert is PlayerTrainingMode {
  return wert === "leicht" || wert === "mittel" || wert === "hart";
}

export type PostfachChecklisteZeile = { id: string; label: string; ok: boolean };

const CHECKLISTE: ReadonlyArray<{ praefix: string; label: string }> = [
  { praefix: "lineup_missing:", label: "Lineup gesetzt" },
  { praefix: "lineup_not_submitted:", label: "Lineup bestätigt" },
  { praefix: "formcards_open:", label: "Formkarten-Pool erstellt" },
  { praefix: "training_missing:", label: "Training gesetzt" },
  { praefix: "captain_missing:", label: "Kapitän gewählt" },
  { praefix: "sponsor_choice_missing:", label: "Sponsor gewählt" },
];

/**
 * Checkliste des Spieltags aus den Bedingungs-Meldungen (sie lösen sich selbst auf, siehe `isAutoResolvingInboxItemId`):
 * „erledigt“ heißt, die Bedingung ist laut Spielstand erfüllt. Es stehen nur Zeilen da, die das Spiel für dieses Team führt.
 */
export function baueChecklisteFuerTeam(items: GameInboxItem[], teamId: string): PostfachChecklisteZeile[] {
  const zeilen: PostfachChecklisteZeile[] = [];
  for (const eintrag of CHECKLISTE) {
    const treffer = items.find((item) => item.itemId.startsWith(eintrag.praefix) && item.teamId === teamId);
    if (treffer) zeilen.push({ id: eintrag.praefix, label: eintrag.label, ok: treffer.status === "done" });
  }
  return zeilen;
}

export type PostfachTischGast = {
  ownerId: string;
  name: string;
  teamName: string;
  stufe: string;
};

/** Die anderen Menschen am Tisch (Franky, Ramona): nur Name, Team und Delegations-Stufe, nie ihre Meldungen. */
export function baueTischGaeste(
  gameState: GameState,
  meinBesitzer: string | null,
  settingsMap: Record<string, TeamControlSettings>,
): PostfachTischGast[] {
  const gaeste = new Map<string, PostfachTischGast>();
  for (const team of gameState.teams) {
    const settings = settingsMap[team.teamId];
    if (!settings || settings.controlMode !== "manual") continue;
    const ownerId = settings.ownerId;
    if (!ownerId || ownerId === meinBesitzer || gaeste.has(ownerId)) continue;
    gaeste.set(ownerId, {
      ownerId,
      name: settings.displayLabel ?? ownerId,
      teamName: team.name,
      stufe: DELEGATION_STUFE_LABEL[resolveTeamDelegation(settings).stufe],
    });
  }
  return Array.from(gaeste.values());
}

/** Gehört die Meldung zum Postfach dieses Teams? (Eigene Team-Kennung oder Ziel-Team der Meldung.) */
export function meldungGehoertZuTeam(item: GameInboxItem, teamId: string): boolean {
  if (item.teamId === teamId) return true;
  const ziel =
    typeof item.targetParams.team === "string"
      ? item.targetParams.team
      : typeof item.targetParams.teamId === "string"
        ? item.targetParams.teamId
        : null;
  return ziel === teamId;
}

/** Zahl an der Icon-Schiene: ungelesene Meldungen über alle eigenen Teams des Managers (Entscheidung 6). */
export function zaehleUngelesenFuerTeams(items: GameInboxItem[], teamIds: readonly string[], gelesen: ReadonlySet<string>): number {
  return items.filter((item) => istMeldungUngelesen(item, gelesen) && teamIds.some((teamId) => meldungGehoertZuTeam(item, teamId))).length;
}
