import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const out = path.join(root, "docs/design/arena-tickets-medaillen-22-11");
const M = (f, q) => `file://${root}/public/mockups/${f}${q}`;
const ansichten = {
  "arena-ausbau": M("finanzen-modern-18-11.html", "?ansicht=wahl&plan=2,1,0"),
  "arena-leer": M("finanzen-modern-18-11.html", "?ansicht=wahl"),
  "finanzen-guv": M("finanzen-modern-18-11.html", "?ansicht=posten"),
};
const groessen = [[1920,1080,"1920x1080"],[2560,1440,"2560x1440"],[1710,1112,"1710x1112"]];
const nur = process.argv[2] ? new RegExp(process.argv[2]) : null;
const b = await chromium.launch({ args: ["--disable-gpu","--disable-dev-shm-usage"] });
for (const [w,h,n] of groessen) for (const [a,url] of Object.entries(ansichten)) {
  const app = path.join(out, `app-${a}-${n}.png`);
  if (!fs.existsSync(app)) continue;
  const ziel = path.join(out, `vergleich-${a}-${n}.png`);
  if (nur && !nur.test(ziel)) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1500);
  const mock = path.join("/tmp/claude-0", `mock-${a}-${n}.png`);
  await p.screenshot({ path: mock }); await ctx.close();
  const c2 = await b.newContext({ viewport: { width: w*2+6, height: h+30 } });
  const q = await c2.newPage();
  const d = (f)=>"data:image/png;base64,"+fs.readFileSync(f).toString("base64");
  await q.setContent(`<body style="margin:0;background:#222;color:#fff;font:14px sans-serif"><div style="display:flex;gap:6px"><div><div style="height:30px;line-height:30px;padding-left:8px">Mockup</div><img src="${d(mock)}" width="${w}"></div><div><div style="height:30px;line-height:30px;padding-left:8px">App</div><img src="${d(app)}" width="${w}"></div></div>`);
  await q.screenshot({ path: ziel }); await c2.close();
  console.log("ok", ziel);
}
await b.close();
