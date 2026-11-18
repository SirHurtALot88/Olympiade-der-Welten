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
  /** Einsatz-Slots je Auftritt (Mittel über alle Auftritte, gerundet); `null`, wenn der Spielplan sie nicht nennt. */
  slots: number | null;
  /** Vorkommen × Slots: wie viele Einsatzplätze die Saison in dieser Disziplin zu besetzen hat. */
  wichtigkeit: number;
};

export type DisziplinBedarf = Record<string, BedarfEintrag>;

export function baueDisziplinBedarf(eintraege: ReadonlyArray<ReadonlyArray<BedarfSlot | null | undefined>>): DisziplinBedarf {
  const summe: Record<string, { vorkommen: number; slotSumme: number; slotAnzahl: number }> = {};
  for (const spieltag of eintraege) {
    for (const slot of spieltag) {
      if (!slot?.disciplineId) continue;
      const z = (summe[slot.disciplineId] ??= { vorkommen: 0, slotSumme: 0, slotAnzahl: 0 });
      z.vorkommen += 1;
      if (typeof slot.playerCount === "number" && Number.isFinite(slot.playerCount) && slot.playerCount > 0) {
        z.slotSumme += slot.playerCount;
        z.slotAnzahl += 1;
      }
    }
  }
  const ergebnis: DisziplinBedarf = {};
  for (const [disciplineId, z] of Object.entries(summe)) {
    const slots = z.slotAnzahl > 0 ? Math.round(z.slotSumme / z.slotAnzahl) : null;
    ergebnis[disciplineId] = { disciplineId, vorkommen: z.vorkommen, slots, wichtigkeit: z.vorkommen * (slots ?? 1) };
  }
  return ergebnis;
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
