"use client";

import { useRef } from "react";

interface Props {
  file: File | null;
  onSetFile: (file: File | null) => void;
  disabled?: boolean;
}

/**
 * Eigener Upload-Slot fuer den Billbee-Artikelstamm-Export (separat von den
 * Verkaufs-Fenster-Dateien in UploadZone, da beide .xlsx sind und sich nicht
 * an der Dateiendung unterscheiden lassen -- Chris' Ergaenzung: dieser Export
 * bringt Lagerbestand + aktuellen VK/EK + den aktiven Katalog mit).
 */
export function BillbeeArtikelUpload({ file, onSetFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Billbee-Artikelstamm (.xlsx)</div>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
            Liefert Lagerbestand, aktuellen VK/EK und den aktiven Katalog (Artikel, die hier fehlen,
            gelten als ausgelaufen).
          </div>
        </div>
        {file ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--panel2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)",
              padding: "8px 11px",
              fontSize: 12.5,
            }}
          >
            <span className="pill p-good" style={{ flex: "none" }}>
              Artikelstamm
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              {file.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onSetFile(null)}
                style={{ border: 0, background: "transparent", color: "var(--faint)", cursor: "pointer", fontSize: 15 }}
                aria-label="Entfernen"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="chip"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            style={{ padding: "8px 14px" }}
          >
            Datei wählen …
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          style={{ display: "none" }}
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f) onSetFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
