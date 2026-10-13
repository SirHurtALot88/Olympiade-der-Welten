// Zieht je Set Druecke (Kartennummer, Seltenheit, Cardmarket-Preis) von cardcluster.de.
// Cardcluster sperrt Server ohne echten Browser (Bunny-Shield) — Playwright + Chromium noetig,
// laeuft deshalb in einer Claude-Sitzung, nicht in der App. Siehe scripts/build-rarity-map.ts.
// usage: node scripts/cardcluster-snapshot.mjs slugs.json outdir   (slugs.json: ["slug", ...])
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const slugs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3]; mkdirSync(OUT, { recursive: true });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const b = await chromium.launch({ channel: "chromium", proxy });
const ctx = await b.newContext({ ignoreHTTPSErrors: true, locale: "de-DE", userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" });
await ctx.route(/(doubleclick|rubiconproject|btloader|intentiq|inmobi|33across|adsrvr|richaudience|id5-sync|a-mo\.net|optidigital|omnitagjs|rapidedge|sentry|prebid|fuseplatform|google|gstatic)/, r => r.abort());
const p = await ctx.newPage();
const got = {};
p.on("response", async (r) => {
  const m = r.url().match(/cardcluster\.de\/api\/sets\/([^/?]+)(\/prices)?\?format=1/);
  if (m && r.status() === 200) { try { got[m[1] + (m[2] ? "|prices" : "|set")] = await r.text(); } catch {} }
});
for (const slug of slugs) {
  const file = `${OUT}/${slug}.json`;
  if (existsSync(file)) continue;
  for (let a = 0; a < 3; a++) {
    delete got[slug + "|set"]; delete got[slug + "|prices"];
    try { await p.goto(`https://cardcluster.de/set/${slug}`, { timeout: 60000, waitUntil: "domcontentloaded" }); } catch {}
    for (let w = 0; w < 30 && !(got[slug + "|set"] && got[slug + "|prices"]); w++) await p.waitForTimeout(1000);
    if (got[slug + "|set"] && got[slug + "|prices"]) break;
  }
  if (!(got[slug + "|set"] && got[slug + "|prices"])) { console.log("FEHLT", slug); continue; }
  const set = JSON.parse(got[slug + "|set"]).data, prices = JSON.parse(got[slug + "|prices"]).data;
  const cm = new Map(prices.filter(x => x.print).map(x => [x.print, x.cm_default]));
  const prints = (set.prints || []).map(pr => ({
    id: pr.id, n: pr.cardNumber, r: pr.rarity, name: pr.card?.nameEn, slug: pr.card?.slug,
    img: pr.image, cm: cm.get(pr.id) ?? null,
  }));
  writeFileSync(file, JSON.stringify({ slug, name: set.name, setNumber: set.setNumber, format: set.format, languages: (set.languages || []).map(l => l.language), prints }));
  console.log("ok", slug, prints.length);
}
await b.close();
