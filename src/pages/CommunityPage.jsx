import React, { useEffect, useRef } from 'react'
import './CommunityPage.css'

/**
 * ============================================================
 * THE COMMUNITY LAYER — "The Few"
 * ============================================================
 * Placeholder. Build the community module in isolation.
 *
 * WHERE TO PLUG IN:
 * Replace the <div className="community-module-slot"> below.
 *
 * FIREBASE COLLECTION: 'community_posts'
 * Document shape:
 * {
 *   username:  string,
 *   thesis:    string,   // their contrarian call
 *   asset:     string,   // what it's about
 *   timestamp: Timestamp,
 *   outcome:   string | null,
 *   votes:     number
 * }
 *
 * GEMINI INTEGRATION (optional):
 * Use askGemini() from ../gemini.js to surface the most
 * interesting submissions on a rolling basis.
 * ============================================================
 */

export default function CommunityPage() {
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
    <div className="community-page page" ref={ref}>
      <div className="cp-hero">
        <div className="wrap cp-hero__content">
          <p className="label rv">The Few</p>
          <h1 className="cp-hero__title rv d1">Put it<br /><em>on record.</em></h1>
          <p className="cp-hero__sub rv d2">
            Not a chat. Not a forum. A public record of independent thought, timestamped and permanent. You are not a member because you hold the coin. You are a member because you think for yourself.
          </p>
        </div>
      </div>

      <div className="wrap cp-body">
        <div className="cp-pillars rv">
          <div className="cp-pillar">
            <span className="cp-pillar__icon">◈</span>
            <p className="cp-pillar__t">Your thesis. On record.</p>
            <p className="cp-pillar__d">Post your contrarian call publicly. Timestamped. No editing. No deleting.</p>
          </div>
          <div className="cp-pillar">
            <span className="cp-pillar__icon">◈</span>
            <p className="cp-pillar__t">Let the market judge.</p>
            <p className="cp-pillar__d">Outcomes are logged when they arrive. The record shows who was right and when.</p>
          </div>
          <div className="cp-pillar">
            <span className="cp-pillar__icon">◈</span>
            <p className="cp-pillar__t">Earn your place.</p>
            <p className="cp-pillar__d">You are not a member because you hold the coin. You earn it by thinking publicly.</p>
          </div>
        </div>

        {/* ── COMMUNITY MODULE SLOT — DROP YOUR COMPONENT HERE ── */}
        <div className="community-module-slot rv">
          <span className="cp-slot__label">Module In Development</span>
          <p className="cp-slot__name">The Few</p>
          <p className="cp-slot__note">
            Build the community layer separately, then replace this block in <code>CommunityPage.jsx</code>
          </p>
        </div>
        {/* ── END COMMUNITY MODULE SLOT ── */}
      </div>
    </div>
  )
}
