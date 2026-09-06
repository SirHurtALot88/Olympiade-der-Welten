// Ticker-Sicht eines EINZELNEN Takeshi-Rennens mit gesetzten Chaos-Feldern: eigener HTTP-Server
// auf public/, Playwright, Rennen starten, nach dem Einlauf den Feed auslesen, Screenshots.
//   node chaos-ticker.mjs <public-root> <out-dir> '<json-felder>'
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const ROOT=process.argv[2], OUT=process.argv[3], FELDER=JSON.parse(process.argv[4]||"{}");
mkdirSync(OUT,{recursive:true});
const MIME={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".json":"application/json"};
const server=createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,"http://x").pathname); if(p==="/")p="/mockups/battle-mode.html";
  const fp=join(ROOT,p); const d=await readFile(fp); res.writeHead(200,{"Content-Type":MIME[extname(fp)]||"application/octet-stream"}); res.end(d);}catch(e){res.writeHead(404);res.end("nf");}});
await new Promise(r=>server.listen(0,"127.0.0.1",r)); const port=server.address().port;
const fest="/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
let browser;
try{
  browser=await chromium.launch(existsSync(fest)?{executablePath:fest,args:["--no-sandbox","--disable-dev-shm-usage"]}:{});
  const p=await browser.newPage({viewport:{width:1300,height:700}});
  const fehler=[]; p.on("pageerror",e=>fehler.push(String(e)));
  await p.route("https://fonts.googleapis.com/**",r=>r.abort()); await p.route("https://fonts.gstatic.com/**",r=>r.abort());
  await p.goto(`http://127.0.0.1:${port}/mockups/battle-mode.html`,{waitUntil:"load"});
  await p.waitForFunction(()=>window.__arena&&window.__arena.setDisc,null,{timeout:30000});
  await p.evaluate(f=>window.__arena.bahnArtSetzen("takeshis-castle",f),FELDER);
  await p.evaluate(d=>window.__arena.setDisc(d),"takeshis-castle");
  await p.click("#t2"); await p.waitForTimeout(400);
  const cv=await p.$("#cv");
  await p.click("#play");
  let last=0;
  for(const [ms,tag] of [[3000,"start"],[6000,"falle-2"],[9000,"mitte"],[14000,"schluss"],[24000,"ziel"]]){
    await p.waitForTimeout(ms-last); last=ms;
    await cv.screenshot({path:OUT+"/"+tag+".png"});
  }
  await p.waitForFunction(()=>window.__arena.vorbei&&window.__arena.vorbei(),null,{timeout:90000}).catch(()=>{});
  const zeilen=await p.$$eval("#feed div",ds=>ds.map(d=>d.textContent.trim()));
  writeFileSync(OUT+"/ticker.txt",zeilen.join("\n"));
  const z=(re)=>zeilen.filter(l=>re.test(l)).length;
  console.log(`Feed-Zeilen ${zeilen.length}: rammt ${z(/rammt/)}, weicht aus ${z(/ins Leere/)}, steckt weg ${z(/steckt den Rempler/)}, Gedraenge ${z(/Gedränge/)}, stolpert/reisst ${z(/reißt die|stolpert/)}, ausgeschieden ${z(/scheidet aus/)}, im Ziel ${z(/im Ziel/)}`);
  console.log("Seitenfehler:",fehler.length?fehler.join(" | "):"keine");
}finally{ if(browser)await browser.close(); server.close(); }
