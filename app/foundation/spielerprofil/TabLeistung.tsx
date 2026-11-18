"use client";

import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { ACHSEN, PP_ZIELLINIE, type AchseId } from "@/lib/foundation/spielerprofil-modell";
import { PpBalken, Tafel, achseKlasse, kategorieAchse, zahl } from "./bausteine";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";

export function TabLeistung({ data, modell }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell }) {
  const raenge = modell.raenge;
  const gesamt = raenge?.ppGesamt ?? data.seasonPerformance?.totalPoints ?? null;
  const achseVon = (id: string): AchseId => kategorieAchse(data.disciplineValues.find((zeile) => zeile.id === id)?.category);
  const aktuell = modell.gameState ? Number(modell.gameState.matchdayState.matchdayId.match(/(\d+)/)?.[1] ?? NaN) || null : null;
  const einsaetze = modell.ppReihe.length;
  const proEinsatz = gesamt != null && einsaetze > 0 ? gesamt / einsaetze : null;
  const maxAchse = Math.max(1, ...ACHSEN.map((achse) => data.seasonPerformance?.pointsByArea[achse.id] ?? 0));
  const formVon = new Map((modell.form?.verlauf ?? []).map((eintrag) => [eintrag.matchdayId, eintrag] as const));
  // Spieltag, an dem sich der Spieler verletzt hat: dort zählte in der Verletzungs-Disziplin nur die Hälfte (Chris 18.11., Punkt 1).
  const halbVon = new Set<string>();
  for (const zeile of data.injuryHistoryRows ?? []) {
    for (const disziplin of zeile.disciplines) halbVon.add(`${zeile.matchdayId}::${disziplin.disciplineId}`);
  }
  const zeilen = modell.ppReihe.flatMap((spieltag) =>
    spieltag.eintraege.map((eintrag) => ({ spieltag, eintrag, form: formVon.get(spieltag.matchdayId) })),
  );
  return (
    <div className="spr-tab spr-t-leistung" data-testid="spielerprofil-tab-leistung">
      <Tafel titel="Player Points" klein="gebucht" className="spr-l-links" testId="spielerprofil-leistung-links">
        <div className="spr-ppk">
          <strong className="spr-t">{zahl(gesamt, 1)}</strong>
          <small>
            PP in dieser Saison
            <br />
            {raenge?.ppGesamtLigaRang != null ? (
              <>
                Rang <b>#{raenge.ppGesamtLigaRang}</b> von {raenge.ppGesamtLigaVon} {raenge.ligaAktiv ? `in der ${raenge.ligaName === "liga2" ? "Liga 2" : "Liga 1"}` : "unter allen Aktiven"}
              </>
            ) : (
              "noch ohne Rang"
            )}
          </small>
        </div>
        <div className="spr-zeile">
          <span>Einsätze</span>
          <strong className="spr-t">{zahl(einsaetze, 0)}</strong>
        </div>
        <div className="spr-zeile">
          <span>PP je Einsatz</span>
          <strong className="spr-t">{zahl(proEinsatz, 2)}</strong>
        </div>
        <div className="spr-zeile">
          <span>
            Ziellinie<small>Top einer Disziplin</small>
          </span>
          <strong className="spr-t">{PP_ZIELLINIE}</strong>
        </div>
        <span className="spr-gk">PP nach Achse</span>
        <div className="spr-ach">
          {ACHSEN.map((achse) => {
            const punkte = data.seasonPerformance?.pointsByArea[achse.id] ?? null;
            return (
              <div key={achse.id} className={achseKlasse(achse.id)}>
                <span>{achse.label}</span>
                <div className="spr-bn">
                  <i style={{ width: `${((punkte ?? 0) / maxAchse) * 100}%` }} />
                </div>
                <b className="spr-t">{zahl(punkte, 1)}</b>
              </div>
            );
          })}
        </div>
        <div className="spr-hinweis">
          Die Skala wird gerade neu geeicht (Top-Spieler um {PP_ZIELLINIE} je Disziplin). Gezeigt sind die <b>echten gebuchten</b> Werte; die Linie ist nur eine Markierung.
        </div>
      </Tafel>
      <Tafel titel="PP je Spieltag" klein="zwei Disziplinen je Spieltag, Farbe = Achse" testId="spielerprofil-leistung-balken">
        <PpBalken reihe={modell.ppReihe} achseVon={achseVon} aktuellerSpieltag={aktuell} />
      </Tafel>
      <Tafel titel="Einsätze" klein="Rang am Spieltag in der Disziplin" koerperClass="spr-et-huelle" testId="spielerprofil-einsatztabelle">
        <div className="spr-et">
          <div className="spr-ez is-kopf">
            <span>Tag</span>
            <span>Disziplin</span>
            <span>PP</span>
            <span>Rang</span>
            <span>Form danach</span>
            <span>Hinweis</span>
          </div>
          {zeilen.map(({ spieltag, eintrag, form }) => {
            const halb = halbVon.has(`${spieltag.matchdayId}::${eintrag.disziplinId}`);
            const achse = achseVon(eintrag.disziplinId);
            return (
              <div key={`${spieltag.matchdayId}-${eintrag.disziplinId}-${eintrag.seite}`} className={`spr-ez ${achseKlasse(achse)}${halb ? " is-verletzt" : ""}`}>
                <span className="spr-t">{spieltag.nummer ?? "—"}</span>
                <span className="spr-dn">
                  <i />
                  {modell.disziplinLabel(eintrag.disziplinId)}
                </span>
                <strong className="spr-t">{zahl(eintrag.pp, 1)}</strong>
                <span className="spr-t">{eintrag.rangAmSpieltag != null ? `#${eintrag.rangAmSpieltag}` : "—"}</span>
                <span className="spr-t">{form ? `${zahl(form.vorher, 0)} → ${zahl(form.form, 0)}` : "—"}</span>
                <span className={halb ? "spr-halb" : "is-stumm"}>{halb ? "verletzt · × 50 %" : form?.bremse ? (form.bremse.art === "verletzung" ? "verletzt" : "erschöpft") : ""}</span>
              </div>
            );
          })}
          {zeilen.length === 0 ? <div className="spr-leer" style={{ padding: "0.8em 0.9em" }}>Noch kein Einsatz in dieser Saison.</div> : null}
        </div>
      </Tafel>
    </div>
  );
}
