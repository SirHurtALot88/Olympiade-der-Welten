/**
 * ZIEL-HEATMAP (Training Runde 2, 22.11., docs/design/training-r2-22-11.md Abschnitt 2 und docs/design/training-r2-bau-22-11.md).
 *
 * Eine Zelle je (Ziel-Disziplin, Weg): 20 Disziplinen x 3 Wege. STANDARDMASS sind die SKILLPUNKTE (SP), die der Spieler mit diesem Ziel und diesem
 * Weg bis Saisonende sammelt (Chris, 22.11.: "das soll der Standardwert sein, mit dem gerechnet wird").
 *
 * GEZEIGT = GEBUCHT, KEINE ZWEITE FORMEL: jeder Spieltag der Rechnung ist ein Aufruf von `berechneSpieltagsZuwachs` -- derselben Funktion, die je
 * Spieltag bucht (Budget mit Potenzial, Trait, Fokus, Gebaeude, Entwicklungsgewichten, Decke, Spillover, Trainingsvorliebe, Ausgleich). Die Spieltage
 * folgen einander wie in `prognostiziereDisziplinTraining` (die Attribute des Spielers wachsen von Spieltag zu Spieltag, die Decke bremst); Ausfall-
 * Spieltage einer laufenden Verletzung zaehlen nicht, die Prognose gilt ab der Rueckkehr. Weitere Masse aus derselben Rechnung:
 *
 *   "sp"      Summe der gebuchten Zuwaechse ueber alle Attribute des Wegs (Standard)
 *   "eignung" Eignungszuwachs im Ziel: Summe (Zuwachs je Attribut x Matrixgewicht der Disziplin / 100) -- die Matrix wird nur gelesen
 *   "luft"    Abstand des 60-%-Attributs zur individuellen Decke (zeigt, wo langfristig Platz ist); ohne bekannte Decke 99 - Wert
 *
 * Die Leistungs-Haelfte der Entwicklung (PP) und der Abbau sind hier bewusst nicht dabei: die Heatmap zeigt, WOHIN Training wirkt.
 */
import type {
  GameState,
  Player,
  PlayerGeneratorAttributeName,
  PlayerTrainingsZiel,
} from "@/lib/data/olyDataTypes";
import {
  disziplinFarbe,
  vorliebeArt,
  vorliebeFaktor,
  type VorliebeArt,
} from "@/lib/training/trainings-vorlieben";
import { trainingsVorliebenAktivFuer } from "@/lib/resolve/trainings-vorlieben";
import {
  officialDisciplineWeightLabels,
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
} from "@/lib/player-generator/official-discipline-weights";
import { PROGRESSION_ATTRIBUTE_ORDER } from "@/lib/training/class-progression-config";
import {
  berechneSpieltagsZuwachs,
  bestimmeAusfallSpielerFuerSpieltag,
  hatVollenAttributbogen,
  schwersteMatrixAttribute,
  trainingsProfilFuerZiel,
  wegeFuerDisziplin,
  type TrainingsWeg,
} from "@/lib/training/spieltag-training";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

export type HeatmapMass = "sp" | "eignung" | "luft";
export type Bereich = "pow" | "spe" | "men" | "soc";

export const BEREICHE: ReadonlyArray<{
  id: Bereich;
  kurz: string;
  name: string;
  gegen: Bereich;
}> = [
  { id: "pow", kurz: "POW", name: "Kraft", gegen: "men" },
  { id: "spe", kurz: "SPE", name: "Tempo", gegen: "soc" },
  { id: "men", kurz: "MEN", name: "Kopf", gegen: "pow" },
  { id: "soc", kurz: "SOC", name: "Auftritt", gegen: "spe" },
];

const FARBE_ZU_BEREICH = {
  red: "pow",
  green: "spe",
  blue: "men",
  yellow: "soc",
} as const;

/** Bereich (POW/SPE/MEN/SOC) einer Disziplin, aus ihrer Disziplinfarbe. */
export function bereichVonDisziplin(disziplinId: string): Bereich | null {
  const farbe = disziplinFarbe(disziplinId);
  return farbe ? FARBE_ZU_BEREICH[farbe] : null;
}

export type HeatmapAttribut = {
  attribute: PlayerGeneratorAttributeName;
  anteil: number;
  matrixGewicht: number;
  /** Wert heute. */
  vorher: number;
  /** Individuelle Decke (hoechstens 99), `null` unbekannt. */
  deckel: number | null;
  /** Summe der projizierten Zuwaechse bis Saisonende. */
  zuwachs: number;
  /** Hat die Decke dieses Attribut in mindestens einem Spieltag gebremst? */
  bremst: boolean;
};

export type HeatmapZelle = {
  disziplinId: string;
  weg: TrainingsWeg;
  art: "primaer" | "neben";
  hauptAttribut: PlayerGeneratorAttributeName;
  /** Skillpunkte bis Saisonende (Summe ueber alle Attribute inkl. Nebeneffekt). */
  sp: number;
  /** Eignungszuwachs im Ziel bis Saisonende (SP x Matrixgewicht). */
  eignung: number;
  /** Abstand des Hauptattributs zur Decke. */
  luft: number;
  attribute: HeatmapAttribut[];
  /** Bremst die Decke diesen Weg (mindestens ein Attribut des Profils)? */
  deckeBremst: boolean;
  /** Trainingsbudget-Faktor dieser Zelle (Vorliebe x Ausgleich x Entwicklungsgewichte x Fokus), vom ersten Spieltag. */
  budgetFaktor: number;
};

export type HeatmapZeile = {
  disziplinId: string;
  label: string;
  bereich: Bereich | null;
  /** Eignung des Spielers in dieser Disziplin (Engine-Wert), `null` ohne Wert. */
  eignungHeute: number | null;
  /** Rang in der eigenen Liga in dieser Disziplin (1 = bester) und Zahl der Spieler der Liga; `null` ohne Wert oder Liga. */
  rangLiga: number | null;
  ligaGroesse: number | null;
  vorliebe: VorliebeArt;
  vorliebeFaktor: number;
  zellen: HeatmapZelle[];
};

export type ZielHeatmap = {
  playerId: string;
  modus: PlayerTrainingMode;
  /** Trainings (Spieltage) bis Saisonende in der Rechnung, Ausfall-Spieltage nicht mitgezaehlt. */
  trainings: number;
  spieltageVerletzt: number;
  /** Erster Spieltag, an dem er (wieder) trainiert, `null` bis Saisonende verletzt. */
  ersterTrainingsSpieltag: { matchdayId: string; nummer: number } | null;
  vorliebenAktiv: boolean;
  zeilen: HeatmapZeile[];
};

function modusVon(player: Player): PlayerTrainingMode {
  return player.trainingMode === "leicht" || player.trainingMode === "hart"
    ? player.trainingMode
    : "mittel";
}

/** Die Trainings-Spieltage ab dem naechsten, ohne Ausfall-Spieltage des Spielers (dieselbe Quelle wie die Buchung). */
export function trainingsFenster(
  gameState: GameState,
  playerId: string,
): { ids: string[]; verletzt: number } {
  const alle = gameState.season?.matchdayIds ?? [];
  const aktuell = gameState.matchdayState?.matchdayId ?? alle[0] ?? null;
  const ab = aktuell ? Math.max(0, alle.indexOf(aktuell)) : 0;
  const ids: string[] = [];
  let verletzt = 0;
  for (const id of alle.slice(ab)) {
    if (bestimmeAusfallSpielerFuerSpieltag(gameState, id).has(playerId))
      verletzt += 1;
    else ids.push(id);
  }
  return { ids, verletzt };
}

/**
 * Projektion EINER Zelle: Spieltag fuer Spieltag `berechneSpieltagsZuwachs`, die Attribute wachsen mit. `trainings` ist die Zahl der Trainings-Spieltage.
 * Exportiert, damit Vorschau und Test dieselbe Rechnung wie die Heatmap benutzen.
 */
export function projiziereZelle(input: {
  gameState: GameState;
  player: Player;
  ziel: PlayerTrainingsZiel;
  modus: PlayerTrainingMode;
  trainings: number;
}): HeatmapZelle | null {
  const { gameState, ziel, modus } = input;
  let player = input.player;
  const profil = trainingsProfilFuerZiel(ziel);
  if (profil.length === 0 || !hatVollenAttributbogen(player)) return null;
  const startStats = player.attributeSheetStats as NonNullable<
    Player["attributeSheetStats"]
  >;
  const summe: Partial<Record<PlayerGeneratorAttributeName, number>> = {};
  const bremst = new Set<PlayerGeneratorAttributeName>();
  const deckel: Partial<Record<PlayerGeneratorAttributeName, number | null>> =
    {};
  let sp = 0;
  let budgetFaktor = 1;
  for (let i = 0; i < input.trainings; i += 1) {
    const schritt = berechneSpieltagsZuwachs({
      gameState,
      player,
      ziel,
      quelle: "manager",
      modus,
    });
    if (!schritt) return null;
    if (i === 0) budgetFaktor = schritt.budgetFaktor;
    for (const a of schritt.deckeBremst) bremst.add(a);
    for (const t of schritt.transparenz.attribute)
      if (!(t.attribute in deckel)) deckel[t.attribute] = t.deckel;
    const stats = {
      ...(player.attributeSheetStats as NonNullable<
        Player["attributeSheetStats"]
      >),
    };
    for (const [a, w] of Object.entries(schritt.zuwachs) as Array<
      [PlayerGeneratorAttributeName, number]
    >) {
      stats[a] = Number(((stats[a] as number) + w).toFixed(3));
      summe[a] = Number(((summe[a] ?? 0) + w).toFixed(4));
      sp += w;
    }
    player = { ...player, attributeSheetStats: stats };
  }
  const top = schwersteMatrixAttribute(ziel.disziplinId, 3);
  const weg = Math.min(
    Math.max(0, Math.floor(ziel.weg ?? 0)),
    top.length - 1,
  ) as TrainingsWeg;
  const haupt = profil[0]!.attribute;
  let eignung = 0;
  for (const a of PROGRESSION_ATTRIBUTE_ORDER) {
    const z = summe[a] ?? 0;
    if (z > 0)
      eignung +=
        (z *
          (officialDisciplineWeightTable[a]?.[
            ziel.disziplinId as keyof (typeof officialDisciplineWeightTable)[typeof a]
          ] ?? 0)) /
        100;
  }
  const hauptDeckel = deckel[haupt];
  const luft = Math.max(
    0,
    (typeof hauptDeckel === "number" ? hauptDeckel : 99) -
      Number(startStats[haupt]),
  );
  return {
    disziplinId: ziel.disziplinId,
    weg,
    art: weg === 0 ? "primaer" : "neben",
    hauptAttribut: haupt,
    sp: Number(sp.toFixed(3)),
    eignung: Number(eignung.toFixed(3)),
    luft: Number(luft.toFixed(2)),
    attribute: profil.map((e) => ({
      attribute: e.attribute,
      anteil: e.anteil,
      matrixGewicht: e.matrixGewicht,
      vorher: Number(Number(startStats[e.attribute]).toFixed(2)),
      deckel:
        typeof deckel[e.attribute] === "number"
          ? (deckel[e.attribute] as number)
          : null,
      zuwachs: Number((summe[e.attribute] ?? 0).toFixed(3)),
      bremst: bremst.has(e.attribute),
    })),
    deckeBremst: profil.some((e) => bremst.has(e.attribute)),
    budgetFaktor,
  };
}

/** Spieler der Liga des Spielers (Kader aller Teams derselben Liga); ohne Ligazuordnung alle Kaderspieler. */
function ligaMitspieler(gameState: GameState, playerId: string): Player[] {
  const teamId = gameState.rosters.find((r) => r.playerId === playerId)?.teamId ?? null;
  const ligen = gameState.seasonState?.leagueByTeamId;
  const meineLiga = teamId && ligen ? ligen[teamId] : null;
  const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
  const ergebnis: Player[] = [];
  for (const r of gameState.rosters) {
    if (meineLiga && ligen && ligen[r.teamId] !== meineLiga) continue;
    const p = spieler.get(r.playerId);
    if (p) ergebnis.push(p);
  }
  return ergebnis;
}

function ligaRang(
  liga: Player[],
  playerId: string,
  disziplinId: string,
  eigener: number | undefined,
): { rangLiga: number | null; ligaGroesse: number | null } {
  if (typeof eigener !== "number" || !Number.isFinite(eigener) || liga.length === 0) return { rangLiga: null, ligaGroesse: null };
  let besser = 0;
  for (const p of liga) {
    if (p.id === playerId) continue;
    const w = p.disciplineRatings?.[disziplinId];
    if (typeof w === "number" && w > eigener) besser += 1;
  }
  return { rangLiga: besser + 1, ligaGroesse: liga.length };
}

/**
 * Die Heatmap eines Spielers fuer den Modus (Standard: sein aktueller). `null` ohne vollen Attributbogen. Die Rechnung ist teuer (60 Zellen x Spieltage),
 * der Aufrufer zwischenspeichert sie je (Spielstand, Spieler, Modus).
 */
export function baueZielHeatmap(input: {
  gameState: GameState;
  playerId: string;
  modus?: PlayerTrainingMode;
}): ZielHeatmap | null {
  const { gameState } = input;
  const player = gameState.players.find((p) => p.id === input.playerId);
  if (!player || !hatVollenAttributbogen(player)) return null;
  const modus = input.modus ?? modusVon(player);
  const fenster = trainingsFenster(gameState, player.id);
  const alleIds = gameState.season?.matchdayIds ?? [];
  const ersterId = fenster.ids[0] ?? null;
  const vorlieben = trainingsVorliebenAktivFuer(gameState);
  const zeilen: HeatmapZeile[] = [];
  const liga = ligaMitspieler(gameState, player.id);
  for (const disziplinId of officialDisciplineWeightOrder) {
    const zellen: HeatmapZelle[] = [];
    for (const option of wegeFuerDisziplin(disziplinId)) {
      const zelle = projiziereZelle({
        gameState,
        player,
        ziel: { disziplinId, weg: option.weg },
        modus,
        trainings: fenster.ids.length,
      });
      if (zelle) zellen.push(zelle);
    }
    const eignung = player.disciplineRatings?.[disziplinId];
    const art = vorlieben ? vorliebeArt(player, disziplinId, gameState.season?.id ?? "") : 0;
    zeilen.push({
      disziplinId,
      label: officialDisciplineWeightLabels[disziplinId],
      bereich: bereichVonDisziplin(disziplinId),
      eignungHeute:
        typeof eignung === "number" && Number.isFinite(eignung)
          ? eignung
          : null,
      ...ligaRang(liga, player.id, disziplinId, eignung),
      vorliebe: art,
      vorliebeFaktor: vorliebeFaktor(art),
      zellen,
    });
  }
  return {
    playerId: player.id,
    modus,
    trainings: fenster.ids.length,
    spieltageVerletzt: fenster.verletzt,
    ersterTrainingsSpieltag: ersterId
      ? { matchdayId: ersterId, nummer: alleIds.indexOf(ersterId) + 1 }
      : null,
    vorliebenAktiv: vorlieben,
    zeilen,
  };
}

/** Wert einer Zelle im gewaehlten Mass. */
export function zellenWert(zelle: HeatmapZelle, mass: HeatmapMass): number {
  return mass === "sp"
    ? zelle.sp
    : mass === "eignung"
      ? zelle.eignung
      : zelle.luft;
}

/**
 * Die beste Zelle im Mass: groesster Wert; bei gleichem Wert (SP) entscheidet der groessere Eignungszuwachs, dann Matrix-Reihenfolge. `null` ohne Zellen.
 */
export function besteZelle(
  heatmap: ZielHeatmap,
  mass: HeatmapMass,
): HeatmapZelle | null {
  let beste: HeatmapZelle | null = null;
  for (const zeile of heatmap.zeilen) {
    for (const zelle of zeile.zellen) {
      if (!beste) {
        beste = zelle;
        continue;
      }
      const d = zellenWert(zelle, mass) - zellenWert(beste, mass);
      if (
        d > 1e-9 ||
        (Math.abs(d) <= 1e-9 && zelle.eignung > beste.eignung + 1e-9)
      )
        beste = zelle;
    }
  }
  return beste;
}

/** Kleinster und groesster Wert aller Zellen im Mass (fuer die Faerbung). */
export function wertSpanne(
  heatmap: ZielHeatmap,
  mass: HeatmapMass,
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const zeile of heatmap.zeilen) {
    for (const zelle of zeile.zellen) {
      const v = zellenWert(zelle, mass);
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return Number.isFinite(min) ? { min, max } : { min: 0, max: 0 };
}

/** Summe der SP-Zelle des gesetzten bzw. gewaehlten Ziels: der Wert, der in Kaderliste, Kopf und Vorschau steht (eine Funktion, eine Zahl). */
export function spBisSaisonende(input: {
  gameState: GameState;
  player: Player;
  ziel: PlayerTrainingsZiel;
  modus: PlayerTrainingMode;
}): number {
  const fenster = trainingsFenster(input.gameState, input.player.id);
  return projiziereZelle({ ...input, trainings: fenster.ids.length })?.sp ?? 0;
}

/* ------------------------------------------------------------------ Fortschritt dieser Saison */

export type SaisonFortschrittAttribut = {
  attribute: PlayerGeneratorAttributeName;
  /** Wert zum Saisonstart (erster gebuchter Spieltag), `null` wenn nicht gespeichert. */
  start: number | null;
  jetzt: number;
  /** Veraenderung seit dem Saisonstart (Training + Leistung - Abbau, gebucht). */
  delta: number;
};

export type SaisonFortschritt = {
  attribute: SaisonFortschrittAttribut[];
  /** Training allein (Summe der gebuchten Zuwaechse z) und die Netto-Veraenderung (Summe der Deltas). */
  trainingSp: number;
  nettoSumme: number;
  /** Spieltage, die in den Verlauf eingegangen sind (1-basiert, erster bis letzter), `null` ohne Verlauf. */
  spieltage: { von: number; bis: number } | null;
  /** Das Attribut mit dem groessten Fortschritt (> 0), `null` wenn keines gewachsen ist. */
  groessterFortschritt: PlayerGeneratorAttributeName | null;
};

/** Der Fortschritt dieser Saison je Attribut, aus dem Trainingsverlauf (`seasonTrainingAccumulator`): genau das, was gebucht wurde. */
export function baueSaisonFortschritt(
  gameState: GameState,
  playerId: string,
): SaisonFortschritt | null {
  const player = gameState.players.find((p) => p.id === playerId);
  const stats = player?.attributeSheetStats;
  if (!player || !stats) return null;
  const akku = player.seasonTrainingAccumulator;
  const gueltig = akku && akku.seasonId === gameState.season.id ? akku : null;
  const start = (gueltig?.startAttribute ?? null) as Partial<
    Record<PlayerGeneratorAttributeName, number>
  > | null;
  const verlauf = (gueltig?.verlauf ?? []).filter((e) => e.s === "t" && !e.o);
  const ids = gameState.season?.matchdayIds ?? [];
  const nettoJeAttribut: Partial<Record<PlayerGeneratorAttributeName, number>> =
    {};
  let trainingSp = 0;
  for (const e of verlauf) {
    for (const [a, w] of Object.entries(e.z ?? {}) as Array<
      [PlayerGeneratorAttributeName, number]
    >) {
      nettoJeAttribut[a] = (nettoJeAttribut[a] ?? 0) + w;
      trainingSp += w;
    }
    for (const [a, w] of Object.entries(e.p ?? {}) as Array<
      [PlayerGeneratorAttributeName, number]
    >)
      nettoJeAttribut[a] = (nettoJeAttribut[a] ?? 0) + w;
    for (const [a, w] of Object.entries(e.a ?? {}) as Array<
      [PlayerGeneratorAttributeName, number]
    >)
      nettoJeAttribut[a] = (nettoJeAttribut[a] ?? 0) - w;
  }
  const attribute = PROGRESSION_ATTRIBUTE_ORDER.map((attribute) => {
    const jetzt = Number(stats[attribute]);
    const s =
      start && typeof start[attribute] === "number"
        ? (start[attribute] as number)
        : null;
    const delta = s != null ? jetzt - s : (nettoJeAttribut[attribute] ?? 0);
    return {
      attribute,
      start: s,
      jetzt: Number(jetzt.toFixed(2)),
      delta: Number(delta.toFixed(2)),
    } satisfies SaisonFortschrittAttribut;
  });
  let groesster: SaisonFortschrittAttribut | null = null;
  for (const a of attribute)
    if (a.delta > 0.004 && (!groesster || a.delta > groesster.delta))
      groesster = a;
  const spieltage = verlauf.length
    ? {
        von: Math.max(1, ids.indexOf(verlauf[0]!.m) + 1),
        bis: Math.max(1, ids.indexOf(verlauf[verlauf.length - 1]!.m) + 1),
      }
    : null;
  return {
    attribute,
    trainingSp: Number(trainingSp.toFixed(2)),
    nettoSumme: Number(attribute.reduce((s, a) => s + a.delta, 0).toFixed(2)),
    spieltage,
    groessterFortschritt: groesster?.attribute ?? null,
  };
}
