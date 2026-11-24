"use client";

/**
 * SPONSOREN im Broadcast-Stil (24.11., Phase 4 des Sponsoren-Rework). Vorlage: public/mockups/sponsoren-modern-22-11.html.
 * Neu gebaut, nicht in die alte Seite eingehaengt: vier Ansichten (Laufender Vertrag, Angebote, Liga-Vergleich, So rechnet der Saisonfaktor).
 * EINE Quelle: `baueSponsorUebersicht` (lib/sponsors/sponsor-uebersicht.ts), gezeigt = gebucht. Geschrieben wird nur ueber die bestehenden
 * Routen: `POST /api/sponsor/choose` (Vertragsart, Laufzeit, Farben) und `POST /api/sponsor/event` (Sponsorentermin).
 * Einheit C; Betraege gross je Saison, klein je Spieltag. Die Liga-Vergleich- und Rechenansicht liegen in `SponsorenLigaRechnung.tsx`.
 */
import { useMemo, useState } from "react";

import { BcHero, BcIcon, BcReiter } from "@/components/foundation/broadcast";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import { evaluateGamePhaseAction } from "@/lib/foundation/game-phase-action-policy";
import { formatGameFlowBlocker } from "@/lib/foundation/game-flow-blocker-labels";
import { getTeamSponsorOffers } from "@/lib/sponsor/sponsor-offer-read";
import {
  auszahlungsZeilen,
  tonVon,
  vorzeichenDe,
  zahlDe,
} from "@/lib/sponsors/sponsor-seite-modell";
import { kaderBeliebtheit, werbegeldMittel } from "@/lib/sponsors/sponsor-topf-eingaben";
import { SPONSOR_FARBEN, SPONSOR_FARBE_LABEL, SPONSOR_TOPF } from "@/lib/sponsors/sponsor-topf-modell";
import { farbStaerkeRang, kiFarbenFuerTeam } from "@/lib/sponsors/sponsor-topf-wahl";
import type { SponsorFarbe, SponsorTermin, SponsorVertragsart } from "@/lib/sponsors/sponsor-topf-typen";
import type { SponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";

import { AuszahlungsKurve, FarbMarke, LeistungVerlaufDiagramm, SponsorWappenBild } from "./sponsoren-bits";
import { SponsorenLigaAnsicht, SponsorenRechnungAnsicht } from "./SponsorenLigaRechnung";
import "./sponsoren-modern.css";

export type SponsorenAnsicht = "vertrag" | "angebote" | "liga" | "rechnung";

export type SponsorenTopfWahl = { vertragsart?: SponsorVertragsart; laufzeit?: 1 | 2 | 3; farben?: SponsorFarbe[] };

export type SponsorenModernProps = {
  gameState: GameState;
  teamId: string;
  teamName: string;
  uebersicht: SponsorUebersicht;
  kannVerwalten: boolean;
  /** Unterschreibt ein Angebot; ohne `wahl` fuellt die KI Vertragsart, Laufzeit und Farben (Mensch ueberschreibt, KI respektiert das). */
  onUnterschreiben: (offerId: string, wahl?: SponsorenTopfWahl) => void | Promise<void>;
  onTerminAntwort?: (terminId: string, antwort: "zusagen" | "absagen" | "ki") => void | Promise<void>;
  meldung: string | null;
  beschaeftigt: string | null;
  terminBeschaeftigt?: string | null;
  startAnsicht?: SponsorenAnsicht;
};

const ART_TEXT: Record<SponsorVertragsart, string> = {
  fest: "Planbar. Jeder Platz zählt nur halb, nach oben wie nach unten. Kein Ziel.",
  leistung: "Der Standard. Voller Leistungssatz, ein Ziel mit kleinem Einsatz.",
  praemie: "Wette auf dich selbst. Jeder Platz zählt anderthalbfach, das Ziel doppelt.",
};

function meldungText(message: string): string {
  const looksLikeReasonSlug = !/\s/.test(message) && /[:_]/.test(message);
  return looksLikeReasonSlug ? formatGameFlowBlocker(message) : message;
}

function Zeile({ label, hinweis, wert, klein, ton, spieltag }: { label: string; hinweis?: string; wert: string; klein?: boolean; ton?: string; spieltag?: string }) {
  return (
    <div className={`so-z${klein ? " klein" : ""}`}>
      <span>
        {label}
        {hinweis ? <small>{hinweis}</small> : null}
      </span>
      <b className={`bc-t ${ton ?? ""}`}>
        {wert}
        {spieltag ? <small>{spieltag}</small> : null}
      </b>
    </div>
  );
}

function farbText(farben: SponsorFarbe[]): string {
  return farben.length ? farben.map((f) => SPONSOR_FARBE_LABEL[f]).join(" und ") : "keine";
}

export default function SponsorenModern({
  gameState,
  teamId,
  teamName,
  uebersicht: u,
  kannVerwalten,
  onUnterschreiben,
  onTerminAntwort,
  meldung,
  beschaeftigt,
  terminBeschaeftigt,
  startAnsicht,
}: SponsorenModernProps) {
  const [ansicht, setAnsicht] = useState<SponsorenAnsicht>(startAnsicht ?? (u.vertrag ? "vertrag" : "angebote"));
  const eigen = u.liga_vergleich.find((t) => t.teamId === teamId) ?? null;
  const wappen = getStaticTeamLogoUrl(teamId) ?? gameState.teams.find((t) => t.teamId === teamId)?.logoPath ?? null;
  const platzText = eigen?.platz != null ? `Platz ${eigen.platz}` : "vor Spieltag 1";
  const erwText = eigen ? zahlDe(Math.round(eigen.erwartungsrang * 10) / 10, 1).replace(/,0$/, "") : "–";
  const faktorText = u.faktor >= 1.005 ? "Konjunktur gut" : u.faktor <= 0.995 ? "Konjunktur schwach" : "Liga im Gleichgewicht";

  return (
    <div className="bc so" data-testid="sponsoren-modern">
      <BcHero
        wappen={wappen}
        wappenAlt={teamName}
        dachzeile={<>{u.gebuchteSpieltage <= 0 ? "Vor Spieltag 1" : `Nach Spieltag ${u.gebuchteSpieltage} von ${u.spieltage}`}</>}
        titel="Sponsoren"
        untertitel={
          <>
            <b className="bc-t">{teamName}</b> · Liga {u.liga} · {platzText} · Erwartung <b className="bc-t">{erwText}</b>
          </>
        }
        mitte={
          <>
            <BcReiter
              aktiv={ansicht === "vertrag"}
              onClick={() => setAnsicht("vertrag")}
              eyebrow="Laufender Vertrag"
              titel={u.vertrag?.markeName ?? "Kein Vertrag"}
              symbol={<BcIcon name="liste" />}
            />
            <BcReiter
              aktiv={ansicht === "angebote"}
              onClick={() => setAnsicht("angebote")}
              eyebrow={u.vertrag ? "Angebote ab Saisonende" : "Angebote für diese Saison"}
              titel="Verhandlung"
              symbol={<BcIcon name="karte" />}
            />
            <BcReiter aktiv={ansicht === "liga"} onClick={() => setAnsicht("liga")} eyebrow="Wer bekommt was" titel="Liga-Vergleich" symbol={<BcIcon name="krone" />} />
            <BcReiter aktiv={ansicht === "rechnung"} onClick={() => setAnsicht("rechnung")} eyebrow="So wird gerechnet" titel="Saisonfaktor" symbol={<BcIcon name="bank" />} />
          </>
        }
        rechts={
          <div className="so-fakt" title="Saisonfaktor F = Grundwert 1,00 x Konjunktur der Saison">
            <strong className="bc-t">{zahlDe(u.faktor, 2)}</strong>
            <span>Saisonfaktor</span>
            <i>{faktorText}</i>
          </div>
        }
      />
      <div className={`so-work v-${ansicht}`}>
        {ansicht === "vertrag" ? (
          <VertragAnsicht gameState={gameState} teamId={teamId} u={u} kannVerwalten={kannVerwalten} onTerminAntwort={onTerminAntwort} terminBeschaeftigt={terminBeschaeftigt ?? null} onAngebote={() => setAnsicht("angebote")} />
        ) : null}
        {ansicht === "angebote" ? (
          <AngeboteAnsicht gameState={gameState} teamId={teamId} u={u} kannVerwalten={kannVerwalten} onUnterschreiben={onUnterschreiben} meldung={meldung} beschaeftigt={beschaeftigt} />
        ) : null}
        {ansicht === "liga" ? <SponsorenLigaAnsicht gameState={gameState} teamId={teamId} u={u} /> : null}
        {ansicht === "rechnung" ? <SponsorenRechnungAnsicht teamId={teamId} u={u} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ Vertrag */

function VertragAnsicht({
  gameState,
  teamId,
  u,
  kannVerwalten,
  onTerminAntwort,
  terminBeschaeftigt,
  onAngebote,
}: {
  gameState: GameState;
  teamId: string;
  u: SponsorUebersicht;
  kannVerwalten: boolean;
  onTerminAntwort?: SponsorenModernProps["onTerminAntwort"];
  terminBeschaeftigt: string | null;
  onAngebote: () => void;
}) {
  const v = u.vertrag;
  if (!v) {
    return (
      <section className="so-pan">
        <div className="so-leer">
          <h3>Noch kein Sponsorenvertrag</h3>
          <p>Vor dem ersten Spieltag wählst du aus den Angeboten einen Hauptsponsor, Vertragsart, Laufzeit und zwei Farb-Partner. Ohne deine Wahl bekommst du zum Stichtag das Angebot mit der besten Passung.</p>
          <button type="button" className="so-btn is-ja" onClick={onAngebote}>
            Zu den Angeboten
          </button>
        </div>
      </section>
    );
  }
  const z = v.zeilen;
  const n = u.spieltage;
  const stufen = auszahlungsZeilen(z.grund.saison, z.leistung.satzJePlatz, z.leistung.erwartungsrang).filter((s) => [1, 4, 8].includes(s.rang) || s.erwartung);
  const erwText = zahlDe(Math.round(z.leistung.erwartungsrang * 10) / 10, 1).replace(/,0$/, "");
  const nameVon = (id: string | null) => gameState.players.find((p) => p.id === id)?.name ?? "ein Spieler";
  const offeneTermine = u.termine.filter((t) => t.status === "offen");
  const alteTermine = u.termine.filter((t) => t.status !== "offen");
  const abschlaege = u.leistungVerlauf.reduce((s, x) => s + x.abschlag, 0);
  return (
    <>
      <section className="so-pan">
        <div className="so-pk">
          <h2>Hauptsponsor</h2>
          <span className="sp" />
          <span className={`so-marke ${u.eingefroren ? "is-echt" : "is-leer"}`}>{u.eingefroren ? "Stichtag gesetzt" : "Vorschau"}</span>
          {u.notbremse ? <span className="so-marke is-rot">Notbremse</span> : null}
        </div>
        <div className="so-kb">
          <div className="so-vk">
            <SponsorWappenBild quelle={{ sponsorBrandId: v.sponsorBrandId, sponsorParentBrandId: v.sponsorParentBrandId, name: v.markeName }} name={v.markeName} />
            <div>
              <h3>{v.markeName}</h3>
              <p>
                {v.vertragsartLabel} · Laufzeit {v.laufzeit} {v.laufzeit === 1 ? "Saison" : "Saisons"} · Jahr {v.jahr}
                <br />
                Erwartungsrang <b className="bc-t">{erwText}</b> von 16 · {v.passung.text}
              </p>
            </div>
          </div>
          <div className="so-zl">
            <Zeile label="Grundbetrag" hinweis={v.treueBonus > 0 ? `inkl. Treuebonus ${zahlDe(v.treueBonus, 1)} C` : undefined} wert={`${zahlDe(z.grund.saison, 1)} C`} spieltag={`${zahlDe(z.grund.jeSpieltag, 2)} C je Spieltag`} />
            <Zeile
              label="Leistungsteil"
              hinweis={`${zahlDe(z.leistung.satzJePlatz, 2)} C je Platz, Stand ${z.leistung.platzJetzt != null ? `Platz ${z.leistung.platzJetzt}` : "vor Spieltag 1"}`}
              wert={`${vorzeichenDe(z.leistung.saison, 1)} C`}
              ton={tonVon(z.leistung.saison)}
              spieltag={`${vorzeichenDe(z.leistung.jeSpieltag, 2)} C je Spieltag`}
            />
            <Zeile label="Farb-Partner" hinweis={farbText(v.farben)} wert={`${vorzeichenDe(z.farbe.saison, 1)} C`} ton={tonVon(z.farbe.saison)} />
            <Zeile
              label="Ziel"
              hinweis={z.ziel.einsatz > 0 ? `Einsatz ±${zahlDe(z.ziel.einsatz, 0)} C, erfüllt zu ${Math.round(z.ziel.erfuellung * 100)} %` : "kein Ziel auf diesem Vertrag"}
              wert={z.ziel.einsatz > 0 ? `${vorzeichenDe(z.ziel.saison, 1)} C` : "–"}
              ton={tonVon(z.ziel.saison)}
            />
            <div className="so-z sum">
              <span>Hochrechnung Saison</span>
              <b className="bc-t">
                {zahlDe(v.hochrechnung.saison, 1)} C<small>{zahlDe(v.hochrechnung.jeSpieltag, 2)} C je Spieltag</small>
              </b>
            </div>
            <Zeile label="Bisher gebucht" hinweis="Grundbetrag und Abschläge" wert={`${zahlDe(v.hochrechnung.gebucht, 1)} C`} klein />
          </div>
          <table className="so-mini" aria-label="Endet die Saison auf">
            <thead>
              <tr>
                <th>Endet die Saison auf</th>
                <th>Leistung</th>
                <th>Hauptsponsor</th>
              </tr>
            </thead>
            <tbody>
              {stufen.map((s) => (
                <tr key={s.rang} className={s.erwartung ? "erw" : undefined}>
                  <td>{s.erwartung ? `Platz ${s.rang} · Erwartung` : `Platz ${s.rang}`}</td>
                  <td className={`bc-t ${tonVon(s.leistung)}`}>{vorzeichenDe(s.leistung, 1)}</td>
                  <td className="bc-t">{zahlDe(s.summe, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {v.ueberfuehrung ? (
            <div className="so-hinweis">
              <b>Aus dem alten System übernommen.</b> Der alte Vertrag ließ {v.ueberfuehrung.alterAnker != null ? `${zahlDe(v.ueberfuehrung.alterAnker, 1)} C` : "einen anderen Betrag"} erwarten, der neue zahlt bei
              Erwartungsrang etwa {zahlDe(v.ueberfuehrung.neuBeiErwartung, 1)} C{v.ueberfuehrung.differenz != null ? ` (${vorzeichenDe(v.ueberfuehrung.differenz, 1)} C)` : ""}.
            </div>
          ) : null}
        </div>
      </section>

      <section className="so-pan">
        <div className="so-pk">
          <h2>Leistungsteil gegen die Erwartung</h2>
          <span className="sp" />
          <span className="hin">Abschlag je Spieltag = 80 % des Leistungsteils beim heutigen Platz ÷ {n}</span>
        </div>
        <div className="so-kb">
          <LeistungVerlaufDiagramm verlauf={u.leistungVerlauf} erwartungsrang={z.leistung.erwartungsrang} spieltage={n} ligaGroesse={u.liga_vergleich.length || 16} />
          <div className="so-leg">
            <span><i style={{ background: "#f2a03d" }} />Tabellenplatz {gameState.teams.find((t) => t.teamId === teamId)?.shortCode ?? ""}</span>
            <span><i style={{ background: "#f0c35a" }} />Erwartungsrang {erwText}</span>
            <span><i style={{ background: "#62d394" }} />Abschlag im Plus</span>
            <span><i style={{ background: "#ff6058" }} />Abschlag im Minus</span>
            <span><i style={{ background: "rgba(154,167,186,.4)" }} />offen: Spieltag {Math.min(n, u.gebuchteSpieltage + 1)} bis {n}</span>
          </div>
        </div>
        <div className="so-fuss">
          <span>
            Abschläge bisher <b className={`bc-t ${tonVon(abschlaege)}`}>{vorzeichenDe(abschlaege, 2)} C</b>. Am Saisonende folgt der Schlussausgleich auf den Endrang. Die Summe über alle {u.liga_vergleich.length || 16} Teams der Liga ist immer 0.
          </span>
        </div>
      </section>

      <div className="so-spalte">
        <section className="so-pan">
          <div className="so-pk">
            <h2>Farb-Partner</h2>
            <span className="sp" />
            <span className="so-marke is-echt">Farb-Punkte echt</span>
          </div>
          <div className="so-kb">
            {SPONSOR_FARBEN.map((f) => {
              const p = u.farbPartner.find((x) => x.farbe === f) ?? null;
              return (
                <div key={f}>
                  <div className="so-z">
                    <span>
                      <FarbMarke farbe={f} aus={!p} /> <b style={{ color: "var(--bc-creme)", fontWeight: 600 }}>{SPONSOR_FARBE_LABEL[f]}</b>
                      <small>{p ? `${p.punkte} Punkte · Platz ${p.platz ?? "–"} von ${p.teilnehmer} Partnern` : "nicht unterschrieben"}</small>
                    </span>
                    <b className={`bc-t ${p ? tonVon(p.betragHeute) : "leise"}`}>{p ? `${vorzeichenDe(p.betragHeute, 1)} C` : "–"}</b>
                  </div>
                  {p ? (
                    <div className="so-z klein" style={{ borderBottom: 0, paddingTop: 0 }}>
                      <span style={{ color: "var(--bc-stumm)" }}>vorn: {p.rangliste.slice(0, 3).map((r, i) => `${i + 1}. ${gameState.teams.find((t) => t.teamId === r.teamId)?.shortCode ?? r.teamName} ${r.punkte}`).join(" · ")}</span>
                      <b />
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div className="so-hinweis">
              Je Farbe ein Topf von {zahlDe(SPONSOR_TOPF.farbTopf[u.liga] * u.faktor, 1)} C in Liga {u.liga}. Verteilt wird nur unter den Teams, die diese Farbe unterschrieben haben: 40 / 25 / 15 / 10 / 5 / 5 %. Jedes Team wählt zwei Farben.
            </div>
          </div>
        </section>
        <section className="so-pan">
          <div className="so-pk">
            <h2>Sponsorentermine</h2>
            <span className="sp" />
            <span className="hin">Entscheidung statt Würfel</span>
          </div>
          <div className="so-kb">
            {offeneTermine.map((t) => (
              <TerminKarte key={t.id} termin={t} sponsor={v.markeName} spieler={nameVon(t.spielerId)} kannVerwalten={kannVerwalten && Boolean(onTerminAntwort)} busy={terminBeschaeftigt === t.id} onAntwort={onTerminAntwort} />
            ))}
            {alteTermine.map((t) => (
              <Zeile key={t.id} label={`Nach Spieltag ${t.nachSpieltag}`} hinweis={t.status === "zugesagt" ? `zugesagt · ${nameVon(t.spielerId)} Form −1` : t.entschiedenVon ? "abgesagt" : "verfallen"} wert={t.status === "zugesagt" ? `${vorzeichenDe(t.betrag, 1)} C` : "–"} ton={t.status === "zugesagt" ? "plus" : "leise"} klein />
            ))}
            {u.termine.length === 0 ? <p className="leise" style={{ margin: 0 }}>Noch kein Termin in dieser Saison. Es kommen höchstens {SPONSOR_TOPF.terminMax}.</p> : null}
            <div className="so-hinweis">
              Zusagen bringt {zahlDe(SPONSOR_TOPF.terminBetrag, 1)} C, kostet aber einem Spieler deiner Wahl eine Form-Stufe am nächsten Spieltag. Höchstens zwei Termine je Saison.
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function TerminKarte({
  termin,
  sponsor,
  spieler,
  kannVerwalten,
  busy,
  onAntwort,
}: {
  termin: SponsorTermin;
  sponsor: string;
  spieler: string;
  kannVerwalten: boolean;
  busy: boolean;
  onAntwort?: SponsorenModernProps["onTerminAntwort"];
}) {
  return (
    <div className="so-termin" data-testid="sponsor-termin">
      <div className="so-z">
        <span>
          Sponsorentermin nach Spieltag {termin.nachSpieltag}
        </span>
        <b className="bc-t plus">{vorzeichenDe(termin.betrag, 1)} C</b>
      </div>
      <div className="so-hinweis">
        <b>{sponsor}</b> lädt zum Werksbesuch. Sagst du zu, fehlt <b>{spieler}</b> am nächsten Spieltag eine Form-Stufe.
      </div>
      <div className="knoepfe">
        <button type="button" className="so-btn is-ja is-klein" disabled={!kannVerwalten || busy} onClick={() => void onAntwort?.(termin.id, "zusagen")}>
          Zusagen
        </button>
        <button type="button" className="so-btn is-klein" disabled={!kannVerwalten || busy} onClick={() => void onAntwort?.(termin.id, "absagen")}>
          Absagen
        </button>
        <button type="button" className="so-btn is-klein" disabled={!kannVerwalten || busy} onClick={() => void onAntwort?.(termin.id, "ki")}>
          An die KI geben
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- Angebote */

function AngeboteAnsicht({
  gameState,
  teamId,
  u,
  kannVerwalten,
  onUnterschreiben,
  meldung,
  beschaeftigt,
}: {
  gameState: GameState;
  teamId: string;
  u: SponsorUebersicht;
  kannVerwalten: boolean;
  onUnterschreiben: SponsorenModernProps["onUnterschreiben"];
  meldung: string | null;
  beschaeftigt: string | null;
}) {
  const angebote = u.angebote;
  const roh = useMemo(() => getTeamSponsorOffers(gameState, teamId), [gameState, teamId]);
  const raenge = useMemo(() => farbStaerkeRang(gameState)[teamId], [gameState, teamId]);
  const kiFarben = useMemo(() => kiFarbenFuerTeam(gameState, teamId), [gameState, teamId]);
  const mittel = useMemo(() => werbegeldMittel(gameState), [gameState]);
  const beliebtheit = useMemo(() => kaderBeliebtheit(gameState, teamId), [gameState, teamId]);
  const gate = useMemo(() => evaluateGamePhaseAction(gameState, "sponsor_choice"), [gameState]);
  const eigen = u.liga_vergleich.find((t) => t.teamId === teamId) ?? null;
  const erwartung = eigen?.erwartungsrang ?? 8.5;
  const ligaGroesse = u.liga_vergleich.length || 16;
  const [offerId, setOfferId] = useState<string | null>(null);
  const [art, setArt] = useState<SponsorVertragsart>("leistung");
  const [laufzeit, setLaufzeit] = useState<1 | 2 | 3>(2);
  const [farben, setFarben] = useState<SponsorFarbe[] | null>(null);
  const aktiv = angebote.find((a) => a.offerId === offerId) ?? angebote[0] ?? null;
  const gewaehlteFarben = farben ?? kiFarben;
  const farbMittel = (4 * (u.liga === 1 ? u.rechnung.farbToepfe.liga1 : u.rechnung.farbToepfe.liga2)) / Math.max(1, ligaGroesse);
  const kannUnterschreiben = kannVerwalten && gate.allowed && !beschaeftigt;

  const wechsleFarbe = (f: SponsorFarbe) =>
    setFarben((alt) => {
      const aktuell = alt ?? kiFarben;
      if (aktuell.includes(f)) return aktuell.length > 1 ? aktuell.filter((x) => x !== f) : aktuell;
      return [...aktuell, f].slice(-2);
    });

  if (u.vertrag || angebote.length === 0) {
    return (
      <section className="so-pan">
        <div className="so-leer">
          <h3>{u.vertrag ? "Dein Vertrag läuft" : "Keine Angebote"}</h3>
          <p>
            {u.vertrag
              ? `${u.vertrag.markeName} läuft noch ${u.vertrag.restSaisons} ${u.vertrag.restSaisons === 1 ? "Saison" : "Saisons"}. Neue Angebote kommen zum Saisonwechsel, mit der Passung aus Beliebtheit und Treue.`
              : "Für diese Saison liegen keine Angebote vor."}
          </p>
        </div>
      </section>
    );
  }

  const grundAktiv = aktiv?.grundbetragRichtwert ?? { saison: 0, jeSpieltag: 0, zusage: 0 };
  const artAktiv = aktiv?.arten.find((x) => x.vertragsart === art) ?? aktiv?.arten[0];
  const treueSumme = aktiv ? (aktiv.laufzeiten.find((l) => l.laufzeit === laufzeit)?.treueBonusJahr ?? []).reduce((s, x) => s + x, 0) : 0;
  const ziel = roh.find((o) => o.offerId === aktiv?.offerId)?.components.find((c) => c.kind === "special") ?? null;
  const beiErwartung = grundAktiv.saison + farbMittel;
  const beste = [...angebote].sort((a, b) => b.passung.wert - a.passung.wert)[0] ?? null;

  return (
    <>
      <section className="so-pan">
        <div className="so-pk">
          <h2>Deine Ausgangslage</h2>
          <span className="sp" />
          <span className="so-marke is-echt">Echt</span>
        </div>
        <div className="so-kb">
          <div className="so-kacheln">
            <div className="so-kachel">
              <span className="bc-gk">Erwartungsrang</span>
              <strong className="bc-t">{zahlDe(Math.round(erwartung * 10) / 10, 1).replace(/,0$/, "")}</strong>
              <small>von {ligaGroesse} · Vorstand: Kaderstärke und Vorjahr</small>
            </div>
            <div className="so-kachel">
              <span className="bc-gk">Beliebtheit</span>
              <strong className="bc-t">{zahlDe(beliebtheit, 1)}</strong>
              <small>Werbegeld des Kaders · Liga-Mittel {zahlDe(mittel[u.liga] ?? 0, 1)}</small>
            </div>
            <div className="so-kachel">
              <span className="bc-gk">Liga-Topf</span>
              <strong className="bc-t">{zahlDe(u.rechnung.topf, 0)} C</strong>
              <small>Kosten der Liga × Faktor {zahlDe(u.faktor, 2)}</small>
            </div>
            <div className="so-kachel">
              <span className="bc-gk">Vorab-Zusage</span>
              <strong className="bc-t">{zahlDe(grundAktiv.zusage, 0)} C</strong>
              <small>mindestens 90 % des Grundbetrags, vor der Kaufphase</small>
            </div>
          </div>
          <div className="so-hinweis">
            <b>Drei Vertragsarten, eine Marke.</b> Alle zahlen bei Erwartungsrang fast dasselbe. Sie unterscheiden sich darin, wie stark jeder Tabellenplatz zählt: Fest ×0,5, Leistung ×1, Prämie ×1,5.
          </div>
          <table className="so-mini" aria-label="Passung der Angebote">
            <thead>
              <tr>
                <th>Passung der Marke</th>
                <th>Passung</th>
                <th>Treue</th>
              </tr>
            </thead>
            <tbody>
              {angebote.map((a) => (
                <tr key={a.offerId}>
                  <td>{a.markeName}</td>
                  <td className="bc-t">{vorzeichenDe((a.passung.wert - 1) * 100, 0)} %</td>
                  <td className="bc-t">{a.passung.treueSaisons} S.</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="so-hinweis">
            Es gibt keine Seltenheitsstufen mehr. Die Passung (±5 %) hebt oder senkt den Grundbetrag leicht und stammt zu zwei Dritteln aus der Beliebtheit deines Kaders, zu einem Drittel aus der Treue zur Marke. Über die Liga ist sie neutral.
          </div>
        </div>
      </section>

      <div className="so-ang" role="list">
        {angebote.map((a) => {
          const istAktiv = a.offerId === aktiv?.offerId;
          const eigeneArt = istAktiv ? art : "leistung";
          const artDaten = a.arten.find((x) => x.vertragsart === eigeneArt) ?? a.arten[0]!;
          const zeilen = auszahlungsZeilen(a.grundbetragRichtwert.saison, artDaten.satzJePlatz, erwartung);
          const kurve = Array.from({ length: ligaGroesse }, (_, i) => i + 1).map((rang) => ({ rang, summe: a.grundbetragRichtwert.saison + artDaten.satzJePlatz * (erwartung - rang) }));
          return (
            <div
              key={a.offerId}
              role="listitem"
              tabIndex={0}
              className={`so-ak${istAktiv ? " an" : ""}`}
              aria-current={istAktiv}
              onClick={() => setOfferId(a.offerId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOfferId(a.offerId);
                }
              }}
            >
              <div className="kopf">
                <SponsorWappenBild quelle={{ sponsorParentBrandId: a.sponsorParentBrandId, name: a.markeName }} name={a.markeName} />
                <div style={{ minWidth: 0 }}>
                  <h3>{a.markeName}</h3>
                  <div className="art">{artDaten.label}</div>
                </div>
              </div>
              <p>{ART_TEXT[artDaten.vertragsart]}</p>
              <div className="so-chips" role="group" aria-label={`Vertragsart ${a.markeName}`}>
                {a.arten.map((x) => (
                  <button
                    key={x.vertragsart}
                    type="button"
                    className="so-chip"
                    aria-pressed={istAktiv && art === x.vertragsart}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOfferId(a.offerId);
                      setArt(x.vertragsart);
                    }}
                  >
                    {x.label.replace("vertrag", "")}
                  </button>
                ))}
              </div>
              <div className="so-zl">
                <Zeile label="Grundbetrag je Saison" wert={`${zahlDe(a.grundbetragRichtwert.saison, 1)} C`} spieltag={`${zahlDe(a.grundbetragRichtwert.jeSpieltag, 2)} C je Spieltag`} />
                <Zeile label="je Platz über oder unter Erwartung" wert={`±${zahlDe(artDaten.satzJePlatz, 2)} C`} klein />
                <Zeile label="Zieleinsatz" wert={artDaten.zielEinsatz > 0 ? `±${zahlDe(artDaten.zielEinsatz, 0)} C` : "–"} klein />
              </div>
              <table className="so-mini" aria-label={`Auszahlung ${a.markeName}`}>
                <thead>
                  <tr>
                    <th>Endrang</th>
                    <th>Leistung</th>
                    <th>Hauptsponsor</th>
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((s) => (
                    <tr key={s.rang} className={s.erwartung ? "erw" : undefined}>
                      <td>{s.erwartung ? `Platz ${s.rang} · Erwartung` : `Platz ${s.rang}`}</td>
                      <td className={`bc-t ${tonVon(s.leistung)}`}>{vorzeichenDe(s.leistung, 1)}</td>
                      <td className="bc-t">{zahlDe(s.summe, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <AuszahlungsKurve punkte={kurve} erwartungsrang={erwartung} ligaGroesse={ligaGroesse} />
              <p style={{ color: "var(--bc-creme)" }}>{a.passung.text}</p>
            </div>
          );
        })}
      </div>

      <section className="so-pan">
        <div className="so-pk">
          <h2>Verhandlung</h2>
          <span className="sp" />
          <span className="hin">{aktiv?.markeName}</span>
        </div>
        <div className="so-kb">
          <div className="so-kopfzeile">Laufzeit</div>
          <div className="so-chips" role="group" aria-label="Laufzeit">
            {([1, 2, 3] as const).map((l) => (
              <button key={l} type="button" className="so-chip" aria-pressed={laufzeit === l} onClick={() => setLaufzeit(l)}>
                {l} {l === 1 ? "Saison" : "Saisons"}
              </button>
            ))}
          </div>
          <p className="leise" style={{ margin: 0, fontSize: "0.9em" }}>
            Vertragsart und Marke sind für die Laufzeit fest. Treuebonus +1 C im zweiten, +2 C im dritten Jahr. Der Erwartungsrang wird jede Saison neu gesetzt.
          </p>
          <div className="so-kopfzeile">Farb-Partner: zwei aus vier</div>
          <div className="so-chips" role="group" aria-label="Farb-Partner">
            {SPONSOR_FARBEN.map((f) => (
              <button key={f} type="button" className={`so-chip f ${f}`} aria-pressed={gewaehlteFarben.includes(f)} onClick={() => wechsleFarbe(f)}>
                {f.toUpperCase()} · Liga-Rang {raenge?.[f] ?? "–"}
              </button>
            ))}
          </div>
          <p className="leise" style={{ margin: 0, fontSize: "0.9em" }}>
            Liga-Rang nach Farb-Punkten dieser Saison <span className="so-marke is-echt">Echt</span> Geld gibt es nur in den zwei unterschriebenen Farben, verteilt nach Farb-Punkten unter allen Teams mit dieser Farbe.
          </p>
          <div className="so-kopfzeile">Ziel gegen die eigene Ausgangslage</div>
          <p style={{ margin: 0, fontSize: "0.95em", color: "var(--bc-creme)" }}>
            {artAktiv && artAktiv.zielEinsatz > 0
              ? ziel
                ? `${ziel.label}. Einsatz ±${zahlDe(artAktiv.zielEinsatz, 0)} C: Auszahlung = Einsatz × (2 × Erfüllung − 1), im Mittel 0.`
                : "Dieses Angebot trägt kein Ziel. Der Einsatz entfällt, der Grundbetrag bleibt."
              : "Der Festvertrag trägt kein Ziel."}
          </p>
          <div style={{ flex: 1 }} />
          {meldung ? <div className="so-fehler" role="status">{meldungText(meldung)}</div> : null}
          {!gate.allowed ? <div className="so-fehler" role="status">{formatGameFlowBlocker(gate.reason ?? "phase_blocked")}</div> : null}
          <div className="so-zl">
            <Zeile label="Grundbetrag" wert={`${zahlDe(grundAktiv.saison, 1)} C`} spieltag={`${zahlDe(grundAktiv.jeSpieltag, 2)} C je Spieltag`} />
            <Zeile label="Farb-Partner" hinweis="im Mittel" wert={`${vorzeichenDe(farbMittel, 1)} C`} ton="plus" />
            <Zeile label="Treuebonus über die Laufzeit" wert={`${vorzeichenDe(treueSumme, 0)} C`} />
            <div className="so-z sum">
              <span>Bei Erwartungsrang, Richtwert</span>
              <b className="bc-t">{zahlDe(beiErwartung, 1)} C</b>
            </div>
          </div>
        </div>
        <div className="so-fuss">
          <button
            type="button"
            className="so-btn"
            disabled={!kannUnterschreiben || !beste}
            title="Die KI wählt die Marke mit der besten Passung und füllt Vertragsart, Laufzeit und Farben"
            onClick={() => beste && void onUnterschreiben(beste.offerId)}
          >
            KI wählen lassen
          </button>
          <span className="sp" />
          <button
            type="button"
            className="so-btn is-ja"
            disabled={!kannUnterschreiben || !aktiv}
            onClick={() => aktiv && void onUnterschreiben(aktiv.offerId, { vertragsart: art, laufzeit, farben: gewaehlteFarben })}
          >
            {beschaeftigt && beschaeftigt === aktiv?.offerId ? "Wird unterschrieben …" : "Unterschreiben"}
          </button>
        </div>
      </section>
    </>
  );
}
