import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

// UPDATE THESE when live
const CA      = 'TBA — Contract address will appear here at launch'
const TWITTER = 'https://twitter.com/contratoken'
const X_COMM  = 'https://twitter.com/i/communities/contratoken'

const TILES = [
  { num:'01', title:'The Manifesto',        sub:'Who the contrarian is. What they cost. Why history proves them right.',                                 to:'/manifesto',    bg:'bg2.jpg' },
  { num:'02', title:'Reading Room',         sub:'Essays on independent thought, market psychology, and the history of being right too early.',           to:'/reading-room', bg:null },
  { num:'03', title:'Consensus vs Reality', sub:'A live archive of what the crowd believed versus what actually happened. The record speaks for itself.',to:'/tracker',      bg:null },
  { num:'04', title:'The Test',             sub:'Seven pressure scenarios. No right answers. Find out how contrarian you actually are.',                 to:'/test',         bg:null },
  { num:'05', title:'The Game',             sub:'Can you go against the flow in real time? Most people fold by round five.',                            to:'/game',         bg:null },
  { num:'06', title:'The Few',              sub:'Put your thesis on record. Timestamped. Public. Let the market decide who was right.',                 to:'/community',    bg:null },
]

const IS_TBA = CA.startsWith('TBA')

export default function Home() {
  const ref = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
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

      {/* HERO */}
      <section className="home-hero">
        <div className="home-hero__bg" style={{ backgroundImage: 'url(/bg1.jpg)' }} />
        <div className="home-hero__overlay" />

        <div className="home-hero__content wrap">

          {/* Small brand mark above title */}
          <div className="home-hero__brand rv">
            <img src="/logo.png" alt="" className="home-hero__logo" />
            <span className="home-hero__brand-ticker">$CONTRA</span>
          </div>

          <h1 className="home-hero__title rv d1">
            The<br /><em>Contrarian</em>
          </h1>

          <p className="home-hero__deck rv d2">
            The internet's home for independent thought.<br />
            For the ones who were right before anyone was watching.
          </p>

          {/* CA — tappable, copies on click, shows feedback */}
          <div
            className={`home-hero__ca rv d3${IS_TBA ? ' home-hero__ca--tba' : ' home-hero__ca--live'}`}
            onClick={copyCA}
          >
            <span className="home-hero__ca-label">Contract Address</span>
            <span className="home-hero__ca-value">{CA}</span>
            {!IS_TBA && (
              <span className={`home-hero__ca-copy${copied ? ' home-hero__ca-copy--done' : ''}`}>
                {copied ? '✓ Copied' : 'Tap to copy'}
              </span>
            )}
          </div>

          {/* Socials */}
          <div className="home-hero__socials rv d4">
            <a href={TWITTER} target="_blank" rel="noopener noreferrer" className="home-hero__social">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X (Twitter)
            </a>
            <span className="home-hero__social-sep">·</span>
            <a href={X_COMM} target="_blank" rel="noopener noreferrer" className="home-hero__social">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm-1-13v6l5-3-5-3z"/>
              </svg>
              X Community
            </a>
          </div>

          <div className="home-hero__scroll rv d4">
            <span /><small>Explore</small>
          </div>
        </div>
      </section>

      {/* TILES */}
      <section className="home-tiles">
        <div className="wrap">
          <p className="label rv" style={{marginBottom:'2.5rem'}}>Explore The Contrarian</p>
          <div className="home-tiles__grid">
            {TILES.map((tile, i) => (
              <Link
                key={tile.to}
                to={tile.to}
                className={`tile rv d${(i % 4) + 1} ${tile.num === '01' ? 'tile--featured' : ''}`}
              >
                {tile.bg && <div className="tile__bg" style={{ backgroundImage: `url(/${tile.bg})` }} />}
                <div className="tile__overlay" />
                <div className="tile__content">
                  <span className="tile__num">{tile.num}</span>
                  <div className="tile__body">
                    <h3 className="tile__title">{tile.title}</h3>
                    <p className="tile__sub">{tile.sub}</p>
                  </div>
                  <span className="tile__arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER STRIP */}
      <footer className="home-footer">
        <div className="wrap home-footer__inner">
          <p className="home-footer__brand">THE CONTRARIAN &nbsp;·&nbsp; $CONTRA</p>
          <p className="home-footer__note">Not financial advice. Think for yourself.</p>
        </div>
      </footer>

    </div>
  )
}
