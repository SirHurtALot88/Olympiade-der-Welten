"use client";

/**
 * EINSATZLISTE MODERN (Welle 1, 17.11.) — der Broadcast-Stil für die echte Seite.
 *
 * Vorlage: public/mockups/einsatzliste-modern-17-11.html, Plan: docs/design/oly-seiten-modern-17-11.md.
 * Diese Ansicht nimmt dieselben Props wie `LineupNewLook` (die klassische bleibt daneben erreichbar,
 * `lib/lineups/einsatzliste-look.ts`) und erfindet keine Spiellogik: Platzwerte, Rollen, Kandidaten,
 * Verletzungsrisiko, Formkarten, Captains, Validierung und Speichern kommen aus den Props, die der
 * Client ohnehin berechnet. Neu gerechnet wird nur Anzeige (Gold-Raute, Gegner-Schätzung, Waage) und
 * die Verteilung für „Optimieren"/„Auffüllen" (`einsatzliste-modern-logik.ts`).
 *
 * WAS DER PROTOTYP ERFUNDEN HATTE UND HIER FEHLT: Spieler-Form (Pfeil), Siegchance, Gruppenprognose.
 * Es gibt im Spielstand keine Spieler-Form; Erschöpfung (`fatigueCount`), Verletzung und
 * Verletzungsrisiko sind echt und stehen an deren Stelle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BcHero, BcIcon, BcMarke, BcPanel, BcReiter, BcSeg, BcSheet, BcTable, BcChip, BcLast, type BcTableColumn } from "@/components/foundation/broadcast";
import { getDisciplineIconSrc } from "@/app/foundation/DisciplineIcon";
import { getPlayerPortraitInitials, getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import {
  GOLD_TOLERANZ,
  goldPruefung,
  passungsGlyphe,
  slotFarbe,
  slotKuerzelFuerListe,
  type Glyphe,
} from "@/lib/lineups/einsatzliste-anzeige";
import {
  bauePruefsaetze,
  berechneVerteilung,
  gewichtsZeilen,
  lastTon,
  setzeMitTausch,
  type Pruefsatz,
  type Seite,
} from "@/lib/lineups/einsatzliste-modern-logik";
import { setzeEinsatzlisteLook } from "@/lib/lineups/einsatzliste-look";
import { formationFuerSeite, type GelegteFormation } from "@/lib/lineups/formation";
import { schaetzeGegnerAufstellung, type GegnerSchaetzung } from "@/lib/lineups/gegner-schaetzung";
import { uebersetzeLineupFehlerListe } from "@/lib/lineups/lineup-fehlertexte";
import type { MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";
import { normalisiereStrategie, strategieVorlagenFuer } from "@/lib/lineups/strategie-vorlagen";

import type { LineupNewLookProps } from "@/app/foundation/legacy-lineup-lab/LineupNewLook";
import { FeldHintergrund } from "@/app/foundation/legacy-lineup-lab/EinsatzlisteFeldHintergrund";
import {
  FormMoralMarke,
  FormMoralProfil,
  FormMoralUebersicht,
  KartenMarke,
  KartenWirkungPanel,
  WarumBlock,
  type UrsachenZeile,
} from "@/app/foundation/legacy-lineup-lab/FormMoralBausteine";
import { baueFormMoralAnzeige, moralUrsachen, type FormMoralAnzeige } from "@/lib/lineups/form-moral-anzeige";
import { berechneKartenWirkung } from "@/lib/lineups/formkarten-wirkung";
import "./einsatzliste-modern.css";

type Props = LineupNewLookProps;
type Karte = Props["rosterCardByActivePlayerId"] extends Map<string, infer C> ? C : never;
type KandidatEintrag = Props["candidateGroups"][number]["entries"][number];

const SEITEN: readonly Seite[] = ["d1", "d2"];
const ZAHL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f1 = (wert: number | null | undefined) => (wert == null || !Number.isFinite(wert) ? "–" : ZAHL.format(wert));
const f0 = (wert: number | null | undefined) => (wert == null || !Number.isFinite(wert) ? "–" : String(Math.round(wert)));
const vz = (wert: number) => `${wert > 0 ? "+" : wert < 0 ? "−" : "±"}${ZAHL.format(Math.abs(wert))}`;
const attrName = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
const STUFEN: ReadonlyArray<{ id: MatchdayIntensityStage; label: string; heiss?: boolean }> = [
  { id: "conserve", label: "Schonen" },
  { id: "normal", label: "Normal" },
  { id: "push", label: "Vollgas", heiss: true },
];
const FORM_HEX: Record<string, string> = { red: "#ff8b86", green: "#a8e7aa", blue: "#a9ccff", yellow: "#ffd987" };
const GLYPHEN_TON: Record<Glyphe, string> = { "++": "bc-plus", "+": "bc-plus", "·": "bc-null", "−": "bc-minus", "−−": "bc-minus" };

/** Verbindliche Sperrgründe: Spieler, die gar nicht antreten können oder dürfen (nicht: „steht in der anderen Disziplin"). */
const SPERRTEXT: Record<string, string> = {
  player_injured_unavailable: "verletzt",
  captain_not_allowed: "Captain der anderen Seite",
  slot_rule_not_fulfilled: "kein Wert hier",
};

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

export default function EinsatzlisteModern(props: Props) {
  const {
    context,
    slots,
    selections,
    activeSlotKey,
    onActiveSlotChange,
    rosterCardByActivePlayerId,
    slotCandidateSummaryByKey,
    slotPreviewByKey,
    slotRoleByKey,
    slotIssuesByKey,
    candidateGroups,
    playerBestSlotSummaryByActivePlayerId,
    captains,
    captainSelectEntriesBySide,
    captainInfoBySide,
    captainDraftRemaining,
    captainSeasonUsedWithDraft,
    captainSeasonLimit,
    onUpdateCaptain,
    d1Rank,
    d2Rank,
    getSelectedOptionMeta,
    onAssignPlayer,
    onClearSlot,
    onApplyAssignments,
    onUndo,
    undoInfo,
    isReadOnly,
    isBusy,
    matchdayPreviewCards,
    lineupFlowSummary,
    lineupSaveCta,
    lineupReadyToSave,
    lineupFinishItems,
    onSaveDraft,
    getDisciplineIntensity,
    onUpdateDisciplineIntensity,
    disciplineTacticPreviewBySide,
    playerFilter,
    onPlayerFilterChange,
    controlsSlot,
    arenaReady = false,
    onNavigateArena,
    statusMessage,
    errors,
    rosterShortfall = null,
    spieltagsGegner = null,
    getDisciplineStrategie,
    onUpdateDisciplineStrategie,
    formCardControlsBySide,
    onAssignDisciplineFormCard,
    formCardSavePendingSide,
    staffelPairGamesByKey = null,
    kulisseBySide = null,
    teamPowerControlsBySide,
    onAssignTeamPower,
    onOpenPlayer,
  } = props;

  const [seite, setSeite] = useState<Seite>("d1");
  const [kontextTab, setKontextTab] = useState<"rolle" | "gegner" | "pruefung" | "formmoral">("rolle");
  const [blatt, setBlatt] = useState<null | "kader" | "kontext">(null);
  const [steuerungOffen, setSteuerungOffen] = useState(false);
  const [sortKey, setSortKey] = useState<"platz" | "disz" | "last" | "name">("platz");
  const [kaderFilter, setKaderFilter] = useState<"alle" | "frei" | "gesetzt" | "gesperrt">("alle");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [profilBlatt, setProfilBlatt] = useState<string | null>(null);
  const [warumId, setWarumId] = useState<string | null>(null);
  const [zieht, setZieht] = useState<{ id: string; von: string | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [ruettel, setRuettel] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const kannBedienen = !isReadOnly && !isBusy;

  const meldung = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => void (toastTimer.current && window.clearTimeout(toastTimer.current)), []);
  const letzteStatus = useRef(statusMessage);
  useEffect(() => {
    if (statusMessage && statusMessage !== letzteStatus.current) meldung(statusMessage);
    letzteStatus.current = statusMessage;
  }, [statusMessage, meldung]);

  /* ---------------- Grunddaten je Seite ---------------- */
  const disziplin = (s: Seite) => (s === "d1" ? context?.matchdayContract?.discipline1 : context?.matchdayContract?.discipline2) ?? null;
  const slotsJeSeite = useMemo(
    () => ({
      d1: slots.filter((slot) => slot.disciplineSide === "d1").sort((a, b) => a.slotIndex - b.slotIndex),
      d2: slots.filter((slot) => slot.disciplineSide === "d2").sort((a, b) => a.slotIndex - b.slotIndex),
    }),
    [slots],
  );

  const kuerzelJeSlot = useMemo(() => {
    const karte = new Map<string, string>();
    for (const s of SEITEN) {
      const liste = slotsJeSeite[s];
      const kuerzel = slotKuerzelFuerListe(liste.map((slot) => slotRoleByKey.get(slot.key)?.label ?? `Slot ${slot.slotIndex + 1}`));
      liste.forEach((slot, index) => karte.set(slot.key, kuerzel[index] ?? "–"));
    }
    return karte;
  }, [slotsJeSeite, slotRoleByKey]);

  const slotName = useCallback(
    (slotKey: string) => {
      const slot = slots.find((entry) => entry.key === slotKey);
      return slot ? `${slot.disciplineSide.toUpperCase()}-${slot.slotIndex + 1} ${slotRoleByKey.get(slotKey)?.label ?? ""}`.trim() : "Platz";
    },
    [slots, slotRoleByKey],
  );
  const spielerName = useCallback(
    (id: string) => rosterCardByActivePlayerId.get(id)?.name ?? getSelectedOptionMeta(id)?.name ?? "Spieler",
    [rosterCardByActivePlayerId, getSelectedOptionMeta],
  );

  const platzVonSpieler = useMemo(() => {
    const karte = new Map<string, string>();
    for (const [slotKey, id] of Object.entries(selections)) if (id) karte.set(id, slotKey);
    return karte;
  }, [selections]);

  // Aktiver Platz: der des Clients, solange er zur gewählten Seite passt, sonst der erste offene.
  const aktiverSlot = useMemo(() => {
    const gesetzt = activeSlotKey ? slots.find((slot) => slot.key === activeSlotKey) ?? null : null;
    return gesetzt && gesetzt.disciplineSide === seite ? gesetzt : null;
  }, [activeSlotKey, slots, seite]);
  const fokusSlot = aktiverSlot ?? slotsJeSeite[seite].find((slot) => !selections[slot.key]) ?? slotsJeSeite[seite][0] ?? null;

  // Der Client-Zustand folgt der Seite: eine andere Seite zu wählen heißt, ihren Platz zu fokussieren.
  const waehleSeite = useCallback(
    (naechste: Seite) => {
      setSeite(naechste);
      const ziel = slotsJeSeite[naechste].find((slot) => !selections[slot.key]) ?? slotsJeSeite[naechste][0];
      if (ziel) onActiveSlotChange(ziel.key);
    },
    [slotsJeSeite, selections, onActiveSlotChange],
  );
  const ersteSynchronisation = useRef(false);
  useEffect(() => {
    if (ersteSynchronisation.current) return;
    const slot = activeSlotKey ? slots.find((entry) => entry.key === activeSlotKey) : null;
    if (slot) {
      ersteSynchronisation.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliges Übernehmen der Client-Seite
      setSeite(slot.disciplineSide);
    }
  }, [activeSlotKey, slots]);

  /* ---------------- Gold (Bestbesetzung) und Gegner-Schätzung ---------------- */
  const verletzte = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, karte] of rosterCardByActivePlayerId) {
      if (karte.availabilityBlocker === "player_injured_unavailable" || karte.injuryStatus === "injured") ids.add(id);
    }
    return ids;
  }, [rosterCardByActivePlayerId]);

  const gold = useMemo(
    () =>
      goldPruefung({
        slotKeys: slots.map((slot) => slot.key),
        slotWerteJeSpieler: playerBestSlotSummaryByActivePlayerId.entries(),
        nameVon: (id) => rosterCardByActivePlayerId.get(id)?.name ?? id,
        ausgeschlossen: verletzte,
      }),
    [slots, playerBestSlotSummaryByActivePlayerId, rosterCardByActivePlayerId, verletzte],
  );

  const gegner = useMemo<GegnerSchaetzung>(() => {
    if (!context) return { status: "unbekannt", grund: "Kontext nicht geladen" };
    const seiten = SEITEN.flatMap((s) => {
      const id = (s === "d1" ? context.matchdayContract?.discipline1 : context.matchdayContract?.discipline2)?.disciplineId ?? null;
      const slotCount = slots.filter((slot) => slot.disciplineSide === s).length;
      return id && slotCount > 0 ? [{ seite: s, disciplineId: id, slotCount }] : [];
    });
    try {
      return schaetzeGegnerAufstellung({
        gameState: context.gameState,
        eigenesTeamId: context.team.id,
        seasonId: context.season.id,
        matchdayId: context.matchday.id,
        seiten,
      });
    } catch {
      return { status: "unbekannt", grund: "Gegner noch nicht bekannt" };
    }
  }, [context, slots]);

  const formation = useMemo(() => {
    const karte = {} as Record<Seite, GelegteFormation>;
    for (const s of SEITEN) karte[s] = formationFuerSeite(disziplin(s)?.disciplineId ?? null, slotsJeSeite[s].length);
    return karte;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context?.matchdayContract?.discipline1, context?.matchdayContract?.discipline2, slotsJeSeite]);

  /* ---------------- Platzdaten ---------------- */
  const captainSeite = useMemo(() => {
    const karte = new Map<string, Seite>();
    if (captains.d1) karte.set(captains.d1, "d1");
    if (captains.d2) karte.set(captains.d2, "d2");
    return karte;
  }, [captains]);

  const eignung = useCallback(
    (id: string, s: Seite): number | null => {
      const karte = rosterCardByActivePlayerId.get(id);
      const wert = s === "d1" ? karte?.discipline1Score : karte?.discipline2Score;
      return typeof wert === "number" ? wert : null;
    },
    [rosterCardByActivePlayerId],
  );
  const platzWert = useCallback(
    (id: string, slotKey: string) => playerBestSlotSummaryByActivePlayerId.get(id)?.find((e) => e.slotKey === slotKey)?.projectedScore ?? null,
    [playerBestSlotSummaryByActivePlayerId],
  );
  const kannSpielen = useCallback(
    (id: string, slotKey: string) => {
      const slot = slots.find((entry) => entry.key === slotKey);
      if (!slot || verletzte.has(id) || platzWert(id, slotKey) == null) return false;
      const cap = captainSeite.get(id);
      return !cap || cap === slot.disciplineSide;
    },
    [slots, verletzte, platzWert, captainSeite],
  );

  /* ---------------- Aktionen ---------------- */
  const setzeAuf = useCallback(
    (slotKey: string, id: string) => {
      if (!kannBedienen) return;
      const slot = slots.find((entry) => entry.key === slotKey);
      if (!slot) return;
      if (verletzte.has(id)) return meldung(`${spielerName(id)} ist verletzt und kann nicht antreten.`);
      if (!kannSpielen(id, slotKey)) return meldung(`${spielerName(id)} kann hier nicht eingesetzt werden.`);
      const alt = platzVonSpieler.get(id);
      if (alt === slotKey) return;
      if (!alt) {
        onAssignPlayer(slotKey, id);
        return;
      }
      if (!onApplyAssignments) {
        if (slots.find((entry) => entry.key === alt)?.disciplineSide === slot.disciplineSide) onAssignPlayer(slotKey, id);
        return;
      }
      const neu = setzeMitTausch(selections, slotKey, id, (verdraengter, frei) => kannSpielen(verdraengter, frei));
      const andereSeite = slots.find((entry) => entry.key === alt)?.disciplineSide !== slot.disciplineSide;
      onApplyAssignments(
        neu,
        andereSeite ? `${spielerName(id)} aus ${slotName(alt)} geholt` : `${spielerName(id)} umgesetzt`,
        `${slotName(slotKey)} · vorher ${slotName(alt)}`,
      );
    },
    [kannBedienen, slots, verletzte, meldung, spielerName, kannSpielen, platzVonSpieler, onAssignPlayer, onApplyAssignments, selections, slotName],
  );

  const werteListe = useMemo(() => [...playerBestSlotSummaryByActivePlayerId.entries()], [playerBestSlotSummaryByActivePlayerId]);
  const verteile = (modus: "optimieren" | "auffuellen") => {
    if (!kannBedienen || !onApplyAssignments) return;
    const v = berechneVerteilung({
      modus,
      slots: slots.map((slot) => ({ key: slot.key, side: slot.disciplineSide })),
      selections,
      werte: werteListe,
      ausgeschlossen: verletzte,
      captainSeite,
      nameVon: spielerName,
    });
    if (v.wechsel.length === 0) {
      meldung(modus === "optimieren" ? "Das ist schon die beste Verteilung." : "Es gibt nichts aufzufüllen.");
      return;
    }
    onApplyAssignments(
      v.neu,
      modus === "optimieren" ? `Optimiert (${vz(v.gewinn)} Platzwert)` : `${v.wechsel.length} Plätze aufgefüllt`,
      `${v.wechsel.length} Plätze geändert`,
    );
  };
  const leeren = () => {
    if (!kannBedienen || !onApplyAssignments) return;
    onApplyAssignments(Object.fromEntries(slots.map((slot) => [slot.key, ""])), "Einsatzliste geleert", "Alle Plätze");
  };

  // Tasten D / A / O / Z / Esc (die Zifferntasten und Pfeile gehören dem Client).
  const tastenRef = useRef<{ d: () => void; a: () => void; o: () => void; z: () => void }>({ d() {}, a() {}, o() {}, z() {} });
  useEffect(() => {
    tastenRef.current = {
      d: () => waehleSeite(seite === "d1" ? "d2" : "d1"),
      a: () => verteile("auffuellen"),
      o: () => verteile("optimieren"),
      z: () => undoInfo && onUndo(),
    };
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const ziel = event.target as HTMLElement | null;
      if (ziel && (/^(input|textarea|select)$/i.test(ziel.tagName) || ziel.isContentEditable)) return;
      if (event.key === "Escape") {
        setProfilBlatt(null);
        setBlatt(null);
        setSteuerungOffen(false);
        return;
      }
      const taste = event.key.toLowerCase();
      if (taste === "d") tastenRef.current.d();
      else if (taste === "a") tastenRef.current.a();
      else if (taste === "o") tastenRef.current.o();
      else if (taste === "z") tastenRef.current.z();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ---------------- Kader ---------------- */
  const fokusWert = fokusSlot ? slotPreviewByKey.get(fokusSlot.key)?.projected.totalProjected ?? null : null;
  const fokusBesetzer = fokusSlot ? selections[fokusSlot.key] ?? "" : "";

  type KaderZeile = {
    id: string;
    karte: KandidatEintrag["player"];
    wert: number | null;
    delta: number | null;
    sperre: string | null;
    platz: string | null;
    disz: number | null;
    last: number | null;
    gold: boolean;
  };
  const kaderZeilen = useMemo<KaderZeile[]>(() => {
    const gesehen = new Map<string, KaderZeile>();
    for (const gruppe of candidateGroups) {
      for (const eintrag of gruppe.entries) {
        const id = eintrag.player.activePlayerId;
        if (!id || gesehen.has(id)) continue;
        const asc = eintrag.activeSlotCandidate;
        const wert = fokusSlot ? (platzWert(id, fokusSlot.key) ?? asc?.projectedScore ?? null) : null;
        const grund = asc?.blockReason ?? null;
        const hart = grund && grund !== "already_assigned_other_discipline" ? (SPERRTEXT[grund] ?? "gesperrt") : null;
        gesehen.set(id, {
          id,
          karte: eintrag.player,
          wert,
          delta: wert != null && fokusWert != null && fokusBesetzer && fokusBesetzer !== id ? Number((wert - fokusWert).toFixed(1)) : null,
          sperre: hart,
          platz: platzVonSpieler.get(id) ?? null,
          disz: fokusSlot ? eignung(id, fokusSlot.disciplineSide) : null,
          last: eintrag.player.fatigueCount ?? null,
          gold: fokusSlot ? (gold.kostenVon(id, fokusSlot.key) ?? Infinity) <= GOLD_TOLERANZ : false,
        });
      }
    }
    return [...gesehen.values()];
  }, [candidateGroups, fokusSlot, fokusWert, fokusBesetzer, platzVonSpieler, platzWert, eignung, gold]);

  const sichtbar = useMemo(() => {
    const suche = playerFilter.trim().toLowerCase();
    let liste = kaderZeilen.filter((zeile) => !suche || zeile.karte.name.toLowerCase().includes(suche));
    if (kaderFilter === "frei") liste = liste.filter((z) => !z.platz && !z.sperre);
    if (kaderFilter === "gesetzt") liste = liste.filter((z) => z.platz);
    if (kaderFilter === "gesperrt") liste = liste.filter((z) => z.sperre);
    const zahl = (z: KaderZeile) => (sortKey === "disz" ? z.disz : sortKey === "last" ? z.last : z.wert);
    return [...liste].sort((a, b) => {
      if (a.sperre && !b.sperre) return 1;
      if (!a.sperre && b.sperre) return -1;
      if (sortKey === "name") return a.karte.name.localeCompare(b.karte.name, "de");
      const x = zahl(a);
      const y = zahl(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return sortKey === "last" ? x - y : y - x;
    });
  }, [kaderZeilen, playerFilter, kaderFilter, sortKey]);

  const hoverZeile = hoverId ? kaderZeilen.find((z) => z.id === hoverId) ?? null : null;

  /* ---------------- Waage ---------------- */
  const waage = useMemo(() => {
    const liste = slotsJeSeite[seite];
    const eigen = liste.flatMap((slot) => {
      const id = selections[slot.key];
      const wert = id ? eignung(id, seite) : null;
      return wert != null ? [{ slot, wert }] : [];
    });
    const sum = (zahlen: number[]) => zahlen.reduce((a, b) => a + b, 0);
    let eigenSchnitt = eigen.length ? sum(eigen.map((e) => e.wert)) / eigen.length : null;
    let vorschau: number | null = null;
    if (hoverZeile && fokusSlot && hoverZeile.disz != null && eigenSchnitt != null) {
      const ohne = eigen.filter((e) => e.slot.key !== fokusSlot.key && selections[e.slot.key] !== hoverZeile.id);
      const mit = [...ohne.map((e) => e.wert), hoverZeile.disz];
      vorschau = sum(mit) / mit.length;
    } else if (hoverZeile && fokusSlot && hoverZeile.disz != null && eigenSchnitt == null) {
      vorschau = hoverZeile.disz;
    }
    if (eigenSchnitt == null && vorschau == null) eigenSchnitt = null;
    const gegnerSeite = gegner.status === "geschaetzt" ? gegner.seiten[seite] ?? null : null;
    const spannen = gegnerSeite?.slots.flatMap((s) => (s.spanne ? [s.spanne] : [])) ?? [];
    const gMin = spannen.length ? sum(spannen.map((s) => s.min)) / spannen.length : gegnerSeite?.schnitt?.min ?? null;
    const gMax = spannen.length ? sum(spannen.map((s) => s.max)) / spannen.length : gegnerSeite?.schnitt?.max ?? null;
    return { eigenSchnitt, vorschau, gMin, gMax, gMid: gMin != null && gMax != null ? (gMin + gMax) / 2 : null };
  }, [slotsJeSeite, seite, selections, eignung, hoverZeile, fokusSlot, gegner]);

  /* ---------------- Prüfung ---------------- */
  const blockierend = useMemo(() => errors.filter((code) => code !== "lineup_draft_is_locked"), [errors]);
  const gesperrtHinweis = errors.find((code) => code === "lineup_draft_is_locked") ?? null;
  const pruefsaetze = useMemo<Pruefsatz[]>(
    () =>
      bauePruefsaetze({
        finishItems: lineupFinishItems,
        slotIssues: slotIssuesByKey,
        slots,
        selections,
        slotName,
        playerName: spielerName,
        fehlerCodes: blockierend,
        gesperrtHinweis,
        kaderLueckeSatz: rosterShortfall ? `${rosterShortfall.headline} ${rosterShortfall.detail}` : null,
      }),
    [lineupFinishItems, slotIssuesByKey, slots, selections, slotName, spielerName, blockierend, gesperrtHinweis, rosterShortfall],
  );
  const fehlerAnzahl = pruefsaetze.filter((s) => s.ton === "fehler").length;
  const warnAnzahl = pruefsaetze.filter((s) => s.ton === "warnung").length;
  const abgegeben = lineupSaveCta.label === "Arena bereit";
  const gesperrt = !lineupReadyToSave || fehlerAnzahl > 0;

  const springe = (slotKey?: string) => {
    if (!slotKey) return;
    const slot = slots.find((entry) => entry.key === slotKey);
    if (slot) setSeite(slot.disciplineSide);
    onActiveSlotChange(slotKey);
    setKontextTab("rolle");
  };
  const abgabeKlick = () => {
    if (abgegeben) {
      if (arenaReady && onNavigateArena) onNavigateArena();
      return;
    }
    if (gesperrt) {
      setKontextTab("pruefung");
      setBlatt("kontext");
      setRuettel(true);
      window.setTimeout(() => setRuettel(false), 350);
      return;
    }
    onSaveDraft();
  };

  /* ---------------- Rendern ---------------- */
  /* ---------------- Form + Moral (18.11.) ---------------- */
  const gs = context?.gameState ?? null;
  const formMoralVon = useMemo(() => {
    const karte = new Map<string, FormMoralAnzeige>();
    for (const [aid, k] of rosterCardByActivePlayerId) karte.set(aid, baueFormMoralAnzeige(gs, k.id));
    return karte;
  }, [gs, rosterCardByActivePlayerId]);
  const fmVon = (aid: string | null | undefined) => (aid ? formMoralVon.get(aid) ?? null : null);
  const disziplinNameVon = (id: string) => (gs?.disciplines ?? []).find((d) => d.id === id)?.name ?? id;
  const ursachenVon = (aid: string): UrsachenZeile[] => {
    const k = rosterCardByActivePlayerId.get(aid);
    return k ? moralUrsachen(gs, k.id, context?.team.id ?? null) : [];
  };
  // Karten-Wirkung je Seite aus DERSELBEN Funktion wie die Wertung (calculateFormModifierForSide);
  // die Auswahl kommt aus den Formkarten-Dropdowns.
  const kartenWirkungJeSeite = useMemo(() => {
    const ergebnis = {} as Record<Seite, ReturnType<typeof berechneKartenWirkung> | null>;
    for (const sd of SEITEN) {
      const steuerung = formCardControlsBySide?.[sd] ?? null;
      const d = (sd === "d1" ? context?.matchdayContract?.discipline1 : context?.matchdayContract?.discipline2) ?? null;
      if (!steuerung || !d || !context) {
        ergebnis[sd] = null;
        continue;
      }
      const spielerIds = slots
        .filter((slot) => slot.disciplineSide === sd)
        .map((slot) => selections[slot.key])
        .filter((aid): aid is string => Boolean(aid))
        .map((aid) => rosterCardByActivePlayerId.get(aid)?.id)
        .filter((id): id is string => Boolean(id));
      ergebnis[sd] = berechneKartenWirkung({
        gameState: gs,
        side: sd,
        disciplineId: d.disciplineId,
        disciplineCategory: d.category,
        formCards: context.formCards ?? [],
        primaryCardId: steuerung.primarySelectedId,
        secondaryCardId: steuerung.secondarySelectedId,
        playerIds: spielerIds,
        rosterPlayers: context.rosterPlayers,
      });
    }
    return ergebnis;
  }, [formCardControlsBySide, context, slots, selections, rosterCardByActivePlayerId, gs]);
  const kartenFuerSpieler = (sd: Seite, playerId: string | undefined) =>
    playerId ? kartenWirkungJeSeite[sd]?.spieler.find((x) => x.playerId === playerId)?.zerlegung ?? null : null;

  if (!context) {
    return (
      <div className="bc elm" data-testid="lineup-modern">
        {isBusy ? (
          <p className="elm-leer" role="status" aria-busy="true">Spieltag-Kontext wird geladen…</p>
        ) : (
          <div className="elm-leer" role="alert" data-testid="lineup-context-unavailable">
            <p>Die Einsatzliste liess sich fuer diesen Spieltag nicht aufbauen.</p>
            {errors.length > 0 ? <p>{uebersetzeLineupFehlerListe(errors).join(" · ")}</p> : <p>Es kam kein Spieltags-Kontext. Bitte die Seite neu laden.</p>}
          </div>
        )}
      </div>
    );
  }

  const stufe = getDisciplineIntensity(seite);
  const dSeite = disziplin(seite);
  const form = formation[seite];
  const rollenZeile = (slotKey: string) => slotRoleByKey.get(slotKey)?.label ?? "Platz";

  // Staffel: Badge am Nehmer, solange das Paar direkt benachbart steht (wie klassisch).
  const staffelPaar = new Map<string, { spiele: number; geber: string }>();
  if (dSeite?.disciplineId === "staffel" && staffelPairGamesByKey) {
    const besetzt = slotsJeSeite[seite].flatMap((slot) => (selections[slot.key] ? [{ key: slot.key, id: selections[slot.key]! }] : []));
    for (let i = 1; i < besetzt.length; i += 1) {
      const spiele = staffelPairGamesByKey[`${rosterCardByActivePlayerId.get(besetzt[i - 1]!.id)?.id}>${rosterCardByActivePlayerId.get(besetzt[i]!.id)?.id}`] ?? 0;
      if (spiele > 0) staffelPaar.set(besetzt[i]!.key, { spiele, geber: spielerName(besetzt[i - 1]!.id) });
    }
  }

  const platzKarte = (slot: (typeof slots)[number]) => {
    const platz = form.plaetze.find((p) => p.slotIndex === slot.slotIndex);
    let x = platz?.x ?? 0.5;
    let y = platz?.y ?? 0.5;
    // Viele Plätze auf einer Leiste (Bühne, Tafel, Staffel): zwei Reihen, damit die Karten nicht überlappen.
    const reihig = (form.definition.anordnung === "nach-index" || form.definition.anordnung === "verschraenkt") && slotsJeSeite[seite].length > 3;
    const spaltenZahl = reihig ? Math.ceil(slotsJeSeite[seite].length / 2) : 0;
    if (reihig) {
      const i = slotsJeSeite[seite].findIndex((entry) => entry.key === slot.key);
      x = ((i % spaltenZahl) + 0.5) / spaltenZahl;
      y = i < spaltenZahl ? 0.27 : 0.73;
    }
    const x2 = form.definition.gegner === "spiegel-x" ? Math.min(0.88, Math.max(0.12, x * 2)) : x;
    const id = selections[slot.key] ?? "";
    const karte = id ? rosterCardByActivePlayerId.get(id) ?? null : null;
    const vorschau = slotPreviewByKey.get(slot.key) ?? null;
    const farbe = slotFarbe(slot.slotIndex);
    const meta = id ? getSelectedOptionMeta(id) : null;
    const last = meta?.fatigueCount ?? karte?.fatigueCount ?? null;
    const risiko = meta?.injuryRiskProjection?.[stufe] ?? null;
    const issues = slotIssuesByKey.get(slot.key) ?? [];
    const hatFehler = issues.some((i) => i.tone === "blocked" && i.label !== "Hier weiter" && i.label !== "Offen") || (id !== "" && verletzte.has(id));
    const kosten = id ? gold.kostenVon(id, slot.key) : null;
    const istGold = id !== "" && kosten != null && kosten <= GOLD_TOLERANZ;
    const verschenkt = id !== "" && kosten != null && kosten > GOLD_TOLERANZ;
    const glyphe = vorschau?.projected.roleModifier != null && id ? passungsGlyphe(vorschau.projected.roleModifier) : null;
    const bester = !id ? slotCandidateSummaryByKey.get(slot.key)?.topCandidates[0] ?? null : null;
    const ist = fokusSlot?.key === slot.key;
    const paar = staffelPaar.get(slot.key);
    const klassen = ["elm-slot", id ? "" : "is-offen", ist ? "is-gew" : "", zieht && kannBedienen ? "is-ziel" : "", hatFehler ? "is-fehl" : ""].filter(Boolean).join(" ");
    return (
      <div
        key={slot.key}
        id={`lineup-slot-${slot.key}`}
        role="button"
        tabIndex={0}
        className={klassen}
        style={{ "--x": x, "--y": y, "--x2": x2, "--pc": farbe, ...(reihig ? { "--w": `calc(${100 / spaltenZahl}% - 14px)` } : {}) } as React.CSSProperties}
        data-testid={`elm-slot-${slot.key}`}
        aria-label={`${slotName(slot.key)}${karte ? `: ${karte.name}` : ": offen"}`}
        draggable={Boolean(id) && kannBedienen}
        onDragStart={(event) => {
          if (!id || !kannBedienen) return event.preventDefault();
          event.dataTransfer.setData("text/plain", id);
          event.dataTransfer.effectAllowed = "move";
          setZieht({ id, von: slot.key });
        }}
        onDragEnd={() => setZieht(null)}
        onDragOver={(event) => zieht && kannBedienen && event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (zieht) setzeAuf(slot.key, zieht.id);
          setZieht(null);
        }}
        onClick={() => {
          onActiveSlotChange(slot.key);
          setKontextTab("rolle");
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) setBlatt("kader");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActiveSlotChange(slot.key);
          }
        }}
      >
        {istGold ? <i className="elm-slot__raute" title="Bestbesetzung: Hier steht, wo die beste Verteilung des ganzen Kaders ihn hinstellt." /> : null}
        {verschenkt ? <i className="elm-slot__raute is-leer" title={`Bestbesetzung verschenkt: Diese Besetzung kostet die Gesamtverteilung ${f1(kosten)}.`} /> : null}
        {id && captains[slot.disciplineSide] === id ? <span className="elm-slot__cap" title="Captain">C</span> : null}
        {paar ? <span className="elm-slot__lf" title={`Übernimmt den Stab von ${paar.geber}`}>{paar.spiele}× eingespielt</span> : null}
        <span className="elm-slot__ro">
          <BcMarke farbe={farbe}>{kuerzelJeSlot.get(slot.key) ?? "–"}</BcMarke>
          <span>{rollenZeile(slot.key)}</span>
        </span>
        {karte ? (
          <>
            <Por klasse="elm-slot__por" url={karte.portraitUrl} name={karte.name} />
            <span className="elm-slot__nm" title={karte.name}>{karte.name}</span>
            <span className="elm-slot__ze bc-t">
              <strong>{f1(vorschau?.projected.totalProjected)}</strong>
              {glyphe ? <span className={`pg ${GLYPHEN_TON[glyphe]}`} title="Rollenpassung (Aufschlag der Rolle in Punkten)">{glyphe}</span> : null}
              {last != null ? <BcLast wert={last} titel={`Erschöpfung ${Math.round(last)} von 100`} /> : null}
              {fmVon(id) ? (
                <button type="button" className="fm-wz" data-testid={`fm-marke-${slot.key}`} onClick={(event) => { event.stopPropagation(); setWarumId(id); setKontextTab("formmoral"); setBlatt("kontext"); }} title="Warum? Form und Moral dieses Spielers">
                  <FormMoralMarke a={fmVon(id)!} />
                </button>
              ) : null}
              {(() => {
                const z = kartenFuerSpieler(seite, karte?.id);
                const w = kartenWirkungJeSeite[seite];
                return z && w?.buchung.gebucht ? <KartenMarke alle={z.alle} traeger={z.traeger} form={z.form} farbe={w.karten[0]?.farbe ?? null} /> : null;
              })()}
              {risiko ? <span className={risiko.riskPercent >= 8 ? "bc-minus" : "bc-null"} title="Verletzungsrisiko dieses Einsatzes" style={{ fontSize: 12, fontWeight: 700 }}>{f1(risiko.riskPercent)}%</span> : null}
            </span>
            {kannBedienen ? (
              <button
                type="button"
                className="elm-slot__weg"
                aria-label={`${karte.name} aus dem Platz nehmen`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClearSlot(slot.key);
                }}
              >
                <BcIcon name="x" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            <span className="elm-slot__por" style={{ borderStyle: "dashed" }}><BcIcon name="plus" /></span>
            <span className="elm-slot__nm" style={{ color: "var(--bc-leise)" }}>Offen</span>
            {bester ? (
              <button
                type="button"
                className="elm-slot__tipp"
                disabled={!kannBedienen}
                title={bester.fitDetail}
                onClick={(event) => {
                  event.stopPropagation();
                  onAssignPlayer(slot.key, bester.activePlayerId);
                }}
              >
                Beste: <b>{bester.name}</b> {f1(bester.projectedScore)}
              </button>
            ) : (
              <span className="elm-slot__tipp">Kein Spieler mit Wert</span>
            )}
          </>
        )}
      </div>
    );
  };

  /* ---- Kader-Spalten ---- */
  const spalten: BcTableColumn<KaderZeile>[] = [
    {
      key: "por",
      breite: "40px",
      render: (z) => <Por klasse="elm-kz__por" url={z.karte.portraitUrl} name={z.karte.name} />,
    },
    {
      key: "name",
      kopf: "Spieler",
      breite: "minmax(0,1fr)",
      onKopf: () => setSortKey("name"),
      aktiv: sortKey === "name",
      render: (z) => (
        <span className="elm-kz__nm">
          <b>{z.karte.name}</b>
          <span>
            {z.sperre ? <BcMarke ton="rot">{z.sperre}</BcMarke> : null}
            {z.platz ? (
              <BcMarke farbe={slotFarbe(slots.find((s) => s.key === z.platz)?.slotIndex ?? 0)} titel={`Steht in ${slotName(z.platz)}`}>
                {z.platz.startsWith("d1") ? "D1" : "D2"} {kuerzelJeSlot.get(z.platz) ?? ""}
              </BcMarke>
            ) : null}
            {z.karte.className ?? ""}
          </span>
        </span>
      ),
    },
    {
      key: "disz",
      kopf: "Eignung",
      breite: "52px",
      rechts: true,
      onKopf: () => setSortKey("disz"),
      aktiv: sortKey === "disz",
      render: (z) => <span className="elm-kz__dz bc-t">{f0(z.disz)}</span>,
    },
    {
      key: "platz",
      kopf: "Platzwert",
      breite: "64px",
      rechts: true,
      onKopf: () => setSortKey("platz"),
      aktiv: sortKey === "platz",
      render: (z) => (
        <span className="elm-kz__sw bc-t">
          <strong>{f1(z.wert)}</strong>
          {z.delta != null ? <small className={z.delta > 0 ? "bc-plus" : z.delta < 0 ? "bc-minus" : "bc-null"}>{vz(z.delta)}</small> : null}
        </span>
      ),
    },
    {
      key: "fm",
      kopf: "Form · Moral",
      breite: "74px",
      render: (z) => {
        const a = fmVon(z.id);
        return a ? (
          <button type="button" className="fm-wz" onClick={(event) => { event.stopPropagation(); setWarumId(z.id); setKontextTab("formmoral"); setBlatt("kontext"); }} title="Warum? Form und Moral">
            <FormMoralMarke a={a} />
          </button>
        ) : null;
      },
    },
    {
      key: "last",
      kopf: "Last",
      breite: "46px",
      rechts: true,
      onKopf: () => setSortKey("last"),
      aktiv: sortKey === "last",
      render: (z) =>
        z.last != null ? (
          <span className="elm-kz__last">
            <small className="bc-t">{f0(z.last)}</small>
            <BcLast wert={z.last} titel={`Erschöpfung ${Math.round(z.last)} von 100 (${lastTon(z.last)})`} />
          </span>
        ) : null,
    },
  ];

  /* ---- Kontext: Rolle ---- */
  const rolle = fokusSlot ? slotRoleByKey.get(fokusSlot.key) ?? null : null;
  const fokusFarbe = fokusSlot ? slotFarbe(fokusSlot.slotIndex) : "var(--bc-leise)";
  const fokusKarte: Karte | null = fokusBesetzer ? rosterCardByActivePlayerId.get(fokusBesetzer) ?? null : hoverZeile ? rosterCardByActivePlayerId.get(hoverZeile.id) ?? null : null;
  const fokusVorschau = fokusSlot ? slotPreviewByKey.get(fokusSlot.key)?.projected ?? null : null;
  const gewichte = gewichtsZeilen(
    (context.disciplineWeights ?? []).filter((w) => w.disciplineId === dSeite?.disciplineId),
    rolle,
  );
  const fokusMeta = fokusKarte?.activePlayerId ? getSelectedOptionMeta(fokusKarte.activePlayerId) : null;
  const fokusRisiko = fokusMeta?.injuryRiskProjection?.[stufe] ?? null;
  const belastung = fokusVorschau?.slotStrainLoad ?? (rolle ? ({ low: "niedrig", medium: "mittel", high: "hoch" } as const)[rolle.fatigueProfile] : null);
  const werteAttr = (key: string): number | null => {
    const wert = fokusKarte?.attributeStats?.[key];
    return typeof wert === "number" ? wert : null;
  };
  const topKandidaten = fokusSlot ? slotCandidateSummaryByKey.get(fokusSlot.key)?.topCandidates.slice(0, 5) ?? [] : [];

  const rolleTab = fokusSlot ? (
    <>
      <div className="elm-rk" style={{ "--pc": fokusFarbe } as React.CSSProperties}>
        <span className="bc-gk">
          {fokusSlot.disciplineSide.toUpperCase()}-{fokusSlot.slotIndex + 1} · {kuerzelJeSlot.get(fokusSlot.key)}
        </span>
        <h3>{rolle?.label ?? "Platz"}</h3>
        <p>{rolle?.description ?? "Für diesen Platz ist keine Rollenbeschreibung hinterlegt."}</p>
        {form.plaetze.find((p) => p.slotIndex === fokusSlot.slotIndex)?.zeile ? (
          <p style={{ marginTop: 6, color: "var(--bc-stumm)" }}>{form.plaetze.find((p) => p.slotIndex === fokusSlot.slotIndex)?.zeile}</p>
        ) : null}
      </div>

      <div className="elm-ab">
        <span className="bc-gk">Besetzt mit</span>
        {fokusBesetzer && fokusKarte ? (
          <>
            <div className="elm-bes" style={{ "--pc": fokusFarbe } as React.CSSProperties}>
              <Por klasse="por" url={fokusKarte.portraitUrl} name={fokusKarte.name} />
              <div>
                <b>{fokusKarte.name}</b>
                <span>{fokusKarte.className ?? ""}</span>
              </div>
            </div>
            {fokusVorschau ? (
              <div className="elm-rech bc-t" title="Rechenweg des Platzwerts">
                <div><small>Eignung</small><strong>{f1(fokusVorschau.baseScore)}</strong></div>
                <div><small>Rolle</small><strong>{vz(fokusVorschau.roleModifier ?? 0)}</strong></div>
                <div><small>Einsatz</small><strong>{vz((fokusVorschau.intensityModifier ?? 0) + (fokusVorschau.rivalryPressureModifier ?? 0))}</strong></div>
                <div><small>Last</small><strong>{vz(fokusVorschau.fatigueModifier ?? 0)}</strong></div>
                <div className="su"><small>Platz</small><strong>{f1(fokusVorschau.totalProjected)}</strong></div>
              </div>
            ) : null}
          </>
        ) : (
          <p style={{ color: "var(--bc-leise)", fontSize: 14.5 }}>Noch niemand gesetzt. Rechts siehst du, wer hier am besten passt.</p>
        )}
      </div>

      <div className="elm-ab">
        <span className="bc-gk">
          <span>Was hier zählt</span>
          <span>Gewicht · {fokusKarte ? `Wert ${fokusKarte.name.split(" ")[0]}` : "Wert"}</span>
        </span>
        {gewichte.length === 0 ? <p style={{ color: "var(--bc-leise)", fontSize: 14 }}>Keine Matrixgewichte für diese Disziplin im Spielstand.</p> : null}
        {gewichte.map((z) => {
          const wert = werteAttr(z.attribut);
          return (
            <div key={z.attribut} className="elm-attr">
              <span className="nm">
                <span>{attrName(z.attribut)}</span>
                {z.rolle ? (
                  <span
                    className="elm-abz"
                    title={z.rolle === "schwerpunkt" ? "Schwerpunkt dieses Platzes: bringt hier den Rollen-Bonus." : "Nebenfokus dieses Platzes: bringt hier einen kleineren Rollen-Bonus."}
                  >
                    {z.rolle === "schwerpunkt" ? "Schwerpunkt" : "Nebenfokus"}
                  </span>
                ) : null}
              </span>
              <span className="gw bc-t" title="Gewicht in der Disziplin-Matrix">{f0(z.gewichtPct)} %</span>
              <span className="wt bc-t">{f0(wert)}</span>
              <span className="elm-attr__bn"><i style={{ width: `${Math.max(0, Math.min(100, wert ?? 0))}%` }} /></span>
            </div>
          );
        })}
      </div>

      {rolle ? (
        <div className="elm-ab">
          <span className="bc-gk">Belastung</span>
          <div className="elm-belast">
            Dieser Platz verschleißt <b>{attrName(rolle.strainAttribute)}</b>
            {belastung ? <> (Belastung <b>{belastung}</b>)</> : null}.
            {fokusKarte ? (
              <>
                {" "}{fokusKarte.name}: {attrName(rolle.strainAttribute)} {f0(werteAttr(rolle.strainAttribute))}
                {fokusMeta?.fatigueCount != null ? <>, Erschöpfung {f0(fokusMeta.fatigueCount)}{fokusRisiko ? <> → {f0(fokusRisiko.fatigueBeforeRoll)}</> : null}</> : null}
                {fokusRisiko ? <>, Verletzungsrisiko <b>{f1(fokusRisiko.riskPercent)} %</b></> : null}.
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="elm-ab">
        <span className="bc-gk">Beste Kandidaten</span>
        {topKandidaten.length === 0 ? <p style={{ color: "var(--bc-leise)", fontSize: 14 }}>Keine Kandidaten.</p> : null}
        {topKandidaten.map((k, index) => (
          <button key={k.activePlayerId} type="button" className="elm-kand" disabled={!kannBedienen} onClick={() => setzeAuf(fokusSlot.key, k.activePlayerId)} title={k.fitDetail}>
            <span className="bc-t bc-null">{index + 1}</span>
            <Por klasse="por" url={rosterCardByActivePlayerId.get(k.activePlayerId)?.portraitUrl} name={k.name} />
            <b>{k.name}</b>
            <strong className="bc-t">{f1(k.projectedScore)}</strong>
          </button>
        ))}
        <div className="elm-akt">
          {fokusBesetzer && kannBedienen ? (
            <button type="button" className="bc-btn bc-btn--klein" onClick={() => onClearSlot(fokusSlot.key)}>Platz leeren</button>
          ) : null}
          {fokusKarte?.id ? (
            <button type="button" className="bc-btn bc-btn--klein" onClick={() => onOpenPlayer(fokusKarte.id, fokusKarte.activePlayerId)}>Spielerprofil</button>
          ) : null}
        </div>
      </div>
    </>
  ) : (
    <p className="elm-leer">Wähle einen Platz auf dem Feld.</p>
  );

  /* ---- Kontext: Gegner ---- */
  const duellSlots = slotsJeSeite[seite];
  const gegnerSeite = gegner.status === "geschaetzt" ? gegner.seiten[seite] ?? null : null;
  const gruppeEintrag = spieltagsGegner?.find((eintrag) => eintrag.disciplineSide === seite) ?? null;
  const rivalen = (dSeite?.disciplineId ? context.teamPowerWindows?.[dSeite.disciplineId]?.top8Rivals : null) ?? [];
  const formMoralTab = (() => {
    const waehle = warumId ?? fokusBesetzer ?? null;
    const a = fmVon(waehle);
    const zeilen = slotsJeSeite[seite].flatMap((slot) => {
      const aid = selections[slot.key];
      const k = aid ? rosterCardByActivePlayerId.get(aid) : null;
      const an = fmVon(aid);
      return aid && k && an ? [{ id: aid, name: k.name, platz: slotName(slot.key), a: an }] : [];
    });
    const w = kartenWirkungJeSeite[seite];
    return (
      <div className="fm-tab">
        {waehle && a ? (
          <>
            <h3 style={{ margin: "0 0 6px" }}>{spielerName(waehle)}</h3>
            <WarumBlock a={a} ursachen={ursachenVon(waehle)} disziplinName={disziplinNameVon} onProfil={() => setProfilBlatt(waehle)} />
            <hr style={{ borderColor: "var(--bc-linie)", margin: "12px 0" }} />
          </>
        ) : null}
        <FormMoralUebersicht zeilen={zeilen} onWaehle={(id) => setWarumId(id)} />
        {w ? (
          <>
            <hr style={{ borderColor: "var(--bc-linie)", margin: "12px 0" }} />
            <KartenWirkungPanel w={w} namen={(pid) => [...rosterCardByActivePlayerId.values()].find((k) => k.id === pid)?.name ?? pid} />
          </>
        ) : null}
      </div>
    );
  })();

  const gegnerTab = (
    <>
      {gegner.status === "geschaetzt" ? (
        <div className="elm-geg">
          <span className="bc-gk">{gruppeEintrag?.art === "pod" ? "Gegner in der Gruppe" : "Gegner"} · {gegner.steuerung === "ki" ? "KI" : "Mensch"}</span>
          <b>{gegner.gegnerName}</b>
          <span title="Scouting-Stufe der Kader-Spieler, gemittelt">
            Scouting Stufe {gegner.stufe} von 5 · Treffsicherheit ca. {gegner.treffsicherheitPct} %
          </span>
          <span>
            {gegner.quelle === "verdeckt"
              ? "Auf dieser Stufe ist die Aufstellung nicht erkennbar."
              : gegner.quelle === "ki-muster"
                ? "Aufstellung aus dem erkannten Einsatzmuster der KI. Immer noch eine Schätzung."
                : "Wahrscheinlichste beste Aufstellung (Prognose). Der Gegner kann abweichen."}
          </span>
        </div>
      ) : (
        <p className="elm-leer">{gegner.grund}.</p>
      )}
      {gruppeEintrag && gruppeEintrag.gegnerNamen.length > 0 ? (
        <div className="elm-ab">
          <span className="bc-gk">{gruppeEintrag.art === "pod" ? "Vierergruppe" : "Duell"}</span>
          <p style={{ fontSize: 15 }}>{gruppeEintrag.gegnerNamen.join(" · ")}</p>
        </div>
      ) : null}
      {gegnerSeite ? (
        <div className="elm-ab">
          <span className="bc-gk"><span>Platz gegen Platz</span><span>Eignung</span></span>
          {duellSlots.map((slot) => {
            const eigenId = selections[slot.key];
            const eigenWert = eigenId ? eignung(eigenId, seite) : null;
            const g = gegnerSeite.slots.find((s) => s.slotIndex === slot.slotIndex);
            const stand = eigenWert != null && g?.spanne ? (eigenWert > g.spanne.max ? ["▲", "bc-plus"] : eigenWert < g.spanne.min ? ["▼", "bc-minus"] : ["≈", "bc-null"]) : ["·", "bc-null"];
            return (
              <div key={slot.key} className="elm-duell bc-t" title={stand[0] === "≈" ? "Innerhalb der Unsicherheit" : undefined}>
                <span className="l">{eigenId ? `${spielerName(eigenId)} ${f0(eigenWert)}` : "—"}</span>
                <span className={`m ${stand[1]}`}>{stand[0]} {kuerzelJeSlot.get(slot.key)}</span>
                <span className="r">{g?.spielerName ? `${g.spielerName} ${g.spanne ? `${g.spanne.min}–${g.spanne.max}` : ""}` : "unbekannt"}</span>
              </div>
            );
          })}
          <p style={{ fontSize: 12.5, color: "var(--bc-stumm)", marginTop: 8 }}>
            Gezeigt wird die rohe Disziplin-Eignung, nicht der Platzwert mit Rolle und Einsatz. Grau heißt: innerhalb der Unsicherheit.
          </p>
        </div>
      ) : null}
      {rivalen.length > 0 ? (
        <div className="elm-ab">
          <span className="bc-gk">Zu schlagen (Saison-Rivalen)</span>
          {rivalen.slice(0, 3).map((r) => (
            <div key={r.teamId} className="elm-duell" style={{ gridTemplateColumns: "40px minmax(0,1fr)" }}>
              <b className="bc-t">#{r.rank}</b>
              <span>{r.teamName}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );

  /* ---- Kontext: Prüfung ---- */
  const pruefTab = (
    <>
      {pruefsaetze.map((s) => (
        <div key={s.id}>
          {s.slotKey ? (
            <button type="button" className={`elm-pr is-${s.ton === "fehler" ? "fe" : s.ton === "warnung" ? "wa" : s.ton === "hinweis" ? "hi" : "ok"}`} onClick={() => springe(s.slotKey)}>
              <span className="ik">{s.ton === "fehler" ? "!" : s.ton === "warnung" ? "!" : s.ton === "hinweis" ? "i" : "✓"}</span>
              <span>{s.satz}{s.code ? <code>{s.code}</code> : null}</span>
              <span className="geh">Zum Platz ›</span>
            </button>
          ) : (
            <div className={`elm-pr is-${s.ton === "fehler" ? "fe" : s.ton === "warnung" ? "wa" : s.ton === "hinweis" ? "hi" : "ok"}`}>
              <span className="ik">{s.ton === "fehler" ? "!" : s.ton === "warnung" ? "!" : s.ton === "hinweis" ? "i" : "✓"}</span>
              <span>{s.satz}{s.code ? <code>{s.code}</code> : null}</span>
              <span />
            </div>
          )}
        </div>
      ))}
    </>
  );

  /* ---- Taktik ---- */
  const formSteuerung = formCardControlsBySide?.[seite] ?? null;
  const formWartet = formCardSavePendingSide?.[seite] ?? false;
  const strategieVorlagen = getDisciplineStrategie && onUpdateDisciplineStrategie ? strategieVorlagenFuer(dSeite?.disciplineId ?? null) : [];
  const powerSteuerung = teamPowerControlsBySide?.[seite] ?? null;
  const captainEintraege = captainSelectEntriesBySide[seite] ?? [];
  const captainInfo = new Map((captainInfoBySide[seite] ?? []).map((info) => [info.activePlayerId, info] as const));
  const tacticVorschau = disciplineTacticPreviewBySide?.[seite] ?? null;

  const formKartenplatz = (art: "primary" | "secondary", titel: string) => {
    if (!formSteuerung) return null;
    const gewaehlt = art === "primary" ? formSteuerung.primarySelectedId : formSteuerung.secondarySelectedId;
    const optionen = art === "primary" ? formSteuerung.primaryOptions : formSteuerung.secondaryOptions;
    const treffer = optionen.find((o) => o.id === gewaehlt) ?? null;
    return (
      <FormMenue
        key={art}
        titel={titel}
        gewaehlt={treffer}
        optionen={optionen}
        gesperrt={!kannBedienen || formWartet}
        onWahl={(id) => onAssignDisciplineFormCard?.(seite, art, id, formSteuerung.disciplineId)}
      />
    );
  };

  const kulisse = kulisseBySide?.[seite] ?? null;
  const ges = (matchdayPreviewCards.d1Projected ?? 0) + (matchdayPreviewCards.d2Projected ?? 0);
  const gesamtOffen = matchdayPreviewCards.d1Projected == null && matchdayPreviewCards.d2Projected == null;

  return (
    <div className={`bc elm${ruettel ? " bc-ruettel" : ""}`} data-testid="lineup-modern">
      <BcHero
        wappen={getStaticTeamLogoUrl(context.team.id) ?? context.team.logoPath ?? null}
        wappenAlt={context.team.name}
        dachzeile={<>Einsatzliste · Spieltag {context.matchday.index}</>}
        titel={context.team.name}
        untertitel={<><b>{context.season.name}</b> · {lineupFlowSummary.selectedCount} von {slots.length} Plätzen besetzt</>}
        mitte={SEITEN.map((s) => {
          const d = disziplin(s);
          if (!d) return null;
          const liste = slotsJeSeite[s];
          const projiziert = s === "d1" ? matchdayPreviewCards.d1Projected : matchdayPreviewCards.d2Projected;
          const ikon = getDisciplineIconSrc(d.disciplineId, d.displayName);
          return (
            <BcReiter
              key={s}
              aktiv={seite === s}
              onClick={() => waehleSeite(s)}
              eyebrow={`${s.toUpperCase()} · Rang ${(s === "d1" ? d1Rank : d2Rank) ?? "–"}`}
              titel={d.displayName}
              symbol={ikon ? <img src={ikon} alt="" /> : d.displayName.slice(0, 2)}
              strich={liste.map((slot) => {
                const id = selections[slot.key];
                if (!id) return "leer" as const;
                return verletzte.has(id) || (slotIssuesByKey.get(slot.key) ?? []).some((i) => i.tone === "blocked" && i.label !== "Hier weiter") ? ("fe" as const) : ("an" as const);
              })}
              wert={projiziert != null ? f0(projiziert) : "–"}
              wertNote="erwartet"
              titelAttr={`${d.displayName}: ${liste.filter((slot) => selections[slot.key]).length} von ${liste.length} Plätzen besetzt`}
            />
          );
        })}
        rechts={
          <>
            <button type="button" className="bc-btn" onClick={() => setSteuerungOffen(true)} data-bc-tip="Team, Spieltag, KI-Vorschläge und Sammelabgabe">
              <BcIcon name="team" /> Team &amp; Spieltag
            </button>
            <button type="button" className="bc-btn bc-btn--klein" onClick={() => setzeEinsatzlisteLook("klassisch")} data-bc-tip="Zur bisherigen Einsatzliste wechseln" aria-label="Klassische Ansicht">
              Klassisch
            </button>
          </>
        }
      />

      <div className="elm-work">
        {/* ------------ Kader ------------ */}
        <BcSheet
          offen={blatt === "kader"}
          onSchliessen={() => setBlatt(null)}
          className="elm-kader"
          data-testid="elm-kader"
          titel="Kader"
          kopfInhalt={
            <label className="elm-such">
              <BcIcon name="suche" />
              <input type="search" value={playerFilter} onChange={(e) => onPlayerFilterChange(e.target.value)} placeholder="Spieler suchen" aria-label="Kader durchsuchen" autoComplete="off" />
            </label>
          }
        >
          <div
            className="elm-fuer"
            style={{ "--pc": fokusFarbe } as React.CSSProperties}
          >
            {fokusSlot ? (
              <>
                <span>Sortiert für</span>
                <BcMarke farbe={fokusFarbe}>{kuerzelJeSlot.get(fokusSlot.key)}</BcMarke>
                <b>{rollenZeile(fokusSlot.key)}</b>
              </>
            ) : (
              <span>Wähle einen Platz, dann sortiert sich der Kader danach.</span>
            )}
          </div>
          <div className="elm-chips">
            {(
              [
                ["alle", "Alle"],
                ["frei", "Frei"],
                ["gesetzt", "Im Einsatz"],
                ["gesperrt", "Nicht einsetzbar"],
              ] as const
            ).map(([id, label]) => (
              <BcChip key={id} gedrueckt={kaderFilter === id} onClick={() => setKaderFilter(id)}>
                {label} <b>{kaderZeilen.filter((z) => (id === "alle" ? true : id === "frei" ? !z.platz && !z.sperre : id === "gesetzt" ? z.platz : z.sperre)).length}</b>
              </BcChip>
            ))}
          </div>
          <div
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
            onDragOver={(event) => zieht?.von && kannBedienen && event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (zieht?.von) onClearSlot(zieht.von);
              setZieht(null);
            }}
            onMouseLeave={() => setHoverId(null)}
          >
            <BcTable
              spalten={spalten}
              zeilen={sichtbar}
              zeilenKey={(z) => z.id}
              zeilenKlasse={(z) => [z.sperre ? "is-aus" : "", z.gold ? "is-gold" : "", zieht?.id === z.id ? "is-zieht" : ""].filter(Boolean).join(" ")}
              zeilenProps={(z) => ({
                disabled: !kannBedienen || Boolean(z.sperre) || !fokusSlot,
                draggable: kannBedienen && !z.sperre,
                onMouseEnter: () => setHoverId(z.id),
                onFocus: () => setHoverId(z.id),
                onDragStart: (event: React.DragEvent) => {
                  event.dataTransfer.setData("text/plain", z.id);
                  event.dataTransfer.effectAllowed = "move";
                  setZieht({ id: z.id, von: null });
                },
                onDragEnd: () => setZieht(null),
                title: z.sperre ? `Nicht einsetzbar: ${z.sperre}` : fokusSlot ? `In ${slotName(fokusSlot.key)} einsetzen (Klick) oder auf einen Platz ziehen` : undefined,
              })}
              onZeile={(z) => {
                if (fokusSlot) setzeAuf(fokusSlot.key, z.id);
                setBlatt(null);
              }}
              leer={<p className="elm-leer">{rosterShortfall ? `${rosterShortfall.headline} ${rosterShortfall.detail}` : "Keine Spieler in dieser Auswahl."}</p>}
            />
          </div>
          <div className="elm-kf">
            <span><i />Goldrand: kostet die Gesamtverteilung nichts</span>
          </div>
        </BcSheet>

        {/* ------------ Feld ------------ */}
        <BcPanel className="elm-feld" data-testid="elm-feld">
          <div className="elm-fk">
            <div className="elm-waage" data-testid="elm-waage">
              <div className="elm-waage__z bc-t">
                <small>Wir · Ø Eignung</small>
                {f0(waage.vorschau ?? waage.eigenSchnitt)}
              </div>
              <div>
                {(() => {
                  const wir = waage.vorschau ?? waage.eigenSchnitt;
                  const g = waage.gMid;
                  if (wir == null || g == null || wir + g === 0) return <div className="elm-waage__bar" style={{ background: "rgba(255,255,255,.12)" }} />;
                  const anteil = (wir / (wir + g)) * 100;
                  const lo = waage.gMax != null ? (wir / (wir + waage.gMax)) * 100 : anteil;
                  const hi = waage.gMin != null ? (wir / (wir + waage.gMin)) * 100 : anteil;
                  return (
                    <div className="elm-waage__bar" role="img" aria-label={`Wir ${f0(wir)} gegen Gegner ${f0(g)}`}>
                      <i style={{ width: `${anteil}%` }} />
                      <u style={{ left: `${lo}%`, width: `${Math.max(0, hi - lo)}%` }} />
                    </div>
                  );
                })()}
                <div className="elm-waage__txt">
                  <span>
                    {gegner.status === "geschaetzt" ? <>gegen <b>{gegner.gegnerName}</b></> : <span title={gegner.grund}>Gegner noch unbekannt</span>}
                  </span>
                  <span>
                    {waage.vorschau != null && hoverZeile ? <span className="elm-vor">Vorschau: {hoverZeile.karte.name} auf {kuerzelJeSlot.get(fokusSlot?.key ?? "")}</span> : "Schraffur = Unsicherheit der Schätzung"}
                  </span>
                </div>
              </div>
              <div className="elm-waage__z is-g bc-t">
                <small>Gegner</small>
                {waage.gMin != null && waage.gMax != null ? `${f0(waage.gMin)}–${f0(waage.gMax)}` : "–"}
              </div>
            </div>
            <div className="elm-wz" style={{ display: "flex", gap: 6 }}>
              <button type="button" className="bc-btn bc-btn--klein" disabled={!kannBedienen || !onApplyAssignments} onClick={() => verteile("auffuellen")} data-bc-tip="Offene Plätze mit den besten freien Spielern füllen (A)">
                <BcIcon name="zauber" /> Auffüllen
              </button>
              <button type="button" className="bc-btn bc-btn--klein" disabled={!kannBedienen || !onApplyAssignments} onClick={() => verteile("optimieren")} data-bc-tip="Beste Verteilung über beide Disziplinen, jeder Spieler nur einmal (O)">
                <BcIcon name="krone" /> Optimieren
              </button>
              <button type="button" className="bc-btn bc-btn--klein" disabled={!undoInfo} onClick={onUndo} data-bc-tip={undoInfo ? `Zurück: ${undoInfo.label} (Z)` : "Nichts zurückzunehmen"} aria-label="Rückgängig">
                <BcIcon name="zurueck" />
              </button>
            </div>
          </div>

          <div className="elm-pitchw">
            <div className="elm-feld__box" data-feld={form.definition.feld}>
              <FeldHintergrund art={form.definition.feld} spuren={slotsJeSeite[seite].length} etiketten={form.etiketten} />
              <div className="elm-hinw">{form.definition.kopfzeile}{kulisse ? ` · Platz: ${kulisse.label}` : ""}</div>
              {form.definition.gegner !== "keiner" && form.definition.gegner !== "schatten"
                ? slotsJeSeite[seite].map((slot) => {
                    const platz = form.plaetze.find((p) => p.slotIndex === slot.slotIndex);
                    const g = gegnerSeite?.slots.find((s) => s.slotIndex === slot.slotIndex);
                    if (!platz?.gegner || !g?.spielerName) return null;
                    return (
                      <div key={`g-${slot.key}`} className="elm-geist bc-t" style={{ "--x": platz.gegner.x, "--y": platz.gegner.y } as React.CSSProperties} title="Geschätzte gegnerische Besetzung (Scouting)">
                        <b>{g.spielerName}</b>
                        {g.spanne ? <span>{g.spanne.min}–{g.spanne.max}</span> : null}
                      </div>
                    );
                  })
                : null}
              {slotsJeSeite[seite].map((slot) => platzKarte(slot))}
            </div>
          </div>

          <div className="elm-tak" data-testid="elm-taktik">
            <div>
              <span className="bc-gk">Einsatz · {dSeite?.displayName}</span>
              <BcSeg
                ariaLabel={`${seite.toUpperCase()} Einsatz`}
                wert={stufe}
                gesperrt={!kannBedienen}
                onWahl={(id) => onUpdateDisciplineIntensity(seite, id)}
                optionen={STUFEN.map((st) => ({
                  ...st,
                  titel: tacticVorschau ? `${st.label}: projiziert ${f1(tacticVorschau[st.id])}` : st.label,
                }))}
              />
              {tacticVorschau?.[stufe] != null ? <small>erwartet {f1(tacticVorschau[stufe])} Punkte</small> : null}
            </div>
            {formSteuerung ? (
              <div>
                <span className="bc-gk">Formkarten{formSteuerung.colorLabel ? ` · ${formSteuerung.colorLabel}` : ""}{formWartet ? " · speichert…" : ""}</span>
                {formSteuerung.primaryOptions.length + formSteuerung.secondaryOptions.length === 0 && !formSteuerung.primarySelectedId && !formSteuerung.secondarySelectedId ? (
                  <small>Keine Formkarte mehr verfügbar — alle Karten dieser Saison sind gespielt.</small>
                ) : (
                  <div className="elm-fkart">
                    {formKartenplatz("primary", "Primär")}
                    {formKartenplatz("secondary", "Sekundär +")}
                  </div>
                )}
                {kartenWirkungJeSeite[seite] && kartenWirkungJeSeite[seite]!.karten.length > 0 ? (
                  <small data-testid="elm-karten-live">
                    {kartenWirkungJeSeite[seite]!.buchung.gebucht
                      ? `Karten fürs Team: ${vz(kartenWirkungJeSeite[seite]!.teamSumme)} (Details im Reiter „Form & Moral“)`
                      : kartenWirkungJeSeite[seite]!.buchung.grund}
                  </small>
                ) : null}
              </div>
            ) : null}
            {captainEintraege.length > 0 ? (
              <div>
                <span className="bc-gk">Captain · {captainDraftRemaining} frei heute · {captainSeasonUsedWithDraft}/{captainSeasonLimit} Saison</span>
                <select
                  className="elm-capwahl"
                  aria-label={`Captain ${seite.toUpperCase()} wählen`}
                  disabled={!kannBedienen}
                  value={captains[seite] ?? ""}
                  onChange={(e) => onUpdateCaptain(seite, e.target.value)}
                >
                  <option value="">Kein Captain</option>
                  {captainEintraege.map((entry) => {
                    const info = captainInfo.get(entry.activePlayerId);
                    return (
                      <option key={entry.activePlayerId} value={entry.activePlayerId}>
                        {entry.name}
                        {info?.estimatedCaptainBonus != null ? ` · +${f1(info.estimatedCaptainBonus)}` : ""}
                        {info?.moraleReward != null ? ` · ♥+${f1(info.moraleReward)}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : null}
            {powerSteuerung && (powerSteuerung.options.length > 0 || powerSteuerung.selectedId) ? (
              <div>
                <span className="bc-gk">Team-Power{powerSteuerung.sourceLabel ? ` · ${powerSteuerung.sourceLabel}` : ""}</span>
                <select
                  className="elm-capwahl"
                  aria-label={`${seite.toUpperCase()} Team-Power wählen`}
                  title={powerSteuerung.title}
                  disabled={!kannBedienen}
                  value={powerSteuerung.selectedId ?? ""}
                  onChange={(e) => onAssignTeamPower?.(seite, e.target.value || null)}
                >
                  <option value="">— {powerSteuerung.emptyLabel} —</option>
                  {powerSteuerung.options.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                {powerSteuerung.selectedSummary ? <small>{powerSteuerung.selectedSummary}</small> : null}
              </div>
            ) : null}
            {strategieVorlagen.length > 0 && getDisciplineStrategie && onUpdateDisciplineStrategie ? (
              (() => {
                const gewaehlt = normalisiereStrategie(dSeite?.disciplineId ?? null, getDisciplineStrategie(seite));
                const def = strategieVorlagenFuer(dSeite?.disciplineId ?? null);
                const defensiv = def.find((v) => v.stufe === "defensiv");
                const offensiv = def.find((v) => v.stufe === "offensiv");
                const knoepfe = [
                  ...(defensiv ? [{ id: defensiv.id as string, label: defensiv.name }] : []),
                  { id: "__normal", label: "Normal" },
                  ...(offensiv ? [{ id: offensiv.id as string, label: offensiv.name }] : []),
                ];
                const aktiv = def.find((v) => v.id === gewaehlt) ?? null;
                return (
                  <div>
                    <span className="bc-gk">Spielweise</span>
                    <BcSeg
                      ariaLabel={`${seite.toUpperCase()} Spielweise`}
                      wert={gewaehlt ?? "__normal"}
                      gesperrt={!kannBedienen}
                      onWahl={(id) => onUpdateDisciplineStrategie(seite, id === "__normal" ? null : id)}
                      optionen={knoepfe}
                    />
                    {aktiv ? <small>{aktiv.satz}</small> : null}
                  </div>
                );
              })()
            ) : null}
          </div>
        </BcPanel>

        {/* ------------ Kontext ------------ */}
        <BcSheet offen={blatt === "kontext"} onSchliessen={() => setBlatt(null)} className="elm-kontext" data-testid="elm-kontext">
          <div className="elm-ktabs" role="tablist">
            <button type="button" role="tab" aria-selected={kontextTab === "rolle"} className={kontextTab === "rolle" ? "is-an" : ""} onClick={() => setKontextTab("rolle")}>Rolle</button>
            <button type="button" role="tab" aria-selected={kontextTab === "gegner"} className={kontextTab === "gegner" ? "is-an" : ""} onClick={() => setKontextTab("gegner")}>Gegner</button>
            <button type="button" role="tab" aria-selected={kontextTab === "formmoral"} className={kontextTab === "formmoral" ? "is-an" : ""} onClick={() => setKontextTab("formmoral")} data-testid="elm-tab-formmoral">Form &amp; Moral</button>
            <button type="button" role="tab" aria-selected={kontextTab === "pruefung"} className={kontextTab === "pruefung" ? "is-an" : ""} onClick={() => setKontextTab("pruefung")}>
              Prüfung
              {fehlerAnzahl + warnAnzahl > 0 ? <span className="pkt">{fehlerAnzahl + warnAnzahl}</span> : <span className="pkt is-gut">✓</span>}
            </button>
          </div>
          <div className="elm-kb">{kontextTab === "rolle" ? rolleTab : kontextTab === "gegner" ? gegnerTab : kontextTab === "formmoral" ? formMoralTab : pruefTab}</div>
        </BcSheet>
      </div>

      <div className="elm-phonebar bc-nurphone">
        <button type="button" className="bc-btn bc-btn--klein" onClick={() => setBlatt("kader")}><BcIcon name="team" /> Kader</button>
        <button type="button" className="bc-btn bc-btn--klein" disabled={!kannBedienen || !onApplyAssignments} onClick={() => verteile("auffuellen")}><BcIcon name="zauber" /> Auffüllen</button>
        <button type="button" className="bc-btn bc-btn--klein" onClick={() => setBlatt("kontext")}><BcIcon name="info" /> Rolle</button>
      </div>

      <BcSheet modal titel="Form & Moral" offen={profilBlatt != null} onSchliessen={() => setProfilBlatt(null)} className="elm-profilblatt" data-testid="elm-profilblatt">
        {profilBlatt && fmVon(profilBlatt) ? (
          <FormMoralProfil name={spielerName(profilBlatt)} a={fmVon(profilBlatt)!} ursachen={ursachenVon(profilBlatt)} disziplinName={disziplinNameVon} />
        ) : null}
      </BcSheet>

      <div className="bc-dock" data-testid="elm-dock">
        <div className="elm-stat">
          <span className={`bc-lampe ${fehlerAnzahl > 0 ? "is-fe" : warnAnzahl > 0 ? "is-wa" : ""}`} />
          <b>{abgegeben ? "ABGEGEBEN" : gesperrt ? "NICHT ABGABEBEREIT" : "ABGABEBEREIT"}</b>
          <span>
            {abgegeben
              ? lineupSaveCta.detail
              : gesperrt
                ? (pruefsaetze.find((s) => s.ton === "fehler")?.satz ?? lineupSaveCta.detail)
                : warnAnzahl > 0
                  ? `${warnAnzahl} Warnung${warnAnzahl === 1 ? "" : "en"}, kein Hindernis`
                  : "Alles in Ordnung"}
          </span>
        </div>
        <div className="elm-ges bc-nurdesk">
          <strong className="bc-t">{gesamtOffen ? "–" : f0(ges)}</strong>
          <small>Spieltag erwartet</small>
        </div>
        <button type="button" className="bc-btn bc-nurdesk" disabled={!kannBedienen || !onApplyAssignments} onClick={leeren}>Leeren</button>
        {abgegeben && arenaReady && onNavigateArena ? null : (
          // Der Weg in die Arena bleibt sichtbar, auch solange der Knopf noch "Abgeben" heißt:
          // Wer hier steht, soll wissen, wohin die Abgabe führt (Gameplay-Smoke prüft das).
          <span className="elm-weg" data-testid="elm-arena-weg">
            {abgegeben ? "Arena öffnet zum Spieltag" : "Danach: Arena"}
          </span>
        )}
        <button
          type="button"
          className={`bc-btn bc-btn--haupt${abgegeben ? " is-ok" : gesperrt ? " is-zu" : ""}`}
          data-testid="nl-lineup-save"
          aria-disabled={isReadOnly || isBusy || (abgegeben && !(arenaReady && onNavigateArena))}
          disabled={isReadOnly || isBusy}
          title={lineupSaveCta.detail}
          onClick={abgabeKlick}
        >
          {isReadOnly ? "Nur ansehen" : abgegeben ? (arenaReady && onNavigateArena ? "Zur Arena" : "Abgegeben") : gesperrt ? "Abgabe gesperrt" : "Abgeben"}
        </button>
      </div>

      <BcSheet modal offen={steuerungOffen} onSchliessen={() => setSteuerungOffen(false)} titel="Team & Spieltag" data-testid="elm-steuerung">
        <div className="elm-ctl">{steuerungOffen ? controlsSlot : null}</div>
      </BcSheet>

      {toast ? <div className="elm-toast" role="status" data-testid="elm-toast">{toast}</div> : null}
    </div>
  );
}

/** Ein Kartenplatz der Taktik-Leiste: gefüllt oder leer, öffnet eine Liste zum Wählen. */
function FormMenue({
  titel,
  gewaehlt,
  optionen,
  gesperrt,
  onWahl,
}: {
  titel: string;
  gewaehlt: { id: string; label: string; color?: string | null } | null;
  optionen: Array<{ id: string; label: string; color?: string | null }>;
  gesperrt: boolean;
  onWahl: (id: string | null) => void;
}) {
  const [offen, setOffen] = useState(false);
  const wurzel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!offen) return;
    const zu = (event: MouseEvent) => {
      if (wurzel.current && !wurzel.current.contains(event.target as Node)) setOffen(false);
    };
    document.addEventListener("mousedown", zu);
    return () => document.removeEventListener("mousedown", zu);
  }, [offen]);
  return (
    <div ref={wurzel} style={{ position: "relative" }}>
      <button
        type="button"
        className={`elm-fka${gewaehlt ? " is-voll" : ""}`}
        disabled={gesperrt}
        aria-haspopup="menu"
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
        title={gewaehlt?.label ?? `${titel}: keine Formkarte gesetzt`}
      >
        <BcIcon name="karte" />
        {gewaehlt ? (
          <span style={gewaehlt.color ? { color: FORM_HEX[gewaehlt.color] } : undefined}>{gewaehlt.label}</span>
        ) : (
          <span>{titel}: leer</span>
        )}
      </button>
      {offen ? (
        <div className="elm-menu" role="menu" aria-label={`${titel} Formkarte`}>
          <button type="button" role="menuitemradio" aria-checked={!gewaehlt} onClick={() => { onWahl(null); setOffen(false); }}>— keine —</button>
          {optionen.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-checked={gewaehlt?.id === o.id}
              style={o.color ? { color: FORM_HEX[o.color] } : undefined}
              onClick={() => { onWahl(o.id); setOffen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
