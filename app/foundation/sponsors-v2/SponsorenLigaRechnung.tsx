"use client";

/**
 * SPONSOREN: Liga-Vergleich (alle Spalten sortierbar) und Rechenansicht „So wird der Saisonfaktor gerechnet“.
 * Quelle ist `SponsorUebersicht` (`liga_vergleich`, `ligaBilanz`, `rechnung`). Scouting-Nebel: der Erwartungsrang fremder Teams
 * erscheint nur als Viertel der Liga (`erwartungsAnzeige`), sortiert wird nach der Untergrenze der Stufe.
 */
import { useMemo, useState } from "react";

import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { bilanzKennzahlen, erwartungsAnzeige, tonVon, topfBeiFaktor, vorzeichenDe, zahlDe } from "@/lib/sponsors/sponsor-seite-modell";
import { SPONSOR_TOPF } from "@/lib/sponsors/sponsor-topf-modell";
import type { SponsorFarbe } from "@/lib/sponsors/sponsor-topf-typen";
import type { SponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";
import { useTabellenSortierung, type SortSpalte } from "@/lib/ui/tabellen-sortierung";

import { BilanzSaeulen, FarbMarke, SponsorWappenBild } from "./sponsoren-bits";

type LigaZeile = {
  rang: number;
  teamId: string;
  teamName: string;
  logo: string | null;
  eigen: boolean;
  marke: string | null;
  art: string;
  erw: ReturnType<typeof erwartungsAnzeige>;
  platz: number | null;
  grund: number;
  leistung: number;
  farben: SponsorFarbe[];
  farbe: number;
  ziel: number;
  summe: number;
  kosten: number;
  ergebnis: number;
};

const ART_KURZ = { fest: "Fest", leistung: "Leistung", praemie: "Prämie" } as const;

type LigaSpalte = "rang" | "team" | "sponsor" | "art" | "erw" | "platz" | "grund" | "leistung" | "farben" | "farbe" | "ziel" | "summe" | "kosten" | "ergebnis";

const SPALTEN: Record<LigaSpalte, SortSpalte<LigaZeile>> = {
  rang: { wert: (z) => z.rang, standard: "auf" },
  team: { wert: (z) => z.teamName, standard: "auf" },
  sponsor: { wert: (z) => z.marke, standard: "auf" },
  art: { wert: (z) => z.art, standard: "auf" },
  erw: { wert: (z) => z.erw.sort, standard: "auf" },
  platz: { wert: (z) => z.platz, standard: "auf" },
  grund: { wert: (z) => z.grund },
  leistung: { wert: (z) => z.leistung },
  farben: { wert: (z) => z.farben.join(""), standard: "auf" },
  farbe: { wert: (z) => z.farbe },
  ziel: { wert: (z) => z.ziel },
  summe: { wert: (z) => z.summe },
  // Rangregel (Chris, 21.11.): bei Kosten ist das guenstigste Team Rang 1, also zuerst aufsteigend.
  kosten: { wert: (z) => z.kosten, standard: "auf" },
  ergebnis: { wert: (z) => z.ergebnis },
};

const KOEPFE: Array<[LigaSpalte, string, string]> = [
  ["rang", "#", "m"],
  ["team", "Team", "l"],
  ["sponsor", "Hauptsponsor", "l"],
  ["art", "Vertragsart", "l"],
  ["erw", "Erwartung", ""],
  ["platz", "Platz", ""],
  ["grund", "Grundbetrag", ""],
  ["leistung", "Leistung", ""],
  ["farben", "Farb-Partner", "m"],
  ["farbe", "Farbe", ""],
  ["ziel", "Ziel", ""],
  ["summe", "Summe heute", ""],
  ["kosten", "Kosten", ""],
  ["ergebnis", "Ergebnis bei Erwartung", ""],
];

export function SponsorenLigaAnsicht({ gameState, teamId, u }: { gameState: GameState; teamId: string; u: SponsorUebersicht }) {
  const zeilen = useMemo<LigaZeile[]>(() => {
    const nachSumme = [...u.liga_vergleich].sort((a, b) => b.summeHeute - a.summeHeute || a.teamName.localeCompare(b.teamName));
    return nachSumme.map((t, i) => ({
      rang: i + 1,
      teamId: t.teamId,
      teamName: t.teamName,
      logo: getStaticTeamLogoUrl(t.teamId) ?? gameState.teams.find((x) => x.teamId === t.teamId)?.logoPath ?? null,
      eigen: t.teamId === teamId,
      marke: t.markeName,
      art: t.vertragsart ? ART_KURZ[t.vertragsart] : "–",
      erw: erwartungsAnzeige(gameState, t.teamId === teamId, t.erwartungsrang),
      platz: t.platz,
      grund: t.grund,
      leistung: t.leistungHeute,
      farben: t.farben,
      farbe: t.farbHeute,
      ziel: t.zielHeute,
      summe: t.summeHeute,
      kosten: t.kosten,
      ergebnis: t.guvBeiErwartung,
    }));
  }, [u.liga_vergleich, gameState, teamId]);
  const { sortiert, kopf } = useTabellenSortierung(zeilen, SPALTEN, { key: "summe", richtung: "ab" });
  const k = useMemo(() => bilanzKennzahlen(u), [u]);
  const maxAbs = Math.max(1, ...zeilen.map((z) => Math.abs(z.ergebnis)));
  const ligaMittel = zeilen.length ? zeilen.reduce((s, z) => s + z.ergebnis, 0) / zeilen.length : 0;
  const imPlus = zeilen.filter((z) => z.ergebnis >= 0).length;
  const grundWerte = zeilen.map((z) => z.grund).filter((g) => g > 0);

  return (
    <section className="so-pan">
      <div className="so-pk">
        <h2>Liga {u.liga}: wer bekommt was</h2>
        <span className="so-marke is-echt">Teams, Plätze, Marken echt</span>
        <span className="sp" />
        <span className="hin">Rang 1 = höchste Summe · alle Spalten sortierbar · C je Saison, Hochrechnung mit dem Tabellenstand · fremde Erwartungsränge nur als Viertel (Scouting-Nebel)</span>
      </div>
      <div className="so-tw">
        <table className="so-tab fuellt" aria-label={`Sponsoren-Vergleich Liga ${u.liga}`}>
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "5.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "6.5%" }} />
            <col style={{ width: "5.5%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr>
              {KOEPFE.map(([key, titel, ausrichtung]) => {
                const kp = kopf(key);
                return (
                  <th key={key} className={ausrichtung} aria-sort={kp.ariaSort}>
                    <button type="button" onClick={kp.onKlick}>
                      {titel}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortiert.map((z) => (
              <tr key={z.teamId} className={z.eigen ? "ich" : undefined} data-testid={z.eigen ? "sponsoren-liga-eigen" : undefined}>
                <td className="m bc-t">{z.rang}</td>
                <td className="l">
                  <div className="so-tm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {z.logo ? <img src={z.logo} alt="" /> : null}
                    <span className="h">{z.teamName}</span>
                  </div>
                </td>
                <td className="l">
                  {z.marke ? (
                    <div className="so-tm">
                      <SponsorWappenBild quelle={{ name: z.marke }} name={z.marke} klein />
                      <span>{z.marke}</span>
                    </div>
                  ) : (
                    <span className="leise">kein Vertrag</span>
                  )}
                </td>
                <td className="l leise">{z.art}</td>
                <td className="bc-t gold" title={z.erw.exakt ? "Erwartungsrang" : "Erwartungsrang als Viertel der Liga (Scouting-Nebel)"}>
                  {z.erw.text}
                </td>
                <td className="bc-t">{z.platz ?? "–"}</td>
                <td className="bc-t">{zahlDe(z.grund, 1)}</td>
                <td className={`bc-t ${tonVon(z.leistung)}`}>{vorzeichenDe(z.leistung, 1)}</td>
                <td className="m">
                  <span className="so-fbz">
                    {z.farben.length ? z.farben.map((f) => <FarbMarke key={f} farbe={f} />) : <span className="leise">–</span>}
                  </span>
                </td>
                <td className={`bc-t ${tonVon(z.farbe)}`}>{z.farbe > 0 ? zahlDe(z.farbe, 1) : "–"}</td>
                <td className={`bc-t ${tonVon(z.ziel)}`}>{z.ziel !== 0 ? vorzeichenDe(z.ziel, 1) : "–"}</td>
                <td className="bc-t gold">{zahlDe(z.summe, 1)}</td>
                <td className="bc-t leise">{zahlDe(z.kosten, 1)}</td>
                <td>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(3em,auto) minmax(0,1fr)", gap: "0.6em", alignItems: "center" }}>
                    <span className={`bc-t ${tonVon(z.ergebnis)}`}>{vorzeichenDe(z.ergebnis, 1)}</span>
                    <div className="so-bal" aria-hidden="true">
                      <i
                        style={
                          z.ergebnis >= 0
                            ? { left: "50%", width: `${Math.min(50, (z.ergebnis / maxAbs) * 50)}%`, background: "var(--bc-gut)" }
                            : { right: "50%", width: `${Math.min(50, (-z.ergebnis / maxAbs) * 50)}%`, background: "var(--bc-warn)" }
                        }
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="so-fuss">
        <span>
          Ergebnis bei Erwartung: Mittel <b className={`bc-t ${tonVon(ligaMittel)}`}>{vorzeichenDe(ligaMittel, 1)} C</b> · im Plus <b className="bc-t">{imPlus} von {zeilen.length}</b> · Gefälle oben gegen unten (Erwartung 1–4 gegen 13–16){" "}
          <b className="bc-t">{vorzeichenDe(k.gaefalleEigeneLiga, 1)} C</b>
        </span>
        <span className="sp" />
        <span>
          Größter zu kleinstem Grundbetrag: <b className="bc-t">{grundWerte.length ? zahlDe(Math.max(...grundWerte) / Math.min(...grundWerte), 2) : "–"}</b>
        </span>
      </div>
    </section>
  );
}

export function SponsorenRechnungAnsicht({ teamId, u }: { teamId: string; u: SponsorUebersicht }) {
  const r = u.rechnung;
  const [faktor, setFaktor] = useState(u.faktor);
  const verschoben = useMemo(() => topfBeiFaktor(r, u.faktor, faktor), [r, u.faktor, faktor]);
  const k = useMemo(() => bilanzKennzahlen(u), [u]);
  const gruppen = useMemo(
    () =>
      [1, 2].map((liga) => ({
        titel: `Liga ${liga}`,
        teams: u.ligaBilanz.teams
          .filter((t) => t.liga === liga)
          .sort((a, b) => b.guvBeiErwartung - a.guvBeiErwartung || a.teamName.localeCompare(b.teamName))
          .map((t) => ({ teamId: t.teamId, kuerzel: t.kuerzel, wert: t.guvBeiErwartung })),
      })),
    [u.ligaBilanz.teams],
  );
  const eigen = u.liga_vergleich.find((t) => t.teamId === teamId) ?? null;
  const schritte = u.rechnung.schritte;
  const wert = (id: string) => schritte.find((s) => s.id === id)?.wert ?? 0;
  const ligaAnteil = SPONSOR_TOPF.anteil[u.liga];

  return (
    <>
      <section className="so-pan">
        <div className="so-pk">
          <h2>So rechnet der Saisonfaktor</h2>
          <span className="sp" />
          <span className="so-marke is-echt">Live-Zahlen</span>
        </div>
        <div className="so-kb">
          <div className="so-schritt">
            <span className="n">1</span>
            <div>
              <b>Was kostet die Liga?</b>
              <small>Gehälter, Unterhalt und Zinsen abzüglich der übrigen Einnahmen (Tickets, Marketing, Medaillen, Ziele). Je Saison höchstens 15 % Bewegung.</small>
            </div>
            <strong className="bc-t">{zahlDe(wert("betrieb"), 0)} C</strong>
          </div>
          <div className="so-schritt">
            <span className="n">2</span>
            <div>
              <b>Kader-Ersatz</b>
              <small>{zahlDe(SPONSOR_TOPF.kaderErsatzAnteil * 100, 0)} % des Kaderwerts (Saison 1 zusätzlich {zahlDe(SPONSOR_TOPF.kaderErsatzZuschlagSaison1 * 100, 0)} %): die Liga bleibt im Wert.</small>
            </div>
            <strong className="bc-t">{zahlDe(wert("ersatz"), 0)} C</strong>
          </div>
          <div className="so-schritt">
            <span className="n">3</span>
            <div>
              <b>Liga-Topf = Rest × Saisonfaktor</b>
              <small>
                × {zahlDe(u.faktor, 2)} − Übertrag {vorzeichenDe(r.uebertrag, 1)} C. Davon gehen {zahlDe(r.farbToepfe.liga1 + r.farbToepfe.liga2, 0)} C an die Farb-Töpfe und {zahlDe(r.treueSumme, 1)} C an Treueboni.
              </small>
            </div>
            <strong className="bc-t gold">{zahlDe(wert("faktor"), 0)} C</strong>
          </div>
          <div className="so-schritt">
            <span className="n">4</span>
            <div>
              <b>Verteilen: Grundbetrag, Leistung, Farbe</b>
              <small>Grundbetrag nach Liga-Anteil, Erwartungsrang und Beliebtheit. Leistung: Summe je Liga 0. Farb-Töpfe getrennt je Farbe.</small>
            </div>
            <strong className="bc-t">{zahlDe(wert("verteilung") / 32, 1)} <small style={{ fontSize: "0.55em", color: "var(--bc-leise)" }}>je Team</small></strong>
          </div>
          <div className="so-formel">
            Auszahlung = <em>Grundbetrag</em>(Erwartungsrang, Beliebtheit, Passung) + <em>Satz</em> × Hebel × (Erwartungsrang − Endrang) − Liga-Ausgleich + <em>Farb-Partner</em> + Ziel
          </div>
          {eigen ? (
            <table className="so-mini" aria-label="Beispiel Grundbetrag">
              <thead>
                <tr>
                  <th>Beispiel: dein Grundbetrag</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Liga-Anteil {zahlDe(ligaAnteil, 2)} von 1,00</td>
                  <td />
                </tr>
                <tr>
                  <td>Grundbetrag inkl. Treuebonus, Stand heute</td>
                  <td className="bc-t gold">{zahlDe(eigen.grund, 1)} C</td>
                </tr>
              </tbody>
            </table>
          ) : null}
          <div className="so-kopfzeile">Saisonfaktor verschoben: {zahlDe(faktor, 2)}</div>
          <input
            type="range"
            min={0.9}
            max={1.1}
            step={0.01}
            value={faktor}
            onChange={(e) => setFaktor(Number(e.target.value))}
            aria-label="Saisonfaktor verschieben"
          />
          <p className="leise" style={{ margin: 0, fontSize: "0.9em" }}>
            Liga-Topf bei {zahlDe(faktor, 2)}: <b className="bc-t" style={{ color: "var(--bc-creme)" }}>{zahlDe(verschoben.topf, 0)} C</b> ({vorzeichenDe(verschoben.differenz, 1)} C, das sind {vorzeichenDe(verschoben.jeTeam, 2)} C je Team). Jedes Hundertstel bewegt die Liga um etwa {zahlDe(verschoben.basis / 100, 0)} C. Der Regler rechnet nur nach, er ändert nichts.
          </p>
        </div>
      </section>

      <section className="so-pan">
        <div className="so-pk">
          <h2>Wenn alle genau ihren Erwartungsrang erreichen</h2>
          <span className="sp" />
          <span className="hin">Ergebnis je Team in C, je Liga absteigend</span>
        </div>
        <div className="so-kb">
          <BilanzSaeulen gruppen={gruppen} eigenesTeamId={teamId} />
          <div className="so-leg">
            <span><i style={{ background: "#62d394" }} />im Plus</span>
            <span><i style={{ background: "#ff6058" }} />im Minus</span>
            <span><i style={{ background: "#f2a03d" }} />dein Team</span>
          </div>
        </div>
        <div className="so-fuss">
          <span>Ergebnis = Grundbetrag + Farb-Mittel − (Kosten − übrige Einnahmen) − Kader-Ersatz. Wer für seinen Erwartungsrang teuer ist, liegt im Minus; der Vergleich mit dem alten System entfällt, weil es dafür keine Datenquelle mehr gibt.</span>
        </div>
      </section>

      <section className="so-pan">
        <div className="so-pk">
          <h2>Liga-Bilanz</h2>
          <span className="sp" />
          <span className="hin">alle auf Erwartungsrang</span>
        </div>
        <div className="so-kb">
          <div className="so-kachel">
            <span className="bc-gk">Liga-Mittel</span>
            <strong className={`bc-t ${tonVon(k.mittel)}`}>{vorzeichenDe(k.mittel, 1)} C</strong>
            <small>je Team, beide Ligen (Saisonfaktor {zahlDe(u.faktor, 2)})</small>
          </div>
          <div className="so-kachel">
            <span className="bc-gk">Teams im Plus · im Minus</span>
            <strong className="bc-t">
              {k.imPlus} · {k.imMinus}
            </strong>
            <small>von {k.anzahl} Teams</small>
          </div>
          <div className="so-kachel">
            <span className="bc-gk">Gefälle oben gegen unten, Liga {u.liga}</span>
            <strong className={`bc-t ${tonVon(k.gaefalleEigeneLiga)}`}>{vorzeichenDe(k.gaefalleEigeneLiga, 1)} C</strong>
            <small>Erwartungsrang 1 bis 4 gegen 13 bis 16</small>
          </div>
          <div className="so-kachel">
            <span className="bc-gk">Größter zu kleinstem Vertrag</span>
            <strong className="bc-t">{zahlDe(k.groessterZuKleinster, 2)}</strong>
            <small>Grundbetrag, Liga {u.liga}</small>
          </div>
          <div className="so-kachel">
            <span className="bc-gk">Sponsorgeld Liga 1 zu Liga 2</span>
            <strong className="bc-t">{zahlDe(k.ligaVerhaeltnis, 2)}</strong>
            <small>Summe der Grundbeträge</small>
          </div>
        </div>
      </section>
    </>
  );
}
