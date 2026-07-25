"use client";

import { useEffect, useRef, useState } from "react";
import type { ArticleSearchResult } from "@/components/import/types";
import { buildCardmarketSearchUrl } from "@/lib/pricing/marketPrice";

export interface SelectedArticle {
  id: string;
  nameRaw: string;
  setCode: string | null;
  packQty: number;
}

interface Props {
  onSelect: (article: SelectedArticle) => void;
  selected: SelectedArticle | null;
  onSaved: () => void;
}

const FIELD_DEFS: { key: keyof FormValues; label: string; placeholder: string }[] = [
  { key: "priceFrom", label: "ab (günstigstes Angebot)", placeholder: "z. B. 0,59" },
  { key: "priceTrend", label: "Preis-Trend", placeholder: "z. B. 0,65" },
  { key: "priceAvg30", label: "30-Tage-Ø", placeholder: "z. B. 0,60" },
  { key: "priceAvg7", label: "7-Tage-Ø", placeholder: "z. B. 0,58" },
  { key: "priceAvg1", label: "1-Tages-Ø", placeholder: "z. B. 0,55" },
  { key: "available", label: "Verfügbar (Stk)", placeholder: "z. B. 2328" },
];

interface FormValues {
  priceFrom: string;
  priceTrend: string;
  priceAvg30: string;
  priceAvg7: string;
  priceAvg1: string;
  available: string;
}

const EMPTY_FORM: FormValues = {
  priceFrom: "",
  priceTrend: "",
  priceAvg30: "",
  priceAvg7: "",
  priceAvg1: "",
  available: "",
};

/**
 * Erfassungs-Karte (PAGES_CONCEPT §3): links Artikel-Picker (Autocomplete
 * gegen /api/articles/search) + "Bei Cardmarket öffnen"-Link, rechts das
 * Eingabeformular fuer die MarketPrice-Felder. Speichern legt IMMER einen
 * neuen Datensatz an (Historie bleibt, siehe POST /api/market-price).
 */
export function MarketPriceForm({ onSelect, selected, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArticleSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/articles/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function pick(article: ArticleSearchResult) {
    onSelect(article);
    setQuery("");
    setResults([]);
    setOpen(false);
    setForm(EMPTY_FORM);
    setSavedNote(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/market-price", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleId: selected.id, ...form }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Speichern fehlgeschlagen.");
      }
      setSavedNote("Gespeichert — neuer Datensatz angelegt, Historie bleibt erhalten.");
      setForm(EMPTY_FORM);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  const cardmarketUrl = selected
    ? buildCardmarketSearchUrl(selected.setCode ?? selected.nameRaw, selected.packQty)
    : null;

  return (
    <div className="card" style={{ padding: "6px 16px 16px" }}>
      <h3 style={{ padding: "12px 4px 10px" }}>
        <span className="hdot" style={{ background: "var(--market)" }} />
        Preis erfassen <span className="r">Provider B · manuell</span>
      </h3>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ position: "relative" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Artikel suchen — Name oder Set-Code …"
              style={{
                width: "100%",
                background: "var(--panel2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                padding: "9px 11px",
                color: "var(--ink)",
                font: "inherit",
                fontSize: 12.7,
                outline: "none",
              }}
            />
            {open && results.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  boxShadow: "var(--shadow)",
                  zIndex: 20,
                  maxHeight: 260,
                  overflowY: "auto",
                }}
              >
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pick(r)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      border: 0,
                      borderBottom: "1px solid var(--line)",
                      background: "transparent",
                      color: "var(--ink)",
                      font: "inherit",
                      fontSize: 12.5,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{r.nameRaw}</span>
                    {r.setCode && (
                      <span className="code" style={{ marginLeft: 8 }}>
                        {r.setCode}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12.7, fontWeight: 700 }}>{selected.nameRaw}</div>
              {selected.setCode && <div className="code">{selected.setCode}</div>}
              {cardmarketUrl && (
                <a
                  href={cardmarketUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="chip c-mkt"
                  style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }}
                >
                  Bei Cardmarket öffnen ↗
                </a>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--faint)" }}>
              Artikel auswählen, um den Cardmarket-Link + das Eingabeformular freizuschalten.
            </div>
          )}
        </div>

        <div>
          {FIELD_DEFS.map((f) => (
            <div key={f.key} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600 }}>{f.label}</label>
              <input
                value={form[f.key]}
                disabled={!selected}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{
                  width: "100%",
                  background: "var(--panel2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-sm)",
                  padding: "7px 10px",
                  color: "var(--ink)",
                  font: "inherit",
                  fontSize: 12.5,
                  outline: "none",
                  marginTop: 2,
                  opacity: selected ? 1 : 0.5,
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="chip c-good"
            disabled={!selected || saving}
            onClick={handleSave}
            style={{ marginTop: 4, padding: "8px 16px", opacity: !selected || saving ? 0.55 : 1 }}
          >
            {saving ? "Speichere …" : "Speichern (neuer Datensatz)"}
          </button>
          {error && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--crit)" }}>{error}</div>}
          {savedNote && !error && <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--good)" }}>{savedNote}</div>}
        </div>
      </div>
    </div>
  );
}
