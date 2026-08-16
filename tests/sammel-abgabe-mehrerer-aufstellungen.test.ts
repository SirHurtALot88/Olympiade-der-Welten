/**
 * SAMMEL-ABGABE MEHRERER AUFSTELLUNGEN (Befund F14, Aufgabe #43).
 *
 * DER BEFUND WAR NICHT "es fehlt eine Route": `PUT /api/lineups/legacy/batch` ist seit Stufe 2.1
 * gebaut, geprueft (`tests/aufstellungen-fuer-mehrere-teams.test.ts`) und gemessen — sie hatte nur
 * keinen menschlichen Aufrufer. Der Weg fuer Menschen ging weiter Team fuer Team ueber die
 * Einzelroute. Etwas Gebautes, das niemand ruft, ist genau so viel wert wie etwas Fehlendes.
 *
 * Zwei Eigenschaften werden hier gehalten:
 *
 * 1. DIE ROUTE HAT EINEN AUFRUFER IN DER OBERFLAECHE. Das ist der Befund selbst; sonst nichts.
 *
 * 2. DIE ZUSAMMENFASSUNG BESCHOENIGT NICHTS. Die Sammelroute kann TEILWEISE gelingen — das ist ihr
 *    Sinn (ein Kaderproblem in einem Team blockiert die anderen nicht mehr). Genau daraus entsteht
 *    die Gefahr: eine Anzeige, die "gespeichert" meldet, obwohl eines von vier Teams abgelehnt
 *    wurde. Jede Pruefung unten haengt an einer Lage, in der das Beschoenigen naheliegt.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { fasseSammelAbgabeZusammen, uebersetzeSammelGrund } from "@/lib/lineups/sammel-aufstellung-abgabe";

const NAMEN: Record<string, string> = { "P-S": "Pixel Sharks", "M-M": "Meteor Movers", "M-S": "Magma Stalkers" };
const nameFuerTeam = (teamId: string) => NAMEN[teamId] ?? null;

describe("Die Sammelroute hat einen Aufrufer in der Oberflaeche (F14)", () => {
  it("die Einsatzliste ruft PUT /api/lineups/legacy/batch wirklich auf", () => {
    const quelltext = readFileSync(
      resolve(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    expect(quelltext, "genau das war der Befund: die Route existierte ohne Aufrufer").toContain(
      "/api/lineups/legacy/batch?",
    );
    // Der 409-Weg der Route ist die EINE Sperr-Bestaetigung fuer den ganzen Stapel (Stufe 2.5).
    // Wer ihn uebergeht und gleich `confirmLock: true` schickt, nagelt Aufstellungen ohne Rueckfrage
    // fest — das darf nicht unbemerkt passieren.
    expect(quelltext).toContain("lineup_lock_confirmation_required");
  });

  it("die Rueckfrage nennt je Team, WAS festgenagelt wird — und zaehlt aus der Antwort der Route", () => {
    const quelltext = readFileSync(
      resolve(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    // Der Einzelweg zeigt "Formkarte(n) gesetzt · Kapitän gesetzt" bzw. "WEDER … NOCH …". Der
    // Sammel-Dialog nagelt MEHR fest und darf deshalb nicht die schwaechere Rueckfrage sein.
    expect(quelltext).toContain("WEDER Formkarte NOCH Kapitän");
    // Und die Liste kommt aus `commitments` — dort legt die Route genau die Teams ab, die sie auch
    // schreiben wird. Ueber den lokalen Stapel zu zaehlen kuendigte Teams als "wird festgelegt" an,
    // die gleich abgelehnt werden.
    expect(quelltext).toContain("payload.commitments ?? []");
  });

  it("der Einzelweg bleibt bestehen — die Sammel-Abgabe ersetzt ihn nicht", () => {
    const quelltext = readFileSync(
      resolve(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    expect(quelltext, "wer selbst aufstellt, braucht den Einzelweg weiterhin").toContain("/api/lineups/legacy?");
  });
});

describe("Die Zusammenfassung der Sammel-Abgabe beschoenigt nichts (F14)", () => {
  it("nennt bei Teilerfolg BEIDE Zahlen und jedes abgelehnte Team samt Grund", () => {
    const zusammenfassung = fasseSammelAbgabeZusammen({
      angefragteTeamIds: ["P-S", "M-M", "M-S"],
      antwort: {
        savedCount: 2,
        results: [
          { teamId: "P-S", ok: true },
          { teamId: "M-M", ok: true },
          { teamId: "M-S", ok: false, errors: ["host_only_action"] },
        ],
      },
      nameFuerTeam,
    });

    expect(zusammenfassung.tonfall, "ein Teilerfolg ist kein Erfolg").toBe("achtung");
    expect(zusammenfassung.satz).toContain("2 von 3");
    expect(zusammenfassung.satz, "das abgelehnte Team muss mit Namen dastehen").toContain("Magma Stalkers");
    expect(zusammenfassung.satz, "und mit seinem Grund, uebersetzt").toContain("Nur der Host");
    expect(zusammenfassung.satz).not.toMatch(/host_only_action/);
    expect(zusammenfassung.gespeicherteTeamIds).toEqual(["P-S", "M-M"]);
  });

  it("uebersetzt sowohl Aufstellungs- als auch Raum-Codes — ohne zweite Tabelle", () => {
    // Die beiden Tabellen decken verschiedene Codes ab und reichen Unbekanntes durch; deshalb
    // laesst sich die eine hinter die andere haengen, statt Saetze ein drittes Mal abzuschreiben.
    expect(uebersetzeSammelGrund("lineup_draft_is_locked")).toMatch(/festgenagelt/);
    expect(uebersetzeSammelGrund("host_only_action")).toMatch(/Host/);
    expect(uebersetzeSammelGrund("ein ganz neuer code")).toBe("ein ganz neuer code");
    expect(uebersetzeSammelGrund(null)).toBeNull();
  });

  it("meldet einen vollstaendigen Fehlschlag als Fehlschlag, nicht als '0 gespeichert'", () => {
    const zusammenfassung = fasseSammelAbgabeZusammen({
      angefragteTeamIds: ["P-S", "M-M"],
      antwort: {
        savedCount: 0,
        results: [
          { teamId: "P-S", ok: false, errors: ["lineup_not_operationally_ready"] },
          { teamId: "M-M", ok: false, errors: ["lineup_draft_is_locked"] },
        ],
      },
      nameFuerTeam,
    });

    expect(zusammenfassung.tonfall).toBe("fehler");
    expect(zusammenfassung.gespeicherteTeamIds).toEqual([]);
    expect(zusammenfassung.abgelehnt).toHaveLength(2);
    expect(zusammenfassung.satz).toContain("Pixel Sharks");
    expect(zusammenfassung.satz).toContain("Meteor Movers");
  });

  it("nennt den Grund auch dann, wenn die Route VOR der Team-Schleife ablehnt", () => {
    // Fehlender Raum-Kontext, gesperrte Phase, Spielstand weg: dann steht in `results` nichts.
    // Ohne diesen Zweig kaeme "0 von 2 gespeichert" ohne einen einzigen Grund heraus — technisch
    // wahr, praktisch nutzlos.
    const zusammenfassung = fasseSammelAbgabeZusammen({
      angefragteTeamIds: ["P-S", "M-M"],
      antwort: { error: "room_context_required_for_room_save" },
      nameFuerTeam,
    });

    expect(zusammenfassung.tonfall).toBe("fehler");
    expect(zusammenfassung.satz).toMatch(/Raum-Kontext fehlt/);
    expect(zusammenfassung.abgelehnt.map((eintrag) => eintrag.teamId)).toEqual(["P-S", "M-M"]);
  });

  it("laesst ein angefragtes Team nicht zwischen die Stuehle fallen", () => {
    // Ein Team, zu dem GAR KEIN Ergebnis zurueckkommt, taucht sonst weder unter "gespeichert" noch
    // unter "abgelehnt" auf, und die Summe passt nicht mehr zu dem, was abgeschickt wurde. Genau
    // diese Sorte stiller Verlust ist der Kern dieser Aufgabe.
    const zusammenfassung = fasseSammelAbgabeZusammen({
      angefragteTeamIds: ["P-S", "M-M"],
      antwort: { savedCount: 1, results: [{ teamId: "P-S", ok: true }] },
      nameFuerTeam,
    });

    expect(zusammenfassung.gespeicherteTeamIds).toEqual(["P-S"]);
    expect(zusammenfassung.abgelehnt.map((eintrag) => eintrag.teamId)).toEqual(["M-M"]);
    expect(zusammenfassung.satz).toContain("1 von 2");
  });

  it("GEGENPROBE: laeuft alles durch, steht da auch nur das — ohne angehaengtes Kleingedrucktes", () => {
    const zusammenfassung = fasseSammelAbgabeZusammen({
      angefragteTeamIds: ["P-S", "M-M"],
      antwort: {
        savedCount: 2,
        results: [
          { teamId: "P-S", ok: true },
          { teamId: "M-M", ok: true },
        ],
      },
      nameFuerTeam,
    });

    expect(zusammenfassung.tonfall).toBe("erfolg");
    expect(zusammenfassung.satz).toBe("Alle 2 Aufstellungen abgegeben.");
    expect(zusammenfassung.abgelehnt).toEqual([]);
  });

  it("GEGENPROBE: bei 0 offenen Teams wird erklaert, nicht stumm nichts getan", () => {
    const zusammenfassung = fasseSammelAbgabeZusammen({ angefragteTeamIds: [], antwort: null, nameFuerTeam });

    expect(zusammenfassung.tonfall).toBe("achtung");
    expect(zusammenfassung.satz).toMatch(/kein Team/);
    expect(zusammenfassung.angefragt).toBe(0);
  });

  it("GEGENPROBE: ohne Namen steht die Team-ID da — sichtbar unschoen, aber kein weggelassenes Team", () => {
    const zusammenfassung = fasseSammelAbgabeZusammen({
      angefragteTeamIds: ["X-Y"],
      antwort: { savedCount: 0, results: [{ teamId: "X-Y", ok: false, errors: ["forbidden_team_control"] }] },
    });

    expect(zusammenfassung.satz).toContain("X-Y");
  });
});
