/**
 * KI-NEBEL (21.11.): Die KI bewertet Spieler beim Kaufen, Draften und für ihre Merkliste nach dem, was SIE über den Spieler
 * weiß, nicht nach den wahren Werten. Chris, 21.11., wörtlich: „bei KI -> Option A! das wäre das Ziel oder es müsste zumindest
 * leicht verschleiert sein, weil es soll ja das Draften nicht kaputt machen, aber vllt werden die Werte dann etwas schwammig“.
 *
 * WISSENSSTUFE: dieselbe Quelle wie beim Menschen, `getEffectiveScoutingLevel` (Scouting-Büro des Teams + Sicherheit aus
 * `scoutIntelByTeamId` bzw. dem automatischen Aufdecken des Potenzials). Eigener Kader und Stufe 5 sind exakt; ist der Nebel
 * per Spielstand-Einstellung aus (`scenarioMeta.scoutingNebelAus`), ist alles exakt.
 *
 * UNSCHÄRFE: ein nicht exakt bekannter Wert wird nicht auf die Bereichsmitte gesetzt, sondern deterministisch verrauscht:
 *   Sicht = wahr + (gemeinsame Verzerrung des Spielers + Rauschen je Disziplin) x Stärke
 * mit Hash über (Saison, Team, Spieler, Attribut) — kein Zufall, dieselbe Saison liefert dieselbe Sicht, eine neue Saison
 * eine neue. Amplituden je Stufe wie in der Scouting-Anzeige des Marktes (`transfermarkt-scouting.ts`: unbekannt größer als
 * beobachtet). Das Ergebnis wird auf die Stufe geklemmt, die der Mensch auf dieser Stufe sieht (10er-Bereich unbekannt,
 * 5er-Bereich beobachtet), und zwar auf den Bereich, der den wahren Wert enthält: die KI weiß nie genauer als „Bereich“.
 * Das Potenzial wird ebenso verrauscht und auf die Spanne geklemmt, die der Mensch sieht (`getScoutingUncertainty`).
 *
 * BEWUSST EXAKT: die vier Achsen-Summen POW/SPE/MEN/SOC. Der Mensch sieht sie seit 21.11. als Zahl (Chris: „die POW SPE MEN
 * SOC Stats in Summe dürfen gezeigt werden“), die KI also auch.
 *
 * Schalter: `OLY_KI_NEBEL=0` = bisheriges Verhalten bit-identisch (wahre Werte). `OLY_KI_NEBEL_STAERKE` = Zahl >= 0, Vielfaches
 * der Amplituden (Standard `KI_NEBEL_STAERKE_STANDARD`). Doku und Messung: docs/design/ki-nebel-21-11.md.
 */
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import { getScoutingUncertainty } from "@/lib/progression/player-potential-service";

/** Vielfaches der Scouting-Amplituden des Marktes. Begründung und Messung: docs/design/ki-nebel-21-11.md. */
export const KI_NEBEL_STAERKE_STANDARD = 1;

/** Gemeinsame Verzerrung je Stufe (wie `getSharedBiasAmplitude` der Marktanzeige). */
const GEMEINSAM_AMPLITUDE = [3.5, 2.5, 1.75, 1, 0.5, 0] as const;
/** Rauschen je Disziplin und Stufe (wie `getDisciplineNoiseAmplitude` der Marktanzeige). */
const DISZIPLIN_AMPLITUDE = [8, 6, 4.5, 3, 1.5, 0] as const;

export function kiNebelAktiv(): boolean {
  return process.env.OLY_KI_NEBEL !== "0";
}

export function kiNebelStaerke(): number {
  const roh = process.env.OLY_KI_NEBEL_STAERKE;
  if (roh == null || roh.trim() === "") return KI_NEBEL_STAERKE_STANDARD;
  const zahl = Number(roh);
  return Number.isFinite(zahl) && zahl >= 0 ? zahl : KI_NEBEL_STAERKE_STANDARD;
}

/** Breite des Bereichs, den der Mensch sieht: 10 unbekannt, 5 beobachtet, 1 gescoutet (wie `stufenBreite` des Marktes). */
export function kiNebelBreite(stufe: number): number {
  return stufe >= 5 ? 1 : stufe <= 0 ? 10 : 5;
}

function fnv(text: string, start = 2166136261): number {
  let hash = start >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Zweiter Hash-Schritt: mischt einen vorberechneten Spieler-Hash mit dem Hash des Attributs (Avalanche über murmur-Finale). */
function mische(spielerHash: number, attributHash: number): number {
  let h = (spielerHash ^ Math.imul(attributHash, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Gleichverteilt in [-1, 1]. */
function einheit(hash: number): number {
  return (hash / 4294967296) * 2 - 1;
}

const ATTRIBUT_HASH = new Map<string, number>();
/** Hash eines Attributs (Disziplin-Id oder Sonderschluessel mit Praefix `:`), je Prozess einmal gerechnet. */
function attributHash(schluessel: string): number {
  let hash = ATTRIBUT_HASH.get(schluessel);
  if (hash === undefined) {
    hash = fnv(schluessel, 0x811c9dc5 ^ 0x1234567);
    ATTRIBUT_HASH.set(schluessel, hash);
  }
  return hash;
}
const HASH_GEMEINSAM = attributHash(":gemeinsam");
const HASH_POTENZIAL = attributHash(":potenzial");

export type KiSichtKontext = {
  teamId: string;
  saisonId: string;
  staerke: number;
  bueroStufe: number;
  eigeneIds: ReadonlySet<string>;
  sicherheitJeSpieler: ReadonlyMap<string, number>;
  potenzialSicherheit: ReadonlyMap<string, number>;
};

/**
 * Baut den Wissensstand eines Teams EINMAL je Plan (statt `getEffectiveScoutingLevel` je Kandidat zu rufen, das jedes Mal Kader und
 * Records durchsucht). Liefert `null`, wenn der Nebel für die KI aus ist (Schalter oder Spielstand-Einstellung).
 */
export function baueKiSichtKontext(gameState: GameState, teamId: string): KiSichtKontext | null {
  if (!kiNebelAktiv() || isScoutingNebelAus(gameState)) return null;
  const staerke = kiNebelStaerke();
  if (staerke <= 0) return null;
  const saisonId = gameState.season.id;
  const eigeneIds = new Set<string>();
  for (const eintrag of gameState.rosters ?? []) if (eintrag.teamId === teamId) eigeneIds.add(eintrag.playerId);
  const sicherheitJeSpieler = new Map<string, number>();
  for (const eintrag of gameState.seasonState?.scoutIntelByTeamId?.[teamId] ?? []) {
    if (eintrag.seasonId === saisonId) sicherheitJeSpieler.set(eintrag.playerId, eintrag.certainty ?? 0);
  }
  const potenzialSicherheit = new Map<string, number>();
  for (const eintrag of gameState.playerPotential ?? []) potenzialSicherheit.set(eintrag.playerId, eintrag.confidence ?? 0);
  return {
    teamId,
    saisonId,
    staerke,
    bueroStufe: getFacilityLevel(getTeamFacilityState(gameState, teamId), "scouting_office"),
    eigeneIds,
    sicherheitJeSpieler,
    potenzialSicherheit,
  };
}

/** Wissensstufe 0..5 — dieselbe Rechnung wie `getEffectiveScoutingLevel`, nur mit vorberechneten Nachschlagetabellen. */
export function kiWissensStufe(kontext: KiSichtKontext, playerId: string): number {
  if (kontext.eigeneIds.has(playerId)) return 5;
  const sicherheit = Math.max(kontext.sicherheitJeSpieler.get(playerId) ?? 0, Math.min(100, Math.max(0, kontext.potenzialSicherheit.get(playerId) ?? 0)));
  return Math.min(5, Math.max(0, kontext.bueroStufe + Math.floor(sicherheit / 25)));
}

function verrausche(
  wahr: number,
  stufe: number,
  staerke: number,
  gemeinsam: number,
  spielerHash: number,
  schluessel: string,
  breite: number,
  gemeinsamAmplitude: number,
  disziplinAmplitude: number,
): number {
  const roh = wahr + (gemeinsam * gemeinsamAmplitude + einheit(mische(spielerHash, attributHash(schluessel))) * disziplinAmplitude) * staerke;
  // Auf den Bereich geklemmt, der den wahren Wert enthaelt (10er / 5er), nie ueber die Skala hinaus.
  const von = Math.floor(wahr / breite) * breite;
  const bis = Math.min(100, von + breite - 1);
  return Math.round(Math.min(bis, Math.max(von, roh)));
}

const SICHT_CACHE = new WeakMap<object, Map<string, { summe: number; sicht: Record<string, number> }>>();

export type KiSpielerSicht = {
  disciplineRatings: Record<string, number>;
  potential: number | null;
  /** Wissensstufe 0..5, mit der die Sicht gebaut wurde (Tests, Messung). */
  stufe: number;
};

/**
 * Die Sicht des Teams auf einen Spieler. Eigene Spieler und Stufe 5 liefern die wahren Werte (dasselbe Objekt, keine Kopie);
 * sonst verrauschte Disziplinwerte und ein verrauschtes Potenzial.
 */
export function kiSichtAufSpieler(kontext: KiSichtKontext, player: Pick<Player, "id" | "disciplineRatings">, wahresPotenzial: number | null): KiSpielerSicht {
  const stufe = kiWissensStufe(kontext, player.id);
  const wahr = player.disciplineRatings ?? {};
  if (stufe >= 5) return { disciplineRatings: wahr, potential: wahresPotenzial, stufe };
  const spielerHash = fnv(`${kontext.saisonId}|${kontext.teamId}|${player.id}`);
  // Zwischenspeicher je Disziplin-Objekt des Spielers: der Draft baut den Rahmen je Pick neu, die Sicht bliebe dieselbe.
  const schluessel = `${kontext.saisonId}|${kontext.teamId}|${stufe}|${kontext.staerke}`;
  let jeSchluessel = SICHT_CACHE.get(wahr);
  // Pruefsumme der wahren Werte: wurde das Objekt veraendert, gilt der Eintrag nicht mehr.
  let summe = 0;
  for (const id in wahr) summe += wahr[id] ?? 0;
  const treffer = jeSchluessel?.get(schluessel);
  let sicht: Record<string, number>;
  if (treffer && treffer.summe === summe) {
    sicht = treffer.sicht;
  } else {
    const gemeinsam = einheit(mische(spielerHash, HASH_GEMEINSAM));
    const breite = kiNebelBreite(stufe);
    const gemeinsamAmplitude = GEMEINSAM_AMPLITUDE[stufe] ?? 3.5;
    const disziplinAmplitude = DISZIPLIN_AMPLITUDE[stufe] ?? 8;
    sicht = {};
    for (const disziplinId in wahr) {
      const wert = wahr[disziplinId];
      sicht[disziplinId] =
        typeof wert === "number" && Number.isFinite(wert)
          ? verrausche(wert, stufe, kontext.staerke, gemeinsam, spielerHash, disziplinId, breite, gemeinsamAmplitude, disziplinAmplitude)
          : (wert as number);
    }
    if (!jeSchluessel) {
      jeSchluessel = new Map();
      SICHT_CACHE.set(wahr, jeSchluessel);
    }
    jeSchluessel.set(schluessel, { summe, sicht });
  }
  let potential = wahresPotenzial;
  if (typeof potential === "number" && Number.isFinite(potential) && potential > 0) {
    const spanne = getScoutingUncertainty(stufe);
    const abweichung = einheit(mische(spielerHash, HASH_POTENZIAL)) * spanne * kontext.staerke;
    // Spanne, die der Mensch sieht: wahr +- Unsicherheit (35..99), nie darueber hinaus.
    const grenze = Math.min(spanne, Math.abs(abweichung));
    potential = Math.round(Math.min(99, Math.max(35, potential + Math.sign(abweichung) * grenze)));
  }
  return { disciplineRatings: sicht, potential, stufe };
}
