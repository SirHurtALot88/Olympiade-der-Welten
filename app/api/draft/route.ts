export const dynamic = "force-dynamic";

/**
 * LIGA-DRAFT IM EINZELSCHRITT — Lese- und Schreibroute (Draft-Neubau, Stufe Kern, 18.11.).
 * Schnittstelle: docs/design/draft-neubau-kern-18-11.md, Abschnitt 5.
 *
 *   GET  /api/draft?saveId=…&teamId=…&vorschau=6&verlauf=40&roomCode/participantId/seatToken/userId…
 *        -> { ansicht: LigaDraftAnsicht | null, hintergrundLaeuft }
 *   POST /api/draft { saveId, teamId, aktion, erwarteteNr, … , roomCode/participantId/seatToken/userId }
 *
 * Aktionen: `ki_schritt` (maxPicks, Standard 1, hoechstens 8), `ki_hintergrund` (KI faehrt im Hintergrund bis zum
 * naechsten Menschen), `pick` (playerId), `auslassen`, `fertig`, `ueberspringen` (variante "A" | "B"), `auto_pick` (an,
 * optional zielTeamId: fuer ein fremdes Team nur der Gastgeber), `starten` (Gastgeber; legt den Draft an, falls keiner
 * laeuft), `abbrechen` (Gastgeber; Draft -> fertig, Marktsperre weg).
 *
 * SCHALTER (Review #1619, S1): mit `OLY_LIGA_DRAFT_MODUS=block` (Rueckweg; Standard seit der Abnahme 19.11. ist der
 * Einzelschritt) schreibt diese Route NICHTS — ausser `abbrechen`, dem Ausweg fuer einen Draft, der aus einer Zeit mit Schalter an
 * liegengeblieben ist. Alle Aktionen ausser
 * `starten` und `abbrechen` brauchen einen laufenden Draft dieser Saison (`ligaDraftLaeuft`), und jede ausser `starten`
 * nennt `erwarteteNr` (= `ansicht.stand`, Schutz vor Doppelklick/Wettlauf; A6).
 *
 * RECHTE wie bei den anderen Schreibrouten: `authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId`, jeder
 * Schreibweg liest frisch (der Dienst liest den Spielstand je Aktion neu). Team-Aktionen brauchen ein EIGENES Team
 * (`teamId`); das Vorspulen der KI braucht ebenfalls ein eigenes Team, als Nachweis des Sitzes. `starten`, `abbrechen`
 * und Auto-Pick fuer ein fremdes Team sind Gastgeber-Aktionen. Die private Sicht `mein` (Vorschlag des GM, Kasse,
 * Reserve) gibt es nur fuer ein Team, fuer das der Aufrufer dasselbe Schreibrecht hat (A7) — sonst nur die oeffentliche.
 */
import { teamsOhneVereinbarung } from "@/lib/finance/vorstand-budget-gespraech";
import { NextResponse } from "next/server";

import { resolveAuthoritativeWriteOwnerId } from "@/lib/auth/session";
import {
  brecheLigaDraftAb,
  bucheMenschAuslassen,
  bucheMenschFertig,
  bucheMenschPick,
  bucheMenschUeberspringen,
  istHintergrundLaufAktiv,
  laufeKiImHintergrund,
  laufeKiZuege,
  LigaDraftFehler,
  LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS,
  LIGA_DRAFT_VOR_JE_HAPPEN,
  setzeMenschAutoPick,
  setzeDraftWunschliste,
  setzeMenschStartWahl,
  spieltNochEinMensch,
  starteLigaDraft,
} from "@/lib/draft/liga-draft-dienst";
import { istEinzelschrittDraftAktiv, ligaDraftDieserSaison, ligaDraftLaeuft, wartetAufStartWahl } from "@/lib/draft/liga-draft-modell";
import { baueLigaDraftAnsicht } from "@/lib/draft/liga-draft-ansicht";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { koopSchreibkonfliktAntwort } from "@/lib/persistence/koop-schreibkonflikt-antwort";
import { getHumanControlledTeamIds } from "@/lib/room/ai-bulk-team-write-scope";
import { parseRoomWriteContextFromRequest } from "@/lib/room/parse-room-write-context";
import { notifyRoomGameplayWrite } from "@/lib/room/room-gameplay-write-notifier";
import { authorizeServerRoomWrite } from "@/lib/room/server-authoritative-write-guard";

type DraftAktion =
  | "ki_schritt"
  | "ki_hintergrund"
  | "pick"
  | "auslassen"
  | "fertig"
  | "ueberspringen"
  | "auto_pick"
  | "starten"
  | "startwahl"
  | "wunschliste"
  | "abbrechen";

const AKTIONEN = new Set<DraftAktion>([
  "ki_schritt",
  "ki_hintergrund",
  "pick",
  "auslassen",
  "fertig",
  "ueberspringen",
  "auto_pick",
  "starten",
  "startwahl",
  "wunschliste",
  "abbrechen",
]);

/** Obergrenze fuer `maxPicks` je `ki_schritt` (Review #1619, A3): ein Aufruf rechnet synchron, ~0,1–0,2 s je Pick. */
const LIGA_DRAFT_MAX_PICKS_JE_SCHRITT = 8;

type DraftRequestBody = {
  saveId?: string;
  teamId?: string;
  aktion?: string;
  playerId?: string;
  variante?: string;
  an?: boolean;
  zielTeamId?: string;
  maxPicks?: number;
  /** `ki_hintergrund`: Vor-Modus mit grossen Happen (Tempo, 19.11.). */
  schnell?: boolean;
  erwarteteNr?: number;
  /** `startwahl`: "spielen" | "selbst". */
  wahl?: string;
  /** `wunschliste`: Anzeigewerte des Spielers aus dem Brett. */
  eintrag?: Record<string, unknown> | null;
  idempotencyKey?: string;
  roomCode?: string | null;
  participantId?: string | null;
  seatToken?: string | null;
  userId?: string | null;
  activeManagerTeamId?: string | null;
};

function zahl(wert: string | null, standard: number): number {
  const n = Number(wert);
  return Number.isFinite(n) ? n : standard;
}

function fehler(code: string, status: number) {
  return NextResponse.json({ success: false, error: code }, { status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saveId = url.searchParams.get("saveId")?.trim() ?? "";
    if (!saveId) return NextResponse.json({ error: "saveId_fehlt" }, { status: 400 });
    const save = createPersistenceService().getSaveById(saveId);
    if (!save) return NextResponse.json({ error: "save_not_found" }, { status: 404 });
    // `mein` (Vorschlag des eigenen GM, Kasse, Pflichtreserve) ist privat: nur fuer ein Team, fuer das der Aufrufer
    // dasselbe Recht hat wie zum Picken (`draft_pick`). Sonst die oeffentliche Sicht ohne `mein` (Review #1619, A7).
    const angefragtesTeam = url.searchParams.get("teamId")?.trim() || null;
    let betrachterTeamId: string | null = null;
    if (angefragtesTeam) {
      const raum = parseRoomWriteContextFromRequest(request);
      const recht = authorizeServerRoomWrite({
        roomCode: raum.roomCode,
        participantId: raum.participantId,
        seatToken: raum.seatToken,
        userId: raum.userId,
        saveId,
        teamId: angefragtesTeam,
        action: "draft_pick",
        source: "sqlite",
        dryRun: false,
        activeManagerTeamId: raum.activeManagerTeamId,
        activeOwnerId: await resolveAuthoritativeWriteOwnerId(),
      });
      if (recht.allowed) betrachterTeamId = angefragtesTeam;
    }
    const ansicht = baueLigaDraftAnsicht({
      gameState: save.gameState,
      saveId,
      betrachterTeamId,
      vorschau: zahl(url.searchParams.get("vorschau"), 6),
      verlaufLimit: zahl(url.searchParams.get("verlauf"), 40),
    });
    return NextResponse.json({ ansicht, hintergrundLaeuft: istHintergrundLaufAktiv(saveId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "draft_lesen_fehlgeschlagen" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as DraftRequestBody;
    const saveId = body.saveId?.trim() ?? "";
    const teamId = body.teamId?.trim() ?? "";
    const aktion = body.aktion as DraftAktion;
    if (!saveId || !AKTIONEN.has(aktion)) return fehler("saveId_oder_aktion_fehlt", 400);

    // Schalter (Review #1619, S1): ohne ihn ist die Route stumm — nur `abbrechen` bleibt als Ausweg.
    if (aktion !== "abbrechen" && !istEinzelschrittDraftAktiv()) return fehler("liga_draft_modus_aus", 409);

    const persistence = createPersistenceService();
    const vorher = persistence.getSaveById(saveId);
    if (!vorher) return fehler("save_not_found", 404);
    if (aktion === "abbrechen") {
      if (!ligaDraftDieserSaison(vorher.gameState)) return fehler("liga_draft_fehlt", 404);
    } else if (aktion !== "starten" && !ligaDraftLaeuft(vorher.gameState)) {
      return fehler("draft_laeuft_nicht", 409);
    }

    // BUDGET-GESPRAECH (23.11.): in Saison 1 wartet der Draft, bis alle Menschen, die selbst verhandeln, unterschrieben haben.
    if (aktion !== "starten" && aktion !== "abbrechen" && aktion !== "wunschliste") {
      const wartet = teamsOhneVereinbarung(vorher.gameState);
      if (wartet.length > 0) {
        return NextResponse.json({ success: false, error: "budget_vereinbarung_fehlt", wartetAuf: wartet }, { status: 409 });
      }
    }

    // A6: jede schreibende Aktion ausser `starten` nennt den Stand, den sie gesehen hat.
    const erwarteteNr = typeof body.erwarteteNr === "number" && Number.isInteger(body.erwarteteNr) ? body.erwarteteNr : null;
    if (aktion !== "starten" && aktion !== "abbrechen" && erwarteteNr == null) return fehler("erwarteteNr_fehlt", 400);
    /**
     * STANDUNABHAENGIGE AKTIONEN (Abnahme 19.11., Fehler F2, docs/design/abnahme-saison-19-11.md): Ueberspringen, Auto-Pick und
     * „Ich bin fertig“ haengen nicht am Platz im Draft. Waehrend die KI im Hintergrund pickt (0,1–0,2 s je Pick), war jeder
     * gesehene Stand beim Eintreffen schon veraltet — „Ueberspringen“ scheiterte mehrfach still (gemessen: 3 Klicks). Fuer
     * diese Aktionen prueft der Dienst den Stand nicht; `erwarteteNr` bleibt Pflicht (A6, Protokoll), Doppelklick ist harmlos
     * (Auto-Pick/Variante B setzen denselben Zustand, Variante A und „fertig“ lehnt der Dienst beim zweiten Mal ab).
     */
    const standFuerDienst = aktion === "ueberspringen" || aktion === "startwahl" || aktion === "wunschliste" || aktion === "auto_pick" || aktion === "fertig" ? null : erwarteteNr;

    // Gastgeber-Aktionen: Draft anlegen/abbrechen, Auto-Pick fuer ein fremdes Team (Konzept Frage 7: „Auto-Pick
    // auslösen“ für einen Abwesenden, mit Rueckfrage in der Seite und Eintrag im Verlauf).
    const zielTeamId = body.zielTeamId?.trim() || teamId;
    const gastgeberAktion =
      aktion === "starten" || aktion === "abbrechen" || (aktion === "auto_pick" && zielTeamId !== teamId);
    if (!gastgeberAktion && !teamId) return fehler("teamId_fehlt", 400);
    const activeOwnerId = await resolveAuthoritativeWriteOwnerId();
    const rechtFuer = (zielTeam: string | null, recht: "draft_pick" | "ai_picks_run_execute") =>
      authorizeServerRoomWrite({
        roomCode: body.roomCode,
        participantId: body.participantId,
        seatToken: body.seatToken,
        userId: body.userId,
        saveId,
        teamId: zielTeam,
        action: recht,
        source: "sqlite",
        dryRun: false,
        activeManagerTeamId: body.activeManagerTeamId,
        activeOwnerId,
      });
    const writeAuth = gastgeberAktion ? rechtFuer(null, "ai_picks_run_execute") : rechtFuer(teamId, "draft_pick");
    if (!writeAuth.allowed) {
      return NextResponse.json({ success: false, error: writeAuth.reason, warnings: writeAuth.warnings }, { status: writeAuth.status });
    }
    // Die Antwort traegt `mein` nur fuer ein Team, das der Aufrufer auch als Team schreiben darf (A7).
    const meinTeamId = !teamId ? null : !gastgeberAktion || rechtFuer(teamId, "draft_pick").allowed ? teamId : null;

    let ergebnis: Record<string, unknown> = {};
    switch (aktion) {
      case "starten": {
        // Menschliche Teams picken selbst (S1) — Auto-Pick nur mit delegiertem Draft (`draft: "ki"`), s. Dienst.
        const selbstPickendeTeamIds = [...getHumanControlledTeamIds({ gameState: vorher.gameState, room: writeAuth.room ?? null })];
        ergebnis = { draft: starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds }) };
        break;
      }
      case "abbrechen":
        // Standunabhaengig (21.11.): `erwarteteNr` wird nicht geprueft — die KI pickt im Hintergrund, der gesehene Stand ist veraltet.
        ergebnis = { draft: brecheLigaDraftAb({ persistence, saveId }) };
        break;
      case "ki_schritt": {
        const maxPicks = Math.max(1, Math.min(LIGA_DRAFT_MAX_PICKS_JE_SCHRITT, Math.floor(Number(body.maxPicks) || 1)));
        ergebnis = laufeKiZuege({ persistence, saveId, maxPicks, erwarteteNr });
        break;
      }
      case "ki_hintergrund": {
        if (ligaDraftDieserSaison(vorher.gameState)?.verlauf.length !== erwarteteNr) {
          throw new LigaDraftFehler("draft_stand_veraltet");
        }
        // Kehrt sofort zurueck; den Fortschritt liest die Seite ueber GET (Variante A/B: „KI pickt fertig“).
        // `schnell`: „Vor zu meinem Pick“ — grosse Happen, ein Schreiben je ~1 s Picks (Dienst: LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS).
        void laufeKiImHintergrund({
          persistence,
          saveId,
          logPrefix: "[api/draft]",
          ...(body.schnell === true ? { jeHappen: LIGA_DRAFT_VOR_JE_HAPPEN, happenBudgetMs: LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS } : {}),
        }).catch(() => undefined);
        ergebnis = { gestartet: true };
        break;
      }
      case "pick":
        if (!body.playerId) return fehler("playerId_fehlt", 400);
        ergebnis = bucheMenschPick({
          persistence,
          saveId,
          teamId,
          playerId: body.playerId,
          erwarteteNr,
          idempotencyKey: body.idempotencyKey,
        });
        break;
      case "startwahl": {
        const wahl = body.wahl === "selbst" ? "selbst" : body.wahl === "spielen" ? "spielen" : null;
        if (!wahl) return fehler("wahl_fehlt", 400);
        const draft = setzeMenschStartWahl({ persistence, saveId, teamId, wahl });
        // „Selbst kaufen“: die KI pickt sofort durch (Hintergrundlauf), sobald alle gewaehlt haben und kein Mensch mehr
        // mitspielt. Spielt noch einer, treibt dessen Seite den Takt.
        if (wahl === "selbst" && !wartetAufStartWahl(draft) && !spieltNochEinMensch(draft)) {
          // Alle KI-Picks in einem Happen mit einem Schreiben (Tempo, 21.11.).
          void laufeKiImHintergrund({
            persistence,
            saveId,
            logPrefix: "[api/draft]",
            jeHappen: LIGA_DRAFT_VOR_JE_HAPPEN,
            happenBudgetMs: LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS,
          }).catch(() => undefined);
        }
        ergebnis = { draft };
        break;
      }
      case "wunschliste": {
        if (!body.playerId) return fehler("playerId_fehlt", 400);
        const e = body.eintrag ?? {};
        const text = (k: string) => (typeof e[k] === "string" ? (e[k] as string) : undefined);
        const zahl = (k: string) => (typeof e[k] === "number" && Number.isFinite(e[k] as number) ? (e[k] as number) : null);
        const anzahl = setzeDraftWunschliste({
          persistence,
          saveId,
          teamId,
          playerId: body.playerId,
          an: body.an !== false,
          eintrag: {
            playerName: text("playerName"),
            className: text("className"),
            race: text("race"),
            marketValue: zahl("marketValue"),
            salary: zahl("salary"),
            bracket: zahl("bracket"),
            pow: zahl("pow"),
            spe: zahl("spe"),
            men: zahl("men"),
            soc: zahl("soc"),
          },
        });
        ergebnis = { wunschlisteAnzahl: anzahl };
        break;
      }
      case "auslassen":
        ergebnis = { draft: bucheMenschAuslassen({ persistence, saveId, teamId, erwarteteNr }) };
        break;
      case "fertig":
        ergebnis = { draft: bucheMenschFertig({ persistence, saveId, teamId, erwarteteNr: standFuerDienst }) };
        break;
      case "ueberspringen": {
        const variante = body.variante === "B" ? "B" : body.variante === "A" ? "A" : null;
        if (!variante) return fehler("variante_fehlt", 400);
        ergebnis = { draft: bucheMenschUeberspringen({ persistence, saveId, teamId, variante, erwarteteNr: standFuerDienst }) };
        break;
      }
      case "auto_pick":
        ergebnis = { draft: setzeMenschAutoPick({ persistence, saveId, teamId: zielTeamId, an: body.an !== false, erwarteteNr: standFuerDienst }) };
        break;
    }

    notifyRoomGameplayWrite(writeAuth, {
      saveId,
      teamId: zielTeamId || null,
      action: `liga_draft_${aktion}`,
      eventType: "roster_updated",
      affectedViews: ["draft", "market", "team"],
      dryRun: false,
      success: true,
    });

    const save = persistence.getSaveById(saveId);
    const ansicht = save
      ? baueLigaDraftAnsicht({ gameState: save.gameState, saveId, betrachterTeamId: meinTeamId, vorschau: 6 })
      : null;
    // Den rohen Draft-Zustand nicht doppelt schicken — die Sicht traegt alles, was die Seite braucht.
    const { draft: _draft, ...rest } = ergebnis as { draft?: unknown };
    return NextResponse.json({ success: true, ...rest, ansicht });
  } catch (error) {
    if (error instanceof LigaDraftFehler) {
      return NextResponse.json({ success: false, error: error.code }, { status: error.status });
    }
    const koopKonflikt = koopSchreibkonfliktAntwort(error);
    if (koopKonflikt) return koopKonflikt;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "draft_aktion_fehlgeschlagen" },
      { status: 500 },
    );
  }
}
