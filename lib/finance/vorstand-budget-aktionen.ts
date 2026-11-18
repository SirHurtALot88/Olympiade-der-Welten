/**
 * Finanzkonzept V2, Finanzseite: die Entscheidungen im Fenster — Umschichten, Ruecklage anzapfen, „Alles auf eine Karte“.
 *
 * Reine Funktionen auf dem `GameState` (wie `loan-service`): sie geben einen neuen Stand zurueck und schreiben nichts.
 * Persistiert wird in der Route `app/api/finance/vorstand/route.ts`, hinter `authorizeServerRoomWrite`; die KI ruft
 * dieselben Funktionen (`entscheideKiVorstandMassnahmen`) und haelt dadurch dieselben Grenzen ein wie der Mensch.
 *
 * Regeln und Zahlen: `docs/design/finanzkonzept-v2-budgets-18-11.md` (Abschnitte 3, 4, 6, 12). Entscheidungen, wo das
 * Konzept offen blieb, stehen in `docs/design/finanzen-v2-seite-18-11.md`.
 */

import type { AlleAufEineKarteRecord, GameState, VorstandBudgetProtokollEintrag, VorstandBudgetZustand } from "@/lib/data/olyDataTypes";
import {
  ANZAPFEN_VERTRAUEN_JE_VIERTEL,
  berechneVorstandBudgetStand,
  lesVorstandZustand,
  type VorstandBudgetStand,
} from "@/lib/finance/vorstand-budgetfreigabe";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";

export type VorstandAktionErgebnis = {
  ok: boolean;
  reason: string | null;
  /** Ein Satz fuer die Oberflaeche. */
  meldung: string;
  gameState: GameState;
  stand: VorstandBudgetStand | null;
};

/** Vertrauen, ab dem der Vorstand einen Antrag auf „Alles auf eine Karte“ genehmigt. */
export const ANTRAG_MIN_VERTRAUEN = 4;
/** Der Vorstand fordert die Wette selbst nur von Top-Teams mit sehr hohem Vertrauen. */
export const VORSTAND_FORDERT_MIN_VERTRAUEN = 8;
export const VORSTAND_FORDERT_MAX_ERWARTUNGSRANG = 3;

const r2 = (v: number) => Math.round(v * 100) / 100;

function fenster(gameState: GameState): boolean {
  return evaluateGamePhaseAction(gameState, "credit_borrow").allowed;
}

function mitZustand(gameState: GameState, teamId: string, zustand: VorstandBudgetZustand): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      vorstandBudget: { ...(gameState.seasonState.vorstandBudget ?? {}), [teamId]: zustand },
    },
  };
}

function eintrag(art: VorstandBudgetProtokollEintrag["art"], text: string, betrag?: number): VorstandBudgetProtokollEintrag {
  return { zeit: new Date().toISOString(), art, text, ...(betrag !== undefined ? { betrag } : {}) };
}

function fehler(gameState: GameState, reason: string, meldung: string): VorstandAktionErgebnis {
  return { ok: false, reason, meldung, gameState, stand: null };
}

/** Umschichten: `betrag` in C Jahresgehalt, + vom Transfer- in den Gehaltstopf, - umgekehrt. Ersetzt den bisherigen Wert. */
export function setzeUmschichtung(gameState: GameState, teamId: string, betrag: number): VorstandAktionErgebnis {
  if (!Number.isFinite(betrag)) return fehler(gameState, "ungueltiger_betrag", "Der Betrag ist keine Zahl.");
  const vorher = berechneVorstandBudgetStand(gameState, teamId);
  if (!vorher.gedeckelt) return fehler(gameState, "nicht_aktiv", "Umschichten gibt es erst ab Saison 2: vorher ist alles freigegeben.");
  const wert = r2(betrag);
  if (wert < 0 && !fenster(gameState)) {
    return fehler(gameState, "nur_im_fenster", "Gehalt in den Transfertopf schieben geht nur im Transferfenster.");
  }
  if (wert > vorher.umschichten.moeglichBis + 1e-9 || wert < vorher.umschichten.moeglichVon - 1e-9) {
    return fehler(
      gameState,
      "ueber_der_grenze",
      `Der Vorstand erlaubt ${vorher.umschichten.moeglichVon.toFixed(1)} bis +${vorher.umschichten.moeglichBis.toFixed(1)} C.`,
    );
  }
  const zustand: VorstandBudgetZustand = {
    ...vorher.zustand,
    umschichtung: wert,
    protokoll: [...vorher.zustand.protokoll, eintrag("umschichten", wert === 0 ? "Umschichtung zurückgenommen" : `Umschichtung ${wert > 0 ? "+" : ""}${wert.toFixed(1)} C`, wert)].slice(-12),
  };
  const next = mitZustand(gameState, teamId, zustand);
  const nachher = berechneVorstandBudgetStand(next, teamId);
  // Der Zieltopf muss das Geld auch frei haben: sonst ginge Umschichten ueber noch Nicht-Vorhandenes.
  if (wert > 0 && nachher.investition.gesamt + 1e-9 < nachher.investition.ausgegeben) {
    return fehler(gameState, "transfertopf_zu_klein", "Im Transfertopf ist nicht mehr genug frei, um das zu verschieben.");
  }
  if (wert < 0 && nachher.gehalt.gesamt + 1e-9 < nachher.gehalt.ausgegeben) {
    return fehler(gameState, "gehaltstopf_zu_klein", "Im Gehaltstopf ist nicht mehr genug frei, um das zu verschieben.");
  }
  return { ok: true, reason: null, meldung: wert === 0 ? "Umschichtung zurückgenommen." : `${Math.abs(wert).toFixed(1)} C umgeschichtet.`, gameState: next, stand: nachher };
}

/** Ruecklage anzapfen: `betrag` ist der GESAMT angezapfte Betrag (ersetzt den alten Wert), hoechstens 50 % des Ruecklage-Ziels. */
export function zapfeRuecklageAn(gameState: GameState, teamId: string, betrag: number): VorstandAktionErgebnis {
  if (!Number.isFinite(betrag) || betrag < 0) return fehler(gameState, "ungueltiger_betrag", "Der Betrag ist keine gültige Zahl.");
  const vorher = berechneVorstandBudgetStand(gameState, teamId);
  if (!vorher.gedeckelt) return fehler(gameState, "nicht_aktiv", "Die Rücklage gibt es erst ab Saison 2.");
  if (!fenster(gameState)) return fehler(gameState, "nur_im_fenster", "Die Rücklage kann nur im Transferfenster angezapft werden.");
  if (vorher.alleAufEineKarte.aktiv) return fehler(gameState, "alles_auf_eine_karte", "„Alles auf eine Karte“ ist aktiv: die Rücklage ist ohnehin frei.");
  const ziel = vorher.herleitung.ruecklageZiel;
  const maximal = ziel * 0.5;
  const gesamt = r2(Math.min(betrag, maximal));
  const viertel = ziel > 0 ? Math.ceil(gesamt / (ziel / 4) - 1e-9) : 0;
  const kosten = r2(viertel * ANZAPFEN_VERTRAUEN_JE_VIERTEL);
  const zustand: VorstandBudgetZustand = {
    ...vorher.zustand,
    ruecklageAngezapft: gesamt,
    vertrauensKosten: kosten,
    protokoll: [...vorher.zustand.protokoll, eintrag("ruecklage_anzapfen", gesamt === 0 ? "Rücklage nicht mehr angezapft" : `Rücklage angezapft: ${gesamt.toFixed(1)} C (Vertrauen -${kosten.toFixed(2)})`, gesamt)].slice(-12),
  };
  const next = mitZustand(gameState, teamId, zustand);
  return {
    ok: true,
    reason: null,
    meldung: gesamt === 0 ? "Die Rücklage bleibt unangetastet." : `${gesamt.toFixed(1)} C aus der Rücklage freigegeben. Das kostet ${kosten.toFixed(2)} Vertrauen, wirksam bei der nächsten Festlegung.`,
    gameState: next,
    stand: berechneVorstandBudgetStand(next, teamId),
  };
}

/** Grobe Erwartung: Rang der Kader-Marktwerte in der eigenen Liga (1 = staerkster Kader). Billig genug fuer die KI-Schleife. */
export function schaetzeErwartungsRang(gameState: GameState, teamId: string): { rang: number; teams: number } {
  const split = isLeagueSplitActive(gameState);
  const tier = split ? getLeagueOf(gameState, teamId) : null;
  const wert = new Map<string, number>();
  const byId = new Map((gameState.players ?? []).map((p) => [p.id, p] as const));
  for (const r of gameState.rosters) {
    const pl = byId.get(r.playerId);
    wert.set(r.teamId, (wert.get(r.teamId) ?? 0) + Math.max(0, pl?.marketValue ?? pl?.displayMarketValue ?? 0));
  }
  const gleiche = gameState.teams.filter((t) => !tier || getLeagueOf(gameState, t.teamId) === tier);
  const meins = wert.get(teamId) ?? 0;
  const besser = gleiche.filter((t) => t.teamId !== teamId && (wert.get(t.teamId) ?? 0) > meins).length;
  return { rang: besser + 1, teams: Math.max(1, gleiche.length) };
}

/** Der Vorstand fordert „Alles auf eine Karte“ als Saisonziel von einem Top-Team mit sehr hohem Vertrauen. */
export function vorstandFordertAlleAufEineKarte(gameState: GameState, teamId: string): boolean {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  if (!stand.gedeckelt || stand.alleAufEineKarte.aktiv || stand.vertrauen == null) return false;
  if (stand.vertrauen < VORSTAND_FORDERT_MIN_VERTRAUEN) return false;
  if (gameState.seasonState.vorstandBudget?.[teamId]?.seasonId === gameState.season.id && gameState.seasonState.vorstandBudget?.[teamId]?.alleAufEineKarte) return false;
  return schaetzeErwartungsRang(gameState, teamId).rang <= VORSTAND_FORDERT_MAX_ERWARTUNGSRANG;
}

/**
 * „Alles auf eine Karte“: bis auf 5 % Puffer darf alles ausgegeben werden. Einmal je Saison, nur im Fenster, ab Saison 2.
 *  - `mensch`: Antrag beim Vorstand — genehmigt ab Vertrauen 4, sonst abgelehnt (mit Begruendung).
 *  - `vorstand`: der Vorstand fordert es als Saisonziel (siehe `vorstandFordertAlleAufEineKarte`), das Team nimmt an.
 *  - `ki`: die KI entscheidet nach Ambition und Doktrin (`entscheideKiVorstandMassnahmen`), selten und begruendet.
 * Das Ziel ist eingefroren: Endrang um zwei Plaetze besser als die Kader-Erwartung (mindestens Platz 1). Der Ausgang
 * wird am Saisonende als Vorstandsziel gewertet (`lib/board/team-season-objectives-service.ts`): Treffer +0,75 Vertrauen,
 * Verfehlen -1,0 Vertrauen, keine Geldstrafe.
 */
export function beantrageAlleAufEineKarte(
  gameState: GameState,
  teamId: string,
  quelle: AlleAufEineKarteRecord["quelle"],
  grund?: string,
): VorstandAktionErgebnis {
  const vorher = berechneVorstandBudgetStand(gameState, teamId);
  if (!vorher.gedeckelt) return fehler(gameState, "nicht_aktiv", "„Alles auf eine Karte“ gibt es erst ab Saison 2: vorher ist ohnehin alles freigegeben.");
  if (!fenster(gameState)) return fehler(gameState, "nur_im_fenster", "„Alles auf eine Karte“ geht nur im Transferfenster.");
  if (vorher.alleAufEineKarte.aktiv) return fehler(gameState, "schon_aktiv", "„Alles auf eine Karte“ läuft in dieser Saison bereits.");
  if (quelle === "mensch") {
    if (vorher.vertrauen == null || vorher.vertrauen < ANTRAG_MIN_VERTRAUEN) {
      const text = `Der Vorstand lehnt ab: bei Vertrauen ${vorher.vertrauen == null ? "—" : vorher.vertrauen.toFixed(1)} unter ${ANTRAG_MIN_VERTRAUEN} traut er dem Team die Wette nicht zu.`;
      const next = mitZustand(gameState, teamId, { ...vorher.zustand, letzterAntragAbgelehnt: { zeit: new Date().toISOString(), grund: text } });
      return { ok: false, reason: "vorstand_lehnt_ab", meldung: text, gameState: next, stand: null };
    }
  }
  if (quelle === "vorstand" && !vorstandFordertAlleAufEineKarte(gameState, teamId)) {
    return fehler(gameState, "vorstand_fordert_nicht", "Der Vorstand fordert die Wette von diesem Team nicht.");
  }
  const erw = schaetzeErwartungsRang(gameState, teamId);
  const karte: AlleAufEineKarteRecord = {
    quelle,
    seit: new Date().toISOString(),
    grund:
      grund ??
      (quelle === "mensch"
        ? "Antrag des Managers, vom Vorstand genehmigt."
        : quelle === "vorstand"
          ? "Der Vorstand fordert es als Saisonziel."
          : "Die KI setzt auf diese Saison."),
    zielRang: Math.max(1, erw.rang - 2),
    erwartungsRang: erw.rang,
    ausgangVertrauen: vorher.vertrauen,
  };
  const zustand: VorstandBudgetZustand = {
    ...vorher.zustand,
    alleAufEineKarte: karte,
    // Der angezapfte Betrag ist in der Wette ohnehin enthalten; er wird nicht doppelt gezaehlt.
    ruecklageAngezapft: 0,
    letzterAntragAbgelehnt: null,
    protokoll: [...vorher.zustand.protokoll, eintrag("alles_auf_eine_karte", `Alles auf eine Karte (${quelle}): Ziel Platz ${karte.zielRang}`)].slice(-12),
  };
  const next = mitZustand(gameState, teamId, zustand);
  return {
    ok: true,
    reason: null,
    meldung: `Alles auf eine Karte: bis auf 5 % Puffer darf alles ausgegeben werden. Ziel: Platz ${karte.zielRang} oder besser. Trifft das Team es nicht, kostet das Vertrauen.`,
    gameState: next,
    stand: berechneVorstandBudgetStand(next, teamId),
  };
}

export type KiVorstandMassnahme = { art: "umschichten" | "ruecklage_anzapfen" | "alles_auf_eine_karte"; text: string; betrag?: number };

/** Charakter der KI aus der Risikobereitschaft des Teams: vorsichtig < 4, normal 4 bis 7, aggressiv > 7. */
export function kiCharakter(gameState: GameState, teamId: string): "vorsichtig" | "normal" | "aggressiv" {
  const risiko = gameState.seasonState.teamStrategyProfiles?.[teamId]?.bias?.riskTolerance;
  if (typeof risiko !== "number") return "normal";
  return risiko < 4 ? "vorsichtig" : risiko > 7 ? "aggressiv" : "normal";
}

/**
 * Die KI entscheidet EINMAL je Fenster und Team, was sie mit den Toepfen tut (Konzept Abschnitt 5, Regeln 3, 7):
 *  - Umschichten in Richtung des Topfes, der zuerst bindet: vorsichtig 0 %, normal 50 %, aggressiv 100 % der Grenze.
 *  - Ruecklage anzapfen: nur aggressive Teams, nur bei Kader unter Soll und Transfertopf als Engpass.
 *  - „Alles auf eine Karte“: selten und begruendet — Top-Team (Erwartungsrang 1 bis 4) mit Ambition >= 7, Vertrauen >= 5
 *    und aggressiver Doktrin (Risikobereitschaft > 7), oder wenn der Vorstand es fordert. Hoechstens einmal je Saison;
 *    dass es selten bleibt, kommt aus der engen Bedingung (die Messung zaehlt es, `scripts/miss-teamfinanzen-saison.ts`).
 */
export function entscheideKiVorstandMassnahmen(
  gameState: GameState,
  teamId: string,
): { gameState: GameState; massnahmen: KiVorstandMassnahme[] } {
  const massnahmen: KiVorstandMassnahme[] = [];
  let gs = gameState;
  const stand = berechneVorstandBudgetStand(gs, teamId);
  if (!stand.gedeckelt || stand.alleAufEineKarte.aktiv || !fenster(gs)) return { gameState, massnahmen };
  const charakter = kiCharakter(gs, teamId);
  const identity = gs.teamIdentities?.find((i) => i.teamId === teamId);
  const ambition = typeof identity?.ambition === "number" ? (identity.ambition > 10 ? identity.ambition / 10 : identity.ambition) : 5;
  const rosterCount = gs.rosters.filter((r) => r.teamId === teamId).length;
  const sollKader = Math.max(8, Math.round(identity?.playerOpt ?? 11));

  // 1) Alles auf eine Karte: selten und begruendet.
  const erw = schaetzeErwartungsRang(gs, teamId);
  const fordert = vorstandFordertAlleAufEineKarte(gs, teamId);
  const wille = (charakter === "aggressiv" && ambition >= 7 && (stand.vertrauen ?? 0) >= 5 && erw.rang <= 4 && rosterCount <= sollKader) || fordert;
  if (wille) {
    const r = beantrageAlleAufEineKarte(
      gs,
      teamId,
      fordert ? "vorstand" : "ki",
      fordert
        ? `Der Vorstand fordert es: Erwartungsrang ${erw.rang}, Vertrauen ${(stand.vertrauen ?? 0).toFixed(1)}.`
        : `Top-Team (Erwartungsrang ${erw.rang}), Ambition ${ambition.toFixed(0)}, aggressive Doktrin: die KI setzt auf die Saison.`,
    );
    if (r.ok) {
      gs = r.gameState;
      massnahmen.push({ art: "alles_auf_eine_karte", text: r.meldung });
      return { gameState: gs, massnahmen };
    }
  }

  // 2) Umschichten in Richtung des bindenden Topfes.
  const anteil = charakter === "vorsichtig" ? 0 : charakter === "normal" ? 0.5 : 1;
  if (anteil > 0) {
    const g = stand.gehalt;
    const t = stand.investition;
    const gehaltBindet = g.frei < t.frei * 0.35;
    if (gehaltBindet && t.frei > 1) {
      const betrag = r2(Math.min(stand.umschichten.moeglichBis * anteil, t.frei * 0.5));
      if (betrag > 0.25) {
        const r = setzeUmschichtung(gs, teamId, betrag);
        if (r.ok) {
          gs = r.gameState;
          massnahmen.push({ art: "umschichten", text: `Transfer -> Gehalt: ${betrag.toFixed(1)} C (Gehaltstopf bindet zuerst)`, betrag });
        }
      }
    }
  }

  // 3) Ruecklage anzapfen: nur aggressive Teams, nur unter Soll.
  if (charakter === "aggressiv" && rosterCount < sollKader) {
    const stand2 = berechneVorstandBudgetStand(gs, teamId);
    if (stand2.ruecklageAnzapfen.moeglich > 0.5 && stand2.investition.frei < stand2.herleitung.ruecklageZiel) {
      const r = zapfeRuecklageAn(gs, teamId, stand2.ruecklageAnzapfen.bereitsAngezapft + stand2.ruecklageAnzapfen.moeglich);
      if (r.ok) {
        gs = r.gameState;
        massnahmen.push({ art: "ruecklage_anzapfen", text: r.meldung, betrag: r.stand?.ruecklageAnzapfen.bereitsAngezapft });
      }
    }
  }
  return { gameState: gs, massnahmen };
}

export { lesVorstandZustand };
