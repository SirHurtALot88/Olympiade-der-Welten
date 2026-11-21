"use client";

/**
 * Office, Reiter „Vorstand und Ziele" (Mockup public/mockups/office-vorstand-21-11.html, Ansicht „vorstand").
 * Drei Spalten: Vertrauen (Bogen, Stufen, Was am Saisonende zaehlt, Raenge), Vorstandsziele (Widerspruchspruefung, Zielkarten,
 * Vertragslaufzeiten, Lieblingsspieler), Freigabe und Budgets (Quote, Kassenbalken, Toepfe, Sonderwege, Knopf zum Gespraech).
 * Alle Zahlen kommen aus `buildOfficeModell`; nichts wird hier neu gerechnet.
 */

import type { CSSProperties } from "react";

import { BcIcon, BcPanel } from "@/components/foundation/broadcast";
import { CHARAKTER_TEXT } from "@/lib/finance/vorstand-gespraech";
import { GESPRAECHE_JE_SAISON } from "@/lib/finance/vorstand-gespraech-zustand";
import type { OfficeModell, OfficeZiel } from "@/lib/finance/office-modell";
import { stufeFuerVertrauen, ALLES_PUFFER_ANTEIL } from "@/lib/finance/vorstand-budgetfreigabe";
import type { VorstandBitteArt } from "@/lib/data/olyDataTypes";
import { C, prozent, vz, vzKlasse, zahl } from "./office-format";

const STATUS_TEXT: Record<OfficeZiel["status"], string> = {
  completed: "Erfüllt",
  failed: "Verfehlt",
  at_risk: "Gefährdet",
  open: "Auf Kurs",
};
const BEREICH_TEXT: Record<OfficeZiel["bereich"], string> = { sport: "Sport", finanzen: "Finanzen", kader: "Kader", kabine: "Kabine" };

/** Halbkreis 0 bis 10 mit den fünf Stufen als Segmente und einer Nadel. */
function Bogen({ wert }: { wert: number | null }) {
  const cx = 150;
  const cy = 140;
  const r = 118;
  const pt = (v: number, rr = r) => {
    const w = Math.PI + (Math.max(0, Math.min(10, v)) / 10) * Math.PI;
    return [cx + rr * Math.cos(w), cy + rr * Math.sin(w)] as const;
  };
  const bogen = (a: number, b: number) => {
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const segmente: Array<[number, number, string]> = [
    [0, 1.5, "var(--bc-warn)"],
    [1.5, 3, "#e8864a"],
    [3, 5, "var(--bc-acht)"],
    [5, 7.5, "#a8d36a"],
    [7.5, 10, "var(--bc-gut)"],
  ];
  const [nx, ny] = pt(wert ?? 0, r - 18);
  const [ax, ay] = pt(wert ?? 0, r + 10);
  return (
    <svg className="off-bogen" viewBox="0 0 300 168" role="img" aria-label={`Vertrauen ${wert == null ? "—" : zahl(wert, 1)} von 10`}>
      {segmente.map(([a, b, f]) => (
        <path key={a} d={bogen(a + 0.06, b - 0.06)} stroke={f} strokeWidth="14" fill="none" opacity={wert != null && wert >= a ? 1 : 0.38} />
      ))}
      {[0, 1.5, 3, 5, 7.5, 10].map((v) => {
        const [tx, ty] = pt(v, r + 24);
        return (
          <text key={v} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" className="off-bogen__t">
            {String(v).replace(".", ",")}
          </text>
        );
      })}
      {wert != null ? <line x1={nx} y1={ny} x2={ax} y2={ay} stroke="var(--bc-creme)" strokeWidth="4" strokeLinecap="round" /> : null}
    </svg>
  );
}

function Zielkarte({ z, m }: { z: OfficeZiel; m: OfficeModell }) {
  const farbe =
    z.status === "completed" ? "var(--bc-gut)" : z.status === "failed" ? "var(--bc-warn)" : z.status === "at_risk" ? "var(--bc-acht)" : "var(--bc-gut)";
  const liebling = z.id === "board-lieblingsspieler" ? m.liebling : null;
  const laufzeit = z.id === "board-vertragslaufzeiten" ? m.vertraege : null;
  return (
    <article className="off-ziel" style={{ "--pc": farbe } as CSSProperties} data-testid={`office-ziel-${z.id}`}>
      <div className="off-ziel__kopf">
        <span className="off-ziel__bereich">
          {BEREICH_TEXT[z.bereich]}
          {z.id === "board-lieblingsspieler" ? " · Lieblingsspieler" : z.id === "board-vertragslaufzeiten" ? " · Laufzeit-Quote" : ""}
        </span>
        <span className="off-marken">
          {z.neu ? <i className="is-neu">NEU</i> : null}
          <i className={z.mehrjaehrig ? "is-lang" : ""}>{z.laufzeitText}</i>
          <i className={`is-st-${z.status}`}>{STATUS_TEXT[z.status]}</i>
        </span>
      </div>
      <h3 className="off-ziel__titel">{z.label}</h3>
      {z.detail ? <p className="off-ziel__text">{z.detail}</p> : null}
      {z.hinweis ? (
        <p className="off-hinweis">
          <b>Hinweis des Vorstands:</b> {z.hinweis}
        </p>
      ) : null}
      {laufzeit ? (
        <div className="off-balken" aria-label="Verträge nach Endsaison">
          {laufzeit.balken.map((b) => (
            <div key={b.saison} className="off-balken__s">
              <b className="bc-t">{b.n}</b>
              <i className={b.ueber ? "is-ueber" : ""} style={{ height: `${Math.max(6, (b.n / Math.max(1, laufzeit.kader)) * 100)}%` }} />
              <small>Ende S{b.saison}</small>
            </div>
          ))}
          <div className="off-balken__g">
            <strong className="bc-t">{laufzeit.grenze}</strong>
            <small>höchstens</small>
          </div>
        </div>
      ) : liebling ? (
        <div className="off-liebling">
          {liebling.portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={liebling.portrait} alt={liebling.name} />
          ) : (
            <span className="off-liebling__ohne" aria-hidden="true" />
          )}
          <div>
            <b className="off-liebling__name">{liebling.name}</b>
            <small>
              {liebling.className ?? ""}
              {liebling.vertragBisSaison != null ? ` · Vertrag bis Ende Saison ${liebling.vertragBisSaison}` : ""}
              {` · ${liebling.quelle === "vorsaison" ? "Bester der Vorsaison" : "Bester dieser Saison"}, PP ${zahl(liebling.pp, 1)}`}
            </small>
          </div>
          <div className="off-liebling__z">
            <strong className="bc-t">{z.ist}</strong>
            <small>{liebling.freigegeben ? "Verkauf freigegeben" : "Stand"}</small>
          </div>
        </div>
      ) : (
        <div className="off-ziel__ist">
          <span>
            Soll <b className="bc-t">{z.soll}</b>
          </span>
          <strong className="bc-t">{z.ist}</strong>
        </div>
      )}
      <div className="off-ziel__folge">
        <span>Erfüllt</span>
        <i className="is-plus">{vz(z.plus)} Vertrauen</i>
        {z.rewardCash > 0 ? <i className="is-plus">+{zahl(z.rewardCash, 1)} C Prämie</i> : null}
        <span>Verfehlt</span>
        <i className="is-minus">{vz(-z.minus)} Vertrauen</i>
        <small>kein Geldabzug</small>
      </div>
    </article>
  );
}

export function OfficeVorstandTab({
  m,
  onFrage,
  onSprechen,
  onFordertAnnehmen,
  fordert,
  kannSchreiben,
}: {
  m: OfficeModell;
  onFrage: (bitte: VorstandBitteArt) => void;
  onSprechen: () => void;
  onFordertAnnehmen?: () => void;
  fordert: boolean;
  kannSchreiben: boolean;
}) {
  const s = m.stand;
  const cs = CHARAKTER_TEXT[m.charakter];
  const frei = Math.max(0, s.investition.frei);
  const kasse = Math.max(m.kasse, 0.01);
  const gehaltPuffer = s.herleitung.gehaltspuffer;
  const ruecklage = s.herleitung.ruecklageZiel;
  const vorbehalt = Math.max(0, kasse - frei - gehaltPuffer - ruecklage);
  const teile: Array<[number, string, string]> = [
    [frei, "frei", "Transfer- und Investitionstopf, frei"],
    [vorbehalt, "vorb", "Vorbehalt des Vorstands"],
    [gehaltPuffer, "puf", "Gehaltspuffer, 7 Spieltage"],
    [ruecklage, "rue", "Notrücklage"],
  ];
  const teileSumme = Math.max(0.01, teile.reduce((a, t) => a + t[0], 0));
  const sichtbar = m.ziele;
  const aufKurs = sichtbar.filter((z) => z.status === "completed" || z.status === "open").length;
  const naechsteStufe = m.vertrauen != null ? stufeFuerVertrauen(Math.max(1, Math.min(10, m.vertrauen + m.hochrechnung.vertrauen))) : null;
  const paare = new Set<string>();
  for (let i = 0; i < sichtbar.length; i += 1) {
    for (let j = i + 1; j < sichtbar.length; j += 1) {
      const a = BEREICH_TEXT[sichtbar[i]!.bereich];
      const b = BEREICH_TEXT[sichtbar[j]!.bereich];
      if (a !== b) paare.add([a, b].sort().join(" ↔ "));
    }
  }
  return (
    <div className="off-gr off-gr--vorstand" data-testid="office-vorstand">
      {/* ---------------------------------------------------------------- Vertrauen */}
      <BcPanel titel="Vertrauen des Vorstands" aktionen={<span className="off-tag">0 bis 10</span>} className="off-pan" bodyClassName="off-pan__k">
        <div className="off-gegenueber">
          <div>
            <h3>{cs.name}</h3>
            <small>
              Sparneigung {zahl(m.sparneigung, 1)} · {cs.satz}
            </small>
          </div>
        </div>
        <div className="off-bogenbox">
          <Bogen wert={m.vertrauen} />
          <div className="off-bogenbox__z">
            <strong className="bc-t">{m.vertrauen == null ? "—" : zahl(m.vertrauen, 1)}</strong>
            <span>/ 10</span>
          </div>
        </div>
        <div className="off-gk">Was das Vertrauen freigibt</div>
        <table className="off-stufen">
          <thead>
            <tr>
              <th>Vertrauen</th>
              <th>Ablösen, Gebäude</th>
              <th>Gehälter</th>
            </tr>
          </thead>
          <tbody>
            {m.stufen.map((st, i) => {
              const gehalt = Math.max(0.75, st.anteil);
              const bis = ["ab 7,5", "5 bis unter 7,5", "3 bis unter 5", "1,5 bis unter 3", "unter 1,5"][i] ?? "";
              return (
                <tr key={st.anteil} className={st.aktiv ? "is-aktiv" : ""}>
                  <td className="bc-t">{bis}</td>
                  <td className="bc-t">{prozent(st.anteil)}</td>
                  <td className="bc-t">{prozent(gehalt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="off-gk">Was am Saisonende zählt</div>
        <ul className="off-liste">
          {sichtbar.length === 0 ? <li className="off-leer">Noch keine Ziele vergeben.</li> : null}
          {sichtbar.slice(0, 7).map((z) => {
            const delta = z.status === "failed" ? -z.minus : z.status === "completed" ? z.plus : 0;
            return (
              <li key={z.id}>
                <span className="off-liste__s">{STATUS_TEXT[z.status]}</span>
                <span className="off-liste__t">{z.label}</span>
                <b className={`bc-t ${vzKlasse(delta)}`}>{z.status === "open" || z.status === "at_risk" ? "offen" : vz(delta)}</b>
              </li>
            );
          })}
        </ul>
        <div className="off-gk">In der Liga</div>
        <ul className="off-liste off-liste--rang">
          {m.raenge.vertrauen ? (
            <li>
              <span className="off-liste__t">Vertrauen des Vorstands <small>höchstes = 1.</small></span>
              <b className="bc-t">{m.raenge.vertrauen.rang}. von {m.raenge.vertrauen.von}</b>
            </li>
          ) : null}
          {m.raenge.gehaltskosten ? (
            <li>
              <span className="off-liste__t">Gehaltskosten <small>günstigstes = 1.</small></span>
              <b className="bc-t">{m.raenge.gehaltskosten.rang}. von {m.raenge.gehaltskosten.von}</b>
            </li>
          ) : null}
          {m.raenge.kasse ? (
            <li>
              <span className="off-liste__t">Kasse <small>höchste = 1.</small></span>
              <b className="bc-t">{m.raenge.kasse.rang}. von {m.raenge.kasse.von}</b>
            </li>
          ) : null}
        </ul>
      </BcPanel>

      {/* ---------------------------------------------------------------- Ziele */}
      <BcPanel
        titel="Vorstandsziele"
        kopfInhalt={<small className="off-sub">Saison {m.saisonNummer} · {sichtbar.length} Ziele, als Satz geprüft</small>}
        aktionen={<span className="off-tag is-gold">{aufKurs} von {sichtbar.length} auf Kurs</span>}
        className="off-pan"
        bodyClassName="off-pan__k"
      >
        <div className={`off-pruefung${m.widerspruch.ok ? "" : " is-konflikt"}`} data-testid="office-widerspruch">
          <BcIcon name={m.widerspruch.ok ? "check" : "info"} />
          <div>
            <b>{m.widerspruch.ok ? "Widerspruchs-Prüfung bestanden." : "Widerspruch gefunden."}</b>{" "}
            {m.widerspruch.ok
              ? `Kein Ziel verlangt, was ein anderes verbietet (${m.widerspruch.paare} Paare geprüft).`
              : m.widerspruch.konflikte.map((k) => k.weil).join(" ")}
            {paare.size > 0 ? (
              <span className="off-chips">
                {[...paare].map((p) => (
                  <i key={p}>{p}</i>
                ))}
              </span>
            ) : null}
          </div>
        </div>
        <div className="off-zielraster">
          {sichtbar.slice(0, 6).map((z) => (
            <Zielkarte key={z.id} z={z} m={m} />
          ))}
        </div>
        {sichtbar.length > 6 ? (
          <ul className="off-liste">
            {sichtbar.slice(6).map((z) => (
              <li key={z.id}>
                <span className="off-liste__s">{STATUS_TEXT[z.status]}</span>
                <span className="off-liste__t">{z.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="off-schritte">
          <div>
            <b>1 Erwartung</b>
            <span>aus der Kaderstärke (beste 6), nie aus den Einsatzplätzen.</span>
          </div>
          <div>
            <b>2 Ein Rang-Ziel</b>
            <span>nur eines ist verbindlich, weitere Rang-Ziele sind Zusatzziele.</span>
          </div>
          <div>
            <b>3 Paarprüfung</b>
            <span>verlangt eines, was ein anderes verbietet, fliegt es raus.</span>
          </div>
          <div>
            <b>4 Laufzeit</b>
            <span>jedes Ziel sagt, bis wann es gilt und wann abgerechnet wird.</span>
          </div>
        </div>
        {m.verworfen.length > 0 ? (
          <div className="off-verworfen" data-testid="office-verworfen">
            <BcIcon name="info" />
            <div>
              {m.verworfen.map((v) => (
                <p key={v.ersetztDurch}>
                  <b>Bei der Vergabe verworfen:</b> <s>{v.label}</s> — {v.weil} Ersetzt durch „{v.ersetztDurch}“.
                </p>
              ))}
            </div>
          </div>
        ) : null}
        <div className="off-abrechnung">
          <div>
            <small>Abrechnung am Saisonende</small>
            <strong className={`bc-t ${vzKlasse(m.hochrechnung.vertrauen)}`}>{vz(m.hochrechnung.vertrauen)}</strong>
            <span>Vertrauen, Stand heute hochgerechnet</span>
          </div>
          <div>
            <small>Zielprämien</small>
            <strong className="bc-t">{C(m.hochrechnung.zielGeld, 1)}</strong>
            <span>Geld nur bei erfüllten Zielen, nie ein Abzug</span>
          </div>
          <div>
            <small>Freigabe nächste Saison</small>
            <strong className="bc-t">{naechsteStufe ? prozent(naechsteStufe.anteil) : "—"}</strong>
            <span>wenn es so bleibt</span>
          </div>
        </div>
      </BcPanel>

      {/* ---------------------------------------------------------------- Budgets */}
      <BcPanel titel="Freigabe und Budgets" className="off-pan" bodyClassName="off-pan__k">
        <div className="off-quote">
          <strong className="bc-t">{prozent(s.wirksamerAnteil)}</strong>
          <p>
            <b>Der Vorstand nimmt nichts weg.</b> Das Geld bleibt auf dem Konto; nur dieser Anteil darf für Ablösen, Gebäude und Gehälter
            ausgegeben werden. Die Sperre ist hart, für Mensch und KI gleich.
          </p>
        </div>
        <div className="off-gk">Kasse {C(m.kasse, 1)} · wie sie aufgeteilt ist</div>
        <div className="off-kasse">
          {teile.map(([v, k]) => (
            <i key={k} className={`is-${k}`} style={{ flexGrow: v / teileSumme, flexBasis: 0 }} />
          ))}
        </div>
        <ul className="off-kassenleg">
          {teile.map(([v, k, t]) => (
            <li key={k}>
              <i className={`is-${k}`} />
              <span>{t}</span>
              <b className="bc-t">{C(v, 1)}</b>
            </li>
          ))}
        </ul>
        <div className="off-toepfe">
          <div>
            <small>Transfer- und Investitionstopf</small>
            <strong className="bc-t">{C(s.investition.frei, 1)}</strong>
            <span>Ablösen, Gebäude · Verkaufserlöse zu 100 % frei</span>
          </div>
          <div>
            <small>Gehaltstopf, frei</small>
            <strong className="bc-t">{C(s.gehalt.frei, 1)}</strong>
            <span>je Saison · {C(s.gehalt.frei / Math.max(1, m.spieltageGesamt), 2)} je Spieltag · Quote {prozent(s.gehalt.quote)}, nie unter 75 %</span>
          </div>
        </div>
        <div className="off-gk">Sonderwege <small>im Transferfenster, ab Saison 2</small></div>
        <div className="off-weg">
          <div>
            <b>Notrücklage anzapfen</b>
            <small>
              {s.ruecklageAnzapfen.bereitsAngezapft > 0.004
                ? `${C(s.ruecklageAnzapfen.bereitsAngezapft, 1)} angezapft, Vertrauen −${zahl(s.ruecklageAnzapfen.vertrauenskosten)}.`
                : `Bis ${C(s.herleitung.ruecklageZiel * 0.5, 1)} (die Hälfte des Ziels). Kostet 0,25 Vertrauen je Viertel, wirksam bei der nächsten Festlegung.`}
            </small>
          </div>
          <button type="button" className="off-btn" onClick={() => onFrage("anzapf")} disabled={!kannSchreiben || !s.gedeckelt}>
            Fragen
          </button>
        </div>
        <div className="off-weg">
          <div>
            <b>Alles auf eine Karte</b>
            <small>
              {s.alleAufEineKarte.aktiv
                ? `Aktiv: Ziel Platz ${s.alleAufEineKarte.zustand?.zielRang} oder besser.`
                : `100 % in beiden Töpfen, Rücklage frei, ${Math.round(ALLES_PUFFER_ANTEIL * 100)} % Puffer. Ziel zwei Plätze besser: erreicht +0,75, verfehlt −1,0 Vertrauen.`}
            </small>
          </div>
          {s.alleAufEineKarte.aktiv ? (
            <span className="off-tag is-gold">AKTIV</span>
          ) : fordert ? (
            <button type="button" className="off-btn is-ja" onClick={onFordertAnnehmen} disabled={!kannSchreiben}>
              Annehmen
            </button>
          ) : (
            <button type="button" className="off-btn" onClick={() => onFrage("alles")} disabled={!kannSchreiben || !s.gedeckelt}>
              Fragen
            </button>
          )}
        </div>
        <div className="off-gk">Was gegen welchen Topf zählt</div>
        <ul className="off-liste off-liste--topf">
          <li><span className="off-liste__t">Ablöse, Gebäude (Bau, Ausbau)</span><b>Transfertopf</b></li>
          <li><span className="off-liste__t">Neues Gehalt, Gehaltserhöhung</span><b>Gehaltstopf</b></li>
          <li><span className="off-liste__t">Prämien</span><b>Gehaltstopf</b></li>
          <li><span className="off-liste__t">Verkaufserlös</span><b>zu 100 % frei</b></li>
          <li><span className="off-liste__t">Gehalt eines verkauften Spielers</span><b>zu 100 % zurück</b></li>
        </ul>
        <button type="button" className="off-haupt" onClick={onSprechen} disabled={!kannSchreiben || !s.gedeckelt} data-testid="office-zum-gespraech">
          <BcIcon name="liste" /> Mit dem Vorstand sprechen
        </button>
        <p className="off-fuss">
          Gespräche diese Saison <b className="bc-t">{m.gespraech.genutzt} von {GESPRAECHE_JE_SAISON}</b>
          {s.gedeckelt ? " · das zweite geht auch in der Saison" : " · in Saison 1 ist alles freigegeben"}
        </p>
      </BcPanel>
    </div>
  );
}
