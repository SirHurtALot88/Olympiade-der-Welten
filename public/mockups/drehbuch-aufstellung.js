// ===================================================================================
// DREHBUCH-MOCKUP B0' — AUFSTELLUNG, DANN ENTHUELLUNG (PM-Plan 20.09., Abschnitt 3.4).
//
// Ein Arena-Kampftag als gescriptete Vorfuehrung, die bei der AUFSTELLUNG beginnt: drei
// Reihen, ein Befehl je Slot, eine Zielansage, "Aufstellung abgeben" — und dann eine
// Aufloesung, die sich ausdruecklich auf diese Entscheidung zurueckbezieht ("Schleicher
// geht hinten rum — dein Bollwerk steht links").
//
// ZUFALLSFREI, UND ZWAR NACHPRUEFBAR (Auflage des Gegenchecks 5.2, "nicht verhandelbar"):
//   * Diese Datei enthaelt keinen Zufallsgenerator — kein Math.random(), kein rr(), kein
//     LCG, keine Zeit-Saat. Suchen Sie danach; Sie finden nur die Sperre direkt unten.
//   * Math.random() wird beim Laden durch eine Funktion ersetzt, die einen Fehler wirft.
//     Die Marke "Zufallsfrei" in der Kopfzeile prueft das und faerbt sich rot, wenn die
//     Sperre nicht greift.
//   * Die Aufloesung ist eine reine Funktion der Aufstellung: baueDrehbuch(aufstellung)
//     liefert die Duell-Liste, Zug fuer Zug, mit festen Schadenszahlen. Gleiche
//     Aufstellung, gleiche Aufloesung. Andere Aufstellung, andere Aufloesung — und zwar
//     dort, wo die Aufstellung etwas gelesen hat (der "Drehbuch-Schluessel" unter der
//     Buehne zeigt genau diese Lesungen an).
//
// WAS HIER NICHT DRIN IST: kein Motor, kein Rezept, kein Sim-/Wertungspfad aus
// battle-mode.engine.js. Geteilt wird nur das Stylesheet (battle-mode.css) und — als
// Vorbild, per Hand uebernommen, nicht importiert — das Buehnenbild von zeichneHeben()
// (grosses Fokuspaar mittig, Duellstand-Zeile oben, Textkarte auf fester Hoehe, wartende
// Paare klein am unteren Rand) sowie der callout()-Mechanismus (#bbugcallout, 2,6 s).
// Die Figuren sind die echten Arena-Figuren: dieselben Baukasten-Blaetter aus
// public/sprites/baukasten/, einmal ueber window.__arena.renderProbe() vorgerendert
// (scripts/rendere-drehbuch-sprites.mjs) und hier als Atlas-PNG gezeichnet.
// ===================================================================================
(function(){
"use strict";

// ---------------------------------------------------------------- 0. Zufall sperren
Math.random=function(){ throw new Error("Drehbuch ist zufallsfrei: Math.random() ist auf dieser Seite gesperrt."); };
(function pruefeSperre(){
  const marke=document.getElementById("zufallsfrei");
  let gesperrt=false;
  try{ Math.random(); }catch(e){ gesperrt=true; }
  if(!gesperrt&&marke){ marke.classList.add("kaputt"); marke.textContent="ACHTUNG: Math.random() ist NICHT gesperrt"; }
})();

// ---------------------------------------------------------------- 1. Kader (echte Werte)
// Namen, Klassen, Rassen, Eignung (TDM) und Groesse: eins zu eins aus SQUAD/OPP des
// Battle-Mode-Entwurfs (Vigilante Wranglers gegen Armageddon Aftermath, Spielstand-Kader).
// `lp` ist eine Anzeige-Groesse des Drehbuchs (20 + 0,8 x Gesundheit), `pers` die
// Persoenlichkeit aus demselben Entwurf, `stark` die Lesung "gewinnt einen Zweikampf
// gegen den Schleicher" (Eignung >= 45) — eine Drehbuch-Regel, kein Motorwert.
const PERS_LABEL={bollwerk:"Bollwerk",draufgaenger:"Draufgänger",duellant:"Duellant",
  schleicher:"Schleicher",beschuetzer:"Beschützer",opportunist:"Opportunist"};
const HEIM=[
  {n:"Draco",     slug:"draco",     c:"Warlord", r:"Human",     eig:66.1, lp:87, pers:"draufgaenger"},
  {n:"Krolach",   slug:"krolach",   c:"Templar", r:"Construct", eig:60.5, lp:90, pers:"bollwerk"},
  {n:"Johanna",   slug:"johanna",   c:"Templar", r:"Human",     eig:50.7, lp:85, pers:"beschuetzer"},
  {n:"Gram",      slug:"gram",      c:"Warlord", r:"Lizard",    eig:45.8, lp:83, pers:"duellant"},
  {n:"Jorund",    slug:"jorund",    c:"Bard",    r:"Human",     eig:27.2, lp:40, pers:"opportunist"},
  {n:"Inefinna",  slug:"inefinna",  c:"Mage",    r:"Divine",    eig:12.7, lp:22, pers:"opportunist"},
];
const GAST=[
  {n:"Greenkraut",   slug:"greenkraut",   c:"Warlord",   r:"Construct", eig:60.6, lp:86, pers:"draufgaenger", reihe:"Front",  befehl:"Mit der Linie"},
  {n:"Krag'Zul",     slug:"krag-zul",     c:"Tank",      r:"Construct", eig:62.7, lp:94, pers:"bollwerk",     reihe:"Front",  befehl:"Hinter den Eigenen"},
  {n:"Tidesprinter", slug:"tidesprinter", c:"Berserker", r:"Aqua",      eig:47.2, lp:61, pers:"schleicher",   reihe:"Mitte",  befehl:"Flanke"},
  {n:"Seraph-11",    slug:"seraph-11",    c:"Bard",      r:"Construct", eig:33.8, lp:62, pers:"beschuetzer",  reihe:"Mitte",  befehl:"Rücken decken · Heiler"},
  {n:"Ralazar the Balanced", slug:"ralazar-the-balanced", c:"Mage", r:"Human", eig:37.0, lp:69, pers:"opportunist", reihe:"Hinten", befehl:"Mit der Linie"},
  {n:"Cassandra",    slug:"cassandra",    c:"Bard",      r:"Human",     eig:32.4, lp:50, pers:"schleicher",   reihe:"Hinten", befehl:"Hinter den Eigenen · Bogen"},
];
const ALLE=Object.fromEntries([...HEIM,...GAST].map(u=>[u.n,u]));
const STARK=(u)=>u.eig>=45;
const SCHADEN=(u)=>Math.round(u.eig*0.45);
const vorname=(n)=>n.split(" ")[0];

// Befehle: dieselben fuenf wie im Battle-Mode-Entwurf (ORDERS), Wortlaut uebernommen.
const BEFEHLE=[["mitlinie","Mit der Linie"],["hinter","Hinter den Eigenen"],["decken","Rücken decken"],["flanke","Flanke"],["verfolgen","Verfolgen"]];
const BEFEHL_LABEL=Object.fromEntries(BEFEHLE);
const SLOTS=["FL","FR","ML","MR","HL","HR"];
const REIHEN=[["F","Front","wer hier steht, trifft zuerst — und wird zuerst getroffen"],
              ["M","Mitte","hält die Mitte, fängt, was außen herumkommt"],
              ["H","Hinten","Bogen, Zauber, Schutz — erreichbar nur über die Flanke"]];

// ---------------------------------------------------------------- 2. Aufstellung (Zustand)
// slots: Slot -> Name; befehl/ziel: Name -> Wert. Vorgaben unten sind die vier Beispiele.
const VORGABEN={
  standard:{slots:{FL:"Draco",FR:"Krolach",ML:"Gram",MR:"Johanna",HL:"Jorund",HR:"Inefinna"},
    befehl:{Draco:"verfolgen",Krolach:"hinter",Gram:"mitlinie",Johanna:"decken",Jorund:"mitlinie",Inefinna:"mitlinie"},
    ziel:{Draco:"Greenkraut"}},
  bollwerk:{slots:{FL:"Draco",FR:"Johanna",ML:"Krolach",MR:"Gram",HL:"Jorund",HR:"Inefinna"},
    befehl:{Draco:"mitlinie",Johanna:"mitlinie",Krolach:"decken",Gram:"mitlinie",Jorund:"hinter",Inefinna:"hinter"},
    ziel:{Draco:"Greenkraut"}},
  verfolgen:{slots:{FL:"Draco",FR:"Krolach",ML:"Gram",MR:"Johanna",HL:"Jorund",HR:"Inefinna"},
    befehl:{Draco:"verfolgen",Krolach:"mitlinie",Gram:"mitlinie",Johanna:"decken",Jorund:"mitlinie",Inefinna:"mitlinie"},
    ziel:{Draco:"Tidesprinter",Krolach:"Greenkraut"}},
  tank:{slots:{FL:"Draco",FR:"Krolach",ML:"Gram",MR:"Johanna",HL:"Jorund",HR:"Inefinna"},
    befehl:{Draco:"verfolgen",Krolach:"hinter",Gram:"mitlinie",Johanna:"decken",Jorund:"mitlinie",Inefinna:"mitlinie"},
    ziel:{Draco:"Krag'Zul"}},
};
const kopie=(o)=>JSON.parse(JSON.stringify(o));
let A=kopie(VORGABEN.standard);
let gewaehlt=null;      // Slot, der fuer einen Tausch angeklickt ist
let versiegelt=false;   // nach "Aufstellung abgeben"

// ---------------------------------------------------------------- 3. Das Drehbuch
// baueDrehbuch(A) liest die Aufstellung an genau vier Stellen und baut daraus die
// Duell-Liste. Jede Lesung steht im Schluessel (s. drehbuchSchluessel), damit man
// nachpruefen kann, WAS die Aufstellung entschieden hat.
//
// Ein Duell: {a (Heim), b (Gast), erst ("a"|"b"), sieger ("a"|"b"), ansage, fazit}.
// Die Schlagfolge folgt aus LP und festem Schaden je Figur: der Sieger braucht
// ceil(LP_verlierer / Schaden) Treffer; der Verlierer schlaegt dazwischen so oft, wie die
// Reihenfolge es hergibt, und nie so hart, dass der Sieger faellt (Drehbuch, kein Motor).
// LP werden von Duell zu Duell mitgenommen — wer angeschlagen ist, faellt schneller.
function baueDrehbuch(A){
  const lp={}; for(const n in ALLE)lp[n]=ALLE[n].lp;
  const gefallen=new Set();
  const lebt=(n)=>!gefallen.has(n);
  const bei=(slot)=>A.slots[slot];
  const befehl=(n)=>A.befehl[n]||"mitlinie";
  const ziel=(n)=>A.ziel[n]||null;
  const duelle=[]; const lesung={};
  let stand=[0,0];

  function duell(aN,bN,erst,sieger,titel,ansage,fazit){
    const a=ALLE[aN], b=ALLE[bN];
    const S=sieger==="a"?a:b, V=sieger==="a"?b:a;
    const lpS=lp[S.n], lpV=lp[V.n];
    const dS=SCHADEN(S);
    const N=Math.max(1,Math.ceil(lpV/dS));                 // Treffer des Siegers
    const M=erst===sieger?N-1:N;                            // Treffer des Verlierers
    const dV=M>0?Math.max(1,Math.min(SCHADEN(V),Math.floor((lpS-6)/M))):0;
    const schlaege=[]; let wer=erst; let s=N,v=M;
    while(s>0||v>0){
      if(wer===sieger){ if(s>0){schlaege.push({von:sieger,schaden:dS}); s--;} }
      else{ if(v>0){schlaege.push({von:wer,schaden:dV}); v--;} }
      wer=wer==="a"?"b":"a";
    }
    // Letzter Schlag ist immer der des Siegers (M<=N und Reihenfolge stellen das sicher).
    lp[V.n]=0; lp[S.n]=lpS-dV*M; gefallen.add(V.n);
    if(sieger==="a")stand[0]++; else stand[1]++;
    const d={nr:duelle.length+1,titel,a:a.n,b:b.n,erst,sieger,schlaege,lpA:sieger==="a"?lpS:lpV,lpB:sieger==="b"?lpS:lpV,
      ansage:ansage||null,fazit:fazit||null,stand:[...stand]};
    duelle.push(d); return d;
  }

  // ---- Lesung 1: die Front. Duellant = FL (oder FR, wenn FL der Verfolger ist).
  const verfolger=HEIM.map(u=>u.n).find(n=>befehl(n)==="verfolgen"&&ziel(n)==="Tidesprinter")||null;
  const F=bei("FL")!==verfolger?bei("FL"):bei("FR");
  const F2=F===bei("FL")?bei("FR"):bei("FL");
  const frontZiel=ziel(F)==="Greenkraut"?"greenkraut":ziel(F)==="Krag'Zul"?"tank":"ohne";
  lesung.front=frontZiel+"("+F+")";
  if(frontZiel==="greenkraut"){
    duell(F,"Greenkraut","a","a","Die Front",
      null,{txt:"Ansage Greenkraut — "+F+" nimmt den Warlord, bevor der Tank heran ist.",caption:"Zielansage aus der Aufstellung: "+F+" → Greenkraut"});
  }else if(frontZiel==="tank"){
    duell(F,"Krag'Zul","a","b","Die Front",
      {txt:"Alle auf den Tank.",caption:"Zielansage aus der Aufstellung: "+F+" → Krag'Zul"},
      {txt:"Krag'Zul steht noch — "+F+" nicht.",caption:"94 Lebenspunkte. Das war die falsche Ansage."});
  }else{
    duell(F,"Greenkraut","b","a","Die Front",
      {txt:"Keine Ansage — "+F+" sucht sich selbst ein Ziel.",caption:"Front-Slot ohne Zielansage: Greenkraut schlägt zuerst"},
      {txt:F+" hat es geschafft. Diesmal.",caption:"Ohne Ansage schlägt der Gegner zuerst — "+F+" hat kaum noch Lebenspunkte"});
  }

  // ---- Lesung 2: die Flanke. Tidesprinter geht links hinten rum. Wer steht da?
  const deckerKandidaten=["ML","HL"].map(bei).filter(n=>befehl(n)==="decken"&&lebt(n)&&n!==verfolger);
  const decker=deckerKandidaten[0]||null;
  if(verfolger&&lebt(verfolger)){
    lesung.flanke="verfolgt("+verfolger+")";
    const V=ALLE[verfolger];
    duell(verfolger,"Tidesprinter","b",STARK(V)?"a":"b","Die Flanke",
      {txt:"Schleicher geht hinten rum — "+verfolger+" hängt ihm im Nacken.",caption:"Befehl „Verfolgen“ mit Zielansage Tidesprinter"},
      STARK(V)?{txt:verfolger+" holt ihn ein. Der Schleicher kommt nie an.",caption:"Der Verfolger ignoriert die Formation — und das war richtig"}
              :{txt:verfolger+" hängt dran. Kurz.",caption:verfolger+" ist kein Kämpfer — der Schleicher schüttelt ihn ab"});
  }else if(decker){
    const D=ALLE[decker];
    lesung.flanke=(STARK(D)?"gedeckt-stark(":"gedeckt-schwach(")+decker+")";
    const wo=D.pers==="bollwerk"?"dein Bollwerk steht links.":decker+" steht links.";
    duell(decker,"Tidesprinter","b",STARK(D)?"a":"b","Die Flanke",
      {txt:"Schleicher geht hinten rum — "+wo,caption:"Befehl „Rücken decken“ auf der linken Seite (Slot "+(bei("ML")===decker?"Mitte":"Hinten")+" links)"},
      STARK(D)?{txt:decker+" hält.",caption:"Tidesprinter kommt nicht an der hinteren Reihe an"}
              :{txt:"Und hält nicht.",caption:decker+" deckt, aber "+decker+" ist kein Kämpfer"});
  }else{
    // Er kommt LINKS an — also trifft er zuerst, wer hinten links steht.
    const opfer=["HL","HR","ML","MR"].map(bei).filter(lebt)[0];
    const O=ALLE[opfer];
    lesung.flanke="offen("+opfer+")";
    duell(opfer,"Tidesprinter","b",STARK(O)?"a":"b","Die Flanke",
      {txt:"Schleicher geht hinten rum — und links steht niemand.",caption:"Kein „Rücken decken“ auf Mitte links oder Hinten links"},
      STARK(O)?{txt:"Aber "+opfer+" dreht sich um.",caption:"Ein Kämpfer in der hinteren Reihe — nicht gedeckt, aber nicht wehrlos"}
              :{txt:opfer+" fällt. Niemand war da.",caption:"Die hintere Reihe war offen — die Aufstellung hat das entschieden"});
  }

  // ---- Zweite Welle an der Front: der uebrige Frontgegner gegen den, der noch steht.
  const gastFront=["Greenkraut","Krag'Zul"].find(lebt);
  if(gastFront){
    const heimFront=[F,F2,bei("ML"),bei("MR")].filter(n=>n&&lebt(n))[0];
    if(heimFront){
      const angeschlagen=lp[heimFront]<ALLE[heimFront].lp*0.5;
      const heimGewinnt=STARK(ALLE[heimFront])&&!angeschlagen;
      duell(heimFront,gastFront,gastFront==="Greenkraut"?"b":"b",heimGewinnt?"a":"b","Zweite Welle",
        null,
        heimGewinnt?{txt:heimFront+" hält die Front — "+vorname(gastFront)+" fällt.",caption:"Frisch und stark — die zweite Welle bricht"}
          :{txt:vorname(gastFront)+" kommt nach — "+heimFront+" hat nichts mehr übrig.",caption:angeschlagen?"Angeschlagen aus dem ersten Duell":"Kein Kämpfer an der Front"});
    }
  }

  // ---- Lesung 3: die hintere Reihe. Cassandra sucht sich, wer hinten steht.
  const hintenZiel=["HR","HL","MR","ML"].map(bei).filter(lebt)[0];
  if(hintenZiel&&lebt("Cassandra")){
    const Z=ALLE[hintenZiel];
    lesung.hinten=(STARK(Z)?"stark(":"schwach(")+hintenZiel+")";
    duell(hintenZiel,"Cassandra","b",STARK(Z)?"a":"b","Der Bogen",
      {txt:"Cassandra sucht die hintere Reihe — und findet "+hintenZiel+".",caption:"Wer hinten steht, hat die Aufstellung entschieden"},
      STARK(Z)?{txt:"Falsche Adresse.",caption:hintenZiel+" ist ein Kämpfer — der Bogen reicht nicht"}
              :{txt:hintenZiel+" fällt.",caption:"Ungedeckt hinten — der Bogen findet immer jemanden"});
  }

  // ---- Ende oder Sudden Death (Gleichstand): wer noch steht, entscheidet — und das ist
  // wieder die Flanke: lebt der Schleicher, gewinnt er; sonst der, der ihn gehalten hat.
  if(stand[0]===stand[1]){
    const staerkster=HEIM.map(u=>u.n).filter(lebt).sort((x,y)=>ALLE[y].eig*lp[y]-ALLE[x].eig*lp[x])[0];
    if(lebt("Tidesprinter")){
      lesung.suddenDeath="schleicher-lebt";
      duell(staerkster,"Tidesprinter","b","b","Sudden Death",
        {txt:"Sudden Death — der Schleicher steht noch.",caption:"Weil links niemand stand"},
        {txt:"Tidesprinter entscheidet den Spieltag.",caption:"Ein Schleicher, den keiner gedeckt hat, ist am Ende noch da"});
    }else{
      const flankenHeld=[verfolger,decker].find(n=>n&&lebt(n))||staerkster;
      const heimRest=flankenHeld;
      const gastRest=GAST.map(u=>u.n).filter(lebt).sort((x,y)=>ALLE[x].eig-ALLE[y].eig)[0];
      lesung.suddenDeath="schleicher-tot";
      duell(heimRest,gastRest,"a","a","Sudden Death",
        {txt:"Sudden Death — "+heimRest+" steht noch.",caption:"Weil der Schleicher nie angekommen ist"},
        {txt:heimRest+" entscheidet den Spieltag.",caption:"Die gedeckte Flanke hat am Ende die Beine übrig"});
    }
  }
  const sieg=stand[0]>stand[1];
  const fazit=lesung.flanke.startsWith("offen")||lesung.flanke.startsWith("gedeckt-schwach")||lesung.flanke.startsWith("verfolgt")&&!sieg
    ?"Der Schleicher kam links durch, weil dort niemand stand, der ihn halten konnte. Wer da steht, entscheidet die Aufstellung — nicht der Kampf."
    :"Der Schleicher ist links nie angekommen. Das hat die Aufstellung entschieden, bevor der erste Schlag fiel.";
  return {duelle,lesung,stand,sieg,fazit,
    schluessel:Object.entries(lesung).map(([k,v])=>k+"="+v).join(" · ")};
}

// ---------------------------------------------------------------- 4. Zeitachse
// Aus der Duell-Liste wird eine Zeitachse in Sekunden: Einmarsch, Schlaege, Fall, Halten.
const T_EINMARSCH=1.1, T_SCHLAG=0.85, T_TREFFER=0.32, T_HALT=2.1;
function baueZeitachse(drehbuch){
  const ereignisse=[]; const callouts=[]; let t=0;
  const duelle=drehbuch.duelle.map(d=>{
    const start=t;
    const ankunft=start+T_EINMARSCH;
    if(d.ansage)callouts.push({t:ankunft-0.15,...d.ansage});
    ereignisse.push({t:start,art:"start",d});
    const schlaege=d.schlaege.map((s,i)=>{
      const beginn=ankunft+i*T_SCHLAG;
      return {...s,beginn,treffer:beginn+T_TREFFER,letzter:i===d.schlaege.length-1};
    });
    const fall=schlaege.length?schlaege[schlaege.length-1].treffer:ankunft;
    ereignisse.push({t:fall,art:"fall",d});
    if(d.fazit)callouts.push({t:fall+0.25,...d.fazit});
    const ende=fall+T_HALT;
    t=ende;
    return {...d,start,ankunft,schlaege,fall,ende};
  });
  return {duelle,ereignisse,callouts,dauer:t};
}

// ---------------------------------------------------------------- 5. Buehne (Canvas)
// Nach dem Vorbild zeichneHeben(): Duellstand-Zeile oben (H*0.10), Untertitel (H*0.155),
// zwei Figuren mittig bei W*0.38 / W*0.62 auf y=H*0.46 mit Schattenellipse, Name und
// Lebenspunkte darunter, Textkarte auf fester Hoehe, wartende Paare bei H*0.90.
const cv=document.getElementById("cv"), ctx=cv.getContext("2d");
const W=cv.width, H=cv.height;
// 0.36/0.64 statt der 0.38/0.62 von zeichneHeben: die Figuren stehen hier 1,6-fach
// vergroessert (Fokuspaar), und in der Luecke dazwischen sitzt die Textkarte.
const SPALTE=[0.36,0.64];
const FARBWURZEL=document.querySelector(".oly-battle-arena");
const css=v=>getComputedStyle(FARBWURZEL).getPropertyValue(v).trim();
const SKALA=1.6;

// Bildtabelle aus drehbuch/sprites.js (reine Daten, generiert). Fehlt sie, zeichnet die
// Buehne Platzhalter-Kacheln mit Kuerzel statt gar nichts.
const ATLAS=window.DREHBUCH_SPRITES||null; const BILDER={};
if(ATLAS)for(const n in ATLAS.figuren){ const im=new Image(); im.src="drehbuch/"+ATLAS.figuren[n].slug+".png"; BILDER[n]=im; }

// Figur zeichnen: Atlas-Zelle (160px, Anker 80/112) so, dass der Anker auf (x,y) liegt.
function zeichneFigur(name,x,y,reihe,bild,alpha){
  ctx.save(); ctx.globalAlpha=alpha==null?1:alpha; ctx.imageSmoothingEnabled=false;
  const im=BILDER[name];
  if(ATLAS&&im&&im.complete&&im.naturalWidth){
    const z=ATLAS.zelle, r=ATLAS.reihen.indexOf(reihe), n=ATLAS.figuren[name].bilder[reihe]||1;
    const b=((bild%n)+n)%n;
    ctx.drawImage(im,b*z,r*z,z,z,x-ATLAS.anker.x*SKALA,y-ATLAS.anker.y*SKALA,z*SKALA,z*SKALA);
  }else{
    ctx.fillStyle="#3a4557"; ctx.fillRect(x-14,y-40,28,58);
    ctx.fillStyle="#c7ccd6"; ctx.font="700 12px 'Barlow Condensed',sans-serif"; ctx.textAlign="center"; ctx.fillText(name.slice(0,2).toUpperCase(),x,y-8);
  }
  ctx.restore();
}
function schrift(txt,x,y,farbe,groesse,gewicht,familie){
  ctx.font=(gewicht||"400")+" "+groesse+"px "+(familie||"'IBM Plex Mono',monospace");
  ctx.lineWidth=3;ctx.strokeStyle="rgba(8,10,14,.85)";ctx.lineJoin="round";
  ctx.strokeText(txt,x,y);ctx.fillStyle=farbe;ctx.fillText(txt,x,y);
}
const ease=(p)=>p<0?0:p>1?1:(1-Math.cos(Math.PI*p))/2;

function zeichneBuehne(Z,uhr){
  ctx.clearRect(0,0,W,H);
  // Boden
  ctx.fillStyle=css("--pitch")||"#0D141E"; ctx.fillRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,H*0.30,0,H); g.addColorStop(0,"rgba(255,255,255,0)"); g.addColorStop(1,"rgba(255,255,255,.05)");
  ctx.fillStyle=g; ctx.fillRect(0,H*0.30,W,H*0.70);
  ctx.strokeStyle="rgba(255,255,255,.07)"; ctx.setLineDash([8,10]); ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(W/2,H*0.26); ctx.lineTo(W/2,H*0.80); ctx.stroke(); ctx.setLineDash([]);

  if(!Z)return;
  const d=Z.duelle.find(x=>uhr>=x.start&&uhr<x.ende)||Z.duelle[Z.duelle.length-1];
  const idx=Z.duelle.indexOf(d);
  const stand=uhr>=d.fall?d.stand:(idx>0?Z.duelle[idx-1].stand:[0,0]);

  // DUELLSTAND-ZEILE oben, wie in zeichneHeben — nur etwas tiefer (H*0.15 statt 0.10),
  // weil das Callout-Banner (#bbugcallout, top:8px) sonst genau darauf liegt.
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="700 30px 'Barlow Condensed',sans-serif";
  ctx.lineWidth=4;ctx.strokeStyle="rgba(8,10,14,.85)";ctx.lineJoin="round";
  const standTxt=stand[0]+" : "+stand[1];
  ctx.strokeText(standTxt,W/2,H*0.15); ctx.fillStyle="#f2e9d8"; ctx.fillText(standTxt,W/2,H*0.15);
  ctx.font="400 11px 'IBM Plex Mono',monospace";ctx.fillStyle="#8a93a3";
  ctx.fillText("Duell "+(idx+1)+" von "+Z.duelle.length+" · "+d.titel+" · "+d.a+" gegen "+d.b,W/2,H*0.205);

  // Figuren: Einmarsch, Schlag, Fall.
  const y=H*0.46;
  const p=ease((uhr-d.start)/T_EINMARSCH);
  const heimX=(-90)+(W*SPALTE[0]+90)*p, gastX=(W+90)-(W+90-W*SPALTE[1])*p;
  const aktiver=d.schlaege.find(s=>uhr>=s.beginn&&uhr<s.beginn+T_SCHLAG)||null;
  const letzterTreffer=[...d.schlaege].reverse().find(s=>uhr>=s.treffer)||null;
  const gefallenA=uhr>=d.fall&&d.sieger==="b", gefallenB=uhr>=d.fall&&d.sieger==="a";
  const lpA=d.lpA-d.schlaege.filter(s=>s.von==="b"&&uhr>=s.treffer).reduce((q,s)=>q+s.schaden,0);
  const lpB=d.lpB-d.schlaege.filter(s=>s.von==="a"&&uhr>=s.treffer).reduce((q,s)=>q+s.schaden,0);
  [["a",d.a,heimX,"--home","r",gefallenA,Math.max(0,lpA),d.lpA],["b",d.b,gastX,"--away","l",gefallenB,Math.max(0,lpB),d.lpB]].forEach(([seite,name,x0,farbVar,blick,gefallen,lp,lpMax])=>{
    const c=css(farbVar);
    let x=x0, reihe="walk_"+blick, bild=Math.floor(uhr*9)%9, alpha=1;
    if(p>=1){ reihe="idle_"+blick; bild=0; }
    if(aktiver&&aktiver.von===seite){
      const q=(uhr-aktiver.beginn)/0.55; const n=ATLAS?ATLAS.figuren[name].bilder["atk_"+blick]:6;
      if(q<1){ reihe="atk_"+blick; bild=Math.floor(q*n); x+= (seite==="a"?1:-1)*Math.sin(Math.PI*q)*26; }
    }
    if(letzterTreffer&&letzterTreffer.von!==seite&&uhr-letzterTreffer.treffer<0.22&&!gefallen){ alpha=Math.floor((uhr-letzterTreffer.treffer)/0.055)%2?0.35:1; }
    if(gefallen){ reihe="hurt_"+blick; bild=0; alpha=0.92; }
    ctx.fillStyle=c;ctx.globalAlpha=0.22;ctx.beginPath();ctx.ellipse(x,y+22,26,9,0,0,6.3);ctx.fill();ctx.globalAlpha=1;
    zeichneFigur(name,x,y,reihe,bild,alpha);
    ctx.textAlign="center";ctx.textBaseline="middle";
    schrift(name.length>16?name.slice(0,15)+"…":name,x0,y+78,c,11);
    schrift(gefallen?"gefallen":"LP "+lp+" / "+lpMax,x0,y+92,gefallen?css("--crit"):"#8a93a3",8.5);
    // Schadenszahl, die aufsteigt (0,7 s), an der Spalte des Getroffenen.
    d.schlaege.filter(s=>s.von!==seite&&uhr>=s.treffer&&uhr<s.treffer+0.7).forEach(s=>{
      const q=(uhr-s.treffer)/0.7;
      ctx.globalAlpha=1-q;
      schrift("−"+s.schaden,x0,y-70-q*34,s.von==="a"?css("--home"):css("--away"),22,"700","'Barlow Condensed',sans-serif");
      ctx.globalAlpha=1;
    });
  });

  // TEXTKARTE auf fester Hoehe, in der Luecke ZWISCHEN den beiden Figuren (bei
  // zeichneHeben steht sie in der Spalte des aktiven Hebers; hier stuende sie dort einer
  // grossen Figur wie Krag'Zul im Kopf, deshalb die Mitte). Das Fall-Banner darunter bei
  // H*0.80 — unter den Namenszeilen, ueber der Paar-Leiste.
  const kopfZeileY=H*0.31, fallZeileY=H*0.80;
  ctx.textAlign="center";ctx.textBaseline="middle";
  if(letzterTreffer){
    const nr=d.schlaege.indexOf(letzterTreffer)+1;
    ctx.font="700 15px 'Barlow Condensed',sans-serif";ctx.lineWidth=3;ctx.strokeStyle="rgba(8,10,14,.85)";
    const wort=letzterTreffer.letzter?"✗ fällt":"✓ Treffer";
    ctx.strokeText(wort,W/2,kopfZeileY); ctx.fillStyle=letzterTreffer.letzter?css("--crit"):css("--ok"); ctx.fillText(wort,W/2,kopfZeileY);
    ctx.font="400 10px 'IBM Plex Mono',monospace";ctx.fillStyle="#8a93a3";
    ctx.fillText("Schlag "+nr+" von "+d.schlaege.length,W/2,kopfZeileY+15);
    ctx.fillText(vorname(letzterTreffer.von==="a"?d.a:d.b)+" trifft",W/2,kopfZeileY+28);
    if(uhr>=d.fall){
      const S=d.sieger==="a"?d.a:d.b, V=d.sieger==="a"?d.b:d.a;
      const txt="★ "+V.toUpperCase()+" FÄLLT — DUELL AN "+S.toUpperCase();
      ctx.font="700 13px 'Barlow Condensed',sans-serif";ctx.lineWidth=2.5;ctx.strokeStyle="rgba(8,10,14,.9)";
      ctx.strokeText(txt,W/2,fallZeileY); ctx.fillStyle=d.sieger==="a"?"#f2d75a":css("--crit"); ctx.fillText(txt,W/2,fallZeileY);
    }
  }else{
    ctx.font="400 11px 'IBM Plex Mono',monospace";ctx.fillStyle="#8a93a3";
    ctx.fillText(p<1?"Einmarsch …":"Erster Schlag folgt …",W/2,kopfZeileY);
  }

  // WARTENDE / ERLEDIGTE PAARE am unteren Rand, wie in zeichneHeben.
  const paare=Z.duelle.filter(x=>x!==d);
  const ry=H*0.90, spanne=W-240;
  paare.forEach((q,i)=>{
    const rx=120+spanne*(paare.length>1?i/(paare.length-1):0.5);
    const fertig=uhr>=q.fall, kommt=uhr<q.start;
    ctx.font="400 8.5px 'IBM Plex Mono',monospace"; ctx.fillStyle=fertig?"#8a93a3":"#c7ccd6";
    ctx.fillText(q.nr+". "+vorname(q.a)+" – "+vorname(q.b),rx,ry);
    ctx.font="400 8px 'IBM Plex Mono',monospace";
    ctx.fillStyle=fertig?css(q.sieger==="a"?"--home":"--away"):"#5f6675";
    ctx.fillText(kommt?"wartet":fertig?("1:0 für "+vorname(q.sieger==="a"?q.a:q.b)):"läuft",rx,ry+11);
  });
}

// ---------------------------------------------------------------- 6. Callout (Vorbild callout())
// Dasselbe DOM-Element, dieselbe Klasse, dieselbe Dauer (2,6 s) wie in
// battle-mode.engine.js — nur getaktet von der Drehbuch-Uhr statt von setTimeout, damit
// ein Sprung auf der Zeitachse (setzeUhr) dasselbe Bild liefert wie das Abspielen.
const CALLOUT_DAUER_MS=2600;
let calloutAktiv=null;
function callout(txt,caption){
  const banner=document.getElementById("bbugcallout");
  if(!banner)return;
  banner.textContent="";
  banner.appendChild(document.createTextNode(txt));
  if(caption){ const em=document.createElement("em"); em.textContent=caption; banner.appendChild(em); }
  banner.hidden=false; banner.classList.remove("zu"); void banner.offsetWidth; banner.classList.add("zu");
}
function calloutAus(){ const b=document.getElementById("bbugcallout"); if(!b)return; b.classList.remove("zu"); b.hidden=true; }
function aktualisiereCallout(Z,uhr){
  const c=Z?[...Z.callouts].reverse().find(x=>uhr>=x.t&&uhr<x.t+CALLOUT_DAUER_MS/1000):null;
  if(c!==calloutAktiv){ calloutAktiv=c; if(c)callout(c.txt,c.caption); else calloutAus(); }
}

// ---------------------------------------------------------------- 7. HUD, Feed, Endstand
const el=(tag,cls,txt)=>{const e=document.createElement(tag); if(cls)e.className=cls; if(txt!=null)e.textContent=txt; return e;};
const mmss=(s)=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
let feedBis=0;
function aktualisiereHud(Z,uhr){
  const d=Z.duelle.find(x=>uhr>=x.start&&uhr<x.ende)||Z.duelle[Z.duelle.length-1];
  const idx=Z.duelle.indexOf(d);
  const stand=uhr>=d.fall?d.stand:(idx>0?Z.duelle[idx-1].stand:[0,0]);
  document.getElementById("score").textContent=stand[0]+" : "+stand[1];
  document.getElementById("clock").textContent=mmss(uhr);
  document.getElementById("phase").textContent=uhr>=Z.dauer?"Ende":d.titel;
  document.getElementById("aliveL").textContent=String(6-stand[1]);
  document.getElementById("aliveR").textContent=String(6-stand[0]);
  const bug=document.getElementById("fokusbug"); bug.hidden=false;
  const fuelle=(id,name,lp,lpMax)=>{
    const box=document.getElementById(id); if(box.dataset.name===name)return;
    box.dataset.name=name; box.textContent="";
    const im=el("img"); im.src="../portraits/"+ALLE[name].slug+".jpg"; im.alt=""; box.appendChild(im);
    const t=el("div"); t.appendChild(el("b",null,name)); t.appendChild(el("small",null,ALLE[name].c+" · "+PERS_LABEL[ALLE[name].pers])); box.appendChild(t);
  };
  fuelle("fokusL",d.a); fuelle("fokusR",d.b);
  // Feed: Ereignisse bis zur Uhr, einmal angehaengt.
  const feed=document.getElementById("feed");
  const alle=[...Z.ereignisse,...Z.callouts.map(c=>({t:c.t,art:"callout",c}))].sort((x,y)=>x.t-y.t);
  while(feedBis<alle.length&&alle[feedBis].t<=uhr){
    const e=alle[feedBis++]; const z=el("div");
    z.appendChild(el("span","tk",mmss(e.t)));
    if(e.art==="start")z.appendChild(el("span",null,e.d.titel+": "+e.d.a+" gegen "+e.d.b));
    else if(e.art==="fall"){ const S=e.d.sieger==="a"?e.d.a:e.d.b, V=e.d.sieger==="a"?e.d.b:e.d.a; z.appendChild(el("span",e.d.sieger==="a"?"h":"a",V+" fällt — "+S+" gewinnt das Duell ("+e.d.stand[0]+":"+e.d.stand[1]+")")); }
    else z.appendChild(el("span","big",e.c.txt));
    feed.appendChild(z); feed.scrollTop=feed.scrollHeight;
  }
}
function zeigeEndstand(D,Z){
  const es=document.getElementById("endstand"); es.hidden=false;
  document.getElementById("esieger").textContent=(D.sieg?"SIEG ":"NIEDERLAGE ")+D.stand[0]+":"+D.stand[1]+" — zählt für Spieltag 7";
  document.getElementById("endzeile").textContent=D.fazit;
  const l=document.getElementById("ehlist"); l.textContent="";
  Z.callouts.forEach(c=>{ const z=el("div","ehzeile"); z.appendChild(el("span","eht",mmss(c.t))); z.appendChild(el("span",null,c.txt)); l.appendChild(z); });
  document.getElementById("ehighlights").hidden=false;
}

// ---------------------------------------------------------------- 8. Abspielen
let D=null, Z=null, uhr=0, laeuft=false, letzterFrame=null, manuell=false;
function frame(ts){
  if(letzterFrame!=null&&laeuft&&!manuell)uhr=Math.min(Z.dauer,uhr+Math.min(0.05,(ts-letzterFrame)/1000));
  letzterFrame=ts;
  zeichneBuehne(Z,uhr); aktualisiereCallout(Z,uhr); if(Z)aktualisiereHud(Z,uhr);
  if(Z&&uhr>=Z.dauer&&laeuft){ laeuft=false; zeigeEndstand(D,Z); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function starteAufloesung(){
  D=baueDrehbuch(A); Z=baueZeitachse(D);
  document.getElementById("drehbuchSchluessel").textContent="Drehbuch-Schlüssel: "+D.schluessel;
  document.getElementById("feed").textContent=""; feedBis=0; uhr=0; laeuft=false;
  document.getElementById("endstand").hidden=true; document.getElementById("ehighlights").hidden=true;
  document.getElementById("fokusL").dataset.name=""; document.getElementById("fokusR").dataset.name="";
  document.getElementById("arena").hidden=false;
  const einlauf=document.getElementById("einlauf"); einlauf.hidden=false;
  document.getElementById("einlaufZeile").textContent="Duell 1: "+D.duelle[0].a+" gegen "+D.duelle[0].b+" — die Auflösung beginnt …";
  document.getElementById("arena").scrollIntoView({behavior:"smooth",block:"start"});
  clearTimeout(starteAufloesung._t);
  // Im manuellen Modus (Pruef-Schnittstelle) bleibt der Einlauf stehen, bis setzeUhr() ihn wegnimmt.
  if(!manuell)starteAufloesung._t=setTimeout(()=>{ einlauf.hidden=true; laeuft=true; },1600);
}

// ---------------------------------------------------------------- 9. Aufstellungstafel (DOM)
function renderTafel(){
  const tafel=document.getElementById("tafel"); tafel.textContent="";
  const frame=document.getElementById("aufstellungFrame"); frame.classList.toggle("db-versiegelt",versiegelt);
  const reihen=el("div","db-reihen");
  REIHEN.forEach(([k,label,text])=>{
    const r=el("div","db-reihe");
    const kopf=el("div","db-reihenkopf"); kopf.appendChild(el("b",null,label)); kopf.appendChild(el("span",null,text)); r.appendChild(kopf);
    ["L","R"].forEach(seite=>{
      const slot=k+seite, name=A.slots[slot], u=ALLE[name];
      const card=el("div","db-slot"+(gewaehlt===slot?" sel":"")); card.dataset.slot=slot;
      const im=el("img","db-portrait"); im.src="../portraits/"+u.slug+".jpg"; im.alt=name; card.appendChild(im);
      const body=el("div");
      const sk=el("div","db-slotkopf"); sk.appendChild(el("b",null,name)); sk.appendChild(el("i",null,seite==="L"?"links":"rechts")); body.appendChild(sk);
      const meta=el("div","db-slotmeta"); meta.appendChild(document.createTextNode(u.c+" · "+u.r+" · Eignung TDM ")); meta.appendChild(el("em",null,u.eig.toFixed(0))); body.appendChild(meta);
      body.appendChild(el("span","db-pers",PERS_LABEL[u.pers]));
      const w1=el("div","db-wahl"); w1.appendChild(el("b",null,"BEFEHL"));
      const s1=el("select"); BEFEHLE.forEach(([v,l])=>{const o=el("option",null,l); o.value=v; if((A.befehl[name]||"mitlinie")===v)o.selected=true; s1.appendChild(o);});
      s1.disabled=versiegelt; s1.addEventListener("change",()=>{A.befehl[name]=s1.value;}); s1.addEventListener("click",e=>e.stopPropagation());
      w1.appendChild(s1); body.appendChild(w1);
      const w2=el("div","db-wahl"); w2.appendChild(el("b",null,"ZIEL"));
      const s2=el("select"); const o0=el("option",null,"— keine Ansage"); o0.value=""; s2.appendChild(o0);
      GAST.forEach(g=>{const o=el("option",null,g.n+" ("+PERS_LABEL[g.pers]+")"); o.value=g.n; if(A.ziel[name]===g.n)o.selected=true; s2.appendChild(o);});
      s2.disabled=versiegelt; s2.addEventListener("change",()=>{ if(s2.value)A.ziel[name]=s2.value; else delete A.ziel[name]; }); s2.addEventListener("click",e=>e.stopPropagation());
      w2.appendChild(s2); body.appendChild(w2);
      card.appendChild(body);
      card.addEventListener("click",()=>{
        if(versiegelt)return;
        if(gewaehlt===null){gewaehlt=slot;}
        else if(gewaehlt===slot){gewaehlt=null;}
        else{ const a=A.slots[gewaehlt]; A.slots[gewaehlt]=A.slots[slot]; A.slots[slot]=a; gewaehlt=null; }
        renderTafel();
      });
      r.appendChild(card);
    });
    reihen.appendChild(r);
  });
  tafel.appendChild(reihen);
  const btn=document.getElementById("abgeben");
  btn.disabled=versiegelt; btn.textContent=versiegelt?"Abgegeben ✓ — versiegelt für Spieltag 7":"Aufstellung abgeben";
  document.getElementById("hinweis").firstElementChild.innerHTML=gewaehlt
    ?"<b>"+A.slots[gewaehlt]+"</b> gewählt — zweiten Slot anklicken, um zu tauschen."
    :"Ihre schnellen Leute laufen um deine Front herum — <b>links</b>, sagt der Scout. Wer deckt hinten links?";
}
function renderGegner(){
  const box=document.getElementById("gegner"); box.textContent="";
  ["Front","Mitte","Hinten"].forEach(reihe=>{
    box.appendChild(el("div","db-gegnerreihe",reihe));
    GAST.filter(g=>g.reihe===reihe).forEach(g=>{
      const card=el("div","db-slot gegner");
      const im=el("img","db-portrait"); im.src="../portraits/"+g.slug+".jpg"; im.alt=g.n; card.appendChild(im);
      const body=el("div");
      const sk=el("div","db-slotkopf"); sk.appendChild(el("b",null,g.n)); body.appendChild(sk);
      const meta=el("div","db-slotmeta"); meta.appendChild(document.createTextNode(g.c+" · "+g.r+" · Eignung ")); meta.appendChild(el("em",null,g.eig.toFixed(0))); body.appendChild(meta);
      body.appendChild(el("span","db-pers",PERS_LABEL[g.pers]));
      body.appendChild(el("div","db-ziel","erwartet: "+g.befehl));
      card.appendChild(body); box.appendChild(card);
    });
  });
}

// ---------------------------------------------------------------- 10. Knoepfe
document.getElementById("abgeben").addEventListener("click",()=>{ if(versiegelt)return; versiegelt=true; gewaehlt=null; renderTafel(); starteAufloesung(); });
document.querySelectorAll("[data-vorgabe]").forEach(b=>b.addEventListener("click",()=>{ if(versiegelt)return; A=kopie(VORGABEN[b.dataset.vorgabe]); gewaehlt=null; renderTafel(); }));
const zurueck=()=>{ versiegelt=false; laeuft=false; Z=null; D=null; calloutAus(); document.getElementById("arena").hidden=true; document.getElementById("fokusbug").hidden=true; renderTafel(); document.getElementById("aufstellung").scrollIntoView({behavior:"smooth",block:"start"}); };
document.getElementById("zurueck").addEventListener("click",zurueck);
document.getElementById("zurueck2").addEventListener("click",zurueck);
document.getElementById("nochmal").addEventListener("click",()=>starteAufloesung());
document.getElementById("pause").addEventListener("click",()=>{ if(!Z)return; laeuft=!laeuft; document.getElementById("pause").textContent=laeuft?"Pause":"Weiter"; });
document.getElementById("weiter").addEventListener("click",()=>{ if(!Z)return; const n=Z.duelle.find(x=>x.start>uhr+0.01); uhr=n?n.start:Z.dauer; laeuft=true; });

renderTafel(); renderGegner();

// ---------------------------------------------------------------- 11. Pruef-Schnittstelle
// Fuer Playwright-Screenshots und die Nachpruefung "andere Aufstellung, andere Enthuellung":
// rein lesend/steuernd, kein zweiter Weg ins Drehbuch.
window.__drehbuch={
  vorgabe:(k)=>{ if(versiegelt)zurueck(); A=kopie(VORGABEN[k]); gewaehlt=null; renderTafel(); },
  setze:(patch)=>{ if(versiegelt)zurueck(); if(patch.slots)Object.assign(A.slots,patch.slots); if(patch.befehl)Object.assign(A.befehl,patch.befehl); if(patch.ziel)Object.assign(A.ziel,patch.ziel); renderTafel(); },
  aufstellung:()=>kopie(A),
  waehle:(slot)=>{ gewaehlt=slot; renderTafel(); },
  manuell:(an)=>{ manuell=!!an; },
  abgeben:()=>document.getElementById("abgeben").click(),
  setzeUhr:(s)=>{ if(!Z)return; uhr=Math.max(0,Math.min(Z.dauer,s)); laeuft=uhr<Z.dauer; document.getElementById("einlauf").hidden=true; },
  uhr:()=>uhr, dauer:()=>Z?Z.dauer:0, bereit:()=>!!Z,
  drehbuch:()=>D?{schluessel:D.schluessel,stand:D.stand,sieg:D.sieg,duelle:D.duelle.map(d=>({nr:d.nr,titel:d.titel,a:d.a,b:d.b,sieger:d.sieger==="a"?d.a:d.b,ansage:d.ansage&&d.ansage.txt,fazit:d.fazit&&d.fazit.txt}))}:null,
  zeitachse:()=>Z?Z.duelle.map(d=>({nr:d.nr,start:d.start,ankunft:d.ankunft,fall:d.fall,ende:d.ende})):null,
  callouts:()=>Z?Z.callouts.map(c=>({t:c.t,txt:c.txt})):null,
  probeAlle:()=>Object.fromEntries(Object.keys(VORGABEN).map(k=>{const d=baueDrehbuch(kopie(VORGABEN[k])); return [k,{schluessel:d.schluessel,stand:d.stand,sieg:d.sieg,callouts:d.duelle.flatMap(x=>[x.ansage&&x.ansage.txt,x.fazit&&x.fazit.txt]).filter(Boolean)}];})),
  bilderGeladen:()=>!!ATLAS&&Object.values(BILDER).every(im=>im.complete&&im.naturalWidth>0),
};
})();
