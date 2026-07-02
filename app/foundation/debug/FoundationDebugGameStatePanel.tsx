"use client";

import { useMemo, useState } from "react";

import type { GameState, MappingWarning } from "@/lib/data/olyDataTypes";
import { buildGameStateContentSignature } from "@/lib/foundation/season-derivations-signature";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";

const FULL_JSON_WARN_KB = 512;
const FULL_JSON_MAX_KB = 2048;

function WarningList({
  title,
  warnings,
}: {
  title: string;
  warnings: string[];
}) {
  if (warnings.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">
          <h3>{title}</h3>
        </div>
        <p className="muted">Keine Warnungen.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <span className="pill">{warnings.length}</span>
      </div>
      <ul className="mapping-highlight-list">
        {warnings.slice(0, 12).map((warning, index) => (
          <li key={`${warning}-${index}`}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}

function MappingHighlight({ warning }: { warning: MappingWarning }) {
  return (
    <li>
      <strong>{warning.type}</strong>: {warning.message}
    </li>
  );
}

function buildGameStateDebugSummary(gameState: GameState) {
  const contentSignature = buildGameStateContentSignature(gameState);
  const persisted = gameState.seasonState.persistedSeasonDerivations as
    | PersistedSeasonDerivationsRecord
    | null
    | undefined;

  return {
    saveId: gameState.scenarioMeta?.label ?? null,
    seasonId: gameState.season.id,
    matchdayId: gameState.matchdayState.matchdayId,
    gamePhase: gameState.gamePhase ?? null,
    saveVersion: gameState.saveVersion ?? 0,
    contentSignature,
    counts: {
      players: gameState.players.length,
      teams: gameState.teams.length,
      rosters: gameState.rosters.length,
      transferHistory: gameState.transferHistory.length,
      logs: gameState.logs.length,
      matchdayResults: gameState.seasonState.matchdayResults?.length ?? 0,
      lineupDrafts: gameState.seasonState.lineupDrafts?.length ?? 0,
      seasonSnapshots: gameState.seasonState.seasonSnapshots?.length ?? 0,
    },
    persistedSeasonDerivations: persisted
      ? {
          seasonId: persisted.seasonId,
          contentSignature: persisted.contentSignature,
          updatedAt: persisted.updatedAt,
          ratingsCount: Object.keys(persisted.ratingsByPlayerId ?? {}).length,
          performanceCount: Object.keys(persisted.performanceByPlayerId ?? {}).length,
          ledgerEntryCount: persisted.ledger?.pointEntries?.length ?? 0,
          signatureMatches: persisted.contentSignature === contentSignature,
        }
      : null,
  };
}

function estimateJsonSizeKb(value: unknown) {
  try {
    return Math.round(new Blob([JSON.stringify(value)]).size / 1024);
  } catch {
    return null;
  }
}

function truncateJson(value: unknown, maxKb: number) {
  const full = JSON.stringify(value, null, 2);
  const maxChars = maxKb * 1024;
  if (full.length <= maxChars) {
    return { text: full, truncated: false };
  }
  return {
    text: `${full.slice(0, maxChars)}\n\n… [truncated at ${maxKb} KB — use export or smaller save]`,
    truncated: true,
  };
}

export default function FoundationDebugGameStatePanel({ gameState }: { gameState: GameState }) {
  const [showFullJson, setShowFullJson] = useState(false);
  const summary = useMemo(() => buildGameStateDebugSummary(gameState), [gameState]);
  const estimatedFullKb = useMemo(() => estimateJsonSizeKb(gameState), [gameState]);

  const fullJsonPreview = useMemo(() => {
    if (!showFullJson) {
      return null;
    }
    return truncateJson(gameState, FULL_JSON_MAX_KB);
  }, [gameState, showFullJson]);

  return (
    <>
      <div className="foundation-warning-grid">
        <WarningList title="Spieler ohne Team" warnings={gameState.mappingReport.unmappedPlayers} />
        <WarningList title="Teams ohne Spieler" warnings={gameState.mappingReport.teamsWithoutPlayers} />
        <WarningList
          title="Mapping ohne Player-Match"
          warnings={gameState.mappingReport.mappingRowsWithoutPlayerMatch}
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Import- und Mapping-Report</h2>
        </div>
        <div className="source-report">
          <p>
            <strong>Spielerquelle:</strong> {gameState.mappingReport.mappingSource}
          </p>
          <p>
            <strong>Teamquelle:</strong> {gameState.mappingReport.teamSource}
          </p>
          <p>
            <strong>Verarbeitete Mapping-Zeilen:</strong> {gameState.mappingReport.processedMappingRows}
          </p>
          <p>
            <strong>Generiert am:</strong>{" "}
            {new Date(gameState.mappingReport.generatedAt).toLocaleString("de-DE")}
          </p>
        </div>
        <ul className="mapping-highlight-list">
          {gameState.mappingReport.warnings.slice(0, 18).map((warning, index) => (
            <MappingHighlight key={`${warning.type}-${index}`} warning={warning} />
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>GameState Debug</h2>
        </div>
        <p className="muted">
          Vollständiges JSON ist standardmäßig ausgeblendet (OOM-Schutz). Geschätzte Größe:{" "}
          {estimatedFullKb != null ? `~${estimatedFullKb} KB` : "unbekannt"}.
        </p>
        <pre className="debug-json">{JSON.stringify(summary, null, 2)}</pre>
        {!showFullJson ? (
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowFullJson(true)}
          >
            Show full JSON
            {estimatedFullKb != null && estimatedFullKb >= FULL_JSON_WARN_KB
              ? ` (Warnung: ~${estimatedFullKb} KB — kann Tab/IDE verlangsamen)`
              : ""}
          </button>
        ) : (
          <>
            <p className="foundation-warning" role="status">
              Vollständiges GameState-JSON geladen
              {estimatedFullKb != null && estimatedFullKb >= FULL_JSON_WARN_KB
                ? ` (~${estimatedFullKb} KB). Bei Freezes Tab schließen oder Button erneut nutzen.`
                : "."}
            </p>
            <pre className="debug-json">{fullJsonPreview?.text}</pre>
            {fullJsonPreview?.truncated ? (
              <p className="muted">Anzeige bei {FULL_JSON_MAX_KB} KB abgeschnitten.</p>
            ) : null}
            <button type="button" className="button secondary" onClick={() => setShowFullJson(false)}>
              Hide full JSON
            </button>
          </>
        )}
      </section>
    </>
  );
}
