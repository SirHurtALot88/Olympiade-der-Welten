/**
 * TRAININGSVORLIEBEN (Chris, 22.11., docs/design/training-r2-22-11.md Abschnitt 3 und docs/design/training-r2-bau-22-11.md).
 *
 * Jeder Spieler hat zwei Lieblings-Disziplinen, auf die er Lust hat zu trainieren, und eine ungeliebte -- dasselbe Muster wie die
 * Attribut-Affinitaet (`deriveAttributeAffinityProfile`: zwei Signatur-Attribute, ein schwaches). Wirkung:
 *
 *   Ziel = Lieblings-Disziplin   Trainingsbudget x1,30 (Chris 23.11.), Moral +3, solange sie Ziel ist
 *   Ziel = ungeliebte Disziplin  Trainingsbudget x0,50 (Chris 23.11.),      Moral -6, solange sie Ziel ist
 *
 * FEST JE SPIELER UND SAISON, DETERMINISTISCH: aus `player.id`, der Saison-Id (Chris 23.11.: neue Vorlieben jede Saison) und der Klassenfarbe
 * abgeleitet, kein Zufall, kein Spielstandsfeld.
 * Dasselbe Spiel, dieselben Vorlieben, fuer Mensch und KI gleich, ueber Saisons stabil. Weder Staerke noch Eignung gehen ein (die aendern sich mit
 * dem Training; sonst wuerden Vorlieben von Saison zu Saison springen).
 *
 * Wuerfelregel: starker Zufall (FNV-Hash von id + Disziplin), leichte Tendenz (+0,15): Lieblinge eher in der Klassenfarbe, die ungeliebte eher in der
 * Gegenfarbe (POW<->MEN, SPE<->SOC wie bei den Formkarten). Klassen ohne Farbe (BALANCED) bekommen keine Tendenz.
 *
 * Diese Datei kennt nur die Ableitung und die Zahlen. OB die Vorlieben in einer Saison gelten, entscheidet der Stempel
 * (`lib/resolve/trainings-vorlieben.ts`), den jeder Rechenweg selbst fragt.
 */
import type { Player } from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import { getPlayerClassColor } from "@/lib/lineups/legacy-lineup-modifiers";
import { GEGENFARBE } from "@/lib/lineups/formkarten-farbregel";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";

/** Trainingsbudget-Faktor einer Lieblings-/ungeliebten Disziplin (Chris, 23.11.: Boost +30 %, Malus -50 %; vorher wie die Attribut-Affinitaet x1,15/x0,80). */
export const VORLIEBE_FAKTOR_LIEBLING = 1.3;
export const VORLIEBE_FAKTOR_UNGELIEBT = 0.5;
/** Moral-Wirkung, solange die Disziplin Trainingsziel ist (Chris, 22.11.). */
export const VORLIEBE_MORAL_LIEBLING = 3;
export const VORLIEBE_MORAL_UNGELIEBT = -6;
/** Staerke der Farbtendenz in der Wuerfelregel. */
export const VORLIEBE_TENDENZ = 0.15;

/**
 * AUSGLEICH (22.11., Messung docs/design/training-r2-bau-22-11.md Abschnitt 4): Zwei von zwanzig Disziplinen geben +30 %, eine -50 %; wer gezielt auf
 * Lieblinge trainiert, bekommt im Ligamittel mehr Training. Gilt NUR, solange die Vorlieben-Regel der Saison "v1" ist (Faktor auf dem Trainingsbudget
 * je Spieltag, in `berechneSpieltagsZuwachs`), damit der Rueckweg `OLY_TRAINING_VORLIEBEN=aus` exakt den Stand vor Runde 2 liefert.
 */
// 23.11. auf +30/-50 umgestellt, ohne Neumessung (Chris: "musst du nicht messen"): aus den gemessenen Zielanteilen der KI (Liebling 16,9 %,
// ungeliebt 1,5 % der Trainingstage) folgt ein Budget-Plus von 0,169*0,30 - 0,015*0,50 = 4,3 %, also Ausgleich 1/1,043 = 0,959.
export const TRAININGS_VORLIEBEN_AUSGLEICH = 0.959;

export type TrainingsVorlieben = {
  /** Die zwei Lieblings-Disziplinen (Matrix-Ids), in Reihenfolge ihrer Staerke. */
  lieblinge: [string, string];
  /** Die ungeliebte Disziplin. */
  ungeliebt: string;
};

export type VorliebeArt = 1 | 0 | -1;

/** FNV-1a 32 Bit auf 0..1 (derselbe Hash wie im Mockup). */
function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

const KATEGORIE_ZU_FARBE: Record<string, "red" | "green" | "blue" | "yellow"> =
  { power: "red", speed: "green", mental: "blue", social: "yellow" };

/** Disziplinfarbe (Formkarten-Farbe der Kategorie): rot POW, gruen SPE, blau MEN, gelb SOC. */
export function disziplinFarbe(
  disziplinId: string,
): "red" | "green" | "blue" | "yellow" | null {
  const kategorie = foundationSeedDisciplines.find(
    (d) => d.id === disziplinId,
  )?.category;
  return kategorie ? (KATEGORIE_ZU_FARBE[kategorie] ?? null) : null;
}

const cache = new Map<string, TrainingsVorlieben>();

/**
 * Die Vorlieben eines Spielers IN EINER SAISON. Rein; Ergebnis wird je (Id, Saison, Klassenfarbe) zwischengespeichert.
 * Chris, 23.11.: die Vorlieben wechseln mindestens einmal je Saison -- die Saison-Id geht deshalb in den Wuerfel ein. Innerhalb einer Saison
 * bleiben sie fest (Buchung, Vorschau, Heatmap und Moral rechnen alle mit derselben Saison-Id: gezeigt = gebucht).
 */
export function leiteTrainingsVorliebenAb(
  player: Pick<Player, "id" | "className">,
  saisonId: string,
): TrainingsVorlieben {
  const klassenFarbe = getPlayerClassColor(player as Player);
  const schluessel = `${player.id}|${saisonId}|${klassenFarbe ?? "-"}`;
  const vorhanden = cache.get(schluessel);
  if (vorhanden) return vorhanden;
  const gegenFarbe = klassenFarbe ? (GEGENFARBE[klassenFarbe] ?? null) : null;
  const ids = [...officialDisciplineWeightOrder] as string[];
  const lieb = (d: string) =>
    hash01(`${player.id}:${saisonId}:lieb:${d}`) +
    (klassenFarbe && disziplinFarbe(d) === klassenFarbe ? VORLIEBE_TENDENZ : 0);
  const unlieb = (d: string) =>
    hash01(`${player.id}:${saisonId}:unlieb:${d}`) +
    (gegenFarbe && disziplinFarbe(d) === gegenFarbe ? VORLIEBE_TENDENZ : 0);
  const sortiert = [...ids].sort(
    (a, b) => lieb(b) - lieb(a) || a.localeCompare(b),
  );
  const lieblinge: [string, string] = [sortiert[0]!, sortiert[1]!];
  const ungeliebt = [...ids]
    .filter((d) => !lieblinge.includes(d))
    .sort((a, b) => unlieb(b) - unlieb(a) || a.localeCompare(b))[0]!;
  const ergebnis = { lieblinge, ungeliebt } satisfies TrainingsVorlieben;
  if (cache.size > 5000) cache.clear();
  cache.set(schluessel, ergebnis);
  return ergebnis;
}

/** 1 = Lieblings-Disziplin, -1 = ungeliebt, 0 = neutral. Ohne Disziplin: 0. */
export function vorliebeArt(
  player: Pick<Player, "id" | "className">,
  disziplinId: string | null | undefined,
  saisonId: string,
): VorliebeArt {
  if (!disziplinId) return 0;
  const v = leiteTrainingsVorliebenAb(player, saisonId);
  if (v.lieblinge.includes(disziplinId)) return 1;
  return v.ungeliebt === disziplinId ? -1 : 0;
}

export function vorliebeFaktor(art: VorliebeArt): number {
  return art > 0
    ? VORLIEBE_FAKTOR_LIEBLING
    : art < 0
      ? VORLIEBE_FAKTOR_UNGELIEBT
      : 1;
}

export function vorliebeMoral(art: VorliebeArt): number {
  return art > 0
    ? VORLIEBE_MORAL_LIEBLING
    : art < 0
      ? VORLIEBE_MORAL_UNGELIEBT
      : 0;
}

/**
 * Die Disziplin, auf die der Spieler gerade trainiert, soweit sie ohne den KI-Kontext bekannt ist: das gesetzte Ziel des Managers, sonst das Ziel
 * seines letzten gebuchten Trainingstags dieser Saison. Fuer die Moral (kein Zugriff auf den teuren KI-Vorschlag).
 */
export function aktuellesTrainingsZielId(
  player: Pick<Player, "trainingsZiel" | "seasonTrainingAccumulator">,
  seasonId: string,
): string | null {
  if (player.trainingsZiel?.disziplinId)
    return player.trainingsZiel.disziplinId;
  const akku = player.seasonTrainingAccumulator;
  if (!akku || akku.seasonId !== seasonId) return null;
  const verlauf = akku.verlauf ?? [];
  for (let i = verlauf.length - 1; i >= 0; i -= 1) {
    const e = verlauf[i]!;
    if (e.s === "t" && e.d) return e.d;
  }
  return null;
}
