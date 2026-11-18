"use client";

import { useMemo, useState } from "react";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { officialDisciplineWeightLabels, type OfficialDisciplineWeightId } from "@/lib/player-generator/official-discipline-weights";
import {
  ACHSEN,
  ATTRIBUT_LABEL,
  beitraegeJeAttribut,
  bestimmeWeg,
  grobBereich,
  grobeRangStufe,
} from "@/lib/foundation/spielerprofil-modell";
import { Tafel, achseKlasse, kategorieAchse, kulisseStil, zahl } from "./bausteine";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";

type Zeile = PlayerDetailDrawerData["disciplineValues"][number];

function Kachel({
  zeile,
  modell,
  gewaehlt,
  top,
  onWaehle,
}: {
  zeile: Zeile;
  modell: SpielerprofilModell;
  gewaehlt: boolean;
  top: boolean;
  onWaehle: () => void;
}) {
  const rang = modell.raenge?.disziplinen.get(zeile.id);
  const nebel = modell.nebel;
  return (
    <button
      type="button"
      className={`spr-dt ${achseKlasse(kategorieAchse(zeile.category))}${gewaehlt ? " is-an" : ""}${(zeile.value ?? 0) < 40 ? " is-schwach" : ""}`}
      style={kulisseStil(zeile.id)}
      onClick={onWaehle}
      data-testid={`spielerprofil-diszi-${zeile.id}`}
      aria-pressed={gewaehlt}
    >
      {top && !nebel ? <span className="spr-hz">TOP</span> : null}
      <b className="n">{zeile.label}</b>
      <strong className="spr-t">{nebel ? (grobBereich(zeile.value, modell.nebelBreite) ?? "?") : zahl(zeile.value, 0)}</strong>
      <span className="spr-kr">
        {rang ? (
          nebel ? (
            (grobeRangStufe(rang.aktivRang, rang.aktivVon) ?? "—")
          ) : (
            <>
              Liga <b>#{rang.ligaRang ?? "—"}</b>/{rang.ligaVon} · Alle <b>#{rang.aktivRang ?? "—"}</b>/{rang.aktivVon}
            </>
          )
        ) : (
          "—"
        )}
      </span>
      <span className="spr-fu">
        {nebel ? (
          <span>Kaderrang verdeckt</span>
        ) : (
          <>
            <span className={rang?.inBesten6 ? "spr-b6" : undefined} title="Kaderstärke zählt die besten sechs">
              Kader #{rang?.kaderRang ?? "—"}
              {rang?.inBesten6 ? " · Top 6" : ""}
            </span>
            <span className="spr-sp" />
            <span>
              PP <b>{zahl(rang?.ppSaison ?? zeile.seasonPoints, 1)}</b>
              {rang?.ppLigaRang != null ? <> · Liga #{rang.ppLigaRang}</> : null}
            </span>
          </>
        )}
      </span>
    </button>
  );
}

function Erklaerung({ data, modell, zeile }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell; zeile: Zeile }) {
  const achse = kategorieAchse(zeile.category);
  const beitraege = beitraegeJeAttribut(zeile.id, modell.werte);
  const weg = bestimmeWeg(zeile.id, modell.werte);
  const maxGewicht = Math.max(1, ...beitraege.map((eintrag) => eintrag.gewicht));
  const rang = modell.raenge?.disziplinen.get(zeile.id);
  const nebel = modell.nebel;
  const gameState = modell.gameState;
  const kader6 = useMemo(() => {
    if (!gameState || !data.teamId || nebel) return [];
    const nameVon = new Map(gameState.players.map((player) => [player.id, player.name] as const));
    return gameState.rosters
      .filter((eintrag) => eintrag.teamId === data.teamId)
      .map((eintrag) => {
        const player = gameState.players.find((kandidat) => kandidat.id === eintrag.playerId);
        const wert = player?.currentDisciplineValues?.[zeile.id] ?? player?.disciplineRatings?.[zeile.id] ?? null;
        return { id: eintrag.playerId, name: nameVon.get(eintrag.playerId) ?? eintrag.playerId, wert };
      })
      .filter((eintrag): eintrag is { id: string; name: string; wert: number } => typeof eintrag.wert === "number")
      .sort((a, b) => b.wert - a.wert);
  }, [gameState, data.teamId, zeile.id, nebel]);
  const eigeneStelle = kader6.findIndex((eintrag) => eintrag.id === data.playerId);
  const sichtbar = kader6.slice(0, 6);
  const mitEigenem = eigeneStelle >= 6 ? [...sichtbar, kader6[eigeneStelle]] : sichtbar;
  const matrixName = officialDisciplineWeightLabels[zeile.id as OfficialDisciplineWeightId] ?? zeile.label;
  return (
    <Tafel titel="Warum diese Zahl" klein="aus der Matrix" koerperClass="spr-dd" testId="spielerprofil-diszi-erklaerung">
      <div className={`spr-ddk ${achseKlasse(achse)}`} style={kulisseStil(zeile.id)}>
        <div>
          <h3>{zeile.label}</h3>
          <small>
            {ACHSEN.find((eintrag) => eintrag.id === achse)?.label} · {matrixName}
            {nebel ? "" : weg.primaerAttribut ? ` · zählt am meisten: ${ATTRIBUT_LABEL[weg.primaerAttribut]}` : ""}
          </small>
        </div>
        <strong className="spr-t">{nebel ? (grobBereich(zeile.value, modell.nebelBreite) ?? "?") : zahl(zeile.value, 0)}</strong>
      </div>
      <div className={achseKlasse(achse)} style={{ display: "flex", flexDirection: "column" }}>
        <div className="spr-mz is-kopf">
          <span>Attribut</span>
          <span>Gewicht</span>
          <span />
          <span>Wert</span>
          <span>Beitrag</span>
        </div>
        {beitraege.map((eintrag) => (
          <div key={eintrag.attribut} className={`spr-mz${!nebel && weg.tragendesAttribut === eintrag.attribut ? " is-trag" : ""}`}>
            <span>
              {ATTRIBUT_LABEL[eintrag.attribut]}
              {weg.primaerAttribut === eintrag.attribut ? <u className="spr-wegmarke" style={{ marginLeft: "0.3em" }}>max</u> : null}
            </span>
            <span>{eintrag.gewicht} %</span>
            <span className="spr-bn">
              <i style={{ width: `${(eintrag.gewicht / maxGewicht) * 100}%` }} />
            </span>
            <span>{nebel ? "?" : zahl(eintrag.wert, 0)}</span>
            <span>{nebel ? "?" : zahl(eintrag.beitrag, 1)}</span>
          </div>
        ))}
      </div>
      {nebel ? (
        <div className="spr-hinweis">
          Die <b>Gewichte</b> sind für alle gleich und offen. Seine Attributwerte und die Beiträge sind ohne Scouting verdeckt.
        </div>
      ) : (
        <>
          <div className="spr-hinweis">
            <u className={`spr-wegmarke${weg.istPrimaer ? "" : " is-neben"}`}>{weg.istPrimaer ? "Primärweg" : "Nebenweg"}</u>{" "}
            {weg.istPrimaer
              ? "Sein stärkstes Gewicht-mal-Wert-Attribut ist auch das wichtigste der Disziplin."
              : `Er kommt über ${weg.tragendesAttribut ? ATTRIBUT_LABEL[weg.tragendesAttribut] : "ein anderes Attribut"} auf seinen Wert, nicht über ${weg.primaerAttribut ? ATTRIBUT_LABEL[weg.primaerAttribut] : "das Hauptattribut"}.`}{" "}
            Slot, Trait und Form kommen im Spiel dazu, die Beiträge summieren sich deshalb nicht exakt auf die Eignung.
          </div>
          {rang ? (
            <div className="spr-zeile">
              <span>
                Rang
                <small>
                  Liga {rang.ligaRang ?? "—"}/{rang.ligaVon} · alle Aktiven {rang.aktivRang ?? "—"}/{rang.aktivVon}
                </small>
              </span>
              <strong>
                Kader #{rang.kaderRang ?? "—"}/{rang.kaderVon}
              </strong>
            </div>
          ) : null}
          <span className="spr-gk">Die besten 6 des Kaders (Kaderstärke)</span>
          <div className="spr-k6" data-testid="spielerprofil-kader-beste6">
            {mitEigenem.map((eintrag) => {
              const platz = kader6.findIndex((kandidat) => kandidat.id === eintrag.id) + 1;
              return (
                <div key={eintrag.id} className={`${eintrag.id === data.playerId ? "is-er" : ""}${platz > 6 ? " is-aus" : ""}`}>
                  <span>{platz}</span>
                  <span>{eintrag.name}</span>
                  <b>{zahl(eintrag.wert, 0)}</b>
                </div>
              );
            })}
            {mitEigenem.length === 0 ? <div className="spr-leer">Kein Kader.</div> : null}
          </div>
        </>
      )}
    </Tafel>
  );
}

export function TabDisziplinen({
  data,
  modell,
  startDisziplin,
}: {
  data: PlayerDetailDrawerData;
  modell: SpielerprofilModell;
  startDisziplin?: string | null;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(startDisziplin ?? modell.besteDisziplin);
  const nachWert = useMemo(() => [...data.disciplineValues].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)), [data.disciplineValues]);
  const top4 = new Set(nachWert.slice(0, 4).map((zeile) => zeile.id));
  const aktuell = data.disciplineValues.find((zeile) => zeile.id === gewaehlt) ?? nachWert[0] ?? null;
  return (
    <div className="spr-tab spr-t-disziplinen" data-testid="spielerprofil-tab-disziplinen">
      <Tafel
        titel="20 Disziplinen"
        klein={modell.nebel ? "grobe Bereiche, Ränge nur als Einordnung" : "Eignung · Rang in der Liga · Rang unter allen aktiven Spielern"}
        koerperClass="spr-d4-huelle"
      >
        <div className="spr-d4">
          {ACHSEN.map((achse) => {
            const zeilen = nachWert.filter((zeile) => kategorieAchse(zeile.category) === achse.id);
            const mittel = zeilen.length > 0 ? zeilen.reduce((summe, zeile) => summe + (zeile.value ?? 0), 0) / zeilen.length : null;
            return (
              <div key={achse.id} className={`spr-dsp ${achseKlasse(achse.id)}`}>
                <h4>
                  {achse.label}
                  <b>{modell.nebel ? "?" : zahl(mittel, 0)}</b>
                </h4>
                {zeilen.map((zeile) => (
                  <Kachel
                    key={zeile.id}
                    zeile={zeile}
                    modell={modell}
                    gewaehlt={aktuell?.id === zeile.id}
                    top={top4.has(zeile.id)}
                    onWaehle={() => setGewaehlt(zeile.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </Tafel>
      {aktuell ? <Erklaerung data={data} modell={modell} zeile={aktuell} /> : <Tafel titel="Warum diese Zahl">Keine Disziplin gewählt.</Tafel>}
    </div>
  );
}
