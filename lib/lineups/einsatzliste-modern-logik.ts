/**
 * LOGIK DER MODERNEN EINSATZLISTE (Welle 1, 17.11.) — reine Funktionen, keine Reaktdinge.
 *
 * Alles, was die Ansicht entscheidet und ohne Browser prüfbar ist: die Verteilung für „Optimieren"
 * und „Auffüllen" (ein Spieler je Spieltag höchstens EINMAL, Entscheidung 4 — der Validator
 * `legacy-lineup-validator.ts` meldet sonst `duplicate_player_usage`), die Prüfung in Sätzen, die
 * Gewichtszeilen der Rollenkarte und der Last-Ton.
 *
 * NUR ANZEIGE/BEDIENUNG: nichts hier liest Resolve oder Motor, es entstehen nur Vorschläge für
 * dieselben Zuweisungen, die der Spieler auch von Hand machen kann.
 */
import { optimaleZuteilung, type SlotWerteJeSpieler } from "@/lib/lineups/einsatzliste-anzeige";
import { uebersetzeLineupFehler } from "@/lib/lineups/lineup-fehlertexte";

export type Seite = "d1" | "d2";

export type VerteilungsSlot = { key: string; side: Seite };

export type Verteilung = {
  /** Vollständige neue Belegung (Slot -> activePlayerId, "" = leer). */
  neu: Record<string, string>;
  /** Nur die Slots, die sich ändern. */
  wechsel: Array<{ slotKey: string; vorher: string; nachher: string }>;
  /** Summe der Platzwerte nachher minus vorher (gleiche Wertetabelle). */
  gewinn: number;
};

function wertVon(werte: Map<string, Map<string, number | null>>, spieler: string, slotKey: string): number | null {
  return werte.get(spieler)?.get(slotKey) ?? null;
}

/**
 * „Optimieren" verteilt den ganzen Kader über beide Disziplinen gemeinsam, „Auffüllen" lässt
 * Gesetztes stehen und füllt nur offene Plätze mit freien Spielern.
 *
 * Captains sind an ihre Seite gebunden (`captain_not_allowed` in der Disziplin, in der sie nicht
 * Captain sind): ihr Wert auf Plätzen der anderen Seite zählt als „nicht einsetzbar".
 */
export function berechneVerteilung(input: {
  modus: "optimieren" | "auffuellen";
  slots: ReadonlyArray<VerteilungsSlot>;
  selections: Readonly<Record<string, string>>;
  werte: SlotWerteJeSpieler;
  ausgeschlossen?: ReadonlySet<string>;
  /** activePlayerId -> Seite, auf der er Captain ist. */
  captainSeite?: ReadonlyMap<string, Seite>;
  nameVon?: (activePlayerId: string) => string;
}): Verteilung {
  // Einmal materialisieren: `Map.entries()` ist ein Einweg-Iterator, und er wird zweimal gelesen.
  const werteListe = [...input.werte];
  const seiteVon = new Map(input.slots.map((slot) => [slot.key, slot.side] as const));
  const tabelle = new Map<string, Map<string, number | null>>();
  for (const [spieler, eintraege] of werteListe) {
    const zeile = new Map<string, number | null>();
    for (const eintrag of eintraege) {
      const captain = input.captainSeite?.get(spieler);
      const erlaubt = !captain || captain === seiteVon.get(eintrag.slotKey);
      zeile.set(eintrag.slotKey, erlaubt && typeof eintrag.projectedScore === "number" ? eintrag.projectedScore : null);
    }
    tabelle.set(spieler, zeile);
  }

  const vergeben = new Set(Object.values(input.selections).filter(Boolean));
  const offene = input.slots.filter((slot) => !input.selections[slot.key]).map((slot) => slot.key);
  const slotKeys = input.modus === "optimieren" ? input.slots.map((slot) => slot.key) : offene;
  const ausgeschlossen = new Set(input.ausgeschlossen ?? []);
  if (input.modus === "auffuellen") for (const id of vergeben) ausgeschlossen.add(id);

  const zuteilung = optimaleZuteilung({
    slotKeys,
    slotWerteJeSpieler: werteListe,
    nameVon: input.nameVon ?? ((id) => id),
    ausgeschlossen,
  });

  const neu: Record<string, string> = { ...input.selections };
  for (const slot of input.slots) if (!(slot.key in neu)) neu[slot.key] = "";
  const gewaehlt = new Set<string>();
  for (const slotKey of slotKeys) {
    const kandidat = zuteilung.jeSlot.get(slotKey);
    const id = kandidat?.id ?? null;
    // Captain-Seite hart prüfen: die optimale Zuteilung kennt die Sperre nur über den Wert.
    if (id && wertVon(tabelle, id, slotKey) != null) {
      neu[slotKey] = id;
      gewaehlt.add(id);
    } else if (input.modus === "optimieren") {
      neu[slotKey] = input.selections[slotKey] && !gewaehlt.has(input.selections[slotKey]!) ? input.selections[slotKey]! : "";
    }
  }
  // Wer beim Optimieren nicht neu vergeben wurde, aber sein Platz verloren hat, wird nicht doppelt gesetzt.
  const gesehen = new Set<string>();
  for (const slot of input.slots) {
    const id = neu[slot.key];
    if (!id) continue;
    if (gesehen.has(id)) neu[slot.key] = "";
    else gesehen.add(id);
  }

  const wechsel: Verteilung["wechsel"] = [];
  let gewinn = 0;
  for (const slot of input.slots) {
    const vorher = input.selections[slot.key] ?? "";
    const nachher = neu[slot.key] ?? "";
    gewinn += (nachher ? (wertVon(tabelle, nachher, slot.key) ?? 0) : 0) - (vorher ? (wertVon(tabelle, vorher, slot.key) ?? 0) : 0);
    if (vorher !== nachher) wechsel.push({ slotKey: slot.key, vorher, nachher });
  }
  return { neu, wechsel, gewinn: Number(gewinn.toFixed(1)) };
}

/** Setzt `spieler` auf `slotKey`; steht er schon irgendwo, wird er dort abgezogen. Wer im Zielplatz stand, rückt in den frei gewordenen Platz (Tausch). */
export function setzeMitTausch(
  selections: Readonly<Record<string, string>>,
  slotKey: string,
  spieler: string,
  nachrueckenErlaubt: (verdraengter: string, freierSlot: string) => boolean = () => true,
): Record<string, string> {
  const neu: Record<string, string> = { ...selections };
  const verdraengter = neu[slotKey] ?? "";
  const alterSlot = Object.keys(neu).find((key) => neu[key] === spieler && key !== slotKey) ?? null;
  if (alterSlot) neu[alterSlot] = "";
  neu[slotKey] = spieler;
  if (alterSlot && verdraengter && verdraengter !== spieler && nachrueckenErlaubt(verdraengter, alterSlot)) {
    neu[alterSlot] = verdraengter;
  }
  return neu;
}

// ================================================================================================
// PRÜFUNG IN SÄTZEN
// ================================================================================================

export type PruefTon = "fehler" | "warnung" | "hinweis" | "ok";

export type Pruefsatz = {
  id: string;
  ton: PruefTon;
  satz: string;
  /** Roher Code (klein dahinter), damit eine In-Game-Meldung ihn nennen kann. */
  code?: string;
  /** Platz, zu dem „Springen" führt. */
  slotKey?: string;
};

type FinishItem = { key: string; label: string; detail: string; tone: string };
type SlotIssue = { label: string; detail: string; tone: string };

export function bauePruefsaetze(input: {
  finishItems: ReadonlyArray<FinishItem>;
  slotIssues: ReadonlyMap<string, ReadonlyArray<SlotIssue>>;
  slots: ReadonlyArray<{ key: string }>;
  selections: Readonly<Record<string, string>>;
  slotName: (slotKey: string) => string;
  playerName: (activePlayerId: string) => string;
  fehlerCodes: ReadonlyArray<string>;
  gesperrtHinweis?: string | null;
  kaderLueckeSatz?: string | null;
}): Pruefsatz[] {
  const saetze: Pruefsatz[] = [];
  const ersterOffener = input.slots.find((slot) => !input.selections[slot.key])?.key;

  for (const item of input.finishItems) {
    const blocked = item.tone === "blocked";
    const warning = item.tone === "warning";
    switch (item.key) {
      case "open-slots":
        if (blocked) saetze.push({ id: item.key, ton: "fehler", satz: `Es sind noch Plätze offen (${item.detail}).`, slotKey: ersterOffener });
        else if (warning) saetze.push({ id: item.key, ton: "warnung", satz: `Plätze bleiben leer, weil niemand mehr frei ist (${item.detail}).`, slotKey: ersterOffener });
        break;
      case "duplicates":
        saetze.push({ id: item.key, ton: "fehler", satz: `Ein Spieler steht doppelt in der Liste (${item.detail}). Pro Spieltag zählt jeder Spieler nur einmal.`, code: "duplicate_player_usage" });
        break;
      case "captain":
        if (blocked) saetze.push({ id: item.key, ton: "fehler", satz: `Das Captain-Limit der Saison ist ausgeschöpft (${item.detail}).` });
        else if (warning) saetze.push({ id: item.key, ton: "hinweis", satz: "Kein Captain gesetzt. Das ist erlaubt, kostet aber den Captain-Bonus." });
        break;
      case "form-source":
        saetze.push({ id: item.key, ton: "hinweis", satz: "Es ist keine Formkarte der Saison mehr verfügbar." });
        break;
      case "morale":
        saetze.push({ id: item.key, ton: "warnung", satz: `Spieler-Forderungen sind offen (${item.detail}).` });
        break;
      case "preview":
        saetze.push({ id: item.key, ton: "warnung", satz: `Die Vorschau meldet Hinweise (${item.detail}).` });
        break;
      default:
        if (blocked) saetze.push({ id: item.key, ton: "fehler", satz: `${item.label}: ${item.detail}` });
        else if (warning) saetze.push({ id: item.key, ton: "warnung", satz: `${item.label}: ${item.detail}` });
    }
  }

  for (const slot of input.slots) {
    const id = input.selections[slot.key];
    if (!id) continue;
    for (const issue of input.slotIssues.get(slot.key) ?? []) {
      const name = input.playerName(id);
      const wo = input.slotName(slot.key);
      if (issue.label === "Verletzt") saetze.push({ id: `${slot.key}-verletzt`, ton: "fehler", satz: `${name} ist verletzt und kann auf ${wo} nicht antreten.`, code: "player_injured_unavailable", slotKey: slot.key });
      else if (issue.label === "Doppelwahl") continue;
      else if (issue.tone === "warning" && (issue.label === "Fatigue-Risiko" || issue.label === "Recovery"))
        saetze.push({ id: `${slot.key}-${issue.label}`, ton: "warnung", satz: `${name} (${wo}): ${issue.detail}`, slotKey: slot.key });
    }
  }

  for (const code of input.fehlerCodes) {
    saetze.push({ id: `code-${code}`, ton: "fehler", satz: uebersetzeLineupFehler(code), code });
  }
  if (input.gesperrtHinweis) saetze.push({ id: "gesperrt", ton: "hinweis", satz: uebersetzeLineupFehler(input.gesperrtHinweis), code: input.gesperrtHinweis });
  if (input.kaderLueckeSatz) saetze.push({ id: "kader-luecke", ton: "warnung", satz: input.kaderLueckeSatz });

  if (!saetze.some((satz) => satz.ton === "fehler" || satz.ton === "warnung")) {
    saetze.unshift({ id: "ok", ton: "ok", satz: "Alles in Ordnung — die Einsatzliste kann abgegeben werden." });
  }
  const rang: Record<PruefTon, number> = { fehler: 0, warnung: 1, hinweis: 2, ok: 3 };
  return saetze.sort((a, b) => rang[a.ton] - rang[b.ton]);
}

// ================================================================================================
// ROLLENKARTE
// ================================================================================================

export type GewichtsZeile = {
  attribut: string;
  gewichtPct: number;
  rolle: "schwerpunkt" | "nebenfokus" | null;
};

/**
 * „Was hier zählt": ALLE Matrixgewichte der Disziplin, absteigend nach Gewicht. Die zwei
 * Rollen-Attribute (Schwerpunkt, Nebenfokus) tragen nur ein Abzeichen und werden NICHT nach oben
 * gezogen (Chris, 17.11.). Das Belastungs-Attribut steht hier nicht, es hat eine eigene Zeile.
 */
export function gewichtsZeilen(
  gewichte: ReadonlyArray<{ attributeKey: string; weightPct: number }>,
  rolle: { majorPositiveAttribute?: string | null; minorPositiveAttribute?: string | null } | null,
): GewichtsZeile[] {
  return gewichte
    .filter((eintrag) => eintrag.weightPct > 0)
    .map((eintrag) => ({
      attribut: eintrag.attributeKey,
      gewichtPct: eintrag.weightPct,
      rolle:
        rolle?.majorPositiveAttribute === eintrag.attributeKey
          ? ("schwerpunkt" as const)
          : rolle?.minorPositiveAttribute === eintrag.attributeKey
            ? ("nebenfokus" as const)
            : null,
    }))
    .sort((a, b) => b.gewichtPct - a.gewichtPct || a.attribut.localeCompare(b.attribut));
}

/** Last in Prozent -> Ton für Balken und Text. */
export function lastTon(last: number | null | undefined): "gut" | "mittel" | "hoch" {
  const wert = last ?? 0;
  return wert >= 65 ? "hoch" : wert >= 40 ? "mittel" : "gut";
}
