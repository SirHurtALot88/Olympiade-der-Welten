/**
 * MARKETABILITY IM TRANSFERMARKT (22.11., docs/design/marketing-22-11.md 5.1): eine eigene Spalte, gerechnet fuer das AKTIVE Team
 * (`activeManagerTeamId`), mit dem Scouting-Nebel in festen Stufen: unbekannt 10er, beobachtet 5er, gescoutet exakt. Nie "~Zahl".
 *
 * Diese Funktion laeuft NUR auf dem Server (Lesedienst des Marktes) und liefert dem Browser ausschliesslich die Stufe: kein Werbegeld, kein
 * Team-Anteil, keine Teilformel, keinen Wert, der genauer waere als die Stufe. Werbegeld und Team-Anteil zeigt der Markt erst, wenn der Spieler im
 * eigenen Kader steht (dann gilt die Seite Marketing). Sortieren und Filtern lesen `schluessel` = Mitte der Stufe (fuer alle Spieler einer
 * Stufe gleich, Gleichstand nach Name, siehe `lib/market/transfermarkt-sicht.ts`).
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { fanProfilFuer, leistungsPerzentile, ligaStufeFuer, teamErfolgVorsaison } from "@/lib/marketing/marketing-kontext";
import { berechneMarketing, type FanProfil } from "@/lib/marketing/marketing-modell";
import { baueSichtWert } from "@/lib/market/transfermarkt-sicht";
import { marketingAktiv } from "@/lib/marketing/marketing-regel";

export type MarktMarketabilitySicht = {
  /** Untere und obere Grenze der Stufe (bei exakt gleich dem Wert). */
  von: number;
  bis: number;
  exakt: boolean;
  /** Scouting-Stufe 0..5, nach der verdeckt wurde. */
  stufe: number;
  /** Anzeige: "80–89", "85–89" oder "88". */
  text: string;
  /** Sortierschluessel: Mitte der Stufe, fuer alle Spieler derselben Stufe gleich. */
  schluessel: number;
};

export type MarktSpielerEingabe = {
  id: string;
  race: string;
  className: string;
  alignment?: string | null;
  traits?: string[];
  traitsPositive?: string[];
  traitsNegative?: string[];
  leistungPerz?: number;
};

export function baueMarktMarketability(
  gameState: GameState,
  teamId: string,
  spieler: MarktSpielerEingabe,
  scoutingStufe: number,
  profilUeberschreiben?: FanProfil,
): MarktMarketabilitySicht {
  const erfolg = teamErfolgVorsaison(gameState, teamId);
  const ergebnis = berechneMarketing(
    {
      race: spieler.race,
      className: spieler.className,
      alignment: spieler.alignment,
      traits: spieler.traits ?? [...(spieler.traitsPositive ?? []), ...(spieler.traitsNegative ?? [])],
      leistungPerz: spieler.leistungPerz ?? leistungsPerzentile(gameState).get(spieler.id) ?? 0,
      gehalt: 0,
    },
    { profil: profilUeberschreiben ?? fanProfilFuer(gameState, teamId), liga: ligaStufeFuer(gameState, teamId), erfolgPunkte: erfolg.punkte, erfolgGrund: erfolg.grund },
  );
  const sicht = baueSichtWert(ergebnis.marketability, scoutingStufe);
  const von = sicht.von ?? 0;
  const bis = sicht.bis ?? 0;
  return { von, bis, exakt: sicht.exakt, stufe: scoutingStufe, text: sicht.text, schluessel: (von + bis) / 2 };
}

/** Scouting-Stufe zur Nebelbreite des Spielerprofils (0 = exakt, 5 = beobachtet, 10 = unbekannt), dieselbe Stufung wie im Markt. */
export function scoutingStufeAusNebelBreite(breite: 0 | 5 | 10): number {
  return breite === 0 ? 5 : breite === 5 ? 1 : 0;
}

/**
 * Marketability eines Spielers aus dem Spielstand fuer das AKTIVE Team (Spielerprofil, Drawer): dieselbe Rechnung wie im Transfermarkt
 * (`baueMarktMarketability`), gezeigt = gebucht. `null`, wenn Marketing im Spielstand nicht gilt oder der Spieler fehlt.
 */
export function marketabilityFuerSpieler(
  gameState: GameState,
  teamId: string | null,
  playerId: string,
  nebelBreite: 0 | 5 | 10,
): MarktMarketabilitySicht | null {
  if (!teamId || !marketingAktiv(gameState)) return null;
  const p = gameState.players.find((x) => x.id === playerId);
  if (!p) return null;
  return baueMarktMarketability(gameState, teamId, p as unknown as MarktSpielerEingabe, scoutingStufeAusNebelBreite(nebelBreite));
}
