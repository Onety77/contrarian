import React, { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../firebase'
import { collection, addDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore'
import './TheRiver.css'

// ─── CONSTANTS ───────────────────────────────────────────────
const CANVAS_W        = 480
const CANVAS_H        = 700
const PLAYER_RADIUS   = 10
const BASE_SPEED      = 1.8
const PARTICLE_COUNT  = 220
const OBSTACLE_INTERVAL = 90   // frames between obstacle spawns
const ROUND_DURATION  = 18     // seconds per round
const MAX_ROUNDS      = 10

// Crowd particle colors — all flowing DOWN
const CROWD_COLORS = ['#4a4460','#3d3d5c','#524870','#3a3a52','#5c4f7a']

// ─── UTILITIES ───────────────────────────────────────────────
const rand  = (a, b)    => Math.random() * (b - a) + a
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp  = (a, b, t) => a + (b - a) * t

// ─── PARTICLE CLASS ──────────────────────────────────────────
class Particle {
  constructor(speed) {
    this.reset(speed)
  }
  reset(speed) {
    this.x     = rand(0, CANVAS_W)
    this.y     = rand(-CANVAS_H, 0)
    this.r     = rand(1.5, 4)
    this.speed = rand(speed * 0.6, speed * 1.6)
    this.alpha = rand(0.25, 0.7)
    this.color = CROWD_COLORS[Math.floor(rand(0, CROWD_COLORS.length))]
    this.wobble = rand(0, Math.PI * 2)
    this.wobbleSpeed = rand(0.01, 0.04)
  }
  update(speed) {
    this.wobble += this.wobbleSpeed
    this.x += Math.sin(this.wobble) * 0.4
    this.y += this.speed
    if (this.y > CANVAS_H + 10) this.reset(speed)
  }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.fillStyle   = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ─── OBSTACLE CLASS ──────────────────────────────────────────
class Obstacle {
  constructor(speed) {
    this.w     = rand(50, 140)
    this.h     = rand(18, 32)
    this.x     = rand(20, CANVAS_W - 20 - this.w)
    this.y     = -this.h - 10
    this.speed = speed * rand(0.7, 1.1)
    this.alpha = 0
  }
  update() {
    this.y    += this.speed
    this.alpha = Math.min(1, this.alpha + 0.05)
  }
  isOffScreen() { return this.y > CANVAS_H + 20 }
  draw(ctx) {
    ctx.save()
    ctx.globalAlpha = this.alpha * 0.55
    ctx.fillStyle   = '#2a2040'
    ctx.strokeStyle = 'rgba(100,80,160,0.4)'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.roundRect(this.x, this.y, this.w, this.h, 6)
    ctx.fill()
    ctx.stroke()
    ctx.globalAlpha = this.alpha * 0.35
    ctx.fillStyle   = 'rgba(180,150,255,0.6)'
    ctx.font        = '500 9px Barlow Condensed, sans-serif'
    ctx.letterSpacing = '0.15em'
    ctx.textAlign   = 'center'
    ctx.fillText('FOLLOW THE CROWD', this.x + this.w / 2, this.y + this.h / 2 + 3)
    ctx.restore()
  }
  hits(px, py) {
    return px > this.x - PLAYER_RADIUS &&
           px < this.x + this.w + PLAYER_RADIUS &&
           py > this.y - PLAYER_RADIUS &&
           py < this.y + this.h + PLAYER_RADIUS
  }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function TheRiver({ onGameEnd }) {
  const canvasRef    = useRef(null)
  const stateRef     = useRef(null)
  const animRef      = useRef(null)
  const inputRef     = useRef({ x: CANVAS_W / 2, y: CANVAS_H * 0.75, active: false })

  const [screen,    setScreen]    = useState('intro')   // intro | playing | dead | victory | leaderboard
  const [round,     setRound]     = useState(1)
  const [distance,  setDistance]  = useState(0)
  const [countdown, setCountdown] = useState(ROUND_DURATION)
  const [hits,      setHits]      = useState(0)
  const [board,     setBoard]     = useState([])
  const [username,  setUsername]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [finalDist, setFinalDist] = useState(0)

  // ── Load leaderboard ────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    try {
      const q    = query(collection(db, 'leaderboard'), orderBy('distance', 'desc'), limit(10))
      const snap = await getDocs(q)
      setBoard(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch(e) {}
  }, [])

  // ── Save score ──────────────────────────────────────────────
  const saveScore = useCallback(async (dist, roundReached) => {
    if (!username.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'leaderboard'), {
        username:     username.trim(),
        distance:     dist,
        round:        roundReached,
        timestamp:    serverTimestamp(),
      })
      await loadBoard()
    } catch(e) {}
    setSaving(false)
    setScreen('leaderboard')
  }, [username, loadBoard])

  // ── Build initial game state ─────────────────────────────────
  const buildState = useCallback((r) => {
    const speed = BASE_SPEED + (r - 1) * 0.55
    return {
      round:       r,
      speed,
      particles:   Array.from({ length: PARTICLE_COUNT }, () => new Particle(speed)),
      obstacles:   [],
      obstFrame:   0,
      px:          CANVAS_W / 2,
      py:          CANVAS_H * 0.72,
      vx:          0,
      vy:          0,
      distance:    0,
      hits:        0,
      maxHits:     2 + Math.floor(r / 2),   // more forgiving early
      frame:       0,
      timer:       ROUND_DURATION * 60,     // in frames
      alive:       true,
      trailPoints: [],
      surge:       { active: false, timer: 0, intensity: 0 },
      nextSurge:   rand(180, 360),
    }
  }, [])

  // ── Start / next round ───────────────────────────────────────
  const startRound = useCallback((r) => {
    stateRef.current = buildState(r)
    setRound(r)
    setHits(0)
    setCountdown(ROUND_DURATION)
    setDistance(0)
    setScreen('playing')
  }, [buildState])

  // ── Game loop ────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const s   = stateRef.current

    const loop = () => {
      const inp = inputRef.current
      s.frame++
      s.timer--

      // ── Surge mechanic ──
      if (!s.surge.active) {
        s.nextSurge--
        if (s.nextSurge <= 0) {
          s.surge.active    = true
          s.surge.timer     = rand(80, 160)
          s.surge.intensity = rand(1.4, 2.2 + s.round * 0.15)
          s.nextSurge       = rand(200, 420)
        }
      } else {
        s.surge.timer--
        if (s.surge.timer <= 0) s.surge.active = false
      }

      const currentSpeed = s.speed * (s.surge.active ? s.surge.intensity : 1)

      // ── Update particles ──
      s.particles.forEach(p => { p.speed = p.speed * 0 + currentSpeed * rand(0.6, 1.6); p.update(currentSpeed) })

      // ── Spawn obstacles ──
      s.obstFrame++
      const obstInterval = Math.max(30, OBSTACLE_INTERVAL - s.round * 7)
      if (s.obstFrame >= obstInterval) {
        s.obstacles.push(new Obstacle(currentSpeed))
        s.obstFrame = 0
      }
      s.obstacles = s.obstacles.filter(o => !o.isOffScreen())
      s.obstacles.forEach(o => o.update())

      // ── Player movement ──
      if (inp.active) {
        const tx  = clamp(inp.x, PLAYER_RADIUS + 5, CANVAS_W - PLAYER_RADIUS - 5)
        const ty  = clamp(inp.y, PLAYER_RADIUS + 5, CANVAS_H - PLAYER_RADIUS - 5)
        s.vx      = lerp(s.vx, (tx - s.px) * 0.18, 0.35)
        s.vy      = lerp(s.vy, (ty - s.py) * 0.18, 0.35)
      } else {
        s.vx *= 0.88
        s.vy *= 0.88
      }

      // Current drags player down
      s.vy += currentSpeed * 0.045

      s.px = clamp(s.px + s.vx, PLAYER_RADIUS + 2, CANVAS_W - PLAYER_RADIUS - 2)
      s.py = clamp(s.py + s.vy, PLAYER_RADIUS + 2, CANVAS_H - PLAYER_RADIUS - 2)

      // Distance = how far UP from start (inverted y)
      const upward = Math.max(0, CANVAS_H * 0.72 - s.py)
      s.distance   = Math.max(s.distance, upward)

      // Trail
      s.trailPoints.unshift({ x: s.px, y: s.py, a: 1 })
      if (s.trailPoints.length > 28) s.trailPoints.pop()

      // ── Collision ──
      let hitThisFrame = false
      s.obstacles.forEach(o => {
        if (o.hits(s.px, s.py)) hitThisFrame = true
      })
      if (hitThisFrame && !s._hitCooldown) {
        s.hits++
        s._hitCooldown = 40
        setHits(s.hits)
      }
      if (s._hitCooldown > 0) s._hitCooldown--

      // ── Timer ──
      const secLeft = Math.ceil(s.timer / 60)
      setCountdown(secLeft)
      setDistance(Math.round(s.distance))

      // ── End conditions ──
      if (s.hits >= s.maxHits) {
        s.alive = false
        setFinalDist(Math.round(s.distance))
        setScreen('dead')
        return
      }
      if (s.timer <= 0) {
        if (s.round >= MAX_ROUNDS) {
          setFinalDist(Math.round(s.distance))
          setScreen('victory')
        } else {
          startRound(s.round + 1)
        }
        return
      }

      // ── DRAW ──────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H)
      const darkness = Math.min(0.98, 0.82 + (s.round - 1) * 0.018)
      bg.addColorStop(0,   `rgba(6,4,14,${darkness})`)
      bg.addColorStop(0.5, `rgba(10,7,22,${darkness})`)
      bg.addColorStop(1,   `rgba(4,3,10,${darkness})`)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // Surge vignette
      if (s.surge.active) {
        const t   = 1 - s.surge.timer / 160
        const vig = ctx.createRadialGradient(CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.2, CANVAS_W/2, CANVAS_H/2, CANVAS_H*0.85)
        vig.addColorStop(0,   'transparent')
        vig.addColorStop(1,   `rgba(180,20,20,${0.18 * Math.min(1,t*2)})`)
        ctx.fillStyle = vig
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      }

      // Crowd particles
      s.particles.forEach(p => p.draw(ctx))

      // Obstacles
      s.obstacles.forEach(o => o.draw(ctx))

      // River banks (subtle)
      ctx.save()
      ctx.strokeStyle = 'rgba(198,168,75,0.06)'
      ctx.lineWidth   = 1
      ctx.setLineDash([4, 8])
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(8, CANVAS_H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(CANVAS_W-8, 0); ctx.lineTo(CANVAS_W-8, CANVAS_H); ctx.stroke()
      ctx.restore()

      // Trail
      s.trailPoints.forEach((pt, i) => {
        const a = (1 - i / s.trailPoints.length) * 0.35
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, PLAYER_RADIUS * 0.55 * (1 - i/s.trailPoints.length), 0, Math.PI*2)
        ctx.fillStyle = `rgba(198,168,75,${a})`
        ctx.fill()
      })

      // Player glow
      const hitFlash = s._hitCooldown > 0 && s._hitCooldown > 20
      const glowColor = hitFlash ? '220,60,60' : '198,168,75'
      const glowSize  = PLAYER_RADIUS * (3.5 + Math.sin(s.frame * 0.08) * 0.5)
      const glow      = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, glowSize)
      glow.addColorStop(0,   `rgba(${glowColor},0.55)`)
      glow.addColorStop(0.4, `rgba(${glowColor},0.18)`)
      glow.addColorStop(1,   'transparent')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(s.px, s.py, glowSize, 0, Math.PI*2)
      ctx.fill()

      // Player core
      ctx.beginPath()
      ctx.arc(s.px, s.py, PLAYER_RADIUS, 0, Math.PI*2)
      ctx.fillStyle = hitFlash ? `rgb(255,100,100)` : `rgb(220,185,80)`
      ctx.fill()
      ctx.beginPath()
      ctx.arc(s.px, s.py, PLAYER_RADIUS * 0.45, 0, Math.PI*2)
      ctx.fillStyle = 'rgba(255,240,180,0.95)'
      ctx.fill()

      // Upstream arrow above player
      ctx.save()
      ctx.globalAlpha = 0.45 + Math.sin(s.frame * 0.06) * 0.2
      ctx.fillStyle   = 'rgba(198,168,75,0.8)'
      ctx.beginPath()
      const ax = s.px, ay = s.py - PLAYER_RADIUS - 14
      ctx.moveTo(ax, ay - 7)
      ctx.lineTo(ax - 5, ay)
      ctx.lineTo(ax + 5, ay)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Surge warning text
      if (s.surge.active && s.surge.timer > 100) {
        ctx.save()
        ctx.globalAlpha  = Math.min(1, (160 - s.surge.timer) / 30) * 0.7
        ctx.fillStyle    = 'rgba(220,80,80,0.9)'
        ctx.font         = '600 10px Barlow Condensed, sans-serif'
        ctx.letterSpacing = '0.3em'
        ctx.textAlign    = 'center'
        ctx.fillText('SURGE', CANVAS_W / 2, 28)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(loop)
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [screen, startRound])

  // ── Input — unified mouse + touch ───────────────────────────
  const getPos = (e, canvas) => {
    const rect  = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top)  * scaleY,
    }
  }

  useEffect(() => {
    if (screen !== 'playing') return
    const canvas = canvasRef.current
    if (!canvas) return

    const onStart = (e) => {
      e.preventDefault()
      const p = getPos(e, canvas)
      inputRef.current = { ...p, active: true }
    }
    const onMove = (e) => {
      e.preventDefault()
      if (!inputRef.current.active) return
      const p = getPos(e, canvas)
      inputRef.current = { ...p, active: true }
    }
    const onEnd = () => { inputRef.current.active = false }

    const onKey = (e) => {
      const s = stateRef.current
      if (!s) return
      const step = 18
      if (e.key === 'ArrowLeft'  || e.key === 'a') inputRef.current = { x: s.px - step, y: s.py, active: true }
      if (e.key === 'ArrowRight' || e.key === 'd') inputRef.current = { x: s.px + step, y: s.py, active: true }
      if (e.key === 'ArrowUp'    || e.key === 'w') inputRef.current = { x: s.px, y: s.py - step, active: true }
      if (e.key === 'ArrowDown'  || e.key === 's') inputRef.current = { x: s.px, y: s.py + step, active: true }
    }
    const onKeyUp = () => { inputRef.current.active = false }

    canvas.addEventListener('mousedown',  onStart, { passive: false })
    canvas.addEventListener('mousemove',  onMove,  { passive: false })
    canvas.addEventListener('mouseup',    onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove',  onMove,  { passive: false })
    canvas.addEventListener('touchend',   onEnd)
    window.addEventListener('keydown',    onKey)
    window.addEventListener('keyup',      onKeyUp)

    return () => {
      canvas.removeEventListener('mousedown',  onStart)
      canvas.removeEventListener('mousemove',  onMove)
      canvas.removeEventListener('mouseup',    onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove',  onMove)
      canvas.removeEventListener('touchend',   onEnd)
      window.removeEventListener('keydown',    onKey)
      window.removeEventListener('keyup',      onKeyUp)
    }
  }, [screen])

  useEffect(() => { loadBoard() }, [loadBoard])

  // ── Max hits for current round ───────────────────────────────
  const maxHits = stateRef.current ? stateRef.current.maxHits : 3

  // ── RENDER ──────────────────────────────────────────────────
  return (
    <div className="river-wrap">

      {/* ── INTRO ── */}
      {screen === 'intro' && (
        <div className="river-screen river-intro">
          <p className="river-label">The River</p>
          <h2 className="river-intro__title">Go<br /><em>Against.</em></h2>
          <p className="river-intro__sub">
            You are the light. The crowd is the current.<br />
            Move upstream. Don't get swept away.
          </p>
          <div className="river-intro__rules">
            <div className="river-rule">
              <span>↑</span>
              <p>Drag or use WASD / arrows to move upstream</p>
            </div>
            <div className="river-rule">
              <span>⚡</span>
              <p>Avoid crowd obstacles — each hit costs you</p>
            </div>
            <div className="river-rule">
              <span>◈</span>
              <p>Survive all {MAX_ROUNDS} rounds to reach the leaderboard</p>
            </div>
          </div>
          <button className="river-btn river-btn--gold" onClick={() => startRound(1)}>
            Enter The River
          </button>
          <button className="river-btn river-btn--ghost" onClick={() => { loadBoard(); setScreen('leaderboard') }}>
            View Leaderboard
          </button>
        </div>
      )}

      {/* ── PLAYING ── */}
      {screen === 'playing' && (
        <div className="river-game">
          {/* HUD */}
          <div className="river-hud">
            <div className="river-hud__item">
              <span className="river-hud__label">Round</span>
              <span className="river-hud__val">{round} <span className="river-hud__max">/ {MAX_ROUNDS}</span></span>
            </div>
            <div className="river-hud__item river-hud__item--center">
              <span className="river-hud__label">Distance</span>
              <span className="river-hud__val river-hud__val--gold">{distance}m</span>
            </div>
            <div className="river-hud__item river-hud__item--right">
              <span className="river-hud__label">Time</span>
              <span className={`river-hud__val ${countdown <= 5 ? 'river-hud__val--red' : ''}`}>{countdown}s</span>
            </div>
          </div>

          {/* Lives */}
          <div className="river-lives">
            {Array.from({ length: maxHits }).map((_, i) => (
              <span key={i} className={`river-life ${i < hits ? 'river-life--lost' : ''}`}>◈</span>
            ))}
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="river-canvas"
          />

          <p className="river-hint">Hold and drag to move your light upstream</p>
        </div>
      )}

      {/* ── DEAD ── */}
      {screen === 'dead' && (
        <div className="river-screen river-dead">
          <p className="river-label">Swept Away</p>
          <h2 className="river-dead__title">The current<br /><em>won this time.</em></h2>
          <div className="river-stat">
            <span className="river-stat__n">{finalDist}m</span>
            <span className="river-stat__l">upstream before the crowd took you</span>
          </div>
          <div className="river-stat">
            <span className="river-stat__n">Round {round}</span>
            <span className="river-stat__l">of {MAX_ROUNDS}</span>
          </div>
          <div className="river-save">
            <input
              className="river-input"
              placeholder="Your name for the leaderboard"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
            />
            <button
              className="river-btn river-btn--gold"
              onClick={() => saveScore(finalDist, round)}
              disabled={saving || !username.trim()}
            >
              {saving ? 'Saving...' : 'Save Score'}
            </button>
          </div>
          <button className="river-btn river-btn--ghost" onClick={() => startRound(1)}>
            Try Again
          </button>
        </div>
      )}

      {/* ── VICTORY ── */}
      {screen === 'victory' && (
        <div className="river-screen river-victory">
          <p className="river-label">The Few</p>
          <h2 className="river-victory__title">You held.<br /><em>All the way.</em></h2>
          <p className="river-victory__sub">
            {MAX_ROUNDS} rounds. The current never took you.<br />
            You are exactly who this was built for.
          </p>
          <div className="river-stat">
            <span className="river-stat__n">{finalDist}m</span>
            <span className="river-stat__l">total distance upstream</span>
          </div>
          <div className="river-save">
            <input
              className="river-input"
              placeholder="Your name for the leaderboard"
              value={username}
              onChange={e => setUsername(e.target.value)}
              maxLength={20}
            />
            <button
              className="river-btn river-btn--gold"
              onClick={() => saveScore(finalDist, MAX_ROUNDS)}
              disabled={saving || !username.trim()}
            >
              {saving ? 'Saving...' : 'Claim Your Place'}
            </button>
          </div>
          <button className="river-btn river-btn--ghost" onClick={() => startRound(1)}>
            Play Again
          </button>
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {screen === 'leaderboard' && (
        <div className="river-screen river-board">
          <p className="river-label">The Few</p>
          <h2 className="river-board__title">Those who<br /><em>held the line.</em></h2>
          <div className="river-board__list">
            {board.length === 0 && (
              <p className="river-board__empty">No scores yet. Be the first.</p>
            )}
            {board.map((entry, i) => (
              <div key={entry.id} className={`river-board__row ${i === 0 ? 'river-board__row--first' : ''}`}>
                <span className="river-board__rank">#{i + 1}</span>
                <span className="river-board__name">{entry.username}</span>
                <span className="river-board__dist">{entry.distance}m</span>
                <span className="river-board__round">R{entry.round}</span>
              </div>
            ))}
          </div>
          <button className="river-btn river-btn--gold" onClick={() => startRound(1)}>
            Enter The River
          </button>
          <button className="river-btn river-btn--ghost" onClick={() => setScreen('intro')}>
            Back
          </button>
        </div>
      )}

    </div>
  )
}
