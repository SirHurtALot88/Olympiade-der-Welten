/**
 * WELCHE DER FÜNF KARTEN EIN GEBÄUDE TRÄGT — und welches.
 *
 * Chris: „wenn wir dann wieder genug verschiedene möglichkeiten haben lohnen auch wieder die 5
 * statt 3 sponsoren." Fuenf Karten sind erst dann eine Auswahl, wenn sie sich unterscheiden — und
 * wenn sie fuer verschiedene Kassenlagen gedacht sind.
 *
 * DIE AUFLAGE AUS DER MESSUNG, und sie ist der Grund, warum diese Datei existiert: zwoelf von 32
 * Teams koennen sich ueberhaupt keinen Cash-Verzicht leisten. Ein Slate aus fuenf teuren
 * Gebaeude-Karten waere fuer die halbe Liga eine Scheinauswahl — fuenf Karten, von denen nur eine
 * in Frage kommt. Deshalb sind zwei Plaetze fest vergeben:
 *
 *   Platz 1: REINE CASH-KARTE, kein Verzicht. Die Karte fuer alle, die jeden Cash brauchen.
 *   Platz 2: GUENSTIGE GEBÄUDE-KARTE, immer die kleinste angebotene Stufe. Der Einstieg, den auch
 *            ein klammes Team stemmen kann — und laut Chris genau der Weg zurueck („oder halt auch
 *            mal in sowas wie einen fan shop investieren").
 *
 * Die uebrigen drei folgen der Rarität des Slates und duerfen teuer sein.
 *
 * Reine Funktionen, deterministisch aus einem Saatwort — derselbe Spielstand ergibt zweimal
 * dasselbe Angebot.
 */
import type { FacilityId } from "@/lib/facilities/facility-catalog";
import {
  baueLeihAngebot,
  berechneCashVerzicht,
  type SponsorLeihAngebot,
  type SponsorLeihRaritaet,
} from "@/lib/sponsor/sponsor-leihe";

/**
 * Die verleihbaren Gebäude. Fan Shop und Arena sind ausdruecklich dabei — sie waren einmal
 * ausgeschlossen, weil ein geliehener Shop sich selbst traegt. Chris hat das umgedreht: „Wenn man
 * zb nen sponsor bekommt der einem nen fan shop leiht ist das ja quasi auch free money." Der
 * Ertrag steckt bereits im Leihwert und damit im Preis der Karte; und die Rangmarke macht ihn
 * bedingt, waehrend der Verzicht fest bleibt.
 */
export const VERLEIHBARE_GEBAEUDE: readonly FacilityId[] = [
  "training_center",
  "recovery_center",
  "scouting_office",
  "analytics_room",
  "fan_shop",
  "arena_upgrade",
  "academy",
  "specialist_wing",
];

/** Startstufe je Rarität: bessere Karten steigen hoeher ein. */
const STARTSTUFE_JE_RARITAET: Record<SponsorLeihRaritaet, number> = {
  gewoehnlich: 1,
  magisch: 2,
  selten: 2,
  legendaer: 3,
};

/**
 * Anfangszustand je Rarität — die zweite Stellschraube neben der Stufe.
 *
 * Chris: „das sollte auch bereits drin stehen wie gut das gebäude noch ist so hast du noch eine
 * variable mit der man spielen kann um unterschiedliche verträge zu erzeugen." Ein gewoehnlicher
 * Sponsor leiht Gebrauchtes, ein legendaerer Neuwertiges. Zwei Karten koennen damit dasselbe
 * Gebaeude auf derselben Stufe anbieten und trotzdem verschieden viel wert sein.
 *
 * Die Spanne ist bewusst so gelegt, dass eine gewoehnliche Leihe schon in der ersten Saison unter
 * der Wirkschwelle 80 startet — sie wirkt sofort spuerbar schwaecher, ohne wertlos zu sein.
 */
const ZUSTAND_JE_RARITAET: Record<SponsorLeihRaritaet, number> = {
  gewoehnlich: 70,
  magisch: 85,
  selten: 95,
  legendaer: 100,
};

/**
 * WAS PLATZ 2 HOECHSTENS KOSTEN DARF — die Zahl kommt aus der Messung, nicht aus dem Gefuehl.
 *
 * Fable hat ueber den Abrechnungspfad gemessen: der Median-Spielraum eines Teams liegt bei +2,5 C je
 * Saison, zwoelf von 32 Teams haben ueberhaupt keinen. Der Einstieg ist deshalb genau auf diesen
 * Median gedeckelt — was darueber liegt, koennte die halbe Liga nicht nehmen, und dann waere Platz 2
 * kein Einstieg mehr, sondern nur eine zweite teure Karte.
 *
 * Der Deckel greift ueberhaupt nur beim Fan Shop, dem teuersten Stufe-1-Bau: 2,8 C bei gewoehnlicher
 * Rarität. Alle anderen sieben Gebaeude liegen auf Stufe 1 zwischen 0,5 und 1,7 C und passen immer.
 */
export const EINSTIEG_VERZICHT_DECKEL = 2.5;

function avalanche(hash: number) {
  let mixed = hash >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/**
 * Der Slate-Wurf fuehrt die Rarität in der deutschen Schreibweise („gewöhnlich"), die Rechenschicht
 * in ASCII („gewoehnlich"). Eine Uebersetzung an genau einer Stelle statt zwei Schreibweisen quer
 * durch die Rechnung.
 */
const RARITAET_AUS_ANZEIGE: Record<string, SponsorLeihRaritaet> = {
  "gewöhnlich": "gewoehnlich",
  magisch: "magisch",
  selten: "selten",
  "legendär": "legendaer",
};

export function leihRaritaet(rarity: string | null | undefined): SponsorLeihRaritaet {
  return RARITAET_AUS_ANZEIGE[rarity ?? ""] ?? "gewoehnlich";
}

export type SponsorSlateKarte = {
  slotIndex: number;
  raritaet: SponsorLeihRaritaet;
  /** Null bei der reinen Cash-Karte. */
  leihe: (SponsorLeihAngebot & { startZustandPct: number }) | null;
  /** Cash-Verzicht der ersten Saison — 0 bei der reinen Cash-Karte. */
  verzichtErsteSaison: number;
};

/**
 * Verteilt Gebäude auf die Karten eines Slates.
 *
 * `raritaeten` kommt aus dem bestehenden Slate-Wurf; diese Funktion erfindet keine Raritäten,
 * sondern entscheidet nur, wer ein Gebaeude bekommt und welches.
 */
export function verteileLeihgabenAufSlate(input: {
  seasonId: string;
  teamId: string;
  raritaeten: readonly SponsorLeihRaritaet[];
  laufzeiten?: readonly number[];
  /** Gebäude, die das Team schon auf dieser Stufe oder hoeher hat — die lohnen als Leihe nicht. */
  eigeneStufen?: Readonly<Record<string, number>>;
  verleihbar?: readonly FacilityId[];
}): SponsorSlateKarte[] {
  const verleihbar = input.verleihbar ?? VERLEIHBARE_GEBAEUDE;
  const eigene = input.eigeneStufen ?? {};

  return input.raritaeten.map((raritaet, slotIndex) => {
    // Platz 1 bleibt immer reines Geld — die Karte fuer Teams ohne Spielraum.
    if (slotIndex === 0) {
      return { slotIndex, raritaet, leihe: null, verzichtErsteSaison: 0 };
    }

    const saat = `${input.seasonId}:${input.teamId}:leihe:${slotIndex}`;
    const wurf = avalanche(hashSeed(saat));

    // Gebäude waehlen: bevorzugt eines, das dem Team ueberhaupt etwas bringt. Ein Gebaeude, das
    // das Team selbst schon hoeher gebaut hat, waere eine tote Karte.
    // Platz 2 ist der guenstige Einstieg: immer Stufe 1, egal wie selten die Karte ist.
    const startStufe = slotIndex === 1 ? 1 : STARTSTUFE_JE_RARITAET[raritaet];
    const brauchbare = verleihbar.filter((facilityId) => (eigene[facilityId] ?? 0) < startStufe);
    const bezahlbare =
      slotIndex === 1
        ? brauchbare.filter(
            (facilityId) =>
              berechneCashVerzicht({ facilityId, stufe: startStufe, raritaet }) <= EINSTIEG_VERZICHT_DECKEL,
          )
        : brauchbare;
    const auswahl = bezahlbare.length > 0 ? bezahlbare : brauchbare.length > 0 ? brauchbare : verleihbar;
    const facilityId = auswahl[wurf % auswahl.length]!;

    const laufzeit = input.laufzeiten?.[slotIndex] ?? (slotIndex === 1 ? 2 : 3);

    const angebot = baueLeihAngebot({ facilityId, raritaet, startStufe, laufzeit });
    return {
      slotIndex,
      raritaet,
      leihe: { ...angebot, startZustandPct: ZUSTAND_JE_RARITAET[raritaet] },
      verzichtErsteSaison: angebot.verzichtJeSaison[0] ?? 0,
    };
  });
}
