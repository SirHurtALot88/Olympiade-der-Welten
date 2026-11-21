"use client";

/**
 * SAISON-EINSTIEG im Designsystem der modernen Seiten (21.11., Chris). Inhalte unverändert (Faktor, Spieltage, Team-Achsen, Cash,
 * Spieltags-Reihenfolge, große Diszis, Farb-Dopplungen), Optik nach docs/design/oly-seiten-modern-17-11.md: Broadcast-Tokens
 * (`.bc`), Barlow-Zahlen, Karten, Disziplin-Icons aus public/discipline-icons. Die Disziplinen stehen in Spielplan-Reihenfolge,
 * Viererdisziplinen (Mini DM, Battlefield, Takeshi, Staffel) tragen eine „4er“-Marke.
 */
import type { CSSProperties, ReactNode } from "react";

import { getDisciplineIconSrc } from "@/app/foundation/DisciplineIcon";
import { isViererPodDiscipline } from "@/lib/season/season-discipline-schedule";

import "@/components/foundation/broadcast/broadcast.css";
import "./saison-info-modern.css";

export type SaisonInfoDisziplin = {
  id?: string | null;
  name: string | null | undefined;
  playerCount: number | null | undefined;
  category: string | null | undefined;
  color: string;
};

export type SaisonInfoSpieltag = {
  matchdayId: string;
  label: string;
  disciplines: SaisonInfoDisziplin[];
  sameColor: boolean;
  totalSlots: number | null;
  isHeavyRoster: boolean;
  isHeavySameColor: boolean;
};

export type SaisonInfoGross = {
  matchdayId: string;
  matchdayLabel: string;
  disciplineId?: string | null;
  displayName?: string | null;
  playerCount?: number | null;
  color: string;
};

export type SaisonInfoModernProps = {
  saisonName: string;
  bereit: boolean;
  faktor: number | null;
  spieltage: number;
  teamAchsen: string;
  teamKuerzel: string | null;
  cash: ReactNode;
  plan: SaisonInfoSpieltag[];
  grosse: SaisonInfoGross[];
  doppelungen: SaisonInfoSpieltag[];
  kuenftigeFaktoren: Array<{ label: string; factor: number }>;
  kategorieLabel: (kategorie: string | null | undefined) => string;
  zahl: (wert: number, stellen: number) => string;
  onSpaeter: () => void;
  onDiszis: () => void;
  onErledigt: () => void;
};

function farbe(c: string): string {
  return c === "red" ? "pow" : c === "green" ? "spe" : c === "blue" ? "men" : c === "yellow" ? "soc" : "neutral";
}

function spieltagNr(label: string, index: number): string {
  const m = label.match(/(\d+)\s*$/);
  return m ? m[1]! : String(index + 1);
}

function DisziIcon({ id, name }: { id?: string | null; name?: string | null }) {
  const src = getDisciplineIconSrc(id ?? null, name ?? null);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="sai-icon" src={src} alt="" width={40} height={40} loading="lazy" />
  ) : (
    <span className="sai-icon sai-icon--leer" aria-hidden="true">{(name ?? "?").slice(0, 2).toUpperCase()}</span>
  );
}

export default function SaisonInfoModern(p: SaisonInfoModernProps) {
  const reveal = (i: number) => ({ "--sai-i": i }) as CSSProperties;
  return (
    <div
      className="foundation-modal-backdrop season-briefing-backdrop sai-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="season-briefing-title"
      data-testid="season-briefing-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) p.onSpaeter();
      }}
    >
      <section className="bc sai" data-testid="season-briefing-page">
        <header className="sai-kopf">
          <div className="sai-kopf__text">
            <span className="sai-eyebrow">Season-Einstieg</span>
            <h1 id="season-briefing-title" className="sai-titel">{p.saisonName}</h1>
            <p className="sai-lead">Lies die Saison-Vorschau durch und markiere sie danach als erledigt.</p>
          </div>
          <button type="button" className="sai-btn" onClick={p.onSpaeter}>Später</button>
        </header>

        <div className="sai-koerper">
          {!p.bereit ? (
            <p className="sai-leer" data-testid="season-briefing-loading">Diszi-Plan und Saison-Faktoren werden geladen …</p>
          ) : null}

          <div className="sai-kacheln" role="group" aria-label="Season-Faktoren">
            <article className="sai-kachel is-gold" style={reveal(0)}>
              <span className="sai-kachel__label">Salary Factor</span>
              <b className="sai-kachel__wert">{p.faktor != null ? `${p.zahl(p.faktor, 2)}x` : "—"}</b>
              <span className="sai-kachel__sub">Basis für Gehälter, Sponsoren und Forecast</span>
            </article>
            <article className="sai-kachel" style={reveal(1)}>
              <span className="sai-kachel__label">Spieltage</span>
              <b className="sai-kachel__wert">{p.zahl(p.spieltage, 0)}</b>
              <span className="sai-kachel__sub">Diszi-Paare in dieser Season</span>
            </article>
            <article className="sai-kachel" style={reveal(2)}>
              <span className="sai-kachel__label">POW / SPE / MEN / SOC</span>
              <b className="sai-kachel__wert sai-kachel__wert--achsen">{p.teamAchsen}</b>
              <span className="sai-kachel__sub">{p.teamKuerzel ? `${p.teamKuerzel} Team-Identity` : "Team wählen"}</span>
            </article>
            <article className="sai-kachel is-gut" style={reveal(3)}>
              <span className="sai-kachel__label">Cash</span>
              <b className="sai-kachel__wert">{p.cash}</b>
              <span className="sai-kachel__sub">Startbudget für Transfers</span>
            </article>
          </div>

          <div className="sai-spalten">
            <section className="sai-tafel sai-tafel--plan" aria-labelledby="sai-plan-titel">
              <header className="sai-tafel__kopf">
                <h2 id="sai-plan-titel">Spieltags-Reihenfolge</h2>
                <p>Alle Diszi-Paare der Season in Spielplan-Reihenfolge. <i className="sai-vier">4er</i> = Viererdisziplin; Farb-Dopplungen und Kaderdruck sind markiert.</p>
              </header>
              <div className="sai-plan">
                {p.bereit ? (
                  p.plan.map((tag, index) => (
                    <article
                      key={`sai-md-${tag.matchdayId}`}
                      className={`sai-tag${tag.sameColor ? " has-same" : ""}${tag.isHeavyRoster ? " has-heavy" : ""}`}
                      style={reveal(Math.min(index, 10) + 2)}
                    >
                      <span className="sai-tag__nr" aria-hidden="true">{spieltagNr(tag.label, index)}</span>
                      <div className="sai-tag__mitte">
                        <span className="sai-tag__label">{tag.label}</span>
                        <div className="sai-tag__diszis">
                          {tag.disciplines.map((d) => (
                            <span key={`${tag.matchdayId}-${d.name}`} className={`sai-diszi is-${farbe(d.color)}`} title={p.kategorieLabel(d.category)}>
                              <DisziIcon id={d.id} name={d.name} />
                              <span className="sai-diszi__text">
                                <b>{d.name}</b>
                                <small>{d.playerCount ?? "—"} Slots · {p.kategorieLabel(d.category)}</small>
                              </span>
                              {isViererPodDiscipline(d.id) ? <i className="sai-vier" title="Viererdisziplin: vier Teams gleichzeitig">4er</i> : null}
                            </span>
                          ))}
                        </div>
                        {tag.isHeavySameColor ? (
                          <span className="sai-marke is-risk">Farb-Dopplung + Kaderdruck · {tag.totalSlots} Slots</span>
                        ) : tag.sameColor ? (
                          <span className="sai-marke is-warn">Farb-Dopplung · gleiche Kategorie am selben Spieltag</span>
                        ) : tag.isHeavyRoster ? (
                          <span className="sai-marke is-risk">Kaderdruck · {tag.totalSlots} Slots</span>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="sai-leer">Spieltags-Paare erscheinen, sobald der Diszi-Plan geladen ist.</p>
                )}
              </div>
            </section>

            <aside className="sai-seite">
              <section className="sai-tafel" aria-labelledby="sai-gross-titel">
                <header className="sai-tafel__kopf">
                  <h2 id="sai-gross-titel">Große Diszis</h2>
                  <p>Nach Slotgröße sortiert.</p>
                </header>
                <ul className="sai-liste">
                  {p.bereit ? (
                    p.grosse.map((g) => (
                      <li key={`sai-gross-${g.matchdayId}-${g.disciplineId}`} className={`is-${farbe(g.color)}`}>
                        <DisziIcon id={g.disciplineId} name={g.displayName} />
                        <span><b>{g.displayName}</b><small>{g.matchdayLabel}</small></span>
                        <em>{g.playerCount ?? "—"}<small> Slots</small></em>
                      </li>
                    ))
                  ) : (
                    <li className="sai-leer">Slot-Größen folgen mit dem Diszi-Plan.</li>
                  )}
                </ul>
              </section>
              <section className="sai-tafel" aria-labelledby="sai-dopp-titel">
                <header className="sai-tafel__kopf">
                  <h2 id="sai-dopp-titel">Farb-Dopplungen</h2>
                </header>
                {!p.bereit ? (
                  <p className="sai-leer">Farb-Kollisionen werden nach dem Laden des Diszi-Plans angezeigt.</p>
                ) : p.doppelungen.length > 0 ? (
                  <ul className="sai-liste">
                    {p.doppelungen.map((e) => (
                      <li key={`sai-dopp-${e.matchdayId}`} className="is-warn">
                        <span><b>{e.label}</b><small>{e.disciplines.map((d) => d.name).join(" / ")}</small></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sai-leer">In dieser Season keine gleiche Farbe doppelt am selben Spieltag. Breiter Kader wird etwas entspannter.</p>
                )}
                {p.kuenftigeFaktoren.length > 0 ? (
                  <div className="sai-faktoren">
                    {p.kuenftigeFaktoren.map((f) => (
                      <span key={`sai-f-${f.label}`}><small>{f.label}</small><b>{p.zahl(f.factor, 2)}x</b></span>
                    ))}
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        </div>

        <footer className="sai-fuss">
          <button type="button" className="sai-btn" onClick={p.onDiszis}>Diszis ansehen</button>
          <button type="button" className="sai-btn is-primaer" onClick={p.onErledigt}>Erledigt</button>
        </footer>
      </section>
    </div>
  );
}
