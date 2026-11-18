"use client";

import { useEffect, useRef } from "react";

import { BcFormPfeil, BcIcon, BcMoralGesicht } from "@/components/foundation/broadcast";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import { gehaltJeSpieltag, grobBereich, grobeRangStufe } from "@/lib/foundation/spielerprofil-modell";
import type { PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import { FigurBuehne, PpBalken, achseKlasse, geld, kategorieAchse, zahl } from "./bausteine";
import type { VertragsAktionen } from "./TabVertrag";
import { useSpielerMerken } from "./use-spieler-merken";
import { useSpielerprofilModell } from "./use-spielerprofil-modell";
import "./spielerprofil.css";

export type SpielerKurzprofilProps = {
  data: PlayerDetailDrawerData;
  onClose: () => void;
  /** „Ganzes Profil öffnen“, optional mit Reiter und Disziplin (Klick auf eine Kachel springt in den Reiter Disziplinen). */
  onOpenFull: (tab?: PlayerProfileTabId, disziplinId?: string) => void;
  aktionen: VertragsAktionen;
  ownerId?: string | null;
};

/**
 * KURZPROFIL (Drawer), Neubau 18.11. (Chris, Punkt 2: ein Kurzprofil ohne Reiter mit dem Knopf „Ganzes Profil öffnen“).
 * Beantwortet „wer ist das, kann er spielen, was kostet er“: Figur, drei Kennzahlen, Statuszeile, Form und Moral, alle 20
 * Disziplinen als Kacheln (Eignung und Rang in der Liga), PP-Balken, letzte Einsätze. Eigene Komponente, kein Teil der Seite.
 */
export default function SpielerKurzprofil({ data, onClose, onOpenFull, aktionen, ownerId }: SpielerKurzprofilProps) {
  const modell = useSpielerprofilModell(data);
  const merken = useSpielerMerken(data.playerId, ownerId);
  const huelle = useRef<HTMLDivElement | null>(null);
  useFocusTrap(true, huelle);

  useEffect(() => {
    function beiTaste(ereignis: KeyboardEvent) {
      if (ereignis.key === "Escape") {
        ereignis.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [onClose]);

  const raenge = modell.raenge;
  const nebel = modell.nebel;
  const form = modell.form;
  const moral = form?.moral ?? data.morale?.morale ?? null;
  const gesamt = raenge?.ppGesamt ?? data.seasonPerformance?.totalPoints ?? null;
  const achseVon = (id: string) => kategorieAchse(data.disciplineValues.find((zeile) => zeile.id === id)?.category);
  const nachWert = [...data.disciplineValues].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const top4 = new Set(nachWert.slice(0, 4).map((zeile) => zeile.id));
  const ordnung = ["power", "speed", "mental", "social"];
  const sortiert = [...data.disciplineValues].sort(
    (a, b) => ordnung.indexOf(a.category) - ordnung.indexOf(b.category) || (b.value ?? -1) - (a.value ?? -1),
  );
  const letzte = modell.ppReihe.slice(-2).reverse();
  const vertragslos = !data.teamId;

  return (
    <>
      <div className="spr-schleier" onClick={onClose} aria-hidden="true" data-testid="spielerkurzprofil-schleier" />
      <div
        ref={huelle}
        className="bc spr spr-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Kurzprofil ${data.name}`}
        data-testid="spielerkurzprofil"
        data-spieler={data.playerId}
      >
        <header className="spr-dr-kopf">
          <div style={{ minWidth: 0 }}>
            <h2>{data.name}</h2>
            <small>
              {data.teamName ?? "Vertragslos"} · {[data.className, data.race].filter(Boolean).join(" · ")}
            </small>
          </div>
          <button type="button" className="spr-dr-zu" onClick={onClose} aria-label="Schließen" data-testid="spielerkurzprofil-zu">
            <BcIcon name="x" />
          </button>
        </header>

        <div className="spr-dr-fig" style={{ display: "flex", flexDirection: "column" }}>
          <FigurBuehne data={data} modell={modell} kompakt />
        </div>

        <div className={`spr-dr-status${modell.verletzung.verletzt ? " is-verletzt" : ""}`} data-testid="spielerkurzprofil-status">
          {modell.verletzung.verletzt ? (
            <span>{modell.verletzung.text}</span>
          ) : (
            <span>{data.teamId ? (modell.verletzung.genesend ? "genesen" : "einsatzbereit") : "vertragslos"}</span>
          )}
          {form?.formVerfuegbar ? (
            <span className="spr-zst" title={`Form: ${form.formWort}`}>
              <BcFormPfeil stufe={form.formStufe} />
              {nebel ? null : <span className="spr-t">{Math.round(form.form ?? 0)}</span>}
            </span>
          ) : null}
          {moral != null ? <BcMoralGesicht wert={moral} mitZahl={!nebel} groesse={20} /> : null}
        </div>

        <div className="spr-vz">
          <div>
            <strong className="spr-t">{nebel ? (grobBereich(data.ovr, modell.nebelBreite) ?? "?") : zahl(data.ovr, 0)}</strong>
            <small>Gesamtwert</small>
          </div>
          <div>
            <strong className="spr-t">{zahl(gesamt, 1)}</strong>
            <small>
              PP {raenge?.ppGesamtLigaRang != null ? `· Liga #${raenge.ppGesamtLigaRang}` : "Saison"}
            </small>
          </div>
          <div>
            <strong className="spr-t">{geld(data.salary, 1)}</strong>
            <small>Gehalt je Saison · {geld(gehaltJeSpieltag(data.salary), 2)} je Spieltag</small>
          </div>
        </div>

        <div>
          <span className="spr-gk">20 Disziplinen · Eignung und Rang in der Liga</span>
          <div className="spr-dr-d20" data-testid="spielerkurzprofil-disziplinen">
            {sortiert.map((zeile) => {
              const rang = raenge?.disziplinen.get(zeile.id);
              return (
                <button
                  key={zeile.id}
                  type="button"
                  className={`${achseKlasse(kategorieAchse(zeile.category))}${top4.has(zeile.id) && !nebel ? " is-top" : ""}`}
                  onClick={() => onOpenFull("disciplines", zeile.id)}
                  title={`${zeile.label}: im Profil erklären`}
                >
                  <span>{zeile.label}</span>
                  <b className="spr-t">{nebel ? (grobBereich(zeile.value, modell.nebelBreite) ?? "?") : zahl(zeile.value, 0)}</b>
                  <small>{nebel ? (grobeRangStufe(rang?.aktivRang, rang?.aktivVon) ?? "") : rang?.ligaRang != null ? `Liga #${rang.ligaRang}` : ""}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="spr-gk">Player Points je Spieltag</span>
          <PpBalken reihe={modell.ppReihe} achseVon={achseVon} />
        </div>

        <div data-testid="spielerkurzprofil-einsaetze">
          {letzte.map((spieltag) =>
            spieltag.eintraege.map((eintrag) => (
              <div key={`${spieltag.matchdayId}-${eintrag.disziplinId}-${eintrag.seite}`} className="spr-zeile">
                <span>
                  Tag {spieltag.nummer ?? "—"} · {modell.disziplinLabel(eintrag.disziplinId)}
                  {eintrag.rangAmSpieltag != null ? <small>Rang #{eintrag.rangAmSpieltag}</small> : null}
                </span>
                <strong className="spr-t">{zahl(eintrag.pp, 1)} PP</strong>
              </div>
            )),
          )}
          {letzte.length === 0 ? <div className="spr-leer">Noch kein Einsatz in dieser Saison.</div> : null}
        </div>

        <div className="spr-dr-fuss">
          <button
            type="button"
            className={`spr-kn is-gold${!aktionen.darfHandeln || vertragslos ? " is-zu" : ""}`}
            disabled={!aktionen.darfHandeln || vertragslos}
            onClick={aktionen.onVerlaengern}
            title={aktionen.grundGesperrt ?? undefined}
          >
            Verlängern
          </button>
          <button type="button" className="spr-kn" disabled={!aktionen.darfHandeln || vertragslos} onClick={aktionen.onVerkaufen} title={aktionen.grundGesperrt ?? undefined}>
            Verkaufen
          </button>
          {merken.verfuegbar ? (
            <button type="button" className="spr-kn" aria-pressed={merken.gemerkt} onClick={merken.umschalten}>
              {merken.gemerkt ? "Gemerkt" : "Merken"}
            </button>
          ) : null}
          <button type="button" className="spr-kn" onClick={() => onOpenFull()} data-testid="spielerkurzprofil-ganzes-profil">
            Ganzes Profil öffnen
          </button>
        </div>
      </div>
    </>
  );
}
