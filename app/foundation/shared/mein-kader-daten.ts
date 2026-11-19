/**
 * DATEN FÜR „MEIN KADER IN ⟨DISZIPLIN⟩“ (UX-Umbau 19.11., PR B). Reine Funktionen für Draft UND Transfermarkt.
 *
 * KEINE NEUE RECHNUNG: Stärke und Rang kommen aus `lib/market/transfermarkt-kaderstaerke.ts` (Ø der besten
 * `KADER_TOP_ANZAHL` Eignungen). Hier wird nur sortiert, der Ausgewählte einsortiert und die Kasse als Zahl aufbereitet.
 * Scouting-Nebel: Eigene Spieler sind exakt bekannt; der Kandidat (ein fremder Spieler) trägt nur die Stufe, die seine Sicht
 * hergibt (`text`), sortiert wird nach seiner Schätzung (`wert`).
 */
import { KADER_TOP_ANZAHL, type KandidatRange, type RangWirkung } from "@/lib/market/transfermarkt-kaderstaerke";
import type { SpielerSicht } from "@/lib/market/transfermarkt-sicht";

export type EigenerSpieler = {
  playerId: string;
  name: string;
  className: string;
  portraitUrl: string | null;
  /** Eignung in der gewählten Disziplin (eigene Spieler: exakt); `null` = keine Bewertung. */
  wert: number | null;
  verletzt?: boolean;
};

export type KandidatEintrag = {
  playerId: string;
  name: string;
  className: string;
  portraitUrl: string | null;
  /** Schätzung (Mitte der Spanne) für die Sortierung. */
  wert: number;
  /** Anzeige: exakte Zahl oder Stufe (`80-89`), je nach Scouting. */
  text: string;
};

export type KaderListenZeile = {
  playerId: string;
  name: string;
  className: string;
  portraitUrl: string | null;
  wert: number;
  text: string;
  /** Platz in der Rangliste (nur gesunde Spieler), sonst `null`. */
  platz: number | null;
  neu: boolean;
  /** Rutscht durch den Kandidaten aus den Top 6. */
  raus: boolean;
  /** Jenseits der Top 6 bzw. verletzt: zählt nicht zur Kaderstärke. */
  zaehltNicht: boolean;
  verletzt: boolean;
};

export function baueKaderListe(input: {
  eigene: readonly EigenerSpieler[];
  kandidat: KandidatEintrag | null;
  top?: number;
}): { zeilen: KaderListenZeile[]; trennNach: number | null } {
  const top = input.top ?? KADER_TOP_ANZAHL;
  const mitWert = input.eigene.filter((s): s is EigenerSpieler & { wert: number } => s.wert != null && Number.isFinite(s.wert));
  const gesund = mitWert.filter((s) => !s.verletzt).sort((a, b) => b.wert - a.wert || a.name.localeCompare(b.name, "de"));
  const verletzt = mitWert.filter((s) => s.verletzt).sort((a, b) => b.wert - a.wert || a.name.localeCompare(b.name, "de"));

  type Eintrag = { playerId: string; name: string; className: string; portraitUrl: string | null; wert: number; text: string; neu: boolean };
  const reihe: Eintrag[] = gesund.map((s) => ({ playerId: s.playerId, name: s.name, className: s.className, portraitUrl: s.portraitUrl, wert: s.wert, text: String(Math.round(s.wert)), neu: false }));
  let kandidatIndex = -1;
  if (input.kandidat && !reihe.some((e) => e.playerId === input.kandidat!.playerId)) {
    const k = input.kandidat;
    kandidatIndex = reihe.findIndex((e) => e.wert < k.wert);
    if (kandidatIndex < 0) kandidatIndex = reihe.length;
    reihe.splice(kandidatIndex, 0, { playerId: k.playerId, name: k.name, className: k.className, portraitUrl: k.portraitUrl, wert: k.wert, text: k.text, neu: true });
  }
  // Der Kandidat drängt den bisherigen sechsten aus den Top 6, wenn er selbst hineinkommt.
  const rausIndex = kandidatIndex >= 0 && kandidatIndex < top && reihe.length > top ? top : -1;
  const zeilen: KaderListenZeile[] = reihe.map((e, i) => ({
    ...e,
    platz: i + 1,
    raus: i === rausIndex,
    zaehltNicht: i >= top,
    verletzt: false,
  }));
  for (const s of verletzt) {
    zeilen.push({ playerId: s.playerId, name: s.name, className: s.className, portraitUrl: s.portraitUrl, wert: s.wert, text: String(Math.round(s.wert)), platz: null, neu: false, raus: false, zaehltNicht: true, verletzt: true });
  }
  return { zeilen, trennNach: reihe.length > top ? top : null };
}

/** Spanne des Kandidaten in einer Disziplin aus seiner Sicht (Nebel); `null` = unbekannt. */
export function kandidatSpanne(sicht: SpielerSicht, disziplinId: string): KandidatRange | null {
  const wert = sicht.disziplinen[disziplinId];
  if (!wert || wert.schaetzung == null || wert.von == null || wert.bis == null) return null;
  return { von: wert.von, mitte: wert.schaetzung, bis: wert.bis };
}

/** Die drei Disziplinen mit dem größten Rangsprung (bester Fall), wie im Transfermarkt. */
export function groessteSpruenge(wirkungen: readonly RangWirkung[], anzahl = 3): RangWirkung[] {
  return [...wirkungen]
    .filter((w) => w.nachherBest < w.vorher)
    .sort((a, b) => b.vorher - b.nachherBest - (a.vorher - a.nachherBest))
    .slice(0, anzahl);
}

// ---------------------------------------------------------------------------------------------------------------------
// Kaderzähler als Streifen
// ---------------------------------------------------------------------------------------------------------------------

export type ZaehlerArt = "v" | "n" | "pf" | "op" | "l";

export function baueZaehler(input: { kader: number; kandidatDazu: boolean; pflicht: number; wunsch: number | null; max: number }): {
  segmente: ZaehlerArt[];
  nachher: number;
  /** „noch N Pflichtplätze offen“ bzw. „noch N bis zur Wunschgröße“, sonst `null`. */
  hinweis: { art: "pflicht" | "wunsch"; n: number } | null;
} {
  const nachher = input.kader + (input.kandidatDazu ? 1 : 0);
  const max = Math.max(input.max, nachher, 1);
  const segmente: ZaehlerArt[] = [];
  for (let i = 0; i < max; i += 1) {
    if (i < input.kader) segmente.push("v");
    else if (input.kandidatDazu && i === input.kader) segmente.push("n");
    else if (i < input.pflicht) segmente.push("pf");
    else if (input.wunsch != null && i < input.wunsch) segmente.push("op");
    else segmente.push("l");
  }
  let hinweis: { art: "pflicht" | "wunsch"; n: number } | null = null;
  if (nachher < input.pflicht) hinweis = { art: "pflicht", n: input.pflicht - nachher };
  else if (input.wunsch != null && nachher < input.wunsch) hinweis = { art: "wunsch", n: input.wunsch - nachher };
  return { segmente, nachher, hinweis };
}

// ---------------------------------------------------------------------------------------------------------------------
// Kasse: „frei jetzt“ und „frei nach Pick/Kauf“ als Zahl mit Balken
// ---------------------------------------------------------------------------------------------------------------------

export type KasseSegment = { art: "aus" | "vor" | "frei" | "res" | "fehlt"; wert: number };

export type KasseAnsicht = {
  segmente: KasseSegment[];
  freiJetzt: number;
  /** `null` = nichts ausgewählt. */
  nach: null | { art: "ok" | "reicht-nicht"; frei: number; gebunden: number; fehlt: number };
};

/** Draft: Kasse, schon Gepicktes, dieser Pick, Reserve für die Pflichtplätze. `maxAbloese` = Kasse minus Reserve (aus der Sicht). */
export function baueKasseDraft(input: { kasse: number; ausgegeben: number; reserve: number; preis: number | null; maxAbloese: number }): KasseAnsicht {
  const preis = input.preis;
  const teuer = preis != null && preis > input.maxAbloese + 1e-9;
  const vor = preis != null && !teuer ? preis : 0;
  const gesamt = Math.max(0.01, input.kasse + input.ausgegeben);
  return {
    segmente: [
      { art: "aus", wert: input.ausgegeben / gesamt },
      { art: "vor", wert: vor / gesamt },
      { art: "frei", wert: Math.max(0, input.kasse - input.reserve - vor) / gesamt },
      { art: "res", wert: input.reserve / gesamt },
    ],
    freiJetzt: input.kasse,
    nach:
      preis == null
        ? null
        : teuer
          ? { art: "reicht-nicht", frei: input.kasse, gebunden: input.reserve, fehlt: preis - input.maxAbloese }
          : { art: "ok", frei: input.kasse - preis, gebunden: input.reserve, fehlt: 0 },
  };
}

/** Markt: `frei` = verfügbare Summe (Freigabe bzw. Kasse), `preis` = Ablöse des Ausgewählten. */
export function baueKasseMarkt(input: { frei: number; preis: number | null }): KasseAnsicht {
  const preis = input.preis;
  const gesamt = Math.max(0.01, input.frei, preis ?? 0);
  const deckt = preis != null ? Math.min(preis, input.frei) : 0;
  const fehlt = preis != null ? Math.max(0, preis - input.frei) : 0;
  return {
    segmente: [
      { art: "vor", wert: deckt / gesamt },
      { art: "frei", wert: Math.max(0, input.frei - (preis ?? 0)) / gesamt },
      { art: "fehlt", wert: fehlt / gesamt },
    ],
    freiJetzt: input.frei,
    nach: preis == null ? null : fehlt > 0 ? { art: "reicht-nicht", frei: input.frei, gebunden: 0, fehlt } : { art: "ok", frei: input.frei - preis, gebunden: 0, fehlt: 0 },
  };
}
