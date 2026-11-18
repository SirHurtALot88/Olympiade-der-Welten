"use client";

import { useMemo } from "react";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { SPIELTAGE_JE_SAISON, gehaltJeSpieltag } from "@/lib/foundation/spielerprofil-modell";
import { Tafel, geld, zahl } from "./bausteine";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";

export type VertragsAktionen = {
  /** Gibt es das Recht, für dieses Team zu handeln (steuerbares Team, nicht schreibgeschützt)? */
  darfHandeln: boolean;
  grundGesperrt: string | null;
  onVerlaengern?: () => void;
  onVerkaufen?: () => void;
};

const FORM_LABEL: Record<string, string> = {
  balanced: "gleichmäßig",
  front_loaded: "vorne schwer",
  back_loaded: "hinten schwer",
};

const FORDERUNG_STATUS: Record<string, string> = {
  open: "offen",
  fulfilled: "erfüllt",
  at_risk: "unter Druck",
  failed: "ignoriert",
};

const ABSICHT: Record<string, string> = {
  willing_to_extend: "verlängerungsbereit",
  short_term_only: "nur kurz binden",
  demands_raise: "fordert Aufwertung",
  considering_exit: "denkt an Wechsel",
  refuses_extension: "blockt Verlängerung",
  neutral: "neutral",
};

export function TabVertrag({
  data,
  modell,
  aktionen,
}: {
  data: PlayerDetailDrawerData;
  modell: SpielerprofilModell;
  aktionen: VertragsAktionen;
}) {
  const jeSpieltag = gehaltJeSpieltag(data.salary);
  const gespielt = useMemo(() => {
    const gameState = modell.gameState;
    if (!gameState) return 0;
    const index = gameState.season.matchdayIds?.indexOf(gameState.matchdayState.matchdayId) ?? -1;
    if (index < 0) return 0;
    return gameState.matchdayState.status === "resolved" ? index + 1 : index;
  }, [modell.gameState]);

  // Gehalt im Kader: Rang und Mittel (nur Spieler des eigenen Teams, Zahlen aus den Rosterzeilen)
  const kader = useMemo(() => {
    const gameState = modell.gameState;
    if (!gameState || !data.teamId) return null;
    const gehaelter = gameState.rosters.filter((eintrag) => eintrag.teamId === data.teamId).map((eintrag) => eintrag.salary).filter((wert) => Number.isFinite(wert));
    if (gehaelter.length === 0 || data.salary == null) return null;
    const rang = gehaelter.filter((wert) => wert > (data.salary ?? 0)).length + 1;
    return { rang, von: gehaelter.length, mittel: gehaelter.reduce((summe, wert) => summe + wert, 0) / gehaelter.length };
  }, [modell.gameState, data.teamId, data.salary]);

  const staffel = data.yearlySalarySchedule ?? [];
  const marktVerlauf = data.historyRows.filter((zeile) => zeile.marketValue != null).slice(-6).reverse();
  const absicht = data.morale?.contractIntent ? (ABSICHT[data.morale.contractIntent] ?? data.morale.contractIntent) : null;
  const vertragslos = !data.teamId;
  return (
    <div className="spr-tab spr-t-vertrag" data-testid="spielerprofil-tab-vertrag">
      <Tafel titel="Gehalt" klein="je Spieltag und je Saison" testId="spielerprofil-gehalt">
        <div className="spr-gehalt">
          <strong className="spr-t" data-testid="spielerprofil-gehalt-saison">{geld(data.salary, 1)}</strong>
          <small>
            Gehalt je Saison
            <br />
            <span data-testid="spielerprofil-gehalt-spieltag">{geld(jeSpieltag, 2)} je Spieltag</span> ({SPIELTAGE_JE_SAISON} Raten)
          </small>
        </div>
        <div className="spr-raten" aria-label="Gehaltsraten dieser Saison">
          {Array.from({ length: SPIELTAGE_JE_SAISON }, (_, index) => (
            <i key={index} className={index < gespielt ? "is-bezahlt" : index === gespielt ? "is-heute" : undefined} title={`Rate ${index + 1}`} />
          ))}
        </div>
        <div className="spr-zeile">
          <span>Restlaufzeit</span>
          <strong className="spr-t">{data.contractLength != null ? `${data.contractLength} ${data.contractLength === 1 ? "Saison" : "Saisons"}` : "—"}</strong>
        </div>
        <div className="spr-zeile">
          <span>Vertragsform</span>
          <strong>{data.contractShape ? (FORM_LABEL[data.contractShape] ?? data.contractShape) : "—"}</strong>
        </div>
        <div className="spr-zeile">
          <span>
            Marktübliches Gehalt<small>Forderung</small>
          </span>
          <strong className="spr-t">
            {geld(data.normalSalary, 1)} <small>{geld(gehaltJeSpieltag(data.normalSalary), 2)} je Spieltag</small>
          </strong>
        </div>
        <span className="spr-gk">Staffel je Saison</span>
        <div className="spr-staffel">
          {staffel.map((jahr) => (
            <div key={jahr.yearIndex} className="spr-zeile">
              <span>{jahr.label}</span>
              <strong className="spr-t">
                {geld(jahr.salary, 1)} <small>{geld(gehaltJeSpieltag(jahr.salary), 2)} je Spieltag</small>
              </strong>
            </div>
          ))}
          {staffel.length === 0 ? <div className="spr-leer">Keine Staffel hinterlegt.</div> : null}
        </div>
      </Tafel>

      <Tafel titel="Wert und Vergleich" klein="Marktwert, Kader" testId="spielerprofil-marktwert">
        <div className="spr-zeile">
          <span>Marktwert</span>
          <strong className="spr-t">{geld(data.marketValue, 1)}</strong>
        </div>
        <div className="spr-zeile">
          <span>Kaufpreis</span>
          <strong className="spr-t">{geld(data.purchasePrice, 1)}</strong>
        </div>
        <div className="spr-zeile">
          <span>Verkaufswert (erwartet)</span>
          <strong className="spr-t">{geld(data.transferContext.expectedSellValue, 1)}</strong>
        </div>
        {kader ? (
          <div className="spr-zeile" data-testid="spielerprofil-gehalt-kader">
            <span>
              Gehalt im Kader<small>Rang nach Gehalt</small>
            </span>
            <strong className="spr-t">
              #{kader.rang} von {kader.von} <small>Ø {geld(kader.mittel, 1)}</small>
            </strong>
          </div>
        ) : null}
        <span className="spr-gk">Marktwert je Saison</span>
        <div className="spr-th">
          {marktVerlauf.map((zeile) => (
            <div key={zeile.seasonId ?? zeile.seasonName} className="spr-zeile">
              <span>
                {zeile.seasonName}
                <small>{zeile.teamCode ?? ""}</small>
              </span>
              <strong className="spr-t">{geld(zeile.marketValue, 1)}</strong>
            </div>
          ))}
          {marktVerlauf.length === 0 ? <div className="spr-leer">Noch keine Saison im Verlauf.</div> : null}
        </div>
      </Tafel>

      <Tafel titel="Entscheidungen" klein={data.teamName ?? "vertragslos"} testId="spielerprofil-entscheidungen">
        <div className="spr-ent">
          {absicht ? (
            <div className="spr-zeile">
              <span>Stimmung zum Vertrag</span>
              <strong>{absicht}</strong>
            </div>
          ) : null}
          <div className="spr-vor" data-testid="spielerprofil-freigabe">
            <h4>Vorstand-Freigabe</h4>
            Gilt für <b>Verlängerung, Gehaltserhöhung und Verkauf</b>. Der Vorstand nimmt nichts weg: nur ein Teil des Kontos darf für Ablösen und Gehälter ausgegeben werden, Verkaufserlöse eingeschlossen. Die Sperre ist hart.
            <br />
            {data.boardTrust ? (
              <>
                Vertrauen derzeit <b>{zahl(data.boardTrust.trustScore, 1)}</b>.{" "}
              </>
            ) : null}
            Die freigegebene Quote und der freie Betrag werden hier gezeigt, sobald die Finanz-Stufe live ist.
          </div>
          <div className="spr-knreihe">
            <button
              type="button"
              className={`spr-kn is-gold${!aktionen.darfHandeln || vertragslos ? " is-zu" : ""}`}
              disabled={!aktionen.darfHandeln || vertragslos}
              onClick={aktionen.onVerlaengern}
              title={aktionen.grundGesperrt ?? "Verlängerung verhandeln"}
              data-testid="spielerprofil-verlaengern"
            >
              Verlängern
            </button>
            <button
              type="button"
              className="spr-kn"
              disabled={!aktionen.darfHandeln || vertragslos}
              onClick={aktionen.onVerkaufen}
              title={aktionen.grundGesperrt ?? "Verkauf prüfen"}
              data-testid="spielerprofil-verkaufen"
            >
              Verkaufen
            </button>
          </div>
          <span className="spr-gk">Forderungen</span>
          <div className="spr-th" data-testid="spielerprofil-forderungen">
            {(data.demands ?? []).map((forderung) => (
              <div key={forderung.demandId} className="spr-zeile">
                <span title={forderung.detail}>
                  {forderung.label}
                  <small>{FORDERUNG_STATUS[forderung.status] ?? forderung.status}</small>
                </span>
                <strong className={forderung.status === "fulfilled" ? "is-plus" : forderung.status === "failed" ? "is-minus" : undefined}>
                  {forderung.status === "fulfilled" ? `+${forderung.moraleReward}` : forderung.status === "failed" ? `−${forderung.moralePenalty}` : "Moral"}
                </strong>
              </div>
            ))}
            {(data.demands ?? []).length === 0 ? <div className="spr-leer">Keine offenen Forderungen.</div> : null}
          </div>
          {!aktionen.darfHandeln && !vertragslos ? (
            <div className="spr-leer">{aktionen.grundGesperrt ?? "Dieses Team steuerst du nicht."}</div>
          ) : null}
        </div>
      </Tafel>
    </div>
  );
}
