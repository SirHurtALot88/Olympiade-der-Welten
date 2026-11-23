/**
 * WERBEKLAUSEL JE VERTRAG (23.11., docs/design/werbeklausel-aushaengeschild-23-11.md). Eine Stelle fuer Kauf, Verlaengerung, KI und Anzeige:
 * welche Stufe gilt, was sie am Gehalt aendert und was sie dem Team bringt (Vorschau = Buchung, beide lesen `berechneMarketing`).
 *
 *   Spieler behaelt mehr   -10 Punkte Team-Anteil, Gehalt -2,5 %, Sicherheitsnetz 22 % des Gehalts
 *   Standard                 0 Punkte,             Gehalt wie gefordert, Netz 25 %
 *   Team bekommt mehr      +10 Punkte,             Gehalt +2,5 % (Loyal ohne Aufschlag), Netz 28 %
 *
 * `Egomaniac` und `Diva` lehnen „Team bekommt mehr“ ab. Die Klausel gilt nur mit der Regel `klausel-v2` (`werbeklauselAktiv`); davor bleibt
 * jeder Vertrag auf Standard. Die KI (reine KI-Teams UND delegierter Bereich Kaeufe/Verkaeufe/Vertraege) waehlt nach dem Finanzwert des Teams:
 * ab 7 „Team bekommt mehr“, unter 4 „Spieler behaelt mehr“, sonst Standard, mit denselben Ablehnungen wie ein Mensch.
 */
import type { GameState, Player, RosterEntry } from "@/lib/data/olyDataTypes";
import { normalisiereFinanzwert } from "@/lib/finance/ki-ruecklage";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { marketingSpielerFuer } from "@/lib/marketing/marketing-kontext";
import {
  KLAUSEL_NAMEN,
  gehaltMitKlausel,
  klauselErlaubt,
  wirksameKlausel,
  type MarketingSpielerErgebnis,
  type Werbeklausel,
} from "@/lib/marketing/marketing-modell";
import { werbeklauselAktiv } from "@/lib/marketing/marketing-regel";

export { KLAUSEL_NAMEN };

export function alleTraitsVon(player: Pick<Player, "traitsPositive" | "traitsNegative">): string[] {
  return [...(player.traitsPositive ?? []), ...(player.traitsNegative ?? [])];
}

/** Die Stufe, die die KI fuer dieses Team waehlt (Finanzwert aus der Team-Matrix, 1 bis 10). */
export function kiKlauselFuerTeam(gameState: Pick<GameState, "teamIdentities">, teamId: string): Werbeklausel {
  const finanzwert = normalisiereFinanzwert(gameState.teamIdentities?.find((i) => i.teamId === teamId)?.finances ?? 5);
  return finanzwert >= 7 ? 1 : finanzwert < 4 ? -1 : 0;
}

/** Entscheidet bei diesem Team die KI ueber Vertraege? Reine KI-/passive Teams und ein delegierter Bereich „Kaeufe, Verkaeufe, Vertraege“. */
export function klauselEntscheidetKi(gameState: Pick<GameState, "seasonState">, teamId: string): boolean {
  const settings = gameState.seasonState?.teamControlSettings?.[teamId];
  if (!settings) return true;
  if (settings.controlMode !== "manual") return true;
  return isBereichDelegiert(settings, "transfers");
}

/**
 * Die Stufe, die ein NEUER oder verlaengerter Vertrag bekommt. `gewaehlt` ist die Wahl des Menschen im Dialog (`undefined`/`null` = nicht
 * gewaehlt: dann entscheidet die KI-Regel, wenn die KI hier entscheidet, sonst Standard). Ohne die Regel `klausel-v2` immer Standard.
 */
export function klauselFuerVertrag(
  gameState: GameState,
  teamId: string,
  player: Pick<Player, "traitsPositive" | "traitsNegative">,
  gewaehlt: Werbeklausel | null | undefined,
): Werbeklausel {
  if (!werbeklauselAktiv(gameState)) return 0;
  const traits = alleTraitsVon(player);
  if (gewaehlt === -1 || gewaehlt === 0 || gewaehlt === 1) return wirksameKlausel(gewaehlt, traits);
  if (klauselEntscheidetKi(gameState, teamId)) return wirksameKlausel(kiKlauselFuerTeam(gameState, teamId), traits);
  return 0;
}

export type KlauselZeile = {
  klausel: Werbeklausel;
  name: string;
  /** Gehalt je Saison mit Klausel (das gebuchte). */
  gehalt: number;
  erlaubt: boolean;
  ergebnis: MarketingSpielerErgebnis | null;
  /** Werbegeld ans Team minus Standard-Zeile. */
  zusatzTeam: number;
  /** Gehalt minus Standard-Gehalt. */
  zusatzGehalt: number;
  /** Zusatzertrag minus Mehrgehalt (Saldo gegen Standard je Saison). */
  saldo: number;
};

/**
 * Die drei Zeilen der Verhandlung: je Stufe Gehalt, Team-Anteil, Werbegeld ans Team und an ihn, Saldo gegen Standard. `basisGehalt` ist das
 * verhandelte Gehalt VOR der Klausel; `restlaufzeit` die Laufzeit des neuen Vertrags. Eine Funktion fuer die Vorschau im Dialog und fuer
 * Tests; die Buchung rechnet danach mit `marketingSpielerFuer` ueber den gespeicherten Vertrag, also mit derselben Formel.
 */
export function klauselZeilen(
  gameState: GameState,
  teamId: string,
  player: Player,
  basisGehalt: number,
  restlaufzeit: number,
  moralOhne: number | null,
  /** true (Kauf): der Spieler ist noch nicht im Kader und kann nicht das Gesicht sein; false (Verlaengerung): gilt sein heutiger Status. */
  istNeu = true,
): KlauselZeile[] {
  const traits = alleTraitsVon(player);
  const eintrag = (k: Werbeklausel, gehalt: number): RosterEntry =>
    ({ id: "klausel-vorschau", teamId, playerId: player.id, salary: gehalt, upkeep: gehalt, contractLength: restlaufzeit, marketingKlausel: k }) as RosterEntry;
  const zeilen = ([-1, 0, 1] as const).map((klausel) => {
    const erlaubt = klauselErlaubt(klausel, traits);
    const gehalt = gehaltMitKlausel(basisGehalt, klausel, traits);
    const ergebnis = erlaubt ? marketingSpielerFuer(gameState, teamId, player, eintrag(klausel, gehalt), moralOhne, istNeu ? false : undefined) : null;
    return { klausel, name: KLAUSEL_NAMEN[String(klausel) as "-1" | "0" | "1"], gehalt, erlaubt, ergebnis, zusatzTeam: 0, zusatzGehalt: 0, saldo: 0 } satisfies KlauselZeile;
  });
  const standard = zeilen[1]!;
  return zeilen.map((z) => {
    const zusatzTeam = z.ergebnis && standard.ergebnis ? z.ergebnis.ansTeam - standard.ergebnis.ansTeam : 0;
    const zusatzGehalt = z.gehalt - standard.gehalt;
    return { ...z, zusatzTeam, zusatzGehalt, saldo: zusatzTeam - zusatzGehalt };
  });
}
