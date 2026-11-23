"use client";

/**
 * Reiter des KURZPROFILS (Drawer), 21.11. (Chris: „im Drawer fehlen noch so einzelne Reiter wie Entwicklung … aus dem
 * Spielerprofil in klein, mit nur den wichtigsten Punkten“). Jeder Reiter hat sein Gegenstück im ganzen Profil und
 * liest dieselben Quellen (`PlayerDetailDrawerData`, `useSpielerprofilModell`, `baueKurzEntwicklung`); nichts wird zweimal
 * gerechnet. Fremde Spieler bleiben im Scouting-Nebel (feste Stufen, keine verdeckten Zahlen).
 */
import { BcFormPfeil, BcMoralGesicht } from "@/components/foundation/broadcast";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import type { PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import type { KurzEntwicklung } from "@/lib/foundation/spielerprofil-kurz-entwicklung";
import { ACHSEN, ATTRIBUT_LABEL, PP_ZIELLINIE, gehaltJeSpieltag, grobBereich, grobeRangStufe } from "@/lib/foundation/spielerprofil-modell";
import { moralStufe } from "@/lib/morale/moral-anzeige";
import { formatLeagueTierShortLabel } from "@/lib/season/league-history";
import { bremsGrundText } from "@/lib/training/training-modern-modell";
import { getTrainingModePresentation } from "@/lib/training/training-mode-presentation";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { PpBalken, achseKlasse, geld, kategorieAchse, zahl } from "./bausteine";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";

export type KurzReiterId = "ueberblick" | "disziplinen" | "entwicklung" | "leistung" | "vertrag" | "karriere";

/** Reiter des Drawers und der Reiter im ganzen Profil, in den der „Voller Bericht“-Link springt. */
export const KURZ_REITER: ReadonlyArray<{ id: KurzReiterId; label: string; voll: PlayerProfileTabId }> = [
  { id: "ueberblick", label: "Überblick", voll: "overview" },
  { id: "disziplinen", label: "Disziplinen", voll: "disciplines" },
  { id: "entwicklung", label: "Entwicklung", voll: "development" },
  { id: "leistung", label: "Leistung", voll: "performance" },
  { id: "vertrag", label: "Vertrag", voll: "contract" },
  { id: "karriere", label: "Karriere", voll: "career" },
];

type Gemeinsam = { data: PlayerDetailDrawerData; modell: SpielerprofilModell };

function vz(wert: number | null | undefined, stellen = 1): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  const text = zahl(Math.abs(wert), stellen);
  return wert > 0 ? `+${text}` : wert < 0 ? `−${text}` : text;
}

function Abschnitt({ titel, klein, children, testId }: { titel: string; klein?: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="spr-dr-ab" data-testid={testId}>
      <header>
        <span className="spr-gk">{titel}</span>
        {klein ? <small>{klein}</small> : null}
      </header>
      {children}
    </section>
  );
}

function VollerBericht({ voll, onOpenFull }: { voll: PlayerProfileTabId; onOpenFull: (tab: PlayerProfileTabId) => void }) {
  return (
    <button type="button" className="spr-dr-voll" onClick={() => onOpenFull(voll)} data-testid={`spielerkurzprofil-voll-${voll}`}>
      Voller Bericht ›
    </button>
  );
}

/* ------------------------------------------------------------------ Kopfteil: Porträt + Figur, Kacheln */

const OVR_STUFEN = [
  { ab: 80, klasse: "is-s" },
  { ab: 65, klasse: "is-a" },
  { ab: 50, klasse: "is-b" },
  { ab: 0, klasse: "is-c" },
];

/** Porträt im OVR-Rahmen (Chris, Welle 3): Rahmenfarbe = Stufe des Gesamtwerts, die Zahl sitzt am unteren Rand. Im Nebel nur der Bereich. */
export function PortraetRahmen({ data, modell }: Gemeinsam) {
  const stufe = OVR_STUFEN.find((eintrag) => (data.ovr ?? 0) >= eintrag.ab)?.klasse ?? "is-c";
  const ovrText = modell.nebel ? (grobBereich(data.ovr, modell.nebelBreite) ?? "?") : zahl(data.ovr, 0);
  return (
    <div className={`spr-dr-port ${modell.nebel ? "is-c" : stufe}`} data-testid="spielerkurzprofil-portraet">
      {data.portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.portraitUrl} alt={data.name} />
      ) : (
        <span className="spr-dr-port__leer" aria-hidden="true">
          {data.name.slice(0, 1)}
        </span>
      )}
      <div className="spr-dr-port__ovr">
        <b className="spr-t">{ovrText}</b>
        <small>OVR</small>
      </div>
    </div>
  );
}

export function Kennzahlen({ data, modell }: Gemeinsam) {
  const raenge = modell.raenge;
  const nebel = modell.nebel;
  const gesamt = raenge?.ppGesamt ?? data.seasonPerformance?.totalPoints ?? null;
  const kachel = (name: string, wert: string, rang: number | null | undefined, testId: string) => (
    <div data-testid={testId}>
      <strong className="spr-t">{wert}</strong>
      <small>
        {name}
        {rang != null && !nebel ? ` · Rang #${rang}` : ""}
      </small>
    </div>
  );
  return (
    <div className="spr-vz" data-testid="spielerkurzprofil-kennzahlen">
      {kachel("OVR", nebel ? (grobBereich(data.ovr, modell.nebelBreite) ?? "?") : zahl(data.ovr, 0), data.ovrRank, "spielerkurzprofil-kachel-ovr")}
      {kachel("MVS", nebel ? (grobBereich(data.mvs, modell.nebelBreite) ?? "?") : zahl(data.mvs, 1), data.mvsRank, "spielerkurzprofil-kachel-mvs")}
      {kachel("PP", zahl(gesamt, 1), raenge?.ppGesamtLigaRang ?? data.ppsRank, "spielerkurzprofil-kachel-pp")}
    </div>
  );
}

/* ------------------------------------------------------------------ Reiter Überblick */

function FormMoral({ data, modell }: Gemeinsam) {
  const form = modell.form;
  const moral = form?.moral ?? data.morale?.morale ?? null;
  const stufe = moral != null ? moralStufe(moral) : null;
  const gruende = modell.moralGruende.slice(0, 2);
  return (
    <div className="spr-dr-zwei" data-testid="spielerkurzprofil-form-moral">
      <section className="spr-dr-zk" data-testid="spielerkurzprofil-form">
        <span className="spr-gk">Form</span>
        {form?.formVerfuegbar ? (
          <>
            <div className="spr-dr-zk__gross">
              <BcFormPfeil stufe={form.formStufe} />
              {modell.nebel ? null : <strong className="spr-t">{zahl(form.form, 0)}</strong>}
              <b>{form.formWort}</b>
            </div>
            {modell.nebel ? <small>ohne Scouting nicht sichtbar</small> : <small>{vz(form.formPct, 2)} % auf die Eignung</small>}
          </>
        ) : (
          <small>Noch kein Formwert, er entsteht mit dem ersten Einsatz.</small>
        )}
      </section>
      <section className="spr-dr-zk" data-testid="spielerkurzprofil-moral">
        <span className="spr-gk">Moral</span>
        {moral != null ? (
          <>
            <div className="spr-dr-zk__gross">
              <BcMoralGesicht wert={moral} mitZahl={false} groesse={30} />
              {modell.nebel ? null : <strong className="spr-t">{zahl(moral, 0)}</strong>}
              <b>{stufe?.wort ?? "—"}</b>
            </div>
            {modell.nebel ? (
              <small>Gründe ohne Scouting nicht sichtbar</small>
            ) : gruende.length > 0 ? (
              gruende.map((grund) => (
                <small key={grund.id} className="spr-dr-grund">
                  <span>{grund.label}</span>
                  <b className={grund.delta >= 0 ? "is-plus" : "is-minus"}>{vz(grund.delta, 1)}</b>
                </small>
              ))
            ) : (
              <small>Keine auffälligen Gründe.</small>
            )}
          </>
        ) : (
          <small>Noch keine Moral erfasst.</small>
        )}
      </section>
    </div>
  );
}

/** Die vier Achsen untereinander (vertikal gestapelt), je Achse Balken, Wert und die drei Attribute. */
function AchsenListe({ data, modell }: Gemeinsam) {
  const zeilen = new Map(data.attributeStats.map((zeile) => [zeile.key, zeile] as const));
  return (
    <div className="spr-dr-achsen" data-testid="spielerkurzprofil-achsen">
      {ACHSEN.map((achse) => {
        const karte = data.axisCards.find((eintrag) => eintrag.id === achse.id);
        const wert = karte?.value ?? null;
        return (
          <div key={achse.id} className={`spr-dr-achse ${achseKlasse(achse.id)}`}>
            <div className="spr-dr-achse__kopf">
              <b>{achse.label}</b>
              <div className="spr-bn">
                <i style={{ width: `${modell.nebel || wert == null ? 0 : Math.min(100, wert)}%` }} />
              </div>
              <strong className="spr-t">{modell.nebel ? "?" : zahl(wert, 0)}</strong>
            </div>
            <div className="spr-dr-achse__att">
              {achse.attribute.map((attribut) => {
                const zeile = zeilen.get(attribut);
                const anzeige = zeile?.value != null ? zahl(zeile.value, 0) : (zeile?.rangeLabel ?? zeile?.ratingLabel ?? "?");
                return (
                  <span key={attribut} data-attribut={attribut}>
                    {ATTRIBUT_LABEL[attribut]} <b className="spr-t">{anzeige}</b>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Staerken({ data, modell, onOpenFull }: Gemeinsam & { onOpenFull: (tab: PlayerProfileTabId, disziplinId?: string) => void }) {
  const raenge = modell.raenge;
  const liste = modell.nebel
    ? [...data.disciplineValues].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).slice(0, 3).map((zeile) => ({ id: zeile.id, label: zeile.label, wert: zeile.value, achse: kategorieAchse(zeile.category), weg: null as string | null }))
    : modell.experte.slice(0, 3).map((e) => ({ id: e.disziplinId, label: e.label, wert: e.wert, achse: e.achse, weg: e.weg.istPrimaer ? "Primärweg" : "Nebenweg" }));
  if (liste.length === 0) return null;
  return (
    <Abschnitt titel="Hier ist er stark" klein={modell.nebel ? "grob gescoutet" : "beste Disziplinen"} testId="spielerkurzprofil-staerken">
      <div className="spr-dr-liste">
        {liste.map((eintrag) => {
          const rang = raenge?.disziplinen.get(eintrag.id);
          const rangText = modell.nebel ? (grobeRangStufe(rang?.aktivRang, rang?.aktivVon) ?? "") : rang?.ligaRang != null ? `Liga #${rang.ligaRang}` : "";
          return (
            <button key={eintrag.id} type="button" className={`spr-dr-zl ${achseKlasse(eintrag.achse)}`} onClick={() => onOpenFull("disciplines", eintrag.id)}>
              <i aria-hidden="true" />
              <span>
                {eintrag.label}
                {eintrag.weg ? <small>{eintrag.weg}</small> : null}
              </span>
              <small>{rangText}</small>
              <b className="spr-t">{modell.nebel ? (grobBereich(eintrag.wert, modell.nebelBreite) ?? "?") : zahl(eintrag.wert, 0)}</b>
            </button>
          );
        })}
      </div>
    </Abschnitt>
  );
}

export function ReiterUeberblick({ data, modell, onOpenFull }: Gemeinsam & { onOpenFull: (tab?: PlayerProfileTabId, disziplinId?: string) => void }) {
  const verletzt = modell.verletzung.verletzt;
  return (
    <>
      <FormMoral data={data} modell={modell} />
      {verletzt ? (
        <div className="spr-dr-hinweis is-rot" data-testid="spielerkurzprofil-verletzt">
          {modell.verletzung.halbeDisziplinen.length > 0
            ? `In ${modell.verletzung.halbeDisziplinen.map((d) => d.name).join(", ")} zählte beim Verletzungsspiel nur die Hälfte (× 50 %).`
            : "Weder Mensch noch KI darf ihn aufstellen, solange er verletzt ist."}
        </div>
      ) : data.fatigue != null && data.teamId ? (
        <div className="spr-dr-hinweis" data-testid="spielerkurzprofil-belastung">
          Erschöpfung <b className="spr-t">{zahl(data.fatigue, 0)}</b> · Verletzungsrisiko <b className="spr-t">{zahl(data.availability.injuryRiskPercent, 0)} %</b>
        </div>
      ) : null}
      <Abschnitt titel="Attribute" klein={modell.nebel ? "Bereiche statt Werte" : "vier Achsen, zwölf Werte"}>
        <AchsenListe data={data} modell={modell} />
      </Abschnitt>
      <Staerken data={data} modell={modell} onOpenFull={onOpenFull} />
      <VollerBericht voll="overview" onOpenFull={onOpenFull} />
    </>
  );
}

/* ------------------------------------------------------------------ Reiter Disziplinen */

export function ReiterDisziplinen({ data, modell, onOpenFull }: Gemeinsam & { onOpenFull: (tab?: PlayerProfileTabId, disziplinId?: string) => void }) {
  const raenge = modell.raenge;
  const nebel = modell.nebel;
  const nachWert = [...data.disciplineValues].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const top4 = new Set(nachWert.slice(0, 4).map((zeile) => zeile.id));
  const ordnung = ["power", "speed", "mental", "social"];
  const sortiert = [...data.disciplineValues].sort((a, b) => ordnung.indexOf(a.category) - ordnung.indexOf(b.category) || (b.value ?? -1) - (a.value ?? -1));
  return (
    <>
      <Abschnitt titel="20 Disziplinen" klein="Eignung und Rang in der Liga" testId="spielerkurzprofil-disziplinen">
        <div className="spr-dr-d20">
          {sortiert.map((zeile) => {
            const rang = raenge?.disziplinen.get(zeile.id);
            return (
              <button
                key={zeile.id}
                type="button"
                className={`${achseKlasse(kategorieAchse(zeile.category))}${top4.has(zeile.id) && !nebel ? " is-top" : ""}`}
                onClick={() => onOpenFull("disciplines", zeile.id)}
                title={`${zeile.label}: im Profil erklären`}
              >
                <span>{zeile.label}</span>
                <b className="spr-t">{nebel ? (grobBereich(zeile.value, modell.nebelBreite) ?? "?") : zahl(zeile.value, 0)}</b>
                <small>{nebel ? (grobeRangStufe(rang?.aktivRang, rang?.aktivVon) ?? "") : rang?.ligaRang != null ? `Liga #${rang.ligaRang}` : ""}</small>
              </button>
            );
          })}
        </div>
      </Abschnitt>
      <VollerBericht voll="disciplines" onOpenFull={onOpenFull} />
    </>
  );
}

/* ------------------------------------------------------------------ Reiter Entwicklung */

const AUSBLICK: Record<string, string> = {
  breakout: "Durchbruch",
  growth: "Wachstum",
  stable: "stabil",
  stagnation: "Stagnation",
  regression_risk: "Rückschritt-Risiko",
};

const MODI: PlayerTrainingMode[] = ["leicht", "mittel", "hart"];

export function ReiterEntwicklung({
  data,
  modell,
  entwicklung,
  eigener,
  onOpenFull,
}: Gemeinsam & { entwicklung: KurzEntwicklung | null; eigener: boolean; onOpenFull: (tab?: PlayerProfileTabId) => void }) {
  const insight = data.developmentInsight;
  const spanne = insight?.potentialRangeDisplay ?? null;
  const nebel = modell.nebel;
  const aenderungen = nebel
    ? []
    : data.baselineAttributeDeltas
        .filter((zeile) => zeile.delta != null && Math.abs(zeile.delta) >= 0.05)
        .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
        .slice(0, 3);
  return (
    <>
      <Abschnitt titel="Potenzial" klein={nebel ? "geschätzt" : "Scouting-Einschätzung"} testId="spielerkurzprofil-potenzial">
        <div className="spr-dr-pot">
          <div>
            <strong className="spr-t">{nebel ? (grobBereich(insight?.currentRating ?? data.ovr, modell.nebelBreite) ?? "?") : zahl(insight?.currentRating ?? data.ovr, 0)}</strong>
            <small>Stärke heute</small>
          </div>
          <span aria-hidden="true">›</span>
          <div>
            <strong className="spr-t is-gold">{spanne ? `${zahl(spanne.min, 0)}–${zahl(spanne.max, 0)}` : "?"}</strong>
            <small>Potenzial{data.potentialStarsDisplay ? ` · ${data.potentialStarsDisplay.split(" (")[0]}` : ""}</small>
          </div>
        </div>
        <div className="spr-zeile">
          <span>Ausblick</span>
          <strong>{insight ? (AUSBLICK[insight.growthOutlook] ?? insight.growthOutlook) : "—"}</strong>
        </div>
        <div className="spr-zeile">
          <span>Aufdeckung</span>
          <strong className="spr-t">{zahl(data.revealConfidencePct, 0)} %</strong>
        </div>
      </Abschnitt>

      <Abschnitt titel="Training" klein={eigener ? "dein Plan" : "nur eigene Spieler"} testId="spielerkurzprofil-training">
        {!eigener || nebel ? (
          <div className="spr-leer">Das Training eines fremden Spielers siehst du nicht.</div>
        ) : !entwicklung ? (
          <div className="spr-leer">Für diesen Spieler gibt es noch keine Trainingsrechnung.</div>
        ) : (
          <TrainingKurz entwicklung={entwicklung} />
        )}
      </Abschnitt>

      {aenderungen.length > 0 ? (
        <Abschnitt titel="Seit Saisonstart" klein="größte Veränderungen" testId="spielerkurzprofil-aenderungen">
          {aenderungen.map((zeile) => (
            <div key={zeile.key} className="spr-zeile">
              <span>
                {zeile.label}
                <small>
                  {zahl(zeile.baselineValue, 0)} → {zahl(zeile.currentValue, 0)}
                </small>
              </span>
              <strong className={`spr-t ${(zeile.delta ?? 0) >= 0 ? "is-plus" : "is-minus"}`}>{vz(zeile.delta, 1)}</strong>
            </div>
          ))}
        </Abschnitt>
      ) : null}
      <VollerBericht voll="development" onOpenFull={onOpenFull} />
    </>
  );
}

function TrainingKurz({ entwicklung }: { entwicklung: KurzEntwicklung }) {
  const { ziel, bremse, wunsch } = entwicklung;
  return (
    <div className="spr-dr-trn">
      <div className="spr-zeile">
        <span>Ziel</span>
        <strong>
          {ziel ? ziel.label : "kein Ziel"}
          {ziel ? <u className={`spr-wegmarke${ziel.art === "primaer" ? "" : " is-neben"}`}>{ziel.art === "primaer" ? "Primärweg" : "Nebenweg"}</u> : null}
        </strong>
      </div>
      {ziel ? (
        <div className="spr-zeile">
          <span>Gesetzt von</span>
          <strong>{ziel.quelle === "manager" ? "dir" : "KI-Vorschlag"}</strong>
        </div>
      ) : null}
      {entwicklung.profil.length > 0 ? (
        <div className="spr-dr-chips" aria-label="Schwerpunkt">
          {entwicklung.profil.map((eintrag) => (
            <span key={eintrag.attribute}>
              {eintrag.label} <b className="spr-t">{Math.round(eintrag.anteil * 100)} %</b>
            </span>
          ))}
        </div>
      ) : null}
      <div className="spr-zeile">
        <span>Intensität</span>
        <span className="spr-seg" role="group" aria-label="Trainingsintensität">
          {MODI.map((modus) => (
            <span key={modus} className={entwicklung.modus === modus ? "is-an" : undefined}>
              {getTrainingModePresentation(modus).label}
            </span>
          ))}
        </span>
      </div>
      {entwicklung.verletzt ? (
        <div className="spr-dr-hinweis is-rot">Verletzt: am nächsten Spieltag gesperrt, kein Zuwachs.</div>
      ) : (
        <>
          <div className="spr-zeile" data-testid="spielerkurzprofil-zuwachs">
            <span>
              Zuwachs je Spieltag<small>nächster Spieltag</small>
            </span>
            <strong className="spr-t is-plus">{vz(entwicklung.zuwachsJeSpieltag, 2)}</strong>
          </div>
          {entwicklung.zuwachsAttribute.slice(0, 3).map((eintrag) => (
            <div key={eintrag.attribute} className="spr-zeile spr-dr-unter">
              <span>{eintrag.label}</span>
              <strong className="spr-t">{vz(eintrag.wert, 2)}</strong>
            </div>
          ))}
          <div className="spr-zeile" data-testid="spielerkurzprofil-potenzialfaktor">
            <span>
              Potenzial-Faktor<small>Beschleuniger, nie Bremse</small>
            </span>
            <strong className="spr-t">{entwicklung.potenzialFaktor != null ? `× ${zahl(entwicklung.potenzialFaktor, 2)}` : "× 1,00"}</strong>
          </div>
          <div className={`spr-zeile${bremse ? " is-bremse" : ""}`} data-testid="spielerkurzprofil-bremse" title={bremse?.attribute.map(bremsGrundText).join(". ")}>
            <span>
              Maximum-Bremse<small>{bremse ? (bremse.mitMaximum ? "Attribut am Maximum 99" : "Attribut am Limit") : "keine"}</small>
            </span>
            <strong className={`spr-t ${bremse ? "is-minus" : "is-stumm"}`}>{bremse ? `−${bremse.verlustProzent} %` : "—"}</strong>
          </div>
        </>
      )}
      {wunsch ? (
        <div className="spr-zeile" data-testid="spielerkurzprofil-wunsch">
          <span>
            Wunsch des Spielers<small>{wunsch.erfuellt ? `erfüllt · +${zahl(wunsch.moraleReward, 0)} Moral` : `offen · ${zahl(wunsch.moralePenalty, 0)} Moral`}</small>
          </span>
          <strong>{getTrainingModePresentation(wunsch.modus).label}</strong>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Reiter Leistung */

export function ReiterLeistung({ data, modell, onOpenFull }: Gemeinsam & { onOpenFull: (tab?: PlayerProfileTabId) => void }) {
  const raenge = modell.raenge;
  const gesamt = raenge?.ppGesamt ?? data.seasonPerformance?.totalPoints ?? null;
  const einsaetze = modell.ppReihe.length;
  const proEinsatz = gesamt != null && einsaetze > 0 ? gesamt / einsaetze : null;
  const achseVon = (id: string) => kategorieAchse(data.disciplineValues.find((zeile) => zeile.id === id)?.category);
  const aktuell = modell.gameState ? Number(modell.gameState.matchdayState.matchdayId.match(/(\d+)/)?.[1] ?? NaN) || null : null;
  const halbVon = new Set<string>();
  for (const zeile of data.injuryHistoryRows ?? []) {
    for (const disziplin of zeile.disciplines) halbVon.add(`${zeile.matchdayId}::${disziplin.disciplineId}`);
  }
  const zeilen = [...modell.ppReihe].reverse().flatMap((spieltag) => spieltag.eintraege.map((eintrag) => ({ spieltag, eintrag })));
  return (
    <>
      <Abschnitt titel="Player Points" klein="gebucht, laufende Saison" testId="spielerkurzprofil-pp">
        <div className="spr-dr-ppk">
          <strong className="spr-t">{zahl(gesamt, 1)}</strong>
          <small>
            {raenge?.ppGesamtLigaRang != null ? (
              <>
                Rang <b>#{raenge.ppGesamtLigaRang}</b> von {raenge.ppGesamtLigaVon}
              </>
            ) : (
              "noch ohne Rang"
            )}
            <br />
            {zahl(einsaetze, 0)} Einsätze · {zahl(proEinsatz, 2)} je Einsatz
          </small>
        </div>
        <PpBalken reihe={modell.ppReihe} achseVon={achseVon} aktuellerSpieltag={aktuell} />
        <small className="spr-dr-leise">Ziellinie {PP_ZIELLINIE}: Top-Spieler einer Disziplin.</small>
      </Abschnitt>
      <Abschnitt titel="Alle Spieltage" klein={`${zeilen.length} Einsätze, neuester oben`} testId="spielerkurzprofil-einsaetze">
        <div className="spr-dr-pl">
          {zeilen.map(({ spieltag, eintrag }) => {
            const halb = halbVon.has(`${spieltag.matchdayId}::${eintrag.disziplinId}`);
            return (
              <div key={`${spieltag.matchdayId}-${eintrag.disziplinId}-${eintrag.seite}`} className={`spr-dr-pz ${achseKlasse(achseVon(eintrag.disziplinId))}${halb ? " is-verletzt" : ""}`}>
                <span className="spr-t">Tag {spieltag.nummer ?? "—"}</span>
                <span>
                  <i aria-hidden="true" />
                  {modell.disziplinLabel(eintrag.disziplinId)}
                  {halb ? <small className="spr-halb">verletzt · × 50 %</small> : null}
                </span>
                <small className="spr-t">{eintrag.rangAmSpieltag != null ? `#${eintrag.rangAmSpieltag}` : ""}</small>
                <strong className="spr-t">{zahl(eintrag.pp, 1)}</strong>
              </div>
            );
          })}
          {zeilen.length === 0 ? <div className="spr-leer">Noch kein Einsatz in dieser Saison.</div> : null}
        </div>
      </Abschnitt>
      <VollerBericht voll="performance" onOpenFull={onOpenFull} />
    </>
  );
}

/* ------------------------------------------------------------------ Reiter Vertrag */

const ABSICHT: Record<string, string> = {
  willing_to_extend: "verlängerungsbereit",
  short_term_only: "nur kurz binden",
  demands_raise: "fordert Aufwertung",
  considering_exit: "denkt an Wechsel",
  refuses_extension: "blockt Verlängerung",
  neutral: "neutral",
};

export function ReiterVertrag({ data, modell, onOpenFull }: { data: PlayerDetailDrawerData; modell: SpielerprofilModell; onOpenFull: (tab?: PlayerProfileTabId) => void }) {
  const absicht = data.morale?.contractIntent ? (ABSICHT[data.morale.contractIntent] ?? data.morale.contractIntent) : null;
  const forderungen = data.demands.filter((eintrag) => eintrag.status === "open" || eintrag.status === "at_risk").slice(0, 2);
  return (
    <>
      <Abschnitt titel="Gehalt" klein={data.teamName ?? "vertragslos"} testId="spielerkurzprofil-gehalt">
        <div className="spr-dr-gehalt">
          <strong className="spr-t" data-testid="spielerkurzprofil-gehalt-saison">
            {geld(data.salary, 1)}
          </strong>
          <small>Gehalt je Saison</small>
          <small className="spr-t" data-testid="spielerkurzprofil-gehalt-spieltag">
            {geld(gehaltJeSpieltag(data.salary), 2)} je Spieltag
          </small>
        </div>
        <div className="spr-zeile">
          <span>Restlaufzeit</span>
          <strong className="spr-t">{data.contractLength != null ? `${data.contractLength} J.` : "—"}</strong>
        </div>
        {absicht ? (
          <div className="spr-zeile">
            <span>Absicht</span>
            <strong>{absicht}</strong>
          </div>
        ) : null}
      </Abschnitt>
      <Abschnitt titel="Wert" testId="spielerkurzprofil-wert">
        <div className="spr-zeile">
          <span>Marktwert</span>
          <strong className="spr-t">{geld(data.marketValue, 1)}</strong>
        </div>
        {modell.marketability ? (
          <div className="spr-zeile" data-testid="spielerkurzprofil-marketability" title="Marketability für dein Team (Fanprofil), Stufe nach Scouting; dieselbe Rechnung wie im Transfermarkt und im Draft">
            <span>Marketability<small>für dein Team</small></span>
            <strong className="spr-t">{modell.marketability.text}</strong>
          </div>
        ) : null}
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
      </Abschnitt>
      {forderungen.length > 0 ? (
        <Abschnitt titel="Forderungen" klein="offen" testId="spielerkurzprofil-forderungen">
          {forderungen.map((eintrag) => (
            <div key={eintrag.demandId} className="spr-zeile">
              <span>{eintrag.label}</span>
              <strong className="spr-t is-plus">+{zahl(eintrag.moraleReward, 0)}</strong>
            </div>
          ))}
        </Abschnitt>
      ) : null}
      <VollerBericht voll="contract" onOpenFull={onOpenFull} />
    </>
  );
}

/* ------------------------------------------------------------------ Reiter Karriere */

export function ReiterKarriere({ data, onOpenFull }: { data: PlayerDetailDrawerData; onOpenFull: (tab?: PlayerProfileTabId) => void }) {
  const saisons = [...data.historyRows].reverse().slice(0, 4);
  const preise = data.seasonAwards.slice(-3).reverse();
  const wechsel = data.transferHistory.slice(0, 3);
  return (
    <>
      <Abschnitt titel="Saison für Saison" klein="letzte Saisons" testId="spielerkurzprofil-saisons">
        {saisons.map((zeile) => (
          <div key={`${zeile.seasonId ?? zeile.seasonName}-${zeile.teamCode ?? ""}`} className={`spr-zeile${zeile.isActiveSeason ? " is-aktiv" : ""}`}>
            <span>
              {zeile.seasonName}
              <small>
                {zeile.teamName ?? zeile.teamCode ?? "—"} · {formatLeagueTierShortLabel(zeile.leagueTier) ?? "—"} · {zahl(zeile.appearances, 0)} Einsätze
              </small>
            </span>
            <strong className="spr-t">
              {zahl(zeile.pps ?? zeile.totalPoints, 1)} PP{zeile.ppsRank != null ? <small> #{zeile.ppsRank}</small> : null}
            </strong>
          </div>
        ))}
        {saisons.length === 0 ? <div className="spr-leer">Noch keine abgeschlossene Saison.</div> : null}
      </Abschnitt>
      <Abschnitt titel="Auszeichnungen" klein={`${data.seasonAwards.length}`} testId="spielerkurzprofil-auszeichnungen">
        {preise.map((preis) => (
          <div key={`${preis.seasonId}-${preis.awardId}`} className="spr-zeile">
            <span>
              {preis.icon} {preis.label}
              <small>{preis.seasonName}</small>
            </span>
            <strong className="spr-t">{preis.value != null ? String(preis.value) : ""}</strong>
          </div>
        ))}
        {preise.length === 0 ? <div className="spr-leer">Noch keine Auszeichnung.</div> : null}
      </Abschnitt>
      <Abschnitt titel="Wechsel" klein="Kauf, Verkauf (auch Vertragsende)" testId="spielerkurzprofil-wechsel">
        {wechsel.map((eintrag) => (
          <div key={eintrag.id} className="spr-zeile">
            <span>
              {eintrag.transferType === "buy" ? "Kauf" : eintrag.transferType === "sell" ? "Verkauf" : "Verkauf (Vertragsende)"} · {eintrag.seasonLabel}
              <small>{eintrag.toTeamName ?? eintrag.fromTeamName ?? "—"}</small>
            </span>
            <strong className="spr-t">{geld(eintrag.fee, 1)}</strong>
          </div>
        ))}
        {wechsel.length === 0 ? <div className="spr-leer">Kein Wechsel bisher.</div> : null}
      </Abschnitt>
      <VollerBericht voll="career" onOpenFull={onOpenFull} />
    </>
  );
}
