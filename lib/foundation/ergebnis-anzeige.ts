// =====================================================================================
// Ergebnis-Anzeige (21.11., Spieltagswertung): was als Ergebnis einer Begegnung dasteht.
// =====================================================================================
//
// GEZEIGT = GEBUCHT: nichts wird neu gerechnet. Quelle sind die gebuchten Felder einer Disziplin-Zeile
// (`duellSeiten`, `ergebnisNormiert`/`ergebnisSkala`, `ergebnisAnzeige`, `miniDmPod`). Diese Datei entscheidet nur,
// WIE sie gezeigt werden.
//
// Chris, 19./20.11.: bei Disziplinen, die ueber eine Summe oder Zeit gewertet werden, steht "1:0" -- das ist der
// Siegmarker des Motors, kein Ergebnis. Gezeigt wird stattdessen
//   - Zeitfahren (Zeitsumme) und Staffel (Zielzeit): die beiden Zeiten, Differenz = Vorsprung,
//   - Breaking (Folter-Zweikampf): besiegte Gegner je Seite (z. B. 6 : 5), nicht Ueberlebende "1 : 0",
//   - alle anderen: der native Seitenstand (Punkte, Treffer, Runden, Auftrittssummen, Platzpunkte).
// Die E1-Skala (0-10 je Seite) bleibt als Zusatz: "87 : 79 → 7 : 4".
//
// Aeltere Zeilen tragen `ergebnisAnzeige` nicht. Dann steht fuer Zeitfahren/Staffel/Breaking KEIN erfundener
// Seitenstand, sondern nur Sieg/Niederlage und die Skala.

import type { ErgebnisAnzeigeZahl } from "@/lib/resolve/ergebnis-anzeige-typen";

/** Disziplinen, deren Duell-Seitenstand nur ein Siegmarker "1 : 0" ist und die eine Zeit buchen. */
export const ZEIT_DISZIPLINEN: ReadonlySet<string> = new Set(["time-trial", "staffel"]);
/** Breaking zaehlt besiegte Gegner. */
export const BESIEGT_DISZIPLINEN: ReadonlySet<string> = new Set(["breaking"]);

/**
 * Dehnung der Staffel-Zielzeit (Motor: `ZEIT_DEHNUNG.staffel` in `public/mockups/battle-mode.engine.js`).
 * Die Vierer-Staffel bucht ihre Zielzeit in SIMULATIONS-Sekunden (`miniDmPod.teamWert`); gezeigt wird sie wie
 * im Motor-HUD in angezeigten Sekunden. `tests/ergebnis-anzeige.test.ts` haelt den Wert gegen den Motor.
 */
export const STAFFEL_ZEIT_DEHNUNG = 14.65;

export type ErgebnisArt = "punkte" | "zeit" | "besiegt";

export function ergebnisArtVon(disciplineId: string | null | undefined): ErgebnisArt {
  if (disciplineId && ZEIT_DISZIPLINEN.has(disciplineId)) return "zeit";
  if (disciplineId && BESIEGT_DISZIPLINEN.has(disciplineId)) return "besiegt";
  return "punkte";
}

function komma(wert: number, stellen = 1): string {
  return wert.toFixed(stellen).replace(".", ",");
}

/** Zahl ohne ueberfluessige Nachkommastelle: 78, 7,5. */
export function zahlText(wert: number): string {
  return Number.isInteger(wert) ? String(wert) : komma(Math.round(wert * 10) / 10);
}

/** Sekunden als "5:25,4" ab einer Minute, darunter "24,4" (ohne Einheit, fuer Tabellenzellen). */
export function zeitKurz(sek: number): string {
  const s = Math.max(0, sek);
  if (s < 60) return komma(s);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const gerundet = Math.round(rest * 10) / 10;
  // 59,96 s darf nicht als "0:60,0" enden.
  if (gerundet >= 60) return `${m + 1}:00,0`;
  return `${m}:${gerundet < 10 ? "0" : ""}${komma(gerundet)}`;
}

/** Wie der Motor-HUD: "5:25,4 min" bzw. "24,4 s". */
export function zeitText(sek: number): string {
  return `${zeitKurz(sek)}${sek < 60 ? " s" : " min"}`;
}

export type DuellErgebnisAnzeige = {
  art: ErgebnisArt;
  /** Werte aus Sicht des eigenen Teams als Text ("78", "5:25,4", "6"); `null`, wenn kein Seitenstand gespeichert ist. */
  eigen: string | null;
  gegner: string | null;
  /** "78 : 71", "5:25,4 : 6:55,1", "6 : 5"; `null` ohne gespeicherten Seitenstand. */
  nativ: string | null;
  /** Was die Zahl ist: "Punkte", "Zeitsumme", "Zielzeit", "besiegte Gegner". */
  einheit: string;
  /** Differenz aus Sicht des eigenen Teams, positiv = vorn ("+7", "+1:29,7"); `null` ohne Seitenstand/bei Gleichstand "±0". */
  diff: string | null;
  diffTon: "plus" | "minus" | "null";
  /** E1-Skala "7 : 4"; `null`, wenn die Zeile keine traegt. */
  skala: string | null;
  /** Sieg, Remis, Niederlage nach dem Seitenstand bzw. der Zeit; `null`, wenn nicht entscheidbar. */
  ausgang: "sieg" | "remis" | "niederlage" | null;
  /** Hinweis fuer aeltere Zeilen: warum keine Zahl dasteht. */
  hinweis: string | null;
};

const EINHEIT: Record<ErgebnisArt, (disciplineId: string | null | undefined) => string> = {
  punkte: () => "Punkte",
  zeit: (id) => (id === "staffel" ? "Zielzeit" : "Zeitsumme"),
  besiegt: () => "besiegte Gegner",
};

function ausgangVon(eigen: number, gegner: number, kleinerIstBesser: boolean): "sieg" | "remis" | "niederlage" {
  if (eigen === gegner) return "remis";
  return (eigen < gegner) === kleinerIstBesser ? "sieg" : "niederlage";
}

/**
 * Das Ergebnis eines Duells aus Sicht EINES Teams.
 *
 * @param seiten `duellSeiten` der gebuchten Zeile `[dieses Team, Gegner]`
 * @param anzeige `ergebnisAnzeige` der gebuchten Zeile (Zeit bzw. besiegte Gegner), falls vorhanden
 * @param skala `ergebnisNormiert` der Zeile, NUR wenn `ergebnisSkala === "e1"` (sonst `null` uebergeben)
 */
export function duellErgebnisAnzeige(input: {
  disciplineId: string | null | undefined;
  seiten: readonly [number, number] | null | undefined;
  anzeige?: ErgebnisAnzeigeZahl | null;
  skala?: readonly [number, number] | null;
}): DuellErgebnisAnzeige {
  const art = ergebnisArtVon(input.disciplineId);
  const einheit = EINHEIT[art](input.disciplineId);
  const skala = input.skala ? `${input.skala[0]} : ${input.skala[1]}` : null;
  const seiten = input.seiten ?? null;
  const zahl = input.anzeige && input.anzeige.art === (art === "zeit" ? "zeit" : "besiegt") ? input.anzeige : null;

  if (art === "punkte") {
    if (!seiten) return { art, eigen: null, gegner: null, nativ: null, einheit, diff: null, diffTon: "null", skala, ausgang: null, hinweis: null };
    const d = Math.round((seiten[0] - seiten[1]) * 10) / 10;
    return {
      art,
      eigen: zahlText(seiten[0]),
      gegner: zahlText(seiten[1]),
      nativ: `${zahlText(seiten[0])} : ${zahlText(seiten[1])}`,
      einheit,
      diff: vorzeichen(d, zahlText),
      diffTon: d > 0 ? "plus" : d < 0 ? "minus" : "null",
      skala,
      ausgang: ausgangVon(seiten[0], seiten[1], false),
      hinweis: null,
    };
  }

  const ausgangMarker = seiten ? ausgangVon(seiten[0], seiten[1], false) : null;
  if (!zahl) {
    // Aelterer Spieltag: nur der Siegmarker ist gespeichert -- keine erfundene Zahl.
    return {
      art,
      eigen: null,
      gegner: null,
      nativ: null,
      einheit,
      diff: null,
      diffTon: "null",
      skala,
      ausgang: ausgangMarker,
      hinweis: art === "zeit" ? "Zeiten dieses Spieltags nicht gespeichert" : "besiegte Gegner dieses Spieltags nicht gespeichert",
    };
  }

  const [e, g] = zahl.werte;
  if (art === "zeit") {
    const vorn = Math.round((g - e) * 10) / 10; // positiv = eigenes Team schneller
    return {
      art,
      eigen: zeitKurz(e),
      gegner: zeitKurz(g),
      nativ: `${zeitKurz(e)} : ${zeitKurz(g)}`,
      einheit,
      diff: vorzeichen(vorn, zeitKurz),
      diffTon: vorn > 0 ? "plus" : vorn < 0 ? "minus" : "null",
      skala,
      ausgang: ausgangVon(e, g, true),
      hinweis: null,
    };
  }
  const d = e - g;
  return {
    art,
    eigen: zahlText(e),
    gegner: zahlText(g),
    nativ: `${zahlText(e)} : ${zahlText(g)}`,
    einheit,
    diff: vorzeichen(d, zahlText),
    diffTon: d > 0 ? "plus" : d < 0 ? "minus" : "null",
    skala,
    ausgang: ausgangMarker ?? ausgangVon(e, g, false),
    hinweis: null,
  };
}

function vorzeichen(wert: number, format: (x: number) => string): string {
  if (Math.abs(wert) < 0.05) return "±0";
  return `${wert > 0 ? "+" : "−"}${format(Math.abs(wert))}`;
}

/** "78 : 71 → 7 : 4", "5:25,4 : 6:55,1 min → 8 : 5", bzw. nur die Skala, wenn kein Seitenstand gespeichert ist. */
export function duellErgebnisText(a: DuellErgebnisAnzeige): string {
  const nativ = a.nativ ? (a.art === "punkte" ? a.nativ : `${a.nativ} ${a.einheit}`) : "";
  if (nativ && a.skala) return `${nativ} → ${a.skala}`;
  return nativ || a.skala || "";
}

/**
 * Gruppenwert eines Platzes in der Vierergruppe: bei der Staffel die Zielzeit (gebucht in Simulationssekunden,
 * gezeigt gedehnt wie im Motor-HUD), sonst die Zahl (Burgpunkte, FFA-Wert, Kontrollpunkte).
 */
export function gruppenWertText(disciplineId: string | null | undefined, wert: number | null | undefined): string | null {
  if (wert == null || !Number.isFinite(wert)) return null;
  if (disciplineId === "staffel") return zeitKurz(wert * STAFFEL_ZEIT_DEHNUNG);
  return zahlText(wert);
}
