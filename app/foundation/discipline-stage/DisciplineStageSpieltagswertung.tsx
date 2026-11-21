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
  baueBegegnungen,
  type Begegnung,
  type BegegnungTeam,
} from "@/app/foundation/discipline-stage/spieltagswertung-begegnungen";
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
  /** Welche Ansicht beim Öffnen steht (Standard: die Tabelle); der Wechsel bleibt Sache des Nutzers. */
  anfangsAnsicht?: "wertung" | "begegnungen";
  /** Welcher Filter beim Öffnen steht (Standard: beide Ligen getrennt bzw. alle Teams). */
  anfangsFilter?: WertungsFilter;
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
  const a = seite.anzeige;
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
      <span className="t" title={a ? `${a.einheit}${a.hinweis ? ` — ${a.hinweis}` : ""}` : undefined}>
        {a?.nativ ?? (seite.gruppe ? seite.gruppe.wertText ?? "" : "")}
      </span>
      {a?.diff && a.diff !== "±0" ? <small className={`df t ${a.diffTon}`}>{a.diff}</small> : null}
      <em className={`t${seite.punkte ? "" : " o"}`}>{punkteText(seite.punkte)}</em>
    </span>
  );
}

/** Form- bzw. Captain-Wirkung beider Disziplinen einer Zeile nebeneinander: "+3 · −2", nicht Gesetztes als "–". */
function PaarZelle({ a, b, feld }: { a: WertungsSeitenWerte; b: WertungsSeitenWerte; feld: "form" | "captain" }) {
  const wert = (x: WertungsSeitenWerte): number | null => {
    if (!x.aufgedeckt) return null;
    return feld === "form" ? (x.formLabel != null ? x.form : null) : x.captain;
  };
  const teil = (x: WertungsSeitenWerte) => {
    const w = wert(x);
    return <i className={w == null ? "null" : ton(w)}>{w == null ? "–" : vz(w)}</i>;
  };
  return (
    <span className="re t pz" data-testid={`spieltagswertung-paar-${feld}`}>
      {teil(a)}
      <u>·</u>
      {teil(b)}
    </span>
  );
}

function SeitenBlock({
  titel,
  disziplinId,
  seite,
  zeile,
  nameVon,
}: {
  titel: string;
  disziplinId: string | null;
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
  const wort = beschreibeWertungsErgebnis(seite.ergebnis, nameVon, disziplinId, seite.anzeige);
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
        <div data-testid="spieltagswertung-differenz">
          <small>{seite.anzeige ? "Differenz" : seite.gruppe ? "Wertung in der Gruppe" : "Differenz"}</small>
          {seite.anzeige?.diff ? (
            <b className={`t ${seite.anzeige.diffTon}`}>{seite.anzeige.diff}</b>
          ) : seite.gruppe?.skala != null ? (
            <b className="t">{seite.gruppe.skala}</b>
          ) : (
            <b className="t null">–</b>
          )}
          {seite.anzeige?.skala ? <i>Skala {seite.anzeige.skala}</i> : seite.gruppe?.skala != null ? <i>von 10</i> : null}
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
  d1Id,
  d2Id,
  d1Revealed,
  d2Revealed,
  nameVon,
}: {
  zeile: WertungsZeile;
  d1Name: string;
  d2Name: string;
  d1Id: string | null;
  d2Id: string | null;
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
      <SeitenBlock titel={d1Name} disziplinId={d1Id} seite={zeile.d1} zeile={zeile} nameVon={nameVon} />
      <SeitenBlock titel={d2Name} disziplinId={d2Id} seite={zeile.d2} zeile={zeile} nameVon={nameVon} />
      <div className={`dsum${zeile.mutator > 0 ? "" : " drei"}`}>
        <div>
          <span>{d1Name}</span>
          <strong className="t">{zeile.d1.aufgedeckt ? punkteText(zeile.d1.punkte) : "–"}</strong>
        </div>
        <div>
          <span>+ {d2Name}</span>
          <strong className="t">{zeile.d2.aufgedeckt ? punkteText(zeile.d2.punkte) : "–"}</strong>
        </div>
        {zeile.mutator > 0 ? (
          <div>
            <span>+ Mutator ◆</span>
            <strong className="t" style={{ color: "var(--drei)" }}>
              {alles ? de(zeile.mutator) : "–"}
            </strong>
          </div>
        ) : null}
        <div className="g">
          <span>= Gesamt</span>
          <strong className="t">{alles ? de(zeile.gesamt) : "–"}</strong>
        </div>
      </div>
    </section>
  );
}

function BegegnungTeamKnopf({
  team,
  gewaehlt,
  rechts,
  onWaehle,
}: {
  team: BegegnungTeam;
  gewaehlt: boolean;
  rechts?: boolean;
  onWaehle: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      className={`bt${rechts ? " re" : ""}${team.istEigen ? " e" : ""}${gewaehlt ? " sel" : ""}`}
      aria-pressed={gewaehlt}
      data-testid={`spieltagswertung-begegnung-team-${team.teamId}`}
      onClick={() => onWaehle(team.teamId)}
    >
      {rechts ? null : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl ?? undefined} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
      )}
      <b>{team.name}</b>
      {team.istEigen ? <span className="du">Du</span> : team.mensch ? <span className="mg">{team.mensch}</span> : null}
      {rechts ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl ?? undefined} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
      ) : null}
    </button>
  );
}

/** Wer gegen wen, je Disziplin: Duelle mit Ergebnis, Differenz und Skala, Vierergruppen mit allen vier Plätzen. */
function BegegnungenAnsicht({
  spalten,
  auswahlTeamId,
  onWaehle,
}: {
  spalten: Array<{ titel: string; art: string; aufgedeckt: boolean; begegnungen: Begegnung[] }>;
  auswahlTeamId: string | null;
  onWaehle: (teamId: string) => void;
}) {
  return (
    <div
      className="begs"
      data-testid="spieltagswertung-begegnungen"
      // Vierergruppen brauchen vier Teams nebeneinander und damit mehr Breite als ein Duell.
      style={{ gridTemplateColumns: spalten.map((sp) => (sp.art === "Vierergruppen" ? "minmax(0, 1.35fr)" : "minmax(0, 1fr)")).join(" ") }}
    >
      {spalten.map((sp) => (
        <section key={sp.titel} className="pan beg" aria-label={`Begegnungen ${sp.titel}`}>
          <div className="lk">
            <h3>{sp.titel}</h3>
            <span className="n t">{sp.aufgedeckt ? `${sp.begegnungen.length} ${sp.art}` : "noch nicht gespielt"}</span>
          </div>
          <div className="body">
            {!sp.aufgedeckt ? (
              <div className="leer">
                <Icon name="schloss" /> Wird erst mit dem Abpfiff aufgedeckt.
              </div>
            ) : sp.begegnungen.length === 0 ? (
              <div className="leer">Keine Begegnungen in diesem Filter.</div>
            ) : (
              sp.begegnungen.map((b) =>
                b.art === "duell" ? (
                  <div key={b.schluessel} className={`br${b.istEigen ? " e" : ""}`} data-testid="spieltagswertung-begegnung-duell">
                    <BegegnungTeamKnopf team={b.a} gewaehlt={b.a.teamId === auswahlTeamId} onWaehle={onWaehle} />
                    <span className="sc t" title={b.anzeige.hinweis ?? b.anzeige.einheit}>
                      {b.anzeige.nativ ?? "Sieg"}
                    </span>
                    <BegegnungTeamKnopf team={b.b} gewaehlt={b.b.teamId === auswahlTeamId} rechts onWaehle={onWaehle} />
                    <span className={`df t ${b.anzeige.diffTon}`}>{b.anzeige.diff ?? ""}</span>
                    <span className="sk t">{b.anzeige.skala ?? ""}</span>
                  </div>
                ) : (
                  <div key={b.schluessel} className={`bg${b.istEigen ? " e" : ""}`} data-testid="spieltagswertung-begegnung-gruppe">
                    {b.plaetze.map((p) => (
                      <button
                        type="button"
                        key={p.teamId}
                        className={`gp${p.istEigen ? " e" : ""}${p.teamId === auswahlTeamId ? " sel" : ""}`}
                        aria-pressed={p.teamId === auswahlTeamId}
                        onClick={() => onWaehle(p.teamId)}
                        title={p.name}
                      >
                        <span className={`pl ${p.platz === 1 ? "s" : p.platz === 2 ? "z" : "n"}`}>{p.platz}.</span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.logoUrl ?? undefined} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                        <b>{p.name}</b>
                        <span className="t w">
                          {p.wert ?? ""}
                          {p.skala != null ? <i> → {p.skala}</i> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                ),
              )
            )}
          </div>
        </section>
      ))}
    </div>
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

  const [filterWahl, setFilterWahl] = useState<WertungsFilter | null>(props.anfangsFilter ?? null);
  const [sortierung, setSortierung] = useState<WertungsSortierung>("ges");
  // Zweiter Klick auf dieselbe Spalte dreht die Richtung (Designregel: alle Tabellen sortierbar).
  const [umgekehrt, setUmgekehrt] = useState(false);
  const waehleSortierung = (schluessel: WertungsSortierung) => {
    if (schluessel === sortierung) setUmgekehrt((u) => !u);
    else {
      setSortierung(schluessel);
      setUmgekehrt(false);
    }
  };
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState<"wertung" | "begegnungen">(props.anfangsAnsicht ?? "wertung");

  const mitLiga = hatLigaTrennung(alleZeilen);
  const gruppeDa = findeEigeneGruppe(alleZeilen, ownTeamId) != null;
  const hatMenschen = alleZeilen.some((z) => z.mensch != null);
  const filter = filterWahl ?? startFilter(alleZeilen);
  const zeilen = useMemo(
    () => sortiereWertungsZeilen(filtereWertungsZeilen(alleZeilen, filter, ownTeamId), sortierung, umgekehrt),
    [alleZeilen, filter, ownTeamId, sortierung, umgekehrt],
  );
  const auswahlTeamId =
    gewaehlt && zeilen.some((z) => z.teamId === gewaehlt)
      ? gewaehlt
      : zeilen.find((z) => z.istEigen)?.teamId ?? zeilen[0]?.teamId ?? null;
  const auswahl = zeilen.find((z) => z.teamId === auswahlTeamId) ?? null;
  const nameVon = (teamId: string) => alleZeilen.find((z) => z.teamId === teamId)?.name ?? null;

  const sichtbareIds = useMemo(() => new Set(zeilen.map((z) => z.teamId)), [zeilen]);
  const begegnungSpalten = useMemo(() => {
    const filtern = (liste: Begegnung[]) =>
      liste.filter((b) => (b.art === "duell" ? sichtbareIds.has(b.a.teamId) || sichtbareIds.has(b.b.teamId) : b.plaetze.some((p) => sichtbareIds.has(p.teamId))));
    const art = (seite: "d1" | "d2") => (baueBegegnungen(alleZeilen, seite, ownTeamId).some((b) => b.art === "gruppe") ? "Vierergruppen" : "Begegnungen");
    return [
      { titel: d1?.displayName ?? "Disziplin 1", art: art("d1"), aufgedeckt: d1Revealed, begegnungen: filtern(baueBegegnungen(alleZeilen, "d1", ownTeamId)) },
      { titel: d2?.displayName ?? "Disziplin 2", art: art("d2"), aufgedeckt: d2Revealed, begegnungen: filtern(baueBegegnungen(alleZeilen, "d2", ownTeamId)) },
    ];
  }, [alleZeilen, sichtbareIds, ownTeamId, d1, d2, d1Revealed, d2Revealed]);

  if (alleZeilen.length === 0) return null;

  const d1Name = d1?.displayName ?? "Disziplin 1";
  const d2Name = d2?.displayName ?? "Disziplin 2";
  const zeigeLiga = mitLiga && filter === "mensch";
  const beide = mitLiga && filter === "beide";
  const bloecke = beide ? gruppiereNachLiga(zeilen, ownTeamId, sortierung, umgekehrt) : [];
  const gesperrt = !d2Revealed;

  const kopf = (schluessel: WertungsSortierung, text: string, klasse?: string) => (
    <button
      type="button"
      className={`${klasse ?? ""}${sortierung === schluessel ? " an" : ""}`}
      aria-pressed={sortierung === schluessel}
      onClick={() => waehleSortierung(schluessel)}
      title="Klick sortiert, nochmal klicken dreht die Richtung"
    >
      {text}
      {sortierung === schluessel ? (umgekehrt ? " ▴" : " ▾") : ""}
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
          <div className="filt ansicht" role="group" aria-label="Ansicht wählen">
            <button type="button" className={ansicht === "wertung" ? "an" : ""} aria-pressed={ansicht === "wertung"} onClick={() => setAnsicht("wertung")}>
              Wertung
            </button>
            <button
              type="button"
              className={ansicht === "begegnungen" ? "an" : ""}
              aria-pressed={ansicht === "begegnungen"}
              data-testid="spieltagswertung-ansicht-begegnungen"
              onClick={() => setAnsicht("begegnungen")}
            >
              Begegnungen
            </button>
          </div>
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

        {ansicht === "begegnungen" ? (
          <BegegnungenAnsicht spalten={begegnungSpalten} auswahlTeamId={auswahlTeamId} onWaehle={setGewaehlt} />
        ) : beide ? (
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
                  {kopf("name", "Team")}
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
            <span style={{ gridColumn: "3/6" }}>Ergebnis · Differenz · Punkte für die Tabelle</span>
            <span style={{ gridColumn: "6/8" }}>Wirkung im Score · keine Punkte</span>
            <span>Saison-Rang</span>
          </div>
          <div className="hd">
            {kopf("ges", "#")}
            {kopf("name", "Team")}
            {kopf("d1", d1Name)}
            {kopf("d2", d2Name)}
            {kopf("ges", "Gesamt", "re")}
            {kopf("form", "Form D1 · D2", "re")}
            {kopf("cap", "Captain D1 · D2", "re")}
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
                <span className="ges t">{gesperrt ? <Icon name="schloss" /> : de(z.gesamt)}</span>
                <PaarZelle a={z.d1} b={z.d2} feld="form" />
                <PaarZelle a={z.d1} b={z.d2} feld="captain" />
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
            <b>Differenz</b> = eigener Wert minus Gegner (bei Zeiten: Vorsprung) · <b>Form / Captain</b> je Disziplin haben die Aufstellung
            stärker oder schwächer gemacht, sie zählen nicht zusätzlich
          </div>
        </section>
        )}

        {auswahl ? (
          <Blatt
            zeile={auswahl}
            d1Name={d1Name}
            d2Name={d2Name}
            d1Id={d1?.disciplineId ?? null}
            d2Id={d2?.disciplineId ?? null}
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
