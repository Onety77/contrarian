import React, { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, addDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore'
import './TheRiver.css'

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const W              = 760
const H              = 420
const PLAYER_X       = 155

// ── PHYSICS ─────────────────────────────────────────────────────
// Core feel goals:
//   • Ship immediately falls when game starts (no input = fall)
//   • Single tap gives a noticeable upward kick (Geometry Dash style)
//   • Holding sustains upward thrust against gravity
//   • Releasing gives a smooth gravity arc back down
//   • No wall riding — boundary = instant death
const GRAVITY        = 0.55   // downward pull every frame (firm, natural)
const LIFT_HOLD      = 0.80   // continuous upward accel while holding
const TAP_IMPULSE    = -2   // instant vy set on fresh press (GD-style kick)
const MAX_VY_DOWN    = 8.0    // max fall speed
const DRAG           = 0.982  // gentle air resistance

const PLAYER_W       = 24
const PLAYER_H       = 16
const BASE_SPEED     = 3.6    // start slower so it feels easy
const MAX_SPEED      = 8.2    // cap for extreme late game
const PARTICLE_CNT   = 80
const BUBBLE_CNT     = 28
const TRAIL_LEN      = 22
const COIN_SCORE     = 5
const MAX_SHAKE      = 10

// ── DIFFICULTY CURVE ────────────────────────────────────────────
// difficulty index driven by distance; 0 = tutorial, 10 = insane
// Each tier unlocks new obstacle types and tightens gaps
const DIFF_THRESHOLDS = [0, 600, 1400, 2400, 3600, 5200, 7000, 9200, 12000, 15000]

// ── BIOMES: each unlocks at a distance milestone ─────────────────
const BIOMES = [
  {
    name:     'STILL WATERS',
    dist:     0,
    sky:      ['#04040e','#060614','#03030a'],
    accent:   [130, 90, 220],
    pillar:   [22,14,50],
    border:   [100,60,180],
    particle: [220,260],
    fog:      'rgba(40,20,80,0.08)',
  },
  {
    name:     'DEEP CURRENT',
    dist:     900,
    sky:      ['#060412','#09061d','#040310'],
    accent:   [170,110,255],
    pillar:   [28,18,58],
    border:   [120,70,200],
    particle: [225,270],
    fog:      'rgba(60,20,100,0.10)',
  },
  {
    name:     'LAVA VEIN',
    dist:     2200,
    sky:      ['#120404','#1c0605','#0e0302'],
    accent:   [255,110,50],
    pillar:   [60,18,8],
    border:   [220,80,20],
    particle: [0,38],
    fog:      'rgba(100,20,0,0.12)',
  },
  {
    name:     'ICE CAVERN',
    dist:     4000,
    sky:      ['#030c12','#04121c','#020a0e'],
    accent:   [70,195,255],
    pillar:   [8,35,58],
    border:   [50,170,240],
    particle: [190,212],
    fog:      'rgba(0,60,100,0.10)',
  },
  {
    name:     'VOID RIFT',
    dist:     6500,
    sky:      ['#070308','#0a040b','#050205'],
    accent:   [215,55,220],
    pillar:   [36,8,46],
    border:   [175,45,190],
    particle: [278,320],
    fog:      'rgba(80,0,100,0.14)',
  },
  {
    name:     'SOLAR STORM',
    dist:     10000,
    sky:      ['#0e0900','#1a1100','#0b0700'],
    accent:   [255,195,25],
    pillar:   [50,38,8],
    border:   [225,180,15],
    particle: [28,58],
    fog:      'rgba(100,60,0,0.12)',
  },
]

// ═══════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════
const rand   = (a, b)    => Math.random() * (b - a) + a
const randi  = (a, b)    => Math.floor(rand(a, b + 1))
const clamp  = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp   = (a, b, t) => a + (b - a) * t
const lerpc  = (a, b, t) => lerp(a, b, clamp(t, 0, 1))

// ═══════════════════════════════════════════════════════════════════
//  SCREEN SHAKE
// ═══════════════════════════════════════════════════════════════════
class Shake {
  constructor() { this.x = 0; this.y = 0; this.mag = 0; this.decay = 0.86 }
  add(mag) { this.mag = Math.min(this.mag + mag, MAX_SHAKE) }
  update() {
    if (this.mag < 0.15) { this.x = 0; this.y = 0; this.mag = 0; return }
    const a = rand(0, Math.PI * 2)
    this.x   = Math.cos(a) * this.mag
    this.y   = Math.sin(a) * this.mag
    this.mag *= this.decay
  }
}

// ═══════════════════════════════════════════════════════════════════
//  AUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════
class AudioEngine {
  constructor() { this.ctx = null; this.master = null; this.ready = false; this._oscPool = []; this._engineOsc = null; this._musicSchedulerActive = false; this._schedulerTimer = null }

  init() {
    if (this.ready) return
    try {
      this.ctx    = new (window.AudioContext || window.webkitAudioContext)()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.52
      this.master.connect(this.ctx.destination)
      this.ready  = true
    } catch(e) {}
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume() }

  // ── Rhythmic music synthesiser ───────────────────────────────
  // Builds a fully procedural looping track using Web Audio
  // scheduling. Each biome gets its own BPM, scale, and timbre.
  startMusic(biomeIdx) {
    if (!this.ready) return
    this.stopMusic()
    const ac  = this.ctx

    // Per-biome settings
    const configs = [
      // 0: Still Waters — slow, ambient, 80 bpm
      { bpm:80,  scale:[0,3,7,10,14],  root:55,  kick:true,  snare:false, arpOct:2, padVol:0.10, bassVol:0.18, arpVol:0.12, kickVol:0.28, filterHz:900,  padType:'triangle' },
      // 1: Deep Current — driving, 100 bpm
      { bpm:100, scale:[0,2,5,7,10],   root:58,  kick:true,  snare:true,  arpOct:2, padVol:0.08, bassVol:0.20, arpVol:0.14, kickVol:0.32, filterHz:1100, padType:'sawtooth' },
      // 2: Lava Vein — heavy, distorted, 110 bpm
      { bpm:110, scale:[0,1,5,6,10],   root:55,  kick:true,  snare:true,  arpOct:1, padVol:0.07, bassVol:0.22, arpVol:0.10, kickVol:0.38, filterHz:800,  padType:'sawtooth' },
      // 3: Ice Cavern — crisp, arpeggiated, 95 bpm
      { bpm:95,  scale:[0,2,4,7,9,11], root:65,  kick:true,  snare:false, arpOct:3, padVol:0.11, bassVol:0.16, arpVol:0.18, kickVol:0.22, filterHz:1400, padType:'triangle' },
      // 4: Void Rift — eerie, syncopated, 105 bpm
      { bpm:105, scale:[0,1,3,6,8,10], root:52,  kick:true,  snare:true,  arpOct:2, padVol:0.09, bassVol:0.19, arpVol:0.13, kickVol:0.30, filterHz:700,  padType:'square'   },
      // 5: Solar Storm — fast, aggressive, 125 bpm
      { bpm:125, scale:[0,2,4,7,9],    root:73,  kick:true,  snare:true,  arpOct:2, padVol:0.07, bassVol:0.24, arpVol:0.16, kickVol:0.42, filterHz:1200, padType:'sawtooth' },
    ]
    const cfg = configs[Math.min(biomeIdx, configs.length-1)]
    const beatLen = 60 / cfg.bpm       // seconds per beat
    const barLen  = beatLen * 4        // 4/4 time
    const noteLen = beatLen * 0.5      // 8th notes for arpeggio

    // Master chain: compressor → master gain
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -18; comp.knee.value = 6; comp.ratio.value = 4
    comp.attack.value = 0.003; comp.release.value = 0.25; comp.connect(this.master)
    const mg = ac.createGain(); mg.gain.value = 0.9; mg.connect(comp)
    this._musicGain = mg; this._musicComp = comp

    // Global low-pass filter for atmosphere
    const lp = ac.createBiquadFilter(); lp.type='lowpass'
    lp.frequency.value = cfg.filterHz; lp.Q.value = 0.8; lp.connect(mg)

    // ── PAD (sustained chords, always present) ─────────────────
    const padGain = ac.createGain(); padGain.gain.value = cfg.padVol; padGain.connect(lp)
    const chordNotes = [0, 4, 7, 11].map(s => cfg.root * Math.pow(2, s/12))
    chordNotes.forEach((freq, i) => {
      const o = ac.createOscillator(); const g = ac.createGain()
      o.type = cfg.padType; o.frequency.value = freq; o.detune.value = (i%2===0?4:-4)
      g.gain.value = 0.6 / (i+1); o.connect(g); g.connect(padGain); o.start()
      this._oscPool.push(o)
    })

    // ── BASS (root note, pumping rhythm) ───────────────────────
    const bassGain = ac.createGain(); bassGain.gain.value = cfg.bassVol; bassGain.connect(mg)
    const bassFilter = ac.createBiquadFilter(); bassFilter.type='lowpass'
    bassFilter.frequency.value = 280; bassFilter.Q.value = 2.0; bassFilter.connect(bassGain)
    const bassPattern = [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,1,0,0]  // 16 steps

    // ── ARPEGGIO (melody line) ──────────────────────────────────
    const arpGain = ac.createGain(); arpGain.gain.value = cfg.arpVol; arpGain.connect(lp)
    const arpFilter = ac.createBiquadFilter(); arpFilter.type='bandpass'
    arpFilter.frequency.value = 1200; arpFilter.Q.value = 1.5; arpFilter.connect(arpGain)
    const arpPattern = cfg.scale  // cycle through the scale

    // ── KICK (sine thud + noise) ────────────────────────────────
    const kickPattern = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]  // 4-on-floor variant
    // ── SNARE (noise burst) ─────────────────────────────────────
    const snarePattern = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0]  // 2 and 4

    // ── SCHEDULER ──────────────────────────────────────────────
    // Uses precise AudioContext time scheduling for tight rhythm
    const scheduleAhead = 0.2  // seconds to schedule ahead
    const lookAhead     = 0.05 // how often to call (seconds)
    let nextNoteTime    = ac.currentTime + 0.1
    let step16          = 0    // 16th-note counter
    let arpStep         = 0

    const scheduleNote = (time) => {
      const step = step16 % 16
      const stepLen = beatLen * 0.25  // 16th note duration

      // Kick
      if (cfg.kick && kickPattern[step]) {
        const kOsc = ac.createOscillator(); const kEnv = ac.createGain()
        kOsc.type = 'sine'; kOsc.frequency.setValueAtTime(160, time)
        kOsc.frequency.exponentialRampToValueAtTime(28, time + 0.12)
        kEnv.gain.setValueAtTime(cfg.kickVol, time)
        kEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.25)
        kOsc.connect(kEnv); kEnv.connect(mg)
        kOsc.start(time); kOsc.stop(time + 0.3)
        // Kick noise layer
        const kBuf = ac.createBuffer(1, Math.floor(ac.sampleRate*0.08), ac.sampleRate)
        const kd   = kBuf.getChannelData(0); for(let i=0;i<kd.length;i++) kd[i]=Math.random()*2-1
        const kSrc = ac.createBufferSource(); const kNG = ac.createGain()
        kSrc.buffer = kBuf; kNG.gain.setValueAtTime(cfg.kickVol*0.4, time)
        kNG.gain.exponentialRampToValueAtTime(0.001, time+0.08)
        kSrc.connect(kNG); kNG.connect(mg); kSrc.start(time)
      }

      // Snare
      if (cfg.snare && snarePattern[step]) {
        const sBuf = ac.createBuffer(1, Math.floor(ac.sampleRate*0.18), ac.sampleRate)
        const sd   = sBuf.getChannelData(0); for(let i=0;i<sd.length;i++) sd[i]=Math.random()*2-1
        const sSrc = ac.createBufferSource(); const sEnv = ac.createGain()
        const sF   = ac.createBiquadFilter(); sF.type='bandpass'; sF.frequency.value=3000; sF.Q.value=0.8
        sEnv.gain.setValueAtTime(0.20, time); sEnv.gain.exponentialRampToValueAtTime(0.001, time+0.18)
        sSrc.buffer = sBuf; sSrc.connect(sF); sF.connect(sEnv); sEnv.connect(mg); sSrc.start(time)
        // Snare tone
        const stO = ac.createOscillator(); const stE = ac.createGain()
        stO.type='triangle'; stO.frequency.value=220
        stE.gain.setValueAtTime(0.08, time); stE.gain.exponentialRampToValueAtTime(0.001, time+0.10)
        stO.connect(stE); stE.connect(mg); stO.start(time); stO.stop(time+0.12)
      }

      // Hi-hat (every 8th note at higher diff biomes)
      if (biomeIdx >= 2 && step % 2 === 0) {
        const hBuf = ac.createBuffer(1, Math.floor(ac.sampleRate*0.04), ac.sampleRate)
        const hd   = hBuf.getChannelData(0); for(let i=0;i<hd.length;i++) hd[i]=Math.random()*2-1
        const hSrc = ac.createBufferSource(); const hEnv = ac.createGain()
        const hF   = ac.createBiquadFilter(); hF.type='highpass'; hF.frequency.value=8000
        hEnv.gain.setValueAtTime(0.04, time); hEnv.gain.exponentialRampToValueAtTime(0.001, time+0.04)
        hSrc.buffer=hBuf; hSrc.connect(hF); hF.connect(hEnv); hEnv.connect(mg); hSrc.start(time)
      }

      // Bass note
      if (bassPattern[step]) {
        const scaleNote = cfg.scale[step % cfg.scale.length]
        const bassFreq  = cfg.root * 0.5 * Math.pow(2, scaleNote/12)
        const bOsc = ac.createOscillator(); const bEnv = ac.createGain()
        bOsc.type='sine'; bOsc.frequency.value=bassFreq
        bEnv.gain.setValueAtTime(cfg.bassVol*1.4, time)
        bEnv.gain.exponentialRampToValueAtTime(0.001, time+stepLen*3.2)
        bOsc.connect(bassFilter)
        bOsc.start(time); bOsc.stop(time+stepLen*3.5)
      }

      // Arpeggio (every 8th note, cycling the scale)
      if (step % 2 === 0) {
        const scaleIdx  = arpStep % arpPattern.length
        const octave    = Math.floor(arpStep / arpPattern.length) % cfg.arpOct
        const arpFreq   = cfg.root * Math.pow(2, (arpPattern[scaleIdx] + octave*12) / 12)
        const aOsc = ac.createOscillator(); const aEnv = ac.createGain()
        aOsc.type='square'; aOsc.frequency.value=arpFreq
        aEnv.gain.setValueAtTime(cfg.arpVol*1.2, time)
        aEnv.gain.exponentialRampToValueAtTime(0.001, time+noteLen*0.85)
        aOsc.connect(arpFilter)
        aOsc.start(time); aOsc.stop(time+noteLen)
        arpStep++
      }

      step16++
      nextNoteTime += stepLen
    }

    const tick = () => {
      if (!this._musicSchedulerActive) return
      while (nextNoteTime < ac.currentTime + scheduleAhead) {
        scheduleNote(nextNoteTime)
      }
      this._schedulerTimer = setTimeout(tick, lookAhead * 1000)
    }
    this._musicSchedulerActive = true
    tick()
  }

  stopMusic() {
    this._musicSchedulerActive = false
    if (this._schedulerTimer) { clearTimeout(this._schedulerTimer); this._schedulerTimer = null }
    this._oscPool.forEach(o => { try { o.stop(); o.disconnect() } catch(e){} })
    this._oscPool = []
    try { this._musicGain?.disconnect() } catch(e){}
    try { this._musicComp?.disconnect() } catch(e){}
  }

  startEngine() {
    if (!this.ready || this._engineOsc) return
    const ac = this.ctx
    const o = ac.createOscillator(); const g = ac.createGain(); const f = ac.createBiquadFilter()
    o.type = 'sawtooth'; o.frequency.value = 135
    g.gain.value = 0.11; f.type = 'bandpass'; f.frequency.value = 680; f.Q.value = 2.8
    o.connect(f); f.connect(g); g.connect(this.master); o.start()
    this._engineOsc = o; this._engineGain = g; this._engineFilt = f
  }

  stopEngine() {
    if (!this._engineOsc) return
    try {
      this._engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06)
      const o = this._engineOsc
      setTimeout(() => { try { o.stop(); o.disconnect() } catch(e){} }, 220)
    } catch(e){}
    this._engineOsc = null; this._engineGain = null; this._engineFilt = null
  }

  thrustUpdate(vy, spd) {
    if (!this._engineOsc) return
    try {
      const t = this.ctx.currentTime
      this._engineOsc.frequency.setTargetAtTime(150 + spd * 7, t, 0.06)
      this._engineFilt.frequency.setTargetAtTime(750 - vy * 18, t, 0.06)
    } catch(e){}
  }

  _burst(type, freq, dur, vol, sweep=null) {
    if (!this.ready) return
    const ac=this.ctx; const o=ac.createOscillator(); const e=ac.createGain(); const now=ac.currentTime
    o.type=type; o.frequency.value=freq
    e.gain.setValueAtTime(vol,now); e.gain.exponentialRampToValueAtTime(0.001,now+dur)
    if (sweep) o.frequency.exponentialRampToValueAtTime(sweep,now+dur)
    o.connect(e); e.connect(this.master); o.start(now); o.stop(now+dur+0.05)
  }

  _noise(dur, vol, freqLo=200, freqHi=1200) {
    if (!this.ready) return
    const ac=this.ctx; const len=Math.floor(ac.sampleRate*dur)
    const buf=ac.createBuffer(1,len,ac.sampleRate)
    const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1
    const src=ac.createBufferSource(); const e=ac.createGain(); const f=ac.createBiquadFilter()
    src.buffer=buf; e.gain.setValueAtTime(vol,ac.currentTime); e.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur)
    f.type='bandpass'; f.frequency.value=(freqLo+freqHi)/2
    src.connect(f); f.connect(e); e.connect(this.master); src.start()
  }

  score()      { this._burst('sine',880,0.08,0.22,1760); setTimeout(()=>this._burst('sine',1320,0.07,0.18),55) }
  coin()       { this._burst('square',1200,0.10,0.18,2400); setTimeout(()=>this._burst('square',1600,0.08,0.14),75) }
  hit()        { this._burst('sawtooth',80,0.3,0.42,20); this._noise(0.18,0.28) }
  death()      { this._burst('sawtooth',220,0.55,0.5,30); setTimeout(()=>this._burst('sine',55,0.7,0.5,10),200) }
  portal()     { this._burst('sine',440,0.28,0.28,880); setTimeout(()=>this._burst('square',880,0.2,0.22,1760),100) }
  gravFlip()   { this._burst('square',330,0.2,0.26,165); setTimeout(()=>this._burst('sine',165,0.22,0.20,330),80) }
  surgeStart() { this._burst('sawtooth',220,0.38,0.38,440); this._burst('sawtooth',330,0.28,0.32,660) }
  checkpoint() { [0,75,150,225].forEach((ms,i)=>setTimeout(()=>this._burst('sine',440+i*220,0.1,0.20),ms)) }
  biomeShift() { this._burst('sine',220,0.55,0.28,880); setTimeout(()=>this._burst('triangle',440,0.45,0.22,1760),180) }
  platform()   { this._burst('sine',330,0.12,0.15,220) }
}

const SFX = new AudioEngine()

// ═══════════════════════════════════════════════════════════════════
//  WATER PARTICLE
// ═══════════════════════════════════════════════════════════════════
class WaterParticle {
  constructor(biomeIdx) { this.biome=biomeIdx; this.reset(true) }
  reset(init=false) {
    const b=BIOMES[this.biome]
    this.x     = init ? rand(0,W) : W+rand(0,50)
    this.y     = rand(0,H)
    this.vx    = rand(-2.4,-0.6)
    this.vy    = rand(-0.12,0.12)
    this.r     = rand(0.7,3.0)
    this.alpha = rand(0.04,0.20)
    this.hue   = rand(b.particle[0],b.particle[1])
    this.sat   = rand(38,65)
  }
  update(speed) { this.x+=this.vx*(speed/BASE_SPEED); this.y+=this.vy; if(this.x<-10) this.reset() }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha=this.alpha
    ctx.fillStyle=`hsl(${this.hue},${this.sat}%,55%)`
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill(); ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BUBBLE
// ═══════════════════════════════════════════════════════════════════
class Bubble {
  constructor() { this.reset(true) }
  reset(init=false) {
    this.x=rand(0,W); this.y=init?rand(0,H):H+10
    this.vy=rand(-0.50,-0.14); this.r=rand(1.2,5.2)
    this.alpha=rand(0.03,0.13); this.wobble=rand(0,Math.PI*2); this.wSpeed=rand(0.012,0.042)
  }
  update() { this.wobble+=this.wSpeed; this.x+=Math.sin(this.wobble)*0.42; this.y+=this.vy; if(this.y<-10) this.reset() }
  draw(ctx,accent) {
    ctx.save(); ctx.globalAlpha=this.alpha
    ctx.strokeStyle=`rgba(${accent[0]},${accent[1]},${accent[2]},0.6)`
    ctx.lineWidth=0.7; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.stroke(); ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  PARALLAX STAR LAYER
// ═══════════════════════════════════════════════════════════════════
class StarLayer {
  constructor(count,speed,size,alpha) {
    this.stars=Array.from({length:count},()=>({
      x:rand(0,W),y:rand(0,H),r:rand(size*0.5,size),
      alpha:rand(alpha*0.4,alpha),tw:rand(0,Math.PI*2),twSpd:rand(0.01,0.04)
    }))
    this.speed=speed; this.off=0
  }
  update(gs) { this.off=(this.off+this.speed*(gs/BASE_SPEED))%W; this.stars.forEach(s=>s.tw+=s.twSpd) }
  draw(ctx,accent) {
    ctx.save()
    this.stars.forEach(s=>{
      ctx.globalAlpha=s.alpha*(0.5+Math.sin(s.tw)*0.5)
      ctx.fillStyle=`rgb(${accent[0]},${accent[1]},${accent[2]})`
      ctx.beginPath(); ctx.arc((s.x-this.off+W*2)%W,s.y,s.r,0,Math.PI*2); ctx.fill()
    })
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  COIN
// ═══════════════════════════════════════════════════════════════════
class Coin {
  constructor(x,y,biomeIdx) {
    this.x=x; this.y=y; this.r=8; this.spin=rand(0,Math.PI*2)
    this.spinSpd=rand(0.04,0.08); this.bob=rand(0,Math.PI*2)
    this.bobSpd=rand(0.03,0.055); this.bobAmp=rand(3,7)
    const cols=['#c6a84b','#ff7040','#4fd4ff','#dd44dd','#ffe040']
    this.col=cols[biomeIdx]||cols[0]; this.picked=false; this.glow=rand(0,Math.PI*2)
  }
  update(spd) { this.x-=spd; this.spin+=this.spinSpd; this.bob+=this.bobSpd; this.glow+=0.06 }
  isGone() { return this.x<-22 }
  hits(px,py) { const dx=px-this.x,dy=py-(this.y+Math.sin(this.bob)*this.bobAmp); return Math.sqrt(dx*dx+dy*dy)<this.r+PLAYER_W*0.45 }
  draw(ctx) {
    if(this.picked) return
    const y=this.y+Math.sin(this.bob)*this.bobAmp
    ctx.save()
    const gg=ctx.createRadialGradient(this.x,y,0,this.x,y,this.r*2.4)
    gg.addColorStop(0,this.col+'aa'); gg.addColorStop(1,'transparent')
    ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(this.x,y,this.r*2.4,0,Math.PI*2); ctx.fill()
    ctx.translate(this.x,y); ctx.rotate(this.spin*0.1)
    const scX=Math.abs(Math.cos(this.spin)); ctx.scale(Math.max(0.1,scX),1)
    const cg=ctx.createRadialGradient(-this.r*0.3,-this.r*0.3,0,0,0,this.r)
    cg.addColorStop(0,'#fff8e0'); cg.addColorStop(0.5,this.col); cg.addColorStop(1,'#4a3400')
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2); ctx.fill()
    ctx.scale(1/Math.max(0.1,scX),1)
    ctx.fillStyle='rgba(255,255,220,0.6)'; ctx.font=`bold ${this.r}px sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★',0,0)
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SCORE POP
// ═══════════════════════════════════════════════════════════════════
class ScorePop {
  constructor(x,y,text,col) { this.x=x; this.y=y; this.text=text||'+1'; this.col=col||'#c6a84b'; this.vy=-1.9; this.life=58; this.max=58 }
  update() { this.y+=this.vy; this.vy*=0.93; this.life-- }
  dead()   { return this.life<=0 }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha=this.life/this.max; ctx.fillStyle=this.col
    ctx.font=`700 13px 'Barlow Condensed',sans-serif`; ctx.textAlign='center'; ctx.fillText(this.text,this.x,this.y); ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EXPLOSION SPARK
// ═══════════════════════════════════════════════════════════════════
class Spark {
  constructor(x,y,col,fast) {
    const a=rand(0,Math.PI*2), sp=fast?rand(3,10):rand(1.5,6)
    this.x=x; this.y=y; this.vx=Math.cos(a)*sp; this.vy=Math.sin(a)*sp
    this.r=rand(2,5.5); this.alpha=1; this.col=col||'198,168,75'
  }
  update() { this.x+=this.vx; this.y+=this.vy; this.vy+=0.14; this.vx*=0.97; this.alpha-=0.025; this.r*=0.97 }
  dead()   { return this.alpha<=0 }
  draw(ctx) { ctx.save(); ctx.globalAlpha=Math.max(0,this.alpha); ctx.fillStyle=`rgb(${this.col})`; ctx.beginPath(); ctx.arc(this.x,this.y,Math.max(0.1,this.r),0,Math.PI*2); ctx.fill(); ctx.restore() }
}

// ═══════════════════════════════════════════════════════════════════
//  GRAVITY PORTAL
// ═══════════════════════════════════════════════════════════════════
class GravPortal {
  constructor(x,type) {
    this.x=x; this.w=16; this.h=H*0.55; this.y=(H-this.h)/2
    this.spin=0; this.glow=rand(0,Math.PI); this.type=type||'grav'
    this.col=this.type==='grav'?'#cc44ff':'#44ffcc'; this.triggered=false
  }
  update(spd) { this.x-=spd; this.spin+=0.058; this.glow+=0.05 }
  isGone()    { return this.x+this.w<-12 }
  hits(px,py) { return !this.triggered && px+PLAYER_W*0.5>this.x && px-PLAYER_W*0.5<this.x+this.w }
  draw(ctx) {
    const g=0.5+Math.sin(this.glow)*0.42
    ctx.save()
    const beam=ctx.createLinearGradient(this.x-18,0,this.x+this.w+18,0)
    beam.addColorStop(0,'transparent'); beam.addColorStop(0.3,this.col+'30'); beam.addColorStop(0.7,this.col+'50'); beam.addColorStop(1,'transparent')
    ctx.fillStyle=beam; ctx.fillRect(this.x-18,this.y,this.w+36,this.h)
    ctx.globalAlpha=0.8*g; ctx.fillStyle=this.col; ctx.fillRect(this.x,this.y,this.w,this.h)
    ctx.globalAlpha=g; ctx.fillStyle='#fff'; ctx.font='10px sans-serif'; ctx.textAlign='center'
    const sym=this.type==='grav'?'⟳':'⚡'
    for(let i=0;i<5;i++) { const yy=this.y+((i/5*this.h+this.spin*12)%this.h); ctx.fillText(sym,this.x+this.w/2,yy+10) }
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  CHECKPOINT RING
// ═══════════════════════════════════════════════════════════════════
class CheckpointRing {
  constructor(x) { this.x=x; this.y=H/2; this.r=26; this.spin=0; this.glow=0; this.passed=false }
  update(spd) { this.x-=spd; this.spin+=0.045; this.glow+=0.07 }
  isGone()    { return this.x<-55 }
  hits(px,py) { if(this.passed) return false; const dx=px-this.x,dy=py-this.y; return Math.sqrt(dx*dx+dy*dy)<this.r+10 }
  draw(ctx) {
    const g=0.5+Math.sin(this.glow)*0.44, col=this.passed?'#44ff88':'#ffd700'
    ctx.save()
    const gg=ctx.createRadialGradient(this.x,this.y,this.r*0.6,this.x,this.y,this.r*2)
    gg.addColorStop(0,col+'55'); gg.addColorStop(1,'transparent')
    ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*2,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle=col; ctx.lineWidth=4*g; ctx.globalAlpha=0.9
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.stroke()
    ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.spin)
    ctx.strokeStyle=col+'aa'; ctx.lineWidth=1.5
    for(let i=0;i<6;i++) {
      const a=(i/6)*Math.PI*2
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*this.r*0.4,Math.sin(a)*this.r*0.4); ctx.lineTo(Math.cos(a)*this.r*0.84,Math.sin(a)*this.r*0.84); ctx.stroke()
    }
    ctx.restore()
    if(this.passed) { ctx.globalAlpha=0.7; ctx.fillStyle='#44ff88'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('✓',this.x,this.y+4) }
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ENERGY BOLT (ambient)
// ═══════════════════════════════════════════════════════════════════
class EnergyBolt {
  constructor(biomeIdx) {
    const b=BIOMES[biomeIdx]
    this.x=rand(0,W); this.y1=rand(0,H*0.4); this.y2=rand(H*0.6,H)
    this.alpha=0; this.life=randi(8,18); this.segs=randi(4,8)
    this.col=`rgb(${b.accent[0]},${b.accent[1]},${b.accent[2]})`
  }
  update() { this.alpha=Math.min(1,this.alpha+0.14); this.life--; if(this.life<5) this.alpha=Math.max(0,this.alpha-0.22) }
  dead()   { return this.life<=0&&this.alpha<=0 }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha=this.alpha*0.32; ctx.strokeStyle=this.col; ctx.lineWidth=rand(0.5,1.8)
    ctx.beginPath(); ctx.moveTo(this.x,this.y1)
    for(let i=1;i<=this.segs;i++) ctx.lineTo(this.x+rand(-16,16),lerp(this.y1,this.y2,i/this.segs))
    ctx.stroke(); ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  ████  OBSTACLE SYSTEM  ████
//
//  Instead of just columns, we have multiple obstacle "types":
//  1. COLUMN      — classic top+bottom pillars with gap
//  2. PLATFORM    — a flat ledge the ship can ride above (no collision from top)
//  3. STALACTITE  — spikes hanging from ceiling only
//  4. STALAGMITE  — spikes rising from floor only
//  5. FLOATER     — isolated block/creature in open space to dodge around
//  6. CEILING_RUN — mostly open floor with low ceiling to duck under
//  7. FLOOR_RUN   — mostly open ceiling with raised floor
//  8. ZIGZAG      — twin diagonal pillars that close and open
//
//  Difficulty controls which types are allowed to spawn:
//  diff 0-1: only COLUMN (huge gap), STALACTITE (few spikes)
//  diff 2-3: + PLATFORM, STALAGMITE, FLOATER (single)
//  diff 4-5: + CEILING_RUN, FLOOR_RUN, moving COLUMN
//  diff 6+:  + ZIGZAG, moving FLOATER, crystal COLUMN
// ═══════════════════════════════════════════════════════════════════

// ── OBSTACLE BASE ─────────────────────────────────────────────────
class Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    this.x      = x
    this.speed  = speed
    this.diff   = diff
    this.biome  = biomeIdx
    this.passed = false
    this.glow   = rand(0, Math.PI*2)
    this.tick   = 0
  }
  update()  { this.x -= this.speed; this.glow += 0.048; this.tick++ }
  isGone()  { return this.x + this.maxW() < -14 }
  maxW()    { return 60 }
  // Returns true if player collides (filled hitbox checked externally per type)
  hits()    { return false }
  draw()    {}

  // shared pillar-draw helper
  _drawBlock(ctx, x, y, w, h, b) {
    if(h<=0) return
    const [pr,pg,pb]=b.pillar; const [br,bg,bb]=b.border
    const g=0.4+Math.sin(this.glow)*0.26
    const gr=ctx.createLinearGradient(x,0,x+w,0)
    gr.addColorStop(0,`rgba(${pr},${pg},${pb},0.97)`)
    gr.addColorStop(0.5,`rgba(${Math.min(pr+22,255)},${Math.min(pg+14,255)},${Math.min(pb+30,255)},0.97)`)
    gr.addColorStop(1,`rgba(${Math.max(pr-4,0)},${Math.max(pg-2,0)},${Math.max(pb-6,0)},0.97)`)
    ctx.fillStyle=gr; ctx.fillRect(x,y,w,h)
    ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*0.5})`; ctx.lineWidth=1.1; ctx.strokeRect(x,y,w,h)
    // interior lines
    ctx.save(); ctx.globalAlpha=0.09
    for(let ly=y+10;ly<y+h;ly+=14) { ctx.fillStyle=`rgba(${br},${bg},${bb},1)`; ctx.fillRect(x+3,ly,w-6,1) }
    ctx.restore()
  }

  _drawSpike(ctx, tip, base, x, dir, b) {
    const [br,bg,bb]=b.border; const g=0.4+Math.sin(this.glow)*0.26
    ctx.fillStyle=`rgba(${br},${bg},${bb},${g*0.85})`
    ctx.beginPath()
    ctx.moveTo(x-5,base); ctx.lineTo(x+5,base); ctx.lineTo(x,tip); ctx.closePath(); ctx.fill()
  }

  _edgeGlow(ctx, x, w, y, dir, b) {
    const [br,bg,bb]=b.border; const g=0.4+Math.sin(this.glow)*0.26
    const eg=ctx.createLinearGradient(0,dir==='down'?y-14:y,0,dir==='down'?y:y+14)
    eg.addColorStop(dir==='down'?0:1,'transparent')
    eg.addColorStop(dir==='down'?1:0,`rgba(${br},${bg},${bb},${g*0.55})`)
    ctx.fillStyle=eg; ctx.fillRect(x,dir==='down'?y-14:y,w,14)
  }
}

// ── 1. COLUMN (classic pillars with gap) ─────────────────────────
class ColumnObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx, forcedGap) {
    super(x, speed, diff, biomeIdx)
    this.w       = 44 + Math.min(diff * 1.6, 18)
    const gapBase  = lerpc(200, 108, diff / 9)      // huge gap at start, tightens with diff
    this.gapSize   = forcedGap || Math.max(108, gapBase)
    const margin   = 55
    const center   = rand(margin + this.gapSize/2, H - margin - this.gapSize/2)
    this.baseCenter= center
    this.gapTop    = center - this.gapSize/2
    this.gapBottom = center + this.gapSize/2
    // moving gap unlocks at diff 4
    this.wobble    = diff >= 4 ? rand(0.25, 0.65) : 0
    this.wobbleP   = rand(0, Math.PI*2)
    this.wobbleSpd = rand(0.018, 0.038)
    // spikes on edges
    this.topSpikes    = this._mkSpikes('down')
    this.bottomSpikes = this._mkSpikes('up')
  }
  maxW() { return this.w }
  _mkSpikes(dir) {
    const n=Math.min(1+Math.floor(this.diff/2),6), out=[]
    for(let i=0;i<n;i++) if(Math.random()>0.45) out.push({x:rand(6,this.w-6), h:rand(7,16), dir})
    return out
  }
  update() {
    super.update()
    if(this.wobble>0) {
      this.wobbleP+=this.wobbleSpd
      const sh=Math.sin(this.wobbleP)*this.wobble*28
      this.gapTop    = this.baseCenter - this.gapSize/2 + sh
      this.gapBottom = this.baseCenter + this.gapSize/2 + sh
    }
  }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    if(px+hw<this.x || px-hw>this.x+this.w) return false
    if(py-hh<this.gapTop || py+hh>this.gapBottom) return true
    return false
  }
  draw(ctx) {
    const b=BIOMES[this.biome]
    this._drawBlock(ctx, this.x, 0, this.w, this.gapTop, b)
    if(this.gapTop>0) {
      this._edgeGlow(ctx,this.x,this.w,this.gapTop,'down',b)
      this.topSpikes.forEach(s=>this._drawSpike(ctx,this.gapTop+s.h,this.gapTop,this.x+s.x,'down',b))
    }
    this._drawBlock(ctx, this.x, this.gapBottom, this.w, H-this.gapBottom, b)
    if(this.gapBottom<H) {
      this._edgeGlow(ctx,this.x,this.w,this.gapBottom,'up',b)
      this.bottomSpikes.forEach(s=>this._drawSpike(ctx,this.gapBottom-s.h,this.gapBottom,this.x+s.x,'up',b))
    }
    // Wobble indicator: highlight when gap is moving
    if(this.wobble>0) {
      const b2=BIOMES[this.biome], [br,bg,bb]=b2.border
      ctx.save(); ctx.globalAlpha=0.18+Math.abs(Math.sin(this.wobbleP))*0.1
      ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`; ctx.lineWidth=2
      ctx.setLineDash([4,4])
      ctx.beginPath(); ctx.moveTo(this.x,this.gapTop+this.gapSize/2); ctx.lineTo(this.x+this.w,this.gapTop+this.gapSize/2); ctx.stroke()
      ctx.setLineDash([]); ctx.restore()
    }
  }
}

// ── 2. PLATFORM (flat ledge, only solid from above, +/- ridable) ──
class PlatformObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    this.w   = rand(90, 160)
    this.h   = 14
    this.y   = rand(H*0.28, H*0.72)   // vertical position of platform top surface
    this.moving = diff>=4 && Math.random()>0.5
    this.moveAmp = rand(18,38); this.moveP=rand(0,Math.PI*2); this.moveSpd=rand(0.02,0.04)
    // spikes on platform surface (at higher diff)
    this.surfSpikes = diff>=3 ? this._mkSurfSpikes() : []
  }
  _mkSurfSpikes() {
    const n=randi(1,4), out=[]
    for(let i=0;i<n;i++) out.push({xOff: rand(10,this.w-10), h: rand(8,14)})
    return out
  }
  maxW() { return this.w }
  update() {
    super.update()
    if(this.moving) { this.moveP+=this.moveSpd; this.y=this.y+(Math.sin(this.moveP)*this.moveAmp*0.1) }
  }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-1
    // Solid only from above: player bottom edge hits platform top
    const playerBot = py+hh, playerTop = py-hh
    const platTop   = this.y, platBot = this.y+this.h
    if(px+hw<this.x || px-hw>this.x+this.w) return false
    // Collide if player bottom is within platform slab
    if(playerBot>=platTop && playerTop<=platBot) return true
    // Check surface spikes
    for(const s of this.surfSpikes) {
      const sx=this.x+s.xOff, sy=this.y-s.h
      const dx=Math.abs(px-sx), dy=Math.abs(py-sy)
      if(dx<6 && dy<8) return true
    }
    return false
  }
  draw(ctx) {
    const b=BIOMES[this.biome]; const [br,bg,bb]=b.border; const [pr,pg,pb]=b.pillar
    const g=0.4+Math.sin(this.glow)*0.26
    // Top glowing edge
    const eg=ctx.createLinearGradient(0,this.y-3,0,this.y+this.h+3)
    eg.addColorStop(0,`rgba(${br},${bg},${bb},${g*0.9})`)
    eg.addColorStop(0.4,`rgba(${pr},${pg},${pb},0.98)`)
    eg.addColorStop(1,`rgba(${Math.max(pr-8,0)},${Math.max(pg-4,0)},${Math.max(pb-10,0)},0.9)`)
    ctx.fillStyle=eg; ctx.fillRect(this.x,this.y,this.w,this.h)
    // Neon top line
    ctx.save(); ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*0.95})`; ctx.lineWidth=2.2
    ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x+this.w,this.y); ctx.stroke()
    // Glow blur under top line
    ctx.globalAlpha=0.22; ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`; ctx.lineWidth=7
    ctx.filter=`blur(4px)`; ctx.beginPath(); ctx.moveTo(this.x,this.y); ctx.lineTo(this.x+this.w,this.y); ctx.stroke()
    ctx.filter='none'; ctx.restore()
    // Surface spikes
    this.surfSpikes.forEach(s=>this._drawSpike(ctx,this.y-s.h,this.y,this.x+s.xOff,'up',b))
    // Moving glow
    if(this.moving) {
      ctx.save(); ctx.globalAlpha=0.18; ctx.fillStyle=`rgba(${br},${bg},${bb},1)`
      ctx.fillRect(this.x,this.y,this.w,this.h); ctx.restore()
    }
  }
}

// ── 3. STALACTITE CLUSTER (spikes from ceiling only) ─────────────
class StalactiteObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    const n=randi(2+diff,5+diff*2)
    this.spikes=[]
    const totalW = Math.min(n*24, 200)
    this.totalW  = totalW
    for(let i=0;i<n;i++) {
      this.spikes.push({
        x:     x + i*22 + rand(-4,4),
        h:     rand(22+diff*3, 55+diff*6),
        w:     rand(7,14),
        glow:  rand(0,Math.PI*2)
      })
    }
  }
  maxW() { return this.totalW }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    for(const s of this.spikes) {
      if(px+hw<s.x-s.w/2 || px-hw>s.x+s.w/2) continue
      if(py-hh<s.h) return true
    }
    return false
  }
  update() { super.update(); this.spikes.forEach(s=>{ s.x-=this.speed; s.glow+=0.05 }) }
  isGone() { return this.spikes.every(s=>s.x+s.w<-10) }
  draw(ctx) {
    const b=BIOMES[this.biome]; const [br,bg,bb]=b.border; const [pr,pg,pb]=b.pillar
    this.spikes.forEach(s=>{
      const g=0.45+Math.sin(s.glow)*0.28
      // Base cap attached to ceiling
      const cg=ctx.createLinearGradient(s.x,0,s.x,s.h)
      cg.addColorStop(0,`rgba(${pr},${pg},${pb},0.98)`)
      cg.addColorStop(1,`rgba(${br},${bg},${bb},${g*0.85})`)
      ctx.fillStyle=cg
      // Draw as a triangle with a flat top connected to ceiling
      ctx.beginPath()
      ctx.moveTo(s.x-s.w/2,0)
      ctx.lineTo(s.x+s.w/2,0)
      ctx.lineTo(s.x+s.w/2*0.5,s.h)
      ctx.lineTo(s.x-s.w/2*0.5,s.h)
      ctx.closePath(); ctx.fill()
      // Glow on tip
      ctx.save(); ctx.globalAlpha=g*0.5
      ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`; ctx.lineWidth=1.2
      ctx.beginPath(); ctx.arc(s.x,s.h-2,3,0,Math.PI*2); ctx.stroke(); ctx.restore()
    })
  }
}

// ── 4. STALAGMITE CLUSTER (spikes from floor only) ───────────────
class StalagmiteObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    const n=randi(2+diff,5+diff*2)
    this.spikes=[]
    const totalW=Math.min(n*24,200); this.totalW=totalW
    for(let i=0;i<n;i++) {
      this.spikes.push({
        x:    x+i*22+rand(-4,4),
        h:    rand(22+diff*3,55+diff*6),
        w:    rand(7,14),
        glow: rand(0,Math.PI*2)
      })
    }
  }
  maxW() { return this.totalW }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    for(const s of this.spikes) {
      if(px+hw<s.x-s.w/2||px-hw>s.x+s.w/2) continue
      if(py+hh>H-s.h) return true
    }
    return false
  }
  update() { super.update(); this.spikes.forEach(s=>{ s.x-=this.speed; s.glow+=0.05 }) }
  isGone() { return this.spikes.every(s=>s.x+s.w<-10) }
  draw(ctx) {
    const b=BIOMES[this.biome]; const [br,bg,bb]=b.border; const [pr,pg,pb]=b.pillar
    this.spikes.forEach(s=>{
      const g=0.45+Math.sin(s.glow)*0.28
      const cg=ctx.createLinearGradient(s.x,H,s.x,H-s.h)
      cg.addColorStop(0,`rgba(${pr},${pg},${pb},0.98)`)
      cg.addColorStop(1,`rgba(${br},${bg},${bb},${g*0.85})`)
      ctx.fillStyle=cg
      ctx.beginPath()
      ctx.moveTo(s.x-s.w/2,H); ctx.lineTo(s.x+s.w/2,H)
      ctx.lineTo(s.x+s.w/2*0.5,H-s.h); ctx.lineTo(s.x-s.w/2*0.5,H-s.h)
      ctx.closePath(); ctx.fill()
      ctx.save(); ctx.globalAlpha=g*0.5; ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`; ctx.lineWidth=1.2
      ctx.beginPath(); ctx.arc(s.x,H-s.h+2,3,0,Math.PI*2); ctx.stroke(); ctx.restore()
    })
  }
}

// ── 5. FLOATER (isolated block / creature to dodge around) ────────
class FloaterObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    this.w    = rand(24, 52)
    this.h    = rand(24, 52)
    this.y    = rand(H*0.18, H*0.82 - this.h)
    this.moving = diff>=3 && Math.random()>0.42
    this.moveAmp= rand(25,65); this.moveP=rand(0,Math.PI*2); this.moveSpd=rand(0.025,0.055)
    this.baseY  = this.y
    this.type   = randi(0,2)  // 0=block, 1=diamond, 2=circle-creature
    this.rot    = rand(0,Math.PI*2); this.rotSpd=rand(-0.02,0.02)
  }
  maxW() { return this.w+8 }
  update() {
    super.update(); this.rot+=this.rotSpd
    if(this.moving) { this.moveP+=this.moveSpd; this.y=this.baseY+Math.sin(this.moveP)*this.moveAmp }
  }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    if(this.type===2) {
      const dx=px-(this.x+this.w/2), dy=py-(this.y+this.h/2)
      return Math.sqrt(dx*dx+dy*dy)<this.w/2+Math.min(hw,hh)-1
    }
    return px+hw>this.x && px-hw<this.x+this.w && py+hh>this.y && py-hh<this.y+this.h
  }
  draw(ctx) {
    const b=BIOMES[this.biome]; const [br,bg,bb]=b.border; const [pr,pg,pb]=b.pillar
    const g=0.45+Math.sin(this.glow)*0.3
    const cx=this.x+this.w/2, cy=this.y+this.h/2
    ctx.save(); ctx.translate(cx,cy); ctx.rotate(this.rot)
    if(this.type===0) {
      // Block
      const gr=ctx.createRadialGradient(0,0,0,0,0,this.w*0.7)
      gr.addColorStop(0,`rgba(${Math.min(pr+30,255)},${Math.min(pg+20,255)},${Math.min(pb+40,255)},0.95)`)
      gr.addColorStop(1,`rgba(${pr},${pg},${pb},0.95)`)
      ctx.fillStyle=gr; ctx.fillRect(-this.w/2,-this.h/2,this.w,this.h)
      ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*0.7})`; ctx.lineWidth=2; ctx.strokeRect(-this.w/2,-this.h/2,this.w,this.h)
    } else if(this.type===1) {
      // Diamond
      const r=Math.min(this.w,this.h)/2
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r,0); ctx.lineTo(0,r); ctx.lineTo(-r,0); ctx.closePath()
      const dg=ctx.createRadialGradient(0,-r*0.3,0,0,0,r)
      dg.addColorStop(0,`rgba(${Math.min(br+60,255)},${Math.min(bg+40,255)},${Math.min(bb+60,255)},0.95)`)
      dg.addColorStop(1,`rgba(${br},${bg},${bb},0.85)`)
      ctx.fillStyle=dg; ctx.fill()
      ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*0.9})`; ctx.lineWidth=2; ctx.stroke()
    } else {
      // Circle creature (fish/entity)
      const r=Math.min(this.w,this.h)/2
      const gg=ctx.createRadialGradient(-r*0.2,-r*0.2,0,0,0,r)
      gg.addColorStop(0,`rgba(${Math.min(br+80,255)},${Math.min(bg+60,255)},${Math.min(bb+80,255)},0.9)`)
      gg.addColorStop(0.6,`rgba(${pr},${pg},${pb},0.95)`)
      gg.addColorStop(1,`rgba(${Math.max(pr-10,0)},${Math.max(pg-6,0)},${Math.max(pb-14,0)},0.9)`)
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=gg; ctx.fill()
      ctx.strokeStyle=`rgba(${br},${bg},${bb},${g*0.85})`; ctx.lineWidth=1.8; ctx.stroke()
      // Eye
      ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(r*0.4,-r*0.2,r*0.22,0,Math.PI*2); ctx.fill()
      ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.arc(r*0.48,-r*0.2,r*0.1,0,Math.PI*2); ctx.fill()
      // Fin
      ctx.save(); ctx.globalAlpha=0.55; ctx.fillStyle=`rgba(${br},${bg},${bb},0.7)`
      ctx.beginPath(); ctx.moveTo(-r*0.2,-r); ctx.lineTo(-r*0.6,-r*1.4); ctx.lineTo(-r*0.9,-r*0.7); ctx.closePath(); ctx.fill(); ctx.restore()
    }
    // Outer pulse glow
    ctx.globalAlpha=g*0.18+(Math.sin(this.glow)*0.08)
    ctx.strokeStyle=`rgba(${br},${bg},${bb},1)`; ctx.lineWidth=6
    if(this.type===2) { ctx.beginPath(); ctx.arc(0,0,Math.min(this.w,this.h)/2+4,0,Math.PI*2); ctx.stroke() }
    ctx.restore()
    // Movement trail dots
    if(this.moving) {
      ctx.save(); ctx.globalAlpha=0.18
      ctx.fillStyle=`rgba(${br},${bg},${bb},1)`
      ctx.beginPath(); ctx.arc(cx,cy,Math.max(this.w,this.h)/2+8,0,Math.PI*2); ctx.fill(); ctx.restore()
    }
  }
}

// ── 6. CEILING_RUN (low ceiling — must stay in lower half) ────────
class CeilingRunObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    this.w         = rand(100, 200)
    this.ceilH     = rand(H*0.25, H*0.42)   // ceiling comes down this far from top
    this.spikes    = this._mkSpikes()
  }
  _mkSpikes() {
    const n=randi(1,3+Math.floor(this.diff/2)), out=[]
    for(let i=0;i<n;i++) out.push({xOff:rand(10,this.w-10), h:rand(10,22)})
    return out
  }
  maxW() { return this.w }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    if(px+hw<this.x||px-hw>this.x+this.w) return false
    if(py-hh<this.ceilH) return true
    for(const s of this.spikes) {
      const sx=this.x+s.xOff
      if(Math.abs(px-sx)<6 && py-hh<this.ceilH+s.h) return true
    }
    return false
  }
  draw(ctx) {
    const b=BIOMES[this.biome]
    this._drawBlock(ctx,this.x,0,this.w,this.ceilH,b)
    this._edgeGlow(ctx,this.x,this.w,this.ceilH,'down',b)
    this.spikes.forEach(s=>this._drawSpike(ctx,this.ceilH+s.h,this.ceilH,this.x+s.xOff,'down',b))
  }
}

// ── 7. FLOOR_RUN (raised floor — must stay in upper half) ─────────
class FloorRunObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    this.w      = rand(100, 200)
    this.floorY = rand(H*0.58, H*0.72)  // floor rises this high from bottom
    this.spikes = this._mkSpikes()
  }
  _mkSpikes() {
    const n=randi(1,3+Math.floor(this.diff/2)), out=[]
    for(let i=0;i<n;i++) out.push({xOff:rand(10,this.w-10), h:rand(10,22)})
    return out
  }
  maxW() { return this.w }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    if(px+hw<this.x||px-hw>this.x+this.w) return false
    if(py+hh>this.floorY) return true
    for(const s of this.spikes) {
      const sx=this.x+s.xOff
      if(Math.abs(px-sx)<6 && py+hh>this.floorY-s.h) return true
    }
    return false
  }
  draw(ctx) {
    const b=BIOMES[this.biome]
    this._drawBlock(ctx,this.x,this.floorY,this.w,H-this.floorY,b)
    this._edgeGlow(ctx,this.x,this.w,this.floorY,'up',b)
    this.spikes.forEach(s=>this._drawSpike(ctx,this.floorY-s.h,this.floorY,this.x+s.xOff,'up',b))
  }
}

// ── 8. ZIGZAG (two diagonal slabs) ────────────────────────────────
class ZigzagObs extends Obstacle {
  constructor(x, speed, diff, biomeIdx) {
    super(x, speed, diff, biomeIdx)
    this.w   = 55 + diff*2
    this.gapSize = Math.max(110, lerpc(185,110,diff/9))
    // Top slab slants down-right, bottom slab slants up-right
    this.t1  = rand(40, H/2 - this.gapSize/2 - 20)
    this.b1  = this.t1 + rand(60, 120)
    this.t2  = this.b1 + this.gapSize
    this.b2  = H
    this.wobble  = diff>=5 ? rand(0.3,0.7) : 0
    this.wobbleP = rand(0,Math.PI*2)
    this.wobbleSpd = rand(0.02,0.04)
  }
  maxW() { return this.w }
  update() {
    super.update()
    if(this.wobble>0) {
      this.wobbleP+=this.wobbleSpd
      const sh=Math.sin(this.wobbleP)*this.wobble*22
      this.b1=clamp(this.b1+sh*0.05,40,H/2-20)
      this.t2=this.b1+this.gapSize
    }
  }
  hits(px,py) {
    const hw=PLAYER_W/2-2, hh=PLAYER_H/2-2
    if(px+hw<this.x||px-hw>this.x+this.w) return false
    if(py-hh<this.b1) return true   // inside top slab
    if(py+hh>this.t2) return true   // inside bottom slab
    return false
  }
  draw(ctx) {
    const b=BIOMES[this.biome]
    this._drawBlock(ctx,this.x,0,this.w,this.b1,b)
    this._edgeGlow(ctx,this.x,this.w,this.b1,'down',b)
    this._drawBlock(ctx,this.x,this.t2,this.w,H-this.t2,b)
    this._edgeGlow(ctx,this.x,this.w,this.t2,'up',b)
  }
}

// ═══════════════════════════════════════════════════════════════════
//  OBSTACLE FACTORY — picks appropriate type based on difficulty
// ═══════════════════════════════════════════════════════════════════
function spawnObstacle(diff, biomeIdx, spd) {
  const x = W + 55

  if (diff === 0) {
    // Tutorial: only easy columns, massive gaps
    return new ColumnObs(x, spd, diff, biomeIdx, lerpc(220, 175, Math.random()))
  }

  if (diff === 1) {
    // Intro: columns + basic stalactites
    const r = Math.random()
    if (r < 0.70) return new ColumnObs(x, spd, diff, biomeIdx)
    return new StalactiteObs(x, spd, diff, biomeIdx)
  }

  if (diff === 2) {
    const r = Math.random()
    if (r < 0.45) return new ColumnObs(x, spd, diff, biomeIdx)
    if (r < 0.60) return new StalactiteObs(x, spd, diff, biomeIdx)
    if (r < 0.75) return new StalagmiteObs(x, spd, diff, biomeIdx)
    if (r < 0.90) return new FloaterObs(x, spd, diff, biomeIdx)
    return new PlatformObs(x, spd, diff, biomeIdx)
  }

  if (diff === 3) {
    const r = Math.random()
    if (r < 0.30) return new ColumnObs(x, spd, diff, biomeIdx)
    if (r < 0.45) return new StalactiteObs(x, spd, diff, biomeIdx)
    if (r < 0.58) return new StalagmiteObs(x, spd, diff, biomeIdx)
    if (r < 0.70) return new FloaterObs(x, spd, diff, biomeIdx)
    if (r < 0.82) return new PlatformObs(x, spd, diff, biomeIdx)
    if (r < 0.92) return new CeilingRunObs(x, spd, diff, biomeIdx)
    return new FloorRunObs(x, spd, diff, biomeIdx)
  }

  if (diff <= 5) {
    const r = Math.random()
    if (r < 0.22) return new ColumnObs(x, spd, diff, biomeIdx)
    if (r < 0.34) return new StalactiteObs(x, spd, diff, biomeIdx)
    if (r < 0.46) return new StalagmiteObs(x, spd, diff, biomeIdx)
    if (r < 0.58) return new FloaterObs(x, spd, diff, biomeIdx)
    if (r < 0.68) return new PlatformObs(x, spd, diff, biomeIdx)
    if (r < 0.76) return new CeilingRunObs(x, spd, diff, biomeIdx)
    if (r < 0.84) return new FloorRunObs(x, spd, diff, biomeIdx)
    return new ZigzagObs(x, spd, diff, biomeIdx)
  }

  // diff 6+: all types, heavier weighting on harder variants
  const r = Math.random()
  if (r < 0.15) return new ColumnObs(x, spd, diff, biomeIdx)
  if (r < 0.26) return new StalactiteObs(x, spd, diff, biomeIdx)
  if (r < 0.37) return new StalagmiteObs(x, spd, diff, biomeIdx)
  if (r < 0.50) return new FloaterObs(x, spd, diff, biomeIdx)
  if (r < 0.60) return new PlatformObs(x, spd, diff, biomeIdx)
  if (r < 0.68) return new CeilingRunObs(x, spd, diff, biomeIdx)
  if (r < 0.76) return new FloorRunObs(x, spd, diff, biomeIdx)
  return new ZigzagObs(x, spd, diff, biomeIdx)
}

// ═══════════════════════════════════════════════════════════════════
//  DRAW PLAYER (ship)
// ═══════════════════════════════════════════════════════════════════
function drawShip(ctx, py, vy, holding, tick, inv, gravFlipped, spd, biomeIdx) {
  ctx.save()
  ctx.translate(PLAYER_X, py)

  // Tilt: lean into the direction of travel
  // When flipped, tilt is inverted
  const tiltDir = gravFlipped ? -1 : 1
  ctx.rotate(clamp(vy * 0.055 * tiltDir, -0.52, 0.52))
  if (gravFlipped) ctx.scale(1, -1)

  if (inv && Math.floor(tick / 4) % 2 === 1) { ctx.restore(); return }

  const b   = BIOMES[Math.min(biomeIdx, BIOMES.length-1)]
  const acc = b.accent
  const speedRatio = spd / BASE_SPEED

  // ── Engine exhaust glow
  const elen = holding ? 36 : 22
  const eg   = ctx.createLinearGradient(-PLAYER_W, 0, -PLAYER_W - elen - 8, 0)
  eg.addColorStop(0,   `rgba(${acc[0]},${acc[1]},${acc[2]},${holding ? 0.52 : 0.26})`)
  eg.addColorStop(1,   'transparent')
  ctx.fillStyle = eg
  ctx.beginPath()
  ctx.ellipse(-PLAYER_W - 5, 0, elen, holding ? 8 : 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Speed streaks
  if (speedRatio > 1.25) {
    ctx.save(); ctx.globalAlpha = (speedRatio - 1.25) * 0.14
    ctx.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},1)`; ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      const yo = (i - 1.5) * 6
      ctx.beginPath(); ctx.moveTo(-PLAYER_W * 1.4, yo); ctx.lineTo(-PLAYER_W * 3.2, yo); ctx.stroke()
    }
    ctx.restore()
  }

  // ── Hull
  ctx.beginPath()
  ctx.moveTo(-PLAYER_W/2,    -PLAYER_H/2)
  ctx.lineTo( PLAYER_W/2,    -PLAYER_H/2 + 3)
  ctx.lineTo( PLAYER_W/2+6,   0)
  ctx.lineTo( PLAYER_W/2,     PLAYER_H/2 - 3)
  ctx.lineTo(-PLAYER_W/2,     PLAYER_H/2)
  ctx.lineTo(-PLAYER_W/2-4,   0)
  ctx.closePath()
  const hg = ctx.createLinearGradient(-PLAYER_W/2, -PLAYER_H/2, PLAYER_W/2, PLAYER_H/2)
  hg.addColorStop(0,   '#d8b035')
  hg.addColorStop(0.45,'#c6a84b')
  hg.addColorStop(1,   '#7a6228')
  ctx.fillStyle = hg; ctx.fill()
  ctx.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},0.52)`; ctx.lineWidth = 1.1; ctx.stroke()

  // ── Wing detail lines
  ctx.save(); ctx.strokeStyle = 'rgba(255,220,120,0.18)'; ctx.lineWidth = 0.7
  ctx.beginPath(); ctx.moveTo(-PLAYER_W/4,-PLAYER_H/2+1); ctx.lineTo(PLAYER_W/2+2,-PLAYER_H/2+4); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(-PLAYER_W/4, PLAYER_H/2-1); ctx.lineTo(PLAYER_W/2+2, PLAYER_H/2-4); ctx.stroke()
  ctx.restore()

  // ── Cockpit
  ctx.beginPath(); ctx.ellipse(6, 0, 8, 5, 0, 0, Math.PI*2)
  const cg = ctx.createRadialGradient(3, -1.5, 0, 6, 0, 8)
  cg.addColorStop(0, 'rgba(220,248,255,0.95)')
  cg.addColorStop(0.6, `rgba(${Math.floor(acc[0]*0.3+40)},${Math.floor(acc[1]*0.3+80)},${Math.floor(acc[2]*0.2+150)},0.6)`)
  cg.addColorStop(1, 'rgba(20,40,70,0.55)')
  ctx.fillStyle = cg; ctx.fill()

  // ── Engine flame
  const fh = holding ? rand(10, 17) : rand(3, 8)
  ctx.beginPath()
  ctx.moveTo(-PLAYER_W/2, -3.5)
  ctx.lineTo(-PLAYER_W/2 - fh - rand(0,4), 0)
  ctx.lineTo(-PLAYER_W/2,  3.5)
  ctx.closePath()
  const fg = ctx.createLinearGradient(-PLAYER_W/2, 0, -PLAYER_W/2-fh-5, 0)
  fg.addColorStop(0,   'rgba(255,210,80,0.98)')
  fg.addColorStop(0.35,`rgba(${acc[0]},${acc[1]},${acc[2]},0.78)`)
  fg.addColorStop(0.7, 'rgba(255,100,20,0.55)')
  fg.addColorStop(1,   'transparent')
  ctx.fillStyle = fg; ctx.fill()

  if (holding) {
    const fh2 = rand(4, 9)
    ctx.beginPath(); ctx.moveTo(-PLAYER_W/2,-1.5); ctx.lineTo(-PLAYER_W/2-fh2-rand(0,2),0); ctx.lineTo(-PLAYER_W/2,1.5); ctx.closePath()
    ctx.fillStyle = 'rgba(255,255,200,0.72)'; ctx.fill()
  }

  // ── Outer glow
  const og = ctx.createRadialGradient(0,0,PLAYER_W*0.3,0,0,PLAYER_W*2)
  og.addColorStop(0,   `rgba(${acc[0]},${acc[1]},${acc[2]},0.20)`)
  og.addColorStop(0.5, `rgba(${acc[0]},${acc[1]},${acc[2]},0.05)`)
  og.addColorStop(1,   'transparent')
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0,0,PLAYER_W*2,0,Math.PI*2); ctx.fill()

  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════
//  DRAW BACKGROUND
// ═══════════════════════════════════════════════════════════════════
function drawBG(ctx, tick, speed, surge, biomeIdx, biomeT) {
  const b   = BIOMES[Math.min(biomeIdx, BIOMES.length-1)]
  const sky = b.sky; const acc = b.accent

  // Sky
  const bg = ctx.createLinearGradient(0,0,0,H)
  bg.addColorStop(0,sky[0]); bg.addColorStop(0.5,sky[1]); bg.addColorStop(1,sky[2])
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)

  // Biome transition flash
  if (biomeT > 0) {
    const fl=Math.min(biomeT/28,1)*Math.max(0,biomeT/28)
    ctx.save(); ctx.globalAlpha=fl*0.52; ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`; ctx.fillRect(0,0,W,H); ctx.restore()
  }

  // Surge vignette
  if (surge > 0) {
    const sv=ctx.createRadialGradient(W/2,H/2,H*0.1,W/2,H/2,H*1.0)
    sv.addColorStop(0,'transparent'); sv.addColorStop(1,`rgba(220,30,30,${surge*0.22})`)
    ctx.fillStyle=sv; ctx.fillRect(0,0,W,H)
  }

  // Current lines
  ctx.save(); ctx.globalAlpha=0.045+surge*0.025; ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},1)`; ctx.lineWidth=0.65
  for(let i=0;i<11;i++) {
    const y=(i/11)*H+14, off=(tick*(speed/BASE_SPEED)*2.0)%W, len=rand(18,115)
    const sx=(W-off+i*26)%W
    ctx.beginPath(); ctx.moveTo(sx,y); ctx.lineTo((sx-len+W*2)%W,y); ctx.stroke()
  }
  ctx.restore()

  // Boundary strips
  const tg=ctx.createLinearGradient(0,0,0,22); tg.addColorStop(0,`rgba(${acc[0]},${acc[1]},${acc[2]},0.82)`); tg.addColorStop(1,'transparent')
  ctx.fillStyle=tg; ctx.fillRect(0,0,W,22)
  const btg=ctx.createLinearGradient(0,H-22,0,H); btg.addColorStop(0,'transparent'); btg.addColorStop(1,`rgba(${acc[0]},${acc[1]},${acc[2]},0.82)`)
  ctx.fillStyle=btg; ctx.fillRect(0,H-22,W,22)
  ctx.strokeStyle=`rgba(${acc[0]},${acc[1]},${acc[2]},0.52)`; ctx.lineWidth=1.8
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W,0); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0,H); ctx.lineTo(W,H); ctx.stroke()
}

// ═══════════════════════════════════════════════════════════════════
//  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════
const makeState = () => ({
  tick:       0,
  py:         H / 2,
  vy:         0.5,            // start with small downward velocity so ship falls immediately
  score:      0,
  coins:      0,
  dist:       0,
  lives:      3,
  speed:      BASE_SPEED,
  obstacles:  [],
  obsTimer:   140,
  particles:  Array.from({length:PARTICLE_CNT}, ()=>new WaterParticle(0)),
  bubbles:    Array.from({length:BUBBLE_CNT},   ()=>new Bubble()),
  starLayers: [new StarLayer(55,0.28,0.7,0.11), new StarLayer(28,0.65,1.3,0.17), new StarLayer(11,1.15,1.9,0.24)],
  bolts:      [],
  boltTimer:  85,
  trail:      [],
  pops:       [],
  sparks:     [],
  coins_arr:  [],
  coinTimer:  randi(200,380),
  portals:    [],
  portalTimer:randi(450,720),
  checkpoints:[],
  cpTimer:    randi(550,850),
  inv:        0,
  alive:      true,
  surging:    false,
  surgeT:     0,
  surgeI:     0,
  nextSurge:  rand(400,700),
  diff:       0,
  biome:      0,
  biomeT:     0,
  gravFlipped:false,
  speedBoost: 0,
  shake:      new Shake(),
  prevHold:   false,          // track previous hold state for impulse-on-press detection
})

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function TheRiver() {
  const canvasRef   = useRef(null)
  const stateRef    = useRef(null)
  const animRef     = useRef(null)
  const holdRef     = useRef(false)

  const [screen,      setScreen]      = useState('intro')
  const [score,       setScore]       = useState(0)
  const [lives,       setLives]       = useState(3)
  const [distance,    setDistance]    = useState(0)
  const [coins,       setCoins]       = useState(0)
  const [biomeIdx,    setBiomeIdx]    = useState(0)
  const [best,        setBest]        = useState(() => parseInt(localStorage.getItem('river_best')||'0'))
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

  // ── Leaderboard ───────────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    try {
      const q    = query(collection(db,'river_leaderboard'),orderBy('score','desc'),limit(10))
      const snap = await getDocs(q)
      setBoard(snap.docs.map(d=>({id:d.id,...d.data()})))
    } catch(e) {}
  }, [])

  const saveScore = useCallback(async () => {
    if (!username.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db,'river_leaderboard'),{
        username: username.trim(), score: finalScore, distance: finalDist, coins: finalCoins,
        timestamp: serverTimestamp()
      })
      await loadBoard()
      setScreen('leaderboard')
    } catch(e) {}
    setSaving(false)
  }, [username, finalScore, finalDist, finalCoins, loadBoard])

  // ── Start ─────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    SFX.init(); SFX.resume()
    holdRef.current = false   // IMPORTANT: clear any held state from previous session
    const s = makeState(); stateRef.current = s
    setScore(0); setLives(3); setDistance(0); setCoins(0); setBiomeIdx(0)
    setSurgeActive(false); setShowBiome(false)
    SFX.startMusic(0)
    setScreen('playing')
  }, [])

  const doCountdown = useCallback(() => {
    SFX.init(); SFX.resume()
    setScreen('countdown')
    let n = 3; setCdNum(3)
    const iv = setInterval(() => {
      n--; setCdNum(n)
      if (n <= 0) { clearInterval(iv); startGame() }
    }, 820)
    return () => clearInterval(iv)
  }, [startGame])

  const flashBiome = useCallback((name) => {
    setBiomeName(name); setShowBiome(true)
    if (biomeFlashRef.current) clearTimeout(biomeFlashRef.current)
    biomeFlashRef.current = setTimeout(()=>setShowBiome(false), 2500)
  }, [])

  // ── Death ─────────────────────────────────────────────────────
  const handleDeath = useCallback((s) => {
    SFX.stopEngine(); SFX.death()
    for (let i=0;i<40;i++) s.sparks.push(new Spark(PLAYER_X,s.py,Math.random()>0.5?'198,168,75':'230,80,80',false))
    s.shake.add(MAX_SHAKE)
    const next = s.lives - 1
    if (next <= 0) {
      s.alive = false
      if (s.score > best) { setBest(s.score); localStorage.setItem('river_best',String(s.score)) }
      setFinalScore(s.score); setFinalDist(Math.round(s.dist)); setFinalCoins(s.coins)
      SFX.stopMusic(); setScreen('dead')
    } else {
      s.lives = next; s.vy = 0; s.py = H/2; s.inv = 165; s.gravFlipped = false
      setLives(next); SFX.hit()
    }
  }, [best])

  // ═══════════════════════════════════════════════════════════════
  //  GAME LOOP
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s   = stateRef.current

    const loop = () => {
      s.tick++
      const holding = holdRef.current

      // ── Difficulty from distance
      let diff = 0
      for (let i = DIFF_THRESHOLDS.length-1; i >= 0; i--) {
        if (s.dist >= DIFF_THRESHOLDS[i]) { diff = i; break }
      }
      s.diff = diff

      // ── Speed ramp — start gentle, cap at MAX_SPEED
      const spd_raw = Math.min(BASE_SPEED + (s.dist / 900) * 0.21, MAX_SPEED)
      const spd = spd_raw * (1 + s.surgeI * 0.50) * (s.speedBoost > 0 ? 1.40 : 1.0)

      if (s.speedBoost > 0) s.speedBoost--

      // ── Biome transition (based on distance)
      let newBiome = 0
      for (let i = BIOMES.length-1; i >= 0; i--) {
        if (s.dist >= BIOMES[i].dist) { newBiome = i; break }
      }
      if (newBiome !== s.biome) {
        s.biome   = newBiome
        s.biomeT  = 55
        s.particles = Array.from({length:PARTICLE_CNT}, ()=>new WaterParticle(newBiome))
        SFX.startMusic(newBiome)
        SFX.biomeShift()
        setBiomeIdx(newBiome)
        flashBiome(BIOMES[newBiome].name)
      }
      if (s.biomeT > 0) s.biomeT--

      // ── Surge mechanic (starts later, easier ramp)
      if (!s.surging) {
        s.nextSurge -= spd * 0.5
        s.surgeI = Math.max(0, s.surgeI - 0.05)
        if (s.nextSurge <= 0) {
          s.surging = true
          s.surgeT  = rand(80, 160)
          s.nextSurge = rand(350, 700)
          if (diff >= 2) { SFX.surgeStart(); setSurgeActive(true) }
        }
      } else {
        s.surgeT--
        // Surge intensity scales with difficulty
        const surgeMax = lerpc(0.35, 0.9, diff / 9)
        s.surgeI = Math.min(surgeMax, s.surgeI + 0.055)
        if (s.surgeT <= 0) { s.surging = false; setSurgeActive(false) }
      }

      // ════════════════════════════════════════════════════════════
      //  PHYSICS — Geometry Dash style
      //
      //  Two distinct inputs:
      //  1. Fresh press (prevHold=false → holding=true):
      //     Apply an instant upward IMPULSE (set vy directly).
      //     This gives the snappy "one tap = one jump" feel.
      //  2. Sustained hold:
      //     Add continuous upward acceleration to fight gravity.
      //     This lets you hover/climb when holding.
      //  Release: pure gravity arc, feels natural.
      // ════════════════════════════════════════════════════════════
      const gravDir = s.gravFlipped ? -1 : 1

      if (holding && !s.prevHold) {
        // Fresh press: instant impulse (GD-style)
        s.vy = TAP_IMPULSE * gravDir
      } else if (holding) {
        // Sustained hold: continuous thrust overcomes gravity
        s.vy += (-LIFT_HOLD) * gravDir
      }

      // Gravity always applies, every frame
      s.vy += GRAVITY * gravDir

      // Soft drag
      s.vy *= DRAG

      // Velocity cap with soft lerp at limits (no jarring snap)
      if (s.vy >  MAX_VY_DOWN) s.vy = lerp(s.vy,  MAX_VY_DOWN, 0.3)
      if (s.vy < -MAX_VY_DOWN) s.vy = lerp(s.vy, -MAX_VY_DOWN, 0.3)

      s.prevHold = holding

      // Move ship — do NOT clamp to boundary here; check boundary separately
      s.py += s.vy

      // ── Boundary = instant death, no invincibility grace
      // Wall riding is impossible — the boundary kills immediately
      const atBoundary = s.py <= PLAYER_H/2 + 1 || s.py >= H - PLAYER_H/2 - 1
      if (atBoundary) {
        s.py = clamp(s.py, PLAYER_H/2 + 1, H - PLAYER_H/2 - 1)  // prevent OOB draw
        s.vy = 0
        if (s.inv <= 0) {
          handleDeath(s)
          if (!s.alive) { animRef.current = requestAnimationFrame(loop); return }
        }
      }

      // Engine audio
      if (holding) { SFX.startEngine(); SFX.thrustUpdate(s.vy, spd) } else SFX.stopEngine()

      // Trail
      s.trail.unshift({x:PLAYER_X, y:s.py})
      if (s.trail.length > TRAIL_LEN) s.trail.pop()

      // Distance
      s.dist += spd * 0.50
      setDistance(Math.round(s.dist))

      // ── Spawn obstacles
      // Spacing: starts wide, gets tighter with diff
      const baseInterval = lerpc(165, 90, diff / 9)
      s.obsTimer -= spd
      if (s.obsTimer <= 0) {
        s.obstacles.push(spawnObstacle(diff, s.biome, spd))
        s.obsTimer = Math.max(88, baseInterval - diff * 4)
      }

      // ── Spawn coins
      s.coinTimer -= spd
      if (s.coinTimer <= 0) {
        s.coins_arr.push(new Coin(W+32, rand(55, H-55), s.biome))
        s.coinTimer = randi(170, 360)
      }

      // ── Spawn portals (diff >= 3)
      s.portalTimer -= spd
      if (s.portalTimer <= 0 && diff >= 3) {
        s.portals.push(new GravPortal(W+42, Math.random()>0.5?'grav':'speed'))
        s.portalTimer = randi(420, 760)
      }

      // ── Spawn checkpoints
      s.cpTimer -= spd
      if (s.cpTimer <= 0) {
        s.checkpoints.push(new CheckpointRing(W+42))
        s.cpTimer = randi(480, 820)
      }

      // ── Ambient bolts
      s.boltTimer--
      if (s.boltTimer <= 0) {
        if (diff >= 1) s.bolts.push(new EnergyBolt(s.biome))
        s.boltTimer = randi(28, 70)
      }
      s.bolts = s.bolts.filter(b=>{ b.update(); return !b.dead() })

      // ── Update all
      s.obstacles.forEach(o=>o.update())
      s.obstacles = s.obstacles.filter(o=>!o.isGone())
      s.coins_arr.forEach(c=>c.update(spd))
      s.coins_arr = s.coins_arr.filter(c=>!c.isGone())
      s.portals.forEach(p=>p.update(spd))
      s.portals = s.portals.filter(p=>!p.isGone())
      s.checkpoints.forEach(c=>c.update(spd))
      s.checkpoints = s.checkpoints.filter(c=>!c.isGone())

      if (s.inv > 0) s.inv--

      // ── Collision: obstacles
      for (const o of s.obstacles) {
        if (!o.passed && o.x + o.maxW() < PLAYER_X - 4) {
          o.passed = true; s.score++
          s.pops.push(new ScorePop(PLAYER_X+36, s.py-22, '+1', '#c6a84b'))
          SFX.score(); setScore(s.score)
        }
        if (s.inv <= 0 && o.hits(PLAYER_X, s.py)) {
          handleDeath(s); if (!s.alive) { animRef.current=requestAnimationFrame(loop); return }; break
        }
      }

      // ── Collision: coins
      for (const c of s.coins_arr) {
        if (!c.picked && c.hits(PLAYER_X, s.py)) {
          c.picked=true; s.coins+=COIN_SCORE; s.score+=COIN_SCORE
          for(let i=0;i<12;i++) {
            const col=c.col.replace('#',''); const r=parseInt(col.slice(0,2),16); const g=parseInt(col.slice(2,4),16); const b=parseInt(col.slice(4,6),16)
            s.sparks.push(new Spark(c.x, s.py, `${r},${g},${b}`, true))
          }
          s.pops.push(new ScorePop(c.x, s.py-18, `+${COIN_SCORE}`, c.col))
          SFX.coin(); setCoins(s.coins); setScore(s.score); s.shake.add(1.5)
        }
      }

      // ── Collision: portals
      for (const p of s.portals) {
        if (p.hits(PLAYER_X, s.py)) {
          p.triggered=true
          if (p.type==='grav') {
            s.gravFlipped=!s.gravFlipped; s.vy=0; SFX.gravFlip(); s.shake.add(4.5)
            s.pops.push(new ScorePop(PLAYER_X, s.py-30, '↕ FLIP', '#cc44ff'))
          } else {
            s.speedBoost=180; SFX.portal(); s.shake.add(2.5)
            s.pops.push(new ScorePop(PLAYER_X, s.py-30, '⚡ BOOST', '#44ffcc'))
          }
        }
      }

      // ── Collision: checkpoints
      for (const cp of s.checkpoints) {
        if (cp.hits(PLAYER_X, s.py)) {
          cp.passed=true; s.score+=3; SFX.checkpoint()
          s.pops.push(new ScorePop(cp.x, cp.y-38, '✦ +3', '#ffd700'))
          s.shake.add(2); setScore(s.score)
        }
      }

      // ── Particles
      s.particles.forEach(p=>p.update(spd))
      s.bubbles.forEach(b=>b.update())
      s.starLayers.forEach(sl=>sl.update(spd))
      s.pops   = s.pops.filter(p  =>{ p.update(); return !p.dead() })
      s.sparks = s.sparks.filter(p=>{ p.update(); return !p.dead() })
      s.shake.update()

      // ═══════════════════════════════════════════════════════════
      //  DRAW
      // ═══════════════════════════════════════════════════════════
      ctx.save()
      ctx.translate(s.shake.x, s.shake.y)

      drawBG(ctx, s.tick, spd, s.surgeI, s.biome, s.biomeT)

      const acc = BIOMES[s.biome].accent
      s.starLayers.forEach(sl=>sl.draw(ctx, acc))
      s.bolts.forEach(b=>b.draw(ctx))
      s.bubbles.forEach(b=>b.draw(ctx, acc))
      s.particles.forEach(p=>p.draw(ctx))
      s.portals.forEach(p=>p.draw(ctx))
      s.checkpoints.forEach(c=>c.draw(ctx))
      s.obstacles.forEach(o=>o.draw(ctx))
      s.coins_arr.forEach(c=>c.draw(ctx))

      // Trail
      s.trail.forEach((pt,i)=>{
        const t=1-i/s.trail.length
        ctx.save(); ctx.globalAlpha=t*0.34
        ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`
        ctx.beginPath(); ctx.arc(pt.x,pt.y,lerp(0.8,5.2,t),0,Math.PI*2); ctx.fill(); ctx.restore()
      })

      s.sparks.forEach(p=>p.draw(ctx))
      drawShip(ctx, s.py, s.vy, holding, s.tick, s.inv>0, s.gravFlipped, spd, s.biome)
      s.pops.forEach(p=>p.draw(ctx))

      // Surge label
      if (s.surgeI > 0.3) {
        ctx.save(); ctx.globalAlpha=s.surgeI*0.85; ctx.fillStyle='rgba(240,70,70,1)'
        ctx.font='700 10px "Barlow Condensed",sans-serif'; ctx.textAlign='center'
        ctx.shadowColor='rgba(255,60,60,0.8)'; ctx.shadowBlur=12
        ctx.fillText('▶ SURGE ◀', W/2, 22); ctx.restore()
      }

      // Speed boost bar
      if (s.speedBoost > 0) {
        const pct=s.speedBoost/180; ctx.save(); ctx.globalAlpha=pct*0.72
        ctx.strokeStyle='#44ffcc'; ctx.lineWidth=2.2; ctx.strokeRect(8,H-16,(W-16)*pct,5)
        ctx.fillStyle='#44ffcc'; ctx.globalAlpha=pct*0.22; ctx.fillRect(8,H-16,(W-16)*pct,5)
        ctx.restore()
      }

      // Gravity flip label
      if (s.gravFlipped) {
        ctx.save(); ctx.globalAlpha=0.58; ctx.fillStyle='#cc44ff'
        ctx.font='500 9px sans-serif'; ctx.textAlign='right'
        ctx.fillText('⟳ GRAVITY FLIPPED', W-8, H-8); ctx.restore()
      }

      // Invincibility shimmer
      if (s.inv > 0 && Math.floor(s.tick/3)%2===0) {
        ctx.save(); ctx.globalAlpha=0.09
        ctx.fillStyle=`rgb(${acc[0]},${acc[1]},${acc[2]})`; ctx.fillRect(0,0,W,H); ctx.restore()
      }

      ctx.restore() // end shake

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(animRef.current); SFX.stopEngine() }
  }, [screen, handleDeath, flashBiome])

  // ── Input ─────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return

    const dn = (e) => { e.preventDefault(); SFX.resume(); holdRef.current = true }
    const up = ()  => { holdRef.current = false }
    const kd = (e) => {
      if (['Space','ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)) {
        e.preventDefault(); SFX.resume(); holdRef.current = true
      }
    }
    const ku = (e) => {
      if (['Space','ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)) holdRef.current = false
    }

    canvas.addEventListener('mousedown',   dn, {passive:false})
    canvas.addEventListener('mouseup',     up)
    canvas.addEventListener('mouseleave',  up)
    canvas.addEventListener('touchstart',  dn, {passive:false})
    canvas.addEventListener('touchend',    up)
    canvas.addEventListener('touchcancel', up)
    window.addEventListener('keydown',     kd)
    window.addEventListener('keyup',       ku)
    return () => {
      canvas.removeEventListener('mousedown',   dn)
      canvas.removeEventListener('mouseup',     up)
      canvas.removeEventListener('mouseleave',  up)
      canvas.removeEventListener('touchstart',  dn)
      canvas.removeEventListener('touchend',    up)
      canvas.removeEventListener('touchcancel', up)
      window.removeEventListener('keydown',     kd)
      window.removeEventListener('keyup',       ku)
    }
  }, [screen])

  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => () => { SFX.stopMusic(); SFX.stopEngine() }, [])

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  const biomeAccent = BIOMES[Math.min(biomeIdx, BIOMES.length-1)]
  const accentCSS   = `rgb(${biomeAccent.accent.join(',')})`

  return (
    <div className="rv-wrap">

      {/* INTRO */}
      {screen === 'intro' && (
        <div className="rv-screen">
          <p className="rv-label">The River</p>
          <h2 className="rv-title">Go<br /><em>Against.</em></h2>
          <p className="rv-sub">
            You are the light cutting through the current.<br />
            The crowd flows against you. Find the gap.<br />
            <strong>Hold to rise. Release to fall.</strong>
          </p>
          <div className="rv-rules">
            <div className="rv-rule"><span>↑</span><p>Hold / tap / Space — thrust upward</p></div>
            <div className="rv-rule"><span>↓</span><p>Release — fall naturally with gravity</p></div>
            <div className="rv-rule"><span>★</span><p>Collect coins scattered through the current for bonus score</p></div>
            <div className="rv-rule"><span>✦</span><p>Checkpoint rings give +3 — pass through them</p></div>
            <div className="rv-rule"><span>↕</span><p>Gravity portals flip your world — speed portals boost you forward</p></div>
            <div className="rv-rule"><span>⚡</span><p>Surge zones hit at higher speeds — 6 biomes of escalating chaos await</p></div>
          </div>
          {best > 0 && <p className="rv-best">Your best: <strong>{best} pts</strong></p>}
          <button className="rv-btn rv-btn--gold" onClick={doCountdown}>Enter The River</button>
          <button className="rv-btn rv-btn--ghost" onClick={()=>{ loadBoard(); setScreen('leaderboard') }}>Leaderboard</button>
        </div>
      )}

      {/* COUNTDOWN */}
      {screen === 'countdown' && (
        <div className="rv-screen rv-countdown">
          <p className="rv-label">Get Ready</p>
          <div className="rv-cd-num" key={cdNum}>{cdNum > 0 ? cdNum : 'GO!'}</div>
          <p className="rv-sub">Hold to thrust · Release to fall</p>
        </div>
      )}

      {/* PLAYING */}
      {screen === 'playing' && (
        <div className="rv-game">
          <div className="rv-hud" style={{'--accent': accentCSS}}>
            <div className="rv-hud-cell">
              <span className="rv-hud-label">Score</span>
              <span className="rv-hud-val">{score}</span>
            </div>
            <div className="rv-hud-cell rv-hud-center">
              <span className="rv-hud-label">Distance</span>
              <span className="rv-hud-val" style={{color: accentCSS}}>{distance}m</span>
            </div>
            <div className="rv-hud-cell rv-hud-coins">
              <span className="rv-hud-label">Coins</span>
              <span className="rv-hud-val rv-hud-gold">★ {coins}</span>
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
            <canvas ref={canvasRef} width={W} height={H} className="rv-canvas" />
            {showBiome && (
              <div className="rv-biome-flash" style={{color: accentCSS}}>
                <span className="rv-biome-label">ENTERING</span>
                <span className="rv-biome-name">{biomeName}</span>
              </div>
            )}
            {surgeActive && <div className="rv-surge-banner">SURGE</div>}
          </div>
          <p className="rv-hint">Hold / tap / Space to thrust · Release to fall · Coins &amp; rings for bonus</p>
        </div>
      )}

      {/* DEAD */}
      {screen === 'dead' && (
        <div className="rv-screen">
          <p className="rv-label">Swept Away</p>
          <h2 className="rv-title rv-title--red">The current<br /><em>won this time.</em></h2>
          <div className="rv-stats">
            <div className="rv-stat">
              <span className="rv-stat-n">{finalScore}</span>
              <span className="rv-stat-l">total score</span>
            </div>
            <div className="rv-stat">
              <span className="rv-stat-n">{finalDist}m</span>
              <span className="rv-stat-l">distance</span>
            </div>
            <div className="rv-stat">
              <span className="rv-stat-n rv-stat-gold">★{finalCoins}</span>
              <span className="rv-stat-l">coins</span>
            </div>
          </div>
          {finalScore >= best && finalScore > 0 && <p className="rv-newbest">✦ New Personal Best</p>}
          <div className="rv-save">
            <input className="rv-input" placeholder="Your name for the leaderboard"
              value={username} onChange={e=>setUsername(e.target.value)} maxLength={20} />
            <button className="rv-btn rv-btn--gold" onClick={saveScore} disabled={saving||!username.trim()}>
              {saving ? 'Saving...' : 'Save Score'}
            </button>
          </div>
          <button className="rv-btn rv-btn--ghost" onClick={doCountdown}>Try Again</button>
          <button className="rv-btn rv-btn--ghost" onClick={()=>setScreen('intro')}>Back</button>
        </div>
      )}

      {/* LEADERBOARD */}
      {screen === 'leaderboard' && (
        <div className="rv-screen">
          <p className="rv-label">The Few</p>
          <h2 className="rv-title">Those who<br /><em>held the line.</em></h2>
          <div className="rv-board">
            {board.length === 0 && <p className="rv-board-empty">No scores yet. Be the first.</p>}
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