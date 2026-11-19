"use client";

/**
 * GEMEINSAMES RECHTES PANEL für Draft und Transfermarkt (UX-Umbau 19.11., PR B, Mockup `ux-draft-markt-19-11.html`):
 *  - `WirkungAufKader`: die drei größten Rangsprünge, „hebt N von 20 Disziplinen“
 *  - `MeinKaderListe`: „Mein Kader in ⟨Disziplin⟩“ nach Eignung, der Ausgewählte golden einsortiert („NEU“), Trennlinie nach
 *    Platz 6, Kaderzähler als Streifen. Klick auf einen Spieler öffnet sofort das Profil.
 *  - `KasseBlock`: „frei jetzt“ / „frei nach Pick bzw. Kauf“ als Zahl mit Balken.
 * Alles Anzeige; die Daten rechnen `mein-kader-daten.ts` und `lib/market/transfermarkt-kaderstaerke.ts`.
 */
import { Fragment } from "react";

import { hebtInDisziplinen, type RangWirkung } from "@/lib/market/transfermarkt-kaderstaerke";
import { de, rangText } from "@/app/foundation/transfermarkt-modern/tm-format";
import { baueKaderListe, baueZaehler, groessteSpruenge, type EigenerSpieler, type KandidatEintrag, type KasseAnsicht } from "./mein-kader-daten";
import "./mein-kader-panel.css";

const C = (x: number) => `${x < 0 ? "−" : ""}${de(Math.abs(x), 1)} C`;

export function WirkungAufKader({ wirkungen, namen }: { wirkungen: readonly RangWirkung[]; namen: Record<string, string> }) {
  const spruenge = groessteSpruenge(wirkungen);
  return (
    <>
      <h4 data-testid="kader-wirkung-kopf">Wirkung auf deinen Kader <span>hebt {hebtInDisziplinen(wirkungen)} von 20 Disziplinen</span></h4>
      <div className="wirk wirk-neu" data-testid="kader-wirkung">
        {spruenge.length > 0 ? (
          spruenge.map((w) => (
            <div key={w.disziplinId}>
              <b>{namen[w.disziplinId] ?? w.disziplinId}</b>
              <span className="t">Rang {w.vorher}. → <i className="auf">{rangText(w.nachherBest, w.nachherSchlecht)}</i></span>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: "1 / 4" }}>Kein Rang ändert sich (auch im besten Fall nicht).</div>
        )}
      </div>
    </>
  );
}

export function MeinKaderListe({
  disziplinName,
  eigene,
  kandidat,
  kader,
  pflicht,
  wunsch,
  max,
  onProfil,
}: {
  disziplinName: string;
  eigene: readonly EigenerSpieler[];
  kandidat: KandidatEintrag | null;
  kader: number;
  pflicht: number;
  wunsch: number | null;
  max: number;
  onProfil: (playerId: string) => void;
}) {
  const { zeilen, trennNach } = baueKaderListe({ eigene, kandidat });
  const eigenerKandidat = kandidat != null && eigene.some((s) => s.playerId === kandidat.playerId);
  const zaehler = baueZaehler({ kader, kandidatDazu: kandidat != null && !eigenerKandidat, pflicht, wunsch, max });
  return (
    <>
      <h4 data-testid="mein-kader-kopf">Mein Kader in {disziplinName} <span>Klick öffnet das Profil</span></h4>
      <div className="mkl" data-testid="mein-kader-liste">
        {zeilen.length === 0 ? <div className="mkr leer">noch kein Spieler im Kader</div> : null}
        {zeilen.map((z, i) => (
          <Fragment key={z.playerId}>
            {trennNach != null && i === trennNach ? <div className="mktrenn" data-testid="mein-kader-trenner">ab hier zählt die Eignung nicht mehr zur Kaderstärke</div> : null}
            <div
              className={`mkr${z.neu ? " neu" : ""}${z.zaehltNicht ? " raus" : ""}`}
              onClick={() => onProfil(z.playerId)}
              title="Profil öffnen"
              data-testid={z.neu ? "mein-kader-neu" : "mein-kader-spieler"}
              data-player-id={z.playerId}
            >
              <span className="p t">{z.platz != null ? `${z.platz}.` : ""}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {z.portraitUrl ? <img src={z.portraitUrl} alt="" loading="lazy" /> : <span className="bildleer" />}
              <span className="n">
                {z.name}
                <small>
                  {z.neu ? `NEU · ${z.className}` : z.raus ? <i className="rausmark">raus aus Top 6</i> : z.verletzt ? <>{z.className} · <i className="rausmark">verletzt</i></> : z.className}
                </small>
              </span>
              <span className="mkbal"><i className={z.neu ? "" : "z"} style={{ width: `${Math.max(0, Math.min(100, z.wert))}%` }} /></span>
              <span className="w t">{z.text}</span>
            </div>
          </Fragment>
        ))}
        {zaehler.hinweis ? (
          <div className={`mkr leer${zaehler.hinweis.art === "wunsch" ? " opt" : ""}`} data-testid="mein-kader-luecke">
            {zaehler.hinweis.art === "pflicht" ? `noch ${zaehler.hinweis.n} Pflichtplätze offen` : `noch ${zaehler.hinweis.n} bis zur Wunschgröße deines GM`}
          </div>
        ) : null}
      </div>
      <div className="mkzaehl" title={`Pflicht ${pflicht}${wunsch != null ? ` · Wunschgröße ${wunsch}` : ""} · höchstens ${max}`} data-testid="mein-kader-zaehler">
        {zaehler.segmente.map((s, i) => <i key={i} className={s} />)}
      </div>
      <div className="gz2">
        <span>Kader</span>
        <b className="t">
          {kader}{kandidat != null && !eigenerKandidat ? ` → ${zaehler.nachher}` : ""}{" "}
          <span className="stumm">· Pflicht {pflicht}{wunsch != null ? ` · Wunsch ${wunsch}` : ""} · max. {max}</span>
        </b>
      </div>
    </>
  );
}

export function KasseBlock({ kasse, hinweis, nachLabel, titelHinweis }: { kasse: KasseAnsicht; hinweis: string; nachLabel: "Pick" | "Kauf"; titelHinweis?: string }) {
  return (
    <div className="kasse-block" data-testid="kasse-block">
      <h4 title={titelHinweis}>Kasse <span>{hinweis}</span></h4>
      <div className="stapel kasse-stapel" data-testid="kasse-balken">
        {kasse.segmente.map((s, i) => <i key={i} className={s.art} style={{ width: `${Math.max(0, Math.min(100, s.wert * 100))}%` }} />)}
      </div>
      <div className="gz2"><span>frei jetzt</span><b className="t">{C(kasse.freiJetzt)}</b></div>
      {kasse.nach ? (
        <div className="gz2" data-testid="kasse-nach">
          <span>frei nach {nachLabel}</span>
          {kasse.nach.art === "reicht-nicht" ? (
            <b className="t minus">reicht nicht · es fehlen {C(kasse.nach.fehlt)}</b>
          ) : (
            <b className="t plus">{C(kasse.nach.frei)}{kasse.nach.gebunden > 0 ? ` · davon ${C(kasse.nach.gebunden)} gebunden` : ""}</b>
          )}
        </div>
      ) : null}
    </div>
  );
}
