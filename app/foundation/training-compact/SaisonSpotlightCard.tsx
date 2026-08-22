"use client";

/**
 * SAISON-SPOTLIGHT — der Rueckblick auf die eigene Trainingsarbeit beim Start der neuen Saison.
 * Gewuenscht von Chris (`5hcq2p`), entworfen von Fable, hier gebaut.
 *
 * Diese Datei ist reine Darstellung. Jede Zahl kommt aus `buildSaisonSpotlight`
 * (`lib/foundation/saison-spotlight.ts`); dort stehen auch die vier Entwurfsentscheidungen und
 * warum es KEINE OVR-Spalte gibt. Fehlt das Modell, rendert die Karte gar nichts — ein Block aus
 * lauter „—" waere schlechter als kein Block.
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-spotlight-*`.
 */

import { useEffect, useState } from "react";

import { NlCard, formatNlNumber, formatNlSignedNumber } from "@/components/foundation/new-look";
import type { SaisonSpotlightModel, SpotlightPlayerRow } from "@/lib/foundation/saison-spotlight";

export type SaisonSpotlightCardProps = {
  model: SaisonSpotlightModel | null;
  /** Optionaler Sprung ins Spielerprofil — ohne Handler bleiben die Namen schlichter Text. */
  onOpenPlayerDetails?: (payload: { playerId: string; activePlayerId?: string | null }) => void;
};

const SPEICHER_PRAEFIX = "oly-spotlight-zugeklappt";

function speicherSchluessel(model: SaisonSpotlightModel): string {
  return `${SPEICHER_PRAEFIX}:${model.teamId}:${model.seasonIdTo}`;
}

function mw(wert: number | null): string {
  return wert == null ? "—" : formatNlNumber(wert, 2);
}

function NlSpotlightZeile({
  zeile,
  onOpenPlayerDetails,
}: {
  zeile: SpotlightPlayerRow;
  onOpenPlayerDetails?: SaisonSpotlightCardProps["onOpenPlayerDetails"];
}) {
  const name = onOpenPlayerDetails ? (
    <button
      type="button"
      className="nl-spotlight-name-button"
      onClick={() => onOpenPlayerDetails({ playerId: zeile.playerId })}
      title={`Spielerprofil von ${zeile.playerName} öffnen`}
    >
      {zeile.playerName}
    </button>
  ) : (
    <span>{zeile.playerName}</span>
  );

  return (
    <tr data-testid={`nl-spotlight-row-${zeile.playerId}`}>
      <th scope="row" className="nl-spotlight-name">
        {name}
        {zeile.classChange ? (
          <span
            className="nl-spotlight-classflag"
            title={`Klassenwechsel: ${zeile.classChange.from} → ${zeile.classChange.to}`}
          >
            ⬆ {zeile.classChange.to}
          </span>
        ) : null}
      </th>
      <td className="nl-tnum nl-spotlight-sp">{formatNlSignedNumber(zeile.netSetpoints, 1)}</td>
      <td className="nl-spotlight-attr">
        {zeile.bestAttribute ? (
          <>
            <span className="nl-spotlight-attr-key">{zeile.bestAttribute.label}</span>{" "}
            <span className="nl-tnum">
              {formatNlNumber(zeile.bestAttribute.fromValue, 1)} → {formatNlNumber(zeile.bestAttribute.toValue, 1)}
            </span>
          </>
        ) : (
          <span className="nl-spotlight-leer" title="Kein Attribut hat in dieser Saison zugelegt.">
            —
          </span>
        )}
      </td>
      <td className="nl-tnum nl-spotlight-mw">
        {mw(zeile.marketValueFrom)} → {mw(zeile.marketValueTo)}
      </td>
      <td className="nl-tnum">{zeile.appearances ?? "—"}</td>
      <td className="nl-spotlight-mode">{zeile.trainingMode ?? "—"}</td>
    </tr>
  );
}

export default function SaisonSpotlightCard({ model, onOpenPlayerDetails }: SaisonSpotlightCardProps) {
  // Beim ersten Oeffnen der neuen Saison aufgeklappt. Der Zuklapp-Wunsch wird je Team und Saison
  // gemerkt — im Effect gelesen, nicht beim ersten Render, damit Server- und Client-Ausgabe
  // uebereinstimmen (dasselbe Muster wie bei den Filter-Presets im Spielerverzeichnis).
  const [zugeklappt, setZugeklappt] = useState(false);
  useEffect(() => {
    if (!model || typeof window === "undefined") return;
    try {
      setZugeklappt(window.localStorage.getItem(speicherSchluessel(model)) === "1");
    } catch {
      // Privater Modus oder gesperrter Speicher: dann bleibt es beim aufgeklappten Standard.
    }
  }, [model]);

  if (!model) return null;

  const umschalten = () => {
    const neu = !zugeklappt;
    setZugeklappt(neu);
    if (typeof window === "undefined") return;
    try {
      if (neu) window.localStorage.setItem(speicherSchluessel(model), "1");
      else window.localStorage.removeItem(speicherSchluessel(model));
    } catch {
      // Nicht speichern zu koennen ist kein Grund, das Zuklappen zu verweigern.
    }
  };

  const platzzeile = [
    model.rank != null && model.teamCount != null ? `Platz ${model.rank} von ${model.teamCount}` : null,
    model.startRank != null ? `Start als Nr. ${model.startRank}` : null,
    model.rankDelta != null && model.rankDelta !== 0
      ? `${Math.abs(model.rankDelta)} ${Math.abs(model.rankDelta) === 1 ? "Platz" : "Plätze"} ${
          model.rankDelta > 0 ? "gutgemacht" : "verloren"
        }`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <NlCard
      className="nl-spotlight-card"
      data-testid="nl-saison-spotlight"
      eyebrow={`Saison-Spotlight · ${model.seasonLabelFrom} → ${model.seasonLabelTo}`}
      title={model.teamName}
      actions={
        <button
          type="button"
          className="nl-training-inline-button"
          onClick={umschalten}
          aria-expanded={!zugeklappt}
          aria-controls="nl-spotlight-body"
          data-testid="nl-spotlight-toggle"
        >
          {zugeklappt ? "Aufklappen" : "Zuklappen"}
        </button>
      }
    >
      {platzzeile ? <p className="nl-spotlight-platz">{platzzeile}</p> : null}

      {zugeklappt ? null : (
        <div id="nl-spotlight-body">
          <div className="nl-spotlight-kpis" data-testid="nl-spotlight-kpis">
            <div className="nl-spotlight-kpi">
              <strong className="nl-tnum">{formatNlSignedNumber(model.netSetpointsTotal, 1)}</strong>
              <span>SP netto im Team</span>
            </div>
            <div className="nl-spotlight-kpi">
              <strong className="nl-tnum">{model.classChangeCount}</strong>
              <span>{model.classChangeCount === 1 ? "Klassenwechsel" : "Klassenwechsel"}</span>
            </div>
            <div className="nl-spotlight-kpi">
              {/* Bewusst NICHT „durch Training": der Marktwert-Zuwachs ist im Save nicht nach
                  Herkunft zerlegt, anders als die Attribute. */}
              <strong className="nl-tnum">
                {model.marketValueGain == null ? "—" : formatNlSignedNumber(model.marketValueGain, 1)}
              </strong>
              <span>Marktwert-Zuwachs</span>
            </div>
          </div>

          {model.rows.length > 0 ? (
            <>
              <h3 className="nl-spotlight-subhead">
                So hat dein Training gewirkt <small>sortiert nach SP netto</small>
              </h3>
              <div className="nl-spotlight-table-scroll">
                <table className="nl-spotlight-table" data-testid="nl-spotlight-table">
                  <thead>
                    <tr>
                      <th scope="col">Spieler</th>
                      <th scope="col">SP netto</th>
                      <th scope="col">Bestes Attribut</th>
                      <th scope="col">Marktwert</th>
                      <th scope="col">Einsätze</th>
                      <th scope="col">Modus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.rows.map((zeile) => (
                      <NlSpotlightZeile
                        key={zeile.playerId}
                        zeile={zeile}
                        onOpenPlayerDetails={onOpenPlayerDetails}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {model.moreRowCount > 0 ? (
                <p className="nl-spotlight-more">
                  + {model.moreRowCount} weitere in der Trainingstabelle unten.
                </p>
              ) : null}
            </>
          ) : (
            <p className="nl-spotlight-more">
              Kein Spieler aus deinem heutigen Kader hat die Vorsaison bei dir trainiert.
            </p>
          )}

          {model.newcomers.length > 0 ? (
            <p className="nl-spotlight-neu" data-testid="nl-spotlight-newcomers">
              <strong>Neu im Team ({model.newcomers.length})</strong> — noch ohne Trainingshistorie bei dir:{" "}
              {model.newcomers
                .map((neu) => `${neu.playerName} (${neu.className ?? "?"}, ${mw(neu.marketValue)})`)
                .join(" · ")}
            </p>
          ) : null}

          {model.leagueBestTrainer ? (
            <p className="nl-spotlight-liga" data-testid="nl-spotlight-league">
              Zum Vergleich: Bester Trainierer der Liga war {model.leagueBestTrainer.playerName}
              {model.leagueBestTrainer.teamName ? ` (${model.leagueBestTrainer.teamName})` : ""} mit{" "}
              {formatNlSignedNumber(model.leagueBestTrainer.netSetpoints, 1)} SP · ligaweit wechselten{" "}
              {model.leagueClassChangeCount} Spieler ihre Klasse.
            </p>
          ) : null}
        </div>
      )}
    </NlCard>
  );
}
