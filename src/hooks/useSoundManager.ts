import { useEffect, useRef, useState } from 'react';

interface WebAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export interface SoundManager {
  init: () => void;
  playAttack: (build: string, x?: number, y?: number, playerX?: number, playerY?: number) => void;
  playHit: (x?: number, y?: number, playerX?: number, playerY?: number) => void;
  playDash: () => void;
  playLevelUp: () => void;
  playGasp: () => void;
  playShieldClink: (x?: number, y?: number, playerX?: number, playerY?: number) => void;
  playShieldBreak: (x?: number, y?: number, playerX?: number, playerY?: number) => void;
  playBossRoar: (x?: number, y?: number, playerX?: number, playerY?: number) => void;
  playVictoryChime: () => void;
  toggleMute: () => void;
  isMuted: boolean;
  volume: number; // legacy master volume compatibility
  setVolume: (vol: number) => void;
  bgmVolume: number;
  sfxVolume: number;
  setBgmVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  startBgm: () => void;
  stopBgm: () => void;
  pauseBgm: () => void;
  resumeBgm: () => void;
  setPausedFilter: (isPaused: boolean) => void;
  setContaminationEffect: (contamination: number) => void;
  setBgmState: (state: 'explore' | 'combat' | 'boss') => void;
}

export function useSoundManager(bgmUrl: string = 'bgm.mp3'): SoundManager {
  void bgmUrl;
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    try {
      const saved = localStorage.getItem('maze_mace_volume');
      return saved !== null ? parseFloat(saved) : 0.8;
    } catch {
      return 0.8;
    }
  });

  const [bgmVolume, setBgmVolumeState] = useState(() => {
    try {
      const saved = localStorage.getItem('maze_mace_bgm_volume');
      return saved !== null ? parseFloat(saved) : 0.6;
    } catch {
      return 0.6;
    }
  });

  const [sfxVolume, setSfxVolumeState] = useState(() => {
    try {
      const saved = localStorage.getItem('maze_mace_sfx_volume');
      return saved !== null ? parseFloat(saved) : 0.7;
    } catch {
      return 0.7;
    }
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const bgmFilterRef = useRef<BiquadFilterNode | null>(null);

  // BGM elements (legacy unrouted elements preserved)
  const isPlayingBgm = useRef(false);

  // Procedural BGM (Fallback drone hum)
  const droneOsc1 = useRef<OscillatorNode | null>(null);
  const droneOsc2 = useRef<OscillatorNode | null>(null);
  const droneLfo = useRef<OscillatorNode | null>(null);
  const droneFilter = useRef<BiquadFilterNode | null>(null);
  const droneGain = useRef<GainNode | null>(null);
  const isProceduralPlaying = useRef(false);

  // BGM Sequencer Scheduling Elements
  const bgmStateRef = useRef<'explore' | 'combat' | 'boss'>('explore');
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const bpmRef = useRef(130);

  // Heartbeat sound loop for high contamination
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wobbleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentContaminationRef = useRef(0);

  // Initialize Audio Context (must be triggered by a user gesture)
  const initAudio = () => {
    if (audioCtxRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Master Gain (combines overall volume)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // SFX Gain (controlled separately)
      const sfxGain = ctx.createGain();
      sfxGain.gain.setValueAtTime(isMuted ? 0 : sfxVolume * 0.7, ctx.currentTime);
      sfxGain.connect(masterGain);
      sfxGainRef.current = sfxGain;

      // BGM Filter (for paused/contamination muffling)
      const bgmFilter = ctx.createBiquadFilter();
      bgmFilter.type = 'lowpass';
      bgmFilter.frequency.setValueAtTime(20000, ctx.currentTime); // default wide open
      bgmFilter.connect(masterGain);
      bgmFilterRef.current = bgmFilter;

      // BGM Gain (controlled separately)
      const bgmGain = ctx.createGain();
      bgmGain.gain.setValueAtTime(isMuted ? 0 : bgmVolume * 0.35, ctx.currentTime);
      bgmGain.connect(bgmFilter);
      bgmGainRef.current = bgmGain;
    } catch (e) {
      console.warn("Failed to initialize Web Audio API:", e);
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      if (masterGainRef.current) {
        masterGainRef.current.gain.setValueAtTime(newMuted ? 0 : volume, now);
      }
      if (bgmGainRef.current) {
        bgmGainRef.current.gain.setValueAtTime(newMuted ? 0 : bgmVolume * 0.35, now);
      }
      if (sfxGainRef.current) {
        sfxGainRef.current.gain.setValueAtTime(newMuted ? 0 : sfxVolume * 0.7, now);
      }
    }
  };

  // Set Master Volume
  const setVolume = (vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setVolumeState(v);
    try {
      localStorage.setItem('maze_mace_volume', String(v));
    } catch {
      return;
    }
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setValueAtTime(isMuted ? 0 : v, audioCtxRef.current.currentTime);
    }
  };

  // Set BGM Volume
  const setBgmVolume = (vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setBgmVolumeState(v);
    try {
      localStorage.setItem('maze_mace_bgm_volume', String(v));
    } catch {
      return;
    }
    if (bgmGainRef.current && audioCtxRef.current) {
      bgmGainRef.current.gain.setValueAtTime(isMuted ? 0 : v * 0.35, audioCtxRef.current.currentTime);
    }
  };

  // Set SFX Volume
  const setSfxVolume = (vol: number) => {
    const v = Math.max(0, Math.min(1, vol));
    setSfxVolumeState(v);
    try {
      localStorage.setItem('maze_mace_sfx_volume', String(v));
    } catch {
      return;
    }
    if (sfxGainRef.current && audioCtxRef.current) {
      sfxGainRef.current.gain.setValueAtTime(isMuted ? 0 : v * 0.7, audioCtxRef.current.currentTime);
    }
  };

  // Helper: Create White Noise Buffer Source
  const createNoiseNode = (ctx: AudioContext): AudioBufferSourceNode | null => {
    try {
      const bufferSize = ctx.sampleRate * 0.5; // 0.5s white noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      return noise;
    } catch {
      return null;
    }
  };

  // Helper: Create Spatial Audio attenuation and panning nodes
  const createSpatialNodes = (
    ctx: AudioContext, 
    sourceX?: number, 
    sourceY?: number, 
    playerX?: number, 
    playerY?: number
  ) => {
    const gainNode = ctx.createGain();
    let panNode: StereoPannerNode | null = null;

    if (sourceX !== undefined && sourceY !== undefined && playerX !== undefined && playerY !== undefined) {
      const dx = sourceX - playerX;
      const dy = sourceY - playerY;
      const dist = Math.hypot(dx, dy);

      // 1. Distance attenuation: close = full volume, far (>= 450px) = 0 volume
      const maxDistance = 450;
      const volMult = Math.max(0, Math.min(1, 1 - dist / maxDistance));
      gainNode.gain.setValueAtTime(volMult, ctx.currentTime);

      // 2. Horizontal stereo panning: pan ranges from -1.0 (far left) to 1.0 (far right)
      const panValue = Math.max(-1.0, Math.min(1.0, dx / 250)); // pan sensitivity factor 250px
      if (ctx.createStereoPanner) {
        panNode = ctx.createStereoPanner();
        panNode.pan.setValueAtTime(panValue, ctx.currentTime);
      }
    } else {
      gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
    }

    return { gainNode, panNode };
  };

  // Helper: Connect nodes to SFX Destination with Spatial Panning
  const connectSpatialSFX = (
    ctx: AudioContext, 
    sourceNode: AudioNode, 
    sourceX?: number, 
    sourceY?: number, 
    playerX?: number, 
    playerY?: number
  ) => {
    const dest = sfxGainRef.current;
    if (!dest) return;

    const spatial = createSpatialNodes(ctx, sourceX, sourceY, playerX, playerY);
    sourceNode.connect(spatial.gainNode);
    if (spatial.panNode) {
      spatial.gainNode.connect(spatial.panNode);
      spatial.panNode.connect(dest);
    } else {
      spatial.gainNode.connect(dest);
    }
  };

  // Play Sound Effects (synthesized via Web Audio)
  const playAttack = (weaponBuild: string, x?: number, y?: number, playerX?: number, playerY?: number) => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || isMuted) return;
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;

    if (weaponBuild === 'breaker') {
      // Heavy Mace: Deep blunt sweep + noise thump
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);

      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

      // Noise thump
      const noise = createNoiseNode(ctx);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(300, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(80, now + 0.08);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      if (noise) {
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectSpatialSFX(ctx, noiseGain, x, y, playerX, playerY);
        noise.start(now);
        noise.stop(now + 0.08);
      }

      osc.connect(gain);
      connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (weaponBuild === 'striker') {
      // Fast Sword: Quick high slash whoosh
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.07);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

      osc.connect(gain);
      connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (weaponBuild === 'guardian') {
      // Wide Greatsword: sweeping noise swoosh + mid wave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.22);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

      const noise = createNoiseNode(ctx);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(600, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(1200, now + 0.22);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.5, now);
      noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.06);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

      if (noise) {
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        connectSpatialSFX(ctx, noiseGain, x, y, playerX, playerY);
        noise.start(now);
        noise.stop(now + 0.24);
      }

      osc.connect(gain);
      connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Cartographer/Default Mace: Standard swing
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  };

  const playHit = (x?: number, y?: number, playerX?: number, playerY?: number) => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || isMuted) return;

    const now = ctx.currentTime;

    // Fleshy noise impact burst
    const noise = createNoiseNode(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.09);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.75, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

    if (noise) {
      noise.connect(filter);
      filter.connect(noiseGain);
      connectSpatialSFX(ctx, noiseGain, x, y, playerX, playerY);
      noise.start(now);
      noise.stop(now + 0.09);
    }

    // Low-end impact thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
    osc.start(now);
    osc.stop(now + 0.12);
  };

  const playDash = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    const dest = sfxGainRef.current;
    if (!ctx || !dest || isMuted) return;

    const now = ctx.currentTime;

    // Wind dash whoosh
    const noise = createNoiseNode(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    if (noise) {
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.15);
    }
  };

  const playLevelUp = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    const dest = sfxGainRef.current;
    if (!ctx || !dest || isMuted) return;

    const now = ctx.currentTime;

    // Ascending arpeggio (C Major Triad)
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      const noteTime = now + index * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = index % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.0, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, noteTime + 0.24);
      
      osc.connect(gain);
      gain.connect(dest);
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.25);
    });

    // High shimmer spark
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(1200, now + 0.3);
    sweepOsc.frequency.exponentialRampToValueAtTime(3000, now + 0.65);

    sweepGain.gain.setValueAtTime(0.0, now + 0.3);
    sweepGain.gain.linearRampToValueAtTime(0.15, now + 0.35);
    sweepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    sweepOsc.connect(sweepGain);
    sweepGain.connect(dest);
    sweepOsc.start(now + 0.3);
    sweepOsc.stop(now + 0.65);
  };

  const playShieldClink = (x?: number, y?: number, playerX?: number, playerY?: number) => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || isMuted) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1700, now);
    osc.frequency.exponentialRampToValueAtTime(1300, now + 0.18);
    
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2500, now);
    osc2.frequency.exponentialRampToValueAtTime(1900, now + 0.18);
    
    osc.connect(gain);
    osc2.connect(gain);
    connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
    
    osc.start(now);
    osc.stop(now + 0.18);
    osc2.start(now);
    osc2.stop(now + 0.18);
  };

  const playShieldBreak = (x?: number, y?: number, playerX?: number, playerY?: number) => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || isMuted) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(450, now);
    osc1.frequency.exponentialRampToValueAtTime(70, now + 0.5);
    
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(320, now);
    osc2.frequency.exponentialRampToValueAtTime(50, now + 0.5);

    // Crunch noise
    const noise = createNoiseNode(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    
    osc1.connect(gain);
    osc2.connect(gain);
    if (noise) {
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(gain);
      noise.start(now);
      noise.stop(now + 0.45);
    }
    
    connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
    
    osc1.start(now);
    osc1.stop(now + 0.5);
    osc2.start(now);
    osc2.stop(now + 0.5);
  };

  const playBossRoar = (x?: number, y?: number, playerX?: number, playerY?: number) => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || isMuted) return;

    const now = ctx.currentTime;
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 1.1);
    
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, now);
    osc1.frequency.linearRampToValueAtTime(60, now + 1.2);
    
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(90, now);
    osc2.frequency.linearRampToValueAtTime(45, now + 1.2);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    
    connectSpatialSFX(ctx, gain, x, y, playerX, playerY);
    
    osc1.start(now);
    osc1.stop(now + 1.4);
    osc2.start(now);
    osc2.stop(now + 1.4);
  };

  const playVictoryChime = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    const dest = sfxGainRef.current;
    if (!ctx || !dest || isMuted) return;

    const now = ctx.currentTime;
    
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Ascending major arpeggio
    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.16;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      const oscGlow = ctx.createOscillator();
      oscGlow.type = 'sine';
      oscGlow.frequency.setValueAtTime(freq * 2, noteTime);
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 1.8);
      
      osc.connect(gain);
      oscGlow.connect(gain);
      gain.connect(dest);
      
      osc.start(noteTime);
      osc.stop(noteTime + 2.0);
      oscGlow.start(noteTime);
      oscGlow.stop(noteTime + 2.0);
    });
  };

  const playGasp = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    const dest = sfxGainRef.current;
    if (!ctx || !dest || isMuted) return;

    const now = ctx.currentTime;

    // Inhale whoosh
    const noise = createNoiseNode(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
    filter.Q.setValueAtTime(3.0, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0, now);
    noiseGain.gain.linearRampToValueAtTime(0.38, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    if (noise) {
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.22);
    }

    // Exhale vocal huff (low frequency sine wave)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.32);

    gain.gain.setValueAtTime(0.0, now + 0.12);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now + 0.12);
    osc.stop(now + 0.32);
  };

  // --- Dynamic Procedural BGM Synthesizer Scheduler ---

  // Voice: Kick Drum
  const playProceduralKick = (ctx: AudioContext, time: number, dest: AudioNode) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    
    let pitchMult = 1.0;
    if (currentContaminationRef.current >= 90) {
      pitchMult = 0.72; // Pitch down under extreme stress
    }
    osc.frequency.setValueAtTime(150 * pitchMult, time);
    osc.frequency.exponentialRampToValueAtTime(38 * pitchMult, time + 0.12);
    
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.8, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.16);
    
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.18);
  };

  // Voice: Hi-Hat
  const playProceduralHiHat = (ctx: AudioContext, time: number, dest: AudioNode) => {
    const noise = createNoiseNode(ctx);
    if (!noise) return;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(8000, time);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.04);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + 0.05);
  };

  // Voice: Snare Drum
  const playProceduralSnare = (ctx: AudioContext, time: number, dest: AudioNode) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    let pitchMult = 1.0;
    if (currentContaminationRef.current >= 90) {
      pitchMult = 0.72;
    }
    osc.frequency.setValueAtTime(180 * pitchMult, time);
    osc.frequency.exponentialRampToValueAtTime(80 * pitchMult, time + 0.08);
    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
    
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.08);
    
    const noise = createNoiseNode(ctx);
    if (noise) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, time);
      
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0, time);
      noiseGain.gain.linearRampToValueAtTime(0.4, time + 0.005);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(dest);
      noise.start(time);
      noise.stop(time + 0.18);
    }
  };

  // Voice: Synth Bass
  const playProceduralBass = (ctx: AudioContext, time: number, note: number, dest: AudioNode) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    
    let pitchMult = 1.0;
    if (currentContaminationRef.current >= 90) {
      pitchMult = 0.72;
    }
    osc.frequency.setValueAtTime(note * pitchMult, time);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, time);
    filter.frequency.exponentialRampToValueAtTime(600, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(120, time + 0.18);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.28, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.22);
  };

  // Voice: High Ambient Chimes (Explore Mode)
  const playProceduralChime = (ctx: AudioContext, time: number, note: number, dest: AudioNode) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note, time);
    
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(note * 1.5 + 2, time); // detuned fifth
    
    gain.gain.setValueAtTime(0.0, time);
    gain.gain.linearRampToValueAtTime(0.06, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 2.0); // long decay
    
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);
    
    osc.start(time);
    osc.stop(time + 2.2);
    osc2.start(time);
    osc2.stop(time + 2.2);
  };

  // Scheduler Clock
  const scheduleNote = (step: number, time: number) => {
    const ctx = audioCtxRef.current;
    const dest = bgmGainRef.current;
    if (!ctx || !dest || isMuted) return;
    
    const state = bgmStateRef.current;
    
    if (state === 'explore') {
      // 1. Sparse chimes on step 0
      if (step === 0 && Math.random() < 0.35) {
        const chimes = [587.33, 698.46, 880.00, 1046.50]; // D5, F5, A5, C6
        const randomNote = chimes[Math.floor(Math.random() * chimes.length)];
        playProceduralChime(ctx, time, randomNote, dest);
      }
    } else if (state === 'combat') {
      // 1. Kick on step 0 & 4
      if (step === 0 || step === 4) {
        playProceduralKick(ctx, time, dest);
      }
      // 2. Hat on step 2 & 6
      if (step === 2 || step === 6) {
        playProceduralHiHat(ctx, time, dest);
      }
      // 3. Driving bassline
      const bassNotes = [73.42, 87.31, 73.42, 98.00, 73.42, 116.54, 110.00, 130.81]; // D2, F2, D2, G2, D2, Bb2, A2, C3
      playProceduralBass(ctx, time, bassNotes[step], dest);
    } else if (state === 'boss') {
      // 1. Kick on step 0, 2, 4
      if (step === 0 || step === 2 || step === 4) {
        playProceduralKick(ctx, time, dest);
      }
      // 2. Snare on step 2 & 6
      if (step === 2 || step === 6) {
        playProceduralSnare(ctx, time, dest);
      }
      // 3. Hi-Hat on every step
      playProceduralHiHat(ctx, time, dest);
      
      // 4. Heavy chaotic bass arpeggio
      const bassNotes = [36.71, 73.42, 43.65, 87.31, 49.00, 98.00, 51.91, 103.83]; // D1, D2, F1, F2, G1, G2, Ab1, Ab2
      playProceduralBass(ctx, time, bassNotes[step], dest);
    }
  };

  const advanceNote = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    let activeBpm = bgmStateRef.current === 'boss' ? 150 : 130;
    
    // Slow down beat dynamically in deep/contaminated zones
    if (currentContaminationRef.current >= 90) {
      activeBpm *= 0.68; // slow down by 32%
      const wobble = 1.0 + Math.sin(ctx.currentTime * 2.0) * 0.05; // tempo wobble
      activeBpm *= wobble;
    } else if (currentContaminationRef.current >= 76) {
      activeBpm *= 0.85; // slow down by 15%
    }
    
    bpmRef.current = activeBpm;
    const secondsPerBeat = 60.0 / activeBpm;
    const noteLength = secondsPerBeat / 2; // eighth notes
    
    nextNoteTimeRef.current += noteLength;
    beatIndexRef.current = (beatIndexRef.current + 1) % 8;
  };

  const scheduler = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const scheduleAheadTime = 0.15;
    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      scheduleNote(beatIndexRef.current, nextNoteTimeRef.current);
      advanceNote();
    }
  };

  const startScheduler = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (schedulerTimerRef.current) return;
    
    nextNoteTimeRef.current = ctx.currentTime;
    beatIndexRef.current = 0;
    schedulerTimerRef.current = setInterval(scheduler, 50);
  };

  const stopScheduler = () => {
    if (schedulerTimerRef.current) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
  };

  // Start BGM
  const startBgm = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    isPlayingBgm.current = true;
    startProceduralDrone(ctx);
    startScheduler();
  };

  // Stop BGM
  const stopBgm = () => {
    isPlayingBgm.current = false;
    stopProceduralDrone();
    stopScheduler();
  };

  const pauseBgm = () => {
    stopProceduralDrone();
    stopScheduler();
  };

  const resumeBgm = () => {
    if (!isPlayingBgm.current) return;
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    if (ctx) {
      startProceduralDrone(ctx);
      startScheduler();
    }
  };

  // Muffled Low-pass Filter for paused state
  const setPausedFilter = (isPaused: boolean) => {
    initAudio();
    const ctx = audioCtxRef.current;
    const filter = bgmFilterRef.current;
    if (!ctx || !filter) return;

    const targetFreq = isPaused ? 400 : 20000;
    filter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.15);
  };

  // Contamination Level Effects (Low pass muffle + Heartbeat SFX loop)
  const setContaminationEffect = (contamination: number) => {
    currentContaminationRef.current = contamination;
    initAudio();
    const ctx = audioCtxRef.current;
    const filter = bgmFilterRef.current;
    if (!ctx) return;

    // 1. Muffle BGM frequency as contamination increases
    if (filter) {
      let targetFreq = 20000;
      if (contamination > 75) {
        targetFreq = 500; // heavy muffle
      } else if (contamination > 50) {
        targetFreq = 1200; // medium muffle
      } else if (contamination > 25) {
        targetFreq = 4000; // light muffle
      }
      filter.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.3);
    }

    // 2. Play biological heartbeat loop when contamination is critical (> 75%)
    if (contamination >= 76) {
      if (!heartbeatIntervalRef.current && !isMuted) {
        const playHeartbeatThud = () => {
          const dest = sfxGainRef.current;
          if (!ctx || !dest || isMuted) return;

          const now = ctx.currentTime;
          
          // Lub: lower pitch
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(60, now);
          osc1.frequency.exponentialRampToValueAtTime(30, now + 0.12);
          gain1.gain.setValueAtTime(0.7, now);
          gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
          osc1.connect(gain1);
          gain1.connect(dest);
          osc1.start(now);
          osc1.stop(now + 0.12);

          // Dub: slightly higher, 180ms later
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(50, now + 0.18);
          osc2.frequency.exponentialRampToValueAtTime(25, now + 0.3);
          gain2.gain.setValueAtTime(0.5, now + 0.18);
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
          osc2.connect(gain2);
          gain2.connect(dest);
          osc2.start(now + 0.18);
          osc2.stop(now + 0.3);
        };

        // Play immediately and start interval (synchronized with 0.8s heartbeat visuals)
        playHeartbeatThud();
        heartbeatIntervalRef.current = setInterval(playHeartbeatThud, 800);
      }
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    // 3. Play BGM distortion pitch wobble when contamination >= 90%
    if (contamination >= 90 && !isMuted) {
      if (!wobbleIntervalRef.current) {
        let wobbleTime = 0;
        wobbleIntervalRef.current = setInterval(() => {
          wobbleTime += 0.15;
          
          // Wobble procedural drone detune if active
          if (droneOsc1.current && droneOsc2.current) {
            droneOsc1.current.detune.setValueAtTime(Math.sin(wobbleTime) * 45, ctx.currentTime);
            droneOsc2.current.detune.setValueAtTime(Math.cos(wobbleTime) * 45, ctx.currentTime);
          }
        }, 150);
      }
    } else {
      if (wobbleIntervalRef.current) {
        clearInterval(wobbleIntervalRef.current);
        wobbleIntervalRef.current = null;
        if (droneOsc1.current && droneOsc2.current) {
          droneOsc1.current.detune.setValueAtTime(0, ctx.currentTime);
          droneOsc2.current.detune.setValueAtTime(8, ctx.currentTime);
        }
      }
    }
  };

  // Start Procedural Drone (detuned sawtooth synth + filter sweep)
  const startProceduralDrone = (ctx: AudioContext) => {
    if (isProceduralPlaying.current || isMuted) return;
    isProceduralPlaying.current = true;

    try {
      const now = ctx.currentTime;

      // 1. Create filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      droneFilter.current = filter;

      // 2. Create Detuned Oscillators (low base hum)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(55, now); // A1 note
      
      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(55.25, now);
      osc2.detune.setValueAtTime(8, now);

      droneOsc1.current = osc1;
      droneOsc2.current = osc2;

      // 3. Create LFO to modulate filter cutoff (breathing effect)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.15, now); // 6.6 second breathing rate

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(45, now); // sweep range

      droneLfo.current = lfo;

      // Connect LFO modulation
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // 4. Volume Gain
      const gainNode = ctx.createGain();
      
      // Determine initial gain based on active BGM state
      const state = bgmStateRef.current;
      const initialDroneGain = state === 'boss' ? 0.16 : state === 'combat' ? 0.12 : 0.08;
      
      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(initialDroneGain, now + 3.0);
      droneGain.current = gainNode;

      // Connect graph
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      
      if (bgmFilterRef.current) {
        gainNode.connect(bgmFilterRef.current);
      } else {
        gainNode.connect(masterGainRef.current || ctx.destination);
      }

      // Start nodes
      osc1.start(now);
      osc2.start(now);
      lfo.start(now);
    } catch (e) {
      console.warn("Failed to play procedural drone", e);
    }
  };

  // Stop Procedural Drone
  const stopProceduralDrone = () => {
    isProceduralPlaying.current = false;
    try {
      if (droneOsc1.current) {
        droneOsc1.current.stop();
        droneOsc1.current.disconnect();
        droneOsc1.current = null;
      }
      if (droneOsc2.current) {
        droneOsc2.current.stop();
        droneOsc2.current.disconnect();
        droneOsc2.current = null;
      }
      if (droneLfo.current) {
        droneLfo.current.stop();
        droneLfo.current.disconnect();
        droneLfo.current = null;
      }
      if (droneFilter.current) {
        droneFilter.current.disconnect();
        droneFilter.current = null;
      }
      if (droneGain.current) {
        droneGain.current.disconnect();
        droneGain.current = null;
      }
    } catch {
      return;
    }
  };

  const syncDroneWithState = (ctx: AudioContext, state: 'explore' | 'combat' | 'boss') => {
    if (!droneGain.current || !droneFilter.current) return;
    const now = ctx.currentTime;
    
    if (state === 'explore') {
      droneGain.current.gain.setTargetAtTime(0.08, now, 0.5);
      droneFilter.current.frequency.setTargetAtTime(140, now, 0.5);
    } else if (state === 'combat') {
      droneGain.current.gain.setTargetAtTime(0.12, now, 0.5);
      droneFilter.current.frequency.setTargetAtTime(200, now, 0.5);
    } else if (state === 'boss') {
      droneGain.current.gain.setTargetAtTime(0.16, now, 0.5);
      droneFilter.current.frequency.setTargetAtTime(320, now, 0.5);
    }
  };

  // Trigger BGM state transition (e.g. explore -> combat)
  const setBgmState = (newState: 'explore' | 'combat' | 'boss') => {
    if (bgmStateRef.current === newState) return;
    bgmStateRef.current = newState;
    
    const ctx = audioCtxRef.current;
    if (ctx) {
      syncDroneWithState(ctx, newState);
    }
  };

  // Clean up
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (wobbleIntervalRef.current) clearInterval(wobbleIntervalRef.current);
      stopProceduralDrone();
      stopScheduler();
    };
  }, []);

  return {
    init: initAudio,
    playAttack,
    playHit,
    playDash,
    playLevelUp,
    playGasp,
    playShieldClink,
    playShieldBreak,
    playBossRoar,
    playVictoryChime,
    toggleMute,
    isMuted,
    volume,
    setVolume,
    bgmVolume,
    sfxVolume,
    setBgmVolume,
    setSfxVolume,
    startBgm,
    stopBgm,
    pauseBgm,
    resumeBgm,
    setPausedFilter,
    setContaminationEffect,
    setBgmState
  };
}
