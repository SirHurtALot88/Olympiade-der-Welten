/**
 * SPONSOR-TOPF: VERTRAGSWAHL (24.11., Konzept 4.6, 7, 8). Vertragsart, gewaehlte Laufzeit 1 bis 3 und zwei Farb-Partner haengen als
 * `contract.sponsorTopf` am Vertrag und rollen mit ihm. Mensch, KI und delegierte KI benutzen DIESELBEN Funktionen
 * ("Mensch ueberschreibt, KI respektiert das": die KI fuellt nur, was nicht gesetzt ist).
 */
import type { GameState, SponsorTermSeasons, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { gueltigerSponsorStempel, sponsorTopfAktiv } from "@/lib/resolve/sponsor-regel";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  SPONSOR_FARBEN,
  SPONSOR_VERTRAGSARTEN,
  kiFarben,
  kiLaufzeit,
  kiVertragsart,
  vertragsartZielEinsatz,
  zTreue,
} from "@/lib/sponsors/sponsor-topf-modell";
import type { SponsorFarbe, SponsorTopfVertrag, SponsorVertragsart } from "@/lib/sponsors/sponsor-topf-typen";
import { berechneErwartungsraenge, ligaGroesseVon, treueSaisonsFuerMarke } from "@/lib/sponsors/sponsor-topf-eingaben";

export type TopfWahl = {
  vertragsart?: SponsorVertragsart;
  laufzeit?: 1 | 2 | 3;
  farben?: SponsorFarbe[];
  von?: SponsorTopfVertrag["gewaehltVon"];
};

/** Prueft eine Wahl; gibt einen Fehlercode oder `null` zurueck. Fehlende Felder sind erlaubt (die KI fuellt sie). */
export function pruefeTopfWahl(wahl: TopfWahl | null | undefined): string | null {
  if (!wahl) return null;
  if (wahl.vertragsart != null && !SPONSOR_VERTRAGSARTEN.includes(wahl.vertragsart)) return "sponsor_vertragsart_ungueltig";
  if (wahl.laufzeit != null && ![1, 2, 3].includes(wahl.laufzeit)) return "sponsor_laufzeit_ungueltig";
  if (wahl.farben != null) {
    const einzig = new Set(wahl.farben);
    if (wahl.farben.length !== 2 || einzig.size !== 2 || wahl.farben.some((f) => !SPONSOR_FARBEN.includes(f))) return "sponsor_farben_ungueltig";
  }
  return null;
}

function farbeVonKategorie(kategorie: string | null | undefined): SponsorFarbe | null {
  switch (kategorie) {
    case "power": return "pow";
    case "speed": return "spe";
    case "mental": return "men";
    case "social": return "soc";
    default: return null;
  }
}

/** Staerkerang je Farbe und Team (1 = bester Kader der Liga in dieser Farbe): Mittel der Top-6-Eignung der Disziplinen der Farbe. */
export function farbStaerkeRang(gameState: GameState): Record<string, Record<SponsorFarbe, number>> {
  const kategorieVon = new Map(gameState.disciplines.map((d) => [d.id, farbeVonKategorie(d.category)] as const));
  const eignung = new Map(gameState.players.map((p) => [p.id, p.disciplineRatings ?? {}] as const));
  const kader = new Map<string, string[]>();
  for (const r of gameState.rosters) (kader.get(r.teamId) ?? kader.set(r.teamId, []).get(r.teamId)!).push(r.playerId);
  const staerke: Record<string, Record<SponsorFarbe, number>> = {};
  for (const t of gameState.teams) {
    const ids = kader.get(t.teamId) ?? [];
    const je: Record<SponsorFarbe, number[]> = { pow: [], spe: [], men: [], soc: [] };
    for (const [diszId, farbe] of kategorieVon) {
      if (!farbe) continue;
      const werte = ids.map((id) => (eignung.get(id) as Record<string, number> | undefined)?.[diszId] ?? 0).sort((a, b) => b - a).slice(0, 6);
      while (werte.length < 6) werte.push(0);
      je[farbe].push(werte.reduce((a, b) => a + b, 0) / 6);
    }
    staerke[t.teamId] = Object.fromEntries(
      SPONSOR_FARBEN.map((f) => [f, je[f].length ? je[f].reduce((a, b) => a + b, 0) / je[f].length : 0]),
    ) as Record<SponsorFarbe, number>;
  }
  // in Raenge umrechnen (Liga egal: der Vergleich ist gegen alle 32, das genuegt fuer die Rangfolge der Farben eines Teams)
  const raenge: Record<string, Record<SponsorFarbe, number>> = {};
  for (const f of SPONSOR_FARBEN) {
    const sortiert = Object.entries(staerke).sort((a, b) => b[1][f] - a[1][f] || a[0].localeCompare(b[0]));
    sortiert.forEach(([teamId], i) => {
      (raenge[teamId] ??= { pow: 0, spe: 0, men: 0, soc: 0 })[f] = i + 1;
    });
  }
  return raenge;
}

function identitaetsFarbe(gameState: GameState, teamId: string): SponsorFarbe | null {
  const i = gameState.teamIdentities.find((x) => x.teamId === teamId);
  if (!i) return null;
  const werte: Array<[SponsorFarbe, number]> = [["pow", i.pow], ["spe", i.spe], ["men", i.men], ["soc", i.soc]];
  return werte.sort((a, b) => b[1] - a[1])[0]![0];
}

/** Die Farb-Partner der KI (Konzept 7): die zwei Farben, in denen der Kader gegen die Liga am besten steht. */
export function kiFarbenFuerTeam(gameState: GameState, teamId: string, raenge?: Record<string, Record<SponsorFarbe, number>>): SponsorFarbe[] {
  const r = (raenge ?? farbStaerkeRang(gameState))[teamId] ?? { pow: 1, spe: 2, men: 3, soc: 4 };
  return kiFarben(r, identitaetsFarbe(gameState, teamId));
}

export type TopfWahlKontext = { erwartung?: Record<string, number>; farbRaenge?: Record<string, Record<SponsorFarbe, number>> };

/** Der Kontext einer ganzen Liga-Runde: Erwartungsraenge und Farb-Raenge EINMAL rechnen (Teams unterschreiben nacheinander, die Eingaben aendern sich dadurch nicht). */
export function baueTopfWahlKontext(gameState: GameState): TopfWahlKontext {
  return { erwartung: berechneErwartungsraenge(gameState), farbRaenge: farbStaerkeRang(gameState) };
}

/** Die vollstaendige KI-Wahl eines Teams (Vertragsart, Laufzeit, Farben) nach Konzept 7. */
export function kiTopfWahl(gameState: GameState, teamId: string, kontext?: TopfWahlKontext): Required<Omit<TopfWahl, "von">> {
  const identity = gameState.teamIdentities.find((x) => x.teamId === teamId);
  const e = (kontext?.erwartung ?? berechneErwartungsraenge(gameState))[teamId] ?? (ligaGroesseVon(gameState, teamId) + 1) / 2;
  const finanzwert = identity?.finances ?? 5;
  return {
    vertragsart: kiVertragsart({ erwartungsrang: e, finanzwert, ambition: identity?.ambition ?? 5, ligaGroesse: ligaGroesseVon(gameState, teamId) }),
    laufzeit: kiLaufzeit(finanzwert),
    farben: kiFarbenFuerTeam(gameState, teamId, kontext?.farbRaenge),
  };
}

/** Fuellt eine (evtl. leere) Wahl mit der KI-Wahl: gesetzte Felder bleiben, fehlende kommen von der KI (nur dafuer wird gerechnet). */
export function ergaenzeTopfWahl(
  gameState: GameState,
  teamId: string,
  wahl: TopfWahl | null | undefined,
  standardVon: SponsorTopfVertrag["gewaehltVon"],
  kontext?: TopfWahlKontext,
): Required<TopfWahl> & { kiFelder: Array<"vertragsart" | "laufzeit" | "farben"> } {
  const vollstaendig = wahl?.vertragsart != null && wahl.laufzeit != null && wahl.farben != null;
  const ki = vollstaendig ? null : kiTopfWahl(gameState, teamId, kontext);
  // Felder, die die KI gefuellt hat, stehen einzeln am Vertrag (`kiFelder`): ein Mensch, der nur die Vertragsart setzt, hat Laufzeit und Farben nicht gewaehlt.
  const kiFelder: Array<"vertragsart" | "laufzeit" | "farben"> = [];
  if (wahl?.vertragsart == null) kiFelder.push("vertragsart");
  if (wahl?.laufzeit == null) kiFelder.push("laufzeit");
  if (wahl?.farben == null) kiFelder.push("farben");
  return {
    vertragsart: wahl?.vertragsart ?? ki!.vertragsart,
    laufzeit: wahl?.laufzeit ?? ki!.laufzeit,
    farben: wahl?.farben ?? ki!.farben,
    von: wahl?.von ?? standardVon,
    kiFelder,
  };
}

/**
 * Haengt die Wahl an den eben unterschriebenen Vertrag. Setzt Laufzeit und Restlaufzeit des Vertrags (die alte Lebenszyklus-Logik rollt
 * den Vertrag danach wie jeden Mehrjahresvertrag). Ohne Topf-Regel oder ohne Vertrag: dieselbe Referenz zurueck.
 */
export function wendeTopfWahlAn(gameState: GameState, teamId: string, wahl: Required<TopfWahl> & { kiFelder?: Array<"vertragsart" | "laufzeit" | "farben"> }, treueSaisons: number): GameState {
  if (!sponsorTopfAktiv(gameState)) return gameState;
  const contract = getTeamSponsorContract(gameState, teamId);
  if (!contract) return gameState;
  const laufzeit = wahl.laufzeit;
  const topf: SponsorTopfVertrag = {
    vertragsart: wahl.vertragsart,
    laufzeit,
    jahr: 1,
    farben: [...wahl.farben],
    treueSaisons: Math.min(3, Math.max(0, treueSaisons)),
    gewaehltVon: wahl.von,
    zielEinsatz: vertragsartZielEinsatz(wahl.vertragsart),
    ...(wahl.kiFelder && wahl.kiFelder.length > 0 ? { kiFelder: wahl.kiFelder } : {}),
  };
  const neu: TeamSponsorContract = { ...contract, termSeasons: laufzeit as SponsorTermSeasons, seasonsRemaining: laufzeit, sponsorTopf: topf };
  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, sponsorContractsByTeamId: { ...(gameState.seasonState.sponsorContractsByTeamId ?? {}), [teamId]: neu } },
  };
}

/**
 * Ueberfuehrung laufender Altvertraege beim ersten Saisonwechsel unter "topf" (Konzept 6): derselbe Vertrag der Marke wird zum
 * Leistungsvertrag, die Restlaufzeit bleibt, der Treuebonus zaehlt weiter (Vertragsjahr aus der alten Laufzeit), die Farben kommen von
 * der KI-Wahl. Die Leihgabe laeuft unveraendert weiter. Idempotent; ohne Topf-Stempel eine No-op.
 */
export function ueberfuehreAltvertraege(gameState: GameState): GameState {
  if (!sponsorTopfAktiv(gameState)) return gameState;
  const vertraege = gameState.seasonState.sponsorContractsByTeamId ?? {};
  const offen = Object.values(vertraege).filter((c) => c && !c.sponsorTopf && (c.seasonsRemaining ?? 1) > 0);
  if (offen.length === 0) return gameState;
  const raenge = farbStaerkeRang(gameState);
  const neu = { ...vertraege };
  for (const c of offen) {
    const laufzeit = ((c!.termSeasons ?? 1) as 1 | 2 | 3);
    const rest = Math.max(1, c!.seasonsRemaining ?? 1);
    const jahr = Math.min(3, Math.max(1, laufzeit - rest + 1));
    neu[c!.teamId] = {
      ...c!,
      sponsorTopf: {
        vertragsart: "leistung",
        laufzeit,
        jahr,
        farben: kiFarbenFuerTeam(gameState, c!.teamId, raenge),
        treueSaisons: Math.min(3, jahr - 1),
        gewaehltVon: "ueberfuehrt",
        zielEinsatz: vertragsartZielEinsatz("leistung"),
        vorherAnker: typeof c!.sponsorV3?.anchor === "number" ? Math.round(c!.sponsorV3.anchor * 10) / 10 : null,
      },
    };
  }
  return { ...gameState, seasonState: { ...gameState.seasonState, sponsorContractsByTeamId: neu } };
}

/**
 * Das Angebot mit der besten Passung (Beliebtheit des Kaders ist fuer alle Angebote gleich, entscheidend ist die Treue zur Marke);
 * bei Gleichstand das erste. Konzept 8: "Marke mit dem hoechsten Prestige" heisst seit Entscheidung 3 (23.11.) "beste Passung".
 */
export function besteAngebotNachPassung<T extends { sponsorParentBrandId?: string }>(gameState: GameState, teamId: string, angebote: readonly T[]): T {
  let best = angebote[0]!;
  let bestWert = -Infinity;
  for (const a of angebote) {
    const w = zTreue(treueSaisonsFuerMarke(gameState, teamId, a.sponsorParentBrandId));
    if (w > bestWert + 1e-9) { best = a; bestWert = w; }
  }
  return best;
}

/** Hat das Team schon Vertragsdaten des Topf-Systems? */
export function hatTopfVertrag(gameState: GameState, teamId: string): boolean {
  return getTeamSponsorContract(gameState, teamId)?.sponsorTopf != null && gueltigerSponsorStempel(gameState)?.version === "topf";
}
