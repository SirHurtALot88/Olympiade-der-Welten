"use client";

/**
 * REITER „GEGNER“ der modernen Einsatzliste (Optik-Runde 18.11., Mockup `einsatzliste-modern-17-11.html`,
 * Reiter „Gegner“): Gegnerkarte mit Scouting, Platz gegen Platz mit ±, Gruppe am Spieltag (bei
 * Vierergruppen alle drei Gegner) und Saison-Rivalen.
 *
 * Alles aus dem Spielstand: Spannen kommen aus `schaetzeGegnerAufstellung` (rohe Disziplin-Eignung,
 * nach Scouting-Stufe gestreut), die Ränge aus `buildTeamDisciplineRankRowsFromGameState`. Wo der Gegner
 * seine Aufstellung noch nicht gesetzt hat, ist es eine PROGNOSE (beste Aufstellung) und steht auch so
 * da. Keine erfundenen Zahlen; reine Anzeige.
 */
import { useMemo, useState } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { getPlayerPortraitBrowserUrl, getPlayerPortraitInitials, getStaticTeamLogoUrl } from "@/lib/data/mediaAssets";
import { berechneDisziRang } from "@/lib/lineups/einsatzliste-diszi-rang";
import { baueGruppenStand, duellStand, spannenMitte, type GruppenEingang } from "@/lib/lineups/einsatzliste-gegner-vergleich";
import { schaetzeGegnerAufstellung, type GegnerSchaetzung, type GegnerSeite } from "@/lib/lineups/gegner-schaetzung";

const ZAHL = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const vz = (wert: number) => `${wert > 0.05 ? "+" : wert < -0.05 ? "−" : "±"}${ZAHL.format(Math.abs(wert))}`;

export type GegnerTabPlatz = {
  key: string;
  slotIndex: number;
  kuerzel: string;
  rolle: string;
  eigenName: string | null;
  eigenPortrait: string | null;
  eigenWert: number | null;
};

export type GegnerTabProps = {
  gameState: GameState | null | undefined;
  eigenesTeamId: string;
  eigenerTeamName: string;
  seasonId: string;
  matchdayId: string;
  seite: GegnerSeite;
  disziplinId: string | null;
  disziplinName: string;
  plaetze: GegnerTabPlatz[];
  gegner: GegnerSchaetzung;
  gruppe: { art: "pod" | "duell"; gegnerNamen: string[]; gegnerTeamIds?: string[] } | null;
  rivalen: Array<{ teamId: string; teamName: string; rank: number }>;
};

function Bild({ url, name, klasse }: { url: string | null; name: string; klasse: string }) {
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

function TeamLogo({ teamId, name }: { teamId: string; name: string }) {
  const [fehler, setFehler] = useState(false);
  const url = getStaticTeamLogoUrl(teamId);
  return (
    <span className="gg-logo" aria-hidden="true">
      {name.slice(0, 2)}
      {url && !fehler ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFehler(true)} />
      ) : null}
    </span>
  );
}

const QUELLE_TEXT: Record<string, string> = {
  verdeckt: "Auf dieser Scouting-Stufe ist die Aufstellung nicht erkennbar.",
  "ki-muster": "Aufstellung aus dem erkannten Einsatzmuster der KI. Immer noch eine Schätzung.",
  prognose: "Prognose: die wahrscheinlich beste Aufstellung des Gegners. Er kann abweichen.",
};

export function EinsatzlisteGegnerTab(p: GegnerTabProps) {
  const { gameState, gegner, gruppe, seite, disziplinId, plaetze } = p;

  // Rang je Team in dieser Disziplin, wie im Kopf der Einsatzliste: Liga-Rang zuerst (Rang 1 = bester),
  // dazu der Rang unter allen. Quelle: Saisonwertung, vor der ersten Wertung die Kaderstärke.
  const disziplinRang = useMemo(() => {
    const karte = new Map<string, { liga: number | null; ligaName: string | null; gesamt: number }>();
    if (!gameState || !disziplinId) return karte;
    const ids = new Set<string>([...(gruppe?.gegnerTeamIds ?? []), ...(gegner.status === "geschaetzt" ? [gegner.gegnerTeamId] : [])]);
    for (const id of ids) {
      try {
        const r = berechneDisziRang(gameState, id, disziplinId);
        if (r) karte.set(id, { liga: r.liga, ligaName: r.ligaName, gesamt: r.gesamt });
      } catch {
        // ohne Rang bleibt die Zeile ohne Zahl
      }
    }
    return karte;
  }, [gameState, disziplinId, gruppe, gegner]);
  const rangText = (teamId: string): string => {
    const r = disziplinRang.get(teamId);
    if (!r) return "ohne Rang";
    return `Rang ${r.liga ?? r.gesamt}${r.liga != null && r.ligaName ? ` · ${r.ligaName}` : ""}`;
  };

  const spielerVon = useMemo(() => new Map((gameState?.players ?? []).map((pl) => [pl.id, pl] as const)), [gameState]);
  const portraitVon = (id: string | null | undefined) => {
    if (!id) return null;
    const pl = spielerVon.get(id);
    return getPlayerPortraitBrowserUrl(id, pl?.portraitUrl ?? null, null);
  };

  const gegnerSeite = gegner.status === "geschaetzt" ? gegner.seiten[seite] ?? null : null;
  const slotZahl = plaetze.length;

  // Vierergruppe: jeden der drei Mitspieler einzeln schätzen (dieselbe Rechnung wie das Duell).
  const gruppenGegner = useMemo(() => {
    if (!gruppe || gruppe.art !== "pod" || !gruppe.gegnerTeamIds || !gameState || !disziplinId) return [];
    return gruppe.gegnerTeamIds.map((teamId, i) => {
      let schaetzung: GegnerSchaetzung = { status: "unbekannt", grund: "nicht bekannt" };
      try {
        schaetzung = schaetzeGegnerAufstellung({
          gameState,
          eigenesTeamId: p.eigenesTeamId,
          seasonId: p.seasonId,
          matchdayId: p.matchdayId,
          seiten: [{ seite, disciplineId: disziplinId, slotCount: slotZahl }],
          gegnerTeamId: teamId,
        });
      } catch {
        // bleibt unbekannt
      }
      return { teamId, name: gruppe.gegnerNamen[i] ?? teamId, schaetzung };
    });
  }, [gruppe, gameState, disziplinId, p.eigenesTeamId, p.seasonId, p.matchdayId, seite, slotZahl]);

  const eigenSchnitt = useMemo(() => {
    const werte = plaetze.flatMap((pl) => (pl.eigenWert != null ? [pl.eigenWert] : []));
    return werte.length > 0 ? werte.reduce((a, b) => a + b, 0) / werte.length : null;
  }, [plaetze]);

  const gruppenStand = useMemo(() => {
    if (gruppenGegner.length === 0) return [];
    const eingang: GruppenEingang[] = [
      { teamId: p.eigenesTeamId, name: p.eigenerTeamName, wir: true, wert: eigenSchnitt, spanne: null, prognose: false },
      ...gruppenGegner.map((g): GruppenEingang => {
        const s = g.schaetzung.status === "geschaetzt" ? g.schaetzung : null;
        return {
          teamId: g.teamId,
          name: g.name,
          wir: false,
          wert: null,
          spanne: s?.seiten[seite]?.schnitt ?? null,
          prognose: !s || s.quelle !== "ki-muster",
        };
      }),
    ];
    return baueGruppenStand(eingang);
  }, [gruppenGegner, p.eigenesTeamId, p.eigenerTeamName, eigenSchnitt, seite]);

  const geschaetzt = gegner.status === "geschaetzt" ? gegner : null;
  const stufe = geschaetzt?.stufe ?? 0;
  const istPod = gruppe?.art === "pod";

  return (
    <div className="gg" data-testid="elm-gegner">
      {istPod ? (
        <p className="gg-quelle" data-testid="elm-gegner-podkopf">
          <span className="bc-marke is-gelb">4 TEAMS · POD</span>
          Vierergruppe: {gruppe?.gegnerNamen.join(" · ") ?? ""}. Gewertet wird die Platzierung unter allen vier Teams.
        </p>
      ) : geschaetzt ? (
        <div className="gg-karte">
          <TeamLogo teamId={geschaetzt.gegnerTeamId} name={geschaetzt.gegnerName} />
          <div className="gg-karte__text">
            <span className="bc-gk">{istPod ? "Gegner im Duell-Plan" : "Gegner"} · {geschaetzt.steuerung === "ki" ? "KI" : "Mensch"}</span>
            <b>{geschaetzt.gegnerName}</b>
            <span>
              {p.disziplinName} · {rangText(geschaetzt.gegnerTeamId)}
            </span>
          </div>
          <div className="gg-karte__scout" title="Scouting-Stufe der Kader-Spieler, gemittelt">
            <span className="bc-gk">Scouting</span>
            <span className="gg-punkte" aria-label={`Stufe ${stufe} von 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} className={n <= stufe ? "an" : ""} />
              ))}
            </span>
            <small>Treffsicherheit ca. {geschaetzt.treffsicherheitPct} %</small>
          </div>
        </div>
      ) : istPod ? null : (
        <p className="elm-leer">{gegner.status === "unbekannt" ? `${gegner.grund}.` : "Gegner noch nicht bekannt."}</p>
      )}
      {geschaetzt && !istPod ? (
        <p className="gg-quelle">
          <span className={`bc-marke${geschaetzt.quelle === "prognose" ? " is-gelb" : ""}`}>{geschaetzt.quelle === "prognose" ? "PROGNOSE" : geschaetzt.quelle === "ki-muster" ? "MUSTER" : "VERDECKT"}</span>
          {QUELLE_TEXT[geschaetzt.quelle]}
        </p>
      ) : null}

      {gegnerSeite && !istPod ? (
        <section className="gg-block">
          <span className="bc-gk"><span>Platz gegen Platz</span><span>geschätzt ± {ZAHL.format(geschaetzt?.unschaerfe ?? 0)}</span></span>
          <div className="gg-schnitt" data-testid="elm-gegner-schnitt">
            <span>Seite im Schnitt (Ø Eignung)</span>
            <b className="bc-t">Wir {eigenSchnitt != null ? Math.round(eigenSchnitt) : "–"}</b>
            <b className="bc-t is-g">Gegner {gegnerSeite.schnitt ? `${gegnerSeite.schnitt.min}–${gegnerSeite.schnitt.max}` : "?"}</b>
          </div>
          {plaetze.map((pl) => {
            const g = gegnerSeite.slots.find((s) => s.slotIndex === pl.slotIndex);
            const { stand, abstand } = duellStand(pl.eigenWert, g?.spanne ?? null);
            const ton = stand === "vorn" ? "bc-plus" : stand === "hinten" ? "bc-minus" : "bc-null";
            return (
              <div key={pl.key} className="gg-duell" data-stand={stand}>
                <span className="gg-duell__l">
                  {pl.eigenName ? <Bild klasse="gg-por" url={pl.eigenPortrait} name={pl.eigenName} /> : <span className="gg-por is-leer" />}
                  <span className="gg-duell__nm">
                    <b>{pl.eigenName ?? "frei"}</b>
                    <small>{pl.kuerzel} · {pl.rolle}</small>
                  </span>
                  <strong className="bc-t">{pl.eigenWert != null ? Math.round(pl.eigenWert) : "–"}</strong>
                </span>
                <span className={`gg-duell__m bc-t ${ton}`} title={stand === "gleich" ? "Innerhalb der Unsicherheit" : stand === "offen" ? "Kein Vergleich möglich" : undefined}>
                  {abstand != null ? vz(abstand) : "–"}
                </span>
                <span className="gg-duell__r">
                  <strong className="bc-t">{g?.spanne ? `${g.spanne.min}–${g.spanne.max}` : "?"}</strong>
                  <span className="gg-duell__nm">
                    <b>{g?.spielerName ?? "unbekannt"}</b>
                    <small title="Derselbe Platz wie links: gleiche Rolle auf beiden Seiten">
                      {pl.kuerzel} · {pl.rolle}
                      {g?.spanne ? ` · Mitte ${ZAHL.format(spannenMitte(g.spanne) ?? 0)}` : " · nicht erkennbar"}
                    </small>
                  </span>
                  {g?.spielerName ? <Bild klasse="gg-por" url={portraitVon(g.spielerId)} name={g.spielerName} /> : <span className="gg-por is-leer" />}
                </span>
              </div>
            );
          })}
          <p className="gg-fuss">Gezeigt wird die rohe Disziplin-Eignung, nicht der Platzwert mit Rolle und Einsatz. Grau heißt: innerhalb der Unsicherheit.</p>
        </section>
      ) : null}

      {istPod ? (
        <section className="gg-block">
          <span className="bc-gk"><span>Gruppe an diesem Spieltag</span><span>Ø Eignung, erwartet</span></span>
          {gruppenStand.length > 0 ? (
            gruppenStand.map((z) => (
              <div key={z.teamId} className={`gg-grp${z.wir ? " is-wir" : ""}`}>
                <span className="gg-grp__n bc-t">{z.platz}.</span>
                <TeamLogo teamId={z.teamId} name={z.name} />
                <span className="gg-grp__nm">
                  <b>{z.name}</b>
                  <small>
                    {z.wir ? "Deine Besetzung" : rangText(z.teamId)}
                  </small>
                </span>
                {!z.wir && z.prognose ? <span className="bc-marke is-gelb">PROGNOSE</span> : null}
                <span className="gg-grp__w bc-t">
                  <strong>{z.mitte != null ? Math.round(z.mitte) : "–"}</strong>
                  {z.unschaerfe != null ? <small>± {Math.round(z.unschaerfe)}</small> : null}
                </span>
              </div>
            ))
          ) : (
            <p className="elm-leer">{gruppe?.gegnerNamen.length ? gruppe.gegnerNamen.join(" · ") : "Gruppe noch nicht bekannt."}</p>
          )}
          <p className="gg-fuss">In Gruppen-Disziplinen zählt die Platzierung unter vier Teams, nicht das direkte Duell. Die Gegner sind Schätzungen aus ihrem Kader.</p>
        </section>
      ) : null}

      {p.rivalen.length > 0 ? (
        <section className="gg-block">
          <span className="bc-gk"><span>Zu schlagen</span><span>Saison-Rivalen</span></span>
          {p.rivalen.slice(0, 3).map((r) => (
            <div key={r.teamId} className="gg-grp">
              <span className="gg-grp__n bc-t">{r.rank}.</span>
              <TeamLogo teamId={r.teamId} name={r.teamName} />
              <span className="gg-grp__nm"><b>{r.teamName}</b><small>{p.disziplinName}-Rang {r.rank}</small></span>
              <span className="bc-marke is-gelb">RIVALE</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
