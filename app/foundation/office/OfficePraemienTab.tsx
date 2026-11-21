"use client";

/**
 * Office, Reiter „Praemien" (Mockup public/mockups/office-vorstand-21-11.html, Ansicht „praemien").
 * Gebaut sind die zwei Praemien, die Chris am 21.11. zuerst wollte: Siegpraemie und Treuepraemie bei Verlaengerung. Sie zahlen aus dem
 * GEHALTSTOPF, die Sperre ist hart. Nur der Mensch nutzt sie; die KI noch nicht (erst nach einer Messung mit 32 KI-Teams).
 * Praemien bewegen die Moral, nie direkt die Leistung.
 */

import { useMemo, useState } from "react";

import { BcIcon, BcMoralGesicht, BcPanel } from "@/components/foundation/broadcast";
import type { OfficeModell, OfficeSpielerZeile } from "@/lib/finance/office-modell";
import type { VorstandAktionFn } from "@/lib/finance/vorstand-aktion-typen";
import { SIEG_STUFEN, TREUE_STUFEN } from "@/lib/finance/vorstand-praemien";
import { C, zahl } from "./office-format";

type Spalte = "name" | "gesamt" | "moral" | "gehalt" | "bis" | "kosten";

const FARBE: Record<NonNullable<OfficeSpielerZeile["farbe"]>, string> = {
  red: "var(--bc-warn)",
  green: "var(--bc-gut)",
  blue: "var(--bc-gast)",
  yellow: "var(--bc-acht)",
};

export function OfficePraemienTab({
  m,
  onAktion,
  kannSchreiben,
}: {
  m: OfficeModell;
  onAktion?: VorstandAktionFn;
  kannSchreiben: boolean;
}) {
  const p = m.praemien;
  const [sieg, setSieg] = useState(p.plan.siegStufe);
  const [treue, setTreue] = useState(p.plan.treueStufe);
  const [sort, setSort] = useState<{ spalte: Spalte; abwaerts: boolean }>({ spalte: "gehalt", abwaerts: true });
  const [meldung, setMeldung] = useState<{ ton: "gut" | "acht"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const entwurf = { ...p.plan, siegStufe: sieg, treueStufe: treue };
  // Die Vorschau rechnet aus dem Modell: Sieg erwartet = Satz x verbleibende Spieltage x Einsatz-Schnitt; Treue = Anteil des Gehalts aller Auslaufenden.
  const siegErwartet = SIEG_STUFEN[sieg]!.satz * p.vorschau.verbleibendeSpieltage * 6;
  const treueMoeglich = p.spieler.filter((x) => x.auslaufend).reduce((a, x) => a + x.gehaltSaison * TREUE_STUFEN[treue]!.anteil, 0);
  const fest = Math.round((siegErwartet + treueMoeglich) * 100) / 100;
  const frei = p.vorschau.gehaltFrei;
  const ueber = m.stand.gedeckelt && fest > frei + 1e-9;
  const geaendert = entwurf.siegStufe !== p.plan.siegStufe || entwurf.treueStufe !== p.plan.treueStufe;
  const darf = kannSchreiben && Boolean(onAktion) && !busy;

  const zeilen = useMemo(() => {
    const dir = sort.abwaerts ? -1 : 1;
    const wert = (z: OfficeSpielerZeile): number | string => {
      switch (sort.spalte) {
        case "name":
          return z.name;
        case "gesamt":
          return z.gesamt ?? 0;
        case "moral":
          return z.moral ?? 0;
        case "gehalt":
          return z.gehaltSaison;
        case "bis":
          return z.vertragBisSaison ?? 0;
        case "kosten":
          return z.auslaufend ? z.treueKosten : 0;
      }
    };
    return [...p.spieler].sort((a, b) => {
      const x = wert(a);
      const y = wert(b);
      return (typeof x === "string" ? x.localeCompare(y as string, "de") : (x as number) - (y as number)) * dir || a.name.localeCompare(b.name, "de");
    });
  }, [p.spieler, sort]);

  const kopf = (spalte: Spalte, text: string, zahlSpalte = false) => (
    <th className={zahlSpalte ? "is-zahl" : ""} aria-sort={sort.spalte === spalte ? (sort.abwaerts ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => setSort((s) => ({ spalte, abwaerts: s.spalte === spalte ? !s.abwaerts : spalte !== "name" }))}>
        {text}
        {sort.spalte === spalte ? <span aria-hidden="true">{sort.abwaerts ? " ▼" : " ▲"}</span> : null}
      </button>
    </th>
  );

  async function speichern() {
    if (!onAktion) return;
    setBusy(true);
    try {
      const r = await onAktion({ aktion: "praemien_setzen", siegStufe: sieg, treueStufe: treue });
      setMeldung({ ton: r.ok ? "gut" : "acht", text: r.meldung });
    } finally {
      setBusy(false);
    }
  }

  const moralVorher = p.spieler.filter((x) => x.moral != null);
  const moralMittel = moralVorher.length ? moralVorher.reduce((a, x) => a + (x.moral ?? 0), 0) / moralVorher.length : null;
  const topfGes = Math.max(frei, fest, 0.1) * 1.15;

  return (
    <div className="off-gr off-gr--praemien" data-testid="office-praemien">
      {/* ------------------------------------------------------------ Mannschaft */}
      <BcPanel titel="Mannschaftsprämien" className="off-pan" bodyClassName="off-pan__k">
        <section className="off-praemie">
          <h3><BcIcon name="krone" /> Siegprämie</h3>
          <p>Für jede gewonnene Begegnung bekommt jeder auf dieser Seite eingesetzte Spieler einen festen Betrag. Gebucht je Disziplin-Seite (D1, D2). Im Duell zählt der Sieg über den Gegner, im Vierer-Pod nur Platz 1.</p>
          <div className="off-seg3" role="group" aria-label="Siegprämie">
            {SIEG_STUFEN.map((st, i) => (
              <button key={st.titel} type="button" aria-pressed={sieg === i} disabled={!darf} onClick={() => setSieg(i)} data-testid={`office-sieg-${i}`}>
                <b className="bc-t">{st.titel}</b>
                <small>{i === 0 ? "0 C" : "je Sieg und Einsatz"}</small>
              </button>
            ))}
          </div>
          <div className="off-chips">
            <i className={sieg ? "is-minus" : ""}>erwartet {C(siegErwartet)} je Saison</i>
            <i className={sieg ? "is-plus" : ""}>{sieg ? `Moral +${SIEG_STUFEN[sieg]!.moral} je Sieg, nur Eingesetzte` : "keine Wirkung"}</i>
          </div>
        </section>
        <section className="off-praemie">
          <h3><BcIcon name="check" /> Treueprämie bei Verlängerung</h3>
          <p>Verlängerst du einen Vertrag, bekommt der Spieler einen Anteil seines neuen Jahresgehalts. Gebucht im Moment der Unterschrift.</p>
          <div className="off-seg3" role="group" aria-label="Treueprämie">
            {TREUE_STUFEN.map((st, i) => (
              <button key={st.titel} type="button" aria-pressed={treue === i} disabled={!darf} onClick={() => setTreue(i)} data-testid={`office-treue-${i}`}>
                <b className="bc-t">{st.titel}</b>
                <small>{i === 0 ? "0 C" : "des neuen Jahresgehalts"}</small>
              </button>
            ))}
          </div>
          <div className="off-chips">
            <i className={treue ? "is-minus" : ""}>bis {C(treueMoeglich)} wenn alle {p.vorschau.auslaufend} Auslaufenden verlängert werden</i>
            <i className={treue ? "is-plus" : ""}>{treue ? `Moral +${TREUE_STUFEN[treue]!.moral} für den Spieler` : "keine Wirkung"}</i>
          </div>
        </section>
        <div className="off-gk">Regeln</div>
        <ul className="off-regeln">
          <li><BcIcon name="check" /><span><b>Zahlt aus dem Gehaltstopf.</b> Die Freigabe des Vorstands gilt auch hier, hart.</span></li>
          <li><BcIcon name="check" /><span><b>Nur wer spielt, verdient.</b> Verletzte sind nicht einsetzbar und bekommen keine Siegprämie.</span></li>
          <li><BcIcon name="check" /><span><b>Gebucht je Spieltag.</b> Wie Gehalt und Sponsor-Rate.</span></li>
          <li><BcIcon name="check" /><span><b>Je Team getrennt.</b> Nur ein Mensch legt Prämien fest; die KI nutzt sie noch nicht.</span></li>
        </ul>
        <p className="off-idee"><BcIcon name="info" /><span><b>Prämien bewegen die Moral, nie direkt die Leistung.</b> Die Moral wirkt wie heute über Form und Moral auf die Eignung; die Rangtreue der Disziplinen bleibt unberührt.</span></p>
      </BcPanel>

      {/* ------------------------------------------------------------ Spieler */}
      <BcPanel titel="Spielerprämien" kopfInhalt={<small className="off-sub">Wirkung der Treueprämie je Spieler · Klick auf die Spalte sortiert</small>} className="off-pan" bodyClassName="off-pan__k off-pan__k--tabelle">
        <table className="off-tabelle" data-testid="office-praemien-tabelle">
          <thead>
            <tr>
              {kopf("name", "Spieler")}
              {kopf("gesamt", "Gesamt", true)}
              {kopf("moral", "Moral")}
              {kopf("gehalt", "Gehalt", true)}
              {kopf("bis", "Vertrag bis")}
              {kopf("kosten", "Treueprämie", true)}
              <th className="is-zahl">Wirkung</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.playerId}>
                <td>
                  <span className="off-spieler">
                    {z.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={z.portrait} alt="" />
                    ) : (
                      <span className="off-spieler__ohne" aria-hidden="true" />
                    )}
                    <span>
                      <b>{z.name}</b>
                      <small style={z.farbe ? { color: FARBE[z.farbe] } : undefined}>
                        {z.className}
                        {z.liebling ? " · Lieblingsspieler" : ""}
                      </small>
                    </span>
                  </span>
                </td>
                <td className="is-zahl bc-t">{z.gesamt == null ? "—" : zahl(z.gesamt, 1)}</td>
                <td>{z.moral == null ? "—" : <BcMoralGesicht wert={z.moral} />}</td>
                <td className="is-zahl">
                  <b className="bc-t">{C(z.gehaltSaison)}</b>
                  <small className="bc-t">{C(z.gehaltSpieltag)} je Spieltag</small>
                </td>
                <td className="bc-t">Ende Saison {z.vertragBisSaison ?? "—"}{z.auslaufend ? <small className="is-acht">läuft aus</small> : null}</td>
                <td className="is-zahl">{z.auslaufend && treue ? <b className="bc-t">{C(z.treueKosten)}</b> : <span className="off-leer">–</span>}</td>
                <td className="is-zahl">{z.auslaufend && treue ? <b className="bc-t is-plus">Moral +{z.treueMoral}</b> : <span className="off-leer">–</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </BcPanel>

      {/* ------------------------------------------------------------ Kosten */}
      <BcPanel titel="Kosten und Wirkung" aktionen={<span className="off-tag is-gold">im Rahmen</span>} className="off-pan" bodyClassName="off-pan__k">
        <div className="off-gk">Zahlt aus dem Gehaltstopf <small>Quote {Math.round(m.stand.gehalt.quote * 100)} %</small></div>
        <div className="off-kasse" role="img" aria-label="Gehaltstopf frei und fest geplante Prämien">
          <i className="is-frei" style={{ flexGrow: Math.max(0, frei - fest), flexBasis: 0 }} />
          <i className={ueber ? "is-ueber" : "is-prae"} style={{ flexGrow: Math.min(fest, topfGes), flexBasis: 0 }} />
          <i className="is-leer" style={{ flexGrow: Math.max(0, topfGes - Math.max(frei, fest)), flexBasis: 0 }} />
        </div>
        <div className="off-toepfe">
          <div>
            <small>Gehaltstopf, frei</small>
            <strong className="bc-t">{C(frei, 1)}</strong>
            <span>je Saison · {C(frei / Math.max(1, m.spieltageGesamt), 2)} je Spieltag</span>
          </div>
          <div className={ueber ? "is-zu" : ""}>
            <small>Prämien, fest geplant</small>
            <strong className="bc-t">{C(fest, 1)}</strong>
            <span>je Saison · {C(fest / Math.max(1, m.spieltageGesamt), 2)} je Spieltag</span>
          </div>
        </div>
        <div className="off-gk">Woraus die Summe besteht</div>
        <ul className="off-liste off-liste--topf">
          <li><span className="off-liste__t">Siegprämie, erwartet</span><b className="bc-t">{C(siegErwartet)}</b></li>
          <li><span className="off-liste__t">Treueprämie, falls alle Auslaufenden bleiben</span><b className="bc-t">{C(treueMoeglich)}</b></li>
          <li><span className="off-liste__t">Schon gebucht diese Saison</span><b className="bc-t">{C(p.plan.siegGebucht + p.plan.treueGebucht)}</b></li>
        </ul>
        <div className="off-gk">Was es bringt</div>
        <ul className="off-liste off-liste--topf">
          <li>
            <span className="off-liste__t">Moral im Kader <small>Mittel</small></span>
            <b>{moralMittel == null ? "—" : <BcMoralGesicht wert={moralMittel} />}</b>
          </li>
          <li><span className="off-liste__t">Vorstand <small>Prämien bewegen sein Vertrauen nicht</small></span><b className="bc-t">±0,0</b></li>
        </ul>
        {p.plan.protokoll.length > 0 ? (
          <>
            <div className="off-gk">Protokoll</div>
            <ul className="off-liste">
              {p.plan.protokoll.slice(-4).map((x, i) => (
                <li key={`${x.zeit}-${i}`}>
                  <span className="off-liste__t">{x.text}</span>
                  {x.betrag != null ? <b className="bc-t">{C(x.betrag)}</b> : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="off-ruf">
          {ueber ? (
            <p className="off-meldung" data-testid="office-praemien-sperre">
              Die Sperre ist hart: fest geplante Prämien über dem freien Gehaltstopf lassen sich nicht speichern. Weniger wählen, oder den Vorstand im Gespräch um Sonderbudget Gehalt bitten.
            </p>
          ) : null}
          {meldung ? <p className={`off-meldung${meldung.ton === "gut" ? " is-gut" : ""}`}>{meldung.text}</p> : null}
          <button type="button" className="off-haupt" disabled={!darf || ueber || !geaendert} onClick={speichern} data-testid="office-praemien-speichern">
            <BcIcon name="check" /> Prämien festlegen
          </button>
          <p className="off-fuss">Gilt ab dem nächsten Spieltag · jederzeit änderbar, schon Gezahltes bleibt gezahlt</p>
        </div>
      </BcPanel>
    </div>
  );
}
