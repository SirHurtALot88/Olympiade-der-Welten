// =====================================================================================
// FieldSvgInner — die geteilte, 1:1 aus dem Host übernommene Feld-Darstellung ALLER
// nicht-track-Primitive (Feldkunst + Fallback + Token-Loop mit den on-Feld-FX).
//
// Die per-Primitive-Dateien (lanes.tsx, court.tsx, barbell.tsx …) delegieren aktuell
// hierher (VERHALTEN UNVERÄNDERT). Ein Fan-out-Agent, der EINE Disziplin neu baut,
// ersetzt in seiner <Primitive>.tsx die Delegation durch bespoke Code — genau wie es
// track.tsx bereits vormacht.
// =====================================================================================
import React from "react";
import {
  ROW_FAMILY,
  TOWER_FAMILY,
  SCENE_PRIMS,
  FIELD_CUSTOM,
  renderMotif,
  renderSceneEnvBg,
  renderKlassenBands,
  renderTerritory,
  envDeco,
  envGlow,
  relColor,
  hueForIdx,
  TRACK_ROUND_MS,
} from "../DisciplineStageNativeArena";
import type { DisciplineFieldProps } from "./types";

export default function FieldSvgInner(props: DisciplineFieldProps): React.ReactNode {
  const {
    primitive: prim,
    disciplineName,
    skinAccent,
    motif,
    env,
    reducedMotion,
    W,
    H,
    N,
    geo,
    layout,
    finalMax,
    makeOval,
    ovalPath,
    OVAL_M,
    OVAL_BAND,
    pathRef,
    tokenPos,
    rt,
    sorted,
    barbellSorted,
    done,
    now,
    fieldNorm,
    barbellInfo,
    barbellY,
    barbellEliminated,
    barbellRankMap,
    demandKg,
    courtMedian,
    courtMax,
    courtHotFloor,
    openHover,
    scheduleHoverClose,
    onOpenTeam,
  } = props;
  return (
    <>
            <defs>
              {rt.map((t) =>
                t.logoUrl ? (
                  <clipPath key={`clip-${t.code}`} id={`natclip-${t.code}`}>
                    <circle cx={0} cy={0} r={t.isOwn ? geo.rOwn : geo.r} />
                  </clipPath>
                ) : null,
              )}
              {env ? (
                <>
                  <linearGradient id="envSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={env.sky[0]} />
                    <stop offset="100%" stopColor={env.sky[1]} />
                  </linearGradient>
                  <linearGradient id="envSurface" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={env.surface[0]} />
                    <stop offset="55%" stopColor={env.surface[1]} />
                    <stop offset="100%" stopColor={env.surface[2]} />
                  </linearGradient>
                  {env.infield ? (
                    <>
                      <linearGradient id="envInfield" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={env.infield[0]} />
                        <stop offset="100%" stopColor={env.infield[1]} />
                      </linearGradient>
                      <clipPath id="envInfieldClip">
                        <path d={makeOval(OVAL_M + OVAL_BAND / 2)} />
                      </clipPath>
                    </>
                  ) : null}
                </>
              ) : null}
            </defs>

            {/* Hintergrund: atmosphärische Umgebung (env) ODER dezentes Motiv */}
            {env ? (
              <>
                {/* Himmel / Ambient — alle Primitive */}
                <rect x={0} y={0} width={W} height={H} fill="url(#envSky)" />

                {prim === "klassen" ? (
                  renderKlassenBands(sorted, W, H, env)
                ) : prim === "territory" ? (
                  renderTerritory(sorted, W, H, env)
                ) : prim === "track" ? (
                  <>
                    <path d={ovalPath} fill="none" stroke={env.stands} strokeWidth={OVAL_BAND + 30} />
                    <path d={ovalPath} fill="none" stroke="url(#envSurface)" strokeWidth={OVAL_BAND} />
                    <path d={makeOval(OVAL_M - 18)} fill="none" stroke={env.line} strokeWidth={1.4} opacity={0.35} />
                    <path d={makeOval(OVAL_M + 18)} fill="none" stroke={env.line} strokeWidth={1.4} opacity={0.35} />
                    {env.infield ? (
                      <>
                        <path d={makeOval(OVAL_M + OVAL_BAND / 2)} fill="url(#envInfield)" stroke="none" />
                        <g clipPath="url(#envInfieldClip)">
                          {Array.from({ length: Math.ceil(W / 46) }).map((_, i) => (
                            <rect key={i} x={i * 46} y={0} width={23} height={H} fill="rgba(0,0,0,0.08)" />
                          ))}
                        </g>
                      </>
                    ) : null}
                    {(() => {
                      // ZIEL/START: Karo-Band quer über die volle Bahnbreite, sauber
                      // auf der oberen Geraden am Rundenanfang (= Token-Startpunkt, so
                      // landet der Sieger nach einer Runde exakt wieder auf der Linie).
                      const r = (H - 2 * OVAL_M) / 2;
                      const sx = OVAL_M + r;
                      const yTop = OVAL_M - OVAL_BAND / 2;
                      const rows = Math.max(2, Math.round(OVAL_BAND / 8));
                      const sq = OVAL_BAND / rows;
                      const dark = "rgba(0,0,0,0.6)";
                      return (
                        <g>
                          {Array.from({ length: rows }).map((_, i) => (
                            <g key={i}>
                              <rect x={sx - sq} y={yTop + i * sq} width={sq} height={sq} fill={i % 2 === 0 ? env.line : dark} />
                              <rect x={sx} y={yTop + i * sq} width={sq} height={sq} fill={i % 2 === 0 ? dark : env.line} />
                            </g>
                          ))}
                          <rect x={sx - sq} y={yTop} width={sq * 2} height={OVAL_BAND} fill="none" stroke={env.line} strokeWidth={0.8} opacity={0.5} />
                          <text x={sx} y={yTop - 7} textAnchor="middle" fontFamily="Georgia, serif" fontSize={15} fontWeight={800} letterSpacing="0.12em" fill={env.line} opacity={0.92}>
                            ZIEL
                          </text>
                        </g>
                      );
                    })()}
                    <path ref={pathRef} d={ovalPath} fill="none" stroke="none" />
                  </>
                ) : ROW_FAMILY.has(prim) ? (
                  <>
                    {/* Horizont-Band hinter dem Feld */}
                    <rect x={0} y={0} width={W} height={layout.top} fill={env.stands} opacity={0.6} />
                    {/* Bahnflächen (alternierende Tönung aus surface[0]/[1]) */}
                    {Array.from({ length: N }).map((_, i) => (
                      <rect key={i} x={layout.xStart} y={layout.top + i * layout.laneH} width={layout.xEnd - layout.xStart} height={layout.laneH} fill={i % 2 ? env.surface[0] : env.surface[1]} opacity={0.55} />
                    ))}
                    {/* TDM: taktisches HUD-Overlay (Scanlines, Fadenkreuz, Scoreboard-Kante) */}
                    {prim === "kda" ? renderSceneEnvBg(prim, env, layout, W, H) : null}
                  </>
                ) : prim === "stage" ? (
                  (() => {
                    // Showcase-Bühne mit Tiefe (Port von showcase-v2 drawStageBG).
                    // Alle Layer HINTER den Tokens, Farben aus env (hsl/rgba, kein Hex).
                    const floorY = layout.floorY;
                    const podiumY = layout.podiumY;
                    const cx = layout.centerX;
                    const baseHalf = layout.baseHalf;
                    const topHalf = layout.topHalf;
                    const bands: number = layout.stairBands;
                    const silhouette = env.deco?.find((d) => d.kind === "silhouette") as { kind: "silhouette"; color: string } | undefined;
                    const crowdColor = silhouette?.color ?? "rgba(0,0,0,0.8)";
                    // b. Publikums-Silhouette am Fuß (deterministische Zacken, keine Animation)
                    const crowdPts: string[] = [`0,${H}`];
                    const cn = 22;
                    for (let i = 0; i <= cn; i += 1) {
                      const x = (i / cn) * W;
                      const h = H - 14 - ((i * 47) % 30);
                      crowdPts.push(`${x},${h}`, `${x + W / cn / 2},${H - 6}`);
                    }
                    crowdPts.push(`${W},${H}`);
                    // g. Spotlight-Kegel auf dem Führenden (wandert automatisch mit)
                    const leader = rt.find((t) => t.rank === 1) ?? null;
                    const leaderPos = leader ? tokenPos(leader, leader.score) : null;
                    return (
                      <>
                        {/* a. dezenter Rahmen (Himmel-Verlauf liegt bereits als envSky-Rect) */}
                        <rect x={24} y={24} width={W - 48} height={H - 48} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
                        {/* b. Showtreppe — 16 Trapez-Bänder, verjüngen sich zum Podest */}
                        <g>
                          {Array.from({ length: bands }).map((_, i) => {
                            const f0 = i / bands;
                            const f1 = (i + 1) / bands;
                            const y0 = floorY - f0 * (floorY - podiumY);
                            const y1 = floorY - f1 * (floorY - podiumY);
                            const hw0 = baseHalf + (topHalf - baseHalf) * f0;
                            const hw1 = baseHalf + (topHalf - baseHalf) * f1;
                            return (
                              <polygon
                                key={i}
                                points={`${cx - hw0},${y0} ${cx + hw0},${y0} ${cx + hw1},${y1} ${cx - hw1},${y1}`}
                                fill={`rgba(255,255,255,${(0.02 + f0 * 0.05).toFixed(3)})`}
                                stroke={env.line}
                                strokeWidth={1}
                                opacity={0.16}
                              />
                            );
                          })}
                        </g>
                        {/* f. Publikums-Silhouette am Fuß der Treppe */}
                        <polygon points={crowdPts.join(" ")} fill={crowdColor} opacity={0.85} />
                        {/* c. Ruhm-Podest oben — das Ziel */}
                        <rect x={cx - topHalf - 14} y={podiumY - 46} width={(topHalf + 14) * 2} height={60} rx={12} fill="rgba(0,0,0,0.35)" stroke={env.line} strokeWidth={2} />
                        <text x={cx} y={podiumY - 16} textAnchor="middle" fontSize={12} fontWeight={800} fill={env.line} letterSpacing="0.16em">
                          RUHM · PODEST
                        </text>
                        {/* d. Jury-Lichter entlang der Podest-Oberkante (statisch, gedimmt) */}
                        <g fill={env.line} opacity={0.32}>
                          {Array.from({ length: 12 }).map((_, b) => {
                            const bx = cx - topHalf - 6 + (b / 11) * ((topHalf + 6) * 2);
                            return <circle key={b} cx={bx} cy={podiumY - 52} r={3.4} />;
                          })}
                        </g>
                        {/* e. Footlights entlang der Vorderkante */}
                        <g fill={env.line} opacity={0.85}>
                          {Array.from({ length: Math.floor((W - 100) / 54) + 1 }).map((_, i) => (
                            <circle key={i} cx={60 + i * 54} cy={H - 24} r={4} />
                          ))}
                        </g>
                        {/* g. statischer Ambient-Kegel überm Podest + Spotlight auf den Führenden */}
                        <defs>
                          <radialGradient id="stageAmbientCone">
                            <stop offset="0%" stopColor={env.line} stopOpacity={0.22} />
                            <stop offset="100%" stopColor={env.line} stopOpacity={0} />
                          </radialGradient>
                          <radialGradient id="stageLeaderCone">
                            <stop offset="0%" stopColor={env.line} stopOpacity={0.34} />
                            <stop offset="100%" stopColor={env.line} stopOpacity={0} />
                          </radialGradient>
                        </defs>
                        <circle cx={cx} cy={podiumY} r={190} fill="url(#stageAmbientCone)" />
                        {leaderPos ? <ellipse cx={leaderPos.x} cy={leaderPos.y} rx={70} ry={62} fill="url(#stageLeaderCone)" /> : null}
                      </>
                    );
                  })()
                ) : TOWER_FAMILY.has(prim) ? (
                  <>
                    {/* towers: Rückwand oben + Boden ab Grundlinie */}
                    <rect x={0} y={0} width={W} height={layout.baseY} fill={env.stands} opacity={0.28} />
                    <rect x={0} y={layout.baseY} width={W} height={H - layout.baseY} fill={env.surface[2]} />
                    <rect x={0} y={layout.topY} width={W} height={layout.baseY - layout.topY} fill="url(#envSurface)" opacity={0.5} />
                  </>
                ) : (
                  renderSceneEnvBg(prim, env, layout, W, H)
                )}

                {/* Deko-Layer (hinter Tokens) — stage/Szenen rendern ihre Layer selbst */}
                {prim !== "stage" && !SCENE_PRIMS.has(prim) && !FIELD_CUSTOM.has(prim) ? env.deco?.map((d, i) => envDeco(d, W, H, TOWER_FAMILY.has(prim) ? layout.baseY : ROW_FAMILY.has(prim) ? H - layout.top : H - OVAL_M + 30, i)) : null}
                {/* Lichtstimmung */}
                {prim !== "stage" && !SCENE_PRIMS.has(prim) && !FIELD_CUSTOM.has(prim) && env.glow ? envGlow(env.glow, W, H, TOWER_FAMILY.has(prim) ? layout.baseY : H * 0.82, ROW_FAMILY.has(prim) ? layout.xEnd : W - 40) : null}
              </>
            ) : (
              <>{renderMotif(motif, W, H, skinAccent)}</>
            )}

            {/* Feld-Wasserzeichen: Disziplin-Identität */}
            {disciplineName ? (
              <text x={18} y={30} fontSize={19} fontWeight={800} letterSpacing="0.04em" fill={env ? env.line : skinAccent} opacity={env ? 0.75 : 0.95} style={{ textTransform: "uppercase" }}>
                {disciplineName}
              </text>
            ) : null}

            {/* Gewichtheben · Kraft-Turm-Feld: kg-Achse, Power-Rack-Rahmen, Podest-Linie
                oben und DIE geforderte Last (goldene Latte, gleitet). Auf dem Feld liegt
                sonst nichts außer den Hebern + der Hover-Steckbrief (freies Spielfeld). */}
            {prim === "barbell" && barbellInfo ? (() => {
              const baseY = layout.baseY;
              const topY = layout.topY;
              const axX = layout.lPad;
              const rightX = W - layout.rPad;
              const ticks: number[] = [];
              for (let k = Math.ceil(barbellInfo.axTop / 50) * 50; k <= barbellInfo.kgMax + 5; k += 50) ticks.push(k);
              const podY = topY - 10;
              const dLine = demandKg == null ? barbellInfo.axTop : demandKg;
              const barY = barbellY(dLine);
              return (
                <g>
                  {/* Power-Rack-Rahmen (Ständer links/rechts) */}
                  <line x1={axX} y1={topY} x2={axX} y2={baseY} stroke="var(--nl-mut)" strokeWidth={2} opacity={0.35} />
                  <line x1={rightX} y1={topY} x2={rightX} y2={baseY} stroke="var(--nl-mut)" strokeWidth={2} opacity={0.35} />
                  <line x1={axX} y1={baseY} x2={rightX} y2={baseY} stroke="var(--nl-line-2)" strokeWidth={2.5} />
                  {/* kg-Achse mit Tick-Marken */}
                  {ticks.map((k) => {
                    const y = barbellY(k);
                    return (
                      <g key={`ax-${k}`}>
                        <line x1={axX - 6} y1={y} x2={rightX} y2={y} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="3 9" opacity={0.4} />
                        <text x={axX - 9} y={y + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="var(--nl-mut-2)">{k}</text>
                      </g>
                    );
                  })}
                  <text x={16} y={(topY + baseY) / 2} textAnchor="middle" fontSize={9} fontWeight={800} fill="var(--nl-mut-2)" letterSpacing="0.14em" transform={`rotate(-90 16 ${(topY + baseY) / 2})`}>kg GESTEMMT</text>
                  {/* Podest-Linie oben (🏆) */}
                  <line x1={axX} y1={podY} x2={rightX} y2={podY} stroke="var(--nl-warn)" strokeWidth={1} strokeDasharray="5 6" opacity={0.55} />
                  <text x={rightX - 6} y={podY - 4} textAnchor="end" fontSize={13}>🏆</text>
                  {/* DIE geforderte Last — der Star. Alle Verbliebenen sitzen darauf. */}
                  <g style={{ transition: reducedMotion ? "none" : `transform ${TRACK_ROUND_MS}ms cubic-bezier(.45,0,.2,1)` }} transform={`translate(0 ${barY})`}>
                    <line x1={axX} y1={0} x2={rightX} y2={0} stroke="var(--nl-warn)" strokeWidth={3} />
                    <rect x={axX - 5} y={-11} width={9} height={22} rx={3} fill="var(--nl-mut)" />
                    <rect x={rightX - 4} y={-11} width={9} height={22} rx={3} fill="var(--nl-mut)" />
                    <g transform={`translate(${axX + 8} -22)`}>
                      <rect x={0} y={0} width={demandKg != null && demandKg >= 100 ? 118 : 108} height={19} rx={5} fill="var(--nl-warn)" />
                      <text x={7} y={13} fontSize={11} fontWeight={900} fontFamily="ui-monospace, monospace" fill="var(--nl-bg)">
                        {demandKg == null ? "GEFORDERT —" : done ? `GESTEMMT ${Math.round(dLine)} kg` : `GEFORDERT ${Math.round(dLine)} kg`}
                      </text>
                    </g>
                  </g>
                  {/* Lane-Kürzel unter der Grundlinie */}
                  {rt.map((t) => (
                    <text key={`bl-${t.code}`} x={layout.lPad + t.laneIdx * layout.colW + layout.colW / 2} y={baseY + 13} textAnchor="middle" fontSize={8} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut-2)"}>
                      {t.code}
                    </text>
                  ))}
                </g>
              );
            })() : null}

            {/* Feld je Primitive (schlichte Optik, wenn keine env-Umgebung) */}
            {(env && (prim === "track" || prim === "stage")) || SCENE_PRIMS.has(prim) || FIELD_CUSTOM.has(prim) || prim === "barbell" ? null : prim === "track" ? (
              <>
                <path d={ovalPath} fill="none" stroke="var(--nl-panel)" strokeWidth={54} />
                <path ref={pathRef} d={ovalPath} fill="none" stroke={skinAccent} opacity={0.7} strokeWidth={2} strokeDasharray="6 8" />
              </>
            ) : ROW_FAMILY.has(prim) ? (
              <>
                {Array.from({ length: N }).map((_, i) => {
                  const y = layout.top + i * layout.laneH + layout.laneH / 2;
                  return <line key={i} x1={layout.xStart} y1={y} x2={layout.xEnd} y2={y} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="4 7" opacity={0.5} />;
                })}
                <line x1={layout.xStart} y1={layout.top} x2={layout.xStart} y2={H - layout.top} stroke={skinAccent} strokeWidth={2.5} />
                {Array.from({ length: Math.ceil((H - 2 * layout.top) / 12) }).map((_, i) => (
                  <rect key={i} x={layout.xEnd} y={layout.top + i * 12} width={6} height={6} fill={i % 2 ? "var(--nl-ink)" : "var(--nl-mut)"} opacity={0.7} />
                ))}
                {rt.map((t) => (
                  <text key={`ll-${t.code}`} x={layout.xStart - 8} y={layout.top + t.laneIdx * layout.laneH + layout.laneH / 2} dominantBaseline="middle" textAnchor="end" fontSize={9.5} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut)"}>
                    {t.isOwn ? "★" : ""}
                    {t.code}
                  </text>
                ))}
              </>
            ) : prim === "stage" ? (
              // Schlichter Fallback (kein env): dunkler Grund + Treppe in --nl-* Tönen.
              (() => {
                const floorY = layout.floorY;
                const podiumY = layout.podiumY;
                const cx = layout.centerX;
                const baseHalf = layout.baseHalf;
                const topHalf = layout.topHalf;
                const bands: number = layout.stairBands;
                return (
                  <>
                    <rect x={0} y={0} width={W} height={H} fill="var(--nl-bg)" opacity={0.9} />
                    <g>
                      {Array.from({ length: bands }).map((_, i) => {
                        const f0 = i / bands;
                        const f1 = (i + 1) / bands;
                        const y0 = floorY - f0 * (floorY - podiumY);
                        const y1 = floorY - f1 * (floorY - podiumY);
                        const hw0 = baseHalf + (topHalf - baseHalf) * f0;
                        const hw1 = baseHalf + (topHalf - baseHalf) * f1;
                        return (
                          <polygon
                            key={i}
                            points={`${cx - hw0},${y0} ${cx + hw0},${y0} ${cx + hw1},${y1} ${cx - hw1},${y1}`}
                            fill="var(--nl-panel)"
                            opacity={0.35 + f0 * 0.45}
                            stroke={skinAccent}
                            strokeWidth={1}
                            strokeOpacity={0.35}
                          />
                        );
                      })}
                    </g>
                    <rect x={cx - topHalf - 14} y={podiumY - 46} width={(topHalf + 14) * 2} height={60} rx={12} fill="var(--nl-panel)" stroke={skinAccent} strokeWidth={2} />
                    <text x={cx} y={podiumY - 16} textAnchor="middle" fontSize={12} fontWeight={800} fill={skinAccent} letterSpacing="0.16em">
                      RUHM · PODEST
                    </text>
                  </>
                );
              })()
            ) : (
              <>
                <line x1={layout.lPad} y1={layout.baseY} x2={W - layout.rPad} y2={layout.baseY} stroke={skinAccent} strokeWidth={2.5} />
                {[0.25, 0.5, 0.75, 1].map((f, i) => (
                  <line key={i} x1={layout.lPad} y1={layout.baseY - (layout.baseY - layout.topY) * f} x2={W - layout.rPad} y2={layout.baseY - (layout.baseY - layout.topY) * f} stroke="var(--nl-line)" strokeWidth={1} strokeDasharray="3 8" opacity={0.45} />
                ))}
                {rt.map((t) => (
                  <text key={`tl-${t.code}`} x={layout.lPad + t.laneIdx * layout.colW + layout.colW / 2} y={layout.baseY + 13} textAnchor="middle" fontSize={8.5} fontWeight={t.isOwn ? 800 : 600} fill={t.isOwn ? "var(--nl-accent)" : "var(--nl-mut)"}>
                    {t.code}
                  </text>
                ))}
              </>
            )}

            {FIELD_CUSTOM.has(prim) ? null : (prim === "barbell" ? barbellSorted : sorted)
              .slice()
              .reverse()
              .map((t) => {
                // track: Token-Position folgt displayScore (pro Runde für ALLE Teams
                // gemeinsam gesetzt → simultanes Gleiten). Andere Primitive nutzen den
                // sequenziell aufgedeckten score (Optik unverändert).
                const posScore = prim === "track" ? t.displayScore : t.score;
                const pos = tokenPos(t, posScore);
                const r = t.isOwn ? geo.rOwn : geo.r;
                const hue = hueForIdx(t.idx);
                const medal = t.roundMedal === 1 ? "var(--nl-warn)" : t.roundMedal === 2 ? "var(--nl-mut)" : t.roundMedal === 3 ? "rgb(205,127,50)" : null;
                // Gewichtheben: Heber gerissen (auf Endgewicht) bzw. Champion an der Krone.
                const bbOut = prim === "barbell" && barbellEliminated(t.idx);
                const bbChamp = prim === "barbell" && done && (barbellRankMap[t.code] ?? 99) === 1;
                // track/barbell: langer, gleichmäßiger Gleit-Übergang über eine ganze Runde
                // (~5 s, TRACK_ROUND_MS) — alle Token/die Latte gleiten simultan statt zu
                // springen. Andere Primitive behalten ihren kürzeren, federnden Übergang.
                const dur = prim === "track" || prim === "barbell" ? TRACK_ROUND_MS : t.isOwn ? 1300 : 520;
                const ease = prim === "track" || prim === "barbell" ? "cubic-bezier(.4,0,.2,1)" : "cubic-bezier(.34,1.2,.4,1)";
                const glowing = t.glowUntil > now;
                // Primitive-spezifische Spur/Balken (absolute Koordinaten, hinter dem Token)
                const barW = Math.min(18, (layout.colW ?? 24) * 0.5);
                return (
                  <g key={t.code}>
                    {/* Kraft-Turm (barbell): FREIES Feld — kein Balken hinter dem Token.
                        Nur der Heber selbst sitzt auf der geforderten Last / seinem
                        Endgewicht. Die restliche Turm-Familie behält ihre Säulen. */}
                    {TOWER_FAMILY.has(prim) && prim !== "barbell" ? (() => {
                      const bh = Math.max(0, (layout.baseY ?? pos.y) - pos.y);
                      const nf = Math.min(1, t.score / finalMax);
                      const bw2 = prim === "sparkbar" ? Math.min(11, barW) : barW;
                      const barFill = prim === "thermometer" ? `hsl(${Math.round(120 - nf * 120)} 72% 48%)` : `hsl(${t.isOwn ? 210 : hue} 55% 50%)`;
                      return (
                        <g>
                          <rect x={pos.x - bw2 / 2} y={pos.y} width={bw2} height={bh} rx={3} fill={barFill} opacity={prim === "thermometer" ? 0.72 : t.isOwn ? 0.55 : 0.3} />
                        </g>
                      );
                    })() : null}
                    {ROW_FAMILY.has(prim) ? (() => {
                      const laneH = layout.laneH;
                      const x0 = layout.xStart;
                      const x1 = layout.xEnd;
                      const yy = pos.y;
                      const nf = Math.min(1, t.score / finalMax);
                      const fillCol = relColor(t.rel) ?? (t.isOwn ? "var(--nl-accent)" : `hsl(${hue} 55% 55%)`);
                      if (prim === "platter") {
                        const plates = Math.min(16, Math.max(1, Math.round(nf * 16)));
                        const step = Math.max(1, (pos.x - x0) / plates);
                        return (
                          <g opacity={0.75}>
                            {Array.from({ length: plates }).map((_, k) => (
                              <ellipse key={k} cx={x0 + step * (k + 0.5)} cy={yy} rx={Math.min(7, step * 0.42)} ry={4} fill="none" stroke={fillCol} strokeWidth={1.6} />
                            ))}
                          </g>
                        );
                      }
                      if (prim === "lamps") {
                        const lamps = 10;
                        const lit = Math.round(nf * lamps);
                        const step = (x1 - x0) / lamps;
                        return (
                          <g>
                            {Array.from({ length: lamps }).map((_, k) => {
                              const on = k < lit;
                              const col = on ? (k % 2 ? "hsl(140 60% 50%)" : "hsl(2 75% 56%)") : "var(--nl-line)";
                              return <rect key={k} x={x0 + step * k + step * 0.2} y={yy - laneH * 0.28} width={step * 0.6} height={laneH * 0.56} rx={2} fill={col} opacity={on ? 0.9 : 0.32} />;
                            })}
                          </g>
                        );
                      }
                      if (prim === "kda") {
                        // TDM — K/D/A/KDA/HS%/PTS deterministisch aus dem Feld-normierten
                        // Score ableiten (n = (score−min)/(max−min)). K grün · D rot · A blau.
                        // PTS = Kills×1 + Assists×0,5 aus den CONTINUOUS-Werten (kc/ac), damit
                        // auch schwächere Teams noch Abstand zeigen. Score bleibt Wahrheit/Rang.
                        const n = fieldNorm(t.score);
                        const kc = 6 + n * 26;
                        const ac = 4 + n * 16;
                        const k = Math.round(kc);
                        const d = Math.round(4 + (1 - n) * 16);
                        const a = Math.round(ac);
                        const kda = (k + a) / Math.max(1, d);
                        const hs = Math.round(28 + n * 42);
                        const pts = kc + ac * 0.5;
                        const kdaCol = kda >= 3 ? "hsl(140 62% 56%)" : kda >= 1.5 ? "hsl(41 85% 58%)" : "hsl(2 78% 62%)";
                        const barH = Math.min(11, laneH * 0.62);
                        const fs = Math.min(9.5, Math.max(7, laneH * 0.62));
                        const relC = relColor(t.rel);
                        return (
                          <g style={{ fontVariantNumeric: "tabular-nums" }}>
                            <title>{`abgeleitet · K ${k} · D ${d} · A ${a} · KDA ${kda.toFixed(1)} · HS ${hs}% · PTS ${pts.toFixed(1)}`}</title>
                            {/* Beziehung: Zeilen-Band + linke Kante (mine=blau/ally=grün/rival=rot) */}
                            {relC ? (
                              <>
                                <rect x={x0 - 16} y={yy - laneH / 2 + 1} width={x1 - x0 + 66} height={laneH - 2} rx={4} fill={relC} opacity={0.14} />
                                <rect x={x0 - 16} y={yy - laneH / 2 + 1} width={4} height={laneH - 2} rx={2} fill={relC} opacity={0.95} />
                              </>
                            ) : null}
                            <rect x={x0} y={yy - barH / 2} width={x1 - x0} height={barH} rx={3} fill="var(--nl-line)" opacity={0.16} />
                            <rect x={x0} y={yy - barH / 2} width={Math.max(0, pos.x - x0)} height={barH} rx={3} fill={fillCol} opacity={0.34} />
                            <text x={x0 + 7} y={yy} dominantBaseline="middle" fontSize={fs} fontWeight={800}>
                              <tspan fill="hsl(140 62% 56%)">{k}</tspan>
                              <tspan fill="var(--nl-mut)"> / </tspan>
                              <tspan fill="hsl(2 78% 62%)">{d}</tspan>
                              <tspan fill="var(--nl-mut)"> / </tspan>
                              <tspan fill="hsl(210 82% 64%)">{a}</tspan>
                            </text>
                            {/* rechts: KDA (farbcodiert) · PTS (Wertungs-Headline); HS% im Steckbrief/Tooltip */}
                            <text x={x1 - 52} y={yy} dominantBaseline="middle" textAnchor="end" fontSize={fs} fontWeight={800} fill={kdaCol}>
                              {kda.toFixed(1)}
                            </text>
                            <text x={x1 - 6} y={yy} dominantBaseline="middle" textAnchor="end" fontSize={fs + 0.5} fontWeight={800} fill="var(--nl-accent)">
                              {pts.toFixed(1)}
                            </text>
                          </g>
                        );
                      }
                      if (prim === "duelhp") {
                        // Mini-DM — 1v1-Lebensbalken im Fighting-Game-Look: skewX-
                        // Slant, Segment-Ticks, HP-Zahl rechts. Farbe hp>60 grün /
                        // >30 gelb / sonst rot. „K.O.?" unter 25 %. Klar anders als kda.
                        const n = fieldNorm(t.score);
                        const hp = Math.round(n * 100);
                        const col = hp > 60 ? "hsl(140 60% 48%)" : hp > 30 ? "hsl(41 85% 55%)" : "hsl(2 78% 56%)";
                        const barH = Math.min(13, laneH * 0.72);
                        const barW = x1 - x0;
                        const fs = Math.min(10, Math.max(7, laneH * 0.66));
                        return (
                          <g>
                            <g transform={`translate(0 ${yy}) skewX(-14)`}>
                              <rect x={x0} y={-barH / 2} width={barW} height={barH} rx={2} fill="var(--nl-line)" opacity={0.22} />
                              <rect x={x0} y={-barH / 2} width={Math.max(0, (hp / 100) * barW)} height={barH} rx={2} fill={col} opacity={0.9} />
                              {Array.from({ length: 9 }).map((_, k) => (
                                <line key={k} x1={x0 + ((k + 1) / 10) * barW} y1={-barH / 2} x2={x0 + ((k + 1) / 10) * barW} y2={barH / 2} stroke="var(--nl-bg)" strokeWidth={0.9} opacity={0.5} />
                              ))}
                            </g>
                            {hp < 25 ? (
                              <text x={x0 + 12} y={yy} dominantBaseline="middle" fontSize={fs} fontWeight={900} fill="hsl(2 88% 64%)" style={{ letterSpacing: "0.08em" }}>
                                K.O.?
                              </text>
                            ) : null}
                            <text x={x1 - 6} y={yy} dominantBaseline="middle" textAnchor="end" fontSize={fs + 1} fontWeight={900} fill={col}>
                              {hp}
                            </text>
                          </g>
                        );
                      }
                      // spybar — Sichtfeld-Balken + entdeckte Objekte
                      const found = Math.max(1, Math.round(nf * 6) + 1);
                      const glyphs = ["⭐", "🔑", "🧩", "🍀", "💎"];
                      return (
                        <g>
                          <rect x={x0} y={yy - 5} width={x1 - x0} height={10} rx={3} fill="var(--nl-line)" opacity={0.22} />
                          <rect x={x0} y={yy - 5} width={Math.max(0, pos.x - x0)} height={10} rx={3} fill={fillCol} opacity={0.38} />
                          {Array.from({ length: found }).map((_, k) => (
                            <text key={k} x={x0 + ((k + 1) / (found + 1)) * (pos.x - x0)} y={yy + 4} textAnchor="middle" fontSize={11}>{glyphs[k % 5]}</text>
                          ))}
                        </g>
                      );
                    })() : null}
                    {prim === "bump" ? (() => {
                      // Rang-über-Etappen-Linie aus RT.rankHistory (kein Score=Position).
                      // Feld grau/leise, Anker (rel oder Top-3) farbig + Endpunkt-Label.
                      const stages = Math.max(1, layout.stagesTotal ?? 1);
                      const hist = t.rankHistory;
                      const xStage = (s: number) => layout.pL + (stages > 1 ? s / (stages - 1) : 0.5) * (W - layout.pL - layout.pR);
                      const yRank = (rk: number) => layout.top + (N > 1 ? (rk - 1) / (N - 1) : 0.5) * (layout.bot - layout.top);
                      const pts: [number, number][] = hist.map((rk, s) => [xStage(s), yRank(rk)]);
                      // Live-Punkt an der laufenden Etappe (aktueller Rang) → Linie zieht mit.
                      const liveStage = Math.min(stages - 1, hist.length);
                      pts.push([xStage(liveStage), yRank(t.rank)]);
                      const anchor = t.rel != null || t.rank <= 3;
                      const rankMed = t.rank === 1 ? "var(--nl-warn)" : t.rank === 2 ? "var(--nl-mut)" : t.rank === 3 ? "rgb(205,127,50)" : null;
                      const col = relColor(t.rel) ?? rankMed ?? "var(--nl-mut)";
                      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
                      const end = pts[pts.length - 1]!;
                      return (
                        <g>
                          <path d={d} fill="none" stroke={anchor ? col : "var(--nl-mut)"} strokeWidth={anchor ? (t.rel ? 2.6 : 1.9) : 1} strokeLinejoin="round" strokeLinecap="round" opacity={anchor ? 0.95 : 0.14} />
                          {anchor ? <text x={end[0] + 11} y={end[1] + 3} fontSize={9.5} fontWeight={800} fill={col}>{t.code}</text> : null}
                        </g>
                      );
                    })() : null}
                    {prim === "stage" || SCENE_PRIMS.has(prim) ? (
                      <ellipse cx={pos.x} cy={pos.y + r * 0.9} rx={r * 0.9} ry={r * 0.32} fill="rgba(0,0,0,0.4)" />
                    ) : null}
                    <g
                      transform={`translate(${pos.x} ${pos.y})`}
                      style={{ transition: reducedMotion ? "none" : `transform ${dur}ms ${ease}`, cursor: onOpenTeam && t.teamId ? "pointer" : "default", opacity: bbOut ? 0.5 : 1 }}
                      onMouseEnter={() => openHover(t.idx)}
                      onMouseLeave={scheduleHoverClose}
                      onClick={() => {
                        if (onOpenTeam && t.teamId) onOpenTeam(t.teamId);
                      }}
                    >
                      {/* Gewichtheben: Sieger-Krone + goldener Ring (Champion), Kampfrichter-
                          Lampe ⚪ gültig / 🔴 gerissen, roter Ring bei Riss. */}
                      {bbChamp ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={3.5} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.4s ease-in-out infinite" }} /> : null}
                      {prim === "barbell" && bbOut ? <circle r={r + 3.5} fill="none" stroke="var(--nl-risk)" strokeWidth={2.4} /> : null}
                      {prim === "barbell" && demandKg != null ? (
                        <text x={-(r + 1)} y={r + 4} textAnchor="end" fontSize={11}>{bbOut ? "🔴" : "⚪"}</text>
                      ) : null}
                      {bbChamp ? <text y={-(r + 9)} textAnchor="middle" fontSize={14}>🏆</text> : null}
                      {glowing ? <circle r={r + 8} fill="none" stroke="var(--nl-warn)" strokeWidth={4} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.1s ease-in-out infinite" }} /> : null}
                      {/* Buzzer-Beater-Glow — Führung auf dem Court dauerhaft golden umrandet */}
                      {prim === "court" && t.rank === 1 && t.thrownSlot >= 0 ? (
                        <circle r={r + 11} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.5} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
                      ) : null}
                      {/* TDM: MVP — Rang 1 dauerhaft golden umrandet (Krone unten im Marker-Block) */}
                      {prim === "kda" && t.rank === 1 && t.thrownSlot >= 0 ? (
                        <circle r={r + 9} fill="none" stroke="var(--nl-warn)" strokeWidth={2.5} opacity={0.6} style={{ animation: reducedMotion ? "none" : "olyGlowPulse 1.6s ease-in-out infinite" }} />
                      ) : null}
                      {/* Freund/Feind-Rahmen (mine/ally/rival) — nur Rahmenfarbe, nie Füllung */}
                      {relColor(t.rel) ? <circle r={r + 5.5} fill="none" stroke={relColor(t.rel)!} strokeWidth={2.4} opacity={0.95} /> : null}
                      {medal ? <circle r={r + 3.5} fill="none" stroke={medal} strokeWidth={t.isOwn ? 4.5 : 3.5} /> : null}
                      {t.logoUrl ? (
                        <image href={t.logoUrl} x={-r} y={-r} width={r * 2} height={r * 2} clipPath={`url(#natclip-${t.code})`} preserveAspectRatio="xMidYMid slice" />
                      ) : (
                        <circle r={r} fill={`hsl(${hue} 60% 52%)`} />
                      )}
                      <circle r={r} fill="none" stroke={t.isOwn ? "var(--nl-ink)" : "rgba(255,255,255,.5)"} strokeWidth={t.isOwn ? 2.5 : 1.4} />
                      {t.isOwn && !ROW_FAMILY.has(prim) ? (
                        <text y={r + 15} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--nl-accent)">
                          ★ {t.code}
                        </text>
                      ) : t.rel && SCENE_PRIMS.has(prim) ? (
                        <text y={-(r + 7)} textAnchor="middle" fontSize={10} fontWeight={800} fill={relColor(t.rel)!}>
                          {t.code}
                        </text>
                      ) : null}
                      {/* Court: Treffer (grüner Swish) / Fehlwurf (rotes X) + 🔥 Hot-Hand + 🏆 Führung */}
                      {prim === "court" && t.thrownSlot >= 0 ? (
                        <g>
                          <g transform={`translate(${r + 5} ${-(r + 5)})`}>
                            {t.score >= courtMedian ? (
                              <>
                                <circle r={5} fill="hsl(140 58% 42%)" stroke="hsl(140 70% 78%)" strokeWidth={1.4} />
                                <path d="M -2.4 0 L -0.6 2 L 2.6 -2.4" fill="none" stroke="hsl(140 82% 92%)" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
                              </>
                            ) : (
                              <g stroke="hsl(2 78% 62%)" strokeWidth={2} strokeLinecap="round">
                                <line x1={-3} y1={-3} x2={3} y2={3} />
                                <line x1={3} y1={-3} x2={-3} y2={3} />
                              </g>
                            )}
                          </g>
                          {courtMax > courtMedian && t.score > courtHotFloor ? (
                            <text x={-(r + 4)} y={-(r + 1)} textAnchor="end" fontSize={13}>🔥</text>
                          ) : null}
                          {t.rank === 1 ? (
                            <text y={r + 27} textAnchor="middle" fontSize={16}>🏆</text>
                          ) : null}
                        </g>
                      ) : null}
                      {/* TDM: MVP-Krone auf Rang 1 */}
                      {prim === "kda" && t.rank === 1 && t.thrownSlot >= 0 ? (
                        <text y={-(r + 5)} textAnchor="middle" fontSize={15}>👑</text>
                      ) : null}
                    </g>
                  </g>
                );
              })}
    </>
  );
}
