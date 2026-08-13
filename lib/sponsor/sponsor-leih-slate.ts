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

/**
 * DIE GROESSE EINER KARTE — die zweite Achse neben der Rarität, und die wichtigere von beiden.
 *
 * Chris: „es soll ja verschiedene stufen geben von gebäude sponsoren, manche wollen zb 30 für die
 * gebäude manche nur 5 dafür sind manche stärker manche schwächer."
 *
 * Die erste Fassung koppelte die Startstufe an die Rarität (1/2/2/3) — damit lag der Verzicht ueber
 * ALLE Karten zwischen 0,5 und 4,3 C, gemessen. Das ist keine Spanne, das ist Rauschen: fuenf
 * Karten, die praktisch dasselbe kosten. Die beiden Achsen taten dasselbe und hoben sich gegenseitig
 * auf, denn eine seltenere Karte stieg zwar hoeher ein, bekam ihre Stufe aber auch billiger.
 *
 * Jetzt sind sie getrennt und messen Verschiedenes:
 *
 *   GROESSE  = WIE VIEL Gebaeude auf der Karte steht (Stufe 1 / 3 / 5).
 *   RARITÄT  = WIE GUT der Handel dafuer ist (Kurs 1,4 / 1,8 / 2,3 / 3,0).
 *
 * Damit spannt der Katalog echte 0,5 bis 25,4 C auf — Chris' „5 bis 30" —, und die vier Ecken der
 * Matrix sind wirklich verschiedene Angebote: die kleine legendaere Karte kostet fast nichts und
 * bringt fast nichts, die grosse gewoehnliche frisst die halbe Saisonzahlung und stellt dafuer ein
 * fertiges Gebaeude auf Hoechststufe.
 *
 * WARUM „gross" AUF 5 STARTET UND DAMIT NICHT MEHR WAECHST: das ist der Vertragscharakter, nicht ein
 * vergessener Aufstieg. Eine grosse Karte leiht ein FERTIGES Gebaeude — sofort volle Wirkung, kein
 * Aufbau. Die mittlere ist die Karte mit Entwicklung (3 → 4 → 5). Wer Aufstieg will, nimmt mittel;
 * wer sofort will, zahlt gross.
 */
export type SponsorLeihGroesse = "klein" | "mittel" | "gross";

const STARTSTUFE_JE_GROESSE: Record<SponsorLeihGroesse, number> = {
  klein: 1,
  mittel: 3,
  gross: 5,
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

/**
 * WIE VIEL VON DER GARANTIERTEN SAISONZAHLUNG EINE KARTE HOECHSTENS KOSTEN DARF.
 *
 * Die grossen Karten sollen weh tun — das ist Chris' ausdrueckliche Absicht („Teams nehmen bewusst
 * in kauf weniger cash zu bekommen"). Eine Karte, die MEHR verlangt als die Haelfte dessen, was das
 * Team auf jedem Endrang sicher bekommt, waere aber keine Entscheidung mehr, sondern ein Ruin mit
 * Ansage: sie liesse selbst dem Meister zu wenig fuer die Gehaelter.
 *
 * Der Deckel ist RELATIV, weil die Leitern sich unterscheiden (gemessen: niedrigste Sprosse 52,1 C
 * bei Startrang 32, 75,1 C bei Startrang 1). Ein starkes Team kann sich also mehr Gebaeude leisten
 * als ein schwaches — genau der Rubberband, den Chris beschrieben hat.
 */
export const VERZICHT_ANTEIL_DER_LEITER = 0.5;

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

/**
 * DER GEBÄUDE-SCHALTER — steht auf AUS.
 *
 * Chris: „mach das mit dem Schalter deaktiviere Gebäude und mach es wie in der p-c season wieder mit
 * der kurven Verteilung und den Sponsoren die es vorher gab."
 *
 * WAS DER AUS-ZUSTAND TUT: `verteileLeihgabenAufSlate` gibt fuer JEDEN Platz dieselbe reine
 * Cash-Karte zurueck, die Platz 1 ohnehin schon immer bekommen hat (`leihe: null`, Verzicht 0). Es
 * ist damit kein zweiter Rechenweg und kein toter Code, sondern derselbe, seit jeher begangene Pfad —
 * nur fuer alle Plaetze. Alles, was daran haengt, ist bereits auf `null` vorbereitet: der Aufbau des
 * Angebots (`if (!leihe) return offer`), die Leih-Ziele (`leihZielFuer` prueft dieselbe Bedingung),
 * der Cash-Verzicht (0 ⇒ `buildSponsorV3TermsCore` setzt das Feld gar nicht erst) und die Rangmarke.
 *
 * WARUM ALS SCHALTER UND NICHT ALS AUSBAU: die Gebäude-Leihe soll vergleichbar bleiben. Auf `true`
 * gestellt laeuft wieder exakt die Fassung, die unter der Bauvorlage gemessen wurde — samt der
 * Typ-Passung in `sponsor-leih-passung.ts`, die dann wieder greift.
 *
 * WAS DAS MESSBAR AENDERT (gemessen, nicht behauptet): 128 von 160 Angeboten eines frischen Spiels
 * trugen eine Leihe, und ihr Cash-Verzicht (0,8 bis 25,4 C) wird von JEDER Sprosse der Leiter
 * abgezogen. Er war damit der groesste einzelne Streuungstreiber der Sponsorkarten.
 */
export const SPONSOR_GEBAEUDE_LEIHE_AKTIV = false;

export type SponsorSlateKarte = {
  slotIndex: number;
  raritaet: SponsorLeihRaritaet;
  /** Null bei der reinen Cash-Karte. */
  groesse: SponsorLeihGroesse | null;
  /** Null bei der reinen Cash-Karte. */
  leihe: (SponsorLeihAngebot & { startZustandPct: number }) | null;
  /** Cash-Verzicht der ersten Saison — 0 bei der reinen Cash-Karte. */
  verzichtErsteSaison: number;
};

/**
 * WELCHE GROESSE AUF WELCHEN PLATZ. Nicht gewuerfelt, sondern verteilt — ein Slate, in dem der Wurf
 * dreimal „mittel" ergibt, waere wieder die Scheinauswahl, gegen die diese Datei gebaut ist.
 *
 * Platz 2 ist immer klein (der Einstieg). Die uebrigen bekommen der Reihe nach gross und mittel,
 * damit beide Enden der Spanne IMMER im Slate stehen; erst ein vierter Gebaeude-Platz wuerfelt frei.
 * Welcher der Plaetze welche Groesse zieht, haengt am Saatwort — die Reihenfolge ist also nicht jede
 * Saison dieselbe.
 */
function verteileGroessen(anzahlGebaeudeplaetze: number, wurf: number): SponsorLeihGroesse[] {
  if (anzahlGebaeudeplaetze <= 0) return [];
  const groessen: SponsorLeihGroesse[] = ["klein"];
  const rest: SponsorLeihGroesse[] = ["gross", "mittel", "mittel", "gross"];
  for (let index = 1; index < anzahlGebaeudeplaetze; index += 1) {
    groessen.push(rest[(index - 1) % rest.length]!);
  }
  // Die Gebaeude-Plaetze ab Index 1 rotieren um den Wurf, damit nicht immer derselbe Platz die
  // grosse Karte traegt. Platz 0 der Liste (der Einstieg) bleibt fest.
  const drehbar = groessen.slice(1);
  if (drehbar.length > 1) {
    const versatz = wurf % drehbar.length;
    return [groessen[0]!, ...drehbar.slice(versatz), ...drehbar.slice(0, versatz)];
  }
  return groessen;
}

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
  /**
   * Was dieses Team hoechstens verzichten darf — vom Aufrufer aus der eigenen Leiter abgeleitet
   * (`VERZICHT_ANTEIL_DER_LEITER`). Ohne Angabe gilt kein Deckel; die grossen Karten koennen dann
   * jede Groesse annehmen, die der Katalog hergibt.
   */
  verzichtDeckel?: number;
  /**
   * Gebäude-Leihe an oder aus. Default ist die Produktionsstellung `SPONSOR_GEBAEUDE_LEIHE_AKTIV` —
   * der Parameter existiert NUR, damit beide Stellungen messbar und testbar bleiben (Chris will
   * vergleichen koennen). Kein Aufrufer im Spiel setzt ihn; die eine Wahrheit bleibt die Konstante.
   */
  aktiv?: boolean;
}): SponsorSlateKarte[] {
  const aktiv = input.aktiv ?? SPONSOR_GEBAEUDE_LEIHE_AKTIV;
  const verleihbar = input.verleihbar ?? VERLEIHBARE_GEBAEUDE;
  const eigene = input.eigeneStufen ?? {};
  const deckel = Number.isFinite(input.verzichtDeckel) ? input.verzichtDeckel! : Number.POSITIVE_INFINITY;

  // Die Groessen haengen am Slate als Ganzem, nicht am einzelnen Platz — nur so laesst sich zusagen,
  // dass beide Enden der Preisspanne vorkommen.
  const groessen = verteileGroessen(
    Math.max(0, input.raritaeten.length - 1),
    avalanche(hashSeed(`${input.seasonId}:${input.teamId}:leihgroessen`)),
  );

  // Ein Gebaeude kommt im Slate hoechstens EINMAL vor. Zwei Karten mit demselben Reha-Zentrum, nur
  // auf verschiedenen Stufen, sind keine Auswahl zwischen zwei Sachen, sondern zwei Preise fuer
  // dieselbe — genau die Sorte Scheinauswahl, die diese Datei sonst gerade verhindert.
  const vergeben = new Set<string>();

  return input.raritaeten.map((raritaet, slotIndex) => {
    // Platz 1 bleibt immer reines Geld — die Karte fuer Teams ohne Spielraum. Steht der
    // Gebäude-Schalter auf AUS, gilt dieselbe Zeile fuer ALLE Plaetze: ein Slate aus reinen
    // Cash-Karten, ohne zweiten Rechenweg.
    if (!aktiv || slotIndex === 0) {
      return { slotIndex, raritaet, groesse: null, leihe: null, verzichtErsteSaison: 0 };
    }

    const saat = `${input.seasonId}:${input.teamId}:leihe:${slotIndex}`;
    const wurf = avalanche(hashSeed(saat));
    const gewuenschteGroesse = groessen[slotIndex - 1] ?? "mittel";

    // Gebäude waehlen: bevorzugt eines, das dem Team ueberhaupt etwas bringt. Ein Gebaeude, das
    // das Team selbst schon hoeher gebaut hat, waere eine tote Karte.
    const brauchbareFuer = (stufe: number) => {
      const frei = verleihbar.filter(
        (facilityId) => (eigene[facilityId] ?? 0) < stufe && !vergeben.has(facilityId),
      );
      // Sind alle schon vergeben (mehr Plaetze als Gebaeude), zaehlt nur noch die eigene Stufe —
      // eine Wiederholung ist besser als eine leere Karte.
      return frei.length > 0 ? frei : verleihbar.filter((facilityId) => (eigene[facilityId] ?? 0) < stufe);
    };

    // Der Einstiegsdeckel gilt nur fuer Platz 2; der Leiter-Deckel fuer jede Gebaeude-Karte.
    const obergrenze = slotIndex === 1 ? Math.min(deckel, EINSTIEG_VERZICHT_DECKEL) : deckel;

    // Die gewuenschte Groesse wird HERUNTERGESTUFT, wenn sie das Team ueberfordert — lieber eine
    // kleinere echte Karte als eine grosse, die niemand nehmen kann. Die Reihenfolge ist die der
    // Groessen selbst, damit der Rueckfall vorhersagbar bleibt.
    const kandidaten: SponsorLeihGroesse[] =
      gewuenschteGroesse === "gross"
        ? ["gross", "mittel", "klein"]
        : gewuenschteGroesse === "mittel"
          ? ["mittel", "klein"]
          : ["klein"];

    let groesse: SponsorLeihGroesse = kandidaten[kandidaten.length - 1]!;
    let startStufe = STARTSTUFE_JE_GROESSE[groesse];
    let facilityId = brauchbareFuer(startStufe)[0] ?? verleihbar[0]!;

    for (const kandidat of kandidaten) {
      const stufe = STARTSTUFE_JE_GROESSE[kandidat];
      const brauchbare = brauchbareFuer(stufe);
      const bezahlbare = brauchbare.filter(
        (id) => berechneCashVerzicht({ facilityId: id, stufe, raritaet }) <= obergrenze,
      );
      if (bezahlbare.length === 0) continue;
      groesse = kandidat;
      startStufe = stufe;
      facilityId = bezahlbare[wurf % bezahlbare.length]!;
      break;
    }

    vergeben.add(facilityId);
    const laufzeit = input.laufzeiten?.[slotIndex] ?? (slotIndex === 1 ? 2 : 3);
    const angebot = baueLeihAngebot({ facilityId, raritaet, startStufe, laufzeit });
    return {
      slotIndex,
      raritaet,
      groesse,
      leihe: { ...angebot, startZustandPct: ZUSTAND_JE_RARITAET[raritaet] },
      verzichtErsteSaison: angebot.verzichtJeSaison[0] ?? 0,
    };
  });
}
