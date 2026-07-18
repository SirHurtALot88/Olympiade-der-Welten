"use client";

import { useState } from "react";

import type {
  DisciplineTeamResolvePreview,
  PlayerPerformancePreview,
  TeamResolvePreview,
} from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * Rein präsentationale End-Screens für die Disziplin-Bühne.
 *
 * Zwei Ausbaustufen im gleichen Look wie die Matchday-Arena
 * (`components/foundation/new-look/`, `MatchdayResultNewLook`):
 *
 *  1. Disziplin-Ende — Team-Ergebnis + Top-10-Spieler der Disziplin.
 *  2. Spieltag-Ende — zusätzlich die Gesamt-Tabelle über beide Disziplinen
 *     (nur wenn `matchdayTeams` gesetzt ist).
 *
 * Bewusst ohne Datenzugriff: keine Fetches, keine State-Hooks außer einem
 * lokalen UI-Toggle für den aufklappbaren Team-Breakdown. Sämtliche Optik
 * kommt aus den Design-Tokens `var(--nl-*)` (keine rohen Hex-Farben, damit
 * der Design-Token-Lint sauber bleibt).
 */

type TeamMeta = { code: string; name: string; logoUrl: string | null };

export type DisciplineStageEndScreenProps = {
  disciplineName: string;
  teamResults: DisciplineTeamResolvePreview[];
  topPlayers: PlayerPerformancePreview[];
  /** Wenn gesetzt: Spieltag-Gesamt-Screen über beide Disziplinen. */
  matchdayTeams?: TeamResolvePreview[] | null;
  teamMetaById: Map<string, TeamMeta>;
  ownTeamId?: string | null;
};

/** Zahlen mit maximal einer Nachkommastelle; leere Werte werden zu „—". */
function fmt1(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/** Ganzzahl-Punkte (kein Dezimalanteil), leere Werte werden zu „—". */
function fmtInt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value)}`;
}

const TNUM: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

const EYEBROW_STYLE: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--nl-mut)",
  fontWeight: 800,
};

function TeamLogo({ meta }: { meta: TeamMeta | undefined }) {
  if (meta?.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={meta.logoUrl}
        alt=""
        aria-hidden
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          objectFit: "cover",
          flex: "none",
          border: "1px solid var(--nl-line)",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        flex: "none",
        background: "var(--nl-bg)",
        border: "1px solid var(--nl-line)",
      }}
    />
  );
}

function Card({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--nl-panel)",
        border: "1px solid var(--nl-line)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={EYEBROW_STYLE}>{eyebrow}</div>
      <h3
        style={{
          margin: "4px 0 12px",
          fontSize: 20,
          fontWeight: 800,
          color: "var(--nl-ink)",
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

const TABLE_SHELL: React.CSSProperties = {
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid var(--nl-line)",
  background: "var(--nl-bg)",
};

const TABLE_STYLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 12px",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--nl-mut)",
  fontWeight: 800,
  borderBottom: "1px solid var(--nl-line)",
  whiteSpace: "nowrap",
};

const TH_NUM: React.CSSProperties = { ...TH_STYLE, textAlign: "right" };

const TD_STYLE: React.CSSProperties = {
  padding: "9px 12px",
  borderBottom: "1px solid var(--nl-line)",
  color: "var(--nl-ink)",
};

const TD_NUM: React.CSSProperties = { ...TD_STYLE, ...TNUM, textAlign: "right" };

function rowBackground(isOwn: boolean, isEven: boolean): string {
  if (isOwn) {
    return "var(--nl-panel)";
  }
  return isEven ? "transparent" : "var(--nl-panel)";
}

function ownRowBorder(isOwn: boolean): React.CSSProperties {
  return isOwn
    ? { boxShadow: "inset 3px 0 0 0 var(--nl-accent)" }
    : {};
}

/** Zeile der Disziplin-Ergebnis-Tabelle inkl. optionalem Breakdown. */
function TeamResultRow({
  team,
  meta,
  isOwn,
  isEven,
}: {
  team: DisciplineTeamResolvePreview;
  meta: TeamMeta | undefined;
  isOwn: boolean;
  isEven: boolean;
}) {
  const [open, setOpen] = useState(false);

  const breakdown: Array<{ label: string; value: number | null | undefined }> = [
    { label: "Basis", value: team.baseScore },
    { label: "Fatigue", value: team.fatigueModifier },
    { label: "Captain", value: team.captainBonus },
    { label: "Form", value: team.formModifier },
    { label: "Mutator", value: team.mutatorModifier },
    { label: "Team-Power", value: team.teamPowerModifier },
  ];

  return (
    <>
      <tr style={{ background: rowBackground(isOwn, isEven), ...ownRowBorder(isOwn) }}>
        <td style={{ ...TD_NUM, fontWeight: 800, color: "var(--nl-mut)" }}>{team.rank}</td>
        <td style={TD_STYLE}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TeamLogo meta={meta} />
            <span style={{ fontWeight: isOwn ? 800 : 600 }}>
              {meta?.name ?? team.teamName}
            </span>
            {isOwn ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--nl-accent)",
                  border: "1px solid var(--nl-accent)",
                  borderRadius: 999,
                  padding: "1px 6px",
                }}
              >
                Dein Team
              </span>
            ) : null}
          </div>
        </td>
        <td style={{ ...TD_NUM, fontWeight: 700 }}>{fmt1(team.score)}</td>
        <td style={{ ...TD_NUM, color: "var(--nl-good)", fontWeight: 800 }}>
          {fmtInt(team.teamPoints)}
        </td>
        <td style={{ ...TD_STYLE, textAlign: "right", whiteSpace: "nowrap" }}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            style={{
              background: "transparent",
              border: "1px solid var(--nl-line)",
              borderRadius: 8,
              padding: "3px 9px",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--nl-mut)",
              cursor: "pointer",
            }}
          >
            {open ? "Details ▲" : "Details ▼"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr style={{ background: "var(--nl-bg)" }}>
          <td style={{ ...TD_STYLE, borderBottom: "1px solid var(--nl-line)" }} />
          <td colSpan={4} style={{ ...TD_STYLE, borderBottom: "1px solid var(--nl-line)" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                ...TNUM,
              }}
            >
              {breakdown.map((part) => (
                <span
                  key={part.label}
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--nl-line)",
                    background: "var(--nl-panel)",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "var(--nl-mut)", fontWeight: 700 }}>{part.label}</span>
                  <span style={{ color: "var(--nl-ink)", fontWeight: 800 }}>{fmt1(part.value)}</span>
                </span>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DisciplineResultTable({
  teamResults,
  teamMetaById,
  ownTeamId,
}: {
  teamResults: DisciplineTeamResolvePreview[];
  teamMetaById: Map<string, TeamMeta>;
  ownTeamId?: string | null;
}) {
  const rows = [...teamResults].sort((a, b) => a.rank - b.rank);
  return (
    <div style={TABLE_SHELL}>
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={{ ...TH_NUM, width: 56 }}>Rang</th>
            <th style={TH_STYLE}>Team</th>
            <th style={TH_NUM}>Score</th>
            <th style={TH_NUM}>Saisonpunkte</th>
            <th style={{ ...TH_STYLE, textAlign: "right" }} aria-label="Breakdown" />
          </tr>
        </thead>
        <tbody>
          {rows.map((team, index) => (
            <TeamResultRow
              key={team.teamId}
              team={team}
              meta={teamMetaById.get(team.teamId)}
              isOwn={ownTeamId != null && team.teamId === ownTeamId}
              isEven={index % 2 === 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopPlayersList({
  topPlayers,
  teamMetaById,
  ownTeamId,
}: {
  topPlayers: PlayerPerformancePreview[];
  teamMetaById: Map<string, TeamMeta>;
  ownTeamId?: string | null;
}) {
  const rows = topPlayers
    .filter((player) => player.isTop10)
    .sort((a, b) => a.rankInDiscipline - b.rankInDiscipline);

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--nl-mut)", fontStyle: "italic" }}>
        Keine Top-Spieler für diese Disziplin.
      </div>
    );
  }

  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {rows.map((player) => {
        const isOwn = ownTeamId != null && player.teamId === ownTeamId;
        const code = teamMetaById.get(player.teamId)?.code ?? "—";
        return (
          <li
            key={player.playerId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--nl-line)",
              background: "var(--nl-panel)",
              ...ownRowBorder(isOwn),
              ...TNUM,
            }}
          >
            <span
              style={{
                width: 26,
                textAlign: "right",
                fontWeight: 800,
                color: "var(--nl-mut)",
              }}
            >
              {player.rankInDiscipline}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: isOwn ? 800 : 700,
                  color: "var(--nl-ink)",
                }}
              >
                {player.playerName}
              </span>
              {player.isMvpCandidate ? (
                <span
                  title="MVP-Kandidat"
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                    color: "var(--nl-warn)",
                    border: "1px solid var(--nl-warn)",
                    borderRadius: 999,
                    padding: "1px 7px",
                    whiteSpace: "nowrap",
                  }}
                >
                  ⭐ MVP
                </span>
              ) : null}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.06em",
                color: "var(--nl-mut)",
                minWidth: 40,
                textAlign: "center",
              }}
            >
              {code}
            </span>
            <span style={{ minWidth: 64, textAlign: "right", fontWeight: 700, color: "var(--nl-ink)" }}>
              {fmt1(player.finalPlayerScore)}
            </span>
            <span
              style={{
                minWidth: 52,
                textAlign: "right",
                fontWeight: 800,
                color: "var(--nl-good)",
              }}
            >
              {fmtInt(player.pointsAwarded)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function MatchdayTotalTable({
  matchdayTeams,
  teamMetaById,
  ownTeamId,
}: {
  matchdayTeams: TeamResolvePreview[];
  teamMetaById: Map<string, TeamMeta>;
  ownTeamId?: string | null;
}) {
  const rows = [...matchdayTeams].sort((a, b) => a.rank - b.rank);
  return (
    <div style={TABLE_SHELL}>
      <table style={TABLE_STYLE}>
        <thead>
          <tr>
            <th style={{ ...TH_NUM, width: 56 }}>Rang</th>
            <th style={TH_STYLE}>Team</th>
            <th style={TH_NUM}>D1-Punkte</th>
            <th style={TH_NUM}>D2-Punkte</th>
            <th style={TH_NUM}>Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((team, index) => {
            const isOwn = ownTeamId != null && team.teamId === ownTeamId;
            const meta = teamMetaById.get(team.teamId);
            return (
              <tr
                key={team.teamId}
                style={{ background: rowBackground(isOwn, index % 2 === 0), ...ownRowBorder(isOwn) }}
              >
                <td style={{ ...TD_NUM, fontWeight: 800, color: "var(--nl-mut)" }}>{team.rank}</td>
                <td style={TD_STYLE}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <TeamLogo meta={meta} />
                    <span style={{ fontWeight: isOwn ? 800 : 600 }}>
                      {meta?.name ?? team.teamName}
                    </span>
                  </div>
                </td>
                <td style={TD_NUM}>{fmtInt(team.d1Points)}</td>
                <td style={TD_NUM}>{fmtInt(team.d2Points)}</td>
                <td style={{ ...TD_NUM, fontWeight: 800, color: "var(--nl-good)" }}>
                  {fmtInt(team.totalPoints)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function DisciplineStageEndScreen(props: DisciplineStageEndScreenProps) {
  const { disciplineName, teamResults, topPlayers, matchdayTeams, teamMetaById, ownTeamId } = props;
  const isMatchdayEnd = matchdayTeams != null && matchdayTeams.length > 0;

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        color: "var(--nl-ink)",
        background: "var(--nl-bg)",
      }}
    >
      <header>
        <div style={EYEBROW_STYLE}>
          {isMatchdayEnd ? "Spieltag abgeschlossen" : "Disziplin abgeschlossen"}
        </div>
        <h2
          style={{
            margin: "4px 0 0",
            fontSize: 26,
            fontWeight: 800,
            color: "var(--nl-ink)",
          }}
        >
          {disciplineName}
        </h2>
      </header>

      <Card eyebrow="Disziplin-Ergebnis" title="Team-Wertung">
        <DisciplineResultTable
          teamResults={teamResults}
          teamMetaById={teamMetaById}
          ownTeamId={ownTeamId}
        />
      </Card>

      <Card eyebrow="Beste Einzelleistungen" title="Top 10 Spieler">
        <TopPlayersList topPlayers={topPlayers} teamMetaById={teamMetaById} ownTeamId={ownTeamId} />
      </Card>

      {isMatchdayEnd ? (
        <Card eyebrow="Spieltag-Gesamt" title="Beide Disziplinen">
          <MatchdayTotalTable
            matchdayTeams={matchdayTeams}
            teamMetaById={teamMetaById}
            ownTeamId={ownTeamId}
          />
        </Card>
      ) : null}
    </div>
  );
}
