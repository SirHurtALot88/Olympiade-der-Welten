/**
 * WAS DIE VERTRAGSFORM AUS DER TEAMLAGE WISSEN MUSS — Apron-Spielraum und der bisherige Mix.
 *
 * GEMELDET VON CHRIS: „Top Teams sollten wenn es geht evtl mehr die Mechanik nutzen Front und Back
 * Loaded verträge zu gestalten um die Apron probleme ggf. umgehen zu können."
 * Und als Grenze dazu: „es sollen ja nicht alle top teams dann nur back loaded nehmen […] dann hast
 * du irgendwann nen sehr teuren gehaltspeak das muss auch vermieden werden, der mix machts."
 *
 * WICHTIG — WAS DIE FORM NICHT KANN. Die Apron-Abgabe selbst lässt sich damit NICHT umgehen. Sie
 * bemisst sich bewusst an der GEGLÄTTETEN Gehaltszahl (`getTeamApronSalaryBase` →
 * `getTeamDisplaySalaryTotal`), gerade damit ein Team sich nicht allein durch die zeitliche
 * Verteilung seiner Raten über oder unter die Linie schiebt — so steht es seit der Kalibrierung im
 * Kopfkommentar von `apron-service.ts`. Diese Absicht bleibt unangetastet.
 *
 * WAS DIE FORM SEHR WOHL BEWEGT: die ECHTE Zahlung dieser Saison (`getTeamActualSalaryTotal`,
 * `resolvePlayerEconomyContract().salary`). Am Live-Abbild gemessen liegen die beiden weit
 * auseinander. In Saison 1 liegen 11 Teams über der ersten Linie, SIEBEN davon zahlen JETZT mehr,
 * als der Apron ihnen anrechnet (M-M: geglättet 81,6, echt 95,9; Z-H: 82,9 gegen 96,9); in Saison 2
 * sind es 4 von 8. Sie front-loaden sich in die Enge hinein und tragen die Abgabe zusätzlich. Genau
 * das ist der behebbare Teil.
 *
 * DIESE DATEI HÄLT DIE REGEL — NICHT DIE AUFRUFER. Es gibt DREI unabhängige Formwähler im Spiel,
 * und alle drei rufen `wendeApronUndMixAn`. Neue Formwähler gehören ebenfalls hierher.
 *
 * WELCHE KAUFWEGE HEUTE WIRKLICH LAUFEN — nachgemessen, nicht aus Altbeständen geschlossen. Der
 * Füll-Lauf (`auto-roster-fill-service.ts`) ist AB SAISON 2 VERBOTEN, die Sperre steht im Dienst
 * selbst („keine filler mehr! VERBOT" — Chris); gepickt wird nur noch organisch. An den Transfers
 * der Spielstände abzulesen: `ai_roster_fill` kommt AUSSCHLIESSLICH in Saison 1 vor (334 bzw. 329
 * Zeilen), in Saison 2 stehen dort `ai_organic_squad_buy` (69) und `ai_preseason_market_buy` (33).
 * Wer aus der blossen Menge der `ai_roster_fill`-Zeilen schliesst, dieser Weg sei der wichtigste,
 * irrt doppelt: die Zeilen sind historisch, und ein Teil davon stammt aus dem verbotenen Dienst.
 *
 *   - `ai_organic_squad_buy` übergibt keine Form und fällt auf `recommendContractOfferForPlayer`
 *     zurück (Slow-Path, `transfermarkt-local-service.ts:1144`).
 *   - `ai_preseason_market_buy` holt die Form ausdrücklich aus derselben Empfehlung
 *     (`ai-market-plan-apply-service.ts:2027`).
 *   - Der organische Setup-Draft der Saison 1 läuft über den Fast-Batch
 *     (`transfermarkt-local-service.ts:2402`) und BESCHRIFTET seine Transfers weiterhin mit
 *     `ai_roster_fill` — daher rührt das Etikett, nicht vom verbotenen Dienst.
 *   - Verlängerungen (`contract-renewal-service.ts`) sind der grösste Strom überhaupt: 121 von 176
 *     KI-Verlängerungen mehrjährig in Saison 2.
 *
 * Eine erste Fassung verdrahtete nur den Slow-Path; Fables Audit hat aufgedeckt, dass Fast-Batch
 * und Verlängerung apron-blind blieben.
 */
import type { ContractShape, GameState } from "@/lib/data/olyDataTypes";
import { getTeamApronSalaryBase, resolveSeasonApronLines } from "@/lib/season/apron-service";

export type ContractShapeTeamContext = {
  /** `line1 − Apron-Bemessung`. Negativ heisst: das Team liegt ueber der ersten Linie. */
  apronHeadroom: number;
  /**
   * DER GEHALTSBERG, IN GELD: der bereits gebundene MEHRBETRAG spaeterer Vertragsjahre, gemessen an
   * der heutigen Gehaltssumme. 0,18 heisst „das Team hat sich fuer eine spaetere Saison 18 % seiner
   * jetzigen Gehaltslast zusaetzlich ans Bein gebunden".
   */
  gehaltsbergQuote: number;
};

/**
 * AB HIER LEGT KEIN WEITERER BACK-LOADED VERTRAG MEHR NACH — gemessen am Geld, nicht an Formen.
 *
 * CHRIS' AUFTRAG: „Ja miss es an zukunftslast." Vorher zaehlte der Riegel FORM-ANTEILE (ab der
 * Haelfte back-loaded). Das war zu grob, und zwar nachweislich: ein Dreijahresvertrag im letzten
 * Jahr zaehlte noch als „back", obwohl seine teure Rate laengst JETZT faellig ist.
 *
 * WARUM NICHT EINFACH „Zukunft gegen heute". Der naheliegende Vergleich — Summe der naechsten
 * Saison gegen die laufende — ist am Abbild WERTLOS: Vertraege laufen aus, die gebundene
 * Zukunftssumme schrumpft also fast immer. Gemessen liegt die hoechste Folgesaison bei KEINEM
 * einzigen Team ueber der laufenden (Saison 1 Maximum 0,69, Saison 2 Maximum 1,04). Eine Schwelle
 * darauf haette nie ausgeloest.
 *
 * WAS STATTDESSEN GEMESSEN WIRD, ist der Aufwaerts-Knick INNERHALB der Vertraege: je Vertrag die
 * teuerste kuenftige Rate minus der Rate dieser Saison, aufsummiert und durch die heutige
 * Gehaltssumme geteilt. Auslaufende Vertraege verwaessern das nicht, weil nur der Anstieg zaehlt.
 *
 * DIE SCHWELLE 0,15 IST GEMESSEN, NICHT GESETZT. Verteilung am Live-Abbild:
 *
 *   Saison 1: Median 0,00 · Maximum 0,182 (P-C)     → 1 Team ueber 0,15
 *   Saison 2: Median 0,06 · Maximum 0,324 (U-A)     → 7 Teams ueber 0,15
 *
 * 0,15 ist rund das Zweieinhalbfache des Saison-2-Medians und trifft in BEIDEN Staenden die Teams
 * mit einem echten Berg. Gegen den alten Riegel gehalten ist das eine UMLENKUNG, keine Ausweitung:
 * in Saison 2 fingen die Form-Anteile A-A, P-C, R-R, V-V; die Geld-Messung faengt bei 0,20
 * dieselbe Zahl, aber teils andere Teams (B-B und U-A statt P-C und R-R) — U-A hat mit 0,324 den
 * groessten Berg der Liga und blieb dem alten Riegel verborgen, weil nur 40 % seiner Vertraege
 * back-loaded sind. Und P-C, das in Saison 1 als EINZIGES Team einen Berg baut (+7,2 auf 39,5),
 * war fuer den alten Riegel unsichtbar.
 *
 * DER MINDESTNENNER ENTFAELLT. Er war noetig, weil ein Anteil aus 2 von 2 Vertraegen nichts
 * aussagt. Die Geld-Messung hat dieses Problem nicht: sie normiert auf die Gehaltssumme des Teams,
 * ein einzelner kleiner Vertrag bewegt sie also kaum.
 */
export const MIX_RIEGEL_QUOTE = 0.15;

/**
 * DIE EINE REGEL, die alle Formwähler teilen. Sie VERSCHIEBT nur — sie erzeugt nie `back_loaded`.
 *
 * Chris' Grenze dazu war ausdruecklich: „achtung deine messwerte schieben alles extrem richtung
 * backloaded das gefaellt mir gar nicht." Beide Zweige liefern deshalb `balanced`.
 */
export function wendeApronUndMixAn(input: {
  form: ContractShape;
  laufzeit: number;
  apronHeadroom?: number | null;
  gehaltsbergQuote?: number | null;
}): { form: ContractShape; grund: string | null } {
  // Bei Einjahresvertraegen gibt es keine Verteilung ueber die Zeit — die Form ist bedeutungslos.
  if (input.laufzeit < 2) return { form: input.form, grund: null };

  if (input.apronHeadroom != null && input.apronHeadroom <= 0 && input.form === "front_loaded") {
    return {
      form: "balanced",
      grund: "Ueber der Apron-Linie: nicht zusaetzlich frueh zahlen, wenn die Abgabe ohnehin faellig wird.",
    };
  }

  if (
    input.gehaltsbergQuote != null &&
    input.gehaltsbergQuote >= MIX_RIEGEL_QUOTE &&
    input.form === "back_loaded"
  ) {
    return {
      form: "balanced",
      grund: "Gehaltsberg schon gebunden: ein weiterer back-loaded Vertrag wuerde ihn weiter auftuermen.",
    };
  }

  return { form: input.form, grund: null };
}

type Lookup = {
  line1: number;
  byTeamId: Map<string, ContractShapeTeamContext>;
};

/**
 * Der organische Draft ruft die Kaufvorschau je Kandidat auf, und jede Vorschau braucht diese Lage. Ohne
 * Zwischenspeicher liefe die Liga-Median-Rechnung (`resolveSeasonApronLines`) pro Kandidat erneut.
 * Der Speicher haengt am GameState-Objekt: ein neuer Zustand bekommt eine neue Rechnung, ein
 * unveraenderter wird nicht zweimal vermessen.
 */
const speicher = new WeakMap<object, Lookup>();

function baueLookup(gameState: GameState): Lookup {
  const lines = resolveSeasonApronLines(gameState);
  return { line1: lines.line1, byTeamId: new Map() };
}

export function getContractShapeTeamContext(gameState: GameState, teamId: string): ContractShapeTeamContext {
  let lookup = speicher.get(gameState as unknown as object);
  if (!lookup) {
    lookup = baueLookup(gameState);
    speicher.set(gameState as unknown as object, lookup);
  }
  const vorhanden = lookup.byTeamId.get(teamId);
  if (vorhanden) return vorhanden;

  const apronHeadroom = Number((lookup.line1 - getTeamApronSalaryBase(gameState, teamId)).toFixed(1));

  // DER BERG IN GELD. Je Vertrag: teuerste kuenftige Rate minus Rate dieser Saison, nur der
  // ANSTIEG zaehlt (deshalb `Math.max(0, …)`) — ein auslaufender oder front-loaded Vertrag drueckt
  // die Quote nicht kuenstlich. Geteilt wird durch die Summe der Raten DIESER Saison, also durch
  // das, was das Team gerade wirklich zahlt.
  const kader = (gameState.rosters ?? []).filter((entry) => entry.teamId === teamId);
  let jetzt = 0;
  let mehrbetrag = 0;
  for (const entry of kader) {
    const raten = (entry.yearlySalarySchedule ?? [])
      .map((jahr) => (Number.isFinite(jahr?.salary) ? jahr.salary : 0));
    if (raten.length === 0) {
      // Bestandsvertraege ohne Schedule tragen keine Verteilung — sie zaehlen nur zur Basis.
      jetzt += Number.isFinite(entry.salary) ? entry.salary : 0;
      continue;
    }
    jetzt += raten[0] ?? 0;
    if (raten.length >= 2) {
      mehrbetrag += Math.max(0, Math.max(...raten.slice(1)) - (raten[0] ?? 0));
    }
  }
  const gehaltsbergQuote = jetzt > 0 ? Number((mehrbetrag / jetzt).toFixed(3)) : 0;

  const ergebnis: ContractShapeTeamContext = { apronHeadroom, gehaltsbergQuote };
  lookup.byTeamId.set(teamId, ergebnis);
  return ergebnis;
}
