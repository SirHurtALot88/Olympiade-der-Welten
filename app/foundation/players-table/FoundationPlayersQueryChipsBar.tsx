"use client";

/**
 * Query-Chip-Builder für das Spieler-Verzeichnis (additiv, "Neuer Look").
 *
 * Attribut + Operator + Wert → Chip, mehrere Chips kombinieren sich per UND
 * (Filter-Logik in `foundation-players-query-chips.ts`). Presets sind reiner
 * Client-Komfort (localStorage, keyed per Save-ID) — gleiche Idee wie die
 * bestehenden Transfermarkt-Filter-Presets in
 * `app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx`, hier aber
 * auf das additive Chip-Vokabular des neuen Looks übertragen.
 *
 * Reiner Presentational-/State-Owner für seinen eigenen Baustein: die
 * Host-Tabelle (`FoundationPlayersTableNewLook.tsx`) hält nur die aktive
 * `chips`-Liste und filtert damit ihre `rows` — der Builder-Entwurf
 * (gewähltes Attribut/Operator/Wert) und die Preset-Verwaltung bleiben
 * lokal in dieser Komponente.
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-pquery-*`.
 */

import { useEffect, useState, type FormEvent } from "react";

import { NlCard } from "@/components/foundation/new-look";
import {
  formatQueryChipLabel,
  getActiveSaveIdFromLocation,
  QUERY_CHIP_ATTRIBUTES,
  readQueryChipPresets,
  writeQueryChipPresets,
  type QueryChip,
  type QueryChipAttr,
  type QueryChipOperator,
  type QueryChipPreset,
} from "@/app/foundation/players-table/foundation-players-query-chips";

export type FoundationPlayersQueryChipsBarProps = {
  chips: QueryChip[];
  onChipsChange: (chips: QueryChip[]) => void;
  classOptions: string[];
  raceOptions: string[];
  /** Kategorien-Optionen für das Attribut "Beste Diszi" (aus den geladenen Zeilen abgeleitet). */
  bestDisciplineOptions: string[];
};

export default function FoundationPlayersQueryChipsBar({
  chips,
  onChipsChange,
  classOptions,
  raceOptions,
  bestDisciplineOptions,
}: FoundationPlayersQueryChipsBarProps) {
  const [draftAttr, setDraftAttr] = useState<QueryChipAttr>("ovr");
  const [draftOperator, setDraftOperator] = useState<QueryChipOperator>(">=");
  const [draftValue, setDraftValue] = useState("");
  const [presets, setPresets] = useState<QueryChipPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);

  const activeAttrMeta = QUERY_CHIP_ATTRIBUTES.find((entry) => entry.key === draftAttr) ?? QUERY_CHIP_ATTRIBUTES[0]!;
  const isCategory = activeAttrMeta.kind === "category";
  const categoryOptions =
    draftAttr === "class"
      ? classOptions
      : draftAttr === "race"
        ? raceOptions
        : draftAttr === "bestDiscipline"
          ? bestDisciplineOptions
          : [];

  // Presets sind rein clientseitig — beim Mount aus localStorage laden (SSR-sicher via typeof-window-Guard in den Helfern).
  useEffect(() => {
    setPresets(readQueryChipPresets(getActiveSaveIdFromLocation()));
  }, []);

  useEffect(() => {
    if (isCategory) {
      setDraftValue(categoryOptions[0] ?? "");
    } else {
      setDraftValue("");
    }
    // categoryOptions bewusst nicht in den Deps — nur ein Attributwechsel soll den Entwurfswert zurücksetzen,
    // nicht jedes Neu-Berechnen der (referenz-instabilen) Options-Liste aus dem Host.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftAttr, isCategory]);

  function handleAddChip(event: FormEvent) {
    event.preventDefault();
    if (isCategory) {
      if (!draftValue) {
        return;
      }
      onChipsChange([...chips, { id: crypto.randomUUID(), attr: draftAttr, operator: "=", value: draftValue }]);
      return;
    }
    const numeric = Number.parseFloat(draftValue.replace(",", "."));
    if (!Number.isFinite(numeric)) {
      return;
    }
    onChipsChange([...chips, { id: crypto.randomUUID(), attr: draftAttr, operator: draftOperator, value: numeric }]);
    setDraftValue("");
  }

  function handleRemoveChip(chipId: string) {
    onChipsChange(chips.filter((chip) => chip.id !== chipId));
  }

  function handleSavePreset() {
    const trimmedName = presetName.trim();
    if (!trimmedName || chips.length === 0) {
      setPresetMessage("Bitte erst Bedingungen hinzufügen und einen Namen vergeben.");
      return;
    }
    const saveId = getActiveSaveIdFromLocation();
    setPresets((current) => {
      const nextPreset: QueryChipPreset = {
        id: crypto.randomUUID(),
        name: trimmedName.slice(0, 32),
        chips,
        createdAt: new Date().toISOString(),
      };
      const next = [nextPreset, ...current].slice(0, 24);
      writeQueryChipPresets(saveId, next);
      setSelectedPresetId(nextPreset.id);
      return next;
    });
    setPresetName("");
    setPresetMessage(`Preset "${trimmedName.slice(0, 32)}" gespeichert.`);
  }

  function handleLoadPreset(presetId: string) {
    setSelectedPresetId(presetId);
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }
    onChipsChange(preset.chips);
    setPresetMessage(`Preset "${preset.name}" geladen.`);
  }

  function handleDeletePreset(presetId: string) {
    const preset = presets.find((entry) => entry.id === presetId);
    const saveId = getActiveSaveIdFromLocation();
    setPresets((current) => {
      const next = current.filter((entry) => entry.id !== presetId);
      writeQueryChipPresets(saveId, next);
      return next;
    });
    if (selectedPresetId === presetId) {
      setSelectedPresetId("");
    }
    setPresetMessage(preset ? `Preset "${preset.name}" gelöscht.` : "Preset gelöscht.");
  }

  return (
    <NlCard className="nl-pquery-card" eyebrow="Filter" title="Bedingungen">
      <form className="nl-pquery-builder" onSubmit={handleAddChip} aria-label="Filter-Bedingung hinzufügen">
        <label className="nl-pquery-field">
          <span>Attribut</span>
          <select value={draftAttr} onChange={(event) => setDraftAttr(event.target.value as QueryChipAttr)}>
            {QUERY_CHIP_ATTRIBUTES.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        {!isCategory ? (
          <label className="nl-pquery-field nl-pquery-field-op">
            <span>Op.</span>
            <select value={draftOperator} onChange={(event) => setDraftOperator(event.target.value as QueryChipOperator)}>
              <option value=">=">≥</option>
              <option value="<=">≤</option>
              <option value="=">=</option>
            </select>
          </label>
        ) : null}
        <label className="nl-pquery-field">
          <span>Wert</span>
          {isCategory ? (
            <select value={draftValue} onChange={(event) => setDraftValue(event.target.value)} disabled={categoryOptions.length === 0}>
              {categoryOptions.length === 0 ? (
                <option value="">—</option>
              ) : (
                categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))
              )}
            </select>
          ) : (
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={draftValue}
              onChange={(event) => setDraftValue(event.target.value)}
              placeholder={activeAttrMeta.money ? "Mio." : "Wert"}
              aria-label="Wert"
            />
          )}
        </label>
        <button type="submit" className="nl-pquery-add-btn">
          + Hinzufügen
        </button>
      </form>

      {chips.length > 0 ? (
        <ul className="nl-pquery-chip-list" aria-label="Aktive Filter-Bedingungen">
          {chips.map((chip) => (
            <li key={chip.id} className="nl-pquery-chip">
              <span className="nl-tnum">{formatQueryChipLabel(chip)}</span>
              <button
                type="button"
                className="nl-pquery-chip-remove"
                onClick={() => handleRemoveChip(chip.id)}
                aria-label={`Bedingung entfernen: ${formatQueryChipLabel(chip)}`}
                title="Entfernen"
              >
                ×
              </button>
            </li>
          ))}
          {chips.length > 1 ? (
            <button type="button" className="nl-pquery-chip-clear" onClick={() => onChipsChange([])}>
              Alle entfernen
            </button>
          ) : null}
        </ul>
      ) : null}

      <div className="nl-pquery-presets">
        <input
          type="text"
          className="nl-pquery-preset-name"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
          placeholder="Preset-Name"
          aria-label="Preset-Name"
          maxLength={32}
        />
        <button type="button" className="nl-pquery-preset-save" onClick={handleSavePreset} disabled={chips.length === 0}>
          Preset speichern
        </button>
        <select
          className="nl-pquery-preset-select"
          aria-label="Preset laden"
          value={selectedPresetId}
          onChange={(event) => (event.target.value ? handleLoadPreset(event.target.value) : setSelectedPresetId(""))}
        >
          <option value="">Preset laden…</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name} ({preset.chips.length})
            </option>
          ))}
        </select>
        {selectedPresetId ? (
          <button
            type="button"
            className="nl-pquery-preset-delete"
            onClick={() => handleDeletePreset(selectedPresetId)}
            aria-label="Ausgewähltes Preset löschen"
            title="Ausgewähltes Preset löschen"
          >
            ×
          </button>
        ) : null}
      </div>
      {presetMessage ? (
        <p className="nl-pquery-preset-message" aria-live="polite">
          {presetMessage}
        </p>
      ) : null}
    </NlCard>
  );
}
