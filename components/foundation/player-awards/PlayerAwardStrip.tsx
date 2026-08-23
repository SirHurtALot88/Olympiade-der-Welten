"use client";

import type { PlayerSeasonAward } from "@/lib/foundation/player-season-awards";

/**
 * DIE AUSZEICHNUNGEN EINES SPIELERS — EINE Darstellung fuer Profil UND Arena.
 *
 * CHRIS (Ticket #41): „Dafür hätte ich gerne im Spielerprofil die Icons dass man auch später
 * direkt sieht ah der spieler gehört [dazu]" — nachgereicht: „auch in den drawern der arena
 * sollen die awards dann auftauchen".
 *
 * ZWEI GROESSEN, EINE KOMPONENTE. Im Profil ist Platz fuer die ganze Marke (Zeichen, Name,
 * Saison); in der Arena-Zeile nur fuer das Zeichen. Das getrennt zu bauen waere derselbe Fehler,
 * den die halbe Ticketliste dieser Runde beschreibt — zwei Darstellungen derselben Sache, die
 * beim naechsten Umbau auseinanderlaufen. Der Grund steht in beiden Groessen im `title`.
 *
 * KEIN LEERER ABSCHNITT. Ohne Auszeichnungen gibt die Komponente `null` zurueck, und der Aufrufer
 * zeigt gar nichts. „Hat nichts gewonnen" und „dieser Spielstand kennt das Feld noch nicht" sind
 * zwei verschiedene Aussagen; eine leere Leiste liesse beide gleich aussehen — und in einer
 * laufenden ERSTEN Saison waere sie bei jedem Spieler zu sehen, weil Auszeichnungen erst beim
 * Saisonabschluss fallen.
 */
export function PlayerAwardStrip({
  awards,
  variant = "full",
  className,
}: {
  awards: readonly PlayerSeasonAward[] | null | undefined;
  /**
   * `full` = Marke mit Zeichen, Name und Saison (Spielerprofil).
   * `icons` = nur die Zeichen (Arena-Zeile, wo eine Marke die Zeile sprengen wuerde).
   */
  variant?: "full" | "icons";
  className?: string;
}) {
  if (!awards || awards.length === 0) {
    return null;
  }

  const beschriftung = (award: PlayerSeasonAward) =>
    `${award.label} · ${award.seasonName} — ${award.reason}`;

  if (variant === "icons") {
    return (
      <span
        className={`nl-award-icons${className ? ` ${className}` : ""}`}
        data-testid="player-award-icons"
        aria-label={`Auszeichnungen: ${awards.map((award) => award.label).join(", ")}`}
      >
        {awards.map((award) => (
          <span key={`${award.seasonId}-${award.awardId}`} title={beschriftung(award)}>
            {award.icon}
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className={`nl-award-strip${className ? ` ${className}` : ""}`} data-testid="player-award-strip">
      <span className="nl-award-strip-label">Auszeichnungen</span>
      <div className="nl-award-strip-list">
        {awards.map((award) => (
          <span
            key={`${award.seasonId}-${award.awardId}`}
            className="nl-award-chip"
            /* Der Grund gehoert an die Marke. Ein Titel ohne Begruendung ist Dekoration — und
               genau die Frage „wofuer eigentlich?" stand am Anfang dieses Tickets. */
            title={beschriftung(award)}
          >
            <span className="nl-award-chip-icon" aria-hidden="true">
              {award.icon}
            </span>
            <span className="nl-award-chip-label">{award.label}</span>
            <span className="nl-award-chip-season nl-tnum">{shortSeason(award.seasonId)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * „season-1" wird zu „S1". Die Marke traegt schon Zeichen und Namen; der volle Saisonname waere
 * die dritte lange Zeichenkette in einer Zeile, die mehrere Marken nebeneinander stellen soll.
 * Der volle Name steht weiterhin im `title`.
 */
function shortSeason(seasonId: string): string {
  const treffer = /(\d+)\s*$/.exec(seasonId);
  return treffer ? `S${treffer[1]}` : seasonId;
}
