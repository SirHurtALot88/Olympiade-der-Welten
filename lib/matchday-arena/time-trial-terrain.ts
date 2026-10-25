/**
 * ZEITFAHREN (Spieltags-Bühne) — Geländeprofil als Daten, nicht als Dekoration.
 *
 * `peloton.tsx` hatte früher einen Streckenprofil-Strip, der eine reine Sinuskurve zeichnete
 * (`Math.sin(i*(0.7+h01("pw")*0.5)+1.7)`, Commit `acfd9c39`, 20.07.) — ohne jeden Bezug zu
 * Streckendaten, deshalb entfernt. Diese Datei liefert den Ersatz: ein Profil, das
 * deterministisch aus der Matchday-ID gezogen wird (gleiche ID → gleiches Profil, über Sessions
 * und Server hinweg identisch), aber NICHTS an `score`/`displayScore`/`rank` ändert — die Zonen
 * sind reine Anzeige, die Wahrheit bleibt der Score (`peloton.tsx` Zeile 7).
 *
 * `docs/design/fable-konzept-broadcast-vorbilder-13-10.md` Abschnitt 3.1, Punkt 1 (ZF1.1).
 */

export type TerrainZoneKind = "steigung" | "abfahrt" | "flach";

export type TerrainZone = {
  kind: TerrainZoneKind;
  /** Streckenanteil 0…1, Beginn der Zone. */
  from: number;
  /** Streckenanteil 0…1, Ende der Zone. */
  to: number;
};

export type TerrainProfile = {
  /** 3–4 Zonen, decken [0,1] lückenlos und überlappungsfrei ab. */
  zones: TerrainZone[];
  /**
   * Normierte Höhe (0…1) an einer Streckenposition (0…1) — stückweise linear, an den
   * Zonengrenzen stetig (kein Sprung). Reine Anzeige-Größe, nie Eingabe für die Wertung.
   */
  elevationAt: (frac: number) => number;
};

// Deterministischer 32-Bit-Hash (FNV-1a) — dieselbe Familie wie `h01` in peloton.tsx, hier aber
// als Seed für einen PRNG statt direkt als 0…1-Wert (wir brauchen mehrere Zufallszahlen in Folge).
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — kompakter, gut gestreuter PRNG (dieselbe Familie, die `DisciplineStageArena.tsx`
// für `pickMutatorTraits` schon verwendet). Deterministisch bei gleichem Seed.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KIND_POOL: TerrainZoneKind[] = ["flach", "steigung", "abfahrt"];
// Mindestlänge je Zone (Anteil der Strecke) — sonst könnten Zonen so kurz werden, dass sie auf
// dem schmalen Profil-Band gar nicht mehr als eigene Zone lesbar wären.
const MIN_ZONE_FRAC = 0.12;

/**
 * Baut ein deterministisches Geländeprofil aus einer Matchday-ID (oder einem anderen stabilen
 * Schlüssel). Dieselbe ID liefert IMMER dasselbe Profil — das ist die einzige Garantie, die
 * dieser Baustein braucht (s. Vitest-Datei).
 */
export function buildTimeTrialTerrainProfile(matchdayId: string): TerrainProfile {
  const seed = fnv1a(matchdayId || "zeitfahren-ohne-matchday-id");
  const rng = mulberry32(seed);

  const zoneCount = rng() < 0.5 ? 3 : 4;

  // Zonenlängen: zufällige Rohlängen, dann auf [MIN_ZONE_FRAC, …] normiert, Summe exakt 1.
  const rawLengths = Array.from({ length: zoneCount }, () => 0.3 + rng() * 0.7);
  const totalRaw = rawLengths.reduce((a, b) => a + b, 0) || 1;
  const freeFrac = Math.max(0, 1 - MIN_ZONE_FRAC * zoneCount);
  const lengths = rawLengths.map((l) => MIN_ZONE_FRAC + (l / totalRaw) * freeFrac);
  // Rundungsrest der letzten Zone zuschlagen, damit die Summe exakt 1 bleibt.
  const lengthSum = lengths.reduce((a, b) => a + b, 0);
  lengths[lengths.length - 1]! += 1 - lengthSum;

  // Kind-Sequenz: kein "abfahrt" als Start (ein Zeitfahren beginnt nicht bergab) und nie
  // zweimal dieselbe Zonenart direkt hintereinander (sonst sähe die Grenze wie keine Grenze aus).
  const kinds: TerrainZoneKind[] = [];
  for (let i = 0; i < zoneCount; i += 1) {
    const pool = KIND_POOL.filter((k) => k !== kinds[i - 1] && !(i === 0 && k === "abfahrt"));
    kinds.push(pool[Math.floor(rng() * pool.length)] ?? "flach");
  }

  let acc = 0;
  const zones: TerrainZone[] = lengths.map((len, i) => {
    const from = acc;
    acc += len;
    const to = i === zoneCount - 1 ? 1 : acc;
    return { kind: kinds[i]!, from, to };
  });

  // Rohhöhe an jeder Zonengrenze: "steigung" +1 Einheit je Zonenlänge, "abfahrt" −1, "flach" 0.
  const RATE: Record<TerrainZoneKind, number> = { steigung: 1, abfahrt: -1, flach: 0 };
  const rawHeightsAtBounds: number[] = [0];
  for (const z of zones) {
    rawHeightsAtBounds.push(rawHeightsAtBounds[rawHeightsAtBounds.length - 1]! + RATE[z.kind] * (z.to - z.from));
  }
  const minH = Math.min(...rawHeightsAtBounds);
  const maxH = Math.max(...rawHeightsAtBounds);
  const span = maxH - minH || 1;

  const elevationAt = (frac: number): number => {
    const f = Math.max(0, Math.min(1, frac));
    let i = zones.findIndex((z) => f >= z.from && f <= z.to);
    if (i < 0) i = zones.length - 1;
    const z = zones[i]!;
    const zoneLen = z.to - z.from || 1;
    const within = (f - z.from) / zoneLen;
    const h = rawHeightsAtBounds[i]! + RATE[z.kind] * within * zoneLen;
    return (h - minH) / span;
  };

  return { zones, elevationAt };
}
