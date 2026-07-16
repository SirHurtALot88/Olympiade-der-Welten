"use client";

import { useRef, useState, type DragEvent } from "react";

interface Props {
  billbeeFiles: File[];
  ebayFile: File | null;
  onAddBillbee: (files: File[]) => void;
  onSetEbay: (file: File | null) => void;
  onRemoveBillbee: (index: number) => void;
  disabled?: boolean;
}

function classifyFiles(files: File[]): { billbee: File[]; ebay: File | null } {
  const billbee: File[] = [];
  let ebay: File | null = null;
  for (const f of files) {
    if (/\.xlsx$/i.test(f.name)) billbee.push(f);
    else if (/\.csv$/i.test(f.name)) ebay = f;
  }
  return { billbee, ebay };
}

export function UploadZone({
  billbeeFiles,
  ebayFile,
  onAddBillbee,
  onSetEbay,
  onRemoveBillbee,
  disabled,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const { billbee, ebay } = classifyFiles(Array.from(fileList));
    if (billbee.length > 0) onAddBillbee(billbee);
    if (ebay) onSetEbay(ebay);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        style={{
          border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          background: dragOver ? "var(--accent-soft)" : "var(--panel2)",
          borderRadius: "var(--r)",
          padding: "28px 20px",
          textAlign: "center",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "background .1s, border-color .1s",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          Dateien hierher ziehen oder klicken
        </div>
        <div style={{ fontSize: 12.5, color: "var(--faint)" }}>
          Billbee-Fenster 30/90/365 T (.xlsx) · eBay-Report (.csv)
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.csv"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {(billbeeFiles.length > 0 || ebayFile) && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {billbeeFiles.map((f, i) => (
            <FileRow
              key={`${f.name}-${i}`}
              label="Billbee"
              name={f.name}
              onRemove={disabled ? undefined : () => onRemoveBillbee(i)}
            />
          ))}
          {ebayFile && (
            <FileRow
              label="eBay"
              name={ebayFile.name}
              onRemove={disabled ? undefined : () => onSetEbay(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({
  label,
  name,
  onRemove,
}: {
  label: string;
  name: string;
  onRemove?: () => void;
}) {
  return (
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
      <span className="pill p-mkt" style={{ flex: "none" }}>
        {label}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            marginLeft: "auto",
            border: 0,
            background: "transparent",
            color: "var(--faint)",
            cursor: "pointer",
            fontSize: 15,
            lineHeight: 1,
          }}
          aria-label="Entfernen"
        >
          ×
        </button>
      )}
    </div>
  );
}
