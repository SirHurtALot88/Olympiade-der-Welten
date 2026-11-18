"use client";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { gehaltJeSpieltag } from "@/lib/foundation/spielerprofil-modell";
import { formatLeagueTierShortLabel } from "@/lib/season/league-history";
import { Tafel, geld, zahl } from "./bausteine";

const WECHSEL: Record<string, string> = { buy: "Kauf", sell: "Verkauf", contract_exit: "Vertragsende" };

export function TabKarriere({ data }: { data: PlayerDetailDrawerData }) {
  const zeilen = [...data.historyRows].reverse();
  return (
    <div className="spr-tab spr-t-karriere" data-testid="spielerprofil-tab-karriere">
      <Tafel titel="Saison für Saison" klein="eine Zeile je Saison, mit Liga" koerperClass="spr-kt-huelle" testId="spielerprofil-karriere-tabelle">
        <div className="spr-kt">
          <div className="spr-kz is-kopf">
            <span>Saison</span>
            <span>Team</span>
            <span>Liga</span>
            <span>Einsätze</span>
            <span>PP</span>
            <span>PP-Rang</span>
            <span>Marktwert</span>
            <span>Gehalt je Saison</span>
          </div>
          {zeilen.map((zeile) => (
            <div key={`${zeile.seasonId ?? zeile.seasonName}-${zeile.teamCode ?? ""}`} className={`spr-kz${zeile.isActiveSeason ? " is-aktiv" : ""}`}>
              <span>
                {zeile.seasonName}
                {zeile.isActiveSeason ? <small style={{ color: "var(--bc-gold)", marginLeft: "0.3em" }}>läuft</small> : null}
              </span>
              <span>{zeile.teamName ?? zeile.teamCode ?? "—"}</span>
              <span>{formatLeagueTierShortLabel(zeile.leagueTier) ?? "—"}</span>
              <span className="spr-t">{zahl(zeile.appearances, 0)}</span>
              <span className="spr-t">{zahl(zeile.pps ?? zeile.totalPoints, 1)}</span>
              <span className="spr-t">{zeile.ppsRank != null ? `#${zeile.ppsRank}` : "—"}</span>
              <span className="spr-t">{geld(zeile.marketValue, 1)}</span>
              <span className="spr-t" title="Gehalt je Saison · je Spieltag">
                {geld(zeile.salary, 1)} <small style={{ color: "var(--bc-leise)" }}>{geld(gehaltJeSpieltag(zeile.salary), 2)}/Spieltag</small>
              </span>
            </div>
          ))}
          {zeilen.length === 0 ? <div className="spr-leer" style={{ padding: "0.8em 0.9em" }}>Noch keine abgeschlossene Saison.</div> : null}
        </div>
      </Tafel>
      <div style={{ display: "grid", gridTemplateRows: "minmax(0, 1fr) auto minmax(0, 1fr)", gap: "0.72em", minHeight: 0 }}>
        <Tafel titel="Geschichte" testId="spielerprofil-geschichte">
          <div className="spr-story">{data.flavorDe ?? "Zu diesem Spieler ist keine Geschichte hinterlegt."}</div>
        </Tafel>
        <Tafel titel="Auszeichnungen" klein={`${data.seasonAwards.length}`} testId="spielerprofil-auszeichnungen">
          {data.seasonAwards.length > 0 ? (
            data.seasonAwards.slice(-5).reverse().map((preis) => (
              <div key={`${preis.seasonId}-${preis.awardId}`} className="spr-zeile">
                <span>
                  {preis.icon} {preis.label}
                  <small>{preis.seasonName}</small>
                </span>
                <strong className="spr-t">{preis.value != null ? String(preis.value) : ""}</strong>
              </div>
            ))
          ) : (
            <div className="spr-leer">Noch keine Auszeichnung.</div>
          )}
        </Tafel>
        <Tafel titel="Wechsel" klein="Kauf, Verkauf, Vertragsende" testId="spielerprofil-wechsel">
          <div className="spr-th">
            {data.transferHistory.slice(0, 8).map((wechsel) => (
              <div key={wechsel.id} className="spr-zeile">
                <span>
                  {WECHSEL[wechsel.transferType] ?? wechsel.transferType} · {wechsel.seasonLabel}
                  <small>{wechsel.toTeamName ?? wechsel.fromTeamName ?? "—"}</small>
                </span>
                <strong className="spr-t">{geld(wechsel.fee, 1)}</strong>
              </div>
            ))}
            {data.transferHistory.length === 0 ? <div className="spr-leer">Kein Wechsel bisher.</div> : null}
          </div>
        </Tafel>
      </div>
    </div>
  );
}
