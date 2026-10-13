import { hasNoEkData, type ArticleAggregate } from "../dashboard/viewModel";

/**
 * EK-Luecke (COCKPIT_V2_KONZEPT §4 Modul 5): aktive Artikel ohne jeden EK-Anhaltspunkt
 * (weder realisiert noch im Artikelstamm) -- Chris' groesstes Datenproblem (722 aktive Artikel
 * laut Uebergabe 13.10.). Das Cockpit zeigt die Zahl, fordert aber NICHT zur Eingabe auf
 * (reine Anzeige, Leitplanke §0). Definition von "EK fehlt" ist dieselbe wie ueberall:
 * `hasNoEkData` aus dem Dashboard-View-Model.
 */
export interface EkGap {
  /** Aktive Artikel ohne EK. */
  missingActive: number;
  /** Aktive Artikel insgesamt. */
  activeTotal: number;
  /** Anteil der aktiven Artikel ohne EK (0..1). */
  shareOfActive: number;
  /** 90-T-Umsatz der Artikel ohne EK. */
  revenue90Missing: number;
  /** Anteil dieses Umsatzes am gesamten 90-T-Umsatz (0..1). */
  shareOfRevenue90: number;
  /** Artikel ohne EK, die in den letzten 90 T verkauft wurden (dort verzerrt die Luecke am meisten). */
  missingActiveWithSales90: number;
}

export function computeEkGap(articles: ArticleAggregate[]): EkGap {
  let activeTotal = 0;
  let missingActive = 0;
  let revenue90Missing = 0;
  let revenue90Total = 0;
  let missingActiveWithSales90 = 0;
  for (const a of articles) {
    const r90 = a.windows["90"]?.revenue ?? 0;
    revenue90Total += r90;
    if (!a.active) continue;
    activeTotal++;
    if (hasNoEkData(a)) {
      missingActive++;
      revenue90Missing += r90;
      if ((a.windows["90"]?.qty ?? 0) > 0) missingActiveWithSales90++;
    }
  }
  return {
    missingActive,
    activeTotal,
    shareOfActive: activeTotal > 0 ? missingActive / activeTotal : 0,
    revenue90Missing,
    shareOfRevenue90: revenue90Total > 0 ? revenue90Missing / revenue90Total : 0,
    missingActiveWithSales90,
  };
}
