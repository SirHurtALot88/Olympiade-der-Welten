"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { FoundationNavAttentionMap } from "@/lib/foundation/foundation-nav-attention";
import type { FoundationActivityItem } from "@/lib/foundation/foundation-activity-types";
import { FoundationBandSlotProvider, FoundationBandSlotTarget } from "@/app/foundation/shell/foundation-band-slot";
import FoundationMeldungen, { type FoundationMeldung } from "@/app/foundation/shell/FoundationMeldungen";
import FoundationSidebar from "@/app/foundation/shell/FoundationSidebar";
import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";
import FoundationTaktgeber, { type FoundationTaktgeberProps } from "@/app/foundation/shell/FoundationTaktgeber";
import { useNavRailPinned } from "@/lib/ui/nav-rail-preference";
import "@/components/foundation/broadcast/broadcast.css";
import "@/components/foundation/broadcast/rahmen.css";

type FoundationShellProps = {
  activeView: FoundationViewId;
  onNavigate: (view: FoundationViewId) => void;
  onPrefetchView?: (view: FoundationViewId) => void;
  attentionByViewId?: FoundationNavAttentionMap;
  seasonLabel?: string | null;
  matchdayDisplayLabel?: string | null;
  currentMatchday?: number | null;
  headerActions?: ReactNode;
  breadcrumb?: ReactNode;
  /**
   * Name der aktiven Ansicht — wird als `<h1>` gerendert, nur fuer Screenreader sichtbar.
   *
   * BEFUND D1 aus `docs/AUDIT-INGAME-2026-08-19.md`: gemessen ueber 14 Ansichten hatten 13 gar
   * KEINE `<h1>`; die einzige im Spiel hiess „Football" — ein Disziplinname, keine
   * Seitenueberschrift. Ein Dokument ohne h1 hat keine Gliederung: Screenreader finden keinen
   * Einstieg, und „Zum Hauptinhalt springen" landet in einem Bereich ohne Titel.
   *
   * WARUM HIER UND NICHT IN 19 ANSICHTEN: der Name steht laengst fest
   * (`getFoundationBreadcrumb`, abgeleitet aus der Nav-Konfiguration). Ihn 19 Mal nachzutragen
   * hiesse, 19 Stellen zu schaffen, die auseinanderlaufen koennen — genau die Fehlerklasse, die
   * dieser Lauf den ganzen Tag repariert.
   *
   * WARUM UNSICHTBAR: die Ansichten tragen ihre Ueberschrift optisch bereits (Breadcrumb,
   * Panel-Titel). Eine zweite sichtbare Zeile waere Doppelung; hier fehlt nur die SEMANTIK.
   */
  viewTitle?: string | null;
  subNav?: ReactNode;
  children: ReactNode;
  isPending?: boolean;
  activities?: FoundationActivityItem[];
  // Compact "Aktives Team"-Umschalter, top-left in der Sidebar neben dem
  // Neuer-Look-Toggle statt im großen Context-Banner (siehe Owner-Feedback:
  // Banner + Titel fraßen die halbe Seite). Wiring bleibt bei der Router-Body,
  // hier nur Platzierung.
  teamPicker?: ReactNode;
  /**
   * Icon-Schiene (Broadcast-Fundament, `components/foundation/broadcast/broadcast.css`): die
   * Seitenleiste ist 64 px schmal, zeigt nur Symbole und fährt bei Hover/Fokus als Überlagerung
   * aus. Seit 18.11. der Standard für ALLE Ansichten; `false` stellt die breite Seitenleiste wieder
   * her. „Beschriftung immer zeigen“ (pro Browser gespeichert) hält sie dauerhaft ausgeklappt.
   */
  compactRail?: boolean;
  /**
   * Taktgeber im Regieband (18.11.): Status und „Weiter“ in EINEM Baustein. Ersetzt den früheren
   * Statuschip + Weiter-Knopf; die Aktivitätsliste steht im Ablauf-Aufklapper des Taktgebers.
   */
  takt?: Omit<FoundationTaktgeberProps, "activities">;
  /** Nur-Ansicht-Hinweis (Text = Erklärung) als kleine Marke im Band statt als eigenes Band. */
  nurAnsicht?: string | null;
  /** Suche öffnen (Lupe im Band). */
  onSearch?: () => void;
  /** Kasse des aktiven Teams, fertig formatiert („3,2 Mio“). */
  kasseLabel?: string | null;
  /** Spielplan öffnen (Klick auf den Saison-Chip). */
  onOpenSeason?: () => void;
  /** Wappen des aktiven Teams (Schienenkopf). */
  teamCrest?: ReactNode;
  teamName?: string | null;
  /** Office öffnen (Punkt unten in der Schiene). */
  onOpenOffice?: () => void;
  /** Meldungen für die Bauchbinde unten rechts; in der Arena zurückgehalten. */
  meldungen?: FoundationMeldung[];
  onOpenMeldungen?: () => void;
};

const SAISON_SPIELTAGE = 20;

function buildSeasonContextLabel(
  seasonLabel: string,
  matchdayDisplayLabel: string,
  currentMatchday?: number | null,
) {
  const seasonNumber = seasonLabel.match(/Season (\d+)/i)?.[1];
  const seasonPart = seasonNumber ? `S${seasonNumber}` : seasonLabel;
  const matchdayPart =
    typeof currentMatchday === "number" && Number.isFinite(currentMatchday)
      ? `MD ${currentMatchday}`
      : matchdayDisplayLabel.replace(/^Spieltag\s+/i, "MD ");
  return `${seasonPart} · ${matchdayPart}`;
}

export default function FoundationShell({
  activeView,
  onNavigate,
  onPrefetchView,
  attentionByViewId,
  seasonLabel,
  matchdayDisplayLabel,
  currentMatchday,
  headerActions,
  breadcrumb,
  subNav,
  children,
  isPending = false,
  activities = [],
  teamPicker,
  viewTitle,
  compactRail = true,
  takt,
  nurAnsicht,
  onSearch,
  kasseLabel,
  onOpenSeason,
  teamCrest,
  teamName,
  onOpenOffice,
  meldungen = [],
  onOpenMeldungen,
}: FoundationShellProps) {
  const [railPinned, setRailPinned] = useNavRailPinned();
  const seasonContextLabel =
    seasonLabel && matchdayDisplayLabel
      ? buildSeasonContextLabel(seasonLabel, matchdayDisplayLabel, currentMatchday)
      : null;

  // Arena-Vollbild (18.11.): Band und Schiene fahren weg, übrig bleibt ein schmaler Griff. R/Griff holt den
  // Rahmen zurück, Esc verlässt die Arena (zurück zur Seite davor, sonst Start).
  const istArena = activeView === "matchdayArena";
  const [arenaRahmen, setArenaRahmen] = useState(false);
  const vorherigeAnsicht = useRef<FoundationViewId | null>(null);
  const letzteAnsicht = useRef<FoundationViewId>(activeView);
  const [wischer, setWischer] = useState<string | null>(null);
  useEffect(() => {
    if (letzteAnsicht.current !== activeView) {
      if (activeView === "matchdayArena") {
        vorherigeAnsicht.current = letzteAnsicht.current;
        setArenaRahmen(false);
        setWischer("Spieltag");
        const timer = setTimeout(() => setWischer(null), 700);
        letzteAnsicht.current = activeView;
        return () => clearTimeout(timer);
      }
      letzteAnsicht.current = activeView;
    }
    return undefined;
  }, [activeView]);
  // Vollbild nur, wenn die Bühne wirklich läuft (Leinwand/Iframe im Arena-Container). Die Seite „Vor dem
  // Anpfiff“ (Einsatzliste unvollständig) behält Band und Schiene, sonst käme man nirgends mehr hin.
  const [buehneDa, setBuehneDa] = useState(false);
  useEffect(() => {
    if (!istArena) {
      setBuehneDa(false);
      return undefined;
    }
    const pruefe = () => setBuehneDa(Boolean(document.querySelector("#foundation-matchday-arena canvas, #foundation-matchday-arena iframe")));
    pruefe();
    const beobachter = new MutationObserver(pruefe);
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => beobachter.disconnect();
  }, [istArena]);
  const arenaVoll = istArena && !arenaRahmen && buehneDa;
  const verlasseArena = useCallback(() => {
    const ziel = vorherigeAnsicht.current && vorherigeAnsicht.current !== "matchdayArena" ? vorherigeAnsicht.current : "homeV2";
    onNavigate(ziel);
  }, [onNavigate]);
  useEffect(() => {
    if (!istArena || (!arenaVoll && !arenaRahmen)) return undefined;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (event.key === "r" || event.key === "R") {
        setArenaRahmen((offen) => !offen);
      } else if (event.key === "Escape") {
        if (arenaRahmen) setArenaRahmen(false);
        else verlasseArena();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [istArena, arenaVoll, arenaRahmen, verlasseArena]);

  const spieltag = typeof currentMatchday === "number" && Number.isFinite(currentMatchday) ? currentMatchday : null;
  const saisonNr = seasonLabel?.match(/Season (\d+)/i)?.[1] ?? null;

  return (
    <FoundationBandSlotProvider>
    <div className={`foundation-shell-layout${isPending ? " is-nav-pending" : ""}${compactRail ? " is-bc-rail" : ""}${compactRail && railPinned ? " is-rail-pinned" : ""}${arenaVoll ? " is-arena-voll" : ""}${istArena && arenaRahmen ? " is-arena-rahmen" : ""}`} data-testid="foundation-shell-layout">
      <FoundationSidebar
        activeView={activeView}
        onNavigate={onNavigate}
        onPrefetchView={onPrefetchView}
        attentionByViewId={attentionByViewId}
        seasonContextLabel={seasonContextLabel}
        teamPicker={teamPicker}
        teamCrest={teamCrest}
        teamName={teamName}
        onOpenOffice={onOpenOffice}
        rail={compactRail ? { pinned: railPinned, onPinnedChange: setRailPinned } : undefined}
      />
      {istArena && arenaVoll ? (
        <button
          type="button"
          className="fb-griff"
          data-testid="foundation-arena-griff"
          onClick={() => setArenaRahmen(true)}
          title="Rahmen einblenden (R) · Arena verlassen (Esc)"
          aria-label="Rahmen einblenden"
        >
          <span aria-hidden="true" />
        </button>
      ) : null}
      {wischer ? (
        <div className="fb-wisch" aria-hidden="true">
          <strong>{wischer}</strong>
        </div>
      ) : null}
      <FoundationMeldungen meldungen={meldungen} zurueckhalten={istArena} onOpen={onOpenMeldungen} />
      <div className="foundation-shell-main" id="foundation-main-content" tabIndex={-1}>
        {/* Die Gliederungs-Spitze des Dokuments. Steht VOR allem anderen im Hauptbereich, damit
            „Zum Hauptinhalt springen" (Ziel `#foundation-main-content`) direkt auf sie faellt. */}
        {viewTitle ? <h1 className="sr-only">{viewTitle}</h1> : null}
        {/* Regieband (18.11., App-Rahmen modern): EIN Band statt Rahmenzeile + Seitenkopf + Reiterzeile.
            Plätze: Ort (Brotkrume/Titel) · Unterreiter · Seiten-Slot · Saison · Kasse · Suche · Hauptaktion ·
            Taktgeber. Seiten füllen den Slot über `FoundationBandSlot`. */}
        <header className="foundation-shell-header fb-band" data-testid="foundation-regieband">
          <div key={activeView} className="foundation-shell-breadcrumb-slot fb-ort">{breadcrumb}</div>
          {subNav ? <div className="fb-reiter">{subNav}</div> : null}
          <FoundationBandSlotTarget />
          <div className="foundation-shell-header-actions fb-rechts">
            {nurAnsicht ? (
              <span className="fb-hinweis" data-testid="foundation-band-nur-ansicht" title={nurAnsicht} role="status">
                Nur Ansicht
              </span>
            ) : null}
            {seasonContextLabel ? (
              <button
                type="button"
                className="fb-chip fb-saison"
                data-testid="foundation-band-saison"
                title={`${seasonContextLabel} — zum Spielplan`}
                onClick={onOpenSeason}
              >
                <small>Saison {saisonNr ?? ""}{spieltag != null ? <> · Spieltag <b>{spieltag}</b> / {SAISON_SPIELTAGE}</> : null}</small>
                <span className="fb-striche" aria-hidden="true">
                  {Array.from({ length: SAISON_SPIELTAGE }, (_, index) => (
                    <i key={index} className={spieltag != null && index + 1 < spieltag ? "is-gespielt" : spieltag === index + 1 ? "is-jetzt" : ""} />
                  ))}
                </span>
              </button>
            ) : null}
            {kasseLabel ? (
              <span className="fb-chip fb-kasse" data-testid="foundation-band-kasse" title="Kasse des aktiven Teams">
                <small>Kasse</small>
                <b>{kasseLabel}</b>
              </span>
            ) : null}
            {onSearch ? (
              <button
                className="fb-icon foundation-tab foundation-tab-search"
                type="button"
                title="Suche öffnen"
                aria-label="Suchen"
                onClick={onSearch}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l4.5 4.5" />
                </svg>
              </button>
            ) : null}
            {headerActions}
            {takt ? <FoundationTaktgeber {...takt} activities={activities} /> : null}
          </div>
        </header>
        {/* key={activeView}: der Content-Wrapper wird bei jedem echten View-Wechsel neu gemountet, damit der
            gestaffelte Einstieg (`foundation-view-enter`, Kinder steigen nacheinander auf) erneut spielt.
            Reduced-Motion schaltet das per CSS ab. */}
        <div key={activeView} className="foundation-shell-content foundation-view-enter">
          {children}
        </div>
      </div>
    </div>
    </FoundationBandSlotProvider>
  );
}
