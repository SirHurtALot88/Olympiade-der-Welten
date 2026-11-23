import type { CSSProperties } from "react";

/**
 * Ein Sponsor-Wappen als Pixelbild in fester Kantenlaenge (kein Layoutsprung beim Laden: Breite und Hoehe stehen
 * am Element). Den Pfad liefert `sponsorWappenPfad` / `sponsorWappenPfadFuer` (`lib/sponsor/sponsor-wappen.ts`);
 * ohne Pfad zeichnet der Aufrufer seinen Rueckfall (Monogramm). Der Name steht immer als Text daneben, das Bild ist
 * deshalb reine Zierde (`alt=""`).
 */
export function SponsorWappen({
  pfad,
  kante,
  className,
  style,
}: {
  pfad: string;
  /** Kantenlaenge in CSS-px; die Quelle ist 96x96, ganzzahlige Teiler (96, 48, 32, 24) bleiben am schaerfsten. */
  kante: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`sponsor-wappen${className ? ` ${className}` : ""}`}
      src={pfad}
      alt=""
      width={kante}
      height={kante}
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ width: kante, height: kante, ...style }}
      data-testid="sponsor-wappen"
    />
  );
}
