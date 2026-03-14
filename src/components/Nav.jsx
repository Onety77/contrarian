import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Nav.css'

const LINKS = [
  { label: 'Manifesto',     to: '/manifesto' },
  { label: 'Reading Room',  to: '/reading-room' },
  { label: 'Tracker',       to: '/tracker' },
  { label: 'The Test',      to: '/test' },
  { label: 'The Game',      to: '/game' },
  { label: 'The Few',       to: '/community' },
]

export default function Nav() {
  const [solid, setSolid]     = useState(false)
  const [open, setOpen]       = useState(false)
  const { pathname }          = useLocation()

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <nav className={`nav ${solid || pathname !== '/' ? 'nav--solid' : ''}`}>
      <div className="nav__wrap wrap">

        <Link to="/" className="nav__logo">
          <img src="/logo.png" alt="The Contrarian" className="nav__logo-img" />
          <div className="nav__logo-text">
            <span className="nav__logo-name">THE CONTRARIAN</span>
            <span className="nav__logo-ticker">$CONTRA</span>
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
  )
}
