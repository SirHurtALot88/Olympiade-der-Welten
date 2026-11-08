// ===================================================================================
// BASKETBALL "KNOCKOUT" — PROTOTYP-MECHANIK (Format-Variante fuer Basketball, 08.11.)
//
// Auftrag: Teil 3 von Chris' Vision (Format-Varianten, gleiche Matrix, anderes Gameplay),
// Fables Kandidat 4.5 aus docs/design/format-varianten-brainstorm-08-11.md. Ergebnis und
// Bewertung: docs/design/format-varianten-basketball-knockout-08-11.md.
//
// DAS IST KEIN PRODUKTIONSCODE. Die Datei steht neben battle-mode.engine.js, die App laedt sie
// nirgends. Sie liefert die Vorab-Sonde (scripts/miss-basketball-knockout-prototyp.mjs).
//
// GRUNDSATZ wie beim Tauziehen: das Format liest NUR Teilwerte, die Basketball ohnehin aus der
// gesperrten Matrix mischt — die Rezepte aus public/mockups/battle-mode.rezepte.js (zeichengleich
// kopiert, unten) und den Freiwurf-Kanal FREIWURF_KANAL aus dem Motor (verbucheFreiwurf).
// Kein neues Attribut, kein neuer Sub-Skill, keine neue Gewichtung.
//
// REGELN (echtes Knockout, auf zwoelf Figuren einer Begegnung):
//   * Zwoelf Werfer in einer Reihe hinter der Freiwurflinie, zwei Baelle.
//   * Der Vordermann wirft von der Linie. Trifft er nicht, holt er den Abpraller und wirft von
//     dort weiter, bis er trifft. Der Hintermann darf werfen, sobald der Vordermann geworfen hat.
//   * Trifft der Hintermann, BEVOR der Vordermann trifft, ist der Vordermann "geknockt".
//   * Wer trifft, gibt den Ball nach vorn an den Naechsten in der Reihe und stellt sich hinten an.
//
// KANAELE (Teilwert -> Bedeutung im Knockout):
//   FREIWURF (spirit 48, int 35, dex 17)   Trefferchance des ersten Wurfs von der Linie
//   TEAMGEIST (charisma 56, spirit 44)     Druck: der Hintermann im Nacken drueckt, der eigene
//                                          Teamgeist haelt dagegen (Publikum, Ruhe)
//   ZWEITCHANCE (torment, int, spirit, aw) wie schnell und wie nah am Korb man den Abpraller hat
//   LAUFTEMPO (speed 52, stamina 32, dex)  Sprint zum Abpraller, Weg zum Korbleger
//   SCHUSS_NAH (power 34, spirit 30, ...)  Korbleger nach kurzem Abpraller
//   TECHNIK (int 50, aw 22, spirit, dex)   Wurfwahl und Sprungwurf nach langem Abpraller
//
// VARIANTEN (fuer die Sonde, s. Dokument Abschnitt 3):
//   leben        1 = reines Ausscheiden (Fables Fassung), 3 = drei Leben je Werfer
//   losen        "fest"  = Reihe nach Slot (Heim/Gast im Wechsel), bleibt zyklisch — Fables Fassung
//                "start" = Reihe je Spiel ausgelost, danach zyklisch
//                "umlauf"= je Spiel ausgelost UND nach jedem vollen Umlauf neu ausgelost
//   wert         "platz" = nur Ausscheide-Reihenfolge; "marge" = Platz + Sekunden-Marge der Duelle
//                (Empfehlung); "mix", "konto", "tempo" = in der Sonde verworfene Alternativen
//   durchgaenge  wie viele komplette Knockouts hintereinander (Spielerwert = Summe)
// ===================================================================================
(function(root){
  "use strict";

  // EXAKT aus public/mockups/battle-mode.rezepte.js (basketball) bzw. FREIWURF_KANAL im Motor.
  const REZEPT={
    FREIWURF:    {spirit:48,intelligence:35,dexterity:17},
    TEAMGEIST:   {charisma:56,spirit:44},
    ZWEITCHANCE: {torment:20,intelligence:24,spirit:23,speed:9,awareness:22,stamina:2},
    LAUFTEMPO:   {speed:52,stamina:32,dexterity:16},
    SCHUSS_NAH:  {power:34,spirit:30,stamina:16,awareness:12,dexterity:6,torment:2},
    TECHNIK:     {intelligence:50,awareness:22,spirit:16,dexterity:12}
  };
  const MATRIX={spirit:22,intelligence:16,awareness:14,charisma:11,speed:10,dexterity:8,power:7,
    stamina:6,torment:6,health:0,will:0,determination:0};
  const ATTRIBUTE=Object.keys(MATRIX);

  const mische=(a,rez)=>{let s=0,w=0;for(const k in rez){s+=(a[k]||0)*rez[k];w+=rez[k];}
    return Math.max(1,Math.min(99,Math.round(s/w)));};
  function rng(saat){let t=(saat>>>0)||1;return()=>{t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);
    r=(r+Math.imul(r^(r>>>7),61|r))^r;return((r^(r>>>14))>>>0)/4294967296;};}
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  // ---------------------------------------------------------------- Konstanten (PLATZHALTER)
  // Kalibriert nur gegen die Vorab-Sonde. Jede Zahl ist ein Hebel fuer die echte Runde.
  const K={
    // Stand nach der Kalibrierung (Dokument Abschnitt 3.3). Die Steigungen sind STEILER als im
    // Live-Motor (FW_STEIGUNG 0,0055): ein Wurfwettbewerb hat je Werfer nur ~15 Wuerfe, und ohne
    // steile Kurven reicht das fuer keine Einzelspiel-Rangfolge (Abschnitt 3.2).
    ftBasis:0.35, ftK:0.0112,         // Freiwurf: 35 % bei FREIWURF 50, +1,1 Pp je Punkt
    druckK:0.0085,                    // TEAMGEIST Hintermann minus eigener TEAMGEIST, je Punkt
    druckMax:9,                       // Deckel fuer den Druckterm (9 = ungedeckelt, s. Dokument 3.4)
    ftMin:0.05, ftMax:0.95,
    wurfZeit:1.2,                     // Ausholen/Abwurf von der Linie (s)
    flugZeit:0.9,                     // Ball in der Luft bis Ring
    rebBasis:2.6, rebZcK:0.15, rebLtK:0.08, // Zeit bis Abpraller gesichert, schneller mit ZC/LT
    kurzBasis:0.25, kurzZcK:0.048,   // Chance auf kurzen Abpraller (Korbleger) aus ZWEITCHANCE
    layBasis:0.62, layK:0.024, layZeit:0.9, layLtK:0.032,  // Korbleger: Chance, Weg (LAUFTEMPO)
    jumpBasis:0.42, jumpK:0.065, jumpZeit:0.6,             // Sprungwurf nach langem Abpraller
    rauschZeit:0.25,                  // relatives Zeitrauschen je Aktion
    pass:0.8,                         // Ball nach vorn, naechster nimmt an
    // Empfohlene Fassung: drei Leben, Neuauslosung je Umlauf, Wert = Platz + Marge.
    // Fables Original: {leben:1, losen:"fest", wert:"platz"}.
    leben:3, losen:"umlauf", durchgaenge:1, wert:"marge",
    wertRauswurf:1.0, wertNote:4.0, wertMarge:1.0, margeDeckel:4, zeitLimit:0, wertTempo:1.0
  };

  function teilwerte(a){const o={};for(const k in REZEPT)o[k]=mische(a,REZEPT[k]);return o;}

  // Ein "Ballbesitz bis zum Treffer" eines Werfers: Startzeit s, Druck vom Hintermann.
  // Liefert die Trefferzeit und die Wurfliste (fuer Film/Boxscore).
  function lauf(w,s,druckVon,r,K){
    const druck=druckVon?clamp(K.druckK*(druckVon.TEAMGEIST-w.TEAMGEIST),-K.druckMax,K.druckMax):0;
    const z=(x)=>x*(1+K.rauschZeit*(r()*2-1));
    let t=s+z(K.wurfZeit);
    const wuerfe=[];
    const pFt=clamp(K.ftBasis+K.ftK*(w.FREIWURF-50)-druck,K.ftMin,K.ftMax);
    let treffer=r()<pFt; wuerfe.push({art:"linie",t,treffer});
    let n=0;
    while(!treffer&&n<12){
      n++;
      // Abpraller holen
      t+=z(K.flugZeit)+z(Math.max(0.4,K.rebBasis-K.rebZcK*(w.ZWEITCHANCE-50)-K.rebLtK*(w.LAUFTEMPO-50)));
      const kurz=r()<clamp(K.kurzBasis+K.kurzZcK*(w.ZWEITCHANCE-50),0.1,0.9);
      // Wurfwahl: kurzer Abpraller -> Korbleger. Langer Abpraller -> wer TECHNIK hat, nimmt den
      // Sprungwurf, sonst wird zum Korb gezogen (Weg kostet LAUFTEMPO-abhaengig Zeit).
      const pLay=clamp(K.layBasis+K.layK*(w.SCHUSS_NAH-50),0.15,0.95);
      const pJump=clamp(K.jumpBasis+K.jumpK*(w.TECHNIK-50),0.08,0.85);
      const wegLay=Math.max(0.3,K.layZeit-K.layLtK*(w.LAUFTEMPO-50));
      let art,p;
      if(kurz){art="leger";p=pLay;t+=z(0.4);}
      else if(pJump/K.jumpZeit>=pLay/(wegLay+0.4)){art="sprung";p=pJump;t+=z(K.jumpZeit);}
      else{art="leger";p=pLay;t+=z(wegLay+0.4);}
      treffer=r()<p; wuerfe.push({art,t,treffer});
    }
    return {zeit:t+K.flugZeit*0.6,start:s,wuerfe};
  }

  // Ein kompletter Knockout. reihe: Array von Werfern (Objekte mit Teilwerten).
  function knockout(reihe,r,K,stat,mitFilm){
    let schlange=reihe.slice();
    const leben=new Map(schlange.map((w)=>[w,K.leben]));
    const raus=[];             // Ausscheide-Reihenfolge (erster = zuerst raus)
    // Film (nur Anzeige, zieht KEINE Zufallszahl): Ballbesitze mit ihren Wuerfen, Ereignisse und
    // je Entscheidung ein Schnappschuss der Reihe. Die Sonde laeuft ohne Film.
    const film=mitFilm?{besitze:[],ereignisse:[],bilder:[]}:null;
    const bild=(t)=>{if(film)film.bilder.push({t,V:V&&V.n,H:H&&H.n,schlange:schlange.map((w)=>w.n),raus:raus.map((w)=>w.n),
      leben:Object.fromEntries([...leben].map(([w,l])=>[w.n,l]))});};
    const besitzFilm=(w,l,ende,ergebnis,extra)=>{if(film)film.besitze.push(Object.assign({w:w.n,start:l.start,ende,ergebnis,
      wuerfe:l.wuerfe.map((x)=>Object.assign({},x,{nachEnde:x.t>ende+1e-9}))},extra||{}));};
    let umlaufZaehler=0;
    // Ballbesitz: vorn (V) und hinten (H), jeweils mit laufendem Versuch.
    let V=schlange.shift(), H=schlange.shift();
    // Druck kommt immer vom Naechsten dahinter (Hintermann bzw. der Wartende mit dem Ball).
    let lV=lauf(V,0,H,r,K);
    let lH=lauf(H,lV.wuerfe[0].t+0.2,schlange[0]||V,r,K);
    const zaehle=(w,l,bis)=>{const s=stat.get(w);for(const x of l.wuerfe){if(x.t>bis)break;s.versuche++;if(x.treffer)s.treffer++;}};
    bild(0);
    const besitz=(w,l)=>{const s=stat.get(w);s.besitze++;s.besitzZeit+=l.zeit-l.start;};
    let sicherheit=0, ende=0;
    while(sicherheit++<4000){
      if(K.zeitLimit&&ende>=K.zeitLimit)break;
      const hTrifftZuerst=lH.zeit<lV.zeit;
      // Marge des Duells (s): positiv = V war schneller. Gedeckelt, damit ein verkorkster
      // Ballbesitz (zwoelf Fehlwuerfe) nicht alles andere ueberstimmt.
      const marge=clamp(lH.zeit-lV.zeit,-K.margeDeckel,K.margeDeckel);
      stat.get(V).marge+=marge; stat.get(H).marge-=marge;
      let jetzt;
      if(hTrifftZuerst){
        jetzt=lH.zeit; ende=jetzt;
        zaehle(V,lV,jetzt); zaehle(H,lH,Infinity); besitz(H,lH);
        stat.get(H).rauswuerfe++; stat.get(V).geknockt++;
        const rest=leben.get(V)-1; leben.set(V,rest);
        besitzFilm(V,lV,jetzt,"geknockt",{von:H.n}); besitzFilm(H,lH,jetzt,"knock",{opfer:V.n});
        if(film)film.ereignisse.push({t:jetzt,typ:"knock",opfer:V.n,taeter:H.n,rest,marge});
        // H hat getroffen: hinten an. V ist geknockt (mit Restleben: ebenfalls hinten an).
        schlange.push(H);
        if(rest<=0)raus.push(V); else schlange.push(V);
        umlaufZaehler+=2;
        if(schlange.length===1){V=null;H=null;bild(jetzt);break;}
        if(K.losen==="umlauf"&&umlaufZaehler>=schlange.length){umlaufZaehler=0;mischen(schlange,r);}
        V=schlange.shift(); H=schlange.shift();
        lV=lauf(V,jetzt+K.pass,H,r,K);
        lH=lauf(H,lV.wuerfe[0].t+0.2,schlange[0]||V,r,K);
        bild(jetzt);
      }else{
        // V trifft zuerst: hinten an; H wird Vordermann (sein Versuch laeuft weiter), Neuer dahinter.
        jetzt=lV.zeit; ende=jetzt;
        zaehle(V,lV,Infinity); besitz(V,lV);
        besitzFilm(V,lV,jetzt,"sicher");
        if(film)film.ereignisse.push({t:jetzt,typ:"sicher",w:V.n,marge});
        schlange.push(V);
        umlaufZaehler++;
        if(K.losen==="umlauf"&&umlaufZaehler>=schlange.length+1){umlaufZaehler=0;mischen(schlange,r);}
        const N=schlange.shift();
        V=H; lV=lH; H=N;
        lH=lauf(H,jetzt+K.pass,schlange[0]||V,r,K);
        bild(jetzt);
      }
    }
    const uebrig=reihe.filter((w)=>!raus.includes(w));
    return {reihenfolge:raus.concat(uebrig),film,dauer:ende};
  }
  function mischen(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}}

  // Ein Spiel = 1..n Knockout-Durchgaenge. heim/gast: [{n,a,eig}].
  function spiele(heim,gast,saat,opt){
    const k=Object.assign({},K,opt||{});
    const r=rng(saat);
    const reihe=[];
    for(let i=0;i<Math.max(heim.length,gast.length);i++){
      if(heim[i])reihe.push({...heim[i],seite:0,...teilwerte(heim[i].a)});
      if(gast[i])reihe.push({...gast[i],seite:1,...teilwerte(gast[i].a)});
    }
    const stat=new Map(reihe.map((w)=>[w,{versuche:0,treffer:0,rauswuerfe:0,geknockt:0,platz:0,marge:0,besitze:0,besitzZeit:0}]));
    const filme=[]; let dauer=0;
    for(let d=0;d<k.durchgaenge;d++){
      let start=reihe.slice();
      if(d>0||k.losen!=="fest")mischen(start,r);
      const e=knockout(start,r,k,stat,!!(opt&&opt.film));
      dauer+=e.dauer;
      e.reihenfolge.forEach((w,i)=>{stat.get(w).platz+=i;});
      if(e.film)filme.push(e);
    }
    const teilnehmer=reihe.map((w)=>{
      const s=stat.get(w);
      const note=s.versuche?s.treffer/s.versuche:0;
      const wert=k.wert==="mix"?s.platz+k.wertRauswurf*s.rauswuerfe+k.wertNote*note*k.durchgaenge
        :k.wert==="marge"?s.platz+k.wertMarge*s.marge
        :k.wert==="tempo"?s.platz-k.wertTempo*(s.besitze?s.besitzZeit/s.besitze:20)
        :k.wert==="konto"?s.rauswuerfe-s.geknockt+k.wertMarge*s.marge
        :s.platz;
      return {n:w.n,seite:w.seite,eig:w.eig,wert,platzSumme:s.platz,marge:s.marge,geknockt:s.geknockt,rauswuerfe:s.rauswuerfe,versuche:s.versuche,treffer:s.treffer};
    });
    return {teilnehmer,filme,dauer,K:k,reihe:reihe.map((w)=>{const o={n:w.n,c:w.c,seite:w.seite,eig:w.eig};
      for(const x in REZEPT)o[x]=w[x];return o;})};
  }

  const api={REZEPT,MATRIX,ATTRIBUTE,K,teilwerte,spiele,mische};
  if(typeof module!=="undefined"&&module.exports)module.exports=api; else root.KnockoutSim=api;
})(typeof window!=="undefined"?window:globalThis);
