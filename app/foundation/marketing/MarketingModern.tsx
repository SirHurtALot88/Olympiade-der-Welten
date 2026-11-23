"use client";

/**
 * MARKETING im Broadcast-Stil (22.11., Bau nach docs/design/marketing-22-11.md, Runde 3). Vorlage: public/mockups/marketing-22-11.html.
 * Neu gebaut, nicht in eine alte Seite eingehaengt. NUR der eigene Kader (Chris: „im Marketing brauch ich nur meine eigenen Spieler und
 * wie die sich warum und wie aufs Marketing auswirken“): je Spieler die Zerlegung in drei Schritten, Reichweite, Passung zu den Fans,
 * Team-Anteil. Alle Zahlen kommen aus `marketingTeamUebersicht` (dieselbe Funktion, die die Buchung je Spieltag und die GuV lesen):
 * gezeigt = gebucht. Je Manager getrennt: die Seite liest nur das aktive Team (`activeManagerTeamId`).
 * Fremde Spieler gibt es hier nicht; ihre Marketability steht als Spalte im Transfermarkt (mit Scouting-Nebel).
 */

import { useMemo, useState, type CSSProperties } from "react";

import { BcHero, BcIcon, BcMoralGesicht, BcReiter } from "@/components/foundation/broadcast";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { FARB_NAMEN, FANPROFILE, KLASSEN_FARBE, type Fanfarbe } from "@/lib/marketing/marketing-daten";
import { gueltigerMarketingStempel, marketingAktiv } from "@/lib/marketing/marketing-regel";
import { MARKETING_KONFIG } from "@/lib/marketing/marketing-modell";
import { marketingTeamUebersicht, type MarketingKaderZeile } from "@/lib/marketing/marketing-team";
import { useTabellenSortierung } from "@/lib/ui/tabellen-sortierung";
import type { MarketingAktionFn } from "@/lib/marketing/marketing-aktion-typen";
import { werbeklauselAktiv } from "@/lib/marketing/marketing-regel";
import AushaengeschildAnsicht from "./AushaengeschildAnsicht";

import "@/app/foundation/finances/finanzen-modern.css";
import "./marketing-modern.css";

export type MarketingKontextReiter = "fan" | "spieler" | "verlauf";
export type MarketingAnsicht = "kader" | "gesicht";

export type MarketingModernProps = {
  gameState: GameState;
  /** Das aktive Team des Managers (`activeManagerTeamId`); nie ein fremdes. */
  teamId: string | null;
  startKontext?: MarketingKontextReiter;
  /** Vorgewaehlter Spieler (Tests, Aufnahmen). */
  startSpieler?: string | null;
  /** Aushaengeschild waehlen (`POST /api/marketing`); ohne Funktion nur lesen. */
  onAktion?: MarketingAktionFn;
  /** Darf der Aufrufer fuer dieses Team schreiben (eigener Manager)? */
  kannSchreiben?: boolean;
  startAnsicht?: MarketingAnsicht;
};

const FARB_VAR = ["var(--bc-p1)", "var(--bc-p4)", "var(--bc-p5)", "var(--bc-p6)"];
const MINUS = "−";

function z1(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r < 0 ? MINUS : ""}${Math.abs(r).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}
const C1 = (v: number) => `${z1(v)} C`;
function vz(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? MINUS : "±"}${Math.abs(v).toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
}
/** Beitrag als ganze Prozentpunkte: +12 / −7 / ±0. */
function pp(v: number): string {
  const r = Math.round(v * 100);
  return `${r > 0 ? "+" : r < 0 ? MINUS : "±"}${Math.abs(r)}`;
}
const tonKlasse = (v: number) => (v > 0.004 ? "bc-plus" : v < -0.004 ? "bc-minus" : "bc-null");

function tonWort(ton: number): string {
  if (ton <= -0.6) return "Bösewicht-Seite";
  if (ton <= -0.2) return "eher Schurke";
  if (ton < 0.2) return "Mitte";
  if (ton < 0.6) return "eher Liebling";
  return "Liebling-Seite";
}

function Marke({ text, art }: { text: string; art?: "po" | "ne" | "neu" | "leer" }) {
  return <span className={`mk-marke${art ? ` is-${art}` : ""}`}>{text}</span>;
}

function SortKopf({
  text,
  kopf,
  re,
}: {
  text: string;
  kopf: { aktiv: boolean; pfeil: string; ariaSort: "ascending" | "descending" | "none"; onKlick: () => void };
  re?: boolean;
}) {
  return (
    <button type="button" className={`fin-sk${re ? " fin-re" : ""}${kopf.aktiv ? " is-an" : ""}`} onClick={kopf.onKlick} aria-sort={kopf.ariaSort}>
      {text}
      {kopf.pfeil}
    </button>
  );
}

/** Reichweite als gestapelter Balken: Leistung (Gold), Ausstrahlung (Rosa), Typ (Violett). */
function ReichweiteBalken({ z }: { z: MarketingKaderZeile }) {
  const e = z.ergebnis;
  const teile: Array<[string, number, string]> = [
    ["Leistung", e.leistung, "var(--bc-gold)"],
    ["Ausstrahlung", e.ausstrahlung, "var(--bc-p1)"],
    ["Typ", e.typ, "var(--bc-p6)"],
  ];
  return (
    <div className="mk-rw" title={`Reichweite ${Math.round(e.reichweite)}: Leistung ${Math.round(e.leistung)} · Ausstrahlung ${Math.round(e.ausstrahlung)} · Typ ${Math.round(e.typ)}`}>
      <div className="mk-stapel">
        {teile.map(([n, v, f]) => (
          <i key={n} style={{ flex: Math.max(v, 0.001), background: f }} />
        ))}
      </div>
      <small className="bc-t">
        <b>{Math.round(e.reichweite)}</b> · {Math.round(e.leistung)} · {Math.round(e.ausstrahlung)} · {Math.round(e.typ)}
      </small>
    </div>
  );
}

function PassungZelle({ z }: { z: MarketingKaderZeile }) {
  const e = z.ergebnis;
  const teile: Array<[string, number]> = [
    ["Kante", e.passKante],
    ["Ton", e.passTon],
    ["Thema", e.passThema],
    ["Farbe", e.passFarbe],
  ];
  return (
    <div className="mk-pz">
      <strong className="bc-t">×{e.passung.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      <span className="mk-chips">
        {teile.map(([n, v]) => (
          <i key={n} className={`mk-pc ${v > 0.004 ? "is-po" : v < -0.004 ? "is-ne" : "is-nu"}`}>
            {n} {pp(v)}
          </i>
        ))}
      </span>
    </div>
  );
}

function AnteilZelle({ z }: { z: MarketingKaderZeile }) {
  const e = z.ergebnis;
  const gruende = e.bausteine
    .filter((b) => b.punkte !== 0)
    .sort((a, b) => Math.abs(b.punkte) - Math.abs(a.punkte))
    .slice(0, 2);
  return (
    <div className="mk-aq">
      <div className="mk-balken">
        <i style={{ width: `${e.teamAnteilProzent}%` }} />
      </div>
      <div className="mk-aqt">
        <b className="bc-t">{e.teamAnteilProzent} %</b>
        <small>
          {gruende.length === 0
            ? "Standard"
            : gruende.map((b) => `${b.label === "Persönlichkeit" ? (b.text.split(" · ")[0] ?? b.label) : b.label} ${b.punkte > 0 ? "+" : MINUS}${Math.abs(b.punkte)}`).join(" · ")}
        </small>
      </div>
    </div>
  );
}

type SpaltenKey = "name" | "reichweite" | "passung" | "m" | "wg" | "q" | "gt" | "gs";

function KaderTabelle({
  zeilen,
  gewaehlt,
  onWahl,
}: {
  zeilen: MarketingKaderZeile[];
  gewaehlt: string | null;
  onWahl: (id: string) => void;
}) {
  const { sortiert, kopf } = useTabellenSortierung<MarketingKaderZeile, SpaltenKey>(
    zeilen,
    {
      name: { wert: (z) => z.name, standard: "auf" },
      reichweite: { wert: (z) => z.ergebnis.reichweite },
      passung: { wert: (z) => z.ergebnis.passung },
      m: { wert: (z) => z.ergebnis.marketability },
      wg: { wert: (z) => z.ergebnis.werbegeld },
      q: { wert: (z) => z.ergebnis.teamAnteilProzent },
      gt: { wert: (z) => z.ergebnis.ansTeam },
      gs: { wert: (z) => z.ergebnis.anIhn },
    },
    { key: "m", richtung: "ab" },
  );
  const cols = "minmax(140px,1.3fr) minmax(150px,1.5fr) minmax(190px,1.9fr) 62px 80px minmax(150px,1.5fr) 92px 112px";
  const summe = zeilen.reduce(
    (s, z) => ({ wg: s.wg + z.ergebnis.werbegeld, gt: s.gt + z.ergebnis.ansTeam, gs: s.gs + z.ergebnis.anIhn }),
    { wg: 0, gt: 0, gs: 0 },
  );
  return (
    <div className="fin-tl mk-tabelle" data-testid="mk-kader">
      <div className="fin-th" style={{ "--cols": cols } as CSSProperties}>
        <SortKopf text="Spieler" kopf={kopf("name")} />
        <SortKopf text="1 · Reichweite" kopf={kopf("reichweite")} />
        <SortKopf text="2 · Passung zu den Fans" kopf={kopf("passung")} />
        <SortKopf text="Marketability" kopf={kopf("m")} re />
        <SortKopf text="Werbegeld" kopf={kopf("wg")} re />
        <SortKopf text="3 · Team-Anteil" kopf={kopf("q")} />
        <SortKopf text="ans Team" kopf={kopf("gt")} re />
        <SortKopf text="an ihn" kopf={kopf("gs")} re />
      </div>
      {sortiert.map((z) => {
        const farbe = KLASSEN_FARBE[z.className];
        return (
          <button
            key={z.playerId}
            type="button"
            className={`fin-tz mk-zeile${gewaehlt === z.playerId ? " is-gew" : ""}`}
            style={{ "--cols": cols, "--pc": farbe == null ? "var(--bc-leise)" : FARB_VAR[farbe] } as CSSProperties}
            onClick={() => onWahl(z.playerId)}
            data-testid={`mk-zeile-${z.playerId}`}
          >
            <span className="mk-name">
              <b>{z.name}</b>
              <small>
                <i className="mk-kl" />
                {z.className} · {z.race}
                {z.istGesicht ? <Marke text="GESICHT" art="neu" /> : null}
                {z.ergebnis.verletztHalb ? <Marke text="VERLETZT" art="ne" /> : null}
              </small>
            </span>
            <ReichweiteBalken z={z} />
            <PassungZelle z={z} />
            <strong className="bc-t fin-re mk-m">{Math.round(z.ergebnis.marketability)}</strong>
            <span className="bc-t fin-re mk-wg">{z.ergebnis.werbegeld < 0.05 ? <span className="bc-null">0</span> : C1(z.ergebnis.werbegeld)}</span>
            <AnteilZelle z={z} />
            <span className="fin-re mk-gt">
              <b className="bc-t">{z.ergebnis.ansTeam < 0.05 ? "0" : C1(z.ergebnis.ansTeam)}</b>
              {z.ergebnis.netzGreift ? <small>Netz: {Math.round(MARKETING_KONFIG.klauselNetz[String(z.klausel) as "-1" | "0" | "1"] * 100)} % vom Gehalt</small> : z.ergebnis.ansTeam >= 0.05 ? <small>{Math.round((z.ergebnis.ansTeam / Math.max(z.gehalt, 0.1)) * 100)} % vom Gehalt</small> : null}
            </span>
            <span className="fin-re mk-gs">
              <b className="bc-t">{z.ergebnis.anIhn < 0.05 ? "0" : C1(z.ergebnis.anIhn)}</b>
              {z.ergebnis.moralZuschlag > 0 ? <small className="bc-plus">Moral +{z.ergebnis.moralZuschlag}</small> : null}
            </span>
          </button>
        );
      })}
      <div className="fin-tz is-su mk-zeile mk-summe" style={{ "--cols": cols } as CSSProperties}>
        <span className="mk-name">
          <b>Kader gesamt</b>
          <small>{zeilen.length} Spieler</small>
        </span>
        <span />
        <span />
        <span />
        <span className="bc-t fin-re">{C1(summe.wg)}</span>
        <span />
        <span className="bc-t fin-re">{C1(summe.gt)}</span>
        <span className="bc-t fin-re">{C1(summe.gs)}</span>
      </div>
    </div>
  );
}

function Karten({ u, gesicht, klauselRegel }: { u: ReturnType<typeof marketingTeamUebersicht>; gesicht: MarketingKaderZeile | null; klauselRegel: boolean }) {
  return (
    <div className="mk-karten">
      <section className="mk-karte" aria-label="Wohin das Werbegeld geht">
        <h3>Wohin das Werbegeld geht</h3>
        <dl>
          <div><dt>Werbegeld im Kader</dt><dd className="bc-t">{C1(u.werbegeld)}</dd></div>
          <div><dt>an die Spieler (Moral)</dt><dd className="bc-t">{C1(u.spielerAnteile)}</dd></div>
          <div><dt>Team-Anteile{u.deckelGreift ? " (Deckel 12 C)" : ""}</dt><dd className="bc-t">{C1(u.teamAnteile)} <small>({u.mittlererAnteilProzent} %)</small></dd></div>
          <div><dt>Teammarke (nach Budget-Rang)</dt><dd className="bc-t">{C1(u.teammarke)}</dd></div>
          <div className="is-su"><dt>in der Kasse je Saison</dt><dd className="bc-t">{C1(u.ansKasse)}</dd></div>
        </dl>
      </section>
      <section className="mk-karte" aria-label="Aushängeschild">
        <h3>Aushängeschild</h3>
        {gesicht ? (
          <>
            <p className="mk-gross">{gesicht.name}</p>
            <p>
              Marketability <b className="bc-t">{Math.round(gesicht.ergebnis.marketability)}</b> · Werbegeld{" "}
              <b className="bc-t">{C1(gesicht.ergebnis.werbegeld)}</b> (+25 %) · Team-Anteil <b className="bc-t">{gesicht.ergebnis.teamAnteilProzent} %</b> (+8 Punkte)
            </p>
            <p className="mk-klein">{klauselRegel ? "Wahl im Reiter Aushängeschild; ohne Wahl gilt die KI-Wahl mit dem höchsten Zusatzertrag fürs Team." : "Höchste Marketability unter deinen sechs besten Spielern."}</p>
          </>
        ) : (
          <p className="mk-klein">Noch kein Kader.</p>
        )}
      </section>
      <section className="mk-karte" aria-label="Team-Anteil dynamisch">
        <h3>Team-Anteil: dynamisch</h3>
        <dl>
          <div><dt>Ausgangswert</dt><dd className="bc-t">{MARKETING_KONFIG.teamAnteilBasis} %</dd></div>
          <div><dt>Persönlichkeit</dt><dd className="bc-t">±20</dd></div>
          <div><dt>Klausel · Laufzeit</dt><dd className="bc-t">±10 · ±5</dd></div>
          <div><dt>Moral · Gesicht</dt><dd className="bc-t">±5 · +8</dd></div>
          <div><dt>Teamerfolg</dt><dd className="bc-t">{vz(u.erfolg.punkte)} <small>{u.erfolg.grund}</small></dd></div>
          <div className="is-su"><dt>Grenzen · Netz · Deckel</dt><dd className="bc-t">15 bis 65 % · 22 / 25 / 28 % vom Gehalt (je Klausel) · 12 C je Team</dd></div>
        </dl>
      </section>
    </div>
  );
}

function Liste({ titel, daten, art }: { titel: string; daten: { rassen: string[]; klassen: string[]; traits: string[] }; art: "po" | "ne" }) {
  const zeile = (name: string, items: string[]) => (
    <div className="mk-lz">
      <em>{name}</em>
      <span>{items.length ? items.map((m) => <Marke key={m} text={m.toUpperCase()} art={art} />) : <Marke text="KEINE" art="leer" />}</span>
    </div>
  );
  return (
    <div className="mk-liste">
      <h4>{titel}</h4>
      {zeile("Rassen", daten.rassen)}
      {zeile("Klassen", daten.klassen)}
      {zeile("Traits", daten.traits)}
    </div>
  );
}

function FarbeBalken({ farbe, start }: { farbe: Fanfarbe; start: Fanfarbe }) {
  return (
    <div className="mk-farbe">
      {FARB_NAMEN.map((n, i) => {
        const d = Math.round((farbe[i]! - start[i]!) * 10) / 10;
        return (
          <div key={n} className="mk-fz">
            <b style={{ color: FARB_VAR[i] }}>{n}</b>
            <span className="mk-fb"><i style={{ width: `${Math.min(100, (farbe[i]! / 12) * 100)}%`, background: FARB_VAR[i] }} /></span>
            <span className="bc-t">{z1(farbe[i]!)}</span>
            <small className={tonKlasse(d)}>{Math.abs(d) < 0.05 ? "wie am Start" : `${d > 0 ? "+" : MINUS}${z1(Math.abs(d))} seit dem Start`}</small>
          </div>
        );
      })}
    </div>
  );
}

function KontextFan({ u }: { u: ReturnType<typeof marketingTeamUebersicht> }) {
  const p = u.profil;
  const achse = 50 + p.ton * 50;
  const start = FANPROFILE[u.teamId]?.farbeStart ?? ([5, 5, 5, 5] as Fanfarbe);
  return (
    <div className="mk-kb" data-testid="mk-kontext-fan">
      <div className="mk-kopf">
        <span className="gk">Deine Fans</span>
        <h3>{p.zielgruppe}</h3>
        <p className="mk-klein">
          Ton {vz(Math.round(p.ton * 100) / 100)} · {tonWort(p.ton)}. Schlechte Manieren sind kein schlechtes Marketing: der Ton dreht nur die Richtung, Kante schlägt die brave Mitte.
        </p>
        <div className="mk-ton"><u style={{ left: `${achse}%` }} /></div>
        <div className="mk-ton-l"><span>Bösewicht</span><span>Mitte</span><span>Liebling</span></div>
      </div>
      <Liste titel="Fans mögen" daten={p.mag} art="po" />
      <Liste titel="Fans meiden" daten={p.meidet} art="ne" />
      <div className="mk-kopf">
        <span className="gk">Farbe der Fans</span>
        <FarbeBalken farbe={p.fanfarbe} start={start} />
        <p className="mk-klein">Die Farbe driftet beim Saisonwechsel mit deinem Kader und deinem Erfolg und wirkt als Farb-Glied der Passung (höchstens ±5 %).</p>
      </div>
    </div>
  );
}

function KontextSpieler({ z, u }: { z: MarketingKaderZeile | null; u: ReturnType<typeof marketingTeamUebersicht> }) {
  if (!z) return <div className="fin-leer">Wähle links einen Spieler.</div>;
  const e = z.ergebnis;
  const farbe = KLASSEN_FARBE[z.className];
  return (
    <div className="mk-kb" data-testid="mk-kontext-spieler">
      <div className="mk-kopf">
        <span className="gk">{z.className} · {z.race}</span>
        <h3>{z.name}</h3>
        <p className="mk-traits">{z.traits.length ? z.traits.map((t) => <Marke key={t} text={t} />) : <Marke text="KEINE TRAITS" art="leer" />}</p>
      </div>
      <div className="mk-frage">
        <h4>1 · Warum fällt er auf?</h4>
        <div className="mk-zl"><span>Leistung (Perzentil × 0,30)</span><b className="bc-t">{Math.round(e.leistung)}</b></div>
        <div className="mk-zl"><span>Ausstrahlung aus den Traits (10 + 1,2 × {vz(e.traitSumme)})</span><b className="bc-t">{Math.round(e.ausstrahlung)}</b></div>
        <div className="mk-zl"><span>Typ (Klasse und Rasse)</span><b className="bc-t">{Math.round(e.typ)}</b></div>
        <div className="mk-zl"><span>Schub durch Aktionen</span><b className="bc-t">{Math.round(e.schub)}</b></div>
        <div className="mk-zl is-su"><span>Reichweite</span><b className="bc-t">{Math.round(e.reichweite)}</b></div>
        <p className="mk-klein">Ton {vz(e.ton)} ({tonWort(e.ton)}) · Kante {e.kante.toLocaleString("de-DE")} {e.kante < 0.2 ? "(brav und farblos)" : e.kante >= 0.6 ? "(viel Profil)" : ""}</p>
      </div>
      <div className="mk-frage">
        <h4>2 · Warum passt er zu deinen Fans?</h4>
        <div className="mk-zl"><span>Kante (Langweiler-Abschlag bis Kanten-Bonus)</span><b className={`bc-t ${tonKlasse(e.passKante)}`}>{pp(e.passKante)} %</b></div>
        <div className="mk-zl"><span>Ton gegen den Ton der Fans</span><b className={`bc-t ${tonKlasse(e.passTon)}`}>{pp(e.passTon)} %</b></div>
        <div className="mk-zl"><span>Thema: {e.themaTexte.length ? e.themaTexte.join(" · ") : "nichts, was die Fans mögen oder meiden"}</span><b className={`bc-t ${tonKlasse(e.passThema)}`}>{pp(e.passThema)} %</b></div>
        <div className="mk-zl"><span>Farbe ({farbe == null ? "ohne" : FARB_NAMEN[farbe]})</span><b className={`bc-t ${tonKlasse(e.passFarbe)}`}>{pp(e.passFarbe)} %</b></div>
        <div className="mk-zl is-su"><span>Passung · Marketability {Math.round(e.reichweite)} × {e.passung.toLocaleString("de-DE")}</span><b className="bc-t">{Math.round(e.marketability)}</b></div>
      </div>
      <div className="mk-frage">
        <h4>3 · Wie viel davon bekommt das Team?</h4>
        <div className="mk-zl"><span>Ausgangswert</span><b className="bc-t">{MARKETING_KONFIG.teamAnteilBasis} %</b></div>
        {e.bausteine.map((b) => (
          <div className="mk-zl" key={b.id}>
            <span>{b.label}: {b.text}</span>
            <b className={`bc-t ${tonKlasse(b.punkte)}`}>{b.punkte === 0 ? "±0" : `${b.punkte > 0 ? "+" : MINUS}${Math.abs(b.punkte)}`}</b>
          </div>
        ))}
        <div className="mk-zl is-su"><span>Team-Anteil{e.teamAnteilRoh !== e.teamAnteilProzent ? ` (rechnerisch ${e.teamAnteilRoh} %, begrenzt auf 15 bis 65 %)` : ""}</span><b className="bc-t">{e.teamAnteilProzent} %</b></div>
        <div className="mk-zl"><span>Werbegeld je Saison</span><b className="bc-t">{C1(e.werbegeld)}</b></div>
        <div className="mk-zl"><span>ans Team{e.netzGreift ? ` (Sicherheitsnetz: höchstens ${Math.round(MARKETING_KONFIG.klauselNetz[String(z.klausel) as "-1" | "0" | "1"] * 100)} % des Gehalts)` : ""}</span><b className="bc-t">{C1(e.ansTeam)}</b></div>
        <div className="mk-zl"><span>an ihn: seine Werbeverträge</span><b className="bc-t">{C1(e.anIhn)}</b></div>
        <div className="mk-zl"><span>Moral aus den Werbeverträgen</span><b className="bc-t">{e.moralZuschlag > 0 ? <><BcMoralGesicht wert={Math.min(100, (z.moralOhne ?? 50) + e.moralZuschlag)} groesse={16} /> +{e.moralZuschlag}</> : "±0"}</b></div>
        <p className="mk-klein">Verletzte zählen zur Hälfte. Team-Anteile gelten je Saison und Kaderstand (Moral im Anteil eingefroren{u.vorschau ? "; Vorschau: noch nicht gebucht, die Zahlen rechnen mit dem heutigen Stand" : ""}); je Spieltag wird ein Zwanzigstel gebucht. Der Teamerfolg der Vorsaison gilt für alle Spieler des Teams ({u.erfolg.grund}).</p>
      </div>
    </div>
  );
}

function KontextVerlauf({ gameState, u }: { gameState: GameState; u: ReturnType<typeof marketingTeamUebersicht> }) {
  const stempel = gueltigerMarketingStempel(gameState);
  const start = FANPROFILE[u.teamId]?.farbeStart ?? ([5, 5, 5, 5] as Fanfarbe);
  const verlauf = stempel?.verlauf?.[u.teamId] ?? [];
  const zeilen: Array<{ seasonId: string; farbe: Fanfarbe; grund: string }> = verlauf.length
    ? verlauf
    : [{ seasonId: gameState.season.id, farbe: u.profil.fanfarbe, grund: verlauf.length === 0 && u.profil.fanfarbe.every((x, i) => x === start[i]) ? "Start" : "heute" }];
  const nr = (id: string) => id.replace(/\D+/g, "") || id;
  return (
    <div className="mk-kb" data-testid="mk-kontext-verlauf">
      <div className="mk-kopf">
        <span className="gk">Farbe der Fans je Saison</span>
        <div className="mk-vl">
          <div className="mk-vh"><span>Saison</span>{FARB_NAMEN.map((n, i) => <b key={n} style={{ color: FARB_VAR[i] }}>{n}</b>)}</div>
          {zeilen.map((r) => (
            <div key={r.seasonId} className="mk-vz">
              <span>S{nr(r.seasonId)}<small>{r.grund}</small></span>
              {r.farbe.map((x, i) => <b key={i} className="bc-t">{z1(x)}</b>)}
            </div>
          ))}
        </div>
      </div>
      <div className="mk-frage">
        <h4>Die Regel</h4>
        <p className="mk-klein">
          Beim Saisonwechsel wandert jede Farbe ein Stück zum Ziel: je zur Hälfte der Anteil der Klassenfarben im Kader und der Anteil deiner Punkte nach Disziplinfarbe. Der Schritt ist
          10 % (Saisonziel verfehlt), 15 % (erreicht) oder 20 % (Titel oder Farb-Meister). Keine Farbe entfernt sich mehr als 6 Punkte vom Startwert, die Summe bleibt 20. Ein Fanprofil kippt nicht in einer Saison.
        </p>
      </div>
    </div>
  );
}

export default function MarketingModern({ gameState, teamId, startKontext = "fan", startSpieler = null, onAktion, kannSchreiben = false, startAnsicht = "kader" }: MarketingModernProps) {
  const [kontext, setKontext] = useState<MarketingKontextReiter>(startKontext);
  const [ansicht, setAnsicht] = useState<MarketingAnsicht>(startAnsicht);
  const [wahl, setWahl] = useState<string | null>(startSpieler);
  const aktiv = marketingAktiv(gameState);
  const u = useMemo(() => (teamId ? marketingTeamUebersicht(gameState, teamId) : null), [gameState, teamId]);

  if (!teamId || !u) {
    return (
      <div className="bc fin mk" data-testid="marketing-modern">
        <div className="fin-leer">
          <b>Kein Team gewählt.</b> Das Marketing zeigt immer das eigene Team.
        </div>
      </div>
    );
  }

  const wappen = getStaticTeamLogoUrl(teamId) ?? gameState.teams.find((t) => t.teamId === teamId)?.logoPath ?? null;
  const teamName = gameState.teams.find((t) => t.teamId === teamId)?.name ?? u.profil.name;
  const saisonNr = gameState.season.id.replace(/\D+/g, "") || gameState.season.id;
  const gesicht = u.zeilen.find((z) => z.istGesicht) ?? null;
  const gewaehlt = u.zeilen.find((z) => z.playerId === wahl) ?? gesicht ?? u.zeilen[0] ?? null;
  const waehle = (id: string) => {
    setWahl(id);
    setKontext("spieler");
  };

  return (
    <div className="bc fin mk" data-testid="marketing-modern">
      <BcHero
        wappen={wappen}
        wappenAlt={teamName}
        dachzeile={<>Saison {saisonNr} · Kader · Marketing{u.vorschau ? <> · <b data-testid="marketing-vorschau">Vorschau</b></> : null}</>}
        titel="Marketing"
        untertitel={
          <>
            {teamName} · Fanprofil <b>{u.profil.zielgruppe}</b> · <b className="bc-t">{C1(u.ansKasse)}</b> ans Team · <b className="bc-t">{C1(u.spielerAnteile)}</b> an die Spieler
          </>
        }
        mitte={
          <>
            <BcReiter aktiv={ansicht === "kader" && kontext === "fan"} onClick={() => { setAnsicht("kader"); setKontext("fan"); }} eyebrow="Fanprofil" titel="Fans" symbol={<BcIcon name="team" />} wert={vz(Math.round(u.profil.ton * 100) / 100)} wertNote="Ton" />
            <BcReiter aktiv={ansicht === "kader" && kontext === "spieler"} onClick={() => { setAnsicht("kader"); setKontext("spieler"); }} eyebrow="Kasse je Saison" titel="Marketing" symbol={<BcIcon name="karte" />} wert={z1(u.ansKasse)} wertNote="C" />
            <BcReiter aktiv={ansicht === "kader" && kontext === "verlauf"} onClick={() => { setAnsicht("kader"); setKontext("verlauf"); }} eyebrow="Farbe der Fans" titel="Verlauf" symbol={<BcIcon name="krone" />} wert={String(Math.max(1, (gueltigerMarketingStempel(gameState)?.verlauf?.[teamId]?.length ?? 1)))} wertNote="Saisons" />
            <BcReiter aktiv={ansicht === "gesicht"} onClick={() => setAnsicht("gesicht")} eyebrow="Aushängeschild" titel="Gesicht" symbol={<BcIcon name="zauber" />} wert={gesicht ? gesicht.name.split(" ")[0]! : "—"} wertNote={werbeklauselAktiv(gameState) ? "" : "ab Saisonwechsel"} />
          </>
        }
        rechts={
          <div className="fin-hr">
            <div className="fin-frist">
              <em>Aushängeschild der Saison</em>
              <strong className="bc-t">{gesicht ? `${gesicht.name} · ${Math.round(gesicht.ergebnis.marketability)}` : "—"}</strong>
            </div>
          </div>
        }
      />
      {ansicht === "gesicht" ? (
        <AushaengeschildAnsicht gameState={gameState} teamId={teamId} onAktion={onAktion} kannSchreiben={kannSchreiben} />
      ) : (
      <div className="fin-work">
        <section className="fin-pan" aria-label="Dein Kader">
          <div className="fin-pk">
            <h2>Dein Kader: wer wirbt, und warum?</h2>
            <span className="fin-hin">Je Spieler: warum er auffällt, warum er zu deinen Fans passt und wie viel davon beim Team bleibt.</span>
            <span className="fin-sp" />
          </div>
          <div className="fin-kb">
            {!aktiv ? (
              <div className="fin-hinweis" data-testid="mk-nicht-aktiv">
                <span>
                  <b>Marketing gilt in dieser Saison noch nicht.</b> Ein bestehender Spielstand bekommt Werbegeld, Team-Anteil, Teammarke und den Moral-Zuschlag mit dem nächsten Saisonwechsel. Die Tabelle
                  zeigt, was dein Kader bei den heutigen Fans einbrächte; gebucht wird noch nichts.
                </span>
              </div>
            ) : null}
            {u.zeilen.length === 0 ? <div className="fin-leer">Dein Kader ist leer. Ohne Spieler gibt es kein Werbegeld, nur die Teammarke.</div> : (
              <>
                <Karten u={u} gesicht={gesicht} klauselRegel={werbeklauselAktiv(gameState)} />
                <KaderTabelle zeilen={u.zeilen} gewaehlt={gewaehlt?.playerId ?? null} onWahl={waehle} />
              </>
            )}
          </div>
          <div className="fin-kf">
            <span><i style={{ background: "var(--bc-gold)" }} />Leistung</span>
            <span><i style={{ background: "var(--bc-p1)" }} />Ausstrahlung</span>
            <span><i style={{ background: "var(--bc-p6)" }} />Typ</span>
            <span className="fin-sp" />
            <span>Einheit C je Saison · gebucht je Spieltag als Posten „Marketing“ · Marktwert und Sponsor bleiben unverändert</span>
          </div>
        </section>
        <aside className="fin-pan" aria-label="Kontext">
          <div className="fin-ktabs" role="tablist">
            {(
              [
                ["fan", "Fanprofil"],
                ["spieler", "Spieler"],
                ["verlauf", "Verlauf"],
              ] as Array<[MarketingKontextReiter, string]>
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={kontext === id} className={kontext === id ? "is-an" : ""} onClick={() => setKontext(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="fin-kb">
            {kontext === "fan" ? <KontextFan u={u} /> : null}
            {kontext === "spieler" ? <KontextSpieler z={gewaehlt} u={u} /> : null}
            {kontext === "verlauf" ? <KontextVerlauf gameState={gameState} u={u} /> : null}
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
