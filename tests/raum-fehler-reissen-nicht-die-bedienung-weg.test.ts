/**
 * NICHT JEDER RAUM-FEHLER IST EIN SITZUNGSFEHLER (Befund F6/F9, Aufgabe #44).
 *
 * Zwei Eigenschaften, die im Spiel unmittelbar spuerbar sind:
 *
 * F6 — der Foundation-Client behandelte JEDEN `roomError` gleich: Bedienleiste leeren und
 * "Room-Session abgelaufen" melden. Auch bei einer harmlosen Fach-Ablehnung (Doppelklick auf
 * "Weiter", eine Aktion, die gerade dem Host gehoert). Der Spieler verlor also fuer einen
 * Bedienfehler seine ganze Bedienung — und las dazu etwas Falsches.
 *
 * F9 — der Spieler las rohe Codes wie `participant_offline` oder `host_only_action`. Die
 * Uebersetzungstabelle gab es laengst, benutzt hat sie nur der Transfermarkt.
 *
 * Beides wird hier an der EIGENSCHAFT gemessen, nicht an der Bauweise.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { formatCockpitReason } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import { lookupRoomWriteErrorMessage } from "@/lib/room/parse-room-write-context";
import {
  GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG,
  RAUM_EXISTIERT_NICHT_MEHR_MELDUNG,
  RAUM_NICHT_GEFUNDEN_MELDUNG,
  RAUM_VOLL_MELDUNG,
  SITZPLATZ_UNGUELTIG_MELDUNG,
  istRoomSitzungsFehler,
} from "@/lib/room/room-session-fehler";
import { formatRoomWriteErrorCode, formatMarketPreviewError } from "@/lib/room/parse-room-write-context";
import { createRoom, joinRoom, rejoinRoom, resetRuntimeRoomsForTests, setParticipantReadyState } from "@/lib/room/room-store";

describe("Raum-Fehler reissen nicht die Bedienung weg (F6)", () => {
  it("erkennt genau die drei Faelle als Sitzungsfehler, in denen der Sitz wirklich nicht mehr gilt", () => {
    expect(istRoomSitzungsFehler(RAUM_EXISTIERT_NICHT_MEHR_MELDUNG)).toBe(true);
    expect(istRoomSitzungsFehler(GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG)).toBe(true);
    expect(istRoomSitzungsFehler(SITZPLATZ_UNGUELTIG_MELDUNG)).toBe(true);
  });

  it("GEGENPROBE: ein voller oder unbekannter Raum ist KEIN Sitzungsfehler — der eigene Sitz gilt ja weiter", () => {
    expect(istRoomSitzungsFehler(RAUM_VOLL_MELDUNG)).toBe(false);
    expect(istRoomSitzungsFehler(RAUM_NICHT_GEFUNDEN_MELDUNG)).toBe(false);
  });

  it("GEGENPROBE: eine gewoehnliche Fach-Ablehnung darf die Bedienleiste NICHT kosten", () => {
    // Der Fall aus dem Befund: Doppelklick, Aktion gehoert dem Host, Zuordnung gerade gesperrt.
    expect(istRoomSitzungsFehler("Nur der Host darf den Room starten.")).toBe(false);
    expect(
      istRoomSitzungsFehler("Team-Zuordnung ist gesperrt, solange ein Spieltag laeuft. Wechsle zwischen zwei Spieltagen."),
    ).toBe(false);
    expect(istRoomSitzungsFehler(null)).toBe(false);
    expect(istRoomSitzungsFehler("")).toBe(false);
  });

  it("die Texte stammen aus DERSELBEN Quelle, die der Server zurueckgibt", () => {
    // Die eigentliche Gefahr bei zwei Kopien: jemand formuliert eine Meldung um, und die Erkennung
    // im Client geht still kaputt — kein Typfehler, kein roter Test. Deshalb hier gegen die echten
    // Rueckgaben von `room-store.ts` gemessen, nicht gegen abgeschriebene Zeichenketten.
    resetRuntimeRoomsForTests();
    const created = createRoom("f6-a", { displayName: "Chris", saveId: "f6-save", preset: "chris_4_franky_4_rest_ai" });
    const roomCode = created.room.roomCode;

    const vollerRaum = (() => {
      joinRoom(roomCode, "f6-b", { displayName: "Franky" });
      return joinRoom(roomCode, "f6-c", { displayName: "Dritter" });
    })();
    expect(vollerRaum.ok).toBe(false);
    if (!vollerRaum.ok) {
      expect(vollerRaum.error).toBe(RAUM_VOLL_MELDUNG);
      expect(istRoomSitzungsFehler(vollerRaum.error), "voller Raum kostet keine Bedienung").toBe(false);
    }

    const unbekannterRaum = joinRoom("GIBT-ESNI", "f6-d", { displayName: "Niemand" });
    expect(unbekannterRaum.ok).toBe(false);
    if (!unbekannterRaum.ok) {
      expect(unbekannterRaum.error).toBe(RAUM_NICHT_GEFUNDEN_MELDUNG);
    }

    const falschesToken = rejoinRoom(roomCode, "ein-erfundenes-token", "f6-e");
    expect(falschesToken.ok).toBe(false);
    if (!falschesToken.ok) {
      expect(falschesToken.error).toBe(GESPEICHERTER_SITZPLATZ_UNGUELTIG_MELDUNG);
      expect(istRoomSitzungsFehler(falschesToken.error), "hier gilt der Sitz wirklich nicht mehr").toBe(true);
    }

    const fremderSitz = setParticipantReadyState(roomCode, "auch-erfunden", true);
    expect(fremderSitz.ok).toBe(false);
    if (!fremderSitz.ok) {
      expect(fremderSitz.error).toBe(SITZPLATZ_UNGUELTIG_MELDUNG);
    }
  });
});

describe("Rohe Fehlercodes werden uebersetzt (F9)", () => {
  it("macht aus den Codes, die der Spieler bisher woertlich las, deutsche Saetze", () => {
    for (const code of ["participant_offline", "host_only_action", "forbidden_team_control"]) {
      const satz = formatRoomWriteErrorCode(code);
      expect(satz, `${code} muss uebersetzt werden`).toBeTruthy();
      expect(satz, `${code} darf nicht roh durchgereicht werden`).not.toBe(code);
      expect(satz).not.toMatch(/_/);
    }
  });

  it("reicht einen bereits lesbaren Text unveraendert durch und liefert bei leer nichts", () => {
    const lesbar = "Weise zuerst dir mindestens ein Team zu.";
    expect(formatRoomWriteErrorCode(lesbar)).toBe(lesbar);
    expect(formatRoomWriteErrorCode(null)).toBeNull();
    expect(formatRoomWriteErrorCode("   ")).toBeNull();
  });

  it("der Transfermarkt behaelt seinen eigenen Ton, faellt sonst aber auf dieselbe Tabelle durch", () => {
    // Eine zweite VOLLTABELLE waere eine zweite Quelle fuer denselben Satz — es gibt nur
    // Ausnahmen fuer die Codes, bei denen der Kauf ausdruecklich benannt gehoert.
    expect(formatMarketPreviewError("room_not_found")).toMatch(/Kauf/);
    expect(
      formatMarketPreviewError("host_only_action"),
      "ohne eigene Ausnahme muss der kontextfreie Satz gelten",
    ).toBe(formatRoomWriteErrorCode("host_only_action"));
  });

  it("auch das Cockpit nennt die Guard-Codes beim Namen statt sie nur zu entstricheln", () => {
    // Der zweite, laenger uebersehene Weg: Gebaeude, Kredite und der Spieltags-Assistent zeigen
    // ihre Gruende ueber `formatCockpitReason`. Die Funktion kannte die Guard-Codes nicht und
    // fiel unten auf `reason.replaceAll("_", " ")` durch — im Panel stand dann „host only action".
    for (const code of ["host_only_action", "participant_offline", "forbidden_team_control", "not_room_participant"]) {
      const satz = formatCockpitReason(code);
      expect(satz, `${code} darf nicht als entstrichelter Code stehen bleiben`).toBe(lookupRoomWriteErrorMessage(code));
      expect(satz).not.toBe(code.replaceAll("_", " "));
    }
  });

  it("GEGENPROBE: wo das Cockpit einen eigenen, passenderen Satz hat, behaelt er den Vorrang", () => {
    // `local_team_not_owned_or_ai_controlled` und `save_not_found` stehen in BEIDEN Tabellen. Im
    // Gebaeude-Panel ist die gebaeudebezogene Fassung die bessere — deshalb wird die Raum-Tabelle
    // dort ERST ganz zum Schluss befragt. Diese Reihenfolge ist die eigentliche Entscheidung und
    // waere ohne Pruefung mit einer verschobenen Zeile still weg.
    expect(formatCockpitReason("local_team_not_owned_or_ai_controlled")).toMatch(/Gebäude/);
    expect(formatCockpitReason("local_team_not_owned_or_ai_controlled")).not.toBe(
      lookupRoomWriteErrorMessage("local_team_not_owned_or_ai_controlled"),
    );
  });

  it("GEGENPROBE: ein unbekannter Grund bleibt unveraendert lesbar und wird nicht erfunden", () => {
    expect(formatCockpitReason("irgendein_neuer_grund")).toBe("irgendein neuer grund");
  });
});

/**
 * DIE STELLEN, AN DENEN ES IM SPIEL SICHTBAR WAR (F9).
 *
 * Die Tabelle zu haben nuetzt nichts, solange die Anzeige sie nicht fragt — genau das war der
 * Befund. Diese Pruefung liest die Client-Module als TEXT und haelt fest, dass in ihnen kein
 * `payload.error` mehr ungefiltert in eine Anzeige laeuft. Ein Text-Test ist hier das ehrliche
 * Werkzeug: die betroffenen Module sind React-Huellen mit Dutzenden Abhaengigkeiten, und die
 * Eigenschaft ("der rohe Code erreicht die Anzeige nicht") steht wirklich im Quelltext.
 *
 * OHNE AUSNAHMEN, auch fuer Routen ohne Write-Guard. Der erste Anlauf zaehlte auf, welche Route
 * geschuetzt ist und welche nicht — das ist eine zweite Quelle fuer eine Angabe, die nur in
 * `app/api/**` steht, und sie veraltet an dem Tag, an dem eine Route den Guard bekommt. Die
 * Tabelle reicht unbekannte Texte ohnehin unveraendert durch; sie ueberall zu fragen kostet nichts
 * und macht aus einer gepflegten Liste eine Regel.
 */
describe("Kein roher Guard-Code erreicht die Anzeige (F9)", () => {
  const MODULE = [
    "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx",
    "lib/foundation/tabs/cockpit-handlers.ts",
    "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
  ];

  /** Genau die Aufrufe, die eine Meldung SETZEN — Feeds und Rueckgabewerte sind nicht gemeint. */
  const ROH_IN_DIE_ANZEIGE = /set[A-Za-z]*(?:Error|Message|Errors)\(\s*\[?\s*(?:\w*[Pp]ayload)\.error\s*\?\?/;

  for (const datei of MODULE) {
    it(`${datei} reicht keinen rohen Fehlercode in eine Meldung`, () => {
      const quelltext = readFileSync(resolve(process.cwd(), datei), "utf8");
      const treffer = quelltext.split("\n").filter((zeile) => ROH_IN_DIE_ANZEIGE.test(zeile));
      expect(treffer, `ungefilterte Anzeige in ${datei}:\n${treffer.join("\n")}`).toEqual([]);
    });
  }

  it("GEGENPROBE: das Muster wuerde einen Rueckfall auch wirklich finden", () => {
    // Ohne diese Probe koennte der Ausdruck stillschweigend auf nichts mehr passen — dann waeren
    // alle drei Pruefungen oben gruen, ohne irgendetwas zu messen.
    expect(ROH_IN_DIE_ANZEIGE.test('setErrors([payload.error ?? "Fehlgeschlagen."]);')).toBe(true);
    expect(ROH_IN_DIE_ANZEIGE.test("setContractRenewalError(previewPayload.error ?? blocker);")).toBe(true);
    expect(ROH_IN_DIE_ANZEIGE.test('setErrors([formatRoomWriteErrorCode(payload.error) ?? "Fehlgeschlagen."]);')).toBe(
      false,
    );
  });
});
