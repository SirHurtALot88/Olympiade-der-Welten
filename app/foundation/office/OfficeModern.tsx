"use client";

/**
 * OFFICE im Broadcast-Stil (21.11., Chris: „ja überall deine empfehlungen nehmen, bau das so").
 * Vorlage: public/mockups/office-vorstand-21-11.html, Erklaerung docs/design/office-vorstand-21-11.md, Bau: docs/design/office-vorstand-bau-21-11.md.
 * Neu gebaut, nicht in die alte Seite eingehaengt: eigener Kopf mit Reitern (Vorstand und Ziele, Gespraech, Praemien) und Kabine
 * (Kapitaen und Front Office, die schon bestehende Ansicht). Alle Zahlen kommen aus `buildOfficeModell`.
 * Mehrspieler: das Team kommt aus dem aktiven Manager, jeder Schreibweg laeuft serverseitig durch `authorizeServerRoomWrite`.
 */

import { useMemo, useState, type ReactNode } from "react";

import { BcHero, BcIcon, BcReiter } from "@/components/foundation/broadcast";
import { getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import type { GameState, VorstandBitteArt } from "@/lib/data/olyDataTypes";
import { buildOfficeModell } from "@/lib/finance/office-modell";
import type { VorstandAktionFn } from "@/lib/finance/vorstand-aktion-typen";
import { vorstandFordertAlleAufEineKarte } from "@/lib/finance/vorstand-budget-aktionen";
import { C, prozent, zahl } from "./office-format";
import { OfficeGespraechTab } from "./OfficeGespraechTab";
import { OfficePraemienTab } from "./OfficePraemienTab";
import { OfficeVorstandTab } from "./OfficeVorstandTab";

import "./office-modern.css";

export type OfficeReiter = "vorstand" | "gespraech" | "praemien" | "kabine";

export type OfficeModernProps = {
  gameState: GameState;
  /** Aktives Team des Managers (Fog of War: nie ein fremdes). */
  teamId: string | null;
  onVorstandAktion?: VorstandAktionFn;
  kannVerwalten?: boolean;
  /** Inhalt des Reiters Kabine (Kapitaen, Front Office). */
  kabine?: ReactNode;
  startReiter?: OfficeReiter;
};

export default function OfficeModern({ gameState, teamId, onVorstandAktion, kannVerwalten = false, kabine, startReiter = "vorstand" }: OfficeModernProps) {
  const [reiter, setReiter] = useState<OfficeReiter>(startReiter);
  const [startBitte, setStartBitte] = useState<VorstandBitteArt | null>(null);
  const m = useMemo(() => (teamId ? buildOfficeModell(gameState, teamId) : null), [gameState, teamId]);

  if (!teamId || !m) {
    return (
      <div className="bc off" data-testid="office-modern" id="foundation-hq">
        <p className="off-leer" style={{ padding: 24 }}>Kein Team ausgewählt.</p>
      </div>
    );
  }
  const wappen = getStaticTeamLogoUrl(teamId) ?? gameState.teams.find((t) => t.teamId === teamId)?.logoPath ?? null;
  const s = m.stand;
  const aufKurs = m.ziele.filter((z) => z.anzeigeStatus === "completed" || z.anzeigeStatus === "open").length;
  const fordert = vorstandFordertAlleAufEineKarte(gameState, teamId);
  const spieltagText = m.spieltag <= 0 ? "Vor Spieltag 1" : `Nach Spieltag ${m.spieltag} von ${m.spieltageGesamt}`;
  const fragen = (b: VorstandBitteArt) => {
    setStartBitte(b);
    setReiter("gespraech");
  };
  const wechsle = (r: OfficeReiter) => {
    setStartBitte(null);
    setReiter(r);
  };
  const schreiben = kannVerwalten && Boolean(onVorstandAktion);

  return (
    <div className="bc off" data-testid="office-modern" id="foundation-hq">
      <BcHero
        wappen={wappen}
        wappenAlt={m.teamName}
        dachzeile={<>Manager-Zentrale · {m.teamName}</>}
        titel="Office"
        untertitel={
          <>
            Saison {m.saisonNummer} · {spieltagText} · Kasse <b className="bc-t">{C(m.kasse, 1)}</b>
          </>
        }
        mitte={
          <>
            <BcReiter
              aktiv={reiter === "vorstand"}
              onClick={() => wechsle("vorstand")}
              eyebrow={`Freigabe ${prozent(s.wirksamerAnteil)}`}
              titel="Vorstand"
              symbol={<BcIcon name="krone" />}
              wert={m.vertrauen == null ? "—" : zahl(m.vertrauen, 1)}
              wertNote={`Vertrauen · ${aufKurs}/${m.ziele.length} auf Kurs`}
            />
            <BcReiter
              aktiv={reiter === "gespraech"}
              onClick={() => wechsle("gespraech")}
              eyebrow="Mit dem Vorstand"
              titel="Gespräch"
              symbol={<BcIcon name="liste" />}
              wert={s.gedeckelt ? `${m.gespraech.frei}` : "—"}
              wertNote={s.gedeckelt ? "von 2 frei" : "ab Saison 2"}
            />
            <BcReiter
              aktiv={reiter === "praemien"}
              onClick={() => wechsle("praemien")}
              eyebrow="Aus dem Gehaltstopf"
              titel="Prämien"
              symbol={<BcIcon name="karte" />}
              wert={zahl(m.praemien.vorschau.fest, 1)}
              wertNote="C fest geplant"
            />
            <BcReiter
              aktiv={reiter === "kabine"}
              onClick={() => wechsle("kabine")}
              eyebrow="Kapitän · Front Office"
              titel="Kabine"
              symbol={<BcIcon name="team" />}
            />
          </>
        }
      />
      <div className="off-seite">
        {reiter === "vorstand" ? (
          <OfficeVorstandTab
            m={m}
            onFrage={fragen}
            onSprechen={() => wechsle("gespraech")}
            fordert={fordert}
            kannSchreiben={schreiben}
            onFordertAnnehmen={onVorstandAktion ? () => void onVorstandAktion({ aktion: "vorstand_fordert_annehmen" }) : undefined}
          />
        ) : null}
        {reiter === "gespraech" ? (
          <OfficeGespraechTab m={m} gameState={gameState} onAktion={onVorstandAktion} kannSchreiben={schreiben} startBitte={startBitte} />
        ) : null}
        {reiter === "praemien" ? <OfficePraemienTab m={m} onAktion={onVorstandAktion} kannSchreiben={schreiben} /> : null}
        {reiter === "kabine" ? <div className="off-kabine">{kabine}</div> : null}
      </div>
    </div>
  );
}
