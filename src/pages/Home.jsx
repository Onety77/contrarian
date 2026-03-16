import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

// ── UPDATE WHEN LIVE ──
const CA      = 'TBA'
const TWITTER = 'https://twitter.com/contratoken'
const X_COMM  = 'https://twitter.com/i/communities/contratoken'

const IS_TBA  = CA === 'TBA'

const TILES = [
  { num:'01', label:'Essay',       title:'The Manifesto',         sub:'Who the contrarian is. What it costs. Why history proves them right.',                          to:'/manifesto'    },
  { num:'02', label:'Library',     title:'Reading Room',          sub:'Essays on independent thought, market psychology, and the history of being right too early.',    to:'/reading-room' },
  { num:'03', label:'Archive',     title:'Consensus vs Reality',  sub:'A timestamped record of what the crowd believed versus what actually happened.',                 to:'/tracker'      },
  { num:'04', label:'Psychology',  title:'The Test',              sub:'Seven pressure scenarios. No right answers. Find out how contrarian you actually are.',          to:'/test'         },
  { num:'05', label:'Game',        title:'The River',             sub:'Hold to rise. Release to fall. The crowd flows against you. Find the gap.',                      to:'/game'         },
  { num:'06', label:'Community',   title:'The Few',               sub:'Put your thesis on record. Timestamped. Public. Let the market decide who was right.',           to:'/community'    },
]

export default function Home() {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.06 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  const copyCA = () => {
    if (IS_TBA) return
    navigator.clipboard.writeText(CA).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="home" ref={ref}>

      {/* ── MASTHEAD ── */}
      <section className="home-masthead">
        <div
          className="home-masthead__bg"
          style={{ backgroundImage: 'url(/bg1.jpg)' }}
        />
        <div className="home-masthead__veil" />

        <div className="home-masthead__body wrap">
          <div className="home-masthead__top rv">
            <span className="eyebrow">Independent Thought</span>
            <span className="home-masthead__date">{new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</span>
          </div>

          <div className="rule--red home-masthead__rule rv d1" />

          <h1 className="home-masthead__title rv d1">
            The<br />Contrarian
          </h1>

          <div className="rule--thick home-masthead__rule rv d2" />

          <p className="home-masthead__deck rv d2">
            The internet's home for independent thought.
            For the ones who were right before anyone was watching.
          </p>

          {/* CA bar */}
          <div
            className={`home-ca rv d3 ${!IS_TBA ? 'home-ca--live' : ''}`}
            onClick={copyCA}
          >
            <span className="home-ca__label">$CONTRA</span>
            <span className="home-ca__divider" />
            <span className="home-ca__value">
              {IS_TBA ? 'Contract address — launching soon' : CA}
            </span>
            {!IS_TBA && (
              <span className={`home-ca__copy ${copied ? 'home-ca__copy--done' : ''}`}>
                {copied ? '✓ Copied' : 'Copy'}
              </span>
            )}
          </div>

          {/* Socials */}
          <div className="home-socials rv d4">
            <a href={TWITTER} target="_blank" rel="noopener noreferrer" className="home-social">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Follow on X
            </a>
            <span className="home-social__sep">·</span>
            <a href={X_COMM} target="_blank" rel="noopener noreferrer" className="home-social">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-1-13v6l5-3-5-3z"/>
              </svg>
              Join the Community
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION GRID ── */}
      <section className="home-sections">
        <div className="wrap">
          <div className="home-sections__header rv">
            <span className="eyebrow">Explore</span>
          </div>
          <div className="rule rv" style={{margin:'1rem 0 0'}} />

          <div className="home-grid">
            {TILES.map((t, i) => (
              <Link
                key={t.to}
                to={t.to}
                className={`hg-tile rv d${(i % 3) + 1} ${i === 0 ? 'hg-tile--lead' : ''}`}
              >
                <div className="hg-tile__top">
                  <span className="section-num">{t.num}</span>
                  <span className="hg-tile__label eyebrow">{t.label}</span>
                </div>
                <div className="rule" style={{margin:'0.75rem 0'}} />
                <h3 className="hg-tile__title">{t.title}</h3>
                <p className="hg-tile__sub">{t.sub}</p>
                <div className="hg-tile__foot">
                  <span className="hg-tile__cta">Read more →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── PULL QUOTE ── */}
      <section className="home-quote">
        <div className="wrap--narrow">
          <div className="rule--red rv" />
          <blockquote className="home-quote__text rv d1">
            "The time to get interested is when no one else is. You can't buy what is popular and do well."
          </blockquote>
          <cite className="home-quote__cite rv d2">Warren Buffett</cite>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="home-footer">
        <div className="wrap home-footer__inner">
          <div className="rule--heavy" style={{marginBottom:'1.5rem'}} />
          <div className="home-footer__row">
            <p className="home-footer__brand">The Contrarian &nbsp;·&nbsp; $CONTRA</p>
            <div className="home-footer__links">
              <a href={TWITTER} target="_blank" rel="noopener noreferrer">X (Twitter)</a>
              <span>·</span>
              <a href={X_COMM} target="_blank" rel="noopener noreferrer">Community</a>
            </div>
            <p className="home-footer__disc">Not financial advice. Think for yourself.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
