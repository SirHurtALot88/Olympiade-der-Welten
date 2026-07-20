"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// WebAudio-Port der Szenen-Sounds (staffel-oval.html:488-564) — reine Synthese,
// keine Dateien. Alle Cues: Startschuss, Crowd-Swell, Wumms, Star-Shimmer,
// steigender Ping, Riser, Stolper-Thud. Zentral + testbar für alle Disziplinen.

export type StageAudio = {
  muted: boolean;
  toggleMute: () => void;
  volume: number; // 0..1 Master-Lautstärke
  setVolume: (v: number) => void;
  gun: (vol?: number) => void;
  crowdSwell: (vol?: number, dur?: number) => void;
  stumbleThud: (vol?: number) => void;
  wumms: (vol?: number) => void;
  star: () => void;
  risingPing: (net: number) => void;
  riser: () => void;
};

// Default halbiert — die Cues waren live zu laut.
const DEFAULT_VOLUME = 0.5;
const LS_VOLUME = "oly-stage-audio-volume";
const LS_MUTED = "oly-stage-audio-muted";

// Persistierte Startwerte lesen (SSR-sicher: window-Guard). Damit bleibt der
// Sound-Slider über Reloads hinweg fix statt bei jedem Laden auf Default zu springen.
function readStoredVolume(): number {
  if (typeof window === "undefined") return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(LS_VOLUME);
  const v = raw == null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
}
function readStoredMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LS_MUTED) === "1";
}

export function useStageAudio(): StageAudio {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const [muted, setMuted] = useState<boolean>(readStoredMuted);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const [volume, setVolumeState] = useState<number>(readStoredVolume);
  const volumeRef = useRef(DEFAULT_VOLUME);
  volumeRef.current = volume;

  // Slider-/Mute-Stand persistieren (bleibt über Reloads erhalten).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_VOLUME, String(volume));
  }, [volume]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_MUTED, muted ? "1" : "0");
  }, [muted]);

  useEffect(
    () => () => {
      if (ctxRef.current) {
        void ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
        masterRef.current = null;
      }
    },
    [],
  );

  const ac = useCallback((): AudioContext | null => {
    if (mutedRef.current) return null;
    if (!ctxRef.current) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctxRef.current = new Ctor();
      } catch {
        return null;
      }
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    // Master-Gain (alle Cues laufen hier durch) — lazy, Gain = aktuelle Lautstärke.
    if (!masterRef.current) {
      masterRef.current = ctx.createGain();
      masterRef.current.connect(ctx.destination);
    }
    masterRef.current.gain.setValueAtTime(Math.max(0, Math.min(1, volumeRef.current)), ctx.currentTime);
    return ctx;
  }, []);

  const setVolume = useCallback((v: number) => setVolumeState(Math.max(0, Math.min(1, v))), []);

  const gun = useCallback(
    (vol = 0.6) => {
      const a = ac();
      if (!a) return;
      const t0 = a.currentTime;
      const len = 0.12;
      const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = a.createBufferSource();
      src.buffer = buf;
      const hp = a.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 800;
      hp.Q.value = 0.7;
      const g = a.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
      src.connect(hp);
      hp.connect(g);
      g.connect(masterRef.current ?? a.destination);
      src.start(t0);
      src.stop(t0 + len);
    },
    [ac],
  );

  const crowdSwell = useCallback(
    (vol = 0.3, dur = 0.6) => {
      const a = ac();
      if (!a) return;
      const t0 = a.currentTime;
      const d1 = Math.max(0.3, dur);
      const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * d1)), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource();
      src.buffer = buf;
      const bp = a.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.6;
      bp.frequency.setValueAtTime(500, t0);
      bp.frequency.linearRampToValueAtTime(2400, t0 + d1 * 0.7);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + d1 * 0.55);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d1);
      src.connect(bp);
      bp.connect(g);
      g.connect(masterRef.current ?? a.destination);
      src.start(t0);
      src.stop(t0 + d1);
    },
    [ac],
  );

  const stumbleThud = useCallback(
    (vol = 0.4) => {
      const a = ac();
      if (!a) return;
      const t0 = a.currentTime;
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(180, t0);
      o.frequency.exponentialRampToValueAtTime(70, t0 + 0.1);
      const g = a.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
      o.connect(g);
      g.connect(masterRef.current ?? a.destination);
      o.start(t0);
      o.stop(t0 + 0.14);
    },
    [ac],
  );

  const wumms = useCallback(
    (vol = 1) => {
      const a = ac();
      if (!a) return;
      const t0 = a.currentTime;
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(160, t0);
      o.frequency.exponentialRampToValueAtTime(44, t0 + 0.32);
      const og = a.createGain();
      og.gain.setValueAtTime(0.0001, t0);
      og.gain.exponentialRampToValueAtTime(0.9 * vol, t0 + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
      o.connect(og);
      og.connect(masterRef.current ?? a.destination);
      o.start(t0);
      o.stop(t0 + 0.52);
      const len = 0.05;
      const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
      const src = a.createBufferSource();
      src.buffer = buf;
      const ng = a.createGain();
      ng.gain.setValueAtTime(0.5 * vol, t0);
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + len);
      src.connect(ng);
      ng.connect(masterRef.current ?? a.destination);
      src.start(t0);
      src.stop(t0 + len);
      [880, 1320, 1760].forEach((f, i) => {
        const s = a.createOscillator();
        s.type = "sine";
        s.frequency.value = f;
        const sg = a.createGain();
        const st = t0 + 0.04 + i * 0.02;
        sg.gain.setValueAtTime(0.0001, st);
        sg.gain.exponentialRampToValueAtTime(0.14 * vol, st + 0.02);
        sg.gain.exponentialRampToValueAtTime(0.001, st + 0.34);
        s.connect(sg);
        sg.connect(masterRef.current ?? a.destination);
        s.start(st);
        s.stop(st + 0.36);
      });
    },
    [ac],
  );

  const star = useCallback(() => {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime;
    [1046, 1318, 1568, 2093].forEach((f, i) => {
      const o = a.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = a.createGain();
      const st = t0 + i * 0.06;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.15, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.4);
      o.connect(g);
      g.connect(masterRef.current ?? a.destination);
      o.start(st);
      o.stop(st + 0.42);
    });
  }, [ac]);

  const risingPing = useCallback(
    (net: number) => {
      const a = ac();
      if (!a) return;
      const t0 = a.currentTime;
      const o = a.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(380 + Math.min(520, net * 3.2), t0);
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(g);
      g.connect(masterRef.current ?? a.destination);
      o.start(t0);
      o.stop(t0 + 0.15);
    },
    [ac],
  );

  const riser = useCallback(() => {
    const a = ac();
    if (!a) return;
    const t0 = a.currentTime;
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(200, t0);
    o.frequency.exponentialRampToValueAtTime(760, t0 + 0.26);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1700;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    o.connect(lp);
    lp.connect(g);
    g.connect(masterRef.current ?? a.destination);
    o.start(t0);
    o.stop(t0 + 0.32);
  }, [ac]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { muted, toggleMute, volume, setVolume, gun, crowdSwell, stumbleThud, wumms, star, risingPing, riser };
}
