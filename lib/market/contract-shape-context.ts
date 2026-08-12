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
 * auseinander — M-M: geglättet 81,6, echt 95,9. Fünf von acht Teams über der ersten Linie zahlten
 * JETZT mehr, als der Apron ihnen anrechnet: sie front-loaden sich in die Enge hinein und tragen die
 * Abgabe zusätzlich. Genau das ist der behebbare Teil.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamApronSalaryBase, resolveSeasonApronLines } from "@/lib/season/apron-service";

export type ContractShapeTeamContext = {
  /** `line1 − Apron-Bemessung`. Negativ heisst: das Team liegt ueber der ersten Linie. */
  apronHeadroom: number;
  /** Anteil back-loaded an den laufenden Mehrjahresvertraegen des Teams (0..1). */
  backLoadedShare: number;
};

type Lookup = {
  line1: number;
  byTeamId: Map<string, ContractShapeTeamContext>;
};

/**
 * Der Fuell-Lauf ruft die Kaufvorschau je Kandidat auf, und jede Vorschau braucht diese Lage. Ohne
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

  const ergebnis: ContractShapeTeamContext = { apronHeadroom, backLoadedShare };
  lookup.byTeamId.set(teamId, ergebnis);
  return ergebnis;
}
