// ===================================================================================
// TAUZIEHEN AN DER HAFENKANTE — PROTOTYP-MECHANIK (Format-Variante fuer Gewichtheben, 08.11.)
//
// Auftrag: docs/design/oberflaechen-effekte-und-rempler-vision-08-11.md, Teil 3 (Chris' eigenes
// Beispiel "Tauziehen"). Machbarkeit, Matrix-Treue und offene Punkte:
// docs/design/format-varianten-machbarkeit-08-11.md.
//
// DAS IST KEIN PRODUKTIONSCODE. Diese Datei steht bewusst NEBEN battle-mode.engine.js und wird
// von der echten App nirgends geladen. Sie zeigt nur, wie sich das Format spielen und anfuehlen
// wuerde, und liefert eine Vorab-Sonde fuer rho/Pp (scripts/miss-tauziehen-prototyp.mjs). Die
// Pflichtabnahme (miss-alle-disziplinen.mjs / messe-arena-einfluss.mjs, zwei Saatstroeme, mit
// Slot-/Trait-/Form-Kanaelen) kann erst laufen, wenn das Format im Motor verdrahtet ist.
//
// GRUNDSATZ (wie beim Sandsack, s. Kopfkommentar von SANDSACK_STATIONEN im Motor): das Format
// liest NUR die fuenf Teilwerte, die Gewichtheben ohnehin aus der gesperrten Matrix mischt —
// LAST / TECHNIK / NERVEN / ANSAGE / ERHOLUNG mit exakt dem Rezept aus BUEHNE_ART.gewichtheben.
// Kein neues Attribut, keine neue Gewichtung; nur die MECHANIK ist eine andere.
//
// ABLAUF (Chris: "alle vorhandenen Spieler gegeneinander, ggf. ueber mehrere Runden"):
//   * Zwoelf Zieher (6 je Team) — das ganze Feld einer Gewichtheben-Begegnung.
//   * FUENF SCHWEIZER RUNDEN, je sechs Eins-gegen-eins-Taue GLEICHZEITIG. Runde 1 paart Slot
//     gegen Slot (wie die Hantel-Duelle), ab Runde 2 paart das Schweizer System nach Siegen —
//     ohne Rueckspiel, ausdruecklich AUCH Teamkollegen gegeneinander ("jeder gegen jeden").
//   * Jedes Tau haengt ueber der Hafenkante: wer verliert, wird ueber die Kante ins Becken
//     gezogen (Platsch). Nach 14 s ohne Platsch entscheidet die Markierung (Punktsieg).
//   * GROSSES TAU zum Schluss: sechs gegen sechs an einem Seil, um den Mannschafts-Bonus.
// ===================================================================================
(function(root){
  "use strict";

  // EXAKT das Rezept aus BUEHNE_ART.gewichtheben (battle-mode.engine.js) — nicht anfassen,
  // sonst misst die Sonde etwas anderes als das, was der Motor mischen wuerde.
  const REZEPT={
    LAST:     {power:60,health:25,determination:15},
    TECHNIK:  {dexterity:45,speed:70,determination:20,power:5},
    NERVEN:   {charisma:35,will:35,determination:20,health:10},
    ANSAGE:   {charisma:53,power:8,will:13,dexterity:9,health:10,speed:7},
    ERHOLUNG: {stamina:40,health:35,will:25}
  };
  // Matrix Gewichtheben (official-discipline-weights.ts), nur fuer die Sonde (Pp-Vergleich).
  const MATRIX={power:28,charisma:23,health:16,determination:12,will:7,speed:6,dexterity:6,stamina:2,
    intelligence:0,awareness:0,spirit:0,torment:0};
  const ATTRIBUTE=Object.keys(MATRIX);

  // Wie mische() im Motor (gewichtetes Mittel, gerundet, 1..99).
  const mische=(a,rez)=>{let s=0,w=0;for(const k in rez){s+=(a[k]||0)*rez[k];w+=rez[k];}
    return Math.max(1,Math.min(99,Math.round(s/w)));};

  // mulberry32 — reproduzierbar je Saat, wie die Motor-Saaten (kein Math.random()).
  function rng(saat){let t=(saat>>>0)||1;return()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);
    r=(r+Math.imul(r^(r>>>7),61|r))^r;return((r^(r>>>14))>>>0)/4294967296;};}
  const gauss=(r)=>{const u=Math.max(1e-9,r()),v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};

  // ---------------------------------------------------------------- Konstanten (PLATZHALTER)
  // Kalibriert nur gegen die Vorab-Sonde (s. Machbarkeitsdokument Abschnitt 5). Jede Zahl hier ist
  // ein Hebel, den die echte Kalibrierrunde neu messen muss.
  const K={
    dt:0.2, maxT:14,              // Tick und Zeitlimit je Tau (s)
    zugBasis:0.55,                // Grundzug je Tick, skaliert mit LAST
    lastExp:0.9,                  // Kraft je LAST leicht unterproportional (Sonde: 1,35 trieb power auf 46 %)
    rhythmusMin:0.4, rhythmusK:1.2, // ANSAGE: "Hau-Ruck"-Takt + Publikum -> Wirkungsgrad 0,40..1,60
    starrBlickK:0.35,             // ANSAGE-Differenz vor dem Anpfiff -> Startvorsprung (Psychospiel)
    ruckRate:0.12,                // Chance je Tick auf einen Ruck
    ruckK:0.10,                   // Ruck-Impuls bei TECHNIK 100
    ruckFehlK:0.04,               // verpatzter Ruck kostet Meter
    kanteSchwelle:0.55,           // ab hier steht man "an der Kante"
    kanteNervenK:1.5,             // NERVEN 100 -> bis +150 % Gegenhalt an der Kante (Fersen rein)
    rauschen:0.10,                // Zug-Rauschen je Tick (Griff, Sand, Ausrutscher)
    formRauschen:0.03,            // Tagesform je Tau
    ermuedungJeS:0.006,           // Ermuedung je gezogener Sekunde
    erholungK:0.9,                // ERHOLUNG 100 baut 90 % der Ermuedung bis zur naechsten Runde ab
    runden:5,
    tauFinaleN:6, finaleBonus:2
  };

  function teilwerte(a){const o={};for(const k in REZEPT)o[k]=mische(a,REZEPT[k]);return o;}

  // Ein Eins-gegen-eins-Tau. Liefert Sieger, Marge und (optional) den Film fuer die Buehne.
  // pos > 0: A gewinnt Boden (B rutscht zur Kante), pos >= 1: B im Becken.
  function tau(A,B,r,mitFilm){
    const film=mitFilm?[]:null;
    const kraft=(u)=>Math.pow(u.LAST/50,K.lastExp)*(K.rhythmusMin+K.rhythmusK*u.ANSAGE/100)
      *(1-u.erm)*(1+gauss(r)*K.formRauschen);
    const fA=kraft(A), fB=kraft(B);
    let pos=K.starrBlickK*(A.ANSAGE-B.ANSAGE)/100, t=0, ende=null;
    if(film)film.push({t:0,pos,ev:"start"});
    while(t<K.maxT){
      t+=K.dt;
      let zA=fA*(1+gauss(r)*K.rauschen), zB=fB*(1+gauss(r)*K.rauschen);
      // AN DER KANTE: wer kurz vor dem Becken steht, stemmt sich mit NERVEN dagegen.
      if(pos> K.kanteSchwelle)zB*=1+K.kanteNervenK*B.NERVEN/100*(pos-K.kanteSchwelle)/(1-K.kanteSchwelle);
      if(pos<-K.kanteSchwelle)zA*=1+K.kanteNervenK*A.NERVEN/100*(-pos-K.kanteSchwelle)/(1-K.kanteSchwelle);
      let d=K.zugBasis*K.dt*(zA-zB)/(zA+zB)*2;
      let ev=null;
      // RUCK: kurzer Gewaltakt. TECHNIK entscheidet, ob er sitzt (Timing, Fussarbeit, Griff).
      for(const [u,s] of [[A,1],[B,-1]]){
        if(r()<K.ruckRate){
          if(r()<0.35+0.6*u.TECHNIK/100){ d+=s*K.ruckK*u.TECHNIK/100*(1+0.5*u.LAST/100); ev=ev||(s>0?"ruckA":"ruckB"); }
          else { d-=s*K.ruckFehlK; ev=ev||(s>0?"patzerA":"patzerB"); }
        }
      }
      pos+=d;
      if(film)film.push({t:+t.toFixed(2),pos:Math.max(-1,Math.min(1,pos)),ev});
      if(pos>=1){ende="A";break;}
      if(pos<=-1){ende="B";break;}
    }
    const platsch=!!ende;
    if(!ende)ende=pos>=0?"A":"B";
    // Ermuedung nach gezogener Zeit (STAMINA traegt laut Matrix nur 2 — deshalb kurz und klein).
    A.erm+=t*K.ermuedungJeS; B.erm+=t*K.ermuedungJeS;
    const marge=Math.max(-1,Math.min(1,pos));
    if(film)film.push({t:+t.toFixed(2),pos:marge,ev:platsch?(ende==="A"?"platschB":"platschA"):"punkt"});
    return {sieger:ende==="A"?A:B, verlierer:ende==="A"?B:A, marge:ende==="A"?marge:-marge, platsch, dauer:t, film};
  }

  // Schweizer Paarung: nach Siegen, dann Marge sortiert, ohne Rueckspiel.
  function paare(z,runde){
    if(runde===0){
      const heim=z.filter(u=>u.side===0), gast=z.filter(u=>u.side===1);
      return heim.map((u,i)=>[u,gast[i]]);
    }
    const sort=[...z].sort((a,b)=>b.siege-a.siege||b.margeSumme-a.margeSumme||a.id-b.id);
    const offen=[...sort], paarungen=[];
    while(offen.length){
      const a=offen.shift();
      let j=offen.findIndex(b=>!a.gegner.includes(b.id));
      if(j<0)j=0;
      paarungen.push([a,offen.splice(j,1)[0]]);
    }
    return paarungen;
  }

  // Grosses Tau: alle sechs gegen alle sechs. Teamkraft = Summe, Takt = bester Ansager.
  function grossesTau(z,r,mitFilm){
    const seite=(s)=>z.filter(u=>u.side===s);
    const takt=(l)=>Math.max(...l.map(u=>u.ANSAGE));
    const kraft=(l)=>l.reduce((s,u)=>s+Math.pow(u.LAST/50,K.lastExp)*(1-u.erm),0)*(K.rhythmusMin+K.rhythmusK*takt(l)/100);
    const A={LAST:0,TECHNIK:0,NERVEN:0,ANSAGE:0,erm:0}, B={...A};
    const fa=kraft(seite(0)), fb=kraft(seite(1));
    const avg=(l,k)=>l.reduce((s,u)=>s+u[k],0)/l.length;
    // In den Einzel-Tau-Rechner gesteckt: Kraftverhaeltnis ueber LAST abgebildet, TECHNIK/NERVEN gemittelt.
    A.LAST=50*Math.pow(fa/6/(K.rhythmusMin+K.rhythmusK*0.5),1/K.lastExp); B.LAST=50*Math.pow(fb/6/(K.rhythmusMin+K.rhythmusK*0.5),1/K.lastExp);
    A.ANSAGE=takt(seite(0)); B.ANSAGE=takt(seite(1));
    A.TECHNIK=avg(seite(0),"TECHNIK"); B.TECHNIK=avg(seite(1),"TECHNIK");
    A.NERVEN=avg(seite(0),"NERVEN"); B.NERVEN=avg(seite(1),"NERVEN");
    const e=tau(A,B,r,mitFilm);
    return {siegerSeite:e.sieger===A?0:1, platsch:e.platsch, dauer:e.dauer, film:e.film};
  }

  // Ganze Begegnung. `heim`/`gast`: Listen {n, a:{attribute}, eig?}. `opt.film` fuer die Buehne.
  function spiele(heim,gast,saat,opt){
    opt=opt||{};
    const r=rng(saat);
    let id=0;
    const z=[...heim.map(p=>({p,side:0})),...gast.map(p=>({p,side:1}))].map(({p,side})=>({
      id:id++, n:p.n, side, a:p.a, eig:p.eig, ...teilwerte(p.a),
      siege:0, margeSumme:0, platschGemacht:0, platschGefallen:0, gegner:[], erm:0, verlauf:[]
    }));
    const runden=[];
    for(let ri=0;ri<K.runden;ri++){
      const taue=paare(z,ri).map(([a,b],bahn)=>{
        const e=tau(a,b,r,!!opt.film);
        a.gegner.push(b.id); b.gegner.push(a.id);
        e.sieger.siege+=1;
        e.sieger.margeSumme+=e.marge; e.verlierer.margeSumme-=e.marge;
        if(e.platsch){e.sieger.platschGemacht++; e.verlierer.platschGefallen++;}
        for(const u of [a,b])u.verlauf.push({runde:ri,gegner:(u===a?b:a).n,sieg:e.sieger===u,platsch:e.platsch});
        return {bahn,a:a.id,b:b.id,sieger:e.sieger.id,marge:e.marge,platsch:e.platsch,dauer:e.dauer,film:e.film};
      });
      runden.push(taue);
      // Erholung bis zur naechsten Runde.
      for(const u of z)u.erm*=1-K.erholungK*u.ERHOLUNG/100;
    }
    const finale=grossesTau(z,r,!!opt.film);
    // Spielerwert (was der Motor als wert() melden wuerde): Siege zaehlen, Marge trennt Gleichstand.
    for(const u of z)u.wert=10*u.siege+3*u.margeSumme;
    const team=[0,1].map(s=>z.filter(u=>u.side===s).reduce((x,u)=>x+u.siege,0)+(finale.siegerSeite===s?K.finaleBonus:0));
    return {teilnehmer:z, runden, finale, team, K};
  }

  // =================================================================================
  // VARIANTE B: "DIE GRUBE" — Fables Entwurf (docs/design/format-varianten-brainstorm-08-11.md
  // Abschnitt 2), hier zum ersten Mal gerechnet. Zwoelf Zieher sternfoermig um eine Grube, alle
  // Seile an EINEM Eisenring. Vier Zuege 12 -> 8 -> 5 -> 3 -> 1 (es fallen 4, 3, 2, 2), dazwischen
  // Erholung. Kanalbelegung wie bei Fable:
  //   Zug = LAST · Stand/Rutscher = TECHNIK · Aufbaeumen an der Kante = NERVEN ·
  //   Ruf (Vollzug/Halten) + Grubenblick = ANSAGE · Puste zwischen den Zuegen = ERHOLUNG.
  // Geometrie: der Ring liegt bei r (2D); jeder Zieher i steht auf seiner Speiche u_i (Einheits-
  // vektor nach aussen) mit Restboden s_i (1 = voll, 0 = Kante). Bewegt sich der Ring um dr, aendert
  // sich s_i um dot(dr, u_i): kommt der Ring auf ihn zu, tritt er zurueck, entfernt er sich, rutscht
  // er Richtung Kante. Wer s_i <= 0 erreicht, haengt ueber der Grube und ist raus.
  // =================================================================================
  const KG={
    dt:0.2, zugMaxT:20, staffel:[4,3,2,2],
    ringK:0.10,                 // Ringweg je Tick und Einheit Nettokraft
    lastExp:0.9,
    standMin:0.85, standK:0.30, // TECHNIK: wie viel Zugkraft am Seil ankommt
    rutschChance:0.5, rutschBoden:0.18, // nach jedem Fall ruckt der Ring: (1-TECHNIK) * Chance
    kanteSchwelle:0.15, aufbaeumK:1.35, // NERVEN: einmal je Zug, Kraftstoss fuer 1 s (NERVEN 100 -> +135 %)
    vollzugSchwelle:55, vollzugK:1.15, haltenK:0.95, vollzugErm:1.5, haltenErm:0.7,
    rufK:0.9,                   // ANSAGE als Takt-Wirkungsgrad (wie Variante A), sonst traegt charisma zu wenig
    blickK:0.05,                // Grubenblick: ANSAGE > NERVEN des Gegenuebers -> -5 % Zugkraft
    ermJeS:0.006, erholungK:0.9,
    rauschen:0.10, formRauschen:0.03
  };

  function spieleGrube(heim,gast,saat,opt){
    opt=opt||{};
    const r=rng(saat);
    let id=0;
    const z=[...heim.map(p=>({p,side:0})),...gast.map(p=>({p,side:1}))].map(({p,side})=>({
      id:id++, n:p.n, side, a:p.a, eig:p.eig, ...teilwerte(p.a),
      raus:false, platz:null, bodenBeiFall:0, zuege:0, aufbaeumer:0, rutscher:0, erm:0
    }));
    const zuegeFilm=[];
    let platzFrei=z.length;
    for(let zi=0;zi<KG.staffel.length;zi++){
      const dabei=z.filter(u=>!u.raus);
      if(dabei.length<=1)break;
      // Aufstellung am Ring: Heim/Gast im Wechsel, Reihenfolge nach Slot (= Listenreihenfolge).
      const h=dabei.filter(u=>u.side===0), g=dabei.filter(u=>u.side===1), ring=[];
      while(h.length||g.length){ if(h.length)ring.push(h.shift()); if(g.length)ring.push(g.shift()); }
      const n=ring.length;
      ring.forEach((u,i)=>{ const w=2*Math.PI*i/n; u.ux=Math.cos(w); u.uy=Math.sin(w); u.s=1; u.aufb=false; u.aufbT=0;
        u.vollzug=u.ANSAGE>=KG.vollzugSchwelle; u.zuege++;
        u.form=1+gauss(r)*KG.formRauschen; });
      // Grubenblick gegen das direkte Gegenueber (gegenueberliegender Platz am Ring)
      ring.forEach((u,i)=>{ const o=ring[(i+Math.floor(n/2))%n]; u.blickMalus=(o!==u&&o.ANSAGE>u.NERVEN)?KG.blickK:0; });
      let rx=0, ry=0, t=0, gefallen=0;
      const soll=Math.min(KG.staffel[zi], n-1);
      const film=opt.film?{zieher:ring.map(u=>({id:u.id,ux:u.ux,uy:u.uy})),frames:[],faelle:[]}:null;
      const fall=(u,grund)=>{ u.raus=true; u.bodenBeiFall=u.s; u.platz=platzFrei--; gefallen++;
        if(film)film.faelle.push({t:+t.toFixed(2),id:u.id,grund});
        // Ruck am Ring: Rutscher-Wurf fuer alle anderen
        for(const v of ring)if(!v.raus&&r()<KG.rutschChance*(1-v.TECHNIK/100)){ v.s-=KG.rutschBoden; v.rutscher++; if(film)film.faelle.push({t:+t.toFixed(2),id:v.id,grund:"rutscher"}); }
      };
      while(gefallen<soll&&t<KG.zugMaxT){
        t+=KG.dt;
        let fx=0, fy=0;
        for(const u of ring){ if(u.raus)continue;
          let f=Math.pow(u.LAST/50,KG.lastExp)*(KG.standMin+KG.standK*u.TECHNIK/100)
            *(1-KG.rufK+KG.rufK*u.ANSAGE/100)*(u.vollzug?KG.vollzugK:KG.haltenK)
            *(1-u.blickMalus)*(1-u.erm)*u.form*(1+gauss(r)*KG.rauschen);
          if(!u.aufb&&u.s<KG.kanteSchwelle){ u.aufb=true; u.aufbT=1.0; u.aufbaeumer++; }
          if(u.aufbT>0){ f*=1+KG.aufbaeumK*u.NERVEN/100; u.aufbT-=KG.dt; }
          u.f=f; fx+=f*u.ux; fy+=f*u.uy;
          u.erm+=KG.ermJeS*KG.dt*(u.vollzug?KG.vollzugErm:KG.haltenErm);
        }
        const dx=KG.ringK*KG.dt*fx, dy=KG.ringK*KG.dt*fy;
        rx+=dx; ry+=dy;
        for(const u of ring){ if(u.raus)continue; u.s+=dx*u.ux+dy*u.uy; u.s=Math.min(1.3,u.s); }
        // Faelle in Reihenfolge des Restbodens (wer tiefer steht, faellt zuerst)
        const unter=ring.filter(u=>!u.raus&&u.s<=0).sort((a,b)=>a.s-b.s);
        for(const u of unter){ if(gefallen>=soll)break; fall(u,"kante"); }
        if(film)film.frames.push({t:+t.toFixed(2),rx,ry,s:ring.map(u=>u.raus?null:+u.s.toFixed(3))});
      }
      // Zeitlimit: die mit dem wenigsten Restboden gehen, bis die Staffel voll ist
      const rest=ring.filter(u=>!u.raus).sort((a,b)=>a.s-b.s);
      while(gefallen<soll)fall(rest.shift(),"zeit");
      for(const u of z)if(!u.raus)u.erm*=1-KG.erholungK*u.ERHOLUNG/100;
      if(film){ film.dauer=t; zuegeFilm.push(film); }
    }
    const letzte=z.filter(u=>!u.raus); letzte.forEach(u=>{u.platz=1;});
    // Spielerwert: Rang (12..1 -> 0..11 Punkte) plus Restboden beim Fall als Feintrenner.
    // (Fables Zugnote per Referenz-Inversion waere der Produktionsweg; hier bewusst einfach.)
    for(const u of z)u.wert=10*(z.length-u.platz)+5*Math.max(-0.5,Math.min(1,u.bodenBeiFall));
    const team=[0,1].map(s=>z.filter(u=>u.side===s).reduce((x,u)=>x+(z.length+1-u.platz),0));
    return {teilnehmer:z, zuege:zuegeFilm, team, K:KG, format:"grube"};
  }

  const api={REZEPT,MATRIX,ATTRIBUTE,K,KG,teilwerte,spiele,spieleGrube,rng};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  else root.__TAUZIEHEN=api;
})(typeof window!=="undefined"?window:globalThis);
