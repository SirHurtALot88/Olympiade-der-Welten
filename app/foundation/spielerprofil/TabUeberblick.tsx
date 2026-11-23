"use client";

import type { CSSProperties } from "react";

import { BcFormPfeil, BcMoralGesicht } from "@/components/foundation/broadcast";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { moralStufe } from "@/lib/morale/moral-anzeige";
import {
  ACHSEN,
  ATTRIBUT_LABEL,
  PP_ZIELLINIE,
  gehaltJeSpieltag,
  grobBereich,
  baueRangZeilen,
  type ExperteIn,
  type RangZeile,
} from "@/lib/foundation/spielerprofil-modell";
import {
  FigurBuehne,
  BelastungsSparkline,
  NebelBand,
  PpBalken,
  Tafel,
  achseKlasse,
  geld,
  kategorieAchse,
  kulisseStil,
  zahl,
} from "./bausteine";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";

const EXPERTEN_ANZAHL = 6;

function vorzeichen(wert: number, stellen = 1): string {
  const text = zahl(Math.abs(wert), stellen);
  return wert > 0 ? `+${text}` : wert < 0 ? `−${text}` : text;
}

/* ------------------------------------------------------------------ Zustandskarten: Form, Moral, Einsatz */

export function FormKarte({ modell }: { modell: SpielerprofilModell }) {
  const form = modell.form;
  const verfuegbar = form?.formVerfuegbar === true;
  const ton = !verfuegbar ? "" : form!.formStufe > 0 ? "is-gut" : form!.formStufe < 0 ? "is-schlecht" : "";
  // Kurve: gefüllter Punkt = Einsatz, Linie = Form nach dem Spieltag (0..100, Mitte 50).
  const verlauf = form?.verlauf ?? [];
  const breite = 100;
  const hoehe = 40;
  const punkte = verlauf.map((eintrag, index) => {
    const x = verlauf.length <= 1 ? breite / 2 : (index / (verlauf.length - 1)) * breite;
    const y = hoehe - (Math.max(0, Math.min(100, eintrag.form)) / 100) * hoehe;
    return { x, y, eingesetzt: eintrag.eingesetzt };
  });
  return (
    <section className={`spr-zk ${ton}`} data-testid="spielerprofil-form">
      <span className="spr-gk">Form</span>
      {verfuegbar ? (
        <>
          <div className="spr-zk__gross">
            <BcFormPfeil stufe={form!.formStufe} />
            {modell.nebel ? null : <strong className="spr-t">{zahl(form!.form, 0)}</strong>}
            <div>
              <b>{form!.formWort}</b>
              {modell.nebel ? null : <small>{vorzeichen(form!.formPct, 2)} % auf die Eignung</small>}
            </div>
          </div>
          {modell.nebel ? (
            <div className="spr-zk__fuss">Genaue Form- und Verlaufswerte sind ohne Scouting nicht sichtbar.</div>
          ) : (
            <>
              <div className="spr-zk__kurve">
                {punkte.length > 1 ? (
                  <svg viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="none" aria-hidden="true">
                    <line x1="0" x2={breite} y1={hoehe / 2} y2={hoehe / 2} stroke="rgba(244,230,196,.18)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                    <polyline
                      points={punkte.map((punkt) => `${punkt.x},${punkt.y}`).join(" ")}
                      fill="none"
                      stroke="var(--bc-gold)"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                    {punkte.map((punkt, index) => (
                      <circle key={index} cx={punkt.x} cy={punkt.y} r="1.6" fill={punkt.eingesetzt ? "var(--bc-gold)" : "var(--bc-flaeche-1)"} stroke="var(--bc-gold)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>
                ) : (
                  <span className="spr-zk__fuss">Die Kurve beginnt nach dem ersten Spieltag.</span>
                )}
              </div>
              <div className="spr-zk__fuss">
                {form!.letzteEinsaetze.length > 0
                  ? `Letzte Leistungen gegen Erwartung: ${form!.letzteEinsaetze
                      .map((eintrag) => `${eintrag.leistungPerz ?? "–"}/${eintrag.erwartungPerz ?? "–"}`)
                      .join(" · ")}`
                  : "Gefüllter Punkt = Einsatz."}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="spr-leer">Noch kein Formwert: die Form entsteht mit dem ersten Einsatz.</div>
      )}
    </section>
  );
}

export function MoralKarte({ data, modell }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell }) {
  const moral = modell.form?.moral ?? data.morale?.morale ?? null;
  const stufe = moral != null ? moralStufe(moral) : null;
  const ton = moral == null ? "" : moral >= 60 ? "is-gut" : moral >= 40 ? "is-mittel" : "is-schlecht";
  return (
    <section className={`spr-zk ${ton}`} data-testid="spielerprofil-moral">
      <span className="spr-gk">Moral</span>
      {moral != null ? (
        <>
          <div className="spr-zk__gross">
            <BcMoralGesicht wert={moral} mitZahl={false} groesse={44} />
            {modell.nebel ? null : <strong className="spr-t">{zahl(moral, 0)}</strong>}
            <div>
              <b>{stufe?.wort ?? "—"}</b>
              {modell.nebel || !modell.form ? null : <small>{vorzeichen(modell.form.moralPct, 2)} % auf die Eignung</small>}
            </div>
          </div>
          {modell.nebel ? (
            <div className="spr-zk__fuss">Gründe der Stimmung sind ohne Scouting nicht sichtbar.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.2em", flex: 1, minHeight: 0, overflow: "hidden" }}>
              {modell.moralGruende.length > 0 ? (
                modell.moralGruende.map((grund) => (
                  <div key={grund.id} className="spr-zk__grund">
                    <span>{grund.label}</span>
                    <b className={grund.delta >= 0 ? "is-plus" : "is-minus"}>{vorzeichen(grund.delta, 1)}</b>
                  </div>
                ))
              ) : (
                <div className="spr-zk__fuss">Keine auffälligen Gründe.</div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="spr-leer">Noch keine Moral erfasst.</div>
      )}
    </section>
  );
}

export function EinsatzKarte({ data, modell }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell }) {
  const v = modell.verletzung;
  if (v.verletzt) {
    const tage = Math.max(1, v.nochSpieltage ?? 1);
    return (
      <section className="spr-zk is-verletzt" data-testid="spielerprofil-einsatz-verletzt">
        <span className="spr-gk">Einsatzfähigkeit</span>
        <div className="spr-zk__gross">
          <div>
            <b>Verletzt</b>
            <small>nicht einsetzbar{v.nochSpieltage != null ? ` · noch ${v.nochSpieltage} ${v.nochSpieltage === 1 ? "Spieltag" : "Spieltage"}` : ""}</small>
          </div>
        </div>
        <div className="spr-tage" aria-label="Ausfall bis zur Rückkehr">
          {Array.from({ length: Math.min(tage, 6) }, (_, index) => (
            <i key={index}>{index + 1}</i>
          ))}
          <i className="is-da">zurück</i>
        </div>
        <div className="spr-zk__fuss">
          {v.halbeDisziplinen.length > 0
            ? `Im Spiel der Verletzung zählte in ${v.halbeDisziplinen.map((d) => d.name).join(", ")} nur die Hälfte (× 50 %).`
            : v.bisSpieltag
              ? `Ausfall bis ${v.bisSpieltag}.`
              : "Weder Mensch noch KI darf ihn aufstellen."}
        </div>
      </section>
    );
  }
  const erschoepfung = data.fatigue;
  const ton = erschoepfung == null ? "" : erschoepfung >= 65 ? "is-schlecht" : erschoepfung >= 40 ? "is-mittel" : "is-gut";
  return (
    <section className={`spr-zk ${ton}`} data-testid="spielerprofil-einsatz">
      <span className="spr-gk">Einsatzfähigkeit</span>
      <div className="spr-zk__gross">
        <strong className="spr-t">{zahl(erschoepfung, 0)}</strong>
        <div>
          <b>{v.genesend ? "Genesen" : "Einsatzbereit"}</b>
          <small>Erschöpfung{v.genesend ? " · frisch zurück" : ""}</small>
        </div>
      </div>
      <div className="spr-bn" style={{ margin: "0.3em 0.2em" }} aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, erschoepfung ?? 0))}%`, background: erschoepfung != null && erschoepfung >= 65 ? "var(--bc-warn)" : "var(--bc-gut)" }} />
      </div>
      <div className="spr-zk__grund">
        <span>Verletzungsrisiko</span>
        <b>{zahl(data.availability.injuryRiskPercent, 0)} %</b>
      </div>
      <div className="spr-zk__fuss">{data.availability.injuryRiskLabel}</div>
      <BelastungsSparkline verlauf={data.fatigueVerlauf} />
    </section>
  );
}

/* ------------------------------------------------------------------ Attribute und Experte */

export function AttributeTafel({ data, modell }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell }) {
  const zeilen = new Map(data.attributeStats.map((zeile) => [zeile.key, zeile] as const));
  const potenzial = !modell.nebel && data.potential != null ? data.potential : null;
  const gesamt = !modell.nebel && data.ovr != null && data.ovr > 0 ? data.ovr : null;
  return (
    <Tafel
      titel="Attribute"
      rechts={
        gesamt != null ? (
          <small className="spr-atk" data-testid="spielerprofil-attribute-kopf">
            Gesamt <b className="spr-t">{zahl(gesamt, 1)}</b>
            {potenzial != null ? (
              <>
                {" · "}Potenzial <b className="spr-t is-pot">{zahl(potenzial, 1)}</b>
              </>
            ) : null}
          </small>
        ) : null
      }
      klein={gesamt == null ? "zwölf Werte in vier Achsen" : undefined}
      testId="spielerprofil-attribute"
    >
      <div className="spr-atg">
        {ACHSEN.map((achse) => {
          const karte = data.axisCards.find((eintrag) => eintrag.id === achse.id);
          return (
            <div key={achse.id} className={`spr-ag ${achseKlasse(achse.id)}`}>
              <h4>
                {achse.label}
                <b className="spr-t">{modell.nebel ? "?" : zahl(karte?.value ?? null, 0)}</b>
              </h4>
              {achse.attribute.map((attribut) => {
                const zeile = zeilen.get(attribut);
                const wert = zeile?.value ?? null;
                const note = wert != null ? (zeile?.ratingLabel ?? null) : null;
                const anzeige = wert != null ? zahl(wert, 0) : (zeile?.rangeLabel ?? zeile?.ratingLabel ?? "?");
                return (
                  <div key={attribut} className="spr-at" data-attribut={attribut}>
                    <span>{ATTRIBUT_LABEL[attribut]}</span>
                    {note ? <em className={note.startsWith("S") ? "is-top" : ""}>{note}</em> : <em className="is-leer" aria-hidden="true" />}
                    <b className="spr-t">{anzeige}</b>
                    <div className="spr-bn">
                      <i style={{ width: `${wert != null ? Math.min(100, wert) : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Tafel>
  );
}

function WegText({ experte }: { experte: ExperteIn }) {
  const weg = experte.weg;
  const primaer = weg.primaerAttribut ? ATTRIBUT_LABEL[weg.primaerAttribut] : "—";
  const tragend = weg.tragendesAttribut ? ATTRIBUT_LABEL[weg.tragendesAttribut] : "—";
  return (
    <span className="spr-weg">
      <u className={`spr-wegmarke${weg.istPrimaer ? "" : " is-neben"}`}>{weg.istPrimaer ? "Primärweg" : "Nebenweg"}</u>
      {weg.istPrimaer ? (
        <>
          über <b>{primaer}</b> ({weg.primaerGewicht} %)
        </>
      ) : (
        <>
          über <b>{tragend}</b> {zahl(weg.tragenderWert, 0)}, obwohl <b>{primaer}</b> am meisten zählt
        </>
      )}
    </span>
  );
}

export function ExperteTafel({ data, modell, onOpenDisziplin }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell; onOpenDisziplin: (id: string) => void }) {
  if (modell.nebel) {
    const grob = data.disciplineValues.slice(0, EXPERTEN_ANZAHL);
    return (
      <Tafel titel="Hier ist er stark" klein="grob gescoutet" testId="spielerprofil-experte">
        <div className="spr-exp" style={{ "--n": Math.max(grob.length, 1) } as CSSProperties}>
          {grob.map((zeile) => {
            const rangZeilen = baueRangZeilen(modell.raenge?.disziplinen.get(zeile.id), modell.raenge, true);
            return (
              <div key={zeile.id} className={`spr-ex ${achseKlasse(kategorieAchse(zeile.category))}`} style={kulisseStil(zeile.id)}>
                <b className="n">{zeile.label}</b>
                <strong>{grobBereich(zeile.value, modell.nebelBreite) ?? "?"}</strong>
                <span className="spr-weg">Bereich statt Wert, Weg unbekannt</span>
                <RangReihe zeilen={rangZeilen} />
              </div>
            );
          })}
          {grob.length === 0 ? <div className="spr-leer">Noch nichts über seine Stärken bekannt.</div> : null}
        </div>
      </Tafel>
    );
  }
  return (
    <Tafel titel="Hier ist er stark" klein={`beste ${modell.experte.length || EXPERTEN_ANZAHL} Disziplinen`} testId="spielerprofil-experte">
      <div className="spr-exp" style={{ "--n": Math.max(modell.experte.length, 1) } as CSSProperties}>
        {modell.experte.map((experte) => {
          const rangZeilen = baueRangZeilen(modell.raenge?.disziplinen.get(experte.disziplinId), modell.raenge, false);
          return (
            <button
              key={experte.disziplinId}
              type="button"
              className={`spr-ex ${achseKlasse(experte.achse)}`}
              style={kulisseStil(experte.disziplinId)}
              onClick={() => onOpenDisziplin(experte.disziplinId)}
              title="Zur Disziplin"
              data-disziplin={experte.disziplinId}
            >
              <b className="n">{experte.label}</b>
              <strong className="spr-t">{zahl(experte.wert, 0)}</strong>
              <WegText experte={experte} />
              <RangReihe zeilen={rangZeilen} />
            </button>
          );
        })}
        {modell.experte.length === 0 ? <div className="spr-leer">Noch keine Eignungswerte.</div> : null}
      </div>
    </Tafel>
  );
}

function RangReihe({ zeilen }: { zeilen: RangZeile[] }) {
  if (zeilen.length === 0) return null;
  return (
    <span className="spr-rang" data-testid="spielerprofil-experte-rang">
      {zeilen.map((zeile) => (
        <span key={zeile.wort} className={zeile.gross ? "is-gross" : undefined}>
          {zeile.gross ? (
            <>
              <b className="spr-t">{zeile.wert}</b> {zeile.wort}
            </>
          ) : (
            <>
              {zeile.wort} <b className="spr-t">{zeile.wert}</b>
            </>
          )}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ PP und Vertrag (Kurzfassung) */

function PpTafel({ data, modell, onTab }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell; onTab: (tab: "performance") => void }) {
  const raenge = modell.raenge;
  const gesamt = raenge?.ppGesamt ?? data.seasonPerformance?.totalPoints ?? null;
  const achseVon = (id: string) => kategorieAchse(data.disciplineValues.find((zeile) => zeile.id === id)?.category);
  const aktuell = modell.gameState ? Number(modell.gameState.matchdayState.matchdayId.match(/(\d+)/)?.[1] ?? NaN) || null : null;
  return (
    <Tafel
      titel="Player Points"
      klein="gebucht, laufende Saison"
      rechts={
        <button type="button" className="spr-kn" onClick={() => onTab("performance")}>
          Leistung ›
        </button>
      }
      testId="spielerprofil-pp"
    >
      <div className="spr-ppk">
        <strong className="spr-t">{zahl(gesamt, 1)}</strong>
        <small>
          PP in dieser Saison
          <br />
          {raenge?.ppGesamtLigaRang != null ? (
            <>
              Rang <b>#{raenge.ppGesamtLigaRang}</b> von {raenge.ppGesamtLigaVon} {raenge.ligaAktiv ? "in der Liga" : "unter allen Aktiven"}
            </>
          ) : (
            "noch ohne Rang"
          )}
        </small>
      </div>
      <PpBalken reihe={modell.ppReihe} achseVon={achseVon} aktuellerSpieltag={aktuell} />
      <div className="spr-zeile">
        <span>Einsätze</span>
        <strong className="spr-t">{zahl(data.seasonPerformance?.appearances ?? modell.ppReihe.length, 0)}</strong>
      </div>
      <div className="spr-zeile">
        <span>
          Beste Disziplin<small>nach PP</small>
        </span>
        <strong>{data.seasonPerformance?.bestDisciplineLabel ?? "—"}</strong>
      </div>
      <span className="spr-gk">Ziellinie {PP_ZIELLINIE}: Top-Spieler einer Disziplin liegen um diesen Wert</span>
    </Tafel>
  );
}

function VertragTafel({ data, onTab }: { data: PlayerDetailDrawerData; onTab: (tab: "contract") => void }) {
  const jeSpieltag = gehaltJeSpieltag(data.salary);
  return (
    <Tafel
      titel="Vertrag"
      klein={data.teamName ?? "vertragslos"}
      rechts={
        <button type="button" className="spr-kn" onClick={() => onTab("contract")}>
          Vertrag ›
        </button>
      }
      testId="spielerprofil-vertrag-kurz"
    >
      <div className="spr-vz">
        <div>
          <strong className="spr-t">{geld(data.salary, 1)}</strong>
          <small>Gehalt je Saison</small>
          <small data-testid="spielerprofil-gehalt-spieltag-kurz">{geld(jeSpieltag, 2)} je Spieltag</small>
        </div>
        <div>
          <strong className="spr-t">{data.contractLength != null ? `${data.contractLength} J.` : "—"}</strong>
          <small>Restlaufzeit</small>
        </div>
      </div>
      <div className="spr-zeile">
        <span>Marktwert</span>
        <strong className="spr-t">{geld(data.marketValue, 1)}</strong>
      </div>
      <div className="spr-zeile">
        <span>Kaufpreis</span>
        <strong className="spr-t">{geld(data.purchasePrice, 1)}</strong>
      </div>
      <div className="spr-zeile">
        <span>
          Verkaufswert<small>erwartet</small>
        </span>
        <strong className="spr-t">{geld(data.transferContext.expectedSellValue, 1)}</strong>
      </div>
      <div className="spr-hinweis" data-testid="spielerprofil-freigabe-platz">
        <b>Vorstand-Freigabe</b> für Verlängerung, Gehaltserhöhung und Verkauf: {data.boardTrust ? `Vertrauen ${zahl(data.boardTrust.trustScore, 1)}. ` : ""}
        Die Quote erscheint hier, sobald die Finanz-Stufe live ist.
      </div>
    </Tafel>
  );
}

export function TabUeberblick({
  data,
  modell,
  onTab,
  onOpenDisziplin,
}: {
  data: PlayerDetailDrawerData;
  modell: SpielerprofilModell;
  onTab: (tab: "performance" | "contract") => void;
  onOpenDisziplin: (id: string) => void;
}) {
  return (
    <div className="spr-tab spr-t-ueberblick" data-testid="spielerprofil-tab-ueberblick">
      <FigurBuehne data={data} modell={modell} />
      <div className="spr-zust">
        <FormKarte modell={modell} />
        <MoralKarte data={data} modell={modell} />
        <EinsatzKarte data={data} modell={modell} />
      </div>
      <div className="spr-mitte">
        <AttributeTafel data={data} modell={modell} />
        <ExperteTafel data={data} modell={modell} onOpenDisziplin={onOpenDisziplin} />
      </div>
      <div className="spr-rechts">
        <PpTafel data={data} modell={modell} onTab={onTab} />
        <VertragTafel data={data} onTab={onTab} />
      </div>
      {modell.nebel ? (
        <div style={{ gridColumn: "1 / -1" }}>
          <NebelBand />
        </div>
      ) : null}
    </div>
  );
}
