"use client";

import { useMemo, useState } from "react";
import { getInitials } from "@/lib/foundation/tabs/foundation-format-render-helpers";

import OptimizedMediaImage from "@/app/foundation/OptimizedMediaImage";
import { getClassColorToken } from "@/app/foundation/classVisuals";
import { getPlayerPortraitModel } from "@/lib/foundation/tabs/foundation-page-module-helpers";
import FoundationPlayerPortraitPreview, {
  type FoundationPlayerPortraitPreviewProps,
} from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import {
  NlCard,
  NlDeltaChip,
  NlEmptyState,
  NlFatigueGauge,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  formatNlSignedNumber,
  useCountUp,
} from "@/components/foundation/new-look";
import { NlAbilityStars, VeloIntensityRail, buildTrainingModeSegments } from "@/components/foundation/velo-ui";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import { sortTrainingAttributeForecastByClassProfile } from "@/lib/training/training-forecast-display";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import {
  formatContractShapeLabel,
  formatContractShapeShortLabel,
} from "@/lib/foundation/player-economy-contract";

import type { TrainingCompactClientProps } from "@/app/foundation/training-compact/TrainingCompactClient";
import type {
  TrainingAttributeForecastEntry,
  TrainingDevelopmentFilter,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";
import {
  TrainingBudgetBreakdownDisclosure,
  buildTrainingClassGainRanking,
  buildTrainingIntensityProjection,
  formatSignedPercent,
  getDevelopmentTone,
  type TrainingClassGainEstimate,
} from "@/app/foundation/training-facilities-v2/training-view-shared";

/**
 * "Neuer Look" Training — Steuer-Tabelle (Paket T5) + Klassen-Stat-Vorschau (Paket T6).
 *
 * Konsumiert exakt dieselben Props wie `TrainingCompactClient` und ruft nur die
 * echten Handler auf (`onSetTrainingMode`, `onSetTrainingClass`,
 * `onSetDevelopmentFilter`, `onOpenPlayerDetails`, `onOpenFacilities`, `onOpenTeams`).
 *
 * Aufbau nach Audit-Befunden TR1–TR6 (Mockup `trainingCompact.html`):
 * - EINE Steuer-Tabelle statt acht Riesenkarten: pro Spieler eine Zeile mit der
 *   täglichen Entscheidung (Intensität als Segment), Netto-Forecast, Belastung
 *   und Klassen-Vorschlag. Die 13er-Klassenliste öffnet nur auf Aufklappen.
 * - EINE KPI-Zeile: die Team-Modus-Vorschau ersetzt die Ist-Zahlen live und
 *   trägt dann sichtbar die Marke „Simulation" — geschrieben wird erst über
 *   „Übernehmen" (TR3). Die Simulation nutzt dieselbe Semantik wie die
 *   Ist-Zahlen (angewendetes Training, gleiche Residual-Decke) — kein zweiter
 *   Zahlenbezug.
 * - „Wie kommt das zustande?" ist ein Info-Link im Detail, kein roter
 *   Primärknopf ×8 (TR2).
 * - Der „Forecast"-Unterreiter ist konsolidiert (TR4, FoundationShellRouterBody):
 *   er war nur ein Scroll-Anker auf dieselbe Seite.
 */

const DEVELOPMENT_FILTERS: Array<{ id: TrainingDevelopmentFilter; label: string; hint: string }> = [
  {
    id: "growth",
    /*
     * GEMELDET VON CHRIS (19.08.): „der Filter Upgrade bereit macht keinen Sinn mehr weil es ja
     * keine Upgrades mehr gibt - bitte entfernen".
     *
     * Der NAME war falsch, die Auswahl ist es nicht: der Filter greift auf den Netto-Forecast
     * (>= +2 SP), und den gibt es unveraendert. Die eigene Kurzbeschreibung sagte das sogar schon
     * — „Kein Sofort-Upgrade, sondern die Saisonend-Tendenz" —, sie stand nur hinter einem Namen,
     * der das Gegenteil behauptet.
     *
     * Herausgenommen wurde er deshalb NICHT: die vier Filter teilen den Kader ohne Rest auf
     * (waechst / Risiko / stabil / alle). Ohne diesen haette man keinen Weg mehr, die Aufsteiger
     * zu sehen — sie verschwaenden in „Alle". Der Name nennt jetzt, was gemeint ist.
     *
     * DER NAME IST CHRIS' WAHL (19.08.). Zwei Zweige hatten denselben Filter unabhaengig
     * umbenannt — „Im Aufwind" und „Waechst" —, und die Merge-Reihenfolge hatte die Frage
     * zufaellig zugunsten des ersten entschieden. Gefragt, geantwortet: „Waechst". Kuerzer und in
     * derselben Wortform wie die Nachbarn („Risiko", „Stabil"), die ebenfalls einen Zustand
     * nennen und keine Bewegung.
     */
    label: "Wächst",
    hint: "Netto-Forecast ≥ +2 SP über die Saison: Training und Performance übersteigen die Regression deutlich. Eine Tendenz zum Saisonende, keine Sofort-Wirkung.",
  },
  {
    id: "regression",
    label: "Risiko",
    hint: "Netto-Forecast negativ ODER hohes Rückschritt-Risiko: Regression überwiegt bereits Training + Performance oder droht das zu tun.",
  },
  {
    id: "stable",
    label: "Stabil",
    hint: "Netto-Forecast zwischen 0 und +2 SP ohne hohes Risiko — Training gleicht die laufende Regression etwa aus.",
  },
  { id: "all", label: "Alle", hint: "Kompletter Kader" },
];

type NlTrainingGlyphKind = "recommend" | "wish" | "signature" | "weak" | "risk" | "trait";

/** Konsistentes Inline-SVG-Icon-Set statt gemischter Emoji (💡/⚑/★/▼/◆). */
function NlTrainingGlyph({ kind }: { kind: NlTrainingGlyphKind }) {
  const shared = {
    width: 12,
    height: 12,
    viewBox: "0 0 16 16",
    "aria-hidden": true as const,
    focusable: false as const,
    className: "nl-training-glyph",
  };
  switch (kind) {
    case "recommend":
      // Glühbirne (KI-Empfehlung)
      return (
        <svg {...shared}>
          <path
            d="M8 1.5a4.5 4.5 0 0 0-2.6 8.17c.45.33.7.75.76 1.23h3.68c.06-.48.31-.9.76-1.23A4.5 4.5 0 0 0 8 1.5Z"
            fill="currentColor"
          />
          <path d="M6.4 12.2h3.2v1a1 1 0 0 1-1 1H7.4a1 1 0 0 1-1-1v-1Z" fill="currentColor" opacity="0.65" />
        </svg>
      );
    case "wish":
      // Fahne (Trainingswunsch)
      return (
        <svg {...shared}>
          <path d="M4 1.5v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 2.5h7l-1.8 2.5L12 7.5H5v-5Z" fill="currentColor" />
        </svg>
      );
    case "signature":
    case "trait":
      // Stern (Signature-Attribut / Trait-Boost)
      return (
        <svg {...shared}>
          <path
            d="M8 1.6 9.9 5.5l4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.6Z"
            fill="currentColor"
          />
        </svg>
      );
    case "weak":
      // Raute (Weak-Attribut)
      return (
        <svg {...shared}>
          <path d="M8 1.8 14.2 8 8 14.2 1.8 8 8 1.8Z" fill="currentColor" />
        </svg>
      );
    case "risk":
      // Warn-Dreieck (Regression/Risiko)
      return (
        <svg {...shared}>
          <path d="M8 1.8 15 13.8H1L8 1.8Z" fill="currentColor" />
          <path d="M8 6v4" stroke="var(--nl-bg, #0e1420)" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.9" fill="var(--nl-bg, #0e1420)" />
        </svg>
      );
    default:
      return null;
  }
}

function getToneBadgeLabel(tone: ReturnType<typeof getDevelopmentTone>) {
  if (tone === "growth") return "steigt";
  if (tone === "regression") return "kann fallen";
  return "stabil";
}

/**
 * #49/Deklutter — Badge-Tooltip erklärt nur noch den Schwellenwert hinter dem
 * Label; die volle Zahlen-Begründung steht im Kern-Takeaway der aufgeklappten
 * Zeile (`getCoreTakeaway`).
 */
function getToneBadgeTooltip(tone: ReturnType<typeof getDevelopmentTone>): string {
  if (tone === "growth") return "Netto-Forecast ≥ +2 SP. Begründung in der aufgeklappten Zeile.";
  if (tone === "regression") return "Netto-Forecast negativ oder Rückschritt-Risiko hoch. Begründung in der aufgeklappten Zeile.";
  return "Netto-Forecast 0 bis +2 SP. Begründung in der aufgeklappten Zeile.";
}

/** Sanftes Scrollen respektiert `prefers-reduced-motion` statt es zu ignorieren. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type TrainingSortKey = "default" | "net" | "risk" | "training" | "performance" | "name";

const TRAINING_SORT_OPTIONS: Array<{ id: TrainingSortKey; label: string }> = [
  { id: "default", label: "Standard" },
  { id: "net", label: "Netto-Forecast" },
  { id: "risk", label: "Rückschritt-Risiko" },
  { id: "training", label: "Trainingsplan" },
  { id: "performance", label: "Performance" },
  { id: "name", label: "Name" },
];

/** Sortiert eine Kopie der echten Kader-Zeilen nach real vorhandenen Feldern. */
function sortTrainingPlayerRows(rows: TrainingPlayerRowView[], sortKey: TrainingSortKey): TrainingPlayerRowView[] {
  if (sortKey === "default") return rows;
  const sorted = [...rows];
  switch (sortKey) {
    case "net":
      sorted.sort((left, right) => right.organicForecast.netSetpoints - left.organicForecast.netSetpoints);
      break;
    case "risk":
      sorted.sort((left, right) => right.forecast.regressionPressure - left.forecast.regressionPressure);
      break;
    case "training":
      sorted.sort((left, right) => right.trainingXp - left.trainingXp);
      break;
    case "performance":
      sorted.sort((left, right) => right.performanceXp - left.performanceXp);
      break;
    case "name":
      sorted.sort((left, right) => left.player.name.localeCompare(right.player.name, "de"));
      break;
    default:
      break;
  }
  return sorted;
}

/**
 * Haupt-Takeaway pro Spieler (in der aufgeklappten Zeile): Netto-Delta + Hauptgrund.
 * Nutzt dieselben echten Forecast-Felder wie die "Wie kommt das zustande?"-Disclosure.
 */
function getCoreTakeaway(row: TrainingPlayerRowView): string {
  if (row.organicForecast.netSetpoints < 0) {
    const missing = Math.abs(row.organicForecast.netSetpoints);
    return `Regression drückt stärker als Training + Performance — es fehlen ca. ${formatNlNumber(missing, 1)} SP zum Halten.`;
  }
  if (row.forecast.regressionRisk === "high") {
    return `Wächst noch, aber hohes Rückschritt-Risiko (Druck ${formatNlNumber(row.forecast.regressionPressure, 0)}) — kippt der Druck weiter, fällt das Netto ins Minus.`;
  }
  if (row.organicForecast.netSetpoints >= 2) {
    return "Training und Performance überwiegen deutlich — Upgrade in Reichweite.";
  }
  return "Entwicklung stabil — Training gleicht die laufende Regression aus.";
}

/**
 * Attribut-Forecast als Bar (jetzt → Prognose) statt Zahlenmatrix.
 * Grün = Wachstum, Rot = Rückschritt; Cap-Marker aus dem echten
 * `ceilingState` (Potential-Decke erreicht/fast erreicht). Rohzahlen
 * wandern in Sekundärtext + Tooltip.
 */
function NlTrainingForecastBar({
  entry,
  scaleMax,
}: {
  entry: TrainingAttributeForecastEntry;
  scaleMax: number;
}) {
  const from = Number.isFinite(entry.before) ? Math.max(0, entry.before) : 0;
  const to = Number.isFinite(entry.after) ? Math.max(0, entry.after) : 0;
  const base = Math.min(from, to);
  const growth = entry.delta > 0;
  const regression = entry.delta < 0;
  const basePct = Math.min(100, (base / scaleMax) * 100);
  const deltaPct = Math.min(100 - basePct, (Math.abs(to - from) / scaleMax) * 100);
  const capMarker = entry.ceilingState === "capped" || entry.ceilingState === "closing";
  const capPct = Math.min(100, (Math.max(from, to) / scaleMax) * 100);
  // Ceiling-Hinweis ("Potential erreicht/fast erreicht") steht bewusst NICHT hier —
  // der Cap-Marker unten trägt exakt diesen Text bereits in seinem eigenen `title`
  // (Deklutter: keine zweite, identische Tooltip-Kopie für dieselbe Zeile).
  const tooltip = `${entry.attribute}: ${formatNlNumber(entry.before, 1)} → ${formatNlNumber(entry.after, 1)} (${formatNlSignedNumber(entry.delta, 1)}) · T ${formatNlSignedNumber(entry.training, 1)} · P ${formatNlSignedNumber(entry.performance, 1)} · R ${formatNlSignedNumber(entry.regression, 1)}${
    regression ? ` · kann fallen: fehlen ca. ${formatNlNumber(Math.abs(entry.delta), 1)} SP zum Halten` : ""
  }`;

  return (
    <div
      className={`nl-training-forecast-row${growth ? " is-growth" : regression ? " is-regression" : ""}`}
      title={tooltip}
    >
      <span className="nl-training-forecast-label">
        {entry.attribute}
        {entry.affinity === "signature" ? (
          <span className="nl-training-affinity is-signature" title="Signature-Attribut">
            <NlTrainingGlyph kind="signature" />
          </span>
        ) : null}
        {entry.affinity === "weak" ? (
          <span className="nl-training-affinity is-weak" title="Weak-Attribut">
            <NlTrainingGlyph kind="weak" />
          </span>
        ) : null}
      </span>
      <div className="nl-training-forecast-track" aria-hidden="true">
        <span className="nl-training-forecast-base" style={{ width: `${basePct}%` }} />
        {deltaPct > 0 ? (
          <span
            className={`nl-training-forecast-delta${regression ? " is-regression" : ""}`}
            style={{ left: `${basePct}%`, width: `${Math.max(deltaPct, 0.75)}%` }}
          />
        ) : null}
        {capMarker ? (
          <span
            className={`nl-training-forecast-cap${entry.ceilingState === "capped" ? " is-capped" : " is-closing"}`}
            style={{ left: `${capPct}%` }}
            title={
              entry.ceilingState === "capped"
                ? "Potential erreicht"
                : `Potential fast erreicht (${entry.headroomLabel ?? "eng"})`
            }
          />
        ) : null}
      </div>
      <span className="nl-training-forecast-numbers nl-tnum">
        {formatNlNumber(entry.before, 1)} → {formatNlNumber(entry.after, 1)}
      </span>
      <NlDeltaChip value={entry.delta} format={(n) => formatNlSignedNumber(n, 1)} className="nl-training-forecast-chip" />
    </div>
  );
}

/** Potential-Trainingsspeed als Tonstufe — macht hohes Potential auf einen Blick sichtbar. */
function getPotentialTone(multiplier: number): "high" | "good" | "neutral" | "low" {
  if (multiplier >= 1.12) return "high";
  if (multiplier >= 1.03) return "good";
  if (multiplier >= 0.98) return "neutral";
  return "low";
}

/**
 * Ton-Klasse einer Trainingsklasse — nach ihrer KLASSENFARBE.
 *
 * GEMELDET VON CHRIS: „vllt kannst du die noch in der passenden Farbe einrahmen damit man sie besser
 * erkennt!" — dieselben vier Achsfarben, die das Spiel auch sonst benutzt (`--nl-pow` … `--nl-soc`,
 * siehe die Kartenfarben im Transfermarkt).
 *
 * NACHGEMELDET: „badass ist gelb". Stimmt — und die Zeile war rot. Gefärbt wurde nach der
 * Development-Route (`classNameToDevelopmentRoute`), also danach, welche Achse die Klasse TRAINIERT.
 * Das ist bei zehn der dreizehn Klassen dieselbe Farbe wie die Klassenfarbe, bei dreien aber nicht:
 * Badass (Route POW, Farbe gelb), Tactician (Route MEN, Farbe gelb) und Templar (Route SOC, Farbe
 * blau). Wiedererkannt wird eine Klasse an ihrer Klassenfarbe — dieselbe, die ihr Icon, ihr Chip im
 * Transfermarkt und der Klassenfilter tragen. Also färbt diese Liste danach.
 *
 * Die Route selbst bleibt unangetastet: sie ist Spiellogik (Route-Bonus) und keine Farbe. Klassen
 * ohne hinterlegte Farbe bleiben ungefärbt, statt sich eine fünfte auszudenken.
 *
 * WICHTIG (TR5/Achsenfarben-Kollision): Die Klassenfarbe sitzt NUR als schmaler Identitäts-Rahmen
 * links an der Zeile — Werte und Balken bleiben einfarbig, die Bewertung trägt ausschließlich
 * der Gold-Rang des Bestwerts (Muster-2-Skala, nie die Teamfarbe). So sagt Rot hier „Berserker",
 * nie „schlecht".
 */
const CLASS_COLOR_TONE: Record<string, string> = {
  red: " nl-tone-pow",
  green: " nl-tone-spe",
  blue: " nl-tone-men",
  yellow: " nl-tone-soc",
};

function classRankingClassTone(className: string | null | undefined) {
  const token = getClassColorToken(className);
  return token ? CLASS_COLOR_TONE[token] ?? "" : "";
}

/**
 * T6 · Klassen-Stat-Vorschau: welche Attribute eine Trainingsklasse für DIESEN Spieler
 * verbessert — die Top-Beiträge aus `entry.attributeGains`, also exakt die Summanden,
 * aus denen `estimatedGain` summiert wird (eine Rechnung, keine zweite Formel; Invariante
 * per Test: `roundTo(Σ gain, 1) === estimatedGain`).
 *
 * Bewusst EINFARBIG (kein Achsfarben-Ton, kein Grün): direkt daneben sitzt die Klassenfarbe
 * als Identitäts-Rahmen — eine zweite Farbcodierung auf denselben Pixeln würde kollidieren
 * (TR5). Werte sind Schätzungen, keine Garantie — das sagt der Tooltip ausdrücklich.
 */
function NlTrainingClassAttributePreview({
  entry,
  attributeLabelByKey,
}: {
  entry: TrainingClassGainEstimate;
  attributeLabelByKey: Map<string, string>;
}) {
  if (entry.attributeGains.length === 0) return null;
  const label = (key: string) => attributeLabelByKey.get(key) ?? key;
  const top = entry.attributeGains.slice(0, 3);
  const rest = entry.attributeGains.slice(3);
  const fullList = entry.attributeGains
    .map((gain) => `${label(gain.attribute)} +${formatNlNumber(gain.gain, 1)}`)
    .join(" · ");
  return (
    <span
      className="nl-training-class-attrs nl-tnum"
      data-testid="nl-training-class-attr-preview"
      title={`${entry.label} verteilt das Trainingsbudget so über die Attribute (Schätzung, keine Garantie): ${fullList}. Die Summe dieser Beiträge IST die Brutto-Schätzung der Klasse (${formatNlNumber(entry.estimatedGain, 1)} SP) — gleiche Rechnung, nur vor der Summierung abgegriffen.`}
    >
      {top.map((gain) => (
        <span className="nl-training-class-attr-tag" key={`${entry.className}-${gain.attribute}`}>
          +{label(gain.attribute)} {formatNlNumber(gain.gain, 1)}
        </span>
      ))}
      {rest.length > 0 ? <span className="nl-training-class-attr-more">+{rest.length} weitere</span> : null}
    </span>
  );
}

/**
 * Klassen nach geschätztem Trainings-SP-Zugewinn (siehe `buildTrainingClassGainRanking` für die
 * Herleitung). Die aktuell trainierte Klasse ist klar markiert („aktiv"), der Bestwert trägt Gold
 * (Muster-2-Rangskala — nie die Teamfarbe). Seit T6 zeigt jede Klasse zusätzlich, WELCHE Attribute
 * sie für diesen Spieler verbessert (`NlTrainingClassAttributePreview`).
 *
 * GEMELDET VON CHRIS: „ich würde gerne beim Training nicht nur die besten 4 Klassen sehen, sondern
 * alle!" Vorher stand hier `limit: 4`. Die Beschränkung nahm dem Vergleich genau das, wofür er da
 * ist: welche Klasse für DIESEN Spieler die richtige ist, sieht man erst, wenn auch die schlechten
 * Optionen danebenstehen — und die vier besten sind bei ähnlichen Werten ohnehin austauschbar.
 * Seit T5 öffnet die Liste pro Tabellenzeile auf Aufklappen (Audit TR1) — alle 13 bleiben drin.
 */
function NlTrainingClassRanking({
  row,
  trainingClassOptions,
  readOnly,
  onSelectClass,
}: {
  row: TrainingPlayerRowView;
  trainingClassOptions: TrainingCompactClientProps["trainingClassOptions"];
  readOnly: boolean;
  onSelectClass: (className: string) => void;
}) {
  const ranking = useMemo(
    // `limit: 99` statt einer Zahl: die Liste ist so lang wie `trainingClassOptions`, und die kennt
    // diese Komponente nicht im Voraus. Derselbe Wert wird an der zweiten Aufrufstelle in dieser
    // Datei bereits benutzt.
    () => buildTrainingClassGainRanking(row, trainingClassOptions, { limit: 99, includeCurrent: true }),
    [row, trainingClassOptions],
  );
  const attributeLabelByKey = useMemo(
    () => new Map(row.attributeForecast.map((entry) => [entry.attributeKey as string, entry.attribute])),
    [row.attributeForecast],
  );
  if (ranking.length === 0) return null;
  const best = ranking.reduce((max, entry) => Math.max(max, entry.estimatedGain), 0.01);

  return (
    <div
      className="nl-training-class-ranking is-selectable"
      data-testid="nl-training-class-ranking"
      role="radiogroup"
      aria-label="Trainingsklasse wählen — alle Klassen nach geschätztem Netto-SP"
    >
      <span
        className="nl-training-class-ranking-title"
        title={`Netto-vergleichbar: verankert am echten Netto-Forecast deiner aktuellen Klasse (${formatNlSignedNumber(row.organicForecast.netSetpoints, 1)} SP, nach Performance − Regression). Jede andere Klasse zeigt, wo dein Netto läge, wenn du sie trainierst (Delta aus Klassen-Attributgewichtung, Potential-Decke, Signature-/Weak-Affinität und Route-Bonus). Der Balken zeigt das relative Brutto-Trainingsbudget, die Attribut-Tags dessen Verteilung. Alles Schätzungen, keine Garantie.`}
      >
        Alle Klassen · Netto-SP{" "}
        {readOnly ? "" : <span className="nl-training-intensity-hint-inline">· tippen zum Wählen</span>}
      </span>
      <div className="nl-training-class-ranking-rows">
        {ranking.map((entry) => (
          <button
            type="button"
            key={`class-rank-${row.player.id}-${entry.className}`}
            className={`nl-training-class-ranking-row is-route-framed${classRankingClassTone(entry.className)}${
              entry.isCurrent ? " is-current" : ""
            }${entry.rank === 1 ? " is-top" : ""}`}
            role="radio"
            aria-checked={entry.isCurrent}
            disabled={readOnly}
            onClick={() => onSelectClass(entry.className)}
            title={`${entry.label} als Trainingsklasse wählen: Rang ${entry.rank} · Netto ca. ${formatNlSignedNumber(entry.netComparableGain, 1)} SP${
              entry.isCurrent ? " · wird aktuell trainiert (= Intensitäts-Netto)" : ""
            }`}
          >
            <span className="nl-training-class-ranking-rank nl-tnum">{entry.rank}</span>
            <span className="nl-training-class-ranking-label">
              {entry.label}
              {entry.isCurrent ? <span className="nl-training-class-ranking-current">aktiv</span> : null}
              {entry.hasFocusRouteBonus ? (
                <span className="nl-training-class-ranking-focus-bonus" title="Trainingsfokus-Route-Bonus: +8%">
                  +8% Fokus
                </span>
              ) : null}
              <NlTrainingClassAttributePreview entry={entry} attributeLabelByKey={attributeLabelByKey} />
            </span>
            <span className="nl-training-class-ranking-bar" aria-hidden="true">
              <span
                className="nl-training-class-ranking-fill"
                style={{ width: `${Math.min(100, (entry.estimatedGain / best) * 100)}%` }}
              />
            </span>
            <span className="nl-training-class-ranking-value nl-tnum">≈{formatNlSignedNumber(entry.netComparableGain, 1)} SP</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Aufgeklappter Detail-Bereich einer Tabellenzeile — trägt alles, was nicht die
 * tägliche Entscheidung ist: Kern-Takeaway, Saison-Stand, Hinweis-Chips,
 * Klassen-Rangliste (mit T6-Stat-Vorschau), Attribut-Forecast und die
 * „Wie kommt das zustande?"-Herleitung (als Info-Link, TR2).
 */
function NlTrainingPlayerCard({
  row,
  trainingModeReadOnly,
  trainingClassOptions,
  onSetTrainingClass,
}: {
  row: TrainingPlayerRowView;
  trainingModeReadOnly: boolean;
  trainingClassOptions: TrainingCompactClientProps["trainingClassOptions"];
  onSetTrainingClass: TrainingCompactClientProps["onSetTrainingClass"];
}) {
  const [showAllAttributes, setShowAllAttributes] = useState(false);
  const potentialMultiplier = row.modifiers.potentialTrainingMultiplier;
  const potentialTone = getPotentialTone(potentialMultiplier);
  const currentTrainingClassLabel = useMemo(
    () => trainingClassOptions.find((option) => option.value === row.trainingClass)?.label ?? row.trainingClass,
    [row.trainingClass, trainingClassOptions],
  );
  const sortedForecast = useMemo(
    () => sortTrainingAttributeForecastByClassProfile(row.attributeForecast, row.trainingClass, row.adminBalancingConfig),
    [row.adminBalancingConfig, row.attributeForecast, row.trainingClass],
  );
  const visibleForecast = showAllAttributes ? sortedForecast : sortedForecast.slice(0, 5);
  const scaleMax = useMemo(() => {
    const peak = sortedForecast.reduce((max, entry) => Math.max(max, entry.before, entry.after), 0);
    return Math.max(20, Math.ceil((peak * 1.12) / 5) * 5);
  }, [sortedForecast]);

  const recommendedMode = row.recommendedTrainingMode ?? null;
  const recommendedPresentation = recommendedMode ? getTrainingModePresentation(recommendedMode) : null;
  const showRecommendation =
    recommendedMode != null && recommendedMode !== row.mode && row.recommendedTrainingMatchesCurrent === false;
  const demand = row.trainingDemand;
  const hasDemand = demand != null && demand.status !== "fulfilled";
  const hasTraitBoost = row.traitBoosts.length > 0 || row.modifiers.traitModifierPct !== 0;
  const isHighRisk = row.forecast.regressionRisk === "high";

  return (
    <div className="nl-training-detail" data-testid="nl-training-player-detail">
      <div className="nl-training-detail-head">
        {row.developmentStars.currentAbilityStars != null ||
        row.developmentStars.currentAbilityRating != null ||
        row.developmentStars.potentialStars != null ||
        row.developmentStars.potentialRating != null ? (
          <NlAbilityStars
            caStars={row.developmentStars.currentAbilityStars}
            caScore={row.developmentStars.currentAbilityRating}
            poStars={row.developmentStars.potentialStars}
            poScore={row.developmentStars.potentialRating}
            known
            compact
            className="nl-training-player-stars"
            label="Fähigkeiten"
          />
        ) : null}
        <span
          className={`nl-training-potential is-${potentialTone}`}
          title="Potential-Trainingsspeed: höheres Potential ⇒ mehr Zuwachs pro Intensität. Dieser Faktor steckt in jeder Prognose dieser Zeile."
        >
          <NlTrainingGlyph kind="signature" /> Potential ×{formatNlNumber(potentialMultiplier, 2)}
        </span>
      </div>

      {/* Kern-Takeaway: Netto-Delta + Hauptgrund. */}
      <div className="nl-training-takeaway" data-testid="nl-training-takeaway">
        <NlDeltaChip
          value={row.organicForecast.netSetpoints}
          format={(n) => `${formatNlSignedNumber(n, 1)} SP`}
          title="Netto-Forecast: Training + Performance − Regression über alle 12 Attribute"
        />
        <p>{getCoreTakeaway(row)}</p>
      </div>
      <small className="nl-training-takeaway-split nl-tnum">
        Training +{formatNlNumber(row.organicForecast.trainingSetpoints, 1)} · Performance +
        {formatNlNumber(row.organicForecast.performanceSetpoints, 1)} · Fatigue{" "}
        {formatNlNumber(row.organicForecast.fatigueLoad, 1)} ·{" "}
        <span
          className="nl-training-hint"
          title={`Strain-Risiko bei ${getTrainingModePresentation(row.mode).label}: ${row.fatigueWarning}`}
        >
          Risiko {row.forecast.fatigueStrain.label}
        </span>
      </small>
      {/* Was BISHER zusammengekommen ist — die Zeile darüber ist die Prognose auf
          die volle Saison. Ohne diesen Gegenpol sieht man nie, ob ein Spieler
          seinen Forecast auch wirklich einfährt, obwohl die Rohdaten (Trainings-
          Budget je Spieltag + Performance-Fenster) längst pro Spieltag vorliegen.
          Attribute werden weiterhin erst am Saisonende gebucht; das hier ist der
          aufgelaufene Stand, keine zweite Buchung. */}
      {row.seasonSoFar ? (
        <small className="nl-training-sofar nl-tnum" data-testid="nl-training-sofar">
          <strong>Bisher</strong> {formatNlSignedNumber(row.seasonSoFar.netCumulative, 1)} SP
          <span
            className="nl-training-hint"
            title={`Bereits aufgelaufen nach ${row.seasonSoFar.matchdaysPlayed} von ${row.seasonSoFar.totalMatchdays} Spieltagen — gleiche Rechnung wie der Forecast, aber nur mit dem bis heute gesammelten Trainings-Budget und den bisher gespielten Spieltagen. Gebucht wird erst am Saisonende.`}
          >
            {" "}
            · Training +{formatNlNumber(row.seasonSoFar.trainingTotal + row.seasonSoFar.spilloverTotal, 1)} · Performance
            +{formatNlNumber(row.seasonSoFar.performanceTotal, 1)} · Regression{" "}
            {formatNlNumber(row.seasonSoFar.regressionTotal, 1)} · nach {row.seasonSoFar.matchdaysPlayed} von{" "}
            {row.seasonSoFar.totalMatchdays} Spieltagen
          </span>
        </small>
      ) : null}

      {/* EINE Chip-Zeile fuer Hinweise UND Affinitaeten. */}
      {showRecommendation || hasTraitBoost || hasDemand || isHighRisk || row.modifiers.signatureAttributes.length > 0 || row.modifiers.weakAttribute ? (
        <div className="nl-training-chip-row" aria-label="Trainings-Hinweise und Affinitäten">
          {showRecommendation && recommendedPresentation ? (
            <span
              className="nl-training-chip is-recommend"
              data-testid="training-ai-recommendation"
              title={`Empfohlen: ${recommendedPresentation.label}${row.recommendedTrainingDetail ? ` — ${row.recommendedTrainingDetail}` : ""}`}
            >
              <NlTrainingGlyph kind="recommend" /> {recommendedPresentation.label}
            </span>
          ) : null}
          {hasTraitBoost ? (
            <span
              className={`nl-training-chip is-trait${row.modifiers.traitModifierPct >= 0 ? " is-positive" : " is-negative"}`}
              title={
                row.traitBoosts
                  .map((entry) => `${entry.trait} ${entry.pct >= 0 ? "+" : ""}${formatNlNumber(entry.pct, 1)}%`)
                  .join(" · ") || "Trait Training Boost"
              }
            >
              <NlTrainingGlyph kind="trait" /> {formatSignedPercent(row.modifiers.traitModifierPct)}
            </span>
          ) : null}
          {hasDemand && demand ? (
            <span
              className={`nl-training-chip is-wish is-${demand.status}`}
              title={`${demand.label} · will ${getTrainingModePresentation(demand.preferredMode).label} · Moral ${demand.moraleReward >= 0 ? "+" : ""}${demand.moraleReward}/${demand.moralePenalty} — ${demand.detail}`}
            >
              <NlTrainingGlyph kind="wish" /> will {getTrainingModePresentation(demand.preferredMode).label}
            </span>
          ) : null}
          {isHighRisk ? (
            <span
              className="nl-training-chip is-risk"
              title={`Regressions-Druck ${formatNlNumber(row.forecast.regressionPressure, 0)} (Alterung, Marktwert-Druck, Belastung) — Begründung im Kurztext oben.`}
            >
              <NlTrainingGlyph kind="risk" /> Rückschritt-Risiko
            </span>
          ) : null}
          {row.modifiers.signatureAttributes.length > 0 || row.modifiers.weakAttribute ? (
            <span
              className="nl-training-affinity-summary"
              data-testid="nl-training-affinity-summary"
              title="Signature-Attribute wachsen schneller (×1,15), das Weak-Attribut langsamer (×0,8). Jeder Spieler hat 2 Signature + 1 Weak."
            >
              {row.modifiers.signatureAttributes.length > 0 ? (
                <span className="nl-training-affinity-summary-part is-signature">
                  <NlTrainingGlyph kind="signature" /> {row.modifiers.signatureAttributes.join(" / ")}
                </span>
              ) : null}
              {row.modifiers.weakAttribute ? (
                <span className="nl-training-affinity-summary-part is-weak">
                  <NlTrainingGlyph kind="weak" /> {row.modifiers.weakAttribute}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}

      <NlTrainingClassRanking
        row={row}
        trainingClassOptions={trainingClassOptions}
        readOnly={trainingModeReadOnly}
        onSelectClass={(className) => onSetTrainingClass(row.player.id, className)}
      />

      <div className="nl-training-forecast" data-testid="nl-training-forecast-bars" aria-label="Attribut-Forecast">
        {visibleForecast.map((entry) => (
          <NlTrainingForecastBar key={`${row.player.id}-${entry.attributeKey}`} entry={entry} scaleMax={scaleMax} />
        ))}
        {sortedForecast.length > 5 ? (
          <button
            type="button"
            className="nl-training-inline-button"
            onClick={() => setShowAllAttributes((current) => !current)}
          >
            {showAllAttributes ? "Weniger anzeigen" : `Alle ${sortedForecast.length} Stats`}
          </button>
        ) : null}
      </div>

      {/* Detail-Berechnung („Wie kommt das zustande?") — als Info-Link gestylt (TR2),
          identische echte Werte wie die Tabelle. */}
      <TrainingBudgetBreakdownDisclosure row={row} />

      {/* Klassen werden oben in der Rangliste gewählt; das Select bleibt als
          tastaturfreundlicher Vollzugriff (identischer Handler, keine zweite Logik). */}
      <footer className="nl-training-player-controls">
        <div className="nl-training-player-foot">
          <label className="nl-training-class-select">
            <span>Andere Klasse</span>
            <select
              className="input"
              value={row.trainingClass}
              disabled={trainingModeReadOnly}
              onChange={(event) => onSetTrainingClass(row.player.id, event.target.value)}
            >
              {trainingClassOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <small className="nl-training-detail-classnote">Trainiert aktuell: {currentTrainingClassLabel}</small>
        </div>
      </footer>
    </div>
  );
}

/** Kurzlabel je Intensität für die Tabellen-Segmente (L/M/H wie im Mockup). */
const MODE_SHORT_LABEL: Record<PlayerTrainingMode, string> = {
  leicht: "L",
  mittel: "M",
  hart: "H",
};

/**
 * Eine Zeile der Steuer-Tabelle: die tägliche Entscheidung (Intensität) sitzt
 * direkt in der Zeile, alles Erklärende klappt auf. Schreibt NUR über die
 * echten Handler (`onSetTrainingMode` beim Segment-Klick).
 */
function NlTrainingPlayerRow({
  row,
  worstAbsNet,
  expanded,
  onToggleExpanded,
  trainingModeReadOnly,
  trainingModeOptions,
  trainingClassOptions,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
}: {
  row: TrainingPlayerRowView;
  worstAbsNet: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  trainingModeReadOnly: boolean;
  trainingModeOptions: TrainingCompactClientProps["trainingModeOptions"];
  trainingClassOptions: TrainingCompactClientProps["trainingClassOptions"];
  onSetTrainingMode: TrainingCompactClientProps["onSetTrainingMode"];
  onSetTrainingClass: TrainingCompactClientProps["onSetTrainingClass"];
  onOpenPlayerDetails: TrainingCompactClientProps["onOpenPlayerDetails"];
}) {
  const tone = getDevelopmentTone(row);
  const projection = useMemo(
    () => buildTrainingIntensityProjection(row, trainingModeOptions),
    [row, trainingModeOptions],
  );
  const ranking = useMemo(
    () => buildTrainingClassGainRanking(row, trainingClassOptions, { limit: 99, includeCurrent: true }),
    [row, trainingClassOptions],
  );
  const demand = row.trainingDemand;
  const demandMode = demand && demand.status !== "fulfilled" ? demand.preferredMode : null;
  const net = row.organicForecast.netSetpoints;
  const netBarPct = worstAbsNet > 0 ? Math.min(100, (Math.abs(net) / worstAbsNet) * 100) : 0;
  const currentTrainingClassLabel =
    trainingClassOptions.find((option) => option.value === row.trainingClass)?.label ?? row.trainingClass;
  const trainsOtherClass = row.trainingClass !== row.player.className;
  // Vertragsform-Kürzel (FL/BL) — dieselbe Ableitung wie die Kaderliste
  // (`formatContractShapeShortLabel`), `null` bei "balanced" (kein Kürzel dort auch).
  const contractShapeShort = formatContractShapeShortLabel(row.economy.contractShape);
  const isContractExpiring = row.economy.contractLength != null && row.economy.contractLength <= 1;

  // Klassen-Vorschlag aus DERSELBEN Rangliste, die die aufgeklappte Zeile zeigt —
  // ein Chip, der der Liste widerspricht, wäre ein Muster-4-Loch.
  const bestClass = ranking.find((entry) => entry.rank === 1) ?? null;
  const currentClass = ranking.find((entry) => entry.isCurrent) ?? null;
  const suggestsSwitch =
    bestClass != null &&
    currentClass != null &&
    !bestClass.isCurrent &&
    bestClass.estimatedGain > currentClass.estimatedGain + 0.3;

  const portrait = getPlayerPortraitModel(row.player);
  // Hover-Steckbrief (#Portrait-Hover): dieselbe `FoundationPlayerPortraitPreview`-Instanz
  // wie in `FoundationPlayersTableNewLook` — trägt den `context="training"`-Preset
  // (Forecast), damit der Popup-Inhalt NICHT dieselben Zahlen doppelt zeigt,
  // die die Zeile selbst schon darstellt. Diese Trainingsseite ist ausschließlich
  // der eigene, steuerbare Kader — kein Fog-of-War nötig.
  //
  // CA/PO stehen NICHT mehr im Text-Preset (vorher "CA 45" als Zahl neben "PO"
  // als Sterne — Chris' Screenshot-Befund): `newLook`+`caScore`/`poScore` aktiviert
  // denselben `NlAbilityStars`-Slot, den auch die Kaderliste (`FoundationPlayersTableNewLook`)
  // und die aufgeklappte Zeile dieser Tabelle (`NlTrainingPlayerCard`, s.u.) für CA/PO
  // benutzen — dieselbe Quelle (`row.developmentStars`), eine Darstellung überall.
  const portraitPreviewProps: Omit<FoundationPlayerPortraitPreviewProps, "children"> = {
    playerId: row.player.id,
    name: row.player.name,
    portraitUrl: portrait.previewSrc ?? portrait.src,
    portraitInitials: portrait.initials || getInitials(row.player.name),
    playerOvr: null,
    playerMvs: row.playerMvs,
    playerPps: row.playerPps,
    pow: row.player.coreStats.pow ?? null,
    spe: row.player.coreStats.spe ?? null,
    men: row.player.coreStats.men ?? null,
    soc: row.player.coreStats.soc ?? null,
    variant: "team",
    context: "training",
    newLook: true,
    known: true,
    caScore: row.developmentStars.currentAbilityRating,
    poScore: row.developmentStars.potentialRating,
    playerClassName: row.player.className,
    subMeta:
      row.organicForecast.classBefore === row.organicForecast.classAfter
        ? row.player.className
        : `${row.organicForecast.classBefore} → ${row.organicForecast.classAfter}`,
    contextData: {
      training: {
        netSetpoints: row.organicForecast.netSetpoints,
        regressionRisk: row.forecast.regressionRisk,
        trainingModeLabel: getTrainingModePresentation(row.mode).label,
        traitModifierPct: row.modifiers.traitModifierPct,
      },
    },
  };

  return (
    <>
      <tr
        className={`nl-training-row${expanded ? " is-expanded" : ""}`}
        data-tone={tone}
        id={`training-player-${row.player.id}`}
        data-testid="nl-training-player-row"
      >
        <td className="nl-training-row-player">
          <FoundationPlayerPortraitPreview {...portraitPreviewProps}>
            <span className="nl-training-row-avatar">
              <OptimizedMediaImage
                className="nl-training-row-avatar-media"
                src={portrait.previewSrc ?? portrait.src}
                alt={`${row.player.name} Portrait`}
                fallbackLabel={portrait.initials || getInitials(row.player.name)}
                onErrorClassName="nl-training-row-avatar-media"
                loading="lazy"
              />
            </span>
          </FoundationPlayerPortraitPreview>
          <span className="nl-training-row-copy">
            {onOpenPlayerDetails ? (
              <FoundationPlayerPortraitPreview {...portraitPreviewProps}>
                <button
                  type="button"
                  className="nl-training-row-name-button"
                  data-testid="training-player-profile-button"
                  title={`${row.player.name} Profil öffnen`}
                  onClick={() => onOpenPlayerDetails({ playerId: row.player.id, activePlayerId: row.entryId })}
                >
                  {row.player.name}
                </button>
              </FoundationPlayerPortraitPreview>
            ) : (
              <strong className="nl-training-row-name">{row.player.name}</strong>
            )}
            <small
              className="nl-training-row-sub"
              title={
                trainsOtherClass
                  ? `Klasse ${row.player.className} — trainiert aktuell als ${currentTrainingClassLabel} (Trainingsklasse, nicht Statprofil).`
                  : `Klasse ${row.player.className} — trainiert die eigene Klasse.`
              }
            >
              {row.player.className}
              {trainsOtherClass ? ` · trainiert ${currentTrainingClassLabel}` : " · aktiv"}
              {row.roleTag ? ` · ${row.roleTag}` : ""}
            </small>
          </span>
        </td>
        <td className="nl-training-row-ability">
          <NlAbilityStars
            caScore={row.developmentStars.currentAbilityRating}
            poScore={row.developmentStars.potentialRating}
            known
            compact
            stacked
            label={`${row.player.name} Fähigkeiten`}
          />
        </td>
        <td className="nl-training-row-modes">
          <span
            className="nl-training-row-seg"
            role="radiogroup"
            aria-label={`Trainingsintensität für ${row.player.name}`}
          >
            {projection.map((entry) => (
              <button
                type="button"
                key={`row-mode-${row.player.id}-${entry.mode}`}
                className={`nl-training-row-seg-btn${entry.isCurrent ? " is-current" : ""}${
                  demandMode === entry.mode && !entry.isCurrent ? " is-demand" : ""
                }`}
                role="radio"
                aria-checked={entry.isCurrent}
                disabled={trainingModeReadOnly}
                onClick={() => onSetTrainingMode(row.player.id, entry.mode as PlayerTrainingMode)}
                title={`${entry.label} wählen · Netto ${formatNlSignedNumber(entry.net, 1)} SP = Training +${formatNlNumber(entry.trainingGain, 1)}${entry.performanceGain ? ` + Performance +${formatNlNumber(entry.performanceGain, 1)}` : ""} − Regression ${formatNlNumber(Math.abs(entry.regression), 1)} − Potential-Decke ${formatNlNumber(entry.ceilingLoss, 1)} · Fatigue-Last ${formatNlNumber(entry.fatigueLoad, 0)} · Erholungs-Tempo ${formatSignedPercent(entry.recoveryDeltaPct)}${
                  demandMode === entry.mode && demand ? ` · Spielerwunsch (${demand.label})` : ""
                }`}
              >
                <span className="nl-training-row-seg-mode">{MODE_SHORT_LABEL[entry.mode as PlayerTrainingMode] ?? entry.label}</span>
                <span className="nl-training-row-seg-gain nl-tnum">+{formatNlNumber(entry.trainingGain, 1)}</span>
              </button>
            ))}
          </span>
          {demandMode ? (
            <small className="nl-training-row-demand" title={demand ? `${demand.label} — ${demand.detail}` : undefined}>
              will {getTrainingModePresentation(demandMode).label}
            </small>
          ) : null}
        </td>
        <td className="nl-training-row-net">
          <NlDeltaChip
            value={net}
            format={(n) => `${formatNlSignedNumber(n, 1)} SP`}
            title="Netto-Forecast über die Saison: Training + Performance − Regression über alle 12 Attribute. Begründung in der aufgeklappten Zeile."
          />
          <span className="nl-training-row-netbar" aria-hidden="true">
            <span
              className={`nl-training-row-netbar-fill${net < 0 ? " is-risk" : " is-good"}`}
              style={{ width: `${Math.max(netBarPct, net === 0 ? 0 : 3)}%` }}
            />
          </span>
        </td>
        <td className="nl-training-row-load">
          <NlFatigueGauge
            value={row.player.fatigue}
            className="nl-training-row-fatigue"
            title={`Fatigue ${formatNlNumber(row.player.fatigue, 0)}/100 · Verletzungsrisiko bei ${row.modeConfig.label}: ${row.modeConfig.fatigueRisk}. ${row.fatigueWarning}`}
          />
          <span className={`nl-training-player-badge is-${tone} nl-training-hint`} title={getToneBadgeTooltip(tone)}>
            {getToneBadgeLabel(tone)}
          </span>
        </td>
        <td className="nl-training-row-salary">
          <span className="nl-tnum">{formatNlMoney(row.economy.salary)}</span>
        </td>
        <td className="nl-training-row-contract">
          {row.economy.contractLength != null ? (
            <span
              className={`nl-training-row-contract-value${isContractExpiring ? " is-expiring" : ""}`}
              title={
                `${formatContractShapeLabel(row.economy.contractShape)} · noch ${row.economy.contractLength} ${
                  row.economy.contractLength === 1 ? "Saison" : "Saisons"
                }` + (isContractExpiring ? " — Vertrag läuft aus" : "")
              }
            >
              {contractShapeShort ? <span className="nl-training-row-contract-shape">{contractShapeShort}</span> : null}
              <span className="nl-tnum">{row.economy.contractLength}J</span>
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="nl-training-row-suggest">
          {suggestsSwitch && bestClass ? (
            <span
              className="nl-training-chip is-class-suggest"
              data-testid="training-class-suggestion"
              title={`Beste Klasse laut Schätzung: ${bestClass.label} (Netto ca. ${formatNlSignedNumber(bestClass.netComparableGain, 1)} SP statt ${formatNlSignedNumber(currentClass?.netComparableGain ?? net, 1)} SP als ${currentTrainingClassLabel}). Details und Auswahl in der aufgeklappten Klassenliste.`}
            >
              <NlTrainingGlyph kind="signature" /> Vorschlag: {bestClass.label}
            </span>
          ) : (
            <span
              className="nl-training-chip is-neutral"
              title={
                bestClass && bestClass.isCurrent
                  ? `${currentTrainingClassLabel} ist laut Schätzung bereits die beste Trainingsklasse für diesen Spieler.`
                  : `Keine Klasse verspricht deutlich mehr als ${currentTrainingClassLabel} (Unterschied unter 0,3 SP) — Wechsel lohnt aktuell nicht.`
              }
            >
              {currentTrainingClassLabel} passt
            </span>
          )}
        </td>
        <td className="nl-training-row-expand">
          <button
            type="button"
            className="nl-training-row-expander"
            aria-expanded={expanded}
            onClick={onToggleExpanded}
            title="Alle Klassen mit Stat-Vorschau, Attribut-Forecast und Herleitung auf-/zuklappen"
          >
            Alle {trainingClassOptions.length} Klassen {expanded ? "▴" : "▾"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="nl-training-detail-row" data-testid="nl-training-detail-row">
          {/* 9 Spalten in der Kopfzeile: Spieler, CA/PO, Intensität, Netto/Saison,
              Belastung, Gehalt, Vertrag, Klassen-Vorschlag, Details. */}
          <td colSpan={9}>
            <NlTrainingPlayerCard
              row={row}
              trainingModeReadOnly={trainingModeReadOnly}
              trainingClassOptions={trainingClassOptions}
              onSetTrainingClass={onSetTrainingClass}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function TrainingCompactNewLook({
  selectedTeam,
  selectedTeamControlMode,
  seasonLabel,
  managementLocked = false,
  managementLockedReason = null,
  summary,
  developmentFilter,
  developmentSummary,
  onSetDevelopmentFilter,
  trainingModeOptions,
  trainingClassOptions,
  playerRows,
  allPlayerCount,
  onSetTrainingMode,
  onSetTrainingClass,
  onOpenPlayerDetails,
  onOpenFacilities,
  onOpenTeams,
}: TrainingCompactClientProps) {
  const trainingModeReadOnly = managementLocked;
  const [sortKey, setSortKey] = useState<TrainingSortKey>("default");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  /**
   * TR3 — EINE KPI-Zeile: `simulationMode` ist die What-if-Vorschau. Gesetzt ersetzt sie
   * die Ist-Zahlen der KPI-Zeile LIVE (sichtbare Marke „Simulation"), geschrieben wird
   * erst über den expliziten „Übernehmen"-Knopf. `null` = Ist-Zustand.
   */
  const [simulationMode, setSimulationMode] = useState<PlayerTrainingMode | null>(null);
  const sortedPlayerRows = useMemo(() => sortTrainingPlayerRows(playerRows, sortKey), [playerRows, sortKey]);
  const modeSegments = useMemo(
    () =>
      buildTrainingModeSegments(
        trainingModeOptions.map((option) => ({
          value: option.value,
          label: option.label,
          trainingSetpoints: option.trainingSetpoints,
          baseXp: option.baseXp,
          recoveryDeltaPct: option.recoveryDeltaPct,
          fatigueLoad: option.fatigueLoad,
          note: option.note,
        })),
      ),
    [trainingModeOptions],
  );

  const teamModeCounts = useMemo(
    () =>
      playerRows.reduce(
        (counts, row) => {
          counts[row.mode] += 1;
          return counts;
        },
        { leicht: 0, mittel: 0, hart: 0 } as Record<PlayerTrainingMode, number>,
      ),
    [playerRows],
  );

  const uniformTeamMode =
    playerRows.length > 0 && playerRows.every((row) => row.mode === playerRows[0].mode) ? playerRows[0].mode : null;

  // Team-Vorschau je Intensität: echte, potentialgewichtete Summe der pro-Spieler-Prognose
  // (`buildTrainingIntensityProjection`) — keine neue Spielmathematik. `appliedTrainingGain`
  // läuft mit, damit die Simulation der KPI-Zeile dieselbe Semantik zeigt wie der Ist-Zustand
  // (angewendetes Training, nicht das Roh-Budget).
  const teamProjectionByMode = useMemo(() => {
    const totals = new Map<
      PlayerTrainingMode,
      {
        trainingGain: number;
        appliedTrainingGain: number;
        performanceGain: number;
        regression: number;
        ceilingLoss: number;
        net: number;
        fatigueLoad: number;
      }
    >();
    for (const option of trainingModeOptions) {
      totals.set(option.value, {
        trainingGain: 0,
        appliedTrainingGain: 0,
        performanceGain: 0,
        regression: 0,
        ceilingLoss: 0,
        net: 0,
        fatigueLoad: 0,
      });
    }
    for (const row of playerRows) {
      for (const entry of buildTrainingIntensityProjection(row, trainingModeOptions)) {
        const bucket = totals.get(entry.mode);
        if (bucket) {
          bucket.trainingGain += entry.trainingGain;
          bucket.appliedTrainingGain += entry.appliedTrainingGain;
          bucket.performanceGain += entry.performanceGain;
          bucket.regression += entry.regression;
          bucket.ceilingLoss += entry.ceilingLoss;
          bucket.net += entry.net;
          bucket.fatigueLoad += entry.fatigueLoad;
        }
      }
    }
    return totals;
  }, [playerRows, trainingModeOptions]);

  const topGrowth =
    [...playerRows].sort((left, right) => right.organicForecast.netSetpoints - left.organicForecast.netSetpoints)[0] ?? null;
  const topRisk =
    [...playerRows].sort(
      (left, right) =>
        right.forecast.regressionPressure - left.forecast.regressionPressure ||
        right.organicForecast.netSetpoints - left.organicForecast.netSetpoints,
    )[0] ?? null;

  // #48 — Team-Summe für die KPI-Zeile (Performance/Trainings-Zugewinn/Regression/
  // Potential-Decke/Netto). Aufsummiert aus den echten, bereits angewendeten Attribut-
  // Forecast-Feldern; der Netto-Wert ist die Summe der pro-Spieler `netSetpoints` (jedes
  // Attribut an seiner Potential-Decke gekappt). Weil Training/Performance/Regression VOR
  // der Kappung summiert werden, gilt Training + Performance − Regression NICHT von selbst
  // = Netto — die Differenz IST der Decken-Verlust. Wir weisen ihn als eigene Kachel aus,
  // damit die Kette exakt aufgeht: Performance + Training − Regression − Decke = Netto.
  const teamKpis = useMemo(() => {
    let performance = 0;
    let training = 0;
    let regression = 0;
    let net = 0;
    for (const row of playerRows) {
      for (const entry of row.attributeForecast) {
        training += entry.training;
        performance += entry.performance;
        regression += entry.regression;
      }
      net += row.organicForecast.netSetpoints;
    }
    // Decken-Verlust (≥ 0): so viel Zuwachs verpufft an den Potential-Obergrenzen. Negativ
    // dargestellt, damit performance + training + regression + ceiling === net exakt gilt.
    const ceiling = net - (performance + training + regression);
    return { performance, training, regression, ceiling, net };
  }, [playerRows]);

  // TR3 — die KPI-Zeile zeigt entweder den Ist-Zustand (`teamKpis`) oder die Simulation des
  // gewählten Modus — in IDENTISCHER Semantik (angewendetes Training; Decke als Residuum
  // derselben Kette). Es gibt keine zweite KPI-Reihe mehr.
  const simulated = simulationMode ? teamProjectionByMode.get(simulationMode) ?? null : null;
  const displayKpis = simulated
    ? {
        performance: simulated.performanceGain,
        training: simulated.appliedTrainingGain,
        regression: simulated.regression,
        ceiling: simulated.net - (simulated.performanceGain + simulated.appliedTrainingGain + simulated.regression),
        net: simulated.net,
      }
    : teamKpis;
  const simulationLabel = simulationMode
    ? trainingModeOptions.find((option) => option.value === simulationMode)?.label ?? simulationMode
    : null;

  const applySimulation = () => {
    if (!simulationMode || trainingModeReadOnly) return;
    for (const row of playerRows) {
      onSetTrainingMode(row.player.id, simulationMode);
    }
    setSimulationMode(null);
  };

  // Skala für die Netto-Balken der Tabelle: |Netto| relativ zum betragsstärksten Wert des Kaders.
  const worstAbsNet = useMemo(
    () => playerRows.reduce((max, row) => Math.max(max, Math.abs(row.organicForecast.netSetpoints)), 0),
    [playerRows],
  );

  // Hero-Zähler (#Wave2) für die KPI-Kacheln — reine Zähl-Animation, keine neue
  // Berechnung (identische Summen wie `displayKpis`; animiert auch den Ist↔Simulation-Wechsel).
  const animatedTeamPerformance = useCountUp(displayKpis.performance);
  const animatedTeamTraining = useCountUp(displayKpis.training);
  const animatedTeamRegression = useCountUp(displayKpis.regression);
  const animatedTeamCeiling = useCountUp(displayKpis.ceiling);
  const animatedTeamNet = useCountUp(displayKpis.net);

  return (
    <section
      className="nl-training"
      data-testid="foundation-training-compact"
      id="foundation-training-compact"
      data-new-look="true"
    >
      <NlCard
        className="nl-training-header-card"
        eyebrow={`${selectedTeam.shortCode} · ${selectedTeamControlMode ?? "manual"} · ${seasonLabel}`}
        title="Training"
        actions={
          <div className="nl-training-header-actions">
            {onOpenFacilities ? (
              <button type="button" className="nl-training-inline-button" onClick={onOpenFacilities}>
                Gebäude
              </button>
            ) : null}
            {onOpenTeams ? (
              <button type="button" className="nl-training-inline-button" onClick={onOpenTeams}>
                Teams
              </button>
            ) : null}
          </div>
        }
      >
        {/* TR3 — EINE KPI-Zeile. Performance/Training/Regression summieren die angewendeten
            Attribut-Forecast-Felder VOR der Kappung; die Potential-Decke ist das Residuum,
            damit exakt gilt: Performance + Training − Regression − Decke = Netto. Bei aktiver
            Simulation zeigen dieselben Kacheln die Vorschau des gewählten Modus (identische
            Semantik) und tragen die Marke „Simulation". */}
        <div className={`nl-training-kpiline${simulated ? " is-simulating" : ""}`} data-testid="nl-training-kpiline">
          {simulated && simulationLabel ? (
            <div className="nl-training-simbar" data-testid="training-simulation-flag">
              <span className="nl-training-simflag">Simulation · alle auf {simulationLabel} — nichts übernommen</span>
              <NlDeltaChip
                value={displayKpis.net - teamKpis.net}
                format={(n) => `${formatNlSignedNumber(n, 1)} SP Netto ggü. Ist`}
                title="Differenz des Team-Netto-Forecasts zwischen der Simulation und dem aktuellen Ist-Zustand."
              />
              <span className="nl-training-sim-actions">
                <button
                  type="button"
                  className="nl-training-inline-button is-apply"
                  disabled={trainingModeReadOnly}
                  onClick={applySimulation}
                  title={`Alle ${playerRows.length} angezeigten Spieler wirklich auf ${simulationLabel} stellen.`}
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  className="nl-training-inline-button"
                  onClick={() => setSimulationMode(null)}
                  title="Simulation verwerfen — die KPI-Zeile zeigt wieder den Ist-Zustand."
                >
                  Verwerfen
                </button>
              </span>
            </div>
          ) : null}
          <StatChipRow aria-label="Trainings-Kennzahlen: Performance, Trainings-Zugewinn, Regression, Potential-Decke, Netto">
            <StatChip
              label="Performance"
              value={`+${formatNlNumber(animatedTeamPerformance ?? displayKpis.performance, 1)} SP`}
              sub={simulated ? `Simulation · alle ${simulationLabel}` : "aus Matchday-Ergebnissen"}
              tone="pow"
              title="SP-Zuwachs aus echten Matchday-Ergebnissen (Score, Rang, Beitrag) über den ganzen Kader — unabhängig von der Trainingsintensität."
            />
            <StatChip
              label="Trainings-Zugewinn"
              value={`+${formatNlNumber(animatedTeamTraining ?? displayKpis.training, 1)} SP`}
              sub={simulated ? `Simulation · alle ${simulationLabel}` : "aus Trainingsintensität"}
              tone="accent"
              title="Auf die Attribute angewendeter SP-Zuwachs durch Training über den ganzen Kader — abhängig von Trainingsintensität (Leicht/Mittel/Hart), Potential und Facility-Boni."
            />
            <StatChip
              label="Regression"
              value={`−${formatNlNumber(Math.abs(animatedTeamRegression ?? displayKpis.regression), 1)} SP`}
              sub="Alterung & Marktwert-Druck"
              tone="risk"
              title="SP-Verlust, den der Kader automatisch durch Alterung, Marktwert-Druck und Belastung verliert — muss durch Training + Performance ausgeglichen werden. Intensitätsunabhängig."
            />
            <StatChip
              label="Potential-Decke"
              value={`${formatNlSignedNumber(animatedTeamCeiling ?? displayKpis.ceiling, 1)} SP`}
              sub="Decken-Kappung ± Spillover"
              tone={displayKpis.ceiling < 0 ? "risk" : "neutral"}
              title="Restglied der Kette: Netto − (Performance + Training − Regression). Negativ = Zuwachs verpufft an den Potential-Obergrenzen; positiv = Spillover auf Nebenstats hat mehr aufgefangen als die Decke gekappt hat. Damit gilt exakt: Performance + Training − Regression + Decke = Netto."
            />
            <StatChip
              label="Netto"
              value={`${formatNlSignedNumber(animatedTeamNet ?? displayKpis.net, 1)} SP`}
              sub="Performance + Training − Regression ± Decke"
              tone={displayKpis.net >= 0 ? "good" : "risk"}
              title="Team-Netto-Forecast über den ganzen Kader. Positiv = Kader wächst im Schnitt, negativ = Kader baut im Schnitt ab."
            />
          </StatChipRow>
        </div>
        <p className="nl-training-topline">
          Regeneration Ø {formatNlNumber(summary.recoveryBeforeTraining, 1)} → {formatNlNumber(summary.recoveryAfterTraining, 1)} ·
          Top: <strong>{topGrowth?.player.name ?? "—"}</strong>
          {topGrowth ? ` (${formatNlSignedNumber(topGrowth.organicForecast.netSetpoints, 1)})` : ""} · Risiko:{" "}
          <strong>{topRisk?.player.name ?? "—"}</strong>
          {topRisk ? ` (Druck ${formatNlNumber(topRisk.forecast.regressionPressure, 0)})` : ""} ·{" "}
          <button
            type="button"
            className="nl-training-topline-link"
            title="Saisonende-Sicht auf Klasse, Potential und erwartete Richtung. Klick: zu den Entwicklungsfiltern springen."
            onClick={() => {
              onSetDevelopmentFilter("growth");
              if (typeof document !== "undefined") {
                document
                  .getElementById("training-development-filters")
                  ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
              }
            }}
          >
            Entwicklungsziel: {developmentSummary.growth} steigt · {developmentSummary.stable} stabil ·{" "}
            {developmentSummary.regression} Risiko
          </button>
        </p>
        {/* Team-Intensität als Vorschau-Schalter (TR3): Klick simuliert, „Übernehmen" schreibt. */}
        <div className="nl-training-mode-block" data-testid="training-global-mode-rail">
          <div className="nl-training-mode-head">
            <span className="nl-training-mode-title">Alle auf einen Modus — erst Vorschau, dann übernehmen</span>
            <small className="nl-training-mode-counts nl-tnum">
              Aktuell: Leicht {teamModeCounts.leicht} · Mittel {teamModeCounts.mittel} · Hart {teamModeCounts.hart}
            </small>
          </div>
          <VeloIntensityRail
            ariaLabel="Trainingsmodus für alle Spieler simulieren"
            segments={modeSegments}
            activeValue={simulationMode ?? uniformTeamMode ?? ""}
            disabled={trainingModeReadOnly}
            onSelect={(value) => {
              // Vorschau, kein Schreibzugriff: erst „Übernehmen" ruft die echten Handler.
              setSimulationMode(value === uniformTeamMode ? null : (value as PlayerTrainingMode));
            }}
          />
          <small className="nl-training-mode-hint">
            Klick zeigt die Vorschau in der KPI-Zeile oben (Marke „Simulation") — verändert nichts, bis du übernimmst.
            {playerRows.length !== allPlayerCount
              ? ` Gilt für die ${playerRows.length} gefilterten von ${allPlayerCount} Spielern.`
              : ""}
          </small>
        </div>
        {managementLockedReason ? <p className="nl-training-locked">{managementLockedReason}</p> : null}
      </NlCard>

      <div className="nl-training-filter-row" id="training-development-filters" role="group" aria-label="Entwicklungsfilter">
        {DEVELOPMENT_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`nl-training-filter${developmentFilter === filter.id ? " is-active" : ""}`}
            title={filter.hint}
            aria-pressed={developmentFilter === filter.id}
            onClick={() => onSetDevelopmentFilter(filter.id)}
          >
            <span>{filter.label}</span>
            <strong className="nl-tnum">{developmentSummary[filter.id]}</strong>
          </button>
        ))}
        <label className="nl-training-sort">
          <span>Sortierung</span>
          <select
            className="input"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as TrainingSortKey)}
            aria-label="Kader sortieren"
          >
            {TRAINING_SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="nl-training-filter-count nl-tnum">
          {playerRows.length}/{allPlayerCount}
        </span>
      </div>

      {playerRows.length === 0 ? (
        <NlEmptyState
          title="Keine Trainingsdaten"
          message="Für dieses Team liegen aktuell keine Spieler oder kein passender Entwicklungsfilter vor."
          action={onOpenTeams ? { label: "Teams öffnen", onClick: onOpenTeams } : undefined}
        />
      ) : (
        <NlCard className="nl-training-table-card" data-testid="nl-training-table-card">
          <div className="nl-training-table-scroll">
            <table className="nl-training-table" data-testid="nl-training-table">
              <thead>
                <tr>
                  <th scope="col">Spieler</th>
                  <th scope="col" title="Fähigkeit (CA) und Potenzial (PO) als Sterne — dieselbe Skala wie überall sonst (Kaderliste, Profil).">
                    CA/PO
                  </th>
                  <th scope="col" title="Trainingsintensität — die tägliche Entscheidung. Zahl = erwarteter Trainings-Zuwachs (SP) bei dieser Stufe.">
                    Intensität
                  </th>
                  <th scope="col" title="Netto-Forecast über die Saison: Training + Performance − Regression. Balkenlänge = |Netto| relativ zum betragsstärksten Wert des Kaders.">
                    Netto / Saison
                  </th>
                  <th scope="col" title="Aktuelle Fatigue (0–100) und Entwicklungs-Tendenz.">
                    Belastung
                  </th>
                  <th scope="col" title="Aktuelles Saison-Gehalt (Vertragsjahr 1) — dieselbe Quelle wie die Kaderliste.">
                    Gehalt
                  </th>
                  <th scope="col" title="Restlaufzeit in Saisons und Vertragsform (FL = Front-Loaded, BL = Back-Loaded, ohne Kürzel = ausgeglichen). Lange Restlaufzeit = lohnt sich eher zu entwickeln.">
                    Vertrag
                  </th>
                  <th scope="col" title="Beste Trainingsklasse laut Schätzung — Details in der aufgeklappten Klassenliste.">
                    Klassen-Vorschlag
                  </th>
                  <th scope="col">
                    <span className="nl-training-table-sr">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayerRows.map((row) => (
                  <NlTrainingPlayerRow
                    key={row.entryId}
                    row={row}
                    worstAbsNet={worstAbsNet}
                    expanded={expandedEntryId === row.entryId}
                    onToggleExpanded={() =>
                      setExpandedEntryId((current) => (current === row.entryId ? null : row.entryId))
                    }
                    trainingModeReadOnly={trainingModeReadOnly}
                    trainingModeOptions={trainingModeOptions}
                    trainingClassOptions={trainingClassOptions}
                    onSetTrainingMode={onSetTrainingMode}
                    onSetTrainingClass={onSetTrainingClass}
                    onOpenPlayerDetails={onOpenPlayerDetails}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </NlCard>
      )}
    </section>
  );
}
