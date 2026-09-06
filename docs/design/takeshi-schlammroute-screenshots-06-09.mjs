// Screenshots der Takeshi-Ansicht: eigener HTTP-Server auf public/, Playwright, danach beendet.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
const ROOT=process.argv[2], OUT=process.argv[3], SAAT=process.argv[4]||"";
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
  const req404=[]; p.on("response",r=>{if(r.status()>=400)req404.push(r.status()+" "+r.url());});
  await p.route("https://fonts.googleapis.com/**",r=>r.abort()); await p.route("https://fonts.gstatic.com/**",r=>r.abort());
  await p.goto(`http://127.0.0.1:${port}/mockups/battle-mode.html`,{waitUntil:"load"});
  await p.waitForFunction(()=>window.__arena&&window.__arena.setDisc,null,{timeout:30000});
  await p.evaluate(d=>window.__arena.setDisc(d),"takeshis-castle");
  await p.click("#t2"); await p.waitForTimeout(400);
  const cv=await p.$("#cv");
  await cv.screenshot({path:OUT+"/00-vor-start.png"});
  await p.click("#play");
  let last=0;
  for(const [ms,tag] of [[1500,"start"],[5000,"mitte"],[10000,"schluss"],[17000,"ziel"],[26000,"ende"],[40000,"karte"]]){
    await p.waitForTimeout(ms-last); last=ms;
    await cv.screenshot({path:OUT+"/"+tag+".png"});
  }
  console.log("404/err:",req404.length?req404.join(" | "):"keine");
  console.log("Seitenfehler:",fehler.length?fehler.join(" | "):"keine");
}finally{ if(browser)await browser.close(); server.close(); }
