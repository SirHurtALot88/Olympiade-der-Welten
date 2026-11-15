/**
 * Preis- und Marktlinie eines Artikels (Opus 14.11., Punkt 8): eigener VK als Treppe aus dem Preisverlauf,
 * Marktwert (Cardmarket-7-Tage-Schnitt) als Linie, Verkaeufe als Punkte, eine Euro-Achse ueber bis zu 180 Tage.
 * Ohne Verlauf wird nichts gezeichnet (hasData false).
 */
export interface LinienEingabe {
  now: number;
  days?: number;
  /** Aktueller VK (heute), null = unbekannt. */
  currentVk: number | null;
  priceLog: { at: string; before: number; after: number }[];
  market: { at: string; priceAvg7: number | null }[];
  sales: { soldAt: string; qty: number; unitPrice: number }[];
}

export interface Punkt {
  t: number;
  v: number;
}

export interface Linie {
  hasData: boolean;
  from: number;
  to: number;
  vk: Punkt[];
  markt: Punkt[];
  verkaeufe: (Punkt & { qty: number })[];
  min: number;
  max: number;
}

const DAY = 86_400_000;

export function buildPreisLinie(i: LinienEingabe): Linie {
  const days = i.days ?? 180;
  const to = i.now;
  const from = to - days * DAY;
  const log = [...i.priceLog].map((c) => ({ t: Date.parse(c.at), before: c.before, after: c.after })).filter((c) => !Number.isNaN(c.t)).sort((a, b) => a.t - b.t);

  // VK-Treppe: Startwert = Preis vor der ersten Aenderung im Fenster, sonst der aktuelle Preis.
  const vk: Punkt[] = [];
  const inWindow = log.filter((c) => c.t >= from);
  const startVk = inWindow.length > 0 ? inWindow[0].before : (log.length > 0 ? log[log.length - 1].after : i.currentVk);
  if (startVk != null && startVk > 0) {
    vk.push({ t: from, v: startVk });
    for (const c of inWindow) {
      vk.push({ t: c.t, v: c.before });
      vk.push({ t: c.t, v: c.after });
    }
    const last = inWindow.length > 0 ? inWindow[inWindow.length - 1].after : startVk;
    vk.push({ t: to, v: i.currentVk != null && i.currentVk > 0 && inWindow.length === 0 ? i.currentVk : last });
  }

  const markt = i.market
    .map((m) => ({ t: Date.parse(m.at), v: m.priceAvg7 }))
    .filter((m): m is Punkt => m.v != null && m.v > 0 && !Number.isNaN(m.t) && m.t >= from)
    .sort((a, b) => a.t - b.t);
  const verkaeufe = i.sales
    .map((s) => ({ t: Date.parse(s.soldAt), v: s.unitPrice, qty: s.qty }))
    .filter((s) => !Number.isNaN(s.t) && s.t >= from && s.v > 0)
    .sort((a, b) => a.t - b.t);

  const hasVkVerlauf = inWindow.length > 0;
  // Zeichnen nur mit Verlauf: mindestens 2 Marktpunkte oder eine Preisaenderung oder 2 Verkaeufe.
  const hasData = markt.length >= 2 || hasVkVerlauf || verkaeufe.length >= 2;
  const all = [...vk, ...markt, ...verkaeufe].map((p) => p.v);
  return {
    hasData,
    from,
    to,
    vk: hasData ? vk : [],
    markt: markt.length >= 2 ? markt : [],
    verkaeufe,
    min: all.length ? Math.min(...all) : 0,
    max: all.length ? Math.max(...all) : 0,
  };
}
