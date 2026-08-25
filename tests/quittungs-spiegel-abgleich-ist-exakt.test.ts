/**
 * DER SPIEGEL-ABGLEICH FAND DAS EIGENE VERSAGEN NICHT.
 *
 * Am 25.08.2026 lieferte ich zwei Quittungen (`ihcjoz`, `rtyqa9`) ohne das `bug-`-Präfix, das die
 * Routine selbst als Dateinamen verlangt (`data/bug-reports/triage/bug-<id>.md`, wörtlich in ihrer
 * eigenen Schritt-0-Anleitung). `scripts/pruefe-quittungen.ts` prüfte den Spiegel bis dahin per
 * SUBSTRING — es fragte nur, ob der sechsstellige Meldungscode irgendwo im Namen einer Quittung
 * vorkam, nicht ob die Datei den vollen, erwarteten Namen trägt. Der Code stand ja tatsächlich im
 * (falschen) Dateinamen — der Abgleich meldete „erledigt", obwohl kein künftiger Lauf die Datei
 * unter dem Namen gefunden hätte, den er sucht. Ohne diesen Fund wären dieselben zwei Meldungen bei
 * jedem der folgenden Vier-Stunden-Läufe erneut als offen behandelt worden — der Riegel, der genau
 * das verhindern soll, hätte es selbst nie gemeldet.
 *
 * Dieser Test prüft die ECHTE Vergleichsfunktion (`bestimmeUnbearbeiteteMeldungen`, exportiert aus
 * dem Skript), nicht eine Nacherzählung davon.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bestimmeUnbearbeiteteMeldungen } from "@/scripts/pruefe-quittungen";

let triageOrdner = "";

beforeEach(() => {
  triageOrdner = mkdtempSync(join(tmpdir(), "oly-quittungen-spiegel-"));
});

afterEach(() => {
  rmSync(triageOrdner, { recursive: true, force: true });
});

function legeQuittungAn(dateiname: string) {
  writeFileSync(join(triageOrdner, dateiname), "status: gebaut\n");
}

describe("Spiegel-Abgleich der Quittungen", () => {
  it("erkennt eine Quittung unter ihrem exakten, vollen Dateinamen als erledigt", () => {
    legeQuittungAn("bug-2026-08-25T13-49-35-444Z-ihcjoz.md");
    const offen = bestimmeUnbearbeiteteMeldungen(
      ["data/bug-reports/bug-2026-08-25T13-49-35-444Z-ihcjoz.json"],
      triageOrdner,
    );
    expect(offen).toEqual([]);
  });

  it("GEGENPROBE: eine Quittung ohne das bug-Praefix zaehlt weiter als offen", () => {
    // Genau der Fall vom 25.08.2026 — die Datei existiert, traegt den Meldungscode, aber nicht
    // unter dem Namen, den die Routine erwartet.
    legeQuittungAn("2026-08-25T13-49-35-444Z-ihcjoz.md");
    const offen = bestimmeUnbearbeiteteMeldungen(
      ["data/bug-reports/bug-2026-08-25T13-49-35-444Z-ihcjoz.json"],
      triageOrdner,
    );
    expect(offen).toEqual(["bug-2026-08-25T13-49-35-444Z-ihcjoz"]);
  });

  it("laesst sich von einer voellig anderen Quittung, die den Code zufaellig enthaelt, nicht taeuschen", () => {
    // Ein Substring-Test waere hier ebenfalls hereingefallen: der Code "ihcjoz" steht im Dateinamen,
    // nur eben nicht als die erwartete Quittung fuer GENAU diese Meldung.
    legeQuittungAn("bug-2026-01-01T00-00-00-000Z-anderer-fund-erwaehnt-ihcjoz-im-text.md");
    const offen = bestimmeUnbearbeiteteMeldungen(
      ["data/bug-reports/bug-2026-08-25T13-49-35-444Z-ihcjoz.json"],
      triageOrdner,
    );
    expect(offen).toEqual(["bug-2026-08-25T13-49-35-444Z-ihcjoz"]);
  });

  it("ignoriert Nicht-JSON-Eintraege im Spiegel-Baum (z. B. ein README)", () => {
    const offen = bestimmeUnbearbeiteteMeldungen(["data/bug-reports/README.md"], triageOrdner);
    expect(offen).toEqual([]);
  });

  it("meldet mehrere offene Meldungen unabhaengig voneinander", () => {
    legeQuittungAn("bug-a.md");
    const offen = bestimmeUnbearbeiteteMeldungen(
      ["data/bug-reports/bug-a.json", "data/bug-reports/bug-b.json", "data/bug-reports/bug-c.json"],
      triageOrdner,
    );
    expect(offen).toEqual(["bug-b", "bug-c"]);
  });

  it("prueft im echten Triage-Ordner ohne Ueberraschung — Vorbedingung fuer den Ordner selbst", () => {
    // Kein Verzeichnis vorhanden: darf nicht werfen, sondern alles als offen melden.
    mkdirSync(triageOrdner, { recursive: true });
    rmSync(triageOrdner, { recursive: true, force: true });
    const offen = bestimmeUnbearbeiteteMeldungen(["data/bug-reports/bug-x.json"], triageOrdner);
    expect(offen).toEqual(["bug-x"]);
  });
});
