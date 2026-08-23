import { getLiveRoomSaveIds } from "@/lib/room/live-room-save-registry";

/**
 * DER RIEGEL GEGEN GLEICHZEITIGES SCHREIBEN IM KOOP (Befund F3, Aufgabe #46).
 *
 * DAS PROBLEM, gemessen in tests/koop-gleichzeitiges-schreiben.test.ts: jeder Koop-Schreibpfad
 * liest den Spielstand, aendert eine Kleinigkeit und schreibt ihn KOMPLETT zurueck. Zwischen Lesen
 * und Schreiben steht ein `await` (`resolveAuthoritativeWriteOwnerId`), das die Event-Loop
 * freigibt — genau dort rutscht die Anfrage des anderen Coaches dazwischen. Chris und Franky
 * spielen denselben Spielstand; gleichzeitig klicken ist der Normalfall.
 *
 * WARUM ES BISHER NIEMANDEM AUFFIEL: `saveSingleplayerState` erhoeht die Version von der
 * GESPEICHERTEN (`withNextSaveVersion(gameState, existing?.gameState.saveVersion)`). Der zweite
 * Schreiber kollidiert deshalb NIE — er zaehlt weiter und legt seinen kompletten, veralteten Stand
 * darueber. Kein Fehler, keine Warnung, die Aenderung des anderen ist einfach fort.
 *
 * WARUM DIE PRUEFUNG HIER STEHT UND NICHT IN DEN ROUTEN: rund 30 Routen schreiben im Raum. Die
 * einzeln umzustellen waere 30-mal dieselbe Regel — und die 31. Route, die jemand naechste Woche
 * baut, haette sie wieder nicht. `saveSingleplayerState` ist die EINE Stelle, an der jeder dieser
 * Schreibvorgaenge vorbeikommt.
 *
 * WORAN "VERALTET" ERKANNT WIRD, ohne dass ein Aufrufer etwas mitschicken muss: der Spielstand
 * TRAEGT seine Version selbst (`gameState.saveVersion`) — es ist die Version, die der Schreibende
 * gelesen hat. Liegt sie unter der gespeicherten, hat in der Zwischenzeit jemand anders
 * geschrieben. Kein neuer Parameter, keine 30 Aufrufstellen, keine zweite Quelle fuer "welchen
 * Stand kenne ich".
 *
 * NUR IM RAUM, und das ist keine Bequemlichkeit: ausserhalb eines Raums schreibt genau EINE
 * Person. Dort gaebe es nichts zu schuetzen, aber sehr wohl etwas kaputtzumachen — jeder
 * Alt-Pfad, jede Migration, jede Wiederherstellung muesste ploetzlich Versionen mitfuehren. Die
 * Bindung kommt aus `getLiveRoomSaveIds()`, derselben Registry, die schon die rollierende
 * Aufbewahrung benutzt (lib/persistence/save-retention.ts) — keine neue Abhaengigkeit von
 * Persistenz auf Raum-Innereien.
 */
export const KOOP_SCHREIBKONFLIKT_CODE = "stale_save_version";

export class KoopSchreibkonfliktError extends Error {
  readonly code = KOOP_SCHREIBKONFLIKT_CODE;
  readonly saveId: string;
  readonly geleseneVersion: number;
  readonly gespeicherteVersion: number;

  constructor(input: { saveId: string; geleseneVersion: number; gespeicherteVersion: number }) {
    super(
      `${KOOP_SCHREIBKONFLIKT_CODE}: Der Spielstand ${input.saveId} wurde inzwischen von deinem Mitspieler ` +
        `geaendert (gelesen: Version ${input.geleseneVersion}, gespeichert: Version ${input.gespeicherteVersion}). ` +
        `Dein Schreibvorgang wurde NICHT ausgefuehrt — bitte neu laden und die Aktion wiederholen.`,
    );
    this.name = "KoopSchreibkonfliktError";
    this.saveId = input.saveId;
    this.geleseneVersion = input.geleseneVersion;
    this.gespeicherteVersion = input.gespeicherteVersion;
  }
}

export function istKoopSchreibkonflikt(error: unknown): error is KoopSchreibkonfliktError {
  return error instanceof KoopSchreibkonfliktError;
}

/**
 * Wirft, wenn ein raumgebundener Spielstand auf einem ueberholten Stand ueberschrieben wuerde.
 *
 * ABSICHTLICH EINE AUSNAHME und kein stilles Auslassen: ein uebersprungener Schreibvorgang saehe
 * fuer den Spieler genauso aus wie der Datenverlust, den diese Pruefung verhindern soll — er
 * klickt, es passiert scheinbar etwas, und seine Aenderung ist trotzdem nicht da. Wer schreibt,
 * muss erfahren, dass er nicht geschrieben hat.
 *
 * FEHLENDE ANGABEN SIND KEIN KONFLIKT. Traegt der eingehende Stand keine Version (Migration,
 * Wiederherstellung aus einer Sicherung, aelterer Aufrufer), laesst sich nichts feststellen — und
 * "nichts feststellbar" darf nicht "abweisen" heissen. Dasselbe, wenn der Spielstand noch gar nicht
 * existiert.
 */
export function assertKeinVeralteterKoopSchreibvorgang(input: {
  saveId: string;
  geleseneVersion: number | null | undefined;
  gespeicherteVersion: number | null | undefined;
}): void {
  const { saveId, geleseneVersion, gespeicherteVersion } = input;
  if (!Number.isFinite(geleseneVersion) || !Number.isFinite(gespeicherteVersion)) {
    return;
  }
  if ((geleseneVersion as number) >= (gespeicherteVersion as number)) {
    return;
  }
  if (!getLiveRoomSaveIds().includes(saveId)) {
    return;
  }
  throw new KoopSchreibkonfliktError({
    saveId,
    geleseneVersion: geleseneVersion as number,
    gespeicherteVersion: gespeicherteVersion as number,
  });
}
