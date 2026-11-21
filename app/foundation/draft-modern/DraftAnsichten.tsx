"use client";

/**
 * DRAFT: Nachzug, Pick-Tafel, Ergebnis und Überspringen-Dialog (18.11.). Vorlage: public/mockups/draft-modern-18-11.html
 * (`#s-tafel`, `#s-ende`, Dialog „Überspringen“, Ansicht „Nachzug“). Nur Anzeige: alles aus `/api/draft`.
 */
import { useEscSchliesst } from "@/app/foundation/shared/klickregel";
import type { DraftKontext } from "./draft-kontext";
import { betragC, de, fertigGrundText, sitzKlasse, sitzName } from "./draft-format";

function Wappen({ url, kuerzel }: { url: string | null; kuerzel: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={kuerzel} /> : <span className="drf-leer">{kuerzel}</span>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Nachzug (links oben statt „Am Zug“)
// ---------------------------------------------------------------------------------------------------------------------

export function NachzugPanel({ k }: { k: DraftKontext }) {
  const a = k.ansicht;
  const mein = a.mein;
  const kiFertig = a.status === "nachzug";
  const picks = a.verlauf.filter((e) => e.art === "pick");
  const teuer = picks.reduce<(typeof picks)[number] | null>((m, e) => (!m || (e.abloese ?? 0) > (m.abloese ?? 0) ? e : m), null);
  const besterRest = k.zeilen.reduce((m, z) => Math.max(m, z.item.marketValue ?? 0), 0);
  const leistbar = mein ? k.zeilen.filter((z) => (z.item.marketValue ?? 0) <= mein.maxAbloese + 1e-9).length : 0;
  return (
    <section className="pan" id="l-zug" data-testid="draft-nachzug">
      <div className="pk"><h2>{kiFertig ? "Du pickst in Ruhe" : "KI pickt fertig …"}</h2><span className="sp" /><span className="tag g">keine Reihenfolge</span></div>
      {mein ? <div className="zt ich"><span className="lg"><Wappen url={k.wappen(mein.teamId)} kuerzel={k.teamKuerzel(mein.teamId)} /></span><div className="mi"><h3>{k.teamName(mein.teamId)}</h3><small>Kader {mein.kader}</small></div><div className="tp">Kasse<br /><b className="t">{betragC(mein.kasse)}</b></div></div> : null}
      <div className="wart" style={{ alignItems: "stretch", textAlign: "left", justifyContent: "flex-start", padding: "calc(.2 * var(--u)) calc(.9 * var(--u)) 0" }}>
        {kiFertig ? (
          <>
            <p style={{ maxWidth: "none" }}>
              Die KI-Teams haben im Hintergrund fertig gepickt: <b>{a.picks} Picks</b> insgesamt. Du wählst jetzt ohne Reihenfolge und ohne Zeitlimit aus den <b>{k.zeilen.length} übrigen Spielern</b>.
            </p>
            <div className="lv3">
              <div><small>teuerster Pick</small><strong className="t">{de(teuer?.abloese ?? 0)}</strong><em>{teuer?.playerId ? (k.ansicht.spieler[teuer.playerId]?.name ?? "") : ""} · {teuer ? k.teamKuerzel(teuer.teamId) : ""}</em></div>
              <div><small>bester Rest</small><strong className="t">{de(besterRest)}</strong><em>C Ablöse</em></div>
              <div><small>für dich leistbar</small><strong className="t">{leistbar}</strong><em>Spieler</em></div>
            </div>
            <p style={{ maxWidth: "none" }}>Fertig bist du ab <b>{a.regeln.minKader} Spielern</b>. Wer danach noch frei ist, bleibt als freier Spieler auf dem Transfermarkt.</p>
          </>
        ) : (
          <p style={{ maxWidth: "none" }}>Die KI-Teams picken im Hintergrund zu Ende (<b>{a.picks} Picks</b> bisher). Danach wählst du ohne Reihenfolge und ohne Zeitlimit aus dem Rest.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Pick-Tafel
// ---------------------------------------------------------------------------------------------------------------------

export function PickTafel({ k }: { k: DraftKontext }) {
  const a = k.ansicht;
  const runden = a.regeln.maxRunden;
  // Spaltenfolge: Reihenfolge der ersten Runde (Schwächste zuerst), danach die übrigen Teams.
  const ersteRunde = a.verlauf.filter((e) => e.runde === 1 && e.quelle !== "nachzug").sort((x, y) => (x.platz ?? 0) - (y.platz ?? 0)).map((e) => e.teamId);
  const spalten = [...new Set([...ersteRunde, ...a.kette.map((c) => c.teamId), ...a.teams.map((t) => t.teamId)])];
  const zelle = new Map<string, (typeof a.verlauf)[number]>();
  for (const e of a.verlauf) if (e.quelle !== "nachzug") zelle.set(`${e.runde}|${e.teamId}`, e);
  const dranId = a.amZug?.teamId;
  return (
    <section className="pan" id="t-tafel" data-testid="draft-tafel">
      <div className="pk"><h2>Pick-Tafel</h2><span className="sp" /><span className="gk">Spalten: Teams · Zeilen: Runden, jede Runde beginnt beim schwächsten Team · Zahl: Ablöse in C</span></div>
      <div className="tg" style={{ gridTemplateColumns: `calc(5.6 * var(--u)) repeat(${spalten.length}, minmax(0, 1fr))`, gridTemplateRows: `calc(3.2 * var(--u)) repeat(${runden}, minmax(0, 1fr))` }}>
        <div className="rz" />
        {spalten.map((id) => {
          const t = a.teams.find((x) => x.teamId === id);
          const sk = t?.art === "mensch" ? sitzKlasse(t.ownerId) : "";
          return <div key={id} className={`kz ${id === a.mein?.teamId ? "ich" : sk}`} title={k.teamName(id)}><Wappen url={k.wappen(id)} kuerzel={k.teamKuerzel(id)} /></div>;
        })}
        {Array.from({ length: runden }, (_, i) => i + 1).flatMap((r) => [
          <div key={`r${r}`} className={`rz${r === a.runde && a.status === "laeuft" ? " an" : ""}`}><b>Runde {r}</b></div>,
          ...spalten.map((id) => {
            const e = zelle.get(`${r}|${id}`);
            const t = a.teams.find((x) => x.teamId === id);
            const sk = t?.art === "mensch" ? (id === a.mein?.teamId ? " ich" : ` ${sitzKlasse(t.ownerId)}`) : "";
            if (e && e.art === "pick" && e.playerId) {
              const bild = k.portrait(e.playerId);
              return (
                <div key={`${r}|${id}`} className={`ze${sk}`} title={`#${e.pickNr} ${k.ansicht.spieler[e.playerId]?.name ?? ""} · ${k.teamName(id)} · ${de(e.abloese ?? 0)} C`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {bild ? <img src={bild} alt="" /> : null}
                  <u className="t">{de(e.abloese ?? 0, 0)}</u>
                </div>
              );
            }
            const vorbei = Boolean(e) || r < a.runde || a.status !== "laeuft" || t?.status === "fertig";
            const jetzt = r === a.runde && id === dranId && a.status === "laeuft";
            return <div key={`${r}|${id}`} className={`ze${sk}${jetzt ? " dran" : vorbei ? " pass" : ""}`} title={e ? (e.art === "auslassen" ? "Pick ausgelassen" : fertigGrundText(t?.fertigGrund) ?? "fertig") : t?.status === "fertig" ? fertigGrundText(t.fertigGrund) ?? "fertig" : undefined} />;
          }),
        ])}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Überspringen
// ---------------------------------------------------------------------------------------------------------------------

export function SkipDialog({ k, onZu, onWahl }: { k: DraftKontext; onZu: () => void; onWahl: (v: "A" | "B") => void }) {
  useEscSchliesst(true, onZu);
  const ki = k.ansicht.teams.filter((t) => t.art === "ki" && t.status !== "fertig").length;
  const andere = k.ansicht.teams.filter((t) => t.art === "mensch" && t.teamId !== k.ansicht.mein?.teamId);
  return (
    <div className="schleier" onClick={(e) => { if (e.target === e.currentTarget) onZu(); }} data-testid="draft-skip-dialog">
      <div className="dlg skip" role="dialog" aria-label="Draft überspringen">
        <div className="dk"><em>Draft · Runde {k.ansicht.runde}</em><h2>Draft überspringen</h2><span className="sp" /><button type="button" className="zu" onClick={onZu} aria-label="Schließen">×</button></div>
        <div className="sk2">
          <div className="sopt">
            <em>Variante A</em>
            <h3>KI fertig picken lassen, ich picke danach</h3>
            <p>Die {ki} KI-Teams picken im Hintergrund zu Ende. Du wählst danach <b>ohne Reihenfolge und ohne Zeitlimit</b> aus den übrigen Spielern.</p>
            <ul><li><i>+</i>volle Kontrolle über jeden deiner Picks</li><li><i>+</i>Kasse und Wunschliste bleiben, wie sie sind</li><li className="m"><i>−</i>die begehrtesten Spieler sind dann weg</li></ul>
            <button type="button" className="knopf haupt" onClick={() => onWahl("A")} data-testid="draft-skip-a">KI fertig picken lassen</button>
          </div>
          <div className="sopt">
            <em>Variante B</em>
            <h3>Auto-Draft: mein GM pickt für mich</h3>
            <p>Dein Team bleibt in der Reihenfolge. Dein GM pickt nach <b>Bedarf und Kasse</b> und hält die Pflichtplätze frei.</p>
            <ul><li><i>+</i>du bist sofort drin und spielbereit</li><li><i>+</i>dein Team pickt an seinem Platz, nicht aus dem Rest</li><li className="m"><i>−</i>du entscheidest nicht selbst; nachverpflichten geht danach am Markt</li></ul>
            <button type="button" className="knopf haupt" onClick={() => onWahl("B")} data-testid="draft-skip-b">Auto-Draft starten</button>
          </div>
        </div>
        <div className="skf">
          <span>{andere.length ? <><b>Mitspieler:</b> {andere.map((t) => sitzName(t.ownerId)).join(" und ")} entscheiden für sich. Wer live bleibt, pickt weiter an seinem Platz.</> : "Du bist der einzige Mensch im Draft."}</span>
          <span className="sp" />
          <button type="button" className="knopf" onClick={onZu}>Zurück zum Draft</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Abbrechen (nur Gastgeber) — Rückfrage in der Seite, kein `confirm()`
// ---------------------------------------------------------------------------------------------------------------------

export function AbbruchDialog({ k, busy, onZu, onJa }: { k: DraftKontext; busy: boolean; onZu: () => void; onJa: () => void }) {
  useEscSchliesst(true, onZu);
  const offen = k.ansicht.teams.filter((t) => t.status !== "fertig");
  const unterMin = k.ansicht.teams.filter((t) => t.status !== "fertig" && t.kader < k.ansicht.regeln.minKader).length;
  return (
    <div className="schleier" onClick={(e) => { if (e.target === e.currentTarget) onZu(); }} data-testid="draft-abbruch-dialog">
      <div className="dlg skip" role="dialog" aria-label="Draft abbrechen">
        <div className="dk"><em>Draft · Runde {k.ansicht.runde}</em><h2>Draft abbrechen?</h2><span className="sp" /><button type="button" className="zu" onClick={onZu} aria-label="Schließen">×</button></div>
        <div className="sk2">
          <div className="sopt">
            <p>
              Der Draft endet jetzt für alle. <b>{offen.length} Teams</b> sind noch nicht fertig und bleiben mit ihrem aktuellen Kader stehen
              {unterMin ? <>; <b>{unterMin}</b> davon haben noch weniger als {k.ansicht.regeln.minKader} Spieler und bekommen eine Warnung</> : null}.
              Danach geht es im Spiel weiter; fehlende Spieler holst du am Transfermarkt nach. Das lässt sich nicht zurücknehmen.
            </p>
          </div>
        </div>
        <div className="skf">
          <span />
          <span className="sp" />
          <button type="button" className="knopf" onClick={onZu} disabled={busy}>Weiter draften</button>
          <button type="button" className="knopf haupt" onClick={onJa} disabled={busy} data-testid="draft-abbruch-ja">Draft abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Nicht picken: „Pick auslassen“ und „Ich bin fertig“ mit Rückfrage (UX 19.11., E6) — kein `confirm()`
// ---------------------------------------------------------------------------------------------------------------------

export function AuslassenDialog({ k, busy, onZu, onJa }: { k: DraftKontext; busy: boolean; onZu: () => void; onJa: () => void }) {
  useEscSchliesst(true, onZu);
  const a = k.ansicht;
  return (
    <div className="schleier" onClick={(e) => { if (e.target === e.currentTarget) onZu(); }} data-testid="draft-auslassen-dialog">
      <div className="dlg skip kurz" role="dialog" aria-modal="true" aria-label="Pick auslassen">
        <div className="dk"><em>Draft · Runde {a.runde} · Pick {a.picks + 1}</em><h2>Diesen Pick auslassen?</h2><span className="sp" /><button type="button" className="zu" onClick={onZu} aria-label="Schließen">×</button></div>
        <div className="sk2 eins">
          <div className="sopt">
            <p>Du nimmst in dieser Runde <b>niemanden</b>. In <b>Runde {a.runde + 1}</b> bist du wieder an deinem Platz dran. Kasse und Wunschliste bleiben, wie sie sind. Der nächste Zug läuft sofort.</p>
          </div>
        </div>
        <div className="skf">
          <span>Geht nur, wenn du am Zug bist.</span>
          <span className="sp" />
          <button type="button" className="knopf" onClick={onZu} disabled={busy} data-testid="draft-auslassen-zurueck">Zurück</button>
          <button type="button" className="knopf haupt" onClick={onJa} disabled={busy} data-testid="draft-auslassen-ja">Ja, Pick auslassen</button>
        </div>
      </div>
    </div>
  );
}

export function FertigDialog({ k, busy, onZu, onJa }: { k: DraftKontext; busy: boolean; onZu: () => void; onJa: () => void }) {
  useEscSchliesst(true, onZu);
  const a = k.ansicht;
  const mein = a.mein;
  if (!mein) return null;
  const opt = mein.kaderOpt;
  const pflichtZeile = mein.kader >= a.regeln.minKader ? `Pflicht ${a.regeln.minKader} erfüllt` : `Pflicht ${a.regeln.minKader} · dir fehlen ${a.regeln.minKader - mein.kader}`;
  return (
    <div className="schleier" onClick={(e) => { if (e.target === e.currentTarget) onZu(); }} data-testid="draft-fertig-dialog">
      <div className="dlg skip kurz" role="dialog" aria-modal="true" aria-label="Draft für dich beenden">
        <div className="dk"><em>Draft · Runde {a.runde}</em><h2>Draft für dich beenden?</h2><span className="sp" /><button type="button" className="zu" onClick={onZu} aria-label="Schließen">×</button></div>
        <div className="sk2 eins">
          <div className="sopt">
            <p>Du gehst <b>aus der Reihenfolge</b> und pickst in diesem Draft nicht mehr. Die anderen Teams picken weiter. <b>Das lässt sich nicht zurücknehmen.</b> Nachkaufen geht danach am Transfermarkt.</p>
            <div className="fakt">
              <div><small>Kader</small><b className="t">{mein.kader}</b><span>{pflichtZeile}</span></div>
              <div><small>Wunschgröße deines GM</small><b className="t">{opt ?? "–"}</b><span>{opt == null ? "keine Angabe" : mein.kader < opt ? `dir fehlen ${opt - mein.kader}` : "erreicht"}</span></div>
              <div><small>Kasse bleibt</small><b className="t">{betragC(mein.kasse)}</b><span>für den Transfermarkt</span></div>
            </div>
          </div>
        </div>
        <div className="skf">
          <span />
          <span className="sp" />
          <button type="button" className="knopf" onClick={onZu} disabled={busy} data-testid="draft-fertig-zurueck">Weiter draften</button>
          <button type="button" className="knopf haupt" onClick={onJa} disabled={busy} data-testid="draft-fertig-ja">Ja, ich bin fertig</button>
        </div>
      </div>
    </div>
  );
}
