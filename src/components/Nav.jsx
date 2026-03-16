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
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
        <div className="nav__inner">

          {/* Brand — always visible */}
          <Link to="/" className="nav__brand" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="" className="nav__logo" />
            <div className="nav__brand-text">
              <span className="nav__name">The Contrarian</span>
              <span className="nav__ticker">$CONTRA</span>
            </div>
          </Link>

          {/* Desktop links — hidden on mobile via CSS */}
          <ul className="nav__desktop-links">
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

          {/* Burger — only visible on mobile via CSS */}
          <button
            className={`nav__burger ${open ? 'nav__burger--open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            <span />
            <span />
            <span />
          </button>

        </div>
      </nav>

      {/* Mobile drawer — completely separate from nav flow */}
      <div className={`nav__drawer ${open ? 'nav__drawer--open' : ''}`}>
        <ul className="nav__mobile-links">
          {LINKS.map(l => (
            <li key={l.to}>
              <Link
                to={l.to}
                className={`nav__mobile-link ${pathname === l.to ? 'nav__mobile-link--active' : ''}`}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Overlay */}
      {open && (
        <div className="nav__overlay" onClick={() => setOpen(false)} />
      )}
    </>
  )
}
