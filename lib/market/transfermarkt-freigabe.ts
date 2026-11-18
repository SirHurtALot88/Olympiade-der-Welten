/**
 * VORSTAND-FREIGABE: DATENVERTRAG FÜR DIE TRANSFERMARKT-ANZEIGE (Chris, 18.11.).
 *
 *  - Das Geld bleibt auf dem Konto; freigegeben sind nur X % zum Ausgeben, für Ablöse UND Gehälter.
 *  - Die Sperre ist HART: übersteigt ein Kauf oder Vertrag den freien Betrag, ist der Abschluss gesperrt.
 *  - Verkaufserlöse werden nur zu X % frei (bei 70 % sind von 20 C Erlös 14 C ausgebbar, 6 C bleiben gesperrt).
 *
 * Die echten Zahlen liefert die Finanzen-Stufe 3 (`claude/finanzen-v2-stufe0-3-18-11`). Bis sie auf main ist, liefert
 * der Host `null`, und die Seite zeigt nur den Kontostand. Sobald die Stufe da ist, füllt der Host `TransferFreigabe`
 * aus ihren Werten; Anzeige und Sperre hängen ausschließlich an diesem Typ.
 */

export type TransferFreigabe = {
  /** Anteil 0..1, der freigegeben ist (Vorstand-Stufe). */
  quote: number;
  /** Freigegebener Betrag der Saison in C (Anteil am Kontostand zu Fensterbeginn plus freie Erlös-Anteile). */
  freigegeben: number;
  /** Davon schon für Ablösen und Gehälter ausgegeben. */
  ausgegeben: number;
  /** Warum nur diese Quote, ein Satz („Vertrauen 3,4 · Endrang 11, erwartet 6“). */
  grund: string | null;
};

export type FreigabeAnzeige = TransferFreigabe & {
  kontostand: number;
  frei: number;
  gesperrt: number;
};

export function berechneFreigabeAnzeige(kontostand: number | null, freigabe: TransferFreigabe | null | undefined): FreigabeAnzeige | null {
  if (!freigabe || kontostand == null || !Number.isFinite(kontostand)) return null;
  const frei = Math.max(0, Math.min(kontostand, freigabe.freigegeben - freigabe.ausgegeben));
  return { ...freigabe, kontostand, frei, gesperrt: Math.max(0, kontostand - frei) };
}

/** Kostenbasis für die Freigabe: Ablöse plus das Gehalt der ersten Saison (Ablöse UND Gehälter). */
export function freigabeKosten(abloese: number | null | undefined, jahresgehalt: number | null | undefined): number {
  return Math.max(0, abloese ?? 0) + Math.max(0, jahresgehalt ?? 0);
}

/** Harte Sperre gegen einen freien Betrag: `null` = Abschluss erlaubt, sonst der Grund. */
export function freigabeSperreFuerBetrag(frei: number | null, kosten: number): string | null {
  if (frei == null) return null;
  if (kosten <= frei + 1e-9) return null;
  const f = (x: number) => x.toFixed(1).replace(".", ",");
  return `Die Freigabe des Vorstands reicht nicht: ${f(kosten - frei)} C zu viel (Ablöse plus Gehalt ${f(kosten)} C, frei ${f(frei)} C).`;
}

/** Harte Sperre: ohne Freigabe-Daten gibt es keine. */
export function freigabeSperre(anzeige: FreigabeAnzeige | null, kosten: number): string | null {
  return freigabeSperreFuerBetrag(anzeige ? anzeige.frei : null, kosten);
}

/** Verkaufserlös: nur zur Quote frei, der Rest bleibt gesperrt auf dem Konto. */
export function erloesFreigabe(erloes: number, quote: number): { frei: number; gesperrt: number } {
  const q = Math.max(0, Math.min(1, quote));
  const frei = Math.round(erloes * q * 100) / 100;
  return { frei, gesperrt: Math.round((erloes - frei) * 100) / 100 };
}

/** Stufen nach Vertrauen (Chris bestätigt, 18.11.): ab 6 → 100 %, 4–6 → 85 %, 2,5–4 → 70 %, darunter 50 %. */
export function freigabeQuoteAusVertrauen(vertrauen: number): number {
  if (vertrauen >= 6) return 1;
  if (vertrauen >= 4) return 0.85;
  if (vertrauen >= 2.5) return 0.7;
  return 0.5;
}
