"use strict";
/* GEMEINSAMER RAHMEN UND DATENMODELL DER MOCKUPS VOM 24.11. (Spieler, Teams, Spielplan).
   ECHT (daten.js, Live-Abbild 24.11.): Teams, Liga, Kasse, Identitaet, GM, Vorstand, Sponsor, Tabelle, Ziele, Kapitaen, Kader,
     Spieler (Werte, Eignung, Attribute, Traits, Marktwert, Gehalt, Vertrag, Kaufpreis), Player Points und Einsaetze (C2-Skala),
     Form, Moral, Verletzungen, Belastung, Spielplan (Paarungen, Heim/Auswaerts, Disziplinen, Plaetze), Ergebnisse (E1), Transfers.
   BEISPIEL (im UI als "Beispiel" markiert): Scouting-Stand, Trainingsvorlieben, Trainingsziel, Entwicklung, Werbewert,
     Fans, Arena-Plaetze und Ticket-Einnahmen, Beziehungen zwischen Teams.
   Kein App-Code, Schriften lokal, 0 PixelLab-Generationen. */
var q=new URLSearchParams(location.search);
var $=function(id){return document.getElementById(id)};
function de(x,nk){return Number(x).toFixed(nk==null?1:nk).replace(".",",")}
function vz(x,nk){return (x>0?"+":x<0?"−":"±")+de(Math.abs(x),nk)}
function C(x,nk){return (x<0?"−":"")+de(Math.abs(x),nk)+" C"}
function tsd(x){return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g,".")}
function logo(c,cls){return '<img class="wap '+(cls||"")+'" src="../team-logos/'+c+'.jpg" alt="">'}
function ic(n){return '<svg class="i"><use href="#i-'+n+'"/></svg>'}
function zufall(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(s){var h=7;for(var i=0;i<s.length;i++)h=Math.imul(h,31)+s.charCodeAt(i)|0;return h}
function kl(x,a,b){return Math.max(a,Math.min(b,x))}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;")}
function moralFarbe(w){var R=[255,96,88],B=[243,181,74],G=[98,211,148],a=w<50?R:B,b=w<50?B:G,t=w<50?w/50:(w-50)/50;return "rgb("+[0,1,2].map(function(i){return Math.round(a[i]+(b[i]-a[i])*t)}).join(",")+")"}
/* Moral-Gesicht: Stufen wie BcMoralGesicht (80/60/40/20), Farbe gruen bis rot */
var MORALSTUFE=[[80,"sehr zufrieden"],[60,"zufrieden"],[40,"neutral"],[20,"unzufrieden"],[0,"verärgert"]];
function moralWort(w){for(var i=0;i<5;i++)if(w>=MORALSTUFE[i][0])return MORALSTUFE[i][1]}
function gesicht(w){var m=Math.max(-1,Math.min(1,(w-50)/50)),f=moralFarbe(w),y=15+m*-1.2,c=y+m*4.2;
  return '<svg class="ges" viewBox="0 0 24 24" aria-label="Moral '+w+'"><circle cx="12" cy="12" r="10" fill="'+f+'" fill-opacity=".16" stroke="'+f+'" stroke-width="2"/><circle cx="8.6" cy="9.6" r="1.3" fill="'+f+'"/><circle cx="15.4" cy="9.6" r="1.3" fill="'+f+'"/><path d="M7.6 '+y.toFixed(1)+' Q12 '+c.toFixed(1)+' 16.4 '+y.toFixed(1)+'" fill="none" stroke="'+f+'" stroke-width="2" stroke-linecap="round"/></svg>'}

/* ---------- Stammdaten ---------- */
var DN=[["TDM","tdm","basis","TDM"],["Mini DM","mini-dm","basis","MiniDM"],["Battlefield","battlefield","eroberung","Battlefield"],["Gewichtheben","gewichtheben","hafen","Gewichtheben"],["Climbing","climbing","fels","Climbing"],["Staffel","staffel","arena","Staffel"],["Time Trial","time-trial","abfahrt-kamm","Time Trial"],["Spurt","spurt","kurs","Spurt"],["Tennis","tennis","court","Tennis"],["Hockey","hockey","eis","Hockey"],["Showcase","showcase","buehne","Showcase"],["Speed-Schach","speed-schach","park","Schach"],["Takeshi",null,null,"Takeshi"],["Breaking","breaking","standard","Breaking Point"],["Wettessen","wettessen","bierzelt","Wettessen"],["Basketball","basketball","parkett","Basketball"],["Football","football","feld","Football"],["Eiskunstlauf","eiskunstlauf","kuer","Eiskunst"],["Fechten","fechten","piste","Fechten"],["I-Spy","i-spy","aztec","I Spy"]];
var DK=["TDM","MDM","BF","GEW","CLI","STA","TT","SPU","TEN","HOC","SHO","SCH","TAK","BRK","WET","BAS","FOO","EIS","FEC","SPY"];
var AN=["Power","Health","Determination","Stamina","Speed","Dexterity","Awareness","Intelligence","Will","Charisma","Spirit","Torment"];
var AK=["POW","HEA","DET","STA","SPD","DEX","AWA","INT","WIL","CHA","SPI","TOR"];
var AX=["POW","SPE","MEN","SOC"],AXN=["Power","Speed","Mental","Social"],AXF=["var(--pow)","var(--spe)","var(--men)","var(--soc)"];
/* Achse je Disziplin (lib/data/dataAdapter.ts, category) und Vierergruppen (VIERER_POD_DISCIPLINE_IDS) */
var DA=[0,0,3,0,1,1,1,1,2,0,3,2,2,0,2,3,3,3,1,2],POD={1:1,2:1,5:1,12:1};
var KLF={Berserker:0,Warlord:0,Tank:0,Sprinter:1,Rogue:1,Charger:1,Mage:2,Overseer:2,Templar:2,Bard:3,Hero:3,Badass:3,Tactician:3};
var GEGEN=[2,3,0,1];
var GM={"bargain-hunter":["Schnäppchenjäger","Kauft unter Marktwert und verkauft mit Gewinn."],"culture-keeper":["Kulturbewahrer","Schützt Teamchemie, Zufriedenheit und langfristige Bindung stärker als reine Tabellenarithmetik."],"depth-spammer":["Kadertiefe-Fan","Großer Kader, viele brauchbare Spieler statt weniger Stars."],"elite-curator":["Elite-Kurator","Wenige, sehr gute Spieler; verlängert früh."],"facility-architect":["Ausbau-Architekt","Steckt Geld zuerst in Gebäude und Training."],"risk-gambler":["Risiko-Spieler","Setzt auf Potenzial und hält wenig Rücklage."],"rivalry-hawk":["Rivalen-Jäger","Richtet Käufe und Aufstellung an den direkten Gegnern aus."],"star-chaser":["Star-Jäger","Zahlt für große Namen und nimmt einen dünnen Kader in Kauf."],"systems-tinkerer":["System-Tüftler","Sucht Spieler für einzelne Disziplinen und Rollen."],"talent-builder":["Talent-Entwickler","Junge Spieler mit Potenzial, lange Verträge."]};
var RAR={"gewöhnlich":"#9aa7ba","gewoehnlich":"#9aa7ba","selten":"#62a6ec","magisch":"#b78cf0","episch":"#f0c35a","legendär":"#ff8a4c","legendaer":"#ff8a4c"};
var MENSCH={user_local:"Chris",franky_local:"Franky",ramona_local:"Ramona"};
function kul(i){var d=DN[i];return d[1]?"../sprites/kulissen/"+d[1]+"/"+d[2]+".jpg":"../sprites/kulissen/showcase/zirkus.jpg"}
function dIcon(i){return '<img class="dic" src="../discipline-icons/'+encodeURIComponent(DN[i][3])+'.png" alt="">'}

/* ---------- Modell ---------- */
var HEUTE=ECHT.heute,GEWERTET=HEUTE-1,SAISON="season-1",ST_SAISON=20;
var NEBEL_AUS=q.get("nebel")==="aus";
var ALLE={},SP=[];
ECHT.P.forEach(function(r){
  var p={n:r[0],s:r[1],kl:r[2],ra:r[3],ov:r[4],pot:r[5],mw:r[6],dem:r[7],ax:r[8],d:r[9],at:r[10],tp:r[11],tn:r[12],fig:r[13],tc:r[14],geh:r[15],rest:r[16],kauf:r[18],
    pps:r[19],eins:r[20],form:r[21],moral:r[22]==null?50:r[22],vs:r[23],vbis:r[24],bel:r[25],fv:r[26],ppmax:r[27],vform:r[28],topd:r[29],mgr:r[30],team:null};
  var z=zufall(hash(p.s||p.n));
  p.kf=KLF[p.kl]==null?3:KLF[p.kl];p.hax=p.ax.indexOf(Math.max.apply(null,p.ax));
  p.frei=!p.tc;p.ppe=p.eins?p.pps/p.eins:0;
  var top=p.d.map(function(v,i){return [v,i]}).sort(function(a,b){return b[0]-a[0]});p.best=top[0][1];p.top3=top.slice(0,3).map(function(x){return x[1]});
  p.verl=p.vs===2?Math.max(1,p.vbis-HEUTE+1):0;
  p.fs=p.form>=62?2:p.form>=55?1:p.form<=38?-2:p.form<=45?-1:0;
  var s=z();p.sc=s<.18?2:s<.48?1:0;
  /* BEISPIEL: Trainingsvorlieben (2 Lieblinge, 1 ungeliebt; je Saison neu, leichte Tendenz zur eigenen bzw. Gegenfarbe) */
  var zz=zufall(hash((p.s||p.n)+SAISON)),eig=[],geg=[],rest=[];for(var i=0;i<20;i++)(DA[i]===p.kf?eig:DA[i]===GEGEN[p.kf]?geg:rest).push(i);
  function zieh(bev,ohne){var l=(zz()<.45?bev:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19]).filter(function(x){return ohne.indexOf(x)<0});return l[Math.floor(zz()*l.length)]}
  var l1=zieh(eig,[]),l2=zieh(eig,[l1]);p.lieb=[l1,l2];p.unlieb=zieh(geg,[l1,l2]);
  p.ziel=p.frei?null:p.top3[Math.floor(zz()*3)];
  p.zart=p.ziel==null?0:p.lieb.indexOf(p.ziel)>=0?1:p.unlieb===p.ziel?-1:0;
  /* BEISPIEL: Entwicklung der Saison in OVR-Punkten (Zielverteilung 10/20/40/20/10 aus CLAUDE.md) */
  var e=zz(),g=zz();p.dev=p.frei?0:e<.04?6+g*2:e<.10?3+g*3:e<.30?1+g*2:e<.70?-1+g*2:e<.90?-3+g*2:e<.96?-6+g*3:-8+g*2;p.dev=Math.round(p.dev*10)/10;
  /* BEISPIEL: Werbewert 0..100 (Charisma, Leistung, Zufall) und Werbegeld je Saison */
  p.werb=Math.round(kl(p.at[9]*.45+p.ppe*9+p.ov*.25+zz()*14-8,3,99));p.wgeld=p.frei?0:Math.round(p.werb*p.werb/100*.035*10)/10;
  p.wert=p.kauf?Math.round((p.mw-p.kauf)*10)/10:0;
  ALLE[p.s||p.n]=p;SP.push(p)});
var TEAMS=ECHT.T.map(function(t){var g=t.gm.replace(/^gm-/,"").replace(/-\d+$/,"");
  var T={c:t.c,n:t.n,liga:t.liga,cash:t.cash,budget:t.budget,mensch:t.mensch,owner:t.owner,id:t.id,opt:t.opt,min:t.min,gm:g,gmInf:t.gmInf,board:t.board,druck:t.druck,sp:t.sp,st:t.st,obj:t.obj,thema:t.thema,lore:t.lore,kauf:t.kauf,verkauf:t.verkauf,vertrag:t.vertrag,kaderstil:t.kaderstil,kap:t.kap,K:[]};
  return T});
var TC={};TEAMS.forEach(function(t){TC[t.c]=t});
SP.forEach(function(p){if(p.tc){p.team=TC[p.tc];p.team.K.push(p)}});
/* aktives Team = activeManagerTeamId des angemeldeten Managers; ?ich=<Kuerzel> spielt einen zweiten Menschen durch */
var ICH=TC[q.get("ich")]||TC["D-P"];
if(q.get("ich")&&ICH.c!=="D-P"){ICH.mensch=true;ICH.owner=q.get("wer")==="ramona"?"ramona_local":"franky_local"}
ICH.K.forEach(function(p){p.sc=2});
(ECHT.merk||[]).forEach(function(s){if(ALLE[s])ALLE[s].stern=true});
SP.forEach(function(p,i){if(!p.stern&&p.team!==ICH&&i%37===5)p.stern=true});

/* ---------- Scouting-Nebel: feste Stufen, Sortieren und Filtern rechnen mit der Stufe ---------- */
function exakt(p){return NEBEL_AUS||p.team===ICH||p.sc>=2}
function ber(v,p,w){if(exakt(p))return null;w=w||(p.sc===1?5:10);var lo=Math.floor(v/w)*w;return [lo,lo+w]}
function zt(v,p){var b=ber(v,p);return b?b[0]+"–"+b[1]:String(Math.round(v))}
function zg(v,p,cls){var b=ber(v,p);return b?'<span class="nb t" title="Scouting-Nebel: feste Stufe">'+b[0]+'–'+b[1]+'</span>':'<b class="t '+(cls||"")+'">'+Math.round(v)+'</b>'}
function sw(v,p){var b=ber(v,p);return b?(b[0]+b[1])/2:v}
function scWort(p){return p.team===ICH?"dein Kader":p.sc===2?"gescoutet":p.sc===1?"beobachtet":"unbekannt"}
/* Gehalt: je Saison (gross) und je Spieltag (klein). Fremde Spieler unter Vertrag: Stufe; freie Spieler: Forderung exakt (sie ist der Preis) */
function gehS(p){return p.frei?p.dem:p.geh}
function gehStufe(p){if(exakt(p)||p.frei)return null;var g=gehS(p),lo=Math.floor(g/4)*4;return [lo,lo+4]}
function gehalt(p){var b=gehStufe(p),g=gehS(p);return b?'<span class="gh"><span class="nb t">'+b[0]+'–'+b[1]+'</span><small>'+de(b[0]/ST_SAISON,1)+'–'+de(b[1]/ST_SAISON,1)+' je ST</small></span>':'<span class="gh"><b class="t">'+de(g)+'</b><small>'+de(g/ST_SAISON,2)+' je ST</small></span>'}
function gehSort(p){var b=gehStufe(p);return b?(b[0]+b[1])/2:gehS(p)}
function pfeil(s){return '<span class="pfeil s'+s+'">'+({"2":"▲▲","1":"▲","0":"–","-1":"▼","-2":"▼▼"})[s]+'</span>'}
function formZ(p){return '<span class="fz" title="Form '+p.form+' (Mitte 50). Öffentlich.">'+pfeil(p.fs)+'<b class="t">'+p.form+'</b></span>'}
function moralZ(p){if(p.frei)return '<span class="zu" title="Freie Spieler haben keine Team-Moral">–</span>';if(!exakt(p)&&p.sc===0)return '<span class="mo null" title="Unbekannter Spieler: Moral erst nach Beobachtung">?</span>';
  return '<span class="mo" style="color:'+moralFarbe(p.moral)+'" title="Moral: '+moralWort(p.moral)+'">'+gesicht(p.moral)+(exakt(p)?'<b class="t">'+p.moral+'</b>':'')+'</span>'}
function moralSort(p){return !exakt(p)&&p.sc===0?-1:exakt(p)?p.moral:Math.floor(p.moral/20)*20}
function klasse(p,kurz){return '<span class="kt k'+p.kf+'" title="'+p.kl+' · Klassenfarbe '+AX[p.kf]+'"><img src="../class-icons/'+p.kl+'.png" alt="">'+(kurz?"":p.kl)+'</span>'}
function rasse(p,mitName){return '<span class="rs" title="'+p.ra+'"><img src="../race-icons/'+p.ra+'.png" alt="" onerror="this.remove()">'+(mitName?p.ra:"")+'</span>'}
function por(p,cls){if(!p.s)return '<span class="por leerb '+(cls||"")+'"></span>';return '<img class="por '+(cls||"")+'" src="../portraits/'+(p.s||"_")+'.jpg" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">'}
function figur(p,r){return p.fig?'<img class="fig" src="../sprites/figuren/'+p.s+'/'+(r||"south")+'.png" alt="">':por(p)}
function profilUrl(p){return "spielerprofil-modern-18-11.html?spieler="+p.s}
function dTag(i,zus){return '<span class="dt a'+DA[i]+'" title="'+DN[i][0]+" · "+AXN[DA[i]]+'">'+DK[i]+(zus||"")+'</span>'}
function status(p){return p.verl?'<span class="tag w" title="Verletzt: nicht einsetzbar, zählt nicht zur Kaderstärke">verletzt · '+p.verl+' ST</span>':p.bel>=60?'<span class="tag a" title="Belastung '+p.bel+': erhöhtes Verletzungsrisiko">müde</span>':'<span class="tag g">fit</span>'}

/* ---------- Kaderstaerke: Schnitt der besten 6 einsetzbaren Spieler je Disziplin ---------- */
function stark(l,d){var a=l.filter(function(p){return !p.verl}).map(function(p){return p.d[d]}).sort(function(x,y){return y-x}).slice(0,6);while(a.length<6)a.push(20);return a.reduce(function(s,x){return s+x},0)/6}
TEAMS.forEach(function(T){T.stk=DN.map(function(_,d){return stark(T.K,d)});T.ges=T.stk.reduce(function(a,b){return a+b},0)/20;
  T.gehalt=T.K.reduce(function(a,p){return a+p.geh},0);T.mwsum=T.K.reduce(function(a,p){return a+p.mw},0);T.verletzt=T.K.filter(function(p){return p.verl}).length;
  T.moral=Math.round(T.K.reduce(function(a,p){return a+p.moral},0)/Math.max(1,T.K.length));T.form=Math.round(T.K.reduce(function(a,p){return a+p.form},0)/Math.max(1,T.K.length));
  T.gescoutet=T.K.filter(function(p){return p.sc>=2}).length});
function liga(T){return TEAMS.filter(function(x){return x.liga===T.liga})}
function rang(T,d){return 1+liga(T).filter(function(x){return x.stk[d]>T.stk[d]}).length}
function rangGes(T){return 1+liga(T).filter(function(x){return x.ges>T.ges}).length}
function rang32(T){return 1+TEAMS.filter(function(x){return x.ges>T.ges}).length}
function teamExakt(T){return NEBEL_AUS||T===ICH||T.gescoutet===T.K.length}
/* fremdes Team: Rang exakt, Wert als grobe 10er-Stufe; exakt nur bei vollem Scouting (Entscheidung 18.11.) */
function stkT(T,v){if(teamExakt(T))return '<b class="t">'+de(v)+'</b>';var lo=Math.floor(v/10)*10;return '<span class="nb t" title="Fremdes Team: grobe Stufe, exakt erst bei vollem Scouting">'+lo+'–'+(lo+10)+'</span>'}
function kaderRang(p,d){return 1+p.team.K.filter(function(x){return !x.verl&&x.d[d]>p.d[d]}).length}
function stammIn(p){var n=0;for(var d=0;d<20;d++)if(!p.verl&&kaderRang(p,d)<=6)n++;return n}
function rolle(p){if(!p.team)return ["","frei"];var n=p.eins,kap=p.team.kap&&p.team.kap[0]===p.s;
  return [kap?"k":n>=8?"s":n>=4?"r":"e",kap?"Kapitän":n>=8?"Stamm":n>=4?"Rotation":"Ergänzung",n]}
function ligaSpieler(l){return SP.filter(function(p){return p.team&&p.team.liga===l})}
var PPR={};[1,2].forEach(function(l){ligaSpieler(l).sort(function(a,b){return b.pps-a.pps}).forEach(function(p,i){PPR[p.s]=i+1})});
SP.slice().sort(function(a,b){return b.pps-a.pps}).forEach(function(p,i){p.ppr32=i+1});
function ppRang(p){return PPR[p.s]||0}

/* ---------- Tabelle, Trend, Ergebnisse ---------- */
function erg(T,st,seite){var r=ECHT.RES[st-1];return r&&r[T.c]?r[T.c][seite]:null}
TEAMS.forEach(function(T){T.tag=[];T.verlauf=[];var s=0;for(var st=1;st<=GEWERTET;st++){var a=erg(T,st,0),b=erg(T,st,1),p=(a?a.p:0)+(b?b.p:0);T.tag.push(p);s+=p;T.verlauf.push(s)}
  T.suN=[0,0,0];for(st=1;st<=GEWERTET;st++)[0,1].forEach(function(k){var e=erg(T,st,k);if(e)T.suN[e.p>=2?0:e.p===1?1:2]++})});
TEAMS.forEach(function(T){T.rangV=T.verlauf.map(function(v,i){return 1+liga(T).filter(function(x){return x.verlauf[i]>v}).length})});
function trend(T,n){return '<span class="fm">'+T.tag.slice(-(n||5)).map(function(p){return '<i class="'+(p>=3?"":p===2?"u":"n")+'" title="'+p+' von 4 Punkten"></i>'}).join("")+'</span>'}
function heim(T,st){var f=ECHT.FIX[st-1][String(T.liga)];for(var i=0;i<f.length;i++){if(f[i][0]===T.c)return [true,TC[f[i][1]]];if(f[i][1]===T.c)return [false,TC[f[i][0]]]}return [true,null]}
/* Medaillen-Kurs: Stand der Disziplin-Wertung je Liga aus den echten Ergebnissen (E1-Punkte bzw. Gruppenwert) */
var MED={};[1,2].forEach(function(l){MED[l]=DN.map(function(_,d){var w={};for(var st=1;st<=GEWERTET;st++)[0,1].forEach(function(k){if(ECHT.DIS[st-1][k*2]!==d)return;TEAMS.forEach(function(T){if(T.liga!==l)return;var e=erg(T,st,k);if(e)w[T.c]=(w[T.c]||0)+(e.pod?e.w:(e.e?e.e[0]:0))})});
  return Object.keys(w).map(function(c){return [c,w[c]]}).sort(function(a,b){return b[1]-a[1]||TC[a[0]].st.rank-TC[b[0]].st.rank})})});
function medRang(T,d){var l=MED[T.liga][d];for(var i=0;i<l.length;i++)if(l[i][0]===T.c)return i+1;return 0}
/* BEISPIEL: Fans, Arena, Tickets, Beziehungen (Arena-Regel gilt in diesem Spielstand erst ab Saison 2) */
TEAMS.forEach(function(T){var z=zufall(hash(T.c+"fans"));T.fans=Math.round((1800+T.id.popularity*520+z()*600)/100)*100;T.stimmung=Math.round(kl(38+T.id.popularity*2.2+(8.5-T.st.rank)*2.4+z()*8,12,97));
  var aus=Math.floor(T.id.finances/3.4+z()*1.2);T.arena={steh:3000+aus*1000,sitz:900+Math.floor(aus/2)*1000,loge:100+(aus>2?100:0)};T.plaetze=T.arena.steh+T.arena.sitz+T.arena.loge;
  T.auslast=Math.round(kl(T.fans/T.plaetze*100*(.55+T.stimmung/200),31,100));T.ticket=Math.round(T.plaetze*T.auslast/100*(T.liga===1?.00042:.00034)*10)/10;
  T.marke=Math.round(kl(T.id.popularity*7+T.stimmung*.3+(17-T.st.rank),5,99))});
function bez(A,B){if(A===B)return 0;var z=zufall(hash([A.c,B.c].sort().join("|")))(),v=Math.round((z-.5)*9+(A.id.cooperation+B.id.cooperation-10)*.35);if(A.liga===B.liga&&Math.abs(A.st.start-B.st.start)<=1)v-=4;return kl(v,-9,9)}
function bezTag(v){return v<=-4?'<span class="tag w">Rivale '+v+'</span>':v>=4?'<span class="tag g">verbündet +'+v+'</span>':'<span class="tag">neutral</span>'}
function werIst(T){return T.mensch?(MENSCH[T.owner]||"Mensch"):"KI"}

/* ---------- Sortieren: [Wert, Name]; im Nebel zaehlt die Stufe, bei Gleichstand der Name ---------- */
function sortiere(liste,wertFn,dir){return liste.slice().sort(function(a,b){var x=wertFn(a),y=wertFn(b);if(typeof x==="string"||typeof y==="string"){x=String(x);y=String(y);return dir*(x<y?-1:x>y?1:0)||(a.n<b.n?-1:1)}return dir*(x-y)||(a.n<b.n?-1:1)})}

/* ---------- Rahmen ---------- */
var IKONEN='<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/></symbol><symbol id="i-post" viewBox="0 0 24 24"><path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/></symbol><symbol id="i-liste" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></symbol><symbol id="i-arena" viewBox="0 0 24 24"><path d="M4 20L20 4M14 4h6v6M4 4l16 16M4 10V4h6"/></symbol><symbol id="i-tab" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol><symbol id="i-team" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="18" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/></symbol><symbol id="i-spieler" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7"/></symbol><symbol id="i-train" viewBox="0 0 24 24"><path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12"/></symbol><symbol id="i-bau" viewBox="0 0 24 24"><path d="M3 21V10l9-6 9 6v11M3 21h18M9 21v-7h6v7"/></symbol><symbol id="i-markt" viewBox="0 0 24 24"><path d="M4 8h14l-3-3M20 16H6l3 3"/></symbol><symbol id="i-scout" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/></symbol><symbol id="i-geld" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9c-1-1.5-5-1.5-5 .8 0 2.6 5 1.4 5 4.2 0 2.2-4.2 2.2-5.4.4M12 6v12"/></symbol><symbol id="i-pin" viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/></symbol><symbol id="i-r" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol><symbol id="i-l" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol><symbol id="i-karte" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></symbol><symbol id="i-rank" viewBox="0 0 24 24"><path d="M8 21V9h8v12M2 21v-7h6M16 21v-9h6v9M1 21h22"/></symbol><symbol id="i-kal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol><symbol id="i-buero" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 13h18"/></symbol><symbol id="i-flagge" viewBox="0 0 24 24"><path d="M5 21V4h13l-3 4 3 4H5"/></symbol><symbol id="i-glocke" viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0112 0v6l2 2H4zM10 21h4"/></symbol><symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol><symbol id="i-ton" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9c1.5 1.5 1.5 4.5 0 6"/></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></symbol><symbol id="i-rahmen" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/></symbol><symbol id="i-stern" viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/></symbol><symbol id="i-waage" viewBox="0 0 24 24"><path d="M12 4v16M6 20h12M4 8h16M4 8l-2 6h6zM20 8l-2 6h6z"/></symbol><symbol id="i-schloss" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></symbol><symbol id="i-kreuz" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol><symbol id="i-hist" viewBox="0 0 24 24"><path d="M4 12a8 8 0 108-8M4 5v4h4M12 8v5l3 2"/></symbol><symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol><symbol id="i-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></symbol><symbol id="i-haus" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/></symbol><symbol id="i-weg" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol><symbol id="i-herz" viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/></symbol><symbol id="i-pokal" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H3c0 3 2 5 4 5M17 6h4c0 3-2 5-4 5M12 14v4M8 20h8"/></symbol><symbol id="i-ticket" viewBox="0 0 24 24"><path d="M3 8a2 2 0 002-2h14a2 2 0 002 2v2a2 2 0 000 4v2a2 2 0 00-2 2H5a2 2 0 00-2-2v-2a2 2 0 000-4z"/></symbol></defs></svg>';
var RAHMEN={
  bau:function(o){
    var st=HEUTE,h=heim(ICH,st),still=q.get("still")==="1";
    document.body.classList.toggle("still",still);
    var nav=[["Spieltag"],["home","Home","oly-start-modern-18-11.html"],["post","Inbox","inbox-modern-21-11.html",2],["liste","Einsatzliste","einsatzliste-modern-17-11.html"],["arena","Arena","arena-spieltag-modern-18-11.html"],["tab","Saisonstand"],
      ["Team"],["team","Teams","teams-modern-24-11.html","","teams"],["spieler","Spieler","spieler-modern-24-11.html","","spieler"],["train","Training","training-modern-18-11.html"],["bau","Gebäude"],
      ["Markt"],["markt","Transfermarkt","transfermarkt-modern-18-11.html"],["scout","Scouting","scouting-modern-18-11.html"],["geld","Finanzen","finanzen-modern-18-11.html"],
      ["Welt"],["rank","Ranks","ranks-modern-22-11.html"],["kal","Spielplan","spielplan-modern-24-11.html","","spielplan"],["stern","Leaders","leaders-modern-22-11.html"]];
    var rail=nav.map(function(n){if(n.length===1)return '<div class="grp">'+n[0]+'</div>';
      return '<a'+(n[2]?' href="'+n[2]+(still?"?still=1":"")+'"':"")+(n[4]===o.seite?' class="an"':"")+'>'+ic(n[0])+(n[3]?'<span class="zahl">'+n[3]+'</span>':"")+'<span class="n">'+n[1]+'</span></a>'}).join("");
    var tk="";for(var i=1;i<=20;i++){var p=i<=GEWERTET?ICH.tag[i-1]:null;tk+='<i class="'+(i===st?"j":p==null?"":p>=3?"s":p===2?"u":"n")+'"></i>'}
    document.body.insertAdjacentHTML("afterbegin",IKONEN+
      '<div class="demo"><b>'+o.demoTitel+'</b>'+o.demo+'<i class="tr"></i><span>Aktiver Manager</span><span id="d-ich"></span><i class="tr"></i><span>Nebel</span><span id="d-nebel"></span><i class="tr"></i><span class="dh">Graue Leiste gehört nicht zum UI. '+(o.demoHinweis||"")+'</span></div>'+
      '<div class="app"><div class="railplatz"><nav class="rail" id="rail" aria-label="Hauptnavigation">'+
        '<div class="kopf"><span class="logo" title="Aktives Team wechseln (activeManagerTeamId)">'+logo(ICH.c)+'</span><span class="wer"><b>'+ICH.n+'</b><small>'+werIst(ICH)+' · '+ICH.st.rank+'. in Liga '+ICH.liga+' · Team wechseln ▾</small></span></div>'+rail+
        '<span class="luecke"></span><a>'+ic("buero")+'<span class="n">Office</span></a><a>'+ic("flagge")+'<span class="n">Fehler melden</span></a><a>'+ic("pin")+'<span class="n">Schiene anheften</span></a></nav></div>'+
      '<div class="rechts"><header class="band" id="band"><div class="bkul"><i id="bk1"></i><i id="bk2"></i></div>'+
        '<div class="ort" id="ort"><em id="b-krume"></em><h1 id="b-titel"></h1></div><nav class="reiter" id="b-reiter"></nav><div class="slot" id="b-slot"></div>'+
        '<div class="regie"><a class="chip" href="spielplan-modern-24-11.html" title="Spielplan"><span class="o">Saison 1 · Spieltag <b>'+st+'</b><span>/ 20</span></span><span class="tk">'+tk+'</span></a>'+
        '<a class="chip" title="Finanzen"><span class="o">Kasse</span><span class="o"><b class="'+(ICH.cash<0?"minus":"")+'">'+C(ICH.cash)+'</b></span></a>'+
        '<a class="ikn" title="Suche">'+ic("scout")+'<kbd>⌘K</kbd></a><a class="ikn" title="Meldungen">'+ic("glocke")+'<span class="zahl">2</span></a>'+
        '<div class="takt weiter"><button class="tb"><span class="fuell"></span><span>Einsatzliste setzen</span>'+ic("r")+'</button><button class="ts"><i></i><span>Spieltag '+st+' · '+(h[0]?"Heim gegen ":"Auswärts bei ")+'<b>'+(h[1]?h[1].n:"")+'</b></span></button></div></div><i class="lauf"></i></header>'+
      '<main class="buehne" id="buehne"></main></div></div><div class="meld" id="meld"></div>');
    function dl(par,wert,txt,an){var u=new URLSearchParams(location.search);if(wert==null)u.delete(par);else u.set(par,wert);return '<a class="'+(an?"an":"")+'" href="?'+u.toString()+'">'+txt+'</a>'}
    $("d-ich").innerHTML=dl("ich",null,"Chris · Death Peaches",ICH.c==="D-P")+" "+dl("ich","V-W","Franky · Vigilante Wranglers",ICH.c==="V-W");
    $("d-nebel").innerHTML=dl("nebel",null,"an",!NEBEL_AUS)+" "+dl("nebel","aus","aus (Einstellung)",NEBEL_AUS);
    RAHMEN.kulisse(o.kulisse==null?ECHT.DIS[st-1][0]:o.kulisse,o.kulisse2==null?ECHT.DIS[st-1][2]:o.kulisse2);
  },
  kulisse:function(a,b){$("bk1").style.backgroundImage="url("+kul(a)+")";$("bk2").style.backgroundImage="url("+kul(b)+")"},
  kopf:function(krume,titel,reiter,slot){$("b-krume").innerHTML=krume;$("b-titel").innerHTML=titel;$("b-reiter").innerHTML=reiter||"";$("b-slot").innerHTML=slot||""},
  link:function(aend){var u=new URLSearchParams(location.search);Object.keys(aend).forEach(function(k){if(aend[k]==null)u.delete(k);else u.set(k,aend[k])});return "?"+u.toString()},
  kpi:function(lab,wert,klein,cls){return '<div class="kpi k '+(cls||"")+'"><span class="gk">'+lab+'</span><strong class="t">'+wert+(klein?' <small>'+klein+'</small>':"")+'</strong></div>'},
  melde:function(titel,text,art){var m=document.createElement("div");m.className="mb "+(art||"");m.innerHTML='<span class="ic">'+ic(art==="w"?"flagge":"check")+'</span><span><b>'+titel+'</b><small>'+text+'</small></span><u></u>';$("meld").appendChild(m);setTimeout(function(){m.classList.add("geht");setTimeout(function(){m.remove()},260)},3200)}
};
