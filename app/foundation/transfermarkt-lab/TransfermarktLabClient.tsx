"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getTransfermarktBaseColumns } from "@/lib/market/transfermarkt-column-contract";
import {
  formatTransfermarktCurrency,
  getConfirmedTierStyle,
} from "@/lib/market/transfermarkt-formatting-contract";
import { getTransfermarktLabMode, getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";

type TransfermarktLabResponse = {
  items: TransfermarktFreeAgentItem[];
  total: number;
  source: "derived_free_agents";
  scope: {
    saveId: string;
    seasonId: string;
    teamId: string | null;
  } | null;
  teamContext: {
    teamId: string;
    teamCash: number;
    teamSalary: number;
    rosterCount: number;
    playerMin: number;
    playerOpt: number;
    readinessStatus: string;
    affordabilityStatus: "affordable" | "tight" | "too_expensive";
    rosterPressureStatus: "under_min" | "under_opt" | "at_or_above_opt";
  } | null;
  notes: string[];
  warnings: string[];
  error?: string;
};

type TransfermarktLabClientProps = {
  initialData?: TransfermarktLabResponse | null;
  initialError?: string | null;
};

const defaultScope = {
  saveId: "save-initial",
  seasonId: "season-1",
  teamId: "",
  search: "",
  limit: 50,
};

function formatAxes(item: TransfermarktFreeAgentItem) {
  return [item.powTier, item.speTier, item.menTier, item.socTier].map((value) => value ?? "—");
}

function formatTopDisciplineScores(item: TransfermarktFreeAgentItem) {
  return item.topDisciplineScores.map((entry) => `${entry.disciplineName.slice(0, 3).toLocaleUpperCase("de")} ${entry.scoreTier ?? "—"} (${entry.ppsLastSeason ?? "—"})`).join(" · ") || "—";
}

export default function TransfermarktLabClient({ initialData = null, initialError = null }: TransfermarktLabClientProps) {
  const [filters, setFilters] = useState(defaultScope);
  const [data, setData] = useState<TransfermarktLabResponse | null>(initialData);
  const [errors, setErrors] = useState<string[]>(initialError ? [initialError] : []);
  const [busy, setBusy] = useState(false);

  async function loadMarket(overrides?: Partial<typeof filters>) {
    const nextFilters = { ...filters, ...overrides };
    const query = new URLSearchParams({
      saveId: nextFilters.saveId,
      seasonId: nextFilters.seasonId,
      limit: String(nextFilters.limit),
      ...(nextFilters.search ? { search: nextFilters.search } : {}),
      ...(nextFilters.teamId ? { teamId: nextFilters.teamId } : {}),
    });

    setBusy(true);
    setErrors([]);

    try {
      const response = await fetch(`/api/transfermarkt/free-agents?${query.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as TransfermarktLabResponse;
      if (!response.ok || payload.error) {
        setData(payload);
        setErrors([payload.error ?? "Transfermarkt free agents could not be loaded."]);
        return;
      }

      setFilters(nextFilters);
      setData(payload);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!initialData && !initialError) {
      void loadMarket(defaultScope);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = data?.items ?? [];
  const notes = data?.notes ?? [];
  const warnings = data?.warnings ?? [];
  const scope = data?.scope;
  const source = data?.source ?? null;
  const teamContext = data?.teamContext ?? null;
  const hasActiveFilters = Boolean(filters.search.trim());
  const columns = useMemo(() => getTransfermarktBaseColumns(), []);
  const mode = getTransfermarktLabMode({
    busy,
    data,
    errors,
    hasActiveFilters,
  });

  const emptyMessage = useMemo(() => {
    if (mode === "error") {
      return "Der Markt konnte nicht geladen werden.";
    }
    if (mode === "loading") {
      return "Marktdaten werden geladen.";
    }
    if (mode === "filtered_empty") {
      return "Aktuell keine Treffer mit den gesetzten Filtern oder der aktuellen Begrenzung.";
    }
    return "Keine Free Agents im aktuellen Scope.";
  }, [mode]);

  return (
    <main className="app-shell foundation-shell">
      <section className="hero">
        <h1>Transfermarkt Lab</h1>
        <p>Read-only Transfermarkt MVP.</p>
        <p className="muted">Keine Kaufbuttons, keine Wishlist, keine DB-Writes. Diese Seite zeigt nur abgeleitete Free Agents.</p>
        <p>
          <Link href="/foundation">Zurueck zur Foundation</Link>
        </p>
      </section>

      {errors.length > 0 ? (
        <div className="error-banner">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <div className="stack legacy-lineup-lab-grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Scope</h2>
          </div>
          <div className="legacy-lineup-lab-controls">
            <label>
              <span>Save</span>
              <input className="input" value={filters.saveId} onChange={(event) => setFilters((current) => ({ ...current, saveId: event.target.value }))} />
            </label>
            <label>
              <span>Season</span>
              <input className="input" value={filters.seasonId} onChange={(event) => setFilters((current) => ({ ...current, seasonId: event.target.value }))} />
            </label>
            <label>
              <span>Team</span>
              <input className="input" value={filters.teamId} placeholder="Optional: A-A" onChange={(event) => setFilters((current) => ({ ...current, teamId: event.target.value }))} />
            </label>
            <label>
              <span>Search</span>
              <input className="input" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
            </label>
            <label>
              <span>Limit</span>
              <select className="input" value={filters.limit} onChange={(event) => setFilters((current) => ({ ...current, limit: Number(event.target.value) }))}>
                {[25, 50, 100, 200].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="legacy-lineup-lab-actions">
            <button className="secondary-button" type="button" onClick={() => void loadMarket(filters)} disabled={busy}>
              Markt laden
            </button>
          </div>
          {scope ? (
            <p className="muted">
              saveId: {scope.saveId} · seasonId: {scope.seasonId} · teamId: {scope.teamId ?? "none"}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Hinweise</h2>
          </div>
          <div className="legacy-resolve-kpis">
            <p>API status: {errors.length > 0 ? "error" : busy ? "loading" : "success"}</p>
            <p>Total: {data?.total ?? 0}</p>
            <p>Items in response: {items.length}</p>
            <p>Source: {source ?? "n/a"}</p>
            <p>Scope: {scope ? `${scope.saveId} / ${scope.seasonId} / ${scope.teamId ?? "no-team"}` : "n/a"}</p>
            <p>Error message: {errors[0] ?? "none"}</p>
            <p>Team context: {teamContext ? "available" : "not available"}</p>
            <p>Team cash: {teamContext ? formatTransfermarktCurrency(teamContext.teamCash) : "n/a"}</p>
            <p>Team salary: {teamContext ? formatTransfermarktCurrency(teamContext.teamSalary) : "n/a"}</p>
            <p>Roster count: {teamContext ? teamContext.rosterCount : "n/a"}</p>
            <p>Player min / opt: {teamContext ? `${teamContext.playerMin} / ${teamContext.playerOpt}` : "n/a"}</p>
            <p>Readiness: {teamContext?.readinessStatus ?? "n/a"}</p>
          </div>
          {notes.length === 0 && warnings.length === 0 ? <p className="muted">Aktuell keine Zusatzhinweise.</p> : null}
          {notes.length > 0 ? (
            <ul className="warning-list">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="warning-list">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="panel legacy-resolve-table-panel">
          <div className="panel-header">
            <h2>Free Agents</h2>
          </div>
          <div className="legacy-resolve-table-wrap">
            <table className="legacy-resolve-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.id}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const [pow, spe, men, soc] = formatAxes(item);
                  const portrait = getTransfermarktPortraitModel(item);
                  return (
                    <tr key={item.playerId}>
                      {columns.map((column) => {
                        if (column.id === "imageUrl") {
                          return (
                            <td key={column.id}>
                              {portrait.src ? (
                                <img
                                  className="transfermarkt-portrait"
                                  src={portrait.src}
                                  alt={item.name}
                                  width={56}
                                  height={56}
                                  loading="lazy"
                                  decoding="async"
                                  fetchPriority="low"
                                />
                              ) : (
                                <div className="transfermarkt-portrait transfermarkt-portrait-placeholder" aria-label={`${item.name} placeholder`}>
                                  {portrait.initials}
                                </div>
                              )}
                            </td>
                          );
                        }
                        if (column.id === "name") {
                          return (
                            <td key={column.id}>
                              <div className="table-player-cell transfermarkt-player-cell">
                                <div className="stack">
                                  <strong>{item.name}</strong>
                                  <span>{portrait.warning ?? "portrait_ok"}</span>
                                </div>
                              </div>
                            </td>
                          );
                        }
                        if (column.id === "className") return <td key={column.id}>{item.className}</td>;
                        if (column.id === "race") return <td key={column.id}>{item.race}</td>;
                        if (column.id === "marketValue") return <td key={column.id}>{formatTransfermarktCurrency(item.marketValue)}</td>;
                        if (column.id === "salary") return <td key={column.id}>{formatTransfermarktCurrency(item.salary)}</td>;
                        if (column.id === "pow") return <td key={column.id} style={getConfirmedTierStyle(item.powTier)}>{pow}</td>;
                        if (column.id === "spe") return <td key={column.id} style={getConfirmedTierStyle(item.speTier)}>{spe}</td>;
                        if (column.id === "men") return <td key={column.id} style={getConfirmedTierStyle(item.menTier)}>{men}</td>;
                        if (column.id === "soc") return <td key={column.id} style={getConfirmedTierStyle(item.socTier)}>{soc}</td>;
                        if (column.id === "fitDisplay") return <td key={column.id}>{item.fitDisplay}</td>;
                        if (column.id === "bracket") return <td key={column.id}>{item.bracket ?? "—"}</td>;
                        if (column.id === "above20") return <td key={column.id}>{item.above20 ?? "—"}</td>;
                        if (column.id === "above40") return <td key={column.id}>{item.above40 ?? "—"}</td>;
                        if (column.id === "above60") return <td key={column.id}>{item.above60 ?? "—"}</td>;
                        if (column.id === "above80") return <td key={column.id}>{item.above80 ?? "—"}</td>;
                        if (column.id === "topDisciplineScores") return <td key={column.id}>{formatTopDisciplineScores(item)}</td>;
                        return <td key={column.id}>—</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {mode !== "table" ? <p className="muted">{emptyMessage}</p> : null}
          </div>
          {data ? <p className="muted">Total: {data.total}</p> : null}
        </section>
      </div>
    </main>
  );
}
