/**
 * GLOBALER CHROMIUM-SEMAPHOR (Plan Abschnitt 2.6: "niemals zwei Chromium-Laeufe gleichzeitig").
 * Eigene, winzige Datei statt in `arena-vorlauf-service.ts` (dort urspruenglich entstanden) --
 * `lib/battle/arena-chromium-selftest.ts` (importiert von `/api/health`, s. dortiger Kommentar
 * "Kleinigkeit": der Selbsttest muss denselben Semaphor nehmen wie ein echter Arena-Vorlauf, sonst
 * koennten beide gleichzeitig je einen eigenen Chromium-Prozess starten) braucht NUR diese eine
 * Funktion, nicht den ganzen (GameState-/Persistenz-schweren) Vorlauf-Service -- ein Import von
 * dort wuerde den Health-Route-Bundle unnoetig aufblaehen.
 *
 * EIN einziger Semaphor-Halter im gesamten Node-Prozess — ueber ALLE Saves, ALLE Disziplinen, UND
 * den Selbsttest. SEIT DEM LATENZ-FIX 18.10. (PR #1290) heisst das NICHT mehr "ein Chromium-Prozess":
 * ein Halter (eine Disziplin eines Arena-Vorlaufs) darf intern seine ZWEI Liga-Stufen gleichzeitig
 * fahren, also bis zu ZWEI Browser (`runBattleModeArenaMatchday()`, Notschalter
 * `OLY_ARENA_TIER_PARALLEL=0`, automatischer RAM-Guard `OLY_ARENA_TIER_PARALLEL_MIN_FREE_MB`). Die
 * Obergrenze projektweit ist damit zwei Browser, nie mehr. Einfache Promise-Kette statt einer Bibliothek: jeder Aufrufer haengt sich ans
 * Ende, die Kette reisst auch bei einem Fehler nicht ab (der `.catch` unten faengt ihn fuer die
 * Kette selbst, der eigentliche Fehler geht unveraendert an den Aufrufer von
 * `mitChromiumSemaphor()` zurueck).
 */
let chromiumKette: Promise<void> = Promise.resolve();

export function mitChromiumSemaphor<T>(aufgabe: () => Promise<T>): Promise<T> {
  const wartenAufVorherige = chromiumKette;
  const ergebnis = wartenAufVorherige.then(aufgabe, aufgabe);
  chromiumKette = ergebnis.then(
    () => undefined,
    () => undefined,
  );
  return ergebnis;
}
