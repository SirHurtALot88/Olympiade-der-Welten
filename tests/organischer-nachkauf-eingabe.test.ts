/**
 * GEFUNDEN beim Nachlesen des eigenen Werkzeugs, nicht aus einer Meldung: der Aufruf, mit dem
 * `scripts/organischen-nachkauf-fahren.ts` das Kauffenster nachtraeglich faehrt, hatte zwei Fehler
 * — und beide waren am Probelauf NICHT zu sehen.
 *
 * 1. `teamIds: kiTeams` — dieses Feld gibt es in `TransferWindowSessionInput` nicht. Ein `as never`
 *    schmuggelte es am Compiler vorbei, die Sitzung verwarf es still. Dass Chris' eigenes Team im
 *    Probelauf unangetastet blieb, lag am zentralen Schutz der Sitzung (`scopeTeam` gegen
 *    `manualTeamIds`), nicht an diesem Argument. Richtig heisst das Feld `targetTeamIds`.
 *
 * 2. `skipIfExistingMarketTransfers` fehlte und steht per Vorgabe auf AN. In der Phase `preseason`
 *    bricht die Sitzung dann ab, sobald die Saison schon Markttransfers kennt. Auf Chris'
 *    Spielstand sind das die 33 `ai_preseason_market_buy`, die wir ABSICHTLICH stehen lassen —
 *    das Werkzeug waere mit `skipped: true` zurueckgekommen und haette nichts gekauft. Der
 *    Probelauf lief nur durch, weil dort alle Saison-2-Kaeufe zurueckgesetzt waren.
 *
 * Der Aufruf steht deshalb jetzt in `lib/ai/organischer-nachkauf-eingabe.ts` statt im Skript: ein
 * Skript mit `void main()` laesst sich nicht importieren, ohne es auszufuehren — und was man nicht
 * importieren kann, prueft auch niemand.
 */
import { describe, expect, it } from "vitest";

import { baueNachkaufSitzung, ermittleKiTeamIds } from "@/lib/ai/organischer-nachkauf-eingabe";

const sitzung = () =>
  baueNachkaufSitzung({
    saveId: "save-1",
    seasonId: "season-2",
    persistence: {} as never,
    kiTeamIds: ["T-1", "T-2"],
  });

describe("Aufruf des organischen Nachkaufs", () => {
  it("uebergibt die KI-Teams als targetTeamIds", () => {
    // Fehler 1: `teamIds` existiert nicht. Ist die Auswahl leer, faehrt die Sitzung ueber ALLE
    // Teams — geschuetzt waeren dann nur noch die manuell gefuehrten.
    expect(sitzung().targetTeamIds).toEqual(["T-1", "T-2"]);
  });

  it("laeuft trotz vorhandener Markttransfers der Saison", () => {
    // Fehler 2: der eigentliche Zweck des Werkzeugs. Ohne dieses `false` ist der ganze Lauf ein
    // No-Op auf genau dem Spielstand, fuer den es gebaut wurde.
    expect(sitzung().skipIfExistingMarketTransfers).toBe(false);
  });

  it("kauft in der Preseason-Phase und schreibt wirklich", () => {
    const eingabe = sitzung();
    expect(eingabe.phase).toBe("preseason");
    expect(eingabe.dryRun).toBe(false);
    // Verkauft wird hier nicht — das macht der Saisonuebergang. `allowBuys` bleibt auf Vorgabe
    // (true); waere es false gesetzt, kaufte die Sitzung gar nichts.
    expect(eingabe.allowBuys).toBeUndefined();
  });
});

describe("Auswahl der KI-Teams", () => {
  const spielstand = (
    teams: Array<{ teamId: string; humanControlled?: boolean }>,
    settings: Record<string, { controlMode: string }> = {},
  ) => ({ teams, seasonState: { teamControlSettings: settings } }) as never;

  it("nimmt Teams ohne Einstellung als KI", () => {
    expect(ermittleKiTeamIds(spielstand([{ teamId: "T-1" }, { teamId: "T-2" }]))).toEqual(["T-1", "T-2"]);
  });

  it("laesst manuell gefuehrte Teams aus", () => {
    // „S-C hat gekauft. das ist MEIN TEAM."
    const state = spielstand([{ teamId: "S-C" }, { teamId: "T-2" }], { "S-C": { controlMode: "manual" } });
    expect(ermittleKiTeamIds(state)).toEqual(["T-2"]);
  });

  it("faellt ohne Einstellung auf humanControlled zurueck — wie die Sitzung selbst", () => {
    // Genau der Rueckfall aus `manualTeamIds`. Waere er hier anders, meldete der Bericht Teams als
    // angefasst, die die Sitzung nie anfasst.
    const state = spielstand([{ teamId: "S-C", humanControlled: true }, { teamId: "T-2" }]);
    expect(ermittleKiTeamIds(state)).toEqual(["T-2"]);
  });
});
