/**
 * BUDGET-GESPRAECH MIT DEM VORSTAND (23.11., Chris 22.11.: „das budget von gehalt und transfers schon in S1 einfuehren … ein screen,
 * wo man als menschlicher spieler erstmal die budgets mit dem vorstand verhandelt“, „ja S1 auch mit Vertrauen aus Identitaet, nicht 100 %“).
 * Konzept: docs/design/budget-gespraech-s1-22-11.md, Mockup: public/mockups/budget-gespraech-22-11.html.
 *
 * Ein GEFUEHRTER Antrag (mehrere Bitten und Zusagen, ein Urteil) auf derselben Regel wie `beurteileGespraech`:
 *   Gewicht = Vertrauen x 2 + Wert der Zusagen (je Charakter), Preis = Summe der Bitten.
 *   Gewicht >= Preis -> Zusage; Luecke <= 10 und Zusagen decken -> Gegenangebot; sonst Ablehnung. Kein Wuerfel.
 *
 * KEINE ZWEITE WAHRHEIT: die Wirkung laeuft ueber die vorhandenen Felder in `seasonState.vorstandBudget`
 * (`stufenAnhebung`, `stufenSenkung`, `ruecklageVoll`, `ruecklageAngezapft`, `alleAufEineKarte`, `umschichtung`); die gezeigten Zahlen
 * kommen aus `berechneVorstandBudgetStand` auf dem Stand NACH der Wahl — gezeigt = gebucht. Der Stempel `seasonState.budgetVereinbarung`
 * ist das Protokoll und das Tor vor Draft (Saison 1) bzw. Transferfenster (ab Saison 2).
 *
 * Das Gespraech zaehlt NICHT als eines der zwei Gespraeche je Saison (PM-Entscheid 23.11., Frage 4). Alles hier ist rein
 * (GameState rein, GameState raus); persistiert wird in `app/api/finance/vorstand/route.ts` hinter `authorizeServerRoomWrite`.
 */

import { getTeamObjectives } from "@/lib/board/team-season-objectives-service";
import type {
  BudgetVereinbarungStempel,
  GameState,
  VorstandBudgetZustand,
  VorstandZusageArt,
} from "@/lib/data/olyDataTypes";
import {
  beantrageAlleAufEineKarte,
  kiCharakter,
  setzeUmschichtung,
  zapfeRuecklageAn,
} from "@/lib/finance/vorstand-budget-aktionen";
import {
  ANZAPFEN_VERTRAUEN_JE_VIERTEL,
  berechneVorstandBudgetStand,
  lesVorstandZustand,
  QUOTEN_STUFEN,
  stufeFuerVertrauen,
  VORSTAND_STUFEN,
  type VorstandBudgetStand,
} from "@/lib/finance/vorstand-budgetfreigabe";
import {
  ANZAPF_FAKTOR,
  BITTE_PREIS,
  BUDGET_PREIS_ZIEL_SENKEN,
  BUDGET_ZUSAGE_WERT,
  GEGENANGEBOT_SPANNE,
  gespraechCharakter,
  imFenster,
  ZUSAGE_WERT,
  type GespraechCharakter,
} from "@/lib/finance/vorstand-gespraech";
import { lesVorstandGespraech } from "@/lib/finance/vorstand-gespraech-zustand";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";
import { toepfeAbSaison1 } from "@/lib/resolve/wirtschafts-regeln";

export type BudgetAmbition = "tief" | "ziel" | "hoch" | "alles";
export type BudgetRuecklage = "vorsichtig" | "normal" | "mutig";
export type BudgetZusage = "deckel" | "vertrauen";

export type BudgetWahl = {
  ambition: BudgetAmbition;
  ruecklage: BudgetRuecklage;
  /** + = Transfer -> Gehalt (C Jahresgehalt). */
  umschichtung: number;
  /** Zusagen, die der Vorstand beim Gegenangebot zusaetzlich verlangt (oder die der Mensch von sich aus gibt). */
  zusagen: BudgetZusage[];
};

/** Der Vorschlag des Vorstands: keine Bitte ueber ihn hinaus. */
export const BUDGET_VORSCHLAG: BudgetWahl = { ambition: "ziel", ruecklage: "normal", umschichtung: 0, zusagen: [] };

export const BUDGET_ZUSAGE_TEXT: Record<BudgetZusage, string> = {
  deckel: "Gehaltsdeckel (kein Umschichten ins Gehalt)",
  vertrauen: "Vertrauen einsetzen (−0,25)",
};

/** Ids der Ziele aus dem Budget-Gespraech. Ihre Vertrauens-Deltas wirken erst bei der naechsten Festlegung (nicht in der laufenden Quote). */
export const BUDGET_ZIEL_TIEF_ID = "vorstand-budget-ziel-tief";
export const BUDGET_RUECKLAGE_VOLL_ID = "vorstand-budget-ruecklage-voll";

export type BudgetPosten = { text: string; punkte: number };

export type BudgetUrteil = {
  charakter: GespraechCharakter;
  vertrauen: number | null;
  /** Quote des Vorstands-Vorschlags (nach Vertrauen, ohne Wahl). */
  quoteBasis: number;
  bitten: BudgetPosten[];
  zusagen: BudgetPosten[];
  preis: number;
  basis: number;
  gewicht: number;
  luecke: number;
  urteil: "zustimmung" | "gegenangebot" | "ablehnung";
  /** Zusagen, die der Vorstand beim Gegenangebot zusaetzlich will. */
  vorschlag: BudgetZusage[];
  sperre: string | null;
  /** Zielrang dieser Wahl (null, wenn es kein Rang-Ziel gibt). */
  zielRang: number | null;
  /** Vertrauen bei erreichtem / verfehltem Ziel und sofort (Rücklage, Zusagen; gebucht bei der naechsten Festlegung). */
  folge: { ok: number; nein: number; sofort: number };
  /** Der Stand, der NACH dieser Wahl gilt (bei Ablehnung: der Vorschlag). */
  stand: VorstandBudgetStand;
  /** Der Stand des Vorschlags, zum Vergleich. */
  standVorschlag: VorstandBudgetStand;
  /** Die Wahl, die tatsaechlich wirkt (bei Zusage die gewaehlte, sonst der Vorschlag). */
  wirksam: BudgetWahl;
};

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

function saisonNr(gameState: GameState): number {
  return Number(/(\d+)\s*$/.exec(gameState.season?.id ?? "")?.[1] ?? 1);
}

function hoehereQuote(q: number): number {
  return QUOTEN_STUFEN.find((x) => x > q + 1e-9) ?? 1;
}

/* ============================================================== Rang-Ziel */

/** Der Rang, den der Vorstand erwartet (verbindliches Rang-Ziel dieser Saison), sonst null. */
export function vorstandZielRang(gameState: GameState, teamId: string): number | null {
  const lies = (wert: unknown): number | null => {
    if (typeof wert === "number" && Number.isFinite(wert)) return wert;
    if (typeof wert === "string") {
      const m = /(\d+)/.exec(wert);
      if (m) return Number(m[1]);
    }
    return null;
  };
  // Saison 1 vor dem Draft: kein Kader, also keine Staerke. Der Vorstand erwartet nach dem Startbudget (Rang in der Liga), mit demselben
  // Abstand wie das Erwartungsziel `expectation-rank` (1 + Ambition / 3 Plaetze besser). Nach dem Draft gilt das echte Ziel.
  if (gameState.rosters.filter((r) => r.teamId === teamId).length < 1) {
    const start = schaetzeStartZielRang(gameState, teamId);
    if (start != null) return start;
  }
  const ziele = (gameState.seasonState.teamSeasonObjectives ?? []).filter((o) => o.seasonId === gameState.season.id && o.teamId === teamId);
  const gespeichert = ziele.find((o) => !o.optional && (o.objectiveId === "expectation-rank" || /^sport-rank-\d+$/.test(o.objectiveId)));
  if (gespeichert) return lies(gespeichert.targetValue);
  // Frisch gerechnet (Saison 1 vor dem Draft gibt es noch keine gespeicherten Ziele). Der Rang haengt nicht an der Wahl, deshalb je
  // Kaderstand einmal (die Stempel-Schleife ueber 32 Teams baut sonst 32 Mal die ganze Zielliste der Liga).
  const bekannt = RANG_CACHE.get(gameState.rosters);
  if (bekannt?.has(teamId)) return bekannt.get(teamId) ?? null;
  let rang: number | null = null;
  try {
    const frisch = getTeamObjectives(gameState, teamId).find((o) => !o.optional && (o.objectiveId === "expectation-rank" || /^sport-rank-\d+$/.test(o.objectiveId)));
    rang = frisch ? lies(frisch.targetValue) : null;
  } catch {
    rang = null;
  }
  const karte = bekannt ?? new Map<string, number | null>();
  karte.set(teamId, rang);
  RANG_CACHE.set(gameState.rosters, karte);
  return rang;
}

const RANG_CACHE = new WeakMap<object, Map<string, number | null>>();

/** Erwartetes Rang-Ziel vor dem ersten Pick: Rang des Startbudgets in der eigenen Liga, abzueglich des Abstands `1 + Ambition / 3`. */
function schaetzeStartZielRang(gameState: GameState, teamId: string): number | null {
  const teams = gameState.teams;
  const liga = isLeagueSplitActive(gameState) ? getLeagueOf(gameState, teamId) : null;
  const gleiche = teams.filter((t) => !liga || getLeagueOf(gameState, t.teamId) === liga);
  const wert = (t: { budget?: number; cash?: number }) => t.budget ?? t.cash ?? 0;
  const ich = gleiche.find((t) => t.teamId === teamId);
  if (!ich || gleiche.length < 2) return null;
  const rang = 1 + gleiche.filter((t) => t.teamId !== teamId && wert(t) > wert(ich)).length;
  const amb = gameState.teamIdentities?.find((i) => i.teamId === teamId)?.ambition;
  const ambition = typeof amb === "number" ? (amb > 10 ? amb / 10 : amb) : 5;
  const abstand = Math.max(1, Math.round(1 + ambition / 3));
  return Math.min(gleiche.length, Math.max(1, rang - abstand));
}

/* ============================================================== Zustand */

/** Der Zustand ohne jede Wahl dieses Gespraechs (Ruecklage, Umschichten, Stufen, „Alles“ zurueck), Protokoll bleibt. */
function ohneWahl(gameState: GameState, teamId: string): GameState {
  const z = lesVorstandZustand(gameState, teamId);
  const frisch: VorstandBudgetZustand = {
    ...z,
    umschichtung: 0,
    ruecklageAngezapft: 0,
    vertrauensKosten: 0,
    alleAufEineKarte: null,
    stufenAnhebung: 0,
    stufenSenkung: 0,
    ruecklageVoll: false,
    zielTief: null,
    letzterAntragAbgelehnt: null,
  };
  const alt = gameState.seasonState.budgetVereinbarung?.[teamId];
  let gs: GameState = {
    ...gameState,
    seasonState: { ...gameState.seasonState, vorstandBudget: { ...(gameState.seasonState.vorstandBudget ?? {}), [teamId]: frisch } },
  };
  // Zusagen, die ein frueheres Budget-Gespraech gebunden hat, fallen beim Neuverhandeln weg (die des Office-Gespraechs bleiben).
  if (alt && alt.seasonId === gameState.season.id && alt.zusagen.length > 0) {
    const g = lesVorstandGespraech(gs, teamId);
    gs = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        vorstandGespraeche: {
          ...(gs.seasonState.vorstandGespraeche ?? {}),
          [teamId]: { ...g, zusagen: g.zusagen.filter((x) => !alt.zusagen.includes(`budget:${x.art}`)) },
        },
      },
    };
  }
  return gs;
}

function bindeBudgetZusage(gameState: GameState, teamId: string, art: VorstandZusageArt, zielRang?: number): GameState {
  const g = lesVorstandGespraech(gameState, teamId);
  if (g.zusagen.some((x) => x.art === art)) return gameState;
  return {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      vorstandGespraeche: {
        ...(gameState.seasonState.vorstandGespraeche ?? {}),
        [teamId]: { ...g, zusagen: [...g.zusagen, { art, seit: new Date().toISOString(), ...(zielRang != null ? { zielRang } : {}) }] },
      },
    },
  };
}

/** Wendet eine (bereits als zugesagt beurteilte) Wahl an. Reine Funktion; die Wirkfunktionen halten ihre harten Grenzen ein. */
function wendeWahl(gameState: GameState, teamId: string, wahl: BudgetWahl, quelle: "mensch" | "ki"): { gameState: GameState; gebunden: string[] } {
  let gs = ohneWahl(gameState, teamId);
  const gebunden: string[] = [];
  const stand0 = berechneVorstandBudgetStand(gs, teamId);
  const zielRang = vorstandZielRang(gs, teamId);
  const mitZustand = (f: (z: VorstandBudgetZustand) => VorstandBudgetZustand) => {
    const z = lesVorstandZustand(gs, teamId);
    gs = { ...gs, seasonState: { ...gs.seasonState, vorstandBudget: { ...(gs.seasonState.vorstandBudget ?? {}), [teamId]: f(z) } } };
  };
  if (wahl.ambition === "alles") {
    const r = beantrageAlleAufEineKarte(gs, teamId, quelle === "ki" ? "ki" : "mensch", "Im Budget-Gespräch mit dem Vorstand vereinbart.");
    if (r.ok) gs = r.gameState;
  } else {
    if (wahl.ambition === "hoch" && stand0.anteil < 1 - 1e-9) {
      mitZustand((z) => ({ ...z, stufenAnhebung: 1 }));
    }
    if (wahl.ambition === "hoch" && zielRang != null && zielRang > 1) {
      gs = bindeBudgetZusage(gs, teamId, "zielhoch", zielRang - 1);
      gebunden.push("budget:zielhoch");
    }
    if (wahl.ambition === "tief") {
      mitZustand((z) => ({ ...z, stufenSenkung: 1, zielTief: zielRang != null ? { zielRang: zielRang + 2, basisRang: zielRang } : null }));
    }
    if (wahl.ruecklage === "vorsichtig") mitZustand((z) => ({ ...z, ruecklageVoll: true }));
    if (wahl.ruecklage === "mutig") {
      const s = berechneVorstandBudgetStand(gs, teamId);
      const r = zapfeRuecklageAn(gs, teamId, r2(s.herleitung.ruecklageZiel * 0.5));
      if (r.ok) gs = r.gameState;
    }
  }
  for (const a of wahl.zusagen) {
    if (a === "deckel") {
      gs = bindeBudgetZusage(gs, teamId, "deckel");
      gebunden.push("budget:deckel");
    }
    if (a === "vertrauen") {
      gs = bindeBudgetZusage(gs, teamId, "vertrauen");
      gebunden.push("budget:vertrauen");
    }
  }
  if (Math.abs(wahl.umschichtung) > 1e-9) {
    const r = setzeUmschichtung(gs, teamId, wahl.umschichtung);
    if (r.ok) gs = r.gameState;
  }
  return { gameState: gs, gebunden };
}

/* ============================================================== Urteil */

/** Die Sperre vor dem Beurteilen: wann das Gespraech gar nicht geht (null = geht). */
export function budgetGespraechSperre(gameState: GameState, teamId: string): string | null {
  if (!toepfeAbSaison1(gameState)) return "In dieser Saison gilt noch der alte Weg: es gibt kein Budget-Gespräch.";
  if (!imFenster(gameState)) return "Das Budget-Gespräch gibt es nur vor dem Draft bzw. im Transferfenster.";
  if (kaeufeDieserSaison(gameState, teamId) > 0) return "Es wurde schon gekauft: die Vereinbarung steht. Nachverhandeln geht im Office (zwei Gespräche je Saison).";
  return null;
}

/** Anzahl Kaeufe dieses Teams in der laufenden Saison (Draft-Picks zaehlen mit). */
export function kaeufeDieserSaison(gameState: GameState, teamId: string): number {
  return (gameState.transferHistory ?? []).filter((e) => e.seasonId === gameState.season.id && e.transferType === "buy" && e.toTeamId === teamId).length;
}

/** Beurteilt eine Wahl: Preis, Gewicht, Urteil, und den Stand, der danach gilt. Rein lesend. */
export function beurteileBudgetWahl(gameState: GameState, teamId: string, wahl: BudgetWahl): BudgetUrteil {
  const basisGs = ohneWahl(gameState, teamId);
  const standVorschlag = berechneVorstandBudgetStand(basisGs, teamId);
  const { charakter } = gespraechCharakter(gameState, teamId);
  const vertrauen = standVorschlag.vertrauen;
  const q0 = standVorschlag.anteil;
  const zielRang = vorstandZielRang(basisGs, teamId);
  const bitten: BudgetPosten[] = [];
  const zusagen: BudgetPosten[] = [];
  let sperre: string | null = budgetGespraechSperre(gameState, teamId);
  if (wahl.ambition === "alles") {
    bitten.push({ text: "Alles auf eine Karte", punkte: BITTE_PREIS.alles });
    if (vertrauen == null || vertrauen < 4) {
      sperre ??= `Unter Vertrauen 4 gibt es „Alles auf eine Karte“ nicht (jetzt ${vertrauen == null ? "—" : vertrauen.toFixed(1).replace(".", ",")}).`;
    }
  } else {
    if (wahl.ambition === "hoch") {
      if (zielRang != null && zielRang > 1) zusagen.push({ text: "Ziel einen Platz besser", punkte: ZUSAGE_WERT.zielhoch[charakter] });
      if (q0 < 1 - 1e-9) bitten.push({ text: "Freigabe eine Stufe höher", punkte: BITTE_PREIS.stufe });
    }
    if (wahl.ambition === "tief") {
      bitten.push({ text: "Ziel zwei Plätze tiefer", punkte: BUDGET_PREIS_ZIEL_SENKEN[charakter] });
      zusagen.push({ text: "Freigabe eine Stufe tiefer", punkte: BUDGET_ZUSAGE_WERT.stufeTiefer[charakter] });
    }
    if (wahl.ruecklage === "mutig") bitten.push({ text: "Rücklage zur Hälfte anzapfen", punkte: r1(2 * BITTE_PREIS.anzapfJeViertel * ANZAPF_FAKTOR[charakter]) });
    if (wahl.ruecklage === "vorsichtig") zusagen.push({ text: "Rücklage voll halten", punkte: BUDGET_ZUSAGE_WERT.ruecklageVoll[charakter] });
  }
  for (const a of wahl.zusagen) {
    if (a === "deckel" && wahl.umschichtung > 1e-9) sperre ??= "Ein Gehaltsdeckel verträgt sich nicht mit Umschichten ins Gehalt.";
    zusagen.push({ text: BUDGET_ZUSAGE_TEXT[a], punkte: ZUSAGE_WERT[a === "deckel" ? "deckel" : "vertrauen"][charakter] });
  }
  const preis = r1(bitten.reduce((s, b) => s + b.punkte, 0));
  const basis = r1((vertrauen ?? 5) * 2);
  const gewicht = r1(basis + zusagen.reduce((s, z) => s + z.punkte, 0));
  const luecke = r1(Math.max(0, preis - gewicht));
  let urteil: BudgetUrteil["urteil"] = luecke <= 0 ? "zustimmung" : luecke <= GEGENANGEBOT_SPANNE ? "gegenangebot" : "ablehnung";
  let vorschlag: BudgetZusage[] = [];
  if (sperre) urteil = "ablehnung";
  else if (urteil === "gegenangebot") {
    const frei = (["deckel", "vertrauen"] as BudgetZusage[])
      .filter((a) => !wahl.zusagen.includes(a) && !(a === "deckel" && wahl.umschichtung > 1e-9))
      .sort((a, b) => ZUSAGE_WERT[b][charakter] - ZUSAGE_WERT[a][charakter]);
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
  const wirksam: BudgetWahl = urteil === "zustimmung" ? wahl : BUDGET_VORSCHLAG;
  const { gameState: nach } = wendeWahl(gameState, teamId, wirksam, "mensch");
  const stand = urteil === "zustimmung" ? berechneVorstandBudgetStand(nach, teamId) : standVorschlag;
  const alles = wirksam.ambition === "alles" && stand.alleAufEineKarte.aktiv;
  const amb = alles ? "alles" : wirksam.ambition;
  const folge =
    amb === "alles"
      ? { ok: 0.75, nein: -1 }
      : amb === "hoch"
        ? { ok: 0.5, nein: -0.9 }
        : amb === "tief"
          ? { ok: 0.3, nein: -0.4 }
          : { ok: 0.5, nein: -0.4 };
  const viertel = wirksam.ruecklage === "mutig" ? 2 : 0;
  const sofort = r2(
    (urteil === "zustimmung" && wirksam.zusagen.includes("vertrauen") ? -0.25 : 0) +
      (amb === "alles" ? 0 : viertel * -ANZAPFEN_VERTRAUEN_JE_VIERTEL) +
      (wirksam.ruecklage === "vorsichtig" && amb !== "alles" ? 0.2 : 0),
  );
  const zielRangWirksam = zielRang == null ? null : amb === "alles" ? Math.max(1, zielRang - 2) : amb === "hoch" ? Math.max(1, zielRang - 1) : amb === "tief" ? zielRang + 2 : zielRang;
  return { charakter, vertrauen, quoteBasis: q0, bitten, zusagen, preis, basis, gewicht, luecke, urteil, vorschlag, sperre, zielRang: zielRangWirksam, folge: { ...folge, sofort }, stand, standVorschlag, wirksam };
}

/* ============================================================== Vereinbarung stempeln */

export type BudgetUnterschrift = { ok: boolean; reason: string | null; meldung: string; gameState: GameState };

function stempelDaten(gs: GameState, teamId: string, wahl: BudgetWahl, gebunden: string[], gefuehrtVon: BudgetVereinbarungStempel["gefuehrtVon"], ownerId: string | null, quoteBasis: number): BudgetVereinbarungStempel {
  const stand = berechneVorstandBudgetStand(gs, teamId);
  const alles = stand.alleAufEineKarte.aktiv;
  return {
    seasonId: gs.season.id,
    gefuehrtVon,
    ownerId,
    zeit: new Date().toISOString(),
    vertrauenStart: stand.vertrauen,
    quoteBasis,
    quote: stand.wirksamerAnteil,
    ambition: alles ? "alles" : wahl.ambition,
    zielRang: alles ? stand.alleAufEineKarte.zustand?.zielRang ?? null : vorstandZielRang(gs, teamId),
    ruecklageStufe: alles ? "normal" : wahl.ruecklage,
    umschichtung: stand.umschichten.aktuell,
    zusagen: gebunden,
    transferTopf: stand.investition.gesamt,
    gehaltsTopf: stand.gehalt.gesamt,
  };
}

function schreibeStempel(gs: GameState, teamId: string, st: BudgetVereinbarungStempel): GameState {
  return { ...gs, seasonState: { ...gs.seasonState, budgetVereinbarung: { ...(gs.seasonState.budgetVereinbarung ?? {}), [teamId]: st } } };
}

/** Hat dieses Team in der laufenden Saison eine Vereinbarung? */
export function lesBudgetVereinbarung(gameState: GameState, teamId: string): BudgetVereinbarungStempel | null {
  const st = gameState.seasonState.budgetVereinbarung?.[teamId];
  return st && st.seasonId === gameState.season.id ? st : null;
}

/** Der Mensch unterschreibt seine Wahl. Nur eine zugesagte Wahl (oder der Vorschlag) wird gestempelt. */
export function unterschreibeBudgetVereinbarung(gameState: GameState, teamId: string, wahl: BudgetWahl, ownerId: string | null): BudgetUnterschrift {
  const sperre = budgetGespraechSperre(gameState, teamId);
  if (sperre) return { ok: false, reason: "budget_gespraech_gesperrt", meldung: sperre, gameState };
  const u = beurteileBudgetWahl(gameState, teamId, wahl);
  if (u.urteil !== "zustimmung") {
    return { ok: false, reason: "vorstand_stimmt_nicht_zu", meldung: u.sperre ?? "Der Vorstand stimmt dieser Wahl nicht zu: erst das Gegenangebot annehmen oder kleiner bitten.", gameState };
  }
  const r = wendeWahl(gameState, teamId, u.wirksam, "mensch");
  const ist = berechneVorstandBudgetStand(r.gameState, teamId);
  if (u.wirksam.ambition === "alles" && !ist.alleAufEineKarte.aktiv) {
    return { ok: false, reason: "alles_nicht_moeglich", meldung: "„Alles auf eine Karte“ geht gerade nicht.", gameState };
  }
  const st = stempelDaten(r.gameState, teamId, u.wirksam, r.gebunden, "mensch", ownerId, u.quoteBasis);
  return { ok: true, reason: null, meldung: "Vereinbart. Die zwei Töpfe gelten ab dem ersten Pick.", gameState: schreibeStempel(r.gameState, teamId, st) };
}

/** Es gilt der Vorschlag des Vorstands (kein Mensch hat verhandelt, oder die Frist ist abgelaufen). */
export function stempleVorschlag(gameState: GameState, teamId: string, ownerId: string | null = null): GameState {
  if (lesBudgetVereinbarung(gameState, teamId)) return gameState;
  const r = wendeWahl(gameState, teamId, BUDGET_VORSCHLAG, "ki");
  const q0 = berechneVorstandBudgetStand(ohneWahl(gameState, teamId), teamId).anteil;
  return schreibeStempel(r.gameState, teamId, stempelDaten(r.gameState, teamId, BUDGET_VORSCHLAG, r.gebunden, "vorschlag", ownerId, q0));
}

/* ============================================================== KI */

/**
 * Die Wahl der KI: dieselbe Regel und dieselben Funktionen wie beim Menschen (Konzept Abschnitt 4). Ihr Antrag kommt aus dem Charakter
 * (Risikobereitschaft unter 4 vorsichtig, ueber 7 aggressiv). Nimmt der Vorstand nicht zu, gilt der Vorschlag.
 */
export function kiBudgetWahl(gameState: GameState, teamId: string): BudgetWahl {
  const charakter = kiCharakter(gameState, teamId);
  const identity = gameState.teamIdentities?.find((i) => i.teamId === teamId);
  const ambition = typeof identity?.ambition === "number" ? (identity.ambition > 10 ? identity.ambition / 10 : identity.ambition) : 5;
  const basisGs = ohneWahl(gameState, teamId);
  const stand0 = berechneVorstandBudgetStand(basisGs, teamId);
  const zielRang = vorstandZielRang(basisGs, teamId);
  const wahl: BudgetWahl = { ambition: "ziel", ruecklage: charakter === "vorsichtig" ? "vorsichtig" : "normal", umschichtung: 0, zusagen: [] };
  if (charakter === "aggressiv" && ambition >= 7 && zielRang != null && zielRang > 1) wahl.ambition = "hoch";
  const rosterCount = gameState.rosters.filter((r) => r.teamId === teamId).length;
  const sollKader = Math.max(8, Math.round(identity?.playerOpt ?? 11));
  if (charakter === "aggressiv" && saisonNr(gameState) >= 2 && rosterCount < sollKader) wahl.ruecklage = "mutig";
  // Aufteilung: in den Topf, der zuerst bindet (Ablösen oder Gehalt fuer den Soll-Kader), vorsichtig 0, normal halbe, aggressiv volle Grenze.
  const anteil = charakter === "vorsichtig" ? 0 : charakter === "normal" ? 0.5 : 1;
  if (anteil > 0) {
    const fee = Math.max(1, stand0.kaderpflicht.platzAbloese);
    const geh = Math.max(0.1, stand0.kaderpflicht.platzGehalt);
    const gehaltBindet = stand0.gehalt.gesamt / geh < stand0.investition.gesamt / fee;
    const grenze = gehaltBindet ? stand0.umschichten.moeglichBis : -stand0.umschichten.moeglichVon;
    const betrag = Math.floor(grenze * anteil * 2) / 2;
    if (betrag >= 0.5) wahl.umschichtung = gehaltBindet ? betrag : -betrag;
  }
  const u = beurteileBudgetWahl(gameState, teamId, wahl);
  if (u.urteil === "zustimmung") return wahl;
  if (u.urteil === "gegenangebot" && u.vorschlag.length === 1 && u.vorschlag[0] === "vertrauen") return { ...wahl, zusagen: ["vertrauen"] };
  return BUDGET_VORSCHLAG;
}

/** Die KI (oder ein delegierter Mensch) fuehrt das Gespraech und stempelt sofort. Rein. */
export function fuehreKiBudgetGespraech(gameState: GameState, teamId: string, gefuehrtVon: "ki" | "vorschlag" = "ki", ownerId: string | null = null): GameState {
  if (!toepfeAbSaison1(gameState) || lesBudgetVereinbarung(gameState, teamId)) return gameState;
  if (budgetGespraechSperre(gameState, teamId) != null) return gameState;
  const wahl = kiBudgetWahl(gameState, teamId);
  const u = beurteileBudgetWahl(gameState, teamId, wahl);
  const wirksam = u.urteil === "zustimmung" ? wahl : BUDGET_VORSCHLAG;
  const r = wendeWahl(gameState, teamId, wirksam, "ki");
  return schreibeStempel(r.gameState, teamId, stempelDaten(r.gameState, teamId, wirksam, r.gebunden, gefuehrtVon, ownerId, u.quoteBasis));
}

/* ============================================================== Tor und Status der Mitspieler */

export type BudgetTischZeile = {
  teamId: string;
  teamName: string;
  ownerId: string | null;
  ownerLabel: string;
  /** Wer fuehrt: der Mensch selbst oder die KI (Bereich „Vorstand“ delegiert). */
  fuehrung: "selbst" | "ki";
  status: "unterschrieben" | "verhandelt";
};

/** Menschliche Teams und ihr Status — nur Status, keine Zahlen der anderen (Konzept Abschnitt 2). */
export function budgetTisch(gameState: GameState): BudgetTischZeile[] {
  const einstellungen = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const zeilen: BudgetTischZeile[] = [];
  for (const team of gameState.teams) {
    const e = einstellungen[team.teamId];
    if (!e || e.controlMode !== "manual") continue;
    const ki = isBereichDelegiert(e, "vorstand");
    zeilen.push({
      teamId: team.teamId,
      teamName: team.name,
      ownerId: e.ownerId ?? null,
      ownerLabel: e.displayLabel ?? e.ownerId ?? "Manager",
      fuehrung: ki ? "ki" : "selbst",
      status: ki || lesBudgetVereinbarung(gameState, team.teamId) ? "unterschrieben" : "verhandelt",
    });
  }
  return zeilen;
}

/** Fehlt diesem Team die Vereinbarung, und ist es ein Mensch, der selbst verhandelt? Dann haelt das Tor den Draft an. */
export function vereinbarungFehlt(gameState: GameState, teamId: string): boolean {
  if (!toepfeAbSaison1(gameState)) return false;
  const e = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings)[teamId];
  if (!e || e.controlMode !== "manual" || isBereichDelegiert(e, "vorstand")) return false;
  return lesBudgetVereinbarung(gameState, teamId) == null;
}

/** Teams, auf die der Draft in Saison 1 noch wartet (Menschen, die selbst verhandeln und noch nicht unterschrieben haben). */
export function teamsOhneVereinbarung(gameState: GameState): string[] {
  return gameState.teams.filter((t) => vereinbarungFehlt(gameState, t.teamId)).map((t) => t.teamId);
}

/**
 * Saison 1: die KI-Teams und die Menschen mit delegiertem Vorstand fuehren ihr Gespraech (sofort, deterministisch). Menschen, die selbst
 * verhandeln, bleiben offen — auf sie wartet der Draft. Idempotent. Ab Saison 2 fuehrt dieselbe Funktion im Fenster (`vorschlagFuerAbwesende`).
 */
export function fuehreKiBudgetGespraecheAus(gameState: GameState): GameState {
  if (!toepfeAbSaison1(gameState)) return gameState;
  let gs = gameState;
  const einstellungen = buildTeamControlSettingsMap(gs.teams, gs.seasonState.teamControlSettings);
  for (const team of gs.teams) {
    if (lesBudgetVereinbarung(gs, team.teamId)) continue;
    const e = einstellungen[team.teamId];
    const mensch = e?.controlMode === "manual";
    if (mensch && !isBereichDelegiert(e, "vorstand")) continue;
    gs = fuehreKiBudgetGespraech(gs, team.teamId, "ki", mensch ? e?.ownerId ?? null : null);
  }
  return gs;
}

/** Ab Saison 2: das Fenster wartet nicht. Menschen ohne Unterschrift bekommen den Vorschlag des Vorstands (nachverhandelbar bis zum ersten Kauf). */
export function vorschlagFuerAbwesende(gameState: GameState): GameState {
  if (saisonNr(gameState) < 2) return gameState;
  let gs = fuehreKiBudgetGespraecheAus(gameState);
  for (const teamId of teamsOhneVereinbarung(gs)) gs = stempleVorschlag(gs, teamId);
  return gs;
}

export { stufeFuerVertrauen, VORSTAND_STUFEN, hoehereQuote };
