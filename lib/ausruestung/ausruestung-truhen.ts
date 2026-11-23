/**
 * AUSRUESTUNG: TRUHEN (Phase 1a, 22.11., Konzept §11 und §52).
 *
 * Drei Truhen: Holz (10 Ruhm), Eisen (20), Gold (45). Gold fuer Ruhm hoechstens alle fuenf Spieltage (Gutscheine aus
 * Platzierungen zaehlen nicht dagegen). Beim Oeffnen werden die drei Funde GEWUERFELT UND GESPEICHERT (`offeneKiste`), bevor der
 * Spieler waehlt: ein Neuladen der Seite oder ein zweiter Klick zeigt dieselben drei Funde. Gewaehlt wird einer, die zwei anderen
 * zerfallen zu Teilen. Passt der gewaehlte nicht ins Lager, bleibt die Kiste offen (`lager_voll`) und man kann zerlegen oder alle
 * drei zu Teilen verwerfen.
 *
 * Phase 1a (Bauplan C1): nur Material, Standard und Selten droppen; die Chancen fuer Episch/Legendaer/Signatur laufen in Selten bzw.
 * Material (`wirksameChancen`).
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { GOLD_ABSTAND_SPIELTAGE, MATERIAL_LABEL, STUFEN, TRUHEN } from "@/lib/ausruestung/ausruestung-katalog";
import { legeMaterialAb, legeTeilAb, leseTeam, mitVerlauf, schreibeTeam, sichereAusruestung } from "@/lib/ausruestung/ausruestung-lager";
import { wirksameChancen, wuerfleKistenFunde, type Chancen } from "@/lib/ausruestung/ausruestung-wuerfel";
import type { AusruestungRegelWechsel, Fund, OffeneKiste, TeamAusruestung, TruhenArt } from "@/lib/ausruestung/ausruestung-typen";

export type TruhenFehler =
  | "nicht_aktiv"
  | "kiste_offen"
  | "kein_ruhm"
  | "gold_abstand"
  | "keine_kiste"
  | "lager_voll"
  | "unbekannte_wahl";

export type AusruestungRegelSicht = Pick<AusruestungRegelWechsel, "besitz" | "wirkung" | "schmiede" | "effekte">;

/** Welche Stufen die Truhen in dieser Regel droppen (Phase 1a: nur Standard und Selten, dazu Material). */
export function erlaubteStufen(regel: AusruestungRegelSicht): { episch: boolean; legendaer: boolean; signatur: boolean } {
  return { episch: regel.schmiede >= 3, legendaer: regel.effekte !== "aus", signatur: regel.schmiede >= 3 };
}

export function truhenChancen(art: TruhenArt, regel: AusruestungRegelSicht): Chancen {
  return wirksameChancen(art, erlaubteStufen(regel));
}

export type TruhenStatus = {
  art: TruhenArt;
  moeglich: boolean;
  grund: TruhenFehler | null;
  /** Womit die Kiste bezahlt wuerde, falls moeglich. */
  bezahlung: "gutschein" | "ruhm" | null;
  ruhmKosten: number;
  ruhmFehlt: number;
  /** Bei `gold_abstand`: so viele Spieltage noch. */
  nochSpieltage: number;
};

/** Kann dieses Team jetzt diese Truhe oeffnen, und womit wuerde es zahlen? */
export function truhenStatus(gameState: Pick<GameState, "ausruestung">, teamId: string, art: TruhenArt): TruhenStatus {
  const team = leseTeam(gameState, teamId);
  const spieltage = gameState.ausruestung?.spieltage ?? 0;
  const kosten = TRUHEN[art].ruhm;
  const basis = { art, ruhmKosten: kosten, ruhmFehlt: 0, nochSpieltage: 0 };
  if (team.offeneKiste) return { ...basis, moeglich: false, grund: "kiste_offen", bezahlung: null };
  if (team.gutscheine[art] > 0) return { ...basis, moeglich: true, grund: null, bezahlung: "gutschein" };
  if (team.ruhm < kosten) return { ...basis, moeglich: false, grund: "kein_ruhm", bezahlung: null, ruhmFehlt: kosten - team.ruhm };
  if (art === "gold" && team.letztesRuhmGold !== null) {
    const seit = spieltage - team.letztesRuhmGold;
    if (seit < GOLD_ABSTAND_SPIELTAGE) return { ...basis, moeglich: false, grund: "gold_abstand", bezahlung: null, nochSpieltage: GOLD_ABSTAND_SPIELTAGE - seit };
  }
  return { ...basis, moeglich: true, grund: null, bezahlung: "ruhm" };
}

export type TruheErgebnis = { ok: true; gameState: GameState; meldung: string } | { ok: false; grund: TruhenFehler; meldung: string };

const FEHLER_TEXT: Record<TruhenFehler, string> = {
  nicht_aktiv: "Die Ausrüstung ist in diesem Spielstand nicht aktiv.",
  kiste_offen: "Es liegt noch eine offene Kiste. Erst einen Fund wählen.",
  kein_ruhm: "Nicht genug Ruhm für diese Truhe.",
  gold_abstand: "Die Goldtruhe gibt es für Ruhm höchstens alle fünf Spieltage.",
  keine_kiste: "Es liegt keine offene Kiste.",
  lager_voll: "Das Lager ist voll. Erst ein Teil zerlegen oder die Kiste verwerfen.",
  unbekannte_wahl: "Diesen Fund gibt es nicht.",
};

export function fehlerText(grund: TruhenFehler): string {
  return FEHLER_TEXT[grund];
}

function fundText(f: Fund): string {
  return f.art === "teil" ? f.teil.name : `${f.anzahl}× ${MATERIAL_LABEL[f.material]}`;
}

/**
 * Oeffnet eine Truhe: bezahlt (Gutschein vor Ruhm), wuerfelt die drei Funde aus der Saat und speichert sie. Das Team darf nur eine
 * Kiste zugleich offen haben. `verlaufBehalten`: Verlaufszeilen nur fuer Teams von Menschen (haelt den Spielstand klein).
 */
export function oeffneKiste(
  gameState: GameState,
  teamId: string,
  art: TruhenArt,
  regel: AusruestungRegelSicht,
  verlaufBehalten = true,
): TruheErgebnis {
  if (!regel.besitz) return { ok: false, grund: "nicht_aktiv", meldung: fehlerText("nicht_aktiv") };
  const basis = sichereAusruestung(gameState);
  const status = truhenStatus(basis, teamId, art);
  if (!status.moeglich || !status.bezahlung) {
    const grund = status.grund ?? "kein_ruhm";
    return { ok: false, grund, meldung: grund === "gold_abstand" ? `${fehlerText(grund)} Noch ${status.nochSpieltage} Spieltag${status.nochSpieltage === 1 ? "" : "e"}.` : fehlerText(grund) };
  }
  const team = leseTeam(basis, teamId);
  const sp = basis.ausruestung!;
  const funde = wuerfleKistenFunde(sp.saat, teamId, team.kisten, art, truhenChancen(art, regel));
  const kiste: OffeneKiste = { truhe: art, kisteNr: team.kisten, spieltag: sp.spieltage, funde, bezahlt: status.bezahlung };
  let neu: TeamAusruestung = {
    ...team,
    offeneKiste: kiste,
    kisten: team.kisten + 1,
    ruhm: status.bezahlung === "ruhm" ? team.ruhm - status.ruhmKosten : team.ruhm,
    gutscheine: status.bezahlung === "gutschein" ? { ...team.gutscheine, [art]: team.gutscheine[art] - 1 } : team.gutscheine,
    letztesRuhmGold: art === "gold" && status.bezahlung === "ruhm" ? sp.spieltage : team.letztesRuhmGold,
  };
  neu = mitVerlauf(neu, sp.spieltage, `${TRUHEN[art].name} geöffnet: ${funde.map(fundText).join(" · ")}`, verlaufBehalten);
  return { ok: true, gameState: schreibeTeam(basis, teamId, neu), meldung: `${TRUHEN[art].name} geöffnet.` };
}

/** Teile, die ein nicht gewaehlter Fund beim Zerfall ergibt: Ausruestung nach Stufe, Material 1. */
export function zerfallTeile(f: Fund): number {
  return f.art === "teil" ? STUFEN[f.teil.seltenheit].zerlegenTeile : 1;
}

/** Waehlt einen der drei Funde: er kommt ins Lager, die beiden anderen zerfallen zu Teilen. Passt er nicht, bleibt die Kiste offen. */
export function waehleFund(gameState: GameState, teamId: string, index: number, verlaufBehalten = true): TruheErgebnis {
  const team = leseTeam(gameState, teamId);
  const kiste = team.offeneKiste;
  if (!kiste) return { ok: false, grund: "keine_kiste", meldung: fehlerText("keine_kiste") };
  if (!Number.isInteger(index) || index < 0 || index > 2) return { ok: false, grund: "unbekannte_wahl", meldung: fehlerText("unbekannte_wahl") };
  const fund = kiste.funde[index]!;
  let neu: TeamAusruestung;
  if (fund.art === "teil") {
    const r = legeTeilAb(team, fund.teil);
    if (!r.ok) return { ok: false, grund: "lager_voll", meldung: fehlerText("lager_voll") };
    neu = r.team;
  } else {
    const r = legeMaterialAb(team, fund.material, fund.anzahl);
    if (!r.ok) return { ok: false, grund: "lager_voll", meldung: fehlerText("lager_voll") };
    neu = r.team;
  }
  const verfall = kiste.funde.reduce((a, f, i) => (i === index ? a : a + zerfallTeile(f)), 0);
  neu = { ...neu, teile: neu.teile + verfall, offeneKiste: null };
  const sp = gameState.ausruestung?.spieltage ?? 0;
  neu = mitVerlauf(neu, sp, `Gewählt: ${fundText(fund)} · zwei Funde zerfielen zu ${verfall} Teil${verfall === 1 ? "" : "en"}`, verlaufBehalten);
  return { ok: true, gameState: schreibeTeam(gameState, teamId, neu), meldung: `${fundText(fund)} liegt im Lager. ${verfall} Teile aus den anderen Funden.` };
}

/** Verwirft die offene Kiste: alle drei Funde zerfallen zu Teilen (Ausweg bei vollem Lager). */
export function verwerfeKiste(gameState: GameState, teamId: string, verlaufBehalten = true): TruheErgebnis {
  const team = leseTeam(gameState, teamId);
  const kiste = team.offeneKiste;
  if (!kiste) return { ok: false, grund: "keine_kiste", meldung: fehlerText("keine_kiste") };
  const verfall = kiste.funde.reduce((a, f) => a + zerfallTeile(f), 0);
  const sp = gameState.ausruestung?.spieltage ?? 0;
  const neu = mitVerlauf({ ...team, teile: team.teile + verfall, offeneKiste: null }, sp, `Kiste verworfen: ${verfall} Teile`, verlaufBehalten);
  return { ok: true, gameState: schreibeTeam(gameState, teamId, neu), meldung: `Die Funde zerfielen zu ${verfall} Teilen.` };
}

