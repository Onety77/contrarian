import React, { useEffect, useRef } from 'react'
import './Community.css'

/**
 * ============================================================
 * THE COMMUNITY LAYER — "The Few"
 * ============================================================
 * This module is intentionally left as a placeholder.
 * The full community layer will be built in isolation.
 *
 * HOW TO INTEGRATE WHEN READY:
 * 1. Build the community component as a self-contained module
 * 2. Replace the <CommunityPlaceholder /> block below with it
 * 3. The section wrapper, heading, and layout remain as-is
 *
 * FIREBASE COLLECTION: 'community_posts'
 * Document shape:
 * {
 *   username: string,
 *   thesis: string,        // their contrarian call
 *   asset: string,         // what it's about
 *   timestamp: Timestamp,
 *   outcome: string|null,  // filled in later
 *   votes: number
 * }
 *
 * Gemini integration (optional):
 * - Use askGemini() from ../gemini.js to surface the most
 *   interesting submissions on a rolling basis
 * ============================================================
 */

export default function Community() {
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
    <section className="community section" id="community" ref={sectionRef}>
      <div className="container">

        <div className="community__header reveal">
          <p className="section-label">The Few</p>
          <div className="community__title-row">
            <h2 className="community__title">
              Put it<br /><em>on record.</em>
            </h2>
            <p className="community__sub">
              Not a chat. Not a forum. A public record of independent thought, timestamped and permanent. You are not a member because you hold the coin. You are a member because you think for yourself and you are willing to prove it.
            </p>
          </div>
        </div>

        {/* ── COMMUNITY MODULE GOES HERE ── */}
        <div className="community__placeholder reveal">
          <div className="community__placeholder-inner">
            <span className="community__placeholder-label">Module Coming Soon</span>
            <p className="community__placeholder-title">The Few</p>
            <p className="community__placeholder-desc">
              The community layer is being built in isolation. When complete, members will post their contrarian theses here publicly, timestamped and on record. The crowd will see who was right.
            </p>
            <div className="community__placeholder-hint">
              Drop your community component inside <code>Community.jsx</code> where marked above.
            </div>
          </div>
        </div>
        {/* ── END COMMUNITY MODULE ── */}

      </div>
    </section>
  )
}
