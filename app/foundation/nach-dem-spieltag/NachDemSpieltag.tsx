"use client";

/**
 * NACH DEM SPIELTAG (18.11.), eigene Ansicht nach dem Mockup public/mockups/form-moral-modern-17-11.html
 * (Ansicht 4) und docs/design/nach-dem-spieltag-abgleich-18-11.md. Ersetzt die in das Spieltagsergebnis
 * eingehaengte Liste: Kopf mit dem Ergebnis je Disziplin, Tafel Form-Meldungen, Tafel Moral, Kaesten
 * "heiss" und "kalt", "Was jetzt zu tun ist" und die grosse Bauchbinde.
 *
 * Alle Zahlen kommen aus `lib/lineups/nach-dem-spieltag.ts` (gespeicherte Werte, keine zweite Rechnung).
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { getDisciplineIconSrc } from "@/app/foundation/DisciplineIcon";
import type { FoundationMatchdayResultShellHostProps } from "@/app/foundation/matchday-result-v2/FoundationMatchdayResultShellHost";
import { BcFormPfeil, BcHero, BcIcon, BcMoralGesicht, BcPanel } from "@/components/foundation/broadcast";
import { getPlayerPortraitInitials, getPlayerPortraitMediaModel, getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import { setFoundationView } from "@/lib/foundation/foundation-navigation";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import {
  baueNachDemSpieltag,
  nameListe,
  type FormZeile,
  type NachDemSpieltag as NachDemSpieltagDaten,
  type SpieltagsDisziplin,
} from "@/lib/lineups/nach-dem-spieltag";
import "./nach-dem-spieltag.css";

/** Ganze Zahl mit Vorzeichen; was auf 0 rundet, ist ±0 und neutral (kein "−0"). */
const vz = (x: number) => {
  const r = Math.round(x);
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${Math.abs(r)}`;
};
const ton = (x: number) => (Math.round(x) > 0 ? "bc-plus" : Math.round(x) < 0 ? "bc-minus" : "bc-null");

function Por({ url, name, klasse }: { url?: string | null; name: string; klasse: string }) {
  const [fehler, setFehler] = useState(false);
  return (
    <span className={klasse} aria-hidden="true">
      {getPlayerPortraitInitials(name)}
      {url && !fehler ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFehler(true)} />
      ) : null}
    </span>
  );
}

/** Grund-Satz mit den Zahlen in Creme und der Erschoepfung in Bernstein (Mockup: `.gr b`). */
function WarumText({ text }: { text: string }) {
  const teile: ReactNode[] = [];
  const re = /((?:Leistung |erwartete )\d+)|(Die Erschöpfung bremst zusätzlich \([^)]*\)\.?)/g;
  let letzte = 0;
  let treffer: RegExpExecArray | null;
  let i = 0;
  while ((treffer = re.exec(text)) !== null) {
    if (treffer.index > letzte) teile.push(text.slice(letzte, treffer.index));
    if (treffer[1]) {
      const [, wort, zahl] = /^(\D+)(\d+)$/.exec(treffer[1]) ?? [];
      teile.push(<span key={i++}>{wort}<b>{zahl}</b></span>);
    } else teile.push(<b key={i++} className="nds-acht">{treffer[2]}</b>);
    letzte = treffer.index + treffer[0].length;
  }
  if (letzte < text.length) teile.push(text.slice(letzte));
  return <>{teile}</>;
}

function DisziplinReiter({ d, aktiv }: { d: SpieltagsDisziplin; aktiv: boolean }) {
  const ikon = getDisciplineIconSrc(d.disciplineId, d.name);
  const gut = d.ausgang === "sieg";
  const schlecht = d.ausgang === "niederlage";
  return (
    <div className={`nds-dtab${aktiv ? " is-an" : ""}`} data-testid={`nds-disziplin-${d.side}`} data-ausgang={d.ausgang ?? ""}>
      <span className="nds-dtab__ic">
        {ikon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ikon} alt="" />
        ) : (
          d.name.slice(0, 2)
        )}
      </span>
      <span className="nds-dtab__tx">
        <em>{d.side.toUpperCase()}{d.gegnerName ? ` · gegen ${d.gegnerName}` : d.art === "pod" ? " · vier Teams" : ""}</em>
        <b>{d.name}</b>
      </span>
      <span className="nds-dtab__erg bc-t">
        <strong className={gut ? "bc-plus" : schlecht ? "bc-minus" : undefined}>{d.wort}</strong>
        <span>{d.detail}</span>
      </span>
    </div>
  );
}

function Bauchbinde({ liste, spieltag, portrait }: { liste: FormZeile[]; spieltag: number | null; portrait: (id: string) => string | null }) {
  const [index, setIndex] = useState(0);
  if (liste.length === 0) return null;
  const m = liste[((index % liste.length) + liste.length) % liste.length];
  const auf = m.delta >= 0;
  return (
    <div className="nds-einbl" role="status" data-testid="nds-bauchbinde" style={{ "--ef": auf ? "var(--bc-gut)" : "var(--bc-warn)" } as CSSProperties}>
      <Por klasse="nds-einbl__por" url={portrait(m.playerId)} name={m.name} />
      <div className="nds-einbl__tx">
        <em>{m.kopf}{spieltag != null ? ` · Spieltag ${spieltag}` : ""}</em>
        <b>{m.titel}</b>
        <p><WarumText text={m.grund} /></p>
      </div>
      <div className="nds-einbl__re">
        <span className="nds-einbl__pf">
          <BcFormPfeil stufe={m.stufeVorher} /><span className="nds-pfeil">→</span><BcFormPfeil stufe={m.stufeNachher} />
          <span className={`bc-t ${ton(m.delta)}`}>{vz(m.delta)}</span>
        </span>
        {liste.length > 1 ? (
          <span className="nds-einbl__nv bc-t">
            <button type="button" onClick={() => setIndex((i) => i - 1)} aria-label="Vorige Meldung"><BcIcon name="links" /></button>
            {(((index % liste.length) + liste.length) % liste.length) + 1} von {liste.length}
            <button type="button" onClick={() => setIndex((i) => i + 1)} aria-label="Nächste Meldung"><BcIcon name="rechts" /></button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function NachDemSpieltag(props: FoundationMatchdayResultShellHostProps) {
  const { gameState, activeManagerTeamId, matchdaySummary, matchdaySummaryOptions, activeMatchdaySummaryId, activeTeamMatchdaySummaryRow, selectedTeam, setSelectedMatchdaySummaryId, setActiveView } = props;
  const teamId = activeManagerTeamId;
  const daten: NachDemSpieltagDaten | null = useMemo(
    () => (teamId && matchdaySummary.hasResult ? baueNachDemSpieltag(gameState, teamId, matchdaySummary.matchdayId) : null),
    [gameState, teamId, matchdaySummary.hasResult, matchdaySummary.matchdayId],
  );
  const spieler = useMemo(() => new Map((gameState?.players ?? []).map((p) => [p.id, p])), [gameState?.players]);
  const portrait = (id: string) => {
    const p = spieler.get(id);
    return p ? getPlayerPortraitMediaModel(p).thumbSrc ?? getPlayerPortraitMediaModel(p).src : null;
  };
  const teamName = selectedTeam?.name ?? activeTeamMatchdaySummaryRow?.teamName ?? "Dein Team";
  const wappen = teamId ? getStaticTeamLogoUrl(teamId) ?? selectedTeam?.logoPath ?? null : null;
  const spieltag = matchdaySummary.matchdayNumber;
  const bewegt = (daten?.form ?? []).filter((z) => z.richtung !== "gleich");
  const bauchbinde = (bewegt.length > 0 ? bewegt : daten?.form ?? []).slice(0, 5);
  const topId = bauchbinde[0]?.playerId ?? null;
  const erste = daten?.disziplinen[0] ?? null;
  const zeile = activeTeamMatchdaySummaryRow;

  return (
    <div className="bc nds" id="foundation-nach-dem-spieltag" data-testid="nach-dem-spieltag">
      <BcHero
        className="nds-hero"
        kulisseUrl={einsatzlisteKulisseBild(erste?.disciplineId ?? matchdaySummary.d1.disciplineId)}
        wappen={wappen}
        wappenAlt={teamName}
        dachzeile={<>Spieltag {spieltag ?? "–"}{matchdaySummary.completion === "partial" ? " · läuft" : matchdaySummary.hasResult ? " · abgeschlossen" : ""}</>}
        titel="Nach dem Spieltag"
        untertitel={<><b>{teamName}</b> · was der Spieltag mit Form und Moral gemacht hat</>}
        mitte={daten?.disziplinen.map((d, i) => <DisziplinReiter key={d.side} d={d} aktiv={i === 0} />)}
        rechts={
          <>
            {zeile?.matchdayRank != null ? (
              <span className="nds-tag bc-t" title="Rang unter allen Teams an diesem Spieltag">
                <small>Tagesrang</small>
                <strong>#{zeile.matchdayRank}</strong>
                {zeile.matchdayPoints != null ? <span>{new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(zeile.matchdayPoints)} Pkt.</span> : null}
              </span>
            ) : null}
            {matchdaySummaryOptions.length > 1 ? (
              <label className="nds-wahl">
                <span>Spieltag</span>
                <select value={activeMatchdaySummaryId} onChange={(e) => setSelectedMatchdaySummaryId(e.target.value)}>
                  {matchdaySummaryOptions.map((o) => (
                    <option key={o.matchdayId} value={o.matchdayId}>Spieltag {o.matchdayNumber ?? "–"}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="button" className="bc-btn" onClick={() => setFoundationView("matchdayResult", setActiveView)}>
              Spieltagsergebnis
            </button>
          </>
        }
      />

      {!daten || daten.form.length === 0 ? (
        <div className="nds-leer" data-testid="nds-leer">
          <BcIcon name="info" />
          <p>
            {matchdaySummary.hasResult
              ? "Für diesen Spieltag liegen keine Form-Meldungen vor. Das passiert bei älteren Spielständen oder wenn Form und Moral abgeschaltet sind."
              : "Dieser Spieltag ist noch nicht gewertet. Die Meldungen erscheinen, sobald das Ergebnis gebucht ist."}
          </p>
        </div>
      ) : (
        <div className="nds-work">
          <BcPanel
            className="nds-pan"
            titel="Form-Meldungen"
            aktionen={<span className="nds-hin">vorher → nachher · größte Bewegung zuerst</span>}
            bodyClassName="nds-koerper"
            data-testid="nds-form"
          >
            <div className="nds-mh" aria-hidden="true">
              <span /><span>Spieler</span><span>Form</span><span className="bc-r">Wert</span><span>Warum</span>
            </div>
            <div className="nds-liste">
              {daten.form.map((z) => (
                <div key={z.playerId} className={`nds-mz${z.playerId === topId ? " is-an" : ""}`} data-testid="nds-form-zeile">
                  <Por klasse="nds-por" url={portrait(z.playerId)} name={z.name} />
                  <span className="nds-nm"><b>{z.name}</b><span>{z.kurz}</span></span>
                  <span className="nds-ww">
                    <BcFormPfeil stufe={z.stufeVorher} /><span className="nds-pfeil">→</span><BcFormPfeil stufe={z.stufeNachher} />
                  </span>
                  <span className={`nds-dz bc-t ${ton(z.delta)}`}>{vz(z.delta)}</span>
                  <span className="nds-gr"><WarumText text={z.grund} /></span>
                </div>
              ))}
            </div>
          </BcPanel>

          <BcPanel
            className="nds-pan"
            titel="Moral"
            aktionen={<span className="nds-hin">stärkster Grund · aktueller Stand</span>}
            bodyClassName="nds-koerper nds-rechts"
            data-testid="nds-moral"
          >
            {daten.moral.length > 0 ? (
              <div className="nds-moral">
                {daten.moral.map((z) => (
                  <div key={z.playerId} className="nds-ur" data-testid="nds-moral-zeile">
                    <Por klasse="nds-por nds-por--s" url={portrait(z.playerId)} name={z.name} />
                    <span className="nds-ul">{z.name}<span> · {z.grund}</span></span>
                    <BcMoralGesicht wert={z.moral} groesse={20} />
                    <b className={`bc-t ${ton(z.delta ?? 0)}`}>{vz(z.delta ?? 0)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="nds-still">Bei der Moral steht nichts an, das sich bewegt.</p>
            )}
            <div className="nds-hinweis" data-testid="nds-hinweis">
              <BcIcon name="info" />
              <span>
                <b>Was jetzt zu tun ist:</b>{" "}
                {daten.hinweise.length > 0 ? daten.hinweise.map((h) => h.text).join(" ") : "Nichts Auffälliges: keiner ist erschöpft, verletzt oder auffällig kalt."}
              </span>
            </div>
            <div className="nds-erg">
              <div className="nds-rk" style={{ "--pc": "var(--bc-gut)" } as CSSProperties} data-testid="nds-heiss">
                <span className="bc-gk">Heiß in Spieltag {spieltag != null ? spieltag + 1 : "–"}</span>
                <h3>{daten.heiss.length > 0 ? nameListe(daten.heiss.map((h) => h.name)) : "Niemand"}</h3>
                <p>
                  {daten.heiss.length > 0
                    ? <>Form <b>{daten.heiss.map((h) => Math.round(h.form)).join(" / ")}</b>: der Formbonus geht mit in den nächsten Spieltag. Wer heiß ist, muss <b>über Erwartung</b> bleiben, sonst kühlt die Form ab.</>
                    : "Keiner steht auf „gut drauf“ oder „heiß“."}
                </p>
              </div>
              <div className="nds-rk" style={{ "--pc": "var(--bc-warn)" } as CSSProperties} data-testid="nds-kalt">
                <span className="bc-gk">Kalt</span>
                <h3>{daten.kalt.length > 0 ? nameListe(daten.kalt.map((h) => h.name)) : "Niemand"}</h3>
                <p>
                  {daten.kalt.length > 0
                    ? <>Form <b>{daten.kalt.map((h) => Math.round(h.form)).join(" / ")}</b>: ein Einsatz <b>über Erwartung</b> bringt sie zurück, kein Einsatz zieht sie langsam zur Mitte.</>
                    : "Keiner steht auf „kalt“ oder „eiskalt“."}
                </p>
              </div>
            </div>
          </BcPanel>
        </div>
      )}

      <Bauchbinde key={activeMatchdaySummaryId} liste={bauchbinde} spieltag={spieltag} portrait={portrait} />
    </div>
  );
}
