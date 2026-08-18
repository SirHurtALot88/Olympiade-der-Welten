/**
 * ENTWUERFE JE TEAM IM GEDAECHTNIS — damit der Teamwechsel die Aufstellung nicht mehr wegwirft.
 *
 * GEMELDET VON CHRIS: „wenn ich das team wechsel dass die seite aktualisiert und die aufstellung
 * weg ist". Der Grund lag in der Schale: der Schluessel, mit dem sie die Einsatzliste aufbaut,
 * enthielt die Team-ID — also baute React beim Teamwechsel alles neu auf, samt jeder
 * ungespeicherten Auswahl. Die Team-ID ist raus (der Client laedt selbst nach, wenn sich
 * `defaultTeamId` aendert). Damit ein Wechsel hin und zurueck die Auswahl auch WIEDERFINDET,
 * merkt sich dieses Gedaechtnis den Entwurf des verlassenen Teams.
 *
 * BEWUSST NUR IM SPEICHER, nicht in der Ablage: ein Entwurf ist kein Spielstand. Ein Neuladen der
 * Seite verwirft ihn weiterhin — alles andere waere eine zweite Wahrheit neben dem gespeicherten
 * Draft, und die gespeicherte gewinnt.
 *
 * Der Entscheidungsteil liegt hier und nicht im Bauteil, weil genau er sich pruefen laesst: was
 * gewinnt beim Laden, wann wird ueberhaupt gemerkt, und wann faellt ein Eintrag wieder weg.
 */
import type { LineupDraftModifiers } from "@/lib/data/olyDataTypes";
import type { MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";

export type GemerkterEntwurf = {
  selections: Record<string, string>;
  captains: Record<"d1" | "d2", string>;
  modifiers: LineupDraftModifiers;
  teamIntensity: MatchdayIntensityStage;
};

/**
 * Ein Ort ist die volle Adresse eines Entwurfs — nicht nur das Team.
 *
 * Der Spieltag laesst sich im Feld daneben wechseln, OHNE dass die Ansicht neu aufgebaut wird; ein
 * Entwurf fuer Spieltag 3 darf beim Sprung auf Spieltag 4 nicht als dessen Entwurf auftauchen.
 * Dasselbe gilt fuer Spielstand, Saison und Quelle (der Referenzmodus zeigt andere Daten).
 */
export type EntwurfOrt = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  source: string;
};

export function entwurfSchluessel(ort: EntwurfOrt): string {
  return `${ort.saveId}::${ort.seasonId}::${ort.matchdayId}::${ort.teamId}::${ort.source}`;
}

export type EntwurfHerkunft = "gedaechtnis" | "ablage";

export type EntwurfGedaechtnis = {
  /**
   * Merkt den Entwurf des Ortes, der gerade verlassen wird — und gibt zurueck, ob er das getan hat.
   *
   * ZWEI LAGEN, IN DENEN NICHT GEMERKT WIRD:
   * - `von` und `nach` sind derselbe Ort. Nach dem Speichern laedt dieselbe Ansicht sich selbst
   *   neu; dort zu merken hiesse, den frisch geholten Server-Stand sofort wieder mit dem lokalen
   *   zu ueberdecken.
   * - es gibt gar keinen Entwurf (`null`), etwa weil noch nichts geladen ist.
   */
  merkeBeimVerlassen(input: { von: EntwurfOrt; nach: EntwurfOrt; entwurf: GemerkterEntwurf | null }): boolean;
  /**
   * Beim Laden gewinnt ein gemerkter Entwurf — das ist der Sinn der Sache.
   *
   * GEGENPROBE, die hier mit drinsteckt: beim ERSTEN Oeffnen ist nichts gemerkt, also gewinnt der
   * gespeicherte Draft aus der Ablage.
   */
  waehleBeimLaden(
    ort: EntwurfOrt,
    ausDerAblage: GemerkterEntwurf,
  ): { entwurf: GemerkterEntwurf; herkunft: EntwurfHerkunft };
  /** Nach einem Schreibvorgang hat die Ablage die Wahrheit — der gemerkte Entwurf darf sie nicht ueberdecken. */
  vergiss(ort: EntwurfOrt): void;
  /** Fuer Schreibvorgaenge ueber viele Teams, die nicht zurueckmelden, welche genau. */
  vergissAlles(): void;
  /** Nur zum Nachmessen in Pruefungen. */
  groesse(): number;
};

export function erzeugeEntwurfGedaechtnis(): EntwurfGedaechtnis {
  const speicher = new Map<string, GemerkterEntwurf>();

  return {
    merkeBeimVerlassen({ von, nach, entwurf }) {
      if (!entwurf) {
        return false;
      }
      if (entwurfSchluessel(von) === entwurfSchluessel(nach)) {
        return false;
      }
      speicher.set(entwurfSchluessel(von), entwurf);
      return true;
    },
    waehleBeimLaden(ort, ausDerAblage) {
      const gemerkt = speicher.get(entwurfSchluessel(ort));
      return gemerkt ? { entwurf: gemerkt, herkunft: "gedaechtnis" } : { entwurf: ausDerAblage, herkunft: "ablage" };
    },
    vergiss(ort) {
      speicher.delete(entwurfSchluessel(ort));
    },
    vergissAlles() {
      speicher.clear();
    },
    groesse() {
      return speicher.size;
    },
  };
}
