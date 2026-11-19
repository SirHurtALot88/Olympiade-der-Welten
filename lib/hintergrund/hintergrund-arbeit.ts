/**
 * HINTERGRUNDARBEIT, DIE NIEMAND ABWARTET — abwartbar und abbrechbar machen.
 *
 * Gefunden an #1642 (CI rot, zweimal unabhängig): `tests/mehrspieler-1v1-2v2-modi.test.ts` „Unbekannter Modus …“ (liest nur eine
 * Datei, lokal 6 ms) lief in den 20-s-Timeout. Ursache: die Raum-Start-Tests davor legen je ein neues Spiel an, und seit der
 * Einzelschritt-Draft Standard ist (Abnahme 19.11., F1), pickt die KI danach im Hintergrund weiter — sechs Ligen à 381 Picks im
 * selben Prozess, nach Testende. Gemessen: Datei mit Blocklauf 26 s, mit Einzelschritt 83 s (Tests selbst je ~12 s).
 *
 * Wer Arbeit „detached“ startet (`void …`), meldet sie hier an. `beendeHintergrundArbeit()` bricht sie beim nächsten Happen ab
 * und wartet darauf. Das Test-Setup (tests/setup/sqlite-pro-testdatei.ts) beendet nach jedem Test, was IN diesem Test
 * angestoßen wurde, und nach der Datei den Rest (Arbeit aus `beforeAll` gehört der ganzen Datei). Das Register liegt auf
 * `globalThis`, damit das Setup es lesen kann, ohne den schweren Importgraph der Dienste zu laden.
 */

type Eintrag = { promise: Promise<unknown>; abbrechen: () => void };

const SCHLUESSEL = Symbol.for("oly.hintergrundArbeit");

function register(): Set<Eintrag> {
  const ziel = globalThis as unknown as Record<symbol, Set<Eintrag> | undefined>;
  return (ziel[SCHLUESSEL] ??= new Set<Eintrag>());
}

/** Meldet eine laufende Hintergrundarbeit an; sie meldet sich selbst ab, sobald sie endet. */
export function meldeHintergrundArbeit(promise: Promise<unknown>, abbrechen: () => void): void {
  const eintrag: Eintrag = { promise, abbrechen };
  register().add(eintrag);
  void promise.then(
    () => register().delete(eintrag),
    () => register().delete(eintrag),
  );
}

/** Wie viele Hintergrundarbeiten gerade laufen. */
export function laufendeHintergrundArbeit(): number {
  return register().size;
}

/** Abzug der gerade laufenden Arbeiten — für `beendeHintergrundArbeit({ ausser })`. */
export function hintergrundArbeitAbzug(): ReadonlySet<object> {
  return new Set<object>(register());
}

/**
 * Bricht die angemeldeten Hintergrundarbeiten ab (beim nächsten Happen) und wartet, bis sie stehen. `ausser`: ein früherer
 * Abzug, dessen Arbeiten weiterlaufen dürfen. Mehrere Runden, weil eine abgebrochene Arbeit beim Auslaufen noch eine
 * Folgearbeit anmelden kann.
 */
export async function beendeHintergrundArbeit(optionen: { ausser?: ReadonlySet<object> } = {}): Promise<void> {
  const betroffen = () => [...register()].filter((eintrag) => !optionen.ausser?.has(eintrag));
  for (let runde = 0; runde < 5 && betroffen().length > 0; runde += 1) {
    const eintraege = betroffen();
    for (const eintrag of eintraege) eintrag.abbrechen();
    await Promise.allSettled(eintraege.map((eintrag) => eintrag.promise));
  }
}
