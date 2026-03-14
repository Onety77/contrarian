import React, { useEffect, useRef } from 'react'
import './Landing.css'

export default function Landing() {
  const canvasRef = useRef(null)

  // Subtle particle field in background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let particles = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const init = () => {
      particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.3,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        alpha: Math.random() * 0.4 + 0.05,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(184, 150, 46, ${p.alpha})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }

    resize()
    init()
    draw()
    window.addEventListener('resize', () => { resize(); init() })
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <section className="landing" id="home">
      <canvas ref={canvasRef} className="landing__canvas" />

      <div className="landing__content">
        <p className="landing__kicker reveal">The internet's home for independent thought</p>

        <h1 className="landing__title reveal reveal-delay-1">
          <span className="landing__title-line">The</span>
          <span className="landing__title-line landing__title-italic">Contrarian</span>
        </h1>

        <p className="landing__sub reveal reveal-delay-2">
          Most people follow the crowd.<br />
          A few never could.
        </p>

        <div className="landing__actions reveal reveal-delay-3">
          <a href="#manifesto" className="landing__btn landing__btn--primary">
            Read the Manifesto
          </a>
          <a href="#test" className="landing__btn landing__btn--ghost">
            Take the Test
          </a>
        </div>

        <div className="landing__scroll reveal reveal-delay-4">
          <span className="landing__scroll-line" />
          <span className="landing__scroll-label">Scroll</span>
        </div>
      </div>

      <div className="landing__ticker-strip">
        <span>$CONTRA</span>
        <span className="sep">·</span>
        <span>THE CONTRARIAN</span>
        <span className="sep">·</span>
        <span>THEY'LL UNDERSTAND LATER</span>
        <span className="sep">·</span>
        <span>$CONTRA</span>
        <span className="sep">·</span>
        <span>THE CONTRARIAN</span>
        <span className="sep">·</span>
        <span>THEY'LL UNDERSTAND LATER</span>
        <span className="sep">·</span>
        <span>$CONTRA</span>
        <span className="sep">·</span>
        <span>THE CONTRARIAN</span>
        <span className="sep">·</span>
        <span>THEY'LL UNDERSTAND LATER</span>
        <span className="sep">·</span>
      </div>
    </section>
  )
}
