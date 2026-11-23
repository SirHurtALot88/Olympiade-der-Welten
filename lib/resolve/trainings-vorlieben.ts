/**
 * TRAININGSVORLIEBEN-REGEL JE SAISON (22.11., docs/design/training-r2-22-11.md Abschnitt 3.5 und docs/design/training-r2-bau-22-11.md).
 *
 * Chris, 22.11.: Jeder Spieler hat zwei Lieblings-Disziplinen, auf die er Lust hat zu trainieren (Training dort x1,15, Moral +3), und eine
 * ungeliebte (x0,80, Moral -6) -- dasselbe Muster wie die Attribut-Affinitaet. Die Vorlieben selbst sind fest je Spieler
 * (`lib/training/trainings-vorlieben.ts`); hier steht nur, OB sie in einer Saison gelten.
 *
 * Die Regel haengt an der SAISON, nicht am Serverstart (Muster `entwicklung-regel.ts`): das Training wird je Spieltag gebucht, ein Umschalten
 * mitten in der Saison liesse gebuchte und kuenftige Spieltage verschieden rechnen. Der Stempel steht IM SPIELSTAND
 * (`seasonState.trainingsVorlieben`) und wird genau zweimal gesetzt: beim Anlegen eines Spiels und beim Saisonwechsel
 * (`preseason-workflow-service.ts`).
 *
 *   "v1"    Vorlieben gelten (Budget-Faktor, Moral-Grund, KI-Gewicht, Heatmap-Markierung)
 *   "aus"   keine Vorlieben
 *
 * BESTEHENDE SAVES: ohne Stempel (oder mit dem Stempel einer anderen Saison) gilt "aus"; die Lade-Migration
 * (`stempleTrainingsVorliebenNachLaden`) schreibt fuer die laufende Saison "aus" fest, ab dem naechsten Saisonwechsel gilt der Schalter.
 * Jeder Rechenweg fragt `trainingsVorliebenRegelFuer(gameState)` bzw. `trainingsVorliebenAktivFuer(gameState)`, nie die Variable.
 *
 * SCHALTER `OLY_TRAINING_VORLIEBEN` (nur Server, deploy/hetzner/docker-compose.yml und .env; kein NEXT_PUBLIC):
 *   nicht gesetzt | "an"   neue Saisons bekommen "v1" (Standard)
 *   "aus"                  Rueckweg: neue Saisons bekommen "aus"; gestempelte Saisons rechnen weiter wie gestempelt
 *   "aus-sofort"           Notbremse: schaltet die Wirkung ab, auch mitten in der Saison (auf dem Server; der Browser sieht die Variable nicht)
 * Nur Battle-Spielstaende bekommen einen Stempel; der Manager-Modus bleibt "aus".
 */
import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";

export type TrainingsVorliebenRegelVersion = "aus" | "v1";

export type TrainingsVorliebenStempel = { seasonId: string; regel: TrainingsVorliebenRegelVersion };

type Schalter = "an" | "aus" | "aus-sofort";

function leseSchalter(wert: string | undefined): Schalter | null {
  const w = (wert ?? "").trim().toLowerCase();
  if (w === "") return null;
  if (w === "aus-sofort" || w === "aus_sofort" || w === "notbremse") return "aus-sofort";
  if (w === "aus" || w === "alt" || w === "0" || w === "false" || w === "nein" || w === "off") return "aus";
  return "an";
}

/** Nur Server-Variable. Die Notbremse wirkt im Browser nur ueber den Stempel, den der Server mitliefert. */
export function trainingsVorliebenSchalter(): Schalter {
  return leseSchalter(process.env.OLY_TRAINING_VORLIEBEN) ?? "an";
}

export type TrainingsVorliebenQuelle =
  | {
      seasonState?: (Pick<SeasonState, "seasonId"> & { trainingsVorlieben?: TrainingsVorliebenStempel | null }) | null;
      season?: { id?: string } | null;
      scenarioMeta?: { gameMode?: string | null } | null;
    }
  | null
  | undefined;

function istBattle(gameState: TrainingsVorliebenQuelle): boolean {
  return gameState?.scenarioMeta?.gameMode === "battle";
}

/** Der Stempel fuer eine NEU beginnende Saison, aus dem Schalter. */
export function trainingsVorliebenFuerNeueSaison(seasonId: string): TrainingsVorliebenStempel {
  return { seasonId, regel: trainingsVorliebenSchalter() === "an" ? "v1" : "aus" };
}

/** Der Stempel eines neuen Saisonstands je Spielmodus: Battle bekommt ihn, Manager keinen. */
export function trainingsVorliebenFuerSpielmodus(gameState: TrainingsVorliebenQuelle, seasonId: string): TrainingsVorliebenStempel | undefined {
  return istBattle(gameState) ? trainingsVorliebenFuerNeueSaison(seasonId) : undefined;
}

/** Setzt den Stempel beim ANLEGEN eines Spiels. Idempotent: ein Stempel derselben Saison bleibt. */
export function stempleTrainingsVorliebenBeimAnlegen(gameState: GameState): GameState {
  const seasonId = gameState.seasonState?.seasonId ?? gameState.season?.id;
  if (!seasonId || !istBattle(gameState)) return gameState;
  if (gameState.seasonState?.trainingsVorlieben?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, trainingsVorlieben: trainingsVorliebenFuerNeueSaison(seasonId) } };
}

/**
 * LADE-MIGRATION: ein Battle-Spielstand ohne gueltigen Stempel der laufenden Saison bekommt "aus" -- die Saison rechnet zu Ende wie
 * gespielt, ab dem naechsten Saisonwechsel gilt der Schalter. Rein und idempotent.
 */
export function stempleTrainingsVorliebenNachLaden<T extends NonNullable<TrainingsVorliebenQuelle> & Pick<GameState, "seasonState">>(gameState: T): T {
  if (!gameState?.seasonState || !istBattle(gameState)) return gameState;
  const seasonId = gameState.seasonState.seasonId;
  if (!seasonId || gameState.seasonState.trainingsVorlieben?.seasonId === seasonId) return gameState;
  return { ...gameState, seasonState: { ...gameState.seasonState, trainingsVorlieben: { seasonId, regel: "aus" as const } } };
}

/** Die Vorliebenregel DIESER Saison. Notbremse, fehlender oder fremder Stempel: "aus". */
export function trainingsVorliebenRegelFuer(gameState: TrainingsVorliebenQuelle): TrainingsVorliebenRegelVersion {
  if (trainingsVorliebenSchalter() === "aus-sofort") return "aus";
  const stempel = gameState?.seasonState?.trainingsVorlieben;
  const seasonId = gameState?.seasonState?.seasonId ?? gameState?.season?.id;
  if (!stempel || !seasonId || stempel.seasonId !== seasonId) return "aus";
  return stempel.regel;
}

/** Kurzform fuer die Rechenwege: gelten in dieser Saison die Trainingsvorlieben? Ohne Spielstand: nein. */
export function trainingsVorliebenAktivFuer(gameState: TrainingsVorliebenQuelle): boolean {
  return trainingsVorliebenRegelFuer(gameState) === "v1";
}
