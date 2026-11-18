import KULISSEN_NAMEN from "@/data/generated/arena-kulissen-namen.json";

/**
 * KOPF-HINTERGRUND DER EINSATZLISTE (18.11.): je Disziplin das Kulissenbild, das hinter dem Kopf der
 * modernen Einsatzliste weichgezeichnet und gedimmt liegt (Mockup `einsatzliste-modern-17-11.html`,
 * `.hero .kul`). Nimmt die zum Spieltag gewaehlte Variante (`LineupKulisseAnzeige.varianteId`), sonst
 * die erste Variante der Disziplin. Nur Bilder, die schon unter `public/sprites/kulissen/` liegen
 * (alles PixelLab, Herkunft in `quellen.json` und im Audit 17.11.) -- es wird nichts bestellt.
 *
 * `null` = die Disziplin hat keine Kulisse (Takeshi's Castle: Route aus Bodenkacheln); der Kopf
 * behaelt dann seinen Farbverlauf.
 */
const NAMEN = KULISSEN_NAMEN as Record<string, Array<{ id: string; label: string }>>;

export function einsatzlisteKulisseBild(
  disziplinId: string | null | undefined,
  varianteId?: string | null,
): string | null {
  if (!disziplinId) return null;
  const varianten = NAMEN[disziplinId];
  if (!varianten || varianten.length === 0) return null;
  const treffer = (varianteId ? varianten.find((v) => v.id === varianteId) : null) ?? varianten[0];
  return `/sprites/kulissen/${disziplinId}/${treffer.id}.jpg`;
}
