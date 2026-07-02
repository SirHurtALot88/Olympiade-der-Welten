"use client";

import { useState } from "react";

import { getGameTermTooltip } from "@/components/ui/GameTerm";
import { sortFoundationTableRows } from "@/lib/foundation/foundation-table-sort";
import type {
  FoundationTableColumn,
  FoundationTablePreset,
  FoundationTablePresetId,
  SortState,
} from "@/lib/foundation/foundation-table-ui-types";

export type { FoundationTableColumn, FoundationTablePreset, FoundationTablePresetId, SortState } from "@/lib/foundation/foundation-table-ui-types";

export function sortTableRows<T>(
  rows: T[],
  sortState: SortState | undefined,
  accessors: Record<string, (row: T) => string | number>,
) {
  return sortFoundationTableRows(rows, sortState, accessors);
}

export function SortableHeader({
  label,
  tableId,
  columnKey,
  sortState,
  onToggle,
  tooltip,
}: {
  label: string;
  tableId: string;
  columnKey: string;
  sortState?: SortState;
  onToggle: (tableId: string, columnKey: string) => void;
  tooltip?: string | null;
}) {
  const isActive = sortState?.key === columnKey;
  const arrow = !isActive ? "↕" : sortState.direction === "asc" ? "↑" : "↓";
  const resolvedTooltip = tooltip ?? getGameTermTooltip(label) ?? getGameTermTooltip(columnKey);

  return (
    <button
      className={`sortable-header${isActive ? " is-active" : ""}`}
      type="button"
      onClick={() => onToggle(tableId, columnKey)}
      title={resolvedTooltip ?? `Nach ${label} sortieren`}
      aria-label={`${label} sortieren${resolvedTooltip ? `: ${resolvedTooltip}` : ""}`}
    >
      <span>{label}</span>
      {resolvedTooltip ? <span className="sortable-help-dot" aria-hidden="true">?</span> : null}
      <span className="sortable-arrow">{arrow}</span>
    </button>
  );
}

export function ColumnVisibilityManager({
  title,
  columns,
  presets = [],
  activePreset = null,
  isVisible,
  onToggle,
  onMove,
  getWidth,
  onStepWidth,
  onResetWidth,
  onApplyPreset,
  onResetToDefault,
}: {
  title: string;
  columns: FoundationTableColumn[];
  presets?: FoundationTablePreset[];
  activePreset?: FoundationTablePresetId | null;
  isVisible: (columnId: string, visibleByDefault?: boolean) => boolean;
  onToggle: (columnId: string, nextVisible: boolean) => void;
  onMove?: (columnId: string, direction: "left" | "right") => void;
  getWidth?: (column: FoundationTableColumn) => number;
  onStepWidth?: (column: FoundationTableColumn, delta: number) => void;
  onResetWidth?: (column: FoundationTableColumn) => void;
  onApplyPreset?: (presetId: Exclude<FoundationTablePresetId, "custom">) => void;
  onResetToDefault?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`column-visibility-manager${isOpen ? " is-open" : ""}`}>
      <button
        className="column-visibility-toggle"
        type="button"
        title="Spalten, Breite & Reihenfolge"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{title}</span>
        <span className="column-visibility-toggle-icon" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      {isOpen && presets.length > 0 ? (
        <div className="table-customization-presets">
          <label className="filter-field table-customization-preset-field">
            <span>Preset</span>
            <select
              className="input"
              value={activePreset && activePreset !== "custom" ? activePreset : "custom"}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  return;
                }
                onApplyPreset?.(event.target.value as Exclude<FoundationTablePresetId, "custom">);
              }}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>
          <button className="secondary-button inline-button" type="button" onClick={onResetToDefault}>
            Layout zurücksetzen
          </button>
        </div>
      ) : null}
      {isOpen ? (
        <div className="table-customization-presets">
          <button
            className="secondary-button inline-button"
            type="button"
            onClick={() => columns.forEach((column) => onToggle(column.id, true))}
          >
            Alle anzeigen
          </button>
          {presets.length === 0 && onResetToDefault ? (
            <button className="secondary-button inline-button" type="button" onClick={onResetToDefault}>
              Layout zurücksetzen
            </button>
          ) : null}
        </div>
      ) : null}
      {isOpen ? <div className="column-visibility-grid">
        {columns.map((column) => {
          const checked = isVisible(column.id, column.visibleByDefault);
          return (
            <div key={column.id} className="column-visibility-option">
              <div className="table-customization-option-main">
                <label className="table-customization-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggle(column.id, event.target.checked)}
                  />
                  <span>{column.label}</span>
                </label>
              </div>
              <div className="table-customization-option-actions">
                {typeof getWidth === "function" ? <span className="table-customization-width">{getWidth(column)} px</span> : null}
                {onMove ? (
                  <>
                    <button className="ghost-button" type="button" onClick={() => onMove(column.id, "left")} aria-label={`${column.label} nach links`}>
                      ←
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onMove(column.id, "right")} aria-label={`${column.label} nach rechts`}>
                      →
                    </button>
                  </>
                ) : null}
                {onStepWidth ? (
                  <>
                    <button className="ghost-button" type="button" onClick={() => onStepWidth(column, -16)} aria-label={`${column.label} schmaler`}>
                      −
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onStepWidth(column, 16)} aria-label={`${column.label} breiter`}>
                      +
                    </button>
                  </>
                ) : null}
                {onResetWidth ? (
                  <button className="ghost-button" type="button" onClick={() => onResetWidth(column)} aria-label={`${column.label} Breite zurücksetzen`}>
                    Reset
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div> : null}
    </div>
  );
}
