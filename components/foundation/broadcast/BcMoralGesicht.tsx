import "./broadcast.css";

import { klemmeMoral, moralFarbe, moralMund, moralStufe } from "@/lib/morale/moral-anzeige";

/**
 * Moral als Gesicht + Zahl (Chris 18.11.). Eigenes SVG im Broadcast-Stil, kein Emoji-Font: Gesichts-
 * ausdruck (Mundkruemmung, Augen, Brauen) UND Farbe (rot -> bernstein -> gruen) folgen dem Wert 0..100.
 * Funktioniert auch ausserhalb von `.bc` (alle Farben stehen inline).
 */
export function BcMoralGesicht({
  wert,
  mitZahl = true,
  groesse = 18,
  titel,
}: {
  wert: number | null | undefined;
  mitZahl?: boolean;
  groesse?: number;
  titel?: string;
}) {
  const w = klemmeMoral(wert);
  const farbe = moralFarbe(w);
  const stufe = moralStufe(w);
  const mund = moralMund(w);
  const eckeY = 15 - mund * 3.2;
  const mitteY = 15 + mund * 3.6;
  const heiter = w >= 80;
  const wuetend = w < 20;
  const text = titel ?? `Moral ${Math.round(w)}: ${stufe.wort}`;
  return (
    <span className="bc-moral" data-moral-stufe={stufe.id} title={text} style={{ color: farbe }}>
      <svg width={groesse} height={groesse} viewBox="0 0 24 24" role="img" aria-label={text} focusable="false">
        <circle cx="12" cy="12" r="10.2" fill="none" stroke={farbe} strokeWidth="1.8" />
        <circle cx="12" cy="12" r="9" fill={farbe} fillOpacity="0.16" />
        {heiter ? (
          <>
            <path d="M7.2 10 Q8.8 7.8 10.4 10" fill="none" stroke={farbe} strokeWidth="1.7" strokeLinecap="round" />
            <path d="M13.6 10 Q15.2 7.8 16.8 10" fill="none" stroke={farbe} strokeWidth="1.7" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="8.9" cy="9.6" r="1.35" fill={farbe} />
            <circle cx="15.1" cy="9.6" r="1.35" fill={farbe} />
          </>
        )}
        {wuetend ? (
          <>
            <path d="M6.8 6.6 L10.8 8" stroke={farbe} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M17.2 6.6 L13.2 8" stroke={farbe} strokeWidth="1.6" strokeLinecap="round" />
          </>
        ) : null}
        <path
          d={`M7.6 ${eckeY.toFixed(2)} Q12 ${mitteY.toFixed(2)} 16.4 ${eckeY.toFixed(2)}`}
          fill="none"
          stroke={farbe}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {mitZahl ? <b className="bc-moral__zahl">{Math.round(w)}</b> : null}
    </span>
  );
}

/** Form-Pfeil in fünf Stufen (▲▲ heiß .. ▼▼ eiskalt), grün / grau / rot. */
export function BcFormPfeil({ stufe, titel }: { stufe: number; titel?: string }) {
  const s = Math.max(-2, Math.min(2, Math.round(stufe)));
  const symbol = s === 2 ? "▲▲" : s === 1 ? "▲" : s === 0 ? "–" : s === -1 ? "▼" : "▼▼";
  const wort = s === 2 ? "heiß" : s === 1 ? "gut drauf" : s === 0 ? "normal" : s === -1 ? "kalt" : "eiskalt";
  return (
    <span className={`bc-formpfeil ${s > 0 ? "is-auf" : s < 0 ? "is-ab" : "is-mitte"}`} title={titel ?? `Form: ${wort}`} data-form-stufe={s}>
      {symbol}
    </span>
  );
}
