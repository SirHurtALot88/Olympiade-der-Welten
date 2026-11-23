"use client";

/**
 * PLAN, TRAINING RUNDE 2 (22.11.): Ziel-Heatmap Disziplin x Weg, Trainingsvorlieben, Fortschritt dieser Saison, Vorschau.
 * Vorlage: public/mockups/training-r2-22-11.html, Konzept docs/design/training-r2-22-11.md, Bau und Abgleich docs/design/training-r2-bau-22-11.md.
 *
 * Alle Zahlen kommen aus den Diensten, die auch buchen (`berechneSpieltagsZuwachs` ueber `training-heatmap.ts`): die Seite rechnet nichts ein zweites
 * Mal. Das Standardmass der Heatmap sind die Skillpunkte bis Saisonende; Zelle, Vorschau, Kaderliste und Kopf zeigen dieselbe Groesse aus derselben Funktion.
 */
import {
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import { klassenKartenfarbe } from "@/app/foundation/KlassenFarbTag";
import { BcMoralGesicht } from "@/components/foundation/broadcast";
import type { GameState } from "@/lib/data/olyDataTypes";
import {
  ATTRIBUT_LABEL,
  achseVonAttribut,
} from "@/lib/foundation/spielerprofil-modell";
import {
  berechneBelastungsForecast,
  RISIKO_SCHWELLE,
} from "@/lib/training/belastungs-forecast";
import {
  BEREICHE,
  baueSaisonFortschritt,
  baueZielHeatmap,
  besteZelle,
  bereichVonDisziplin,
  spBisSaisonende,
  wertSpanne,
  zellenWert,
  type Bereich,
  type HeatmapMass,
  type HeatmapZelle,
  type HeatmapZeile,
} from "@/lib/training/training-heatmap";
import {
  officialDisciplineWeightLabels,
  type OfficialDisciplineWeightId,
} from "@/lib/player-generator/official-discipline-weights";
import {
  bremseKurz,
  bremsGrundText,
  naechsteSortierung,
  sortiereZeilen,
  wuenscheErfuellen,
  wunschFolge,
  zielGleich,
  type SortRichtung,
  type TrainingZeile,
} from "@/lib/training/training-modern-modell";
import { getTrainingSetpointsJeSpieltag } from "@/lib/training/training-mode-presentation";
import {
  baueWirkungVergleich,
  prognostiziereTrainingAbRueckkehr,
} from "@/lib/training/training-wirkung";
import {
  baueTrainingsZielKontext,
  bestimmeAusfallSpielerFuerSpieltag,
  wegeFuerDisziplin,
} from "@/lib/training/spieltag-training";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import {
  VORLIEBE_FAKTOR_LIEBLING,
  VORLIEBE_FAKTOR_UNGELIEBT,
  VORLIEBE_MORAL_LIEBLING,
  VORLIEBE_MORAL_UNGELIEBT,
} from "@/lib/training/trainings-vorlieben";

import {
  NEBEL_STUFEN,
  nebelStufeFuer,
  sortiereNachNebelStufe,
  vorliebenSichtFuerStufe,
  type NebelStufe,
} from "@/lib/training/trainings-vorlieben-sicht";
import { leiteTrainingsVorliebenAb } from "@/lib/training/trainings-vorlieben";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";

import "./training-r2.css";

export type Entwurf = Record<
  string,
  { ziel?: { disziplinId: string; weg: number }; modus?: PlayerTrainingMode }
>;

const MODI: Array<{ id: PlayerTrainingMode; name: string }> = [
  { id: "leicht", name: "Leicht" },
  { id: "mittel", name: "Mittel" },
  { id: "hart", name: "Hart" },
];
const MINUS = "−";
const KURZ: Record<string, string> = {
  power: "STR",
  health: "VIT",
  determination: "DET",
  stamina: "STA",
  speed: "SPD",
  dexterity: "DEX",
  awareness: "AWA",
  intelligence: "INT",
  will: "WIL",
  charisma: "CHA",
  spirit: "SPI",
  torment: "TOR",
};
const MASS_TITEL: Record<HeatmapMass, string> = {
  sp: "Skillpunkte bis Saisonende",
  eignung: "Eignungszuwachs bis Saisonende",
  luft: "Luft bis zur Decke",
};

function zahl(v: number | null | undefined, stellen = 0): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const t = Math.abs(v).toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
  return v < 0 && Number(t.replace(",", ".")) !== 0 ? `${MINUS}${t}` : t;
}
function pm(v: number, stellen = 2): string {
  return `${v >= 0 ? "+" : MINUS}${zahl(Math.abs(v), stellen)}`;
}
const label = (id: string) =>
  officialDisciplineWeightLabels[id as OfficialDisciplineWeightId] ?? id;
const klassenBereich = (klasse: string): Bereich | null => {
  const f = klassenKartenfarbe(klasse);
  return f ? (f.achse.toLowerCase() as Bereich) : null;
};

/* ------------------------------------------------------------------ Symbole (SVG, keine Emojis) */

const BEREICH_ICON: Record<Bereich, ReactNode> = {
  pow: <path d="M3 9v6M6.5 6v12M17.5 6v12M21 9v6M6.5 12h11" />,
  spe: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  men: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  soc: (
    <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z" />
  ),
};
function BereichIcon({ bereich }: { bereich: Bereich }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      {BEREICH_ICON[bereich]}
    </svg>
  );
}
function Herz({ klasse = "lieb" }: { klasse?: string }) {
  return (
    <svg className={`f ${klasse}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}
function Daumen({ klasse = "unlieb" }: { klasse?: string }) {
  return (
    <svg className={`f ${klasse}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ Tooltip (fest positioniert, damit keine Tafel ihn abschneidet) */

type TipState = { x: number; y: number; inhalt: ReactNode } | null;

function useTip() {
  const [tip, setTip] = useState<TipState>(null);
  const bind = (inhalt: ReactNode) => ({
    onMouseMove: (e: MouseEvent) =>
      setTip({ x: e.clientX, y: e.clientY, inhalt }),
    onMouseLeave: () => setTip(null),
  });
  const box = tip ? (
    <div
      className="tr2-tip"
      role="tooltip"
      style={{
        left: Math.min(
          tip.x + 14,
          (typeof window !== "undefined" ? window.innerWidth : 1920) - 340,
        ),
        top: Math.min(
          tip.y + 16,
          (typeof window !== "undefined" ? window.innerHeight : 1080) - 160,
        ),
      }}
    >
      {tip.inhalt}
    </div>
  ) : null;
  return { bind, box, aus: () => setTip(null) };
}

/* ------------------------------------------------------------------ Vorlieben-Pillen */

function Pille({
  disziplinId,
  art,
  aktiv,
  bind,
}: {
  disziplinId: string;
  art: 1 | -1;
  aktiv: boolean;
  bind: ReturnType<typeof useTip>["bind"];
}) {
  const bereich = bereichVonDisziplin(disziplinId);
  return (
    <span
      className={`vp ${art > 0 ? "l" : "u"} c-${bereich ?? "bal"}${aktiv ? " akt" : ""}`}
      {...bind(
        art > 0 ? (
          <>
            <b>Lieblingsdisziplin</b>
            <br />
            Training mit diesem Ziel: Budget ×
            {zahl(VORLIEBE_FAKTOR_LIEBLING, 2)} und +{VORLIEBE_MORAL_LIEBLING}{" "}
            Moral, solange es Ziel ist.
          </>
        ) : (
          <>
            <b>Ungeliebte Disziplin</b>
            <br />
            Training mit diesem Ziel: Budget ×
            {zahl(VORLIEBE_FAKTOR_UNGELIEBT, 2)} und {MINUS}
            {Math.abs(VORLIEBE_MORAL_UNGELIEBT)} Moral, solange es Ziel ist.
          </>
        ),
      )}
    >
      {art > 0 ? <Herz /> : <Daumen />}
      {label(disziplinId)}
    </span>
  );
}

/* ------------------------------------------------------------------ Kaderliste */

type ListeSort = "reihe" | "name" | "vorlieben" | "sp";

function Kaderliste({
  zeilen,
  spJeSpieler,
  gewaehlt,
  onWahl,
  entwurf,
  bind,
  vorliebenAktiv,
  offeneWuensche,
  onWuensche,
  gesperrt,
}: {
  offeneWuensche: number;
  onWuensche: () => void;
  gesperrt: boolean;
  zeilen: TrainingZeile[];
  spJeSpieler: Map<string, number>;
  gewaehlt: string;
  onWahl: (id: string) => void;
  entwurf: Entwurf;
  bind: ReturnType<typeof useTip>["bind"];
  vorliebenAktiv: boolean;
}) {
  const [sort, setSort] = useState<{
    schluessel: ListeSort;
    richtung: SortRichtung;
  }>({ schluessel: "reihe", richtung: "auf" });
  const wert = (z: TrainingZeile): number | string => {
    const w = entwurf[z.playerId]?.ziel;
    if (sort.schluessel === "sp") return spJeSpieler.get(z.playerId) ?? 0;
    if (sort.schluessel === "name") return z.name.toLocaleLowerCase("de");
    if (sort.schluessel === "vorlieben") {
      if (!z.vorlieben) return 1;
      const id = w?.disziplinId ?? z.ziel?.disziplinId;
      return id && z.vorlieben.lieblinge.includes(id)
        ? 2
        : id === z.vorlieben.ungeliebt
          ? 0
          : 1;
    }
    return 0;
  };
  const sortiert = useMemo(
    () =>
      sort.schluessel === "reihe"
        ? zeilen
        : sortiereZeilen(zeilen, wert, sort.richtung, (z) => z.name),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zeilen, sort, entwurf, spJeSpieler],
  );
  const kopf = (
    schluessel: ListeSort,
    text: string,
    standard: SortRichtung,
    rechts?: boolean,
  ) => (
    <button
      type="button"
      className={`${sort.schluessel === schluessel ? "an" : ""}${rechts ? " r" : ""}`}
      onClick={() =>
        setSort((alt) => naechsteSortierung(alt, schluessel, standard))
      }
      data-testid={`training-plan-sort-${schluessel}`}
    >
      {text}
      {sort.schluessel === schluessel
        ? sort.richtung === "ab"
          ? " ▾"
          : " ▴"
        : ""}
    </button>
  );
  return (
    <section className="pan" data-testid="training-plan-kader">
      <div className="pk">
        <h2>Kader</h2>
        <small>{zeilen.length} Spieler</small>
        <span className="sp" />
        <div className="seg">
          <button
            type="button"
            data-testid="training-wuensche-erfuellen"
            disabled={gesperrt || offeneWuensche === 0}
            onClick={onWuensche}
            {...bind(
              <>
                Setzt bei allen Spielern mit offenem Wunsch die gewünschte
                Intensität als offene Änderung.
              </>,
            )}
          >
            Wünsche erfüllen ({offeneWuensche})
          </button>
        </div>
      </div>
      <div className="kh">
        <span />
        {kopf("name", "Spieler", "auf")}
        <span>Ziel · Weg</span>
        {kopf("vorlieben", "Vorlieben", "ab")}
        {kopf("sp", "SP", "ab", true)}
      </div>
      <div className="kl">
        {sortiert.map((z) => {
          const e = entwurf[z.playerId];
          const ziel =
            e?.ziel ??
            (z.ziel
              ? { disziplinId: z.ziel.disziplinId, weg: z.ziel.weg }
              : null);
          const modus = e?.modus ?? z.modus;
          const kf = klassenBereich(z.klasse);
          const zb = ziel ? bereichVonDisziplin(ziel.disziplinId) : null;
          const geaendert = Boolean(e);
          const hauptAttribut = ziel
            ? (wegeFuerDisziplin(ziel.disziplinId)[ziel.weg]?.hauptAttribut ??
              null)
            : null;
          const sp = spJeSpieler.get(z.playerId) ?? 0;
          const aktId = ziel?.disziplinId ?? null;
          return (
            <button
              key={z.playerId}
              type="button"
              className={`kz c-${kf ?? "bal"}${z.playerId === gewaehlt ? " an" : ""}${z.verletzt ? " verl" : ""}`}
              onClick={() => onWahl(z.playerId)}
              data-testid="training-plan-kaderzeile"
            >
              <span className="po">
                {z.portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={z.portrait} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className="nm">
                <b>{z.name}</b>
                <span>
                  {z.klasse}{" "}
                  <i>
                    ·{" "}
                    {z.verletzt
                      ? "verletzt"
                      : (MODI.find((m) => m.id === modus)?.name ?? "")}
                  </i>
                </span>
              </span>
              <span className={`zi c-${zb ?? "bal"}`}>
                <b>
                  {ziel
                    ? label(ziel.disziplinId)
                    : z.verletzt
                      ? "Reha"
                      : "kein Ziel"}
                  {geaendert ? " •" : ""}
                </b>
                <span>
                  {ziel
                    ? `${ziel.weg === 0 ? "Primärweg" : "Nebenweg"} ${hauptAttribut ? (KURZ[hauptAttribut] ?? "") : ""}`
                    : "—"}
                </span>
              </span>
              <span className="vl">
                {vorliebenAktiv && z.vorlieben ? (
                  <>
                    <Pille
                      disziplinId={z.vorlieben.lieblinge[0]}
                      art={1}
                      aktiv={aktId === z.vorlieben.lieblinge[0]}
                      bind={bind}
                    />
                    <Pille
                      disziplinId={z.vorlieben.lieblinge[1]}
                      art={1}
                      aktiv={aktId === z.vorlieben.lieblinge[1]}
                      bind={bind}
                    />
                    <Pille
                      disziplinId={z.vorlieben.ungeliebt}
                      art={-1}
                      aktiv={aktId === z.vorlieben.ungeliebt}
                      bind={bind}
                    />
                  </>
                ) : (
                  <span className="vp q">Regel aus</span>
                )}
              </span>
              <span
                className={`dz t ${sp > 0 ? "plus" : "null"}`}
                {...bind(
                  <>
                    Skillpunkte bis Saisonende mit dem aktuellen Plan.
                    <br />
                    <i>
                      Klein darunter: was er diese Saison schon gesammelt hat.
                    </i>
                  </>,
                )}
              >
                {pm(sp)}
                <small>bisher {pm(z.spBisher, 1)}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="kfuss">
        {vorliebenAktiv ? (
          <>
            <b>Vorlieben:</b> <Herz /> zwei Lieblingsdisziplinen (Budget ×
            {zahl(VORLIEBE_FAKTOR_LIEBLING, 2)}, +{VORLIEBE_MORAL_LIEBLING}{" "}
            Moral), <Daumen /> eine ungeliebte (×
            {zahl(VORLIEBE_FAKTOR_UNGELIEBT, 2)}, {MINUS}
            {Math.abs(VORLIEBE_MORAL_UNGELIEBT)} Moral) – nur wenn sie das
            Trainingsziel ist. „•“ = offene Änderung.
          </>
        ) : (
          <>
            <b>Vorlieben:</b> in dieser Saison nicht aktiv, sie gelten ab der
            nächsten. „•“ = offene Änderung.
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Heatmap */

function zellenTipp(
  zelle: HeatmapZelle,
  zeile: HeatmapZeile,
  eignungHeute: number | null,
  mass: HeatmapMass,
): ReactNode {
  return (
    <>
      <b>
        {zeile.label} · {zelle.art === "primaer" ? "Primärweg" : "Nebenweg"}{" "}
        {ATTRIBUT_LABEL[zelle.hauptAttribut]}
      </b>
      {zelle.attribute.map((a) => (
        <div key={a.attribute}>
          {KURZ[a.attribute]} {Math.round(a.anteil * 100)} % (Matrix{" "}
          {a.matrixGewicht}){" "}
          <i>
            {zahl(a.vorher, 1)} → Decke{" "}
            {a.deckel != null ? zahl(a.deckel, 0) : "?"}
          </i>{" "}
          {pm(a.zuwachs)}
          {a.bremst ? " · Decke bremst" : ""}
        </div>
      ))}
      <b>Summe {pm(zelle.sp)} SP bis Saisonende</b>
      <div>
        Eignung {zeile.label}: {zahl(eignungHeute, 1)} (Zuwachs über die Matrix{" "}
        {pm(zelle.eignung)})
      </div>
      {zeile.vorliebe !== 0 ? (
        <div>
          {zeile.vorliebe > 0 ? "Lieblingsdisziplin" : "Ungeliebte Disziplin"}:
          Budget ×{zahl(zeile.vorliebeFaktor, 2)} steckt in der Zahl.
        </div>
      ) : null}
      {mass === "luft" ? (
        <div>Luft: Abstand des Hauptattributs zur Decke.</div>
      ) : null}
    </>
  );
}

function HeatmapTafel({
  heatmap,
  mass,
  setMass,
  spieler,
  aktZiel,
  modus,
  onZelle,
  gesperrt,
  klassenBer,
  bind,
  onFremd,
}: {
  onFremd?: () => void;
  heatmap: ReturnType<typeof baueZielHeatmap>;
  mass: HeatmapMass;
  setMass: (m: HeatmapMass) => void;
  spieler: TrainingZeile;
  aktZiel: { disziplinId: string; weg: number } | null;
  modus: PlayerTrainingMode;
  onZelle: (disziplinId: string, weg: number) => void;
  gesperrt: boolean;
  klassenBer: Bereich | null;
  bind: ReturnType<typeof useTip>["bind"];
}) {
  const kopf = (
    <div className="pk">
      <h2>
        <b>1</b>Ziel und Weg
      </h2>
      <small>
        {spieler.name} · {MASS_TITEL[mass]} ·{" "}
        {MODI.find((m) => m.id === modus)?.name}
      </small>
      <span className="sp" />
      <div className="seg" data-testid="training-heat-mass">
        {(["sp", "eignung", "luft"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={mass === m ? "an" : ""}
            onClick={() => setMass(m)}
            {...bind(
              m === "sp" ? (
                <>
                  <b>Standard.</b> Summe der Skillpunkte über alle drei
                  Attribute des Wegs bis Saisonende. Mit dieser Zahl rechnen
                  Vorschau und Kaderliste.
                </>
              ) : m === "eignung" ? (
                <>
                  Eignungszuwachs im Ziel bis Saisonende: Skillpunkte ×
                  Matrixgewicht (die Matrix wird nur gelesen).
                </>
              ) : (
                <>
                  Abstand des 60-%-Attributs zur individuellen Decke: zeigt, wo
                  langfristig Platz ist.
                </>
              ),
            )}
          >
            {m === "sp"
              ? "Skillpunkte"
              : m === "eignung"
                ? "Eignung"
                : "Luft bis Decke"}
          </button>
        ))}
      </div>
      {onFremd ? (
        <div className="seg">
          <button type="button" className="an">
            Mein Spieler
          </button>
          <button
            type="button"
            onClick={onFremd}
            data-testid="training-fremdes-team-knopf"
          >
            Fremdes Team
          </button>
        </div>
      ) : null}
    </div>
  );
  if (!heatmap) {
    return (
      <section className="pan" data-testid="training-heatmap">
        {kopf}
        <div className="nebelhin">
          <span>
            Für <b>{spieler.name}</b> fehlt der volle Attributbogen, deshalb
            gibt es keine Prognose.
          </span>
        </div>
      </section>
    );
  }
  const spanne = wertSpanne(heatmap, mass);
  const beste = besteZelle(heatmap, mass);
  const bestId = beste ? `${beste.disziplinId}|${beste.weg}` : "";
  const gewaehltId = aktZiel ? `${aktZiel.disziplinId}|${aktZiel.weg}` : "";
  const fm = (v: number) => (mass === "luft" ? zahl(v, 0) : pm(v));
  const bestZeile = beste
    ? heatmap.zeilen.find((z) => z.disziplinId === beste.disziplinId)
    : null;
  return (
    <section className="pan" data-testid="training-heatmap">
      {kopf}
      <div className="hm">
        {BEREICHE.map((b) => {
          const zeilen = heatmap.zeilen
            .filter((z) => z.bereich === b.id)
            .sort(
              (x, y) =>
                Math.max(...y.zellen.map((c) => zellenWert(c, mass))) -
                  Math.max(...x.zellen.map((c) => zellenWert(c, mass))) ||
                x.label.localeCompare(y.label, "de"),
            );
          let bestWert = -Infinity;
          let bestName = "";
          for (const z of zeilen)
            for (const c of z.zellen) {
              if (zellenWert(c, mass) > bestWert) {
                bestWert = zellenWert(c, mass);
                bestName = z.label;
              }
            }
          return (
            <div
              key={b.id}
              className={`band c-${b.id}`}
              data-testid={`training-heat-band-${b.id}`}
            >
              <div className="bk">
                <span className="ic">
                  <BereichIcon bereich={b.id} />
                </span>
                <h3>
                  {b.kurz}
                  <small>{b.name}</small>
                </h3>
                {klassenBer === b.id ? (
                  <span className="kf">Klassenfarbe</span>
                ) : null}
                {klassenBer &&
                BEREICHE.find((x) => x.id === klassenBer)?.gegen === b.id ? (
                  <span
                    className="kf"
                    style={{
                      background: "transparent",
                      color: "var(--leise)",
                      border: "1px solid var(--linie-2)",
                    }}
                  >
                    Gegenfarbe
                  </span>
                ) : null}
                <span className="sp" />
                <span className="best">
                  am meisten:{" "}
                  <b className="t">
                    {bestWert > -Infinity ? fm(bestWert) : "–"}
                  </b>{" "}
                  {bestName}
                </span>
              </div>
              <div className="sph">
                <span>Disziplin · Eignung · Liga</span>
                <span>Primärweg</span>
                <span>Nebenweg</span>
                <span>Nebenweg</span>
              </div>
              <div className="zln">
                {zeilen.map((z) => {
                  const art = z.vorliebe;
                  return (
                    <div
                      key={z.disziplinId}
                      className={`zl${art > 0 ? " lieb" : art < 0 ? " unlieb" : ""}`}
                    >
                      <span
                        className="dn"
                        {...(art !== 0
                          ? bind(
                              art > 0 ? (
                                <>
                                  <b>Lieblingsdisziplin</b> von {spieler.name}
                                  <br />
                                  Budget ×{zahl(z.vorliebeFaktor, 2)} · +
                                  {VORLIEBE_MORAL_LIEBLING} Moral
                                </>
                              ) : (
                                <>
                                  <b>Ungeliebte Disziplin</b> von {spieler.name}
                                  <br />
                                  Budget ×{zahl(z.vorliebeFaktor, 2)} · {MINUS}
                                  {Math.abs(VORLIEBE_MORAL_UNGELIEBT)} Moral
                                </>
                              ),
                            )
                          : {})}
                      >
                        <b>
                          {art !== 0 ? (
                            <em className={`vb ${art > 0 ? "l" : "u"}`}>
                              {art > 0 ? <Herz /> : <Daumen />}
                            </em>
                          ) : null}
                          <span className="dnn">{z.label}</span>
                          {art !== 0 ? (
                            <em className={`vx ${art > 0 ? "l" : "u"}`}>
                              ×{zahl(z.vorliebeFaktor, 2)}
                            </em>
                          ) : null}
                        </b>
                        <span>
                          <b className="t">{zahl(z.eignungHeute, 1)}</b>
                          {z.rangLiga != null ? (
                            <>
                              {" "}
                              · Rang {z.rangLiga}/{z.ligaGroesse}
                            </>
                          ) : null}
                        </span>
                      </span>
                      {z.zellen.map((c) => {
                        const wertC = zellenWert(c, mass);
                        const t =
                          spanne.max > spanne.min
                            ? Math.pow(
                                (wertC - spanne.min) /
                                  (spanne.max - spanne.min),
                                1.25,
                              )
                            : 0;
                        const id = `${c.disziplinId}|${c.weg}`;
                        const an = id === gewaehltId;
                        const best = id === bestId;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={gesperrt}
                            className={`hz${t > 0.62 && (b.id === "soc" || b.id === "spe") ? " hell" : ""}${t < 0.2 ? " kalt" : ""}${an ? " an" : ""}${best ? " best" : ""}`}
                            style={
                              {
                                "--t": (4 + t * 90).toFixed(1),
                              } as CSSProperties
                            }
                            onClick={() => onZelle(c.disziplinId, c.weg)}
                            data-testid="training-heat-zelle"
                            data-ziel={id}
                            data-bester={best ? "1" : undefined}
                            data-gewaehlt={an ? "1" : undefined}
                            aria-pressed={an}
                            {...bind(zellenTipp(c, z, z.eignungHeute, mass))}
                          >
                            <b className="t">{fm(wertC)}</b>
                            <span>{KURZ[c.hauptAttribut]} 60 %</span>
                            {best ? <em className="bm">★ Beste</em> : null}
                            {an ? <em className="gm">Gewählt</em> : null}
                            {c.deckeBremst ? <i className="dk">DECKE</i> : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="hmf">
        <span className="skala">
          <span>wenig</span>
          <span className="st">
            <i />
            <i className="s2" />
            <i className="s3" />
            <i className="s4" />
          </span>
          <span>
            viel {mass === "luft" ? "Luft" : mass === "sp" ? "SP" : "Zuwachs"}
          </span>
        </span>
        <span className="lg b">
          <i />
          beste Zelle:{" "}
          <b>
            {bestZeile?.label} {beste ? fm(zellenWert(beste, mass)) : ""}
          </b>
        </span>
        <span className="lg g">
          <i />
          gewählt
        </span>
        {heatmap.vorliebenAktiv ? (
          <>
            <span>
              <Herz /> Liebling ×{zahl(VORLIEBE_FAKTOR_LIEBLING, 2)}
            </span>
            <span>
              <Daumen /> ungeliebt ×{zahl(VORLIEBE_FAKTOR_UNGELIEBT, 2)}
            </span>
          </>
        ) : null}
        <span>
          <b
            style={{
              color: "var(--warn)",
              fontSize: "calc(var(--u)*.7)",
              letterSpacing: ".06em",
            }}
          >
            DECKE
          </b>{" "}
          bremst
        </span>
        <span style={{ flex: 1 }} />
        <span>
          Zahl:{" "}
          <b>
            {mass === "luft"
              ? "Punkte bis zur Decke"
              : mass === "sp"
                ? "Skillpunkte bis Saisonende"
                : "Eignung bis Saisonende"}
          </b>
        </span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Vorschau */

function Vorschau({
  zeile,
  gameState,
  heatmap,
  aktZiel,
  aktModus,
  aenderung,
  setze,
  onUebernehmen,
  onVerwerfen,
  gesperrt,
  anzahlAenderungen,
  bind,
}: {
  zeile: TrainingZeile;
  gameState: GameState;
  heatmap: ReturnType<typeof baueZielHeatmap>;
  aktZiel: { disziplinId: string; weg: number } | null;
  aktModus: PlayerTrainingMode;
  aenderung: boolean;
  setze: (patch: {
    ziel?: { disziplinId: string; weg: number };
    modus?: PlayerTrainingMode;
  }) => void;
  onUebernehmen: () => void;
  onVerwerfen: () => void;
  gesperrt: boolean;
  anzahlAenderungen: number;
  bind: ReturnType<typeof useTip>["bind"];
}) {
  const playerId = zeile.playerId;
  const fortschritt = useMemo(
    () => baueSaisonFortschritt(gameState, playerId),
    [gameState, playerId],
  );
  const belastung = useMemo(
    () => berechneBelastungsForecast({ gameState, playerId }),
    [gameState, playerId],
  );
  const zelle = useMemo(() => {
    if (!heatmap || !aktZiel) return null;
    return (
      heatmap.zeilen
        .find((z) => z.disziplinId === aktZiel.disziplinId)
        ?.zellen.find((c) => c.weg === aktZiel.weg) ?? null
    );
  }, [heatmap, aktZiel]);
  const kontext = useMemo(() => {
    const md = gameState.matchdayState?.matchdayId ?? null;
    return baueTrainingsZielKontext(
      gameState,
      md,
      md
        ? bestimmeAusfallSpielerFuerSpieltag(gameState, md)
        : new Set<string>(),
    );
  }, [gameState]);
  const schritt = useMemo(() => {
    if (!aktZiel) return null;
    const erg = prognostiziereTrainingAbRueckkehr({
      gameState,
      playerId,
      ziel: { disziplinId: aktZiel.disziplinId, weg: aktZiel.weg as 0 | 1 | 2 },
      modus: aktModus,
      kontext,
    });
    return erg && !erg.verletzt ? erg : null;
  }, [gameState, playerId, aktZiel, aktModus, kontext]);
  const planZiel = zeile.ziel
    ? { disziplinId: zeile.ziel.disziplinId, weg: zeile.ziel.weg }
    : null;
  const wirkung = useMemo(
    () =>
      baueWirkungVergleich({
        gameState,
        playerId,
        bisher: { ziel: planZiel, modus: zeile.modus },
        neu: { ziel: aktZiel, modus: aktModus },
        anzahl: 20,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      gameState,
      playerId,
      planZiel?.disziplinId,
      planZiel?.weg,
      zeile.modus,
      aktZiel?.disziplinId,
      aktZiel?.weg,
      aktModus,
    ],
  );
  const kf = klassenBereich(zeile.klasse);
  const art =
    zeile.vorlieben && aktZiel
      ? zeile.vorlieben.lieblinge.includes(aktZiel.disziplinId)
        ? 1
        : zeile.vorlieben.ungeliebt === aktZiel.disziplinId
          ? -1
          : 0
      : 0;
  const dMoral =
    art > 0 ? VORLIEBE_MORAL_LIEBLING : art < 0 ? VORLIEBE_MORAL_UNGELIEBT : 0;
  const zielBereich = aktZiel ? bereichVonDisziplin(aktZiel.disziplinId) : null;
  const wirkZeile =
    wirkung?.zeilen.find((d) => d.disziplinId === aktZiel?.disziplinId) ?? null;
  const maxFort = fortschritt
    ? Math.max(0, ...fortschritt.attribute.map((a) => a.delta))
    : 0;
  const bereichReihe: Bereich[] = ["pow", "spe", "men", "soc"];
  const fortschrittSortiert = fortschritt
    ? [...fortschritt.attribute].sort(
        (x, y) =>
          bereichReihe.indexOf(achseVonAttribut(x.attribute) as Bereich) -
          bereichReihe.indexOf(achseVonAttribut(y.attribute) as Bereich),
      )
    : [];
  const ruhtBis = heatmap?.ersterTrainingsSpieltag ?? null;
  const wunsch = zeile.wunsch ? wunschFolge(zeile, aktModus) : null;
  const bremse = schritt ? bremseKurz(schritt.transparenz) : null;
  const beschleuniger = schritt?.transparenz.beschleuniger.faktor ?? 1;
  const punkte = belastung?.stufen[aktModus]?.punkte.slice(0, 6) ?? [];
  const zoneKlasse = (w: number) =>
    w >= 80 ? 3 : w >= 50 ? 2 : w >= 25 ? 1 : 0;
  return (
    <section className="pan" data-testid="training-vorschau">
      <div className="pk">
        <h2>
          <b>2</b>Vorschau
        </h2>
        <small>bis Saisonende</small>
        <span className="sp" />
        <div className="seg" id="segmod" data-testid="training-modus-seg">
          {MODI.map((m) => (
            <button
              key={m.id}
              type="button"
              className={aktModus === m.id ? "an" : ""}
              disabled={gesperrt || zeile.verletzt}
              onClick={() => setze({ modus: m.id })}
              {...(zeile.wunsch === m.id
                ? bind(
                    <>
                      <b>Wunsch des Spielers</b>
                      <br />
                      Diese Intensität wünscht er sich.
                    </>,
                  )
                : {})}
            >
              {m.name}
              {zeile.wunsch === m.id ? <i className="wu" /> : null}
            </button>
          ))}
        </div>
      </div>
      <div className="vs">
        <div className={`sk c-${kf ?? "bal"}`}>
          <span className="po">
            {zeile.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zeile.portrait} alt="" />
            ) : null}
          </span>
          <div style={{ minWidth: 0 }}>
            <h3>{zeile.name}</h3>
            <div className="kl2">
              {zeile.klasse} <i>· {zeile.rasse}</i>
            </div>
            <div className="tr">{zeile.traits.join(" · ")}</div>
          </div>
          <div className="mo">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "calc(var(--u)*.3)",
              }}
            >
              <BcMoralGesicht wert={zeile.moral} groesse={22} />
              {dMoral !== 0 ? (
                <b
                  className={`t ${dMoral > 0 ? "plus" : "minus"}`}
                  style={{ fontSize: "calc(var(--u)*.95)" }}
                >
                  {dMoral > 0 ? "+" : MINUS}
                  {Math.abs(dMoral)}
                </b>
              ) : null}
            </span>
            <span>
              Moral · Form{" "}
              <b className="t" style={{ fontSize: "calc(var(--u)*.95)" }}>
                {zahl(zeile.form, 0)}
              </b>
            </span>
          </div>
        </div>
        {zeile.verletzt ? (
          <div className="ruht" data-testid="training-vorschau-ruht">
            <b>Nicht einsetzbar.</b> Training ruht, Ziel und Intensität gelten
            ab Spieltag {ruhtBis?.nummer ?? "—"}.{" "}
            {heatmap ? (
              <>
                Gerechnet: <b>{heatmap.trainings} statt {heatmap.trainings + heatmap.spieltageVerletzt}</b>{" "}
                Trainings, keine Trainingslast.
              </>
            ) : null}
          </div>
        ) : null}
        {zeile.vorlieben ? (
          <div className="kasten vor" data-testid="training-vorlieben-kasten">
            <h4>
              Trainingsvorlieben
              <span className="sp" />
              <em>neu je Saison</em>
            </h4>
            <div className="vch">
              {zeile.vorlieben.lieblinge.map((id) => (
                <div
                  key={id}
                  className={`vc c-${bereichVonDisziplin(id) ?? "bal"}${aktZiel?.disziplinId === id ? " akt" : ""}`}
                >
                  <b>
                    <Herz />
                    {label(id)}
                  </b>
                  <span>
                    Liebling ·{" "}
                    <i className="plus">×{zahl(VORLIEBE_FAKTOR_LIEBLING, 2)}</i>
                  </span>
                </div>
              ))}
              <div
                className={`vc u c-${bereichVonDisziplin(zeile.vorlieben.ungeliebt) ?? "bal"}${aktZiel?.disziplinId === zeile.vorlieben.ungeliebt ? " akt" : ""}`}
              >
                <b>
                  <Daumen />
                  {label(zeile.vorlieben.ungeliebt)}
                </b>
                <span>
                  ungeliebt ·{" "}
                  <i className="minus">×{zahl(VORLIEBE_FAKTOR_UNGELIEBT, 2)}</i>
                </span>
              </div>
            </div>
            <p className="vtx">
              {art > 0 ? (
                <>
                  <b>Trainiert seine Lieblingsdisziplin:</b> +
                  {Math.round((VORLIEBE_FAKTOR_LIEBLING - 1) * 100)} %
                  Trainingsbudget und{" "}
                  <b className="plus">+{VORLIEBE_MORAL_LIEBLING} Moral</b>,
                  solange {aktZiel ? label(aktZiel.disziplinId) : ""} das Ziel
                  ist.
                </>
              ) : art < 0 ? (
                <>
                  <b>Trainiert, was er nicht mag:</b> {MINUS}
                  {Math.round((1 - VORLIEBE_FAKTOR_UNGELIEBT) * 100)} %
                  Trainingsbudget und{" "}
                  <b className="minus">
                    {MINUS}
                    {Math.abs(VORLIEBE_MORAL_UNGELIEBT)} Moral
                  </b>
                  , solange {aktZiel ? label(aktZiel.disziplinId) : ""} das Ziel
                  ist.
                </>
              ) : (
                <>
                  {aktZiel ? label(aktZiel.disziplinId) : "Das Ziel"} ist ihm
                  gleich: kein Bonus, kein Abzug. Ein Herz in der Heatmap
                  brächte +{Math.round((VORLIEBE_FAKTOR_LIEBLING - 1) * 100)} %
                  Budget und +{VORLIEBE_MORAL_LIEBLING} Moral.
                </>
              )}
            </p>
          </div>
        ) : null}
        <div className="kasten" data-testid="training-fortschritt">
          <h4>
            Fortschritt diese Saison
            <span className="sp" />
            <em>
              bisher{" "}
              <b
                className={`t ${(fortschritt?.trainingSp ?? 0) > 0 ? "plus" : ""}`}
              >
                {pm(fortschritt?.trainingSp ?? 0, 1)} SP
              </b>
              {fortschritt?.spieltage
                ? ` · ST ${fortschritt.spieltage.von}–${fortschritt.spieltage.bis}`
                : " · noch kein Spieltag gebucht"}
            </em>
          </h4>
          <div className="fs">
            {fortschrittSortiert.map((a) => {
              const achse = achseVonAttribut(a.attribute);
              const top = fortschritt?.groessterFortschritt === a.attribute;
              return (
                <div
                  key={a.attribute}
                  className={`fa c-${achse}${a.delta > 0.005 ? "" : " nix"}${top ? " top" : ""}`}
                  data-testid="training-fortschritt-attribut"
                  {...bind(
                    <>
                      <b>{ATTRIBUT_LABEL[a.attribute]}</b>
                      <br />
                      {a.start != null ? (
                        <>
                          Saisonstart {zahl(a.start, 1)} → heute{" "}
                          <b>{zahl(a.jetzt, 1)}</b>
                        </>
                      ) : (
                        <>heute {zahl(a.jetzt, 1)}</>
                      )}
                      <br />
                      {a.delta > 0.005
                        ? `diese Saison ${pm(a.delta)}`
                        : "diese Saison unverändert"}
                      {top ? (
                        <>
                          <br />
                          <i>größter Fortschritt</i>
                        </>
                      ) : null}
                    </>,
                  )}
                >
                  <span>{KURZ[a.attribute]}</span>
                  <i>
                    <u
                      style={{
                        width: `${maxFort > 0 ? (Math.max(0, a.delta) / maxFort) * 100 : 0}%`,
                      }}
                    />
                  </i>
                  <b className="t">{a.delta > 0.005 ? pm(a.delta, 1) : "–"}</b>
                </div>
              );
            })}
          </div>
        </div>
        <div
          className={`kasten c-${zielBereich ?? "bal"}`}
          data-testid="training-gewaehlt"
        >
          <h4>
            Gewählt{aenderung ? " · offene Änderung" : ""}
            <span className="sp" />
            <em>
              {heatmap?.trainings ?? 0} Trainings ·{" "}
              {MODI.find((m) => m.id === aktModus)?.name} ·{" "}
              <b className="t plus">{zelle ? pm(zelle.sp) : "–"} SP</b>
            </em>
          </h4>
          {aktZiel && zelle ? (
            <>
              <div className="wahl">
                <span
                  className="bk"
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    height: "auto",
                  }}
                >
                  <span className="ic">
                    {zielBereich ? <BereichIcon bereich={zielBereich} /> : null}
                  </span>
                </span>
                <div className="zn">
                  <b>{label(aktZiel.disziplinId)}</b>
                  <span>
                    {zelle.art === "primaer" ? "Primärweg" : "Nebenweg"} über{" "}
                    <i>{ATTRIBUT_LABEL[zelle.hauptAttribut]}</i> · Eignung{" "}
                    <b className="t" style={{ color: "var(--creme)" }}>
                      {zahl(wirkZeile?.heute ?? null, 1)}
                    </b>
                    {wirkZeile ? (
                      <>
                        {" "}
                        → <b className="t plus">{zahl(wirkZeile.neu, 2)}</b>
                      </>
                    ) : null}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: "calc(var(--u)*.4)" }}>
                {zelle.attribute.map((a) => (
                  <div
                    key={a.attribute}
                    className={`ar c-${achseVonAttribut(a.attribute)}`}
                    {...bind(
                      <>
                        <b>{ATTRIBUT_LABEL[a.attribute]}</b>
                        <br />
                        heute {zahl(a.vorher, 1)} · Decke{" "}
                        {a.deckel != null ? zahl(a.deckel, 0) : "?"} ·
                        Matrixgewicht {a.matrixGewicht}
                        {a.bremst ? (
                          <>
                            <br />
                            <i>Die Decke bremst diesen Anteil.</i>
                          </>
                        ) : null}
                      </>,
                    )}
                  >
                    <span className="ab">{KURZ[a.attribute]}</span>
                    <span className="an2 t">
                      {Math.round(a.anteil * 100)} %
                    </span>
                    <span className="ba">
                      <i style={{ width: `${Math.min(100, a.vorher)}%` }} />
                      <u
                        style={{
                          left: `${Math.min(100, a.vorher)}%`,
                          width: `${Math.max(0.6, a.zuwachs)}%`,
                        }}
                      />
                      {a.deckel != null ? (
                        <s style={{ left: `${Math.min(100, a.deckel)}%` }} />
                      ) : null}
                    </span>
                    <span className="gw t plus">{pm(a.zuwachs)}</span>
                  </div>
                ))}
              </div>
              <div className="fk">
                <span>
                  Satz {zahl(getTrainingSetpointsJeSpieltag(aktModus), 3)} je
                  Spieltag
                </span>
                {art > 0 ? (
                  <span className="l">
                    Liebling ×{zahl(VORLIEBE_FAKTOR_LIEBLING, 2)}
                  </span>
                ) : null}
                {art < 0 ? (
                  <span className="u">
                    ungeliebt ×{zahl(VORLIEBE_FAKTOR_UNGELIEBT, 2)}
                  </span>
                ) : null}
                {beschleuniger > 1.005 ? (
                  <span className="g">Potenzial ×{zahl(beschleuniger, 2)}</span>
                ) : null}
                {zelle.deckeBremst ? (
                  <span
                    className="s"
                    {...bind(
                      <>
                        {bremse
                          ? bremse.attribute.map(bremsGrundText).join(". ")
                          : "Die Decke bremst diesen Weg."}
                      </>,
                    )}
                  >
                    Decke bremst{" "}
                    {zelle.attribute
                      .filter((a) => a.bremst)
                      .map((a) => KURZ[a.attribute])
                      .join(", ")}
                  </span>
                ) : (
                  <span className="g">keine Decke im Weg</span>
                )}
                {wunsch ? (
                  <span
                    className={wunsch.punkte < 0 ? "s" : "g"}
                    data-testid="training-vorschau-wunsch"
                  >
                    Wunsch {MODI.find((m) => m.id === zeile.wunsch)?.name}:{" "}
                    {pm(wunsch.punkte, 1)} Moral
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="vtx">Wähle in der Heatmap eine Zelle.</p>
          )}
        </div>
        <div className="kasten" data-testid="training-vorschau-top5">
          <h4>
            Wo das ankommt · Top 6
            <span className="sp" />
            <em>Eignung bis Saisonende</em>
          </h4>
          {wirkung && wirkung.zeilen.length > 0 ? (
            <div className="an6">
              {wirkung.zeilen.slice(0, 6).map((d) => (
                <div
                  key={d.disziplinId}
                  className={`a6 c-${bereichVonDisziplin(d.disziplinId) ?? "bal"}${d.istZiel ? " zielz" : ""}`}
                  data-testid="training-top5-zeile"
                >
                  <i />
                  <span>{label(d.disziplinId)}</span>
                  <em className="t">{zahl(d.heute, 1)}</em>
                  <b className={`t ${d.deltaNeu > 0 ? "plus" : "null"}`}>
                    {pm(d.deltaNeu)}
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <p className="vtx">
              Keine Prognose, es fehlt der volle Attributbogen.
            </p>
          )}
          {wirkung?.eignungsModus === "schaetzung" ? (
            <p className="vtx">Geschätzt, fremde Kader sind verdeckt.</p>
          ) : null}
        </div>
        <div className="kasten" data-testid="training-vorschau-belastung">
          <h4>
            Belastung · nächste 6 Spieltage
            <span className="sp" />
            <em>heute {zahl(zeile.fatigue, 0)}</em>
          </h4>
          {punkte.length > 0 ? (
            <>
              <div className="bf">
                {punkte.map((p) => (
                  <div
                    key={p.matchdayId}
                    className={`s z${zoneKlasse(p.wert)}`}
                    {...bind(
                      <>
                        <b>Spieltag {p.nummer}</b>
                        <br />
                        Belastung {zahl(p.wert, 0)}
                        {p.ausfall ? " · Training ruht" : ""}
                      </>,
                    )}
                  >
                    <b className="t">{zahl(p.wert, 0)}</b>
                    <i style={{ height: `${Math.max(4, p.wert * 0.62)}%` }} />
                  </div>
                ))}
              </div>
              <div className="bfl">
                {punkte.map((p) => (
                  <span
                    key={p.matchdayId}
                    className={p.wert >= RISIKO_SCHWELLE ? "e" : ""}
                  >
                    ST {p.nummer}
                    {p.ausfall ? " ruht" : ""}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="vtx">Keine Prognose.</p>
          )}
        </div>
      </div>
      <div className="kn-wrap">
        <div className="kn">
          <button
            type="button"
            disabled={anzahlAenderungen === 0}
            onClick={onVerwerfen}
            data-testid="training-plan-verwerfen"
          >
            Verwerfen
          </button>
          <button
            type="button"
            className={`haupt${anzahlAenderungen > 0 && !gesperrt ? "" : " aus"}`}
            disabled={gesperrt || anzahlAenderungen === 0}
            onClick={onUebernehmen}
            data-testid="training-plan-uebernehmen"
          >
            {anzahlAenderungen > 0
              ? `Plan übernehmen (${anzahlAenderungen}) · ab Spieltag ${ruhtBis?.nummer ?? "—"}`
              : "Plan ist aktuell"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Fremdes Team unter Scouting-Nebel */

type FremdSort = { schluessel: "name" | "stufe"; richtung: SortRichtung };

function FremdesTeamTafel({
  gameState,
  viewerTeamId,
  fremdTeamId,
  setFremdTeamId,
  onZurueck,
}: {
  gameState: GameState;
  viewerTeamId: string;
  fremdTeamId: string | null;
  setFremdTeamId: (id: string) => void;
  onZurueck: () => void;
}) {
  const [sort, setSort] = useState<FremdSort>({
    schluessel: "stufe",
    richtung: "ab",
  });
  const teams = useMemo(
    () =>
      gameState.teams
        .filter((t) => t.teamId !== viewerTeamId)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [gameState.teams, viewerTeamId],
  );
  const team = teams.find((t) => t.teamId === fremdTeamId) ?? teams[0] ?? null;
  const nebelAus = isScoutingNebelAus(gameState);
  const zeilen = useMemo(() => {
    if (!team) return [];
    const spieler = new Map(gameState.players.map((p) => [p.id, p] as const));
    return gameState.rosters
      .filter((r) => r.teamId === team.teamId)
      .map((r) => spieler.get(r.playerId))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => {
        const stufe: NebelStufe = nebelStufeFuer(gameState, viewerTeamId, p.id);
        const sicht = vorliebenSichtFuerStufe(
          leiteTrainingsVorliebenAb(p, gameState.season?.id ?? ""),
          stufe,
        );
        let beste: string | null = null;
        if (stufe >= 2) {
          let bestWert = -Infinity;
          for (const [id, w] of Object.entries(p.disciplineRatings ?? {})) {
            if (
              typeof w === "number" &&
              w > bestWert &&
              (officialDisciplineWeightLabels as Record<string, string>)[id]
            ) {
              bestWert = w;
              beste = id;
            }
          }
        }
        return { p, stufe, sicht, beste };
      });
  }, [gameState, team, viewerTeamId]);
  const sortiert =
    sort.schluessel === "stufe"
      ? sortiereNachNebelStufe(
          zeilen,
          (z) => z.stufe,
          (z) => z.p.name,
          sort.richtung,
        )
      : sortiereZeilen(
          zeilen,
          (z) => z.p.name.toLocaleLowerCase("de"),
          sort.richtung,
          (z) => z.p.name,
        );
  const kopf = (schluessel: FremdSort["schluessel"], text: string) => (
    <button
      type="button"
      className={sort.schluessel === schluessel ? "an" : ""}
      onClick={() =>
        setSort((alt) =>
          naechsteSortierung(
            alt,
            schluessel,
            schluessel === "name" ? "auf" : "ab",
          ),
        )
      }
    >
      {text}
      {sort.schluessel === schluessel
        ? sort.richtung === "ab"
          ? " ▾"
          : " ▴"
        : ""}
    </button>
  );
  const zelle = (id: string | null, art: 1 | -1, stufe: NebelStufe) => {
    if (!id) {
      return (
        <span className="fz q">
          <b>
            <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17v.01" />
            </svg>
            {stufe === 0 ? "unbekannt" : "verdeckt"}
          </b>
          <span>{art > 0 ? "Lieblingsdisziplin" : "ungeliebte Disziplin"}</span>
        </span>
      );
    }
    const bereich = bereichVonDisziplin(id);
    return (
      <span className={`fz c-${bereich ?? "bal"}`}>
        <b>
          {art > 0 ? <Herz /> : <Daumen />}
          {label(id)}
        </b>
        <span>
          {bereich?.toUpperCase()} · trainiert ×
          {zahl(
            art > 0 ? VORLIEBE_FAKTOR_LIEBLING : VORLIEBE_FAKTOR_UNGELIEBT,
            2,
          )}
        </span>
      </span>
    );
  };
  return (
    <section className="pan" data-testid="training-fremdes-team">
      <div className="pk">
        <h2>{team?.name ?? "Fremdes Team"}</h2>
        <small>fremdes Team · Vorlieben unter Scouting-Nebel</small>
        <span className="sp" />
        <select
          className="tr2-select"
          value={team?.teamId ?? ""}
          onChange={(e) => setFremdTeamId(e.target.value)}
          aria-label="Fremdes Team wählen"
          data-testid="training-fremdes-team-wahl"
        >
          {teams.map((t) => (
            <option key={t.teamId} value={t.teamId}>
              {t.name}
            </option>
          ))}
        </select>
        <div className="seg">
          <button type="button" onClick={onZurueck}>
            Mein Spieler
          </button>
          <button type="button" className="an">
            Fremdes Team
          </button>
        </div>
      </div>
      <div className="fh">
        <span />
        {kopf("name", "Spieler")}
        {kopf("stufe", "Scouting")}
        <span>Liebling 1</span>
        <span>Liebling 2</span>
        <span>Ungeliebt</span>
        <span className="r">Beste Disziplin</span>
      </div>
      <div className="fl">
        {sortiert.map(({ p, stufe, sicht, beste }) => {
          const kf = klassenBereich(p.className);
          const bb = beste ? bereichVonDisziplin(beste) : null;
          return (
            <div
              key={p.id}
              className={`fr c-${kf ?? "bal"}`}
              data-testid="training-fremd-zeile"
              data-stufe={stufe}
            >
              <span className="po">
                {(p.portraitUrl ?? p.portraitPath) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(p.portraitUrl ?? p.portraitPath) as string}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
              </span>
              <span className="nm">
                <b>{p.name}</b>
                <span>{p.className}</span>
              </span>
              <span>
                <span className={`stufe s${stufe}`}>
                  {NEBEL_STUFEN[stufe]!.name}
                </span>
              </span>
              {zelle(sicht.lieblinge[0], 1, stufe)}
              {zelle(sicht.lieblinge[1], 1, stufe)}
              {zelle(sicht.ungeliebt, -1, stufe)}
              <span className={`bd c-${bb ?? "bal"}`}>
                <b>{beste ? label(beste) : "verdeckt"}</b>
              </span>
            </div>
          );
        })}
      </div>
      <div className="hmf">
        <span>
          <b>unbekannt:</b> nichts
        </span>
        <span>
          <b>beobachtet:</b> eine Lieblingsdisziplin
        </span>
        <span>
          <b>gescoutet:</b> alle drei
        </span>
        <span style={{ flex: 1 }} />
        <span>
          {nebelAus
            ? "Scouting-Nebel ist ausgeschaltet: alles sichtbar."
            : "Sortiert wird nach Stufe, dann Name – nie nach verdecktem Inhalt."}
        </span>
      </div>
    </section>
  );
}

function RegelInZahlen() {
  const lieb = Math.round((VORLIEBE_FAKTOR_LIEBLING - 1) * 100);
  const unlieb = Math.round((1 - VORLIEBE_FAKTOR_UNGELIEBT) * 100);
  return (
    <section className="pan" data-testid="training-vorlieben-regel">
      <div className="pk">
        <h2>Die Regel in Zahlen</h2>
        <small>Trainingsvorlieben</small>
      </div>
      <div className="vs">
        <div className="kasten vor">
          <h4>
            <Herz /> Zwei Lieblingsdisziplinen
          </h4>
          <p className="vtx" style={{ margin: 0 }}>
            Ist eine davon das Trainingsziel:{" "}
            <b className="plus">+{lieb} % Trainingsbudget</b> und{" "}
            <b className="plus">+{VORLIEBE_MORAL_LIEBLING} Moral</b>, solange
            sie Ziel bleibt.
          </p>
        </div>
        <div
          className="kasten"
          style={{ borderColor: "rgba(157,140,255,.45)" }}
        >
          <h4>
            <Daumen /> Eine ungeliebte Disziplin
          </h4>
          <p className="vtx" style={{ margin: 0 }}>
            Ist sie das Trainingsziel:{" "}
            <b className="minus">
              {MINUS}
              {unlieb} % Trainingsbudget
            </b>{" "}
            und{" "}
            <b className="minus">
              {MINUS}
              {Math.abs(VORLIEBE_MORAL_UNGELIEBT)} Moral
            </b>
            , solange sie Ziel bleibt.
          </p>
        </div>
        <div className="kasten">
          <h4>Warum 15 und 20</h4>
          <p className="vtx" style={{ margin: 0 }}>
            Dieselben Faktoren wie bei der Attribut-Affinität: Signatur ×
            {zahl(VORLIEBE_FAKTOR_LIEBLING, 2)}, schwach ×
            {zahl(VORLIEBE_FAKTOR_UNGELIEBT, 2)}. Damit die Liga insgesamt nicht
            schneller wächst, ist das Grundtempo des Trainings leicht angepasst:
            wer seinen Liebling trainiert, liegt darüber, wer etwas anderes
            trainiert, leicht darunter.
          </p>
        </div>
        <div className="kasten">
          <h4>Wie gewürfelt wird</h4>
          <p className="vtx" style={{ margin: 0 }}>
            Je Spieler und Saison neu gewürfelt, <b>stark zufällig</b>; innerhalb
            einer Saison fest, für Mensch und KI gleich. Leichte Tendenz: Lieblinge
            eher in der Klassenfarbe, die ungeliebte eher in der Gegenfarbe.
          </p>
        </div>
        <div className="kasten">
          <h4>Was sich nicht ändert</h4>
          <p className="vtx" style={{ margin: 0 }}>
            Die Matrix, die Leistungs-Hälfte der Entwicklung, die Wertung im
            Spiel. Die Vorliebe wirkt <b>nur</b> auf das Trainingsbudget und die
            Moral – und nur, wenn die Disziplin das Ziel ist.
          </p>
        </div>
        <div className="kasten">
          <h4>Sichtbarkeit</h4>
          <p className="vtx" style={{ margin: 0 }}>
            Eigenes Team: immer. Fremde: nach Scouting-Stufe (unbekannt nichts,
            beobachtet eine Lieblingsdisziplin, gescoutet alle drei). Eine
            Einstellung schaltet den Nebel ganz ab.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Plan-Ansicht */

export default function PlanR2({
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
  const [mass, setMass] = useState<HeatmapMass>("sp");
  const [fremd, setFremd] = useState(false);
  const [fremdTeamId, setFremdTeamId] = useState<string | null>(null);
  const { bind, box } = useTip();
  const zeile =
    zeilen.find((z) => z.playerId === gewaehlt) ?? zeilen[0] ?? null;
  const wahl = zeile ? (entwurf[zeile.playerId] ?? {}) : {};
  const aktZiel =
    wahl.ziel ??
    (zeile?.ziel
      ? { disziplinId: zeile.ziel.disziplinId, weg: zeile.ziel.weg }
      : null);
  const aktModus = wahl.modus ?? zeile?.modus ?? "mittel";
  const playerId = zeile?.playerId ?? null;
  const heatmap = useMemo(
    () =>
      playerId
        ? baueZielHeatmap({ gameState, playerId, modus: aktModus })
        : null,
    [gameState, playerId, aktModus],
  );
  // SP der Kaderliste: dieselbe Funktion wie die Heatmap; nur wer eine offene Aenderung hat, wird neu gerechnet.
  const spJeSpieler = useMemo(() => {
    const karte = new Map<string, number>();
    for (const z of zeilen) {
      const e = entwurf[z.playerId];
      if (!e || (!e.ziel && !e.modus)) {
        karte.set(z.playerId, z.sp);
        continue;
      }
      const ziel =
        e.ziel ??
        (z.ziel ? { disziplinId: z.ziel.disziplinId, weg: z.ziel.weg } : null);
      const spieler = gameState.players.find((p) => p.id === z.playerId);
      karte.set(
        z.playerId,
        ziel && spieler
          ? spBisSaisonende({
              gameState,
              player: spieler,
              ziel: {
                disziplinId: ziel.disziplinId,
                weg: Math.min(2, Math.max(0, ziel.weg)) as 0 | 1 | 2,
              },
              modus: e.modus ?? z.modus,
            })
          : 0,
      );
    }
    return karte;
  }, [zeilen, entwurf, gameState]);
  const anzahlAenderungen = Object.values(entwurf).filter(
    (e) => e.ziel || e.modus,
  ).length;
  // Offen = Wunsch, der auch mit den bereits gesetzten Entwurfs-Aenderungen noch nicht erfuellt ist.
  const offeneWuensche = Object.keys(wuenscheErfuellen(zeilen, entwurf)).length;
  if (!zeile)
    return <div className="te-tafel te-leer">Keine Spieler im Kader.</div>;

  const setze = (patch: {
    ziel?: { disziplinId: string; weg: number };
    modus?: PlayerTrainingMode;
  }) =>
    setEntwurf((alt) => {
      const neu = { ...(alt[zeile.playerId] ?? {}), ...patch };
      if (neu.ziel && zeile.ziel && zielGleich(neu.ziel, zeile.ziel))
        delete neu.ziel;
      if (neu.modus && neu.modus === zeile.modus) delete neu.modus;
      const rest = { ...alt };
      if (neu.ziel || neu.modus) rest[zeile.playerId] = neu;
      else delete rest[zeile.playerId];
      return rest;
    });
  const aenderung =
    !zielGleich(
      aktZiel,
      zeile.ziel
        ? { disziplinId: zeile.ziel.disziplinId, weg: zeile.ziel.weg }
        : null,
    ) || aktModus !== zeile.modus;
  const vorliebenAktiv = zeilen.some((z) => z.vorlieben != null);
  return (
    <div className="tr2 tr2-plan" data-testid="training-plan">
      <Kaderliste
        zeilen={zeilen}
        spJeSpieler={spJeSpieler}
        gewaehlt={zeile.playerId}
        onWahl={onWahl}
        entwurf={entwurf}
        bind={bind}
        vorliebenAktiv={vorliebenAktiv}
        gesperrt={gesperrt}
        offeneWuensche={offeneWuensche}
        onWuensche={() =>
          setEntwurf((alt) => {
            const neu = { ...alt };
            for (const [id, modus] of Object.entries(
              wuenscheErfuellen(zeilen, alt),
            )) {
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
      />
      {fremd ? (
        <FremdesTeamTafel
          gameState={gameState}
          viewerTeamId={teamId}
          fremdTeamId={fremdTeamId}
          setFremdTeamId={setFremdTeamId}
          onZurueck={() => setFremd(false)}
        />
      ) : (
        <HeatmapTafel
          onFremd={vorliebenAktiv ? () => setFremd(true) : undefined}
          heatmap={heatmap}
          mass={mass}
          setMass={setMass}
          spieler={zeile}
          aktZiel={aktZiel}
          modus={aktModus}
          onZelle={(disziplinId, weg) => setze({ ziel: { disziplinId, weg } })}
          gesperrt={gesperrt}
          klassenBer={klassenBereich(zeile.klasse)}
          bind={bind}
        />
      )}
      {fremd ? (
        <RegelInZahlen />
      ) : (
        <Vorschau
          zeile={zeile}
          gameState={gameState}
          heatmap={heatmap}
          aktZiel={aktZiel}
          aktModus={aktModus}
          aenderung={aenderung}
          setze={setze}
          onUebernehmen={onUebernehmen}
          onVerwerfen={() => setEntwurf(() => ({}))}
          gesperrt={gesperrt}
          anzahlAenderungen={anzahlAenderungen}
          bind={bind}
        />
      )}
      {box}
    </div>
  );
}
