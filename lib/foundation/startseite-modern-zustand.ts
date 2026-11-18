/**
 * STARTSEITE MODERN, RUNDE 2 (18.11.): Zustand, der im Spielstand schon liegt und auf der Startseite gezeigt wird.
 *
 * Nichts wird neu gerechnet, was ein anderes Modul schon beantwortet:
 * - Einsatzliste je Disziplin: dieselben Lesefunktionen wie Home-Flow und Einsatzliste-Bündel
 *   (`getTeamMatchdayLineupDraft`, `getMatchdayLineupSideRequirements`, `getLineupDraftSideCounts`), also der
 *   gespeicherte Entwurf des aktuellen Spieltags.
 * - Gelegte Formkarte: `modifiers.d1/d2` des Entwurfs, sonst der Formplan (`formCardPlans`).
 * - Pflicht-Minuskarte: `buildFormCardSeasonUsageAudit` (dieselbe Zahl wie die Saisonende-Strafe).
 * - Vertrag läuft aus: `laeuftMitDieserSaisonAus` (Endsaison = laufende Saison).
 * - Spieler der Saison: `baueMatchwinnerListe` (Bestenliste des Saisonstands).
 * Alles reine Lesefunktionen ohne React.
 */
import type { GameState, LineupDraftModifierSide } from "@/lib/data/olyDataTypes";
import { laeuftMitDieserSaisonAus } from "@/lib/contracts/vertragslaufzeit";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import {
  getLineupDraftSideCounts,
  getMatchdayLineupSideRequirements,
  getTeamMatchdayLineupDraft,
} from "@/lib/foundation/matchday-lineup-readiness";
import { findeSpieltagsFixtures } from "@/lib/resolve/battle-mode-pps-duell";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { baueMatchwinnerListe } from "@/lib/season/saisonstand-matchwinner";
import type { FormMoralAnzeige } from "@/lib/lineups/form-moral-anzeige";

const FARB_NAME: Record<string, string> = { red: "Power", green: "Speed", blue: "Mental", yellow: "Social" };
const vz = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${Math.abs(x)}`;

/* ------------------------------------------------------------------ Einsatzliste und Formkarte je Disziplin */

export type SeitenEinsatz = {
  side: "d1" | "d2";
  gesetzt: number;
  benoetigt: number;
  /** Gelegte Formkarten als Text („Speed +8"); leer = keine gelegt. */
  formkarten: string[];
};

export type EinsatzStatus = {
  d1: SeitenEinsatz;
  d2: SeitenEinsatz;
  offenePlaetze: number;
  /** Hat das Team seinen Formkarten-Pool (Transfers finalisiert)? Sonst gibt es nichts zu legen. */
  hatFormkartenPool: boolean;
};

/**
 * Stand der Einsatzliste des aktuellen Spieltags. `null`, wenn `matchdayId` nicht der laufende Spieltag ist
 * (der Entwurf gehört dann nicht zu der gezeigten Karte).
 */
export function einsatzStatus(gameState: GameState, teamId: string, matchdayId: string): EinsatzStatus | null {
  if (gameState.matchdayState.matchdayId !== matchdayId) return null;
  const draft = getTeamMatchdayLineupDraft(gameState, teamId);
  const need = getMatchdayLineupSideRequirements(gameState);
  const counts = getLineupDraftSideCounts(draft?.entries ?? []);
  const karten = (gameState.seasonState.formCards ?? []).filter((c) => c.seasonId === gameState.season.id && c.teamId === teamId);
  const kartenText = (ids: Array<string | null | undefined>): string[] =>
    ids
      .filter((id): id is string => Boolean(id))
      .map((id) => karten.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => `${FARB_NAME[c.cardColor] ?? c.cardColor} ${vz(c.cardValue)}`);
  const plaene = (gameState.seasonState.formCardPlans ?? []).filter((p) => p.teamId === teamId && p.matchdayId === matchdayId);
  const seite = (side: "d1" | "d2"): SeitenEinsatz => {
    const mod: LineupDraftModifierSide | undefined = draft?.modifiers?.[side];
    let texte = kartenText([mod?.primaryFormCardId, mod?.secondaryFormCardId]);
    if (texte.length === 0) {
      const plan = plaene.find((p) => p.disciplineSide === side);
      texte = kartenText([plan?.primaryFormCardId, plan?.secondaryFormCardId]);
    }
    return { side, gesetzt: side === "d1" ? counts.d1 : counts.d2, benoetigt: side === "d1" ? need.d1Required : need.d2Required, formkarten: texte };
  };
  const d1 = seite("d1");
  const d2 = seite("d2");
  return {
    d1,
    d2,
    offenePlaetze: Math.max(d1.benoetigt - d1.gesetzt, 0) + Math.max(d2.benoetigt - d2.gesetzt, 0),
    hatFormkartenPool: getFormCardFlowStatus(gameState, teamId).hasPool,
  };
}

/* ------------------------------------------------------------------ Entscheidungen aus dem echten Zustand */

export type EntscheidungZiel = { art: "einsatzliste" } | { art: "kader" } | { art: "spieler"; playerId: string } | { art: "inbox" };

export type AbgeleiteteEntscheidung = {
  id: string;
  /** rot = dringend, gelb = Warnung, grau = Hinweis */
  ton: "rot" | "gelb" | "grau";
  titel: string;
  detail: string;
  ziel: EntscheidungZiel;
  zielText: string;
};

export const MORAL_VERAERGERT_SCHWELLE = 40;

export function baueAbgeleiteteEntscheidungen(input: {
  gameState: GameState;
  teamId: string;
  einsatz: EinsatzStatus | null;
  formMoral: Record<string, Pick<FormMoralAnzeige, "moral">>;
  gespielteSpieltage: number;
  gesamtSpieltage: number;
  saisonEnde: boolean;
}): AbgeleiteteEntscheidung[] {
  const { gameState, teamId, einsatz, formMoral, gespielteSpieltage, gesamtSpieltage, saisonEnde } = input;
  const aus: AbgeleiteteEntscheidung[] = [];
  const nameVon = new Map(gameState.players.map((p) => [p.id, p.name] as const));
  const verbleibend = Math.max(0, gesamtSpieltage - gespielteSpieltage);

  /* Einsatzliste unvollständig */
  if (einsatz && !saisonEnde && einsatz.offenePlaetze > 0) {
    const gesetzt = einsatz.d1.gesetzt + einsatz.d2.gesetzt;
    const gesamt = einsatz.d1.benoetigt + einsatz.d2.benoetigt;
    aus.push({
      id: "einsatzliste",
      ton: "rot",
      titel: gesetzt === 0 ? "Einsatzliste leer" : "Einsatzliste unvollständig",
      detail: `${gesetzt} von ${gesamt} Plätzen gesetzt · ${einsatz.offenePlaetze} offen`,
      ziel: { art: "einsatzliste" },
      zielText: "setzen ›",
    });
  }

  /* Pflicht-Minuskarte offen: ungespielte Minuskarten kosten am Saisonende Tabellenpunkte */
  if (!saisonEnde && getFormCardFlowStatus(gameState, teamId).hasPool) {
    const zeile = buildFormCardSeasonUsageAudit(gameState, gameState.season.id).rows.find((r) => r.teamId === teamId);
    if (zeile && zeile.unusedNegativeCards > 0) {
      aus.push({
        id: "minuskarte",
        ton: verbleibend <= 3 ? "rot" : "gelb",
        titel: zeile.unusedNegativeCards === 1 ? "Pflicht-Minuskarte offen" : `${zeile.unusedNegativeCards} Pflicht-Minuskarten offen`,
        detail: `Strafe am Saisonende −${zeile.negativePenaltyPoints} Pkt · noch ${verbleibend} ${verbleibend === 1 ? "Spieltag" : "Spieltage"} Zeit`,
        ziel: { art: "einsatzliste" },
        zielText: "legen ›",
      });
    }
  }

  /* Spieler verärgert: Moral unter 40, mit Spieltagen ohne Einsatz, wenn die Einsatz-Zeilen da sind */
  const gewertet = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((r) => r.seasonId === gameState.season.id && r.status === "preview_applied")
      .map((r) => r.id),
  );
  const eingesetzt = new Map<string, Set<string>>();
  for (const p of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (!gewertet.has(p.matchdayResultId)) continue;
    const set = eingesetzt.get(p.playerId) ?? new Set<string>();
    set.add(p.matchdayResultId);
    eingesetzt.set(p.playerId, set);
  }
  const veraergert = Object.entries(formMoral)
    .filter(([, a]) => a.moral != null && (a.moral as number) < MORAL_VERAERGERT_SCHWELLE)
    .sort((a, b) => (a[1].moral as number) - (b[1].moral as number))
    .slice(0, 2);
  for (const [playerId, a] of veraergert) {
    const ohne = gewertet.size > 0 ? Math.max(0, gewertet.size - (eingesetzt.get(playerId)?.size ?? 0)) : null;
    aus.push({
      id: `moral-${playerId}`,
      ton: "gelb",
      titel: `${nameVon.get(playerId) ?? "Ein Spieler"} verärgert`,
      detail: `Moral ${Math.round(a.moral as number)}${ohne != null && ohne > 0 ? ` · ${ohne} ${ohne === 1 ? "Spieltag" : "Spieltage"} ohne Einsatz` : ""}`,
      ziel: { art: "spieler", playerId },
      zielText: "ansehen ›",
    });
  }

  /* Vertrag läuft aus: Endsaison = laufende Saison */
  const laufenAus = gameState.rosters
    .filter((r) => r.teamId === teamId && laeuftMitDieserSaisonAus(r, gameState))
    .map((r) => ({ id: r.playerId, name: nameVon.get(r.playerId) ?? r.playerId }));
  if (laufenAus.length > 0) {
    const namen = laufenAus.slice(0, 3).map((x) => x.name).join(", ") + (laufenAus.length > 3 ? " …" : "");
    aus.push({
      id: "vertraege",
      ton: saisonEnde ? "rot" : "gelb",
      titel: laufenAus.length === 1 ? `Vertrag ${laufenAus[0]!.name} läuft aus` : `${laufenAus.length} Verträge laufen aus`,
      detail: laufenAus.length === 1 ? "Endet mit dieser Saison" : `${namen} · Saisonende`,
      ziel: laufenAus.length === 1 ? { art: "spieler", playerId: laufenAus[0]!.id } : { art: "kader" },
      zielText: "verhandeln ›",
    });
  }
  return aus;
}

/**
 * Ein Eintrag je Sache: sagt ein Inbox-Eintrag dasselbe wie eine abgeleitete Entscheidung, entfällt er. Gleicher Titel reicht nicht,
 * die Inbox nennt die leere Einsatzliste „Lineup fehlt“, die abgeleitete Zeile „Einsatzliste leer“ (Abnahme 18.11.: beides stand da).
 */
const SACHE_NACH_ID: Array<{ id: string; muster: RegExp }> = [
  { id: "einsatzliste", muster: /lineup|einsatzliste/i },
  { id: "minuskarte", muster: /minuskarte/i },
  { id: "vertraege", muster: /vertr.*(läuft|laufen|endet)/i },
];

export function inboxEintragIstDoppelt(inboxTitel: string, abgeleitet: Array<Pick<AbgeleiteteEntscheidung, "id" | "titel">>): boolean {
  const titel = inboxTitel.toLowerCase();
  if (abgeleitet.some((e) => e.titel.toLowerCase() === titel)) return true;
  return SACHE_NACH_ID.some((s) => s.muster.test(inboxTitel) && abgeleitet.some((e) => e.id === s.id));
}

/* ------------------------------------------------------------------ Spieler des Tages / der Saison, bestes Heimspiel */

export type SpielerEhrung = { playerId: string; name: string; text: string };

/** Spieler des Tages: bester des eigenen Teams (`rankInTeam` 1) im letzten gewerteten Spieltag, der gewonnene Einsatz zuerst, dann nach Beitrag. */
export function spielerDesTages(gameState: GameState, teamId: string, matchdayId: string): SpielerEhrung | null {
  const ergebnis = (gameState.seasonState.matchdayResults ?? []).find(
    (r) => r.seasonId === gameState.season.id && r.matchdayId === matchdayId && r.status === "preview_applied",
  );
  if (!ergebnis) return null;
  const punkte = new Map<string, number>();
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    if (row.matchdayResultId === ergebnis.id && row.teamId === teamId && typeof row.teamPoints === "number") punkte.set(row.disciplineId, row.teamPoints);
  }
  const kandidaten = (gameState.seasonState.playerDisciplinePerformances ?? [])
    .filter((p) => p.matchdayResultId === ergebnis.id && p.teamId === teamId && p.rankInTeam === 1)
    .sort((a, b) => ((punkte.get(b.disciplineId) ?? 0) >= 2 ? 1 : 0) - ((punkte.get(a.disciplineId) ?? 0) >= 2 ? 1 : 0) || b.scoreContribution - a.scoreContribution);
  const bester = kandidaten[0];
  if (!bester) return null;
  const name = gameState.players.find((p) => p.id === bester.playerId)?.name ?? bester.playerId;
  const disz = gameState.disciplines.find((d) => d.id === bester.disciplineId)?.name ?? bester.disciplineId;
  return { playerId: bester.playerId, name, text: `${disz}, bester des Teams` };
}

/** Spieler der Saison: Platz 1 der eigenen Spieler in der Matchwinner-Bestenliste. */
export function spielerDerSaison(gameState: GameState, teamId: string): SpielerEhrung | null {
  const liste = baueMatchwinnerListe(gameState, gameState.season.id, 400).filter((e) => e.teamId === teamId);
  const e = liste[0];
  if (!e) return null;
  return { playerId: e.playerId, name: e.name, text: `${e.matchwinner}-mal Matchwinner in ${e.einsaetze} Einsätzen` };
}

export type BestesHeimspiel = { spieltag: number; punkte: number; moeglich: number; gegnerId: string };

/**
 * Bestes Heimspiel: nur, wenn Heim/Auswärts im Spielplan steht (`schedule`, `homeTeamId`). Gewertet wird die Summe der
 * Teampunkte des Spieltags; bei Gleichstand der frühere Spieltag.
 */
export function bestesHeimspiel(gameState: GameState, teamId: string): BestesHeimspiel | null {
  let bestes: BestesHeimspiel | null = null;
  for (const r of gameState.seasonState.matchdayResults ?? []) {
    if (r.seasonId !== gameState.season.id || r.status !== "preview_applied") continue;
    const fixture = findeSpieltagsFixtures(gameState, r.matchdayId).find((f) => f.homeTeamId === teamId);
    if (!fixture) continue;
    let punkte = 0;
    let moeglich = 0;
    for (const row of gameState.seasonState.disciplineResults ?? []) {
      if (row.matchdayResultId !== r.id || row.teamId !== teamId || typeof row.teamPoints !== "number") continue;
      punkte += row.teamPoints;
      moeglich += 2;
    }
    if (moeglich === 0) continue;
    const spieltag = gameState.season.matchdayIds.indexOf(r.matchdayId) + 1;
    if (!bestes || punkte > bestes.punkte) bestes = { spieltag, punkte, moeglich, gegnerId: fixture.awayTeamId };
  }
  return bestes;
}
