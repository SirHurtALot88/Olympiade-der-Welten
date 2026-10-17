/**
 * GLOBALER CHROMIUM-SEMAPHOR (Plan Abschnitt 2.6: "niemals zwei Chromium-Laeufe gleichzeitig").
 * Eigene, winzige Datei statt in `arena-vorlauf-service.ts` (dort urspruenglich entstanden) --
 * `lib/battle/arena-chromium-selftest.ts` (importiert von `/api/health`, s. dortiger Kommentar
 * "Kleinigkeit": der Selbsttest muss denselben Semaphor nehmen wie ein echter Arena-Vorlauf, sonst
 * koennten beide gleichzeitig je einen eigenen Chromium-Prozess starten) braucht NUR diese eine
 * Funktion, nicht den ganzen (GameState-/Persistenz-schweren) Vorlauf-Service -- ein Import von
 * dort wuerde den Health-Route-Bundle unnoetig aufblaehen.
 *
 * EIN einziger Chromium-Prozess im gesamten Node-Prozess — ueber ALLE Saves, ALLE Disziplinen, UND
 * den Selbsttest. Einfache Promise-Kette statt einer Bibliothek: jeder Aufrufer haengt sich ans
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
