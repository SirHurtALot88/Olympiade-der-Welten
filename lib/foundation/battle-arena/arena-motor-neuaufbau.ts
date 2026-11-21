/**
 * MOTOR-NEUAUFBAU IN DER SPIELTAGS-ANSICHT (Arena-Fluss 21.11., docs/design/arena-fluss-21-11.md).
 *
 * Chris: „das Endergebnis resettet immer" und „nach D1 springt die Arena von selbst weiter". Gemessen
 * am Live-Abbild (Spieltag 12, D1 Mini-DM, D2 Basketball): die Buchung von D1 aendert den Spielstand,
 * den der Host als Motor-Nutzlast (`umschlag`) einhaengt — bis 21.11. buchte der D1-Commit den
 * Trainingszuwachs auf Attribute und Disziplinwerte. Die Signatur der Nutzlast kippte, der Host riss
 * den Motor mit dem gerade gezeigten Endstand ab, zeigte das Ladebild (mit dem Ausblick auf D2) und
 * baute D1 von vorn auf.
 *
 * Die Ursache ist im Trainings-Commit behoben (`spieltagOffen`). Diese Regel ist die zweite Sicherung
 * im Browser: hat der Zuschauer die Disziplin schon angeschaut (Vorstellung weggeklickt, Quick-Sim)
 * oder steht ihr Endstand, wird der Motor fuer DIESE Disziplin nicht mehr neu aufgebaut. Eine
 * geaenderte Nutzlast wirkt erst beim naechsten Disziplinwechsel (Klick auf „Weiter" zu D2) — dort
 * baut der Host mit dem dann aktuellen Stand neu auf.
 *
 * NACHSCHAERFUNG (Review 21.11.): „angeschaut" darf keinen NOETIGEN Neuaufbau verhindern.
 *  (a) Spieltagswechsel: die Buehne bleibt eingehaengt, D2 auf Spieltag n und D1 auf n+1 koennen
 *      dieselbe Disziplin sein — ohne Spieltags-ID in der Entscheidung zeigte sie das alte Match.
 *      Anderer Spieltag => immer neu (der Host setzt Ende/Vorstellung dabei ausserdem zurueck).
 *  (b) Echte Aenderung waehrend des Spiels (neuer Vorlauf mit anderer Saat, Room-Sync, anderer Pod):
 *      die alte Saat liefe weiter, gebucht wuerde die neue. Aufgeschoben wird deshalb nur, wenn sich
 *      fuer die AKTUELLE Disziplin weder Saat, Mutatoren, Format, Strategie noch Pods/Paarung
 *      geaendert haben (`spielteilSignatur`) — also nur Kader-Werte (Attribute, Disziplinwerte,
 *      Verletzungsstand), die mit dem Trainings-Fix ohnehin nicht mehr mitten im Spieltag wechseln.
 *
 * Reine Funktionen ohne DOM, damit sie ohne Browser pruefbar sind (`tests/arena-motor-neuaufbau.test.ts`).
 */
export type MotorNeuaufbauEntscheidung =
  /** Gleiche Nutzlast, Motor steht: nichts tun. */
  | "behalten"
  /** Nur Kader-Werte anders, die gezeigte Disziplin ist angeschaut/beendet: stehen lassen bis zum Wechsel. */
  | "aufschieben"
  /** Neu einhaengen (erster Aufbau, Spieltagswechsel, Disziplinwechsel mit neuer Nutzlast, echte Spielaenderung, noch nicht angeschaut). */
  | "neu";

export function entscheideMotorNeuaufbau(input: {
  /** Signatur der jetzt gewuenschten Nutzlast (`null` ausserhalb der Spieltags-Ansicht). */
  signatur: string | null;
  /** Signatur der eingehaengten Instanz (`null`, solange keine steht). */
  gemounteteSignatur: string | null;
  /** Steht ein Motor im Container? */
  motorSteht: boolean;
  /** Spieltag (matchdayId), der jetzt gezeigt werden soll. */
  spieltagsId: string | null;
  /** Spieltag, fuer den die eingehaengte Instanz gebaut wurde. */
  gemounteteSpieltagsId: string | null;
  /** Disziplin, die gerade gezeigt werden soll. */
  aktuelleDisziplin: string | null;
  /** `spielteilSignatur` der gewuenschten Nutzlast fuer `aktuelleDisziplin`. */
  spielteil: string | null;
  /** `spielteilSignatur` der eingehaengten Nutzlast fuer `aktuelleDisziplin`. */
  gemounteterSpielteil: string | null;
  /** Disziplin, deren Spiel auf DIESEM Spieltag zuletzt zu Ende lief (`oly-arena:ende`), sonst `null`. */
  endeDisziplin: string | null;
  /** Disziplin, deren Vorstellung auf DIESEM Spieltag weggeklickt (oder per Quick-Sim uebersprungen) wurde, sonst `null`. */
  angeschauteDisziplin: string | null;
}): MotorNeuaufbauEntscheidung {
  const { signatur, gemounteteSignatur, motorSteht, aktuelleDisziplin } = input;
  if (signatur == null || !motorSteht || gemounteteSignatur == null) return "neu";
  // (a) Ein anderer Spieltag ist ein anderes Spiel — auch bei gleicher Disziplin, auch angeschaut.
  if (input.spieltagsId !== input.gemounteteSpieltagsId) return "neu";
  if (signatur === gemounteteSignatur) return "behalten";
  const angeschaut =
    aktuelleDisziplin != null &&
    (input.endeDisziplin === aktuelleDisziplin || input.angeschauteDisziplin === aktuelleDisziplin);
  // (b) Nur aufschieben, wenn das SPIEL der aktuellen Disziplin dasselbe bleibt.
  if (angeschaut && input.spielteil != null && input.spielteil === input.gemounteterSpielteil) {
    return "aufschieben";
  }
  return "neu";
}

/** Was der Host als Nutzlast einhaengt (Ausschnitt, den `spielteilSignatur` liest). */
export type ArenaNutzlastSpielteil = {
  heimTeamId: string;
  gastTeamId: string;
  umschlag: {
    aufstellung?: unknown;
    seedByDisciplineId?: Record<string, unknown> | null;
    mutatorenByDisciplineId?: Record<string, unknown> | null;
    formatByDisciplineId?: Record<string, unknown> | null;
    strategieByDisciplineId?: Record<string, unknown> | null;
    miniDmFfaTeams?: ReadonlyArray<{ name?: unknown }> | null;
    miniDmFfaK?: unknown;
    miniDmFfaSaat?: unknown;
    miniDmFfaAufstellung?: unknown;
    battlefieldPod?: unknown;
    bahnPodByDisciplineId?: Record<string, unknown> | null;
  };
};

const MINI_DM_DISZIPLIN = "mini-dm";
const BATTLEFIELD_DISZIPLIN = "battlefield";

/** Aufstellung (Name -> {d, slot, ...}) auf die Plaetze der Disziplin reduziert: wer spielt wo. */
function plaetzeFuer(aufstellung: unknown, disziplin: string): Array<[string, string]> {
  if (!aufstellung || typeof aufstellung !== "object") return [];
  const plaetze: Array<[string, string]> = [];
  for (const [name, eintrag] of Object.entries(aufstellung as Record<string, unknown>)) {
    const e = eintrag as { d?: unknown; slot?: unknown } | null;
    if (e && e.d === disziplin) plaetze.push([name, String(e.slot ?? "")]);
  }
  return plaetze.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/**
 * JSON ohne Kader-Werte: `kader` (Attribute, Disziplinwerte, Verletzungsstand je Spieler) faellt weg,
 * `aufstellung` wird auf die Plaetze der Disziplin reduziert (Zusatzfelder wie Paar-Bonus oder Form
 * aendern sich mit Buchungen und sind Spielerwerte, keine Paarung).
 */
function ohneKaderWerte(wert: unknown, disziplin: string): string {
  return JSON.stringify(wert ?? null, (schluessel, v) => {
    if (schluessel === "kader") return undefined;
    if (schluessel === "aufstellung") {
      return Array.isArray(v) ? v.map((a) => plaetzeFuer(a, disziplin)) : plaetzeFuer(v, disziplin);
    }
    return v;
  });
}

/**
 * DAS SPIEL einer Disziplin in der Nutzlast — alles, was entscheidet, WELCHES Match laeuft: Paarung
 * (Teams, Plaetze der Aufstellung), Saat, Mutatoren, Format, Strategie und der Pod (Teams, k, Saat,
 * Plaetze). NICHT darin: die Kader-Werte der Spieler. Unterscheiden sich zwei Nutzlasten nur dort,
 * bleibt ein angeschautes Spiel stehen (s. `entscheideMotorNeuaufbau`).
 */
export function spielteilSignatur(nutzlast: ArenaNutzlastSpielteil, disziplin: string | null): string | null {
  if (!disziplin) return null;
  const u = nutzlast.umschlag;
  const teil = {
    paarung: [nutzlast.heimTeamId, nutzlast.gastTeamId],
    plaetze: plaetzeFuer(u.aufstellung, disziplin),
    saat: u.seedByDisciplineId?.[disziplin] ?? null,
    mutatoren: u.mutatorenByDisciplineId?.[disziplin] ?? null,
    format: u.formatByDisciplineId?.[disziplin] ?? null,
    strategie: u.strategieByDisciplineId?.[disziplin] ?? null,
    pod:
      disziplin === MINI_DM_DISZIPLIN
        ? {
            teams: u.miniDmFfaTeams ? u.miniDmFfaTeams.map((t) => t?.name ?? null) : null,
            k: u.miniDmFfaK ?? null,
            saat: u.miniDmFfaSaat ?? null,
            aufstellung: u.miniDmFfaAufstellung ?? null,
          }
        : disziplin === BATTLEFIELD_DISZIPLIN
          ? (u.battlefieldPod ?? null)
          : (u.bahnPodByDisciplineId?.[disziplin] ?? null),
  };
  return ohneKaderWerte(teil, disziplin);
}
