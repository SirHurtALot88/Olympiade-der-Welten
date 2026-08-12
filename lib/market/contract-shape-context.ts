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
  /** Anteil back-loaded an den laufenden Mehrjahresvertraegen des Teams (0..1). */
  backLoadedShare: number;
  /** Wie viele Mehrjahresvertraege der Anteil misst — der Nenner. Siehe MIX_RIEGEL_MINDESTZAHL. */
  mehrjahresVertraege: number;
};

/** Ab diesem Anteil back-loaded legt kein weiterer back-loaded Vertrag mehr nach. */
export const MIX_RIEGEL_ANTEIL = 0.5;

/**
 * MINDESTNENNER, damit der Riegel nicht auf Zufall anspringt. Ohne ihn triggert ein Team mit 2 von 2
 * back-loaded Vertraegen genauso wie eines mit 8 von 12 — am Abbild traf das real zu (D-P mit 2/2,
 * A-A mit 4/4). Bei so wenigen Vertraegen sagt der Anteil nichts ueber einen Gehaltsberg aus.
 * Zur Einordnung: Liga-Norm des back-Anteils sind 6,5 % (Saison 1) bzw. 23 % (Saison 2), nur 5 von
 * 32 Teams liegen ueberhaupt bei >= 50 %. Der Riegel ist ein Ausreisser-Riegel, kein Normalfall.
 */
export const MIX_RIEGEL_MINDESTZAHL = 4;

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
  backLoadedShare?: number | null;
  mehrjahresVertraege?: number | null;
}): { form: ContractShape; grund: string | null } {
  // Bei Einjahresvertraegen gibt es keine Verteilung ueber die Zeit — die Form ist bedeutungslos.
  if (input.laufzeit < 2) return { form: input.form, grund: null };

  if (input.apronHeadroom != null && input.apronHeadroom <= 0 && input.form === "front_loaded") {
    return {
      form: "balanced",
      grund: "Ueber der Apron-Linie: nicht zusaetzlich frueh zahlen, wenn die Abgabe ohnehin faellig wird.",
    };
  }

  const nennerReicht = (input.mehrjahresVertraege ?? 0) >= MIX_RIEGEL_MINDESTZAHL;
  if (
    nennerReicht &&
    input.backLoadedShare != null &&
    input.backLoadedShare >= MIX_RIEGEL_ANTEIL &&
    input.form === "back_loaded"
  ) {
    return {
      form: "balanced",
      grund: "Schon ueberwiegend back-loaded: ein weiterer wuerde den Gehaltsberg spaeter aufbauen.",
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

  // Nur Mehrjahresvertraege zaehlen: bei einem Einjahresvertrag gibt es keine Verteilung ueber die
  // Zeit, die Form ist dort bedeutungslos.
  const mehrjaehrig = (gameState.rosters ?? []).filter(
    (entry) => entry.teamId === teamId && (entry.contractLength ?? 1) >= 2,
  );
  const backLoaded = mehrjaehrig.filter((entry) => entry.contractShape === "back_loaded").length;
  const backLoadedShare = mehrjaehrig.length === 0 ? 0 : backLoaded / mehrjaehrig.length;

  const ergebnis: ContractShapeTeamContext = {
    apronHeadroom,
    backLoadedShare,
    mehrjahresVertraege: mehrjaehrig.length,
  };
  lookup.byTeamId.set(teamId, ergebnis);
  return ergebnis;
}
