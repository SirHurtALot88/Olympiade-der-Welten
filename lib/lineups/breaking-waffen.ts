/**
 * BREAKING: WAFFE FREI WÄHLBAR (Chris, 22.11., docs/design/breaking-tagteam-22-11.md).
 *
 * Keine feste Waffe nach Klassenfarbe: jeder Spieler nutzt in JEDEM Gang genau EINE Waffe und darf sie von Gang zu Gang
 * wechseln. Der Manager kann je Spieler eine Folge vorgeben (`LineupDraftModifierSide.breakingWaffen[spielerId]`, Index = eigener
 * Gang, die Folge wiederholt sich); was er nicht setzt (`null`), füllt die KI deterministisch (Konterwahl gegen den
 * Aushalte-Kanal des aktuellen Gegners) — dieselbe Logik für KI-Teams und delegierte Bereiche („Mensch überschreibt,
 * KI respektiert“). Alle drei Waffen haben dasselbe Schadensbudget je Phase; sie unterscheiden sich nur im Profil und im
 * Kanal, den sie beim Aushaltenden prüfen. Die Zahlen stehen im Motor (`TT_WAFFEN_KONSTANTE` in
 * public/mockups/battle-mode.engine.js); diese Datei trägt Kennung und Texte, ein Test hält beide Listen deckungsgleich.
 */
export const BREAKING_DISCIPLINE_ID = "breaking";

export type BreakingWaffenId = "wucht" | "hieb" | "zermuerbung";

export type BreakingWaffe = {
  id: BreakingWaffenId;
  name: string;
  /** Ein Satz Profil, kein Zahlwert. */
  profil: string;
  /** Welcher Teilwert des Aushaltenden dagegenhält. */
  kanal: "SPITZENMOMENT" | "TECHNIK" | "NERVEN";
};

export const BREAKING_WAFFEN: readonly BreakingWaffe[] = Object.freeze([
  Object.freeze({ id: "wucht" as const, name: "Wucht", profil: "Wenige schwere Schläge, die Hälfte des Schadens erholt sich auf der Bank.", kanal: "SPITZENMOMENT" as const }),
  Object.freeze({ id: "hieb" as const, name: "Hieb", profil: "Kurze, scharfe Schläge, die Hälfte des Schadens erholt sich auf der Bank.", kanal: "TECHNIK" as const }),
  Object.freeze({ id: "zermuerbung" as const, name: "Zermürbung", profil: "Viele kleine Anschläge, der Schaden bleibt.", kanal: "NERVEN" as const }),
]);

/** Die Folge je Spieler höchstens so lang (der Motor wiederholt sie). */
export const BREAKING_WAFFENFOLGE_MAX = 6;

export function istBreakingWaffenId(wert: unknown): wert is BreakingWaffenId {
  return typeof wert === "string" && BREAKING_WAFFEN.some((w) => w.id === wert);
}

/**
 * Nur gültige Kennungen werden angenommen; alles andere (fehlend, Tippfehler, andere Disziplin) ist `null` = die KI wählt.
 * Liefert `null`, wenn kein einziger Eintrag gesetzt ist (dann bleibt der Aufstellungseintrag exakt der alte).
 */
export function normalisiereBreakingWaffen(folge: unknown): Array<string | null> | null {
  if (!Array.isArray(folge)) return null;
  const bereinigt = folge.slice(0, BREAKING_WAFFENFOLGE_MAX).map((w) => (istBreakingWaffenId(w) ? w : null));
  return bereinigt.some((w) => w !== null) ? bereinigt : null;
}
