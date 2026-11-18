"use client";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import type {
  TrainingClassOption,
  TrainingModeOption,
  TrainingPlayerRowView,
} from "@/app/foundation/training-facilities-v2/training-view-types";
import { ACHSEN, ATTRIBUT_LABEL, achseVonAttribut } from "@/lib/foundation/spielerprofil-modell";
import type { PlayerGeneratorAttributeKey } from "@/lib/player-generator/official-discipline-weights";
import { NebelBand, Tafel, achseKlasse, zahl } from "./bausteine";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";

export type TrainingSteuerung = {
  row: TrainingPlayerRowView | null;
  modeOptions: TrainingModeOption[];
  classOptions: TrainingClassOption[];
  onSetMode?: (playerId: string, mode: PlayerTrainingMode) => void;
  onSetClass?: (playerId: string, trainingClass: string) => void;
  readOnly: boolean;
};

const AUSBLICK: Record<string, string> = {
  breakout: "Durchbruch",
  growth: "Wachstum",
  stable: "stabil",
  stagnation: "Stagnation",
  regression_risk: "Rückschritt-Risiko",
};

function vorzeichen(wert: number | null | undefined, stellen = 0): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  const text = zahl(Math.abs(wert), stellen);
  return wert > 0 ? `+${text}` : wert < 0 ? `−${text}` : text;
}

export function TabEntwicklung({
  data,
  modell,
  training,
}: {
  data: PlayerDetailDrawerData;
  modell: SpielerprofilModell;
  training: TrainingSteuerung;
}) {
  const insight = data.developmentInsight;
  const nebel = modell.nebel;
  const spanne = insight?.potentialRangeDisplay ?? null;
  const baseline = new Map(data.baselineAttributeDeltas.map((zeile) => [zeile.key, zeile] as const));
  const decke = new Map(data.attributeCeilingPreview.map((zeile) => [zeile.attribute as string, zeile] as const));
  const stats = new Map(data.attributeStats.map((zeile) => [zeile.key, zeile] as const));
  const attribute = ACHSEN.flatMap((achse) => achse.attribute);
  const verletzungen = data.injuryHistoryRows ?? [];
  const historie = (data.trainingHistoryRows ?? []).slice(-5).reverse();
  return (
    <div className="spr-tab spr-t-entwicklung" data-testid="spielerprofil-tab-entwicklung">
      <Tafel titel="Potenzial" klein={nebel ? "geschätzt" : "Scouting-Einschätzung"} testId="spielerprofil-potenzial">
        <div className="spr-pot">
          <strong className="spr-t">{zahl(insight?.currentRating ?? data.ovr, 0)}</strong>
          <div>
            <small>Gesamtwert heute</small>
            <small>
              Potenzial{" "}
              <b className="is-ziel" style={{ color: "var(--bc-gold)" }}>
                {spanne ? `${zahl(spanne.min, 0)}–${zahl(spanne.max, 0)}` : "unbekannt"}
              </b>
            </small>
          </div>
        </div>
        <div className="spr-zeile">
          <span>Einschätzung</span>
          <strong>{data.potentialStarsDisplay ?? data.scoutPotential?.starRating ?? "—"}</strong>
        </div>
        <div className="spr-zeile">
          <span>Aufdeckung</span>
          <strong className="spr-t">{zahl(data.revealConfidencePct, 0)} %</strong>
        </div>
        <div className="spr-zeile">
          <span>Ausblick</span>
          <strong>{insight ? (AUSBLICK[insight.growthOutlook] ?? insight.growthOutlook) : "—"}</strong>
        </div>
        <div className="spr-zeile">
          <span>Lücke zum Potenzial</span>
          <strong className="spr-t">{vorzeichen(insight?.developmentGap ?? null, 0)}</strong>
        </div>
        {insight ? <div className="spr-hinweis">{insight.recommendation}</div> : null}
        {nebel ? <NebelBand>Das Potenzial ist nur als Spanne bekannt; je mehr gescoutet ist, desto enger wird sie.</NebelBand> : null}
      </Tafel>

      <Tafel titel="Attribute" klein="Saisonstart → heute → Decke" testId="spielerprofil-entwicklung-attribute">
        <div className="spr-ent6">
          <div className="spr-enz is-kopf">
            <span>Attribut</span>
            <span>Start</span>
            <span>Heute</span>
            <span />
            <span>Decke</span>
          </div>
          {attribute.map((schluessel) => {
            const achse = achseVonAttribut(schluessel as PlayerGeneratorAttributeKey);
            const stat = stats.get(schluessel);
            const basis = baseline.get(schluessel);
            const grenze = decke.get(schluessel);
            const heute = stat?.value ?? null;
            const start = basis?.baselineValue ?? null;
            const deckeAnzeige = grenze
              ? grenze.ceilingRevealed || grenze.ceilingMin == null || grenze.ceilingMax == null
                ? zahl(grenze.ceiling, 0)
                : `${zahl(grenze.ceilingMin, 0)}–${zahl(grenze.ceilingMax, 0)}`
              : "—";
            return (
              <div key={schluessel} className={`spr-enz ${achseKlasse(achse)}`}>
                <span>{ATTRIBUT_LABEL[schluessel as PlayerGeneratorAttributeKey]}</span>
                <span className="spr-t is-stumm">{nebel ? "?" : zahl(start, 0)}</span>
                <b className="spr-t">{heute != null ? zahl(heute, 0) : (stat?.rangeLabel ?? stat?.ratingLabel ?? "?")}</b>
                <span className="spr-bn">
                  <i style={{ width: `${heute != null ? Math.min(100, heute) : 0}%` }} />
                  {grenze?.ceiling != null ? <u style={{ left: `${Math.min(100, grenze.ceiling)}%` }} /> : null}
                </span>
                <span className="spr-t">{deckeAnzeige}</span>
              </div>
            );
          })}
        </div>
      </Tafel>

      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr) minmax(0, 0.8fr)", gap: "0.72em", minHeight: 0 }}>
        <Tafel titel="Training" klein={training.readOnly ? "nur Ansicht" : "dein Plan"} testId="spielerprofil-training">
          {training.row && !nebel ? (
            <div className="spr-trn">
              <span className="spr-gk">Intensität</span>
              <div className="spr-seg" role="group" aria-label="Trainingsintensität">
                {training.modeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={training.row?.mode === option.value ? "is-an" : undefined}
                    aria-pressed={training.row?.mode === option.value}
                    disabled={training.readOnly}
                    title={option.note}
                    onClick={() => training.onSetMode?.(data.playerId, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="spr-gk">Trainingsklasse</span>
              <select
                className="spr-kn"
                value={training.row.trainingClass}
                disabled={training.readOnly}
                aria-label="Trainingsklasse"
                onChange={(event) => training.onSetClass?.(data.playerId, event.target.value)}
              >
                {training.classOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="spr-zeile">
                <span>XP diese Saison</span>
                <strong className="spr-t">{zahl(training.row.totalXp, 0)}</strong>
              </div>
            </div>
          ) : (
            <div className="spr-leer">{nebel ? "Das Training eines fremden Spielers siehst du nicht." : "Nur für Spieler deines Teams."}</div>
          )}
        </Tafel>
        <Tafel titel="Trainingsverlauf" klein="letzte Saisons" testId="spielerprofil-trainingsverlauf">
          <div className="spr-th">
            {historie.map((zeile) => (
              <div key={zeile.eventId} className="spr-zeile">
                <span>
                  {zeile.seasonId.replace(/^season-/i, "S")}
                  <small>
                    {zeile.trainingClass ?? "—"} · {zeile.trainingMode ?? "—"}
                  </small>
                </span>
                <strong className="spr-t">{vorzeichen(zeile.netSetpoints, 1)}</strong>
              </div>
            ))}
            {historie.length === 0 ? <div className="spr-leer">Noch kein abgeschlossenes Trainingsjahr.</div> : null}
          </div>
        </Tafel>
        <Tafel titel="Verletzungen" klein="Karriere" testId="spielerprofil-verletzungshistorie">
          <div className="spr-th">
            {verletzungen.map((zeile) => (
              <div key={zeile.eventId} className="spr-zeile">
                <span>
                  {zeile.seasonName ?? zeile.seasonId} · {zeile.matchdayLabel ?? zeile.matchdayId}
                  <small>{zeile.disciplines.map((disziplin) => disziplin.name).join(", ") || "ohne Einsatz"}</small>
                </span>
                <strong className="spr-t">{zeile.matchdaysMissed} Spieltag{zeile.matchdaysMissed === 1 ? "" : "e"}</strong>
              </div>
            ))}
            {verletzungen.length === 0 ? <div className="spr-leer">Keine Verletzung in der Karriere.</div> : null}
          </div>
        </Tafel>
      </div>
    </div>
  );
}
