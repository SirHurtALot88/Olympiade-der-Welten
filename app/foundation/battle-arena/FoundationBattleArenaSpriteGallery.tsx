"use client";

import { useMemo, useState } from "react";

import PlayerPixelSprite from "@/app/foundation/PlayerPixelSprite";
import spielerListe from "@/data/generated/battle-arena-sprite-gallery.json";
import spriteFitBewertung from "@/data/generated/sprite-fit-bewertung.json";
import { listFigurSprites, type FigurSprite } from "@/lib/data/figurenSprites";

/**
 * PIXEL-FIGUREN-GALERIE — Kartenbild und Figur direkt nebeneinander, damit sich abweichende
 * Treffer auf einen Blick finden lassen.
 *
 * Seit 02.11. zeigt die Galerie die NEUEN PixelLab-Figuren (80x80-Kanon, animiert, Klick auf
 * die Figur wechselt Gehen/Aktion/Treffer/K.o.) aus `public/sprites/figuren/` —
 * `lib/data/figurenSprites.ts`. Vorher zeigte sie die alten Baukasten-Sprites
 * (`public/sprites/preview/<slug>.png`, vorgerendert aus battle-mode.html), die der
 * Battle-Mode-Motor weiterhin selbst zeichnet. Der alte Sprite steht deshalb klein daneben
 * („Motor"), solange es einen gibt — samt seiner Sterne-Bewertung
 * (docs/design/sprite-fit-bewertungssystem.md), die sich auf GENAU diesen alten Sprite bezieht.
 */

type GalerieEintrag = { name: string; slug: string };
type FitBewertung = {
  name: string;
  slug: string;
  sterne: 1 | 2 | 3 | 4 | 5;
  begruendung: string;
  fehlendesDetail: string | null;
};

type Zeile = {
  slug: string;
  name: string;
  figur: FigurSprite | null;
  altSprite: boolean;
};

const ALTE_EINTRAEGE = spielerListe as GalerieEintrag[];
const BEWERTUNG_NACH_SLUG = new Map((spriteFitBewertung as FitBewertung[]).map((b) => [b.slug, b]));

function nameAusSlug(slug: string) {
  return slug
    .split("-")
    .map((teil) => (teil ? teil[0]!.toUpperCase() + teil.slice(1) : teil))
    .join(" ");
}

function baueZeilen(): Zeile[] {
  const alteNamen = new Map(ALTE_EINTRAEGE.map((e) => [e.slug, e.name]));
  const zeilen = new Map<string, Zeile>();
  for (const figur of listFigurSprites()) {
    zeilen.set(figur.slug, {
      slug: figur.slug,
      name: alteNamen.get(figur.slug) ?? nameAusSlug(figur.slug),
      figur,
      altSprite: alteNamen.has(figur.slug),
    });
  }
  for (const alt of ALTE_EINTRAEGE) {
    if (!zeilen.has(alt.slug)) zeilen.set(alt.slug, { slug: alt.slug, name: alt.name, figur: null, altSprite: true });
  }
  return [...zeilen.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

function SterneAnzeige({ sterne }: { sterne: number }) {
  return (
    <span aria-label={`${sterne} von 5 Sternen`} style={{ letterSpacing: 1 }}>
      {"★".repeat(sterne)}
      <span style={{ opacity: 0.3 }}>{"★".repeat(5 - sterne)}</span>
    </span>
  );
}

type Filter = "alle" | "animiert" | "ohne-animation" | "ohne-figur";

export default function FoundationBattleArenaSpriteGallery() {
  const [suche, setSuche] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const zeilen = useMemo(() => baueZeilen(), []);
  const anzahlFiguren = zeilen.filter((z) => z.figur).length;
  const anzahlAnimiert = zeilen.filter((z) => z.figur && z.figur.animationen.length > 0).length;

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return zeilen.filter((z) => {
      if (q && !z.name.toLowerCase().includes(q)) return false;
      if (filter === "animiert") return Boolean(z.figur && z.figur.animationen.length > 0);
      if (filter === "ohne-animation") return Boolean(z.figur && z.figur.animationen.length === 0);
      if (filter === "ohne-figur") return !z.figur;
      return true;
    });
  }, [suche, filter, zeilen]);

  return (
    <section className="panel" aria-label="Pixel-Figuren-Galerie" data-testid="pixel-figuren-galerie" style={{ marginTop: 16 }}>
      <header style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: "0 0 4px" }}>Pixel-Figuren vs. Kartenbilder</h2>
          <p className="muted" style={{ margin: 0, maxWidth: "76ch" }}>
            {anzahlFiguren} Spieler mit neuer PixelLab-Figur ({anzahlAnimiert} davon animiert), Kartenbild und Figur
            direkt nebeneinander. Klick auf die Figur wechselt Gehen → Aktion → Treffer → K.o. Klein daneben, falls
            vorhanden: der alte Baukasten-Sprite, den der Battle-Mode-Motor noch zeichnet, mit seiner Bewertung.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label="Figuren filtern"
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--nl-line)",
              background: "transparent",
              color: "inherit",
              fontSize: 14,
            }}
          >
            <option value="alle">Alle</option>
            <option value="animiert">Nur animierte Figuren</option>
            <option value="ohne-animation">Figur ohne Animation</option>
            <option value="ohne-figur">Noch ohne neue Figur</option>
          </select>
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
        </div>
      </header>

      {gefiltert.length === 0 ? (
        <p className="muted">Kein Spieler passt zu „{suche}“.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))", gap: 10 }}>
          {gefiltert.map((z) => {
            const bewertung = BEWERTUNG_NACH_SLUG.get(z.slug);
            return (
              <figure
                key={z.slug}
                data-figur-slug={z.slug}
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/portraits/${z.slug}.jpg`}
                    alt={`${z.name} — Kartenbild`}
                    loading="lazy"
                    style={{
                      width: 72,
                      height: 96,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid var(--nl-line)",
                      background: "var(--nl-bg-2)",
                    }}
                  />
                  {z.figur ? (
                    <span style={{ borderRadius: 6, border: "1px solid var(--nl-line)", background: "var(--nl-bg-2)", lineHeight: 0 }}>
                      <PlayerPixelSprite sprite={z.figur} size={96} anim="walk" cycleOnClick showLabel />
                    </span>
                  ) : (
                    <span
                      className="muted"
                      style={{ width: 96, height: 96, display: "grid", placeItems: "center", fontSize: 11, textAlign: "center", border: "1px dashed var(--nl-line)", borderRadius: 6 }}
                    >
                      noch keine PixelLab-Figur
                    </span>
                  )}
                </div>
                <figcaption
                  style={{ fontSize: 12, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}
                  title={z.name}
                >
                  {z.name}
                </figcaption>
                {z.altSprite ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}
                    title={
                      bewertung
                        ? `Alter Motor-Sprite: ${bewertung.begruendung}${bewertung.fehlendesDetail ? ` — fehlt für 5★: ${bewertung.fehlendesDetail}` : ""}`
                        : "Alter Motor-Sprite (Baukasten)"
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/sprites/preview/${z.slug}.png`}
                      alt=""
                      loading="lazy"
                      style={{ width: 28, height: 28, imageRendering: "pixelated", opacity: 0.8 }}
                    />
                    <span className="muted">Motor</span>
                    {bewertung ? <SterneAnzeige sterne={bewertung.sterne} /> : null}
                  </div>
                ) : null}
              </figure>
            );
          })}
        </div>
      )}
    </section>
  );
}
