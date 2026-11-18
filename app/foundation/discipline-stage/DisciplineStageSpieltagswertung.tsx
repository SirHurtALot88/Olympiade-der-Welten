"use client";

// =====================================================================================
// Spieltagswertung (neu, 18.11.) — eine Zeile je Team, Aufschlüsselung im Blatt rechts.
// =====================================================================================
//
// Vorlage: public/mockups/arena-spieltag-modern-18-11.html, Screen 5 (?sc=wertung).
// Erklärung: docs/design/arena-spieltag-modern-18-11.md Abschnitt 3 (Spalten und Feldzuordnung).
//
// Ersetzt die Anzeige von `DisciplineStageMatchdayPanel` in der Arena. Das alte Panel bleibt als Quelle der
// Typen und der getesteten Rang-Helfer bestehen (Rang je Tag, Saison-Rang-Spalte).
//
// Rein lesend: Zeilen, Filter und Sortierung stehen in `spieltagswertung-zeilen.ts`; hier wird nur gezeichnet.

import { useMemo, useState } from "react";

import "./spieltagswertung-modern.css";
import {
  beschreibeArenaAusfallGrund,
  type DisciplineStageMatchdayPanelProps,
} from "@/app/foundation/discipline-stage/DisciplineStageMatchdayPanel";
import {
  baueWertungsZeilen,
  beschreibeWertungsErgebnis,
  filtereWertungsZeilen,
  gruppiereNachLiga,
  hatLigaTrennung,
  sortiereWertungsZeilen,
  startFilter,
  wertungsMarke,
  type WertungsFilter,
  type WertungsSeitenWerte,
  type WertungsSortierung,
  type WertungsZeile,
  findeEigeneGruppe,
} from "@/app/foundation/discipline-stage/spieltagswertung-zeilen";

export type DisciplineStageSpieltagswertungProps = Pick<
  DisciplineStageMatchdayPanelProps,
  | "teamResults"
  | "standings"
  | "d1"
  | "d2"
  | "d1Revealed"
  | "d2Revealed"
  | "teamMetaById"
  | "ownTeamId"
  | "onOpenTeam"
  | "onHoverTeam"
  | "mutatorByTeam"
  | "playersByTeam"
  | "modifiersByTeam"
> & {
  /** Liga je Team (nur gesetzt, wenn der Spielstand eine Ligatrennung hat). */
  leagueByTeam?: Map<string, "liga1" | "liga2"> | null;
  /** Name des Menschen je menschlich gesteuertem Team. */
  humanLabelByTeam?: Map<string, string> | null;
  /** Wird von der Arena weitergereicht; die neue Wertung braucht sie nicht. */
  modifierBaseByTeam?: DisciplineStageMatchdayPanelProps["modifierBaseByTeam"];
  injuryMarksByTeam?: DisciplineStageMatchdayPanelProps["injuryMarksByTeam"];
};

/** Zahl mit Komma, eine Nachkommastelle (Mockup-Schreibweise). */
function de(wert: number, nachkomma = 1): string {
  return wert.toFixed(nachkomma).replace(".", ",");
}
/** Zahl mit Vorzeichen und echtem Minus; `±0` bei null. */
function vz(wert: number): string {
  if (Math.abs(wert) < 0.05) return "±0";
  return `${wert > 0 ? "+" : "−"}${de(Math.abs(wert))}`;
}
function ton(wert: number): string {
  return Math.abs(wert) < 0.05 ? "null" : wert > 0 ? "plus" : "minus";
}
function punkteText(wert: number | null): string {
  return wert == null ? "–" : de(wert);
}

function Icon({ name }: { name: "ok" | "schloss" }) {
  return (
    <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
      {name === "ok" ? (
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      ) : (
        <>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      )}
    </svg>
  );
}

function Wappen({ zeile }: { zeile: WertungsZeile }) {
  // eslint-disable-next-line @next/next/no-img-element
  return zeile.logoUrl ? <img src={zeile.logoUrl} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <img alt="" />;
}

function Bewegung({ wert }: { wert: number | null }) {
  if (wert == null) return null;
  const klasse = wert > 0 ? "auf" : wert < 0 ? "ab" : "gl";
  return <span className={`bw ${klasse}`}>{wert > 0 ? `▲${wert}` : wert < 0 ? `▼${-wert}` : "="}</span>;
}

function Menschenmarke({ zeile }: { zeile: WertungsZeile }) {
  if (zeile.istEigen) return <span className="du">Du</span>;
  return zeile.mensch ? <span className="mg">{zeile.mensch}</span> : null;
}

/** Zelle einer Disziplin in der Tabelle: Marke, Endstand bzw. Platz, Punkte. */
function DisziplinZelle({ seite, kurz = false }: { seite: WertungsSeitenWerte; kurz?: boolean }) {
  if (!seite.aufgedeckt) {
    return (
      <span className="dz" title="Erst nach dieser Disziplin — kein Spoiler">
        <Icon name="schloss" />
      </span>
    );
  }
  const marke = wertungsMarke(seite.ergebnis);
  const e = seite.ergebnis;
  if (kurz) {
    return (
      <span className="dz">
        {marke ? <span className={`pl ${marke.ton}`}>{marke.text}</span> : null}
        <em className={`t${seite.punkte ? "" : " o"}`}>{punkteText(seite.punkte)}</em>
      </span>
    );
  }
  return (
    <span className="dz">
      {marke ? <span className={`pl ${marke.ton}`}>{marke.text}</span> : null}
      <span className="t">
        {e?.art === "duell" ? `${de(e.eigen, 0)} : ${de(e.gegner, 0)}` : e?.art === "gruppe" && e.wert != null ? de(e.wert, 0) : ""}
      </span>
      <em className={`t${seite.punkte ? "" : " o"}`}>{punkteText(seite.punkte)}</em>
    </span>
  );
}

function SeitenBlock({
  titel,
  seite,
  zeile,
  nameVon,
}: {
  titel: string;
  seite: WertungsSeitenWerte;
  zeile: WertungsZeile;
  nameVon: (teamId: string) => string | null;
}) {
  if (!seite.aufgedeckt) {
    return (
      <div className="bl">
        <div className="bh">
          <b>{titel}</b>
          <small>Noch nicht gespielt — wird erst mit dem Abpfiff aufgedeckt.</small>
          <strong className="o">
            <Icon name="schloss" />
          </strong>
        </div>
      </div>
    );
  }
  const wort = beschreibeWertungsErgebnis(seite.ergebnis, nameVon);
  const hatCaptain = seite.captain != null;
  return (
    <div className="bl" data-testid={`spieltagswertung-blatt-${zeile.teamId}-${titel}`}>
      <div className="bh">
        <b>{titel}</b>
        <small title={seite.ausfallGrund ? `PPS-Wertung — ${beschreibeArenaAusfallGrund(seite.ausfallGrund)}` : undefined}>
          {seite.ausfallGrund ? "PPS-Wertung (Arena ausgefallen)" : wort ?? ""}
        </small>
        <strong className={`t${seite.punkte ? "" : " o"}`}>{seite.punkte ? `+${de(seite.punkte)}` : seite.punkte === 0 ? "0" : "–"} Pkt</strong>
      </div>
      <div className="kette">
        <div>
          <small>Formkarte{seite.formLabel ? ` ${seite.formLabel}` : ""}</small>
          <b className={`t ${seite.formLabel ? ton(seite.form ?? 0) : "null"}`}>{seite.formLabel ? vz(seite.form ?? 0) : "keine"}</b>
          {seite.formLabel ? <i>Score</i> : null}
        </div>
        <div>
          <small>Captain{seite.captainName ? ` ${seite.captainName}` : ""}</small>
          <b className={`t ${hatCaptain ? ton(seite.captain ?? 0) : "null"}`}>{hatCaptain ? vz(seite.captain ?? 0) : "nicht gesetzt"}</b>
          {hatCaptain ? <i>Score</i> : null}
        </div>
        <div>
          <small>Mutator-Bonus</small>
          <b className={`t${seite.mutator ? "" : " null"}`} style={seite.mutator ? { color: "var(--drei)" } : undefined}>
            {seite.mutator ? `◆ +${de(seite.mutator)}` : "keiner"}
          </b>
          {seite.mutator ? <i>Pkt</i> : null}
        </div>
      </div>
      <div className="dsp">
        {seite.spieler.length === 0 ? (
          <div className="leer">Keine Spielerliste in der Vorschau.</div>
        ) : (
          seite.spieler.map((sp) => (
            <div key={sp.playerId}>
              {sp.portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sp.portraitUrl} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              ) : (
                <span />
              )}
              <b>
                {sp.name}
                {sp.isCaptain ? <small>C</small> : null}
              </b>
              {sp.mutatorPp ? <span className="mut">◆ +{de(sp.mutatorPp)}</span> : <span />}
              <span className="ppb t">{sp.pp != null ? de(sp.pp) : "–"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Blatt({
  zeile,
  d1Name,
  d2Name,
  d1Revealed,
  d2Revealed,
  nameVon,
}: {
  zeile: WertungsZeile;
  d1Name: string;
  d2Name: string;
  d1Revealed: boolean;
  d2Revealed: boolean;
  nameVon: (teamId: string) => string | null;
}) {
  const alles = d1Revealed && d2Revealed;
  return (
    <section className="pan det" data-testid="spieltagswertung-blatt">
      <div className="dk">
        <Wappen zeile={zeile} />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: "calc(0.3 * var(--u))" }}>
            {zeile.istEigen ? <span className="du">Dein Team</span> : null}
            {zeile.mensch && !zeile.istEigen ? <span className="mg">{zeile.mensch}</span> : null}
          </div>
          <b>{zeile.name}</b>
          <small>
            {zeile.vorRang != null ? `Saison ${zeile.vorRang}.` : "Saison –"}
            {alles && zeile.nachRang != null ? (
              <>
                {" → "}
                {zeile.nachRang}. <Bewegung wert={zeile.bewegung} />
              </>
            ) : null}
            {alles && zeile.vorPunkte != null && zeile.nachPunkte != null
              ? ` · ${de(zeile.vorPunkte)} → ${de(zeile.nachPunkte)} Pkt`
              : ""}
          </small>
        </div>
        <div>
          <strong className="t">{alles ? de(zeile.gesamt) : "–"}</strong>
          <small>Gesamt heute</small>
        </div>
      </div>
      <SeitenBlock titel={d1Name} seite={zeile.d1} zeile={zeile} nameVon={nameVon} />
      <SeitenBlock titel={d2Name} seite={zeile.d2} zeile={zeile} nameVon={nameVon} />
      <div className="dsum">
        <div>
          <span>{d1Name}</span>
          <strong className="t">{zeile.d1.aufgedeckt ? punkteText(zeile.d1.punkte) : "–"}</strong>
        </div>
        <div>
          <span>+ {d2Name}</span>
          <strong className="t">{zeile.d2.aufgedeckt ? punkteText(zeile.d2.punkte) : "–"}</strong>
        </div>
        <div>
          <span>+ Mutator ◆</span>
          <strong className="t" style={{ color: zeile.mutator ? "var(--drei)" : "var(--stumm)" }}>
            {alles ? de(zeile.mutator) : "–"}
          </strong>
        </div>
        <div className="g">
          <span>= Gesamt</span>
          <strong className="t">{alles ? de(zeile.gesamt) : "–"}</strong>
        </div>
      </div>
    </section>
  );
}

const FILTER_NAMEN: Array<[WertungsFilter, string]> = [
  ["beide", "Beide Ligen"],
  ["liga2", "Liga 2"],
  ["liga1", "Liga 1"],
  ["alle", "Alle Teams"],
  ["gruppe", "Meine Gruppe"],
  ["mensch", "Menschen"],
];

export default function DisciplineStageSpieltagswertung(props: DisciplineStageSpieltagswertungProps) {
  const { d1, d2, d1Revealed, d2Revealed, ownTeamId, onHoverTeam } = props;
  const alleZeilen = useMemo(
    () =>
      baueWertungsZeilen({
        teamResults: props.teamResults,
        standings: props.standings,
        d1,
        d2,
        d1Revealed,
        d2Revealed,
        teamMetaById: props.teamMetaById,
        ownTeamId,
        mutatorByTeam: props.mutatorByTeam,
        playersByTeam: props.playersByTeam,
        modifiersByTeam: props.modifiersByTeam,
        leagueByTeam: props.leagueByTeam,
        humanLabelByTeam: props.humanLabelByTeam,
      }),
    [
      props.teamResults,
      props.standings,
      d1,
      d2,
      d1Revealed,
      d2Revealed,
      props.teamMetaById,
      ownTeamId,
      props.mutatorByTeam,
      props.playersByTeam,
      props.modifiersByTeam,
      props.leagueByTeam,
      props.humanLabelByTeam,
    ],
  );

  const [filterWahl, setFilterWahl] = useState<WertungsFilter | null>(null);
  const [sortierung, setSortierung] = useState<WertungsSortierung>("ges");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const mitLiga = hatLigaTrennung(alleZeilen);
  const gruppeDa = findeEigeneGruppe(alleZeilen, ownTeamId) != null;
  const hatMenschen = alleZeilen.some((z) => z.mensch != null);
  const filter = filterWahl ?? startFilter(alleZeilen);
  const zeilen = useMemo(
    () => sortiereWertungsZeilen(filtereWertungsZeilen(alleZeilen, filter, ownTeamId), sortierung),
    [alleZeilen, filter, ownTeamId, sortierung],
  );
  const auswahlTeamId =
    gewaehlt && zeilen.some((z) => z.teamId === gewaehlt)
      ? gewaehlt
      : zeilen.find((z) => z.istEigen)?.teamId ?? zeilen[0]?.teamId ?? null;
  const auswahl = zeilen.find((z) => z.teamId === auswahlTeamId) ?? null;
  const nameVon = (teamId: string) => alleZeilen.find((z) => z.teamId === teamId)?.name ?? null;

  if (alleZeilen.length === 0) return null;

  const d1Name = d1?.displayName ?? "Disziplin 1";
  const d2Name = d2?.displayName ?? "Disziplin 2";
  const zeigeLiga = mitLiga && filter === "mensch";
  const beide = mitLiga && filter === "beide";
  const bloecke = beide ? gruppiereNachLiga(zeilen, ownTeamId, sortierung) : [];
  const gesperrt = !d2Revealed;

  const kopf = (schluessel: WertungsSortierung, text: string, klasse?: string) => (
    <button
      type="button"
      className={`${klasse ?? ""}${sortierung === schluessel ? " an" : ""}`}
      aria-pressed={sortierung === schluessel}
      onClick={() => setSortierung(schluessel)}
    >
      {text}
      {sortierung === schluessel ? " ▾" : ""}
    </button>
  );

  return (
    <section className="swm" data-testid="spieltagswertung" aria-label="Spieltagswertung">
      <div className="in">
        <div className="wkopf2">
          <h2>Spieltagswertung</h2>
          <span className="dchip">
            <Icon name={d1Revealed ? "ok" : "schloss"} />
            {d1Name}
          </span>
          <span className="dchip">
            <Icon name={d2Revealed ? "ok" : "schloss"} />
            {d2Name}
          </span>
          <span className="sp" />
          <div className="filt" role="group" aria-label="Teams filtern">
            {FILTER_NAMEN.filter(([wert]) =>
              wert === "beide" || wert === "liga1" || wert === "liga2" ? mitLiga : wert === "alle" ? !mitLiga : wert === "gruppe" ? gruppeDa : wert === "mensch" ? hatMenschen : true,
            ).map(([wert, text]) => (
              <button
                key={wert}
                type="button"
                className={filter === wert ? "an" : ""}
                aria-pressed={filter === wert}
                onClick={() => setFilterWahl(wert)}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {beide ? (
          <div className="ligen" data-testid="spieltagswertung-ligen">
            {bloecke.map((b) => (
              <section
                key={b.liga ?? "ohne"}
                className={`pan tab kompakt${b.istEigene ? " eigene" : ""}`}
                data-testid={`spieltagswertung-liga-${b.liga ?? "ohne"}`}
                aria-label={b.titel}
              >
                <div className="lk">
                  <h3>{b.titel}</h3>
                  {b.istEigene ? <span className="du">Deine Liga</span> : null}
                  <span className="n t">{b.zeilen.length} Teams</span>
                </div>
                <div className="hd">
                  {kopf("ges", "#")}
                  {kopf("ges", "Team")}
                  {kopf("d1", d1Name)}
                  {kopf("d2", d2Name)}
                  {kopf("ges", "Gesamt", "re")}
                  {kopf("sai", "Saison", "re")}
                </div>
                <div className="body">
                  {b.zeilen.map((z) => (
                    <button
                      type="button"
                      key={z.teamId}
                      data-testid={`spieltagswertung-zeile-${z.teamId}`}
                      className={`zr${z.istEigen ? " e" : ""}${z.teamId === auswahlTeamId ? " sel" : ""}`}
                      aria-pressed={z.teamId === auswahlTeamId}
                      onClick={() => setGewaehlt(z.teamId)}
                      onMouseEnter={() => onHoverTeam?.(z.teamId)}
                      onMouseLeave={() => onHoverTeam?.(null)}
                    >
                      <span className="rg t">{gesperrt || z.ligaRang == null ? "–" : z.ligaRang}</span>
                      <span className="tm">
                        <Wappen zeile={z} />
                        <b>{z.name}</b>
                        <Menschenmarke zeile={z} />
                      </span>
                      <DisziplinZelle seite={z.d1} kurz />
                      <DisziplinZelle seite={z.d2} kurz />
                      <span className="ges t">{gesperrt ? <Icon name="schloss" /> : de(z.gesamt)}</span>
                      <span className="sr t">
                        <i>{z.vorRang != null ? `${z.vorRang}.` : "–"}</i>→
                        {gesperrt ? <Icon name="schloss" /> : <b>{z.nachRang != null ? `${z.nachRang}.` : "–"}</b>}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
        <section className="pan tab" data-testid="spieltagswertung-tabelle">
          <div className="grp">
            <span style={{ gridColumn: "1/3", border: 0 }} />
            <span style={{ gridColumn: "3/8" }}>Ergebnis · Punkte für die Tabelle</span>
            <span style={{ gridColumn: "8/10" }}>Wirkung im Score · keine Punkte</span>
            <span>Saison-Rang</span>
          </div>
          <div className="hd">
            {kopf("ges", "#")}
            {kopf("ges", "Team")}
            {kopf("d1", d1Name)}
            {kopf("d2", d2Name)}
            {kopf("pkt", "Punkte", "re")}
            {kopf("mut", "◆ Mutator", "re")}
            {kopf("ges", "Gesamt", "re")}
            {kopf("form", "Form", "re")}
            {kopf("cap", "Captain", "re")}
            {kopf("sai", "vor → nach", "re")}
          </div>
          <div className="body">
            {zeilen.map((z) => (
              <button
                type="button"
                key={z.teamId}
                data-testid={`spieltagswertung-zeile-${z.teamId}`}
                className={`zr${z.istEigen ? " e" : ""}${z.teamId === auswahlTeamId ? " sel" : ""}`}
                aria-pressed={z.teamId === auswahlTeamId}
                onClick={() => setGewaehlt(z.teamId)}
                onMouseEnter={() => onHoverTeam?.(z.teamId)}
                onMouseLeave={() => onHoverTeam?.(null)}
              >
                <span className="rg t">{gesperrt || z.ligaRang == null ? "–" : z.ligaRang}</span>
                <span className="tm">
                  <Wappen zeile={z} />
                  <b>{z.name}</b>
                  <Menschenmarke zeile={z} />
                  {z.missingLineup ? (
                    <span className="mg ki" title="Keine Aufstellung eingereicht — die 0 Punkte sind kein echtes Ergebnis">
                      ohne Aufstellung
                    </span>
                  ) : null}
                </span>
                <DisziplinZelle seite={z.d1} />
                <DisziplinZelle seite={z.d2} />
                <span className="re t">{z.d1.aufgedeckt || z.d2.aufgedeckt ? de(z.punkte) : "–"}</span>
                <span className="re t" style={{ color: z.mutator ? "var(--drei)" : "var(--stumm)" }}>
                  {z.mutator ? `+${de(z.mutator)}` : "–"}
                </span>
                <span className="ges t">{gesperrt ? <Icon name="schloss" /> : de(z.gesamt)}</span>
                <span className={`re t ${z.hatForm ? ton(z.form) : "null"}`}>{z.hatForm ? vz(z.form) : "–"}</span>
                <span className={`re t ${z.hatCaptain ? ton(z.captain) : "null"}`}>{z.hatCaptain ? vz(z.captain) : "–"}</span>
                <span className="sr t">
                  {zeigeLiga && z.liga ? <i>{z.liga === "liga1" ? "L1" : "L2"}</i> : null}
                  <i>{z.vorRang != null ? `${z.vorRang}.` : "–"}</i>→
                  {gesperrt ? <Icon name="schloss" /> : <b>{z.nachRang != null ? `${z.nachRang}.` : "–"}</b>}
                  {gesperrt ? null : <Bewegung wert={z.bewegung} />}
                </span>
              </button>
            ))}
            {zeilen.length === 0 ? <div className="leer">Keine Teams in diesem Filter.</div> : null}
          </div>
          <div className="tfuss">
            <b>#</b> Rang nur dieses Spieltags nach Gesamt · <b>S / N</b> Sieg, Niederlage · <b>1.–4.</b> Platz in der Vierergruppe ·{" "}
            <b>Gesamt</b> = Punkte + Mutator · <b>Form / Captain</b> haben die Aufstellung stärker oder schwächer gemacht, sie zählen nicht
            zusätzlich
          </div>
        </section>
        )}

        {auswahl ? (
          <Blatt
            zeile={auswahl}
            d1Name={d1Name}
            d2Name={d2Name}
            d1Revealed={d1Revealed}
            d2Revealed={d2Revealed}
            nameVon={nameVon}
          />
        ) : (
          <section className="pan det" />
        )}
      </div>
    </section>
  );
}
