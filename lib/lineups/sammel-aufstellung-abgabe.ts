import { uebersetzeLineupFehler } from "@/lib/lineups/lineup-fehlertexte";
import { formatRoomWriteErrorCode } from "@/lib/room/parse-room-write-context";

/**
 * SAMMEL-ABGABE MEHRERER AUFSTELLUNGEN — die Auswertung (Befund F14, Aufgabe #43).
 *
 * DER BEFUND WAR NICHT "es fehlt eine Route", SONDERN "die Route hat keinen Aufrufer":
 * `PUT /api/lineups/legacy/batch` ist gebaut, geprueft und gemessen — benutzt hat sie bis eben nur
 * `scripts/smoke-multiplayer-e2e.ts`. Der menschliche Weg ging weiter ueber die Einzelroute, Team
 * fuer Team. Wer vier Teams fuehrt, klickte also viermal durch dieselbe Bestaetigung.
 *
 * WARUM DIESE AUSWERTUNG EIN EIGENES MODUL IST: die Sammelroute kann TEILWEISE gelingen — das ist
 * ihr ganzer Sinn (ein Kaderproblem in einem Team blockiert die anderen nicht mehr). Genau daraus
 * entsteht die Gefahr, vor der die Hausregel warnt: eine Oberflaeche, die "gespeichert" meldet,
 * obwohl eines von vier Teams abgelehnt wurde. Die Zusammenfassung muss deshalb IMMER beide Zahlen
 * nennen und jedes abgelehnte Team samt Grund benennen — und das laesst sich hier ohne React
 * pruefen.
 *
 * KEINE ZWEITE FEHLERTABELLE: die Gruende laufen durch `uebersetzeLineupFehler` (kennt die
 * Aufstellungs-Codes) und danach durch `formatRoomWriteErrorCode` (kennt die Guard-Codes). Beide
 * reichen Unbekanntes unveraendert durch, deshalb ist die Verkettung gefahrlos und es bleibt bei
 * genau einer Quelle je Code.
 */

export type SammelAbgabeTeamErgebnis = {
  teamId: string;
  ok: boolean;
  errors?: string[];
  warnings?: string[];
};

export type SammelAbgabeAntwort = {
  results?: SammelAbgabeTeamErgebnis[];
  savedCount?: number;
  warnings?: string[];
  error?: string;
};

export type SammelAbgabeZusammenfassung = {
  /** Wie viele Teams wurden ueberhaupt losgeschickt — der Nenner jeder Aussage. */
  angefragt: number;
  gespeicherteTeamIds: string[];
  abgelehnt: Array<{ teamId: string; grund: string }>;
  /** Ein Satz fuer die Anzeige, der nie mehr behauptet, als wirklich geschrieben wurde. */
  satz: string;
  tonfall: "erfolg" | "achtung" | "fehler";
};

/** Ein Grund, lesbar gemacht — erst die Aufstellungs-Tabelle, dann die Raum-Tabelle. */
export function uebersetzeSammelGrund(code: string | null | undefined): string | null {
  if (typeof code !== "string" || code.trim().length === 0) {
    return null;
  }
  return formatRoomWriteErrorCode(uebersetzeLineupFehler(code.trim()));
}

const KEIN_GRUND_GENANNT = "Die Route hat keinen Grund genannt.";

/**
 * Fasst die Antwort der Sammelroute so zusammen, dass die Anzeige nichts beschoenigen kann.
 *
 * `nameFuerTeam` ist absichtlich hereingereicht statt hier aufgeloest: dieses Modul soll ohne
 * GameState pruefbar bleiben. Fehlt ein Name, steht die Team-ID da — sichtbar unschoen, aber
 * ehrlich, und besser als ein weggelassenes Team.
 */
export function fasseSammelAbgabeZusammen(input: {
  angefragteTeamIds: readonly string[];
  antwort: SammelAbgabeAntwort | null | undefined;
  nameFuerTeam?: (teamId: string) => string | null | undefined;
}): SammelAbgabeZusammenfassung {
  const angefragt = input.angefragteTeamIds.length;
  const zeige = (teamId: string) => {
    const name = input.nameFuerTeam?.(teamId);
    return name && name.trim().length > 0 ? name.trim() : teamId;
  };

  // "Bei 0 wird erklaert, nicht versteckt": ein leerer Stapel ist kein Erfolg und kein Fehler,
  // sondern eine Lage, die der Spieler verstehen soll.
  if (angefragt === 0) {
    return {
      angefragt: 0,
      gespeicherteTeamIds: [],
      abgelehnt: [],
      satz: "Keine Aufstellung zum Abgeben: es ist gerade kein Team von dir dran.",
      tonfall: "achtung",
    };
  }

  const ergebnisse = input.antwort?.results ?? [];

  // Die Route kann VOR der Team-Schleife ablehnen (fehlender Raum-Kontext, gesperrte Phase,
  // Spielstand weg). Dann steht in `results` nichts, und ohne diesen Zweig meldete die Anzeige
  // "0 von 4 gespeichert" ohne einen einzigen Grund — technisch wahr, praktisch nutzlos.
  if (ergebnisse.length === 0) {
    const grund = uebersetzeSammelGrund(input.antwort?.error) ?? KEIN_GRUND_GENANNT;
    return {
      angefragt,
      gespeicherteTeamIds: [],
      abgelehnt: input.angefragteTeamIds.map((teamId) => ({ teamId, grund })),
      satz: `Keine der ${angefragt} Aufstellungen wurde gespeichert: ${grund}`,
      tonfall: "fehler",
    };
  }

  const gespeicherteTeamIds = ergebnisse.filter((entry) => entry.ok).map((entry) => entry.teamId);
  const abgelehnt = ergebnisse
    .filter((entry) => !entry.ok)
    .map((entry) => ({
      teamId: entry.teamId,
      grund: uebersetzeSammelGrund(entry.errors?.[0]) ?? KEIN_GRUND_GENANNT,
    }));

  /**
   * Ein angefragtes Team, zu dem GAR KEIN Ergebnis zurueckkam, faellt sonst zwischen die Stuehle:
   * es taucht weder unter "gespeichert" noch unter "abgelehnt" auf, und die Summe stimmt nicht
   * mehr mit dem ueberein, was der Spieler abgeschickt hat. Passiert heute nicht — aber genau das
   * ist die Sorte stiller Verlust, um die es in dieser Aufgabe geht.
   */
  const genannt = new Set(ergebnisse.map((entry) => entry.teamId));
  for (const teamId of input.angefragteTeamIds) {
    if (!genannt.has(teamId)) {
      abgelehnt.push({ teamId, grund: "Die Route hat zu diesem Team gar nicht geantwortet." });
    }
  }

  const abgelehnteSaetze = abgelehnt.map((eintrag) => `${zeige(eintrag.teamId)} abgelehnt: ${eintrag.grund}`);

  if (abgelehnt.length === 0) {
    return {
      angefragt,
      gespeicherteTeamIds,
      abgelehnt,
      satz:
        angefragt === 1
          ? `Aufstellung für ${zeige(gespeicherteTeamIds[0] ?? input.angefragteTeamIds[0]!)} abgegeben.`
          : `Alle ${angefragt} Aufstellungen abgegeben.`,
      tonfall: "erfolg",
    };
  }

  if (gespeicherteTeamIds.length === 0) {
    return {
      angefragt,
      gespeicherteTeamIds,
      abgelehnt,
      satz: `Keine der ${angefragt} Aufstellungen wurde gespeichert. ${abgelehnteSaetze.join(" · ")}`,
      tonfall: "fehler",
    };
  }

  return {
    angefragt,
    gespeicherteTeamIds,
    abgelehnt,
    satz: `${gespeicherteTeamIds.length} von ${angefragt} Aufstellungen abgegeben. ${abgelehnteSaetze.join(" · ")}`,
    tonfall: "achtung",
  };
}
