import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Nav.css'

const LINKS = [
  { label: 'Manifesto',  to: '/manifesto' },
  { label: 'Reading',    to: '/reading-room' },
  { label: 'Tracker',    to: '/tracker' },
  { label: 'The Test',   to: '/test' },
  { label: 'The Game',   to: '/game' },
  { label: 'The Few',    to: '/community' },
]

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen]         = useState(false)
  const { pathname }            = useLocation()

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
        <div className="nav__inner wrap">

          <Link to="/" className="nav__brand">
            <img src="/logo.png" alt="" className="nav__logo" />
            <div className="nav__brand-text">
              <span className="nav__name">The Contrarian</span>
              <span className="nav__ticker">$CONTRA</span>
            </div>
          </Link>

          <ul className={`nav__links ${open ? 'nav__links--open' : ''}`}>
            {LINKS.map(l => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className={`nav__link ${pathname === l.to ? 'nav__link--active' : ''}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <button
            className={`nav__burger ${open ? 'open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>

        </div>
      </nav>

      {/* Mobile overlay */}
      {open && <div className="nav__overlay" onClick={() => setOpen(false)} />}
    </>
  )
}
