"use client";

/**
 * DRAFT-SEITE (18.11.) — der Saisonstart-Draft im Einzelschritt, gebaut nach dem freigegebenen Mockup
 * `public/mockups/draft-modern-18-11.html` (Erklärung `docs/design/draft-modern-18-11.md`, Entscheidungen von Chris
 * am Ende des Dokuments). Schnittstelle: `docs/design/draft-neubau-kern-18-11.md`, Abschnitt 5.
 *
 * GEZEIGT = GEBUCHT: Picks, Top 3, Preise, Grenzen und Reihenfolge kommen aus `/api/draft`. Die Seite rechnet nichts
 * davon nach. Das Brett kommt aus dem Markt-Feed (`/api/transfermarkt/free-agents`) und läuft durch `baueSpielerSicht`:
 * unter dem Scouting-Nebel sieht man nur Stufen, und sortiert wird nur über diese Stufen.
 *
 * Sie erscheint in der Foundation-Shell an der Stelle des Schildes „Liga wird erstellt …“, sobald ein Draft-Zustand
 * existiert (Schalter `OLY_LIGA_DRAFT_MODUS=einzelschritt`); ohne Schalter bleibt alles wie heute.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { getTeamLogoModel, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import { figurPoseUrl, getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import { baueSpielerSicht } from "@/lib/market/transfermarkt-sicht";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import type { FoundationMarketV2ShellHostProps } from "@/app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost";
import { useMarktFeed } from "@/app/foundation/transfermarkt-modern/tm-daten";
import { AmZug, DanachAmZug, DraftBrett, Kopfleiste, LiveTicker, MeinDraft } from "./DraftLive";
import { Ergebnis, NachzugPanel, PickTafel, SkipDialog } from "./DraftAnsichten";
import { useLigaDraft } from "./draft-daten";
import type { DraftKontext, DraftZeile } from "./draft-kontext";
import { betragC, de } from "./draft-format";
import "@/app/foundation/transfermarkt-modern/transfermarkt-modern.css";
import "./draft-modern.css";

export type DraftTaktZustand = { label: string; title: string; statusClass: string; onClick: () => void };

type Ansicht = "live" | "tafel" | "ende";

export default function LigaDraftSeite({
  hostProps,
  onTakt,
  onWeiter,
}: {
  hostProps: FoundationMarketV2ShellHostProps;
  onTakt: (t: DraftTaktZustand | null) => void;
  onWeiter: () => void;
}) {
  const { gameState, activeSaveId, activeManagerTeamId, roomContext } = hostProps;
  const teamId = activeManagerTeamId ?? null;
  const nebelAus = isScoutingNebelAus(gameState);
  const draft = useLigaDraft({ saveId: activeSaveId, teamId, roomContext });
  const { ansicht, aktionen } = draft;

  // Höhe wie die Markt-Seite: Fensterhöhe minus Abstand von oben, damit nichts scrollt.
  const wurzelRef = useRef<HTMLDivElement | null>(null);
  const [hoehe, setHoehe] = useState<number | null>(null);
  useLayoutEffect(() => {
    function messen() {
      const el = wurzelRef.current;
      if (!el) return;
      const oben = el.getBoundingClientRect().top + window.scrollY;
      setHoehe(Math.max(420, Math.floor(window.innerHeight - oben - 28)));
    }
    messen();
    window.addEventListener("resize", messen);
    const t = window.setTimeout(messen, 600);
    return () => {
      window.removeEventListener("resize", messen);
      window.clearTimeout(t);
    };
  }, []);

  const [ans, setAns] = useState<Ansicht>("live");
  const [disziplin, setDisziplin] = useState("hockey");
  const [wahl, setWahl] = useState<string | null>(null);
  const [schau, setSchau] = useState<string | null>(null);
  const [skipOffen, setSkipOffen] = useState(false);

  const feed = useMarktFeed({
    saveId: activeSaveId,
    seasonId: gameState.season.id,
    teamId: teamId ?? "",
    source: hostProps.readMetaSource,
    bereit: Boolean(teamId),
    suche: "",
    neuLaden: 0,
    roomContext,
  });

  const gepickt = useMemo(() => new Set((ansicht?.verlauf ?? []).filter((e) => e.art === "pick" && e.playerId).map((e) => e.playerId as string)), [ansicht?.verlauf]);
  const alleZeilen = useMemo<DraftZeile[]>(() => feed.items.map((item) => ({ item, sicht: baueSpielerSicht(item, { nebelAus }) })), [feed.items, nebelAus]);
  const zeilen = useMemo(() => alleZeilen.filter((z) => !gepickt.has(z.item.playerId)), [alleZeilen, gepickt]);
  const zeilenById = useMemo(() => new Map(alleZeilen.map((z) => [z.item.playerId, z])), [alleZeilen]);
  const spielerById = useMemo(() => new Map(gameState.players.map((p) => [p.id, p])), [gameState.players]);
  const teamsById = useMemo(() => new Map(gameState.teams.map((t) => [t.teamId, t])), [gameState.teams]);

  const wunsch = useMemo(() => new Set(hostProps.transferWishlistEntriesForMarketV2.map((e) => e.playerId)), [hostProps.transferWishlistEntriesForMarketV2]);

  // Vorschlag des eigenen GM als Vormerkung, solange nichts (oder etwas Vergebenes) gewählt ist.
  const vorschlag = ansicht?.mein?.vorschlag[0] ?? null;
  useEffect(() => {
    if (!ansicht?.mein) return;
    if (wahl && !gepickt.has(wahl)) return;
    if (ansicht.mein.darfPicken && vorschlag) setWahl(vorschlag); // eslint-disable-line react-hooks/set-state-in-effect
    else if (wahl && gepickt.has(wahl)) setWahl(null);
  }, [wahl, gepickt, vorschlag, ansicht?.mein]);

  const fertigGesehen = useRef(false);
  useEffect(() => {
    if (ansicht?.status === "fertig" && !fertigGesehen.current) {
      fertigGesehen.current = true;
      setAns("ende");
    }
  }, [ansicht?.status]);

  const kontext: DraftKontext | null = ansicht
    ? {
        ansicht,
        hintergrund: draft.hintergrund,
        zeilen,
        zeilenById,
        feedBusy: feed.busy,
        feedFehler: feed.fehler,
        nebelAus,
        disziplin,
        setDisziplin,
        wappen: (id) => {
          const t = teamsById.get(id);
          return t ? getTeamLogoModel(t).src : null;
        },
        portrait: (id) => {
          const z = zeilenById.get(id);
          if (z) return getTransfermarktPortraitModel(z.item).src;
          const p = spielerById.get(id);
          return p ? getPlayerPortraitBrowserUrl(p.id, p.portraitUrl, p.portraitPath) : null;
        },
        figur: (id) => {
          const s = getFigurSpriteForPlayer(id);
          return s ? figurPoseUrl(s, "south") : null;
        },
        teamName: (id) => ansicht.teams.find((t) => t.teamId === id)?.name ?? teamsById.get(id)?.name ?? id,
        teamKuerzel: (id) => ansicht.teams.find((t) => t.teamId === id)?.kuerzel ?? teamsById.get(id)?.shortCode ?? id,
        wunsch,
        toggleWunsch: (item) => hostProps.toggleTransferWishlist(item),
        wahl,
        setWahl,
        schau,
        setSchau,
      }
    : null;

  // Taktgeber der Shell (Hauptaktion rechts oben) folgt dem Draft.
  const takt = ((): DraftTaktZustand | null => {
    if (!ansicht) return null;
    const mein = ansicht.mein;
    if (ansicht.status === "fertig") return { label: "Weiter", title: "Draft abgeschlossen", statusClass: "is-ready", onClick: onWeiter };
    if (mein?.status === "nachzug" && ansicht.status === "nachzug") {
      return mein.darfFertig
        ? { label: "Draft abschließen", title: `Kader ${mein.kader} · du kannst weiter picken`, statusClass: "is-ready", onClick: () => void aktionen.fertig() }
        : { label: `Noch ${Math.max(0, ansicht.regeln.minKader - mein.kader)} Pflichtplätze`, title: "Du pickst in Ruhe", statusClass: "is-blocked", onClick: () => {} };
    }
    if (draft.hintergrund) return { label: "KI pickt fertig …", title: "Die KI-Teams picken im Hintergrund", statusClass: "is-blocked", onClick: () => {} };
    if (mein?.darfPicken && mein.amZug) {
      const z = wahl ? zeilenById.get(wahl) : undefined;
      const ok = z && (z.item.marketValue ?? 0) <= mein.maxAbloese + 1e-9;
      return ok && z
        ? { label: `${z.item.name} picken`, title: `Du bist dran · kein Zeitlimit · ${betragC(z.item.marketValue)}`, statusClass: "is-ready", onClick: () => void aktionen.pick(z.item.playerId, z.item.name) }
        : { label: "Spieler wählen", title: "Du bist dran · kein Zeitlimit", statusClass: "is-blocked", onClick: () => {} };
    }
    if (mein?.autoPick && mein.status === "aktiv") return { label: "Auto-Draft läuft", title: "Dein GM pickt an deinem Platz", statusClass: "is-blocked", onClick: () => {} };
    if (ansicht.wartetAufMensch && ansicht.amZug) {
      const name = ansicht.teams.find((t) => t.teamId === ansicht.amZug?.teamId);
      return { label: `Warten auf ${name?.name ?? "Mitspieler"}`, title: "Der Draft wartet · kein Zeitlimit", statusClass: "is-blocked", onClick: () => {} };
    }
    if (mein?.art === "mensch") {
      return {
        label: "Vor zu meinem Pick",
        title: `KI pickt · Pick ${ansicht.picks + 1}${mein.picksBisZug ? ` · noch ${mein.picksBisZug} vor dir` : ""}`,
        statusClass: "is-warning",
        onClick: () => {
          draft.setVor(true);
        },
      };
    }
    return null;
  })();
  const taktRef = useRef(takt);
  useEffect(() => {
    taktRef.current = takt;
  });
  const taktSchluessel = takt ? `${takt.label}|${takt.title}|${takt.statusClass}` : "";
  useEffect(() => {
    const t = taktRef.current;
    onTakt(t ? { ...t, onClick: () => taktRef.current?.onClick() } : null);
  }, [taktSchluessel, onTakt]);
  useEffect(() => () => onTakt(null), [onTakt]);

  const mein = ansicht?.mein ?? null;
  const reiter: Array<[Ansicht, string]> = [
    ["live", mein?.status === "nachzug" && ansicht?.status === "nachzug" ? "Nachzug" : "Live"],
    ["tafel", "Pick-Tafel"],
    ...(ansicht?.status === "fertig" ? ([["ende", "Ergebnis"]] as Array<[Ansicht, string]>) : []),
  ];

  const stil = hoehe != null ? ({ ["--tmk-hoehe" as string]: `${hoehe}px` } as CSSProperties) : undefined;
  const kpi = (l: string, w: string, kl?: string) => (
    <div className="drf-kpi" key={l}><span>{l}</span><strong className="t">{w}{kl ? <small> {kl}</small> : null}</strong></div>
  );

  return (
    <div className="tmk drf" data-testid="liga-draft-seite" ref={wurzelRef} style={stil}>
      <FoundationBandSlot>
        <div className="tmk-bs" data-testid="draft-bandslot">
          <nav className="tmk-bs-reiter" aria-label="Draft-Ansichten">
            {reiter.map(([id, label]) => (
              <button key={id} type="button" className={ans === id ? "an" : ""} onClick={() => setAns(id)} data-testid={`draft-reiter-${id}`}>{label}</button>
            ))}
          </nav>
          {ansicht ? (
            <div className="drf-kpis">
              {kpi("Runde", ansicht.status === "fertig" ? "–" : String(ansicht.runde), `von ${ansicht.regeln.maxRunden}`)}
              {kpi("Picks", String(ansicht.picks), "gemacht")}
              {mein ? kpi("Kasse frei", de(mein.kasse), "C") : null}
              {mein ? kpi("Mein Kader", String(mein.kader), `/ ${ansicht.regeln.minKader} Pflicht`) : null}
            </div>
          ) : null}
        </div>
      </FoundationBandSlot>

      {!ansicht || !kontext ? (
        <div className="drf-leerzeile" data-testid="draft-laedt">{draft.geladen ? "Für diese Saison gibt es keinen Draft." : "Draft wird geladen …"}</div>
      ) : ans === "tafel" ? (
        <div className="tf drf-seite">
          <div className="folge df"><Kopfleiste k={kontext} tempo={draft.tempo} setTempo={draft.setTempo} setVor={draft.setVor} onSkip={() => { draft.setTempo(0); setSkipOffen(true); }} zeig={draft.zeig} /></div>
          <PickTafel k={kontext} />
        </div>
      ) : ans === "ende" && ansicht.status === "fertig" ? (
        <Ergebnis k={kontext} onWeiter={onWeiter} />
      ) : (
        <div className="dv drf-seite" data-testid="draft-live">
          <div className="folge df">
            <Kopfleiste k={kontext} tempo={draft.tempo} setTempo={draft.setTempo} setVor={draft.setVor} onSkip={() => { draft.setTempo(0); setSkipOffen(true); }} zeig={draft.zeig} />
          </div>
          <div className="lsp">
            {mein?.status === "nachzug" && !schau ? <NachzugPanel k={kontext} /> : <AmZug k={kontext} zeig={draft.zeig} onVormerken={(id) => setWahl(id)} />}
            <DanachAmZug k={kontext} />
          </div>
          <DraftBrett k={kontext} aktionen={aktionen} />
          <MeinDraft k={kontext} aktionen={aktionen} />
          <LiveTicker k={kontext} zeig={draft.zeig} />
        </div>
      )}

      {skipOffen && kontext ? (
        <SkipDialog
          k={kontext}
          onZu={() => setSkipOffen(false)}
          onWahl={(v) => {
            setSkipOffen(false);
            void aktionen.ueberspringen(v);
          }}
        />
      ) : null}

      <div className="drf-meld" aria-live="polite">
        {draft.meldungen.map((m) => (
          <div key={m.id} className={`drf-mb ${m.art}`} role="status"><b>{m.titel}</b><small>{m.text}</small></div>
        ))}
      </div>
    </div>
  );
}

