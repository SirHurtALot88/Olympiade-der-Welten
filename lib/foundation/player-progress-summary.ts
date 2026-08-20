export type PlayerProgressHistoryRow = {
  seasonId: string | null;
  seasonName: string;
  isActiveSeason: boolean;
  ovr: number | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  /**
   * Einsätze der Saison. Die vier Achsenwerte sind AUFSUMMIERTE Saisonpunkte
   * (`powPoints`…`socPoints`) und wachsen mit jedem Einsatz — ohne diese Zahl lässt sich eine
   * angefangene Saison nicht mit einer vollen vergleichen. Siehe `buildPlayerProgressSummary`.
   */
  appearances: number | null;
};

export type PlayerProgressMetricId = "ovr" | "pow" | "spe" | "men" | "soc";

export type PlayerProgressMetricSummary = {
  id: PlayerProgressMetricId;
  label: string;
  firstValue: number | null;
  lastValue: number | null;
  delta: number | null;
  tone: "positive" | "negative" | "neutral";
  /**
   * `true` für die vier Achsen: ihre Werte sind hier PUNKTE JE EINSATZ, nicht Saisonsummen. Die
   * Anzeige muss das beschriften, sonst steht dort eine Zahl in einer anderen Einheit als erwartet.
   */
  perAppearance: boolean;
};

export type PlayerProgressSummary = {
  firstSeasonName: string;
  lastSeasonName: string;
  lastSeasonIsLive: boolean;
  metrics: PlayerProgressMetricSummary[];
  axisSumDelta: number | null;
  axisSumTone: "positive" | "negative" | "neutral";
};

const METRIC_DEFINITIONS: Array<{ id: PlayerProgressMetricId; label: string }> = [
  { id: "ovr", label: "OVR" },
  { id: "pow", label: "POW" },
  { id: "spe", label: "SPE" },
  { id: "men", label: "MEN" },
  { id: "soc", label: "SOC" },
];

const AXIS_METRIC_IDS: PlayerProgressMetricId[] = ["pow", "spe", "men", "soc"];

function sortHistoryRows<T extends PlayerProgressHistoryRow>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftKey = left.seasonId ?? left.seasonName;
    const rightKey = right.seasonId ?? right.seasonName;
    return leftKey.localeCompare(rightKey, "de", { numeric: true });
  });
}

function resolveDeltaTone(delta: number | null): PlayerProgressMetricSummary["tone"] {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return "neutral";
  }
  return delta > 0 ? "positive" : "negative";
}

function computeDelta(firstValue: number | null, lastValue: number | null) {
  if (firstValue == null || lastValue == null || !Number.isFinite(firstValue) || !Number.isFinite(lastValue)) {
    return null;
  }
  // Zwei Stellen: OVR-Deltas sind ganzzahlig genug, die Achsen tragen jetzt Punkte je Einsatz und
  // brauchen die zweite Stelle (siehe `axisSumDelta`).
  return Number((lastValue - firstValue).toFixed(2));
}

export function formatProgressDelta(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
    signDisplay: "exceptZero",
  }).format(value);
  return formatted;
}

/**
 * DIE ACHSEN SIND PUNKTE, NICHT NIVEAUS — UND PUNKTE MUSS MAN JE EINSATZ VERGLEICHEN.
 *
 * GEMELDET VON CHRIS (`diwdvh`, „Team · Spieler"): „bei PP Entwicklung und Attributentwicklung
 * fehlt der Startwert! so sieht man nicht ob die Spieler sich in S1 schon verbessert haben" —
 * gesehen an Saison 2, SPIELTAG 1.
 *
 * WAS DORT WIRKLICH SCHIEFLAG: `pow`…`soc` sind `powPoints`…`socPoints` aus dem Saison-
 * Schnappschuss, also in dieser Saison GESAMMELTE Punkte. Sie wachsen mit jedem Einsatz. Die
 * Bilanz rechnete letzte Saison minus erste — und wer sie am ersten Spieltag einer neuen Saison
 * ansah, verglich eine volle Saison mit einer, die noch gar nicht stattgefunden hat.
 *
 * AM ABBILD `89rv3s` NACHGEMESSEN (Saison 2, Spieltag 1, Chris' Kader C-C): JEDER Spieler zeigte
 * ein Minus, und zwar allein deshalb —
 *
 *   Spieler   S1 Achsen-PP / Einsätze    S2    Bilanz alt
 *   1579           11,6 / 8               0/0     −11,6
 *   1288            9,6 / 8               0/0      −9,6
 *   2869            8,6 / 8               0/0      −8,6
 *   0598            7,4 / 7               0/0      −7,4
 *
 * Zwölf von zwölf Spielern im tiefen Minus, ohne dass ein einziger schlechter geworden wäre.
 *
 * CHRIS' ENTSCHEIDUNG (Weg b): auf PUNKTE JE EINSATZ umstellen. Das leistet zweierlei — eine
 * angefangene Saison wird mit einer vollen vergleichbar, UND am Spieltag 0 gibt es gar keinen
 * Wert mehr statt eines falschen: ohne Einsatz keine Aussage.
 *
 * OVR BLEIBT, WIE ES IST. Es ist ein Niveau und keine Summe; „OVR je Einsatz" wäre sinnlos.
 * Deshalb trägt jede Kennzahl `perAppearance` — die Anzeige muss die Einheit dranschreiben.
 */
function resolveMetricValue<T extends PlayerProgressHistoryRow>(
  row: T,
  id: PlayerProgressMetricId,
  perAppearance: boolean,
): number | null {
  const raw = row[id];
  if (raw == null || !Number.isFinite(raw)) {
    return null;
  }
  if (!perAppearance) {
    return raw;
  }
  const appearances = row.appearances;
  // Ohne Einsatz gibt es keinen Punkteschnitt — und „0 Punkte aus 0 Einsätzen" ist keine 0,
  // sondern eine fehlende Angabe. Genau daran hing der gemeldete Fehleindruck.
  if (appearances == null || !Number.isFinite(appearances) || appearances <= 0) {
    return null;
  }
  return Number((raw / appearances).toFixed(2));
}

export function buildPlayerProgressSummary<T extends PlayerProgressHistoryRow>(rows: T[]): PlayerProgressSummary | null {
  const sortedRows = sortHistoryRows(rows);
  if (sortedRows.length === 0) {
    return null;
  }

  const firstRow = sortedRows[0];
  const lastRow = sortedRows[sortedRows.length - 1];

  const metrics = METRIC_DEFINITIONS.map(({ id, label }) => {
    const perAppearance = AXIS_METRIC_IDS.includes(id);
    const firstValue = resolveMetricValue(firstRow, id, perAppearance);
    const lastValue = resolveMetricValue(lastRow, id, perAppearance);
    const delta = computeDelta(firstValue, lastValue);
    return {
      id,
      label,
      firstValue,
      lastValue,
      delta,
      tone: resolveDeltaTone(delta),
      perAppearance,
    };
  });

  const axisDeltas = metrics
    .filter((metric) => AXIS_METRIC_IDS.includes(metric.id))
    .map((metric) => metric.delta)
    .filter((delta): delta is number => delta != null && Number.isFinite(delta));

  // Zwei Nachkommastellen, weil die Achsen jetzt Punkte JE EINSATZ tragen — dort liegen die Werte
  // um 1,0, und eine Stelle würde einen Zuwachs von 0,15 auf 0,2 aufrunden.
  // Bleibt bewusst `null`, solange nicht alle vier Achsen einen Wert haben: am Spieltag 0 einer
  // Saison hat keine von ihnen einen, und eine Teilsumme wäre eine Aussage über nichts.
  const axisSumDelta =
    axisDeltas.length === AXIS_METRIC_IDS.length
      ? Number(axisDeltas.reduce((total, delta) => total + delta, 0).toFixed(2))
      : null;

  return {
    firstSeasonName: firstRow.seasonName,
    lastSeasonName: lastRow.seasonName,
    lastSeasonIsLive: lastRow.isActiveSeason,
    metrics,
    axisSumDelta,
    axisSumTone: resolveDeltaTone(axisSumDelta),
  };
}

export function sortPlayerProgressHistoryRows<T extends PlayerProgressHistoryRow>(rows: T[]): T[] {
  return sortHistoryRows(rows);
}

export const PLAYER_PROGRESS_METRIC_DEFINITIONS = METRIC_DEFINITIONS;
