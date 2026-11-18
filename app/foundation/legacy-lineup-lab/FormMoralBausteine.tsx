"use client";

/**
 * FORM + MORAL, BAUSTEINE (18.11.) nach dem Mockup public/mockups/form-moral-modern-17-11.html:
 * Warum-Block, Reiter "Form & Moral", Formkarten-Wirkung, Form-Verlauf/Profil, Form-Meldungen.
 * Alle Zahlen kommen aus `lib/lineups/form-moral-anzeige.ts` und `lib/lineups/formkarten-wirkung.ts`
 * (gespeicherte Werte, dieselbe Rechnung wie die Wertung). Moral ist ueberall Gesicht + Zahl
 * (`BcMoralGesicht`, Chris 18.11.). Fehlt ein Wert, bleibt der Teil leer statt etwas zu erfinden.
 */
import { useState } from "react";

import { BcFormPfeil, BcMoralGesicht } from "@/components/foundation/broadcast";
import { moralFarbe, moralStufe } from "@/lib/morale/moral-anzeige";
import { formBegruendung, type FormMeldung, type FormMoralAnzeige } from "@/lib/lineups/form-moral-anzeige";
import type { KartenWirkung } from "@/lib/lineups/formkarten-wirkung";
import "./form-moral.css";

const ZAHL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const vz = (x: number, nk = 1) => {
  const t = new Intl.NumberFormat("de-DE", { minimumFractionDigits: nk, maximumFractionDigits: nk }).format(Math.abs(x));
  return `${x > 0.0001 ? "+" : x < -0.0001 ? "−" : "±"}${t}`;
};
const FORM_HEX: Record<string, string> = { red: "#ff8b86", green: "#a8e7aa", blue: "#a9ccff", yellow: "#ffd987" };
export const FARB_NAME: Record<string, string> = { red: "Power", green: "Speed", blue: "Mental", yellow: "Social" };

/** Pfeil + Gesicht nebeneinander (Platzkarte, Kader). Ohne Form-Wert nur das Gesicht. */
export function FormMoralMarke({ a, nurMoral = false }: { a: FormMoralAnzeige; nurMoral?: boolean }) {
  return (
    <span className="fm-marke">
      {a.formVerfuegbar && !nurMoral ? (
        <BcFormPfeil stufe={a.formStufe} titel={`Form ${a.form != null ? Math.round(a.form) : "–"}: ${a.formWort} (${vz(a.formPct)} ${einheit(a)})`} />
      ) : null}
      {a.moral != null ? <BcMoralGesicht wert={a.moral} groesse={16} titel={`Moral ${Math.round(a.moral)}: ${a.moralWort} (${vz(a.moralPct)} ${einheit(a)})`} /> : null}
    </span>
  );
}

/** Was die Prozentzahl meint: Legacy-Wertung bucht auf den Spielerwert, die Arena auf die Eignung. */
const einheit = (a: FormMoralAnzeige) => (a.pfad === "legacy" ? "% Spielerwert" : "% Eignung");

export type UrsachenZeile = { id: string; label: string; delta: number };

/** Das Warum: Form, letzte drei Einsaetze, Erschoepfung, Moral mit Ursachen, Summe. */
export function WarumBlock({
  a,
  ursachen,
  disziplinName,
  onProfil,
}: {
  a: FormMoralAnzeige;
  ursachen: UrsachenZeile[];
  disziplinName: (id: string) => string;
  onProfil?: () => void;
}) {
  return (
    <div className="fm-warum" data-testid="fm-warum">
      <div className="fm-warum__zeile">
        <span className="fm-gk">Form</span>
        {a.formVerfuegbar ? (
          <>
            <b className="t">
              <BcFormPfeil stufe={a.formStufe} /> {a.form != null ? Math.round(a.form) : "–"} · {a.formWort}
            </b>
            <span className={`t ${a.formPct > 0 ? "bc-plus" : a.formPct < 0 ? "bc-minus" : ""}`}>{vz(a.formPct)} {einheit(a)}</span>
          </>
        ) : (
          <span className="fm-leise">Noch keine Form gespeichert — sie entsteht nach dem ersten Spieltag.</span>
        )}
      </div>
      {a.letzteEinsaetze.length > 0 ? (
        <div className="fm-einsaetze">
          {a.letzteEinsaetze.map((e) => {
            const erw = e.erwartungPerz ?? null;
            const lei = e.leistungPerz ?? null;
            const diff = erw != null && lei != null ? lei - erw : 0;
            return (
              <div key={`${e.seasonId}-${e.matchdayId}`} className="fm-einsatz" title={formBegruendung(e, e.disziplinId ? disziplinName(e.disziplinId) : null)}>
                <span>{e.disziplinId ? disziplinName(e.disziplinId) : "Einsatz"}</span>
                {erw != null && lei != null ? (
                  <>
                    <span className="fm-balken" aria-hidden="true">
                      <i className="fm-balken__erw" style={{ left: `${erw}%` }} />
                      <i className={`fm-balken__abst ${diff >= 0 ? "is-auf" : "is-ab"}`} style={{ left: `${Math.min(erw, lei)}%`, width: `${Math.abs(diff)}%` }} />
                    </span>
                    <span className="t">
                      {erw} → {lei}
                    </span>
                  </>
                ) : (
                  <span className="fm-leise">kein Vergleich</span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="fm-warum__zeile">
        <span className="fm-gk">Erschöpfung</span>
        {a.erschoepfung != null ? (
          <>
            <b className="t">{Math.round(a.erschoepfung)}</b>
            <span className={a.bremsePunkte > 0 ? "bc-minus t" : "fm-leise"}>
              {a.bremsePunkte > 0 ? `bremst die Form (−${ZAHL.format(a.bremsePunkte)})` : "keine Bremse, erst über 60"}
            </span>
          </>
        ) : (
          <span className="fm-leise">unbekannt</span>
        )}
      </div>
      <div className="fm-warum__zeile">
        <span className="fm-gk">Moral</span>
        {a.moral != null ? (
          <>
            <b className="t">
              <BcMoralGesicht wert={a.moral} /> · {a.moralWort}
            </b>
            <span className={`t ${a.moralPct > 0 ? "bc-plus" : a.moralPct < 0 ? "bc-minus" : ""}`}>{vz(a.moralPct)} {einheit(a)}</span>
          </>
        ) : (
          <span className="fm-leise">noch nicht bewertet</span>
        )}
      </div>
      {ursachen.length > 0 ? (
        <ul className="fm-ursachen">
          {ursachen.map((u) => (
            <li key={u.id}>
              <span className={`t ${u.delta >= 0 ? "bc-plus" : "bc-minus"}`}>{vz(u.delta, 0)}</span> {u.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="fm-summe">
        <span>Zusammen</span>
        <b className={`t ${a.gesamtPct > 0 ? "bc-plus" : a.gesamtPct < 0 ? "bc-minus" : ""}`}>{vz(a.gesamtPct)} % {a.pfad === "legacy" ? "auf den Spielerwert" : "auf die Eignung"}</b>
      </div>
      <p className="fm-leise fm-hinweis">Form verschiebt den Wert nur leicht — {ZAHL.format(2)} % bei „heiß“ sind keine Gamechanger.{a.pfad === "legacy" ? " Die Moral wirkt in dieser Wertung stärker (bis +8 % / −10 %)." : ""}</p>
      {onProfil ? (
        <button type="button" className="bc-btn bc-btn--klein" onClick={onProfil}>
          Form-Verlauf im Profil
        </button>
      ) : null}
    </div>
  );
}

/** Reiter "Form & Moral": die Aufstellung auf einen Blick. */
export function FormMoralUebersicht({
  zeilen,
  onWaehle,
}: {
  zeilen: Array<{ id: string; name: string; platz: string; a: FormMoralAnzeige }>;
  onWaehle: (id: string) => void;
}) {
  if (zeilen.length === 0) return <p className="fm-leise">Noch niemand aufgestellt.</p>;
  const stufen = [2, 1, 0, -1, -2].map((s) => ({ s, n: zeilen.filter((z) => z.a.formVerfuegbar && z.a.formStufe === s).length }));
  const mitMoral = zeilen.filter((z) => z.a.moral != null);
  const schnitt = mitMoral.length ? mitMoral.reduce((x, z) => x + (z.a.moral ?? 0), 0) / mitMoral.length : null;
  return (
    <div className="fm-uebersicht" data-testid="fm-uebersicht">
      <div className="fm-team">
        <span className="fm-gk">Team-Form</span>
        <span className="fm-team__stufen">
          {stufen.map(({ s, n }) => (
            <span key={s} className="t">
              <BcFormPfeil stufe={s} /> {n}
            </span>
          ))}
        </span>
        {schnitt != null ? (
          <span className="fm-team__moral">
            <span className="fm-gk">Moral Ø</span> <BcMoralGesicht wert={schnitt} />
          </span>
        ) : null}
      </div>
      {zeilen.map((z) => (
        <button key={z.id} type="button" className="fm-zeile" onClick={() => onWaehle(z.id)}>
          <b>{z.name}</b>
          <span className="fm-leise">{z.platz}</span>
          <FormMoralMarke a={z.a} />
          <span className={`t ${z.a.gesamtPct > 0 ? "bc-plus" : z.a.gesamtPct < 0 ? "bc-minus" : "fm-leise"}`}>{vz(z.a.gesamtPct)} %</span>
        </button>
      ))}
    </div>
  );
}

/** Kopf-Baustein „Team-Form · Moral Ø“: fuenf Zaehler plus Moral-Schnitt (Mockup, Hero rechts). */
export function TeamFormKopf({ anzeigen }: { anzeigen: FormMoralAnzeige[] }) {
  const mitForm = anzeigen.filter((a) => a.formVerfuegbar);
  const mitMoral = anzeigen.filter((a) => a.moral != null);
  if (mitForm.length === 0 && mitMoral.length === 0) return null;
  const schnitt = mitMoral.length ? mitMoral.reduce((x, a) => x + (a.moral ?? 0), 0) / mitMoral.length : null;
  return (
    <div className="fm-kopf" data-testid="fm-kopf">
      <span className="fm-gk">Team-Form{schnitt != null ? " · Moral Ø" : ""}</span>
      <span className="fm-kopf__zeile">
        {[2, 1, 0, -1, -2].map((s) => (
          <span key={s} className="t">
            <BcFormPfeil stufe={s} /> {mitForm.filter((a) => a.formStufe === s).length}
          </span>
        ))}
        {schnitt != null ? <BcMoralGesicht wert={schnitt} groesse={18} /> : null}
      </span>
    </div>
  );
}

/** Formkarten-Leiste: gelegte Karten als Kacheln (passt / fremd halber Wert) und „Karten fürs Team“ mit alle · Farbe · Form. */
export function KartenLeiste({ w }: { w: KartenWirkung }) {
  const summe = (f: (z: KartenWirkung["spieler"][number]["zerlegung"]) => number) => w.spieler.reduce((x, s) => x + f(s.zerlegung), 0);
  const alle = summe((z) => z.alle);
  const farbe = summe((z) => z.traeger);
  const form = summe((z) => z.form);
  return (
    <div className="fm-leiste" data-testid="fm-leiste">
      <div className="fm-leiste__kopf">
        <span className="fm-gk">Formkarten · {w.karten.length} gelegt</span>
        <small className="fm-leise">{w.buchung.gebucht ? "zählt in dieser Wertung" : "zählt hier noch nicht"}</small>
      </div>
      <div className="fm-leiste__kacheln">
        {w.karten.length === 0 ? <span className="fm-leise">Keine Karte gelegt.</span> : null}
        {w.karten.map((k) => (
          <span key={k.id} className="fm-kachel" style={{ borderColor: FORM_HEX[k.farbe] }}>
            <b className="t" style={{ color: FORM_HEX[k.farbe] }}>{vz(k.wert, 0)}</b>
            <span>{FARB_NAME[k.farbe] ?? k.farbe}</span>
            <small className="fm-leise">{k.spielerName}</small>
            <small className={k.passt ? "bc-plus" : "fm-leise"}>{k.passt ? "passt" : "fremd ½"}</small>
          </span>
        ))}
      </div>
      {w.buchung.gebucht ? (
        <div className="fm-leiste__team" data-testid="fm-leiste-team">
          <span className="fm-gk">Karten fürs Team</span>
          <b className="t">{vz(w.teamSumme)}</b>
          <small className="fm-leise">
            alle {vz(alle)} · Farbe {vz(farbe)} · Form {vz(form)} (+ Tagesform ±{w.tagesformSpanne} je Spieler)
          </small>
        </div>
      ) : (
        <p className="fm-warn">{w.buchung.grund}</p>
      )}
    </div>
  );
}

/** Dreiteilige Karten-Marke am Platz: alle / Farbe / Form. */
export function KartenMarke({ alle, traeger, form, farbe }: { alle: number; traeger: number; form: number; farbe: string | null }) {
  const summe = alle + traeger + form;
  if (summe === 0) return null;
  return (
    <span className="fm-kmarke" title={`Karten: ${vz(alle)} für alle, ${vz(traeger)} Farbe, ${vz(form)} Form`} data-testid="fm-kmarke">
      <b className="fm-kmarke__sum t">{vz(summe)}</b>
      {traeger !== 0 ? <i className="fm-kmarke__tr t" style={{ color: farbe ? FORM_HEX[farbe] : undefined }}>{vz(traeger)}</i> : null}
      {form !== 0 ? <i className="fm-kmarke__fo t">{vz(form)}</i> : null}
    </span>
  );
}

/** Formkarten-Wirkung: Regel in einem Satz, Tabelle "Wer bekommt", ehrlicher Buchungshinweis. */
export function KartenWirkungPanel({ w, namen }: { w: KartenWirkung; namen: (playerId: string) => string }) {
  if (w.karten.length === 0) {
    return (
      <div className="fm-karten" data-testid="fm-karten-leer">
        <p>Keine Karte gelegt. Regel (je Karte mit Wert v):</p>
        <table className="fm-regel">
          <thead>
            <tr><th></th><th>alle</th><th>Farbträger zusätzlich</th></tr>
          </thead>
          <tbody>
            <tr><td>fremde Farbe</td><td>0,5 × v</td><td>+0,5 × v</td></tr>
            <tr><td>passende Farbe</td><td>1,0 × v</td><td>+0,5 × v</td></tr>
          </tbody>
        </table>
        <p className="fm-leise">Höchstens +12 für einen Farbträger in passender Disziplin (mit Form ▲▲ bis +13).</p>
      </div>
    );
  }
  const satz = w.karten.map((k) => `${vz(k.wert, 0)} ${FARB_NAME[k.farbe] ?? k.farbe}${k.passt ? " (passt)" : " (fremd, halber Wert)"}`).join(" + ");
  return (
    <div className="fm-karten" data-testid="fm-karten">
      <p>
        <b>{satz}</b>: {vz(w.alleAnteil)} für alle
        {w.traegerAnzahl > 0 ? `, zusätzlich für ${w.traegerAnzahl} Spieler der Kartenfarbe.` : ", kein Spieler dieser Farbe im Einsatz."}
      </p>
      {!w.buchung.gebucht ? (
        <p className="fm-warn" data-testid="fm-nicht-gebucht">
          {w.buchung.grund}
        </p>
      ) : null}
      <p className="fm-leise" data-testid="fm-tagesform">
        Dazu kommt je Spieler die <b>Tagesform ±{w.tagesformSpanne}</b> (Zufall, je Spieltag neu). Bei Kartenwerten unter {w.tagesformSpanne} (mit ~) kann das Vorzeichen kippen.
      </p>
      {w.vergleich.length > 0 ? (
        <div className="fm-vergleich" data-testid="fm-vergleich">
          <span className="fm-gk">Alle Karten im Vergleich</span>
          {w.vergleich.slice(0, 8).map((v) => (
            <div key={v.id} className={`fm-vergleich__zeile${v.gewaehlt ? " is-gelegt" : ""}`}>
              <b className="t" style={{ color: FORM_HEX[v.farbe] }}>{vz(v.wert, 0)}</b>
              <span>{FARB_NAME[v.farbe] ?? v.farbe} · {v.spielerName}</span>
              <small className={v.passt ? "bc-plus" : "fm-leise"}>{v.passt ? "passt" : "fremd ½"}</small>
              <b className="t">{vz(v.teamSumme)}</b>
            </div>
          ))}
        </div>
      ) : null}
      <table className="fm-tabelle">
        <thead>
          <tr><th>Wer bekommt</th><th>alle</th><th>Farbe</th><th>Form</th><th>Karte</th></tr>
        </thead>
        <tbody>
          {w.spieler.map((s) => (
            <tr key={s.playerId} className={s.zerlegung.istTraeger ? "is-traeger" : ""}>
              <td>{namen(s.playerId)}</td>
              <td className="t">{vz(s.zerlegung.alle)}</td>
              <td className="t">{s.zerlegung.traeger ? vz(s.zerlegung.traeger) : "–"}</td>
              <td className="t">{s.zerlegung.form ? vz(s.zerlegung.form) : "–"}</td>
              <td className="t"><b>{s.vorzeichenOffen ? "~" : ""}{vz(s.zerlegung.summe)}</b></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><td colSpan={4}>Team (Karten)</td><td className="t"><b>{vz(w.teamSumme)}</b></td></tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Form-Kurve der Saison: Punkt = Einsatz (gefuellt) oder Ruhetag (hohl), Mitte 50 als Linie. */
export function FormVerlaufKurve({ a }: { a: FormMoralAnzeige }) {
  const v = a.verlauf;
  if (v.length === 0) return <p className="fm-leise" data-testid="fm-kein-verlauf">Noch kein Verlauf — die Kurve beginnt nach dem nächsten Spieltag.</p>;
  const B = 320;
  const H = 120;
  const dx = v.length > 1 ? (B - 24) / (v.length - 1) : 0;
  const y = (f: number) => 8 + (1 - f / 100) * (H - 16);
  const pfad = v.map((e, i) => `${i === 0 ? "M" : "L"}${(12 + i * dx).toFixed(1)} ${y(e.form).toFixed(1)}`).join(" ");
  return (
    <svg className="fm-kurve" viewBox={`0 0 ${B} ${H}`} role="img" aria-label="Form-Verlauf der Saison" data-testid="fm-kurve">
      {[2, 1, 0, -1, -2].map((s) => (
        <line key={s} x1="0" x2={B} y1={y(50 + s * 15)} y2={y(50 + s * 15)} className={s === 0 ? "fm-kurve__mitte" : "fm-kurve__gitter"} />
      ))}
      <path d={pfad} fill="none" className="fm-kurve__linie" />
      {v.map((e, i) => (
        <circle key={e.matchdayId} cx={12 + i * dx} cy={y(e.form)} r="3.4" className={e.eingesetzt ? "fm-kurve__punkt" : "fm-kurve__punkt is-hohl"}>
          <title>{`${e.matchdayId}: Form ${Math.round(e.form)} (${e.eingesetzt ? "Einsatz" : "kein Einsatz"})`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Spielerprofil-Block: Form-Verlauf, Leistung gegen Erwartung, Moral-Ursachen. */
export function FormMoralProfil({
  name,
  a,
  ursachen,
  disziplinName,
}: {
  name: string;
  a: FormMoralAnzeige;
  ursachen: UrsachenZeile[];
  disziplinName: (id: string) => string;
}) {
  const stufe = a.moral != null ? moralStufe(a.moral) : null;
  return (
    <section className="fm-profil" data-testid="fm-profil" aria-label={`Form und Moral: ${name}`}>
      <div className="fm-profil__form">
        <h3>Form-Verlauf</h3>
        <div className="fm-kennzahlen">
          <span><small>Form</small><b className="t">{a.form != null ? Math.round(a.form) : "–"}</b></span>
          <span><small>Stufe</small><b><BcFormPfeil stufe={a.formStufe} /> {a.formWort}</b></span>
          <span><small>Wirkung</small><b className="t">{vz(a.formPct)} %</b></span>
          <span><small>Erschöpfung</small><b className="t">{a.erschoepfung != null ? Math.round(a.erschoepfung) : "–"}</b></span>
        </div>
        <FormVerlaufKurve a={a} />
        <div className="fm-ldE">
          <h4>Leistung gegen Erwartung</h4>
          {a.verlauf.filter((e) => e.eingesetzt).slice(-8).map((e) => {
            const d = e.erwartungPerz != null && e.leistungPerz != null ? e.leistungPerz - e.erwartungPerz : null;
            return (
              <div key={e.matchdayId} className="fm-ldE__zeile" title={formBegruendung(e, e.disziplinId ? disziplinName(e.disziplinId) : null)}>
                <span>{e.disziplinId ? disziplinName(e.disziplinId) : "Einsatz"}</span>
                <b className={`t ${d == null ? "" : d >= 0 ? "bc-plus" : "bc-minus"}`}>{d == null ? "–" : vz(d, 0)}</b>
                {e.bremse?.art === "erschoepfung" ? <span className="bc-minus t">Last −{ZAHL.format(e.bremse.punkte)}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="fm-profil__moral">
        <h3>Moral</h3>
        <div className="fm-kennzahlen">
          <span><small>Moral</small><b>{a.moral != null ? <BcMoralGesicht wert={a.moral} groesse={22} /> : "–"}</b></span>
          <span><small>Stufe</small><b style={stufe && a.moral != null ? { color: moralFarbe(a.moral) } : undefined}>{stufe?.wort ?? "–"}</b></span>
          <span><small>Wirkung</small><b className="t">{vz(a.moralPct)} %</b></span>
        </div>
        {ursachen.length > 0 ? (
          <ul className="fm-ursachen">
            {ursachen.map((u) => (
              <li key={u.id}><span className={`t ${u.delta >= 0 ? "bc-plus" : "bc-minus"}`}>{vz(u.delta, 0)}</span> {u.label}</li>
            ))}
          </ul>
        ) : (
          <p className="fm-leise">Keine auffälligen Ursachen.</p>
        )}
      </div>
    </section>
  );
}

/** Nach dem Spieltag: Bauchbinde (groesste Bewegung, wegklickbar) + Liste aller Meldungen. */
export function FormMeldungen({
  meldungen,
  spieltag,
  bauchbinde = true,
}: {
  meldungen: FormMeldung[];
  spieltag?: string | number | null;
  bauchbinde?: boolean;
}) {
  if (meldungen.length === 0) return null;
  const bewegt = meldungen.filter((m) => m.richtung !== "gleich");
  return (
    <section className="fm-meldungen" data-testid="fm-meldungen" aria-label="Form-Meldungen">
      {bauchbinde && bewegt.length > 0 ? <FormBauchbinde meldungen={bewegt.slice(0, 5)} spieltag={spieltag} /> : null}
      <h3>Form-Meldungen</h3>
      <ul>
        {meldungen.map((m) => (
          <li key={m.playerId}>
            <b>{m.name}</b>
            <span className="t">
              <BcFormPfeil stufe={m.stufeVorher} /> → <BcFormPfeil stufe={m.stufeNachher} />
            </span>
            <span className={`t ${m.delta > 0 ? "bc-plus" : m.delta < 0 ? "bc-minus" : ""}`}>
              {Math.round(m.vorher)} → {Math.round(m.nachher)}
            </span>
            <span className="fm-leise">{m.grund}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}


export function FormBauchbinde({ meldungen, spieltag }: { meldungen: FormMeldung[]; spieltag?: string | number | null }) {
  const [index, setIndex] = useState(0);
  const [zu, setZu] = useState(false);
  if (zu || meldungen.length === 0) return null;
  const m = meldungen[index % meldungen.length];
  return (
    <div className={`fm-bauchbinde ${m.richtung === "gestiegen" ? "is-auf" : "is-ab"}`} role="status" data-testid="fm-bauchbinde">
      <div>
        <small>Form {m.richtung}{spieltag != null ? ` · Spieltag ${spieltag}` : ""}</small>
        <b>{m.name}</b>
        <span>{m.grund}</span>
      </div>
      <span className="t fm-bauchbinde__pfeile">
        <BcFormPfeil stufe={m.stufeVorher} /> → <BcFormPfeil stufe={m.stufeNachher} />
      </span>
      {meldungen.length > 1 ? (
        <button type="button" className="bc-btn bc-btn--klein" onClick={() => setIndex((i) => i + 1)} aria-label="Nächste Meldung">
          {(index % meldungen.length) + 1}/{meldungen.length} ›
        </button>
      ) : null}
      <button type="button" className="bc-btn bc-btn--klein" onClick={() => setZu(true)} aria-label="Schließen">×</button>
    </div>
  );
}
