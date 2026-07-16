"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadZone } from "./UploadZone";
import { ImportSummaryCard } from "./ImportSummaryCard";
import { ReviewRow } from "./ReviewRow";
import type { ImportSummary, OpenReviewItem } from "./types";

interface Props {
  initialReviewItems: OpenReviewItem[];
  articleCount: number;
}

export function ImportView({ initialReviewItems, articleCount }: Props) {
  const router = useRouter();
  const [billbeeFiles, setBillbeeFiles] = useState<File[]>([]);
  const [ebayFile, setEbayFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [reviewItems, setReviewItems] = useState<OpenReviewItem[]>(initialReviewItems);

  const canUpload = billbeeFiles.length > 0 || ebayFile !== null;

  async function handleUpload() {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of billbeeFiles) form.append("billbee", f);
      if (ebayFile) form.append("ebay", ebayFile);

      const res = await fetch("/api/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || "Import fehlgeschlagen.");
        setUploading(false);
        return;
      }
      setSummary(data.summary as ImportSummary);
      setBillbeeFiles([]);
      setEbayFile(null);
      // Frische Review-Liste laden (Server-Komponente neu rendern).
      router.refresh();
      const reviewRes = await fetch("/api/review/list");
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        setReviewItems(reviewData.items ?? []);
      }
    } catch {
      setError("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setUploading(false);
    }
  }

  function handleResolved(id: string) {
    setReviewItems((items) => items.filter((i) => i.id !== id));
  }

  return (
    <>
      <UploadZone
        billbeeFiles={billbeeFiles}
        ebayFile={ebayFile}
        onAddBillbee={(files) => setBillbeeFiles((prev) => [...prev, ...files])}
        onSetEbay={setEbayFile}
        onRemoveBillbee={(index) => setBillbeeFiles((prev) => prev.filter((_, i) => i !== index))}
        disabled={uploading}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!canUpload || uploading}
          className="chip c-good"
          style={{
            padding: "9px 18px",
            fontSize: 13,
            cursor: !canUpload || uploading ? "default" : "pointer",
            opacity: !canUpload || uploading ? 0.55 : 1,
          }}
        >
          {uploading ? "Importiere …" : "Import starten"}
        </button>
        <span style={{ fontSize: 12, color: "var(--faint)" }}>
          Fenster (30/90/365 T) wird aus dem Zeitraum-Feld der Datei erkannt · Re-Import ersetzt den
          Snapshot
        </span>
      </div>

      {error && (
        <div
          className="card"
          style={{ padding: "12px 16px", marginBottom: 16, color: "var(--crit)", fontSize: 13 }}
        >
          {error}
        </div>
      )}

      {summary && <ImportSummaryCard summary={summary} />}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          Review-Liste
          <span className="r">
            {reviewItems.length} ungematcht · {articleCount} Kartenartikel gesamt
          </span>
        </h3>
        {reviewItems.length === 0 ? (
          <div style={{ padding: "10px 16px 16px", fontSize: 12.5, color: "var(--faint)" }}>
            Nichts zu prüfen — alle Zeilen sind zugeordnet.
          </div>
        ) : (
          <div>
            <div
              style={{
                padding: "0 16px 10px",
                fontSize: 11.5,
                color: "var(--faint)",
              }}
            >
              Billbee-Zeilen ohne eBay-Match zuordnen (gelernter Alias matcht künftig automatisch)
              oder Privatverkäufe ignorieren.
            </div>
            {reviewItems.map((item) => (
              <ReviewRow key={item.id} item={item} onResolved={handleResolved} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
