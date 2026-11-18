/**
 * REGIELEISTE DER SPIELTAGS-ARENA (18.11., Mockup `arena-spieltag-modern-18-11.html`) -- reine Logik.
 *
 * Die Leiste steht auf allen Arena-Screens (Laden, Vorstellung, Live, Ergebnis, Wechsel) und zeigt die
 * drei Schritte des Spieltags: Disziplin 1, Disziplin 2, Spieltagswertung. Erledigt = Haken, aktuell =
 * Gold, offen = grau. "Erledigt" heisst GEBUCHT (Save), nicht "Arena lief durch": gezeigt = gebucht.
 */
export type RegieSchrittStatus = "erledigt" | "aktuell" | "offen";

export type RegieSchritt = {
  id: "d1" | "d2" | "wertung";
  label: string;
  /** Name der Disziplin bei D1/D2, sonst `null`. */
  disziplinName: string | null;
  status: RegieSchrittStatus;
};

export function baueRegieSchritte(input: {
  d1: { disciplineId: string | null; name: string | null; gewertet: boolean; geplant: boolean } | null;
  d2: { disciplineId: string | null; name: string | null; gewertet: boolean; geplant: boolean } | null;
  /** Welche Seite die Arena gerade zeigt. */
  aktiveSeite: "d1" | "d2" | "overall";
}): RegieSchritt[] {
  const { d1, d2, aktiveSeite } = input;
  const schritte: RegieSchritt[] = [];
  const seite = (id: "d1" | "d2", daten: typeof d1, nummer: number): RegieSchritt | null => {
    if (!daten || !daten.geplant) return null;
    return {
      id,
      label: `Disziplin ${nummer}`,
      disziplinName: daten.name,
      status: daten.gewertet ? "erledigt" : aktiveSeite === id ? "aktuell" : "offen",
    };
  };
  const s1 = seite("d1", d1, 1);
  const s2 = seite("d2", d2, 2);
  if (s1) schritte.push(s1);
  if (s2) schritte.push(s2);
  const alleErledigt = schritte.length > 0 && schritte.every((schritt) => schritt.status === "erledigt");
  // Aktuell ist immer genau ein Schritt: die gezeigte Seite, sonst (alles gebucht) die Wertung.
  if (!schritte.some((schritt) => schritt.status === "aktuell") && !alleErledigt) {
    const naechster = schritte.find((schritt) => schritt.status === "offen");
    if (naechster) naechster.status = "aktuell";
  }
  schritte.push({
    id: "wertung",
    label: "Spieltagswertung",
    disziplinName: null,
    status: alleErledigt ? "aktuell" : "offen",
  });
  return schritte;
}

export type RegieMitspieler = {
  teamId: string;
  teamName: string;
  /** Anzeigename des Menschen, wenn bekannt. */
  spielerName: string | null;
  istEigen: boolean;
};

/** Eigenes Team zuerst, danach nach Teamname -- stabile Reihenfolge fuer die Leiste. */
export function ordneRegieMitspieler(spieler: readonly RegieMitspieler[]): RegieMitspieler[] {
  return [...spieler].sort(
    (a, b) => Number(b.istEigen) - Number(a.istEigen) || a.teamName.localeCompare(b.teamName, "de-DE"),
  );
}

/**
 * Teamfarben im eigenen Spiel (Mockup): das eigene Team immer Orange, die anderen in Gruppen-Reihenfolge
 * Tuerkis, Violett, Rosa. Rueckgabe je Teamindex der Gruppe.
 */
export const ARENA_TEAMFARBEN = {
  eigen: "#F2A03D",
  andere: ["#3CC8D6", "#9B7BFF", "#FF6FA8"],
} as const;

export function teamfarbeInGruppe(teamIds: readonly string[], ownTeamId: string | null | undefined): Record<string, string> {
  const farben: Record<string, string> = {};
  let i = 0;
  for (const id of teamIds) {
    if (id === ownTeamId) farben[id] = ARENA_TEAMFARBEN.eigen;
    else farben[id] = ARENA_TEAMFARBEN.andere[Math.min(i++, ARENA_TEAMFARBEN.andere.length - 1)];
  }
  return farben;
}
