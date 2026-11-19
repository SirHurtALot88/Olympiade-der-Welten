/**
 * TRANSFERS-REITER DER HISTORIE (Mockup 18.11.) — die reine Rechnung hinter der Ansicht.
 *
 * KADERAUFBAU GETRENNT VON TRANSFERS (Buchungsregel aus #1634, `lib/season/transferbilanz-buchung.ts`): Kaeufe und
 * Verkaeufe des Fensters vor Saison 1 sind Kaderaufbau aus dem Startbudget und zaehlen in keine Transferbilanz.
 * `buchungsArt` kommt schon aus `useHistoryV2Derivations`; hier wird nur getrennt, gezaehlt und geordnet.
 *
 * PICK UND RUNDE: der Draft speichert sie nicht (`TransferHistoryEntry` kennt weder Pick-Nummer noch Runde). Der
 * Kaderaufbau wird deshalb nach Team gruppiert und nach Zeitstempel geordnet (Chris, Frage 5: Rueckfall).
 */
import { saisonNummer, spieltagNummer } from "@/lib/foundation/transfer-window-zuordnung";

/** Das Minimum, das die Rechnung an einer Zeile liest (passt auf `TransferHistoryV2Row`). */
export type HistorieDealZeile = {
  transferId: string;
  playerId: string;
  playerName: string;
  seasonId: string;
  seasonLabel: string;
  type: "buy" | "sell" | "contract_exit";
  fromTeamId: string | null;
  fromTeamName: string | null;
  toTeamId: string | null;
  toTeamName: string | null;
  fee: number;
  salary: number;
  marketValue: number;
  guv: number | null;
  happenedAt: string;
  matchdayId?: string | null;
  buchungsArt?: "kaderaufbau" | "transfer" | "vertragsende";
};

/** Die Fenster-Saison einer Zeile (`seasonLabel` traegt bereits das Fenster, nicht die Saison des Eintrags). */
export function fensterNummer(zeile: Pick<HistorieDealZeile, "seasonLabel" | "seasonId">): number | null {
  return saisonNummer(zeile.seasonLabel) ?? saisonNummer(zeile.seasonId);
}

/** „Ende S2" (Verkaeufe am Saisonende), „vor ST 1" (Fenster vor Spieltag 1), sonst „ST n". */
export function zeitText(zeile: Pick<HistorieDealZeile, "seasonLabel" | "seasonId" | "matchdayId">): string {
  const eigene = saisonNummer(zeile.seasonId);
  const fenster = fensterNummer(zeile);
  if (eigene != null && fenster != null && eigene < fenster) return `Ende S${eigene}`;
  const spieltag = spieltagNummer(zeile.matchdayId);
  if (spieltag == null || spieltag <= 1) return "vor ST 1";
  return `ST ${spieltag}`;
}

export type DealArt = "kauf" | "verkauf" | "abgang";

export function dealArt(zeile: Pick<HistorieDealZeile, "type">): DealArt {
  return zeile.type === "buy" ? "kauf" : zeile.type === "sell" ? "verkauf" : "abgang";
}

export type HistorieTrennung<T> = {
  /** Fenster vor Saison 1: Kaderaufbau aus dem Startbudget, kein Transfer. */
  kaderaufbau: T[];
  /** Alles andere ausser auslaufenden Vertraegen: Transfers. */
  transfers: T[];
  /** Vertragsende / Abgang, kein Transfer im Sinn der Bilanz. */
  abgaenge: T[];
};

export function trenneKaderaufbau<T extends Pick<HistorieDealZeile, "buchungsArt" | "type">>(zeilen: readonly T[]): HistorieTrennung<T> {
  const ergebnis: HistorieTrennung<T> = { kaderaufbau: [], transfers: [], abgaenge: [] };
  for (const zeile of zeilen) {
    if (zeile.buchungsArt === "kaderaufbau") ergebnis.kaderaufbau.push(zeile);
    else if (zeile.type === "contract_exit" || zeile.buchungsArt === "vertragsende") ergebnis.abgaenge.push(zeile);
    else ergebnis.transfers.push(zeile);
  }
  return ergebnis;
}

export type TeamBilanz = {
  teamId: string;
  teamName: string;
  deals: number;
  kaeufe: number;
  verkaeufe: number;
  /** Ausgaben (Ablösen der Kaeufe). */
  aus: number;
  /** Einnahmen (Ablösen der Verkaeufe). */
  ein: number;
};

/** Bilanz je Team aus Deals; Abgaenge (Vertragsende) zaehlen als Deal, ohne Ablösefluss. */
export function bilanzJeTeam(
  zeilen: readonly Pick<HistorieDealZeile, "type" | "fee" | "fromTeamId" | "fromTeamName" | "toTeamId" | "toTeamName">[],
  namen?: ReadonlyMap<string, string>,
): TeamBilanz[] {
  const karte = new Map<string, TeamBilanz>();
  const eintrag = (teamId: string, name: string | null | undefined) => {
    const vorhanden = karte.get(teamId);
    if (vorhanden) return vorhanden;
    const neu: TeamBilanz = { teamId, teamName: namen?.get(teamId) ?? name ?? teamId, deals: 0, kaeufe: 0, verkaeufe: 0, aus: 0, ein: 0 };
    karte.set(teamId, neu);
    return neu;
  };
  for (const zeile of zeilen) {
    if (zeile.type === "buy" && zeile.toTeamId) {
      const e = eintrag(zeile.toTeamId, zeile.toTeamName);
      e.deals += 1;
      e.kaeufe += 1;
      e.aus += zeile.fee;
    }
    if ((zeile.type === "sell" || zeile.type === "contract_exit") && zeile.fromTeamId) {
      const e = eintrag(zeile.fromTeamId, zeile.fromTeamName);
      e.deals += 1;
      e.verkaeufe += 1;
      if (zeile.type === "sell") e.ein += zeile.fee;
    }
  }
  return [...karte.values()];
}

/** CSV mit Semikolon (deutsche Tabellenprogramme), eine Zeile je Deal. */
export function dealsAlsCsv(zeilen: readonly HistorieDealZeile[]): string {
  const kopf = ["Zeit", "Fenster", "Spieler", "Art", "Von", "An", "Abloese", "Gehalt", "Marktwert", "GuV", "Buchung"];
  const zahl = (wert: number | null) => (wert == null ? "" : String(wert).replace(".", ","));
  const text = (wert: string) => `"${wert.replace(/"/g, '""')}"`;
  const zeilenText = zeilen.map((zeile) =>
    [
      text(zeitText(zeile)),
      text(zeile.seasonLabel),
      text(zeile.playerName),
      text(dealArt(zeile)),
      text(zeile.fromTeamName ?? ""),
      text(zeile.toTeamName ?? ""),
      zahl(zeile.fee),
      zahl(zeile.salary),
      zahl(zeile.marketValue),
      zahl(zeile.guv),
      text(zeile.buchungsArt ?? ""),
    ].join(";"),
  );
  return [kopf.join(";"), ...zeilenText].join("\n");
}
