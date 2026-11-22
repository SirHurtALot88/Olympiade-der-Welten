/**
 * FINANZEN JE SPIELTAG (22.11., Arbeitsliste Welle 4; Konzept: docs/design/finanzen-je-spieltag-22-11.md).
 *
 * Bisher buchte das Spiel Gehalt, Sponsor, Gebaeude-Einnahmen und -Unterhalt EINMAL am Saisonende als Summe. Mit dem
 * Stempel `seasonState.finanzenJeSpieltag` laufen vier Fluesse je Spieltag zu 1/N (N = Spieltage im Spielplan der
 * Saison, nie hart 20):
 *
 *   gehalt             Jahresgehalt des Kaders, wie er an DIESEM Spieltag im Kader steht (Kauf/Verkauf/Verlaengerung
 *                      wirken ab dem naechsten Abschluss, nichts rueckwirkend; Verletzte zahlen weiter)
 *   sponsorBasis       die garantierte Saisonbasis des Sponsorvertrags (Rang und Sonderziel bleiben am Saisonende)
 *   gebaeudeEinnahme   Fan-Shop und Arena (Saisoneinnahme / N)
 *   gebaeudeUnterhalt  Unterhalt der gebauten Gebaeude (Saisonunterhalt / N)
 *   rangAbschlag       (Chris, 22.11.) Vorschuss auf die Rangpraemie: 0,8 x (Leiter(Platz) - Sockel) / N; der Schlussausgleich
 *                      am Saisonende bucht Rangpraemie(Endrang) minus Summe der Abschlaege (darf negativ sein)
 *
 * DIESE DATEI IST CLIENT-SICHER (kein node:fs/crypto, keine Sponsor- und Gebaeude-Dienste): sie haelt den Stempel,
 * das Ledger-Lesen und die Anteilsrechnung. Das SCHREIBEN der Buchung liegt in `finanzen-je-spieltag-buchung.ts`.
 *
 * MUSTER: `lib/resolve/wertungs-skalen.ts` — der Stempel steht IM SPIELSTAND und wird genau zweimal gesetzt, beim
 * Anlegen eines Spiels und beim Saisonwechsel. Eine laufende Saison eines bestehenden Spielstands rechnet damit
 * bit-identisch alt zu Ende. Rueckweg: `OLY_FINANZEN_JE_SPIELTAG=aus` (neue Saisons bekommen keinen Stempel).
 *
 * RUNDUNG: jeder Betrag wird auf 0,1 gerundet (wie `team.cash`), der Rest geht als `rest` in die naechste Buchung. Die
 * Saisonsumme weicht dadurch hoechstens 0,05 vom exakten Jahresbetrag ab, und Kasse = Summe der Buchungen bleibt exakt.
 */
import type { GameState, RosterEntry, SeasonState, SpieltagFinanzBuchung } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

export type FinanzenJeSpieltagStempel = { seasonId: string; version: "v1" };

export type SpieltagTeilsummen = {
  gehalt: number;
  sponsorBasis: number;
  gebaeudeEinnahme: number;
  gebaeudeUnterhalt: number;
  /** Summe der Rang-Abschlaege auf die Sponsor-Rangpraemie (22.11.). */
  rangAbschlag: number;
  cashDelta: number;
  /** Anzahl gebuchter Spieltage dieses Teams in der Saison. */
  anzahl: number;
};

export function runde1(wert: number): number {
  return Math.round(wert * 10) / 10;
}

/** Schalter (Server): nicht gesetzt = an; "aus"/"0"/"false"/"nein"/"off" = neue Saisons bekommen keinen Stempel. */
export function finanzenJeSpieltagAktiv(): boolean {
  const roh = (process.env.OLY_FINANZEN_JE_SPIELTAG ?? "").trim().toLowerCase();
  return !(roh === "aus" || roh === "0" || roh === "false" || roh === "nein" || roh === "off");
}

/** Der Stempel einer NEU beginnenden Saison; `null`, wenn der Schalter aus ist. */
export function finanzenJeSpieltagFuerNeueSaison(seasonId: string): FinanzenJeSpieltagStempel | null {
  return finanzenJeSpieltagAktiv() ? { seasonId, version: "v1" } : null;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleFinanzenJeSpieltagBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !gameState.seasonState) return gameState;
  if (gameState.seasonState.finanzenJeSpieltag?.seasonId === seasonId) return gameState;
  const stempel = finanzenJeSpieltagFuerNeueSaison(seasonId);
  if (!stempel) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, finanzenJeSpieltag: stempel } };
}

type StempelQuelle =
  | {
      season?: { id?: string; matchdayIds?: readonly string[] } | null;
      seasonState?: Pick<SeasonState, "seasonId" | "finanzenJeSpieltag"> | null;
    }
  | null
  | undefined;

/** Laeuft die Saison im Modus "je Spieltag"? Gueltiger Stempel dieser Saison UND ein Spielplan mit Spieltagen. */
export function istJeSpieltagSaison(gameState: StempelQuelle): boolean {
  const stempel = gameState?.seasonState?.finanzenJeSpieltag;
  if (!stempel || stempel.version !== "v1") return false;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!seasonId || stempel.seasonId !== seasonId) return false;
  return (gameState?.season?.matchdayIds?.length ?? 0) > 0;
}

/** Spieltage der Saison laut Spielplan (der Nenner aller Anteile). */
export function spieltageDerSaison(gameState: Pick<GameState, "season">): number {
  return gameState.season?.matchdayIds?.length ?? 0;
}

/** Alle Spieltagsbuchungen der laufenden Saison (optional eines Teams), nach Spieltag sortiert. */
export function spieltagBuchungenDerSaison(
  gameState: Pick<GameState, "season" | "seasonState">,
  teamId?: string,
  seasonId?: string,
): SpieltagFinanzBuchung[] {
  const id = seasonId ?? gameState.seasonState?.seasonId ?? gameState.season?.id;
  return (gameState.seasonState?.spieltagFinanzen ?? [])
    .filter((b) => b.seasonId === id && (teamId == null || b.teamId === teamId))
    .sort((a, b) => a.matchdayIndex - b.matchdayIndex);
}

/** Summen je Fluss (Vorzeichen wie gebucht) eines Teams in der Saison. */
export function summeSpieltagBuchungen(
  gameState: Pick<GameState, "season" | "seasonState">,
  teamId: string,
  seasonId?: string,
): SpieltagTeilsummen {
  const out: SpieltagTeilsummen = { gehalt: 0, sponsorBasis: 0, gebaeudeEinnahme: 0, gebaeudeUnterhalt: 0, rangAbschlag: 0, cashDelta: 0, anzahl: 0 };
  for (const b of spieltagBuchungenDerSaison(gameState, teamId, seasonId)) {
    out.gehalt += b.gehalt;
    out.sponsorBasis += b.sponsorBasis;
    out.gebaeudeEinnahme += b.gebaeudeEinnahme;
    out.gebaeudeUnterhalt += b.gebaeudeUnterhalt;
    out.rangAbschlag += b.rangAbschlag ?? 0;
    out.cashDelta += b.cashDelta;
    out.anzahl += 1;
  }
  return {
    gehalt: runde1(out.gehalt),
    sponsorBasis: runde1(out.sponsorBasis),
    gebaeudeEinnahme: runde1(out.gebaeudeEinnahme),
    gebaeudeUnterhalt: runde1(out.gebaeudeUnterhalt),
    rangAbschlag: runde1(out.rangAbschlag),
    cashDelta: runde1(out.cashDelta),
    anzahl: out.anzahl,
  };
}

/**
 * Die Kasse, nach der KI-Entscheidungen mitten in der Saison urteilen (Chris, 22.11.): die Kasse VOR den Spieltagsbuchungen,
 * `kasse - Summe der Ledger-cashDelta` (dieselbe Rechnung wie `anfangskasse` des Vorstands). Im Altmodus rutschte die Kasse
 * mitten in der Saison nie um Gehalt, Basis und Gebaeude; ohne diese Rueckrechnung wuerde die KI-Verlaengerung durch die
 * niedrigere Zwischenkasse zurueckhaltender. Die harte Grenze bleibt die echte Kasse (Vorstands-Freigabe, Kauf-Pruefung).
 * Ohne Stempel, ohne Buchung oder fuer ein Team ohne Ledger: die echte Kasse, unveraendert.
 */
export function kasseVorSpieltagsbuchungen(
  gameState: Pick<GameState, "season" | "seasonState">,
  teamId: string,
  kasse: number,
): number {
  if (!spieltagBuchungenNochOffen(gameState, teamId)) return kasse;
  const gebucht = summeSpieltagBuchungen(gameState, teamId).cashDelta;
  return gebucht === 0 ? kasse : runde1(kasse - gebucht);
}

/**
 * Stehen die Spieltagsbuchungen dieses Teams noch "offen" gegen die Saisonabrechnung? Ja, solange die Saison im Modus je
 * Spieltag laeuft und die Saisonende-Abrechnung des Teams (Marke `season_end` im Sponsor-Log) noch nicht gebucht ist. Danach
 * enthaelt die Kasse schon alles, was der Altmodus am Saisonende gebucht haette (Rang-Schlussausgleich und Basis-Rest
 * gleichen das Ledger aus); eine Rueckrechnung um das Ledger waere dann doppelt.
 */
export function spieltagBuchungenNochOffen(gameState: Pick<GameState, "season" | "seasonState">, teamId: string): boolean {
  if (!istJeSpieltagSaison(gameState)) return false;
  const seasonId = gameState.seasonState.seasonId ?? gameState.season?.id;
  return !(gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.teamId === teamId && log.phase === "season_end",
  );
}

/** Anteil der Saison, der noch NICHT je Spieltag gebucht ist (0 im Normalfall; 1 vor Spieltag 1). */
export function ungebuchterAnteil(gameState: Pick<GameState, "season" | "seasonState">, teamId: string): number {
  const n = spieltageDerSaison(gameState);
  if (n <= 0) return 1;
  const k = summeSpieltagBuchungen(gameState, teamId).anzahl;
  return Math.max(0, Math.min(1, (n - k) / n));
}

/**
 * Das Jahresgehalt EINES Kadereintrags an Spieltag `matchdayIndex` (1-basiert). Ohne In-Saison-Verlaengerung ist es das
 * aktuelle Vertragsgehalt; mit Vermerk (`inSaisonVerlaengerung`, nur in seiner Saison) gilt bis `spieltageAlt` das alte
 * und danach das neue Gehalt — die Verlaengerung wirkt ab dem naechsten Spieltag, nie rueckwirkend, und die Mischrechnung
 * (`mischeSaisongehalt`) ist in diesem Modus nicht noetig, weil jeder Spieltag sein Gehalt selbst bucht.
 */
export function gehaltAmSpieltag(
  entry: Pick<RosterEntry, "inSaisonVerlaengerung">,
  seasonId: string,
  aktuell: number,
  matchdayIndex: number,
): number {
  const v = entry.inSaisonVerlaengerung;
  if (!v || v.seasonId !== seasonId) return aktuell;
  if (Math.abs(aktuell - v.neuesGehalt) > 0.05) return aktuell;
  return matchdayIndex <= v.spieltageAlt ? v.altesGehalt : v.neuesGehalt;
}

/** Jahresgehalt des Kaders (Summe der Vertragsgehaelter) an Spieltag `matchdayIndex`; ohne Index das aktuelle. */
export function kaderJahresgehaltAmSpieltag(
  gameState: Pick<GameState, "players" | "rosters" | "season">,
  teamId: string,
  matchdayIndex: number | null,
): number {
  const playerById = new Map(gameState.players.map((p) => [p.id, p] as const));
  const seasonId = gameState.season?.id ?? "";
  let summe = 0;
  for (const entry of gameState.rosters) {
    if (entry.teamId !== teamId) continue;
    const player = playerById.get(entry.playerId) ?? null;
    const aktuell = resolvePlayerEconomyContract({ player, rosterEntry: entry }).salary ?? 0;
    summe += matchdayIndex == null ? aktuell : gehaltAmSpieltag(entry, seasonId, aktuell, matchdayIndex);
  }
  return summe;
}

/**
 * DAS SAISONGEHALT IM MODUS "JE SPIELTAG": bereits gebucht plus der Rest zum heutigen Gehalt. Das ist die Zahl, die
 * `getTeamActualSalaryTotal` (Finanzseite, GuV, Standings) zeigt — groß je Saison, klein je Spieltag bleibt die Anzeige.
 * Ohne ungebuchte Spieltage (Saisonende) ist es exakt die Summe der gebuchten Gehaelter.
 */
export function saisonGehaltJeSpieltag(gameState: Pick<GameState, "players" | "rosters" | "season" | "seasonState">, teamId: string): number {
  const n = spieltageDerSaison(gameState);
  const s = summeSpieltagBuchungen(gameState, teamId);
  const offen = Math.max(0, n - s.anzahl);
  const rest = n > 0 && offen > 0 ? (kaderJahresgehaltAmSpieltag(gameState, teamId, null) * offen) / n : 0;
  return -s.gehalt + rest;
}

/** Das noch ungebuchte Gehalt (positive Zahl): am Saisonende nur noch der Nachtrag fuer nicht gebuchte Spieltage. */
export function ungebuchtesGehalt(gameState: Pick<GameState, "players" | "rosters" | "season" | "seasonState">, teamId: string): number {
  const n = spieltageDerSaison(gameState);
  const s = summeSpieltagBuchungen(gameState, teamId);
  const offen = Math.max(0, n - s.anzahl);
  if (n <= 0 || offen <= 0) return 0;
  return runde1((kaderJahresgehaltAmSpieltag(gameState, teamId, null) * offen) / n);
}

/** Ein Jahresbetrag zu 1/N, mit Rundungsrest aus der Vorbuchung. Gibt den gerundeten Betrag und den neuen Rest zurueck. */
export function teileJahresbetrag(jahresbetrag: number, n: number, restVorher: number): { betrag: number; rest: number } {
  if (!(n > 0) || !Number.isFinite(jahresbetrag)) return { betrag: 0, rest: restVorher };
  const roh = jahresbetrag / n + restVorher;
  const betrag = runde1(roh);
  return { betrag, rest: roh - betrag };
}
