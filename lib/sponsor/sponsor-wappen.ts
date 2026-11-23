import { SPONSOR_BRAND_PARENTS } from "@/lib/sponsor/sponsor-brand-parents";

/**
 * Sponsor-Wappen (Chris, 22.11.: „generier nur die Sponsorenwappen, die gerade genutzt werden, und bau die auf den
 * Seiten ein“). Ein Wappen je Dachmarke liegt als 96x96-PNG unter `public/sprites/sponsoren/<brandId>.png`
 * (PixelLab, Herkunft in `quellen.json` daneben, bestellt mit `scripts/pixellab-sponsor-wappen.py`).
 *
 * Es gibt NICHT fuer alle 200 Dachmarken ein Wappen, nur fuer die, die in den aktiven Spielstaenden unter Vertrag
 * standen. Jede Anzeige fragt deshalb `sponsorWappenPfad` und faellt ohne Wappen auf das Monogramm zurueck.
 * Das Wappen traegt keine Schrift (Ausnahme Probe-Wappen `red-stag-energy`, dessen Schrift zum Spielnamen passt);
 * der Name steht immer als Text daneben, damit auf dem Wappen nie etwas anderes steht als im Spiel.
 *
 * Die Liste ist bewusst eine Konstante und kein Dateisystem-Blick: sie wird auch im Browser gebraucht.
 * `tests/sponsor-wappen.test.ts` haelt sie mit den Dateien und mit `quellen.json` deckungsgleich.
 */
export const SPONSOR_WAPPEN_IDS: ReadonlySet<string> = new Set([
  "adobe-creative",
  "alphasearch-global",
  "apple-core",
  "basf-chemie",
  "bertelsmann-content",
  "canon-imaging",
  "carlsberg-brewery",
  "chrysler-motors",
  "conrad-elektronik",
  "deichmann-schuhe",
  "deutsche-bank",
  "douglas-beauty",
  "dr-oetker",
  "enbw-strom",
  "evonik-materials",
  "ferrari-corse",
  "fiat-automobili",
  "fischer-duebelwerke",
  "fressnapf-tierbedarf",
  "general-motors",
  "hannover-rueck",
  "hella-fahrzeuglicht",
  "hermes-paket",
  "hilti-befestigung",
  "hornbach-co",
  "hp-hardware",
  "infineon-chips",
  "jaguar-land-rover",
  "kuehne-nagel-fracht",
  "kuka-automation",
  "leica-kamera",
  "loreal-cosmetics",
  "mahle-motoren",
  "metaworld-social",
  "miele-hausgeraete",
  "montblanc-writing",
  "netto-markendiscount",
  "nike-just-do-it",
  "penny-markt",
  "porsche-holding",
  "prosieben-media",
  "rainforest-commerce",
  "red-stag-energy",
  "reebok-athletics",
  "renault-mobility",
  "rewe-united",
  "schaeffler-antrieb",
  "sennheiser-audio",
  "toom-werkstadt",
  "toyota-way",
  "trumpf-lasertechnik",
  "unilever-brands",
  "wdr-sport",
  "webasto-comfort",
  "zalando-fashion",
]);

export const SPONSOR_WAPPEN_ORDNER = "/sprites/sponsoren";

/** Dachmarke aus einer Marken-ID; `sponsorBrandId` traegt die Variante hinter einem Doppelpunkt. */
function dachmarkenId(brandId: string | null | undefined): string | null {
  if (!brandId) return null;
  const id = brandId.split(":")[0]?.trim();
  return id ? id : null;
}

/** Pfad des Wappens einer Dachmarke, oder `null`, wenn es (noch) keines gibt: dann zeigt die Seite das Monogramm. */
export function sponsorWappenPfad(brandId: string | null | undefined): string | null {
  const id = dachmarkenId(brandId);
  return id && SPONSOR_WAPPEN_IDS.has(id) ? `${SPONSOR_WAPPEN_ORDNER}/${id}.png` : null;
}

const DACHMARKE_NACH_NAME = new Map(SPONSOR_BRAND_PARENTS.map((parent) => [parent.name, parent.id]));

/**
 * Wappen zu einem Angebot oder Vertrag. Vorrang hat die `sponsorParentBrandId`, dann die `sponsorBrandId`
 * (Dachmarke vor dem Doppelpunkt), zuletzt der Name (alte Vertraege ohne Marken-ID).
 */
export function sponsorWappenPfadFuer(
  quelle: { sponsorParentBrandId?: string | null; sponsorBrandId?: string | null; name?: string | null } | null | undefined,
): string | null {
  if (!quelle) return null;
  return (
    sponsorWappenPfad(quelle.sponsorParentBrandId) ??
    sponsorWappenPfad(quelle.sponsorBrandId) ??
    sponsorWappenPfad(quelle.name ? DACHMARKE_NACH_NAME.get(quelle.name) : null)
  );
}

/** Rueckfall ohne Wappen: bis zu zwei Anfangsbuchstaben des Namens. */
export function sponsorMonogramm(name: string | null | undefined): string {
  return (
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((teil) => teil[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
