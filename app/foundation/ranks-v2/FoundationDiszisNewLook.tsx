"use client";

import { useMemo } from "react";
import type * as React from "react";

import {
  NlBarChart,
  NlCard,
  NlEmptyState,
  NlProgressBar,
  NlTable,
  StatChip,
  StatChipRow,
  formatNlNumber,
  nlToneClass,
  NL_AXIS_LABELS,
  NL_TONE_VAR,
  type NlAxisKey,
  type NlTableColumn,
  type NlTone,
} from "@/components/foundation/new-look";
import type { DisciplineCategoryFilter, FoundationDiszisPanelProps } from "@/app/foundation/ranks-v2/FoundationDiszisPanel";

/**
 * "Neuer Look" Spielplan — bildet den Diszis-Reiter (jetzt "Spielplan")
 * im neuen Design-System nach (flag-gated, additiv).
 *
 * Der Saison-Spielplan (Spieltag-Ablauf) ist die Hero-Sektion: eine
 * Achsen-Farblegende plus ein Kartenraster über alle Spieltage, damit auf
 * einen Blick klar ist, welche Achsen-Farbe (POW/SPE/MEN/SOC) welche
 * Disziplin trägt. Die Disziplin-Konfiguration (Draftboard-Reihenfolge,
 * Spieleranzahl, Mutatoren) bleibt darunter als sekundäre Sektion erhalten.
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationDiszisPanel` fällt ohne Flag unverändert auf die bestehende
 * Tabelle zurück. Konsumiert dieselben Daten-Props wie zuvor
 * (`visibleDisciplineConfigRows`, `seasonDisciplineScheduleRows`, …);
 * Sortierung läuft weiterhin über `tableSorts.disciplineConfig` /
 * `toggleTableSort`, Filter über `disciplineCategoryFilter` /
 * `setDisciplineCategoryFilter` — beides bereits beim Aufrufer
 * (useFoundationCrossTabDisciplineRanks) angewendet, die Zeilen kommen
 * also schon gefiltert/sortiert an.
 *
 * Spaltenbreiten-/Reihenfolge-/Sichtbarkeits-Verwaltung (ColumnVisibilityManager,
 * `getTableColumnWidth`, `moveTableColumn`, Drag-Resize, …) ist bewusst NICHT
 * übernommen: `NlTable` ist die schlanke Tabellen-Grundlage des neuen Looks
 * (feste Spalten, sortierbare Köpfe) — analog zu `FoundationRanksNewLook`, das
 * dieselbe Art von Legacy-Spalten-Chrome aus `FoundationRanksPanelProps`
 * ebenfalls ungenutzt lässt.
 */

type DisciplineRow = FoundationDiszisPanelProps["visibleDisciplineConfigRows"][number];
type ScheduleRow = FoundationDiszisPanelProps["seasonDisciplineScheduleRows"][number];
type ScheduleSlot = { disciplineId?: string; displayName?: string; order?: number | null; playerCount?: number | null; category?: string } | null | undefined;

const CATEGORY_AXIS: Record<Exclude<DisciplineCategoryFilter, "all">, NlAxisKey> = {
  power: "pow",
  speed: "spe",
  mental: "men",
  social: "soc",
};

const AXIS_LEGEND: Array<{ axis: NlAxisKey; label: string }> = [
  { axis: "pow", label: NL_AXIS_LABELS.pow },
  { axis: "spe", label: NL_AXIS_LABELS.spe },
  { axis: "men", label: NL_AXIS_LABELS.men },
  { axis: "soc", label: NL_AXIS_LABELS.soc },
];

const NL_DISZIS_FILTERS: Array<{ id: DisciplineCategoryFilter; label: string; tone: NlTone }> = [
  { id: "all", label: "Alle", tone: "accent" },
  { id: "power", label: NL_AXIS_LABELS.pow, tone: "pow" },
  { id: "speed", label: NL_AXIS_LABELS.spe, tone: "spe" },
  { id: "mental", label: NL_AXIS_LABELS.men, tone: "men" },
  { id: "social", label: NL_AXIS_LABELS.soc, tone: "soc" },
];

function categoryAxis(row: DisciplineRow): NlAxisKey | null {
  const category = row.category as DisciplineCategoryFilter | undefined;
  if (!category || category === "all") return null;
  return CATEGORY_AXIS[category] ?? null;
}

function slotAxis(slot: ScheduleSlot): NlAxisKey | null {
  const category = slot?.category as DisciplineCategoryFilter | undefined;
  if (!category || category === "all") return null;
  return CATEGORY_AXIS[category] ?? null;
}

const DISCIPLINE_CONFIG_COLUMNS: NlTableColumn<DisciplineRow>[] = [
  { key: "originalOrder", label: "Original", sortable: true, align: "right", width: "88px", tooltip: "Original-Reihenfolge aus dem Draftboard" },
  { key: "displayOrder", label: "Reihenfolge", sortable: true, align: "right", width: "100px", tooltip: "Neue Reihenfolge" },
  { key: "name", label: "Disziplin", sortable: true },
  { key: "playerCount", label: "Spieler", sortable: true, width: "180px", tooltip: "Spieleranzahl pro Disziplin" },
  { key: "mutator1", label: "Mutator 1", sortable: true },
  { key: "mutator2", label: "Mutator 2", sortable: true },
];

/** Ein Slot (D1/D2) innerhalb einer Spieltag-Karte — farbcodiert nach Achse. */
function ScheduleSlotRow({ slot }: { slot: ScheduleSlot }) {
  if (!slot) {
    return (
      <div className="nl-diszis-md-slot is-empty">
        <span className="nl-diszis-md-slot-name muted">—</span>
      </div>
    );
  }
  const axis = slotAxis(slot);
  const color = axis ? NL_TONE_VAR[axis] : NL_TONE_VAR.neutral;
  return (
    <div className="nl-diszis-md-slot" style={{ "--slot-color": color } as React.CSSProperties}>
      <span className="nl-diszis-md-slot-name">{slot.displayName ?? "—"}</span>
      <span className="nl-diszis-md-slot-meta">
        {axis ? <span className="nl-diszis-md-slot-axis" style={{ color }}>{NL_AXIS_LABELS[axis]}</span> : null}
        {slot.playerCount != null ? <span className="muted"> · {formatNlNumber(slot.playerCount, 0)} Spieler</span> : null}
      </span>
    </div>
  );
}

function ScheduleMatchdayCard({ row, isCurrent }: { row: ScheduleRow; isCurrent: boolean }) {
  const discipline1 = row.discipline1 as ScheduleSlot;
  const discipline2 = row.discipline2 as ScheduleSlot;
  return (
    <article className={`nl-diszis-md-card${isCurrent ? " is-current" : ""}`}>
      <header className="nl-diszis-md-card-head">
        <strong>{row.matchdayLabel as React.ReactNode}</strong>
        {isCurrent ? <span className="nl-diszis-md-current-tag">· läuft</span> : null}
      </header>
      <div className="nl-diszis-md-card-body">
        <ScheduleSlotRow slot={discipline1} />
        <ScheduleSlotRow slot={discipline2} />
      </div>
      {row.sourceStatus ? <footer className="nl-diszis-md-card-foot muted">{row.sourceStatus as React.ReactNode}</footer> : null}
    </article>
  );
}

export default function FoundationDiszisNewLook({
  disciplineCategoryFilter,
  setDisciplineCategoryFilter,
  visibleDisciplineConfigRows,
  seasonDisciplineScheduleRows,
  currentMatchdayId,
  tableSorts,
  toggleTableSort,
}: FoundationDiszisPanelProps) {
  const activeFilter = NL_DISZIS_FILTERS.find((entry) => entry.id === disciplineCategoryFilter) ?? NL_DISZIS_FILTERS[0];

  const totalPlayers = useMemo(
    () => visibleDisciplineConfigRows.reduce((sum, row) => sum + (Number(row.playerCount) || 0), 0),
    [visibleDisciplineConfigRows],
  );

  const maxPlayerCount = useMemo(
    () => visibleDisciplineConfigRows.reduce((max, row) => Math.max(max, Number(row.playerCount) || 0), 0),
    [visibleDisciplineConfigRows],
  );

  const missingMutatorCount = useMemo(
    () => visibleDisciplineConfigRows.filter((row) => !row.mutator1 && !row.mutator2).length,
    [visibleDisciplineConfigRows],
  );

  // Ein Balken je (bereits gefilterter/sortierter) Disziplin — Spieleranzahl
  // liest sich als Balken schneller als in einer reinen Zahlenspalte.
  const playerCountBars = useMemo(
    () =>
      visibleDisciplineConfigRows.map((row) => {
        const axis = categoryAxis(row);
        return {
          label: String(row.name ?? "").replace(/\s+/g, "").slice(0, 3).toUpperCase() || "—",
          value: Number(row.playerCount) || 0,
          tone: axis ?? ("neutral" as const),
        };
      }),
    [visibleDisciplineConfigRows],
  );

  function renderDisciplineCell(row: DisciplineRow, column: NlTableColumn<DisciplineRow>): React.ReactNode {
    switch (column.key) {
      case "originalOrder":
      case "displayOrder":
        return <span className="nl-tnum">{formatNlNumber(Number(row[column.key]) || 0, 0)}</span>;
      case "name": {
        const axis = categoryAxis(row);
        return (
          <span>
            <strong style={axis ? { color: NL_TONE_VAR[axis] } : undefined}>{row.name as React.ReactNode}</strong>
            {axis ? (
              <>
                <br />
                <small className="muted">{NL_AXIS_LABELS[axis]}</small>
              </>
            ) : null}
          </span>
        );
      }
      case "playerCount": {
        const value = Number(row.playerCount) || 0;
        const axis = categoryAxis(row);
        return (
          <NlProgressBar
            value={value}
            max={maxPlayerCount > 0 ? maxPlayerCount : 1}
            tone={axis ?? "neutral"}
            format={(current) => formatNlNumber(current, 0)}
            className="nl-diszis-playercount-bar"
            title={`${formatNlNumber(value, 0)} Spieler (max. ${formatNlNumber(maxPlayerCount, 0)} in dieser Ansicht)`}
          />
        );
      }
      case "mutator1":
      case "mutator2": {
        const value = (row[column.key] as string) || "";
        return value ? <>{value}</> : <span className="muted">kein Mutator</span>;
      }
      default:
        return null;
    }
  }

  const scheduleSourceStatus = (seasonDisciplineScheduleRows[0]?.sourceStatus as string | undefined) ?? "legacy_seed";
  const scheduleSourceNote = seasonDisciplineScheduleRows[0]?.sourceNote as React.ReactNode | undefined;

  return (
    <section
      className="nl-diszis"
      data-testid="foundation-diszis"
      id="foundation-diszis"
      data-new-look="true"
      style={{ display: "flex", flexDirection: "column", gap: "var(--nl-s4, 20px)" }}
    >
      <NlCard
        className="nl-diszis-schedule-card"
        eyebrow="Saison-Spielplan"
        title="Spieltag-Ablauf"
        actions={<StatChip label="Quelle" value={scheduleSourceStatus} />}
        data-testid="foundation-diszis-schedule"
      >
        <div id="foundation-diszis-schedule" style={{ scrollMarginTop: 16 }}>
          <div className="nl-diszis-axis-legend" role="group" aria-label="Achsen-Farblegende">
            {AXIS_LEGEND.map((entry) => (
              <span key={entry.axis} className="nl-diszis-axis-legend-item">
                <span className="nl-diszis-axis-legend-swatch" style={{ background: NL_TONE_VAR[entry.axis] }} aria-hidden="true" />
                {entry.label}
              </span>
            ))}
          </div>

          {seasonDisciplineScheduleRows.length > 0 ? (
            <div className="nl-diszis-schedule-grid" data-testid="nl-diszis-schedule-grid">
              {seasonDisciplineScheduleRows.map((row) => (
                <ScheduleMatchdayCard key={String(row.matchdayId)} row={row} isCurrent={row.matchdayId === currentMatchdayId} />
              ))}
            </div>
          ) : (
            <NlEmptyState title="Noch kein Saison-Matchday-Plan verfügbar." />
          )}
        </div>
        {scheduleSourceNote ? <p className="muted">{scheduleSourceNote}</p> : null}
      </NlCard>

      <NlCard
        className="nl-diszis-config-card"
        eyebrow="Draftboard"
        title="Disziplin-Konfiguration"
        actions={
          <div className="nl-ranks-filterbar" role="group" aria-label="Disziplin-Kategorien">
            {NL_DISZIS_FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`nl-ranks-filter ${nlToneClass(entry.tone)}${disciplineCategoryFilter === entry.id ? " is-active" : ""}`}
                onClick={() => setDisciplineCategoryFilter(entry.id)}
                aria-pressed={disciplineCategoryFilter === entry.id}
              >
                {entry.label}
              </button>
            ))}
          </div>
        }
      >
        <StatChipRow aria-label="Diszis-Überblick">
          <StatChip
            label={`Diszis · ${activeFilter.label}`}
            value={formatNlNumber(visibleDisciplineConfigRows.length, 0)}
            tone={activeFilter.tone}
            title="Anzahl Disziplinen in der aktuellen Kategorie-Auswahl"
          />
          <StatChip
            label="Spieler gesamt"
            value={formatNlNumber(totalPlayers, 0)}
            title="Summe der Spieleranzahl über alle sichtbaren Disziplinen"
          />
          <StatChip
            label="Ø Spieler/Diszi"
            value={formatNlNumber(visibleDisciplineConfigRows.length > 0 ? totalPlayers / visibleDisciplineConfigRows.length : 0, 1)}
            title="Durchschnittliche Spieleranzahl je Disziplin"
          />
          <StatChip
            label="Ohne Mutator"
            value={formatNlNumber(missingMutatorCount, 0)}
            sub={`von ${formatNlNumber(visibleDisciplineConfigRows.length, 0)}`}
            tone={missingMutatorCount > 0 ? "warn" : "good"}
            title="Disziplinen ohne im Saison-Spielplan hinterlegten Mutator"
          />
        </StatChipRow>

        {playerCountBars.length > 0 ? (
          <div className="nl-ranks-metric-chart-scroll">
            <NlBarChart
              bars={playerCountBars}
              format={(value) => formatNlNumber(value, 0)}
              aria-label="Spieleranzahl je Disziplin"
              className="nl-ranks-metric-chart"
            />
          </div>
        ) : null}

        {visibleDisciplineConfigRows.length > 0 ? (
          <NlTable
            columns={DISCIPLINE_CONFIG_COLUMNS}
            rows={visibleDisciplineConfigRows}
            rowKey={(row) => String(row.id)}
            renderCell={renderDisciplineCell}
            sortState={tableSorts.disciplineConfig}
            onSort={(key) => toggleTableSort("disciplineConfig", key)}
            aria-label="Disziplin-Konfiguration"
            data-testid="nl-diszis-config-table"
          />
        ) : (
          <NlEmptyState
            title="Keine Disziplinen in dieser Kategorie."
            message="Andere Kategorie wählen oder auf „Alle“ zurücksetzen."
            action={{ label: "Alle anzeigen", onClick: () => setDisciplineCategoryFilter("all") }}
          />
        )}

        <p className="muted">
          Mutatoren sind pro Disziplin (noch) nicht im Saison-Spielplan hinterlegt — die Spalten zeigen daher
          „kein Mutator&#8220;. Der vollständige Spieltag-Ablauf steht im{" "}
          <a href="#foundation-diszis-schedule">Saison-Spielplan</a> oben.
        </p>
      </NlCard>
    </section>
  );
}
