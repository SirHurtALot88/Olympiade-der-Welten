"use client";

import type { RegieMitspieler, RegieSchritt } from "@/lib/foundation/battle-arena/arena-regie";

/**
 * REGIELEISTE (18.11., Mockup `public/mockups/arena-spieltag-modern-18-11.html`, Abschnitt 2 der
 * Erklaerung): links der Ort (Spieltag, Liga), in der Mitte die drei Schritte des Spieltags, rechts die
 * Mitspieler im Raum und fest "Du steuerst: <Team>". Reine Darstellung -- Status kommt aus
 * `baueRegieSchritte` (gebucht, nicht "Arena lief durch").
 */
export type ArenaRegie = {
  spieltagText: string;
  ligaText: string | null;
  schritte: RegieSchritt[];
  mitspieler: RegieMitspieler[];
  eigenesTeamName: string | null;
};

export default function ArenaRegieleiste({ regie, aktuellerTitel }: { regie: ArenaRegie; aktuellerTitel?: string }) {
  return (
    <div className="oly-regie" data-testid="arena-regieleiste" aria-label="Spieltag-Ablauf">
      <div className="oly-regie-ort">
        <b>{regie.spieltagText}</b>
        <span>{[regie.ligaText, aktuellerTitel].filter(Boolean).join(" · ")}</span>
      </div>
      <ol className="oly-regie-schritte">
        {regie.schritte.map((schritt, index) => (
          <li
            key={schritt.id}
            className="oly-regie-schritt"
            data-status={schritt.status}
            data-testid={`arena-regie-schritt-${schritt.id}`}
            aria-current={schritt.status === "aktuell" ? "step" : undefined}
          >
            <span className="nr" aria-hidden>
              {schritt.status === "erledigt" ? "✓" : index + 1}
            </span>
            <span>
              {schritt.label}
              {schritt.disziplinName ? <small>{schritt.disziplinName}</small> : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="oly-regie-rechts">
        {regie.mitspieler.length > 1 ? (
          <div className="oly-regie-raum" title="Im Raum">
            {regie.mitspieler.map((spieler) => (
              <span key={spieler.teamId} className={spieler.istEigen ? "ist-eigen" : undefined}>
                {spieler.spielerName ?? spieler.teamName}
              </span>
            ))}
          </div>
        ) : null}
        {regie.eigenesTeamName ? (
          <span className="oly-regie-du" data-testid="arena-regie-du">
            <em>Du steuerst</em>
            {regie.eigenesTeamName}
          </span>
        ) : null}
      </div>
    </div>
  );
}
