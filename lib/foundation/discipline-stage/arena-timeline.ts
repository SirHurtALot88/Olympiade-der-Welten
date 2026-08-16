/**
 * DIE GEMEINSAME ZEITBASIS DER ARENA — Befund B4 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md, Stufe
 * 3.2/3.3/3.4).
 *
 * VORHER: der Ablauf existierte ausschliesslich als `setTimeout`-Kaskade im Browser
 * (`DisciplineStageNativeArena.tsx`, `TRACK_ROUND_MS = 10000`). Es gab keine Funktion
 * `Zustand(Schritt, verstrichene Zeit)`, aus der ein zweiter Browser denselben Augenblick
 * herstellen konnte — jeder Client rechnete seine eigene Kaskade, ab dem Moment, in dem SEIN
 * `setTimeout` feuerte. Zwei Browser mit unterschiedlicher Systemuhr (oder nur unterschiedlicher
 * Netzwerklatenz beim Empfang) sahen deshalb bestenfalls "gleiche Reihenfolge, anderer Moment".
 *
 * DIESE DATEI zieht genau diese Frage in eine REINE Funktion — kein React, kein Timer, kein DOM,
 * deshalb ohne Rendering pruefbar (Hausregel dieses Projekts). Sie beantwortet, wie weit ein
 * Schritt fortgeschritten ist, WENN man Schrittbeginn (Server-Zeit) und eine Server-Zeit-Schaetzung
 * des Clients kennt — nicht, wenn man einer lokalen `setTimeout`-Kette folgt.
 *
 * ZEITQUELLE GEKAPSELT: `Date.now()` direkt zu rufen waere in Tests fragil (die Uhr laeuft beim
 * Testlauf weiter). Jede Funktion hier nimmt "jetzt" als Parameter (`clientNowMs`/`serverNowMs`)
 * entgegen, nichts ruft intern `Date.now()` ausser dem explizit benannten `systemArenaClock` —
 * ein Test kann eine eigene Uhr einsetzen, ohne echte Zeit verstreichen zu lassen.
 */

/** Eine austauschbare Uhr: liefert "jetzt" in ms seit Epoch. Tests setzen eine eigene ein. */
export type ArenaClockSource = () => number;

/** Die echte Systemuhr — nur hier, damit es GENAU eine Stelle gibt, die `Date.now()` ruft. */
export const systemArenaClock: ArenaClockSource = () => Date.now();

/**
 * Uhren-Versatz eines Clients: Server-Zeit minus eigene Client-Zeit, in ms.
 *
 * `serverTimeIso` ist ein Zeitstempel, den der Server mit dem Raum-Zustand mitschickt (heute
 * `RoomArenaState.updatedAt`/`stepStartedAt`, siehe `lib/room/arena-sync-state.ts`) — kein
 * eigener Ping-Zyklus noetig, jede Zustandsaktualisierung liefert einen frischen Ankerpunkt.
 * `clientNowMs` ist der Zeitpunkt (eigene Uhr), zu dem der Client diesen Zeitstempel EMPFANGEN
 * hat. Ein positiver Versatz heisst: die Server-Uhr laeuft der Client-Uhr voraus.
 *
 * Ungueltige Zeitstempel (z.B. leer, kaputt geparst) ergeben Versatz 0 — der Client faellt dann
 * auf "eigene Uhr = Server-Uhr" zurueck, statt mit `NaN` weiterzurechnen.
 *
 * BEDINGUNG, UNTER DER DIESE RECHNUNG UEBERHAUPT STIMMT (Befund F8, Aufgabe #45): `serverTimeIso`
 * muss in DEM Moment entstanden sein, in dem der Client ihn empfaengt. Ist er aelter, wandert der
 * gesamte Altersunterschied in den Versatz — der Client haelt die Server-Uhr dann faelschlich fuer
 * nachgehend. Genau das passierte nach einem Neustart: `rehydrateRuntimeRoomsFromPersistence()`
 * lieferte den Raum-Zustand mit seinem GESPEICHERTEN `updatedAt` aus, also Minuten alt. Gemessen
 * bei 4 Minuten Ausfall: Versatz -240.000 ms, und weil `stepStartedAt` denselben alten Wert trug,
 * hob der Fehler die Veraltung des Schrittbeginns exakt auf — `resolveArenaDisplayState` meldete
 * `isStepSettled: false` fuer eine vier Minuten alte Etappe. `resumeRoomArenaAfterRestart`
 * (`lib/room/arena-sync-state.ts`) setzt `updatedAt` beim Wiederanlauf deshalb neu, damit der
 * Anker wieder frisch ist. KEINE zweite Zeitquelle hier — die Bedingung wird an der Stelle
 * hergestellt, an der der Zeitstempel entsteht, nicht hier nachtraeglich geraten.
 */
export function computeArenaClockOffsetMs(serverTimeIso: string, clientNowMs: number): number {
  const serverMs = Date.parse(serverTimeIso);
  if (!Number.isFinite(serverMs)) {
    return 0;
  }
  return serverMs - clientNowMs;
}

/** Client-Zeit + eigener Versatz = geschaetzte Server-Zeit — die Basis fuer `resolveArenaDisplayState`. */
export function estimateServerNowMs(clientNowMs: number, clockOffsetMs: number): number {
  return clientNowMs + clockOffsetMs;
}

/**
 * Die geplante Dauer eines Arena-Schritts (Etappen-Gleiten). 10 Sekunden ist keine neu erfundene
 * Zahl — es ist der bereits gewaehlte, produktiv laufende Wert `TRACK_ROUND_MS` aus
 * `DisciplineStageNativeArena.tsx` (dort seit der ersten Fassung der Reveal-Kaskade). Die
 * Komponente importiert diese Konstante und exportiert sie unter ihrem alten Namen weiter, damit
 * es dafuer nur EINE Quelle gibt (Hausregel "keine zweite Quelle"), statt zwei Stellen, die
 * zufaellig denselben Wert tragen.
 */
export const ARENA_STEP_DURATION_MS = 10_000;

/** Was der Raum-Zustand ueber den AKTUELLEN Schritt weiss (Ausschnitt aus `RoomArenaState`). */
export type ArenaStepSnapshot = {
  stepIndex: number;
  /** Server-Zeit (ISO), zu der dieser Schritt begann. */
  stepStartedAt: string;
  /** Geplante Dauer dieses Schritts in ms. */
  stepDurationMs: number;
  /** Pausiert der Host gerade? Eingefroren heisst: die verstrichene Zeit waechst nicht weiter. */
  paused: boolean;
};

export type ArenaDisplayState = {
  /** Welcher Schritt angezeigt wird — identisch mit `step.stepIndex`, nur der Vollstaendigkeit halber hier. */
  stepIndex: number;
  /** Seit Schrittbeginn verstrichene Zeit, gekappt auf `[0, stepDurationMs]`. */
  elapsedMs: number;
  /** `elapsedMs / stepDurationMs`, im Bereich `[0, 1]`. */
  progress: number;
  /** `progress >= 1` — der Schritt ist eingeschwungen (Zielwerte erreicht, kein Gleiten mehr). */
  isStepSettled: boolean;
};

/**
 * DAS HERZSTUECK (Stufe 3.4): "welcher Anzeigezustand gilt bei Schritt N nach t Millisekunden?"
 *
 * Bewusst NICHT "wie viel Ausgangszeit ist auf MEINER lokalen `setTimeout`-Kette vergangen" —
 * sondern "wie viel Zeit ist seit dem SERVER-Zeitpunkt vergangen, zu dem dieser Schritt begann,
 * gemessen an meiner besten Schaetzung der Server-Zeit". Zwei Clients mit unterschiedlichem
 * Uhren-Versatz (`estimateServerNowMs`), aber demselben `step` (derselbe Raum-Zustand), errechnen
 * damit denselben `progress` — das ist die Eigenschaft, die `tests/arena-gemeinsame-zeitbasis.test.ts`
 * prueft.
 *
 * Pausiert (`step.paused`), friert `elapsedMs` auf dem Wert ein, den es beim letzten Aufruf VOR
 * der Pause hatte, NICHT auf 0 — dafuer uebergibt der Aufrufer `frozenElapsedMs` (siehe
 * `use-arena-room-sync.ts`: dort wird der Wert beim Umschalten auf `paused` gemerkt). Ohne
 * `frozenElapsedMs` (z.B. beim allerersten Aufruf) gilt 0 als Startwert.
 */
export function resolveArenaDisplayState(input: {
  step: ArenaStepSnapshot;
  /** Die eigene Schaetzung der aktuellen Server-Zeit (`estimateServerNowMs(...)`), NICHT `Date.now()` direkt. */
  serverNowMs: number;
  /** Verstrichene Zeit im Moment des Pausierens (falls `step.paused`); sonst wird 0 angenommen. */
  frozenElapsedMs?: number;
}): ArenaDisplayState {
  const startMs = Date.parse(input.step.stepStartedAt);
  const durationMs = Math.max(0, input.step.stepDurationMs);
  if (!Number.isFinite(startMs) || durationMs === 0) {
    return { stepIndex: input.step.stepIndex, elapsedMs: 0, progress: durationMs === 0 ? 1 : 0, isStepSettled: true };
  }
  const rawElapsed = input.step.paused
    ? Math.max(0, input.frozenElapsedMs ?? 0)
    : Math.max(0, input.serverNowMs - startMs);
  const elapsedMs = Math.min(durationMs, rawElapsed);
  const progress = elapsedMs / durationMs;
  return {
    stepIndex: input.step.stepIndex,
    elapsedMs,
    progress,
    isStepSettled: progress >= 1,
  };
}

/**
 * NACHHOLEN DURCH UEBERSPRINGEN, NICHT DURCH NACHSPIELEN (Stufe 3.4, Antwort auf Befund-Punkt 4).
 *
 * "hold": lokal laeuft gerade eine Kaskade fuer den aktuellen Schritt (busy) — nichts tun, bis sie
 *   fertig ist (sonst ueberholen sich zwei Kaskaden).
 * "in-sync": lokaler und Ziel-Schritt sind identisch — nichts zu tun.
 * "advance-one": das Ziel ist GENAU einen Schritt weiter als der lokale Stand — der normale Fall
 *   waehrend ein Gast live mitschaut. Hier lohnt sich die volle Reveal-Kaskade (Sounds, Highlights,
 *   Gleiten) — sie IST der naechste Schritt, kein Rueckstand.
 * "jump": alles andere — mehr als ein Schritt Rueckstand (Gast war kurz weg), Spaet-Einstieg
 *   (lokaler Stand 0, Ziel laengst weiter) ODER ein RUECKWAERTS-Sprung (Host hat "↻ Neu" gedrueckt,
 *   Ziel liegt VOR dem lokalen Stand). In allen drei Faellen waere Nachspielen jeder
 *   Zwischenetappe nur ein Rennen, das der Gast nie gewinnt (der Host laeuft ja weiter) — der
 *   Aufrufer baut den Zielzustand stattdessen DIREKT auf (siehe `jumpToRound` in
 *   `DisciplineStageNativeArena.tsx`).
 */
export type ArenaCatchUpMode = "hold" | "in-sync" | "advance-one" | "jump";

export function resolveArenaCatchUpMode(input: {
  localStepIndex: number;
  targetStepIndex: number;
  /** Laeuft gerade eine lokale Reveal-Kaskade (Aequivalent zu `busyRef.current` in der Komponente)? */
  localCascadeRunning: boolean;
  /**
   * BEFUND A1 (docs/MULTIPLAYER_VOLLAUSBAU_PLAN.md): DIE Stelle, an der die gemeinsame Zeitbasis
   * tatsaechlich etwas ENTSCHEIDET, statt nur transportiert zu werden. Optional/wirkungslos ohne
   * diesen Parameter — jeder bestehende Aufrufer/Test, der den Modus rein ueber die Schrittdifferenz
   * bestimmt, verhaelt sich unveraendert.
   *
   * Der Normalfall bei `delta === 1` ist "advance-one": die volle lokale Reveal-Kaskade abspielen
   * (Sounds/Highlights/Gleiten), weil sie der naechste echte Schritt ist. Das gilt aber nur, WENN
   * dieser Schritt laut Server-Uhr gerade erst begonnen hat. Kam die Host-Meldung so spaet an (Tab
   * im Hintergrund gedrosselt, Reconnect, hohe Latenz), dass der Schritt laut
   * `resolveArenaDisplayState` beim Gast schon EINGESCHWUNGEN ist (`isStepSettled`), waere eine
   * frische ~10s-Kaskade eine VERSPAETETE Wiederholung eines Moments, den der Server laengst hinter
   * sich hat — der Gast wuerde dadurch nicht aufholen, sondern (weil jede Kaskade selbst wieder die
   * volle Schrittdauer braucht) IMMER WEITER zurueckfallen. In diesem Fall gilt "jump" statt
   * "advance-one": der Zielzustand wird direkt aufgebaut (`jumpToRound`), keine stale Kaskade.
   */
  targetStepClock?: { step: ArenaStepSnapshot; serverNowMs: number };
}): ArenaCatchUpMode {
  if (input.localCascadeRunning) {
    return "hold";
  }
  const delta = input.targetStepIndex - input.localStepIndex;
  if (delta === 0) {
    return "in-sync";
  }
  if (delta === 1) {
    if (input.targetStepClock && resolveArenaDisplayState(input.targetStepClock).isStepSettled) {
      return "jump";
    }
    return "advance-one";
  }
  return "jump";
}

/**
 * PAUSE ALS GEMEINSAMER ZUSTAND (Stufe 3.6): "pausiert der Host, pausiert es bei beiden."
 *
 * Solo (kein Raum aktiv): reiner Lokalzustand — unveraendert gegenueber vorher (Punkt 5 der
 * Aufgabe, "Solo darf sich in nichts aendern").
 *
 * Host: seine eigene Pause-Absicht IST die Raum-Wahrheit — er meldet sie ans Zimmer
 * (`onHostPauseToggle`), diese Funktion spiegelt das nur zurueck.
 *
 * Gast: folgt IMMER dem Host-Feld aus dem Raum-Zustand, NIE dem eigenen Tastendruck. Ein Gast, der
 * lokal pausiert, waehrend der Host weiterlaeuft, saehe eine Anzeige, die von der des Hosts
 * abweicht — genau die Aufspaltung, die Stufe 3.6 schliessen soll. Deshalb hat der Gast gar keine
 * eigene Pause-Autoritaet, nur der Host.
 *
 * EINE PAUSE OHNE URHEBER BINDET AUCH DEN HOST (Befund F8, Aufgabe #45). Die Host-Regel oben
 * unterstellt, dass die Pause des Raums SEINE ist — dass `roomPaused` also nur zeigt, was er selbst
 * gemeldet hat. Nach einem Server-Neustart stimmt das nicht mehr: `resumeRoomArenaAfterRestart`
 * (`lib/room/arena-sync-state.ts`) haelt die Enthuellung an, ohne dass irgendein Mensch etwas
 * gedrueckt hat. Der Host haette dann die Vorgabe `localPauseIntent: false` und liefe weiter,
 * waehrend der Gast dem Raum-Feld folgt und einfriert — nachgemessen aus DEMSELBEN Raum-Zustand:
 * Host `false`, Gast `true`. Genau die Aufspaltung, die es nicht geben darf.
 *
 * `roomPausedBy` traegt die Unterscheidung schon (`RoomArenaState.pausedBy`: "wer zuletzt pausiert
 * hat"), es braucht dafuer kein zweites Feld. Wichtig ist der Unterschied zwischen den beiden
 * leeren Werten, und er ist bewusst so getippt:
 *   - `null`      = "pausiert, aber von keinem Menschen" → bindet JEDEN, auch den Host.
 *   - `undefined` = der Aufrufer liefert das Feld gar nicht → unveraendertes Verhalten von vorher.
 * Ein Aufrufer, der `pausedBy` nicht kennt, aendert sein Verhalten also in keinem Fall.
 */
export function resolveArenaEffectivePause(input: {
  roomActive: boolean;
  isHost: boolean;
  roomPaused: boolean;
  localPauseIntent: boolean;
  /** `RoomArenaState.pausedBy` — siehe Erklaerung oben zu `null` vs. `undefined`. */
  roomPausedBy?: string | null;
}): boolean {
  if (!input.roomActive) {
    return input.localPauseIntent;
  }
  if (input.roomPaused && input.roomPausedBy === null) {
    return true;
  }
  if (input.isHost) {
    return input.localPauseIntent;
  }
  return input.roomPaused;
}

/**
 * WARUM `prefers-reduced-motion` LOKAL BLEIBT (Stufe 3.6, Barrierefreiheit):
 *
 * Reduced-Motion ist eine Einstellung des EINZELNEN Geraets/Nutzers (Betriebssystem-Praeferenz),
 * keine Spielregel — ein Gast mit Vestibularstoerung darf die Animationsdauer auf 0 setzen, ohne
 * dass der Host (der sie sehen will) seine Animationen mit-verliert, und umgekehrt.
 *
 * Das GEHT, ohne den Gleichlauf zu brechen, WEIL dieser jetzt ueber den SCHRITT laeuft
 * (`stepIndex`/`ArenaCatchUpMode`), nicht ueber die Animationsdauer: `resolveArenaCatchUpMode`
 * fragt nur, welcher Schritt gilt, nie, wie lange eine Animation dauert. Ein Client mit
 * Reduced-Motion zeigt denselben Schritt-Inhalt wie einer ohne — nur ohne das Gleiten dorthin. Vor
 * Stufe 3.2 war das nicht so: der Gleichlauf lief ueber `setTimeout`-Ketten, deren Dauer
 * Reduced-Motion auf 0 setzte (`later()` in der Komponente) — DORT haette ein Reduced-Motion-Client
 * den Takt des ganzen Raums verzerrt, weil die Dauer selbst Teil des geteilten Zustands war.
 */
