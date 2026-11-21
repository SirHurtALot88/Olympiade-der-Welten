"use client";

/**
 * ENTWICKLUNG / TRAINING im Broadcast-Stil (21.11.). Vorlage: public/mockups/training-modern-18-11.html, Doku:
 * docs/design/training-modern-18-11.md. Neu gebaut statt umgestylt: Kopf mit Reitern und Kennzahlen, Reiter Kader
 * (Trainingshalle, Tabelle, Disziplin-Radar, „Im Blick"), Spieler und Plan (Ziel-Disziplin + Weg + Intensität).
 * Alle Zahlen kommen aus den bestehenden Diensten (`TrainingPlayerRowView`, `spieltag-training`,
 * `disziplin-trainings-prognose`); die Seite rechnet nichts ein zweites Mal. Die alte Seite bleibt über
 * `?training=klassisch` erreichbar (`lib/training/training-look.ts`).
 */

import { useMemo, useState, type CSSProperties } from "react";

import PlayerPixelSprite from "@/app/foundation/PlayerPixelSprite";
import type { TrainingCompactClientProps } from "@/app/foundation/training-compact/TrainingCompactClient";
import { getClassIconSrc } from "@/app/foundation/classVisuals";
import { klassenKartenfarbe } from "@/app/foundation/KlassenFarbTag";
import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { BcIcon, BcSeg, BcTable, type BcTableColumn } from "@/components/foundation/broadcast";
import type { GameState } from "@/lib/data/olyDataTypes";
import { prognostiziereDisziplinTraining } from "@/lib/training/disziplin-trainings-prognose";
import {
  baueTrainingsZielKontext,
  bestimmeAusfallSpielerFuerSpieltag,
  entpackeTrainingsVerlauf,
  prognostiziereSpieltagsTraining,
  wegeFuerDisziplin,
} from "@/lib/training/spieltag-training";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import {
  STATIONEN,
  achsenFarbe,
  attributLabel,
  baueDisziplinKarten,
  baueKaderKennzahlen,
  baueTrainingZeilen,
  belastungNachTraining,
  wunschFolge,
  wuenscheErfuellen,
  belastungsZone,
  naechsteSortierung,
  risikoProzent,
  sortiereKader,
  sortiereZeilen,
  stationDef,
  stationenBelegung,
  zielGleich,
  zielLabel,
  zonenText,
  type DisziplinKarte,
  type KaderSortSchluessel,
  type SortRichtung,
  type TrainingZeile,
} from "@/lib/training/training-modern-modell";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import "./training-modern.css";

export type TrainingModernProps = TrainingCompactClientProps & {
  gameState: GameState;
  /** Setzt Ziel-Disziplin + Weg gesammelt; `null` = zurück an den KI-Vorschlag. */
  onSetTrainingsZiele?: (
    aenderungen: Array<{
      playerId: string;
      ziel: { disziplinId: string; weg: number } | null;
    }>,
  ) => void;
  onZurKlassik?: () => void;
};

type Ansicht = "kader" | "spieler" | "plan";
type Entwurf = Record<string, { ziel?: { disziplinId: string; weg: number }; modus?: PlayerTrainingMode }>;

const MODI: Array<{ id: PlayerTrainingMode; kurz: string; name: string }> = [
  { id: "leicht", kurz: "L", name: "Leicht" },
  { id: "mittel", kurz: "M", name: "Mittel" },
  { id: "hart", kurz: "H", name: "Hart" },
];
const MINUS = "−";

function zahl(v: number | null | undefined, stellen = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const t = Math.abs(v).toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
  return v < 0 && Number(t.replace(",", ".")) !== 0 ? `${MINUS}${t}` : t;
}
function vz(v: number | null | undefined, stellen = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) < 0.5 * 10 ** -stellen) return `±${zahl(0, stellen)}`;
  return `${v > 0 ? "+" : MINUS}${zahl(Math.abs(v), stellen)}`;
}
const ton = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.05 ? "bc-null" : v > 0 ? "bc-plus" : "bc-minus");
const kurzName = (name: string) => name.split(" ")[0] ?? name;

/* ================================================================ kleine Bausteine */

/** Klasse immer in ihrer Klassenfarbe, mit dem vorhandenen Klassen-Icon (Designsystem-Regel 21.11.). */
function KlasseTag({ klasse }: { klasse: string }) {
  const f = klassenKartenfarbe(klasse);
  const src = getClassIconSrc(klasse);
  return (
    <span
      className="te-klasse"
      style={f ? ({ "--kf": f.farbe } as CSSProperties) : undefined}
      title={f ? `${klasse} · ${f.achse}` : klasse}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={16} height={16} loading="lazy" />
      ) : null}
      {klasse}
    </span>
  );
}

function Medaillon({ zeile, klein }: { zeile: Pick<TrainingZeile, "portrait" | "name">; klein?: boolean }) {
  return (
    <span className={`te-med${klein ? " is-klein" : ""}`}>
      {zeile.portrait ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={zeile.portrait} alt="" loading="lazy" />
      ) : (
        <b>{zeile.name.slice(0, 1)}</b>
      )}
    </span>
  );
}

function ModusSeg({
  wert,
  onWahl,
  gesperrt,
  wunsch,
}: {
  wert: PlayerTrainingMode;
  onWahl: (m: PlayerTrainingMode) => void;
  gesperrt?: boolean;
  /** Gewünschte Intensität des Spielers: der Knopf bekommt eine Marke. */
  wunsch?: PlayerTrainingMode | null;
}) {
  return (
    <BcSeg
      ariaLabel="Intensität"
      wert={wert}
      gesperrt={gesperrt}
      onWahl={onWahl}
      optionen={MODI.map((m) => ({
        id: m.id,
        label: m.kurz,
        heiss: m.id === "hart",
        marke: wunsch === m.id,
        titel: wunsch === m.id ? `${m.name} (Wunsch des Spielers)` : m.name,
      }))}
    />
  );
}

/** „wünscht Leicht – erfüllt/nicht erfüllt, Folge: Moral …" für Intensität `modus`; nichts ohne Wunsch. */
function WunschZeile({ zeile, modus, vorher }: { zeile: TrainingZeile; modus: PlayerTrainingMode; vorher?: PlayerTrainingMode }) {
  if (!zeile.wunsch) return null;
  const folge = wunschFolge(zeile, modus);
  const name = MODI.find((m) => m.id === zeile.wunsch)?.name ?? zeile.wunsch;
  const erfuellt = zeile.wunsch === modus;
  const alt = vorher ? wunschFolge(zeile, vorher) : null;
  return (
    <p className={`te-wunschzeile ${erfuellt ? "is-ok" : "is-offen"}`} data-testid="training-wunschzeile" title={zeile.row.trainingDemand?.detail}>
      <BcIcon name={erfuellt ? "check" : "info"} />
      <span>
        wünscht <b>{name}</b> · {erfuellt ? "erfüllt" : "nicht erfüllt"}
        {folge ? (
          <>
            {" "}
            · Folge: Moral{" "}
            {alt && alt.delta !== folge.delta ? (
              <>
                <b className="bc-t">{vz(alt.delta, 1)}</b> → <b className={`bc-t ${ton(folge.delta)}`}>{vz(folge.delta, 1)}</b>
              </>
            ) : (
              <b className={`bc-t ${ton(folge.delta)}`}>{vz(folge.delta, 1)}</b>
            )}{" "}
            <small>({folge.text})</small>
          </>
        ) : null}
      </span>
    </p>
  );
}

function Belastung({ fatigue, naechste }: { fatigue: number; naechste?: number }) {
  const zone = belastungsZone(fatigue);
  return (
    <div
      className="te-bel"
      title={`Belastung ${zahl(fatigue)} · ${zonenText(fatigue)} · Verletzungsrisiko ${zahl(risikoProzent(fatigue), 1)} %`}
    >
      <div className="te-bel__skala" aria-hidden="true">
        <i style={{ width: "25%", background: "#62d394" }} />
        <i style={{ width: "25%", background: "#c3cf5e" }} />
        <i style={{ width: "30%", background: "#f3b54a" }} />
        <i style={{ width: "20%", background: "#ff6058" }} />
        <u style={{ left: `${Math.min(100, fatigue)}%` }} />
        {naechste != null ? <s style={{ left: `${Math.min(100, naechste)}%` }} /> : null}
      </div>
      <span className="bc-t" style={{ color: zone.farbe }}>
        {zahl(fatigue)}
        {naechste != null ? <em> → {zahl(naechste)}</em> : null}
        <small> · {zahl(risikoProzent(fatigue), 1)} %</small>
      </span>
    </div>
  );
}

function AttributBalken({ eintraege }: { eintraege: TrainingZeile["profil"] }) {
  return (
    <span className="te-prof">
      {eintraege.map((p) => (
        <span key={p.attribute} style={{ "--af": achsenFarbe(p.attribute) } as CSSProperties}>
          <i />
          {p.label} <b className="bc-t">{Math.round(p.anteil * 100)}</b>
        </span>
      ))}
    </span>
  );
}

function ArtMarke({ art }: { art: TrainingZeile["art"] }) {
  if (!art) return null;
  return <span className={`te-art${art === "neben" ? " is-neben" : ""}`}>{art === "primaer" ? "Primärweg" : "Nebenweg"}</span>;
}

/* ================================================================ Trainingshalle */

function Halle({
  zeilen,
  gewaehlt,
  onWahl,
  trainingsZentrumPct,
  ueberlastet,
}: {
  zeilen: TrainingZeile[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
  trainingsZentrumPct: number;
  ueberlastet: number;
}) {
  const belegung = stationenBelegung(zeilen);
  return (
    <section className="te-halle" aria-label="Trainingshalle" data-testid="training-halle">
      <header className="te-halle__kopf">
        <h2>Trainingshalle</h2>
        <span>
          Trainingszentrum {trainingsZentrumPct > 0 ? `+${zahl(trainingsZentrumPct)} %` : "ohne Bonus"} · jede Station ist ein Schwerpunkt ·
          Klick auf eine Figur wählt den Spieler
        </span>
        {ueberlastet > 0 ? <strong className="te-halle__warn">{ueberlastet} überlastet</strong> : null}
      </header>
      <div className="te-halle__stationen">
        {belegung.map(({ id, zeilen: leute }) => {
          const st = stationDef(id);
          return (
            <div
              key={id}
              className="te-sta"
              style={
                {
                  "--f": st.farbe,
                  flexGrow: Math.max(1, leute.length),
                } as CSSProperties
              }
            >
              <div className="te-sta__tafel">
                <b>{id === "reha" ? st.name : `${st.name} · ${st.kurz}`}</b>
                <small>{leute.length} Spieler</small>
              </div>
              <div className="te-sta__leute">
                {leute.map((z) => (
                  <button
                    key={z.playerId}
                    type="button"
                    className={`te-hf${gewaehlt === z.playerId ? " is-an" : ""}${istRot(z) ? " is-rot" : ""}${z.verletzt ? " is-reha" : ""}`}
                    onClick={() => onWahl(z.playerId)}
                    title={`${z.name} · Belastung ${zahl(z.fatigue)}`}
                  >
                    {istRot(z) ? <span className="te-hf__ruf">überlastet</span> : null}
                    <span className="te-hf__fig">
                      <PlayerPixelSprite
                        playerId={z.playerId}
                        size={104}
                        dir="south"
                        anim={id === "pow" ? "angriff" : id === "spe" ? "walk" : "pose"}
                        fallback={<Medaillon zeile={z} />}
                      />
                    </span>
                    <span className="te-hf__last" aria-hidden="true">
                      <i
                        style={{
                          width: `${Math.min(100, z.fatigue)}%`,
                          background: belastungsZone(z.fatigue).farbe,
                        }}
                      />
                    </span>
                    <span className="te-hf__nm">{kurzName(z.name)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const istRot = (z: TrainingZeile) => !z.verletzt && z.fatigue >= 50;

/* ================================================================ Kader: Tabelle */

function KaderTabelle({
  zeilen,
  gewaehlt,
  onWahl,
  onModus,
  gesperrt,
  diszFilter,
}: {
  zeilen: TrainingZeile[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
  onModus: (playerId: string, m: PlayerTrainingMode) => void;
  gesperrt: boolean;
  diszFilter: string | null;
}) {
  const [sort, setSort] = useState<{
    schluessel: KaderSortSchluessel;
    richtung: SortRichtung;
  }>({ schluessel: "belastung", richtung: "ab" });
  const sortiert = useMemo(() => sortiereKader(zeilen, sort.schluessel, sort.richtung), [zeilen, sort]);
  const kopf = (schluessel: KaderSortSchluessel, text: string, standard: SortRichtung = "ab") => ({
    kopf: (
      <>
        {text}
        {sort.schluessel === schluessel ? (sort.richtung === "ab" ? " ▾" : " ▴") : ""}
      </>
    ),
    onKopf: () => setSort((alt) => naechsteSortierung(alt, schluessel, standard)),
    aktiv: sort.schluessel === schluessel,
  });
  const spalten: Array<BcTableColumn<TrainingZeile>> = [
    {
      key: "name",
      breite: "minmax(0,1.25fr)",
      ...kopf("name", "Spieler", "auf"),
      render: (z) => (
        <span className="te-sp">
          <Medaillon zeile={z} klein />
          <span>
            <strong>{z.name}</strong>
            <small>
              <KlasseTag klasse={z.klasse} />
              {z.gesamt != null ? ` · ${zahl(z.gesamt, 1)}` : ""}
            </small>
          </span>
        </span>
      ),
    },
    {
      key: "ziel",
      breite: "minmax(0,1.9fr)",
      ...kopf("ziel", "Schwerpunkt", "auf"),
      render: (z) =>
        z.verletzt ? (
          <span className="te-reha">
            <b>+ Reha</b> nicht einsetzbar · Training ruht
          </span>
        ) : z.ziel ? (
          <span className="te-ziel">
            <b className="te-kurz">{zielLabel(z.ziel.disziplinId).slice(0, 3).toUpperCase()}</b>
            <ArtMarke art={z.art} />
            <AttributBalken eintraege={z.profil.slice(0, 2)} />
          </span>
        ) : (
          <span className="bc-null">kein Ziel</span>
        ),
    },
    {
      key: "modus",
      breite: "7.4em",
      ...kopf("modus", "Intensität", "auf"),
      render: (z) => (
        <ModusSeg wert={z.modus} wunsch={z.wunsch} onWahl={(m) => onModus(z.playerId, m)} gesperrt={gesperrt || z.verletzt} />
      ),
    },
    {
      key: "netto",
      breite: "6.2em",
      rechts: true,
      ...kopf("netto", "Netto Saison"),
      render: (z) => <b className={`bc-t ${ton(z.netto)}`}>{vz(z.netto, 1)}</b>,
    },
    {
      key: "potenzial",
      breite: "9.2em",
      ...kopf("potenzial", "Potenzial-Rest"),
      render: (z) =>
        z.gesamt != null && z.potenzial != null ? (
          <span className="te-pot" title={`Gesamtwert ${zahl(z.gesamt, 1)} von Potenzial ${zahl(z.potenzial, 1)}`}>
            <span className="te-pot__bar">
              <i
                style={{
                  width: `${Math.min(100, (z.gesamt / Math.max(z.potenzial, 1)) * 100)}%`,
                }}
              />
            </span>
            <b className="bc-t">{zahl(z.gesamt)}</b>
            <small className="bc-t"> / {zahl(z.potenzial)}</small>
          </span>
        ) : (
          <span className="bc-null">—</span>
        ),
    },
    {
      key: "belastung",
      breite: "minmax(0,1.7fr)",
      ...kopf("belastung", "Belastung · Risiko"),
      render: (z) => <Belastung fatigue={z.fatigue} naechste={z.verletzt ? undefined : belastungNachTraining(z.fatigue, z.modus)} />,
    },
    {
      key: "wunsch",
      breite: "5.6em",
      rechts: true,
      ...kopf("wunsch", "Wunsch"),
      render: (z) =>
        z.wunsch ? (
          <span className={`te-wunsch${z.wunsch === z.modus ? " is-ok" : ""}`} title={z.row.trainingDemand?.detail}>
            {z.wunsch === z.modus ? "erfüllt" : `will ${z.wunsch.slice(0, 1).toUpperCase()}`}
          </span>
        ) : (
          <span className="bc-null">—</span>
        ),
    },
  ];
  return (
    <section className="te-tafel te-kader" data-testid="training-kader-tabelle">
      <header className="te-tafel__kopf">
        <h2>Kader · wer trainiert was</h2>
        <span>
          {zeilen.length} Spieler
          {diszFilter ? ` · Filter: ${zielLabel(diszFilter)}` : ""} · Spaltenkopf klicken sortiert, zweiter Klick dreht
        </span>
      </header>
      <BcTable
        className="te-tbl"
        spalten={spalten}
        zeilen={sortiert}
        zeilenKey={(z) => z.playerId}
        zeilenProps={(z) => ({ onClick: () => onWahl(z.playerId) })}
        zeilenKlasse={(z) =>
          `${gewaehlt === z.playerId ? "is-eigene" : ""}${diszFilter && z.ziel?.disziplinId !== diszFilter ? " is-aus" : ""}`
        }
        leer={<div className="te-leer">Keine Spieler im Kader.</div>}
      />
    </section>
  );
}

/* ================================================================ Disziplin-Radar */

function Radar({
  karten,
  zeilen,
  filter,
  onFilter,
}: {
  karten: DisziplinKarte[];
  zeilen: TrainingZeile[];
  filter: string | null;
  onFilter: (id: string | null) => void;
}) {
  return (
    <section className="te-tafel te-radar" data-testid="training-radar">
      <header className="te-tafel__kopf">
        <h2>Welche Disziplinen noch kommen</h2>
        <span>Auftritte offen · Plätze · wer im Kader darauf trainiert (Klick filtert die Tabelle)</span>
      </header>
      <div className="te-radar__raster">
        {karten.map((k) => {
          const trainieren = zeilen.filter((z) => !z.verletzt && z.ziel?.disziplinId === k.disziplinId).length;
          return (
            <button
              key={k.disziplinId}
              type="button"
              className={`te-rk${filter === k.disziplinId ? " is-an" : ""}${k.offen === 0 ? " is-zu" : ""}`}
              aria-pressed={filter === k.disziplinId}
              title={`${k.label}: ${k.offen} Auftritte offen, ${k.plaetze ?? "?"} Plätze, ${trainieren} trainieren darauf`}
              onClick={() => onFilter(filter === k.disziplinId ? null : k.disziplinId)}
            >
              <b>{k.label.slice(0, 3).toUpperCase()}</b>
              <span className="bc-t">×{k.offen}</span>
              <small className="bc-t">{k.plaetze != null ? `${k.plaetze} Pl.` : "—"}</small>
              <i className="te-rk__bar" style={{ opacity: trainieren > 0 ? 1 : 0.25 }}>
                <u style={{ width: `${Math.min(100, trainieren * 25)}%` }} />
              </i>
              <em className="bc-t">{trainieren}</em>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ================================================================ Im Blick */

function ImBlick({
  zeile,
  index,
  anzahl,
  onModus,
  gesperrt,
  onDetails,
  onPlan,
  wirkung,
}: {
  wirkung?: ReturnType<typeof prognostiziereDisziplinTraining>;
  zeile: TrainingZeile | null;
  index: number;
  anzahl: number;
  onModus: (playerId: string, m: PlayerTrainingMode) => void;
  gesperrt: boolean;
  onDetails?: (id: string, entryId: string) => void;
  onPlan: () => void;
}) {
  if (!zeile) {
    return (
      <aside className="te-tafel te-blick">
        <header className="te-tafel__kopf">
          <h2>Im Blick</h2>
        </header>
        <div className="te-leer">Wähle einen Spieler in der Halle oder in der Tabelle.</div>
      </aside>
    );
  }
  const so = zeile.row.seasonSoFar;
  const preset = getTrainingModePresentation(zeile.modus);
  return (
    <aside className="te-tafel te-blick" data-testid="training-im-blick">
      <header className="te-tafel__kopf">
        <h2>Im Blick</h2>
        <span>
          {index + 1} von {anzahl}
        </span>
        {onDetails ? (
          <button
            type="button"
            className="te-link"
            data-testid="training-player-profile-button"
            onClick={() => onDetails(zeile.playerId, zeile.row.entryId)}
          >
            Voller Bericht ›
          </button>
        ) : null}
      </header>
      <div className="te-blick__koerper">
        <div className="te-blick__kopf">
          <Medaillon zeile={zeile} />
          <div>
            <h3>{zeile.name}</h3>
            <p>
              <KlasseTag klasse={zeile.klasse} /> · Gesamt {zahl(zeile.gesamt, 1)} / Potenzial {zahl(zeile.potenzial, 1)}
            </p>
          </div>
        </div>
        <div className="te-blick__plan">
          <div className="te-blick__zeile">
            <span className="te-gk">Plan</span>
            <ModusSeg wert={zeile.modus} wunsch={zeile.wunsch} onWahl={(m) => onModus(zeile.playerId, m)} gesperrt={gesperrt || zeile.verletzt} />
          </div>
          <WunschZeile zeile={zeile} modus={zeile.modus} />
          {zeile.verletzt ? (
            <p className="te-hinweis is-warn">Nicht einsetzbar, das Training ruht bis zur Rückkehr.</p>
          ) : zeile.ziel ? (
            <>
              <div className="te-blick__ziel">
                <b className="te-haus">{zeile.zielLabel}</b>
                <ArtMarke art={zeile.art} />
                <small>{zeile.ziel.quelle === "ki" ? "Vorschlag der KI" : "von dir gesetzt"}</small>
              </div>
              <AttributBalken eintraege={zeile.profil} />
            </>
          ) : (
            <p className="te-hinweis">Kein Ziel gesetzt.</p>
          )}
          <p className="te-hinweis">
            {preset.label}: {preset.note}
            {zeile.row.trainingDemand ? ` · ${zeile.row.trainingDemand.label}` : ""}
          </p>
        </div>
        <div className="te-blick__saison">
          <span className="te-gk">
            Diese Saison bisher
            {so ? ` · Spieltag ${so.matchdaysPlayed} von ${so.totalMatchdays}` : ""}
          </span>
          {so ? (
            <div className="te-vier">
              <div>
                <small>Training</small>
                <b className={`bc-t ${ton(so.trainingTotal)}`}>{vz(so.trainingTotal, 1)}</b>
              </div>
              <div>
                <small>Leistung</small>
                <b className={`bc-t ${ton(so.performanceTotal)}`}>{vz(so.performanceTotal, 1)}</b>
              </div>
              <div>
                <small>Nebeneffekt</small>
                <b className={`bc-t ${ton(so.spilloverTotal)}`}>{vz(so.spilloverTotal, 1)}</b>
              </div>
              <div>
                <small>Abbau</small>
                <b className={`bc-t ${ton(-Math.abs(so.regressionTotal))}`}>{vz(-Math.abs(so.regressionTotal), 1)}</b>
              </div>
            </div>
          ) : (
            <p className="te-hinweis">Noch kein Spieltag im Budget.</p>
          )}
        </div>
        <div className="te-blick__bel">
          <span className="te-gk">
            Belastung <b className="bc-t">{zahl(zeile.fatigue)}</b> · {zonenText(zeile.fatigue)}
          </span>
          <Belastung fatigue={zeile.fatigue} naechste={zeile.verletzt ? undefined : belastungNachTraining(zeile.fatigue, zeile.modus)} />
          <p className="te-hinweis">
            Ab 25 beginnt das Verletzungsrisiko (3 % bei 50, 25 % bei 80, 33 % bei 100). Der Pfeil zeigt die Belastung nach dem nächsten
            Training in dieser Intensität, ohne Einsatz.
          </p>
        </div>
        {wirkung && wirkung.zeilen.length > 0 ? (
          <div className="te-blick__saison" data-testid="training-wo-es-ankommt">
            <span className="te-gk">Wo das ankommt · Eignung bis Saisonende</span>
            {wirkung.zeilen.slice(0, 4).map((d) => (
              <div key={d.disziplinId} className="te-kv">
                <span>
                  {zielLabel(d.disziplinId)}
                  {d.kaderRangPrognose != null ? <small className="bc-t"> · Kaderplatz {d.kaderRangPrognose}</small> : null}
                </span>
                <b className="bc-t">
                  {zahl(d.prognose, 1)} <span className={ton(d.delta)}>{vz(d.delta, 2)}</span>
                </b>
              </div>
            ))}
          </div>
        ) : null}
        <div className="te-blick__fuss">
          <button type="button" className="te-btn is-gold" onClick={onPlan}>
            <BcIcon name="zahnrad" /> Plan ändern
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ================================================================ Spieler-Ansicht */

type AttrZeile = TrainingZeile["row"]["attributeForecast"][number];

function SpielerAnsicht({
  zeile,
  gameState,
  onDetails,
}: {
  zeile: TrainingZeile | null;
  gameState: GameState;
  onDetails?: (id: string, entryId: string) => void;
}) {
  const [aSort, setASort] = useState<{
    schluessel: string;
    richtung: SortRichtung;
  }>({ schluessel: "jetzt", richtung: "ab" });
  const [dSort, setDSort] = useState<{
    schluessel: string;
    richtung: SortRichtung;
  }>({ schluessel: "delta", richtung: "ab" });
  const playerId = zeile?.playerId ?? null;
  const prognose = useMemo(() => (playerId ? prognostiziereDisziplinTraining({ gameState, playerId }) : null), [gameState, playerId]);
  const verlauf = useMemo(() => (playerId ? entpackeTrainingsVerlauf(gameState, playerId) : []), [gameState, playerId]);
  if (!zeile) return <div className="te-tafel te-leer">Wähle im Reiter Kader einen Spieler.</div>;

  const attrWert = (a: AttrZeile, s: string): number | string => {
    switch (s) {
      case "name":
        return a.attribute;
      case "jetzt":
        return a.before;
      case "training":
        return a.training;
      case "leistung":
        return a.performance;
      case "neben":
        return a.spillover ?? 0;
      case "abbau":
        return a.regression;
      default:
        return a.after;
    }
  };
  const attribute = sortiereZeilen(
    zeile.row.attributeForecast,
    (a) => attrWert(a, aSort.schluessel),
    aSort.richtung,
    (a) => a.attribute,
  );
  const kopfA = (key: string, text: string, rechts = true): BcTableColumn<AttrZeile> => ({
    key,
    breite: key === "name" ? "minmax(0,1.5fr)" : key === "decke" ? "minmax(0,1.3fr)" : "minmax(0,0.8fr)",
    rechts,
    kopf: (
      <>
        {text}
        {aSort.schluessel === key ? (aSort.richtung === "ab" ? " ▾" : " ▴") : ""}
      </>
    ),
    onKopf: key === "decke" ? undefined : () => setASort((alt) => naechsteSortierung(alt, key, key === "name" ? "auf" : "ab")),
    aktiv: aSort.schluessel === key,
    render: () => null,
  });
  const profilMap = new Map(zeile.profil.map((p) => [p.attribute as string, p.anteil] as const));
  const spaltenA: Array<BcTableColumn<AttrZeile>> = [
    {
      ...kopfA("name", "Attribut", false),
      render: (a) => (
        <span className="te-attr" style={{ "--af": achsenFarbe(a.attributeKey) } as CSSProperties}>
          <i />
          {a.attribute}
          {profilMap.has(a.attributeKey) ? (
            <small className="bc-t"> {Math.round((profilMap.get(a.attributeKey) ?? 0) * 100)} %</small>
          ) : null}
        </span>
      ),
    },
    {
      ...kopfA("jetzt", "Jetzt"),
      render: (a) => <b className="bc-t te-gross">{zahl(a.before)}</b>,
    },
    {
      ...kopfA("training", "Training"),
      render: (a) => <span className={`bc-t ${ton(a.training)}`}>{a.training ? vz(a.training, 1) : "–"}</span>,
    },
    {
      ...kopfA("leistung", "Leistung"),
      render: (a) => <span className={`bc-t ${ton(a.performance)}`}>{a.performance ? vz(a.performance, 1) : "–"}</span>,
    },
    {
      ...kopfA("neben", "Neben"),
      render: (a) => <span className={`bc-t ${ton(a.spillover)}`}>{a.spillover ? vz(a.spillover, 1) : "–"}</span>,
    },
    {
      ...kopfA("abbau", "Abbau"),
      render: (a) => <span className={`bc-t ${ton(-Math.abs(a.regression))}`}>{a.regression ? vz(-Math.abs(a.regression), 1) : "–"}</span>,
    },
    {
      ...kopfA("ende", "Saisonende"),
      render: (a) => (
        <span className="bc-t">
          <b>{zahl(a.after, 1)}</b> <small className={ton(a.delta)}>{vz(a.delta, 1)}</small>
        </span>
      ),
    },
    {
      ...kopfA("decke", "Decke", false),
      render: (a) => <small className={`te-decke is-${a.ceilingState ?? "open"}`}>{a.headroomLabel ?? "—"}</small>,
    },
  ];

  const zeilenD = prognose?.zeilen ?? [];
  const dWert = (d: (typeof zeilenD)[number], s: string): number | string => {
    switch (s) {
      case "name":
        return zielLabel(d.disziplinId);
      case "heute":
        return d.heute;
      case "prognose":
        return d.prognose;
      case "rang":
        return d.kaderRangPrognose ?? 99;
      default:
        return d.delta;
    }
  };
  const disz = sortiereZeilen(
    zeilenD,
    (d) => dWert(d, dSort.schluessel),
    dSort.richtung,
    (d) => zielLabel(d.disziplinId),
  );
  const kopfD = (key: string, text: string, breite: string, rechts = true): BcTableColumn<(typeof zeilenD)[number]> => ({
    key,
    breite,
    rechts,
    kopf: (
      <>
        {text}
        {dSort.schluessel === key ? (dSort.richtung === "ab" ? " ▾" : " ▴") : ""}
      </>
    ),
    onKopf: () => setDSort((alt) => naechsteSortierung(alt, key, key === "name" ? "auf" : "ab")),
    aktiv: dSort.schluessel === key,
    render: () => null,
  });
  const spaltenD: Array<BcTableColumn<(typeof zeilenD)[number]>> = [
    {
      ...kopfD("name", "Disziplin", "minmax(0,1.6fr)", false),
      render: (d) => (
        <span>
          {zielLabel(d.disziplinId)}
          {d.istZiel ? <b className="te-art"> Ziel</b> : null}
        </span>
      ),
    },
    {
      ...kopfD("heute", "Heute", "minmax(0,0.8fr)"),
      render: (d) => <span className="bc-t">{zahl(d.heute, 1)}</span>,
    },
    {
      ...kopfD("prognose", "Prognose", "minmax(0,0.9fr)"),
      render: (d) => <b className="bc-t">{zahl(d.prognose, 1)}</b>,
    },
    {
      ...kopfD("delta", "Zuwachs", "minmax(0,0.9fr)"),
      render: (d) => <span className={`bc-t ${ton(d.delta)}`}>{vz(d.delta, 2)}</span>,
    },
    {
      ...kopfD("rang", "Kaderplatz", "minmax(0,0.9fr)"),
      render: (d) => (
        <span className="bc-t">
          {d.kaderRangPrognose ?? "—"}
          {d.kaderRangHeute != null && d.kaderRangPrognose != null && d.kaderRangHeute !== d.kaderRangPrognose ? (
            <small className="bc-plus"> ({d.kaderRangHeute})</small>
          ) : null}
        </span>
      ),
    },
  ];
  const maxVerlauf = Math.max(0.01, ...verlauf.map((v) => v.summe));
  const gesamtVerlauf = verlauf.reduce((s, v) => s + v.summe, 0);
  return (
    <div className="te-spieler" data-testid="training-spieler">
      <section className="te-tafel te-sp-links">
        <div className="te-sp-fig">
          <PlayerPixelSprite playerId={zeile.playerId} size={200} dir="south" anim="walk" fallback={<Medaillon zeile={zeile} />} />
          <div className="te-sp-name">
            <h3>{zeile.name}</h3>
            <p>
              <KlasseTag klasse={zeile.klasse} />
            </p>
          </div>
        </div>
        <div className="te-blick__plan">
          <span className="te-gk">Plan</span>
          {zeile.verletzt ? (
            <p className="te-hinweis is-warn">Nicht einsetzbar, Training ruht.</p>
          ) : zeile.ziel ? (
            <>
              <div className="te-blick__ziel">
                <b className="te-haus">{zeile.zielLabel}</b>
                <ArtMarke art={zeile.art} />
              </div>
              <AttributBalken eintraege={zeile.profil} />
            </>
          ) : (
            <p className="te-hinweis">Kein Ziel gesetzt.</p>
          )}
        </div>
        <div className="te-blick__plan">
          <span className="te-gk">Entwicklung vor Verkauf</span>
          <div className="te-kv">
            <span>Gesamt heute → Potenzial</span>
            <b className="bc-t">
              {zahl(zeile.gesamt, 1)} → {zahl(zeile.potenzial, 1)}
            </b>
          </div>
          {zeile.row.economy.contractLength != null ? (
            <div className="te-kv">
              <span>Vertrag</span>
              <b className="bc-t">
                noch {zeile.row.economy.contractLength} Saison
                {zeile.row.economy.contractLength === 1 ? "" : "en"}
              </b>
            </div>
          ) : null}
        </div>
        {onDetails ? (
          <button type="button" className="te-btn" onClick={() => onDetails(zeile.playerId, zeile.row.entryId)}>
            Spielerprofil öffnen
          </button>
        ) : null}
      </section>
      <section className="te-tafel te-sp-mitte">
        <header className="te-tafel__kopf">
          <h2>Zwölf Attribute</h2>
          <span>Engine-Prognose bis Saisonende · Spaltenkopf sortiert</span>
        </header>
        <BcTable className="te-tbl" spalten={spaltenA} zeilen={attribute} zeilenKey={(a) => a.attributeKey} />
        <div className="te-verlauf">
          <span className="te-gk">Trainingsverlauf je Spieltag</span>
          {verlauf.length > 0 ? (
            <>
              <div className="te-verlauf__balken">
                {verlauf.map((v) => (
                  <i
                    key={v.matchdayId}
                    className={v.status === "verletzt" ? "is-reha" : v.modus ? `is-${v.modus}` : ""}
                    style={{
                      height: `${v.status === "verletzt" ? 12 : Math.max(8, (v.summe / maxVerlauf) * 100)}%`,
                    }}
                    title={`Spieltag ${v.spieltag ?? "?"}: ${v.status === "verletzt" ? "verletzt, kein Training" : `${vz(v.summe, 2)} SP · ${v.modus ?? ""}`}`}
                  />
                ))}
              </div>
              <p className="te-hinweis">
                Gebucht bisher <b className="bc-t">{vz(gesamtVerlauf, 2)}</b> SP in {verlauf.filter((v) => v.status === "trainiert").length}{" "}
                Spieltagen.
              </p>
            </>
          ) : (
            <p className="te-hinweis">Noch kein gebuchter Spieltag in dieser Saison.</p>
          )}
        </div>
      </section>
      <section className="te-tafel te-sp-rechts">
        <header className="te-tafel__kopf">
          <h2>Wirkung in 20 Disziplinen</h2>
          <span>{prognose ? `bis Saisonende, andere Spieler bleiben stehen` : "ohne vollen Attributbogen nicht berechenbar"}</span>
        </header>
        {prognose ? (
          <BcTable className="te-tbl" spalten={spaltenD} zeilen={disz} zeilenKey={(d) => d.disziplinId} />
        ) : (
          <div className="te-leer">Für diesen Spieler liegt kein voller Attributbogen vor.</div>
        )}
      </section>
    </div>
  );
}

/* ================================================================ Plan-Editor */

function PlanAnsicht({
  zeilen,
  gewaehlt,
  onWahl,
  gameState,
  teamId,
  entwurf,
  setEntwurf,
  onUebernehmen,
  gesperrt,
}: {
  zeilen: TrainingZeile[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
  gameState: GameState;
  teamId: string;
  entwurf: Entwurf;
  setEntwurf: (f: (alt: Entwurf) => Entwurf) => void;
  onUebernehmen: () => void;
  gesperrt: boolean;
}) {
  const matchdayId = gameState.matchdayState?.matchdayId ?? null;
  const ausfall = useMemo(
    () => (matchdayId ? bestimmeAusfallSpielerFuerSpieltag(gameState, matchdayId) : new Set<string>()),
    [gameState, matchdayId],
  );
  const kontext = useMemo(() => baueTrainingsZielKontext(gameState, matchdayId, ausfall), [gameState, matchdayId, ausfall]);
  const zeile = zeilen.find((z) => z.playerId === gewaehlt) ?? zeilen[0] ?? null;
  const karten = useMemo(
    () =>
      zeile
        ? baueDisziplinKarten({
            gameState,
            teamId,
            playerId: zeile.playerId,
            kontext,
          })
        : [],
    [gameState, teamId, zeile, kontext],
  );
  const aenderungen = Object.entries(entwurf).filter(([, e]) => e.ziel || e.modus);
  // Offen = Wunsch, der auch mit den bereits gesetzten Entwurfs-Änderungen noch nicht erfüllt ist.
  const offeneWuensche = Object.keys(wuenscheErfuellen(zeilen, entwurf)).length;
  // Vorschau je (Ziel, Intensität): jede Rechnung ist eine volle Spieltags-Progression. Pro Render waren es bis zu acht;
  // jetzt je Spieler und Spielstand einmal pro Kombination (Cache), damit Hover und Auswahl den Browser nicht belasten.
  const vorschauPlayerId = zeile?.playerId ?? null;
  const vorschauDisz = Array.from(
    new Set([zeile?.ziel?.disziplinId, entwurf[zeile?.playerId ?? ""]?.ziel?.disziplinId].filter((x): x is string => Boolean(x))),
  ).join("|");
  const vorschauMap = useMemo(() => {
    const karte = new Map<string, ReturnType<typeof prognostiziereSpieltagsTraining>>();
    if (!vorschauPlayerId) return karte;
    for (const disziplinId of vorschauDisz.split("|").filter(Boolean)) {
      for (const weg of [0, 1, 2] as const) {
        for (const modus of ["leicht", "mittel", "hart"] as const) {
          karte.set(
            `${disziplinId}:${weg}:${modus}`,
            prognostiziereSpieltagsTraining({ gameState, playerId: vorschauPlayerId, ziel: { disziplinId, weg }, modus, kontext }),
          );
        }
      }
    }
    return karte;
  }, [gameState, kontext, vorschauPlayerId, vorschauDisz]);
  const vorschau = (ziel: { disziplinId: string; weg: number } | null, modus: PlayerTrainingMode) => {
    if (!ziel) return null;
    const erg = vorschauMap.get(`${ziel.disziplinId}:${ziel.weg}:${modus}`);
    return erg && !erg.verletzt ? erg : null;
  };
  if (!zeile) return <div className="te-tafel te-leer">Keine Spieler im Kader.</div>;

  const wahl = entwurf[zeile.playerId] ?? {};
  const aktZiel = wahl.ziel ?? (zeile.ziel ? { disziplinId: zeile.ziel.disziplinId, weg: zeile.ziel.weg } : null);
  const aktModus = wahl.modus ?? zeile.modus;
  const gewaehlteKarte = karten.find((k) => k.disziplinId === aktZiel?.disziplinId) ?? null;
  const setze = (patch: { ziel?: { disziplinId: string; weg: number }; modus?: PlayerTrainingMode }) =>
    setEntwurf((alt) => {
      const neu = { ...(alt[zeile.playerId] ?? {}), ...patch };
      if (neu.ziel && zeile.ziel && zielGleich(neu.ziel, zeile.ziel)) delete neu.ziel;
      if (neu.modus && neu.modus === zeile.modus) delete neu.modus;
      const rest = { ...alt };
      if (neu.ziel || neu.modus) rest[zeile.playerId] = neu;
      else delete rest[zeile.playerId];
      return rest;
    });

  const jetzt = vorschau(zeile.ziel ? { disziplinId: zeile.ziel.disziplinId, weg: zeile.ziel.weg } : null, zeile.modus);
  const neu = vorschau(aktZiel, aktModus);
  const wege = aktZiel ? wegeFuerDisziplin(aktZiel.disziplinId) : [];

  return (
    <div className="te-plan" data-testid="training-plan">
      <section className="te-tafel te-plan-links">
        <header className="te-tafel__kopf">
          <h2>Kader-Plan</h2>
          <span>Spieler wählen</span>
        </header>
        <div className="te-wunschleiste">
          <button
            type="button"
            className="te-btn te-btn--klein"
            data-testid="training-wuensche-erfuellen"
            disabled={gesperrt || offeneWuensche === 0}
            title="Setzt bei allen Spielern mit offenem Wunsch die gewünschte Intensität als offene Änderung"
            onClick={() =>
              setEntwurf((alt) => {
                const neu = { ...alt };
                for (const [id, modus] of Object.entries(wuenscheErfuellen(zeilen, alt))) {
                  const z = zeilen.find((x) => x.playerId === id);
                  const rest = { ...(neu[id] ?? {}) };
                  if (z && modus === z.modus) delete rest.modus;
                  else rest.modus = modus;
                  if (rest.ziel || rest.modus) neu[id] = rest;
                  else delete neu[id];
                }
                return neu;
              })
            }
          >
            <BcIcon name="check" /> Wünsche erfüllen ({offeneWuensche})
          </button>
        </div>
        <div className="te-plan-liste">
          {zeilen.map((z) => {
            const e = entwurf[z.playerId];
            return (
              <button
                key={z.playerId}
                type="button"
                className={`te-pl${z.playerId === zeile.playerId ? " is-an" : ""}`}
                onClick={() => onWahl(z.playerId)}
              >
                <Medaillon zeile={z} klein />
                <span>
                  <strong>{z.name}</strong>
                  <small>
                    {z.verletzt ? "Reha" : (z.zielLabel ?? "kein Ziel")} · <KlasseTag klasse={z.klasse} />
                  </small>
                </span>
                {z.wunsch ? (
                  <span
                    className={`te-wunsch te-wunsch--klein${(e?.modus ?? z.modus) === z.wunsch ? " is-ok" : ""}`}
                    title={`Wunsch: ${MODI.find((m) => m.id === z.wunsch)?.name}`}
                  >
                    W {MODI.find((m) => m.id === z.wunsch)?.kurz}
                  </span>
                ) : null}
                {e ? <i className="te-pl__punkt" title="offene Änderung" /> : null}
                <b className="te-pl__modus">{MODI.find((m) => m.id === (e?.modus ?? z.modus))?.kurz}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="te-tafel te-plan-mitte">
        <header className="te-tafel__kopf">
          <h2>{zeile.name} · Trainingsplan</h2>
          <span>
            <KlasseTag klasse={zeile.klasse} /> · Gesamt {zahl(zeile.gesamt, 1)} / Potenzial {zahl(zeile.potenzial, 1)}
          </span>
          {wahl.ziel || wahl.modus ? (
            <button
              type="button"
              className="te-link"
              onClick={() =>
                setEntwurf((alt) => {
                  const r = { ...alt };
                  delete r[zeile.playerId];
                  return r;
                })
              }
            >
              Änderung verwerfen
            </button>
          ) : null}
        </header>
        {zeile.verletzt ? (
          <p className="te-hinweis is-warn te-pad">Nicht einsetzbar: das Training ruht, Ziel und Intensität gelten ab Rückkehr.</p>
        ) : null}
        <div className="te-plan-schritt">
          <h3>
            <b>1</b> Ziel-Disziplin <small>×N = Auftritte, die diese Saison noch kommen · darunter Eignung und Kaderplatz</small>
          </h3>
          <div className="te-dk-raster">
            {karten.map((k) => (
              <button
                key={k.disziplinId}
                type="button"
                disabled={gesperrt}
                className={`te-dk${aktZiel?.disziplinId === k.disziplinId ? " is-an" : ""}${k.offen === 0 ? " is-zu" : ""}`}
                onClick={() =>
                  setze({
                    ziel: {
                      disziplinId: k.disziplinId,
                      weg: aktZiel?.disziplinId === k.disziplinId ? aktZiel.weg : 0,
                    },
                  })
                }
              >
                <span className="te-dk__oben bc-t">
                  ×{k.offen}
                  <small>
                    {k.kaderRang != null ? `Rang ${k.kaderRang}` : ""}
                    {k.plaetze != null ? ` · ${k.plaetze} Pl.` : ""}
                  </small>
                </span>
                <b>{k.label}</b>
                <span className="bc-t">{zahl(k.eignung, 1)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="te-plan-schritt">
          <h3>
            <b>2</b> Weg{" "}
            <small>
              {gewaehlteKarte
                ? `${gewaehlteKarte.label} lässt sich über mehrere Attribute gewinnen. Die Matrix bleibt, du wählst nur, was trainiert wird.`
                : "erst eine Disziplin wählen"}
            </small>
          </h3>
          <div className="te-wege">
            {wege.map((w) => {
              const p = vorschau({ disziplinId: aktZiel!.disziplinId, weg: w.weg }, aktModus);
              const gew = aktZiel?.weg === w.weg;
              return (
                <button
                  key={w.weg}
                  type="button"
                  disabled={gesperrt}
                  className={`te-weg${gew ? " is-an" : ""}`}
                  onClick={() =>
                    setze({
                      ziel: { disziplinId: aktZiel!.disziplinId, weg: w.weg },
                    })
                  }
                >
                  <span className="te-weg__kopf">
                    <span className={`te-art${w.art === "neben" ? " is-neben" : ""}`}>
                      {w.art === "primaer" ? "Primärweg" : "Nebenweg"}
                    </span>
                    <small>Matrix {zahl(gewaehlteKarte?.wege.find((x) => x.weg === w.weg)?.matrixGewicht ?? 0)} %</small>
                  </span>
                  <b className="te-haus" style={{ "--af": achsenFarbe(w.hauptAttribut) } as CSSProperties}>
                    <i /> {attributLabel(w.hauptAttribut)}
                  </b>
                  <AttributBalken
                    eintraege={w.profil.map((e) => ({
                      attribute: e.attribute,
                      label: attributLabel(e.attribute),
                      anteil: e.anteil,
                    }))}
                  />
                  <span className="te-weg__fuss">
                    {p ? (
                      <>
                        Zuwachs je Spieltag <b className="bc-t bc-plus">{vz(p.summe, 3)}</b> SP
                        {p.deckeBremst.length > 0 ? <em> · Decke bremst: {p.deckeBremst.map(attributLabel).join(", ")}</em> : null}
                      </>
                    ) : (
                      "keine Prognose"
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="te-plan-schritt">
          <h3>
            <b>3</b> Intensität{" "}
            <small>
              mehr Budget kostet Erholung
              {zeile.wunsch ? ` · sein Wunsch: ${MODI.find((m) => m.id === zeile.wunsch)?.name}` : ""}
            </small>
          </h3>
          <WunschZeile zeile={zeile} modus={aktModus} vorher={aktModus !== zeile.modus ? zeile.modus : undefined} />
          <div className="te-modi">
            {MODI.map((m) => {
              const preset = getTrainingModePresentation(m.id);
              const p = vorschau(aktZiel, m.id);
              const nach = belastungNachTraining(zeile.fatigue, m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={gesperrt || zeile.verletzt}
                  className={`te-modus${aktModus === m.id ? " is-an" : ""}`}
                  onClick={() => setze({ modus: m.id })}
                >
                  <span className="te-modus__kopf">
                    <b className="te-haus">{m.name}</b>
                    {zeile.wunsch === m.id ? <span className="te-art te-art--wunsch">Sein Wunsch</span> : null}
                  </span>
                  <small>{preset.note}</small>
                  <span className="te-kv">
                    <span>Trainingszuwachs je Spieltag</span>
                    <b className="bc-t bc-plus">{p ? `${vz(p.summe, 3)} SP` : "—"}</b>
                  </span>
                  <span className="te-kv">
                    <span>Belastung nach dem Training</span>
                    <b className="bc-t" style={{ color: belastungsZone(nach).farbe }}>
                      {zahl(zeile.fatigue)} → {zahl(nach)}
                    </b>
                  </span>
                  <span className="te-kv">
                    <span>Verletzungsrisiko dann</span>
                    <b className="bc-t">{zahl(risikoProzent(nach), 1)} %</b>
                  </span>
                  {zeile.wunsch ? (
                    <span className="te-kv">
                      <span>Moral durch den Wunsch</span>
                      <b className={`bc-t ${ton(wunschFolge(zeile, m.id)?.delta)}`}>{vz(wunschFolge(zeile, m.id)?.delta, 1)}</b>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="te-tafel te-plan-rechts">
        <header className="te-tafel__kopf">
          <h2>Vorschau</h2>
          <span>bisher → mit dieser Änderung</span>
        </header>
        <div className="te-vorschau">
          <span className="te-gk">
            {gewaehlteKarte?.label ?? "—"} · {aktZiel ? (aktZiel.weg === 0 ? "Primärweg" : "Nebenweg") : "—"} ·{" "}
            {MODI.find((m) => m.id === aktModus)?.name}
          </span>
          <div className="te-kv">
            <span>Zuwachs nächster Spieltag</span>
            <b className="bc-t">
              {jetzt ? vz(jetzt.summe, 3) : "—"} → <span className="bc-plus">{neu ? vz(neu.summe, 3) : "—"}</span> SP
            </b>
          </div>
          <div className="te-kv">
            <span>Eignung {gewaehlteKarte?.label ?? ""}</span>
            <b className="bc-t">{zahl(gewaehlteKarte?.eignung, 1)}</b>
          </div>
          <div className="te-kv">
            <span>Kaderplatz</span>
            <b className="bc-t">{gewaehlteKarte?.kaderRang ?? "—"}</b>
          </div>
          <div className="te-kv">
            <span>Belastung nach Training</span>
            <b className="bc-t">
              {zahl(belastungNachTraining(zeile.fatigue, zeile.modus))} → {zahl(belastungNachTraining(zeile.fatigue, aktModus))}
            </b>
          </div>
          <div className="te-kv">
            <span>Verletzungsrisiko</span>
            <b className="bc-t">
              {zahl(risikoProzent(belastungNachTraining(zeile.fatigue, zeile.modus)), 1)} % →{" "}
              {zahl(risikoProzent(belastungNachTraining(zeile.fatigue, aktModus)), 1)} %
            </b>
          </div>
          {zeile.wunsch ? (
            <div className="te-kv" data-testid="training-vorschau-wunsch">
              <span>Moral durch den Wunsch</span>
              <b className="bc-t">
                {vz(wunschFolge(zeile, zeile.modus)?.delta, 1)} →{" "}
                <span className={ton(wunschFolge(zeile, aktModus)?.delta)}>{vz(wunschFolge(zeile, aktModus)?.delta, 1)}</span>
              </b>
            </div>
          ) : null}
        </div>
        <div className="te-offen">
          <span className="te-gk">Offene Änderungen · {aenderungen.length}</span>
          {aenderungen.length === 0 ? <p className="te-hinweis">Nichts geändert.</p> : null}
          {aenderungen.map(([id, e]) => {
            const z = zeilen.find((x) => x.playerId === id);
            return (
              <div key={id} className="te-kv">
                <span>{z?.name ?? id}</span>
                <b className="bc-t">
                  {e.ziel ? zielLabel(e.ziel.disziplinId) : (z?.zielLabel ?? "")}
                  {e.ziel ? (e.ziel.weg === 0 ? " · Primär" : " · Neben") : ""}
                  {e.modus ? ` · ${MODI.find((m) => m.id === e.modus)?.name}` : ""}
                </b>
              </div>
            );
          })}
        </div>
        <div className="te-blick__fuss">
          <button type="button" className="te-btn is-gold" disabled={gesperrt || aenderungen.length === 0} onClick={onUebernehmen}>
            <BcIcon name="check" /> Plan übernehmen ({aenderungen.length})
          </button>
          <button type="button" className="te-btn" disabled={aenderungen.length === 0} onClick={() => setEntwurf(() => ({}))}>
            Verwerfen
          </button>
        </div>
      </section>
    </div>
  );
}

/* ================================================================ Seite */

export default function TrainingModern(props: TrainingModernProps) {
  const {
    gameState,
    selectedTeam,
    summary,
    playerRows,
    managementLocked = false,
    managementLockedReason = null,
    onSetTrainingMode,
    onSetTrainingsZiele,
    onOpenPlayerDetails,
    onOpenFacilities,
    onZurKlassik,
  } = props;
  const [ansicht, setAnsicht] = useState<Ansicht>("kader");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [diszFilter, setDiszFilter] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Entwurf>({});

  const matchdayId = gameState.matchdayState?.matchdayId ?? null;
  const ausfall = useMemo(
    () => (matchdayId ? bestimmeAusfallSpielerFuerSpieltag(gameState, matchdayId) : new Set<string>()),
    [gameState, matchdayId],
  );
  const kontext = useMemo(() => baueTrainingsZielKontext(gameState, matchdayId, ausfall), [gameState, matchdayId, ausfall]);
  const zeilen = useMemo(
    () => baueTrainingZeilen({ gameState, rows: playerRows, kontext, ausfall }),
    [gameState, playerRows, kontext, ausfall],
  );
  const kenn = useMemo(() => baueKaderKennzahlen(zeilen), [zeilen]);
  const aktiv = zeilen.find((z) => z.playerId === gewaehlt) ?? zeilen[0] ?? null;
  const aktivIndex = aktiv ? zeilen.findIndex((z) => z.playerId === aktiv.playerId) : 0;
  const aktivId = aktiv?.playerId ?? null;
  const wirkung = useMemo(
    () => (aktivId && ansicht === "kader" ? prognostiziereDisziplinTraining({ gameState, playerId: aktivId }) : null),
    [gameState, aktivId, ansicht],
  );
  const radarKarten = useMemo(
    () =>
      aktiv
        ? baueDisziplinKarten({
            gameState,
            teamId: selectedTeam.teamId,
            playerId: aktiv.playerId,
            kontext,
          })
        : [],
    [gameState, selectedTeam.teamId, aktiv, kontext],
  );

  const gesperrt = managementLocked;

  const uebernehmen = () => {
    const ziele: Array<{
      playerId: string;
      ziel: { disziplinId: string; weg: number } | null;
    }> = [];
    for (const [playerId, e] of Object.entries(entwurf)) {
      if (e.ziel) ziele.push({ playerId, ziel: e.ziel });
      if (e.modus) onSetTrainingMode(playerId, e.modus);
    }
    if (ziele.length > 0) onSetTrainingsZiele?.(ziele);
    setEntwurf({});
  };
  const wahlSpieler = (id: string) => setGewaehlt(id);
  const details = onOpenPlayerDetails
    ? (id: string, entryId: string) => onOpenPlayerDetails({ playerId: id, activePlayerId: entryId })
    : undefined;

  const reiter: Array<[Ansicht, string]> = [
    ["kader", "Kader"],
    ["spieler", "Spieler"],
    ["plan", "Plan"],
  ];
  return (
    <div className="bc te" data-testid="training-modern">
      <FoundationBandSlot>
        <div className="bc te-slot" data-testid="training-kopf">
          <div className="te-reiter" role="tablist">
            {reiter.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={ansicht === id}
                className={ansicht === id ? "is-an" : ""}
                onClick={() => setAnsicht(id)}
              >
                {label}
              </button>
            ))}
            {onOpenFacilities ? (
              <button type="button" role="tab" aria-selected={false} onClick={onOpenFacilities} title="Gebäude öffnen">
                Gebäude
              </button>
            ) : null}
            <button type="button" role="tab" aria-selected={false} disabled title="kommt: Vergleich mit den KI-Teams">
              Liga <small>kommt</small>
            </button>
          </div>
          <div className="te-kennzahlen">
            <div>
              <em>Kader netto</em>
              <strong className={`bc-t ${ton(kenn.nettoSumme)}`}>{vz(kenn.nettoSumme, 1)}</strong>
              <small>SP bis Saisonende</small>
            </div>
            <div>
              <em>Belastung Ø</em>
              <strong className="bc-t">{kenn.belastungMittel}</strong>
              <small>von 100</small>
            </div>
            <div className={kenn.ueberlastet > 0 ? "is-warn" : ""}>
              <em>Überlastet</em>
              <strong className="bc-t">{kenn.ueberlastet}</strong>
              <small>über 50</small>
            </div>
            <div className={kenn.wuenscheOffen > 0 ? "is-wunsch" : ""} data-testid="training-kennzahl-wuensche">
              <em>Wünsche offen</em>
              <strong className="bc-t">{kenn.wuenscheOffen}</strong>
              <small>von {kenn.wuenscheGesamt}</small>
            </div>
            <div>
              <em>Verletzt</em>
              <strong className="bc-t">{kenn.verletzt}</strong>
              <small>in Reha</small>
            </div>
            <div>
              <em>Trainingszentrum</em>
              <strong className="bc-t">{summary.trainingXpModifierPct > 0 ? `+${zahl(summary.trainingXpModifierPct)} %` : "—"}</strong>
              <small>aufs Budget</small>
            </div>
          </div>
        </div>
      </FoundationBandSlot>
      {managementLockedReason ? <p className="te-sperre">{managementLockedReason}</p> : null}
      <div className="te-work">
        {ansicht === "kader" ? (
          <div className="te-kader-raster">
            <div className="te-kader-links">
              <Halle
                zeilen={zeilen}
                gewaehlt={aktiv?.playerId ?? null}
                onWahl={wahlSpieler}
                trainingsZentrumPct={summary.trainingXpModifierPct}
                ueberlastet={kenn.ueberlastet}
              />
              <KaderTabelle
                zeilen={zeilen}
                gewaehlt={aktiv?.playerId ?? null}
                onWahl={wahlSpieler}
                onModus={onSetTrainingMode}
                gesperrt={gesperrt}
                diszFilter={diszFilter}
              />
              <Radar karten={radarKarten} zeilen={zeilen} filter={diszFilter} onFilter={setDiszFilter} />
            </div>
            <ImBlick
              wirkung={wirkung}
              zeile={aktiv}
              index={aktivIndex}
              anzahl={zeilen.length}
              onModus={onSetTrainingMode}
              gesperrt={gesperrt}
              onDetails={details}
              onPlan={() => setAnsicht("plan")}
            />
          </div>
        ) : null}
        {ansicht === "spieler" ? <SpielerAnsicht zeile={aktiv} gameState={gameState} onDetails={details} /> : null}
        {ansicht === "plan" ? (
          <PlanAnsicht
            zeilen={zeilen}
            gewaehlt={aktiv?.playerId ?? null}
            onWahl={wahlSpieler}
            gameState={gameState}
            teamId={selectedTeam.teamId}
            entwurf={entwurf}
            setEntwurf={setEntwurf}
            onUebernehmen={uebernehmen}
            gesperrt={gesperrt || !onSetTrainingsZiele}
          />
        ) : null}
      </div>
      {onZurKlassik ? (
        <footer className="te-fuss">
          <button type="button" className="te-link" onClick={onZurKlassik}>
            Klassische Trainingsseite
          </button>
          <span>Einheit SP = Setpoints · Zuwächse sind Prognosen der Engine, gebucht wird je Spieltag</span>
        </footer>
      ) : null}
    </div>
  );
}

export { STATIONEN };
