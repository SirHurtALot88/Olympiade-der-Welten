/**
 * AUSRUESTUNG: ANZEIGE-TEXTE (Phase 1a, 22.11.). Reine Text-Helfer fuer die Seite und die Tests: aus einem Affix wird eine Zeile
 * mit Ton (Plus gruen, Minus rot, Pflege neutral). Die Seite rechnet nichts selbst.
 */
import { ATTRIBUT_LABEL, DISZIPLIN_LABEL, FARBE_LABEL, FAMILIE_BY_ID, SELTENHEIT_LABEL } from "@/lib/ausruestung/ausruestung-katalog";
import type { Affix, PflegeAffix, Teil } from "@/lib/ausruestung/ausruestung-typen";

export const PFLEGE_TEXT: Record<PflegeAffix, { name: string; wirkung: string }> = {
  robust: { name: "Robust", wirkung: "Verschleiß halbiert" },
  pflegeleicht: { name: "Pflegeleicht", wirkung: "Reparatur −30 %" },
  leicht: { name: "Leicht", wirkung: "Erschöpfung −5 % in Einsätzen mit dem Teil" },
};

export type AffixZeile = {
  /** Hauptzeile, zum Beispiel „+9 Health“. */
  text: string;
  /** Abzug bei Zweischneidigen, zum Beispiel „−3 Stamina“. */
  malus: string | null;
  /** Beschraenkung, zum Beispiel „nur in POW-Disziplinen“. */
  nur: string | null;
  art: "plus" | "pflege";
};

export function affixZeile(a: Affix): AffixZeile {
  if (a.art === "pflege") {
    const p = PFLEGE_TEXT[a.pflege];
    return { text: p.name, malus: null, nur: p.wirkung, art: "pflege" };
  }
  const nur = a.nur ? ("farbe" in a.nur ? `nur in ${FARBE_LABEL[a.nur.farbe]}-Disziplinen` : `nur im ${DISZIPLIN_LABEL[a.nur.disziplin] ?? a.nur.disziplin}`) : null;
  return {
    text: `+${a.wert} ${ATTRIBUT_LABEL[a.attribut]}`,
    malus: a.malus ? `−${Math.abs(a.malus.wert)} ${ATTRIBUT_LABEL[a.malus.attribut]}` : null,
    nur,
    art: "plus",
  };
}

/** Kurze Unterzeile eines Teils: Stufe, Familie, bevorzugte Attribute. */
export function teilUnterzeile(teil: Teil): string {
  const f = FAMILIE_BY_ID[teil.familie];
  return `${SELTENHEIT_LABEL[teil.seltenheit]} · ${f.name} · bevorzugt ${ATTRIBUT_LABEL[f.bevorzugt[0]]}, ${ATTRIBUT_LABEL[f.bevorzugt[1]]}`;
}

/** Eine Zeile fuer Listen: „+6 Health, +3 Speed“ (Pflege-Affixe mit Namen). */
export function teilKurzzeile(teil: Teil): string {
  return teil.affixe
    .map((a) => {
      const z = affixZeile(a);
      return z.art === "pflege" ? z.text : `${z.text}${z.malus ? ` ${z.malus}` : ""}`;
    })
    .join(" · ");
}

/** Bilder, die es von PixelLab schon gibt (Icon-Probe, public/sprites/ausruestung/quellen.json). Alles andere zeichnet die Seite als Linien-Glyphe. */
export const ICON_BILDER: ReadonlySet<string> = new Set(["helm-standard", "plattenpanzer-selten", "amulett-legendaer"]);

export function iconBildPfad(familie: string, seltenheit: string): string | null {
  const schluessel = `${familie}-${seltenheit}`;
  return ICON_BILDER.has(schluessel) ? `/sprites/ausruestung/${schluessel}.png` : null;
}
