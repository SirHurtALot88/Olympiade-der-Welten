/**
 * BUCHUNG DER TRANSFERBILANZ: „DAS FENSTER VOR SAISON N GEHOERT ZU SAISON N" (Chris 18.11., „ok dann mach das so!").
 *
 * CHRIS' BESCHWERDE: der Draft wurde als Kauf gewertet und die Verkaeufe am Saisonende dagegen — dadurch stand
 * in Saison 1 bei praktisch jedem Team eine tief negative Transferbilanz, obwohl niemand „schlecht gehandelt"
 * hatte. Ein Team, das sich aus dem Startbudget einen Kader baut, hat keine Transferbilanz, es hat einen
 * Kaderaufbau.
 *
 * DIE REGEL, an EINER Stelle:
 *
 *   1. Jeder Kauf/Verkauf gehoert zum TRANSFERFENSTER seiner Saison. Saisonende-Verkaeufe des alten Ablaufs
 *      (am letzten Spieltag der Saison N mit `seasonId` N gebucht) gehoeren zum Fenster der Saison N+1 — die
 *      Zuordnung dafuer gibt es seit #459 (`lib/foundation/transfer-window-zuordnung.ts`) und wird hier
 *      wiederverwendet, nicht nachgebaut. Im gemeinsamen Fenster (Kaufen und Verkaufen in der neuen Saison
 *      vor Spieltag 1) tragen alle Eintraege ohnehin schon die richtige Saison.
 *   2. Alles, was zum Fenster der SAISON 1 gehoert — Liga-Draft (`ai_roster_fill`), eigene Draft-Picks
 *      (`manual_transfermarkt_buy` auf `matchday-1`), Maskottchen-Regel, Verkaeufe vor Spieltag 1 —, ist
 *      KADERAUFBAU AUS DEM STARTBUDGET, keine Transferbilanz. Transferbilanz Saison 1 = leer (`null`, „—").
 *   3. Ab Saison 2: Transferbilanz = Erloese − Ablösen aller Kaeufe/Verkaeufe, die zum Fenster dieser Saison
 *      gehoeren — unabhaengig von der Quelle (KI, Mensch, Fuell-Lauf, Verletzungs-Nachkauf).
 *   4. `contract_exit` (auslaufende Vertraege) ist kein Transfer und zaehlt in keine der beiden Summen.
 *
 * NICHTS AM GESPEICHERTEN GELD WIRD GEAENDERT. Die Historie bleibt, wie sie ist; diese Zuordnung ist Buchung
 * und Anzeige. Deshalb rechnet sie auch alte Spielstaende ohne Migration richtig: die Draft-Kaeufe erkennt sie
 * an ihrer Fenster-Saison (1), die Saisonende-Verkaeufe an ihrem Spieltag (dem letzten der Saison).
 *
 * Betraege: Ablöse (`fee`), wie bisher in Saisonstand, Schnappschuss und Vorstandszielen.
 */
import type { TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import {
  ermittleFensterSaisonId,
  ermittleLetzteSpieltageJeSaison,
  saisonNummer,
} from "@/lib/foundation/transfer-window-zuordnung";

export type TransferBuchungsArt = "kaderaufbau" | "transfer" | "vertragsende";

export type TransferBuchung = {
  /** Die Saison, zu der der Eintrag gebucht wird (Fenster vor Saison N → N). */
  saisonId: string;
  art: TransferBuchungsArt;
};

export type TransferBuchungsSumme = {
  kaeufe: number;
  verkaeufe: number;
  anzahlKaeufe: number;
  anzahlVerkaeufe: number;
  /** Erloese − Ausgaben. */
  netto: number;
};

export type TeamTransferBuchung = {
  teamId: string;
  saisonId: string;
  /** Nur Saison 1: Draft/Startkader aus dem Startbudget. `null` ab Saison 2. */
  kaderaufbau: TransferBuchungsSumme | null;
  /** Ab Saison 2: das Transferfenster dieser Saison. `null` in Saison 1. */
  transfer: TransferBuchungsSumme | null;
  /** Die Transferbilanz fuer Anzeigen und Vorstandsziele: `null` in Saison 1 („—"), sonst `transfer.netto`. */
  transferNet: number | null;
  /** Der Kaderaufbau als eine Zahl (negativ = Ausgaben), `null` ab Saison 2. */
  kaderaufbauNet: number | null;
};

type BuchungsKontext = {
  letzteSpieltage: Map<string, number>;
  spieltageProSaison: number | null;
};

function r2(wert: number): number {
  return Math.round(wert * 100) / 100;
}

function betrag(entry: Pick<TransferHistoryEntry, "fee">): number {
  return typeof entry.fee === "number" && Number.isFinite(entry.fee) ? entry.fee : 0;
}

/** Ist das die erste Saison (Kaderaufbau aus dem Startbudget)? */
export function istKaderaufbauSaison(seasonId: string | null | undefined): boolean {
  return saisonNummer(seasonId) === 1;
}

export function bucheTransferEintrag(
  entry: Pick<TransferHistoryEntry, "seasonId" | "matchdayId" | "phase" | "transferType">,
  kontext: BuchungsKontext,
): TransferBuchung {
  if (entry.transferType === "contract_exit") {
    return { saisonId: entry.seasonId, art: "vertragsende" };
  }
  const saisonId = ermittleFensterSaisonId(entry, kontext.letzteSpieltage, kontext.spieltageProSaison);
  return { saisonId, art: istKaderaufbauSaison(saisonId) ? "kaderaufbau" : "transfer" };
}

/** Der Kontext fuer `bucheTransferEintrag` — EINMAL je Historie, nicht je Eintrag. */
export function baueBuchungsKontext(
  historie: readonly TransferHistoryEntry[],
  spieltageProSaison?: number | null,
): BuchungsKontext {
  return {
    letzteSpieltage: ermittleLetzteSpieltageJeSaison(historie),
    spieltageProSaison: spieltageProSaison ?? null,
  };
}

function leereSumme(): TransferBuchungsSumme {
  return { kaeufe: 0, verkaeufe: 0, anzahlKaeufe: 0, anzahlVerkaeufe: 0, netto: 0 };
}

const cache = new WeakMap<readonly TransferHistoryEntry[], Map<string, Map<string, TeamTransferBuchung>>>();

/**
 * Die Transferbuchung ALLER Teams fuer eine Saison. Teams ohne Eintrag bekommen eine leere Buchung
 * (Saison 1: Kaderaufbau 0, Transferbilanz `null`; ab Saison 2: Transferbilanz 0).
 *
 * `spieltageProSaison` (aus `season.matchdayIds.length`) schuetzt die Saisonende-Zuordnung gegen Teilhistorien;
 * ohne Angabe gilt der hoechste vorkommende Spieltag einer Saison als ihr letzter.
 */
export function berechneTransferbuchungJeTeam(input: {
  transferHistory: readonly TransferHistoryEntry[] | null | undefined;
  seasonId: string;
  teamIds: readonly string[];
  spieltageProSaison?: number | null;
}): Map<string, TeamTransferBuchung> {
  const historie = input.transferHistory ?? [];
  // Laenge und letzte ID im Schluessel: manche Pfade haengen in place an dieselbe Liste an.
  const cacheSchluessel = `${historie.length}|${historie[historie.length - 1]?.id ?? ""}|${input.seasonId}|${input.spieltageProSaison ?? ""}|${input.teamIds.join(",")}`;
  const proHistorie = cache.get(historie);
  const treffer = proHistorie?.get(cacheSchluessel);
  if (treffer) return treffer;

  const kontext = baueBuchungsKontext(historie, input.spieltageProSaison);
  const aufbauSaison = istKaderaufbauSaison(input.seasonId);
  const summen = new Map<string, TransferBuchungsSumme>();
  const summeVon = (teamId: string) => summen.get(teamId) ?? summen.set(teamId, leereSumme()).get(teamId)!;

  for (const entry of historie) {
    if (entry.transferType !== "buy" && entry.transferType !== "sell") continue;
    const buchung = bucheTransferEintrag(entry, kontext);
    if (buchung.saisonId !== input.seasonId) continue;
    if (entry.transferType === "buy" && entry.toTeamId) {
      const summe = summeVon(entry.toTeamId);
      summe.kaeufe = r2(summe.kaeufe + betrag(entry));
      summe.anzahlKaeufe += 1;
    } else if (entry.transferType === "sell" && entry.fromTeamId) {
      const summe = summeVon(entry.fromTeamId);
      summe.verkaeufe = r2(summe.verkaeufe + betrag(entry));
      summe.anzahlVerkaeufe += 1;
    }
  }

  const ergebnis = new Map<string, TeamTransferBuchung>();
  const alleTeams = new Set([...input.teamIds, ...summen.keys()]);
  for (const teamId of alleTeams) {
    const summe = summen.get(teamId) ?? leereSumme();
    summe.netto = r2(summe.verkaeufe - summe.kaeufe);
    ergebnis.set(teamId, {
      teamId,
      saisonId: input.seasonId,
      kaderaufbau: aufbauSaison ? summe : null,
      transfer: aufbauSaison ? null : summe,
      transferNet: aufbauSaison ? null : summe.netto,
      kaderaufbauNet: aufbauSaison ? summe.netto : null,
    });
  }

  const neu = proHistorie ?? new Map<string, Map<string, TeamTransferBuchung>>();
  neu.set(cacheSchluessel, ergebnis);
  if (!proHistorie) cache.set(historie, neu);
  return ergebnis;
}

/** Bequemer Einzelzugriff. */
export function berechneTransferbuchungFuerTeam(input: {
  transferHistory: readonly TransferHistoryEntry[] | null | undefined;
  seasonId: string;
  teamId: string;
  spieltageProSaison?: number | null;
}): TeamTransferBuchung {
  return berechneTransferbuchungJeTeam({ ...input, teamIds: [input.teamId] }).get(input.teamId)!;
}

/**
 * ALTSTAENDE IN DER ANZEIGE UMRECHNEN — ein archivierter Saison-Datensatz traegt die Transferzahlen nach der
 * alten Rechnung (alle Eintraege mit `seasonId` dieser Saison, Draft als Kauf). Liegt die Transferhistorie vor,
 * werden die Zahlen hier aus der Buchung neu gesetzt; das gespeicherte Archiv bleibt unangetastet (der
 * Archivschutz `preserveAppendOnlyArchive` haelt es ohnehin Zeichen fuer Zeichen fest).
 *
 * Ohne Historie (oder ohne einen einzigen Eintrag dieser Saison) gilt: Saison 1 → Transferbilanz `null` und der
 * alte Saldo wird als Kaderaufbau gelesen (vor dieser Regel zaehlte in Saison 1 jede Bewegung als Kauf/Verkauf);
 * ab Saison 2 bleibt der gespeicherte Wert stehen.
 */
export type TransferbilanzFelder = {
  transferNet?: number | null;
  transferBuyTotal?: number | null;
  transferSellTotal?: number | null;
  transferBuyCount?: number | null;
  transferSellCount?: number | null;
  kaderaufbauNet?: number | null;
  kaderaufbauBuyTotal?: number | null;
  kaderaufbauSellTotal?: number | null;
  kaderaufbauBuyCount?: number | null;
};

export function rechneTransferbilanzImDatensatzUm<T extends TransferbilanzFelder & { teamId: string }>(
  record: T,
  seasonId: string,
  buchung: TeamTransferBuchung | null,
): T {
  if (buchung) {
    const transfer = buchung.transfer;
    const aufbau = buchung.kaderaufbau;
    return {
      ...record,
      transferNet: buchung.transferNet,
      transferBuyTotal: transfer?.kaeufe ?? 0,
      transferSellTotal: transfer?.verkaeufe ?? 0,
      transferBuyCount: transfer?.anzahlKaeufe ?? 0,
      transferSellCount: transfer?.anzahlVerkaeufe ?? 0,
      kaderaufbauNet: buchung.kaderaufbauNet,
      kaderaufbauBuyTotal: aufbau ? aufbau.kaeufe : null,
      kaderaufbauSellTotal: aufbau ? aufbau.verkaeufe : null,
      kaderaufbauBuyCount: aufbau ? aufbau.anzahlKaeufe : null,
    };
  }
  if (!istKaderaufbauSaison(seasonId)) return record;
  if (record.kaderaufbauNet !== undefined && record.transferNet === null) return record;
  // Ohne Historie: der alte Saldo von Saison 1 war (bis auf die Saisonende-Verkaeufe) der Kaderaufbau.
  const kaeufe = typeof record.transferBuyTotal === "number" ? record.transferBuyTotal : null;
  return {
    ...record,
    transferNet: null,
    kaderaufbauNet: kaeufe != null ? r2(-kaeufe) : record.kaderaufbauNet ?? null,
    kaderaufbauBuyTotal: kaeufe,
    kaderaufbauSellTotal: kaeufe != null ? 0 : null,
    kaderaufbauBuyCount: typeof record.transferBuyCount === "number" ? record.transferBuyCount : null,
  };
}

/**
 * Hat die Historie ueberhaupt Eintraege, die zu dieser Saison gebucht werden? Ohne sie (z. B. eine im Browser
 * beschnittene Historie) waere eine Neuberechnung eine stille Null — dann bleibt der Archivwert.
 */
export function historieKenntSaison(
  transferHistory: readonly TransferHistoryEntry[] | null | undefined,
  seasonId: string,
): boolean {
  const historie = transferHistory ?? [];
  if (historie.length === 0) return false;
  return historie.some((entry) => entry.seasonId === seasonId);
}
