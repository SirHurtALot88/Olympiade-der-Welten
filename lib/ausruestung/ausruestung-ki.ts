/**
 * AUSRUESTUNG: KI (Phase 1a, 22.11., Konzept §55). DIESELBEN Regeln und Funktionen wie der Mensch, je Bereich eine feste
 * Reihenfolge, keine Suche ueber Kombinationen.
 *
 * Phase 1a deckt davon ab: Truhen oeffnen, Fund waehlen, Lager halten (zerlegen ueber der Schwelle). Ausruesten, Reparieren,
 * Haendler, Schmiede folgen mit ihren Phasen.
 *
 *   Truhen oeffnen:  Gutscheine zuerst (Gold, Eisen, Holz), dann Ruhm: Gold, wenn erlaubt, sonst Eisen, sonst Holz — hoechstens
 *                    drei Kisten je Runde.
 *   Wahl aus drei:   Wunschlisten-Material vor hoechster Stufe vor hoechstem `Bonus x Matrixgewicht` (Teilwert); bei Gleichstand der
 *                    erste Fund. Passt der Fund nicht ins Lager, zerlegt die KI zuerst das wertloseste Teil, sonst verwirft sie.
 *   Lager halten:    steht es ueber 12 von 16, wird das Teil mit dem kleinsten Gesamtwert zerlegt (nie Wunschlisten-Material).
 *   Wunschliste:     die Materialien der zwei Familien, deren bevorzugte Attribute in den Disziplinen der zwei staerksten Farben des Teams
 *                    (Team-Identitaet pow/spe/men/soc) das groesste Matrixgewicht tragen.
 *
 * WER SPIELT: KI-Teams und Menschen, die den Bereich `ausruestung` delegiert haben (Halbautomatik = KI, `isBereichDelegiert`).
 * „Mensch ueberschreibt, KI respektiert das“: eine OFFENE Kiste eines selbst fuehrenden Menschen fasst die KI nie an.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { isBereichDelegiert } from "@/lib/foundation/team-delegation";
import { officialDisciplineWeightMatrix, officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import { DISZIPLIN_FARBE, FAMILIEN, SELTENHEITEN } from "@/lib/ausruestung/ausruestung-katalog";
import { leseTeam, schreibeTeam, teileImLager, zerlegeTeil, mitVerlauf } from "@/lib/ausruestung/ausruestung-lager";
import { oeffneKiste, truhenStatus, verwerfeKiste, waehleFund, type AusruestungRegelSicht } from "@/lib/ausruestung/ausruestung-truhen";
import type { DisziplinFarbe, Fund, MaterialId, Teil, TruhenArt } from "@/lib/ausruestung/ausruestung-typen";

/** Ueber dieser Belegung raeumt die KI das Lager auf (Konzept §55: ueber 12 von 16). */
export const KI_LAGER_SCHWELLE = 12;
/** Hoechstens so viele Kisten oeffnet die KI je Runde (je Spieltag). */
export const KI_KISTEN_JE_RUNDE = 3;

/** Summe der Matrixgewichte eines Attributs ueber alle zwanzig Disziplinen (je Attribut 166 oder 167: die Matrix ist ausgeglichen). */
const GEWICHT_SUMME_JE_ATTRIBUT: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  for (const d of officialDisciplineWeightOrder) {
    for (const [attr, w] of Object.entries(officialDisciplineWeightMatrix[d] ?? {})) out[attr] = (out[attr] ?? 0) + (w ?? 0);
  }
  return out;
})();

/**
 * Gesamtwert eines Teils: Summe aus Affix-Wert mal Matrixgewicht des Attributs ueber alle zwanzig Disziplinen; Abzuege aus der
 * Zweischneidigkeit zaehlen negativ, eingeschraenkte Affixe nur anteilig (Farbe: Disziplinen dieser Farbe, einzeln: eine).
 */
export function teilGesamtwert(teil: Teil): number {
  let summe = 0;
  for (const a of teil.affixe) {
    if (a.art !== "attribut") continue;
    let gewicht = GEWICHT_SUMME_JE_ATTRIBUT[a.attribut] ?? 0;
    if (a.nur) {
      gewicht = 0;
      for (const d of officialDisciplineWeightOrder) {
        const gilt = "farbe" in a.nur ? DISZIPLIN_FARBE[d] === a.nur.farbe : d === a.nur.disziplin;
        if (gilt) gewicht += officialDisciplineWeightMatrix[d]?.[a.attribut] ?? 0;
      }
    }
    summe += (a.wert * gewicht) / 100;
    if (a.malus) summe += (a.malus.wert * (GEWICHT_SUMME_JE_ATTRIBUT[a.malus.attribut] ?? 0)) / 100;
  }
  return summe;
}

/** Die Materialien der Wunschliste des Teams (zwei Familien nach den zwei staerksten Farben). */
export function wunschMaterialien(gameState: Pick<GameState, "teamIdentities">, teamId: string): MaterialId[] {
  const id = gameState.teamIdentities.find((t) => t.teamId === teamId);
  const farben: Array<[DisziplinFarbe, number]> = [
    ["pow", id?.pow ?? 0],
    ["spe", id?.spe ?? 0],
    ["men", id?.men ?? 0],
    ["soc", id?.soc ?? 0],
  ];
  const staerkste = new Set(farben.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 2).map(([f]) => f));
  const punkte = FAMILIEN.map((f) => {
    let p = 0;
    for (const d of officialDisciplineWeightOrder) {
      if (!staerkste.has(DISZIPLIN_FARBE[d]!)) continue;
      for (const a of f.bevorzugt) p += officialDisciplineWeightMatrix[d]?.[a] ?? 0;
    }
    return { material: f.material, p, id: f.id };
  }).sort((a, b) => b.p - a.p || a.id.localeCompare(b.id));
  return [...new Set(punkte.slice(0, 2).map((x) => x.material))];
}

function fundRang(f: Fund, wunsch: ReadonlySet<MaterialId>): [number, number, number] {
  if (f.art === "material") return [wunsch.has(f.material) ? 1 : 0, -1, 0];
  return [0, SELTENHEITEN.indexOf(f.teil.seltenheit), teilGesamtwert(f.teil)];
}

/** Die Wahl der KI aus drei Funden: Wunschlisten-Material, dann hoechste Stufe, dann hoechster Gesamtwert, sonst der erste. */
export function kiWaehleIndex(funde: readonly [Fund, Fund, Fund], wunsch: ReadonlySet<MaterialId>): number {
  let bester = 0;
  let besterRang = fundRang(funde[0], wunsch);
  for (let i = 1; i < 3; i += 1) {
    const r = fundRang(funde[i]!, wunsch);
    if (r[0] > besterRang[0] || (r[0] === besterRang[0] && (r[1] > besterRang[1] || (r[1] === besterRang[1] && r[2] > besterRang[2])))) {
      bester = i;
      besterRang = r;
    }
  }
  return bester;
}

/** Das wertloseste Teil im Lager (kleinster Gesamtwert, Gleichstand: das aelteste, also zuerst abgelegte). */
export function wertlosestesTeil(gameState: Pick<GameState, "ausruestung">, teamId: string): Teil | null {
  const teile = teileImLager(leseTeam(gameState, teamId));
  if (teile.length === 0) return null;
  return teile.reduce((a, b) => (teilGesamtwert(b) < teilGesamtwert(a) ? b : a));
}

/** Welche Truhe die KI jetzt oeffnen wuerde (Gold vor Eisen vor Holz, Gutschein oder Ruhm), oder `null`. */
export function kiNaechsteTruhe(gameState: Pick<GameState, "ausruestung">, teamId: string): TruhenArt | null {
  for (const art of ["gold", "eisen", "holz"] as const) {
    if (truhenStatus(gameState, teamId, art).moeglich) return art;
  }
  return null;
}

/** Eine KI-Runde fuer ein Team: Kiste offen, Fund waehlen, Lager halten. Rein; gibt den neuen Spielstand zurueck. */
export function kiAusruestungsRunde(gameState: GameState, teamId: string, regel: AusruestungRegelSicht, verlaufBehalten = false): GameState {
  if (!regel.besitz) return gameState;
  const wunsch = new Set(wunschMaterialien(gameState, teamId));
  let aktuell = gameState;

  const waehle = (): GameState => {
    const kiste = leseTeam(aktuell, teamId).offeneKiste;
    if (!kiste) return aktuell;
    const index = kiWaehleIndex(kiste.funde, wunsch);
    let r = waehleFund(aktuell, teamId, index, verlaufBehalten);
    // Lager voll: das wertloseste Teil zerlegen und noch einmal waehlen; gibt es keines, wird die Kiste verworfen.
    while (!r.ok && r.grund === "lager_voll") {
      const opfer = wertlosestesTeil(aktuell, teamId);
      if (!opfer) { r = verwerfeKiste(aktuell, teamId, verlaufBehalten); break; }
      const z = zerlegeTeil(leseTeam(aktuell, teamId), opfer.id);
      if (!z.ok) break;
      aktuell = schreibeTeam(aktuell, teamId, z.team);
      r = waehleFund(aktuell, teamId, index, verlaufBehalten);
    }
    if (r.ok) aktuell = r.gameState;
    return aktuell;
  };

  // Eine liegengebliebene Kiste (Spielstand aus einer Unterbrechung oder delegierter Bereich) zuerst abarbeiten.
  waehle();
  for (let i = 0; i < KI_KISTEN_JE_RUNDE; i += 1) {
    const art = kiNaechsteTruhe(aktuell, teamId);
    if (!art) break;
    const auf = oeffneKiste(aktuell, teamId, art, regel, verlaufBehalten);
    if (!auf.ok) break;
    aktuell = auf.gameState;
    waehle();
  }

  // Lager halten: ueber der Schwelle wird das wertloseste Teil zerlegt (Wunschlisten-Material liegt als Stapel dort und ist kein Teil).
  while (leseTeam(aktuell, teamId).lager.length > KI_LAGER_SCHWELLE) {
    const opfer = wertlosestesTeil(aktuell, teamId);
    if (!opfer) break;
    const z = zerlegeTeil(leseTeam(aktuell, teamId), opfer.id);
    if (!z.ok) break;
    aktuell = schreibeTeam(aktuell, teamId, mitVerlauf(z.team, aktuell.ausruestung?.spieltage ?? 0, `Zerlegt: ${opfer.name} (+${z.teile} Teile)`, verlaufBehalten));
  }
  return aktuell;
}

/** Spielt die KI dieses Team? KI-Teams ja; Menschen nur, wenn sie den Bereich `ausruestung` delegiert haben. Passive Teams nie. */
export function ausruestungSpieltDieKi(gameState: GameState, teamId: string): boolean {
  const kontrolle = buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings);
  const e = kontrolle[teamId];
  if (!e) return false;
  if (e.controlMode === "ai") return true;
  return e.controlMode === "manual" && isBereichDelegiert(e, "ausruestung");
}
