"use strict";
/* TABELLEN-BAUKASTEN DER MOCKUPS VOM 24.11.: jede Spalte sortierbar (Regel 21.11.).
   Spalte = {k,t,w,r,tip,wert(x),html(x),kopf(o),nebel}. nebel:true = Spalte kann verdeckte Werte tragen; sortiert wird dann nach der Stufe. */
function tafel(o){
  var sp=o.cols.map(function(c){return c.w}).join(" "),akt=null;o.cols.forEach(function(c){if(c.k===o.sort)akt=c});
  if(o.extraSort&&o.extraSort[o.sort])akt=o.extraSort[o.sort];
  var rows=akt&&akt.wert?sortiere(o.rows,akt.wert,o.dir):o.rows,von=(o.blatt||0)*(o.zeilen||0),sicht=o.zeilen?rows.slice(von,von+o.zeilen):rows;
  var kopf='<div class="tz kopf">'+o.cols.map(function(c){if(c.kopf)return c.kopf(o);
    return '<span class="'+(c.r?"r ":"")+(c.k===o.sort?"so":"")+'"'+(c.wert?' data-so="'+c.k+'"':"")+(c.tip?' title="'+esc(c.tip)+'"':"")+'>'+c.t+(c.k===o.sort?(o.dir<0?" ▼":" ▲"):"")+'</span>'}).join("")+'</div>';
  var body=sicht.map(function(x,i){var a=o.zeile?o.zeile(x,von+i):{};
    return '<div class="tz '+(a.cls||"")+'"'+(a.attr?" "+a.attr:"")+'>'+o.cols.map(function(c){return '<span class="'+(c.r?"r ":"")+(c.cls||"")+'">'+c.html(x,von+i)+'</span>'}).join("")+'</div>'}).join("");
  for(var i=sicht.length;i<(o.zeilen||0);i++)body+='<div class="tz leer"></div>';
  return {html:'<div class="tf" style="--sp:'+sp+';--zeilen:'+(o.zeilen||sicht.length)+'">'+kopf+body+'</div>',n:rows.length,rows:rows,nebelSort:!!(akt&&akt.nebel&&!NEBEL_AUS)};
}
/* Klick auf einen Spaltenkopf: gleiche Spalte dreht die Richtung, neue Spalte startet absteigend (oder laut std) */
function sortKlick(ev,Z,std){var s=ev.target.closest("[data-so]");if(!s)return false;var k=s.getAttribute("data-so");if(Z.sort===k)Z.dir=-Z.dir;else{Z.sort=k;Z.dir=(std&&std[k])||-1}Z.blatt=0;return true}
