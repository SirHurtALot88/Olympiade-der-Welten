"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import PlayerPixelSprite from "@/app/foundation/PlayerPixelSprite";
import { BcIcon } from "@/components/foundation/broadcast";
import { figurAnimation, getFigurSpriteForPlayer, type FigurAnimationKind } from "@/lib/data/figurenSprites";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import { formatNlNumber } from "@/components/foundation/new-look/nl-tones";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import {
  ACHSEN,
  PP_ZIELLINIE,
  achseVonKategorie,
  grobeRangStufe,
  type AchseId,
  type DisziplinRang,
  type PpSpieltag,
} from "@/lib/foundation/spielerprofil-modell";
import type { SpielerprofilModell } from "./use-spielerprofil-modell";
import "./spielerprofil.css";

/* ------------------------------------------------------------------ kleine Helfer */

export function zahl(wert: number | null | undefined, stellen = 0): string {
  return wert == null || !Number.isFinite(wert) ? "—" : formatNlNumber(wert, stellen);
}

/** Geld in Mio mit wählbarer Nachkommastelle (Gehalt je Spieltag braucht zwei). */
export function geld(wert: number | null | undefined, stellen = 1): string {
  return wert == null || !Number.isFinite(wert) ? "—" : `${formatNlNumber(wert, stellen)} Mio`;
}

export function achseKlasse(achse: AchseId): string {
  return `spr-${achse}`;
}

export function achseFarbe(achse: AchseId): string {
  return `var(--spr-${achse})`;
}

export function kategorieAchse(kategorie: string | null | undefined): AchseId {
  return achseVonKategorie(kategorie);
}

export function kulisseStil(disziplinId: string | null | undefined): CSSProperties | undefined {
  const url = einsatzlisteKulisseBild(disziplinId);
  return url ? ({ "--bild": `url(${url})` } as CSSProperties) : undefined;
}

/** Rang als Text; im Nebel nur grob (Chris 18.11.: Scouting-Nebel, Ränge dürfen keine verdeckten Werte verraten). */
export function rangText(rang: number | null | undefined, von: number | null | undefined, nebel: boolean): string {
  if (rang == null || von == null || von <= 0) return "—";
  if (nebel) return grobeRangStufe(rang, von) ?? "—";
  return `#${rang}`;
}

export function Tafel({
  titel,
  klein,
  rechts,
  children,
  className,
  koerperClass,
  testId,
}: {
  titel: ReactNode;
  klein?: ReactNode;
  rechts?: ReactNode;
  children: ReactNode;
  className?: string;
  koerperClass?: string;
  testId?: string;
}) {
  return (
    <section className={`spr-pan${className ? ` ${className}` : ""}`} data-testid={testId}>
      <header className="spr-pk">
        <h2>{titel}</h2>
        {klein ? <small>{klein}</small> : null}
        <span className="spr-sp" />
        {rechts}
      </header>
      <div className={`spr-pb${koerperClass ? ` ${koerperClass}` : ""}`}>{children}</div>
    </section>
  );
}

export function NebelBand({ children }: { children?: ReactNode }) {
  return (
    <div className="spr-nebel-band" data-testid="spielerprofil-nebel">
      {children ?? "Nicht voll gescoutet: die Tafeln zeigen nur grobe Bereiche, Ränge nur als Einordnung."}
    </div>
  );
}

/* ------------------------------------------------------------------ PP-Balken je Spieltag */

/**
 * 20 Spieltags-Plätze, je zwei Balken (eine Disziplin je Seite), Farbe = Achse der Disziplin. Die Ziellinie bei 5 ist nur
 * eine Markierung (Chris 18.11.); die Höhen sind die gebuchten PP, nicht neu skaliert.
 */
export function PpBalken({
  reihe,
  achseVon,
  aktuellerSpieltag,
}: {
  reihe: PpSpieltag[];
  achseVon: (disziplinId: string) => AchseId;
  aktuellerSpieltag?: number | null;
}) {
  const nachNummer = new Map(reihe.map((zeile) => [zeile.nummer, zeile] as const));
  const maximum = Math.max(PP_ZIELLINIE * 1.25, ...reihe.flatMap((zeile) => zeile.eintraege.map((eintrag) => eintrag.pp)));
  const slots = Array.from({ length: 20 }, (_, index) => index + 1);
  return (
    <>
      <div className="spr-ppc" data-testid="spielerprofil-pp-balken" role="img" aria-label="Player Points je Spieltag">
        <div className="spr-ppc__ziel" style={{ bottom: `${(PP_ZIELLINIE / maximum) * 100}%` }}>
          <span>Ziel {PP_ZIELLINIE}</span>
        </div>
        {slots.map((nummer) => {
          const zeile = nachNummer.get(nummer);
          const klassen = ["spr-ppc__sl", zeile ? "" : "is-leer", aktuellerSpieltag === nummer ? "is-heute" : ""].filter(Boolean).join(" ");
          if (!zeile) {
            return (
              <div key={nummer} className={klassen}>
                <i />
              </div>
            );
          }
          return (
            <div key={nummer} className={klassen} title={`Spieltag ${nummer}: ${zahl(zeile.summe, 1)} PP`}>
              {zeile.eintraege.map((eintrag, index) => (
                <i
                  key={index}
                  className={achseKlasse(achseVon(eintrag.disziplinId))}
                  style={{ height: `${Math.max(2, (eintrag.pp / maximum) * 100)}%`, background: "var(--ax)" }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div className="spr-ppx">
        {slots.map((nummer) => (
          <span key={nummer}>{aktuellerSpieltag === nummer ? <b>{nummer}</b> : nummer}</span>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Figuren-Bühne */

type Pose = "stand" | FigurAnimationKind;
const POSEN: Array<{ id: Pose; label: string; art: FigurAnimationKind | null }> = [
  { id: "stand", label: "Stand", art: null },
  { id: "walk", label: "Lauf", art: "walk" },
  { id: "angriff", label: "Angriff", art: "angriff" },
  { id: "treffer", label: "Treffer", art: "treffer" },
];
const RICHTUNGEN = ["south", "east", "west"] as const;

function useKastenGroesse() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [groesse, setGroesse] = useState({ b: 240, h: 320 });
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const beobachter = new ResizeObserver((eintraege) => {
      const rechteck = eintraege[0]?.contentRect;
      if (rechteck && rechteck.width > 0 && rechteck.height > 0) {
        setGroesse({ b: rechteck.width, h: rechteck.height });
      }
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, []);
  return { ref, groesse };
}

/**
 * Figur groß auf der Kulisse der besten Disziplin (Chris 18.11., Punkt 6): vier Posen anklickbar, Drehen. Ohne PixelLab-Figur
 * (362 von 2984 Spielern haben eine) steht das Porträt groß an derselben Stelle (Punkt 7). Keine neue Animation, keine Tod-Pose.
 */
export function FigurBuehne({
  data,
  modell,
  kompakt = false,
}: {
  data: PlayerDetailDrawerData;
  modell: SpielerprofilModell;
  kompakt?: boolean;
}) {
  const sprite = getFigurSpriteForPlayer(data.playerId);
  const [pose, setPose] = useState<Pose>("walk");
  const [richtung, setRichtung] = useState(0);
  const { ref, groesse } = useKastenGroesse();
  // Die Figur füllt nur die Mitte ihres Bildes: das Bild darf über den Kasten hinausragen (der Rest ist durchsichtig).
  const px = Math.max(96, Math.floor(Math.min(groesse.h * 1.25, groesse.b * 1.5)));
  const anim: FigurAnimationKind | "pose" = pose === "stand" ? "pose" : pose;
  const rang = modell.raenge?.ppGesamtLigaRang;
  const kulisseName = modell.besteDisziplin ? modell.disziplinLabel(modell.besteDisziplin) : null;
  return (
    <section
      className={`spr-fb${modell.verletzung.verletzt ? " is-verletzt" : ""}`}
      data-testid={kompakt ? "spielerprofil-figur-kompakt" : "spielerprofil-figur"}
      aria-label={`${data.name}${sprite ? ", Pixel-Figur" : ", Porträt"}`}
    >
      <div
        className="spr-fb__hg"
        style={modell.kulisseUrl ? { backgroundImage: `url(${modell.kulisseUrl})` } : undefined}
        aria-hidden="true"
      />
      <div className="spr-fb__ob">
        {!modell.nebel && rang != null ? <span className="spr-fb__rg">PP-Rang Liga #{rang}</span> : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {data.portraitUrl && sprite ? <img className="spr-fb__port" src={data.portraitUrl} alt="" /> : null}
      </div>
      <div className="spr-fb__platz" ref={ref}>
        <div className="spr-fb__boden" aria-hidden="true" />
        {sprite ? (
          <PlayerPixelSprite
            key={`${data.playerId}-${pose}-${richtung}`}
            playerId={data.playerId}
            size={px}
            dir={RICHTUNGEN[richtung % RICHTUNGEN.length]}
            anim={anim}
            className="spr-fb__figur"
          />
        ) : (
          <div className="spr-fb__ersatz" data-testid="spielerprofil-portrait-ersatz">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {data.portraitUrl ? <img src={data.portraitUrl} alt={data.name} /> : null}
            <span>Noch keine Pixel-Figur — das Porträt steht an ihrer Stelle.</span>
          </div>
        )}
        {modell.verletzung.verletzt ? <div className="spr-fb__band">Verletzt</div> : null}
      </div>
      {kompakt ? null : (
        <div className="spr-fb__un">
          <h3>{data.name}</h3>
          <p>
            {[data.className, data.race].filter(Boolean).join(" · ")}
            {data.subclasses.length > 0 ? ` · ${data.subclasses.slice(0, 2).join(", ")}` : ""}
          </p>
          <div className="spr-fb__tr">
            {data.traitsPositive.map((trait) => (
              <span key={`p-${trait}`}>{trait}</span>
            ))}
            {data.traitsNegative.map((trait) => (
              <span key={`n-${trait}`} className="is-neg">
                {trait}
              </span>
            ))}
            {data.hiddenPositiveTraitCount + data.hiddenNegativeTraitCount > 0 ? (
              <span className="is-nebel" title="Nicht gescoutet">
                {data.hiddenPositiveTraitCount + data.hiddenNegativeTraitCount} verdeckt
              </span>
            ) : null}
          </div>
        </div>
      )}
      {sprite ? (
        <div className="spr-fb__st" data-testid="spielerprofil-posen">
          <span className="spr-gk">Pose</span>
          <div className="spr-seg" role="group" aria-label="Pose der Figur">
            {POSEN.map((eintrag) => {
              const vorhanden = eintrag.art == null || figurAnimation(sprite, eintrag.art) != null;
              return (
                <button
                  key={eintrag.id}
                  type="button"
                  className={pose === eintrag.id ? "is-an" : undefined}
                  aria-pressed={pose === eintrag.id}
                  disabled={!vorhanden}
                  title={vorhanden ? undefined : "Diese Pose gibt es für die Figur nicht"}
                  onClick={() => setPose(eintrag.id)}
                >
                  {eintrag.label}
                </button>
              );
            })}
          </div>
          <span className="spr-sp" />
          <button type="button" className="spr-dreh" aria-label="Figur drehen" title="Figur drehen" onClick={() => setRichtung((alt) => alt + 1)}>
            <BcIcon name="zurueck" />
          </button>
        </div>
      ) : null}
      {kulisseName ? <span className="spr-fb__kul">Kulisse: {kulisseName}</span> : null}
    </section>
  );
}

/* ------------------------------------------------------------------ Disziplin-Rangzeile (geteilt) */

export function RangZeile({ rang, nebel }: { rang: DisziplinRang | undefined; nebel: boolean }) {
  if (!rang) return <>—</>;
  if (nebel) {
    return <>{grobeRangStufe(rang.aktivRang, rang.aktivVon) ?? "—"}</>;
  }
  return (
    <>
      Liga <b>#{rang.ligaRang ?? "—"}</b>/{rang.ligaVon} · Alle <b>#{rang.aktivRang ?? "—"}</b>/{rang.aktivVon}
    </>
  );
}

export { ACHSEN };
