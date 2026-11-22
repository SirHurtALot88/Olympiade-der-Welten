/* Gemeinsame Helfer der Mockups Kredite / Ranks / Leaders (22.11.). Kein App-Code. */
"use strict";
var Q=new URLSearchParams(location.search);
var O=window.OLY, TEAMS=O.teams, DZ=O.diszi, SP=O.spieler;
var TB={};TEAMS.forEach(function(t){TB[t.id]=t});
var ICH=Q.get("team")&&TB[Q.get("team")]?Q.get("team"):"D-P", WIR=TB[ICH];
var AX=["pow","spe","men","soc"], AXN=["POW","SPE","MEN","SOC"], AXL=["Power","Speed","Mental","Social"];
/* Klassenfarbe: app/foundation/classVisuals.ts (rot POW, gruen SPE, blau MEN, gelb SOC) */
var KLF={Berserker:"pow",Warlord:"pow",Tank:"pow",Sprinter:"spe",Rogue:"spe",Charger:"spe",Mage:"men",Overseer:"men",Templar:"men",Bard:"soc",Hero:"soc",Badass:"soc",Tactician:"soc"};
if(Q.get("still")==="1")document.body.classList.add("still");

var SPRITE='<svg width="0" height="0" style="position:absolute" aria-hidden="true">'+
'<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/><path d="M9 20v-6h6v6"/></symbol>'+
'<symbol id="i-liste" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></symbol>'+
'<symbol id="i-tab" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>'+
'<symbol id="i-team" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-4 3-6 7-6s7 2 7 6"/><circle cx="18" cy="9" r="2.5"/><path d="M17 14c3 0 5 2 5 5"/></symbol>'+
'<symbol id="i-markt" viewBox="0 0 24 24"><path d="M4 8h14l-3-3M20 16H6l3 3"/></symbol>'+
'<symbol id="i-scout" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/></symbol>'+
'<symbol id="i-geld" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9c-1-1.5-5-1.5-5 .8 0 2.600 5 1.400 5 4.200 0 2.200-4.200 2.200-5.400.4M12 6v12"/></symbol>'+
'<symbol id="i-rang" viewBox="0 0 24 24"><path d="M3 20h6v-8H3zM9 20h6V5H9zM15 20h6v-11h-6z"/></symbol>'+
'<symbol id="i-pokal" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 01-10 0zM7 6H3v1a4 4 0 004 4M17 6h4v1a4 4 0 01-4 4M12 14v4M8 20h8"/></symbol>'+
'<symbol id="i-med" viewBox="0 0 24 24"><circle cx="12" cy="15" r="5"/><path d="M8 3l3 7M16 3l-3 7M9 3h6"/></symbol>'+
'<symbol id="i-bank" viewBox="0 0 24 24"><path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/></symbol>'+
'<symbol id="i-kreis" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6 4"/></symbol>'+
'<symbol id="i-wahl" viewBox="0 0 24 24"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></symbol>'+
'<symbol id="i-l" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>'+
'<symbol id="i-r" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>'+
'<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.500v.5"/></symbol>'+
'<symbol id="i-ok" viewBox="0 0 24 24"><path d="M5 12.500l4.500 4.500L19 7"/></symbol>'+
'<symbol id="i-acht" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></symbol>'+
'<symbol id="i-auf" viewBox="0 0 24 24"><path d="M6 15l6-7 6 7"/></symbol>'+
'<symbol id="i-ab" viewBox="0 0 24 24"><path d="M6 9l6 7 6-7"/></symbol>'+
'<symbol id="i-spieler" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 4-7 8-7s8 2 8 7"/></symbol>'+
'<symbol id="i-stern" viewBox="0 0 24 24"><path d="M12 3l2.700 5.700 6.300.8-4.600 4.300 1.200 6.200L12 17l-5.600 3 1.200-6.200L3 9.500l6.300-.8z"/></symbol>'+
'<symbol id="i-hand" viewBox="0 0 24 24"><path d="M3 12l4-4 4 3 3-3 7 5-4 5-4-2-3 2z"/></symbol>'+
'</svg>';
document.body.insertAdjacentHTML("afterbegin",SPRITE);

function ic(n){return '<svg class="i"><use href="#i-'+n+'"/></svg>'}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function z1(x){return (Math.round(x*10)/10).toLocaleString("de-DE",{minimumFractionDigits:1,maximumFractionDigits:1})}
function z2(x){return (Math.round(x*100)/100).toLocaleString("de-DE",{minimumFractionDigits:2,maximumFractionDigits:2})}
function z0(x){return Math.round(x).toLocaleString("de-DE")}
function geld(x,vz){var s=z1(Math.abs(x));return (x<0?"−":(vz&&x>0?"+":""))+s+" C"}
function pz(x,n){return (x*100).toLocaleString("de-DE",{minimumFractionDigits:n==null?1:n,maximumFractionDigits:n==null?1:n})+" %"}
function logo(id){return "team-logos/"+id+".jpg"}
function teamZ(id,lang){var t=TB[id];return '<span class="team"><img src="../'+logo(id)+'" alt=""><b>'+esc(lang===false?t.id:t.name)+'</b>'+(lang===2?'<small>'+t.id+'</small>':'')+'</span>'}
function portrait(p){return p.s?'<img class="po" src="../portraits/'+p.s+'.jpg" alt="" loading="lazy">':'<span class="po"></span>'}
function klasse(k,kurz){var f=KLF[k]||"men";return '<span class="kl" style="--kf:var(--'+f+')" data-tip="'+esc(k)+' · Klassenfarbe '+f.toUpperCase()+'"><img src="../class-icons/'+k+'.png" alt="">'+(kurz?'':'<span>'+esc(k)+'</span>')+'</span>'}
function dzIcon(i){return '<img class="dz-ic" src="../discipline-icons/'+encodeURI(DZ[i].icon)+'.png" alt="">'}
function rail(an){
  var e=[["home","Start","oly-start-modern-18-11.html"],["liste","Einsatzliste","einsatzliste-modern-17-11.html"],["tab","Saisonstand","#"],["rang","Ranks","ranks-modern-22-11.html"],["pokal","Leaders","leaders-modern-22-11.html"],["team","Kader und Teams","kader-teams-modern-18-11.html"],["markt","Transfermarkt","transfermarkt-modern-18-11.html"]];
  var h='<div class="logo"><img src="../'+logo(ICH)+'" alt=""></div>';
  e.forEach(function(x){h+='<a class="tipr'+(x[0]===an?' an':'')+'" data-tip="'+x[1]+'" href="'+x[2]+'">'+ic(x[0])+'</a>'});
  h+='<span class="luecke"></span><a class="tipr'+(an==="geld"?' an':'')+'" data-tip="Finanzen · Kredite" href="kredite-modern-22-11.html">'+ic("geld")+'</a>';
  return h;
}
/* Sortieren: alle Tabellen. z = {k:Spalte,d:1|-1}; Gleichstand immer nach Name. */
function sortiere(rows,wert,d,name){return rows.slice().sort(function(a,b){var x=wert(a),y=wert(b);if(x===y||(x==null&&y==null))return name?String(name(a)).localeCompare(String(name(b)),"de"):0;if(x==null)return 1;if(y==null)return -1;if(typeof x==="string")return d*x.localeCompare(y,"de");return d*(x-y)})}
function kopf(k,txt,z,cls,tip){return '<button type="button" class="'+(cls||"")+(z.k===k?" so":"")+'" data-so="'+k+'"'+(tip?' data-tip="'+esc(tip)+'"':'')+'>'+txt+'<span class="pf">'+(z.k===k&&z.d>0?"▲":"▼")+'</span></button>'}
/* Rang 1 = bester. hoch=true: groesster Wert ist Rang 1. Gleiche Werte teilen den Rang. */
function raenge(liste,wert,hoch){var s=liste.slice().sort(function(a,b){return hoch?wert(b)-wert(a):wert(a)-wert(b)});var m=new Map(),r=0,vor=null;s.forEach(function(x,i){var w=wert(x);if(w!==vor){r=i+1;vor=w}m.set(x,r)});return m}
function setzeUrl(k,v){var u=new URL(location.href);if(v==null)u.searchParams.delete(k);else u.searchParams.set(k,v);history.replaceState(null,"",u)}
function demoKnopf(k,v,txt,akt){return '<button type="button" data-dk="'+k+'" data-dv="'+v+'" aria-pressed="'+(akt?"true":"false")+'">'+txt+'</button>'}
