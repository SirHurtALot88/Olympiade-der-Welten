"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { klassenKartenfarbe } from "@/app/foundation/KlassenFarbTag";
import { getClassIconSrc } from "@/app/foundation/classVisuals";
import { FoundationBandSlot } from "@/app/foundation/shell/foundation-band-slot";
import { BcMoralGesicht } from "@/components/foundation/broadcast";
import type { GameInboxItem, GameState, Player, Team } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { gelesenIdsFuer, inboxBesitzerFuerTeam } from "@/lib/foundation/inbox-gelesen";
import { getInboxQuickActions } from "@/lib/foundation/inbox-quick-action-service";
import {
  POSTFACH_ABSENDER,
  baueChecklisteFuerTeam,
  baueModell,
  baueTischGaeste,
  istTrainingsModus,
  meldungGehoertZuTeam,
  meldungsZeit,
  trainingsWunschFolgen,
  zaehleUngelesen,
  type PostfachAbsenderId,
  type PostfachEintrag,
  type PostfachOrdner,
  type PostfachSortierung,
  type WunschFolgen,
} from "@/lib/foundation/inbox-postfach";
import { resolveInboxTargetLabel } from "@/lib/foundation/inbox-target-labels";
import { buildTeamControlSettingsMap } from "@/lib/foundation/team-control-settings";
import { VORSTAND_STUFEN, resolveVorstandFreigabe } from "@/lib/finance/vorstand-budgetfreigabe";
import { moralStufe } from "@/lib/morale/moral-anzeige";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { sponsorWappenPfadFuer } from "@/lib/sponsor/sponsor-wappen";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";

import "./postfach-modern.css";

export type PostfachModernProps = {
  gameState: GameState;
  /** Alle Meldungen, die der Manager sehen darf (eigene Teams); Postfach und Zähler filtern selbst nach Team. */
  items: GameInboxItem[];
  aktivesTeamId: string;
  onWaehleTeam: (teamId: string) => void;
  /** Gelesen-Marke setzen oder löschen; der Schreibweg läuft über `/api/inbox/gelesen`. */
  onGelesen: (teamId: string, itemIds: string[], gelesen: boolean) => void;
  /** Trainingsintensität setzen: derselbe Weg wie auf der Entwicklungsseite. */
  onTrainingModus: (playerId: string, modus: PlayerTrainingMode) => void;
  onStatus: (item: GameInboxItem, status: GameInboxItem["status"]) => void;
  onOeffne: (item: GameInboxItem) => void;
  /** Nur ansehen (fremdes Team, Spielstand schreibgeschützt): keine Aktion schreibt. */
  schreibgeschuetzt?: boolean;
};

/* ------------------------------------------------------------------ Symbole (Pfade aus dem Mockup) */
const SYM: Record<string, ReactNode> = {
  post: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  haken: <path d="M5 12l5 5 9-10" />,
  warn: <path d="M12 3l10 18H2zM12 10v5M12 18v.5" />,
  auge: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  kabine: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" />
    </>
  ),
  arzt: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  vorstand: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V4h6v3M3 13h18" />
    </>
  ),
  sponsor: <path d="M7 4h10v5a5 5 0 01-10 0zM7 5H4a3 3 0 003 4M17 5h3a3 3 0 01-3 4M12 14v3M8 20h8" />,
  markt: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  vertrag: <path d="M6 3.5h9l4 4v13H6zM14.5 3.5V8H19M9 12h6M9 15.5h4" />,
  spieltag: <path d="M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2h-1M7 9h7M7 12.5h7M7 16h4" />,
  gebaeude: <path d="M3 21V10l9-6 9 6v11M3 21h18M9 21v-7h6v7" />,
  rechts: <path d="M9 5l7 7-7 7" />,
  schloss: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </>
  ),
  uhr: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

function Sym({ name }: { name: string }) {
  return (
    <svg className="ibx-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {SYM[name] ?? null}
    </svg>
  );
}

const ABSENDER_SYMBOL: Record<PostfachAbsenderId, string> = {
  kabine: "kabine",
  teamarzt: "arzt",
  vorstand: "vorstand",
  sponsor: "sponsor",
  markt: "markt",
  vertrag: "vertrag",
  spieltag: "spieltag",
  gebaeude: "gebaeude",
};

const KATEGORIE_WORT: Record<string, string> = {
  task: "Aufgabe",
  warning: "Warnung",
  news: "News",
  result: "Ergebnis",
  finance: "Finanzen",
  transfer: "Transfer",
  training: "Training",
  contract: "Vertrag",
  facility: "Gebäude",
  sponsor: "Sponsor",
};

/** Meldungen des Absenders „Sponsor“ zeigen das Wappen des laufenden Vertrags des Teams, sonst das Absender-Symbol. */
function sponsorWappenDerMeldung(gameState: GameState, eintrag: PostfachEintrag): string | null {
  if (eintrag.absender !== "sponsor" || !eintrag.item.teamId) return null;
  return sponsorWappenPfadFuer(getTeamSponsorContract(gameState, eintrag.item.teamId));
}

function absenderLabel(id: PostfachAbsenderId) {
  return POSTFACH_ABSENDER.find((a) => a.id === id)?.label ?? id;
}

/* ------------------------------------------------------------------ Aktionen einer Meldung */
type FolgeMarke = { text: string; ton: "p" | "m" | "n" };
type Aktion = {
  id: string;
  label: string;
  detail: string;
  folgen?: FolgeMarke[];
  empfohlen?: boolean;
  gilt: string;
  art: "wunsch-erfuellen" | "wunsch-ablehnen" | "training-leicht" | "oeffne";
};

function zahlText(wert: number, einheit = "", nachkomma = 0) {
  const gerundet = Number(wert.toFixed(nachkomma));
  return `${gerundet > 0 ? "+" : gerundet < 0 ? "−" : "±"}${Math.abs(gerundet).toString().replace(".", ",")}${einheit}`;
}

function folgenMarken(folgen: WunschFolgen, erfuellt: boolean): FolgeMarke[] {
  const marken: FolgeMarke[] = [{ text: `Moral ${zahlText(folgen.moral)}`, ton: folgen.moral >= 0 ? "p" : "m" }];
  if (erfuellt) {
    if (folgen.belastung !== 0) {
      marken.push({ text: `Belastung ${zahlText(folgen.belastung)}`, ton: folgen.belastung < 0 ? "p" : "m" });
    }
    if (folgen.entwicklung !== 0) {
      marken.push({ text: `Entwicklung ${zahlText(folgen.entwicklung, " XP/ST", 2)}`, ton: folgen.entwicklung > 0 ? "p" : "m" });
    }
  }
  return marken;
}

function wunschDaten(item: GameInboxItem): { wunsch: PlayerTrainingMode; aktuell: PlayerTrainingMode } | null {
  const wunsch = item.targetParams.wunsch;
  const aktuell = item.targetParams.aktuell;
  return istTrainingsModus(wunsch) && istTrainingsModus(aktuell) ? { wunsch, aktuell } : null;
}

function baueAktionen(eintrag: PostfachEintrag): Aktion[] {
  const { item } = eintrag;
  if (item.status !== "open") return [];
  const aktionen: Aktion[] = [];
  const wunsch = item.source === "player_training_wish" ? wunschDaten(item) : null;
  if (wunsch && item.playerId) {
    const folgen = trainingsWunschFolgen(wunsch.aktuell, wunsch.wunsch);
    aktionen.push({
      id: "wunsch-erfuellen",
      label: `Auf ${wunsch.wunsch} stellen`,
      detail: "Wunsch erfüllt. Gilt ab diesem Spieltag, jederzeit wieder änderbar.",
      folgen: folgenMarken(folgen.erfuellen, true),
      empfohlen: true,
      gilt: "Gilt sofort",
      art: "wunsch-erfuellen",
    });
    aktionen.push({
      id: "wunsch-ablehnen",
      label: `Bei ${wunsch.aktuell} bleiben`,
      detail: "Wunsch abgelehnt. Er bleibt beim Spieler bestehen, die Moral leidet weiter; die Meldung wandert nach „Erledigt“.",
      folgen: folgenMarken(folgen.ablehnen, false),
      gilt: "Gilt sofort",
      art: "wunsch-ablehnen",
    });
  }
  for (const quick of getInboxQuickActions(item)) {
    if (quick.id === "open-lineup" || quick.id === "open-target") {
      aktionen.push({
        id: quick.id,
        label: wunsch ? "Zum Training" : quick.label,
        detail: wunsch ? "Plan, Weg und Belastung im Ganzen ansehen." : quick.detail,
        gilt: "Öffnet Seite",
        art: "oeffne",
        empfohlen: aktionen.length === 0,
      });
    } else if (quick.id === "apply-training-light") {
      aktionen.push({
        id: quick.id,
        label: quick.label,
        detail: quick.detail,
        gilt: "Gilt sofort",
        art: "training-leicht",
        empfohlen: aktionen.length === 0,
      });
    }
  }
  return aktionen;
}

/* ------------------------------------------------------------------ Kacheln im Brief */
type Kachel = { titel: string; wert: ReactNode; unter: string };

function kachelnFuer(eintrag: PostfachEintrag, gameState: GameState, spieler: Player | null): Kachel[] {
  const { item } = eintrag;
  const moral = spieler ? gameState.playerMoraleState?.find((m) => m.playerId === spieler.id) : null;
  if (item.source === "player_training_wish" && spieler) {
    const daten = wunschDaten(item);
    return [
      {
        titel: "Moral",
        wert: <BcMoralGesicht wert={moral?.morale ?? null} groesse={26} />,
        unter: moral ? moralStufe(moral.morale).wort : "ohne Wert",
      },
      { titel: "Belastung", wert: Math.round(spieler.fatigue ?? 0), unter: "Gesamt aus Spielen und Training" },
      { titel: "Training jetzt", wert: daten?.aktuell ?? spieler.trainingMode ?? "mittel", unter: daten ? `Wunsch: ${daten.wunsch}` : "" },
    ];
  }
  if (item.source === "player_health_injury" && spieler && item.teamId) {
    const sicht = getPlayerAvailabilityView(gameState, spieler.id, item.teamId, gameState.matchdayState.matchdayId);
    const index = gameState.season.matchdayIds?.findIndex((id) => id === sicht.injuryUntilMatchday) ?? -1;
    return [
      { titel: "Fehlt bis", wert: index >= 0 ? `Spieltag ${index + 1}` : "offen", unter: "einsatzbereit danach" },
      { titel: "Risiko beim Einsatz", wert: sicht.injuryRiskLastRoll ? `${sicht.injuryRiskLastRoll.riskPercent} %` : "—", unter: "letzter Wurf" },
      { titel: "Belastung", wert: Math.round(sicht.fatigue), unter: "Gesamt aus Spielen und Training" },
    ];
  }
  if (item.source === "moral_gekippt" && spieler && moral?.vorher) {
    return [
      { titel: "Moral jetzt", wert: <BcMoralGesicht wert={moral.morale} groesse={26} />, unter: moralStufe(moral.morale).wort },
      { titel: "Moral vorher", wert: <BcMoralGesicht wert={moral.vorher.morale} groesse={26} />, unter: moralStufe(moral.vorher.morale).wort },
      { titel: "Belastung", wert: Math.round(spieler.fatigue ?? 0), unter: "Gesamt aus Spielen und Training" },
    ];
  }
  if (item.source === "vorstand_freigabe" && item.teamId) {
    const freigabe = resolveVorstandFreigabe(gameState, item.teamId);
    const naechste = [...VORSTAND_STUFEN].reverse().find((s) => s.abVertrauen > (freigabe.vertrauen ?? 0));
    return [
      { titel: "Freigabe", wert: `${Math.round(freigabe.anteil * 100)} %`, unter: "vom verfügbaren Budget" },
      { titel: "Vertrauen", wert: freigabe.vertrauen == null ? "—" : (Math.round(freigabe.vertrauen * 10) / 10).toString().replace(".", ","), unter: "1 bis 10" },
      { titel: "Nächste Stufe", wert: naechste ? `ab ${String(naechste.abVertrauen).replace(".", ",")}` : "erreicht", unter: naechste ? `${Math.round(naechste.anteil * 100)} % frei` : "" },
    ];
  }
  return [];
}

/* ------------------------------------------------------------------ Komponente */
export default function PostfachModern({
  gameState,
  items,
  aktivesTeamId,
  onWaehleTeam,
  onGelesen,
  onTrainingModus,
  onStatus,
  onOeffne,
  schreibgeschuetzt = false,
}: PostfachModernProps) {
  const [ordner, setOrdner] = useState<PostfachOrdner>("post");
  const [absender, setAbsender] = useState<PostfachAbsenderId | "alle">("alle");
  const [sortierung, setSortierung] = useState<PostfachSortierung>("dring");
  const [nurUngelesen, setNurUngelesen] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  // Was der Manager selbst auf „ungelesen“ gestellt hat, liest das Öffnen nicht gleich wieder weg.
  const [absichtlichUngelesen, setAbsichtlichUngelesen] = useState<ReadonlySet<string>>(() => new Set());

  const settingsMap = useMemo(
    () => buildTeamControlSettingsMap(gameState.teams, gameState.seasonState.teamControlSettings),
    [gameState.teams, gameState.seasonState.teamControlSettings],
  );
  const besitzer = inboxBesitzerFuerTeam(gameState, aktivesTeamId);
  const gelesen = useMemo(() => gelesenIdsFuer(gameState, besitzer), [gameState, besitzer]);
  const aktivesTeam = gameState.teams.find((team) => team.teamId === aktivesTeamId) ?? null;
  const settings = settingsMap[aktivesTeamId] ?? null;

  const eigeneTeams: Team[] = useMemo(
    () => gameState.teams.filter((team) => settingsMap[team.teamId]?.controlMode === "manual" && settingsMap[team.teamId]?.ownerId === besitzer),
    [gameState.teams, settingsMap, besitzer],
  );

  const teamItems = useMemo(() => items.filter((item) => meldungGehoertZuTeam(item, aktivesTeamId)), [items, aktivesTeamId]);
  const modell = useMemo(
    () => baueModell({ items: teamItems, gelesen, settings, ordner, absender, sortierung, nurUngelesen }),
    [teamItems, gelesen, settings, ordner, absender, sortierung, nurUngelesen],
  );
  const checkliste = useMemo(() => baueChecklisteFuerTeam(items, aktivesTeamId), [items, aktivesTeamId]);
  const tisch = useMemo(() => baueTischGaeste(gameState, besitzer, settingsMap), [gameState, besitzer, settingsMap]);

  const gewaehlterEintrag = modell.alle.find((eintrag) => eintrag.item.itemId === gewaehlt) ?? modell.alle[0] ?? null;
  const gewaehlteId = gewaehlterEintrag?.item.itemId ?? null;

  // Öffnen heißt lesen: die angezeigte Meldung wird (einmal) als gelesen gebucht.
  useEffect(() => {
    if (!gewaehlterEintrag || !gewaehlterEintrag.ungelesen || schreibgeschuetzt) return;
    if (absichtlichUngelesen.has(gewaehlterEintrag.item.itemId)) return;
    onGelesen(aktivesTeamId, [gewaehlterEintrag.item.itemId], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel der angezeigten Meldung
  }, [gewaehlteId, gewaehlterEintrag?.ungelesen]);

  const waehle = useCallback((eintrag: PostfachEintrag) => setGewaehlt(eintrag.item.itemId), []);

  const spielerVon = (item: GameInboxItem): Player | null =>
    item.playerId ? gameState.players.find((player) => player.id === item.playerId) ?? null : null;

  const fuehreAus = (eintrag: PostfachEintrag, aktion: Aktion) => {
    const { item } = eintrag;
    if (aktion.art === "oeffne") {
      onOeffne(item);
      return;
    }
    if (schreibgeschuetzt) return;
    const wunsch = wunschDaten(item);
    if (aktion.art === "wunsch-erfuellen" && wunsch && item.playerId) {
      onTrainingModus(item.playerId, wunsch.wunsch);
      return;
    }
    if (aktion.art === "wunsch-ablehnen") {
      onStatus(item, "done");
      return;
    }
    if (aktion.art === "training-leicht" && item.playerId) {
      onTrainingModus(item.playerId, "leicht");
    }
  };

  const naechste = () => {
    if (modell.alle.length === 0) return;
    const index = modell.alle.findIndex((eintrag) => eintrag.item.itemId === gewaehlteId);
    setGewaehlt(modell.alle[(index + 1) % modell.alle.length]!.item.itemId);
  };

  const alleInfoGelesen = () => {
    const ids = [...modell.blick, ...modell.bericht].filter((eintrag) => eintrag.ungelesen).map((eintrag) => eintrag.item.itemId);
    if (ids.length > 0) onGelesen(aktivesTeamId, ids, true);
  };

  const teamUngelesen = (teamId: string) => zaehleUngelesen(items.filter((item) => meldungGehoertZuTeam(item, teamId)), gelesen);

  const tastatur = (event: KeyboardEvent<HTMLDivElement>, eintrag: PostfachEintrag) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      waehle(eintrag);
    }
  };

  const { zaehler } = modell;

  return (
    <div className="bc ibx" data-testid="postfach" data-ordner={ordner} data-team={aktivesTeamId}>
      <FoundationBandSlot>
        <div className="bc ibx-band" data-testid="postfach-band">
          <BandZahl titel="Ungelesen" wert={zaehler.ungelesen} testid="postfach-zahl-ungelesen" />
          <BandZahl titel="Handeln" wert={zaehler.handeln} ton="acht" />
          <BandZahl titel="Hält auf" wert={zaehler.haelt} ton={zaehler.haelt > 0 ? "warn" : undefined} testid="postfach-zahl-haelt" />
          <BandZahl titel="Info" wert={zaehler.info} />
        </div>
      </FoundationBandSlot>

      {/* ---------------- Postfach (links) */}
      <section className="ibx-pan" aria-label="Postfach">
        <header className="ibx-pk">
          <h2>Postfach</h2>
          <span className="ibx-sp" />
          {zaehler.ungelesen > 0 ? <span className="ibx-zz ibx-w">{zaehler.ungelesen} ungelesen</span> : <span className="ibx-zz">alles gelesen</span>}
        </header>
        <div className="ibx-pb ibx-sc">
          <button type="button" className={`ibx-fl${ordner === "post" ? " ibx-an" : ""}`} onClick={() => setOrdner("post")} data-testid="postfach-ordner-post">
            <Sym name="post" />
            Posteingang
            {zaehler.ungelesen > 0 ? <u>{zaehler.ungelesen}</u> : null}
            <b className="ibx-t">{zaehler.posteingang}</b>
          </button>
          <button
            type="button"
            className={`ibx-fl${ordner === "erledigt" ? " ibx-an" : ""}${zaehler.erledigt === 0 ? " ibx-null" : ""}`}
            onClick={() => setOrdner("erledigt")}
            data-testid="postfach-ordner-erledigt"
          >
            <Sym name="haken" />
            Erledigt
            <b className="ibx-t">{zaehler.erledigt}</b>
          </button>

          <div className="ibx-ab">
            <b>Absender</b>
          </div>
          <button type="button" className={`ibx-abs${absender === "alle" ? " ibx-an" : ""}`} onClick={() => setAbsender("alle")} data-testid="postfach-absender-alle">
            <Sym name="post" />
            Alle
            <b className="ibx-t">{Object.values(modell.jeAbsender).reduce((summe, n) => summe + n, 0)}</b>
          </button>
          {POSTFACH_ABSENDER.map((eintrag) => (
            <button
              key={eintrag.id}
              type="button"
              className={`ibx-abs${absender === eintrag.id ? " ibx-an" : ""}${modell.jeAbsender[eintrag.id] === 0 ? " ibx-null" : ""}`}
              onClick={() => setAbsender(eintrag.id)}
              data-testid={`postfach-absender-${eintrag.id}`}
            >
              <Sym name={ABSENDER_SYMBOL[eintrag.id]} />
              {eintrag.label}
              <b className="ibx-t">{modell.jeAbsender[eintrag.id]}</b>
            </button>
          ))}

          <div className="ibx-ab">
            <b>Sortieren</b>
          </div>
          <div className="ibx-seg" role="group" aria-label="Sortierung">
            {(
              [
                ["dring", "Dringend"],
                ["neu", "Neueste"],
                ["absender", "Absender"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" className={sortierung === id ? "ibx-an" : undefined} aria-pressed={sortierung === id} onClick={() => setSortierung(id)} data-testid={`postfach-sort-${id}`}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="ibx-zeile" onClick={() => setNurUngelesen((wert) => !wert)} aria-pressed={nurUngelesen} data-testid="postfach-nur-ungelesen">
            <span>Nur ungelesene</span>
            <i className={`ibx-sw${nurUngelesen ? " ibx-an" : ""}`} aria-hidden="true" />
          </button>

          <div className="ibx-ab">
            <b>Meine Teams</b>
            <span>{eigeneTeams.length > 1 ? "je Team ein Postfach" : ""}</span>
          </div>
          <div className="ibx-tms">
            {eigeneTeams.map((team) => (
              <button
                key={team.teamId}
                type="button"
                className={`ibx-tm${team.teamId === aktivesTeamId ? " ibx-an" : ""}`}
                onClick={() => onWaehleTeam(team.teamId)}
                data-testid={`postfach-team-${team.teamId}`}
              >
                <TeamLogo team={team} />
                <span>
                  <b>{team.name}</b>
                  <small>{teamUngelesen(team.teamId)} ungelesen</small>
                </span>
                <strong className="ibx-t">{teamUngelesen(team.teamId)}</strong>
              </button>
            ))}
          </div>

          {checkliste.length > 0 ? (
            <>
              <div className="ibx-ab">
                <b>Spieltag</b>
                <span>
                  {checkliste.filter((zeile) => zeile.ok).length} von {checkliste.length} bereit
                </span>
              </div>
              {checkliste.map((zeile) => (
                <div key={zeile.id} className={`ibx-ck${zeile.ok ? " ibx-ok" : ""}`} data-testid="postfach-checkliste-zeile">
                  <i>{zeile.ok ? "✓" : ""}</i>
                  {zeile.label}
                </div>
              ))}
            </>
          ) : null}

          {tisch.length > 0 ? (
            <div className="ibx-tisch">
              <div className="ibx-ab">
                <b>Am Tisch</b>
                <span>eigene Postfächer</span>
              </div>
              <div className="ibx-tms">
                {tisch.map((gast) => (
                  <div key={gast.ownerId} className="ibx-tm ibx-fremd" data-testid="postfach-tisch-gast">
                    <span className={`ibx-mn ${gast.ownerId.startsWith("ramona") ? "ibx-r" : "ibx-f"}`}>{gast.name.slice(0, 1).toUpperCase()}</span>
                    <span>
                      <b>{gast.name}</b>
                      <small>
                        {gast.teamName} · {gast.stufe}
                      </small>
                    </span>
                    <Sym name="schloss" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------- Handeln */}
      <section className="ibx-pan ibx-bahn ibx-act" aria-label="Handeln" data-testid="postfach-bahn-handeln">
        <header className="ibx-pk">
          <span className="ibx-bi">
            <Sym name="warn" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2>Handeln</h2>
            <div className="ibx-fr">Was kostet dich etwas, wenn du es liegen lässt?</div>
          </div>
          <span className="ibx-sp" />
          <span className={`ibx-zz${modell.haelt.length + modell.vorher.length > 0 && ordner === "post" ? " ibx-w" : ""}`}>{modell.haelt.length + modell.vorher.length}</span>
        </header>
        <div className="ibx-pb ibx-sc">
          {modell.haelt.length > 0 ? (
            <>
              <Abschnitt titel="Hält den Spieltag auf" zahl={modell.haelt.length} />
              {modell.haelt.map((eintrag) => zeile(eintrag))}
            </>
          ) : null}
          {modell.vorher.length > 0 ? (
            <>
              <Abschnitt titel="Vor dem Spieltag entscheiden" zahl={modell.vorher.length} />
              {modell.vorher.map((eintrag) => zeile(eintrag))}
            </>
          ) : null}
          {modell.haelt.length + modell.vorher.length === 0 ? (
            <div className="ibx-leer" data-testid="postfach-handeln-leer">
              <svg className="ibx-i" viewBox="0 0 24 24" aria-hidden="true" style={{ fontSize: "2.6em" }}>
                <path d="M5 12l5 5 9-10" />
              </svg>
              <b>{ordner === "post" ? "Nichts offen — du bist durch." : "Hier liegt nichts Erledigtes."}</b>
              {ordner === "post" ? "Was den Spieltag aufhält oder vorher entschieden werden will, steht hier." : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------- Info */}
      <section className="ibx-pan ibx-bahn ibx-inf" aria-label="Info" data-testid="postfach-bahn-info">
        <header className="ibx-pk">
          <span className="ibx-bi">
            <Sym name="auge" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2>Info</h2>
            <div className="ibx-fr">Was wird bald wichtig, und was ist passiert?</div>
          </div>
          <span className="ibx-sp" />
          <span className="ibx-zz">{modell.blick.length + modell.bericht.length}</span>
          <button type="button" className="ibx-alle" onClick={alleInfoGelesen} disabled={schreibgeschuetzt || [...modell.blick, ...modell.bericht].every((e) => !e.ungelesen)} data-testid="postfach-alle-gelesen">
            Alle gelesen
          </button>
        </header>
        <div className="ibx-pb ibx-sc">
          {modell.blick.length > 0 ? (
            <>
              <Abschnitt titel="Im Blick behalten" zahl={modell.blick.length} />
              {modell.blick.map((eintrag) => zeile(eintrag))}
            </>
          ) : null}
          {modell.bericht.length > 0 ? (
            <>
              <Abschnitt titel="Berichte & Momente" zahl={modell.bericht.length} />
              {modell.bericht.map((eintrag) => zeile(eintrag))}
            </>
          ) : null}
          {modell.blick.length + modell.bericht.length === 0 ? (
            <div className="ibx-leer">
              <b>Nichts am Horizont.</b>
              Nach dem nächsten Spieltag steht hier, was passiert ist.
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------- Brief */}
      <section className="ibx-pan" aria-label="Brief" data-testid="postfach-brief">
        {gewaehlterEintrag ? (
          <Brief
            eintrag={gewaehlterEintrag}
            gameState={gameState}
            spieler={spielerVon(gewaehlterEintrag.item)}
            team={aktivesTeam}
            schreibgeschuetzt={schreibgeschuetzt}
            onAktion={(aktion) => fuehreAus(gewaehlterEintrag, aktion)}
            onUngelesen={() => {
              const id = gewaehlterEintrag.item.itemId;
              const jetztUngelesen = gewaehlterEintrag.ungelesen;
              setAbsichtlichUngelesen((alt) => {
                const neu = new Set(alt);
                if (jetztUngelesen) neu.delete(id);
                else neu.add(id);
                return neu;
              });
              onGelesen(aktivesTeamId, [id], jetztUngelesen);
            }}
            onWiederOeffnen={() => onStatus(gewaehlterEintrag.item, "open")}
            onNaechste={naechste}
          />
        ) : (
          <div className="ibx-pb">
            <div className="ibx-leer">
              <b>Kein Brief gewählt</b>
              Wähle links eine Meldung.
            </div>
          </div>
        )}
      </section>
    </div>
  );

  function zeile(eintrag: PostfachEintrag) {
    const { item } = eintrag;
    const spieler = spielerVon(item);
    const aktionen = baueAktionen(eintrag);
    const erste = aktionen[0] ?? null;
    const portrait = spieler ? getPlayerPortraitBrowserUrl(spieler.id, spieler.portraitUrl, spieler.portraitPath) : null;
    const wappen = sponsorWappenDerMeldung(gameState, eintrag);
    const istGewaehlt = item.itemId === gewaehlteId;
    const schwere = item.severity === "critical" ? "ibx-s-k" : item.severity === "warning" ? "ibx-s-w" : "";
    return (
      <div
        key={item.itemId}
        role="button"
        tabIndex={0}
        className={`ibx-ml${eintrag.ungelesen ? " ibx-neu" : ""}${istGewaehlt ? " ibx-an" : ""}${schwere ? ` ${schwere}` : ""}${item.status !== "open" ? " ibx-fertig" : ""}`}
        onClick={() => waehle(eintrag)}
        onKeyDown={(event) => tastatur(event, eintrag)}
        aria-current={istGewaehlt ? "true" : undefined}
        data-testid="postfach-meldung"
        data-meldung-id={item.itemId}
        data-ungelesen={eintrag.ungelesen ? "1" : "0"}
        data-haelt={eintrag.haelt ? "1" : "0"}
        data-quelle={item.source}
      >
        <span className="ibx-pkt" aria-hidden="true" />
        <span className={`ibx-av${spieler ? "" : ""}`}>
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" loading="lazy" />
          ) : wappen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sponsor-wappen ibx-wappen" src={wappen} alt="" loading="lazy" data-testid="postfach-sponsor-wappen" />
          ) : (
            <Sym name={ABSENDER_SYMBOL[eintrag.absender]} />
          )}
        </span>
        <span className="ibx-mt">
          <span className="ibx-ko">
            <span className="ibx-wer">{absenderLabel(eintrag.absender)}</span>
            <span>· {KATEGORIE_WORT[item.category] ?? item.category}</span>
            {eintrag.haelt ? <span className="ibx-mk ibx-halt">Hält den Spieltag auf</span> : null}
            {!eintrag.haelt && item.severity === "critical" ? <span className="ibx-mk ibx-krit">Kritisch</span> : null}
            {!eintrag.haelt && item.severity === "warning" ? <span className="ibx-mk ibx-warn">Warnung</span> : null}
            {eintrag.kiErledigt ? <span className="ibx-mk ibx-neu" data-testid="postfach-ki-marke">KI hat erledigt</span> : null}
            <span className="ibx-zt">{meldungsZeit(item, gameState)}</span>
          </span>
          <b className="ibx-ti">{item.title}</b>
          <small>{item.description}</small>
          {erste && !schreibgeschuetzt ? (
            <button
              type="button"
              className="ibx-go"
              onClick={(event) => {
                event.stopPropagation();
                waehle(eintrag);
                fuehreAus(eintrag, erste);
              }}
              data-testid="postfach-meldung-aktion"
            >
              {erste.label}
              <Sym name="rechts" />
            </button>
          ) : null}
        </span>
      </div>
    );
  }
}

function BandZahl({ titel, wert, ton, testid }: { titel: string; wert: number; ton?: "acht" | "warn"; testid?: string }) {
  return (
    <div className={`ibx-bz${ton ? ` ibx-${ton}` : ""}`} data-testid={testid}>
      <span>{titel}</span>
      <b className="ibx-t">{wert}</b>
    </div>
  );
}

function Abschnitt({ titel, zahl }: { titel: string; zahl: number }) {
  return (
    <div className="ibx-ug">
      <b>{titel}</b>
      <span>{zahl}</span>
      <i />
    </div>
  );
}

function TeamLogo({ team }: { team: Team }) {
  const logo = getTeamLogoBrowserUrl(team.teamId, team.logoPath ?? null);
  // eslint-disable-next-line @next/next/no-img-element
  return logo ? <img className="ibx-lg ibx-k" src={logo} alt="" /> : <span className="ibx-lg ibx-k" aria-hidden="true" />;
}

function Brief({
  eintrag,
  gameState,
  spieler,
  team,
  schreibgeschuetzt,
  onAktion,
  onUngelesen,
  onWiederOeffnen,
  onNaechste,
}: {
  eintrag: PostfachEintrag;
  gameState: GameState;
  spieler: Player | null;
  team: Team | null;
  schreibgeschuetzt: boolean;
  onAktion: (aktion: Aktion) => void;
  onUngelesen: () => void;
  onWiederOeffnen: () => void;
  onNaechste: () => void;
}) {
  const { item } = eintrag;
  const aktionen = baueAktionen(eintrag);
  const kacheln = kachelnFuer(eintrag, gameState, spieler);
  const portrait = spieler ? getPlayerPortraitBrowserUrl(spieler.id, spieler.portraitUrl, spieler.portraitPath) : null;
  const wappen = sponsorWappenDerMeldung(gameState, eintrag);
  const klasse = spieler?.className ? klassenKartenfarbe(spieler.className) : null;
  const klassenIcon = spieler?.className ? getClassIconSrc(spieler.className) : null;
  const ziel = resolveInboxTargetLabel(item);
  return (
    <>
      <header className="ibx-bk">
        <span className="ibx-gr2">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt="" />
          ) : wappen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="sponsor-wappen ibx-wappen" src={wappen} alt="" />
          ) : (
            <Sym name={ABSENDER_SYMBOL[eintrag.absender]} />
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="ibx-mks">
            <span className="ibx-mk">{eintrag.bahn === "handeln" ? "Handeln" : "Info"}</span>
            <span className="ibx-mk">{KATEGORIE_WORT[item.category] ?? item.category}</span>
            {eintrag.haelt ? <span className="ibx-mk ibx-halt">Hält den Spieltag auf</span> : null}
            {eintrag.kiErledigt ? <span className="ibx-mk ibx-neu">KI hat erledigt</span> : null}
          </div>
          <h3 data-testid="postfach-brief-titel">{item.title}</h3>
          <div className="ibx-von">
            <span>
              Von <b>{absenderLabel(eintrag.absender)}</b>
            </span>
            {spieler ? (
              <>
                <span>·</span>
                <b>{spieler.name}</b>
                {spieler.className ? (
                  <span className="ibx-kls" style={klasse ? ({ "--kf": klasse.farbe } as CSSProperties) : undefined}>
                    {klassenIcon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={klassenIcon} alt="" />
                    ) : null}
                    {spieler.className}
                  </span>
                ) : null}
              </>
            ) : null}
            {team ? <span>· {team.name}</span> : null}
            <span>· {meldungsZeit(item, gameState)}</span>
          </div>
        </div>
      </header>
      <div className="ibx-pb ibx-sc" style={{ gap: 0 }}>
        <p className="ibx-txt" data-testid="postfach-brief-text" style={{ margin: "0 0 0.6em", fontSize: "1.05em" }}>
          {item.description}
        </p>
        {kacheln.length > 0 ? (
          <div className="ibx-kas3" data-testid="postfach-brief-kacheln">
            {kacheln.map((kachel) => (
              <div key={kachel.titel} className="ibx-fk">
                <span>{kachel.titel}</span>
                <strong className="ibx-t">{kachel.wert}</strong>
                <small>{kachel.unter}</small>
              </div>
            ))}
          </div>
        ) : null}
        {aktionen.length > 0 ? (
          <>
            <div className="ibx-ab">
              <b>Deine Optionen</b>
              <span>mit Folgen</span>
            </div>
            {aktionen.map((aktion) => (
              <button
                key={aktion.id}
                type="button"
                className={`ibx-wahl${aktion.empfohlen ? " ibx-emp" : ""}`}
                onClick={() => onAktion(aktion)}
                disabled={schreibgeschuetzt && aktion.art !== "oeffne"}
                data-testid={`postfach-option-${aktion.id}`}
              >
                <b>
                  {aktion.label}
                  {aktion.empfohlen ? <span className="ibx-mk ibx-gold" style={{ color: "var(--gold)", borderColor: "rgba(240,195,90,.6)" }}>Empfohlen</span> : null}
                </b>
                <small>{aktion.detail}</small>
                {aktion.folgen && aktion.folgen.length > 0 ? (
                  <span className="ibx-fo">
                    {aktion.folgen.map((folge) => (
                      <i key={folge.text} className={`ibx-${folge.ton}`}>
                        {folge.text}
                      </i>
                    ))}
                  </span>
                ) : null}
                <span className="ibx-ar">
                  {aktion.gilt}
                  <Sym name="rechts" />
                </span>
              </button>
            ))}
          </>
        ) : item.status !== "open" ? (
          <p className="ibx-txt" data-testid="postfach-brief-erledigt" style={{ marginTop: "0.8em" }}>
            Diese Meldung liegt in „Erledigt“.
            {item.source === "player_training_wish" ? " Der Wunsch bleibt beim Spieler bestehen und wirkt weiter auf die Moral." : ""}
          </p>
        ) : ziel ? (
          <p className="ibx-txt">Hier ist nichts zu entscheiden. Mehr dazu: {ziel}.</p>
        ) : null}
      </div>
      <footer className="ibx-fuss2">
        <button type="button" className="ibx-kn" onClick={onUngelesen} disabled={schreibgeschuetzt} data-testid="postfach-brief-ungelesen" title="Gelesen-Marke setzen oder löschen">
          <Sym name="post" />
          {eintrag.ungelesen ? "Als gelesen markieren" : "Ungelesen"}
        </button>
        {item.status !== "open" ? (
          <button type="button" className="ibx-kn" onClick={onWiederOeffnen} disabled={schreibgeschuetzt} data-testid="postfach-brief-wieder-oeffnen">
            <Sym name="uhr" />
            Zurück in den Posteingang
          </button>
        ) : null}
        <span className="ibx-sp" />
        <button type="button" className="ibx-kn ibx-gold" onClick={onNaechste} data-testid="postfach-brief-naechste">
          Nächste
          <Sym name="rechts" />
        </button>
      </footer>
    </>
  );
}
