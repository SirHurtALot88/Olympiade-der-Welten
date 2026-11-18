import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuslassenFertig } from "@/app/foundation/draft-modern/DraftLive";
import { istDraftKandidat, urteilGilt } from "@/app/foundation/draft-modern/draft-tor";
import {
  auslassenSperrGrund,
  fehlerText,
  fertigGrundText,
  fertigSperrGrund,
  istStandKonflikt,
  pickHerkunft,
} from "@/app/foundation/draft-modern/draft-format";
import { baueDraftLeseParameter, baueDraftPostKoerper } from "@/app/foundation/draft-modern/draft-protokoll";
import type { FoundationRoomContext } from "@/lib/room/foundation-room-context-client";

const raum: FoundationRoomContext = { roomCode: "ABCD", participantId: "p1", userId: "u1", seatToken: "tok", saveId: "s1", ownerId: null };
const draftLaeuft = (status: "laeuft" | "nachzug" | "fertig", saisonId = "season-1") => ({ saisonId, status }) as never;

describe("Draft-Tor: Entscheidung Draft ja/nein", () => {
  it("fragt bei Aufbau und bei offenem Draft, auch bei ready (Reload im Nachzug)", () => {
    const basis = { saveId: "s1", saisonId: "season-1" };
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "in_progress", ligaDraft: null })).toBe(true);
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "failed", ligaDraft: null })).toBe(true);
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "ready", ligaDraft: draftLaeuft("nachzug") })).toBe(true);
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "ready", ligaDraft: draftLaeuft("laeuft") })).toBe(true);
  });

  it("fragt nicht: fertiger Draft, Draft einer anderen Saison, kein Draft, kein Spielstand", () => {
    const basis = { saveId: "s1", saisonId: "season-2" };
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "ready", ligaDraft: draftLaeuft("fertig", "season-2") })).toBe(false);
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "ready", ligaDraft: draftLaeuft("nachzug", "season-1") })).toBe(false);
    expect(istDraftKandidat({ ...basis, leagueSetupStatus: "ready", ligaDraft: null })).toBe(false);
    expect(istDraftKandidat({ saveId: "loading-save", saisonId: "season-2", leagueSetupStatus: "in_progress", ligaDraft: null })).toBe(false);
  });

  it("ein altes „nein“ gilt nicht mehr, wenn sich die Lage ändert; ein „ja“ bleibt", () => {
    expect(urteilGilt({ saveId: "s1", wert: "nein", schluessel: "a" }, "s1", "a")).toBe(true);
    expect(urteilGilt({ saveId: "s1", wert: "nein", schluessel: "a" }, "s1", "b")).toBe(false);
    expect(urteilGilt({ saveId: "s1", wert: "ja", schluessel: "a" }, "s1", "b")).toBe(true);
    expect(urteilGilt({ saveId: "s1", wert: "ja", schluessel: "a" }, "s2", "a")).toBe(false);
  });
});

describe("Draft-Protokoll: erwarteteNr und Raumfelder", () => {
  it("GET trägt Raumfelder und eigenes Team als Query", () => {
    const p = baueDraftLeseParameter({ saveId: "s1", teamId: "t7", roomContext: raum });
    expect(p.get("roomCode")).toBe("ABCD");
    expect(p.get("participantId")).toBe("p1");
    expect(p.get("seatToken")).toBe("tok");
    expect(p.get("userId")).toBe("u1");
    expect(p.get("teamId")).toBe("t7");
    expect(p.get("activeManagerTeamId")).toBe("t7");
    const solo = baueDraftLeseParameter({ saveId: "s1", teamId: "t7", roomContext: null });
    expect(solo.get("roomCode")).toBeNull();
  });

  it("jeder POST außer starten trägt erwarteteNr = Stand", () => {
    for (const aktion of ["ki_schritt", "ki_hintergrund", "pick", "auslassen", "fertig", "ueberspringen", "auto_pick", "abbrechen"]) {
      const k = baueDraftPostKoerper({ saveId: "s1", teamId: "t7", aktion, stand: 12, roomContext: raum });
      expect(k.erwarteteNr, aktion).toBe(12);
      expect(k.roomCode).toBe("ABCD");
    }
    expect("erwarteteNr" in baueDraftPostKoerper({ saveId: "s1", teamId: "t7", aktion: "starten", stand: 12, roomContext: null })).toBe(false);
  });

  it("ki_schritt.maxPicks bleibt zwischen 1 und 8", () => {
    const m = (maxPicks: number) => baueDraftPostKoerper({ saveId: "s1", teamId: "t7", aktion: "ki_schritt", stand: 0, roomContext: null, extra: { maxPicks } }).maxPicks;
    expect(m(50)).toBe(8);
    expect(m(0)).toBe(1);
    expect(m(3)).toBe(3);
  });

  it("die Seite schickt jeden POST über den gemeinsamen Körperbau", () => {
    const quelle = readFileSync("app/foundation/draft-modern/draft-daten.ts", "utf8");
    expect(quelle).toContain("baueDraftPostKoerper(");
    expect(quelle).toContain("baueDraftLeseParameter(");
    expect((quelle.match(/method: "POST"/g) ?? []).length).toBe(1);
  });
});

describe("Draft-Seite: Knöpfe strikt nach darfAuslassen/darfFertig", () => {
  const mein = (teil: Partial<{ darfAuslassen: boolean; darfFertig: boolean; autoPick: boolean; amZug: boolean; status: string; kader: number }>) =>
    ({ teamId: "t7", art: "mensch", status: "aktiv", autoPick: false, amZug: true, darfPicken: true, darfAuslassen: true, darfFertig: true, darfUeberspringen: true, kader: 9, kasse: 10, pflichtReserve: 0, maxAbloese: 10, vorschlag: [], picksBisZug: 0, ...teil }) as never;
  const html = (m: never) => renderToStaticMarkup(createElement(AuslassenFertig, { mein: m, minKader: 8, aktionen: { auslassen: async () => undefined, fertig: async () => true } }));
  const knopf = (h: string, id: string) => h.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? "";

  it("beide an", () => {
    const h = html(mein({}));
    expect(knopf(h, "draft-auslassen")).not.toContain("disabled");
    expect(knopf(h, "draft-fertig")).not.toContain("disabled");
  });

  it("gesperrt exakt nach den Flags der Sicht, mit Tooltip", () => {
    const h = html(mein({ darfAuslassen: false, darfFertig: false, kader: 5 }));
    expect(knopf(h, "draft-auslassen")).toContain("disabled");
    expect(knopf(h, "draft-fertig")).toContain("disabled");
    expect(knopf(h, "draft-fertig")).toContain("title=");
    const nurFertig = html(mein({ darfAuslassen: false, darfFertig: true }));
    expect(knopf(nurFertig, "draft-auslassen")).toContain("disabled");
    expect(knopf(nurFertig, "draft-fertig")).not.toContain("disabled");
  });

  it("Gründe in Klartext", () => {
    expect(auslassenSperrGrund({ darfAuslassen: false, autoPick: true, amZug: true, status: "aktiv" })).toMatch(/Auto-Pick/);
    expect(auslassenSperrGrund({ darfAuslassen: false, autoPick: false, amZug: false, status: "aktiv" })).toMatch(/eigenen Zug/);
    expect(auslassenSperrGrund({ darfAuslassen: false, autoPick: false, amZug: true, status: "aktiv" })).toMatch(/8 Spielern/);
    expect(auslassenSperrGrund({ darfAuslassen: true, autoPick: false, amZug: true, status: "aktiv" })).toBeNull();
    expect(fertigSperrGrund({ darfFertig: false, kader: 5 }, 8)).toMatch(/ab 8 Spielern/);
  });
});

describe("Draft-Seite: Fehlertexte und Anzeige", () => {
  it("neue Fehlercodes sind verständlich, Stand-Konflikte still", () => {
    for (const code of ["liga_draft_modus_aus", "erwarteteNr_fehlt", "draft_laeuft_nicht", "auslassen_unter_mindestkader", "draft_schon_fertig", "nur_saison_1", "saison_laeuft_schon", "nur_im_saisonaufbau", "auto_pick_ist_an"]) {
      expect(fehlerText(code), code).not.toMatch(/\(.*\)$/);
    }
    expect(istStandKonflikt("draft_stand_veraltet")).toBe(true);
    expect(istStandKonflikt("erwarteteNr_fehlt")).toBe(true);
    expect(istStandKonflikt("kader_voll")).toBe(false);
  });

  it("zeigt abgebrochen und Notkauf", () => {
    expect(fertigGrundText("abgebrochen")).toBe("Draft abgebrochen");
    expect(pickHerkunft({ quelle: "ki", grund: "notkauf_mindestkader" })).toMatch(/Notkauf/);
    expect(pickHerkunft({ quelle: "ki", grund: null })).toBe("KI");
  });
});
