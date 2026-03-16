import React, { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, addDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore'
import './TheRiver.css'

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const W              = 760
const H              = 400
const PLAYER_X       = 150
const GRAVITY        = 0.40
const LIFT           = -0.55
const MAX_VY         = 8
const PLAYER_W       = 24
const PLAYER_H       = 16
const BASE_SPEED     = 4.0
const PARTICLE_CNT   = 80
const BUBBLE_CNT     = 28
const TRAIL_LEN      = 20
const OBS_BASE_INT   = 110   // frames between obstacles
const GAP_BASE       = 158
const GAP_MIN        = 105

// ═══════════════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════════════
const rand  = (a, b)    => Math.random() * (b - a) + a
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp  = (a, b, t) => a + (b - a) * t

// ═══════════════════════════════════════════════════════════════════
//  WATER PARTICLE
// ═══════════════════════════════════════════════════════════════════
class WaterParticle {
  constructor() { this.reset(true) }
  reset(init = false) {
    this.x     = init ? rand(0, W) : W + rand(0, 40)
    this.y     = rand(0, H)
    this.vx    = rand(-2.2, -0.8)
    this.vy    = rand(-0.1, 0.1)
    this.r     = rand(1, 3)
    this.alpha = rand(0.05, 0.20)
    this.hue   = rand(220, 270)
  }
  update(speed) {
    this.x += this.vx * (speed / BASE_SPEED)
    this.y += this.vy
    if (this.x < -8) this.reset()
  }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.fillStyle   = `hsl(${this.hue},55%,50%)`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  BUBBLE
// ═══════════════════════════════════════════════════════════════════
class Bubble {
  constructor() { this.reset(true) }
  reset(init = false) {
    this.x      = rand(0, W)
    this.y      = init ? rand(0, H) : H + 8
    this.vy     = rand(-0.5, -0.18)
    this.r      = rand(1.5, 5)
    this.alpha  = rand(0.04, 0.13)
    this.wobble = rand(0, Math.PI * 2)
    this.wSpeed = rand(0.015, 0.04)
  }
  update() {
    this.wobble += this.wSpeed
    this.x += Math.sin(this.wobble) * 0.4
    this.y += this.vy
    if (this.y < -8) this.reset()
  }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.strokeStyle = 'rgba(180,160,255,0.7)'
    ctx.lineWidth   = 0.8
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  OBSTACLE COLUMN
// ═══════════════════════════════════════════════════════════════════
class ObstacleColumn {
  constructor(x, speed, gapSize, diff) {
    this.x      = x
    this.speed  = speed
    this.w      = 42 + Math.min(diff * 1.5, 18)
    this.passed = false
    this.glow   = rand(0, Math.PI * 2)

    const margin    = 70
    const center    = rand(margin + gapSize / 2, H - margin - gapSize / 2)
    this.gapTop     = center - gapSize / 2
    this.gapBottom  = center + gapSize / 2

    // Spike arrays
    this.topSpikes    = this._spikes(diff, 'down')
    this.bottomSpikes = this._spikes(diff, 'up')
  }

  _spikes(diff, dir) {
    const n   = Math.min(2 + Math.floor(diff / 2), 6)
    const out = []
    for (let i = 0; i < n; i++) {
      if (Math.random() > 0.45) {
        out.push({ x: rand(6, this.w - 6), h: rand(7, 15), dir })
      }
    }
    return out
  }

  update() {
    this.x   -= this.speed
    this.glow += 0.045
  }

  isGone() { return this.x + this.w < -10 }

  hits(px, py) {
    const hw = PLAYER_W / 2 - 2
    const hh = PLAYER_H / 2 - 2
    if (px + hw < this.x || px - hw > this.x + this.w) return false
    if (py - hh < this.gapTop || py + hh > this.gapBottom) return true
    return false
  }

  draw(ctx) {
    const g = 0.45 + Math.sin(this.glow) * 0.25

    const drawBlock = (yTop, yBot) => {
      if (yBot - yTop <= 0) return
      const gr = ctx.createLinearGradient(this.x, 0, this.x + this.w, 0)
      gr.addColorStop(0,   'rgba(28,18,58,0.97)')
      gr.addColorStop(0.5, 'rgba(48,32,88,0.97)')
      gr.addColorStop(1,   'rgba(24,16,52,0.97)')
      ctx.fillStyle = gr
      ctx.fillRect(this.x, yTop, this.w, yBot - yTop)

      // Border
      ctx.strokeStyle = `rgba(120,70,200,${g * 0.55})`
      ctx.lineWidth   = 1
      ctx.strokeRect(this.x, yTop, this.w, yBot - yTop)

      // Inner label
      const blockH = yBot - yTop
      if (blockH > 28) {
        ctx.save()
        ctx.globalAlpha  = 0.16
        ctx.fillStyle    = 'rgba(210,180,255,1)'
        ctx.font         = '600 7px Barlow Condensed, sans-serif'
        ctx.textAlign    = 'center'
        ctx.fillText('CROWD', this.x + this.w / 2, yTop + blockH / 2 + 3)
        ctx.restore()
      }
    }

    const drawEdgeGlow = (y, dir) => {
      const eg = ctx.createLinearGradient(0, y - (dir === 'down' ? 14 : 0), 0, y + (dir === 'down' ? 0 : 14))
      eg.addColorStop(dir === 'down' ? 0 : 1, 'transparent')
      eg.addColorStop(dir === 'down' ? 1 : 0, `rgba(150,90,230,${g * 0.55})`)
      ctx.fillStyle = eg
      ctx.fillRect(this.x, y - (dir === 'down' ? 14 : 0), this.w, 14)
    }

    const drawSpikes = (spikes, edgeY) => {
      ctx.fillStyle = `rgba(170,110,245,${g * 0.75})`
      spikes.forEach(s => {
        const tip = s.dir === 'down' ? edgeY + s.h : edgeY - s.h
        ctx.beginPath()
        ctx.moveTo(this.x + s.x - 4, edgeY)
        ctx.lineTo(this.x + s.x + 4, edgeY)
        ctx.lineTo(this.x + s.x,     tip)
        ctx.closePath()
        ctx.fill()
      })
    }

    // Top block
    drawBlock(0, this.gapTop)
    if (this.gapTop > 0) {
      drawEdgeGlow(this.gapTop, 'down')
      drawSpikes(this.topSpikes, this.gapTop)
    }

    // Bottom block
    drawBlock(this.gapBottom, H)
    if (this.gapBottom < H) {
      drawEdgeGlow(this.gapBottom, 'up')
      drawSpikes(this.bottomSpikes, this.gapBottom)
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SCORE POP
// ═══════════════════════════════════════════════════════════════════
class ScorePop {
  constructor(x, y) {
    this.x = x; this.y = y; this.vy = -1.6; this.life = 50; this.max = 50
  }
  update() { this.y += this.vy; this.life-- }
  dead()   { return this.life <= 0 }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha  = this.life / this.max
    ctx.fillStyle    = '#c6a84b'
    ctx.font         = '700 12px Barlow Condensed, sans-serif'
    ctx.textAlign    = 'center'
    ctx.fillText('+1', this.x, this.y)
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  EXPLOSION PARTICLE
// ═══════════════════════════════════════════════════════════════════
class Spark {
  constructor(x, y) {
    const a  = rand(0, Math.PI * 2)
    const sp = rand(1.5, 6.5)
    this.x   = x; this.y = y
    this.vx  = Math.cos(a) * sp; this.vy = Math.sin(a) * sp
    this.r   = rand(2, 5.5)
    this.alpha = 1
    this.col = Math.random() > 0.5 ? '198,168,75' : '230,190,100'
  }
  update() {
    this.x += this.vx; this.y += this.vy
    this.vy    += 0.12; this.vx *= 0.97
    this.alpha -= 0.022; this.r *= 0.97
  }
  dead()   { return this.alpha <= 0 }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = Math.max(0, this.alpha)
    ctx.fillStyle   = `rgb(${this.col})`
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ═══════════════════════════════════════════════════════════════════
//  DRAW PLAYER (ship)
// ═══════════════════════════════════════════════════════════════════
function drawShip(ctx, py, vy, holding, tick, inv) {
  ctx.save()
  ctx.translate(PLAYER_X, py)
  ctx.rotate(clamp(vy * 0.06, -0.5, 0.5))

  if (inv && Math.floor(tick / 4) % 2 === 1) { ctx.restore(); return }

  // Engine glow behind ship
  const eg = ctx.createLinearGradient(-PLAYER_W, 0, -PLAYER_W - 32, 0)
  eg.addColorStop(0,   `rgba(198,168,75,${holding ? 0.45 : 0.25})`)
  eg.addColorStop(1,   'transparent')
  ctx.fillStyle = eg
  ctx.beginPath()
  ctx.ellipse(-PLAYER_W - 4, 0, 28, holding ? 7 : 4, 0, 0, Math.PI * 2)
  ctx.fill()

  // Hull shape
  ctx.beginPath()
  ctx.moveTo(-PLAYER_W / 2,      -PLAYER_H / 2)
  ctx.lineTo( PLAYER_W / 2,      -PLAYER_H / 2 + 3)
  ctx.lineTo( PLAYER_W / 2 + 5,   0)
  ctx.lineTo( PLAYER_W / 2,       PLAYER_H / 2 - 3)
  ctx.lineTo(-PLAYER_W / 2,       PLAYER_H / 2)
  ctx.lineTo(-PLAYER_W / 2 - 4,   0)
  ctx.closePath()

  const hg = ctx.createLinearGradient(-PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W / 2, PLAYER_H / 2)
  hg.addColorStop(0,   '#d4aa30')
  hg.addColorStop(0.45,'#c6a84b')
  hg.addColorStop(1,   '#7a6228')
  ctx.fillStyle   = hg
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,220,120,0.45)'
  ctx.lineWidth   = 1
  ctx.stroke()

  // Cockpit
  ctx.beginPath()
  ctx.ellipse(5, 0, 7, 4.5, 0, 0, Math.PI * 2)
  const cg = ctx.createRadialGradient(3, -1, 0, 5, 0, 7)
  cg.addColorStop(0, 'rgba(210,245,255,0.92)')
  cg.addColorStop(1, 'rgba(70,130,200,0.4)')
  ctx.fillStyle = cg
  ctx.fill()

  // Engine flame
  const fh = holding ? rand(8, 14) : rand(4, 8)
  ctx.beginPath()
  ctx.moveTo(-PLAYER_W / 2, -3)
  ctx.lineTo(-PLAYER_W / 2 - fh - rand(0, 3), 0)
  ctx.lineTo(-PLAYER_W / 2,  3)
  ctx.closePath()
  const fg = ctx.createLinearGradient(-PLAYER_W / 2, 0, -PLAYER_W / 2 - fh - 4, 0)
  fg.addColorStop(0,   'rgba(255,200,80,0.95)')
  fg.addColorStop(0.6, 'rgba(255,110,30,0.7)')
  fg.addColorStop(1,   'transparent')
  ctx.fillStyle = fg
  ctx.fill()

  // Outer glow
  const og = ctx.createRadialGradient(0, 0, PLAYER_W * 0.3, 0, 0, PLAYER_W * 1.8)
  og.addColorStop(0,   'rgba(198,168,75,0.20)')
  og.addColorStop(0.5, 'rgba(198,168,75,0.05)')
  og.addColorStop(1,   'transparent')
  ctx.fillStyle = og
  ctx.beginPath()
  ctx.arc(0, 0, PLAYER_W * 1.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════
//  DRAW BACKGROUND
// ═══════════════════════════════════════════════════════════════════
function drawBG(ctx, tick, speed, surge) {
  // Base gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0,   `rgb(8,5,20)`)
  bg.addColorStop(0.5, `rgb(6,4,16)`)
  bg.addColorStop(1,   `rgb(4,3,12)`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Surge red vignette
  if (surge > 0) {
    const sv = ctx.createRadialGradient(W/2, H/2, H*0.1, W/2, H/2, H*0.95)
    sv.addColorStop(0,   'transparent')
    sv.addColorStop(1,   `rgba(200,20,20,${surge * 0.20})`)
    ctx.fillStyle = sv
    ctx.fillRect(0, 0, W, H)
  }

  // Moving current lines
  ctx.save()
  ctx.globalAlpha = 0.045 + surge * 0.02
  ctx.strokeStyle = 'rgba(110,80,190,1)'
  ctx.lineWidth   = 0.6
  for (let i = 0; i < 10; i++) {
    const y   = (i / 10) * H + 20
    const off = (tick * (speed / BASE_SPEED) * 1.8) % W
    const len = rand(25, 110)
    ctx.beginPath()
    ctx.moveTo((W - off + i * 30) % W, y)
    ctx.lineTo((W - off + i * 30 - len) % W, y)
    ctx.stroke()
  }
  ctx.restore()

  // Top/bottom water boundary
  const tg = ctx.createLinearGradient(0, 0, 0, 20)
  tg.addColorStop(0, 'rgba(90,55,155,0.75)')
  tg.addColorStop(1, 'transparent')
  ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 20)

  const btg = ctx.createLinearGradient(0, H - 20, 0, H)
  btg.addColorStop(0, 'transparent')
  btg.addColorStop(1, 'rgba(90,55,155,0.75)')
  ctx.fillStyle = btg; ctx.fillRect(0, H - 20, W, 20)

  // Boundary lines
  ctx.strokeStyle = 'rgba(130,90,215,0.45)'
  ctx.lineWidth   = 1.5
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.stroke()
}

// ═══════════════════════════════════════════════════════════════════
//  INITIAL STATE FACTORY
// ═══════════════════════════════════════════════════════════════════
const makeState = () => ({
  tick:       0,
  py:         H / 2,
  vy:         0,
  score:      0,
  dist:       0,
  lives:      3,
  speed:      BASE_SPEED,
  obstacles:  [],
  obsTimer:   OBS_BASE_INT,
  particles:  Array.from({ length: PARTICLE_CNT }, () => new WaterParticle()),
  bubbles:    Array.from({ length: BUBBLE_CNT },   () => new Bubble()),
  trail:      [],
  pops:       [],
  sparks:     [],
  inv:        0,
  alive:      true,
  surging:    false,
  surgeT:     0,
  surgeI:     0,
  nextSurge:  rand(300, 600),
  diff:       0,
})

// ═══════════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function TheRiver() {
  const canvasRef  = useRef(null)
  const stateRef   = useRef(null)
  const animRef    = useRef(null)
  const holdRef    = useRef(false)

  const [screen,     setScreen]     = useState('intro')
  const [score,      setScore]      = useState(0)
  const [lives,      setLives]      = useState(3)
  const [distance,   setDistance]   = useState(0)
  const [best,       setBest]       = useState(() => parseInt(localStorage.getItem('contra_river_best') || '0'))
  const [finalScore, setFinalScore] = useState(0)
  const [finalDist,  setFinalDist]  = useState(0)
  const [board,      setBoard]      = useState([])
  const [username,   setUsername]   = useState('')
  const [saving,     setSaving]     = useState(false)
  const [cdNum,      setCdNum]      = useState(3)

  // ── Leaderboard ──────────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    try {
      const q    = query(collection(db,'river_leaderboard'), orderBy('score','desc'), limit(10))
      const snap = await getDocs(q)
      setBoard(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    } catch(e) {}
  }, [])

  const saveScore = useCallback(async () => {
    if (!username.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db,'river_leaderboard'), {
        username:  username.trim(),
        score:     finalScore,
        distance:  finalDist,
        timestamp: serverTimestamp(),
      })
      await loadBoard()
      setScreen('leaderboard')
    } catch(e) {}
    setSaving(false)
  }, [username, finalScore, finalDist, loadBoard])

  // ── Start ────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    stateRef.current = makeState()
    setScore(0); setLives(3); setDistance(0)
    setScreen('playing')
  }, [])

  const doCountdown = useCallback(() => {
    setScreen('countdown')
    let n = 3
    setCdNum(3)
    const iv = setInterval(() => {
      n--
      setCdNum(n)
      if (n <= 0) { clearInterval(iv); startGame() }
    }, 800)
    return () => clearInterval(iv)
  }, [startGame])

  // ── Die / lose life ──────────────────────────────────────────
  const handleDeath = useCallback((s) => {
    // Sparks
    for (let i = 0; i < 30; i++) s.sparks.push(new Spark(PLAYER_X, s.py))

    const next = s.lives - 1
    if (next <= 0) {
      s.alive = false
      const nb = Math.max(best, s.score)
      if (s.score > best) {
        setBest(nb)
        localStorage.setItem('contra_river_best', String(nb))
      }
      setFinalScore(s.score)
      setFinalDist(Math.round(s.dist))
      setScreen('dead')
    } else {
      s.lives   = next
      s.vy      = 0
      s.py      = H / 2
      s.inv     = 150
      setLives(next)
    }
  }, [best])

  // ── Game loop ────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s   = stateRef.current

    const loop = () => {
      s.tick++
      const holding = holdRef.current

      // Speed & difficulty ramp
      s.speed = BASE_SPEED + (s.dist / 600) * 0.22
      s.diff  = Math.floor(s.dist / 350)

      // Surge mechanic
      if (!s.surging) {
        s.nextSurge--
        s.surgeI = Math.max(0, s.surgeI - 0.05)
        if (s.nextSurge <= 0) {
          s.surging   = true
          s.surgeT    = rand(100, 200)
          s.nextSurge = rand(320, 680)
        }
      } else {
        s.surgeT--
        s.surgeI = Math.min(1, s.surgeI + 0.055)
        if (s.surgeT <= 0) s.surging = false
      }

      const spd = s.speed * (1 + s.surgeI * 0.50)

      // Physics
      s.vy += holding ? LIFT : GRAVITY
      s.vy  = clamp(s.vy, -MAX_VY, MAX_VY)
      s.py  = clamp(s.py + s.vy, PLAYER_H / 2 + 1, H - PLAYER_H / 2 - 1)

      // Boundary death
      if (s.py <= PLAYER_H / 2 + 1 || s.py >= H - PLAYER_H / 2 - 1) {
        if (s.inv <= 0) { handleDeath(s); if (!s.alive) { animRef.current = requestAnimationFrame(loop); return } }
      }

      // Trail
      s.trail.unshift({ x: PLAYER_X, y: s.py })
      if (s.trail.length > TRAIL_LEN) s.trail.pop()

      // Distance
      s.dist += spd * 0.48
      setDistance(Math.round(s.dist))

      // Spawn obstacles
      s.obsTimer -= spd
      if (s.obsTimer <= 0) {
        const gap = Math.max(GAP_MIN, GAP_BASE - s.diff * 4)
        s.obstacles.push(new ObstacleColumn(W + 50, spd, gap, s.diff))
        s.obsTimer = Math.max(90, OBS_BASE_INT - s.diff * 5)
      }

      // Update obstacles
      s.obstacles.forEach(o => o.update())
      s.obstacles = s.obstacles.filter(o => !o.isGone())

      // Collision & score
      if (s.inv > 0) s.inv--
      for (const o of s.obstacles) {
        if (!o.passed && o.x + o.w < PLAYER_X - 4) {
          o.passed = true
          s.score++
          s.pops.push(new ScorePop(PLAYER_X + 35, s.py - 22))
          setScore(s.score)
        }
        if (s.inv <= 0 && o.hits(PLAYER_X, s.py)) {
          handleDeath(s)
          if (!s.alive) { animRef.current = requestAnimationFrame(loop); return }
          break
        }
      }

      // Particles
      s.particles.forEach(p => p.update(spd))
      s.bubbles.forEach(b => b.update())
      s.pops   = s.pops.filter(p   => { p.update();   return !p.dead() })
      s.sparks = s.sparks.filter(p => { p.update();   return !p.dead() })

      // ══ DRAW ══════════════════════════════════════════════════

      drawBG(ctx, s.tick, spd, s.surgeI)

      s.bubbles.forEach(b => b.draw(ctx))
      s.particles.forEach(p => p.draw(ctx))
      s.obstacles.forEach(o => o.draw(ctx))

      // Trail
      s.trail.forEach((pt, i) => {
        const t = 1 - i / s.trail.length
        ctx.save()
        ctx.globalAlpha = t * 0.32
        ctx.fillStyle   = '#c6a84b'
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, lerp(1.5, 5, t), 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })

      s.sparks.forEach(p => p.draw(ctx))
      drawShip(ctx, s.py, s.vy, holding, s.tick, s.inv > 0)
      s.pops.forEach(p => p.draw(ctx))

      // Surge label
      if (s.surgeI > 0.35) {
        ctx.save()
        ctx.globalAlpha  = s.surgeI * 0.75
        ctx.fillStyle    = 'rgba(230,70,70,1)'
        ctx.font         = '700 10px Barlow Condensed, sans-serif'
        ctx.letterSpacing = '0.4em'
        ctx.textAlign    = 'center'
        ctx.fillText('SURGE', W / 2, 22)
        ctx.restore()
      }

      // Invincibility shimmer
      if (s.inv > 0 && Math.floor(s.tick / 3) % 2 === 0) {
        ctx.save()
        ctx.globalAlpha = 0.1
        ctx.fillStyle   = 'rgba(255,200,80,1)'
        ctx.fillRect(0, 0, W, H)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [screen, handleDeath])

  // ── Input ─────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return

    const pos = (e) => {
      const r  = canvas.getBoundingClientRect()
      const sx = W / r.width
      const sy = H / r.height
      const src = e.touches ? e.touches[0] : e
      return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy }
    }

    const dn  = (e) => { e.preventDefault(); holdRef.current = true }
    const up  = ()  => { holdRef.current = false }
    const kd  = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); holdRef.current = true } }
    const ku  = (e) => { if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w') holdRef.current = false }

    canvas.addEventListener('mousedown',  dn, { passive: false })
    canvas.addEventListener('mouseup',    up)
    canvas.addEventListener('touchstart', dn, { passive: false })
    canvas.addEventListener('touchend',   up)
    window.addEventListener('keydown',    kd)
    window.addEventListener('keyup',      ku)
    return () => {
      canvas.removeEventListener('mousedown',  dn)
      canvas.removeEventListener('mouseup',    up)
      canvas.removeEventListener('touchstart', dn)
      canvas.removeEventListener('touchend',   up)
      window.removeEventListener('keydown',    kd)
      window.removeEventListener('keyup',      ku)
    }
  }, [screen])

  useEffect(() => { loadBoard() }, [loadBoard])

  // ══════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="rv-wrap">

      {/* INTRO */}
      {screen === 'intro' && (
        <div className="rv-screen">
          <p className="rv-label">The River</p>
          <h2 className="rv-title">Go<br /><em>Against.</em></h2>
          <p className="rv-sub">
            You are the light moving through the current.<br />
            The crowd flows against you. Find the gap.<br />
            <strong>Hold to rise. Release to fall.</strong>
          </p>
          <div className="rv-rules">
            <div className="rv-rule"><span>↑</span><p>Hold / tap / Space to thrust upward</p></div>
            <div className="rv-rule"><span>↓</span><p>Release to fall with gravity</p></div>
            <div className="rv-rule"><span>◈</span><p>3 lives — each hit costs one</p></div>
            <div className="rv-rule"><span>⚡</span><p>Surge moments accelerate everything</p></div>
          </div>
          {best > 0 && <p className="rv-best">Your best: <strong>{best} gaps</strong></p>}
          <button className="rv-btn rv-btn--gold" onClick={doCountdown}>Enter The River</button>
          <button className="rv-btn rv-btn--ghost" onClick={() => { loadBoard(); setScreen('leaderboard') }}>Leaderboard</button>
        </div>
      )}

      {/* COUNTDOWN */}
      {screen === 'countdown' && (
        <div className="rv-screen rv-countdown">
          <p className="rv-label">Get Ready</p>
          <div className="rv-cd-num">{cdNum > 0 ? cdNum : 'GO'}</div>
          <p className="rv-sub">Hold to thrust · Release to fall</p>
        </div>
      )}

      {/* PLAYING */}
      {screen === 'playing' && (
        <div className="rv-game">
          <div className="rv-hud">
            <div className="rv-hud-cell">
              <span className="rv-hud-label">Score</span>
              <span className="rv-hud-val">{score}</span>
            </div>
            <div className="rv-hud-cell rv-hud-center">
              <span className="rv-hud-label">Distance</span>
              <span className="rv-hud-val rv-hud-gold">{distance}m</span>
            </div>
            <div className="rv-hud-cell rv-hud-right">
              <span className="rv-hud-label">Lives</span>
              <span className="rv-hud-val">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={`rv-life ${i >= lives ? 'rv-life--lost' : ''}`}>◈</span>
                ))}
              </span>
            </div>
          </div>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="rv-canvas"
          />
          <p className="rv-hint">Hold / tap / Space to thrust · Release to fall</p>
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
              <span className="rv-stat-l">gaps cleared</span>
            </div>
            <div className="rv-stat">
              <span className="rv-stat-n">{finalDist}m</span>
              <span className="rv-stat-l">distance</span>
            </div>
          </div>
          {finalScore > best && <p className="rv-newbest">✦ New Personal Best</p>}
          <div className="rv-save">
            <input
              className="rv-input"
              placeholder="Your name for the leaderboard"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
            />
            <button className="rv-btn rv-btn--gold" onClick={saveScore} disabled={saving || !username.trim()}>
              {saving ? 'Saving...' : 'Save Score'}
            </button>
          </div>
          <button className="rv-btn rv-btn--ghost" onClick={doCountdown}>Try Again</button>
          <button className="rv-btn rv-btn--ghost" onClick={() => setScreen('intro')}>Back</button>
        </div>
      )}

      {/* LEADERBOARD */}
      {screen === 'leaderboard' && (
        <div className="rv-screen">
          <p className="rv-label">The Few</p>
          <h2 className="rv-title">Those who<br /><em>held the line.</em></h2>
          <div className="rv-board">
            {board.length === 0 && <p className="rv-board-empty">No scores yet. Be the first.</p>}
            {board.map((e, i) => (
              <div key={e.id} className={`rv-board-row ${i === 0 ? 'rv-board-row--first' : ''}`}>
                <span className="rv-board-rank">#{i + 1}</span>
                <span className="rv-board-name">{e.username}</span>
                <span className="rv-board-score">{e.score} gaps</span>
                <span className="rv-board-dist">{e.distance}m</span>
              </div>
            ))}
          </div>
          <button className="rv-btn rv-btn--gold" onClick={doCountdown}>Play</button>
          <button className="rv-btn rv-btn--ghost" onClick={() => setScreen('intro')}>Back</button>
        </div>
      )}

    </div>
  )
}
