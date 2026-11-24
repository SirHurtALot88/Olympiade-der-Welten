"use client";

/**
 * SPONSOREN: kleine Bausteine der neuen Seite (Wappen, Farb-Marken, Messhaken, drei Diagramme).
 * Die Diagramme sind reines SVG ohne Bibliothek (Muster der Mockups): Breite und Hoehe kommen aus dem Container, damit Schrift und
 * Striche bei 1710x1112, 1920x1080 und 2560x1440 gleich scharf bleiben.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

import { sponsorMonogramm, sponsorWappenPfadFuer } from "@/lib/sponsor/sponsor-wappen";
import { SPONSOR_FARBE_LABEL } from "@/lib/sponsors/sponsor-topf-modell";
import type { SponsorFarbe } from "@/lib/sponsors/sponsor-topf-typen";
import { vorzeichenDe, zahlDe } from "@/lib/sponsors/sponsor-seite-modell";

export function SponsorWappenBild({
  quelle,
  name,
  klein,
}: {
  quelle: { sponsorParentBrandId?: string | null; sponsorBrandId?: string | null; name?: string | null };
  name: string;
  klein?: boolean;
}) {
  const pfad = sponsorWappenPfadFuer({ ...quelle, name: quelle.name ?? name });
  return (
    <span className={`so-wap${klein ? " kl" : ""}`} title={pfad ? undefined : "Wappen folgt, bis dahin Monogramm"}>
      {pfad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pfad} alt="" draggable={false} loading="lazy" decoding="async" />
      ) : (
        <span>{sponsorMonogramm(name)}</span>
      )}
    </span>
  );
}

export function FarbMarke({ farbe, aus }: { farbe: SponsorFarbe; aus?: boolean }) {
  return (
    <span className={`so-fb ${farbe}${aus ? " aus" : ""}`} title={SPONSOR_FARBE_LABEL[farbe]}>
      {farbe.toUpperCase()}
    </span>
  );
}

/** Misst ein Element in CSS-Pixeln und meldet Aenderungen (Fenstergroesse, Reiterwechsel). */
export function useMass<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [mass, setMass] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lies = () => {
      const r = el.getBoundingClientRect();
      setMass((alt) => (Math.abs(alt.w - r.width) < 1 && Math.abs(alt.h - r.height) < 1 ? alt : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    lies();
    if (typeof ResizeObserver === "undefined") return;
    const beobachter = new ResizeObserver(lies);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);
  return { ref, ...mass };
}

function DiagrammRahmen({ kinder }: { kinder: (w: number, h: number, k: number) => ReactNode }) {
  const { ref, w, h } = useMass<HTMLDivElement>();
  // k: Schriftgroesse der Achsenbeschriftung in Pixeln, aus der Wurzel der Seite abgeleitet.
  const k = typeof window !== "undefined" && ref.current ? parseFloat(getComputedStyle(ref.current).fontSize) || 14 : 14;
  return (
    <div className="so-dia" ref={ref}>
      {w > 40 && h > 30 ? (
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-hidden="true">
          {kinder(w, h, k)}
        </svg>
      ) : null}
    </div>
  );
}

/** Platz je Spieltag gegen den Erwartungsrang, darunter der gebuchte Abschlag (Vertragsansicht). */
export function LeistungVerlaufDiagramm({
  verlauf,
  erwartungsrang,
  spieltage,
  ligaGroesse,
}: {
  verlauf: Array<{ spieltag: number; platz: number | null; abschlag: number }>;
  erwartungsrang: number;
  spieltage: number;
  ligaGroesse: number;
}) {
  return (
    <DiagrammRahmen
      kinder={(w, h, k) => {
        const f = Math.max(11, k * 0.82);
        const links = f * 4.6;
        const rechts = f * 1.2;
        const oben = f * 1.8;
        const teilH = (h - oben - f * 3.2) * 0.62;
        const unten0 = oben + teilH + f * 1.6;
        const balkenH = h - unten0 - f * 2.4;
        const plaetze = verlauf.map((v) => v.platz ?? 0).filter(Boolean);
        const maxPlatz = Math.min(ligaGroesse, Math.max(8, Math.ceil(erwartungsrang) + 4, ...plaetze.map((p) => p + 1)));
        const x = (spieltag: number) => links + ((spieltag - 0.5) / Math.max(1, spieltage)) * (w - links - rechts);
        const yPlatz = (p: number) => oben + ((p - 1) / Math.max(1, maxPlatz - 1)) * teilH;
        const maxAbs = Math.max(0.05, ...verlauf.map((v) => Math.abs(v.abschlag)));
        const mitte = unten0 + balkenH / 2;
        const bw = Math.max(6, ((w - links - rechts) / Math.max(1, spieltage)) * 0.6);
        const gespielt = verlauf.filter((v) => v.platz != null);
        const punkte = gespielt.map((v) => `${x(v.spieltag)},${yPlatz(v.platz!)}`).join(" ");
        return (
          <>
            {Array.from({ length: maxPlatz }, (_, i) => i + 1).map((p) => (
              <g key={p}>
                <line x1={links} x2={w - rechts} y1={yPlatz(p)} y2={yPlatz(p)} stroke="rgba(244,230,196,.07)" />
                <text x={links - 8} y={yPlatz(p) + f * 0.35} textAnchor="end" fontSize={f}>{`Platz ${p}`}</text>
              </g>
            ))}
            <line x1={links} x2={w - rechts} y1={yPlatz(erwartungsrang)} y2={yPlatz(erwartungsrang)} stroke="#f0c35a" strokeDasharray="6 5" strokeWidth={2} />
            <text x={w - rechts} y={yPlatz(erwartungsrang) - 6} textAnchor="end" fontSize={f} fill="#f0c35a" style={{ fill: "#f0c35a" }}>{`Erwartung ${zahlDe(Math.round(erwartungsrang * 10) / 10, 1).replace(/,0$/, "")}`}</text>
            {gespielt.length > 1 ? <polyline points={punkte} fill="none" stroke="#f2a03d" strokeWidth={3} strokeLinejoin="round" /> : null}
            {gespielt.map((v) => (
              <g key={v.spieltag}>
                <circle cx={x(v.spieltag)} cy={yPlatz(v.platz!)} r={5} fill="#f2a03d" />
                <text x={x(v.spieltag)} y={yPlatz(v.platz!) - 9} textAnchor="middle" fontSize={f * 0.9}>{v.platz}</text>
              </g>
            ))}
            {spieltage > gespielt.length ? (
              <rect x={x(gespielt.length + 1) - ((w - links - rechts) / spieltage) / 2} y={oben - 4} width={(w - links - rechts) * ((spieltage - gespielt.length) / spieltage)} height={h - oben - f * 2.2} fill="rgba(255,255,255,.035)" />
            ) : null}
            <line x1={links} x2={w - rechts} y1={mitte} y2={mitte} stroke="rgba(244,230,196,.3)" />
            <text x={links - 8} y={mitte + f * 0.35} textAnchor="end" fontSize={f}>Abschlag</text>
            {Array.from({ length: spieltage }, (_, i) => i + 1).map((tag) => {
              const v = verlauf.find((e) => e.spieltag === tag);
              const hoehe = v ? (Math.abs(v.abschlag) / maxAbs) * (balkenH / 2 - f * 1.2) : 0;
              return (
                <g key={tag}>
                  {v && v.abschlag !== 0 ? (
                    <>
                      <rect x={x(tag) - bw / 2} y={v.abschlag > 0 ? mitte - hoehe : mitte} width={bw} height={Math.max(2, hoehe)} rx={2} fill={v.abschlag > 0 ? "#62d394" : "#ff6058"} />
                      <text x={x(tag)} y={v.abschlag > 0 ? mitte - hoehe - 4 : mitte + hoehe + f} textAnchor="middle" fontSize={f * 0.85}>{vorzeichenDe(v.abschlag, 2)}</text>
                    </>
                  ) : (
                    <rect x={x(tag) - bw / 2} y={mitte - 1} width={bw} height={2} fill={v ? "rgba(154,167,186,.6)" : "rgba(154,167,186,.25)"} />
                  )}
                  <text x={x(tag)} y={h - f * 0.6} textAnchor="middle" fontSize={f * 0.9}>{tag}</text>
                </g>
              );
            })}
          </>
        );
      }}
    />
  );
}

/** Summe je Endrang als Linie von Platz 1 bis Platz 16; die gestrichelte Linie ist der Betrag bei Erwartung (Angebotskarte). */
export function AuszahlungsKurve({ punkte, erwartungsrang, ligaGroesse }: { punkte: Array<{ rang: number; summe: number }>; erwartungsrang: number; ligaGroesse: number }) {
  return (
    <DiagrammRahmen
      kinder={(w, h, k) => {
        const f = Math.max(10, k * 0.8);
        const rand = f * 0.8;
        const unten = f * 2.2;
        const werte = punkte.map((p) => p.summe);
        const lo = Math.min(...werte);
        const hi = Math.max(...werte);
        const spanne = Math.max(1, hi - lo);
        const x = (r: number) => rand + ((r - 1) / Math.max(1, ligaGroesse - 1)) * (w - 2 * rand);
        const y = (v: number) => f * 1.6 + (1 - (v - lo) / spanne) * (h - unten - f * 2.4);
        const erw = punkte.reduce((best, p) => (Math.abs(p.rang - erwartungsrang) < Math.abs(best.rang - erwartungsrang) ? p : best), punkte[0]!);
        const ersterX = x(punkte[0]!.rang);
        return (
          <>
            <line x1={rand} x2={w - rand} y1={y(erw.summe)} y2={y(erw.summe)} stroke="rgba(240,195,90,.45)" strokeDasharray="5 5" />
            <polyline points={punkte.map((p) => `${x(p.rang)},${y(p.summe)}`).join(" ")} fill="none" stroke="#f0c35a" strokeWidth={2.5} strokeLinejoin="round" />
            <circle cx={x(erw.rang)} cy={y(erw.summe)} r={5} fill="#f2a03d" />
            <text x={Math.min(w - rand - f * 8, x(erw.rang) + 10)} y={y(erw.summe) - 8} fontSize={f}>{`Erwartung · ${zahlDe(erw.summe, 1)} C`}</text>
            <text x={w - rand} y={y(punkte[punkte.length - 1]!.summe) - 8} textAnchor="end" fontSize={f}>{`${zahlDe(punkte[punkte.length - 1]!.summe, 1)} C`}</text>
            <text x={ersterX} y={h - f * 0.8} fontSize={f}>Platz 1</text>
            <text x={w - rand} y={h - f * 0.8} textAnchor="end" fontSize={f}>{`Platz ${ligaGroesse}`}</text>
          </>
        );
      }}
    />
  );
}

/** Ergebnis je Team bei Erwartungsrang (Rechenansicht): zwei Gruppen, je Liga absteigend sortiert, eigenes Team orange. */
export function BilanzSaeulen({
  gruppen,
  eigenesTeamId,
}: {
  gruppen: Array<{ titel: string; teams: Array<{ teamId: string; kuerzel: string; wert: number }> }>;
  eigenesTeamId: string;
}) {
  return (
    <DiagrammRahmen
      kinder={(w, h, k) => {
        const f = Math.max(10, k * 0.78);
        const links = f * 3;
        const oben = f * 2.2;
        const unten = f * 3.2;
        const alle = gruppen.flatMap((g) => g.teams.map((t) => t.wert));
        const hi = Math.max(10, Math.ceil(Math.max(0, ...alle) / 10) * 10);
        const lo = Math.min(-10, Math.floor(Math.min(0, ...alle) / 10) * 10);
        const y = (v: number) => oben + ((hi - v) / (hi - lo)) * (h - oben - unten);
        const insgesamt = gruppen.reduce((s, g) => s + g.teams.length, 0) + gruppen.length - 1;
        const spalte = (w - links - f) / Math.max(1, insgesamt);
        const ticks: number[] = [];
        for (let v = lo; v <= hi; v += 10) ticks.push(v);
        let index = 0;
        return (
          <>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={links} x2={w - f} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(244,230,196,.3)" : "rgba(244,230,196,.07)"} />
                <text x={links - 6} y={y(t) + f * 0.35} textAnchor="end" fontSize={f}>{t > 0 ? `+${t}` : t}</text>
              </g>
            ))}
            {gruppen.map((g) => {
              const start = index;
              const knoten = g.teams.map((t) => {
                const cx = links + (index + 0.5) * spalte;
                const farbe = t.teamId === eigenesTeamId ? "#f2a03d" : t.wert >= 0 ? "#62d394" : "#ff6058";
                const y0 = y(0);
                const y1 = y(t.wert);
                index += 1;
                return (
                  <g key={t.teamId}>
                    <rect x={cx - spalte * 0.34} y={Math.min(y0, y1)} width={spalte * 0.68} height={Math.max(1, Math.abs(y1 - y0))} rx={2} fill={farbe} />
                    <text x={cx} y={h - unten + f * 1.25} textAnchor="middle" fontSize={f * 0.82} transform={`rotate(-40 ${cx} ${h - unten + f * 1.25})`} style={t.teamId === eigenesTeamId ? { fill: "#f2a03d" } : undefined}>{t.kuerzel}</text>
                  </g>
                );
              });
              const mitteX = links + ((start + index) / 2) * spalte;
              index += 1;
              return (
                <g key={g.titel}>
                  {knoten}
                  <text x={mitteX} y={f * 1.2} textAnchor="middle" fontSize={f}>{g.titel}</text>
                </g>
              );
            })}
          </>
        );
      }}
    />
  );
}
