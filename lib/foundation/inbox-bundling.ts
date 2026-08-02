/**
 * BÜNDELUNG (docs/INBOX_KONZEPT.md, Stufe 2).
 *
 * Gemeldet war: „drei Schritte, ein Ziel — die Inbox fühlt sich an, als führe alles an denselben
 * Ort." Der Grund ist nicht die Navigation, sondern die Zählweise: der Service erzeugt eine Karte
 * je BEDINGUNG, nicht je ENTSCHEIDUNG. Aufstellung setzen, bestätigen und Formkarten erzeugen sind
 * drei Bedingungen, aber ein Vorgang — und ein belasteter Spieler kann drei Karten auslösen, die
 * dieselbe Person meinen.
 *
 * Hier werden Karten zusammengefasst, die zusammengehören. Zwei Regeln gelten dabei:
 *
 *  1. **Nichts geht verloren.** Eine Bündelung, die eine Quick-Action wegnimmt, ist keine
 *     Aufräumaktion, sondern eine Verschlechterung. Deshalb wird der Belastungs-Report je SPIELER
 *     gebündelt und nicht je Team: so bleibt `playerId` erhalten und „Training leicht" funktioniert
 *     weiter.
 *  2. **Der Fortschritt bleibt sichtbar.** Aus drei Schritten wird nicht „1 Aufgabe", sondern
 *     „Schritt 2 von 3" mit dem Namen des Schritts, an dem man steht.
 */
import type { GameInboxItem } from "@/lib/data/olyDataTypes";

/** Prefix der gebündelten Aufstellungs-Karte. Auch in den Auto-Resolve-Prefixes hinterlegt. */
export const MATCHDAY_PREP_BUNDLE_PREFIX = "matchday_prep_bundle";
/** Prefix der gebündelten Belastungs-Karte je Spieler. */
export const PLAYER_HEALTH_BUNDLE_PREFIX = "player_health_bundle";
/** Prefix der gebündelten Scouting-Wochennotiz je Team. */
export const SCOUT_BUNDLE_PREFIX = "scout_milestone_bundle";

/**
 * Die drei Schritte der Spieltagsvorbereitung, in der Reihenfolge, in der man sie durchläuft.
 * Die Reihenfolge ist nicht kosmetisch: der Service erzeugt Schritt 2 und 3 überhaupt erst, wenn
 * Schritt 1 erfüllt ist — die Karte muss also denselben Weg beschreiben.
 */
const MATCHDAY_PREP_STEPS = [
  { prefix: "lineup_missing", label: "Aufstellung setzen" },
  { prefix: "formcards_open", label: "Formkarten erzeugen" },
  { prefix: "lineup_not_submitted", label: "Aufstellung bestätigen" },
] as const;

const PLAYER_HEALTH_SOURCES = new Set([
  "player_health_fatigue_risk",
  "player_health_lineup_rest",
  "player_health_training_load",
]);

function itemIdPrefix(itemId: string) {
  return itemId.split(":")[0] ?? itemId;
}

function severityRank(severity: GameInboxItem["severity"]) {
  return severity === "critical" ? 0 : severity === "warning" ? 1 : 2;
}

/** Die lauteste Schwere einer Gruppe — eine kritische Karte darf nicht in „info" verschwinden. */
function worstSeverity(items: GameInboxItem[]): GameInboxItem["severity"] {
  return [...items].sort((left, right) => severityRank(left.severity) - severityRank(right.severity))[0]!.severity;
}

function bundleKey(item: GameInboxItem, extra?: string | null) {
  return [item.teamId ?? "global", item.seasonId, extra ?? ""].join("|");
}

/**
 * Aus den drei Aufstellungs-Schritten wird eine Karte mit Fortschritt.
 *
 * Erledigt ist sie erst, wenn ALLE Schritte erledigt sind — sonst würde ein „done" den offenen Rest
 * verstecken, was genau der Fehler wäre, den die Auto-Resolve-Sperre (#43) verhindern soll.
 */
function bundleMatchdayPrep(group: GameInboxItem[]): GameInboxItem {
  const byPrefix = new Map(group.map((item) => [itemIdPrefix(item.itemId), item] as const));
  const ordered = MATCHDAY_PREP_STEPS.map((step) => ({ step, item: byPrefix.get(step.prefix) })).filter(
    (entry): entry is { step: (typeof MATCHDAY_PREP_STEPS)[number]; item: GameInboxItem } => entry.item != null,
  );

  const total = ordered.length;
  const doneCount = ordered.filter((entry) => entry.item.status === "done").length;
  const current = ordered.find((entry) => entry.item.status !== "done") ?? null;
  const allDone = current == null;

  // Das Ziel kommt vom Schritt, an dem man WIRKLICH steht — sonst landet man auf einer erledigten
  // Teilaufgabe und fragt sich, was man hier soll.
  const anchor = current?.item ?? ordered[ordered.length - 1]!.item;

  return {
    ...anchor,
    itemId: `${MATCHDAY_PREP_BUNDLE_PREFIX}:${anchor.saveId}:${anchor.seasonId}:${anchor.matchday ?? "md"}:${anchor.teamId ?? "team"}`,
    category: "task",
    severity: allDone ? "info" : worstSeverity(ordered.filter((entry) => entry.item.status !== "done").map((entry) => entry.item)),
    status: allDone ? "done" : "open",
    title: allDone ? "Spieltag vorbereitet" : "Spieltag vorbereiten",
    description: allDone
      ? `Alle ${total} Schritte erledigt.`
      : `Schritt ${doneCount + 1} von ${total} — ${current!.step.label}.`,
    ctaLabel: allDone ? null : current!.step.label,
  };
}

/** Mehrere Belastungs-Hinweise zu EINEM Spieler werden eine Karte — `playerId` bleibt erhalten. */
function bundlePlayerHealth(group: GameInboxItem[]): GameInboxItem {
  const worst = [...group].sort((left, right) => severityRank(left.severity) - severityRank(right.severity))[0]!;
  // Die lauteste Karte gibt Titel, Ziel und Quick-Action vor; die übrigen liefern ihren Satz dazu.
  const extraLines = group.filter((item) => item.itemId !== worst.itemId).map((item) => item.title);
  return {
    ...worst,
    itemId: `${PLAYER_HEALTH_BUNDLE_PREFIX}:${worst.saveId}:${worst.seasonId}:${worst.teamId ?? "team"}:${worst.playerId ?? "player"}`,
    description: extraLines.length > 0 ? `${worst.description} Außerdem: ${extraLines.join(", ")}.` : worst.description,
  };
}

/** Scouting-Meilensteine eines Teams werden zu einer Wochennotiz. */
function bundleScoutMilestones(group: GameInboxItem[]): GameInboxItem {
  const template = group[0]!;
  const names = group
    .map((item) => item.description.split(":")[0]?.trim())
    .filter((name): name is string => Boolean(name));
  const shown = names.slice(0, 3).join(", ");
  return {
    ...template,
    itemId: `${SCOUT_BUNDLE_PREFIX}:${template.saveId}:${template.seasonId}:${template.teamId ?? "team"}`,
    playerId: null,
    title: `${group.length} Scouting-Reports sind schärfer geworden`,
    description: `${shown}${names.length > 3 ? ` und ${names.length - 3} weitere` : ""}.`,
  };
}

type BundleSpec = {
  /** Gehört diese Karte in diesen Topf? */
  match: (item: GameInboxItem) => boolean;
  /** Woran erkennt man, dass zwei Karten in denselben Topf gehören? */
  key: (item: GameInboxItem) => string;
  /** Ab wie vielen Karten lohnt sich das Bündeln? */
  minSize: number;
  build: (group: GameInboxItem[]) => GameInboxItem;
};

const BUNDLES: BundleSpec[] = [
  {
    match: (item) => MATCHDAY_PREP_STEPS.some((step) => itemIdPrefix(item.itemId) === step.prefix),
    key: (item) => bundleKey(item, `prep:${item.matchday ?? ""}`),
    // Schon zwei Schritte sind eine Wiederholung derselben Aufgabe.
    minSize: 2,
    build: bundleMatchdayPrep,
  },
  {
    match: (item) => PLAYER_HEALTH_SOURCES.has(item.source),
    key: (item) => bundleKey(item, `health:${item.playerId ?? ""}`),
    minSize: 2,
    build: bundlePlayerHealth,
  },
  {
    match: (item) => item.source === "scout_intel_pipeline",
    // Eine einzelne Meldung darf ihren Spielernamen behalten; ab drei wird es eine Notiz.
    key: (item) => bundleKey(item, "scout"),
    minSize: 3,
    build: bundleScoutMilestones,
  },
];

/**
 * Zusammenfassen, was zusammengehört. Karten ohne Topf gehen unverändert durch, und ein Topf mit
 * zu wenig Inhalt wird wieder aufgelöst — eine „Bündelung" von einer Karte ist nur ein
 * schlechterer Titel.
 */
export function bundleInboxItems(items: GameInboxItem[]): GameInboxItem[] {
  const buckets = new Map<string, { spec: BundleSpec; group: GameInboxItem[] }>();
  // `order` merkt sich, an welcher Stelle die erste Karte eines Topfes stand — die gebündelte Karte
  // nimmt genau diesen Platz ein, damit die Sortierung des Aufrufers erhalten bleibt.
  const order: Array<{ kind: "item"; item: GameInboxItem } | { kind: "bucket"; key: string }> = [];

  for (const item of items) {
    const spec = BUNDLES.find((candidate) => candidate.match(item));
    if (!spec) {
      order.push({ kind: "item", item });
      continue;
    }
    const key = `${BUNDLES.indexOf(spec)}#${spec.key(item)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.group.push(item);
      continue;
    }
    buckets.set(key, { spec, group: [item] });
    order.push({ kind: "bucket", key });
  }

  const result: GameInboxItem[] = [];
  for (const entry of order) {
    if (entry.kind === "item") {
      result.push(entry.item);
      continue;
    }
    const bucket = buckets.get(entry.key)!;
    if (bucket.group.length < bucket.spec.minSize) {
      result.push(...bucket.group);
      continue;
    }
    result.push(bucket.spec.build(bucket.group));
  }
  return result;
}
