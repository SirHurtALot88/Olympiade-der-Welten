/**
 * GEHALT GEGEN ÜBLICH — verdient dieser Spieler mehr, als seine Leistung sonst kostet?
 *
 * WARUM NICHT GEHALT GETEILT DURCH LEISTUNG. Der naheliegende Weg waere ein Quotient
 * ("Gehalt je Punkt"). Der misst hier aber keine Wirtschaftlichkeit, sondern nur Leistung:
 * in einem typischen Kader liegen die Gehaelter um Faktor ~1,5 auseinander, die Leistungswerte
 * um Faktor ~20. Der Quotient wird damit fast vollstaendig vom Nenner bestimmt — nach ihm
 * sortiert ergibt sich beinahe dieselbe Reihenfolge wie nach der Leistung allein.
 *
 * Die Folge waere ein systematischer Nachteil fuer schwache Spieler: sie landen immer unten,
 * unabhaengig davon, was sie kosten. Eine Kauf-/Verkaufsempfehlung darauf zu bauen hiesse
 * "abgeben, weil schwach" — nicht "abgeben, weil zu teuer". Das sind verschiedene Aussagen,
 * und nur die zweite ist eine wirtschaftliche.
 *
 * DESHALB DIE ABWEICHUNG. Aus der Grundgesamtheit (moeglichst die ganze Liga, nicht nur der
 * eigene Kader) wird geschaetzt, was ein Spieler dieser Leistung ueblicherweise verdient.
 * Verglichen wird dann das tatsaechliche Gehalt damit. Ein schwacher, billiger Spieler landet
 * so bei ~0 statt am Pranger; auffaellig wird, wer aus der Reihe faellt.
 */

/** Ein Spieler in der Grundgesamtheit: was er kostet, was er leistet, wie lange er gebunden ist. */
export type SalaryBenchmarkSample = {
  /** Jahresgehalt. */
  salary: number;
  /** Leistungsmass — MVS oder PPs, aber ueber die ganze Grundgesamtheit dasselbe. */
  leistung: number;
  /**
   * Restlaufzeit in Saisons. Optional, aber dringend empfohlen — siehe `buildSalaryBenchmark`:
   * lange Vertraege sind oft besser dotiert, und ohne diese Spalte haelt das Modell genau die
   * langfristig gebundenen Spieler faelschlich fuer ueberbezahlt.
   */
  laufzeit?: number | null;
};

/** Die geschaetzte Flaeche "uebliches Gehalt bei dieser Leistung und dieser Bindung". */
export type SalaryBenchmarkModel = {
  /** Gehalt bei Leistung 0 und Laufzeit 0. */
  sockel: number;
  /** Aufschlag je Leistungspunkt. Nie negativ — siehe `buildSalaryBenchmark`. */
  jeLeistungspunkt: number;
  /**
   * Aufschlag je Vertragsjahr. Darf negativ sein: ob eine lange Bindung teurer (Sicherheit fuer
   * den Spieler) oder billiger (Sicherheit fuer den Verein) ist, entscheidet der Markt, nicht
   * die Erwartung des Modells. 0 heisst: die Laufzeit erklaert hier nichts.
   */
  jeVertragsjahr: number;
  /** Zahl der Spieler, auf denen die Schaetzung beruht. */
  stichprobe: number;
};

export type SalaryBenchmarkResult = {
  /** Was ein Spieler dieser Leistung ueblicherweise verdient. */
  ueblich: number;
  /** Tatsaechliches Gehalt minus ueblich. Positiv = teurer als ueblich. */
  abweichung: number;
  /**
   * Die Abweichung im Verhaeltnis zum ueblichen Gehalt (0,15 = 15 % teurer als ueblich).
   * Fuer Schwellen besser geeignet als der absolute Betrag, der mit dem Gehaltsniveau skaliert.
   */
  relativ: number;
};

/**
 * Wie viele Spieler die Schaetzung mindestens braucht. Unter dieser Grenze ist eine Gerade
 * durch die Punktwolke Zahlenmystik — dann lieber gar keine Aussage als eine erfundene.
 */
export const SALARY_BENCHMARK_MIN_STICHPROBE = 6;

function istZahl(wert: number | null | undefined): wert is number {
  return wert != null && Number.isFinite(wert);
}

function runde(wert: number, stellen = 2): number {
  const faktor = 10 ** stellen;
  return Math.round(wert * faktor) / faktor;
}

/**
 * Schaetzt aus der Grundgesamtheit die Gerade "uebliches Gehalt bei dieser Leistung"
 * (kleinste Quadrate). `null`, wenn die Stichprobe zu klein ist oder alle Spieler dieselbe
 * Leistung haben — dann gibt es keine Steigung, die man ablesen koennte.
 *
 * DIE STEIGUNG WIRD BEI NULL ABGESCHNITTEN. Mathematisch kann sie negativ herauskommen (wenn
 * in einer kleinen Stichprobe zufaellig die Schwachen am meisten verdienen). Uebernaehme man
 * das, wuerde das Modell behaupten, mehr Leistung gehoere sich billiger — und jeder starke
 * Spieler erschiene automatisch ueberbezahlt. Eine flache Gerade ist die ehrlichere Aussage:
 * "in dieser Liga haengt das Gehalt nicht an der Leistung".
 */
export function buildSalaryBenchmark(stichprobe: SalaryBenchmarkSample[]): SalaryBenchmarkModel | null {
  const brauchbar = stichprobe.filter(
    (eintrag) => istZahl(eintrag.salary) && istZahl(eintrag.leistung) && eintrag.salary > 0,
  );
  if (brauchbar.length < SALARY_BENCHMARK_MIN_STICHPROBE) return null;

  const anzahl = brauchbar.length;
  const mittelLeistung = brauchbar.reduce((summe, e) => summe + e.leistung, 0) / anzahl;
  const mittelGehalt = brauchbar.reduce((summe, e) => summe + e.salary, 0) / anzahl;

  // ZWEITE ERKLAERENDE GROESSE: DIE LAUFZEIT. Lange Vertraege sind oft besser dotiert — teils
  // weil man sie den Spielern gibt, die man halten will, teils weil eine lange Bindung selbst
  // bezahlt wird. Ohne diese Spalte schoebe das Modell den Laufzeit-Aufschlag der Leistung zu
  // und erklaerte jeden langfristig gebundenen Spieler fuer ueberbezahlt — also ausgerechnet
  // die, an die sich der Verein bewusst gebunden hat.
  const mitLaufzeit = brauchbar.filter((eintrag) => istZahl(eintrag.laufzeit));
  const laufzeitNutzbar = mitLaufzeit.length === anzahl;
  const mittelLaufzeit = laufzeitNutzbar
    ? brauchbar.reduce((summe, e) => summe + (e.laufzeit as number), 0) / anzahl
    : 0;

  let sLL = 0; // Streuung der Leistung
  let sZZ = 0; // Streuung der Laufzeit
  let sLZ = 0; // gemeinsame Streuung
  let sLY = 0; // Leistung gegen Gehalt
  let sZY = 0; // Laufzeit gegen Gehalt
  for (const eintrag of brauchbar) {
    const dL = eintrag.leistung - mittelLeistung;
    const dZ = laufzeitNutzbar ? (eintrag.laufzeit as number) - mittelLaufzeit : 0;
    const dY = eintrag.salary - mittelGehalt;
    sLL += dL * dL;
    sZZ += dZ * dZ;
    sLZ += dL * dZ;
    sLY += dL * dY;
    sZY += dZ * dY;
  }

  // Alle gleich stark → keine Steigung ablesbar. Das uebliche Gehalt ist dann schlicht der
  // Mittelwert, und jede Abweichung davon ist eine echte Abweichung.
  if (sLL <= 0) {
    return { sockel: runde(mittelGehalt), jeLeistungspunkt: 0, jeVertragsjahr: 0, stichprobe: anzahl };
  }

  const nenner = sLL * sZZ - sLZ * sLZ;
  // Die Laufzeit hilft nur, wenn sie ueberhaupt streut UND nicht deckungsgleich mit der Leistung
  // ist. Sonst (alle gleich lang gebunden, oder Laufzeit = Funktion der Leistung) laesst sich ihr
  // Beitrag nicht von dem der Leistung trennen — dann lieber eindimensional als zwei Zahlen, die
  // sich gegenseitig erklaeren.
  const zweidimensional = laufzeitNutzbar && sZZ > 0 && Math.abs(nenner) > 1e-9;

  let jeLeistungspunkt: number;
  let jeVertragsjahr: number;
  if (zweidimensional) {
    jeLeistungspunkt = (sZZ * sLY - sLZ * sZY) / nenner;
    jeVertragsjahr = (sLL * sZY - sLZ * sLY) / nenner;
  } else {
    jeLeistungspunkt = sLY / sLL;
    jeVertragsjahr = 0;
  }

  // Negative Leistungssteigung wird abgeschnitten (Begruendung siehe oben). Faellt sie weg,
  // wird der Laufzeit-Anteil neu bestimmt, damit der Sockel nicht auf eine Steigung baut, die
  // gar nicht mehr im Modell steht.
  if (jeLeistungspunkt < 0) {
    jeLeistungspunkt = 0;
    jeVertragsjahr = zweidimensional && sZZ > 0 ? sZY / sZZ : 0;
  }

  const sockel = mittelGehalt - jeLeistungspunkt * mittelLeistung - jeVertragsjahr * mittelLaufzeit;
  return {
    sockel: runde(sockel),
    jeLeistungspunkt: runde(jeLeistungspunkt, 4),
    jeVertragsjahr: runde(jeVertragsjahr, 4),
    stichprobe: anzahl,
  };
}

/** Wendet das Modell auf einen einzelnen Spieler an. `null`, wenn Gehalt oder Leistung fehlen. */
export function bewerteGehalt(
  modell: SalaryBenchmarkModel | null,
  spieler: { salary: number | null; leistung: number | null; laufzeit?: number | null },
): SalaryBenchmarkResult | null {
  if (!modell) return null;
  if (!istZahl(spieler.salary) || !istZahl(spieler.leistung)) return null;
  // Fehlt die Laufzeit beim einzelnen Spieler, faellt nur ihr Anteil weg — der Rest der
  // Schaetzung bleibt gueltig, statt die ganze Aussage zu verlieren.
  const laufzeitAnteil = istZahl(spieler.laufzeit) ? modell.jeVertragsjahr * spieler.laufzeit : 0;
  // Ein negatives uebliches Gehalt waere Unsinn (kaeme bei stark negativem Sockel und Leistung 0
  // vor); der Sockel selbst ist die Untergrenze dessen, was ueberhaupt gezahlt wird.
  const ueblich = Math.max(0, modell.sockel + modell.jeLeistungspunkt * spieler.leistung + laufzeitAnteil);
  const abweichung = spieler.salary - ueblich;
  return {
    ueblich: runde(ueblich),
    abweichung: runde(abweichung),
    relativ: ueblich > 0 ? runde(abweichung / ueblich, 4) : 0,
  };
}

/**
 * Schwellen fuer die Einordnung. Bewusst relativ (Prozent vom ueblichen Gehalt) statt absolut:
 * ein Betrag, der in der Spitzenklasse Rauschen ist, waere im unteren Kaderdrittel ein Skandal.
 */
export const SALARY_BENCHMARK_SCHWELLE_TEUER = 0.12;
export const SALARY_BENCHMARK_SCHWELLE_GUENSTIG = -0.12;

export type SalaryBenchmarkEinordnung = "teuer" | "ueblich" | "guenstig";

export function ordneGehaltEin(bewertung: SalaryBenchmarkResult | null): SalaryBenchmarkEinordnung | null {
  if (!bewertung) return null;
  if (bewertung.relativ >= SALARY_BENCHMARK_SCHWELLE_TEUER) return "teuer";
  if (bewertung.relativ <= SALARY_BENCHMARK_SCHWELLE_GUENSTIG) return "guenstig";
  return "ueblich";
}

/**
 * DIE EINSATZZEIT-FALLE. Wer wenig gespielt hat, hat wenig Punkte — ohne deshalb schlechter zu
 * sein. Ohne Korrektur liest die Kennzahl einen verletzten oder rotierten Spieler als
 * Minderleister und empfiehlt, ihn abzugeben; das ist derselbe Bias wie beim Quotienten, nur
 * eine Ebene tiefer.
 *
 * Deshalb wird die Leistung auf ein volles Pensum hochgerechnet, bevor sie ins Modell geht.
 * Unterhalb von `mindestEinsaetze` wird NICHT hochgerechnet, sondern `null` geliefert: aus zwei
 * Einsaetzen eine Saison hochzurechnen ist geraten, nicht gemessen — und die Oberflaeche soll
 * "noch keine Aussage" zeigen duerfen statt einer erfundenen Zahl.
 */
export function leistungJeVollemPensum(input: {
  leistung: number | null;
  einsaetze: number | null;
  pensum: number | null;
  mindestEinsaetze?: number;
}): number | null {
  const mindest = input.mindestEinsaetze ?? 3;
  if (!istZahl(input.leistung) || !istZahl(input.einsaetze) || !istZahl(input.pensum)) return null;
  if (input.einsaetze < mindest || input.pensum <= 0) return null;
  if (input.einsaetze >= input.pensum) return runde(input.leistung);
  return runde((input.leistung / input.einsaetze) * input.pensum);
}
