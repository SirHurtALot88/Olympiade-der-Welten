"use client";

/**
 * STARTSEITE MODERN (18.11.) — die neue Home-Ansicht der Foundation, Vorlage
 * public/mockups/oly-start-modern-18-11.html, Doku docs/design/oly-start-modern-18-11.md.
 * Abgleich Mockup | App: docs/design/startseite-neu-abgleich-18-11.md.
 *
 * Alles kommt aus echten Daten: `HomeV2ClientProps` (Kopf, Entscheidungen, Kader, Kasse) und
 * `props.startseite` (Liga-Tabelle, Spieltag-Karte, Disziplinen, Meldungsband; gebaut von
 * `baueStartseiteModern`). Was es nicht gibt (Kassenkurve je Spieltag, Apron-Abstand, Einsatzliste je
 * Disziplin, Spieler des Tages), wird weggelassen oder klar leer gezeigt — nichts erfunden.
 * S-U-N zählt Disziplin-Duelle, nie „Spiele".
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { BcFormPfeil, BcMoralGesicht } from "@/components/foundation/broadcast";
import { FormMoralMarke } from "@/app/foundation/legacy-lineup-lab/FormMoralBausteine";
import type { HomeV2ClientProps, HomeV2InboxItem } from "@/app/foundation/home-v2/home-v2-types";
import {
  duelleText,
  sunText,
  type DisziplinKachel,
  type LetzteMeldung,
  type LigaZeile,
  type SpieltagsKarte,
  type StartseiteDaten,
} from "@/lib/foundation/startseite-modern";
import "./home-modern.css";

const ZAHL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const de = (x: number, nk = 1) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: nk, maximumFractionDigits: nk }).format(x);
const vz = (x: number, nk = 1) => `${x > 0 ? "+" : x < 0 ? "−" : "±"}${de(Math.abs(x), nk)}`;
const ton = (x: number | null | undefined) => (x == null || x === 0 ? "hm-null" : x > 0 ? "hm-plus" : "hm-minus");
const mio = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? "—" : `${de(x)} Mio`);

function Chevron() {
  return (
    <svg className="hm-i" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Wappen({ url, initials, alt = "" }: { url: string | null; initials: string; alt?: string }) {
  // Wappen sind Bilder mit Initialen-Rückfall: ohne URL oder bei einem Ladefehler ein neutraler Kasten.
  const [fehler, setFehler] = useState(false);
  return url && !fehler ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} decoding="async" onError={() => setFehler(true)} />
  ) : (
    <span aria-hidden="true" className="hm-wappen-leer">
      {initials}
    </span>
  );
}

function FormKaestchen({ form, anzahl = 5 }: { form: readonly string[]; anzahl?: number }) {
  return (
    <span className="hm-fm" aria-label={form.length ? `Form: ${form.join(", ")}` : "noch kein Spieltag"}>
      {Array.from({ length: anzahl }, (_, i) => {
        const c = form[i];
        return <i key={i} className={c === "s" ? "" : c === "u" ? "hm-u" : c === "n" ? "hm-n" : "hm-x"} />;
      })}
    </span>
  );
}

/* ------------------------------------------------------------------------------------- Kopf */

function Kopf({ p, sd }: { p: HomeV2ClientProps; sd: StartseiteDaten | null }) {
  const eigene = sd?.eigene ?? null;
  const roster = sd ? Object.values(sd.formMoral) : [];
  const mitForm = roster.filter((a) => a.formVerfuegbar);
  const mitMoral = roster.filter((a) => a.moral != null);
  const moralSchnitt = mitMoral.length ? mitMoral.reduce((x, a) => x + (a.moral ?? 0), 0) / mitMoral.length : null;
  const zaehler = [2, 1, 0, -1, -2].map((s) => mitForm.filter((a) => a.formStufe === s).length);
  const tief = zaehler[3] + zaehler[4];
  const dominant = zaehler.indexOf(Math.max(...zaehler));
  const kopfStufe = mitForm.length === 0 ? null : dominant < 2 ? 1 : dominant > 2 ? -1 : 0;
  const zone = eigene?.zone === "aufstieg" || eigene?.zone === "titel";
  const hatWertung = sd?.hatWertung ?? false;
  const kicker = [
    p.seasonName,
    sd ? (sd.saisonEnde ? `nach Spieltag ${sd.gesamtSpieltage} von ${sd.gesamtSpieltage}` : `vor Spieltag ${sd.gespielteSpieltage + 1} von ${sd.gesamtSpieltage}`) : p.matchdayLabel,
    sd?.ligaName,
  ]
    .filter(Boolean)
    .join(" · ");
  const bilder = sd?.kopfBilder ?? [];
  const lage = sd?.lage ?? "";
  return (
    <header className="hm-hero" data-testid="hm-hero">
      {bilder.length > 0 ? (
        <div className={`hm-kul${bilder.length === 1 ? " hm-eins" : ""}`} aria-hidden="true">
          {bilder.slice(0, 2).map((b) => (
            <i key={b} style={{ backgroundImage: `url("${b}")` }} />
          ))}
        </div>
      ) : null}
      <div className="hm-hk">
        <span className="hm-crest">
          <Wappen url={p.teamLogoUrl} initials={p.teamLogoInitials} alt={p.teamName} />
        </span>
        <div style={{ minWidth: 0 }}>
          <em>{kicker}</em>
          <h2 className="hm-name">{p.teamName}</h2>
          <span className="hm-lage">
            {eigene && eigene.rang != null ? <b>{eigene.rang}. in {sd?.ligaName}</b> : <b>{sd?.ligaName ?? "Liga"}</b>}
            {lage ? <> · {lage}</> : null}
          </span>
        </div>
      </div>
      <div className="hm-kpis">
        <div className={`hm-kpi${zone ? " hm-zone" : ""}`}>
          <span className="hm-gk">Rang</span>
          <strong className="hm-t">{eigene?.rang != null ? `${eigene.rang}.` : "–"}</strong>
          <small>
            in {sd?.ligaName ?? "der Liga"}
            {eigene?.bewegung ? <> · <span className={ton(eigene.bewegung)}>{eigene.bewegung > 0 ? "▲" : "▼"}{Math.abs(eigene.bewegung)}</span></> : null}
          </small>
        </div>
        <div className="hm-kpi">
          <span className="hm-gk">Punkte</span>
          <strong className="hm-t">{hatWertung ? eigene?.punkte ?? p.points ?? 0 : 0}</strong>
          <small className="hm-t" title="S-U-N zählt Disziplin-Duelle: Siege, Unentschieden, Niederlagen">
            {eigene?.bilanz ? (
              <>
                {sunText(eigene.bilanz)} · {duelleText(eigene.bilanz)}
                {eigene.verhaeltnis != null ? <> · Verh. <span className={ton(eigene.verhaeltnis)}>{vz(eigene.verhaeltnis)}</span></> : null}
              </>
            ) : (
              "noch kein Duell"
            )}
          </small>
        </div>
        <div className="hm-kpi">
          <span className="hm-gk">Ergebnisse</span>
          <strong>
            <FormKaestchen form={eigene?.form ?? []} />
          </strong>
          <small>{eigene && eigene.form.length > 0 ? `letzte ${eigene.form.length} Spieltage` : "noch kein Spieltag"}</small>
        </div>
        <div className="hm-kpi">
          <span className="hm-gk">Form · Moral</span>
          <strong>
            {kopfStufe == null ? <span className="hm-null">–</span> : <BcFormPfeil stufe={kopfStufe} />}
            {moralSchnitt != null ? (
              <span style={{ fontSize: ".75em", display: "inline-flex" }}>
                <BcMoralGesicht wert={moralSchnitt} groesse={22} />
              </span>
            ) : null}
          </strong>
          <small className="hm-t">{mitForm.length > 0 ? `${zaehler[0]}×▲▲ ${zaehler[1]}×▲ · ${tief} im Tief` : "noch keine Form"}</small>
        </div>
        <div className="hm-kpi">
          <span className="hm-gk">Kasse</span>
          <strong className="hm-t">{mio(p.cash)}</strong>
          <small className="hm-t">Gehälter {mio(p.salaryTotal)}</small>
        </div>
      </div>
      <div className="hm-cta">
        <span className="hm-gk">{sd?.saisonEnde ? "Saison beendet" : "Nächster Schritt"}</span>
        <button type="button" className="hm-btn hm-haupt" onClick={p.onContinue} data-testid="hm-weiter">
          {p.nextStepLabel} <Chevron />
        </button>
        <small>{p.nextStepDetail}</small>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------------------- Spieltag-Karte */

function KarteDuell({ k, ligaName, onOpen }: { k: SpieltagsKarte; ligaName: string; onOpen: () => void }) {
  const bildStil = k.bild ? ({ "--bild": `url("${k.bild}")` } as CSSProperties) : undefined;
  const vierer = k.art === "vierer";
  const mx = Math.max(1, ...k.gruppe.map((g) => g.staerke));
  const art = vierer ? "Vierergruppe · 2-1-0-0" : "Duell · 2 / 1 / 0";
  return (
    <button type="button" className={`hm-dz${vierer ? " hm-vierer" : ""}`} style={bildStil} onClick={onOpen}>
      <div className="hm-kopf">
        <b>{k.name}</b>
        <small>
          {art}
          {k.kulisse ? ` · Kulisse ${k.kulisse}` : ""}
          {k.durchgang ? ` · ${k.durchgang}. Durchgang` : ""}
        </small>
      </div>
      {vierer ? (
        <>
          <div className="hm-lab">
            <span>Kaderstärke der Vierergruppe</span>
            {k.papier ? <span className="hm-pf"><b className={`hm-${k.papier.ton}`}>{k.papier.wort}</b></span> : null}
            <span>Rang in {ligaName}</span>
          </div>
          <div className="hm-pod">
            {k.gruppe.map((g) => (
              <div key={g.teamId} className={g.istEigen ? "hm-wir" : ""}>
                <Wappen url={g.logoUrl} initials={g.logoInitials} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                <span className="hm-bn"><i style={{ width: `${((g.staerke / mx) * 100).toFixed(0)}%` }} /></span>
                <b className="hm-t">{g.rang ? `#${g.rang}` : "–"}</b>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="hm-lab">
            <span>Kaderstärke</span>
            <span className="hm-t">{k.anteil != null ? `Anteil ${de(k.anteil, 0)} %` : "–"}</span>
          </div>
          <div className="hm-lab">
            <b className="hm-h hm-t">{k.rangEigen ? `#${k.rangEigen}` : "–"}</b>
            <span>Rang in {ligaName}</span>
            <b className="hm-g hm-t">{k.rangGegner ? `#${k.rangGegner}` : "–"}</b>
          </div>
          <div className="hm-wb"><i style={{ width: `${(k.anteil ?? 50).toFixed(1)}%` }} /></div>
          <div className="hm-sp" />
          {k.papier ? (
            <div className="hm-pf"><b className={`hm-${k.papier.ton}`}>{k.papier.wort}</b><span>Papierform aus der Kaderstärke</span></div>
          ) : null}
        </>
      )}
    </button>
  );
}

function SpieltagKarte({ p, sd }: { p: HomeV2ClientProps; sd: StartseiteDaten }) {
  if (sd.saisonEnde && sd.bilanzEnde) {
    const b = sd.bilanzEnde;
    return (
      <section className="hm-pan hm-p-tag" data-testid="hm-saisonbilanz">
        <div className="hm-pk">
          <h2>Saisonbilanz</h2>
          <span className="hm-sp" />
          <button type="button" onClick={p.onOpenSeason} className="hm-mehr">Saisonstand <span aria-hidden="true">›</span></button>
        </div>
        <div className="hm-pb">
          <div className="hm-bil">
            <div className="hm-gross">
              <strong className="hm-t">{b.rang != null ? `${b.rang}.` : "–"}</strong>
              <span>{b.wort ?? sd.ligaName}</span>
              <small className="hm-t">
                {b.punkte} Pkt{b.bilanz ? ` · ${sunText(b.bilanz)} · ${duelleText(b.bilanz)}` : ""}
                {b.verhaeltnis != null ? ` · Verh. ${vz(b.verhaeltnis)}` : ""}
              </small>
            </div>
            <div>
              {b.zeilen.map((z) => (
                <div key={z.label} className="hm-zeile" style={{ padding: ".5rem 0" }}>
                  <span>{z.label}</span>
                  <strong style={{ fontSize: "1rem", fontWeight: 600 }}>{z.wert}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  const n = sd.naechster;
  const g = n?.gegner ?? null;
  const eigen = sd.eigene;
  const unterEigen = eigen && eigen.rang != null && sd.hatWertung ? `${eigen.rang}. · ${eigen.punkte} Pkt${eigen.bilanz ? ` · ${sunText(eigen.bilanz)}` : ""}` : `${sd.ligaName} · Saisonstart`;
  const unterGegner = g ? (g.rang != null && g.punkte != null ? `${g.rang}. · ${g.punkte} Pkt${g.bilanz ? ` · ${sunText(g.bilanz)}` : ""}` : `${sd.ligaName} · Saisonstart`) : "";
  const verbleibend = sd.gesamtSpieltage - sd.gespielteSpieltage;
  return (
    <section className="hm-pan hm-p-tag" data-testid="hm-spieltag">
      <div className="hm-pk">
        <h2>Spieltag {n?.nummer ?? sd.gespielteSpieltage + 1}</h2>
        {n?.heim != null ? <span className={`hm-marke${n.heim ? "" : " hm-g"}`}>{n.heim ? "Heimspiel" : "Auswärts"}</span> : null}
        <span className="hm-sp" />
        <button type="button" className="hm-mehr" onClick={p.onOpenLineup}>Zur Einsatzliste <span aria-hidden="true">›</span></button>
      </div>
      <div className="hm-pb">
        {g ? (
          <div className="hm-match">
            <div className="hm-s">
              <Wappen url={p.teamLogoUrl} initials={p.teamLogoInitials} />
              <div><b>{p.teamName}</b><small className="hm-t">{unterEigen}</small></div>
            </div>
            <span className="hm-vs">vs</span>
            <div className="hm-s hm-g">
              <Wappen url={g.logoUrl} initials={g.logoInitials} />
              <div><b>{g.name}</b><small className="hm-t">{unterGegner}</small></div>
            </div>
          </div>
        ) : (
          <p className="hm-leer">Für diesen Spieltag ist noch keine Paarung bekannt.</p>
        )}
        {n && n.karten.length > 0 ? (
          <div className="hm-dzs">
            {n.karten.map((k) => (
              <KarteDuell key={k.disciplineId} k={k} ligaName={sd.ligaName} onOpen={p.onOpenLineup} />
            ))}
          </div>
        ) : (
          <div className="hm-sp" />
        )}
        <div className="hm-spiel">
          <span className="hm-gk">Auf dem Spiel</span>
          <span>Punkte heute<b className="hm-t">bis 4</b></span>
          {sd.aufDemSpiel.filter((a) => a.id !== "rest").map((a) => (
            <span key={a.id}>{a.label}<b className="hm-t">{a.wert}</b></span>
          ))}
          <span>Noch {verbleibend} {verbleibend === 1 ? "Spieltag" : "Spieltage"}<b className="hm-t">bis {verbleibend * 4} Pkt</b></span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- Tabelle */

function TabellenZeile({ z, index, onOpen }: { z: LigaZeile; index: number; onOpen: () => void }) {
  const r = z.rang ?? index + 1;
  const auf = z.rang != null && (z.zone === "aufstieg" || z.zone === "titel");
  const ab = z.rang != null && z.zone === "abstieg";
  const klassen = ["hm-tz", auf ? "hm-auf" : "", ab ? "hm-ab" : "", z.istEigen ? "hm-wir" : ""].filter(Boolean).join(" ");
  const bew = z.bewegung;
  return (
    <button type="button" className={klassen} onClick={onOpen} data-rang={r}>
      <span>{z.rang != null ? `${z.rang}.` : "–"}</span>
      <span className={ton(bew)}>{bew ? `${bew > 0 ? "▲" : "▼"}${Math.abs(bew)}` : "–"}</span>
      <span className="hm-tm">
        <Wappen url={z.logoUrl} initials={z.logoInitials} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{z.name}</span>
        {z.istEigen ? <span className="hm-du">DU</span> : z.istGegner ? <span className="hm-gg">GEGNER</span> : null}
      </span>
      <span title="Siege-Unentschieden-Niederlagen in Disziplin-Duellen">{z.bilanz ? sunText(z.bilanz) : "0-0-0"}</span>
      <span className={ton(z.verhaeltnis)}>{z.rang != null && z.verhaeltnis != null ? vz(z.verhaeltnis) : "–"}</span>
      <span><FormKaestchen form={z.form} /></span>
      <strong>{z.punkte}</strong>
    </button>
  );
}

function Tabelle({ p, sd }: { p: HomeV2ClientProps; sd: StartseiteDaten }) {
  const n = sd.zeilen.length;
  return (
    <section className="hm-pan hm-p-tab" data-testid="hm-tabelle">
      <div className="hm-pk">
        <h2>{sd.ligaName} · Tabelle</h2>
        <span className="hm-sp" />
        <button type="button" className="hm-mehr" onClick={p.onOpenSeason}>Saisonstand <span aria-hidden="true">›</span></button>
      </div>
      <div className="hm-tab hm-t" style={{ gridTemplateRows: `1.7rem repeat(${Math.max(1, n)}, minmax(0, 1fr))` }}>
        <div className="hm-tz hm-kopf">
          <span>#</span><span>±</span><span>Team</span><span title="Siege-Unentschieden-Niederlagen, gezählt in Disziplin-Duellen">S-U-N</span><span>Verh.</span><span>Form</span><span>Pkt</span>
        </div>
        {sd.zeilen.map((z, i) => (
          <TabellenZeile key={z.teamId} z={z} index={i} onOpen={p.onOpenSeason} />
        ))}
      </div>
      <div className="hm-tfuss">
        {sd.ligaTier === "liga2" ? <span><i style={{ background: "var(--gut)" }} />Aufstieg 1–3</span> : null}
        {sd.ligaTier === "liga1" ? (
          <>
            <span><i style={{ background: "var(--gut)" }} />Meister</span>
            <span><i style={{ background: "var(--warn)" }} />Abstieg 14–16</span>
          </>
        ) : null}
        <span className="hm-sp" />
        <span className="hm-weg">S-U-N = Disziplin-Duelle (2 je Spieltag) · Sieg 2 · Remis 1 · Niederlage 0 · Gleichstand: Verhältnis</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- Entscheidungen */

function Entscheidungen({ p }: { p: HomeV2ClientProps }) {
  const items: Array<{ id: string; klasse: string; icon: string; titel: string; detail: string; ziel: string }> = p.inboxItems.slice(0, 5).map((i: HomeV2InboxItem) => ({
    id: i.id,
    klasse: i.severity === "critical" ? "" : i.severity === "warning" ? "hm-w" : "hm-h",
    icon: i.severity === "info" ? "i" : "!",
    titel: i.title,
    detail: i.detail,
    ziel: "öffnen ›",
  }));
  if (items.length < 5) {
    const z = p.boardObjectives[0];
    if (z) {
      items.push({ id: `board-${z.objectiveId}`, klasse: "hm-h", icon: "i", titel: "Vorstandsziel", detail: z.label, ziel: "lesen ›" });
    }
  }
  return (
    <section className="hm-pan hm-p-ent" data-testid="hm-entscheidungen">
      <div className="hm-pk">
        <h2>Entscheidungen</h2>
        <span className="hm-sp" />
        <button type="button" className="hm-mehr" onClick={p.onOpenInbox}>Inbox{p.inboxOpenCount > 0 ? ` (${p.inboxOpenCount})` : ""} <span aria-hidden="true">›</span></button>
      </div>
      <div className="hm-ents">
        {items.length === 0 ? (
          <p className="hm-leer" style={{ padding: ".8rem .6rem" }}>Nichts offen. Alles erledigt.</p>
        ) : (
          items.map((e) => (
            <button key={e.id} type="button" className={`hm-ent ${e.klasse}`} onClick={e.id.startsWith("board-") && p.onOpenBoardObjectives ? p.onOpenBoardObjectives : p.onOpenInbox}>
              <span className="hm-ik">{e.icon}</span>
              <span className="hm-tx">{e.titel}<small>{e.detail}</small></span>
              <span className="hm-go">{e.ziel}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- Kader */

function Kader({ p, sd }: { p: HomeV2ClientProps; sd: StartseiteDaten | null }) {
  const roster = sd ? Object.values(sd.formMoral) : [];
  const mitForm = roster.filter((a) => a.formVerfuegbar);
  const mitMoral = roster.filter((a) => a.moral != null);
  const schnitt = mitMoral.length ? mitMoral.reduce((x, a) => x + (a.moral ?? 0), 0) / mitMoral.length : null;
  return (
    <section className="hm-pan hm-p-kad" data-testid="hm-kader">
      <div className="hm-pk">
        <h2>Kader · Form &amp; Moral</h2>
        <span className="hm-sp" />
        <button type="button" className="hm-mehr" onClick={p.onOpenTeams}>Ganzer Kader ({p.rosterCount}) <span aria-hidden="true">›</span></button>
      </div>
      <div className="hm-pb">
        <div className="hm-tfk">
          {mitForm.length > 0 || schnitt != null ? (
            <>
              <span className="hm-gk">Team-Form</span>
              <span className="hm-zz">
                {[2, 1, 0, -1, -2].map((s) => (
                  <span key={s}><BcFormPfeil stufe={s} /><b className="hm-t">{mitForm.filter((a) => a.formStufe === s).length}</b></span>
                ))}
              </span>
              {schnitt != null ? (
                <>
                  <span className="hm-gk">Moral Ø</span>
                  <span className="hm-zz" style={{ gap: ".35rem" }}><BcMoralGesicht wert={schnitt} groesse={20} /></span>
                </>
              ) : null}
            </>
          ) : (
            <span className="hm-gk">Form und Moral entstehen nach dem ersten Spieltag</span>
          )}
          <span className="hm-weg" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Die besten sechs nach Gesamtwert</span>
        </div>
        <div className="hm-kk">
          {p.topPlayers.slice(0, 6).map((pl, i) => {
            const a = sd?.formMoral[pl.playerId];
            return (
              <button key={pl.playerId} type="button" className="hm-sk" onClick={() => p.onOpenPlayer(pl.playerId)}>
                {pl.portraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pl.portraitUrl} alt="" loading="lazy" decoding="async" />
                ) : null}
                <span className="hm-rg hm-t">{i + 1}</span>
                <span className="hm-un">
                  <b>{pl.name}</b>
                  <small>{pl.contractLength != null ? `Vertrag ${pl.contractLength} ${pl.contractLength === 1 ? "Jahr" : "Jahre"}` : " "}</small>
                  <span className="hm-ov hm-t">
                    <strong>{pl.playerOvr != null ? ZAHL.format(pl.playerOvr) : "–"}</strong>
                    {a ? <FormMoralMarke a={a} /> : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- Kasse */

function Kasse({ p }: { p: HomeV2ClientProps }) {
  const kredit = (p.loanInstallment ?? 0) > 0 || (p.outstandingDebt ?? 0) > 0;
  return (
    <section className="hm-pan hm-p-fin" data-testid="hm-kasse">
      <div className="hm-pk">
        <h2>Kasse</h2>
        <span className="hm-sp" />
        <button type="button" className="hm-mehr" onClick={p.onOpenTeams}>Teams <span aria-hidden="true">›</span></button>
      </div>
      <div className="hm-pb">
        <div className="hm-kas">
          <strong className="hm-t">{mio(p.cash)}</strong>
          <small>Kassenstand</small>
        </div>
        <div className="hm-kurve-leer" data-testid="hm-kurve-leer">
          Kassenverlauf je Spieltag folgt mit dem neuen Finanzkonzept
        </div>
        <div className="hm-zeile"><span>Gehälter <small>Saison</small></span><strong className="hm-t">{mio(p.salaryTotal)}</strong></div>
        <div className="hm-zeile"><span>Saisonergebnis <small>GuV</small></span><strong className={`hm-t ${ton(p.guv)}`}>{p.guv == null ? "—" : `${vz(p.guv)} Mio`}</strong></div>
        {kredit ? (
          <div className="hm-zeile"><span>Kredit <small>Rate je Saison {mio(p.loanInstallment)}</small></span><strong className="hm-t hm-minus">{mio(p.outstandingDebt)}</strong></div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- Disziplinen */

function Kachel({ d }: { d: DisziplinKachel }) {
  const stil = d.bild ? ({ "--bild": `url("${d.bild}")` } as CSSProperties) : undefined;
  const k = d.ampel ? ` hm-${d.ampel}` : "";
  return (
    <div className={`hm-dk${k}${d.heute ? " hm-h" : ""}`} style={stil} title={`${d.name}: Kaderstärke-Rang ${d.rang ?? "–"}`}>
      <small>{d.name}</small>
      <strong className="hm-t">{d.rang ? `${d.rang}.` : "–"}</strong>
      <em className="hm-t">{d.moeglich > 0 ? `${d.punkte} / ${d.moeglich} Pkt` : "noch offen"}</em>
    </div>
  );
}

function Disziplinen({ sd }: { sd: StartseiteDaten }) {
  return (
    <section className="hm-pan hm-p-dis" data-testid="hm-disziplinen">
      <div className="hm-pk">
        <h2>Disziplinen · Kaderstärke-Rang in {sd.ligaName}</h2>
        <span className="hm-sp" />
        <span className="hm-leg">
          <span><i style={{ background: "var(--gut)" }} />1–3</span>
          <span><i style={{ background: "var(--acht)" }} />4–6</span>
          <span><i style={{ background: "var(--warn)" }} />7–10</span>
          <span><i style={{ background: "var(--stumm)" }} />ab 11</span>
          <span><i style={{ outline: "2px solid var(--gold)", background: "none" }} />an diesem Spieltag</span>
          <span>klein: Duellpunkte bisher</span>
        </span>
      </div>
      <div className="hm-dr">
        {sd.disziplinen.map((d) => (
          <Kachel key={d.disciplineId} d={d} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------- Meldungsband */

function Band({ sd }: { sd: StartseiteDaten }) {
  const l = sd.letzterSpieltag;
  const teile: ReactNode[] = [];
  if (l) {
    for (const m of l.meldungen as LetzteMeldung[]) {
      teile.push(
        <span key={m.id}>
          <b>{m.disziplin}</b> {m.text}
          {m.ergebnis ? ` ${m.ergebnis}` : ""} · <b className={m.ton === "plus" ? "hm-plus" : m.ton === "acht" ? "hm-acht" : "hm-null"}>{m.punkte >= 1 ? `+${m.punkte}` : "0"}</b>
        </span>,
      );
    }
  }
  if (sd.tabellenfuehrer && sd.eigene) {
    teile.push(
      sd.tabellenfuehrer.name !== sd.eigene.name ? (
        <span key="fuehrer">{sd.tabellenfuehrer.name} führt mit <b>{sd.tabellenfuehrer.punkte} Pkt</b></span>
      ) : (
        <span key="fuehrer">Du führst mit <b>{sd.tabellenfuehrer.punkte} Pkt</b></span>
      ),
    );
  }
  if (teile.length === 0) {
    teile.push(<span key="start">{sd.ligaName} · {sd.zeilen.length} Teams · {sd.gesamtSpieltage} Spieltage · je Spieltag <b>2 Disziplinen</b> · Sieg 2, Remis 1, Niederlage 0</span>);
  }
  return (
    <div className="hm-ticker" data-testid="hm-band">
      <b className="hm-gk">{l ? `Spieltag ${l.nummer} · ${l.punkte} von ${l.moeglich} Pkt` : "Saisonauftakt"}</b>
      {teile}
    </div>
  );
}

/* ------------------------------------------------------------------------------------- Seite */

/** Entwurfsmaß der Seite in rem (Mockup: 1920x1080 bei 16 px, abzüglich 4 rem Icon-Schiene). */
const ENTWURF_BREITE_REM = 116;
const ENTWURF_HOEHE_REM = 67.5;

/**
 * Volle Fläche: Die Wurzelgröße der Seite (`--hm-u`) und ihre Höhe (`--hm-h`) richten sich nach dem, was die
 * Shell tatsächlich übrig lässt (Breite des Elternelements, Fensterhöhe abzüglich Oberkante) — nicht nach dem
 * Fenster allein. Ohne Messung (erste Zeichnung, Druckansicht) greifen die Rückfallwerte der CSS.
 */
function useVolleFlaeche(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messe = () => {
      if (window.matchMedia("(max-width: 760px)").matches) {
        el.style.removeProperty("--hm-u");
        el.style.removeProperty("--hm-h");
        return;
      }
      const breite = el.parentElement?.clientWidth ?? window.innerWidth;
      const oben = el.getBoundingClientRect().top;
      const hoehe = Math.max(480, window.innerHeight - oben - 4);
      const u = Math.min(34, Math.max(12.5, Math.min(breite / ENTWURF_BREITE_REM, hoehe / ENTWURF_HOEHE_REM)));
      el.style.setProperty("--hm-u", `${u.toFixed(2)}px`);
      el.style.setProperty("--hm-h", `${Math.floor(hoehe)}px`);
      // Lässt die Shell unten noch Rand oder Fuß, scrollt die Seite: genau diesen Überstand abziehen.
      const ueber = document.documentElement.scrollHeight - window.innerHeight;
      if (ueber > 0) el.style.setProperty("--hm-h", `${Math.max(480, Math.floor(hoehe - ueber))}px`);
    };
    messe();
    const beobachter = new ResizeObserver(messe);
    if (el.parentElement) beobachter.observe(el.parentElement);
    window.addEventListener("resize", messe);
    return () => {
      beobachter.disconnect();
      window.removeEventListener("resize", messe);
    };
  }, [ref]);
}

export default function HomeModern(props: HomeV2ClientProps) {
  const sd = props.startseite ?? null;
  const wurzel = useRef<HTMLDivElement>(null);
  useVolleFlaeche(wurzel);
  return (
    <div className="hm bc" data-testid="home-modern" ref={wurzel}>
      <Kopf p={props} sd={sd} />
      {sd ? (
        <div className="hm-raster">
          <SpieltagKarte p={props} sd={sd} />
          <Tabelle p={props} sd={sd} />
          <Entscheidungen p={props} />
          <Kader p={props} sd={sd} />
          <Kasse p={props} />
          <Disziplinen sd={sd} />
          <Band sd={sd} />
        </div>
      ) : (
        <div className="hm-raster">
          <p className="hm-leer" style={{ gridColumn: "1 / 13" }}>Keine aktive Mannschaft: Wähle ein Team, dann füllt sich die Startseite.</p>
        </div>
      )}
    </div>
  );
}
