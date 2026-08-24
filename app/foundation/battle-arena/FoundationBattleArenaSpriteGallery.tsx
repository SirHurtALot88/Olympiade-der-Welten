"use client";

import { useMemo, useState } from "react";

import spielerListe from "@/data/generated/battle-arena-sprite-gallery.json";

/**
 * SPRITE-VS-KARTENBILD-GALERIE — Chris' Wunsch nach dem Sichtcheck-Auftrag: eine
 * durchsuchbare Liste aller Spieler, deren animierter Battle-Arena-Sprite bereits gebaut
 * ist, Portrait und Sprite direkt nebeneinander, damit sich abweichende Treffer auf einen
 * Blick finden lassen statt einzeln nachzufragen.
 *
 * Die Sprite-Vorschauen sind vorgerendert (nicht live aus dem Canvas), weil der Sprite
 * nur innerhalb von battle-mode.html gezeichnet werden kann (zeichneSprite lebt im
 * geschlossenen Scope dieser Datei) — 144 Live-Renderings bei jedem Seitenaufruf waeren
 * unnoetig langsam fuer ein Bild, das sich nur aendert, wenn jemand den Baukasten-Eintrag
 * anfasst. public/sprites/preview/<slug>.png wird per Skript aus genau demselben
 * renderProbe() erzeugt, das auch die Opus-Sichtcheck-Agents genutzt haben.
 */

type GalerieEintrag = { name: string; slug: string };

const EINTRAEGE = spielerListe as GalerieEintrag[];

export default function FoundationBattleArenaSpriteGallery() {
  const [suche, setSuche] = useState("");

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return EINTRAEGE;
    return EINTRAEGE.filter((e) => e.name.toLowerCase().includes(q));
  }, [suche]);

  return (
    <section className="panel" aria-label="Sprite-vs-Kartenbild-Galerie" style={{ marginTop: 16 }}>
      <header style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Sprites vs. Kartenbilder</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>
            Alle {EINTRAEGE.length} Spieler mit eigenem animiertem Battle-Arena-Sprite, Kartenbild und
            Sprite direkt nebeneinander. Fällt dir ein Ausreißer auf — falscher Kopf, fehlende Ausrüstung,
            falsche Haarfarbe — sag einfach den Namen.
          </p>
        </div>
        <input
          type="text"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Name suchen…"
          aria-label="Spieler suchen"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--nl-line)",
            background: "transparent",
            color: "inherit",
            minWidth: 200,
            fontSize: 14,
          }}
        />
      </header>

      {gefiltert.length === 0 ? (
        <p className="muted">Kein Spieler passt zu „{suche}".</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 10,
          }}
        >
          {gefiltert.map((e) => (
            <figure
              key={e.slug}
              style={{
                margin: 0,
                border: "1px solid var(--nl-line)",
                borderRadius: 10,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <img
                  src={`/portraits/${e.slug}.jpg`}
                  alt={`${e.name} — Kartenbild`}
                  loading="lazy"
                  style={{
                    width: 72,
                    height: 90,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid var(--nl-line)",
                    background: "#0002",
                  }}
                />
                <img
                  src={`/sprites/preview/${e.slug}.png`}
                  alt={`${e.name} — Sprite`}
                  loading="lazy"
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: "contain",
                    imageRendering: "pixelated",
                    borderRadius: 6,
                    border: "1px solid var(--nl-line)",
                    background: "#0002",
                  }}
                />
              </div>
              <figcaption
                style={{
                  fontSize: 12,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
                title={e.name}
              >
                {e.name}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
