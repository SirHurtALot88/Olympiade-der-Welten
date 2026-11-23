"use client";

/**
 * BUDGET-GESPRAECH MIT DEM VORSTAND (23.11., Chris: „bau das“). Vorlage: public/mockups/budget-gespraech-22-11.html, Konzept
 * docs/design/budget-gespraech-s1-22-11.md. Neu gebaut im Mockup-Stil (eigene Komponente, eigenes CSS), nicht in eine alte Seite eingehaengt.
 * Drei Schritte: Lage, Verhandeln, Vereinbarung. Links der Vorstand mit seiner Antwort (feste Regel, kein Wuerfel), rechts der Entwurf.
 * Alle Zahlen kommen aus `beurteileBudgetWahl` und damit aus `berechneVorstandBudgetStand` auf dem Stand NACH der Wahl: gezeigt = gebucht.
 * Mehrspieler: das Team kommt vom Aufrufer (aktiver Manager), geschrieben wird ueber `POST /api/finance/vorstand` (`budget_unterschreiben`).
 */

import { useMemo, useState } from "react";

import { BcHero, BcIcon, BcReiter } from "@/components/foundation/broadcast";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { VorstandAktionFn } from "@/lib/finance/vorstand-aktion-typen";
import {
  BUDGET_VORSCHLAG,
  BUDGET_ZUSAGE_TEXT,
  beurteileBudgetWahl,
  budgetTisch,
  kaeufeDieserSaison,
  lesBudgetVereinbarung,
  type BudgetAmbition,
  type BudgetRuecklage,
  type BudgetWahl,
} from "@/lib/finance/vorstand-budget-gespraech";
import { CHARAKTER_TEXT, gespraechCharakter } from "@/lib/finance/vorstand-gespraech";
import { VORSTAND_STUFEN } from "@/lib/finance/vorstand-budgetfreigabe";
import { UMSCHICHT_GRENZE_ANTEIL } from "@/lib/finance/vorstand-budgetfreigabe";
import { getLeagueOf, isLeagueSplitActive } from "@/lib/season/league-split";
import { C, prozent, vz, zahl } from "./office-format";

import "./budget-gespraech.css";

const PORTRAET = {
  antreiber: { datei: "antreiber-orc", rasse: "Orc" },
  kaufmann: { datei: "kaufmann-dwarf", rasse: "Dwarf" },
  kassenwart: { datei: "kassenwart-construct", rasse: "Construct" },
} as const;

const STUFEN_NAME: Record<string, string> = { hoch: "hoch", standard: "Standard", niedrig: "niedrig", knapp: "knapp", sparauflage: "Sparauflage" };
const PFLICHT = 8;
const SPIELTAGE = 20;
const f1 = (v: number) => zahl(v, 1);

export type BudgetGespraechProps = {
  gameState: GameState;
  teamId: string;
  onAktion?: VorstandAktionFn;
  kannSchreiben: boolean;
  /** Im Draft-Tor: „Zum Draft“ nach der Unterschrift. */
  onFertig?: () => void;
  /** Im Draft-Tor haelt die Seite den Draft an, bis alle unterschrieben haben. */
  imTor?: boolean;
  /** Teams (Namen), auf die der Draft noch wartet. */
  wartetAuf?: string[];
  /** Im Office: zurueck zum Vorstand. */
  onZurueck?: () => void;
};

export default function BudgetGespraech({ gameState, teamId, onAktion, kannSchreiben, onFertig, imTor = false, wartetAuf = [], onZurueck }: BudgetGespraechProps) {
  const stempel = lesBudgetVereinbarung(gameState, teamId);
  const gekauft = kaeufeDieserSaison(gameState, teamId) > 0;
  const [schritt, setSchritt] = useState<1 | 2 | 3>(stempel ? 3 : 1);
  const [wahl, setWahl] = useState<BudgetWahl>(BUDGET_VORSCHLAG);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);

  const u = useMemo(() => beurteileBudgetWahl(gameState, teamId, wahl), [gameState, teamId, wahl]);
  const v0 = useMemo(() => beurteileBudgetWahl(gameState, teamId, BUDGET_VORSCHLAG), [gameState, teamId]);
  const tisch = useMemo(() => budgetTisch(gameState), [gameState]);
  const team = gameState.teams.find((t) => t.teamId === teamId);
  const identity = gameState.teamIdentities?.find((i) => i.teamId === teamId);
  const ch = gespraechCharakter(gameState, teamId);
  const wappen = getStaticTeamLogoUrl(teamId) ?? team?.logoPath ?? null;
  const s = u.stand;
  const saisonNr = Number(/(\d+)\s*$/.exec(gameState.season.id)?.[1] ?? 1);
  const unterschrieben = stempel != null;
  const darf = kannSchreiben && Boolean(onAktion) && !busy && !gekauft;
  const kl = u.urteil === "zustimmung" ? "zusage" : u.urteil === "gegenangebot" ? "gegen" : "nein";
  const wort = u.urteil === "zustimmung" ? "Zusage" : u.urteil === "gegenangebot" ? "Gegenangebot" : "Ablehnung";
  const alles = wahlAlles(u);
  const kassen = s.herleitung.anfangskasse;

  const setze = (p: Partial<BudgetWahl>, neuVerhandeln = true) => setWahl((w) => ({ ...w, ...p, ...(neuVerhandeln && ("ambition" in p || "ruecklage" in p) ? { zusagen: [] } : {}) }));

  async function unterschreibe(mitWahl: BudgetWahl) {
    if (!onAktion) return;
    setBusy(true);
    try {
      const r = await onAktion({ aktion: "budget_unterschreiben", wahl: mitWahl });
      setMeldung(r.meldung);
      if (r.ok) setSchritt(3);
    } finally {
      setBusy(false);
    }
  }

  // Kader-Ausblick: wie viele Spieler tragen beide Toepfe zum Marktpreis (Median des freien Marktes).
  const platzFee = Math.max(1, u.standVorschlag.kaderpflicht.platzAbloese);
  const platzGeh = Math.max(0.1, u.standVorschlag.kaderpflicht.platzGehalt);
  const nT = s.investition.gesamt / platzFee;
  const nG = s.gehalt.gesamt / platzGeh;
  const kader = Math.min(14, Math.floor(Math.min(nT, nG) + 1e-9));
  const kaderV0 = Math.min(14, Math.floor(Math.min(v0.stand.investition.gesamt / platzFee, v0.stand.gehalt.gesamt / platzGeh) + 1e-9));
  const kaderZiel = Math.max(PFLICHT, Math.min(14, Math.round(identity?.playerOpt ?? 11)));

  const titel: Array<[string, string, string]> = [
    ["Lage", prozent(u.quoteBasis), "Freigabe"],
    ["Verhandeln", wort, "Antwort"],
    ["Vereinbarung", unterschrieben ? "gestempelt" : "offen", "Stand"],
  ];
  const vorstandTeam = (
    <>
      <BcHero
        wappen={wappen}
        wappenAlt={team?.name}
        dachzeile={<>Office · Vorstand</>}
        titel="Budget-Gespräch"
        untertitel={
          <>
            <b className="bc-t">{team?.name}</b> · Saison {saisonNr} · {saisonNr <= 1 ? "vor dem Draft" : "vor dem Transferfenster"}
          </>
        }
        mitte={titel.map(([name, erw, erwText], i) => (
          <BcReiter
            key={name}
            aktiv={schritt === i + 1}
            onClick={() => setSchritt((i + 1) as 1 | 2 | 3)}
            eyebrow={`Schritt ${i + 1} von 3`}
            titel={name}
            symbol={schritt > i + 1 || (i === 2 && unterschrieben) ? <BcIcon name="check" /> : <span>{i + 1}</span>}
            wert={erw}
            wertNote={erwText.length > 0 ? erwText : undefined}
          />
        ))}
        rechts={
          imTor ? (
            <div className="bgs-frist">
              <span className="gk">Draft beginnt</span>
              <strong>{wartetAuf.length > 0 ? `wartet auf ${wartetAuf.join(", ")}` : "sobald alle unterschrieben haben"}</strong>
            </div>
          ) : onZurueck ? (
            <button type="button" className="btn" onClick={onZurueck}><BcIcon name="zurueck" />Zum Office</button>
          ) : null
        }
      />
    </>
  );

  /* ---------------------------------------------------------------- links: der Vorstand */
  const p = PORTRAET[ch.charakter];
  const rede =
    schritt === 1 ? (
      <>
        „{saisonNr <= 1 ? "Wir kennen uns noch nicht. " : ""}Mein Vertrauen von <b>{f1(u.vertrauen ?? 5)}</b> kommt aus dem, wofür dieser Verein steht. Dafür gebe ich <b>{prozent(u.quoteBasis)}</b> frei. Nehmen Sie das, oder verhandeln Sie.“
      </>
    ) : u.sperre ? (
      <>{u.sperre} Erst liefern, dann wetten.</>
    ) : u.urteil === "zustimmung" ? (
      u.preis === 0 && u.zusagen.length === 0 ? (
        <>„Das ist mein Vorschlag. Daran halte ich mich.“</>
      ) : (
        <>
          „Einverstanden.“ Ihr Gewicht <b>{f1(u.gewicht)}</b> deckt den Preis <b>{f1(u.preis)}</b>.
        </>
      )
    ) : u.urteil === "gegenangebot" ? (
      <>
        „Fast.“ Es fehlen <b>{f1(u.luecke)}</b> Punkte. Er stimmt zu mit: <b>{u.vorschlag.map((a) => BUDGET_ZUSAGE_TEXT[a]).join(" und ")}</b>.
      </>
    ) : (
      <>
        „Nein.“ Es fehlen <b>{f1(u.luecke)}</b> Punkte, mehr als Zusagen ausgleichen. Kleiner bitten.
      </>
    );
  const skala = Math.max(30, u.preis, u.gewicht) * 1.08;
  const stufeSchwelle = (() => {
    const i = VORSTAND_STUFEN.findIndex((x) => Math.abs(x.anteil - u.quoteBasis) < 1e-9);
    return i <= 0 ? null : VORSTAND_STUFEN[i - 1]!.abVertrauen;
  })();

  const links = (
    <section className="pan" aria-label="Vorstand">
      <div className="pk"><h2>Der Vorstand</h2><span className="sp" /><span className="hin">antwortet nach fester Regel</span></div>
      <div className="kb">
        <div className="vs-kopf">
          <span className={`vs-bild ${schritt === 1 ? "" : kl}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/portraits/vorstand/${p.datei}.png`} alt={`Vorstand, ${CHARAKTER_TEXT[ch.charakter].name} (${p.rasse})`} onError={(e) => ((e.currentTarget.parentElement as HTMLElement).classList.add("ohne"), e.currentTarget.remove())} />
            <span className="rasse">{p.rasse}</span>
          </span>
          <div>
            <span className="gk">Charakter aus der Team-Identität</span>
            <h3>{CHARAKTER_TEXT[ch.charakter].name}</h3>
            <p>{CHARAKTER_TEXT[ch.charakter].satz}</p>
          </div>
        </div>
        <div className="werte">
          <div><span className="gk">Vertrauen</span><strong className="t">{f1(u.vertrauen ?? 5)}</strong></div>
          <div><span className="gk">Finanzwert</span><strong className="t">{f1(normiere(identity?.finances))}</strong></div>
          <div><span className="gk">Ambition</span><strong className="t">{f1(normiere(identity?.ambition))}</strong></div>
        </div>
        <div className={`blase ${schritt === 1 ? "" : kl}`}>
          {schritt === 1 ? null : (
            <div className="urteil"><b>{wort}</b><span className="sp" />{schritt === 3 && unterschrieben ? <span className="marke gut">gestempelt</span> : null}</div>
          )}
          <div>{rede}</div>
          {schritt > 1 && u.urteil === "gegenangebot" ? (
            <button type="button" className="btn ja" onClick={() => setWahl((w) => ({ ...w, zusagen: [...new Set([...w.zusagen, ...u.vorschlag])] }))}>
              <BcIcon name="check" />Gegenangebot annehmen
            </button>
          ) : null}
        </div>
        <div className="waage">
          <div className="kopf"><span className="gk">Gewicht gegen Preis</span><strong className={`t ${u.luecke > 0 ? "minus" : "plus"}`}>{f1(u.gewicht)} : {f1(u.preis)}</strong></div>
          <div className="wbalken">
            <i className={u.luecke > 0 ? "zu" : ""} style={{ width: `${Math.min(100, (u.gewicht / skala) * 100)}%` }} />
            {u.preis > 0 ? <u style={{ left: `${(u.preis / skala) * 100}%` }} title="Preis" /> : null}
          </div>
          <ul className="posten">
            <li><span>Vertrauen {f1(u.vertrauen ?? 5)} × 2</span><b className="t plus">+{f1(u.basis)}</b></li>
            {u.zusagen.map((x) => <li key={x.text}><span>Zusage: {x.text}</span><b className="t plus">+{f1(x.punkte)}</b></li>)}
            {u.bitten.length > 0 ? u.bitten.map((x) => <li key={x.text}><span>Bitte: {x.text}</span><b className="t minus">−{f1(x.punkte)}</b></li>) : <li><span>Keine Bitte über den Vorschlag hinaus</span><b className="t">0,0</b></li>}
          </ul>
        </div>
        <div className="vfolgen">
          <span className="gk">Was das fürs Vertrauen heißt{u.zielRang != null ? ` · Ziel Rang ${u.zielRang}` : ""}</span>
          <div><span>Ziel erreicht</span><b className="t plus">{vz(u.folge.ok, 2)}</b></div>
          <div><span>Ziel verfehlt</span><b className="t minus">{vz(u.folge.nein, 2)}</b></div>
          <div><span>Aus Zusagen und Rücklage, nächste Festlegung</span><b className={`t ${u.folge.sofort < 0 ? "minus" : u.folge.sofort > 0 ? "plus" : ""}`}>{u.folge.sofort ? vz(u.folge.sofort, 2) : "0,0"}</b></div>
          <div><span>Nächste Stufe nach oben</span><b className="t">{u.quoteBasis >= 1 ? "schon 100 %" : stufeSchwelle != null ? `ab ${f1(stufeSchwelle)}` : "—"}</b></div>
        </div>
        <p className="regel">Regel: Gewicht ≥ Preis → Zusage. Bis 10 Punkte Lücke → Gegenangebot, wenn Zusagen sie decken. Sonst Ablehnung. Kein Würfel, keine Geldstrafe.</p>
      </div>
    </section>
  );

  /* ---------------------------------------------------------------- Mitte */
  const opt = (gr: "ambition" | "ruecklage", k: BudgetAmbition | BudgetRuecklage, name: string, txt: string, effB: string, effS: string, dis?: boolean) => (
    <button
      type="button"
      key={k}
      className="opt"
      aria-pressed={wahl.ambition !== "alles" && wahl[gr] === k}
      disabled={dis || wahl.ambition === "alles"}
      onClick={() => setze({ [gr]: k } as Partial<BudgetWahl>)}
    >
      <span className="punkt" />
      <span><strong>{name}</strong><span className="txt">{txt}</span></span>
      <span className="eff"><b className="t">{effB}</b>{effS}</span>
    </button>
  );
  const q = u.quoteBasis;
  const qHoch = [0.5, 0.7, 0.8, 0.9, 1].find((x) => x > q + 1e-9) ?? 1;
  const qTief = [...[0.5, 0.7, 0.8, 0.9, 1]].reverse().find((x) => x < q - 1e-9) ?? 0.5;
  const zr = v0.zielRang;
  const ruecklageVoll = v0.stand.herleitung.ruecklageZiel * (saisonNr <= 2 ? 2 : 1);
  const um = s.umschichten;
  const grenzeProzent = alles ? 0.25 : UMSCHICHT_GRENZE_ANTEIL[s.wirksamerAnteil] ?? UMSCHICHT_GRENZE_ANTEIL[q] ?? 0.25;
  const deckel = wahl.zusagen.includes("deckel");
  const schiebMin = Math.floor(um.moeglichVon * 2) / 2;
  const schiebMax = Math.floor(um.moeglichBis * 2) / 2;

  const lage = (
    <>
      <div className="pk"><h2>Die Lage {saisonNr <= 1 ? "vor dem Draft" : "vor dem Fenster"}</h2><span className="sp" /><span className="hin">So kommt der Vorstand auf seinen Vorschlag</span></div>
      <div className="kb">
        <div className="raster lage">
          <div className="karte">
            <h3>Vertrauen → Freigabe</h3>
            <div className="unter">{saisonNr <= 1 ? "In Saison 1 gibt es kein Vorjahr. Das Startvertrauen ist das Vertrauen aus der Team-Identität." : "Das Vertrauen aus der abgelaufenen Saison bestimmt die Stufe."}</div>
            <div className="leiter">
              {VORSTAND_STUFEN.map((st, i) => (
                <div key={st.stufe} className={Math.abs(st.anteil - q) < 1e-9 ? "an" : ""}>
                  <span>{i === VORSTAND_STUFEN.length - 1 ? "darunter" : `ab ${f1(st.abVertrauen)}`}</span>
                  <span>{STUFEN_NAME[st.stufe]}{Math.abs(st.anteil - q) < 1e-9 ? ` · ${team?.name} steht bei ${f1(u.vertrauen ?? 5)}` : ""}</span>
                  <b className="t">{prozent(st.anteil)}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="karte">
            <h3>Transfertopf<span className="sp" /><span className="marke" style={{ background: "var(--heim)" }}>Ablösen · Gebäude</span></h3>
            <div className="unter">Das Geld bleibt auf dem Konto. Der Vorstand gibt nur einen Teil zum Ausgeben frei.</div>
            <div className="rech">
              <div><span>Kasse zum Start</span><b className="t">{C(v0.stand.herleitung.anfangskasse, 1)}</b></div>
              <div><span>− Rücklage nach Finanzwert {f1(v0.stand.herleitung.finanzwert)}<small>{saisonNr <= 1 ? "in Saison 1 die Hälfte von " : "voll: "}{C(v0.stand.herleitung.ruecklageZiel * (saisonNr <= 1 ? 2 : 1), 1)}</small></span><b className="t">−{C(v0.stand.herleitung.ruecklageZiel, 1)}</b></div>
              <div><span>− Gehaltspuffer<small>7 Spieltage Gehalt, soweit die Rücklage sie nicht deckt{saisonNr <= 1 ? "; Saison 1 halb" : ""}</small></span><b className="t">{v0.stand.herleitung.gehaltspuffer > 0.04 ? "−" : ""}{C(v0.stand.herleitung.gehaltspuffer, 1)}</b></div>
              <div><span>× Freigabe</span><b className="t">{prozent(v0.stand.wirksamerAnteil)}</b></div>
              <div className="summe"><span>Transfertopf</span><b className="t">{C(v0.stand.investition.gesamt, 1)}<small>{C(v0.stand.investition.gesperrt + v0.stand.investition.ausgegeben * 0, 1)} bleiben gesperrt auf dem Konto</small></b></div>
            </div>
          </div>
          <div className="karte">
            <h3>Gehaltstopf<span className="sp" /><span className="marke" style={{ background: "var(--gast)" }}>Verträge</span></h3>
            <div className="unter">Tragbar ist das Höhere aus erwartetem Sponsor und Gehalt eines vollen Kaders. Gekürzt wird höchstens auf 75 %.</div>
            <div className="rech">
              <div><span>Sponsor, erwartet</span><b className="t">{C(v0.stand.herleitung.sponsorErwartung, 1)}</b></div>
              <div><span>Zielgehalt<small>Kader auf Soll-Größe</small></span><b className="t">{C(v0.stand.herleitung.zielgehalt, 1)}</b></div>
              <div><span>× Gehaltsquote</span><b className="t">{prozent(v0.stand.gehalt.quote)}</b></div>
              <div className="summe"><span>Gehaltstopf je Saison</span><b className="t">{C(v0.stand.gehalt.gesamt, 1)}<small>{C(v0.stand.gehalt.gesamt / SPIELTAGE)} je Spieltag</small></b></div>
            </div>
          </div>
          <div className="karte">
            <h3>Saisonziel</h3>
            <div className="unter">Der Vorstand erwartet einen Rang. Erfüllt bringt Vertrauen, verfehlt kostet Vertrauen. Geld nimmt er nie weg.</div>
            <div className="zielzeile">
              <div className="rang t">{v0.zielRang != null ? `${v0.zielRang}.` : "—"}<small> von {ligaGroesse(gameState, teamId)}</small></div>
              <div className="folgen">
                <div><span>Ziel erreicht</span><b className="plus t">{vz(v0.folge.ok, 2)} Vertrauen</b></div>
                <div><span>Ziel verfehlt</span><b className="minus t">{vz(v0.folge.nein, 2)} Vertrauen</b></div>
                <div><span>Folge im nächsten Jahr</span><b>neue Freigabe-Stufe</b></div>
              </div>
            </div>
            <div className="neu"><b>Neu ab Saison 1:</b> beide Töpfe gelten vom ersten Pick an, für Mensch und KI gleich. Der Pflichtkader von {PFLICHT} ist nie gesperrt.</div>
          </div>
        </div>
      </div>
      <div className="fuss">
        <span className="hin">Sie können den Vorschlag so annehmen oder verhandeln. Höchstens drei Schritte.</span><span className="sp" />
        <button type="button" className="btn" onClick={() => { setWahl(BUDGET_VORSCHLAG); setSchritt(3); }}>Vorschlag annehmen</button>
        <button type="button" className="btn ja" onClick={() => setSchritt(2)}>Verhandeln<BcIcon name="rechts" /></button>
      </div>
    </>
  );

  const verhandeln = (
    <>
      <div className="pk"><h2>Verhandeln</h2><span className="sp" /><span className="hin">Drei Hebel und ein Sonderantrag. Die Antwort links ändert sich sofort.</span></div>
      <div className="kb">
        <div className="raster hebel">
          <div className="karte">
            <h3>1 · Ambition</h3>
            <div className="unter">Höheres Ziel: mehr Freigabe jetzt, mehr Risiko für das Vertrauen.</div>
            <div className="wahl">
              {opt("ambition", "tief", "Bescheiden", zr != null ? `Rang ${zr + 2}, weniger Druck` : "weniger Druck", prozent(qTief), "Freigabe", q <= 0.5 || (saisonNr <= 1 && q <= 0.8))}
              {opt("ambition", "ziel", "Ziel des Vorstands", zr != null ? `Rang ${zr}, sein Vorschlag` : "sein Vorschlag", prozent(q), "Freigabe")}
              {opt("ambition", "hoch", "Ehrgeizig", zr != null ? `Rang ${Math.max(1, zr - 1)}, verfehlt −0,9` : "verfehlt −0,9", prozent(qHoch), q >= 1 ? "schon voll" : "Freigabe")}
            </div>
          </div>
          <div className="karte">
            <h3>2 · Rücklage</h3>
            <div className="unter">Die Rücklage ist weich: Sie bestimmt, wie viel der Topf zurückhält.</div>
            <div className="wahl">
              {opt("ruecklage", "vorsichtig", "Vorsichtig", saisonNr <= 2 ? "Volle Rücklage" : "Rücklage halten", C(ruecklageVoll, 1), "+0,2 Vertrauen")}
              {opt("ruecklage", "normal", "Normal", saisonNr <= 2 ? "Halbe Rücklage in der ersten Saison" : "Die Regel", C(ruecklageVoll * (saisonNr <= 2 ? 0.5 : 1), 1), "Regel")}
              {opt("ruecklage", "mutig", "Mutig", "Die Hälfte davon anzapfen", C(ruecklageVoll * (saisonNr <= 2 ? 0.25 : 0.5), 1), "−0,5 Vertrauen")}
            </div>
          </div>
          <div className="karte">
            <h3>Sonderantrag</h3>
            <div className="unter">Einmal je Saison, ersetzt Ambition und Rücklage.</div>
            <div className="sonder">
              <ul>
                <li>Bis auf 5 % Puffer ist alles ausgebbar, beide Töpfe 100 %.</li>
                <li>Dafür ein Ziel zwei Plätze besser{zr != null ? `: Rang ${Math.max(1, zr - 2)}` : ""}.</li>
                <li>Erreicht +0,75 Vertrauen, verfehlt −1,0.</li>
                <li>Antrag erst ab Vertrauen 4.</li>
              </ul>
              <button type="button" className="btn" aria-pressed={wahl.ambition === "alles"} onClick={() => setWahl((w) => ({ ...w, ambition: w.ambition === "alles" ? "ziel" : "alles", ruecklage: "normal", zusagen: [] }))}>
                {wahl.ambition === "alles" ? "Antrag zurückziehen" : "Alles auf eine Karte beantragen"}
              </button>
            </div>
          </div>
          <div className="karte breit">
            <h3>3 · Aufteilung<span className="sp" /><span className="gk">1 C Transfer = 1 C Jahresgehalt · Grenze {prozent(grenzeProzent)} des Gehaltstopfs{deckel ? " · Gehaltsdeckel zugesagt" : ""}</span></h3>
            <div className="schieb">
              <div className="seite"><span className="gk" style={{ color: "var(--heim)" }}>Transfertopf</span><strong className="t">{C(s.investition.gesamt, 1)}</strong><small>Ablösen, Gebäude</small></div>
              <div className="mitte">
                <div className="wert t">{Math.abs(um.aktuell) < 0.05 ? "Vorschlag des Vorstands, nichts verschoben" : um.aktuell > 0 ? `${f1(um.aktuell)} C vom Transfer ins Gehalt` : `${f1(-um.aktuell)} C vom Gehalt in den Transfer`}</div>
                <input
                  type="range"
                  aria-label="Aufteilung Transfer und Gehalt"
                  min={schiebMin}
                  max={deckel ? Math.min(0, schiebMax) : schiebMax}
                  step={0.5}
                  value={Math.max(schiebMin, Math.min(schiebMax, wahl.umschichtung))}
                  disabled={schiebMin > -0.5 && schiebMax < 0.5}
                  onChange={(e) => setWahl((w) => ({ ...w, umschichtung: Number(e.target.value) }))}
                />
                <div className="skala t"><span>← bis {f1(-schiebMin)} C mehr Transfer</span><span>bis {f1(schiebMax)} C mehr Gehalt →</span></div>
              </div>
              <div className="seite r"><span className="gk" style={{ color: "var(--gast)" }}>Gehaltstopf je Saison</span><strong className="t">{C(s.gehalt.gesamt, 1)}</strong><small className="t">{C(s.gehalt.gesamt / SPIELTAGE)} je Spieltag</small></div>
            </div>
          </div>
        </div>
      </div>
      <div className="fuss">
        <button type="button" className="btn" onClick={() => setSchritt(1)}><BcIcon name="zurueck" />Lage</button><span className="sp" />
        <span className="hin">{u.urteil === "zustimmung" ? "Der Vorstand sagt zu. Weiter zur Vereinbarung." : u.urteil === "gegenangebot" ? "Gegenangebot annehmen oder kleiner bitten." : "Abgelehnt: so kommt keine Vereinbarung zustande."}</span>
        <button type="button" className="btn ja" disabled={u.urteil !== "zustimmung"} onClick={() => setSchritt(3)}>Zur Vereinbarung<BcIcon name="rechts" /></button>
      </div>
    </>
  );

  const ambTxt = alles ? "Alles auf eine Karte" : u.wirksam.ambition === "hoch" ? "Ehrgeizig" : u.wirksam.ambition === "tief" ? "Bescheiden" : "Ziel des Vorstands";
  const rlTxt = alles ? "entfällt, 5 % Puffer" : u.wirksam.ruecklage === "vorsichtig" ? "vorsichtig, volle Rücklage" : u.wirksam.ruecklage === "mutig" ? "mutig, zur Hälfte angezapft" : saisonNr <= 2 ? "normal, halbe Rücklage" : "normal";
  const ang = s.ruecklageAnzapfen.bereitsAngezapft;
  const blatt = (
    <>
      <div className="pk"><h2>Vereinbarung für Saison {saisonNr}</h2><span className="sp" /><span className="hin">{unterschrieben ? "So steht es im Spielstand" : u.urteil === "zustimmung" ? "So wird es im Spielstand gestempelt" : "Ohne Zusage gilt der Vorschlag des Vorstands"}</span></div>
      <div className="kb">
        <div className="blatt">
          <div className="spalte">
            <div className="gtopf" style={{ ["--c" as string]: "var(--heim)" }}>
              <h3>Transfertopf</h3><span className="gk">Ablösen und Gebäude · harte Grenze</span>
              {unterschrieben ? <div className="stempel">Vereinbart<small>Saison {saisonNr} · {team?.name}</small></div> : null}
              <div className="rech">
                <div><span>Kasse zum Start</span><b className="t">{C(kassen, 1)}</b></div>
                {alles ? (
                  <div><span>− 5 % Puffer, sonst alles frei</span><b className="t">−{C(kassen * 0.05, 1)}</b></div>
                ) : (
                  <>
                    <div><span>− Rücklage und Gehaltspuffer{ang > 0 ? ` (angezapft: +${f1(ang)} C)` : ""}</span><b className="t">−{C(s.herleitung.ruecklageZiel + s.herleitung.gehaltspuffer - ang, 1)}</b></div>
                    <div><span>× Freigabe</span><b className="t">{prozent(s.wirksamerAnteil)}</b></div>
                  </>
                )}
                <div><span>Aufteilung</span><b className="t">{Math.abs(um.aktuell) < 0.05 ? "±0,0" : um.aktuell > 0 ? `−${f1(um.aktuell)}` : `+${f1(-um.aktuell)}`} C</b></div>
              </div>
              <div className="riesig t">{f1(s.investition.gesamt)} <small>C</small></div>
              <div className="dazu">von <b className="t">{C(kassen, 1)}</b> Kasse · <b className="t">{C(Math.max(0, kassen - s.investition.gesamt), 1)}</b> bleiben auf dem Konto</div>
            </div>
            <div className="gtopf" style={{ ["--c" as string]: "var(--gast)" }}>
              <h3>Gehaltstopf</h3><span className="gk">Neue Verträge und Erhöhungen · harte Grenze</span>
              <div className="rech">
                <div><span>Tragbar: das Höhere aus Sponsor {f1(s.herleitung.sponsorErwartung)} C und Zielgehalt {f1(s.herleitung.zielgehalt)} C</span><b className="t">{C(s.herleitung.tragbaresGehalt, 1)}</b></div>
                <div><span>× Gehaltsquote, nie unter 75 %</span><b className="t">{prozent(s.gehalt.quote)}</b></div>
                <div><span>Aufteilung</span><b className="t">{Math.abs(um.aktuell) < 0.05 ? "±0,0" : um.aktuell > 0 ? `+${f1(um.aktuell)}` : `−${f1(-um.aktuell)}`} C</b></div>
              </div>
              <div className="riesig t">{f1(s.gehalt.gesamt)} <small>C je Saison</small></div>
              <div className="dazu"><span className="t">{C(s.gehalt.gesamt / SPIELTAGE)} je Spieltag</span> · reicht für etwa <b className="t">{f1(nG)}</b> Spieler zu {C(platzGeh, 1)}</div>
            </div>
          </div>
          <div className="spalte">
            <div className="klauseln">
              <h3>Was vereinbart ist</h3>
              <dl>
                <dt>Freigabe</dt><dd className="t">{prozent(s.wirksamerAnteil)} Transfer · {prozent(s.gehalt.quote)} Gehalt<small>Vertrauen {f1(u.vertrauen ?? 5)} aus {saisonNr <= 1 ? "der Team-Identität" : "der Vorsaison"}{s.wirksamerAnteil !== q ? `, im Gespräch ${s.wirksamerAnteil > q ? "angehoben" : "gesenkt"}` : ""}</small></dd>
                <dt>Saisonziel</dt><dd className="t">{u.zielRang != null ? `Rang ${u.zielRang} von ${ligaGroesse(gameState, teamId)} · ` : ""}{ambTxt}<small>erreicht {vz(u.folge.ok, 2)} · verfehlt {vz(u.folge.nein, 2)} Vertrauen</small></dd>
                <dt>Rücklage</dt><dd className="t">{C(Math.max(0, s.herleitung.ruecklageZiel - ang), 1)} · {rlTxt}<small>weich: Unterschreiten kostet Vertrauen, sperrt aber nichts</small></dd>
                <dt>Aufteilung</dt><dd className="t">{Math.abs(um.aktuell) < 0.05 ? "wie vorgeschlagen" : um.aktuell > 0 ? `${f1(um.aktuell)} C ins Gehalt verschoben` : `${f1(-um.aktuell)} C in den Transfer verschoben`}</dd>
                <dt>Zusagen</dt><dd>{u.urteil === "zustimmung" && u.wirksam.zusagen.length ? u.wirksam.zusagen.map((a) => BUDGET_ZUSAGE_TEXT[a]).join(" · ") : "keine weiteren"}{u.folge.sofort ? <small>Vertrauen bei der nächsten Festlegung: {vz(u.folge.sofort, 2)}</small> : null}</dd>
                <dt>Geführt von</dt><dd>{stempel ? (stempel.gefuehrtVon === "mensch" ? "dir (Mensch)" : stempel.gefuehrtVon === "ki" ? "der KI" : "dem Vorschlag des Vorstands") : "dir (Mensch)"}<small>delegiert führt die KI dasselbe Gespräch nach derselben Regel</small></dd>
              </dl>
              <div className="gilt"><b className="plus">Gezeigt = gebucht.</b> Planer, Draft und Kaufsperre lesen genau diese Zahlen (<span className="t">kaufRahmen</span>). Der Pflichtkader von {PFLICHT} ist nie gesperrt. Nachverhandeln: zwei Gespräche in der Saison.</div>
            </div>
          </div>
        </div>
      </div>
      <div className="fuss">
        <button type="button" className="btn" onClick={() => setSchritt(2)} disabled={gekauft}><BcIcon name="zurueck" />Nachverhandeln</button><span className="sp" />
        <span className="hin">{meldung ?? (gekauft ? "Es wurde schon gekauft: die Vereinbarung steht." : unterschrieben ? "Gestempelt. Die Töpfe gelten ab dem ersten Pick." : "Mit der Unterschrift gelten die Töpfe für die ganze Saison.")}</span>
        {unterschrieben && onFertig ? (
          <button type="button" className="btn ja" onClick={onFertig} disabled={wartetAuf.length > 0} title={wartetAuf.length > 0 ? `Der Draft wartet auf ${wartetAuf.join(", ")}.` : undefined}>Zum Draft<BcIcon name="rechts" /></button>
        ) : (
          <button type="button" className="btn ja" disabled={!darf} onClick={() => void unterschreibe(u.wirksam)} title={kannSchreiben ? undefined : "Nur der Manager dieses Teams kann unterschreiben."}>
            <BcIcon name="liste" />{unterschrieben ? "Neu unterschreiben" : u.urteil === "zustimmung" ? "Unterschreiben" : "Vorschlag unterschreiben"}
          </button>
        )}
      </div>
    </>
  );

  /* ---------------------------------------------------------------- rechts: Entwurf */
  const pr = (x: number) => (kassen > 0 ? (Math.max(0, x) / kassen) * 100 : 0);
  const dl = (d: number) => (Math.abs(d) < 0.05 ? "" : d > 0 ? "plus" : "minus");
  const dv = (d: number) => (Math.abs(d) < 0.05 ? "±0,0" : `${d > 0 ? "+" : "−"}${f1(Math.abs(d))}`);
  const rechts = (
    <section className="pan" aria-label="Vereinbarung, Entwurf">
      <div className="pk"><h2>{unterschrieben ? "Vereinbarung" : "Entwurf"}</h2><span className="sp" /><span className={`marke ${unterschrieben ? "gut" : u.urteil === "zustimmung" ? "gold" : "leer"}`}>{unterschrieben ? "gestempelt" : u.urteil === "zustimmung" ? "zugesagt" : "Vorschlag gilt"}</span></div>
      <div className="kb">
        <div className="topf">
          <span className="gk" style={{ color: "var(--heim)" }}>Transfertopf</span>
          <div className="zeile"><div className="gross t">{f1(s.investition.gesamt)} <small>C</small></div><div className="klein">Kasse <b className="t">{C(kassen, 1)}</b><br />gesperrt <b className="t">{C(Math.max(0, kassen - s.investition.gesamt), 1)}</b></div></div>
          <div className="balken"><i className="frei" style={{ width: `${pr(s.investition.gesamt)}%` }} /><i className="rl" style={{ width: `${pr(s.herleitung.ruecklageZiel - ang + s.herleitung.gehaltspuffer + Math.max(0, um.aktuell))}%` }} /><i className="vb" style={{ flex: 1 }} /></div>
          <div className="leg"><span style={{ ["--c" as string]: "var(--heim)" }}>frei</span><span style={{ ["--c" as string]: "#5b6578" }}>Rücklage, Puffer{um.aktuell > 0 ? ", ins Gehalt" : ""}</span><span style={{ ["--c" as string]: "#3a4254" }}>Vorbehalt des Vorstands</span></div>
        </div>
        <div className="topf">
          <span className="gk" style={{ color: "var(--gast)" }}>Gehaltstopf</span>
          <div className="zeile"><div className="gross t">{f1(s.gehalt.gesamt)} <small>C je Saison</small></div><div className="klein"><span className="t">{C(s.gehalt.gesamt / SPIELTAGE)}</span><br />je Spieltag</div></div>
          <div className="balken"><i className="frei g" style={{ width: `${Math.min(100, (s.gehalt.gesamt / Math.max(0.1, s.herleitung.tragbaresGehalt)) * 100)}%` }} /><i className="vb" style={{ flex: 1 }} /></div>
          <div className="leg"><span style={{ ["--c" as string]: "var(--gast)" }}>frei für Verträge</span><span style={{ ["--c" as string]: "#3a4254" }}>tragbar wären {C(s.herleitung.tragbaresGehalt, 1)}</span></div>
        </div>
        <div className="eck">
          <div><span className="gk">Freigabe</span><strong className="t">{prozent(s.wirksamerAnteil)}</strong></div>
          <div><span className="gk">Zielrang</span><strong className="t">{u.zielRang != null ? `${u.zielRang}.` : "—"}</strong></div>
          <div><span className="gk">Rücklage</span><strong className="t">{C(Math.max(0, s.herleitung.ruecklageZiel - ang), 1)}</strong></div>
        </div>
        <div className="kader">
          <span className="gk">Kader-Ausblick · Marktpreise ({C(platzFee, 1)} Ablöse, {C(platzGeh, 1)} Gehalt)</span>
          <div className="plaetze">{Array.from({ length: 14 }, (_, i) => <i key={i} className={`${i < kader ? "voll" : ""}${i < PFLICHT ? " pflicht" : ""}${i === kaderZiel - 1 ? " ziel" : ""}`} />)}</div>
          <p>
            Reicht für etwa <b className="t" style={{ color: "var(--tinte)" }}>{kader} Spieler</b> (Pflicht {PFLICHT}, Ziel {kaderZiel}). Es bindet der <b style={{ color: nT < nG ? "var(--heim)" : "var(--gast)" }}>{nT < nG ? "Transfertopf" : "Gehaltstopf"}</b>: Ablösen für {f1(nT)}, Gehälter für {f1(nG)} Spieler.
            {kader < PFLICHT ? <b style={{ color: "var(--gut)" }}> Der Pflichtkader von {PFLICHT} ist trotzdem frei.</b> : null}
          </p>
        </div>
        <div className="gegen-v">
          <span className="gk">Gegenüber dem Vorschlag des Vorstands</span>
          <div><span>Transfertopf</span><b className={`t ${dl(s.investition.gesamt - v0.stand.investition.gesamt)}`}>{dv(s.investition.gesamt - v0.stand.investition.gesamt)} C</b></div>
          <div><span>Gehaltstopf je Saison</span><b className={`t ${dl(s.gehalt.gesamt - v0.stand.gehalt.gesamt)}`}>{dv(s.gehalt.gesamt - v0.stand.gehalt.gesamt)} C</b></div>
          <div><span>Kader-Ausblick</span><b className={`t ${dl(kader - kaderV0)}`}>{kader === kaderV0 ? "gleich" : `${kader > kaderV0 ? "+" : "−"}${Math.abs(kader - kaderV0)} Spieler`}</b></div>
          <div><span>Risiko bei verfehltem Ziel</span><b className={`t ${dl(u.folge.nein - v0.folge.nein)}`}>{vz(u.folge.nein, 2)} Vertrauen</b></div>
        </div>
        <div className="tisch">
          <span className="gk">Am Tisch · jeder Manager verhandelt für sich</span>
          {tisch.map((z) => (
            <div key={z.teamId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getStaticTeamLogoUrl(z.teamId) ?? ""} alt="" />
              <span><b>{z.ownerLabel} · {z.teamName}</b><small>{z.fuehrung === "ki" ? "Halbautomatik: KI führt das Gespräch" : "selbst"}</small></span>
              <span className={`marke ${z.status === "unterschrieben" ? "gut" : "gold"}`}>{z.teamId === teamId && !unterschrieben ? `Schritt ${schritt}` : z.status === "unterschrieben" ? "unterschrieben" : "verhandelt"}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <div className="bgs" data-testid="budget-gespraech">
      {vorstandTeam}
      <div className="work">
        {links}
        <section className="pan" aria-label="Schritt">{schritt === 1 ? lage : schritt === 2 ? verhandeln : blatt}</section>
        {rechts}
      </div>
    </div>
  );
}

function normiere(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 5;
  return v > 10 ? v / 10 : v;
}

function wahlAlles(u: { wirksam: BudgetWahl; stand: { alleAufEineKarte: { aktiv: boolean } } }): boolean {
  return u.wirksam.ambition === "alles" && u.stand.alleAufEineKarte.aktiv;
}

function ligaGroesse(gameState: GameState, teamId: string): number {
  if (!isLeagueSplitActive(gameState)) return gameState.teams.length;
  const liga = getLeagueOf(gameState, teamId);
  return gameState.teams.filter((t) => getLeagueOf(gameState, t.teamId) === liga).length || gameState.teams.length;
}
