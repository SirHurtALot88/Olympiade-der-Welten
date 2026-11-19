import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuslassenDialog, FertigDialog } from "@/app/foundation/draft-modern/DraftAnsichten";
import { DraftBrett, NichtPicken } from "@/app/foundation/draft-modern/DraftLive";
import {
  entscheideTaste,
  klickAuswahlOderProfil,
  nameKlickAuswahlUndProfil,
  naechsteAuswahl,
} from "@/app/foundation/shared/klickregel";

/**
 * UX-Umbau 19.11. (PR A): eine Klickregel für Draft und Transfermarkt, „Nicht picken?“ mit Rückfragen.
 * Mockup `public/mockups/ux-draft-markt-19-11.html`, Erklärung `docs/design/ux-review-draft-markt-19-11.md`.
 */

describe("Klickregel: 1. Klick wählt aus, Klick auf das Ausgewählte öffnet das Profil", () => {
  it("erster Klick wählt aus und öffnet nichts", () => {
    const log: string[] = [];
    klickAuswahlOderProfil("a", null, (id) => log.push(`wahl:${id}`), (id) => log.push(`profil:${id}`));
    klickAuswahlOderProfil("b", "a", (id) => log.push(`wahl:${id}`), (id) => log.push(`profil:${id}`));
    expect(log).toEqual(["wahl:a", "wahl:b"]);
  });

  it("Zweitklick auf das Ausgewählte öffnet das Profil und wählt nicht neu", () => {
    const log: string[] = [];
    klickAuswahlOderProfil("a", "a", (id) => log.push(`wahl:${id}`), (id) => log.push(`profil:${id}`));
    expect(log).toEqual(["profil:a"]);
  });

  it("Name wählt aus UND öffnet das Profil; Vergebenes (nicht auswählbar) öffnet nur das Profil", () => {
    const log: string[] = [];
    nameKlickAuswahlUndProfil("a", true, (id) => log.push(`wahl:${id}`), (id) => log.push(`profil:${id}`));
    nameKlickAuswahlUndProfil("weg", false, (id) => log.push(`wahl:${id}`), (id) => log.push(`profil:${id}`));
    expect(log).toEqual(["wahl:a", "profil:a", "profil:weg"]);
  });
});

describe("Klickregel: Tastatur", () => {
  const ids = ["a", "b", "c"];

  it("↑/↓ bewegt die Auswahl und bleibt am Rand stehen", () => {
    expect(naechsteAuswahl(ids, "a", 1)).toBe("b");
    expect(naechsteAuswahl(ids, "c", 1)).toBe("c");
    expect(naechsteAuswahl(ids, "a", -1)).toBe("a");
    expect(naechsteAuswahl(ids, "b", -1)).toBe("a");
  });

  it("ohne sichtbare Auswahl beginnt ↓ oben und ↑ unten; leere Liste tut nichts", () => {
    expect(naechsteAuswahl(ids, null, 1)).toBe("a");
    expect(naechsteAuswahl(ids, "weg", -1)).toBe("c");
    expect(naechsteAuswahl([], "a", 1)).toBeNull();
  });

  it("Enter öffnet das Profil des Ausgewählten, ohne Auswahl nichts", () => {
    expect(entscheideTaste({ key: "Enter" }, ids, "b")).toEqual({ art: "profil", id: "b" });
    expect(entscheideTaste({ key: "Enter" }, ids, null)).toBeNull();
  });

  it("Pfeiltasten wählen aus (kein Profil, kein Pick)", () => {
    expect(entscheideTaste({ key: "ArrowDown" }, ids, "a")).toEqual({ art: "auswahl", id: "b" });
    expect(entscheideTaste({ key: "ArrowUp" }, ids, "b")).toEqual({ art: "auswahl", id: "a" });
  });

  it("nie Picken/Kaufen per Taste: kein anderer Schlüssel löst etwas aus", () => {
    for (const key of ["p", "k", " ", "v", "Delete"]) expect(entscheideTaste({ key }, ids, "a")).toBeNull();
  });

  it("in Eingabefeldern, bei Strg/Alt/Meta und auf fokussierten Knöpfen (Enter) bleibt die Liste still", () => {
    expect(entscheideTaste({ key: "ArrowDown", targetTag: "INPUT" }, ids, "a")).toBeNull();
    expect(entscheideTaste({ key: "Enter", targetTag: "TEXTAREA" }, ids, "a")).toBeNull();
    expect(entscheideTaste({ key: "ArrowDown", targetEditierbar: true }, ids, "a")).toBeNull();
    expect(entscheideTaste({ key: "ArrowDown", ctrlKey: true }, ids, "a")).toBeNull();
    expect(entscheideTaste({ key: "Enter", targetIstKnopf: true }, ids, "a")).toBeNull();
    expect(entscheideTaste({ key: "ArrowDown", targetIstKnopf: true }, ids, "a")).toEqual({ art: "auswahl", id: "b" });
  });
});

const mein = (teil: Record<string, unknown> = {}) =>
  ({
    teamId: "t7",
    art: "mensch",
    status: "aktiv",
    autoPick: false,
    amZug: true,
    darfPicken: true,
    darfAuslassen: true,
    darfFertig: true,
    darfUeberspringen: true,
    kader: 9,
    kaderOpt: 11,
    kasse: 96,
    pflichtReserve: 0,
    maxAbloese: 96,
    vorschlag: [],
    picksBisZug: 0,
    ...teil,
  }) as never;

describe("Nicht picken?: drei beschriftete Wege, Sperrgrund sichtbar", () => {
  const html = (m: never) => renderToStaticMarkup(createElement(NichtPicken, { mein: m, minKader: 8, onAuslassen: () => undefined, onFertig: () => undefined, onSkip: () => undefined }));

  it("zeigt Pick auslassen, Ich bin fertig und Überspringen … mit je einer Zeile Folge", () => {
    const h = html(mein());
    expect(h).toContain("Nicht picken?");
    expect(h).toContain("Pick auslassen");
    expect(h).toContain("nur diese Runde");
    expect(h).toContain("Ich bin fertig");
    expect(h).toContain("Draft für mich beenden · Kader 9");
    expect(h).toContain("Überspringen …");
  });

  it("unter dem Mindestkader ist „Ich bin fertig“ gesperrt und sagt sichtbar „noch N Pflichtplätze“", () => {
    const h = html(mein({ darfFertig: false, kader: 3 }));
    const fertig = h.match(/<button[^>]*data-testid="draft-fertig"[^>]*>.*?<\/button>/)?.[0] ?? "";
    expect(fertig).toContain("disabled");
    expect(fertig).toContain("ab 8 Spielern · noch 5 Pflichtplätze");
  });

  it("der Sperrgrund von „Pick auslassen“ steht im Text des Knopfs, nicht nur im Tooltip", () => {
    const h = html(mein({ darfAuslassen: false, amZug: false }));
    const knopf = h.match(/<button[^>]*data-testid="draft-auslassen"[^>]*>.*?<\/button>/)?.[0] ?? "";
    expect(knopf).toContain("disabled");
    expect(knopf).toContain("<small>Du kannst nur am eigenen Zug auslassen.</small>");
  });

  it("ein Mensch, der schon fertig ist, sieht den Block nicht", () => {
    expect(html(mein({ status: "fertig" }))).toBe("");
  });
});

describe("Nicht picken?: Rückfragen", () => {
  const k = (m: unknown) => ({ ansicht: { runde: 4, picks: 32, regeln: { minKader: 8 }, mein: m } }) as never;

  it("Pick auslassen: Rückfrage nennt die nächste Runde und hat Ja/Zurück", () => {
    const h = renderToStaticMarkup(createElement(AuslassenDialog, { k: k(mein()), busy: false, onZu: () => undefined, onJa: () => undefined }));
    expect(h).toContain("Diesen Pick auslassen?");
    expect(h).toContain("Runde 5");
    expect(h).toContain('data-testid="draft-auslassen-ja"');
    expect(h).toContain('data-testid="draft-auslassen-zurueck"');
  });

  it("Ich bin fertig: Rückfrage zeigt Kader, Wunschgröße des GM, Kasse und warnt, dass es endgültig ist", () => {
    const h = renderToStaticMarkup(createElement(FertigDialog, { k: k(mein()), busy: false, onZu: () => undefined, onJa: () => undefined }));
    expect(h).toContain("Draft für dich beenden?");
    expect(h).toContain("Das lässt sich nicht zurücknehmen.");
    expect(h).toContain("Pflicht 8 erfüllt");
    expect(h).toContain("dir fehlen 2");
    expect(h).toContain("96,0");
    expect(h).toContain('data-testid="draft-fertig-ja"');
  });
});

describe("Draft-Brett: Picken und Profil nur in der ausgewählten Zeile", () => {
  const item = (id: string, name: string): { playerId: string } =>
    ({ playerId: id, name, className: "Rogue", race: "Lizard", marketValue: 50, salary: 10, traitsPositive: [], traitsNegative: [] }) as never;
  const sicht = (id: string) => ({
    playerId: id,
    name: `Spieler ${id}`,
    stufe: 5,
    disziplinen: { hockey: { text: "82", exakt: true, schaetzung: 82, von: null, bis: null } },
    achsen: { pow: { anzeige: "B", exakt: true, sortWert: 3 }, spe: { anzeige: "B", exakt: true, sortWert: 3 }, men: { anzeige: "B", exakt: true, sortWert: 3 }, soc: { anzeige: "B", exakt: true, sortWert: 3 } },
  }) as never;
  const kontext = (wahl: string | null, ichBinDran: boolean) => {
    const zeilen = ["a", "b", "c"].map((id) => ({ item: item(id, `Spieler ${id}`), sicht: sicht(id) }));
    return {
      ansicht: { mein: mein({ darfPicken: ichBinDran, maxAbloese: 96 }), gefragt: {}, verlauf: [], picks: 0 },
      zeilen,
      zeilenById: new Map(zeilen.map((z) => [z.item.playerId, z])),
      feedBusy: false,
      feedFehler: null,
      nebelAus: true,
      disziplin: "hockey",
      setDisziplin: () => undefined,
      wunsch: new Set<string>(),
      toggleWunsch: () => undefined,
      portrait: () => null,
      profil: () => undefined,
      klick: () => undefined,
      nameKlick: () => undefined,
      wahl,
      setWahl: () => undefined,
    } as never;
  };
  const brett = (wahl: string | null, ichBinDran: boolean) =>
    renderToStaticMarkup(createElement(DraftBrett, { k: kontext(wahl, ichBinDran), aktionen: {} as never, tastenAktiv: false }));

  it("am eigenen Zug steht „Picken“ nur in der ausgewählten Zeile (statt in jeder), daneben „Profil ›“", () => {
    const h = brett("b", true);
    expect((h.match(/data-testid="draft-picken"/g) ?? []).length).toBe(1);
    expect((h.match(/data-testid="draft-zeile-profil"/g) ?? []).length).toBe(1);
    const ab = h.indexOf('data-player-id="b"');
    const ende = h.indexOf('data-player-id="c"');
    expect(h.slice(ab, ende)).toContain("draft-picken");
    expect(h).toContain('class="mz an"');
  });

  it("die anderen Zeilen sagen „Klick wählt aus“; „vormerken/vorgemerkt“ gibt es nicht mehr", () => {
    const h = brett("b", true);
    expect((h.match(/Klick wählt aus/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(h).not.toMatch(/vorgemerkt|vormerken/i);
  });

  it("nicht am Zug: ausgewählt zeigt nur „Profil ›“, kein Picken", () => {
    const h = brett("b", false);
    expect(h).not.toContain('data-testid="draft-picken"');
    expect(h).toContain('data-testid="draft-zeile-profil"');
  });

  it("ohne Auswahl gibt es weder Picken noch Profil-Knopf", () => {
    const h = brett(null, true);
    expect(h).not.toContain('data-testid="draft-picken"');
    expect(h).not.toContain('data-testid="draft-zeile-profil"');
  });
});

describe("Verdrahtung: Draft und Transfermarkt folgen derselben Regel", () => {
  const lies = (p: string) => readFileSync(p, "utf8");

  it("Draft: Brett, Top 3, Portraits und Wunschliste gehen über k.klick; der Name über k.nameKlick", () => {
    const q = lies("app/foundation/draft-modern/DraftLive.tsx");
    expect(q).toContain("onClick={() => k.klick(it.playerId)}");
        expect(q).toContain("k.nameKlick(it.playerId)");
    expect(q).toContain("k.klick(id)");
    expect(q).toContain('data-testid="draft-danach-portrait"');
    // Top 3 auch dann auswählbar, wenn man nicht dran ist (E5): kein `meinZug ?` mehr vor dem Klick.
    expect(q).not.toContain("onClick={meinZug ? ()");
  });

  it("Draft: Pick auslassen und Ich bin fertig laufen über die Rückfrage, auch der Taktgeber", () => {
    const q = lies("app/foundation/draft-modern/LigaDraftSeite.tsx");
    expect(q).toContain("setFertigOffen(true)");
    expect(q).not.toMatch(/onClick: \(\) => void aktionen\.fertig\(\)/);
    expect(q).toContain("aktionen.auslassen()");
    expect(q).toMatch(/setAuslassenOffen\(false\);\s*void aktionen\.auslassen\(\)/);
  });

  it("Draft rechts: Gehaltsbudget-Kasten, Vertragshinweis und „kein Team hat ihn“ sind weg", () => {
    const q = lies("app/foundation/draft-modern/DraftLive.tsx");
    expect(q).not.toContain("draft-vertrag-hinweis");
    expect(q).not.toContain("Kein KI-Team vor dir hat ihn gerade");
    expect(q).not.toContain('className="vorst"');
  });

  it("Transfermarkt: Zeile über zeilenKlick, Name über nameKlick, Verhandeln nur in der ausgewählten Zeile, Bühne öffnet das Profil", () => {
    const q = lies("app/foundation/transfermarkt-modern/TransfermarktModern.tsx");
    expect(q).toContain("onClick={() => zeilenKlick(z)}");
    expect(q).toContain("nameKlickAuswahlUndProfil(it.playerId, true");
    expect(q).toMatch(/istFokus \? \([\s\S]*tm-zeile-verhandeln/);
    expect(q).toContain('onClick={props.onDetails}');
    expect(q).toContain('data-testid="tm-buehne"');
    expect(q).toContain("useListenTasten(");
  });

  it("Transfermarkt Verkauf/Verträge: Zeile, Name und Kopf öffnen das Profil über onProfil", () => {
    const q = lies("app/foundation/transfermarkt-modern/KaderAnsichten.tsx");
    expect(q).toContain("klickAuswahlOderProfil(r.playerId");
    expect(q).toContain("props.onProfil");
    expect(q).toContain("useListenTasten(");
    expect(lies("app/foundation/transfermarkt-modern/TransfermarktModern.tsx")).toContain("onProfil={profilOeffnen}");
  });

  it("Esc schließt Dialoge (Skip, Abbruch, Auslassen, Fertig, Vergleich, Verhandlungstisch)", () => {
    expect(lies("app/foundation/draft-modern/DraftAnsichten.tsx").match(/useEscSchliesst\(true, onZu\)/g)?.length).toBe(4);
    expect(lies("app/foundation/transfermarkt-modern/VergleichDialog.tsx")).toContain("useEscSchliesst(");
    expect(lies("app/foundation/transfermarkt-modern/VerhandlungsTisch.tsx")).toContain("useEscSchliesst(");
  });
});
