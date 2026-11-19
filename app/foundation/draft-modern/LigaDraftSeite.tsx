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
 * existiert (Standard seit der Abnahme 19.11.; `OLY_LIGA_DRAFT_MODUS=block` ist der Rueckweg auf den alten Hintergrund-Draft).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { getTeamLogoModel, getPlayerPortraitBrowserUrl } from "@/lib/data/mediaAssets";
import { figurPoseUrl, getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import { getTransfermarktPortraitModel } from "@/lib/market/transfermarkt-lab";
import { baueSpielerSicht } from "@/lib/market/transfermarkt-sicht";
import { bereiteTeamVor } from "@/lib/market/transfermarkt-kaderstaerke";
import { isScoutingNebelAus } from "@/lib/market/transfermarkt-nebel-einstellung";
import type { FoundationMarketV2ShellHostProps } from "@/app/foundation/transfermarkt-v2/FoundationMarketV2ShellHost";
import { useMarktFeed } from "@/app/foundation/transfermarkt-modern/tm-daten";
import { DraftLiga } from "./DraftLiga";
import { baueDraftKaderSicht } from "./draft-liga";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";
import { DraftProfil } from "./DraftProfil";
import { getTeamTransferWishlistEntries } from "@/lib/scouting/scouting-wishlist-slots";
import { AmZug, DanachAmZug, DraftBrett, Kopfleiste, LiveTicker, MeinDraft } from "./DraftLive";
import { AbbruchDialog, AuslassenDialog, Ergebnis, FertigDialog, NachzugPanel, PickTafel, SkipDialog } from "./DraftAnsichten";
import { useLigaDraft } from "./draft-daten";
import type { DraftKontext, DraftZeile } from "./draft-kontext";
import { betragC, de, draftKopfSchluessel } from "./draft-format";
import { klickAuswahlOderProfil, nameKlickAuswahlUndProfil } from "@/app/foundation/shared/klickregel";
import "@/app/foundation/transfermarkt-modern/transfermarkt-modern.css";
import "./draft-modern.css";

export type DraftTaktZustand = { label: string; title: string; statusClass: string; onClick: () => void };

type Ansicht = "live" | "tafel" | "liga" | "ende";

export default function LigaDraftSeite({
  hostProps,
  istGastgeber = false,
  setupFehlgeschlagen = false,
  onTakt,
  onWeiter,
  onZumOffice,
}: {
  hostProps: FoundationMarketV2ShellHostProps;
  /** Solo oder Raum-Gastgeber: nur dann gibt es „Draft abbrechen“ (die Route prüft es ebenfalls). */
  istGastgeber?: boolean;
  /** Die Shell steht auf `leagueSetupStatus: "failed"` — der Draft wird über `ki_hintergrund` fortgesetzt. */
  setupFehlgeschlagen?: boolean;
  onTakt: (t: DraftTaktZustand | null) => void;
  onWeiter: () => void;
  /** „Zurück ins Office“ — der Draft pausiert (Takt läuft hier), der Zustand liegt im Spielstand. */
  onZumOffice?: () => void;
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
  const [abbruchOffen, setAbbruchOffen] = useState(false);
  const [auslassenOffen, setAuslassenOffen] = useState(false);
  const [fertigOffen, setFertigOffen] = useState(false);
  const [profilId, setProfilId] = useState<string | null>(null);

  // Liegengebliebener Hintergrundlauf (Reload, Server-Neustart, abgebrochener Lauf → Liga „failed“): niemand treibt die
  // KI-Züge. Die Shell bietet dafür kein „Erneut versuchen“ (409 `liga_draft_laeuft`), die Seite setzt den Draft selbst
  // über `ki_hintergrund` fort — einmal je Draft-Stand, leise.
  const fortsetzGesehen = useRef<number | null>(null);
  useEffect(() => {
    if (!ansicht || ansicht.status !== "laeuft" || ansicht.wartetAufStart || !ansicht.amZug?.automatisch || draft.hintergrund || draft.busy) return;
    if (!setupFehlgeschlagen && draft.tempo > 0) return; // läuft der Takt selbst (ki_schritt), nichts zu tun
    if (fortsetzGesehen.current === ansicht.stand) return;
    fortsetzGesehen.current = ansicht.stand;
    void aktionen.kiHintergrund(true);
  }, [ansicht, draft.hintergrund, draft.busy, draft.tempo, setupFehlgeschlagen, aktionen]);

  // ABNAHME 19.11., Fehler F4 (docs/design/abnahme-saison-19-11.md): der Kopf der Shell (Kasse, Saisonfortschritt) liest den
  // geladenen Spielstand, und den lud waehrend des Drafts niemand nach — nach dem Draft stand oben noch die Kasse nach dem ersten
  // Pick (256,9 C), unten „Kasse zum Saisonstart 23,7 C“. Jetzt laedt die Seite den Spielstand nach, sobald sich der EIGENE Kader
  // aendert (eigener Pick, Auto-Pick des GM) oder der Draft endet. Fremde Picks bewegen die eigene Kasse nicht.
  const kopfSchluessel = ansicht ? draftKopfSchluessel(ansicht) : null;
  const kopfGesehen = useRef<string | null>(null);
  useEffect(() => {
    if (!kopfSchluessel) return;
    if (kopfGesehen.current === null) {
      kopfGesehen.current = kopfSchluessel;
      return;
    }
    if (kopfGesehen.current === kopfSchluessel) return;
    kopfGesehen.current = kopfSchluessel;
    void hostProps.loadSave(activeSaveId);
  }, [kopfSchluessel, hostProps, activeSaveId]);

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

  // Bug J (19.11.): `transferWishlistEntriesForMarketV2` wird nur in der Transfermarkt-Ansicht gebaut — hier war die Liste leer, der
  // Stern blieb leer, der zweite Klick entfernte wieder. Direkt aus dem Spielstand ableiten (eigenes Team).
  const wunsch = useMemo(
    () => new Set(teamId ? getTeamTransferWishlistEntries(gameState, teamId).map((e) => e.playerId) : []),
    [gameState, teamId],
  );

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

  const kaderSicht = useMemo(
    () => (ansicht && ansicht.mein ? baueDraftKaderSicht({ gameState, ansicht, teamId: ansicht.mein.teamId, disziplinIds: [...officialDisciplineWeightOrder] }) : null),
    [gameState, ansicht],
  );
  const raenge = kaderSicht?.zeilen ?? null;
  // „Mein Kader“ und „Wirkung auf deinen Kader“ (UX 19.11.): dieselbe Rechnung wie Transfermarkt (`transfermarkt-kaderstaerke.ts`), hier
  // mit den Live-Picks des Drafts.
  const vorbereitung = useMemo(
    () =>
      kaderSicht && ansicht?.mein
        ? bereiteTeamVor({ spieler: kaderSicht.spieler, staerken: kaderSicht.staerken, teamId: ansicht.mein.teamId, disziplinIds: [...officialDisciplineWeightOrder] })
        : null,
    [kaderSicht, ansicht?.mein],
  );
  const meinKader = useMemo(
    () =>
      kaderSicht && ansicht?.mein
        ? kaderSicht.spieler
            .filter((s) => s.teamId === ansicht.mein!.teamId)
            .map((s) => ({ playerId: s.playerId, name: spielerById.get(s.playerId)?.name ?? s.playerId, className: spielerById.get(s.playerId)?.className ?? "", ratings: s.ratings }))
        : [],
    [kaderSicht, ansicht?.mein, spielerById],
  );

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
        raenge,
        meinKader,
        vorbereitung,
        profil: (id) => setProfilId(id),
        spielerName: (id) => zeilenById.get(id)?.item.name ?? ansicht.spieler[id]?.name ?? spielerById.get(id)?.name ?? "—",
        wunsch,
        // Schmal über `/api/draft` statt über den Auto-Save des ganzen Client-Stands: der Server überholt diesen Stand mit jedem
        // Pick, der Ganzstand-Save lief daher in „Save-Konflikt erkannt“ (19.11.). Danach den Serverstand übernehmen.
        toggleWunsch: (item) => {
          const an = !wunsch.has(item.playerId);
          void aktionen
            .wunsch(item.playerId, an, {
              playerName: item.name,
              className: item.className,
              race: item.race,
              marketValue: item.marketValue ?? null,
              salary: item.salary ?? null,
              bracket: item.bracket ?? null,
              pow: item.pow ?? null,
              spe: item.spe ?? null,
              men: item.men ?? null,
              soc: item.soc ?? null,
            })
            .then((ok) => (ok ? hostProps.loadSave(activeSaveId) : undefined));
        },
        wahl,
        setWahl,
        klick: (id) => (gepickt.has(id) ? setProfilId(id) : klickAuswahlOderProfil(id, wahl, setWahl, setProfilId)),
        nameKlick: (id) => nameKlickAuswahlUndProfil(id, !gepickt.has(id), setWahl, setProfilId),
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
        ? { label: "Draft abschließen", title: `Kader ${mein.kader} · du kannst weiter picken`, statusClass: "is-ready", onClick: () => setFertigOffen(true) }
        : { label: `Noch ${Math.max(0, ansicht.regeln.minKader - mein.kader)} Pflichtplätze`, title: "Du pickst in Ruhe", statusClass: "is-blocked", onClick: () => {} };
    }
    if (ansicht.wartetAufStart) {
      return mein?.startWahl === "offen"
        ? { label: "Wahl treffen", title: "Draft spielen oder selbst kaufen — vorher läuft nichts", statusClass: "is-warning", onClick: () => {} }
        : { label: "Warten auf Mitspieler", title: "Der Draft startet, sobald alle gewählt haben", statusClass: "is-blocked", onClick: () => {} };
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
        onClick: () => void aktionen.kiHintergrund(),
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
    ["liga", "Liga & Ränge"],
    ...(ansicht?.status === "fertig" ? ([["ende", "Ergebnis"]] as Array<[Ansicht, string]>) : []),
  ];

  const stil = hoehe != null ? ({ ["--tmk-hoehe" as string]: `${hoehe}px` } as CSSProperties) : undefined;
  const kpi = (l: string, w: string, kl?: string) => (
    <div className="drf-kpi" key={l}><span>{l}</span><strong className="t">{w}{kl ? <small> {kl}</small> : null}</strong></div>
  );

  return (
    <div className="tmk drf" data-testid="liga-draft-seite" ref={wurzelRef} style={stil}>
      {/* Solange das große Profil offen ist, gehört das Band dem Profil-Kopf (beide im Slot überlagerten sich). */}
      {profilId ? null : (
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
              {onZumOffice && ansicht.status !== "fertig" ? (
                <button type="button" className="knopf" onClick={onZumOffice} title="Der Draft pausiert, bis du zurückkommst. Der Hinweis oben bringt dich zurück." data-testid="draft-zum-office">← Office</button>
              ) : null}
              {istGastgeber && ansicht.status !== "fertig" ? (
                <button type="button" className="knopf" onClick={() => setAbbruchOffen(true)} title="Nur der Gastgeber: beendet den Draft für alle" data-testid="draft-abbrechen">Draft abbrechen</button>
              ) : null}
            </div>
          ) : null}
        </div>
      </FoundationBandSlot>
      )}

      {!ansicht || !kontext ? (
        <div className="drf-leerzeile" data-testid="draft-laedt">{draft.geladen ? "Für diese Saison gibt es keinen Draft." : "Draft wird geladen …"}</div>
      ) : ans === "tafel" ? (
        <div className="tf drf-seite">
          <div className="folge df"><Kopfleiste k={kontext} tempo={draft.tempo} setTempo={draft.setTempo} setVor={draft.setVor} onSkip={() => { draft.setTempo(0); setSkipOffen(true); }} onVor={() => void aktionen.kiHintergrund()} zeig={draft.zeig} /></div>
          <PickTafel k={kontext} />
        </div>
      ) : ans === "liga" ? (
        <div className="tf drf-seite">
          <div className="folge df"><Kopfleiste k={kontext} tempo={draft.tempo} setTempo={draft.setTempo} setVor={draft.setVor} onSkip={() => { draft.setTempo(0); setSkipOffen(true); }} onVor={() => void aktionen.kiHintergrund()} zeig={draft.zeig} /></div>
          <DraftLiga k={kontext} gameState={gameState} />
        </div>
      ) : ans === "ende" && ansicht.status === "fertig" ? (
        <Ergebnis k={kontext} onWeiter={onWeiter} />
      ) : (
        <div className="dv drf-seite" data-testid="draft-live">
          <div className="folge df">
            <Kopfleiste k={kontext} tempo={draft.tempo} setTempo={draft.setTempo} setVor={draft.setVor} onSkip={() => { draft.setTempo(0); setSkipOffen(true); }} onVor={() => void aktionen.kiHintergrund()} zeig={draft.zeig} />
          </div>
          <div className="lsp">
            {mein?.status === "nachzug" && !schau ? <NachzugPanel k={kontext} /> : <AmZug k={kontext} zeig={draft.zeig} />}
            <DanachAmZug k={kontext} />
          </div>
          <DraftBrett k={kontext} aktionen={aktionen} tastenAktiv={!profilId && !skipOffen && !abbruchOffen && !auslassenOffen && !fertigOffen && mein?.startWahl !== "offen"} />
          <MeinDraft k={kontext} aktionen={aktionen} onAuslassen={() => setAuslassenOffen(true)} onFertig={() => setFertigOffen(true)} onSkip={() => { draft.setTempo(0); setSkipOffen(true); }} />
          <LiveTicker k={kontext} zeig={draft.zeig} />
        </div>
      )}

      {kontext && ansicht && mein?.startWahl === "offen" && ansicht.status === "laeuft" ? (
        <div className="drf-start" role="dialog" aria-modal="true" aria-label="Draft starten" data-testid="draft-start">
          <div className="drf-start-karte">
            <small>Saisonstart-Draft</small>
            <h2>Der Draft steht bei Pick 1</h2>
            <p>Noch ist nichts gepickt. Entscheide, wie du deinen Kader aufbaust — vorher läuft kein Pick, auch nicht der der KI.</p>
            <div className="drf-start-wahl">
              <button type="button" className="drf-start-opt haupt" onClick={() => void aktionen.startWahl("spielen")} disabled={draft.busy} data-testid="draft-start-spielen">
                <b>Draft spielen</b>
                <span>Du beginnst bei Pick 1 und siehst jeden KI-Pick. Bei deinem Pick wählst du einen Spieler — Draft-Vertrag: 1 Saison, Gehalt wie angezeigt. „Vor zu meinem Pick“ überspringt die KI bis zu dir.</span>
              </button>
              <button type="button" className="drf-start-opt" onClick={() => void aktionen.startWahl("selbst")} disabled={draft.busy} data-testid="draft-start-selbst">
                <b>Selbst kaufen</b>
                <span>Die KI pickt sofort durch. Danach kaufst du frei aus dem Rest im Transfermarkt.</span>
              </button>
            </div>
            {onZumOffice ? <button type="button" className="knopf" onClick={onZumOffice} data-testid="draft-start-office">← Erst ins Office</button> : null}
            <em>Der Draft pausiert, solange du nicht hier bist. Der Hinweis im Office bringt dich zurück.</em>
          </div>
        </div>
      ) : null}

      {profilId && kontext ? (
        <DraftProfil
          hostProps={hostProps}
          playerId={profilId}
          darfPicken={Boolean(mein?.darfPicken && kontext.zeilenById.has(profilId))}
          onPicken={(id, name) => void aktionen.pick(id, name)}
          onWechsel={(id) => setProfilId(id)}
          onZu={() => setProfilId(null)}
        />
      ) : null}

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

      {auslassenOffen && kontext ? (
        <AuslassenDialog
          k={kontext}
          busy={draft.busy}
          onZu={() => setAuslassenOffen(false)}
          onJa={() => {
            setAuslassenOffen(false);
            void aktionen.auslassen();
          }}
        />
      ) : null}

      {fertigOffen && kontext ? (
        <FertigDialog
          k={kontext}
          busy={draft.busy}
          onZu={() => setFertigOffen(false)}
          onJa={() => {
            setFertigOffen(false);
            void aktionen.fertig();
          }}
        />
      ) : null}

      {abbruchOffen && kontext ? (
        <AbbruchDialog
          k={kontext}
          busy={draft.busy}
          onZu={() => setAbbruchOffen(false)}
          onJa={() => {
            void (async () => {
              const ok = await aktionen.abbrechen();
              setAbbruchOffen(false);
              if (ok) onWeiter();
            })();
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

