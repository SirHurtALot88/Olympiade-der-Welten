// ===================================================================================
// M1 — DREI STUFUNGEN DER AUFSTELLUNGS-AUTORSCHAFT, als wiederverwendbarer Baustein.
//
// PM-Plan (docs/pm-briefings/projektmanager-plan-kampfmodell-umsetzung-20-09.md, Abschnitt
// 3.3): die Kader-Familie fuehrt heute KEIN `place` — der Motor faellt immer auf seine
// Eigenordnung zurueck (SLOT_ZUSATZ, battle-mode.engine.js:5042-5065: "der beste Spieler
// bekommt den vordersten Slot"). Diese Datei baut die drei im Auftrag genannten Stufungen
// EXPLIZIT ueber den bestehenden Weg (`buildArenaAufstellungBeide`, arena-aufstellung-
// adapter.ts) — sie ersetzt ihn nicht.
//
// WARUM HIER EIN EIGENES MODUL UND NICHT NUR CODE IM MESS-SKRIPT: Auflage aus der PM-Planung
// ("was du hier als Sondengeruest baust, erbt A1.0 als seine Variante P" — Konvergenz §4).
// `baueStufung()`/`baueAufstellungFuerStufung()` sind deshalb eigenstaendig exportiert, ohne
// jede Playwright-/Browser-Abhaengigkeit, damit ein spaeterer Lauf (A1.0) sie direkt
// importieren und neben seinen Varianten A-E einhaengen kann, statt dieselbe Logik ein
// zweites Mal zu schreiben.
//
// WAS HIER NICHT GEBAUT WIRD: keine Motorlogik. Diese Datei erzeugt ausschliesslich
// Eingaben (eine Spielerreihenfolge, ein `ArenaAufstellung`-Objekt) fuer den bereits
// bestehenden Weg `lineupDrafts -> arena-aufstellung-adapter.ts -> aufstellung[name]=
// {d,slot} -> slotFuer` (battle-mode.engine.js). `buildArenaAufstellungBeide` selbst bleibt
// unangetastet, importiert von dort.
//
// NACHGEMESSEN, NICHT VERMUTET (wichtig fuer die Gastseite): im Arena-Chassis fuer TDM/
// Mini-DM/Battlefield (battle-mode.engine.js, `build()`, ca. Z. 19546-19624) wirkt `place`
// fuer die GEGNERSEITE nur auf die AUSWAHL ("wer spielt", ueber `gastGesetzt`-Filter), NICHT
// auf den SLOT selbst — der kommt fuer den Gegner aus `PLAN.zuteilung` (KI-Schlachtplan,
// `schlachtplan()`) bzw. aus einer Reihen-Verteilung nach ARRAY-INDEX, wenn `o.row` fehlt
// (was bei echten Kadern immer der Fall ist — `o.row` existiert nur in der handkuratierten
// Mockup-Beispielaufstellung). `PLAN.zuteilung[o.n]` setzt `ord`/`zielP`, aber nirgends
// `.slot` (nachgesehen in `schlachtplan()`). Die Aufstellungs-Autorschaft, die dieses Modul
// misst, gilt deshalb bewusst NUR fuer die EIGENE (Heim-)Seite — die Gastseite bleibt in
// allen drei Stufungen ohne `place`-Eintrag (= heutiges Standardverhalten, dieselbe
// Kontrollgroesse in allen drei Laeufen). Das ist keine Vereinfachung der Sonde, sondern
// spiegelt genau das, was der Motor an dieser Stelle tatsaechlich liest.
//
// ZWEITER NEBENBEFUND (persOf-Altlast, nicht Gegenstand von M1, aber fuer den naechsten
// Leser/A1.0 dokumentiert, damit er nicht neu gesucht wird): die etablierte kaderFamilie-
// Messung (`disziplinProbe(d,{kaderFamilie})`, s. Kopfkommentar `battle-mode.engine.js`
// Z. 31089-31095) laedt den Motor NUR EINMAL und tauscht SQUAD/OPP fuer jede weitere
// Paarung per `kaderSetzen`-Zuweisung innerhalb DERSELBEN Motor-Instanz. `persOf`
// (Persoenlichkeits-Herleitung, `leitePers()`) wird aber nur EINMAL beim allerersten Laden
// aus `[...SQUAD,...OPP]` befuellt (Z. 18220) und danach NIE neu berechnet — jede
// Zielwahl/Standardhaltung, die `persOf[p.n]||"duellant"` liest (Z. 4808/18881/18893/
// 18903/18921/19529/24918/29431), faellt fuer JEDEN Spieler-NAMEN ausserhalb der
// allerersten Paarung lautlos auf die generische "duellant"-Persoenlichkeit zurueck,
// unabhaengig von dessen echten Klassen-/Rassen-/Trait-Werten. Diese Sonde hier laedt den
// Motor dagegen PRO PAARUNG NEU (noetig, weil Namen UND Aufstellung sich aendern) — `persOf`
// wird also fuer jede Paarung frisch und korrekt hergeleitet. Die beiden Messweisen sind
// deshalb auf dieser Achse NICHT dieselbe Groesse: Stufung 1 ("motoroptimal") reproduziert
// zwar exakt dieselbe SLOT-/REIHEN-Zuordnung wie der Reihum-Ruecfall (nachgemessen an einer
// namenskollisionsfreien Paarung, s. PR-Beschreibung), landet aber wegen dieser
// persOf-Frische auf einem anderen Zahlenwert als die eingecheckte Basislinie fuer
// tdm/mini-dm/battlefield — das ist kein Fehler dieser Sonde, sondern eine bereits
// bestehende Eigenschaft der etablierten Mehrpaarungs-Messung, hier nur erstmals benannt.
// Fuer M1s eigentliche Frage (Spannweite Stufung 1 vs. 3) ist das unschaedlich: alle drei
// Stufungen laufen durch DIESELBE Reload-pro-Paarung-Methode, der Vergleich bleibt intern
// konsistent.
// ===================================================================================
import {
  resolveSlotRoleShortId,
  resolveSlotRolesForDiscipline,
} from "@/lib/lineups/matchday-slot-roles";
import {
  buildArenaAufstellungBeide,
  type ArenaAufstellung,
} from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import type { ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import type { GameState } from "@/lib/data/olyDataTypes";

export type ArenaStufungDisziplin = "tdm" | "mini-dm" | "battlefield";

export const ARENA_STUFUNG_DISZIPLINEN: ArenaStufungDisziplin[] = ["tdm", "mini-dm", "battlefield"];

export const JE_SEITE: Record<ArenaStufungDisziplin, number> = {
  tdm: 6,
  "mini-dm": 4,
  battlefield: 4,
};

export const AUFSTELLUNGS_STUFUNGEN = [
  "motoroptimal",
  "menschlich-plausibel",
  "absichtlich-schlecht",
] as const;
export type AufstellungsStufung = (typeof AUFSTELLUNGS_STUFUNGEN)[number];

/**
 * MOCKUP-INTERNE REIHENFOLGE, vorne nach hinten (SLOT_ZUSATZ.pos aufsteigend,
 * battle-mode.engine.js Z. 5042-5065). Das ist reines Lesewissen ueber die bestehende
 * Engine-Konstante (per Zeilennummer zitiert, nicht dupliziert als Motorlogik) — es aendert
 * nichts an SLOT_ZUSATZ, sondern nutzt nur, was dort bereits steht: der Motor liest `place`
 * unveraendert selbst, diese Liste sagt der Sonde nur, WELCHEN Slot sie fuer "Position k von
 * vorne" setzen muss, damit `slotReihe()` im Motor die gewuenschte Reihe ergibt.
 */
const MOCKUP_POS_ORDER: Record<ArenaStufungDisziplin, string[]> = {
  tdm: ["vanguard", "holdline", "breaker", "skirmisher", "shotcaller", "rallypoint"],
  battlefield: ["siegecore", "moraleanchor", "spotter", "commander"],
  "mini-dm": ["frontliner", "finisher", "trickfighter", "ironguard"],
};

/**
 * DIE FLANKE JE DISZIPLIN (SLOT_ZUSATZ `ord:"flanke"`) — fuer Stufung 3 ("Bollwerk auf die
 * Flanke"). MINI-DM TRAEGT IM MOCKUP KEINEN ALS FLANKE MARKIERTEN SLOT (SLOT_ZUSATZ hat
 * keinen der vier Mini-DM-Slot-IDs, `slotOrd()` faellt dort fuer jeden auf "mitlinie"
 * zurueck) — "trickfighter" steht hier nur als NAMENS-Analogon ("findet Winkel"), ohne
 * eigene Flanken-Wirkung im Motor. Ehrlich benannt, damit ein spaeterer Leser (oder A1.0)
 * das nicht fuer eine vierte echte Flanke haelt.
 */
const FLANK_SLOT: Record<ArenaStufungDisziplin, string> = {
  tdm: "skirmisher",
  battlefield: "spotter",
  "mini-dm": "trickfighter",
};

/** slotIndex (Produktionsreihenfolge, DISCIPLINE_ROLE_THEMES) -> Kurzkennung, ueber die
 * bestehende Funktion ermittelt — keine zweite Kopie der Themenliste. */
function baueProduktionsIndexZuKurzId(disc: ArenaStufungDisziplin): Map<string, number> {
  const karte = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const kurz = resolveSlotRoleShortId(disc, null, i);
    if (kurz) karte.set(kurz, i);
  }
  return karte;
}

/** Kurzkennung (Mockup-Reihenfolge) -> Kopf-Attribut der Rolle (`majorPositiveAttribute`),
 * ueber die echte Produktionsfunktion — fuer Stufung 2 ("plausible menschliche Aufstellung"). */
function baueKurzIdZuKopfattribut(disc: ArenaStufungDisziplin, jeSeite: number): Map<string, string> {
  const rollen = resolveSlotRolesForDiscipline(disc, null, jeSeite);
  const karte = new Map<string, string>();
  rollen.forEach((rolle, i) => {
    const kurz = resolveSlotRoleShortId(disc, null, i);
    if (kurz) karte.set(kurz, rolle.majorPositiveAttribute);
  });
  return karte;
}

const eigVon = (p: ArenaSpieler, disc: string) => p.d[disc] || 0;
const zaehVon = (p: ArenaSpieler) => (p.a?.power || 0) + (p.a?.health || 0);

/**
 * STUFUNG 1 — MOTOROPTIMAL (Kontrolle). Sortiert exakt wie die Motor-Ersatzaufstellung
 * (`ersatz=[...SQUAD].sort((a,b)=>(b.d[d]||0)-(a.d[d]||0))`, battle-mode.engine.js `build()`):
 * beste Eignung zuerst, in `slotsVon(d)`-Reihenfolge (== MOCKUP_POS_ORDER) vorne nach hinten
 * platziert. Explizit gesetzt (nicht als leeres `place` durchgereicht), damit die Sonde
 * denselben Weg faehrt wie die anderen beiden Stufungen — s. Kopfkommentar.
 */
function stufungMotoroptimal(roster: ArenaSpieler[], disc: ArenaStufungDisziplin, jeSeite: number): ArenaSpieler[] {
  return [...roster].sort((a, b) => eigVon(b, disc) - eigVon(a, disc)).slice(0, jeSeite);
}

/**
 * STUFUNG 2 — PLAUSIBLE MENSCHLICHE AUFSTELLUNG. Ein Manager, der keine Motorformel kennt,
 * liest je Slot dessen Kurzbeschreibung ("Vanguard: Power und Health") und besetzt sie
 * gierig von vorne nach hinten mit dem Kader-Mitglied, das im ROHEN Attribut am staerksten
 * ist — nicht mit dem nach vollem `eig` (Slot-Profil, Trait-/Form-Zuschlag) besten. Das ist
 * genau der Unterschied zwischen "sieht auf dem Papier stark aus" und "ist es wirklich" —
 * eine defensible, nicht bösartige Fehlentscheidung, kein Zufall.
 */
function stufungMenschlichPlausibel(
  roster: ArenaSpieler[],
  disc: ArenaStufungDisziplin,
  jeSeite: number,
): ArenaSpieler[] {
  const posOrder = MOCKUP_POS_ORDER[disc].slice(0, jeSeite);
  const kopfattribut = baueKurzIdZuKopfattribut(disc, jeSeite);
  const pool = [...roster];
  const ergebnis: ArenaSpieler[] = [];
  for (const slotId of posOrder) {
    const attr = kopfattribut.get(slotId) || "power";
    pool.sort((a, b) => {
      const diff = (b.a?.[attr as keyof typeof b.a] as number || 0) - (a.a?.[attr as keyof typeof a.a] as number || 0);
      if (diff !== 0) return diff;
      // deterministischer Tie-Break: Eignung, dann Name — kein Math.random.
      const eigDiff = eigVon(b, disc) - eigVon(a, disc);
      if (eigDiff !== 0) return eigDiff;
      return a.n.localeCompare(b.n);
    });
    const gewaehlt = pool.shift();
    if (gewaehlt) ergebnis.push(gewaehlt);
  }
  return ergebnis;
}

/**
 * STUFUNG 3 — ABSICHTLICH SCHLECHT. Dieselben `jeSeite` Spieler wie Stufung 1 (derselbe
 * Talent-Pool — die Sonde misst die ARRANGEMENT-Autorschaft, nicht zusaetzlich noch eine
 * schlechtere Auswahl), aber rueckwaerts aufgestellt: der Star (Rang 1 nach Eignung) landet
 * auf dem hintersten Slot ("Star nach hinten"). Danach wird das Bollwerk (hoechste
 * Power+Health-Summe unter denselben Spielern) zwangsweise auf die Flanke getauscht
 * ("Bollwerk auf die Flanke") — s. FLANK_SLOT-Kommentar fuer die Mini-DM-Einschraenkung.
 */
function stufungAbsichtlichSchlecht(
  roster: ArenaSpieler[],
  disc: ArenaStufungDisziplin,
  jeSeite: number,
): ArenaSpieler[] {
  const optimal = stufungMotoroptimal(roster, disc, jeSeite);
  const rueckwaerts = [...optimal].reverse();
  const posOrder = MOCKUP_POS_ORDER[disc].slice(0, jeSeite);
  const flankIdx = posOrder.indexOf(FLANK_SLOT[disc]);
  if (flankIdx >= 0) {
    const bollwerk = [...optimal].sort((a, b) => zaehVon(b) - zaehVon(a))[0];
    const bollwerkIdx = rueckwaerts.findIndex((p) => p.id === bollwerk.id);
    if (bollwerkIdx >= 0 && bollwerkIdx !== flankIdx) {
      const tmp = rueckwaerts[flankIdx];
      rueckwaerts[flankIdx] = rueckwaerts[bollwerkIdx];
      rueckwaerts[bollwerkIdx] = tmp;
    }
  }
  return rueckwaerts;
}

/**
 * Baut die Spielerreihenfolge (vorne nach hinten) fuer EINE Stufung — der zentrale
 * Einstiegspunkt, den auch A1.0 ("Variante P") wiederverwenden kann.
 */
export function baueStufung(
  roster: ArenaSpieler[],
  disc: ArenaStufungDisziplin,
  stufung: AufstellungsStufung,
): ArenaSpieler[] {
  const jeSeite = Math.min(JE_SEITE[disc], roster.length);
  if (stufung === "motoroptimal") return stufungMotoroptimal(roster, disc, jeSeite);
  if (stufung === "menschlich-plausibel") return stufungMenschlichPlausibel(roster, disc, jeSeite);
  return stufungAbsichtlichSchlecht(roster, disc, jeSeite);
}

/**
 * Treibt den BESTEHENDEN Weg (`buildArenaAufstellungBeide`) mit einem synthetischen,
 * einseitigen `LineupDraft` (nur Heim — s. Kopfkommentar zur Gastseite) an. `geordnet` muss
 * bereits in der gewuenschten vorne-nach-hinten-Reihenfolge stehen (s. `baueStufung`).
 *
 * Baut dafuer NUR die drei Felder, die der Adapter tatsaechlich liest (`gameState.players`,
 * `gameState.rosters`, `gameState.seasonState.lineupDrafts`) — kein vollstaendiger
 * `GameState`, aber derselbe Funktionsaufruf, den auch `arena-headless-runner.ts` nutzt.
 */
export function baueAufstellungFuerHeim(
  geordnet: ArenaSpieler[],
  disc: ArenaStufungDisziplin,
  heimTeamId = "m1-sonde-heim",
  gastTeamId = "m1-sonde-gast",
  matchdayId = "m1-sonde-spieltag",
): ArenaAufstellung {
  const players = geordnet.map((p) => ({ id: p.id, name: p.n }));
  const rosters = geordnet.map((p) => ({ id: `roster-${p.id}`, teamId: heimTeamId, playerId: p.id }));
  // WICHTIG: `geordnet[k]` steht in MOCKUP-Reihenfolge (vorne nach hinten, s. MOCKUP_POS_ORDER),
  // die PRODUKTIONS-Themenliste (DISCIPLINE_ROLE_THEMES, ueber die `slotIndex` indiziert) fuehrt
  // dieselben Rollen aber in einer ANDEREN Reihenfolge (z.B. Battlefield: commander, spotter,
  // siegecore, moraleanchor — statt siegecore, moraleanchor, spotter, commander im Mockup). Ein
  // roher `slotIndex=k` wuerde deshalb die falsche Kurzkennung erzeugen (nachgemessen: fuer TDM
  // landete Rang 2 dadurch auf "skirmisher" (Flanke) statt "holdline" (vorn), s. PR-Beschreibung).
  // Die Uebersetzung geht deshalb ausschliesslich ueber die echte Funktion
  // `resolveSlotRoleShortId` (nicht ueber eine geratene Reihenfolge).
  const posOrder = MOCKUP_POS_ORDER[disc].slice(0, geordnet.length);
  const kurzIdZuProduktionsIndex = baueProduktionsIndexZuKurzId(disc);
  const entries = geordnet.map((p, k) => {
    const kurzId = posOrder[k];
    const slotIndex = kurzIdZuProduktionsIndex.get(kurzId);
    if (slotIndex == null) {
      throw new Error(`baueAufstellungFuerHeim: kein Produktions-slotIndex fuer "${kurzId}" (${disc}) gefunden.`);
    }
    return {
      disciplineId: disc,
      disciplineSide: "d1" as const,
      slotIndex,
      playerId: p.id,
      activePlayerId: `roster-${p.id}`,
    };
  });
  const fakeGameState = {
    players,
    rosters,
    seasonState: {
      lineupDrafts: [
        {
          lineupId: "m1-sonde-draft",
          saveId: "m1-sonde",
          seasonId: "m1-sonde",
          matchdayId,
          teamId: heimTeamId,
          status: "resolved" as const,
          entries,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      ],
    },
  };
  return buildArenaAufstellungBeide(fakeGameState as unknown as GameState, heimTeamId, gastTeamId, matchdayId);
}
