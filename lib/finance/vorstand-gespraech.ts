/**
 * Office 21.11, Reiter „Gespraech": der Mensch verhandelt mit dem Vorstand. Es ersetzt die direkten Knoepfe
 * „Ruecklage anzapfen" und „Alles auf eine Karte" der Finanzseite (Chris 21.11., Entscheidung 6).
 *
 * Regeln (Konzept `docs/design/vorstandsgespraech-18-11.md`, Zahlen dort Abschnitt 4, Aenderungen in
 * `docs/design/office-vorstand-bau-21-11.md`):
 *  - Hoechstens ZWEI Gespraeche je Saison; ein Antrag verbraucht eines, gleich wie er ausgeht; ein Gegenangebot
 *    laeuft in Runde 2 im selben Gespraech weiter. Fragen (die Einschaetzung) kostet nichts und kein Vertrauen.
 *  - Antwort ohne Wuerfel: Gewicht = Vertrauen x 2 + Summe der Zusagen (Wert je Charakter) gegen den Preis der Bitte.
 *  - Charakter aus der Sparneigung = Finanzwert - max(0, Ambition - 5): Antreiber (< 3,5), Kaufmann, Kassenwart (>= 7).
 *  - Ab Saison 2 (vorher ist alles freigegeben).
 *  - Reine Funktionen auf dem GameState wie `vorstand-budget-aktionen`; die Route schreibt hinter `authorizeServerRoomWrite`.
 *
 * Die KI fuehrt keine Gespraeche; sie ruft weiter dieselben Wirkfunktionen direkt (`entscheideKiVorstandMassnahmen`).
 */

import { getTeamObjectivePool, istZielTauschbar, tauscheVorstandsZiel, zielTauschZeitfenster } from "@/lib/board/team-season-objectives-service";
import { lieblingFuerSaison, verlaengertDieseSaison } from "@/lib/board/vorstand-ziele-erweitert";
import type {
  GameState,
  VorstandBitteArt,
  VorstandBudgetZustand,
  VorstandGespraechOffen,
  VorstandGespraechProtokollEintrag,
  VorstandGespraechZustand,
  VorstandZusageArt,
} from "@/lib/data/olyDataTypes";
import { beantrageAlleAufEineKarte, zapfeRuecklageAn } from "@/lib/finance/vorstand-budget-aktionen";
import { berechneVorstandBudgetStand, lesVorstandZustand, type VorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import { GESPRAECHE_JE_SAISON, lesVorstandGespraech } from "@/lib/finance/vorstand-gespraech-zustand";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";

export { GESPRAECHE_JE_SAISON, lesVorstandGespraech };

export type GespraechCharakter = "antreiber" | "kaufmann" | "kassenwart";

export const CHARAKTER_TEXT: Record<GespraechCharakter, { name: string; satz: string }> = {
  antreiber: { name: "Der Antreiber", satz: "Er will Ergebnisse. Ein höheres Saisonziel überzeugt ihn am meisten." },
  kaufmann: { name: "Der Kaufmann", satz: "Er wägt ab. Jede Zusage zählt ähnlich." },
  kassenwart: { name: "Der Kassenwart", satz: "Er hütet die Kasse. Ein Gehaltsdeckel überzeugt ihn am meisten." },
};

/** Wert der Zusagen je Charakter (Startwerte, zum Messen). */
export const ZUSAGE_WERT: Record<VorstandZusageArt, Record<GespraechCharakter, number>> = {
  zielhoch: { antreiber: 8, kaufmann: 5, kassenwart: 2 },
  deckel: { antreiber: 2, kaufmann: 4, kassenwart: 6 },
  vertrauen: { antreiber: 3, kaufmann: 3, kassenwart: 3 },
  binden: { antreiber: 3, kaufmann: 4, kassenwart: 5 },
};

export const ZUSAGE_TEXT: Record<VorstandZusageArt, { titel: string; kurz: string }> = {
  zielhoch: { titel: "Höheres Saisonziel", kurz: "Das verbindliche Ziel einen Platz besser. Verfehlt: −0,5 Vertrauen." },
  deckel: { titel: "Gehaltsdeckel", kurz: "Das Gehaltsbudget wächst diese Saison nicht mit: kein Umschichten ins Gehalt." },
  vertrauen: { titel: "Vertrauen einsetzen", kurz: "−0,25 Vertrauen, gebucht bei der nächsten Festlegung." },
  binden: { titel: "Lieblingsspieler verlängern", kurz: "Bis Saisonende verlängern, sonst −0,5 Vertrauen." },
};

export const BITTE_TEXT: Record<VorstandBitteArt, { titel: string; kurz: string }> = {
  stufe: { titel: "Freigabe anheben", kurz: "Eine Stufe mehr für die ganze Saison (zum Beispiel 80 → 90 %)." },
  sonder: { titel: "Sonderbudget Gehalt", kurz: "Einmalig Geld aus dem Vorbehalt in den Gehaltstopf." },
  anzapf: { titel: "Notrücklage anzapfen", kurz: "Bis zur Hälfte des Rücklage-Ziels zusätzlich in den Transfertopf. Kostet Vertrauen." },
  alles: { titel: "Alles auf eine Karte", kurz: "100 %, nur 5 % Puffer, dafür ein Ziel zwei Plätze besser." },
  ziel: { titel: "Ziel tauschen", kurz: "Ein Saisonziel gegen ein anderes desselben Bereichs." },
  liebling: { titel: "Lieblingsspieler freigeben", kurz: "Verkauf des Lieblings ohne Vertrauensverlust." },
};

/** Feste Preise der Bitten (Startwerte, zum Messen). */
export const BITTE_PREIS = { stufe: 14, sonder: 4, sonderSpanne: 10, anzapfJeViertel: 5, alles: 20, ziel: 6, liebling: 8 };
const ANZAPF_FAKTOR: Record<GespraechCharakter, number> = { antreiber: 0.8, kaufmann: 1, kassenwart: 1.6 };
/** Fehlt weniger als so viel, macht der Vorstand ein Gegenangebot, sonst lehnt er ab. */
export const GEGENANGEBOT_SPANNE = 10;
/** Hoechstens so viele Runden je Gespraech. */
export const GESPRAECH_RUNDEN = 2;

export type GespraechAntrag = {
  bitte: VorstandBitteArt;
  /** Sonderbudget und Anzapfen: Betrag in C. */
  betrag?: number;
  /** Ziel tauschen: welches. */
  zielId?: string;
  zusagen: VorstandZusageArt[];
};

export type GespraechUrteil = "zustimmung" | "gegenangebot" | "ablehnung";

export type GespraechEinschaetzung = {
  charakter: GespraechCharakter;
  sparneigung: number;
  vertrauen: number | null;
  gewicht: number;
  verlangt: number;
  luecke: number;
  urteil: GespraechUrteil;
  /** Zusagen, die der Vorstand zusaetzlich will, um die Luecke zu schliessen (nur beim Gegenangebot). */
  vorschlag: VorstandZusageArt[];
  /** Feste Regel: warum die Bitte gar nicht geht (null = geht). */
  sperre: string | null;
  begruendung: string;
  /** Welche Zusagen sich mit dieser Bitte vertragen, mit Grund fuer die gesperrten. */
  zusagenVerfuegbar: Record<VorstandZusageArt, string | null>;
};

export type GespraechErgebnis = {
  ok: boolean;
  reason: string | null;
  meldung: string;
  ausgang: GespraechUrteil | "zurueckgezogen" | null;
  gameState: GameState;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function gespraechCharakter(gameState: GameState, teamId: string): { charakter: GespraechCharakter; sparneigung: number } {
  const identity = gameState.teamIdentities?.find((i) => i.teamId === teamId);
  const fin = typeof identity?.finances === "number" ? (identity.finances > 10 ? identity.finances / 10 : identity.finances) : 5;
  const amb = typeof identity?.ambition === "number" ? (identity.ambition > 10 ? identity.ambition / 10 : identity.ambition) : 5;
  const sparneigung = fin - Math.max(0, amb - 5);
  return { charakter: sparneigung < 3.5 ? "antreiber" : sparneigung < 7 ? "kaufmann" : "kassenwart", sparneigung: r1(sparneigung) };
}

function imFenster(gameState: GameState): boolean {
  return evaluateGamePhaseAction(gameState, "credit_borrow").allowed;
}

/** Zielrang aus einem Zielwert: Zahl oder „Top 6". */
function rangAusZielwert(wert: unknown): number | null {
  if (typeof wert === "number" && Number.isFinite(wert)) return wert;
  if (typeof wert === "string") {
    const m = /(\d+)/.exec(wert);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Das verbindliche Rang-Ziel dieser Saison (Zielrang), falls es eines gibt. */
export function verbindlichesRangZiel(gameState: GameState, teamId: string): { objectiveId: string; rang: number } | null {
  for (const o of gameState.seasonState.teamSeasonObjectives ?? []) {
    if (o.seasonId !== gameState.season.id || o.teamId !== teamId || o.optional) continue;
    if (o.objectiveId !== "expectation-rank" && !/^sport-rank-\d+$/.test(o.objectiveId)) continue;
    const rang = rangAusZielwert(o.targetValue);
    if (rang != null) return { objectiveId: o.objectiveId, rang };
  }
  return null;
}

function bitteSperre(gameState: GameState, teamId: string, stand: VorstandBudgetStand, antrag: GespraechAntrag): string | null {
  const z = lesVorstandGespraech(gameState, teamId);
  const fenster = imFenster(gameState);
  if (!stand.gedeckelt) return "Vor Saison 2 ist alles freigegeben: es gibt nichts zu verhandeln.";
  if (!z.offen && z.genutzt >= GESPRAECHE_JE_SAISON) return `Beide Gespräche dieser Saison sind verbraucht (${GESPRAECHE_JE_SAISON} von ${GESPRAECHE_JE_SAISON}).`;
  const deckel = z.zusagen.some((x) => x.art === "deckel");
  switch (antrag.bitte) {
    case "stufe":
      if (stand.alleAufEineKarte.aktiv) return "„Alles auf eine Karte“ läuft: die Freigabe ist ohnehin 100 %.";
      if (stand.anteil >= 1 - 1e-9) return "Schon voll freigegeben.";
      if ((stand.zustand.stufenAnhebung ?? 0) > 0) return "Die Freigabe wurde in dieser Saison schon angehoben.";
      if (deckel) return "Du hast einen Gehaltsdeckel zugesagt: die Freigabe darf diese Saison nicht steigen.";
      return null;
    case "sonder": {
      if (stand.alleAufEineKarte.aktiv) return "„Alles auf eine Karte“ läuft: es gibt keinen Vorbehalt.";
      if (deckel) return "Du hast einen Gehaltsdeckel zugesagt: das Gehaltsbudget wächst nicht.";
      if (stand.gehalt.gesperrt < 0.5) return "Es gibt keinen Vorbehalt im Gehaltstopf, den der Vorstand freigeben könnte.";
      if (!(antrag.betrag != null && antrag.betrag >= 0.5)) return "Bitte einen Betrag ab 0,5 C wählen.";
      return null;
    }
    case "anzapf":
      if (!fenster) return "Die Rücklage kann nur im Transferfenster angezapft werden.";
      if (stand.alleAufEineKarte.aktiv) return "„Alles auf eine Karte“ ist aktiv: die Rücklage ist ohnehin frei.";
      if (stand.ruecklageAnzapfen.moeglich < 0.5) return "Es lässt sich nichts mehr anzapfen.";
      if (!(antrag.betrag != null && antrag.betrag >= 0.5)) return "Bitte einen Betrag ab 0,5 C wählen.";
      return null;
    case "alles":
      if (!fenster) return "„Alles auf eine Karte“ geht nur im Transferfenster.";
      if (stand.alleAufEineKarte.aktiv) return "„Alles auf eine Karte“ läuft in dieser Saison bereits.";
      if (stand.vertrauen == null || stand.vertrauen < 4) return `Unter Vertrauen 4 traut der Vorstand dem Team die Wette nicht zu (jetzt ${stand.vertrauen == null ? "—" : stand.vertrauen.toFixed(1).replace(".", ",")}).`;
      return null;
    case "ziel": {
      const zeitFenster = zielTauschZeitfenster(gameState);
      if (!zeitFenster.erlaubt) return zeitFenster.grund;
      if (!antrag.zielId) return "Bitte das Ziel wählen, das getauscht werden soll.";
      const ziel = (gameState.seasonState.teamSeasonObjectives ?? []).find(
        (o) => o.seasonId === gameState.season.id && o.teamId === teamId && o.objectiveId === antrag.zielId,
      );
      if (!ziel) return "Dieses Ziel gibt es nicht.";
      if (!istZielTauschbar(ziel)) return "Dieses Ziel ist entschieden oder gehört nicht dem Vorstand und lässt sich nicht tauschen.";
      const alternativen = getTeamObjectivePool(gameState, teamId).filter(
        (k) => k.objectiveId !== ziel.objectiveId && k.status !== "completed" && k.status !== "failed" && !(gameState.seasonState.teamSeasonObjectives ?? []).some((o) => o.seasonId === gameState.season.id && o.teamId === teamId && o.objectiveId === k.objectiveId),
      );
      if (alternativen.length === 0) return "Der Vorstand hat kein anderes Ziel zur Hand.";
      return null;
    }
    case "liebling": {
      const l = lieblingFuerSaison(gameState, teamId);
      if (!l) return "Der Vorstand hat in dieser Saison keinen Lieblingsspieler.";
      if (!gameState.rosters.some((r) => r.teamId === teamId && r.playerId === l.playerId)) return "Der Lieblingsspieler ist schon nicht mehr im Kader.";
      if (z.lieblingFreigegeben) return "Der Verkauf ist schon freigegeben.";
      return null;
    }
  }
}

function zusageSperre(gameState: GameState, teamId: string, antrag: GespraechAntrag, zusage: VorstandZusageArt): string | null {
  const z = lesVorstandGespraech(gameState, teamId);
  if (z.zusagen.some((x) => x.art === zusage)) return "Schon zugesagt.";
  switch (zusage) {
    case "zielhoch":
      if (!verbindlichesRangZiel(gameState, teamId)) return "Es gibt kein verbindliches Rang-Ziel, das sich erhöhen ließe.";
      if (verbindlichesRangZiel(gameState, teamId)!.rang <= 1) return "Das Ziel ist schon Platz 1.";
      if (antrag.bitte === "ziel") return "Passt nicht zur Bitte: du tauschst gerade ein Ziel.";
      if (antrag.bitte === "alles") return "Passt nicht zur Bitte: „Alles auf eine Karte“ bringt sein eigenes Ziel mit.";
      return null;
    case "deckel":
      if (antrag.bitte === "sonder") return "Widerspricht der Bitte: du bittest ja um mehr Gehaltsbudget.";
      if (antrag.bitte === "stufe") return "Widerspricht der Bitte: eine höhere Freigabe hebt auch das Gehaltsbudget.";
      return null;
    case "vertrauen":
      return null;
    case "binden": {
      const l = lieblingFuerSaison(gameState, teamId);
      if (!l || !gameState.rosters.some((r) => r.teamId === teamId && r.playerId === l.playerId)) return "Es gibt keinen Lieblingsspieler im Kader.";
      if (verlaengertDieseSaison(gameState, teamId, l.playerId)) return "Der Lieblingsspieler ist in dieser Saison schon verlängert: das lässt sich nicht noch einmal zusagen.";
      if (antrag.bitte === "liebling") return "Widerspricht der Bitte: du willst ihn ja freigeben.";
      return null;
    }
  }
}

const ALLE_ZUSAGEN: VorstandZusageArt[] = ["zielhoch", "deckel", "vertrauen", "binden"];

function preisDerBitte(antrag: GespraechAntrag, stand: VorstandBudgetStand, charakter: GespraechCharakter): number {
  switch (antrag.bitte) {
    case "stufe":
      return BITTE_PREIS.stufe;
    case "sonder": {
      const vorbehalt = Math.max(0.5, stand.gehalt.gesperrt);
      return r1(BITTE_PREIS.sonder + BITTE_PREIS.sonderSpanne * Math.min(1, (antrag.betrag ?? 0) / vorbehalt));
    }
    case "anzapf": {
      const ziel = stand.herleitung.ruecklageZiel;
      const viertel = ziel > 0 ? Math.max(1, Math.ceil(Math.min(antrag.betrag ?? 0, ziel * 0.5) / (ziel / 4) - 1e-6)) : 1;
      return r1(BITTE_PREIS.anzapfJeViertel * viertel * ANZAPF_FAKTOR[charakter]);
    }
    case "alles":
      return BITTE_PREIS.alles;
    case "ziel":
      return BITTE_PREIS.ziel;
    case "liebling":
      return BITTE_PREIS.liebling;
  }
}

/**
 * Die Einschaetzung VOR dem Antrag: reicht es, fehlt es, geht es gar nicht. Rein lesend, kostet kein Gespraech.
 * Beim Gegenangebot waehlt der Vorstand die Zusagen mit dem hoechsten Wert fuer seinen Charakter, bis die Luecke zu ist.
 */
export function beurteileGespraech(gameState: GameState, teamId: string, antrag: GespraechAntrag): GespraechEinschaetzung {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  const { charakter, sparneigung } = gespraechCharakter(gameState, teamId);
  const vertrauen = stand.vertrauen;
  const zusagenVerfuegbar = Object.fromEntries(ALLE_ZUSAGEN.map((a) => [a, zusageSperre(gameState, teamId, antrag, a)])) as Record<VorstandZusageArt, string | null>;
  const gueltig = antrag.zusagen.filter((a) => zusagenVerfuegbar[a] == null);
  const sperre = bitteSperre(gameState, teamId, stand, antrag);
  const verlangt = preisDerBitte(antrag, stand, charakter);
  const gewicht = r1((vertrauen ?? 5) * 2 + gueltig.reduce((s, a) => s + ZUSAGE_WERT[a][charakter], 0));
  const luecke = r1(Math.max(0, verlangt - gewicht));
  let urteil: GespraechUrteil = luecke <= 0 ? "zustimmung" : luecke <= GEGENANGEBOT_SPANNE ? "gegenangebot" : "ablehnung";
  let vorschlag: VorstandZusageArt[] = [];
  if (sperre) {
    urteil = "ablehnung";
  } else if (urteil === "gegenangebot") {
    const frei = ALLE_ZUSAGEN.filter((a) => zusagenVerfuegbar[a] == null && !gueltig.includes(a)).sort(
      (a, b) => ZUSAGE_WERT[b][charakter] - ZUSAGE_WERT[a][charakter],
    );
    let rest = luecke;
    for (const a of frei) {
      if (rest <= 0) break;
      vorschlag.push(a);
      rest -= ZUSAGE_WERT[a][charakter];
    }
    if (rest > 0) {
      vorschlag = [];
      urteil = "ablehnung";
    }
  }
  const begruendung = sperre
    ? sperre
    : urteil === "zustimmung"
      ? `Er stimmt zu: Gewicht ${String(gewicht).replace(".", ",")} gegen ${String(verlangt).replace(".", ",")}.`
      : urteil === "gegenangebot"
        ? `Es fehlen ${String(luecke).replace(".", ",")} Punkte. Er würde zustimmen mit: ${vorschlag.map((a) => ZUSAGE_TEXT[a].titel).join(", ")}.`
        : `Es fehlen ${String(luecke).replace(".", ",")} Punkte, mehr als der Vorstand durch Zusagen ausgleichen lässt. Kleiner bitten oder später fragen.`;
  return { charakter, sparneigung, vertrauen, gewicht, verlangt, luecke, urteil, vorschlag, sperre, begruendung, zusagenVerfuegbar };
}

/* ============================================================ Wirkung */

function schreibeGespraech(gameState: GameState, teamId: string, z: VorstandGespraechZustand): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      vorstandGespraeche: { ...(gameState.seasonState.vorstandGespraeche ?? {}), [teamId]: z },
    },
  };
}

function schreibeBudgetZustand(gameState: GameState, teamId: string, z: VorstandBudgetZustand): GameState {
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      vorstandBudget: { ...(gameState.seasonState.vorstandBudget ?? {}), [teamId]: z },
    },
  };
}

function wende(
  gameState: GameState,
  teamId: string,
  antrag: GespraechAntrag,
): { ok: boolean; gameState: GameState; meldung: string; reason: string | null } {
  switch (antrag.bitte) {
    case "stufe": {
      const z = lesVorstandZustand(gameState, teamId);
      const next = schreibeBudgetZustand(gameState, teamId, {
        ...z,
        stufenAnhebung: 1,
        protokoll: [...z.protokoll, { zeit: new Date().toISOString(), art: "lockerung" as const, text: "Freigabe im Gespräch um eine Stufe angehoben" }].slice(-12),
      });
      const s = berechneVorstandBudgetStand(next, teamId);
      return { ok: true, gameState: next, meldung: `Der Vorstand hebt die Freigabe auf ${Math.round(s.wirksamerAnteil * 100)} % an.`, reason: null };
    }
    case "sonder": {
      const stand = berechneVorstandBudgetStand(gameState, teamId);
      const betrag = r2(Math.min(antrag.betrag ?? 0, stand.gehalt.gesperrt));
      const z = lesVorstandZustand(gameState, teamId);
      const next = schreibeBudgetZustand(gameState, teamId, {
        ...z,
        sonderGehalt: r2((z.sonderGehalt ?? 0) + betrag),
        protokoll: [...z.protokoll, { zeit: new Date().toISOString(), art: "umschichten" as const, text: `Sonderbudget Gehalt ${betrag.toFixed(1)} C aus dem Vorbehalt`, betrag }].slice(-12),
      });
      return { ok: true, gameState: next, meldung: `${betrag.toFixed(1).replace(".", ",")} C aus dem Vorbehalt gehen in den Gehaltstopf.`, reason: null };
    }
    case "anzapf": {
      const r = zapfeRuecklageAn(gameState, teamId, (berechneVorstandBudgetStand(gameState, teamId).ruecklageAnzapfen.bereitsAngezapft) + (antrag.betrag ?? 0));
      return { ok: r.ok, gameState: r.gameState, meldung: r.meldung, reason: r.reason };
    }
    case "alles": {
      const r = beantrageAlleAufEineKarte(gameState, teamId, "mensch", "Im Gespräch mit dem Vorstand vereinbart.");
      return { ok: r.ok, gameState: r.gameState, meldung: r.meldung, reason: r.reason };
    }
    case "ziel": {
      const r = tauscheVorstandsZiel(gameState, teamId, antrag.zielId ?? "");
      return { ok: r.ok, gameState: r.gameState, meldung: r.meldung, reason: r.reason };
    }
    case "liebling": {
      const z = lesVorstandGespraech(gameState, teamId);
      return {
        ok: true,
        gameState: schreibeGespraech(gameState, teamId, { ...z, lieblingFreigegeben: true }),
        meldung: "Der Vorstand gibt den Verkauf des Lieblingsspielers frei: kein Vertrauensverlust.",
        reason: null,
      };
    }
  }
}

function bindeZusagen(gameState: GameState, teamId: string, zusagen: VorstandZusageArt[]): GameState {
  const z = lesVorstandGespraech(gameState, teamId);
  const seit = new Date().toISOString();
  const neu = zusagen
    .filter((a) => !z.zusagen.some((x) => x.art === a))
    .map((art) => {
      if (art === "zielhoch") {
        const rang = verbindlichesRangZiel(gameState, teamId);
        return { art, seit, zielRang: rang ? Math.max(1, rang.rang - 1) : undefined };
      }
      if (art === "binden") return { art, seit, playerId: lieblingFuerSaison(gameState, teamId)?.playerId };
      return { art, seit };
    });
  return schreibeGespraech(gameState, teamId, { ...z, zusagen: [...z.zusagen, ...neu] });
}

function eintrag(
  antrag: GespraechAntrag,
  ausgang: VorstandGespraechProtokollEintrag["ausgang"],
  text: string,
  gewicht: number,
  verlangt: number,
  runde: number,
  zusagen: VorstandZusageArt[],
): VorstandGespraechProtokollEintrag {
  return { zeit: new Date().toISOString(), bitte: antrag.bitte, zusagen, ausgang, text, gewicht, verlangt, runde };
}

function ergebnis(gameState: GameState, ok: boolean, reason: string | null, meldung: string, ausgang: GespraechErgebnis["ausgang"]): GespraechErgebnis {
  return { ok, reason, meldung, ausgang, gameState };
}

/**
 * Formal ungueltiger Antrag (fehlender Betrag, fehlende oder unbekannte Ziel-Id, unbekannte Bitte): das ist ein Bedienfehler, keine
 * Verhandlung. Er verbraucht kein Gespraech und aendert nichts am Spielstand.
 */
export function formalFehlerImAntrag(gameState: GameState, teamId: string, antrag: GespraechAntrag): string | null {
  if (!(antrag.bitte in BITTE_TEXT)) return "Diese Bitte gibt es nicht.";
  if (antrag.bitte === "sonder" || antrag.bitte === "anzapf") {
    if (!(typeof antrag.betrag === "number" && Number.isFinite(antrag.betrag) && antrag.betrag > 0)) return "Es fehlt der Betrag.";
  }
  if (antrag.bitte === "ziel") {
    if (!antrag.zielId) return "Es fehlt das Ziel, das getauscht werden soll.";
    const da = (gameState.seasonState.teamSeasonObjectives ?? []).some(
      (o) => o.seasonId === gameState.season.id && o.teamId === teamId && o.objectiveId === antrag.zielId,
    );
    if (!da) return "Dieses Ziel gibt es nicht.";
  }
  return null;
}

/** Der Antrag: verbraucht ein Gespraech (ausser in Runde 2 eines Gegenangebots) und wendet bei Zustimmung die Wirkung an. */
export function stelleGespraechAntrag(gameState: GameState, teamId: string, antrag: GespraechAntrag): GespraechErgebnis {
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  const z0 = lesVorstandGespraech(gameState, teamId);
  if (!stand.gedeckelt) return ergebnis(gameState, false, "nicht_aktiv", "Vor Saison 2 ist alles freigegeben: es gibt nichts zu verhandeln.", null);
  const formal = formalFehlerImAntrag(gameState, teamId, antrag);
  if (formal) return ergebnis(gameState, false, "antrag_unvollstaendig", formal, null);
  if (z0.offen && (z0.offen.bitte !== antrag.bitte)) {
    return ergebnis(gameState, false, "gespraech_offen", "Ein Gegenangebot ist offen: erst annehmen, nachbessern oder zurückziehen.", null);
  }
  if (!z0.offen && z0.genutzt >= GESPRAECHE_JE_SAISON) {
    return ergebnis(gameState, false, "keine_gespraeche", `Beide Gespräche dieser Saison sind verbraucht.`, null);
  }
  const runde = (z0.offen?.runde ?? 0) + 1;
  const einschaetzung = beurteileGespraech(gameState, teamId, antrag);
  const gueltigeZusagen = antrag.zusagen.filter((a) => einschaetzung.zusagenVerfuegbar[a] == null);
  // Jeder gestellte Antrag verbraucht ein Gespraech (nicht Runde 2 desselben).
  const genutzt = z0.offen ? z0.genutzt : z0.genutzt + 1;
  let z: VorstandGespraechZustand = { ...z0, genutzt, offen: null };

  if (einschaetzung.sperre) {
    z = { ...z, protokoll: [...z.protokoll, eintrag(antrag, "ablehnung", einschaetzung.sperre, einschaetzung.gewicht, einschaetzung.verlangt, runde, gueltigeZusagen)].slice(-12) };
    return ergebnis(schreibeGespraech(gameState, teamId, z), true, "abgelehnt", `Der Vorstand lehnt ab: ${einschaetzung.sperre}`, "ablehnung");
  }
  if (einschaetzung.urteil === "zustimmung") {
    const w = wende(schreibeGespraech(gameState, teamId, z), teamId, antrag);
    if (!w.ok) {
      // Die Wirkfunktion hat abgelehnt (feste Regel dort): das Gespraech ist trotzdem verbraucht.
      const z2: VorstandGespraechZustand = { ...lesVorstandGespraech(w.gameState, teamId), genutzt, offen: null };
      const z3 = { ...z2, protokoll: [...z2.protokoll, eintrag(antrag, "ablehnung", w.meldung, einschaetzung.gewicht, einschaetzung.verlangt, runde, gueltigeZusagen)].slice(-12) };
      return ergebnis(schreibeGespraech(w.gameState, teamId, z3), true, "abgelehnt", `Der Vorstand lehnt ab: ${w.meldung}`, "ablehnung");
    }
    let next = bindeZusagen(w.gameState, teamId, gueltigeZusagen);
    const z2 = lesVorstandGespraech(next, teamId);
    next = schreibeGespraech(next, teamId, {
      ...z2,
      genutzt,
      offen: null,
      protokoll: [...z2.protokoll, eintrag(antrag, "zustimmung", w.meldung, einschaetzung.gewicht, einschaetzung.verlangt, runde, gueltigeZusagen)].slice(-12),
    });
    return ergebnis(next, true, null, w.meldung, "zustimmung");
  }
  if (einschaetzung.urteil === "gegenangebot" && runde < GESPRAECH_RUNDEN) {
    const offen: VorstandGespraechOffen = {
      bitte: antrag.bitte,
      betrag: antrag.betrag,
      zielId: antrag.zielId,
      zusagen: gueltigeZusagen,
      vorschlag: einschaetzung.vorschlag,
      runde,
      gewicht: einschaetzung.gewicht,
      verlangt: einschaetzung.verlangt,
    };
    z = { ...z, offen, protokoll: [...z.protokoll, eintrag(antrag, "gegenangebot", einschaetzung.begruendung, einschaetzung.gewicht, einschaetzung.verlangt, runde, gueltigeZusagen)].slice(-12) };
    return ergebnis(schreibeGespraech(gameState, teamId, z), true, "gegenangebot", einschaetzung.begruendung, "gegenangebot");
  }
  z = { ...z, protokoll: [...z.protokoll, eintrag(antrag, "ablehnung", einschaetzung.begruendung, einschaetzung.gewicht, einschaetzung.verlangt, runde, gueltigeZusagen)].slice(-12) };
  return ergebnis(schreibeGespraech(gameState, teamId, z), true, "abgelehnt", `Der Vorstand lehnt ab. ${einschaetzung.begruendung}`, "ablehnung");
}

/** Das Gegenangebot annehmen: die Zusagen des Vorstands werden mit gebunden, die Bitte wirkt. */
export function nimmGegenangebotAn(gameState: GameState, teamId: string): GespraechErgebnis {
  const z0 = lesVorstandGespraech(gameState, teamId);
  const offen = z0.offen;
  if (!offen) return ergebnis(gameState, false, "kein_gegenangebot", "Es gibt kein offenes Gegenangebot.", null);
  const antrag: GespraechAntrag = {
    bitte: offen.bitte,
    betrag: offen.betrag,
    zielId: offen.zielId,
    zusagen: Array.from(new Set([...offen.zusagen, ...offen.vorschlag])),
  };
  const einschaetzung = beurteileGespraech(gameState, teamId, antrag);
  const zusagen = antrag.zusagen.filter((a) => einschaetzung.zusagenVerfuegbar[a] == null);
  const ohneOffen = schreibeGespraech(gameState, teamId, { ...z0, offen: null });
  if (einschaetzung.sperre || einschaetzung.urteil !== "zustimmung") {
    return ergebnis(ohneOffen, false, "gegenangebot_verfallen", "Das Gegenangebot gilt nicht mehr: die Lage hat sich geändert.", null);
  }
  const w = wende(ohneOffen, teamId, antrag);
  if (!w.ok) return ergebnis(ohneOffen, false, w.reason, w.meldung, null);
  let next = bindeZusagen(w.gameState, teamId, zusagen);
  const z2 = lesVorstandGespraech(next, teamId);
  next = schreibeGespraech(next, teamId, {
    ...z2,
    offen: null,
    protokoll: [...z2.protokoll, eintrag(antrag, "zustimmung", `Gegenangebot angenommen. ${w.meldung}`, einschaetzung.gewicht, einschaetzung.verlangt, offen.runde + 1, zusagen)].slice(-12),
  });
  return ergebnis(next, true, null, w.meldung, "zustimmung");
}

/** Zurueckziehen: das Gespraech bleibt verbraucht, es wird nichts gebunden. */
export function ziehGegenangebotZurueck(gameState: GameState, teamId: string): GespraechErgebnis {
  const z0 = lesVorstandGespraech(gameState, teamId);
  if (!z0.offen) return ergebnis(gameState, false, "kein_gegenangebot", "Es gibt kein offenes Gegenangebot.", null);
  const antrag: GespraechAntrag = { bitte: z0.offen.bitte, zusagen: z0.offen.zusagen };
  const z = {
    ...z0,
    offen: null,
    protokoll: [...z0.protokoll, eintrag(antrag, "zurueckgezogen", "Antrag zurückgezogen, nichts vereinbart.", z0.offen.gewicht, z0.offen.verlangt, z0.offen.runde, z0.offen.zusagen)].slice(-12),
  };
  return ergebnis(schreibeGespraech(gameState, teamId, z), true, null, "Zurückgezogen. Das Gespräch bleibt verbraucht, nichts wurde vereinbart.", "zurueckgezogen");
}

/** Gesperrt: positive Umschichtung ins Gehalt bei zugesagtem Gehaltsdeckel (wird von `setzeUmschichtung` gefragt). */
export function gehaltsdeckelAktiv(gameState: GameState, teamId: string): boolean {
  return lesVorstandGespraech(gameState, teamId).zusagen.some((x) => x.art === "deckel");
}
