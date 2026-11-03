#!/usr/bin/env python3
"""
Baut die ERSTE abspielbare Spurt-Szene (HYROX-Kurs): public/szenen/spurt/kurs.html

    python3 -I scripts/baue-spurt-szene.py
    node scripts/baue-szenen-poster.mjs spurt/kurs

Bis zum 03.11. hatte Spurt nur das Standbild `hyrox.jpg` (Asset-Runde 01./02.11., PixelLab) —
keine Szene, `demo: null`. Diese Szene nimmt genau dieses Bild als Kulisse, nimmt die darin
eingebrannten Figuren heraus (Flicken aus derselben Bahn, um eine Pfeil-Periode bzw. eine
Box versetzt) und laesst die Demo-Figuren der Asset-Runde darauf laufen:

  * Johanna und Arlen laufen die 1-km-Schleife gegen den Uhrzeigersinn (wie die Pfeile),
    Arlen etwas langsamer, so dass Johanna ihn einmal je Runde ueberholt.
  * Wurzelbert schiebt auf Bahn 2 des Kunstrasens den Schlitten hin und zurueck.
  * Kiti traegt auf Bahn 2 der Farmers-Carry-Gasse zwei Kettlebells hin und zurueck.
  * Noface wirft in Box 3 Wall Balls an die Zielscheibe.
  * Die Anzeigetafel zaehlt die Laufzeit hoch.

Reine Anzeige wie jede andere Pixel-Szene: kein Bezug zur Wertung, nichts im Spielcode.
Die Figuren-Animationen stammen unveraendert aus den Szenen der Asset-Runde
(gewichtheben/sandsack.html: Kiti/Wurzelbert gehend + Ruhebilder; battlefield/eroberung.html:
Johanna/Arlen im Sprint).
"""
import base64
import io
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SZ = os.path.join(ROOT, "public", "szenen")
SRC_JPG = os.path.join(SZ, "spurt", "hyrox.jpg")
OUT = os.path.join(SZ, "spurt", "kurs.html")


def enc(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def enc_jpg(im):
    # Die Vorlage ist selbst ein JPEG; als JPEG eingebettet bleiben Lichtkegel ohne Farbbaender.
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=92, subsampling=0)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def json_after(s, marker):
    """Liest das JSON-Objekt, das direkt hinter `marker` beginnt (Klammern zaehlen)."""
    i = s.index(marker) + len(marker)
    depth, j, ins, esc = 0, i, False, False
    while True:
        c = s[j]
        if ins:
            if esc:
                esc = False
            elif c == "\\":
                esc = True
            elif c == '"':
                ins = False
        elif c == '"':
            ins = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[i : j + 1])
        j += 1


# ------------------------------------------------------------------ Kulisse ohne eingebrannte Figuren
# (Zielrechteck x0, y0, x1, y1) <- dieselben Zeilen, um dx versetzt. Die Bahnpfeile liegen alle
# 311 px, die Boxen der Wall-Ball-Station alle 125 px — so passt auch der Pfeil unter Kiti.
PATCHES = [
    ((1095, 38, 1182, 116), -311),   # Johanna auf der oberen Geraden
    ((532, 798, 600, 860), +311),    # Kiti auf der unteren Geraden (samt Pfeil darunter)
    ((316, 236, 410, 294), +130),    # Wurzelbert + Schlitten, Kunstrasen Bahn 2
    ((436, 588, 484, 620), -150),    # gruene Kettlebells mitten in Bahn 2
    ((1140, 620, 1178, 688), -250),  # Wurzelbert in Box 3 (bringt den Ersatzball am Boden aus Box 1 mit)
    ((1148, 512, 1172, 538), -250),  # Wall Ball in der Luft
]
SLED_BOX = (366, 238, 409, 292)


def sled_sprite(im):
    sp = im.crop(SLED_BOX).convert("RGBA")
    px = sp.load()
    for y in range(sp.height):
        for x in range(sp.width):
            r, g, b, _ = px[x, y]
            turf = g > r + 18 and g > b + 14
            line = (r + g + b) / 3 > 170 and max(r, g, b) - min(r, g, b) < 40 and 4 <= y <= 9
            if turf or line:
                px[x, y] = (0, 0, 0, 0)
    # Wurzelberts Hand ragt links ein paar Pixel ins Kaestchen
    for y in range(sp.height):
        for x in range(0, 3):
            px[x, y] = (0, 0, 0, 0)
    return sp


def clean_bg():
    im = Image.open(SRC_JPG).convert("RGB")
    sled = sled_sprite(im)
    src = im.copy()
    for (x0, y0, x1, y1), dx in PATCHES:
        im.paste(src.crop((x0 + dx, y0, x1 + dx, y1)), (x0, y0))
    return im, sled


# ------------------------------------------------------------------ Figuren aus den Nachbarszenen
def figures():
    gw = open(os.path.join(SZ, "gewichtheben", "sandsack.html"), encoding="utf-8").read()
    G = json_after(gw, "const D = ")
    bf = open(os.path.join(SZ, "battlefield", "eroberung.html"), encoding="utf-8").read()
    B = json_after(bf, "const D=")
    walk = {k: G["anims"][k] for k in ("kiti_e", "kiti_w", "wz_e", "wz_w")}
    sprint = {k: B["sets"][k] for k in ("johanna_sprint_e", "arlen_sprint_e")}
    idle = {"noface": G["idles"]["noface"]}
    return walk, sprint, idle, G["font"]


HTML = r"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Spurt HYROX-Kurs</title>
<style>
:root { --bg:#0b0c11; --fg:#ecebe6; --muted:#a19e98; --line:#2a2b33; --acc:#f2c94c; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.wrap { max-width:1140px; margin:0 auto; padding:24px max(16px,env(safe-area-inset-left,0px)) 32px; }
h1 { font-size:1.35rem; margin:0 0 6px; text-wrap:balance; }
p.lead { color:var(--muted); font-size:0.92rem; line-height:1.55; max-width:72ch; margin:0 0 16px; }
.stage { position:relative; width:100%; aspect-ratio:1680/960; border-radius:10px; overflow:hidden; background:#000; box-shadow:0 8px 28px rgba(0,0,0,.55); }
canvas { display:block; width:100%; height:100%; }
.controls { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; align-items:center; }
button { font:inherit; font-weight:700; font-size:0.86rem; padding:9px 14px; border-radius:8px; border:1px solid var(--line); background:#1a1b21; color:var(--fg); cursor:pointer; }
button.on { border-color:var(--acc); color:var(--acc); }
.cap { color:var(--muted); font-size:0.85rem; line-height:1.55; margin-top:12px; max-width:80ch; }
.t { font-variant-numeric:tabular-nums; color:var(--muted); font-size:0.85rem; margin-left:auto; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Spurt &mdash; HYROX-Kurs in Bewegung</h1>
  <p class="lead">Laufschleife mit Stationen: Johanna und Arlen auf der Runde, Wurzelbert am Schlitten, Kiti beim Farmers Carry, Noface an der Wall-Ball-Box. Die Tafel z&auml;hlt die Zeit.</p>
  <div class="stage"><canvas id="c"></canvas></div>
  <div class="controls">
    <button id="play">Pause</button>
    <button data-sp="1" class="on">Tempo 1&times;</button>
    <button data-sp="2">Tempo 2&times;</button>
    <button data-sp="4">Tempo 4&times;</button>
    <button id="reset">Zur&uuml;cksetzen</button>
    <span class="t" id="tt"></span>
  </div>
  <p class="cap">Reine Anzeige, nichts im Spielcode und ohne Bezug zum Ergebnis des Spieltags. Kulisse: das HYROX-Standbild der Asset-Runde, die eingebrannten Figuren herausgenommen. Figuren: dieselben PixelLab-Animationen wie in der Sandsack- und der Battlefield-Szene.</p>
</div>
<script>
const D = __DATA__;
const W = 1680, H = 960;
const cvs = document.getElementById('c');
const ctx = cvs.getContext('2d');
const mk = s => { const i = new Image(); i.src = s; return i; };
const BG = mk(D.bg), SLED = mk(D.sled);
const WALK = {}; for (const [k, a] of Object.entries(D.walk)) WALK[k] = Object.assign({}, a, { imgs: a.frames.map(mk) });
const RUN = {}; for (const [k, a] of Object.entries(D.sprint)) RUN[k] = Object.assign({}, a, { imgs: a.f.map(mk) });
const IDL = {}; for (const [k, a] of Object.entries(D.idle)) IDL[k] = Object.assign({}, a, { im: mk(a.frame) });
const lerp = (a, b, u) => a + (b - a) * u;
let K = 1;
const snap = v => Math.round(v * K) / K;

// ---------------------------------------------------------------- Laufschleife (Fussmittellinie)
// Gegen den Uhrzeigersinn wie die Pfeile: unten nach rechts, rechts hoch, oben nach links, links runter.
const L = { x0: 78, x1: 1602, y0: 99, y1: 842, r: 92 };
const SEGS = (() => {
  const { x0, x1, y0, y1, r } = L, out = [];
  const line = (ax, ay, bx, by) => out.push({ k: 'l', ax, ay, bx, by, len: Math.hypot(bx - ax, by - ay) });
  const arc = (cx, cy, a0, a1) => out.push({ k: 'a', cx, cy, a0, a1, len: Math.abs(a1 - a0) * r });
  const P = Math.PI;
  line(x0 + r, y1, x1 - r, y1); arc(x1 - r, y1 - r, P / 2, 0);
  line(x1, y1 - r, x1, y0 + r); arc(x1 - r, y0 + r, 0, -P / 2);
  line(x1 - r, y0, x0 + r, y0); arc(x0 + r, y0 + r, -P / 2, -P);
  line(x0, y0 + r, x0, y1 - r); arc(x0 + r, y1 - r, -P, -1.5 * P);
  let s = 0; for (const q of out) { q.s0 = s; s += q.len; } out.total = s; return out;
})();
function onLoop(s) {
  s = ((s % SEGS.total) + SEGS.total) % SEGS.total;
  const q = SEGS.find(z => s >= z.s0 && s < z.s0 + z.len) || SEGS[SEGS.length - 1];
  const u = (s - q.s0) / q.len;
  if (q.k === 'l') return { x: lerp(q.ax, q.bx, u), y: lerp(q.ay, q.by, u), dx: q.bx - q.ax };
  const a = lerp(q.a0, q.a1, u), r = L.r;
  return { x: q.cx + Math.cos(a) * r, y: q.cy + Math.sin(a) * r, dx: -Math.sin(a) * Math.sign(q.a1 - q.a0) };
}
const RUNNERS = [
  { key: 'johanna_sprint_e', v: 205, s0: 600, sc: 0.40, cyc: 0.075, face: 1 },
  { key: 'arlen_sprint_e', v: 182, s0: 1650, sc: 0.36, cyc: 0.08, face: 1 },
];

// ---------------------------------------------------------------- Stationen
// Schlitten: Kunstrasen Bahn 2, Fusslinie y 288, schiebt zwischen x 322 und 528.
const SL = { y: 288, xa: 330, xb: 520, v: 36 };
// Farmers Carry: Bahn 2 der Gasse, Fusslinie y 620, zwischen Startlinie 230 und Ende 727.
const FC = { y: 621, xa: 262, xb: 700, v: 58 };
// Wall Ball: Box 3, Wurf an die Zielscheibe (1157, 497).
const WB = { x: 1158, y: 682, tx: 1157, ty: 500, per: 1.9 };

function seq(segs) { let t = 0; for (const s of segs) { s.t0 = t; t += s.dur; } segs.period = t; return segs; }
function at(segs, ts) {
  const tl = ts % segs.period;
  const s = segs.find(q => tl >= q.t0 && tl < q.t0 + q.dur) || segs[segs.length - 1];
  return { s, tl, u: Math.min(1, (tl - s.t0) / s.dur), lt: tl - s.t0 };
}
const SLED_SEQ = seq([
  { dur: (SL.xb - SL.xa) / SL.v, dir: 1, push: true },
  { dur: 0.7, dir: 1, rest: true },
  { dur: 0.9, dir: -1, swap: true },
  { dur: (SL.xb - SL.xa) / SL.v, dir: -1, push: true },
  { dur: 0.7, dir: -1, rest: true },
  { dur: 0.9, dir: 1, swap: true },
]);
const FC_SEQ = seq([
  { dur: (FC.xb - FC.xa) / FC.v, dir: 1, go: true },
  { dur: 0.6, dir: 1 },
  { dur: (FC.xb - FC.xa) / FC.v, dir: -1, go: true },
  { dur: 0.6, dir: -1 },
]);

// ---------------------------------------------------------------- Zeichnen
function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,10,0.38)'; ctx.beginPath(); ctx.ellipse(x, y, r, r / 4, 0, 0, Math.PI * 2); ctx.fill(); }
function drawWalk(key, fi, x, y, k) {
  const an = WALK[key], sc = an.scale * k;
  ctx.drawImage(an.imgs[fi], snap(x - an.ax * sc), snap(y - an.fy * sc), an.cw * sc, an.ch_h * sc);
}
function drawRun(key, fi, x, y, sc, flip) {
  const an = RUN[key], im = an.imgs[fi];
  ctx.save(); ctx.translate(snap(x), snap(y)); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -an.ax * sc, -an.ay * sc, an.w * sc, an.h * sc); ctx.restore();
}
function bell(x, y, col) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#1c1c22'; ctx.fillRect(x - 3, y - 9, 7, 2); ctx.fillRect(x - 3, y - 9, 2, 5); ctx.fillRect(x + 2, y - 9, 2, 5);
  ctx.fillStyle = col[0]; ctx.fillRect(x - 4, y - 4, 9, 6); ctx.fillRect(x - 3, y - 5, 7, 8);
  ctx.fillStyle = col[1]; ctx.fillRect(x - 2, y - 4, 2, 2);
  ctx.fillStyle = col[2]; ctx.fillRect(x - 3, y + 2, 7, 1);
}
function ball(x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - 5, y - 4, 11, 9); ctx.fillRect(x - 4, y - 5, 9, 11);
  ctx.fillStyle = '#9aa0aa'; ctx.fillRect(x - 4, y - 3, 9, 7); ctx.fillRect(x - 3, y - 4, 7, 9);
  ctx.fillStyle = '#f2c94c'; ctx.fillRect(x - 4, y, 9, 2);
  ctx.fillStyle = '#d8dce2'; ctx.fillRect(x - 2, y - 3, 2, 1);
}
const FONT = D.font;
function text(s, x, y, col, sc) {
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT[' '];
    for (let j = 0; j < 7; j++) for (let k = 0; k < 5; k++) if (g[j][k] === '1') ctx.fillRect(x + (i * 6 + k) * sc, y + j * sc, sc, sc);
  }
}
const tw = (s, sc) => (s.length * 6 - 1) * sc;

function render(ts) {
  const w = cvs.clientWidth || 1120, dpr = window.devicePixelRatio || 1;
  const CW = Math.round(w * dpr), CH = Math.round(w * dpr * H / W);
  if (cvs.width !== CW || cvs.height !== CH) { cvs.width = CW; cvs.height = CH; }
  K = cvs.width / W;
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(BG, 0, 0);
  const items = [];

  // Laeufer
  for (const r of RUNNERS) {
    const p = onLoop(r.s0 + ts * r.v), an = RUN[r.key];
    if (Math.abs(p.dx) > 0.2) r.face = p.dx > 0 ? 1 : -1;
    const fi = Math.floor(ts / r.cyc) % an.imgs.length, face = r.face;
    items.push({ y: p.y, f: () => { shadow(p.x, p.y, 13); drawRun(r.key, fi, p.x, p.y, r.sc, face < 0); } });
  }
  // Schlitten
  {
    const { s, u, lt } = at(SLED_SEQ, ts), d = s.dir;
    let sx;
    if (s.push) sx = d > 0 ? lerp(SL.xa, SL.xb, u) : lerp(SL.xb, SL.xa, u);
    else sx = d > 0 ? (s.swap ? SL.xa : SL.xb) : (s.swap ? SL.xb : SL.xa);
    // der Schlitten steht vor Wurzelbert; beim Seitenwechsel laeuft er drumherum
    let wx = sx - d * 30, key = d > 0 ? 'wz_e' : 'wz_w', fi = 0;
    if (s.swap) { wx = lerp(sx + d * 30, sx - d * 30, u); key = d > 0 ? 'wz_w' : 'wz_e'; fi = Math.floor(lt / 0.1) % 9; }
    else if (s.push) fi = Math.floor(lt / 0.16) % 9;
    const sw = SLED.width, sh = SLED.height;
    items.push({ y: SL.y - 1, f: () => { shadow(sx, SL.y, 16); ctx.drawImage(SLED, Math.round(sx - sw / 2), SL.y + 2 - sh); } });
    items.push({ y: SL.y + (s.swap ? 8 : 0), f: () => { shadow(wx, SL.y + (s.swap ? 8 : 0), 12); drawWalk(key, fi, wx, SL.y + (s.swap ? 8 : 0), 0.84); } });
  }
  // Farmers Carry
  {
    const { s, u, lt } = at(FC_SEQ, ts), d = s.dir;
    const x = s.go ? (d > 0 ? lerp(FC.xa, FC.xb, u) : lerp(FC.xb, FC.xa, u)) : (d > 0 ? FC.xb : FC.xa);
    const key = d > 0 ? 'kiti_e' : 'kiti_w', fi = s.go ? Math.floor(lt / 0.12) % WALK[key].imgs.length : 0;
    const G = ['#3aa65a', '#8fe0a0', '#1f6a36'];
    items.push({ y: FC.y, f: () => {
      shadow(x, FC.y, 12);
      bell(x - d * 3, FC.y - 14, ['#2c7a44', '#5fb878', '#174d29']);   // hintere Hand
      drawWalk(key, fi, x, FC.y, 0.84);
      bell(x + d * 4, FC.y - 13, G);                                   // vordere Hand
    } });
  }
  // Wall Ball
  {
    const u = (ts % WB.per) / WB.per, id = IDL.noface, sc = id.scale * 0.84;
    let bx = WB.x + 4, by = WB.y - 34;
    if (u < 0.42) { const v = u / 0.42; by = lerp(WB.y - 34, WB.ty, 1 - (1 - v) * (1 - v)); bx = lerp(WB.x + 4, WB.tx, v); }
    else if (u < 0.84) { const v = (u - 0.42) / 0.42; by = lerp(WB.ty, WB.y - 34, v * v); bx = lerp(WB.tx, WB.x + 4, v); }
    const squat = u > 0.84 ? Math.sin((u - 0.84) / 0.16 * Math.PI) * 4 : 0;
    items.push({ y: WB.y, f: () => {
      shadow(WB.x, WB.y, 12);
      ctx.drawImage(id.im, snap(WB.x - id.ax * sc), snap(WB.y - id.fy * sc + squat), id.cw * sc, id.ch_h * sc);
      ball(bx, by + (u > 0.84 ? squat : 0));
    } });
  }
  items.sort((a, b) => a.y - b.y).forEach(it => it.f());

  // Anzeigetafel: Laufzeit + Fortschritt
  const tot = 3600 + 2 * 60 + 37 + ts, hh = Math.floor(tot / 3600), mm = Math.floor(tot / 60) % 60, ss = Math.floor(tot % 60);
  const s = hh + ':' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  ctx.fillStyle = '#0f1633'; ctx.fillRect(1440, 252, 82, 22);
  text(s, Math.round(1481 - tw(s, 2) / 2), 256, '#f5cd5c', 2);
  const prog = 0.69 + 0.3 * ((ts % 60) / 60);
  ctx.fillStyle = '#2a3a78'; ctx.fillRect(1436, 285, 90, 3);
  ctx.fillStyle = '#5fd6a0'; ctx.fillRect(1436, 285, Math.round(90 * prog), 3);
  document.getElementById('tt').textContent = 't = ' + ts.toFixed(2) + ' s';
}

let speed = 1, playing = true, simT = 0, last = null, seeking = false;
function tick(now) {
  if (last === null) last = now;
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (playing && !seeking) simT += dt * speed;
  if (!seeking) render(simT);
  requestAnimationFrame(tick);
}
window.__seek = t => { seeking = true; simT = t; render(t); };
window.__ready = Promise.all([BG, SLED, ...Object.values(WALK).flatMap(a => a.imgs), ...Object.values(RUN).flatMap(a => a.imgs),
  ...Object.values(IDL).map(a => a.im)].map(i => i.decode()));
document.getElementById('play').onclick = e => { playing = !playing; e.target.textContent = playing ? 'Pause' : 'Weiter'; };
document.getElementById('reset').onclick = () => { simT = 0; seeking = false; };
document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => {
  speed = +b.dataset.sp; document.querySelectorAll('[data-sp]').forEach(q => q.classList.toggle('on', q === b)); });
window.__ready.then(() => requestAnimationFrame(tick));
</script>
</body>
</html>
"""


def main():
    bg, sled = clean_bg()
    walk, sprint, idle, font = figures()
    if os.environ.get("SZENEN_DEBUG"):
        bg.save(os.path.join(os.environ["SZENEN_DEBUG"], "spurt-kurs-bg.png"))
        sled.save(os.path.join(os.environ["SZENEN_DEBUG"], "spurt-kurs-sled.png"))
    data = {
        "bg": enc_jpg(bg),
        "sled": enc(sled),
        "walk": walk,
        "sprint": sprint,
        "idle": idle,
        "font": font,
    }
    out = HTML.replace("__DATA__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    open(OUT, "w", encoding="utf-8").write(out)
    print("geschrieben:", os.path.relpath(OUT, ROOT), f"{len(out) / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
