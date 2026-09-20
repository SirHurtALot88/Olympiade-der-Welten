// ===================================================================================
// KLASSE+UNTERKLASSE+TRAITS -> EIN KAMPF-ARCHETYP.
//
// Backlog #156. Die Bruecke, die `docs/design/klassen-archetyp-konzept-20-09.md`
// (Branch `fable-klassen-archetyp-20-09`) als "Schritt 1" empfiehlt: `battle-mode.
// engine.js` traegt heute fuer JEDEN Kaempfer denselben Platzhalter
// (`PLATZHALTER_ARCHETYP`, Fighter: 15/30 %), weil es keine Zuordnung von einem
// bestehenden Spieler auf einen der 35 Kampf-Archetypen gibt. Diese Datei liefert
// genau das — als reine, deterministische Funktion, kein Wuerfeln, kein neuer
// Spielerzustand.
//
// KEIN VIERTES SYSTEM. Es verbindet nur die drei, die es schon gibt:
//   1. `lib/player-generator/player-generator-archetypes.ts` — 14 breite Buckets
//      (mage/beast/rogue/tank/warrior/...), bisher NUR ein Wuerfel-Parameter
//      (`preferredArchetype` in `PlayerGeneratorInput`, s. olyDataTypes.ts:752),
//      nie rueckwirkend auf einen bestehenden Spieler angewendet. Wird hier
//      genau dafuer wiederverwendet: dieselbe Matching-Logik (Klasse/Unterklasse/
//      Traits/Identitaets-Schluesselwoerter gegen `preferred*`/`identityKeywords`),
//      nur rueckwaerts — "zu welchem Bucket passt dieser Spieler am besten" statt
//      "wuerfle einen Spieler, der zu diesem Bucket passt".
//   2. `lib/battle/subclass-archetypes.ts` — ordnet jede Unterklasse einer
//      KANDIDATENMENGE von Kampf-Archetypen zu (`archetypenFuer()`, bereits fertig,
//      inklusive der Bildbefund-Verfeinerung fuer named Spieler). Wird unveraendert
//      aufgerufen, nicht neu gebaut.
//   3. `lib/battle/archetype-registry.ts` — die 35 Kampf-Archetypen selbst
//      (hp/atk/def/spd/stunResist/knockbackResist/...), Abschrift von Chris'
//      Klassenkarten. Nur GELESEN, nie veraendert.
//
// DIE LETZTE AUSWAHL (Bucket -> genau EIN Archetyp aus der Kandidatenmenge) ist der
// einzige wirklich neue Code hier: ein Aehnlichkeits-Score zwischen dem Zahlenprofil
// jedes Kandidaten (hp/atk/def/spd, normiert 0..1 ueber alle 35 Karten) und einem aus
// dem Bucket abgeleiteten Zielvektor (s. `ZIEL_ABBILDUNG` unten). Rein deterministisch:
// dieselbe Eingabe liefert immer dasselbe Ergebnis, kein RNG, kein Speicherzustand.
// ===================================================================================

import { ARCHETYPES, archetypeById, type Archetype } from "@/lib/battle/archetype-registry";
import { archetypenFuer } from "@/lib/battle/subclass-archetypes";
import { playerGeneratorArchetypes } from "@/lib/player-generator/player-generator-archetypes";
import type { PlayerGeneratorArchetype, PlayerGeneratorAttributeName } from "@/lib/data/olyDataTypes";

/** Die vier Zahlen jeder Kampf-Karte, auf die sich ein Bucket-Profil abbilden laesst. */
export type KampfProfilAchse = "hp" | "atk" | "def" | "spd";

/**
 * EXPLIZITE MODELLANNAHME, KEINE GEMESSENE GROESSE. Die 14 Generator-Buckets kennen
 * zwoelf Attribute (`PlayerGeneratorAttributeName`), die 35 Kampf-Karten nur vier
 * Zahlen (hp/atk/def/spd). Diese Tabelle sagt, welches Attribut welche Kampf-Achse
 * speist — sie ist eine Lesart, keine Ableitung aus dem Spiel (dafuer gibt es keine
 * Quelle: die Karten selbst verbinden Kampfwerte nie mit den zwoelf Spielattributen).
 * Gewichte je Achse muessen sich nicht zu 1 summieren; nur das Vorzeichen und die
 * relative Groesse zaehlen, weil am Ende nur der Bucket mit dem hoechsten Score unter
 * einer bereits engen Kandidatenmenge gewinnt (s. `waehleAusKandidaten()`).
 *
 * health   -> hp  (direkt: mehr Lebenspunkt-Bias, mehr Leben)
 * power    -> atk (direkt: mehr Kraft-Bias, mehr Angriff)
 * torment  -> atk (halbes Gewicht: Aggressions-/Schadensmotiv der DEMON/UNDEAD-Buckets)
 * speed      -> spd (direkt)
 * dexterity  -> spd (direkt: Handhabung/Ausweichen, dieselbe Kampf-Achse wie Tempo)
 * stamina  -> def (halbes Gewicht: koerperliche Zaehigkeit als Verteidigungs-Proxy)
 * will     -> def (halbes Gewicht: mentale Haerte als Verteidigungs-Proxy)
 *
 * Alle anderen Attribute (intelligence, awareness, determination, charisma, spirit)
 * haben in den vier Kampf-Achsen keine plausible Entsprechung und bleiben hier aussen
 * vor — sie wirken trotzdem auf die BUCKET-Wahl selbst (ueber Klasse/Unterklasse/
 * Traits), nur nicht mehr auf die Auswahl INNERHALB der Kandidatenmenge.
 */
const ZIEL_ABBILDUNG: Partial<Record<PlayerGeneratorAttributeName, Partial<Record<KampfProfilAchse, number>>>> = {
  health: { hp: 1 },
  power: { atk: 1 },
  torment: { atk: 0.5 },
  speed: { spd: 1 },
  dexterity: { spd: 1 },
  stamina: { def: 0.5 },
  will: { def: 0.5 },
};

/** Zielvektor eines Buckets ueber die vier Kampf-Achsen, aus `attributeBias` abgeleitet. */
export type KampfZielvektor = Record<KampfProfilAchse, number>;

function zielvektorVonBucket(attributeBias: Partial<Record<PlayerGeneratorAttributeName, number>>): KampfZielvektor {
  const ziel: KampfZielvektor = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const [attribut, bias] of Object.entries(attributeBias) as [PlayerGeneratorAttributeName, number][]) {
    const abbildung = ZIEL_ABBILDUNG[attribut];
    if (!abbildung || !bias) continue;
    for (const [achse, gewicht] of Object.entries(abbildung) as [KampfProfilAchse, number][]) {
      ziel[achse] += bias * gewicht;
    }
  }
  return ziel;
}

/** Midpoint einer Karten-Spanne — dieselbe Groesse, die `ausSpanne(spanne, 0.5)` liefert. */
function mittelwert(spanne: readonly [number, number]): number {
  return (spanne[0] + spanne[1]) / 2;
}

/**
 * Normiertes 0..1-Profil jeder der 35 Karten ueber die vier Kampf-Achsen (Min-Max
 * ueber ALLE Karten) — sonst wuerde `hp` (77..390) jeden Vergleich gegen `def`
 * (7..111) allein durch die groessere Zahlenspanne gewinnen, unabhaengig vom Bucket.
 * Einmal bei Modul-Laden berechnet, danach nur gelesen.
 */
const KAMPF_PROFIL: ReadonlyMap<string, KampfZielvektor> = (() => {
  const achsen: KampfProfilAchse[] = ["hp", "atk", "def", "spd"];
  const roh = new Map<string, Record<KampfProfilAchse, number>>();
  for (const a of ARCHETYPES) {
    roh.set(a.id, { hp: mittelwert(a.hp), atk: mittelwert(a.atk), def: mittelwert(a.def), spd: mittelwert(a.spd) });
  }
  const minMax = new Map<KampfProfilAchse, [number, number]>();
  for (const achse of achsen) {
    const werte = [...roh.values()].map((v) => v[achse]);
    minMax.set(achse, [Math.min(...werte), Math.max(...werte)]);
  }
  const normiert = new Map<string, KampfZielvektor>();
  for (const [id, v] of roh) {
    const profil = {} as KampfZielvektor;
    for (const achse of achsen) {
      const [min, max] = minMax.get(achse)!;
      profil[achse] = max > min ? (v[achse] - min) / (max - min) : 0;
    }
    normiert.set(id, profil);
  }
  return normiert;
})();

/** Buckets in fester, dokumentierter Reihenfolge — genau die Objekt-Reihenfolge aus der Quelle. */
const BUCKET_REIHENFOLGE = Object.keys(playerGeneratorArchetypes) as PlayerGeneratorArchetype[];

function normalisiert(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * DOKUMENTIERTER EXPLIZITER DEFAULT (nicht stillschweigend). Greift nur, wenn die
 * Kandidatenmenge aus `archetypenFuer()` leer ist — heute nur die Datenrest-
 * Unterklasse "Klasse" (s. subclass-archetypes.ts, absichtlich ohne Zuordnung) oder
 * ein Spieler ganz ohne Unterklassen. Bewusst dieselbe Karte, die vorher als
 * PLATZHALTER_ARCHETYP in battle-mode.engine.js fuer JEDEN Spieler galt — jetzt aber
 * nur noch fuer die seltene Ausnahme statt fuer die ganze Liga.
 */
export const STANDARD_ARCHETYP_ID = "fighter";

export interface SpielerFuerArchetypAufloesung {
  readonly className: string;
  readonly subclasses: readonly string[];
  readonly traitsPositive: readonly string[];
  readonly traitsNegative: readonly string[];
  /** Optional: schaltet die Bildbefund-Verfeinerung aus `subclass-archetypes.ts` frei. */
  readonly name?: string;
}

export interface BreitenBucketErgebnis {
  readonly bucket: PlayerGeneratorArchetype;
  /** Score des gewaehlten Buckets. 0, wenn kein einziges Kriterium traf (Fallback-Fall). */
  readonly score: number;
}

/**
 * SCHRITT 1 — welcher der 14 breiten Buckets passt am besten? Dieselbe Bedeutung wie
 * beim Wuerfeln (`preferredClasses`/`preferredSubclasses`/`preferredPositiveTraits`/
 * `preferredNegativeTraits`/`identityKeywords`), nur als Score statt als Filter:
 *
 *   Klasse ist preferredClasses      -> +3     Klasse ist disallowedClasses -> -6
 *   je Unterklasse in preferredSubclasses    -> +2
 *   je Positivtrait in preferredPositiveTraits -> +1
 *   je Negativtrait in preferredNegativeTraits -> +1
 *   je Identitaets-Schluesselwort-Treffer (Klasse ODER eine Unterklasse,
 *     normalisiert auf Kleinschreibung+Bindestrich, z. B. "Spec Ops" -> "spec-ops") -> +1,5
 *
 * Gewichte sind eine explizite Setzung (mehr Gewicht fuer eine ausdrueckliche
 * Vorliebe als fuer ein einzelnes Trait), keine gemessene Groesse. Unentschieden
 * wird deterministisch durch die Objekt-Reihenfolge der Quelle aufgeloest (erster
 * Treffer gewinnt) — bei einem Score von 0 fuer JEDEN Bucket (kein einziges
 * Kriterium traf) faellt die Wahl auf "warrior": der neutralste, generischste
 * Nahkampf-Bucket, nicht der zufaellig erste Schluessel im Quellobjekt.
 */
export function bestimmeBreitenBucket(spieler: SpielerFuerArchetypAufloesung): BreitenBucketErgebnis {
  const klasse = spieler.className;
  const subUnterklassen = spieler.subclasses;
  const identitaeten = [normalisiert(klasse), ...subUnterklassen.map(normalisiert)];

  let bester: PlayerGeneratorArchetype | null = null;
  let besterScore = -Infinity;
  for (const key of BUCKET_REIHENFOLGE) {
    const b = playerGeneratorArchetypes[key];
    let score = 0;
    if (b.preferredClasses.includes(klasse)) score += 3;
    if (b.disallowedClasses.includes(klasse)) score -= 6;
    for (const sub of subUnterklassen) if (b.preferredSubclasses.includes(sub)) score += 2;
    for (const trait of spieler.traitsPositive) if (b.preferredPositiveTraits.includes(trait)) score += 1;
    for (const trait of spieler.traitsNegative) if (b.preferredNegativeTraits.includes(trait)) score += 1;
    for (const kw of b.identityKeywords) if (identitaeten.includes(kw)) score += 1.5;
    if (score > besterScore) {
      besterScore = score;
      bester = key;
    }
  }
  if (besterScore <= 0) return { bucket: "warrior", score: 0 };
  return { bucket: bester as PlayerGeneratorArchetype, score: besterScore };
}

export interface KampfArchetypAufloesung {
  readonly archetype: Archetype;
  readonly breiterBucket: PlayerGeneratorArchetype;
  readonly bucketScore: number;
  /** Alle Kampf-Archetyp-IDs, die `subclass-archetypes.ts` fuer diesen Spieler zuliess. */
  readonly kandidaten: readonly string[];
  /** true, wenn die Kandidatenmenge leer war und der dokumentierte Default griff. */
  readonly fallback: boolean;
}

/**
 * SCHRITT 2+3 — aus der Kandidatenmenge (`archetypenFuer()`, Unterklassen-Vereinigung
 * plus Bildbefund-Verfeinerung) genau EINEN Archetyp waehlen: den mit dem hoechsten
 * Aehnlichkeits-Score zwischen seinem normierten hp/atk/def/spd-Profil und dem aus
 * dem breiten Bucket abgeleiteten Zielvektor (Skalarprodukt). Ein einzelner Kandidat
 * ist trivial. Eine leere Menge greift auf `STANDARD_ARCHETYP_ID` zurueck.
 */
export function bestimmeKampfArchetyp(spieler: SpielerFuerArchetypAufloesung): KampfArchetypAufloesung {
  const { bucket, score: bucketScore } = bestimmeBreitenBucket(spieler);
  const kandidatenArchetypen = archetypenFuer(spieler.subclasses, spieler.name);
  const kandidaten = kandidatenArchetypen.map((a) => a.id);

  if (kandidatenArchetypen.length === 0) {
    const standard = archetypeById(STANDARD_ARCHETYP_ID);
    if (!standard) throw new Error(`combat-archetype-resolver: STANDARD_ARCHETYP_ID "${STANDARD_ARCHETYP_ID}" fehlt in archetype-registry.ts.`);
    return { archetype: standard, breiterBucket: bucket, bucketScore, kandidaten, fallback: true };
  }
  if (kandidatenArchetypen.length === 1) {
    return { archetype: kandidatenArchetypen[0]!, breiterBucket: bucket, bucketScore, kandidaten, fallback: false };
  }

  const ziel = zielvektorVonBucket(playerGeneratorArchetypes[bucket].attributeBias);
  let bester = kandidatenArchetypen[0]!;
  let besterScore = -Infinity;
  for (const kandidat of kandidatenArchetypen) {
    const profil = KAMPF_PROFIL.get(kandidat.id);
    if (!profil) continue;
    const s = profil.hp * ziel.hp + profil.atk * ziel.atk + profil.def * ziel.def + profil.spd * ziel.spd;
    if (s > besterScore) {
      besterScore = s;
      bester = kandidat;
    }
  }
  return { archetype: bester, breiterBucket: bucket, bucketScore, kandidaten, fallback: false };
}

/** Nur fuer die Datengenerierung (`scripts/generiere-kampf-archetyp-daten.ts`) exportiert. */
export const _internals = { ZIEL_ABBILDUNG, zielvektorVonBucket, KAMPF_PROFIL, BUCKET_REIHENFOLGE, normalisiert };
