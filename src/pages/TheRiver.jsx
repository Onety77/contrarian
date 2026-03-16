import React, { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, addDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore'
import './TheRiver.css'

// ═══════════════════════════════════════════════════════════════════════════
//  CANVAS DIMENSIONS
// ═══════════════════════════════════════════════════════════════════════════
const W        = 760
const H        = 420
const PLAYER_X = 155

// ═══════════════════════════════════════════════════════════════════════════
//  PHYSICS  — tweak only these five numbers
// ═══════════════════════════════════════════════════════════════════════════
const GRAVITY        = 0.55    // downward accel every frame — higher = heavier fall
const LIFT_HOLD      = 0.82    // upward accel per frame while holding
const TAP_IMPULSE    = -0.9    // instant vy on fresh press (negative = up)
const MAX_VY         = 8.5     // terminal velocity in either direction
const DRAG           = 0.980   // 0–1 air resistance each frame

// ═══════════════════════════════════════════════════════════════════════════
//  PLAYER SIZE  (also affects hitbox — keep PLAYER_W/H matching ship art)
// ═══════════════════════════════════════════════════════════════════════════
const PLAYER_W   = 24
const PLAYER_H   = 16
const HITBOX_PAD = 3   // shrink hitbox by this many px each side (forgiveness)

// ═══════════════════════════════════════════════════════════════════════════
//  DIFFICULTY TIERS  (exact from your spec)
// ═══════════════════════════════════════════════════════════════════════════
const TIERS = [
  { name:'Easy',          dist:0,     speed:3.2,  gap:180 },
  { name:'Normal',        dist:500,   speed:4.0,  gap:160 },
  { name:'Hard',          dist:900,   speed:5.5,  gap:140 },
  { name:'Harder',        dist:1500,   speed:6.3,  gap:122 },
  { name:'Insane',        dist:2200,   speed:7.2,  gap:108 },
  { name:'Extreme',       dist:3000,  speed:8.2,  gap:95  },
  { name:'Demon',         dist:4000,  speed:9.4,  gap:84  },
  { name:'Easy Demon',    dist:4300,  speed:10.6, gap:74  },
  { name:'Medium Demon',  dist:4800,  speed:12.0, gap:66  },
  { name:'Hard Demon',    dist:5000,  speed:13.6, gap:58  },
  { name:'Insane Demon',  dist:7000,  speed:15.2, gap:50  },
  { name:'IMPOSSIBLE',    dist:9999,  speed:17.5, gap:40  },
]

// ═══════════════════════════════════════════════════════════════════════════
//  BIOMES  (visual themes, unlock by distance)
// ═══════════════════════════════════════════════════════════════════════════
const BIOMES = [
  { name:'STILL WATERS', dist:0,    sky:['#03030d','#05051a','#020209'], accent:[120,80,220],  pillar:[20,12,50], border:[95,55,175],  particle:[218,258] },
  { name:'DEEP CURRENT', dist:900,  sky:['#050310','#08061c','#03020e'], accent:[165,105,255], pillar:[26,16,56], border:[115,65,195], particle:[222,268] },
  { name:'LAVA VEIN',    dist:2200, sky:['#110303','#1a0404','#0d0202'], accent:[255,105,45],  pillar:[58,16,7],  border:[215,75,18],  particle:[0,36]    },
  { name:'ICE CAVERN',   dist:4000, sky:['#02090f','#03101a','#02080d'], accent:[65,190,255],  pillar:[7,33,56],  border:[48,165,238], particle:[188,210] },
  { name:'VOID RIFT',    dist:6500, sky:['#060207','#090309','#040104'], accent:[210,50,218],  pillar:[34,7,44],  border:[172,42,185], particle:[275,318] },
  { name:'SOLAR STORM',  dist:10000,sky:['#0d0800','#180f00','#0a0600'], accent:[255,190,20],  pillar:[48,36,7],  border:[222,175,12], particle:[26,56]   },
]

// ═══════════════════════════════════════════════════════════════════════════
//  MISC CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const PARTICLE_CNT = 80
const BUBBLE_CNT   = 28
const TRAIL_LEN    = 24
const COIN_SCORE   = 5
const MAX_SHAKE    = 10
const SPEED_BOOST_DUR  = 180  // frames
const MINI_DUR         = 480  // frames
const GRAV_FLIP_DUR    = 360  // frames

// ═══════════════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════════════
const rand  = (a,b) => Math.random()*(b-a)+a
const randi = (a,b) => Math.floor(rand(a,b+1))
const clamp = (v,a,b) => Math.max(a,Math.min(b,v))
const lerp  = (a,b,t) => a+(b-a)*t
const lerpC = (a,b,t) => lerp(a,b,clamp(t,0,1))

// ═══════════════════════════════════════════════════════════════════════════
//  TIER LOOKUP
// ═══════════════════════════════════════════════════════════════════════════
function getTier(dist) {
  let t = 0
  for (let i = TIERS.length-1; i >= 0; i--) {
    if (dist >= TIERS[i].dist) { t = i; break }
  }
  return t
}
function getTierSpeed(dist) {
  const t = getTier(dist)
  const next = TIERS[Math.min(t+1, TIERS.length-1)]
  const cur  = TIERS[t]
  if (t === TIERS.length-1) return cur.speed
  const frac = (dist - cur.dist) / (next.dist - cur.dist)
  return lerp(cur.speed, next.speed, clamp(frac, 0, 1))
}
function getTierGap(dist) {
  const t = getTier(dist)
  const next = TIERS[Math.min(t+1, TIERS.length-1)]
  const cur  = TIERS[t]
  if (t === TIERS.length-1) return cur.gap
  const frac = (dist - cur.dist) / (next.dist - cur.dist)
  return lerp(cur.gap, next.gap, clamp(frac, 0, 1))
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCREEN SHAKE
// ═══════════════════════════════════════════════════════════════════════════
class Shake {
  constructor() { this.x=0; this.y=0; this.mag=0; this.decay=0.86 }
  add(m) { this.mag=Math.min(this.mag+m,MAX_SHAKE) }
  update() {
    if (this.mag<0.12) { this.x=0; this.y=0; this.mag=0; return }
    const a=rand(0,Math.PI*2); this.x=Math.cos(a)*this.mag; this.y=Math.sin(a)*this.mag
    this.mag*=this.decay
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════
class AudioEngine {
  constructor() {
    this.ctx=null; this.master=null; this.ready=false
    this._oscPool=[]; this._engineOsc=null
    this._musicActive=false; this._schedTimer=null
  }
  init() {
    if (this.ready) return
    try {
      this.ctx = new (window.AudioContext||window.webkitAudioContext)()
      this.master = this.ctx.createGain(); this.master.gain.value=0.52
      this.master.connect(this.ctx.destination); this.ready=true
    } catch(e){}
  }
  resume() { if (this.ctx?.state==='suspended') this.ctx.resume() }

  startMusic(biomeIdx) {
    if (!this.ready) return
    this.stopMusic()
    const ac = this.ctx

    // ── Per-biome musical character ──────────────────────────────────────
    // Scales use semitone offsets from root. Moods are distinct per zone.
    const CONFIGS = [
      // 0: Still Waters — peaceful, slow, minor pentatonic, 78bpm
      { bpm:78,  root:220,   scale:[0,3,5,7,10],     mood:'ambient',  bass:0.5, melody:0.7, pad:0.4, drum:false },
      // 1: Deep Current — building tension, dorian mode, 95bpm
      { bpm:95,  root:220,   scale:[0,2,3,7,9],      mood:'driving',  bass:0.7, melody:0.8, pad:0.3, drum:true  },
      // 2: Lava Vein — intense, phrygian dominant, heavy kick, 108bpm
      { bpm:108, root:196,   scale:[0,1,4,5,7,8,11], mood:'intense',  bass:0.8, melody:0.6, pad:0.2, drum:true  },
      // 3: Ice Cavern — ethereal, lydian, high arpeggios, 88bpm
      { bpm:88,  root:261.6, scale:[0,2,4,6,7,9,11], mood:'ethereal', bass:0.4, melody:0.9, pad:0.5, drum:false },
      // 4: Void Rift — dark, diminished, syncopated, 102bpm
      { bpm:102, root:196,   scale:[0,1,3,4,6,7,9],  mood:'dark',     bass:0.9, melody:0.7, pad:0.3, drum:true  },
      // 5: Solar Storm — triumphant chaos, whole-tone, 118bpm
      { bpm:118, root:246.9, scale:[0,2,4,6,8,10],   mood:'epic',     bass:1.0, melody:1.0, pad:0.25,drum:true  },
    ]
    const cfg = CONFIGS[Math.min(biomeIdx, CONFIGS.length - 1)]
    const beat    = 60 / cfg.bpm
    const step16  = beat / 4          // 16th note duration in seconds

    // ── Master chain with soft compression and reverb ────────────────────
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -20; comp.knee.value = 8
    comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.3
    comp.connect(this.master)

    // Reverb via convolver (synthesised impulse response)
    const reverbLen  = Math.floor(ac.sampleRate * (cfg.mood === 'ethereal' ? 3.5 : cfg.mood === 'ambient' ? 2.8 : 1.4))
    const reverbBuf  = ac.createBuffer(2, reverbLen, ac.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = reverbBuf.getChannelData(c)
      for (let i = 0; i < reverbLen; i++) {
        const decay = Math.pow(1 - i / reverbLen, 2.5)
        d[i] = (Math.random() * 2 - 1) * decay
      }
    }
    const reverb = ac.createConvolver(); reverb.buffer = reverbBuf
    const dryGain = ac.createGain(); dryGain.gain.value = 0.62; dryGain.connect(comp)
    const wetGain = ac.createGain(); wetGain.gain.value = 0.38; reverb.connect(wetGain); wetGain.connect(comp)

    // ── Pad (sustained chord, very soft, triangle/sine) ──────────────────
    const padVol = ac.createGain(); padVol.gain.value = cfg.pad * 0.14
    padVol.connect(dryGain); padVol.connect(reverb)
    const chordIntervals = [0, 3, 7, 10].map(s => cfg.root * Math.pow(2, s / 12))
    chordIntervals.forEach((freq, i) => {
      const o = ac.createOscillator(); const g = ac.createGain()
      o.type = 'triangle'
      o.frequency.value = freq / 2  // play an octave below for warmth
      o.detune.value = (i % 2 === 0 ? 5 : -5)  // subtle detuning for width
      g.gain.value = 0.5 / (i + 1)
      o.connect(g); g.connect(padVol); o.start()
      this._oscPool.push(o)
    })

    // ── Scheduler state ───────────────────────────────────────────────────
    let nextBeatTime = ac.currentTime + 0.12
    let beat16 = 0
    let melodyStep = 0
    let bassNote = 0

    // Melody patterns per mood (indices into scale array)
    const melodyPatterns = {
      ambient:  [[0,2,1,3,2,4,3,2], [0,1,2,3,4,3,2,1]],
      driving:  [[0,0,2,4,2,0,3,2], [4,3,2,0,2,3,4,3]],
      intense:  [[0,2,4,3,2,4,0,2], [3,4,2,0,4,2,3,0]],
      ethereal: [[0,2,4,6,4,2,3,4], [0,4,2,6,4,3,2,4]],
      dark:     [[0,1,3,1,0,4,3,1], [3,4,0,3,1,4,3,0]],
      epic:     [[0,2,4,2,0,4,2,4], [4,2,0,4,2,0,4,2]],
    }
    const mPatterns = melodyPatterns[cfg.mood] || melodyPatterns.driving
    let mPatternIdx = 0
    let mPattern    = mPatterns[0]

    // Bass patterns (16-step, 1=play 0=rest)
    const bassPatterns = {
      ambient:  [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0],
      driving:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
      intense:  [1,0,1,0, 0,1,0,0, 1,0,1,0, 0,0,1,0],
      ethereal: [1,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
      dark:     [1,0,0,1, 0,0,1,0, 1,0,0,0, 1,0,1,0],
      epic:     [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    }
    const bassPat = bassPatterns[cfg.mood] || bassPatterns.driving

    const schedNote = (time) => {
      const step = beat16 % 16
      const bar  = Math.floor(beat16 / 16)

      // ── KICK (sine thud, only when cfg.drum) ─────────────────────────
      if (cfg.drum && (step === 0 || step === 8 || (cfg.mood === 'intense' && step === 6))) {
        const ko = ac.createOscillator(); const ke = ac.createGain()
        ko.type = 'sine'
        ko.frequency.setValueAtTime(90, time)
        ko.frequency.exponentialRampToValueAtTime(32, time + 0.18)
        ke.gain.setValueAtTime(0.55, time)
        ke.gain.exponentialRampToValueAtTime(0.001, time + 0.28)
        ko.connect(ke); ke.connect(comp); ko.start(time); ko.stop(time + 0.32)
        // Soft click on top
        const clickBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.02), ac.sampleRate)
        const cd = clickBuf.getChannelData(0)
        for (let i = 0; i < cd.length; i++) cd[i] = (1 - i / cd.length) * (Math.random() * 0.5 - 0.25)
        const cs = ac.createBufferSource(); const cg = ac.createGain()
        cs.buffer = clickBuf; cg.gain.value = 0.35
        cs.connect(cg); cg.connect(comp); cs.start(time)
      }

      // ── SNARE (noise burst shaped as a crack, steps 4 and 12) ────────
      if (cfg.drum && (step === 4 || step === 12)) {
        const snLen = Math.floor(ac.sampleRate * 0.14)
        const snBuf = ac.createBuffer(1, snLen, ac.sampleRate)
        const snd   = snBuf.getChannelData(0)
        for (let i = 0; i < snLen; i++) {
          const env = Math.pow(1 - i / snLen, 1.8)
          snd[i] = (Math.random() * 2 - 1) * env
        }
        const snSrc = ac.createBufferSource(); const snEnv = ac.createGain()
        const snFlt = ac.createBiquadFilter()
        snFlt.type = 'bandpass'; snFlt.frequency.value = 3200; snFlt.Q.value = 0.7
        snEnv.gain.setValueAtTime(0.22, time)
        snEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.14)
        snSrc.buffer = snBuf
        snSrc.connect(snFlt); snFlt.connect(snEnv); snEnv.connect(comp); snSrc.start(time)
        // Snare tone body
        const stO = ac.createOscillator(); const stE = ac.createGain()
        stO.type = 'triangle'; stO.frequency.value = 185
        stE.gain.setValueAtTime(0.10, time); stE.gain.exponentialRampToValueAtTime(0.001, time + 0.08)
        stO.connect(stE); stE.connect(comp); stO.start(time); stO.stop(time + 0.10)
      }

      // ── SOFT HI-HAT (every 2nd 16th at harder moods) ─────────────────
      if (cfg.drum && step % 2 === 0 && cfg.mood !== 'ambient' && cfg.mood !== 'ethereal') {
        const hhBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.025), ac.sampleRate)
        const hhd   = hhBuf.getChannelData(0)
        for (let i = 0; i < hhd.length; i++) hhd[i] = (Math.random() * 2 - 1) * (1 - i / hhd.length)
        const hhSrc = ac.createBufferSource(); const hhEnv = ac.createGain()
        const hhFlt = ac.createBiquadFilter(); hhFlt.type = 'highpass'; hhFlt.frequency.value = 9000
        hhEnv.gain.setValueAtTime(0.055, time); hhEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.025)
        hhSrc.buffer = hhBuf; hhSrc.connect(hhFlt); hhFlt.connect(hhEnv); hhEnv.connect(comp); hhSrc.start(time)
      }

      // ── BASS NOTE ────────────────────────────────────────────────────
      if (bassPat[step]) {
        const scaleNote   = cfg.scale[bassNote % cfg.scale.length]
        const bassFreq    = (cfg.root / 4) * Math.pow(2, scaleNote / 12)
        const bO  = ac.createOscillator(); const bE = ac.createGain()
        const bF  = ac.createBiquadFilter()
        bO.type   = 'sine'
        bO.frequency.value = bassFreq
        bF.type   = 'lowpass'; bF.frequency.value = 320; bF.Q.value = 1.8
        bE.gain.setValueAtTime(cfg.bass * 0.52, time)
        bE.gain.exponentialRampToValueAtTime(0.001, time + step16 * 3.8)
        bO.connect(bF); bF.connect(bE); bE.connect(comp)
        bO.start(time); bO.stop(time + step16 * 4.2)
        if (step === 0) bassNote++
      }

      // ── MELODY (every 2nd 16th note = 8th notes) ─────────────────────
      if (step % 2 === 0) {
        const mIdx    = melodyStep % mPattern.length
        const noteIdx = mPattern[mIdx] % cfg.scale.length
        const octave  = Math.floor(melodyStep / mPattern.length) % 2
        const freq    = cfg.root * Math.pow(2, (cfg.scale[noteIdx] + octave * 12) / 12)

        // Two-oscillator melody with slight detune for richness
        const detunes = [0, 7]
        detunes.forEach((det, di) => {
          const mO = ac.createOscillator(); const mE = ac.createGain()
          mO.type = 'sine'   // clean sine — no harshness
          mO.frequency.value = freq
          mO.detune.value = det
          const noteVol = cfg.melody * (di === 0 ? 0.28 : 0.14)
          // Envelope: quick attack, hold, release
          mE.gain.setValueAtTime(0, time)
          mE.gain.linearRampToValueAtTime(noteVol, time + 0.012)
          mE.gain.setValueAtTime(noteVol, time + step16 * 1.6)
          mE.gain.exponentialRampToValueAtTime(0.001, time + step16 * 1.95)
          mO.connect(mE); mE.connect(dryGain); mE.connect(reverb)
          mO.start(time); mO.stop(time + step16 * 2.1)
        })

        melodyStep++
        // Switch melody pattern every 2 bars
        if (melodyStep > 0 && melodyStep % (mPattern.length * 2) === 0) {
          mPatternIdx = (mPatternIdx + 1) % mPatterns.length
          mPattern    = mPatterns[mPatternIdx]
        }
      }

      beat16++
      nextBeatTime += step16
    }

    const tick = () => {
      if (!this._musicActive) return
      while (nextBeatTime < ac.currentTime + 0.22) schedNote(nextBeatTime)
      this._schedTimer = setTimeout(tick, 35)
    }
    this._musicActive = true
    tick()
  }

  stopMusic() {
    this._musicActive = false
    if (this._schedTimer) { clearTimeout(this._schedTimer); this._schedTimer = null }
    this._oscPool.forEach(o => { try { o.stop(); o.disconnect() } catch(e){} })
    this._oscPool = []
    try { this._musicGain?.disconnect() } catch(e){}
    try { this._musicComp?.disconnect() } catch(e){}
  }

  startEngine() {
    if(!this.ready||this._engineOsc) return
    const ac=this.ctx
    const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter()
    o.type='sawtooth';o.frequency.value=138
    g.gain.value=0.10;f.type='bandpass';f.frequency.value=660;f.Q.value=2.6
    o.connect(f);f.connect(g);g.connect(this.master);o.start()
    this._engineOsc=o;this._engineGain=g;this._engineFilt=f
  }
  stopEngine() {
    if(!this._engineOsc) return
    try{
      this._engineGain.gain.setTargetAtTime(0,this.ctx.currentTime,0.06)
      const o=this._engineOsc
      setTimeout(()=>{try{o.stop();o.disconnect()}catch(e){}},200)
    }catch(e){}
    this._engineOsc=null;this._engineGain=null;this._engineFilt=null
  }
  thrustUpdate(vy,spd) {
    if(!this._engineOsc) return
    try{
      const t=this.ctx.currentTime
      this._engineOsc.frequency.setTargetAtTime(148+spd*6,t,0.06)
      this._engineFilt.frequency.setTargetAtTime(720-vy*16,t,0.06)
    }catch(e){}
  }

  _burst(type,freq,dur,vol,sweep=null) {
    if(!this.ready) return
    const ac=this.ctx,o=ac.createOscillator(),e=ac.createGain(),now=ac.currentTime
    o.type=type;o.frequency.value=freq
    e.gain.setValueAtTime(vol,now);e.gain.exponentialRampToValueAtTime(0.001,now+dur)
    if(sweep) o.frequency.exponentialRampToValueAtTime(sweep,now+dur)
    o.connect(e);e.connect(this.master);o.start(now);o.stop(now+dur+0.05)
  }
  _noise(dur,vol,fc=600){
    if(!this.ready) return
    const ac=this.ctx,len=Math.floor(ac.sampleRate*dur)
    const buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0)
    for(let i=0;i<len;i++) d[i]=Math.random()*2-1
    const s=ac.createBufferSource(),e=ac.createGain(),f=ac.createBiquadFilter()
    s.buffer=buf;e.gain.setValueAtTime(vol,ac.currentTime);e.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur)
    f.type='bandpass';f.frequency.value=fc;s.connect(f);f.connect(e);e.connect(this.master);s.start()
  }
  score()      { this._burst('sine',880,0.08,0.20,1760);setTimeout(()=>this._burst('sine',1320,0.06,0.16),55) }
  coin()       { this._burst('square',1200,0.09,0.17,2400);setTimeout(()=>this._burst('square',1600,0.07,0.13),70) }
  hit()        { this._burst('sawtooth',80,0.28,0.40,18);this._noise(0.16,0.25) }
  death()      { this._burst('sawtooth',220,0.5,0.48,28);setTimeout(()=>this._burst('sine',55,0.65,0.48,9),200) }
  portal(type) {
    if(type==='speed_up')   { this._burst('sine',660,0.18,0.25,1320);this._burst('square',880,0.15,0.20,1760) }
    else if(type==='gravity_flip'){ this._burst('square',330,0.18,0.24,165);setTimeout(()=>this._burst('sine',165,0.20,0.18,330),80) }
    else if(type==='mini')  { this._burst('sine',1200,0.15,0.22,2400);this._burst('triangle',800,0.12,0.18,1600) }
    else                    { this._burst('sine',440,0.18,0.22,880) }
  }
  checkpoint() { [0,70,140,210].forEach((ms,i)=>setTimeout(()=>this._burst('sine',440+i*220,0.09,0.18),ms)) }
  biomeShift() { this._burst('sine',220,0.50,0.26,880);setTimeout(()=>this._burst('triangle',440,0.40,0.20,1760),180) }
  surgeStart() { this._burst('sawtooth',220,0.35,0.35,440);this._burst('sawtooth',330,0.26,0.30,660) }
}
const SFX = new AudioEngine()

// ═══════════════════════════════════════════════════════════════════════════
//  WATER PARTICLE
// ═══════════════════════════════════════════════════════════════════════════
class WaterParticle {
  constructor(bi){this.bi=bi;this.reset(true)}
  reset(init=false){
    const b=BIOMES[this.bi]
    this.x=init?rand(0,W):W+rand(0,50);this.y=rand(0,H)
    this.vx=rand(-2.4,-0.6);this.vy=rand(-0.12,0.12)
    this.r=rand(0.7,3.0);this.alpha=rand(0.04,0.20)
    this.hue=rand(b.particle[0],b.particle[1]);this.sat=rand(38,65)
  }
  update(spd){this.x+=this.vx*(spd/4.2);this.y+=this.vy;if(this.x<-10)this.reset()}
  draw(ctx){
    ctx.save();ctx.globalAlpha=this.alpha
    ctx.fillStyle=`hsl(${this.hue},${this.sat}%,55%)`
    ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.fill();ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  BUBBLE
// ═══════════════════════════════════════════════════════════════════════════
class Bubble {
  constructor(){this.reset(true)}
  reset(init=false){
    this.x=rand(0,W);this.y=init?rand(0,H):H+10
    this.vy=rand(-0.50,-0.14);this.r=rand(1.2,5.2)
    this.alpha=rand(0.03,0.13);this.wobble=rand(0,Math.PI*2);this.ws=rand(0.012,0.042)
  }
  update(){this.wobble+=this.ws;this.x+=Math.sin(this.wobble)*0.42;this.y+=this.vy;if(this.y<-10)this.reset()}
  draw(ctx,acc){
    ctx.save();ctx.globalAlpha=this.alpha
    ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},0.6)`
    ctx.lineWidth=0.7;ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.stroke();ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  STAR LAYER (parallax bg)
// ═══════════════════════════════════════════════════════════════════════════
class StarLayer {
  constructor(n,spd,sz,al){
    this.stars=Array.from({length:n},()=>({x:rand(0,W),y:rand(0,H),r:rand(sz*.5,sz),a:rand(al*.4,al),tw:rand(0,Math.PI*2),ts:rand(.01,.04)}))
    this.spd=spd;this.off=0
  }
  update(gs){this.off=(this.off+this.spd*(gs/4.2))%W;this.stars.forEach(s=>s.tw+=s.ts)}
  draw(ctx,acc){
    ctx.save()
    this.stars.forEach(s=>{
      ctx.globalAlpha=s.a*(0.5+Math.sin(s.tw)*0.5)
      ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`
      ctx.beginPath();ctx.arc((s.x-this.off+W*2)%W,s.y,s.r,0,Math.PI*2);ctx.fill()
    })
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  COIN
// ═══════════════════════════════════════════════════════════════════════════
class Coin {
  constructor(x,y,bi){
    this.x=x;this.y=y;this.r=8;this.spin=rand(0,Math.PI*2)
    this.spinS=rand(.04,.08);this.bob=rand(0,Math.PI*2);this.bobS=rand(.03,.055);this.bobA=rand(3,7)
    const cols=['#c6a84b','#ff7040','#4fd4ff','#dd44dd','#ffe040']
    this.col=cols[bi]||cols[0];this.picked=false;this.glow=rand(0,Math.PI*2)
  }
  update(spd){this.x-=spd;this.spin+=this.spinS;this.bob+=this.bobS;this.glow+=.06}
  isGone(){return this.x<-22}
  hits(px,py){const dx=px-this.x,dy=py-(this.y+Math.sin(this.bob)*this.bobA);return Math.sqrt(dx*dx+dy*dy)<this.r+PLAYER_W*.4}
  draw(ctx){
    if(this.picked)return
    const y=this.y+Math.sin(this.bob)*this.bobA
    ctx.save()
    const gg=ctx.createRadialGradient(this.x,y,0,this.x,y,this.r*2.4)
    gg.addColorStop(0,this.col+'aa');gg.addColorStop(1,'transparent')
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(this.x,y,this.r*2.4,0,Math.PI*2);ctx.fill()
    ctx.translate(this.x,y);ctx.rotate(this.spin*.1)
    const scX=Math.abs(Math.cos(this.spin));ctx.scale(Math.max(.1,scX),1)
    const cg=ctx.createRadialGradient(-this.r*.3,-this.r*.3,0,0,0,this.r)
    cg.addColorStop(0,'#fff8e0');cg.addColorStop(.5,this.col);cg.addColorStop(1,'#4a3400')
    ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,0,this.r,0,Math.PI*2);ctx.fill()
    ctx.scale(1/Math.max(.1,scX),1)
    ctx.fillStyle='rgba(255,255,220,.6)';ctx.font=`bold ${this.r}px sans-serif`
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('★',0,0)
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SCORE POP
// ═══════════════════════════════════════════════════════════════════════════
class ScorePop {
  constructor(x,y,txt,col){this.x=x;this.y=y;this.txt=txt||'+1';this.col=col||'#c6a84b';this.vy=-1.9;this.life=58;this.max=58}
  update(){this.y+=this.vy;this.vy*=.93;this.life--}
  dead(){return this.life<=0}
  draw(ctx){ctx.save();ctx.globalAlpha=this.life/this.max;ctx.fillStyle=this.col;ctx.font="700 13px 'Barlow Condensed',sans-serif";ctx.textAlign='center';ctx.fillText(this.txt,this.x,this.y);ctx.restore()}
}

// ═══════════════════════════════════════════════════════════════════════════
//  SPARK
// ═══════════════════════════════════════════════════════════════════════════
class Spark {
  constructor(x,y,col,fast){
    const a=rand(0,Math.PI*2),sp=fast?rand(3,10):rand(1.5,6)
    this.x=x;this.y=y;this.vx=Math.cos(a)*sp;this.vy=Math.sin(a)*sp
    this.r=rand(2,5.5);this.alpha=1;this.col=col||'198,168,75'
  }
  update(){this.x+=this.vx;this.y+=this.vy;this.vy+=.14;this.vx*=.97;this.alpha-=.025;this.r*=.97}
  dead(){return this.alpha<=0}
  draw(ctx){ctx.save();ctx.globalAlpha=Math.max(0,this.alpha);ctx.fillStyle=`rgb(${this.col})`;ctx.beginPath();ctx.arc(this.x,this.y,Math.max(.1,this.r),0,Math.PI*2);ctx.fill();ctx.restore()}
}

// ═══════════════════════════════════════════════════════════════════════════
//  PORTAL  (4 types: speed_up, gravity_flip, mini, restore)
// ═══════════════════════════════════════════════════════════════════════════
const PORTAL_TYPES = ['speed_up','gravity_flip','mini','restore']
const PORTAL_COLS  = { speed_up:'#44ffcc', gravity_flip:'#cc44ff', mini:'#ff44aa', restore:'#44aaff' }
const PORTAL_ICONS = { speed_up:'⚡', gravity_flip:'↕', mini:'⬡', restore:'✦' }

class Portal {
  constructor(x,type){
    this.x=x;this.w=18;this.h=H*.55;this.y=(H-this.h)/2
    this.type=type||PORTAL_TYPES[randi(0,3)]
    this.col=PORTAL_COLS[this.type];this.spin=0;this.glow=rand(0,Math.PI);this.triggered=false
  }
  update(spd){this.x-=spd;this.spin+=.055;this.glow+=.05}
  isGone(){return this.x+this.w<-14}
  hits(px,py){return !this.triggered&&px+PLAYER_W*.5>this.x&&px-PLAYER_W*.5<this.x+this.w}
  draw(ctx){
    const g=.5+Math.sin(this.glow)*.42
    ctx.save()
    const beam=ctx.createLinearGradient(this.x-18,0,this.x+this.w+18,0)
    beam.addColorStop(0,'transparent');beam.addColorStop(.3,this.col+'28');beam.addColorStop(.7,this.col+'48');beam.addColorStop(1,'transparent')
    ctx.fillStyle=beam;ctx.fillRect(this.x-18,this.y,this.w+36,this.h)
    ctx.globalAlpha=.78*g;ctx.fillStyle=this.col;ctx.fillRect(this.x,this.y,this.w,this.h)
    ctx.globalAlpha=g;ctx.fillStyle='#fff';ctx.font='10px sans-serif';ctx.textAlign='center'
    const ic=PORTAL_ICONS[this.type]
    for(let i=0;i<5;i++){const yy=this.y+((i/5*this.h+this.spin*12)%this.h);ctx.fillText(ic,this.x+this.w/2,yy+10)}
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CHECKPOINT RING
// ═══════════════════════════════════════════════════════════════════════════
class CheckpointRing {
  constructor(x){this.x=x;this.y=H/2;this.r=26;this.spin=0;this.glow=0;this.passed=false}
  update(spd){this.x-=spd;this.spin+=.045;this.glow+=.07}
  isGone(){return this.x<-55}
  hits(px,py){if(this.passed)return false;const dx=px-this.x,dy=py-this.y;return Math.sqrt(dx*dx+dy*dy)<this.r+10}
  draw(ctx){
    const g=.5+Math.sin(this.glow)*.44,col=this.passed?'#44ff88':'#ffd700'
    ctx.save()
    const gg=ctx.createRadialGradient(this.x,this.y,this.r*.6,this.x,this.y,this.r*2)
    gg.addColorStop(0,col+'55');gg.addColorStop(1,'transparent')
    ctx.fillStyle=gg;ctx.beginPath();ctx.arc(this.x,this.y,this.r*2,0,Math.PI*2);ctx.fill()
    ctx.strokeStyle=col;ctx.lineWidth=4*g;ctx.globalAlpha=.9
    ctx.beginPath();ctx.arc(this.x,this.y,this.r,0,Math.PI*2);ctx.stroke()
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.spin)
    ctx.strokeStyle=col+'aa';ctx.lineWidth=1.5
    for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2;ctx.beginPath();ctx.moveTo(Math.cos(a)*this.r*.4,Math.sin(a)*this.r*.4);ctx.lineTo(Math.cos(a)*this.r*.84,Math.sin(a)*this.r*.84);ctx.stroke()}
    ctx.restore()
    if(this.passed){ctx.globalAlpha=.7;ctx.fillStyle='#44ff88';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText('✓',this.x,this.y+4)}
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ENERGY BOLT (ambient effect)
// ═══════════════════════════════════════════════════════════════════════════
class EnergyBolt {
  constructor(bi){
    const b=BIOMES[bi];this.x=rand(0,W);this.y1=rand(0,H*.4);this.y2=rand(H*.6,H)
    this.alpha=0;this.life=randi(8,18);this.segs=randi(4,8)
    this.col=`rgb(${b.accent[0]},${b.accent[1]},${b.accent[2]})`
  }
  update(){this.alpha=Math.min(1,this.alpha+.14);this.life--;if(this.life<5)this.alpha=Math.max(0,this.alpha-.22)}
  dead(){return this.life<=0&&this.alpha<=0}
  draw(ctx){
    ctx.save();ctx.globalAlpha=this.alpha*.3;ctx.strokeStyle=this.col;ctx.lineWidth=rand(.5,1.8)
    ctx.beginPath();ctx.moveTo(this.x,this.y1)
    for(let i=1;i<=this.segs;i++)ctx.lineTo(this.x+rand(-16,16),lerp(this.y1,this.y2,i/this.segs))
    ctx.stroke();ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  ██████ PATTERN SYSTEM ██████
//
//  Each pattern is a factory function that returns an array of Obstacle
//  objects for one "wave". The pattern decides obstacle count, spacing,
//  and shape. The game picks patterns based on tier.
//
//  Obstacle primitives:
//    ColBlock(x,y,w,h)   — a solid rectangle (no gap)
//    GapPillar(x,gap,y)  — full-height column with gap at y±gap/2
//    SpikeRow(x,dir,n)   — n spikes from ceiling (dir='down') or floor ('up')
//    FloatBlock(x,y,w,h) — floating rectangle, no wall connection
//    MovingBlock(x,y,w,h,amp,spd) — vertically oscillating block
// ═══════════════════════════════════════════════════════════════════════════

// ─── Shared block/spike drawing helpers (used by all patterns) ────────────
function _colForBiome(bi){const b=BIOMES[bi];return b}
function _drawSolidBlock(ctx,x,y,w,h,b,glow){
  if(h<=0||w<=0)return
  const [pr,pg,pb]=b.pillar;const [br,bg,bb]=b.border;const g=.42+Math.sin(glow)*.26
  const gr=ctx.createLinearGradient(x,0,x+w,0)
  gr.addColorStop(0,`rgba(${pr},${pg},${pb},.97)`)
  gr.addColorStop(.5,`rgba(${Math.min(pr+22,255)},${Math.min(pg+14,255)},${Math.min(pb+30,255)},.97)`)
  gr.addColorStop(1,`rgba(${Math.max(pr-4,0)},${Math.max(pg-2,0)},${Math.max(pb-6,0)},.97)`)
  ctx.fillStyle=gr;ctx.fillRect(x,y,w,h)
  ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*.5})`;ctx.lineWidth=1.1;ctx.strokeRect(x,y,w,h)
  ctx.save();ctx.globalAlpha=.08
  for(let ly=y+10;ly<y+h;ly+=14){ctx.fillStyle=`rgba(${br},${bg},${bb},1)`;ctx.fillRect(x+3,ly,w-6,1)}
  ctx.restore()
}
function _drawEdgeGlow(ctx,x,w,y,dir,b,glow){
  const [br,bg,bb]=b.border;const g=.42+Math.sin(glow)*.26
  const eg=ctx.createLinearGradient(0,dir==='down'?y-14:y,0,dir==='down'?y:y+14)
  eg.addColorStop(dir==='down'?0:1,'transparent')
  eg.addColorStop(dir==='down'?1:0,`rgba(${br},${bg},${bb},${g*.55})`)
  ctx.fillStyle=eg;ctx.fillRect(x,dir==='down'?y-14:y,w,14)
}
function _drawSpikeTri(ctx,tip,base,cx,b,glow){
  const [br,bg,bb]=b.border;const g=.42+Math.sin(glow)*.26
  ctx.fillStyle=`rgba(${br},${bg},${bb},${g*.88})`
  ctx.beginPath();ctx.moveTo(cx-5,base);ctx.lineTo(cx+5,base);ctx.lineTo(cx,tip);ctx.closePath();ctx.fill()
}

// ─── BASE OBSTACLE ─────────────────────────────────────────────────────────
class Obs {
  constructor(bi,spd){this.bi=bi;this.spd=spd;this.glow=rand(0,Math.PI*2);this.tick=0;this.passed=false;this.hit=false}
  update(){this.glow+=.048;this.tick++}
  isGone(){return false}
  maxRight(){return 0} // rightmost x edge
  hits(px,py){return false}
  draw(ctx){}
}

// ─── PILLAR (classic full-height column with a gap) ────────────────────────
class PillarObs extends Obs {
  constructor(x,spd,gapY,gapH,bi,wobAmp=0){
    super(bi,spd);this.x=x;this.w=44;this.gapY=gapY;this.gapH=gapH
    this.baseGapY=gapY;this.wobAmp=wobAmp;this.wobP=rand(0,Math.PI*2);this.wobSpd=rand(.018,.036)
  }
  update(){super.update();this.x-=this.spd;if(this.wobAmp>0){this.wobP+=this.wobSpd;this.gapY=this.baseGapY+Math.sin(this.wobP)*this.wobAmp}}
  isGone(){return this.x+this.w<-14}
  maxRight(){return this.x+this.w}
  hits(px,py){
    const hw=PLAYER_W/2-HITBOX_PAD,hh=PLAYER_H/2-HITBOX_PAD
    if(px+hw<this.x||px-hw>this.x+this.w)return false
    if(py-hh<this.gapY||py+hh>this.gapY+this.gapH)return true
    return false
  }
  draw(ctx){
    const b=BIOMES[this.bi]
    _drawSolidBlock(ctx,this.x,0,this.w,this.gapY,b,this.glow)
    if(this.gapY>0)_drawEdgeGlow(ctx,this.x,this.w,this.gapY,'down',b,this.glow)
    _drawSolidBlock(ctx,this.x,this.gapY+this.gapH,this.w,H-(this.gapY+this.gapH),b,this.glow)
    if(this.gapY+this.gapH<H)_drawEdgeGlow(ctx,this.x,this.w,this.gapY+this.gapH,'up',b,this.glow)
  }
}

// ─── CEILING SHELF (low ceiling block, open floor) ─────────────────────────
class CeilShelf extends Obs {
  constructor(x,spd,ceilH,w,bi){
    super(bi,spd);this.x=x;this.w=w||rand(80,180);this.ceilH=ceilH
    this.spikes=Array.from({length:randi(1,4)},()=>({xOff:rand(10,this.w-10),h:rand(10,20)}))
  }
  update(){super.update();this.x-=this.spd}
  isGone(){return this.x+this.w<-14}
  maxRight(){return this.x+this.w}
  hits(px,py){
    const hw=PLAYER_W/2-HITBOX_PAD,hh=PLAYER_H/2-HITBOX_PAD
    if(px+hw<this.x||px-hw>this.x+this.w)return false
    if(py-hh<this.ceilH)return true
    for(const s of this.spikes)if(Math.abs(px-(this.x+s.xOff))<5&&py-hh<this.ceilH+s.h)return true
    return false
  }
  draw(ctx){
    const b=BIOMES[this.bi]
    _drawSolidBlock(ctx,this.x,0,this.w,this.ceilH,b,this.glow)
    _drawEdgeGlow(ctx,this.x,this.w,this.ceilH,'down',b,this.glow)
    this.spikes.forEach(s=>_drawSpikeTri(ctx,this.ceilH+s.h,this.ceilH,this.x+s.xOff,b,this.glow))
  }
}

// ─── FLOOR SHELF (raised floor, open ceiling) ──────────────────────────────
class FloorShelf extends Obs {
  constructor(x,spd,floorY,w,bi){
    super(bi,spd);this.x=x;this.w=w||rand(80,180);this.floorY=floorY
    this.spikes=Array.from({length:randi(1,4)},()=>({xOff:rand(10,this.w-10),h:rand(10,20)}))
  }
  update(){super.update();this.x-=this.spd}
  isGone(){return this.x+this.w<-14}
  maxRight(){return this.x+this.w}
  hits(px,py){
    const hw=PLAYER_W/2-HITBOX_PAD,hh=PLAYER_H/2-HITBOX_PAD
    if(px+hw<this.x||px-hw>this.x+this.w)return false
    if(py+hh>this.floorY)return true
    for(const s of this.spikes)if(Math.abs(px-(this.x+s.xOff))<5&&py+hh>this.floorY-s.h)return true
    return false
  }
  draw(ctx){
    const b=BIOMES[this.bi]
    _drawSolidBlock(ctx,this.x,this.floorY,this.w,H-this.floorY,b,this.glow)
    _drawEdgeGlow(ctx,this.x,this.w,this.floorY,'up',b,this.glow)
    this.spikes.forEach(s=>_drawSpikeTri(ctx,this.floorY-s.h,this.floorY,this.x+s.xOff,b,this.glow))
  }
}

// ─── SPIKE CLUSTER (ceiling or floor spikes only, open on other side) ──────
class SpikeCluster extends Obs {
  constructor(x,spd,dir,bi,n,tier){
    super(bi,spd);this.dir=dir;this.totalW=0
    const count=n||randi(2,5+tier)
    this.spikes=Array.from({length:count},(_, i)=>{
      const sw=rand(8,16),sh=rand(18+tier*4,48+tier*7),sx=x+i*22+rand(-3,3)
      this.totalW=Math.max(this.totalW,(sx-x)+sw+5)
      return{x:sx,w:sw,h:sh,glow:rand(0,Math.PI*2)}
    })
  }
  update(){super.update();this.spikes.forEach(s=>{s.x-=this.spd;s.glow+=.05})}
  isGone(){return this.spikes.every(s=>s.x+s.w<-10)}
  maxRight(){return Math.max(...this.spikes.map(s=>s.x+s.w))}
  hits(px,py){
    const hw=PLAYER_W/2-HITBOX_PAD,hh=PLAYER_H/2-HITBOX_PAD
    for(const s of this.spikes){
      if(px+hw<s.x-s.w/2||px-hw>s.x+s.w/2)continue
      if(this.dir==='down'&&py-hh<s.h)return true
      if(this.dir==='up'  &&py+hh>H-s.h)return true
    }
    return false
  }
  draw(ctx){
    const b=BIOMES[this.bi]
    this.spikes.forEach(s=>{
      const g=.45+Math.sin(s.glow)*.28
      const [pr,pg,pb]=b.pillar;const [br,bg,bb]=b.border
      if(this.dir==='down'){
        const cg=ctx.createLinearGradient(s.x,0,s.x,s.h)
        cg.addColorStop(0,`rgba(${pr},${pg},${pb},.98)`);cg.addColorStop(1,`rgba(${br},${bg},${bb},${g*.85})`)
        ctx.fillStyle=cg;ctx.beginPath()
        ctx.moveTo(s.x-s.w/2,0);ctx.lineTo(s.x+s.w/2,0);ctx.lineTo(s.x+s.w*.25,s.h);ctx.lineTo(s.x-s.w*.25,s.h);ctx.closePath();ctx.fill()
        ctx.save();ctx.globalAlpha=g*.5;ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`;ctx.lineWidth=1.2
        ctx.beginPath();ctx.arc(s.x,s.h-2,3,0,Math.PI*2);ctx.stroke();ctx.restore()
      } else {
        const cg=ctx.createLinearGradient(s.x,H,s.x,H-s.h)
        cg.addColorStop(0,`rgba(${pr},${pg},${pb},.98)`);cg.addColorStop(1,`rgba(${br},${bg},${bb},${g*.85})`)
        ctx.fillStyle=cg;ctx.beginPath()
        ctx.moveTo(s.x-s.w/2,H);ctx.lineTo(s.x+s.w/2,H);ctx.lineTo(s.x+s.w*.25,H-s.h);ctx.lineTo(s.x-s.w*.25,H-s.h);ctx.closePath();ctx.fill()
        ctx.save();ctx.globalAlpha=g*.5;ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`;ctx.lineWidth=1.2
        ctx.beginPath();ctx.arc(s.x,H-s.h+2,3,0,Math.PI*2);ctx.stroke();ctx.restore()
      }
    })
  }
}

// ─── FLOATING BLOCK (mid-air obstacle, dodge around) ───────────────────────
class FloatBlock extends Obs {
  constructor(x,spd,y,w,h,bi,moveAmp=0){
    super(bi,spd);this.x=x;this.y=y;this.w=w;this.h=h
    this.moveAmp=moveAmp;this.baseY=y;this.moveP=rand(0,Math.PI*2);this.moveSpd=rand(.022,.048)
    this.type=randi(0,2);this.rot=rand(0,Math.PI*2);this.rotSpd=rand(-.02,.02)
  }
  update(){super.update();this.x-=this.spd;this.rot+=this.rotSpd;if(this.moveAmp>0){this.moveP+=this.moveSpd;this.y=this.baseY+Math.sin(this.moveP)*this.moveAmp}}
  isGone(){return this.x+this.w<-14}
  maxRight(){return this.x+this.w}
  hits(px,py){
    const hw=PLAYER_W/2-HITBOX_PAD,hh=PLAYER_H/2-HITBOX_PAD
    if(this.type===2){const dx=px-(this.x+this.w/2),dy=py-(this.y+this.h/2);return Math.sqrt(dx*dx+dy*dy)<Math.min(this.w,this.h)/2+Math.min(hw,hh)}
    return px+hw>this.x&&px-hw<this.x+this.w&&py+hh>this.y&&py-hh<this.y+this.h
  }
  draw(ctx){
    const b=BIOMES[this.bi];const [br,bg,bb]=b.border;const [pr,pg,pb]=b.pillar
    const g=.45+Math.sin(this.glow)*.3
    const cx=this.x+this.w/2,cy=this.y+this.h/2
    ctx.save();ctx.translate(cx,cy);ctx.rotate(this.rot)
    if(this.type===0){
      const gr=ctx.createRadialGradient(0,0,0,0,0,this.w*.7)
      gr.addColorStop(0,`rgba(${Math.min(pr+30,255)},${Math.min(pg+20,255)},${Math.min(pb+40,255)},.95)`)
      gr.addColorStop(1,`rgba(${pr},${pg},${pb},.95)`)
      ctx.fillStyle=gr;ctx.fillRect(-this.w/2,-this.h/2,this.w,this.h)
      ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*.7})`;ctx.lineWidth=2;ctx.strokeRect(-this.w/2,-this.h/2,this.w,this.h)
    } else if(this.type===1){
      const r=Math.min(this.w,this.h)/2
      ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r,0);ctx.lineTo(0,r);ctx.lineTo(-r,0);ctx.closePath()
      const dg=ctx.createRadialGradient(0,-r*.3,0,0,0,r)
      dg.addColorStop(0,`rgba(${Math.min(br+60,255)},${Math.min(bg+40,255)},${Math.min(bb+60,255)},.95)`)
      dg.addColorStop(1,`rgba(${br},${bg},${bb},.88)`)
      ctx.fillStyle=dg;ctx.fill();ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*.9})`;ctx.lineWidth=2;ctx.stroke()
    } else {
      const r=Math.min(this.w,this.h)/2
      const gg=ctx.createRadialGradient(-r*.2,-r*.2,0,0,0,r)
      gg.addColorStop(0,`rgba(${Math.min(br+80,255)},${Math.min(bg+60,255)},${Math.min(bb+80,255)},.9)`)
      gg.addColorStop(1,`rgba(${pr},${pg},${pb},.95)`)
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=gg;ctx.fill()
      ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*.85})`;ctx.lineWidth=1.8;ctx.stroke()
      ctx.fillStyle='rgba(255,255,255,.8)';ctx.beginPath();ctx.arc(r*.4,-r*.2,r*.22,0,Math.PI*2);ctx.fill()
      ctx.fillStyle='rgba(0,0,0,.9)';ctx.beginPath();ctx.arc(r*.48,-r*.2,r*.1,0,Math.PI*2);ctx.fill()
      ctx.globalAlpha=.55;ctx.fillStyle=`rgba(${br},${bg},${bb},.7)`
      ctx.beginPath();ctx.moveTo(-r*.2,-r);ctx.lineTo(-r*.6,-r*1.4);ctx.lineTo(-r*.9,-r*.7);ctx.closePath();ctx.fill()
    }
    ctx.globalAlpha=g*.16;ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`;ctx.lineWidth=6
    if(this.type===2){ctx.beginPath();ctx.arc(0,0,Math.min(this.w,this.h)/2+4,0,Math.PI*2);ctx.stroke()}
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PATTERN LIBRARY  (32 patterns across all tiers)
//  Each returns an array of Obs objects.  x = starting x of pattern.
// ═══════════════════════════════════════════════════════════════════════════
function makePattern(name, x, spd, gap, bi, tier) {
  const obs = []
  const pw  = 44     // pillar width
  const CX  = W + x  // absolute canvas x

  const pill = (ox, gapY, gapH, wob=0) => new PillarObs(CX+ox, spd, gapY, gapH||gap, bi, wob)
  const ceil = (ox, cH, w)  => new CeilShelf(CX+ox, spd, cH, w, bi)
  const fl   = (ox, fY, w)  => new FloorShelf(CX+ox, spd, fY, w, bi)
  const spkD = (ox, n)      => new SpikeCluster(CX+ox, spd, 'down', bi, n, tier)
  const spkU = (ox, n)      => new SpikeCluster(CX+ox, spd, 'up',   bi, n, tier)
  const flt  = (ox, oy, w, h, mv=0) => new FloatBlock(CX+ox, spd, oy, w, h, bi, mv)

  const mid  = H/2 - gap/2   // gapY for centred pillar
  const lo   = H*0.6 - gap/2
  const hi   = H*0.28 - gap/2
  const safe = 55            // margin from walls

  switch(name) {
    // ── TIER 0-1 ─────────────────────────────────────────────────────────
    case 'corridor':
      // Single centred pillar — pure breathing room
      obs.push(pill(0, mid, gap))
      break

    case 'spike_floor':
      // Just floor spikes, wide open ceiling
      obs.push(spkU(0, randi(2,4)))
      break

    case 'spike_ceil':
      // Ceiling spikes, wide open floor
      obs.push(spkD(0, randi(2,4)))
      break

    case 'both_spikes':
      // Sparse spikes on both sides, wide gap between them
      obs.push(spkD(0, 2), spkU(55, 2))
      break

    // ── TIER 2-3 ─────────────────────────────────────────────────────────
    case 'diagonal_shift':
      // Pillar high, then pillar low — force a diagonal path
      obs.push(pill(0, hi, gap), pill(90, lo, gap))
      break

    case 'wave_corridor':
      // Pillars whose centres undulate
      for(let i=0;i<3;i++){
        const gy=H/2+(Math.sin(i*1.3)*60)-gap/2
        obs.push(pill(i*90, clamp(gy, safe, H-safe-gap), gap))
      }
      break

    case 'tight_corridor':
      // One pillar, gap tighter than default
      obs.push(pill(0, mid, Math.max(gap*.85, 80)))
      break

    case 'double_wall':
      // Two adjacent pillars, must thread between them
      obs.push(pill(0, H*.2, gap*1.1), pill(pw+10, H*.5-gap/2, gap*1.1))
      break

    case 'floor_shelf':
      // Long raised floor section
      obs.push(fl(0, H*.68, rand(120,180)))
      break

    case 'ceil_shelf':
      obs.push(ceil(0, H*.32, rand(120,180)))
      break

    case 'float_dodge':
      // Mid-air block to dodge around (above or below)
      obs.push(flt(0, H*.35, 40, 40, 0), flt(80, H*.58, 36, 36, 0))
      break

    // ── TIER 4-5 ─────────────────────────────────────────────────────────
    case 'zigzag':
      // Alternating high-low pillars, forces fast altitude changes
      ;[hi, lo, mid, hi, lo].forEach((gy, i) => obs.push(pill(i*80, clamp(gy,safe,H-safe-gap), gap)))
      break

    case 'mid_wall':
      // A floating block dead-centre — must go above or below
      obs.push(flt(0, H*.5-30, 44, 60, 0))
      break

    case 'moving_floor':
      // Floor shelf that bobs vertically
      obs.push(fl(0, H*.6, rand(100,150)), new FloatBlock(CX+rand(140,180), spd, H*.4, 44, 44, bi, 28))
      break

    case 'triple_wall':
      // Three pillars, centres cascade diagonally
      obs.push(pill(0, hi, gap), pill(pw+12, mid, gap), pill((pw+12)*2, lo, gap))
      break

    case 'sandwich':
      // Ceiling shelf + floor shelf = tight sandwich passage
      {const cH=H*.28,fY=H*.72;obs.push(ceil(0,cH,rand(130,170)),fl(rand(0,40),fY,rand(130,170)))}
      break

    case 'saw_enter':
      // Spike gauntlet entrance — ceil & floor spikes facing each other
      obs.push(spkD(0,3), spkU(22,3), spkD(55,3), spkU(77,3))
      break

    // ── TIER 6-7 ─────────────────────────────────────────────────────────
    case 'saw_gauntlet':
      // Dense alternating spike pairs
      for(let i=0;i<6;i++) obs.push(i%2===0 ? spkD(i*30,3) : spkU(i*30,3))
      break

    case 'moving_ceiling':
      obs.push(ceil(0, H*(rand(.22,.38)), rand(100,160)))
      obs.push(flt(120, H*.5, 38, 38, bi, 35))
      break

    case 'narrow_saw':
      // Pillar with tiny gap + adjacent spikes
      obs.push(pill(0, mid, Math.max(gap*.75,70)), spkD(pw+15, 2), spkU(pw+35, 2))
      break

    case 'double_saws':
      obs.push(spkD(0,4), spkU(50,4), spkD(110,3), spkU(150,3))
      break

    case 'crusher':
      // Moving floater that forces timing
      obs.push(flt(0, H*.2, 60, H*.55, bi, 50))
      break

    case 'nightmare_corridor':
      // Narrow pillar + saws on both sides
      obs.push(
        spkU(0,2), pill(40, mid, Math.max(gap*.7,65)), spkD(pw+52,2),
        spkU(pw+72,2), pill(pw*2+60, H*.3, Math.max(gap*.7,65))
      )
      break

    // ── TIER 8-9 ─────────────────────────────────────────────────────────
    case 'triple_saws':
      for(let i=0;i<9;i++) obs.push(i%3===0?spkD(i*28,4):i%3===1?spkU(i*28,4):flt(i*28,H*.45,28,28,bi,0))
      break

    case 'full_chaos':
      obs.push(
        spkU(0,3), flt(30, H*.3, 38, 38, bi, 40), pill(80, mid, Math.max(gap*.65,60)),
        spkD(pw+95,3), flt(160, H*.6, 36, 36, bi, 30)
      )
      break

    case 'wall_of_death':
      // Two pillars very close together, gaps don't align — need to thread through quickly
      obs.push(pill(0, H*.18, gap*.9), pill(pw+8, H*.55, gap*.9))
      break

    case 'impossible_gauntlet':
      obs.push(
        ceil(0, H*.22, 60), fl(70, H*.75, 60),
        pill(140, H*.35, Math.max(gap*.6,55)),
        spkD(195,5), spkU(240,5)
      )
      break

    case 'death_zone':
      for(let i=0;i<5;i++) obs.push(pill(i*(pw+6), H*(i%2===0?.15:.55), Math.max(gap*.6,55)))
      break

    // ── TIER 10-11 ───────────────────────────────────────────────────────
    case 'pixel_corridor':
      // Extremely tight pillars, machine-precise
      ;[H*.1,H*.7,H*.35,H*.55,H*.2,H*.65].forEach((gy,i)=>obs.push(pill(i*(pw+4),clamp(gy,30,H-30-Math.max(gap*.5,50)),Math.max(gap*.5,50))))
      break

    case 'triple_threat':
      obs.push(
        spkD(0,6), spkU(30,6),
        pill(80, H*.3, Math.max(gap*.55,48)), pill(pw+90, H*.52, Math.max(gap*.55,48)),
        spkD(200,5), spkU(230,5)
      )
      break

    case 'GD_impossible_1':
      // Moving pillar + flanking saws + floater
      obs.push(
        flt(0, H*.35, 44, 44, bi, 55),
        pill(60, mid, Math.max(gap*.5,45), Math.max(gap*.5,45)>.01?28:0),
        spkD(pw+75,6), spkU(pw+105,6),
        flt(180, H*.6, 40, 40, bi, 45)
      )
      break

    case 'GD_impossible_2':
      for(let i=0;i<8;i++){
        const gy=H*.5+(Math.sin(i*.9)*70)-Math.max(gap*.4,40)/2
        obs.push(pill(i*(pw+3),clamp(gy,25,H-25-Math.max(gap*.4,40)),Math.max(gap*.4,40)))
      }
      break

    case 'GD_impossible_3':
      obs.push(
        ceil(0,H*.15,50), fl(60,H*.82,50),
        pill(120,H*.3,Math.max(gap*.4,40)), pill(pw+128,H*.55,Math.max(gap*.4,40)),
        ceil(210,H*.18,45), fl(268,H*.79,45),
        spkD(320,7), spkU(360,7)
      )
      break

    default:
      obs.push(pill(0, mid, gap))
  }
  return obs
}

// ─── PATTERN POOLS PER TIER ────────────────────────────────────────────────
const PATTERN_POOLS = [
  ['corridor','spike_floor','spike_ceil'],                                           // 0
  ['corridor','spike_floor','spike_ceil','both_spikes','float_dodge'],               // 1
  ['diagonal_shift','wave_corridor','tight_corridor','float_dodge','floor_shelf','ceil_shelf','both_spikes'], // 2
  ['diagonal_shift','double_wall','wave_corridor','floor_shelf','ceil_shelf','float_dodge','tight_corridor'], // 3
  ['zigzag','mid_wall','moving_floor','triple_wall','sandwich','saw_enter','double_wall'], // 4
  ['zigzag','saw_enter','sandwich','triple_wall','moving_floor','saw_gauntlet','crush_enter'], // 5 (crush_enter falls to default)
  ['saw_gauntlet','moving_ceiling','narrow_saw','double_saws','crusher','nightmare_corridor','triple_wall'], // 6
  ['saw_gauntlet','nightmare_corridor','double_saws','crusher','narrow_saw','triple_saws'], // 7
  ['triple_saws','full_chaos','wall_of_death','impossible_gauntlet','nightmare_corridor'], // 8
  ['triple_saws','wall_of_death','impossible_gauntlet','death_zone','full_chaos'],         // 9
  ['pixel_corridor','triple_threat','GD_impossible_1','death_zone','full_chaos'],          // 10
  ['GD_impossible_1','GD_impossible_2','GD_impossible_3','pixel_corridor','triple_threat'],// 11
]
function pickPattern(tier) {
  const pool = PATTERN_POOLS[Math.min(tier, PATTERN_POOLS.length-1)]
  return pool[randi(0, pool.length-1)]
}

// ═══════════════════════════════════════════════════════════════════════════
//  DRAW SHIP
// ═══════════════════════════════════════════════════════════════════════════
function drawShip(ctx, py, vy, holding, tick, inv, gravFlipped, spd, mini, bi) {
  ctx.save()
  ctx.translate(PLAYER_X, py)
  const tilt = gravFlipped ? -1 : 1
  ctx.rotate(clamp(vy*.055*tilt, -.52, .52))
  if (gravFlipped) ctx.scale(1, -1)
  if (mini) ctx.scale(.6, .6)
  if (inv && Math.floor(tick/4)%2===1) { ctx.restore(); return }

  const b=BIOMES[Math.min(bi,BIOMES.length-1)],acc=b.accent
  const sr=spd/4.2

  // Engine glow
  const elen=holding?36:22
  const eg=ctx.createLinearGradient(-PLAYER_W,0,-PLAYER_W-elen-8,0)
  eg.addColorStop(0,`rgba(${acc[0]},${acc[1]},${acc[2]},${holding?.5:.26})`)
  eg.addColorStop(1,'transparent')
  ctx.fillStyle=eg;ctx.beginPath();ctx.ellipse(-PLAYER_W-5,0,elen,holding?8:5,0,0,Math.PI*2);ctx.fill()

  // Speed streaks
  if(sr>1.2){
    ctx.save();ctx.globalAlpha=(sr-1.2)*.13;ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},1)`;ctx.lineWidth=1
    for(let i=0;i<4;i++){const yo=(i-1.5)*6;ctx.beginPath();ctx.moveTo(-PLAYER_W*1.4,yo);ctx.lineTo(-PLAYER_W*3.2,yo);ctx.stroke()}
    ctx.restore()
  }

  // Hull
  ctx.beginPath()
  ctx.moveTo(-PLAYER_W/2,-PLAYER_H/2);ctx.lineTo(PLAYER_W/2,-PLAYER_H/2+3)
  ctx.lineTo(PLAYER_W/2+6,0);ctx.lineTo(PLAYER_W/2,PLAYER_H/2-3)
  ctx.lineTo(-PLAYER_W/2,PLAYER_H/2);ctx.lineTo(-PLAYER_W/2-4,0);ctx.closePath()
  const hg=ctx.createLinearGradient(-PLAYER_W/2,-PLAYER_H/2,PLAYER_W/2,PLAYER_H/2)
  hg.addColorStop(0,'#d8b035');hg.addColorStop(.45,'#c6a84b');hg.addColorStop(1,'#7a6228')
  ctx.fillStyle=hg;ctx.fill()
  ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},.50)`;ctx.lineWidth=1.1;ctx.stroke()
  // Wing lines
  ctx.save();ctx.strokeStyle='rgba(255,220,120,.18)';ctx.lineWidth=.7
  ctx.beginPath();ctx.moveTo(-PLAYER_W/4,-PLAYER_H/2+1);ctx.lineTo(PLAYER_W/2+2,-PLAYER_H/2+4);ctx.stroke()
  ctx.beginPath();ctx.moveTo(-PLAYER_W/4,PLAYER_H/2-1);ctx.lineTo(PLAYER_W/2+2,PLAYER_H/2-4);ctx.stroke()
  ctx.restore()
  // Cockpit
  ctx.beginPath();ctx.ellipse(6,0,8,5,0,0,Math.PI*2)
  const cg=ctx.createRadialGradient(3,-1.5,0,6,0,8)
  cg.addColorStop(0,'rgba(220,248,255,.95)')
  cg.addColorStop(.6,`rgba(${Math.floor(acc[0]*.3+40)},${Math.floor(acc[1]*.3+80)},${Math.floor(acc[2]*.2+150)},.6)`)
  cg.addColorStop(1,'rgba(20,40,70,.55)')
  ctx.fillStyle=cg;ctx.fill()
  // Flame
  const fh=holding?rand(10,17):rand(3,8)
  ctx.beginPath();ctx.moveTo(-PLAYER_W/2,-3.5);ctx.lineTo(-PLAYER_W/2-fh-rand(0,4),0);ctx.lineTo(-PLAYER_W/2,3.5);ctx.closePath()
  const fg=ctx.createLinearGradient(-PLAYER_W/2,0,-PLAYER_W/2-fh-5,0)
  fg.addColorStop(0,'rgba(255,210,80,.98)');fg.addColorStop(.35,`rgba(${acc[0]},${acc[1]},${acc[2]},.78)`);fg.addColorStop(1,'transparent')
  ctx.fillStyle=fg;ctx.fill()
  if(holding){ctx.beginPath();ctx.moveTo(-PLAYER_W/2,-1.5);ctx.lineTo(-PLAYER_W/2-rand(4,9)-rand(0,2),0);ctx.lineTo(-PLAYER_W/2,1.5);ctx.closePath();ctx.fillStyle='rgba(255,255,200,.72)';ctx.fill()}
  // Outer glow
  const og=ctx.createRadialGradient(0,0,PLAYER_W*.3,0,0,PLAYER_W*2)
  og.addColorStop(0,`rgba(${acc[0]},${acc[1]},${acc[2]},.18)`);og.addColorStop(1,'transparent')
  ctx.fillStyle=og;ctx.beginPath();ctx.arc(0,0,PLAYER_W*2,0,Math.PI*2);ctx.fill()
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════
//  DRAW BACKGROUND
// ═══════════════════════════════════════════════════════════════════════════
function drawBG(ctx, tick, spd, surge, bi, biomeT) {
  const b=BIOMES[Math.min(bi,BIOMES.length-1)],sky=b.sky,acc=b.accent
  const bg=ctx.createLinearGradient(0,0,0,H)
  bg.addColorStop(0,sky[0]);bg.addColorStop(.5,sky[1]);bg.addColorStop(1,sky[2])
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H)
  if(biomeT>0){ctx.save();ctx.globalAlpha=Math.min(biomeT/28,1)*Math.max(0,biomeT/28)*.50;ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`;ctx.fillRect(0,0,W,H);ctx.restore()}
  if(surge>0){const sv=ctx.createRadialGradient(W/2,H/2,H*.1,W/2,H/2,H*1.0);sv.addColorStop(0,'transparent');sv.addColorStop(1,`rgba(220,30,30,${surge*.22})`);ctx.fillStyle=sv;ctx.fillRect(0,0,W,H)}
  ctx.save();ctx.globalAlpha=.042+surge*.024;ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},1)`;ctx.lineWidth=.65
  for(let i=0;i<11;i++){const y=(i/11)*H+14,off=(tick*(spd/4.2)*2.0)%W,len=rand(18,115),sx=(W-off+i*26)%W;ctx.beginPath();ctx.moveTo(sx,y);ctx.lineTo((sx-len+W*2)%W,y);ctx.stroke()}
  ctx.restore()
  const tg=ctx.createLinearGradient(0,0,0,22);tg.addColorStop(0,`rgba(${acc[0]},${acc[1]},${acc[2]},.82)`);tg.addColorStop(1,'transparent')
  ctx.fillStyle=tg;ctx.fillRect(0,0,W,22)
  const btg=ctx.createLinearGradient(0,H-22,0,H);btg.addColorStop(0,'transparent');btg.addColorStop(1,`rgba(${acc[0]},${acc[1]},${acc[2]},.82)`)
  ctx.fillStyle=btg;ctx.fillRect(0,H-22,W,22)
  ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},.50)`;ctx.lineWidth=1.8
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.stroke()
  ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(W,H);ctx.stroke()
}

// ═══════════════════════════════════════════════════════════════════════════
//  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════
const makeState = () => ({
  tick:0, py:H/2, vy:0.4,
  score:0, coins:0, dist:0, lives:3,
  obstacles:[],
  patTimer: 180,              // 3 seconds of clear runway before first obstacle
  particles: Array.from({length:PARTICLE_CNT},()=>new WaterParticle(0)),
  bubbles:   Array.from({length:BUBBLE_CNT},  ()=>new Bubble()),
  starLayers:[new StarLayer(55,.28,.7,.11),new StarLayer(28,.65,1.3,.17),new StarLayer(11,1.15,1.9,.24)],
  bolts:[], boltTimer:85,
  trail:[],
  pops:[], sparks:[],
  coins_arr:[], coinTimer:randi(200,380),
  portals:[],   portalTimer:randi(500,800),
  checkpoints:[],cpTimer:randi(550,900),
  inv:0, alive:true,
  surging:false, surgeT:0, surgeI:0, nextSurge:rand(450,750),
  tier:0, biome:0, biomeT:0,
  gravFlipped:false, gravTimer:0,
  speedBoost:0,
  mini:false, miniTimer:0,
  shake:new Shake(),
  prevHold:false,
})

// ═══════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function TheRiver() {
  const canvasRef  = useRef(null)
  const stateRef   = useRef(null)
  const animRef    = useRef(null)
  const holdRef    = useRef(false)

  const [screen,      setScreen]      = useState('intro')
  const [score,       setScore]       = useState(0)
  const [lives,       setLives]       = useState(3)
  const [distance,    setDistance]    = useState(0)
  const [coins,       setCoins]       = useState(0)
  const [biomeIdx,    setBiomeIdx]    = useState(0)
  const [tierName,    setTierName]    = useState('Easy')
  const [best,        setBest]        = useState(()=>parseInt(localStorage.getItem('river_best')||'0'))
  const [finalScore,  setFinalScore]  = useState(0)
  const [finalDist,   setFinalDist]   = useState(0)
  const [finalCoins,  setFinalCoins]  = useState(0)
  const [board,       setBoard]       = useState([])
  const [username,    setUsername]    = useState('')
  const [saving,      setSaving]      = useState(false)
  const [cdNum,       setCdNum]       = useState(3)
  const [surgeActive, setSurgeActive] = useState(false)
  const [biomeName,   setBiomeName]   = useState('STILL WATERS')
  const [showBiome,   setShowBiome]   = useState(false)
  const biomeFlashRef = useRef(null)

  const loadBoard = useCallback(async()=>{
    try{const q=query(collection(db,'river_leaderboard'),orderBy('score','desc'),limit(10));const snap=await getDocs(q);setBoard(snap.docs.map(d=>({id:d.id,...d.data()})))}catch(e){}
  },[])

  const saveScore = useCallback(async()=>{
    if(!username.trim())return
    setSaving(true)
    try{await addDoc(collection(db,'river_leaderboard'),{username:username.trim(),score:finalScore,distance:finalDist,coins:finalCoins,timestamp:serverTimestamp()});await loadBoard();setScreen('leaderboard')}catch(e){}
    setSaving(false)
  },[username,finalScore,finalDist,finalCoins,loadBoard])

  const startGame = useCallback(()=>{
    SFX.init();SFX.resume()
    holdRef.current=false
    const s=makeState();stateRef.current=s
    setScore(0);setLives(3);setDistance(0);setCoins(0);setBiomeIdx(0);setTierName('Easy')
    setSurgeActive(false);setShowBiome(false)
    SFX.startMusic(0);setScreen('playing')
  },[])

  const doCountdown = useCallback(()=>{
    SFX.init();SFX.resume()
    setScreen('countdown');let n=3;setCdNum(3)
    const iv=setInterval(()=>{n--;setCdNum(n);if(n<=0){clearInterval(iv);startGame()}},820)
    return()=>clearInterval(iv)
  },[startGame])

  const flashBiome = useCallback((name)=>{
    setBiomeName(name);setShowBiome(true)
    if(biomeFlashRef.current)clearTimeout(biomeFlashRef.current)
    biomeFlashRef.current=setTimeout(()=>setShowBiome(false),2500)
  },[])

  const handleDeath = useCallback((s)=>{
    SFX.stopEngine();SFX.death()
    for(let i=0;i<40;i++)s.sparks.push(new Spark(PLAYER_X,s.py,Math.random()>.5?'198,168,75':'230,80,80',false))
    s.shake.add(MAX_SHAKE)
    const next=s.lives-1
    if(next<=0){
      s.alive=false
      if(s.score>best){setBest(s.score);localStorage.setItem('river_best',String(s.score))}
      setFinalScore(s.score);setFinalDist(Math.round(s.dist));setFinalCoins(s.coins)
      SFX.stopMusic();setScreen('dead')
    } else {
      s.lives=next;s.vy=0;s.py=H/2;s.inv=165;s.gravFlipped=false;s.gravTimer=0;s.mini=false;s.miniTimer=0
      setLives(next);SFX.hit()
    }
  },[best])

  // ── GAME LOOP ─────────────────────────────────────────────────────────
  useEffect(()=>{
    if(screen!=='playing')return
    const canvas=canvasRef.current;if(!canvas)return
    const ctx=canvas.getContext('2d')
    const s=stateRef.current

    const loop=()=>{
      s.tick++
      const holding=holdRef.current

      // ── Tier & speed
      const tier=getTier(s.dist)
      s.tier=tier
      const baseSpd=getTierSpeed(s.dist)
      const gap=getTierGap(s.dist)
      const spd=baseSpd*(1+s.surgeI*.45)*(s.speedBoost>0?1.38:1.0)

      // ── Timers
      if(s.speedBoost>0)s.speedBoost--
      if(s.miniTimer>0){s.miniTimer--;if(s.miniTimer===0)s.mini=false}
      if(s.gravTimer>0){s.gravTimer--;if(s.gravTimer===0){s.gravFlipped=false}}

      // ── Biome
      let newBiome=0;for(let i=BIOMES.length-1;i>=0;i--){if(s.dist>=BIOMES[i].dist){newBiome=i;break}}
      if(newBiome!==s.biome){
        s.biome=newBiome;s.biomeT=55
        s.particles=Array.from({length:PARTICLE_CNT},()=>new WaterParticle(newBiome))
        SFX.startMusic(newBiome);SFX.biomeShift()
        setBiomeIdx(newBiome);flashBiome(BIOMES[newBiome].name)
      }
      if(s.biomeT>0)s.biomeT--

      // React state updates (throttled to avoid spam)
      if(s.tick%6===0){setTierName(TIERS[tier].name)}

      // ── Surge (starts only at tier>=2)
      if(!s.surging){
        s.nextSurge-=spd*.5;s.surgeI=Math.max(0,s.surgeI-.05)
        if(s.nextSurge<=0){s.surging=true;s.surgeT=rand(70,150);s.nextSurge=rand(380,720);if(tier>=2){SFX.surgeStart();setSurgeActive(true)}}
      } else {
        s.surgeT--;const surgeMax=lerpC(.3,.85,tier/11);s.surgeI=Math.min(surgeMax,s.surgeI+.055)
        if(s.surgeT<=0){s.surging=false;setSurgeActive(false)}
      }

      // ══════════════════════════════════════════════════════════════════
      //  PHYSICS
      // ══════════════════════════════════════════════════════════════════
      const gravDir=s.gravFlipped?-1:1

      if(holding&&!s.prevHold){
        s.vy=TAP_IMPULSE*gravDir        // fresh press = instant kick
      } else if(holding){
        s.vy+=(-LIFT_HOLD)*gravDir      // sustained hold = continuous thrust
      }
      s.vy+=GRAVITY*gravDir             // gravity every frame, always
      s.vy*=DRAG                        // air drag
      if(s.vy> MAX_VY) s.vy=lerp(s.vy, MAX_VY,.3)
      if(s.vy<-MAX_VY) s.vy=lerp(s.vy,-MAX_VY,.3)
      s.prevHold=holding

      s.py+=s.vy

      // Boundary = instant death, no grace
      const atBound=s.py<=PLAYER_H/2+1||s.py>=H-PLAYER_H/2-1
      if(atBound){
        s.py=clamp(s.py,PLAYER_H/2+1,H-PLAYER_H/2-1);s.vy=0
        if(s.inv<=0){handleDeath(s);if(!s.alive){animRef.current=requestAnimationFrame(loop);return}}
      }

      // Engine audio
      if(holding){SFX.startEngine();SFX.thrustUpdate(s.vy,spd)}else SFX.stopEngine()

      // Trail
      s.trail.unshift({x:PLAYER_X,y:s.py});if(s.trail.length>TRAIL_LEN)s.trail.pop()

      // Distance — scaled so 1 dist unit = roughly 1 real meter of play time.
      // We divide by BASE_SPEED (4.2) so distance accumulates at a fixed real-world
      // rate regardless of scroll speed. At 60fps:
      //   dist += 1.0/frame  →  60 dist/sec  →  tier 1 (dist=120) reached in ~2s  ← too fast
      //   dist += 0.25/frame →  15 dist/sec  →  tier 1 (dist=120) reached in ~8s  ← correct
      // Scaling: spd/BASE_SPEED gives 1.0 at tier 0, ~4.2 at IMPOSSIBLE.
      // Multiply by 0.25 so the player genuinely travels through tiers over minutes.
      s.dist += (spd / 4.2) * 0.25
      setDistance(Math.round(s.dist))

      // ── Spawn pattern
      // patTimer counts frames (not speed units) so difficulty tier alone
      // controls spacing — speed affects how fast obstacles cross the screen,
      // NOT how often new ones spawn.
      // Tier 0: ~220 frames between patterns (~3.7s = very relaxed breathing room)
      // Tier 11: ~68 frames (~1.1s = relentless)
      s.patTimer--
      if(s.patTimer<=0){
        const patName=pickPattern(tier)
        const newObs=makePattern(patName, 0, spd, gap, s.biome, tier)
        s.obstacles.push(...newObs)
        const frameGap = Math.round(lerpC(300, 80, tier / 11))
        s.patTimer = frameGap
      }

      // ── Spawn coins
      s.coinTimer-=spd;if(s.coinTimer<=0){s.coins_arr.push(new Coin(W+32,rand(55,H-55),s.biome));s.coinTimer=randi(180,380)}

      // ── Spawn portals (tier>=2)
      s.portalTimer-=spd
      if(s.portalTimer<=0&&tier>=2){
        const ptype=tier<4?'speed_up':PORTAL_TYPES[randi(0,3)]
        s.portals.push(new Portal(W+42,ptype));s.portalTimer=randi(440,800)
      }

      // ── Spawn checkpoints
      s.cpTimer-=spd;if(s.cpTimer<=0){s.checkpoints.push(new CheckpointRing(W+42));s.cpTimer=randi(500,850)}

      // ── Ambient bolts
      s.boltTimer--;if(s.boltTimer<=0){if(tier>=1)s.bolts.push(new EnergyBolt(s.biome));s.boltTimer=randi(28,70)}
      s.bolts=s.bolts.filter(b=>{b.update();return!b.dead()})

      // ── Update
      s.obstacles.forEach(o=>o.update());s.obstacles=s.obstacles.filter(o=>!o.isGone())
      s.coins_arr.forEach(c=>c.update(spd));s.coins_arr=s.coins_arr.filter(c=>!c.isGone())
      s.portals.forEach(p=>p.update(spd));s.portals=s.portals.filter(p=>!p.isGone())
      s.checkpoints.forEach(c=>c.update(spd));s.checkpoints=s.checkpoints.filter(c=>!c.isGone())
      if(s.inv>0)s.inv--

      // ── Collisions: obstacles
      // 'passed' = cleared safely (score point)
      // 'hit'    = collided with (no score, no re-trigger during inv)
      for(const o of s.obstacles){
        // Score point only if it passed the player WITHOUT being hit
        if(!o.passed && !o.hit && o.maxRight() < PLAYER_X - 4){
          o.passed = true
          s.score++
          s.pops.push(new ScorePop(PLAYER_X+36, s.py-22, '+1', '#c6a84b'))
          SFX.score()
          setScore(s.score)
        }
        // Collision: only if not invincible AND obstacle not already hit this life
        if(s.inv <= 0 && !o.hit && o.hits(PLAYER_X, s.py)){
          o.hit = true   // mark so it can't trigger again during same pass
          handleDeath(s)
          if(!s.alive){ animRef.current=requestAnimationFrame(loop); return }
          break
        }
      }

      // ── Collisions: coins
      for(const c of s.coins_arr){
        if(!c.picked&&c.hits(PLAYER_X,s.py)){
          c.picked=true;s.coins+=COIN_SCORE;s.score+=COIN_SCORE
          const col=c.col.replace('#','');const r=parseInt(col.slice(0,2),16),g=parseInt(col.slice(2,4),16),bv=parseInt(col.slice(4,6),16)
          for(let i=0;i<12;i++)s.sparks.push(new Spark(c.x,s.py,`${r},${g},${bv}`,true))
          s.pops.push(new ScorePop(c.x,s.py-18,`+${COIN_SCORE}`,c.col))
          SFX.coin();setCoins(s.coins);setScore(s.score);s.shake.add(1.5)
        }
      }

      // ── Collisions: portals
      for(const p of s.portals){
        if(p.hits(PLAYER_X,s.py)){
          p.triggered=true;SFX.portal(p.type);s.shake.add(3.5)
          if(p.type==='speed_up'){s.speedBoost=SPEED_BOOST_DUR;s.pops.push(new ScorePop(PLAYER_X,s.py-30,'⚡ SPEED UP','#44ffcc'))}
          else if(p.type==='gravity_flip'){s.gravFlipped=!s.gravFlipped;s.gravTimer=GRAV_FLIP_DUR;s.vy=0;s.pops.push(new ScorePop(PLAYER_X,s.py-30,'↕ FLIP','#cc44ff'))}
          else if(p.type==='mini'){s.mini=true;s.miniTimer=MINI_DUR;s.pops.push(new ScorePop(PLAYER_X,s.py-30,'⬡ MINI','#ff44aa'))}
          else{s.gravFlipped=false;s.gravTimer=0;s.speedBoost=0;s.mini=false;s.miniTimer=0;s.pops.push(new ScorePop(PLAYER_X,s.py-30,'✦ RESTORE','#44aaff'))}
        }
      }

      // ── Collisions: checkpoints
      for(const cp of s.checkpoints){
        if(cp.hits(PLAYER_X,s.py)){cp.passed=true;s.score+=3;SFX.checkpoint();s.pops.push(new ScorePop(cp.x,cp.y-38,'✦ +3','#ffd700'));s.shake.add(2);setScore(s.score)}
      }

      // ── Particles
      s.particles.forEach(p=>p.update(spd));s.bubbles.forEach(b=>b.update())
      s.starLayers.forEach(sl=>sl.update(spd))
      s.pops=s.pops.filter(p=>{p.update();return!p.dead()})
      s.sparks=s.sparks.filter(p=>{p.update();return!p.dead()})
      s.shake.update()

      // ══════════════════════════════════════════════════════════════════
      //  DRAW
      // ══════════════════════════════════════════════════════════════════
      ctx.save();ctx.translate(s.shake.x,s.shake.y)
      drawBG(ctx,s.tick,spd,s.surgeI,s.biome,s.biomeT)
      const acc=BIOMES[s.biome].accent
      s.starLayers.forEach(sl=>sl.draw(ctx,acc))
      s.bolts.forEach(b=>b.draw(ctx))
      s.bubbles.forEach(b=>b.draw(ctx,acc))
      s.particles.forEach(p=>p.draw(ctx))
      s.portals.forEach(p=>p.draw(ctx))
      s.checkpoints.forEach(c=>c.draw(ctx))
      s.obstacles.forEach(o=>o.draw(ctx))
      s.coins_arr.forEach(c=>c.draw(ctx))
      // Trail
      s.trail.forEach((pt,i)=>{
        const t=1-i/s.trail.length
        ctx.save();ctx.globalAlpha=t*.33;ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`
        ctx.beginPath();ctx.arc(pt.x,pt.y,lerp(.8,5.2,t),0,Math.PI*2);ctx.fill();ctx.restore()
      })
      s.sparks.forEach(p=>p.draw(ctx))
      drawShip(ctx,s.py,s.vy,holding,s.tick,s.inv>0,s.gravFlipped,spd,s.mini,s.biome)
      s.pops.forEach(p=>p.draw(ctx))
      // Surge
      if(s.surgeI>.28){ctx.save();ctx.globalAlpha=s.surgeI*.82;ctx.fillStyle='rgba(240,70,70,1)';ctx.font='700 10px "Barlow Condensed",sans-serif';ctx.textAlign='center';ctx.shadowColor='rgba(255,60,60,.8)';ctx.shadowBlur=12;ctx.fillText('▶ SURGE ◀',W/2,22);ctx.restore()}
      // Speed bar
      if(s.speedBoost>0){const pct=s.speedBoost/SPEED_BOOST_DUR;ctx.save();ctx.globalAlpha=pct*.70;ctx.strokeStyle='#44ffcc';ctx.lineWidth=2.2;ctx.strokeRect(8,H-16,(W-16)*pct,5);ctx.fillStyle='#44ffcc';ctx.globalAlpha=pct*.20;ctx.fillRect(8,H-16,(W-16)*pct,5);ctx.restore()}
      // Grav indicator
      if(s.gravFlipped){const pct=s.gravTimer/GRAV_FLIP_DUR;ctx.save();ctx.globalAlpha=.60;ctx.fillStyle='#cc44ff';ctx.font='500 9px sans-serif';ctx.textAlign='right';ctx.fillText(`↕ GRAVITY ${Math.ceil(s.gravTimer/60)}s`,W-8,H-8);ctx.restore()}
      // Mini indicator
      if(s.mini){ctx.save();ctx.globalAlpha=.58;ctx.fillStyle='#ff44aa';ctx.font='500 9px sans-serif';ctx.textAlign='left';ctx.fillText(`⬡ MINI ${Math.ceil(s.miniTimer/60)}s`,8,H-8);ctx.restore()}
      // Inv shimmer
      if(s.inv>0&&Math.floor(s.tick/3)%2===0){ctx.save();ctx.globalAlpha=.08;ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`;ctx.fillRect(0,0,W,H);ctx.restore()}
      ctx.restore()

      animRef.current=requestAnimationFrame(loop)
    }
    animRef.current=requestAnimationFrame(loop)
    return()=>{cancelAnimationFrame(animRef.current);SFX.stopEngine()}
  },[screen,handleDeath,flashBiome])

  // ── INPUT — full-screen touch registers even outside canvas ────────────
  useEffect(()=>{
    if(screen!=='playing')return

    const dn=(e)=>{e.preventDefault();SFX.resume();holdRef.current=true}
    const up=()=>{holdRef.current=false}
    const kd=(e)=>{if(['Space','ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)){e.preventDefault();SFX.resume();holdRef.current=true}}
    const ku=(e)=>{if(['Space','ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code))holdRef.current=false}

    // Attach to document (not just canvas) for full-screen mobile touch
    document.addEventListener('touchstart',dn,{passive:false})
    document.addEventListener('touchend',  up)
    document.addEventListener('touchcancel',up)
    document.addEventListener('mousedown', dn)
    document.addEventListener('mouseup',   up)
    window.addEventListener('keydown',kd)
    window.addEventListener('keyup',  ku)
    return()=>{
      document.removeEventListener('touchstart',dn)
      document.removeEventListener('touchend',  up)
      document.removeEventListener('touchcancel',up)
      document.removeEventListener('mousedown',dn)
      document.removeEventListener('mouseup',  up)
      window.removeEventListener('keydown',kd)
      window.removeEventListener('keyup',  ku)
    }
  },[screen])

  useEffect(()=>{loadBoard()},[loadBoard])
  useEffect(()=>()=>{SFX.stopMusic();SFX.stopEngine()},[])

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════
  const acc=BIOMES[Math.min(biomeIdx,BIOMES.length-1)].accent
  const accentCSS=`rgb(${acc.join(',')})`

  return (
    <div className="rv-wrap">

      {screen==='intro'&&(
        <div className="rv-screen">
          <p className="rv-label">The River</p>
          <h2 className="rv-title">Go<br/><em>Against.</em></h2>
          <p className="rv-sub">You are the light cutting through the current.<br/>The crowd flows against you. Find the gap.<br/><strong>Hold to rise. Release to fall.</strong></p>
          <div className="rv-rules">
            <div className="rv-rule"><span>↑</span><p>Hold / tap anywhere on screen — thrust upward</p></div>
            <div className="rv-rule"><span>↓</span><p>Release — fall naturally with gravity</p></div>
            <div className="rv-rule"><span>★</span><p>Coins give +5 score — grab them all</p></div>
            <div className="rv-rule"><span>⚡</span><p>Speed portals · Gravity flips · Mini mode · Restore</p></div>
            <div className="rv-rule"><span>✦</span><p>12 tiers from Easy to IMPOSSIBLE · 6 biomes</p></div>
          </div>
          {best>0&&<p className="rv-best">Your best: <strong>{best} pts</strong></p>}
          <button className="rv-btn rv-btn--gold" onClick={doCountdown}>Enter The River</button>
          <button className="rv-btn rv-btn--ghost" onClick={()=>{loadBoard();setScreen('leaderboard')}}>Leaderboard</button>
        </div>
      )}

      {screen==='countdown'&&(
        <div className="rv-screen rv-countdown">
          <p className="rv-label">Get Ready</p>
          <div className="rv-cd-num" key={cdNum}>{cdNum>0?cdNum:'GO!'}</div>
          <p className="rv-sub">Tap anywhere · Hold to thrust · Release to fall</p>
        </div>
      )}

      {screen==='playing'&&(
        <div className="rv-game">
          <div className="rv-hud" style={{'--accent':accentCSS}}>
            <div className="rv-hud-cell">
              <span className="rv-hud-label">Score</span>
              <span className="rv-hud-val">{score}</span>
            </div>
            <div className="rv-hud-cell rv-hud-center">
              <span className="rv-hud-label">Distance</span>
              <span className="rv-hud-val" style={{color:accentCSS}}>{distance}m</span>
            </div>
            <div className="rv-hud-cell rv-hud-right">
              <span className="rv-hud-label">Lives</span>
              <span className="rv-hud-val">
                {Array.from({length:3}).map((_,i)=>(
                  <span key={i} className={`rv-life ${i>=lives?'rv-life--lost':''}`}>◈</span>
                ))}
              </span>
            </div>
          </div>
          <div className="rv-canvas-wrap">
            <canvas ref={canvasRef} width={W} height={H} className="rv-canvas"/>
            {showBiome&&(
              <div className="rv-biome-flash" style={{color:accentCSS}}>
                <span className="rv-biome-label">ENTERING</span>
                <span className="rv-biome-name">{biomeName}</span>
              </div>
            )}
            {surgeActive&&<div className="rv-surge-banner">SURGE</div>}
          </div>
          <p className="rv-hint">Tap anywhere on screen to thrust · Release to fall</p>
        </div>
      )}

      {screen==='dead'&&(
        <div className="rv-screen">
          <p className="rv-label">Swept Away</p>
          <h2 className="rv-title rv-title--red">The current<br/><em>won this time.</em></h2>
          <div className="rv-stats">
            <div className="rv-stat"><span className="rv-stat-n">{finalScore}</span><span className="rv-stat-l">score</span></div>
            <div className="rv-stat"><span className="rv-stat-n">{finalDist}m</span><span className="rv-stat-l">distance</span></div>
            <div className="rv-stat"><span className="rv-stat-n rv-stat-gold">★{finalCoins}</span><span className="rv-stat-l">coins</span></div>
          </div>
          {finalScore>=best&&finalScore>0&&<p className="rv-newbest">✦ New Personal Best</p>}
          <div className="rv-save">
            <input className="rv-input" placeholder="Your name for the leaderboard" value={username} onChange={e=>setUsername(e.target.value)} maxLength={20}/>
            <button className="rv-btn rv-btn--gold" onClick={saveScore} disabled={saving||!username.trim()}>{saving?'Saving...':'Save Score'}</button>
          </div>
          <button className="rv-btn rv-btn--ghost" onClick={doCountdown}>Try Again</button>
          <button className="rv-btn rv-btn--ghost" onClick={()=>setScreen('intro')}>Back</button>
        </div>
      )}

      {screen==='leaderboard'&&(
        <div className="rv-screen">
          <p className="rv-label">The Few</p>
          <h2 className="rv-title">Those who<br/><em>held the line.</em></h2>
          <div className="rv-board">
            {board.length===0&&<p className="rv-board-empty">No scores yet. Be the first.</p>}
            {board.map((e,i)=>(
              <div key={e.id} className={`rv-board-row ${i===0?'rv-board-row--first':''}`}>
                <span className="rv-board-rank">#{i+1}</span>
                <span className="rv-board-name">{e.username}</span>
                <span className="rv-board-score">{e.score} pts</span>
                <span className="rv-board-coins">★{e.coins||0}</span>
                <span className="rv-board-dist">{e.distance}m</span>
              </div>
            ))}
          </div>
          <button className="rv-btn rv-btn--gold" onClick={doCountdown}>Play</button>
          <button className="rv-btn rv-btn--ghost" onClick={()=>setScreen('intro')}>Back</button>
        </div>
      )}

    </div>
  )
}