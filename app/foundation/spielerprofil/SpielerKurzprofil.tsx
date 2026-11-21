"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { BcFormPfeil, BcIcon, BcMoralGesicht } from "@/components/foundation/broadcast";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { useFocusTrap } from "@/lib/foundation/use-focus-trap";
import { baueKurzEntwicklung } from "@/lib/foundation/spielerprofil-kurz-entwicklung";
import type { PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import { FigurBuehne } from "./bausteine";
import {
  Kennzahlen,
  KURZ_REITER,
  PortraetRahmen,
  ReiterDisziplinen,
  ReiterEntwicklung,
  ReiterKarriere,
  ReiterLeistung,
  ReiterUeberblick,
  ReiterVertrag,
  type KurzReiterId,
} from "./SpielerKurzprofilTabs";
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
  /** Teams, die der Betrachter führt: nur deren Spieler zeigen den Trainingsplan. */
  manageableTeamIds?: readonly string[];
  /** Reiter beim Öffnen (Tests, Sprung aus Listen). */
  startReiter?: KurzReiterId;
};

/**
 * KURZPROFIL (Drawer), Neubau 18.11., Reiter 21.11. (Chris: „im Drawer fehlen noch Reiter wie Entwicklung … aus dem
 * Spielerprofil in klein, mit nur den wichtigsten Punkten“). Kopf (Porträt im OVR-Rahmen neben der Figur, Kacheln
 * OVR/MVS/PP, Status) bleibt stehen, darunter sechs Reiter wie im ganzen Profil, je mit „Voller Bericht ›“. Alle Zahlen
 * stammen aus denselben Quellen wie die Seite. Eigene Komponente, kein Teil der Seite.
 */
export default function SpielerKurzprofil({ data, onClose, onOpenFull, aktionen, ownerId, manageableTeamIds, startReiter = "ueberblick" }: SpielerKurzprofilProps) {
  const modell = useSpielerprofilModell(data);
  const merken = useSpielerMerken(data.playerId, ownerId);
  const huelle = useRef<HTMLDivElement | null>(null);
  const [reiter, setReiter] = useState<KurzReiterId>(startReiter);
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

  const nebel = modell.nebel;
  const form = modell.form;
  const moral = form?.moral ?? data.morale?.morale ?? null;
  const vertragslos = !data.teamId;
  const eigener = Boolean(data.teamId && manageableTeamIds?.includes(data.teamId));
  const gameState = modell.gameState;
  // Trainingsrechnung nur, wenn der Reiter offen ist und der Spieler zum eigenen Team gehört (kein Aufwand beim Blättern).
  const entwicklung = useMemo(
    () => (reiter === "entwicklung" && eigener && !nebel && gameState ? baueKurzEntwicklung(gameState, data.playerId) : null),
    [reiter, eigener, nebel, gameState, data.playerId],
  );

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

        <div className="spr-dr-hero">
          <PortraetRahmen data={data} modell={modell} />
          <div className="spr-dr-fig" style={{ display: "flex", flexDirection: "column" }}>
            <FigurBuehne data={data} modell={modell} kompakt ohnePortrait />
          </div>
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

        <Kennzahlen data={data} modell={modell} />

        <div className="spr-dr-reiter" role="tablist" aria-label="Kurzprofil-Reiter" data-testid="spielerkurzprofil-reiter">
          {KURZ_REITER.map((eintrag) => (
            <button
              key={eintrag.id}
              type="button"
              role="tab"
              aria-selected={reiter === eintrag.id}
              className={reiter === eintrag.id ? "is-an" : undefined}
              onClick={() => setReiter(eintrag.id)}
              data-testid={`spielerkurzprofil-reiter-${eintrag.id}`}
            >
              {eintrag.label}
            </button>
          ))}
        </div>

        <div className="spr-dr-koerper" role="tabpanel" data-testid={`spielerkurzprofil-tab-${reiter}`}>
          {reiter === "ueberblick" ? <ReiterUeberblick data={data} modell={modell} onOpenFull={onOpenFull} /> : null}
          {reiter === "disziplinen" ? <ReiterDisziplinen data={data} modell={modell} onOpenFull={onOpenFull} /> : null}
          {reiter === "entwicklung" ? <ReiterEntwicklung data={data} modell={modell} entwicklung={entwicklung} eigener={eigener} onOpenFull={onOpenFull} /> : null}
          {reiter === "leistung" ? <ReiterLeistung data={data} modell={modell} onOpenFull={onOpenFull} /> : null}
          {reiter === "vertrag" ? <ReiterVertrag data={data} onOpenFull={onOpenFull} /> : null}
          {reiter === "karriere" ? <ReiterKarriere data={data} onOpenFull={onOpenFull} /> : null}
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
