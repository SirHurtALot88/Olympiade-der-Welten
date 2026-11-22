import type { GameState, LineupDraft, Player, PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import { baueVorraumTeams, type VorraumTeam } from "@/lib/foundation/battle-arena/arena-vorraum";
import { getManualControlTeamIds, getTeamControlSettings, resolveOwnerDisplayLabel } from "@/lib/foundation/team-control-settings";
import { ermittleVerletzungsgesperrteAmSpieltag } from "@/lib/fatigue/fatigue-injury-service";
import { duellStand, type DuellStand } from "@/lib/lineups/einsatzliste-gegner-vergleich";
import { formationFuerSeite, type FeldArt, type Verbindlichkeit } from "@/lib/lineups/formation";
import { baueFormMoralAnzeige } from "@/lib/lineups/form-moral-anzeige";
import { berechneKartenWirkung, wertungsPfad } from "@/lib/lineups/formkarten-wirkung";
import {
  getModifierSelectionForSide,
  getTeamFormCardOptions,
  resolveEffectiveLineupModifiers,
} from "@/lib/lineups/legacy-lineup-modifiers";
import {
  berechneSlotAufschlag,
  resolveSlotRoleShortId,
  resolveSlotRolesForDiscipline,
  hasSlotCountSpecificRoles,
  type MatchdaySlotRoleDefinition,
} from "@/lib/lineups/matchday-slot-roles";
import { getFigurSpriteForPlayer } from "@/lib/data/figurenSprites";
import KULISSEN_NAMEN from "@/data/generated/arena-kulissen-namen.json";
import { getSeasonDisciplineScheduleEntry } from "@/lib/season/season-discipline-schedule";

/**
 * TAFEL DER ARENA-VORSTELLUNG (Rework 22.11., Mockup `public/mockups/arena-vorstellung-rework-22-11.html`,
 * Doku `docs/design/arena-vorstellung-rework-22-11.md`) -- reine Logik, kein React.
 *
 * EINE ZEILE = EIN SLOT. Die Zeilen sind die Slots der Disziplin in der Reihenfolge der Einsatzliste
 * (`resolveSlotRolesForDiscipline`, Kopfzahl k des Spieltags); wer denselben Slot besetzt, steht in allen
 * Teams in derselben Zeile (Index = `slotIndex` des Aufstellungsentwurfs). Ein unbesetzter Slot ergibt
 * `null` -- nichts rutscht nach.
 *
 * GEZEIGT = GEBUCHT. Die Zellen kommen aus demselben Aufstellungsentwurf (`seasonState.lineupDrafts`) wie
 * `buildArenaAufstellung` (Arena-Adapter): gleiche Aufloesung `activePlayerId` -> Kader-Zeile -> Spieler,
 * gleiche Verletzungssperre (`ermittleVerletzungsgesperrteAmSpieltag`), gleiche Rollenkennung
 * (`resolveSlotRoleShortId`, Battlefield mit Kadergroesse). Es wird nichts neu abgeleitet.
 *
 * EIGNUNG IM SLOT = ROH + SLOT-BONUS, FUER ALLE TEAMS GLEICH (Chris, 22.11.): rohe Disziplin-Eignung
 * (`player.disciplineRatings[disziplin]`, dieselbe Zahl, mit der der Arena-Adapter `d` fuettert) plus
 * Slot-Bonus aus `berechneSlotAufschlag` (`lib/lineups/matchday-slot-roles.ts`, dieselbe Formel wie
 * `slotAufschlag()` im Motor: Slotprofil gegen Grundprofil, x 2,2, geklemmt +-8,5; Football x 0,35).
 * Gegner zeigen die Zahl EXAKT (kein Scouting-Nebel in der Vorstellung), aber OHNE Tagesmodifikatoren:
 * keine Form, keine Moral, keine Formkarte, keine Intensitaet, keine Muedigkeit. Das eigene Team zeigt
 * dieselbe Zahl und daneben Form, Moral und Kartenwirkung als eigene Marken.
 * Die gegnerische Formkarte bleibt bis zum Anpfiff verdeckt (nie in dieser Struktur).
 *
 * NUR ANZEIGE. Nichts davon fliesst in Resolve, KI oder Motor.
 */

/** Football-Sonderfall des Motors (`FOOTBALL_SLOT_AUFSCHLAG_SKALA` in battle-mode.engine.js); Drift-Test im Testfile. */
export const VORSTELLUNG_FOOTBALL_SLOT_SKALA = 0.35;

/** Feldarten, fuer die die Vorstellung einen kleinen Feldplan je Slot zeichnet (Feldspiele). */
export const VORSTELLUNG_FELDPLAN_ARTEN: readonly FeldArt[] = ["halbfeld", "eis", "football"];

export type VorstellungFeldplan = {
  feld: FeldArt;
  /** Platz des Slots im Feld, Anteile 0..1 der Feldbreite/-hoehe (Formations-Registry, Quelle: Arena-Motor). */
  x: number;
  y: number;
  /** Gegner-Platz derselben Position, `null`, wenn der Gegner dort nicht auf dem Feld steht. */
  gegner: { x: number; y: number } | null;
  /** "motor" = der Motor haelt den Platz; sonst nur Darstellung (Marke wird hohl gezeichnet). */
  verbindlichkeit: Verbindlichkeit;
  /** Etikett des Platzes ("Netfront", "Top of Key"). */
  label: string | null;
  beleg: string;
};

export type VorstellungSlot = {
  /** 1-basiert, so wie die Zeile heisst. */
  nr: number;
  slotIndex: number;
  roleId: string | null;
  label: string;
  text: string;
  /** Die zwei Schluesselattribute (Klartext, z. B. "Power"). */
  schluesselAttribute: string[];
  feldplan: VorstellungFeldplan | null;
};

export type VorstellungFormMarke = { stufe: number; wort: string };

export type VorstellungZelle = {
  playerId: string;
  name: string;
  className: string | null;
  race: string | null;
  /** Slug der PixelLab-Figur, `null` = Portraet-Marke. */
  figurSlug: string | null;
  portraitUrl: string | null;
  /** Rohe Disziplin-Eignung (ungerundet) und Slot-Bonus; `null` ohne Wert. */
  roh: number | null;
  slotBonus: number | null;
  /** Gerundete Anzeige: roh + Slot-Bonus. */
  eignung: number | null;
  /** Nur eigenes Team: */
  captain: boolean;
  form: VorstellungFormMarke | null;
  moral: number | null;
  /** Gebuchter Kartenwert dieses Spielers (flach, ohne Tagesform), `null` = keine Karte / nicht gebucht. */
  karte: { wert: number; farbbonus: boolean } | null;
};

export type VorstellungNichtAufgestellt = { playerId: string; name: string; grund: "verletzt" | "bank"; portraitUrl: string | null };

export type VorstellungEigenInfo = {
  /** Gelegte Karten der Seite, z. B. "Rot +2". */
  karten: Array<{ id: string; farbe: string; wert: number; name: string }>;
  /** `false` = in dieser Disziplin zaehlt die gespielte Karte nicht (Ersatzkarte); dann keine Kartenpunkte zeigen. */
  kartenGebucht: boolean;
  kartenHinweis: string | null;
  einsatz: "schonen" | "normal" | "push";
  nichtAufgestellt: VorstellungNichtAufgestellt[];
};

export type VorstellungManager = { art: "mensch" | "ki"; name: string | null };

export type VorstellungTeam = VorraumTeam & {
  manager: VorstellungManager;
  /** Eine Zelle je Zeile; `null` = Slot unbesetzt. */
  zellen: Array<VorstellungZelle | null>;
  /** `true`, wenn fuer dieses Team kein Aufstellungsentwurf dieser Disziplin vorliegt (Motor nimmt dann Reihum). */
  ohneAufstellung: boolean;
  /** Nur das eigene Team. */
  eigenInfo: VorstellungEigenInfo | null;
};

export type VorstellungVergleich =
  | { art: "duell"; stand: DuellStand; abstand: number | null }
  | { art: "pod"; vorn: number; von: number };

export type VorstellungTafel = {
  art: "duell" | "pod";
  disciplineId: string;
  /** Kopfzahl des Spieltags = Zeilenzahl. */
  k: number;
  /** "Slot", "Gefecht", "Läufer" ... */
  zeilenName: string;
  /** Hinweis fuer den Fuss, wenn die Zeile mehr als "Slot" bedeutet (Slot i gegen Slot i). */
  zeilenHinweis: string | null;
  slots: VorstellungSlot[];
  /** Eigenes Team zuerst (Reihenfolge von `baueVorraumTeams`). */
  teams: VorstellungTeam[];
  /** `true`, wenn jeder gefundene Aufstellungsentwurf gesperrt oder gewertet ist (Marke "Einsatzlisten gesperrt"). */
  listenGesperrt: boolean;
  /** Ein Eintrag je Zeile, vom ERSTEN Team (= eigenes, sonst erstes) aus gesehen. */
  vergleich: Array<VorstellungVergleich | null>;
};

const ATTRIBUT_NAMEN: Record<string, string> = {
  power: "Power",
  health: "Health",
  stamina: "Stamina",
  intelligence: "Intelligence",
  awareness: "Awareness",
  determination: "Determination",
  speed: "Speed",
  dexterity: "Dexterity",
  charisma: "Charisma",
  will: "Will",
  spirit: "Spirit",
  torment: "Torment",
};

const FARB_NAMEN: Record<string, string> = { red: "Rot", green: "Grün", blue: "Blau", yellow: "Gelb" };

/** Wie die Zeile heisst: bei Buehnen mit Slot-Paarung "Gefecht", bei Bahnen "Läufer", sonst "Slot". */
export function vorstellungZeilenName(disciplineId: string): { name: string; hinweis: string | null } {
  switch (disciplineId) {
    case "fechten":
    case "tennis":
    case "speed-schach":
      return { name: "Gefecht", hinweis: "Gleiche Zeile = gleiches Gefecht: Slot 1 tritt gegen Slot 1 an." };
    case "gewichtheben":
      return { name: "Duell", hinweis: "Gleiche Zeile = gleiches Duell: Slot 1 tritt gegen Slot 1 an." };
    case "staffel":
      return { name: "Läufer", hinweis: "Die Zeile ist zugleich die Laufreihenfolge der Staffel." };
    case "spurt":
    case "time-trial":
    case "takeshis-castle":
      return { name: "Läufer", hinweis: null };
    case "climbing":
      return { name: "Kletterer", hinweis: null };
    default:
      return { name: "Slot", hinweis: null };
  }
}

function rundeEignung(wert: number | null): number | null {
  return wert == null || !Number.isFinite(wert) ? null : Math.round(wert);
}

/** Gewichteter Schnitt im Grundprofil der Disziplin -- nur Rueckfall, wenn `disciplineRatings` den Wert nicht traegt (wie `gewichtet()` im Motor). */
function grundSchnitt(role: MatchdaySlotRoleDefinition | null, stats: PlayerAttributeSheetStats | null | undefined): number | null {
  const profil = role?.baseWeightProfile;
  if (!profil || !stats) return null;
  let summe = 0;
  let gewicht = 0;
  for (const [attribut, g] of Object.entries(profil)) {
    const wert = (stats as Record<string, number | null | undefined>)[attribut];
    if (!g || g <= 0 || wert == null || !Number.isFinite(wert)) continue;
    summe += g * wert;
    gewicht += g;
  }
  return gewicht > 0 ? summe / gewicht : null;
}

/** Rohe Eignung + Slot-Bonus eines Spielers in einer Rolle. Die Funktion, die die Tafel fuer ALLE Teams nutzt. */
export function eignungImSlot(input: {
  disciplineId: string;
  player: Pick<Player, "disciplineRatings">;
  stats: PlayerAttributeSheetStats | null | undefined;
  role: MatchdaySlotRoleDefinition | null;
}): { roh: number | null; slotBonus: number | null; eignung: number | null } {
  const { disciplineId, player, stats, role } = input;
  const gespeichert = player.disciplineRatings?.[disciplineId];
  const roh = typeof gespeichert === "number" && Number.isFinite(gespeichert) ? gespeichert : grundSchnitt(role, stats);
  const skala = disciplineId === "football" ? VORSTELLUNG_FOOTBALL_SLOT_SKALA : 1;
  const slotBonus = berechneSlotAufschlag(role, stats, skala);
  const eignung = roh == null ? null : roh + (slotBonus ?? 0);
  return { roh, slotBonus, eignung: rundeEignung(eignung) };
}

function kopfzahlFuer(gameState: GameState, matchdayId: string | null | undefined, disciplineId: string, entwuerfe: LineupDraft[]): number {
  if (matchdayId) {
    try {
      const eintrag = getSeasonDisciplineScheduleEntry(gameState, matchdayId);
      for (const slot of [eintrag?.discipline1, eintrag?.discipline2]) {
        const anzahl = slot?.playerCount;
        if (slot?.disciplineId === disciplineId && anzahl != null && Number.isInteger(anzahl) && anzahl >= 1) return anzahl;
      }
    } catch {
      // unvollstaendiger Spielstand: Rueckfall auf die Entwuerfe
    }
  }
  let hoechster = 0;
  for (const entwurf of entwuerfe) {
    for (const eintrag of entwurf.entries) {
      if (eintrag.disciplineId === disciplineId) hoechster = Math.max(hoechster, eintrag.slotIndex + 1);
    }
  }
  return hoechster;
}

function portraitVon(player: Player | undefined): string | null {
  if (!player) return null;
  const url = (player as { portraitUrl?: string | null }).portraitUrl;
  if (typeof url === "string" && url.startsWith("/")) return url;
  const slug = player.id.toLowerCase().match(/^player-\d+-(.+)$/)?.[1];
  return slug ? `/portraits/${slug}.jpg` : null;
}

function managerVon(gameState: GameState, teamId: string): VorstellungManager {
  if (!getManualControlTeamIds(gameState).has(teamId)) return { art: "ki", name: null };
  const einstellung = getTeamControlSettings(gameState, teamId);
  const name = einstellung?.displayLabel ?? resolveOwnerDisplayLabel(einstellung?.ownerId) ?? null;
  return { art: "mensch", name };
}

export function baueVorstellungsTafel(input: {
  gameState: GameState;
  /** Teams der Begegnung bzw. Vierergruppe (Reihenfolge der Buchung); das eigene wird nach vorn gezogen. */
  teamIds: readonly string[];
  /** Aktives Team des Managers (`activeManagerTeamId`), nie hart ein Name. */
  ownTeamId: string | null | undefined;
  disciplineId: string;
  matchdayId: string | null | undefined;
  art: "duell" | "pod";
  /** Nachgeladene Attributboegen fremder Teams (Host: `sheetsByPlayerId`); der Spielstand traegt sie nur fuer das eigene Team. */
  attributeSheets?: ReadonlyMap<string, PlayerAttributeSheetStats | null | undefined> | null;
}): VorstellungTafel {
  const { gameState, ownTeamId, disciplineId, matchdayId, art } = input;
  const vorraumTeams = baueVorraumTeams({ gameState, teamIds: input.teamIds, ownTeamId, disciplineId });
  const entwuerfe = (gameState.seasonState?.lineupDrafts ?? []).filter((d) => matchdayId != null && d.matchdayId === matchdayId);
  const entwurfVon = new Map<string, LineupDraft>();
  for (const teamId of vorraumTeams.map((t) => t.teamId)) {
    const treffer = entwuerfe.find((d) => d.teamId === teamId);
    if (treffer) entwurfVon.set(teamId, treffer);
  }
  const k = kopfzahlFuer(gameState, matchdayId, disciplineId, [...entwurfVon.values()]);
  const kopfSlotZahl = hasSlotCountSpecificRoles(disciplineId, null) ? k : undefined;
  const rollen = resolveSlotRolesForDiscipline(disciplineId, null, k);
  const formation = formationFuerSeite(disciplineId, k);
  const feldplanErlaubt = VORSTELLUNG_FELDPLAN_ARTEN.includes(formation.definition.feld) && !formation.rueckfall;
  const zeilenName = vorstellungZeilenName(disciplineId);

  const slots: VorstellungSlot[] = Array.from({ length: k }, (_, slotIndex) => {
    const rolle = rollen[slotIndex] ?? null;
    const platz = formation.plaetze.find((p) => p.slotIndex === slotIndex) ?? null;
    return {
      nr: slotIndex + 1,
      slotIndex,
      roleId: resolveSlotRoleShortId(disciplineId, null, slotIndex, kopfSlotZahl),
      label: rolle?.label ?? `Slot ${slotIndex + 1}`,
      text: rolle?.description ?? "",
      schluesselAttribute: (rolle?.keyAttributes ?? [])
        .slice(0, 2)
        .map((a) => ATTRIBUT_NAMEN[a.attribute] ?? a.attribute),
      feldplan:
        feldplanErlaubt && platz
          ? {
              feld: formation.definition.feld,
              x: platz.x,
              y: platz.y,
              gegner: platz.gegner,
              verbindlichkeit: platz.verbindlichkeit,
              label: platz.gruppenLabel,
              beleg: platz.beleg,
            }
          : null,
    };
  });

  const spielerVon = new Map(gameState.players.map((p) => [p.id, p] as const));
  const kaderzeileZuSpieler = new Map(gameState.rosters.map((z) => [z.id, z.playerId] as const));
  const gesperrt = ermittleVerletzungsgesperrteAmSpieltag(gameState, matchdayId);
  const pfad = wertungsPfad(gameState, disciplineId);
  const kategorie = (gameState.disciplines ?? []).find((d) => d.id === disciplineId)?.category;

  const teams: VorstellungTeam[] = vorraumTeams.map((team) => {
    const entwurf = entwurfVon.get(team.teamId) ?? null;
    const eintraege = (entwurf?.entries ?? []).filter((e) => e.disciplineId === disciplineId);
    const zellen: Array<VorstellungZelle | null> = Array.from({ length: k }, () => null);
    const aufgestellt = new Set<string>();
    const eigen = team.eigen;

    // Kartenwirkung nur fuers eigene Team (die gegnerische Karte bleibt verdeckt), und nur wenn die Karte gebucht wird.
    let wirkung: ReturnType<typeof berechneKartenWirkung> | null = null;
    let kartenFarben: string[] = [];
    let einsatz: "schonen" | "normal" | "push" = "normal";
    const seite = eintraege[0]?.disciplineSide;
    const spielerIdVon = (eintrag: (typeof eintraege)[number]) =>
      eintrag.activePlayerId ? kaderzeileZuSpieler.get(eintrag.activePlayerId) ?? eintrag.playerId : eintrag.playerId;
    if (eigen && entwurf && (seite === "d1" || seite === "d2")) {
      try {
        const modifiers = resolveEffectiveLineupModifiers({
          modifiers: entwurf.modifiers,
          formCardPlans: (gameState.seasonState?.formCardPlans ?? []).filter((p) => p.seasonId === entwurf.seasonId && p.teamId === team.teamId),
          seasonId: entwurf.seasonId,
          teamId: team.teamId,
          matchdayId,
        });
        const auswahl = getModifierSelectionForSide(modifiers, seite);
        const stufe = auswahl.intensity;
        einsatz = stufe === "conserve" ? "schonen" : stufe === "push" ? "push" : "normal";
        const formCards = getTeamFormCardOptions({ gameState, seasonId: entwurf.seasonId, teamId: team.teamId, lineupId: entwurf.lineupId });
        wirkung = berechneKartenWirkung({
          gameState,
          side: seite,
          disciplineId,
          disciplineCategory: kategorie,
          formCards,
          primaryCardId: auswahl.primaryFormCardId ?? null,
          secondaryCardId: auswahl.secondaryFormCardId ?? null,
          playerIds: eintraege.map(spielerIdVon),
        });
        kartenFarben = wirkung.karten.map((c) => c.farbe);
      } catch {
        wirkung = null;
      }
    }
    const kartenGebucht = wirkung?.buchung.gebucht ?? false;

    for (const eintrag of eintraege) {
      const spielerId = spielerIdVon(eintrag);
      if (gesperrt.size > 0 && gesperrt.has(`${team.teamId}::${spielerId}`)) continue;
      const spieler = spielerVon.get(spielerId);
      if (!spieler) continue;
      const slotIndex = eintrag.slotIndex;
      if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= k || zellen[slotIndex]) continue;
      if (!slots[slotIndex]?.roleId) continue;
      const stats = input.attributeSheets?.get(spielerId) ?? spieler.attributeSheetStats ?? null;
      const rolle = rollen[slotIndex] ?? null;
      const wert = eignungImSlot({ disciplineId, player: spieler, stats, role: rolle });
      let form: VorstellungFormMarke | null = null;
      let moral: number | null = null;
      let karte: VorstellungZelle["karte"] = null;
      if (eigen) {
        try {
          const anzeige = baueFormMoralAnzeige(gameState, spielerId, { pfad });
          form = anzeige.formVerfuegbar ? { stufe: anzeige.formStufe, wort: anzeige.formWort } : null;
          moral = anzeige.moral != null ? Math.round(anzeige.moral) : null;
        } catch {
          // Anzeige darf an einem unvollstaendigen Spielstand nie scheitern: dann ohne Form/Moral.
        }
        const z = kartenGebucht ? wirkung?.spieler.find((s) => s.playerId === spielerId) : undefined;
        if (z && kartenFarben.length > 0 && z.zerlegung.summe !== 0) {
          karte = { wert: Number(z.zerlegung.summe.toFixed(1)), farbbonus: z.zerlegung.istTraeger };
        }
      }
      zellen[slotIndex] = {
        playerId: spielerId,
        name: spieler.name,
        className: spieler.className ?? null,
        race: spieler.race ?? null,
        figurSlug: getFigurSpriteForPlayer(spielerId)?.slug ?? null,
        portraitUrl: portraitVon(spieler),
        roh: wert.roh,
        slotBonus: wert.slotBonus,
        eignung: wert.eignung,
        captain: eigen && Boolean(eintrag.isCaptain),
        form,
        moral,
        karte,
      };
      aufgestellt.add(spielerId);
    }

    let eigenInfo: VorstellungEigenInfo | null = null;
    if (eigen) {
      const bank: VorstellungNichtAufgestellt[] = gameState.rosters
        .filter((z) => z.teamId === team.teamId && !aufgestellt.has(z.playerId))
        .map((z) => {
          const spieler = spielerVon.get(z.playerId);
          return {
            playerId: z.playerId,
            name: spieler?.name ?? z.playerId,
            grund: gesperrt.has(`${team.teamId}::${z.playerId}`) ? ("verletzt" as const) : ("bank" as const),
            portraitUrl: portraitVon(spieler),
          };
        })
        .sort((a, b) => (a.grund === b.grund ? a.name.localeCompare(b.name, "de") : a.grund === "verletzt" ? -1 : 1));
      eigenInfo = {
        karten: (wirkung?.karten ?? []).map((c) => ({
          id: c.id,
          farbe: c.farbe,
          wert: c.wert,
          name: `${FARB_NAMEN[c.farbe] ?? c.farbe} ${c.wert > 0 ? "+" : ""}${c.wert}`,
        })),
        kartenGebucht,
        kartenHinweis: wirkung && !wirkung.buchung.gebucht ? wirkung.buchung.grund : null,
        einsatz,
        nichtAufgestellt: bank,
      };
    }

    return {
      ...team,
      manager: managerVon(gameState, team.teamId),
      zellen,
      ohneAufstellung: eintraege.length === 0,
      eigenInfo,
    };
  });

  // Vergleich je Zeile: aus Sicht des ersten Teams (eigenes). Beide Seiten exakt und ohne Tagesmodifikatoren,
  // verglichen wird die ANGEZEIGTE (gerundete) Zahl -- gleiche Zahl heisst "gleich", nicht "vorn".
  const vergleich: Array<VorstellungVergleich | null> = slots.map((_, zeile) => {
    const erste = teams[0]?.zellen[zeile]?.eignung ?? null;
    if (erste == null) return null;
    if (art === "duell") {
      const gegner = teams[1]?.zellen[zeile]?.eignung ?? null;
      if (gegner == null) return { art: "duell", stand: "offen", abstand: null };
      const { stand, abstand } = duellStand(erste, { min: gegner, max: gegner });
      return { art: "duell", stand, abstand };
    }
    let vorn = 0;
    let von = 0;
    for (const team of teams.slice(1)) {
      const wert = team.zellen[zeile]?.eignung ?? null;
      if (wert == null) continue;
      von += 1;
      if (erste > wert) vorn += 1;
    }
    return { art: "pod", vorn, von };
  });

  const entwurfListe = [...entwurfVon.values()];
  return {
    art,
    disciplineId,
    k,
    listenGesperrt: entwurfListe.length > 0 && entwurfListe.every((d) => d.status === "locked" || d.status === "resolved"),
    zeilenName: zeilenName.name,
    zeilenHinweis: zeilenName.hinweis,
    slots,
    teams,
    vergleich,
  };
}

const KULISSEN = KULISSEN_NAMEN as Record<string, Array<{ id: string; label: string }>>;

/** Kulissenbild und -name der Disziplin fuer den Hintergrund der Vorstellung (gebuchte Variante, sonst die erste). */
export function kulisseFuerVorstellung(
  disciplineId: string | null | undefined,
  varianteId?: string | null,
): { bild: string; label: string } | null {
  const varianten = disciplineId ? KULISSEN[disciplineId] : undefined;
  if (!disciplineId || !varianten || varianten.length === 0) return null;
  const treffer = (varianteId ? varianten.find((v) => v.id === varianteId) : null) ?? varianten[0]!;
  return { bild: `/sprites/kulissen/${disciplineId}/${treffer.id}.jpg`, label: treffer.label };
}
