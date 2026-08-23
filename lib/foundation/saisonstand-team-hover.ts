import type { ContractShape, GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

/**
 * DIE DREI HOVERS IM SAISONSTAND — Marktwert, Gehälter, Teamname.
 *
 * GEWÜNSCHT VON CHRIS am 23.08.2026: „Können wir bitte diese Hovers auch im Saisonstand einbauen,
 * dass, wenn ich zum Beispiel dort mit der Maus über den Marktwert von dem jeweiligen Team gehe,
 * dass ich dann die Spieler dahinter sehe, beim Gehalt dasselbe […] immer absteigend sortiert, dass
 * ich, wenn ich mit der Maus über den Teamnamen gehe, so eine kleine Miniansicht bekomme, kompakt
 * aus den Spielern […] weil in der Teamansicht haben wir solche Hovers ja schon etabliert."
 *
 * Genau das ist der Punkt: das Team-Profil hat `mwBreakdown` und `salaryBreakdown` längst. Diese
 * Datei ist deren Zwilling für die Tabelle — REACT-FREI, damit die Regel ohne Rendering prüfbar ist
 * und beide Ansichten dieselbe Sortierung und dieselbe Kappung benutzen.
 *
 * DREI ENTSCHEIDUNGEN, die hier festliegen und nicht in der Ansicht:
 *
 *  1. HÖCHSTENS FÜNF ZEILEN, der Rest als eine Sammelzeile mit Summe. Zwölf Namen in einem Hover
 *     liest niemand — dieselbe Lehre wie beim Saison-Spotlight und beim Trainings-Blocker.
 *  2. ABSTEIGEND SORTIERT, wie Chris es verlangt hat. Spieler ohne Wert stehen hinten und zählen
 *     nicht in die Summe; ein fehlender Marktwert ist keine Null.
 *  3. DER ANTEIL WIRD AN DER GEZEIGTEN SUMME GEMESSEN, nicht an der Spaltensumme der Tabelle. Die
 *     beiden dürfen auseinanderliegen (die Spalte kann aus dem Feed kommen), und ein Prozentwert,
 *     der sich auf eine andere Grundlage bezieht als die Zeilen daneben, wäre schlimmer als keiner.
 */

export const SAISONSTAND_HOVER_MAX_ZEILEN = 5;

/** Ein Kadereintrag, so kompakt wie die drei Hovers ihn brauchen. */
export type SaisonstandHoverSpieler = {
  playerId: string;
  name: string;
  className: string | null;
  marketValue: number | null;
  salary: number | null;
  contractShape: ContractShape | null;
  contractLength: number | null;
  ovr: number | null;
};

export type SaisonstandHoverZeile = {
  playerId: string;
  name: string;
  wert: number;
  /** Anteil an der Summe der gezeigten UND der zusammengefassten Zeilen, 0..1. */
  anteil: number;
  /** Nur beim Gehalts-Hover gesetzt: FL / BL / STD. */
  contractShape: ContractShape | null;
  contractLength: number | null;
};

export type SaisonstandHoverListe = {
  zeilen: SaisonstandHoverZeile[];
  /** Wie viele Spieler die Liste nicht einzeln zeigt. */
  weitere: number;
  /** Summe der zusammengefassten Spieler. */
  weitereSumme: number;
  /** Summe über alle Spieler mit Wert. */
  summe: number;
  /** Spieler ohne belegten Wert — sie zählen nirgends mit, verschwinden aber auch nicht still. */
  ohneWert: number;
};

function endlich(wert: unknown): number | null {
  return typeof wert === "number" && Number.isFinite(wert) ? wert : null;
}

function runde(wert: number, stellen = 2): number {
  return Number(wert.toFixed(stellen));
}

function baueListe(
  spieler: SaisonstandHoverSpieler[],
  lies: (eintrag: SaisonstandHoverSpieler) => number | null,
  mitVertrag: boolean,
): SaisonstandHoverListe {
  const mitWert = spieler
    .map((eintrag) => ({ eintrag, wert: lies(eintrag) }))
    .filter((paar): paar is { eintrag: SaisonstandHoverSpieler; wert: number } => paar.wert != null);
  const ohneWert = spieler.length - mitWert.length;
  mitWert.sort((links, rechts) => rechts.wert - links.wert);
  const summe = runde(mitWert.reduce((gesamt, paar) => gesamt + paar.wert, 0));

  const gezeigt = mitWert.slice(0, SAISONSTAND_HOVER_MAX_ZEILEN);
  const rest = mitWert.slice(SAISONSTAND_HOVER_MAX_ZEILEN);
  const anteilVon = (wert: number) => (summe > 0 ? runde(wert / summe, 4) : 0);

  return {
    zeilen: gezeigt.map(({ eintrag, wert }) => ({
      playerId: eintrag.playerId,
      name: eintrag.name,
      wert: runde(wert),
      anteil: anteilVon(wert),
      contractShape: mitVertrag ? eintrag.contractShape : null,
      contractLength: mitVertrag ? eintrag.contractLength : null,
    })),
    weitere: rest.length,
    weitereSumme: runde(rest.reduce((gesamt, paar) => gesamt + paar.wert, 0)),
    summe,
    ohneWert,
  };
}

/** Marktwerte, absteigend. */
export function buildMarktwertHover(spieler: SaisonstandHoverSpieler[]): SaisonstandHoverListe {
  return baueListe(spieler, (eintrag) => eintrag.marketValue, false);
}

/** Gehälter, absteigend, mit Vertragsform und Restlaufzeit. */
export function buildGehaltHover(spieler: SaisonstandHoverSpieler[]): SaisonstandHoverListe {
  return baueListe(spieler, (eintrag) => eintrag.salary, true);
}

export type SaisonstandTeamHover = {
  kaderGroesse: number;
  /** Ø OVR über die Spieler, die einen tragen. `null`, wenn keiner. */
  ovrSchnitt: number | null;
  /** Die drei wertvollsten Spieler — die Visitenkarte des Teams. */
  top: Array<{ playerId: string; name: string; className: string | null; marketValue: number | null }>;
  /** Wie viele Verträge in dieser Saison auslaufen (Restlaufzeit ≤ 1). */
  auslaufend: number;
};

/** Die kompakte Miniansicht hinter dem Teamnamen. */
export function buildTeamHover(spieler: SaisonstandHoverSpieler[]): SaisonstandTeamHover {
  const mitOvr = spieler.map((eintrag) => eintrag.ovr).filter((wert): wert is number => wert != null);
  const nachWert = [...spieler].sort((links, rechts) => (rechts.marketValue ?? 0) - (links.marketValue ?? 0));
  return {
    kaderGroesse: spieler.length,
    ovrSchnitt: mitOvr.length > 0 ? runde(mitOvr.reduce((a, b) => a + b, 0) / mitOvr.length, 1) : null,
    top: nachWert.slice(0, 3).map((eintrag) => ({
      playerId: eintrag.playerId,
      name: eintrag.name,
      className: eintrag.className,
      marketValue: eintrag.marketValue,
    })),
    auslaufend: spieler.filter((eintrag) => eintrag.contractLength != null && eintrag.contractLength <= 1).length,
  };
}

/**
 * Baut die kompakte Kaderliste eines Teams aus dem Spielstand. Läuft EINMAL beim Aufbau der
 * Tabellenzeilen, nicht bei jedem Hover — 32 Teams zu je ~12 Spielern sind einmal billig und
 * einmal-pro-Bewegung teuer.
 */
export function buildSaisonstandHoverKader(gameState: GameState, teamId: string): SaisonstandHoverSpieler[] {
  const spielerNachId = new Map((gameState.players ?? []).map((spieler) => [spieler.id, spieler] as const));
  const eintraege = (gameState.rosters ?? []).filter((eintrag) => eintrag.teamId === teamId);
  return eintraege
    .map((eintrag: RosterEntry) => {
      const spieler: Player | undefined = spielerNachId.get(eintrag.playerId);
      if (!spieler) return null;
      return {
        playerId: spieler.id,
        name: spieler.name,
        className: (spieler as { className?: string | null }).className ?? null,
        marketValue: endlich((spieler as { displayMarketValue?: number }).displayMarketValue ?? spieler.marketValue),
        // DIESELBE Gehaltszahl wie die Spalte daneben: `team-management-overview.ts` summiert
        // ueber genau diesen Aufruf. Ein zweiter Gehaltsbegriff im Hover waere derselbe Fehler,
        // den die GuV gerade hinter sich hat.
        salary: endlich(resolvePlayerEconomyContract({ player: spieler, rosterEntry: eintrag }).salary),
        contractShape: eintrag.contractShape ?? null,
        contractLength: endlich(eintrag.contractLength),
        ovr: endlich((spieler as { ovr?: number }).ovr),
      } satisfies SaisonstandHoverSpieler;
    })
    .filter((eintrag): eintrag is SaisonstandHoverSpieler => eintrag != null);
}
