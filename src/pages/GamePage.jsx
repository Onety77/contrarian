import React, { useEffect, useRef } from 'react'
import TheRiver from './TheRiver'
import './GamePage.css'

export default function GamePage() {
  const ref = useRef(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.07 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="game-page page" ref={ref}>
      <div className="gp-hero">
        <div className="wrap gp-hero__content">
          <p className="label rv">The Game</p>
          <h1 className="gp-hero__title rv d1">Go<br /><em>Against.</em></h1>
          <p className="gp-hero__sub rv d2">
            You are the light. The crowd is the current.<br />
            Hold to rise. Release to fall. Find the gap.
          </p>
        </div>
      </div>
      <div className="gp-body">
        <TheRiver />
      </div>
    </div>
  )
}
