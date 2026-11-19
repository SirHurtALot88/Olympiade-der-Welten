"use client";

import { useEffect } from "react";

import { BcFormPfeil, BcIcon, BcMoralGesicht } from "@/components/foundation/broadcast";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { type PlayerProfileTabId } from "@/lib/foundation/player-profile-service";
import { formatLeagueTierShortLabel } from "@/lib/season/league-history";
import { TabDisziplinen } from "./TabDisziplinen";
import { TabEntwicklung, type TrainingSteuerung } from "./TabEntwicklung";
import { TabKarriere } from "./TabKarriere";
import { TabLeistung } from "./TabLeistung";
import { TabUeberblick } from "./TabUeberblick";
import { TabVertrag, type VertragsAktionen } from "./TabVertrag";
import { useSpielerMerken } from "./use-spieler-merken";
import { useSpielerprofilModell } from "./use-spielerprofil-modell";
import "./spielerprofil.css";

export type SpielerprofilSeiteProps = {
  data: PlayerDetailDrawerData;
  activeTab: PlayerProfileTabId;
  onTabChange: (tab: PlayerProfileTabId) => void;
  onClose?: () => void;
  /** Blättern zu einem anderen Spieler (Kollegen im Kader). */
  onNavigatePlayer?: (playerId: string) => void;
  onOpenTeam?: (teamId: string) => void;
  training: TrainingSteuerung;
  aktionen: VertragsAktionen;
  ownerId?: string | null;
  /** Disziplin, die der Reiter „Disziplinen“ vorwählt (Sprung aus dem Überblick oder dem Kurzprofil). */
  startDisziplin?: string | null;
  onStartDisziplin?: (disziplinId: string | null) => void;
};

/**
 * SPIELERPROFIL (Seite), Neubau 18.11. nach `public/mockups/spielerprofil-modern-18-11.html`. Eigene Komponente, eigenes CSS
 * (`spielerprofil.css`, Präfix `spr-`), kein Bestandteil der alten Spieler-Schublade. Sechs Reiter, je ein Bildschirm.
 * Name, Blättern, Reiter und Form/Moral/Status stehen im Kopf der Seite; sobald der App-Rahmen (Regieband) auf main liegt,
 * wandert genau dieser Kopf in dessen Seiten-Slot.
 */
export default function SpielerprofilSeite({
  data,
  activeTab,
  onTabChange,
  onClose,
  onNavigatePlayer,
  onOpenTeam,
  training,
  aktionen,
  ownerId,
  startDisziplin,
  onStartDisziplin,
}: SpielerprofilSeiteProps) {
  const modell = useSpielerprofilModell(data);
  const merken = useSpielerMerken(data.playerId, ownerId);
  const position = modell.kaderIds.indexOf(data.playerId);
  const vorher = position > 0 ? modell.kaderIds[position - 1] : null;
  const nachher = position >= 0 && position < modell.kaderIds.length - 1 ? modell.kaderIds[position + 1] : null;

  useEffect(() => {
    function beiTaste(ereignis: KeyboardEvent) {
      const ziel = ereignis.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "SELECT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable)) return;
      if (ereignis.key === "ArrowUp" && vorher && onNavigatePlayer) {
        ereignis.preventDefault();
        onNavigatePlayer(vorher);
      } else if (ereignis.key === "ArrowDown" && nachher && onNavigatePlayer) {
        ereignis.preventDefault();
        onNavigatePlayer(nachher);
      }
    }
    window.addEventListener("keydown", beiTaste);
    return () => window.removeEventListener("keydown", beiTaste);
  }, [vorher, nachher, onNavigatePlayer]);

  const form = modell.form;
  const moral = form?.moral ?? data.morale?.morale ?? null;
  const liga = formatLeagueTierShortLabel(modell.raenge?.ligaName ?? null);

  return (
    <div className="bc spr" data-testid="spielerprofil-seite" data-spieler={data.playerId}>
      {/* Regieband des App-Rahmens: Name, Blättern und Zustand stehen im Seiten-Slot, die Reiter im Unterreiter-Platz
          des Bands (von der Shell gezeichnet). Ohne Band (Tests) bleibt der Slot leer. */}
      <FoundationBandSlot>
        <div className={`bc spr-slot${modell.verletzung.verletzt ? " is-verletzt" : ""}`} data-testid="spielerprofil-kopf">
          {onClose ? (
            <button type="button" className="spr-zurueck" aria-label="Zurück" title="Zurück" onClick={onClose} data-testid="spielerprofil-zurueck">
              <BcIcon name="links" /> <span className="spr-zurueck__text">Zurück</span>
            </button>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {data.portraitUrl ? <img className="spr-kopf__port" src={data.portraitUrl} alt="" /> : <span className="spr-kopf__port" aria-hidden="true" />}
          <div style={{ minWidth: "9em", flex: "0 1 auto" }}>
            <h2 className="spr-kopf__name" style={{ display: "flex", alignItems: "center", gap: "0.3em" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{data.name}</span>
              <span className="spr-blaettern" role="group" aria-label="Im Kader blättern">
                <button type="button" disabled={!vorher} onClick={() => vorher && onNavigatePlayer?.(vorher)} aria-label="Vorheriger Spieler" title="Vorheriger Spieler (↑)">
                  <BcIcon name="auf" />
                </button>
                <button type="button" disabled={!nachher} onClick={() => nachher && onNavigatePlayer?.(nachher)} aria-label="Nächster Spieler" title="Nächster Spieler (↓)">
                  <BcIcon name="ab" />
                </button>
              </span>
            </h2>
            <div className="spr-kopf__sub">
              {data.teamId && onOpenTeam ? (
                <button type="button" onClick={() => onOpenTeam(data.teamId as string)} style={{ color: "var(--bc-tinte)", fontWeight: 600 }}>
                  {data.teamName}
                </button>
              ) : (
                <b>{data.teamName ?? "Vertragslos"}</b>
              )}
              {liga ? ` · ${liga}` : ""} · {[data.className, data.race].filter(Boolean).join(" · ")}
            </div>
          </div>
          <span className="spr-sp" style={{ flex: 1 }} />
          <div className="spr-kopf__zustand" data-testid="spielerprofil-zustand">
            {form?.formVerfuegbar ? (
              <span className="spr-zst" title={`Form: ${form.formWort}`}>
                <BcFormPfeil stufe={form.formStufe} />
                {modell.nebel ? null : <span className="spr-t">{Math.round(form.form ?? 0)}</span>}
              </span>
            ) : null}
            {moral != null ? <BcMoralGesicht wert={moral} mitZahl={!modell.nebel} groesse={22} /> : null}
            {modell.verletzung.verletzt ? (
              <span className="spr-marke is-rot spr-marke--band" data-testid="spielerprofil-status-verletzt" title={modell.verletzung.text ?? undefined}>
                {modell.verletzung.text}
              </span>
            ) : data.teamId ? (
              <span className="spr-marke is-gruen">{modell.verletzung.genesend ? "genesen" : "einsatzbereit"}</span>
            ) : (
              <span className="spr-marke is-grau">vertragslos</span>
            )}
            {merken.verfuegbar ? (
              <button type="button" className="spr-kn" aria-pressed={merken.gemerkt} onClick={merken.umschalten} data-testid="spielerprofil-merken">
                {merken.gemerkt ? "Gemerkt" : "Merken"}
              </button>
            ) : null}
          </div>
        </div>
      </FoundationBandSlot>
      {activeTab === "overview" ? (
        <TabUeberblick
          data={data}
          modell={modell}
          onTab={onTabChange}
          onOpenDisziplin={(id) => {
            onStartDisziplin?.(id);
            onTabChange("disciplines");
          }}
        />
      ) : null}
      {activeTab === "disciplines" ? <TabDisziplinen key={`${data.playerId}-${startDisziplin ?? ""}`} data={data} modell={modell} startDisziplin={startDisziplin} /> : null}
      {activeTab === "performance" ? <TabLeistung data={data} modell={modell} /> : null}
      {activeTab === "development" ? <TabEntwicklung data={data} modell={modell} training={training} /> : null}
      {activeTab === "contract" ? <TabVertrag data={data} modell={modell} aktionen={aktionen} /> : null}
      {activeTab === "career" ? <TabKarriere data={data} /> : null}
    </div>
  );
}
