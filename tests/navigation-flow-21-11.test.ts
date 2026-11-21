import { afterEach, describe, expect, it, vi } from "vitest";

import { bestimmeTaktgeberZustand } from "@/app/foundation/shell/FoundationTaktgeber";
import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";
import { buildFoundationActivities } from "@/lib/foundation/foundation-activity-registry";
import { entscheideLeertaste } from "@/lib/foundation/foundation-takt-plan";
import { entscheideHistorie, leseUnterzustand, schreibeUnterzustand } from "@/lib/foundation/history-unterzustand";
import { ligaAufbauAktivitaetStatus, waehleTaktQuelle } from "@/lib/foundation/takt-auswahl";
import { holeTaktRegistrierung, setzeTaktRegistrierung } from "@/lib/foundation/takt-klick-store";

const laeuft: FoundationActivityItem = { id: "league-setup", label: "Liga wird erstellt", tone: "running" };

describe("History: Unterzustände (Maus Zurück/Vor, 21.11.)", () => {
  it("entscheideHistorie: kein Doppel-Eintrag bei gleichem Stand", () => {
    expect(entscheideHistorie({ wert: "p1", inHistorie: "p1", leer: null })).toBe("nichts");
    expect(entscheideHistorie({ wert: null, inHistorie: null, leer: null })).toBe("nichts");
  });
  it("leer -> belegt pusht, belegt -> leer geht zurück, Wechsel ersetzt", () => {
    expect(entscheideHistorie({ wert: "p1", inHistorie: null, leer: null })).toBe("push");
    expect(entscheideHistorie({ wert: null, inHistorie: "p1", leer: null })).toBe("zurueck");
    expect(entscheideHistorie({ wert: "p2", inHistorie: "p1", leer: null })).toBe("replace");
  });
  it("Reiter pushen jede Änderung", () => {
    expect(entscheideHistorie({ wert: "tafel", inHistorie: "live", leer: "live", jedeAenderungPusht: true })).toBe("push");
    expect(entscheideHistorie({ wert: "live", inHistorie: "tafel", leer: "live", jedeAenderungPusht: true })).toBe("push");
  });

  describe("history.state", () => {
    afterEach(() => {
      delete (globalThis as { window?: unknown }).window;
    });
    it("schreibt und liest den Unterzustand, push erzeugt einen Eintrag, replace nicht", () => {
      const stack: unknown[] = [{ foundationNav: { view: "draft" } }];
      let i = 0;
      const history = {
        get state() {
          return stack[i];
        },
        pushState: vi.fn((s: unknown) => {
          stack.splice(i + 1);
          stack.push(s);
          i += 1;
        }),
        replaceState: vi.fn((s: unknown) => {
          stack[i] = s;
        }),
      };
      (globalThis as { window?: unknown }).window = { history, location: { href: "http://x/foundation?view=draft" } };
      expect(leseUnterzustand("draftProfil")).toBeUndefined();
      schreibeUnterzustand("draftProfil", "p1", "push");
      expect(stack).toHaveLength(2);
      expect(leseUnterzustand("draftProfil")).toBe("p1");
      expect((history.state as Record<string, unknown>).foundationNav).toEqual({ view: "draft" });
      schreibeUnterzustand("draftProfil", "p2", "replace");
      expect(stack).toHaveLength(2);
      expect(leseUnterzustand("draftProfil")).toBe("p2");
      i = 0;
      expect(leseUnterzustand("draftProfil")).toBeUndefined();
    });
  });
});

describe("Taktgeber: welche Aktion gilt (je Zustand, 21.11.)", () => {
  const basis = { draftSeiteOffen: false, draftMeldetTakt: false, draftHinweis: false, einsatzlisteAnsicht: false, einsatzlisteMeldetAbgabe: false };
  it("Draft-Seite offen mit Takt: Draft-Aktion", () => {
    expect(waehleTaktQuelle({ ...basis, draftSeiteOffen: true, draftMeldetTakt: true })).toBe("draft");
  });
  it("Draft wartet im Office: Zum Draft", () => {
    expect(waehleTaktQuelle({ ...basis, draftHinweis: true })).toBe("draft-hinweis");
  });
  it("Draft-Seite offen, aber ohne Takt und ohne Hinweis: global", () => {
    expect(waehleTaktQuelle({ ...basis, draftSeiteOffen: true })).toBe("global");
  });
  it("Einsatzliste: Abgabe nur in der Einsatzliste-Ansicht", () => {
    expect(waehleTaktQuelle({ ...basis, einsatzlisteAnsicht: true, einsatzlisteMeldetAbgabe: true })).toBe("einsatzliste");
    expect(waehleTaktQuelle({ ...basis, einsatzlisteMeldetAbgabe: true })).toBe("global");
  });
  it("alles andere (Startwahl, Transfermarkt, Training, Arena, Spieltagswertung, Saisonende): global", () => {
    expect(waehleTaktQuelle(basis)).toBe("global");
  });
  it("Draft hat Vorrang vor Einsatzliste", () => {
    expect(
      waehleTaktQuelle({ ...basis, draftSeiteOffen: true, draftMeldetTakt: true, einsatzlisteAnsicht: true, einsatzlisteMeldetAbgabe: true }),
    ).toBe("draft");
  });
});

describe("Taktgeber: „Aktion läuft“ nur bei echter Sperre", () => {
  it("Hintergrund-Aktivität sperrt den Knopf nicht, wenn gesperrt=false gesetzt ist", () => {
    expect(bestimmeTaktgeberZustand("is-ready", [laeuft], false)).toBe("weiter");
    expect(bestimmeTaktgeberZustand("is-blocked", [laeuft], false)).toBe("zu");
  });
  it("gesperrt=true: läuft; ohne Angabe bleibt das alte Verhalten", () => {
    expect(bestimmeTaktgeberZustand("is-ready", [], true)).toBe("laeuft");
    expect(bestimmeTaktgeberZustand("is-ready", [laeuft])).toBe("laeuft");
  });
  it("Liga-Aufbau meldet mit Draft-Zustand dieser Saison keine laufende Aktion", () => {
    expect(ligaAufbauAktivitaetStatus("in_progress", true)).toBeNull();
    expect(ligaAufbauAktivitaetStatus("in_progress", false)).toBe("in_progress");
    expect(ligaAufbauAktivitaetStatus("failed", true)).toBe("failed");
    expect(ligaAufbauAktivitaetStatus("ready", true)).toBe("ready");
    expect(ligaAufbauAktivitaetStatus(undefined, true)).toBeNull();
  });
  it("die Aktivitätsliste enthält ohne laufenden Aufbau kein „Liga wird erstellt“", () => {
    const mit = buildFoundationActivities({ leagueSetupStatus: "in_progress" } as never);
    const ohne = buildFoundationActivities({ leagueSetupStatus: ligaAufbauAktivitaetStatus("in_progress", true) } as never);
    expect(mit.some((a) => a.id === "league-setup" && a.tone === "running")).toBe(true);
    expect(ohne.some((a) => a.id === "league-setup")).toBe(false);
  });
});

describe("Leertaste = Knopf", () => {
  const basis = { textZiel: false, dialogOffen: false, eigeneLeertaste: false, deaktiviert: false, anzahlKritisch: 0, ablaufOffen: false };
  afterEach(() => setzeTaktRegistrierung(null));
  it("die Registrierung des sichtbaren Taktgebers wird abgeholt und ausgelöst", () => {
    const ausloesen = vi.fn();
    setzeTaktRegistrierung({ ausloesen, kritisch: 0, springeZumKritischen: null, gesperrt: false });
    expect(entscheideLeertaste(basis)).toBe("weiter");
    holeTaktRegistrierung()?.ausloesen();
    expect(ausloesen).toHaveBeenCalledTimes(1);
  });
  it("gesperrter Knopf, Eingabefeld und Dialog: Leertaste ignoriert", () => {
    expect(entscheideLeertaste({ ...basis, deaktiviert: true })).toBe("ignorieren");
    expect(entscheideLeertaste({ ...basis, textZiel: true })).toBe("ignorieren");
    expect(entscheideLeertaste({ ...basis, dialogOffen: true })).toBe("ignorieren");
  });
  it("kritische Punkte: erst Ablauf, dann springen", () => {
    expect(entscheideLeertaste({ ...basis, anzahlKritisch: 2 })).toBe("ablauf-zeigen");
    expect(entscheideLeertaste({ ...basis, anzahlKritisch: 2, ablaufOffen: true })).toBe("springen");
  });
});
