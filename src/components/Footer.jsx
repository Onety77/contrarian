import React from 'react'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__inner">

          <div className="footer__brand">
            <p className="footer__name">THE CONTRARIAN</p>
            <p className="footer__tagline">They'll understand later.</p>
          </div>

          <div className="footer__coin">
            <p className="footer__coin-label">Contract Address</p>
            <p className="footer__ca">TBA</p>
          </div>

          <div className="footer__socials">
            <p className="footer__socials-label">Follow</p>
            <div className="footer__links">
              <a
                href="https://twitter.com/contratoken"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__link"
              >
                X (Twitter)
              </a>
              <a
                href="https://twitter.com/i/communities/contratoken"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__link"
              >
                X Community
              </a>
            </div>
          </div>

        </div>

        <div className="footer__bottom">
          <p>$CONTRA &nbsp;·&nbsp; Not financial advice. &nbsp;·&nbsp; Think for yourself.</p>
        </div>
      </div>
    </footer>
  )
}
