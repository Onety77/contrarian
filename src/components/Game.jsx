import React, { useEffect, useRef } from 'react'
import './Game.css'

/**
 * ============================================================
 * THE GAME — "Go Against"
 * ============================================================
 * This module is intentionally left as a placeholder.
 * The full game will be built in isolation and dropped in here.
 *
 * HOW TO INTEGRATE THE FULL GAME WHEN READY:
 * 1. Build the game as a self-contained React component
 * 2. Replace the <GamePlaceholder /> render below with your component
 * 3. Import it at the top of this file
 * 4. The section wrapper, heading, and layout will remain as-is
 *
 * WHAT THE GAME SHOULD RECEIVE AS PROPS (suggested interface):
 * - onGameEnd(score, username) => void  (to save to Firebase leaderboard)
 *
 * FIREBASE LEADERBOARD COLLECTION: 'leaderboard'
 * Document shape: { username, score, timestamp }
 * ============================================================
 */

export default function Game() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.06 }
    )
    const els = sectionRef.current?.querySelectorAll('.reveal') || []
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="game section" id="game" ref={sectionRef}>
      <div className="container">

        <div className="game__header reveal">
          <p className="section-label">The Game</p>
          <div className="game__title-row">
            <h2 className="game__title">
              Go<br /><em>Against.</em>
            </h2>
            <p className="game__sub">
              Most people fold by round five. A game that puts you inside real crowd pressure and tests whether you can consistently diverge from the natural flow. The ones who hold longest appear on the leaderboard. Those are The Few.
            </p>
          </div>
        </div>

        {/* ── GAME MODULE GOES HERE ── */}
        <div className="game__placeholder reveal">
          <div className="game__placeholder-inner">
            <span className="game__placeholder-label">Module Coming Soon</span>
            <p className="game__placeholder-title">Go Against</p>
            <p className="game__placeholder-desc">
              The game is being built in isolation and will be dropped into this section when complete. The leaderboard, scoring logic, and crowd mechanics will all live here.
            </p>
            <div className="game__placeholder-hint">
              Drop your game component inside <code>Game.jsx</code> where marked above.
            </div>
          </div>
        </div>
        {/* ── END GAME MODULE ── */}

      </div>
    </section>
  )
}
