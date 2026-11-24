/**
 * SPONSOR-TOPF: BUCHUNG (24.11.). Alle Betraege, die der Spieltagsweg und die Saisonende-Abrechnung buchen, kommen von HIER und aus
 * `sponsor-topf-modell.ts` -- dieselben Funktionen speisen die Uebersicht (`sponsor-uebersicht.ts`): gezeigt = gebucht.
 *
 *   je Spieltag    Grundbetrag (+ Treuebonus) zu 1/N         -> Ledger-Fluss `sponsorBasis`
 *                  80 % des Leistungsteils beim heutigen Platz zu 1/N   -> Ledger-Fluss `rangAbschlag`
 *   am Saisonende  Zeilen "base" (Rest), "rank" (Schlussausgleich auf den Endrang), "farbe" (Farb-Partner), "special" (Ziel)
 *
 * Vor dem Stichtag rechnet jede Funktion mit der Vorschau (`berechneTopfLive`), danach mit dem eingefrorenen Stand im Stempel.
 */
import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { gueltigerSponsorStempel, sponsorLeistungAktiv, sponsorTopfAktiv } from "@/lib/resolve/sponsor-regel";
import { evaluateSpecialComponentStage } from "@/lib/sponsor/sponsor-objective-evaluator";
import {
  SPONSOR_FARBEN,
  berechneLeistungsteile,
  SPONSOR_TOPF,
  runde1,
  topfSigma,
  treueBonus,
  verteileFarbTopf,
  vertragsartHebel,
  zielAuszahlung,
  type TopfErgebnis,
} from "@/lib/sponsors/sponsor-topf-modell";
import { berechneTopfLive, istErsteSaison, type TopfSammlung } from "@/lib/sponsors/sponsor-topf-eingaben";
import type { SponsorFarbe, SponsorTopfTeamStand } from "@/lib/sponsors/sponsor-topf-typen";

export const RANG_ABSCHLAG_QUOTE_TOPF = 0.8;

const KATEGORIE_VON_FARBE: Record<SponsorFarbe, "power" | "speed" | "mental" | "social"> = {
  pow: "power", spe: "speed", men: "mental", soc: "social",
};

// ── Stand: eingefroren oder Vorschau ────────────────────────────────────────────────────────────────

export type TopfStand = {
  /** true = am Stichtag eingefroren, false = Vorschau aus dem heutigen Spielstand. */
  eingefroren: boolean;
  faktor: number;
  sigma: number;
  topf: number;
  hauptTopf: number;
  farbTopf: [number, number];
  teams: Record<string, SponsorTopfTeamStand>;
  rechnung: Pick<TopfErgebnis, "betriebsteil" | "betriebsteilRoh" | "kaderErsatz" | "uebertrag" | "treueSumme">;
};

const liveCache = new WeakMap<object, { ergebnis: TopfErgebnis; sammlung: TopfSammlung }>();

/**
 * RE-ENTRANZ-WACHE. Die Plan-Posten des Topfs (Tickets) lesen die Sponsor-Stufe der Teams, und die liest den Grundbetrag (`sponsorBasisJahr`):
 * ein Kreis. Waehrend der Topf gerechnet wird, liefert `topfGrundJahr` deshalb den VORLAEUFIGEN Grundbetrag aus dem Stempel (oder 0) statt
 * den Topf noch einmal anzustossen. Synchron, nie ueber ein await.
 */
let topfRechnetGerade = false;

export function rechneTopfLive<T>(fn: () => T): T {
  const vorher = topfRechnetGerade;
  topfRechnetGerade = true;
  try {
    return fn();
  } finally {
    topfRechnetGerade = vorher;
  }
}

function liveFuer(gameState: GameState) {
  let hit = liveCache.get(gameState);
  if (!hit) {
    hit = rechneTopfLive(() => berechneTopfLive(gameState));
    liveCache.set(gameState, hit);
  }
  return hit;
}

/** Teamstand aus der Live-Rechnung (Format wie am Stichtag). */
export function teamStandenAusLive(ergebnis: TopfErgebnis, sammlung: TopfSammlung): Record<string, SponsorTopfTeamStand> {
  const aus: Record<string, SponsorTopfTeamStand> = {};
  for (const e of sammlung.eingabe.teams) {
    const vertrag = sammlung.vertraege[e.teamId];
    const r = ergebnis.teams[e.teamId]!;
    aus[e.teamId] = {
      teamId: e.teamId,
      liga: e.liga,
      erwartungsrang: e.erwartungsrang,
      beliebtheit: e.beliebtheit,
      hebel: vertragsartHebel(vertrag?.sponsorTopf?.vertragsart),
      vertragsart: vertrag?.sponsorTopf?.vertragsart ?? null,
      passung: r.passung,
      treue: e.treue,
      grundbetrag: r.grundbetrag,
      kosten: e.kosten,
      planEinnahmen: e.planEinnahmen,
      kaderwert: e.kaderwert,
      farben: vertrag?.sponsorTopf?.farben ?? [],
    };
  }
  return aus;
}

/**
 * Der Topf-Stand dieser Saison. `null`, wenn die Regel nicht "topf" ist.
 *   eingefroren (Stempel)       nach dem Stichtag: die Zahlen, die gebucht werden
 *   `live: true`                Vorschau aus dem heutigen Spielstand (volle Rechnung, ~1 s); nur fuer die Uebersichtsseite
 *   sonst, vor dem Stichtag     billiger vorlaeufiger Stand aus der Vorab-Zusage im Stempel (Grundbetrag je Team, Leistungsteil und Farb-Partner
 *                               noch 0): so bleibt jeder Aufrufer der Buchungs-Schicht (GuV-Vorschau, KI-Planung, Arena-Stufen) billig
 */
export function topfStandFuer(gameState: GameState, opts: { live?: boolean } = {}): TopfStand | null {
  if (!sponsorTopfAktiv(gameState)) return null;
  const stempel = gueltigerSponsorStempel(gameState)!;
  const f = stempel.eingefroren;
  if (f) {
    return {
      eingefroren: true,
      faktor: f.faktor,
      sigma: f.sigma,
      topf: f.topf,
      hauptTopf: f.hauptTopf,
      farbTopf: f.farbTopf,
      teams: f.teams,
      rechnung: { betriebsteil: f.betriebsteil, betriebsteilRoh: f.betriebsteilRoh, kaderErsatz: f.kaderErsatz, uebertrag: f.uebertrag, treueSumme: f.treueSumme },
    };
  }
  if (opts.live) {
    const { ergebnis, sammlung } = liveFuer(gameState);
    return {
      eingefroren: false,
      faktor: ergebnis.faktor,
      sigma: ergebnis.sigma,
      topf: ergebnis.topf,
      hauptTopf: ergebnis.hauptTopf,
      farbTopf: ergebnis.farbTopf,
      teams: teamStandenAusLive(ergebnis, sammlung),
      rechnung: { betriebsteil: ergebnis.betriebsteil, betriebsteilRoh: ergebnis.betriebsteilRoh, kaderErsatz: ergebnis.kaderErsatz, uebertrag: ergebnis.uebertrag, treueSumme: ergebnis.treueSumme },
    };
  }
  return vorlaeufigerStand(gameState, stempel);
}

const vorlaeufigCache = new WeakMap<object, TopfStand>();

function vorlaeufigerStand(gameState: GameState, stempel: NonNullable<ReturnType<typeof gueltigerSponsorStempel>>): TopfStand {
  const hit = vorlaeufigCache.get(gameState);
  if (hit) return hit;
  const vorl = stempel.vorlaeufig;
  const teams: Record<string, SponsorTopfTeamStand> = {};
  for (const team of gameState.teams) {
    const vertrag = gameState.seasonState.sponsorContractsByTeamId?.[team.teamId];
    const tv = vertrag?.sponsorTopf;
    teams[team.teamId] = {
      teamId: team.teamId,
      liga: gameState.seasonState.leagueByTeamId?.[team.teamId] === "liga2" ? 2 : 1,
      erwartungsrang: 8.5,
      beliebtheit: gameState.teamIdentities.find((i) => i.teamId === team.teamId)?.popularity ?? 5,
      hebel: vertragsartHebel(tv?.vertragsart),
      vertragsart: tv?.vertragsart ?? null,
      passung: 1,
      treue: tv ? treueBonus(tv.jahr) : 0,
      grundbetrag: vorl?.grund[team.teamId] ?? 0,
      kosten: 0,
      planEinnahmen: 0,
      kaderwert: 0,
      farben: tv?.farben ?? [],
    };
  }
  const aus: TopfStand = {
    eingefroren: false,
    faktor: 1,
    sigma: topfSigma(istErsteSaison(gameState)),
    topf: vorl?.topf ?? 0,
    hauptTopf: vorl?.topf ?? 0,
    farbTopf: [runde1(SPONSOR_TOPF.farbTopf[1]), runde1(SPONSOR_TOPF.farbTopf[2])],
    teams,
    rechnung: { betriebsteil: 0, betriebsteilRoh: 0, kaderErsatz: 0, uebertrag: stempel.uebertrag, treueSumme: 0 },
  };
  vorlaeufigCache.set(gameState, aus);
  return aus;
}

/** Das Jahr des Grundbetrags inklusive Treuebonus: das, was je Spieltag zu 1/N als `sponsorBasis` gebucht wird. Ohne Vertrag 0. */
export function topfGrundJahr(gameState: GameState, teamId: string): number {
  if (topfRechnetGerade) return runde1(gueltigerSponsorStempel(gameState)?.vorlaeufig?.grund[teamId] ?? 0);
  const stand = topfStandFuer(gameState);
  const t = stand?.teams[teamId];
  if (!t || !gameState.seasonState.sponsorContractsByTeamId?.[teamId]) return 0;
  return runde1(t.grundbetrag + t.treue);
}

// ── Leistungsteil ───────────────────────────────────────────────────────────────────────────────────

type LeistungJetzt = { rang: Record<string, number>; leistung: Record<string, number> };
const leistungCache = new WeakMap<object, LeistungJetzt>();

/** Leistungsteil JETZT je Team (aktueller Tabellenplatz) und der Platz selbst. Liga-Summe exakt 0. Ohne Leistung (Notbremse): alles 0. */
export function topfLeistungJetzt(gameState: GameState): LeistungJetzt | null {
  const stand = topfStandFuer(gameState);
  if (!stand) return null;
  const hit = leistungCache.get(gameState);
  if (hit) return hit;
  // Vor dem Stichtag gibt es weder Erwartungsrang noch Tabelle: der Leistungsteil ist 0 (Vorschau); die Seite rechnet die Vorschau mit `live`.
  if (!stand.eingefroren) {
    const leer = { rang: {}, leistung: Object.fromEntries(Object.keys(stand.teams).map((id) => [id, 0])) };
    leistungCache.set(gameState, leer);
    return leer;
  }
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const rangVon = new Map(rows.map((r) => [r.teamId, r.rank ?? r.startplatz ?? null] as const));
  const eingabe = Object.values(stand.teams).map((t) => ({
    teamId: t.teamId,
    liga: t.liga,
    erwartungsrang: t.erwartungsrang,
    rang: rangVon.get(t.teamId) ?? t.erwartungsrang,
    hebel: t.hebel,
  }));
  const leistung = sponsorLeistungAktiv(gameState)
    ? berechneLeistungsteile(eingabe, stand.faktor, stand.sigma)
    : Object.fromEntries(eingabe.map((e) => [e.teamId, 0]));
  const aus = { rang: Object.fromEntries(eingabe.map((e) => [e.teamId, e.rang])), leistung };
  leistungCache.set(gameState, aus);
  return aus;
}

/** Rang-Abschlag je Spieltag: 80 % des Leistungsteils beim heutigen Platz, geteilt durch die Zahl der Spieltage. */
export function topfRangAbschlag(gameState: GameState, teamId: string, spieltage: number): { praemie: number; abschlag: number } {
  const jetzt = topfLeistungJetzt(gameState);
  if (!jetzt || !(spieltage > 0) || !gameState.seasonState.sponsorContractsByTeamId?.[teamId]) return { praemie: 0, abschlag: 0 };
  const praemie = jetzt.leistung[teamId] ?? 0;
  return { praemie, abschlag: runde1((RANG_ABSCHLAG_QUOTE_TOPF * praemie) / spieltage) };
}

export function topfRangFuerAbschlag(gameState: GameState, teamId: string): number | null {
  return topfLeistungJetzt(gameState)?.rang[teamId] ?? null;
}

// ── Farb-Partner ────────────────────────────────────────────────────────────────────────────────────

export type FarbZeile = { farbe: SponsorFarbe; liga: 1 | 2; teamId: string; punkte: number; betrag: number; platz: number };
export type FarbVerteilung = {
  /** Je Liga und Farbe: Topf, Teilnehmer, verteilte Summe. */
  toepfe: Array<{ liga: 1 | 2; farbe: SponsorFarbe; topf: number; teilnehmer: number; verteilt: number }>;
  zeilen: FarbZeile[];
  jeTeam: Record<string, number>;
};
const farbCache = new WeakMap<object, FarbVerteilung>();

/** Verteilt die acht Farb-Toepfe (4 Farben x 2 Ligen) nach den Farbpunkten der laufenden Saison. */
export function topfFarbVerteilung(gameState: GameState): FarbVerteilung | null {
  const stand = topfStandFuer(gameState);
  if (!stand) return null;
  const hit = farbCache.get(gameState);
  if (hit) return hit;
  // Vor dem Stichtag gibt es keine Punkte: der Farb-Partner ist 0 (kein teures Ledger fuer eine Vorschau).
  const aktiv = sponsorLeistungAktiv(gameState) && stand.eingefroren;
  const ledger = aktiv ? buildSeasonPointsLedger(gameState) : null;
  const zeilen: FarbZeile[] = [];
  const toepfe: FarbVerteilung["toepfe"] = [];
  const jeTeam: Record<string, number> = {};
  for (const liga of [1, 2] as const) {
    const topf = stand.farbTopf[liga - 1]!;
    for (const farbe of SPONSOR_FARBEN) {
      const teilnehmer = Object.values(stand.teams)
        .filter((t) => t.liga === liga && t.farben.includes(farbe) && gameState.seasonState.sponsorContractsByTeamId?.[t.teamId])
        .map((t) => ({ teamId: t.teamId, punkte: ledger?.teamSummariesByTeamId.get(t.teamId)?.pointsByArea?.[KATEGORIE_VON_FARBE[farbe]] ?? 0 }));
      const anteile = aktiv ? verteileFarbTopf(topf, teilnehmer) : {};
      const sortiert = [...teilnehmer].sort((a, b) => b.punkte - a.punkte || a.teamId.localeCompare(b.teamId));
      sortiert.forEach((t, i) => {
        const betrag = anteile[t.teamId] ?? 0;
        zeilen.push({ farbe, liga, teamId: t.teamId, punkte: t.punkte, betrag, platz: i + 1 });
        jeTeam[t.teamId] = runde1((jeTeam[t.teamId] ?? 0) + betrag);
      });
      toepfe.push({ liga, farbe, topf, teilnehmer: teilnehmer.length, verteilt: runde1(Object.values(anteile).reduce((a, b) => a + b, 0)) });
    }
  }
  const aus = { toepfe, zeilen, jeTeam };
  farbCache.set(gameState, aus);
  return aus;
}

// ── Ziel ────────────────────────────────────────────────────────────────────────────────────────────

/** Ziel-Auszahlung des Vertrags: Einsatz x (2 x Erfuellung - 1). Ohne Zielkomponente oder bei Festvertrag 0. */
export function topfZielAuszahlung(gameState: GameState, contract: TeamSponsorContract): { betrag: number; erfuellung: number; einsatz: number } {
  const einsatz = contract.sponsorTopf?.zielEinsatz ?? 0;
  const special = contract.components.find((c) => c.kind === "special") ?? null;
  // Nur Angebote mit Achsen-Karte tragen ein Ziel; die Basis-Karte hat keines, ihr Einsatz ist 0 (die Seite zeigt dann "kein Ziel").
  if (!(einsatz > 0) || !special) return { betrag: 0, erfuellung: 0, einsatz: 0 };
  const fraction = Math.max(0, Math.min(1, evaluateSpecialComponentStage(gameState, contract.teamId, special).fraction));
  return { betrag: zielAuszahlung(einsatz, fraction), erfuellung: fraction, einsatz };
}

// ── Zeilen der Saisonende-Abrechnung ───────────────────────────────────────────────────────────────

export type TopfAbrechnungsZeile = {
  key: "base" | "rank" | "farbe" | "special";
  label: string;
  cashDelta: number;
  reason: string;
};

/** Die vier Zeilen eines Vertrags am Saisonende (Grundbetrag, Leistungsteil beim Endrang, Farb-Partner, Ziel). */
export function topfSaisonendeZeilen(gameState: GameState, contract: TeamSponsorContract): TopfAbrechnungsZeile[] {
  const stand = topfStandFuer(gameState);
  const t = stand?.teams[contract.teamId];
  if (!stand || !t) return [];
  const grund = runde1(t.grundbetrag + t.treue);
  const leistung = topfLeistungJetzt(gameState)?.leistung[contract.teamId] ?? 0;
  const rang = topfLeistungJetzt(gameState)?.rang[contract.teamId] ?? null;
  const farbe = topfFarbVerteilung(gameState)?.jeTeam[contract.teamId] ?? 0;
  const ziel = topfZielAuszahlung(gameState, contract);
  const zeilen: TopfAbrechnungsZeile[] = [
    { key: "base", label: "Grundbetrag", cashDelta: grund, reason: `Grundbetrag ${t.grundbetrag.toFixed(1)} C${t.treue > 0 ? ` + Treuebonus ${t.treue.toFixed(1)} C` : ""}` },
    {
      key: "rank",
      label: "Leistungsteil",
      cashDelta: leistung,
      reason: rang == null ? "Leistungsteil" : `Leistungsteil bei Platz ${rang}, Erwartung ${t.erwartungsrang.toFixed(1)}`,
    },
  ];
  zeilen.push({ key: "farbe", label: "Farb-Partner", cashDelta: farbe, reason: `Farb-Partner ${t.farben.map((f) => f.toUpperCase()).join(" + ") || "keiner"}` });
  zeilen.push({
    key: "special",
    label: "Ziel",
    cashDelta: ziel.betrag,
    reason: ziel.einsatz > 0 ? `Ziel zu ${Math.round(ziel.erfuellung * 100)} % erfuellt` : "kein Ziel (Festvertrag oder Basis-Karte)",
  });
  return zeilen;
}
