/**
 * Chris 19.11.: Attribute untereinander (POW/SPE/MEN/SOC mit Note und Balken) und rechts mehr Disziplinen mit
 * Rang im Team und Rang in der Liga. Prüft Panel-Rendering und Nebel-Verhalten ohne Browser.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttributeTafel, ExperteTafel } from "@/app/foundation/spielerprofil/TabUeberblick";
import type { SpielerprofilModell } from "@/app/foundation/spielerprofil/use-spielerprofil-modell";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { ACHSEN, bestimmeWeg, type DisziplinRang } from "@/lib/foundation/spielerprofil-modell";

const ATTRIBUTE = ACHSEN.flatMap((achse) => achse.attribute);

function daten(ueberschreibe: Record<string, unknown> = {}): PlayerDetailDrawerData {
  return {
    ovr: 53,
    potential: 72.9,
    attributeVisibility: "exact",
    attributeStats: ATTRIBUTE.map((key, index) => ({ key, label: key, value: 40 + index * 4, ratingLabel: index === 10 ? "S+" : "C", rangeLabel: null })),
    axisCards: ACHSEN.map((achse) => ({ id: achse.id, value: 50 })),
    disciplineValues: ["tennis", "hockey", "basketball", "staffel", "tdm", "wettessen", "football"].map((id, i) => ({ id, label: id, category: "mental", value: 80 - i })),
    ...ueberschreibe,
  } as unknown as PlayerDetailDrawerData;
}

function rang(ueber: Partial<DisziplinRang>): DisziplinRang {
  return {
    disziplinId: "x", wert: 80, ligaRang: 3, ligaVon: 40, aktivRang: 5, aktivVon: 80, kaderRang: 1, kaderVon: 14, inBesten6: true,
    freiAktivRang: null, beiDirRang: null, beiDirVon: 0, ppSaison: null, ppLigaRang: null, ppLigaVon: 0, ...ueber,
  };
}

function modell(d: PlayerDetailDrawerData, vertragslos = false, nebel = false): SpielerprofilModell {
  const ids = d.disciplineValues.map((zeile) => zeile.id);
  const werte = Object.fromEntries(ATTRIBUTE.map((key) => [key, 60]));
  const experte = ids.slice(0, 6).map((id, i) => ({ disziplinId: id, label: id, achse: "men" as const, wert: 80 - i, weg: bestimmeWeg(id, werte) }));
  const disziplinen = new Map(
    ids.map(
      (id, i) =>
        [id, vertragslos ? rang({ ligaRang: null, kaderRang: null, aktivRang: null, freiAktivRang: 7 + i, beiDirRang: 2, beiDirVon: 15 }) : rang({ kaderRang: i + 1 })] as const,
    ),
  );
  return {
    nebel,
    nebelBreite: nebel ? 10 : 0,
    experte: nebel ? [] : experte,
    raenge: { ligaAktiv: true, ligaName: "liga1", vertragslos, disziplinen },
  } as unknown as SpielerprofilModell;
}

describe("Attribute-Panel", () => {
  it("zeigt zwölf Zeilen mit Note und Zahl, vier Achsenköpfe und Gesamt/Potenzial", () => {
    const d = daten();
    const html = renderToStaticMarkup(<AttributeTafel data={d} modell={modell(d)} />);
    expect(html.match(/class="spr-at"/g)).toHaveLength(12);
    expect(html.match(/<h4>/g)).toHaveLength(4);
    expect(html).toContain("Gesamt");
    expect(html).toContain("Potenzial");
    expect(html).toContain('class="is-top">S+');
  });

  it("lässt das Potenzial weg, wenn es nicht im Profil steht", () => {
    const d = daten({ potential: null });
    const html = renderToStaticMarkup(<AttributeTafel data={d} modell={modell(d)} />);
    expect(html).toContain("Gesamt");
    expect(html).not.toContain("Potenzial");
  });

  it("Nebel: Spannen statt Zahlen, kein Gesamt, keine Note", () => {
    const d = daten({
      attributeVisibility: "scouted",
      attributeStats: ATTRIBUTE.map((key) => ({ key, label: key, value: null, ratingLabel: null, rangeLabel: "40–49" })),
    });
    const html = renderToStaticMarkup(<AttributeTafel data={d} modell={modell(d, false, true)} />);
    expect(html).toContain("40–49");
    expect(html).not.toContain("Gesamt");
    expect(html).not.toContain("Potenzial");
    expect(html).not.toContain('class="is-top"');
  });
});

describe("Experten-Panel", () => {
  it("zeigt sechs Disziplinen mit „#N im Kader“ und „Liga #N“", () => {
    const d = daten();
    const html = renderToStaticMarkup(<ExperteTafel data={d} modell={modell(d)} onOpenDisziplin={() => undefined} />);
    expect(html.match(/class="spr-ex /g)).toHaveLength(6);
    expect(html).toContain("#1</b> im Kader");
    expect(html).toContain("Liga <b");
    expect(html).toContain("#3");
  });

  it("vertragslos: „bei dir #N“ und „Alle #N“, kein „#–“", () => {
    const d = daten();
    const html = renderToStaticMarkup(<ExperteTafel data={d} modell={modell(d, true)} onOpenDisziplin={() => undefined} />);
    expect(html).toContain("bei dir");
    expect(html).toContain("Alle <b");
    expect(html).not.toContain("#–");
    expect(html).not.toContain("im Kader");
  });

  it("Nebel: Bereiche und nur grobe Rangstufen, kein exakter Rang", () => {
    const d = daten({ attributeVisibility: "scouted" });
    const html = renderToStaticMarkup(<ExperteTafel data={d} modell={modell(d, false, true)} onOpenDisziplin={() => undefined} />);
    expect(html).toContain("70–79");
    expect(html).not.toContain("#");
    expect(html).not.toContain("im Kader");
  });
});
