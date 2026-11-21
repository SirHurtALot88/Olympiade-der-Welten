"use client";

/**
 * Office, Reiter „Gespraech" (Mockup public/mockups/office-vorstand-21-11.html, Ansicht „gespraech").
 * Drei Schritte: Bitte, Zusagen, Antwort. Links der Vorstand (Charakter, was ihm wichtig ist, wann man sprechen kann, was nie zur
 * Debatte steht), in der Mitte der Verlauf als Wechselrede, rechts die Folgen als vorher und nachher. Die Antwort ist fest, ohne
 * Wuerfel (`lib/finance/vorstand-gespraech.ts`); die Einschaetzung steht vor dem Antrag da und kostet kein Gespraech.
 */

import { useMemo, useState } from "react";

import { BcIcon, BcPanel } from "@/components/foundation/broadcast";
import type { GameState, VorstandBitteArt, VorstandZusageArt } from "@/lib/data/olyDataTypes";
import type { OfficeModell } from "@/lib/finance/office-modell";
import type { VorstandAktionFn } from "@/lib/finance/vorstand-aktion-typen";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import {
  beurteileGespraech,
  BITTE_TEXT,
  CHARAKTER_TEXT,
  stelleGespraechAntrag,
  ZUSAGE_TEXT,
  ZUSAGE_WERT,
  type GespraechAntrag,
  type GespraechCharakter,
} from "@/lib/finance/vorstand-gespraech";
import { GESPRAECHE_JE_SAISON } from "@/lib/finance/vorstand-gespraech-zustand";
import { C, prozent, zahl } from "./office-format";

const BITTEN: VorstandBitteArt[] = ["stufe", "sonder", "anzapf", "alles", "ziel", "liebling"];
const ZUSAGEN: VorstandZusageArt[] = ["zielhoch", "deckel", "vertrauen", "binden"];
const CHARAKTERE: GespraechCharakter[] = ["antreiber", "kaufmann", "kassenwart"];
const CHARAKTER_KURZ: Record<GespraechCharakter, [string, string]> = {
  antreiber: ["unter 3,5", "will höhere Ziele"],
  kaufmann: ["3,5 bis 7", "wägt alles ähnlich"],
  kassenwart: ["ab 7", "will einen Gehaltsdeckel"],
};
const BITTE_SATZ: Record<VorstandBitteArt, string> = {
  stufe: "Ich möchte eine Stufe mehr Freigabe für diese Saison.",
  sonder: "Ich brauche mehr Gehaltsbudget für diese Saison.",
  anzapf: "Ich möchte einen Teil der Notrücklage nutzen.",
  alles: "Wir setzen alles auf eine Karte.",
  ziel: "Ich möchte eines der Saisonziele tauschen.",
  liebling: "Ich möchte den Lieblingsspieler verkaufen dürfen.",
};

type Phase = "bitte" | "zusagen" | "antwort";

function standardBetrag(m: OfficeModell, bitte: VorstandBitteArt): number | undefined {
  if (bitte === "sonder") return Math.max(0.5, Math.min(1, Math.floor(m.stand.gehalt.gesperrt * 2) / 2));
  if (bitte === "anzapf") return Math.max(0.5, Math.floor((m.stand.ruecklageAnzapfen.moeglich / 2) * 2) / 2);
  return undefined;
}

export function OfficeGespraechTab({
  m,
  gameState,
  onAktion,
  kannSchreiben,
  startBitte,
}: {
  m: OfficeModell;
  gameState: GameState;
  onAktion?: VorstandAktionFn;
  kannSchreiben: boolean;
  /** Ein Sprung aus der Budget-Spalte waehlt die Bitte gleich vor (der Reiter wird dafuer neu eingehaengt). */
  startBitte: VorstandBitteArt | null;
}) {
  const g = m.gespraech;
  const offen = g.offen;
  const vorgewaehlt = !offen ? startBitte : null;
  const [phase, setPhase] = useState<Phase>(offen ? "antwort" : vorgewaehlt ? "zusagen" : "bitte");
  const [bitte, setBitte] = useState<VorstandBitteArt | null>(vorgewaehlt);
  const [betrag, setBetrag] = useState<number | undefined>(vorgewaehlt ? standardBetrag(m, vorgewaehlt) : undefined);
  const [zielId, setZielId] = useState<string | undefined>(vorgewaehlt ? m.ziele.find((z) => z.tauschbar)?.id : undefined);
  const [zusagen, setZusagen] = useState<VorstandZusageArt[]>([]);
  const [bitteBusy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "acht"; text: string } | null>(null);

  const antrag = useMemo<GespraechAntrag | null>(() => (bitte ? { bitte, betrag, zielId, zusagen } : null), [bitte, betrag, zielId, zusagen]);
  const e = useMemo(() => (antrag ? beurteileGespraech(gameState, m.teamId, antrag) : null), [gameState, m.teamId, antrag]);
  const bittenSperre = useMemo(
    () =>
      Object.fromEntries(
        BITTEN.map((b) => [
          b,
          beurteileGespraech(gameState, m.teamId, {
            bitte: b,
            betrag: standardBetrag(m, b),
            zielId: m.ziele.find((z) => z.tauschbar)?.id,
            zusagen: [],
          }).sperre,
        ]),
      ) as Record<VorstandBitteArt, string | null>,
    [gameState, m],
  );
  // Folgen: so stuende es nach der Zustimmung (bei einem Gegenangebot mit den Zusagen, die der Vorstand dazu will).
  const nachher = useMemo(() => {
    const quelle = offen ? { bitte: offen.bitte, betrag: offen.betrag, zielId: offen.zielId, zusagen: [...offen.zusagen, ...offen.vorschlag] } : antrag && e && !e.sperre && e.urteil !== "ablehnung" ? { ...antrag, zusagen: [...antrag.zusagen, ...e.vorschlag] } : null;
    if (!quelle) return null;
    const r = stelleGespraechAntrag(offen ? { ...gameState, seasonState: { ...gameState.seasonState, vorstandGespraeche: { ...(gameState.seasonState.vorstandGespraeche ?? {}), [m.teamId]: { ...g, offen: null, genutzt: Math.max(0, g.genutzt - 1) } } } } : gameState, m.teamId, quelle);
    return r.ausgang === "zustimmung" ? berechneVorstandBudgetStand(r.gameState, m.teamId) : null;
  }, [gameState, m.teamId, offen, antrag, e, g]);

  const s = m.stand;
  const gespraecheFrei = Math.max(0, GESPRAECHE_JE_SAISON - g.genutzt);
  const cs = CHARAKTER_TEXT[m.charakter];
  const darf = kannSchreiben && Boolean(onAktion) && !bitteBusy;

  async function sende(input: Parameters<VorstandAktionFn>[0]) {
    if (!onAktion) return;
    setBusy(true);
    try {
      const r = await onAktion(input);
      setMeldung({ ton: r.ok ? "gut" : "acht", text: r.meldung });
      if (r.ok) setPhase("antwort");
    } finally {
      setBusy(false);
    }
  }

  const waehleBitte = (b: VorstandBitteArt) => {
    setBitte(b);
    setBetrag(standardBetrag(m, b));
    setZielId(m.ziele.find((z) => z.tauschbar)?.id);
    setZusagen([]);
    setMeldung(null);
    setPhase("zusagen");
  };
  const neuBeginnen = () => {
    setBitte(null);
    setZusagen([]);
    setMeldung(null);
    setPhase("bitte");
  };
  const toggleZusage = (a: VorstandZusageArt) => setZusagen((z) => (z.includes(a) ? z.filter((x) => x !== a) : [...z, a]));

  const verlauf = g.protokoll;
  const letzter = verlauf[verlauf.length - 1] ?? null;
  const schritte: Array<[Phase, string]> = [
    ["bitte", "Bitte"],
    ["zusagen", "Zusagen"],
    ["antwort", "Antwort"],
  ];
  const wert = (a: VorstandZusageArt) => ZUSAGE_WERT[a][m.charakter];

  const zusagenNachher: VorstandZusageArt[] = offen ? [...offen.zusagen, ...offen.vorschlag] : antrag && e && !e.sperre ? [...antrag.zusagen, ...e.vorschlag] : [];
  // Folgen-Zeilen.
  const zeilen: Array<{ l: string; k?: string; vor: string; nach: string | null; plus?: boolean }> = [
    { l: "Vertrauen", k: "wirksam bei der nächsten Festlegung", vor: m.vertrauen == null ? "—" : zahl(m.vertrauen, 1), nach: m.vertrauen == null || !nachher ? null : zahl(m.vertrauen - Math.max(0, nachher.zustand.vertrauensKosten - s.zustand.vertrauensKosten) - (zusagenNachher.includes("vertrauen") ? 0.25 : 0), 2) },
    { l: "Freigabe", vor: prozent(s.wirksamerAnteil), nach: nachher ? prozent(nachher.wirksamerAnteil) : null },
    { l: "Transfer- und Investitionstopf", k: "Ablösen und Gebäude, frei", vor: C(s.investition.frei, 1), nach: nachher ? C(nachher.investition.frei, 1) : null },
    { l: "Gehaltstopf, frei", k: `je Saison · ${C(s.gehalt.frei / Math.max(1, m.spieltageGesamt), 2)} je Spieltag`, vor: C(s.gehalt.frei, 1), nach: nachher ? C(nachher.gehalt.frei, 1) : null },
    { l: "Vorbehalt im Gehaltstopf", k: "bleibt auf dem Konto", vor: C(s.gehalt.gesperrt, 1), nach: nachher ? C(nachher.gehalt.gesperrt, 1) : null },
    { l: "Notrücklage", vor: C(s.herleitung.ruecklageZiel, 1), nach: nachher ? C(Math.max(0, nachher.herleitung.ruecklageZiel - nachher.herleitung.angezapft), 1) : null },
  ];

  return (
    <div className="off-gr off-gr--gespraech" data-testid="office-gespraech">
      {/* ------------------------------------------------------------ Gegenueber */}
      <BcPanel titel="Dein Gegenüber" aktionen={<span className="off-tag is-gold">Gespräch {Math.min(GESPRAECHE_JE_SAISON, g.genutzt + (offen ? 0 : 1))} von {GESPRAECHE_JE_SAISON}</span>} className="off-pan" bodyClassName="off-pan__k">
        <div className="off-gegenueber">
          <div>
            <h3>{cs.name}</h3>
            <small>
              Vertrauen <b className="bc-t">{m.vertrauen == null ? "—" : zahl(m.vertrauen, 1)}</b> von 10 · Freigabe <b className="bc-t">{prozent(s.wirksamerAnteil)}</b>
            </small>
          </div>
        </div>
        <p className="off-text">
          Der Vorstand antwortet <b>fest, ohne Würfel</b>. Du siehst seine Einschätzung, bevor du den Antrag stellst. Fragen kostet nie Vertrauen, aber jeder gestellte
          Antrag verbraucht eines von zwei Gesprächen.
        </p>
        <div className="off-gk">Was ihm wichtig ist</div>
        <ul className="off-liste">
          {ZUSAGEN.map((a) => (
            <li key={a}>
              <span className="off-liste__t">{ZUSAGE_TEXT[a].titel}</span>
              <b className="bc-t">{wert(a)} Punkte</b>
            </li>
          ))}
        </ul>
        <div className="off-gk">Wer dir gegenübersitzt <small>aus der Sparneigung des Teams</small></div>
        <div className="off-charaktere">
          {CHARAKTERE.map((c) => (
            <div key={c} className={c === m.charakter ? "is-an" : ""}>
              <small>{CHARAKTER_KURZ[c][0]}</small>
              <b>{CHARAKTER_TEXT[c].name.replace("Der ", "")}</b>
              <span>{CHARAKTER_KURZ[c][1]}</span>
            </div>
          ))}
        </div>
        <div className="off-gk">Wann du sprechen kannst</div>
        <ul className="off-liste off-liste--topf">
          <li><span className="off-liste__t">Transferfenster</span><b>alle Anliegen</b></li>
          <li><span className="off-liste__t">In der Saison</span><b>ohne „Alles auf eine Karte“</b></li>
          <li><span className="off-liste__t">Saison 1</span><b>nicht nötig, alles frei</b></li>
        </ul>
        <div className="off-gk">Was nie zur Debatte steht</div>
        <ul className="off-regeln">
          <li><BcIcon name="check" /><span><b>Keine Geldstrafen.</b> Ein verfehltes Ziel kostet Vertrauen, nie Geld.</span></li>
          <li><BcIcon name="check" /><span><b>Er nimmt nichts weg.</b> Gesperrtes Geld bleibt auf deinem Konto.</span></li>
          <li><BcIcon name="check" /><span><b>Gehaltstopf mindestens 75 %.</b> Auch in der Sparauflage.</span></li>
          <li><BcIcon name="check" /><span><b>Pflichtkader 8 ist nie gesperrt.</b> Für Mensch und KI gleich.</span></li>
          <li><BcIcon name="check" /><span><b>Verkaufserlöse sind zu 100 % frei.</b></span></li>
        </ul>
      </BcPanel>

      {/* ------------------------------------------------------------ Mitte */}
      <BcPanel
        titel="Gespräch mit dem Vorstand"
        kopfInhalt={<small className="off-sub">{m.imFenster ? "Transferfenster" : "Saison"}</small>}
        aktionen={bitte || offen ? <button type="button" className="off-link" onClick={neuBeginnen}>Neu beginnen</button> : null}
        className="off-pan"
        bodyClassName="off-pan__k off-mitte"
      >
        <div className="off-sitzung">
          <div>
            <small>Vorstandssitzung · Saison {m.saisonNummer}</small>
            <h3>{bitte ? BITTE_TEXT[bitte].titel : offen ? BITTE_TEXT[offen.bitte].titel : "Worum bittest du?"}</h3>
          </div>
          <ol className="off-stepper">
            {schritte.map(([p, t], i) => (
              <li key={p} className={phase === p ? "is-an" : schritte.findIndex(([q]) => q === phase) > i ? "is-fertig" : ""}>
                <span>{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>

        {!s.gedeckelt ? (
          <p className="off-leer">In Saison 1 ist alles freigegeben: es gibt nichts zu verhandeln. Ab Saison 2 sprichst du hier mit dem Vorstand.</p>
        ) : (
          <>
            <div className="off-verlauf" data-testid="office-verlauf">
              {verlauf.map((v, i) => (
                <div key={`${v.zeit}-${i}`} className="off-verlauf__paar">
                  <div className="off-blase is-du">
                    <small>Du</small>
                    {BITTE_SATZ[v.bitte]}
                    {v.zusagen.length ? ` Dafür sage ich zu: ${v.zusagen.map((a) => ZUSAGE_TEXT[a].titel).join(", ")}.` : ""}
                  </div>
                  <div className={`off-blase is-vorstand is-${v.ausgang}`}>
                    <small>{cs.name} · {v.ausgang === "zustimmung" ? "Zustimmung" : v.ausgang === "gegenangebot" ? "Gegenangebot" : v.ausgang === "ablehnung" ? "Ablehnung" : "zurückgezogen"}</small>
                    {v.text}
                  </div>
                </div>
              ))}
              {verlauf.length === 0 && phase === "bitte" ? (
                <div className="off-blase is-vorstand">
                  <small>{cs.name}</small>
                  Die Freigabe steht bei {prozent(s.wirksamerAnteil)}. Wenn du mehr brauchst, sag, wofür, und was du dafür zusagst.
                </div>
              ) : null}
              {bitte && phase !== "bitte" ? (
                <div className="off-blase is-du">
                  <small>Du</small>
                  {BITTE_SATZ[bitte]}
                </div>
              ) : null}
              {e && phase === "zusagen" ? (
                <div className={`off-blase is-vorstand is-einschaetzung is-${e.urteil}`}>
                  <small>{cs.name} · Einschätzung</small>
                  {e.sperre ? e.sperre : `Darüber können wir reden. Ich will dafür Zusagen im Wert von ${zahl(e.verlangt, 0)} Punkten sehen.`}
                </div>
              ) : null}
              {phase === "antwort" && offen ? (
                <div className="off-blase is-vorstand is-gegenangebot" data-testid="office-gegenangebot">
                  <small>{cs.name} · Gegenangebot (Runde {offen.runde} von 2)</small>
                  Es fehlen {zahl(Math.max(0, offen.verlangt - offen.gewicht), 1)} Punkte. Ich stimme zu mit: {offen.vorschlag.map((a) => ZUSAGE_TEXT[a].titel).join(", ")}.
                </div>
              ) : null}
            </div>

            {phase === "bitte" ? (
              <div className="off-bitten" data-testid="office-bitten">
                <div className="off-gk">Worum bittest du? <small>{gespraecheFrei} von {GESPRAECHE_JE_SAISON} Gesprächen frei</small></div>
                <div className="off-bitten__raster">
                  {BITTEN.map((b) => (
                    <button key={b} type="button" className="off-bitte" disabled={!darf || Boolean(bittenSperre[b])} onClick={() => waehleBitte(b)} title={bittenSperre[b] ?? undefined} data-testid={`office-bitte-${b}`}>
                      <b>{BITTE_TEXT[b].titel}</b>
                      <small>{bittenSperre[b] ?? BITTE_TEXT[b].kurz}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {phase === "zusagen" && bitte && e ? (
              <div className="off-zusagen">
                {bitte === "sonder" || bitte === "anzapf" ? (
                  <div className="off-betrag">
                    <span>{bitte === "sonder" ? "Wie viel Gehaltsbudget?" : "Wie viel Rücklage?"}</span>
                    <input
                      type="range"
                      min={0.5}
                      max={Math.max(0.5, bitte === "sonder" ? Math.floor(s.gehalt.gesperrt * 2) / 2 : Math.floor((s.ruecklageAnzapfen.moeglich + s.ruecklageAnzapfen.bereitsAngezapft) * 2) / 2)}
                      step={0.5}
                      value={betrag ?? 0.5}
                      onChange={(ev) => setBetrag(Number(ev.target.value))}
                      aria-label="Betrag"
                    />
                    <b className="bc-t">{C(betrag ?? 0.5, 1)}</b>
                  </div>
                ) : null}
                {bitte === "ziel" ? (
                  <div className="off-betrag">
                    <span>Welches Ziel?</span>
                    <select value={zielId ?? ""} onChange={(ev) => setZielId(ev.target.value)} aria-label="Ziel wählen">
                      {m.ziele.filter((z) => z.tauschbar).map((z) => (
                        <option key={z.id} value={z.id}>{z.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="off-gk">Was sagst du dafür zu? <small>frei wählbar · keine Zusage kostet Geld vom Konto</small></div>
                <div className="off-zusagenraster">
                  {ZUSAGEN.map((a) => {
                    const sperre = e.zusagenVerfuegbar[a];
                    const an = zusagen.includes(a);
                    return (
                      <button key={a} type="button" className={`off-zusage${an ? " is-an" : ""}`} aria-pressed={an} disabled={Boolean(sperre) || !darf} onClick={() => toggleZusage(a)} title={sperre ?? undefined} data-testid={`office-zusage-${a}`}>
                        <span><b>{ZUSAGE_TEXT[a].titel}</b><i className="bc-t">{wert(a)}</i></span>
                        <small>{sperre ?? ZUSAGE_TEXT[a].kurz}</small>
                      </button>
                    );
                  })}
                </div>
                <div className="off-waage">
                  <div className="off-waage__leiste" role="img" aria-label={`Gewicht ${e.gewicht} von ${e.verlangt}`}>
                    <i style={{ width: `${Math.min(100, (e.gewicht / Math.max(1, e.verlangt * 1.25)) * 100)}%` }} />
                    <u style={{ left: `${Math.min(100, (e.verlangt / Math.max(1, e.verlangt * 1.25)) * 100)}%` }} />
                  </div>
                  <div className="off-waage__fuss">
                    <span>
                      Du bietest <b className="bc-t">{zahl(e.gewicht, 1)}</b> von <b className="bc-t">{zahl(e.verlangt, 1)}</b> Punkten · Einschätzung:{" "}
                      <b className={`off-urteil is-${e.urteil}`}>{e.sperre ? "geht nicht" : e.urteil === "zustimmung" ? "er stimmt zu" : e.urteil === "gegenangebot" ? "er macht ein Gegenangebot" : "er lehnt ab"}</b>
                    </span>
                    <span className="off-waage__knoepfe">
                      <button type="button" className="off-btn" onClick={neuBeginnen}>Andere Bitte</button>
                      <button type="button" className="off-haupt is-klein" disabled={!darf || Boolean(e.sperre)} onClick={() => sende({ aktion: "gespraech_antrag", antrag: antrag! })} data-testid="office-antrag-stellen">
                        Antrag stellen
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {phase === "antwort" ? (
              <div className="off-antwort" data-testid="office-antwort">
                {offen ? (
                  <div className="off-antwort__knoepfe">
                    <button type="button" className="off-haupt is-klein" disabled={!darf} onClick={() => sende({ aktion: "gespraech_annehmen" })} data-testid="office-annehmen">Gegenangebot annehmen</button>
                    {offen.runde < 2 ? (
                      <button
                        type="button"
                        className="off-btn"
                        disabled={!darf}
                        onClick={() => {
                          setBitte(offen.bitte);
                          setBetrag(offen.betrag);
                          setZielId(offen.zielId);
                          setZusagen(offen.zusagen);
                          setPhase("zusagen");
                        }}
                      >
                        Nachbessern (Runde 2)
                      </button>
                    ) : null}
                    <button type="button" className="off-btn" disabled={!darf} onClick={() => sende({ aktion: "gespraech_zurueckziehen" })}>Zurückziehen</button>
                  </div>
                ) : (
                  <div className="off-antwort__ende">
                    {letzter ? (
                      <p className={`off-urteil is-${letzter.ausgang}`}>
                        {letzter.ausgang === "zustimmung" ? "Vereinbart. Die Folgen stehen rechts, die Zusagen im Protokoll." : letzter.ausgang === "ablehnung" ? "Abgelehnt. Das Gespräch ist verbraucht, Vertrauen hat es nicht gekostet." : "Beendet."}
                      </p>
                    ) : null}
                    <button type="button" className="off-btn" onClick={neuBeginnen} disabled={gespraecheFrei === 0}>
                      {gespraecheFrei === 0 ? "Keine Gespräche mehr in dieser Saison" : "Neues Gespräch beginnen"}
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            {meldung ? <div className={`off-meldung${meldung.ton === "gut" ? " is-gut" : ""}`}>{meldung.text}</div> : null}
          </>
        )}
      </BcPanel>

      {/* ------------------------------------------------------------ Folgen */}
      <BcPanel titel="Folgen" kopfInhalt={<small className="off-sub">wenn er zustimmt</small>} aktionen={<span className="off-tag">vorher → nachher</span>} className="off-pan" bodyClassName="off-pan__k">
        <ul className="off-folgen">
          {zeilen.map((z) => (
            <li key={z.l}>
              <span>
                <b>{z.l}</b>
                {z.k ? <small>{z.k}</small> : null}
              </span>
              <i className="bc-t">{z.vor}</i>
              <BcIcon name="rechts" />
              <strong className={`bc-t${z.nach && z.nach !== z.vor ? " is-anders" : ""}`}>{z.nach ?? z.vor}</strong>
            </li>
          ))}
        </ul>
        <div className="off-gk">Woran du dich bindest <b className="bc-t">{g.zusagen.length}</b></div>
        <ul className="off-liste">
          {g.zusagen.length === 0 ? <li className="off-leer">Noch nichts zugesagt.</li> : null}
          {g.zusagen.map((z) => (
            <li key={z.art}>
              <BcIcon name="check" />
              <span className="off-liste__t"><b>{ZUSAGE_TEXT[z.art].titel}.</b> {z.art === "zielhoch" && z.zielRang ? `Top ${z.zielRang}. ` : ""}{ZUSAGE_TEXT[z.art].kurz}</span>
            </li>
          ))}
        </ul>
        <div className="off-gk">Protokoll Saison {m.saisonNummer}</div>
        <ul className="off-liste">
          {g.protokoll.length === 0 ? <li className="off-leer">Noch kein Gespräch geführt.</li> : null}
          {g.protokoll.map((p, i) => (
            <li key={`${p.zeit}-${i}`}>
              <span className="off-liste__s">{p.ausgang === "zustimmung" ? "Ja" : p.ausgang === "gegenangebot" ? "Gegen" : p.ausgang === "ablehnung" ? "Nein" : "Zurück"}</span>
              <span className="off-liste__t">{BITTE_TEXT[p.bitte].titel}</span>
              <b className="bc-t">{`${zahl(p.gewicht, 0)}/${zahl(p.verlangt, 0)}`}</b>
            </li>
          ))}
        </ul>
        <p className="off-mehrspieler">
          <BcIcon name="team" />
          <span><b>Mehrspieler:</b> jedes Team führt seine eigenen zwei Gespräche. Ist „Käufe, Verkäufe, Verträge“ an die KI delegiert, spricht die KI nach denselben Regeln; was du selbst vereinbart hast, überschreibt sie nicht.</span>
        </p>
      </BcPanel>
    </div>
  );
}
