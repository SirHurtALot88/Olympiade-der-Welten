/**
 * EIGNUNG NACH ATTRIBUTÄNDERUNG, auch im Browser (Training „Wo das ankommt", 22.11.).
 *
 * Eine Disziplin-Eignung ist der ligaweite RANG der gewichteten Attributsumme, durch die Rang→Stat-Tabelle
 * geschickt (`buildLeagueDisciplineRatingsWithAttributeOverrides`, Gewichte aus der offiziellen Matrix
 * über `calculateRawDisciplineScore`). Der Rang braucht ALLE Spieler der Liga.
 *
 * URSACHE DER „99,3" (Chris 22.11., Aeon Flux, Hockey): die kompakte Anfangsladung streicht die Attributbögen
 * aller fremden Spieler (`foundation-initial-compact-state.ts`, Fog of War); nur der eigene Kader behält sie.
 * Die Engine ließ stillschweigend jeden Spieler ohne Bogen aus der Rangliste fallen, rechnete im Browser also
 * einen Rang unter ~12 Eigenspielern, und Rang 1 ergibt in der Tabelle ~99. Am vollen Server-Stand (alle 2984
 * Bögen) kommt für dieselbe Spielerin 43,4 heraus, wie die Plan-Kacheln (`player.disciplineRatings`). Auch die
 * Zuwächse der anderen Disziplinen waren dort null, weil ein Rang 1 nicht weiter steigen kann.
 *
 * Lösung: Bezugspunkt ist immer der gespeicherte Wert (`player.disciplineRatings`, dieselbe Quelle wie die Kacheln).
 *  - Sind (fast) alle Bögen da (Server, Tests): exakte Engine, nur das Delta wird auf den gespeicherten Wert gelegt.
 *  - Sonst (Browser): das Delta wird aus der Matrix-Rohsumme geschätzt. Als Stützpunkte dienen alle Spieler MIT Bogen
 *    und gespeichertem Wert; die Rohsumme wird über einen Normalverteilungs-Fit zum Rang und durch dieselbe
 *    Rang→Stat-Tabelle geschickt (`schaetzeDeltaEignung`). Gemessen am vollen Stand: mittlerer Abstand 0,08 Punkte.
 *    Die Matrix wird nur gelesen.
 */
import type { Player, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { buildLeagueDisciplineRatingsWithAttributeOverrides, calculateRawDisciplineScore } from "@/lib/player-formulas/discipline-rating-engine";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import rankToDisciplineStatJson from "@/references/formulas/rank-to-discipline-stat.json";
import type { RankToDisciplineStatRow } from "@/lib/player-formulas/discipline-rating-engine";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";

export type EignungsModus = "liga" | "schaetzung";

export type EignungsErgebnis = {
  modus: EignungsModus;
  /** Eignung heute je Disziplin: der gespeicherte Wert (wie die Kacheln), sonst der Engine-Wert. */
  heute: Record<string, number>;
  /** Eignung mit den neuen Attributen (heute + Delta), je Disziplin. */
  nachher: Record<string, number>;
};

/** Ab diesem Anteil Spieler mit Bogen gilt die Liga als vollständig (exakter Engine-Weg). */
export const LIGA_VOLLSTAENDIG_ANTEIL = 0.9;

const MAX_EIGNUNG = 100;

export function attributbogenVon(player: Pick<Player, "attributeSheetStats">): PlayerGeneratorAttributes | null {
  const stats = player.attributeSheetStats;
  if (!stats) return null;
  for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
    const w = (stats as Record<string, unknown>)[a];
    if (typeof w !== "number" || !Number.isFinite(w)) return null;
  }
  return stats as PlayerGeneratorAttributes;
}

function runde(wert: number, stellen = 2) {
  return Number(wert.toFixed(stellen));
}

/* ---- Schätzung: Rohsumme → Rang → Tabelle ------------------------------------------------------------------------
 * Die Rohsumme einer Disziplin ist über die Liga annähernd normalverteilt. Aus den Stützpunkten (Rohsumme, Rang aus dem
 * gespeicherten Wert) wird probit(1 − Rang/N) linear gegen die Rohsumme gefittet; der Rang eines neuen Rohwerts geht dann
 * durch dieselbe Rang→Stat-Tabelle wie in der Engine. Der Achsenabschnitt wird auf den eigenen, bekannten Rang gelegt.
 */
function normalCdf(x: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

function probit(p: number): number {
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const TABELLE = rankToDisciplineStatJson as RankToDisciplineStatRow[];

function statBeiRang(rang: number): number {
  const r = Math.max(1, Math.min(TABELLE.length, rang));
  const unten = Math.floor(r);
  const oben = Math.min(TABELLE.length, unten + 1);
  const a = TABELLE[unten - 1]!.disciplineStat;
  const b = TABELLE[oben - 1]!.disciplineStat;
  return a + (b - a) * (r - unten);
}

/** Mittlerer Rang aller Tabellenzeilen mit diesem Stat (der gespeicherte Wert ist tabellengerundet). */
function rangZuStat(stat: number): number | null {
  let von = -1;
  let bis = -1;
  for (let i = 0; i < TABELLE.length; i += 1) {
    if (Math.abs(TABELLE[i]!.disciplineStat - stat) < 0.005) {
      if (von < 0) von = TABELLE[i]!.rank;
      bis = TABELLE[i]!.rank;
    }
  }
  return von < 0 ? null : (von + bis) / 2;
}

function schaetzeDeltaEignung(input: {
  punkte: Array<{ roh: number; stat: number }>;
  liga: number;
  rohJetzt: number;
  rohNeu: number;
  statJetzt: number;
}): number {
  const { punkte, liga, rohJetzt, rohNeu, statJetzt } = input;
  const rangJetzt = rangZuStat(statJetzt);
  if (rangJetzt == null || punkte.length < 3) return 0;
  const xs: number[] = [];
  const zs: number[] = [];
  for (const p of punkte) {
    const r = rangZuStat(p.stat);
    if (r == null) continue;
    xs.push(p.roh);
    zs.push(probit(1 - (r - 0.5) / liga));
  }
  if (xs.length < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const mz = zs.reduce((a, b) => a + b, 0) / zs.length;
  let sxx = 0;
  let sxz = 0;
  for (let i = 0; i < xs.length; i += 1) {
    sxx += (xs[i]! - mx) ** 2;
    sxz += (xs[i]! - mx) * (zs[i]! - mz);
  }
  const b = sxx > 1e-9 ? sxz / sxx : 0;
  if (b <= 0) return 0;
  const zJetzt = probit(1 - (rangJetzt - 0.5) / liga);
  const zNeu = zJetzt + b * (rohNeu - rohJetzt);
  const rangNeu = Math.max(1, liga * (1 - normalCdf(zNeu)) + 0.5);
  return statBeiRang(rangNeu) - statBeiRang(rangJetzt);
}

export function berechneEignungNachAttributen(input: {
  players: Player[];
  playerId: string;
  neueAttribute: PlayerGeneratorAttributes;
}): EignungsErgebnis | null {
  const { players, playerId, neueAttribute } = input;
  const ich = players.find((p) => p.id === playerId);
  if (!ich) return null;
  const meinBogen = attributbogenVon(ich);
  if (!meinBogen) return null;
  const gespeichert = ich.disciplineRatings ?? {};
  const mitBogen = players.filter((p) => attributbogenVon(p) != null);
  const vollstaendig = mitBogen.length >= players.length * LIGA_VOLLSTAENDIG_ANTEIL;

  if (vollstaendig) {
    const heuteEngine = buildLeagueDisciplineRatingsWithAttributeOverrides(players, {}).get(playerId) ?? {};
    const nachherEngine =
      buildLeagueDisciplineRatingsWithAttributeOverrides(players, { [playerId]: neueAttribute }).get(playerId) ?? {};
    const heute: Record<string, number> = {};
    const nachher: Record<string, number> = {};
    for (const id of Object.keys(heuteEngine)) {
      const h = heuteEngine[id] ?? 0;
      const basis = typeof gespeichert[id] === "number" ? (gespeichert[id] as number) : h;
      heute[id] = basis;
      nachher[id] = Math.max(0, Math.min(MAX_EIGNUNG, runde(basis + ((nachherEngine[id] ?? h) - h))));
    }
    return { modus: "liga", heute, nachher };
  }

  const heute: Record<string, number> = {};
  const nachher: Record<string, number> = {};
  for (const id of officialDisciplineWeightOrder) {
    const basis = gespeichert[id];
    if (typeof basis !== "number" || !Number.isFinite(basis)) continue;
    const punkte: Array<{ roh: number; stat: number }> = [];
    for (const p of mitBogen) {
      const stat = p.disciplineRatings?.[id];
      if (typeof stat !== "number" || !Number.isFinite(stat)) continue;
      const roh = calculateRawDisciplineScore(attributbogenVon(p)!, id);
      if (roh != null) punkte.push({ roh, stat });
    }
    const rohJetzt = calculateRawDisciplineScore(meinBogen, id);
    const rohNeu = calculateRawDisciplineScore(neueAttribute, id);
    heute[id] = basis;
    if (rohJetzt == null || rohNeu == null) {
      nachher[id] = basis;
      continue;
    }
    const liga = players.length;
    const delta = schaetzeDeltaEignung({ punkte, liga, rohJetzt, rohNeu, statJetzt: basis });
    nachher[id] = Math.max(0, Math.min(MAX_EIGNUNG, runde(basis + delta)));
  }
  return { modus: "schaetzung", heute, nachher };
}
