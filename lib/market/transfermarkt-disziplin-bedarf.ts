/**
 * WAS IST DIESE SAISON WICHTIG? (Chris, 18.11.): „Kann man beim Draften und Kaufen sehen, welche Diszis für die Saison
 * wichtig sind und wie viele Slots die haben und wie stark der eigene Kader ist?“
 *
 * Rein funktional über dem Spielplan (`getSeasonDisciplineSchedule`): je Disziplin, wie oft sie in der Saison
 * drankommt, wie viele Einsatz-Slots ein Auftritt hat, und daraus eine Wichtigkeit. Mit dem Liga-Rang der eigenen
 * Kaderstärke ergibt sich ein kleiner Bedarfs-Hinweis. Der Draft-Neubau bekommt später denselben Block.
 */

export type BedarfSlot = {
  disciplineId: string;
  playerCount: number | null;
};

export type BedarfEintrag = {
  disciplineId: string;
  /** Wie oft die Disziplin in dieser Saison im Spielplan steht (Spieltage bzw. Duelle). */
  vorkommen: number;
  /**
   * Einsatz-Slots je Auftritt (Mittel über alle Auftritte, gerundet); `null`, wenn der Spielplan sie nicht nennt.
   * NICHT zur Anzeige: je Saisonhälfte hat eine Disziplin eigene Slots (Basketball z. B. 4 und 3), das Mittel
   * verwischt die feste Verteilung 2–6 je Bereich (Chris, 19.11.). Anzeige über `auftritte[].slots`.
   */
  slots: number | null;
  /** Summe der Slots aller Auftritte: wie viele Einsatzplätze die Saison in dieser Disziplin zu besetzen hat. */
  wichtigkeit: number;
  /**
   * Wann sie drankommt (Chris, 19.11.: „bei Saison sollte stehen an welchem Slot in der Season die Diszi dran kommt“):
   * `spieltag` 1-basiert, `platz` = Disziplin 1 oder 2 des Spieltags, `nr` = laufende Nummer über die ganze Saison.
   */
  auftritte: Array<{ spieltag: number; platz: number; nr: number; slots: number | null }>;
};

export type DisziplinBedarf = Record<string, BedarfEintrag>;

export function baueDisziplinBedarf(eintraege: ReadonlyArray<ReadonlyArray<BedarfSlot | null | undefined>>): DisziplinBedarf {
  const summe: Record<string, { vorkommen: number; slotSumme: number; slotAnzahl: number; auftritte: BedarfEintrag["auftritte"] }> = {};
  let nr = 0;
  eintraege.forEach((spieltag, tagIndex) => {
    spieltag.forEach((slot, platzIndex) => {
      nr += 1;
      if (!slot?.disciplineId) return;
      const z = (summe[slot.disciplineId] ??= { vorkommen: 0, slotSumme: 0, slotAnzahl: 0, auftritte: [] });
      z.vorkommen += 1;
      const anzahl = typeof slot.playerCount === "number" && Number.isFinite(slot.playerCount) && slot.playerCount > 0 ? slot.playerCount : null;
      z.auftritte.push({ spieltag: tagIndex + 1, platz: platzIndex + 1, nr, slots: anzahl });
      if (anzahl != null) {
        z.slotSumme += anzahl;
        z.slotAnzahl += 1;
      }
    });
  });
  const ergebnis: DisziplinBedarf = {};
  for (const [disciplineId, z] of Object.entries(summe)) {
    const slots = z.slotAnzahl > 0 ? Math.round(z.slotSumme / z.slotAnzahl) : null;
    ergebnis[disciplineId] = { disciplineId, vorkommen: z.vorkommen, slots, wichtigkeit: z.auftritte.reduce((sum, a) => sum + (a.slots ?? 1), 0), auftritte: z.auftritte };
  }
  return ergebnis;
}

/** Kurzform für die Spalte „Saison“: „ST 3“, bei mehreren Auftritten „ST 3 · 11“. */
export function spielplanKurz(eintrag: BedarfEintrag | undefined): string {
  if (!eintrag || eintrag.auftritte.length === 0) return "–";
  return `ST ${eintrag.auftritte.map((a) => a.spieltag).join(" · ")}`;
}

/** Langform für Tooltips: „Spieltag 3, 2. Disziplin, 4 Slots (Platz 6 von 20 im Spielplan)“. */
export function spielplanLang(eintrag: BedarfEintrag | undefined, slotsGesamt: number): string {
  if (!eintrag || eintrag.auftritte.length === 0) return "nicht im Spielplan";
  return eintrag.auftritte
    .map(
      (a) =>
        `Spieltag ${a.spieltag}, ${a.platz}. Disziplin, ${a.slots ?? "?"} Slots (Platz ${a.nr}${slotsGesamt > 0 ? ` von ${slotsGesamt}` : ""} im Spielplan)`,
    )
    .join("; ");
}

/** Slots je Auftritt als Kurzform: „4 · 3“. */
export function slotsKurz(eintrag: BedarfEintrag | undefined): string {
  if (!eintrag || eintrag.auftritte.length === 0) return "–";
  return eintrag.auftritte.map((a) => a.slots ?? "?").join(" · ");
}

/** Sortierschlüssel „in der Reihenfolge, in der die Diszis drankommen“: erster Auftritt, nicht im Spielplan ans Ende. */
export function ersterAuftritt(eintrag: BedarfEintrag | undefined): number {
  return eintrag?.auftritte[0]?.nr ?? Number.POSITIVE_INFINITY;
}

export type BedarfUrteil = { art: "luecke" | "solide" | "stark" | "selten" | "offen"; text: string };

/**
 * Bedarfs-Hinweis aus Häufigkeit und eigenem Liga-Rang. `ligaGroesse` = Teams der Liga.
 * „häufig“ = mindestens so oft wie der Schnitt aller Disziplinen; „schwach“ = untere Hälfte der Liga.
 */
export function bedarfUrteil(input: { eintrag: BedarfEintrag | undefined; schnittVorkommen: number; rang: number; ligaGroesse: number }): BedarfUrteil {
  const { eintrag, rang, ligaGroesse } = input;
  if (!eintrag) return { art: "offen", text: "Spielplan kennt diese Disziplin noch nicht." };
  const haeufig = eintrag.vorkommen >= Math.max(2, input.schnittVorkommen);
  const schwach = rang > Math.ceil(ligaGroesse / 2);
  const stark = rang <= Math.max(1, Math.floor(ligaGroesse / 4));
  if (haeufig && schwach) return { art: "luecke", text: "häufig, aber schwach besetzt" };
  if (haeufig && stark) return { art: "stark", text: "häufig und stark besetzt" };
  if (haeufig) return { art: "solide", text: "häufig, solide besetzt" };
  if (schwach) return { art: "selten", text: "selten, schwach besetzt" };
  return { art: "selten", text: "selten, kein Handlungsdruck" };
}

export function schnittVorkommen(bedarf: DisziplinBedarf): number {
  const werte = Object.values(bedarf).map((e) => e.vorkommen);
  return werte.length === 0 ? 0 : werte.reduce((a, b) => a + b, 0) / werte.length;
}
