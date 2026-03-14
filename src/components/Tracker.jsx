import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import './Tracker.css'

const SEED_ENTRIES = [
  {
    id: 't1',
    date: 'Nov 2021',
    consensus: 'Bitcoin will hit $100k by end of year. Multiple analysts, institutions, and media outlets in agreement.',
    outcome: 'Bitcoin peaked at $69k in November, then dropped 75% over the following year.',
    verdict: 'wrong',
  },
  {
    id: 't2',
    date: 'Jan 2009',
    consensus: 'Bitcoin is a toy for cypherpunks. No serious monetary use case. Will never gain mainstream traction.',
    outcome: 'Bitcoin became a $1T+ asset class adopted by sovereign nations, Fortune 500 companies, and central banks.',
    verdict: 'wrong',
  },
  {
    id: 't3',
    date: 'Mar 2020',
    consensus: 'Markets will continue falling. This is the beginning of a multi-year depression. Stay in cash.',
    outcome: 'The S&P 500 bottomed exactly on March 23, 2020 and more than doubled over the next 18 months.',
    verdict: 'wrong',
  },
  {
    id: 't4',
    date: 'Dec 2017',
    consensus: 'Crypto is the future of money. Bitcoin to $1M. Institutional money is coming. This time is different.',
    outcome: 'Bitcoin dropped 84% over the following year. The bear market lasted until 2020.',
    verdict: 'wrong',
  },
  {
    id: 't5',
    date: 'Jun 2022',
    consensus: 'Ethereum merge will fail or be indefinitely delayed. Too technically complex to execute.',
    outcome: 'The Ethereum merge was completed successfully on September 15, 2022.',
    verdict: 'wrong',
  },
  {
    id: 't6',
    date: 'Sep 2008',
    consensus: 'Bear Stearns, Lehman Brothers are too big to fail. The financial system is fundamentally sound.',
    outcome: 'Lehman collapsed. Bear Stearns was sold for $2/share. The global financial system required a multi-trillion dollar bailout.',
    verdict: 'wrong',
  },
]

export default function Tracker() {
  const sectionRef = useRef(null)
  const [entries, setEntries] = useState(SEED_ENTRIES)
  const [activeEntry, setActiveEntry] = useState(null)

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

  useEffect(() => {
    async function fetchEntries() {
      try {
        const q = query(collection(db, 'tracker'), orderBy('date', 'desc'))
        const snap = await getDocs(q)
        if (!snap.empty) {
          setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      } catch (e) {
        // use seeds
      }
    }
    fetchEntries()
  }, [])

  return (
    <section className="tracker section" id="tracker" ref={sectionRef}>
      <div className="container">

        <div className="tracker__header reveal">
          <p className="section-label">Consensus vs Reality</p>
          <div className="tracker__title-row">
            <h2 className="tracker__title">
              The record<br /><em>speaks for itself.</em>
            </h2>
            <p className="tracker__sub">
              A running archive of what the crowd believed at the moment it mattered most, measured against what actually happened. Updated regularly. Judge for yourself.
            </p>
          </div>
        </div>

        <div className="tracker__counter reveal">
          <span className="tracker__counter-num">{entries.filter(e => e.verdict === 'wrong').length}</span>
          <span className="tracker__counter-label">times the consensus was wrong</span>
          <span className="tracker__counter-note">in this archive alone</span>
        </div>

        <div className="tracker__list">
          {entries.map((entry, i) => (
            <div
              key={entry.id}
              className={`tracker__entry reveal reveal-delay-${(i % 3) + 1} ${activeEntry === entry.id ? 'tracker__entry--open' : ''}`}
              onClick={() => setActiveEntry(activeEntry === entry.id ? null : entry.id)}
            >
              <div className="tracker__entry-header">
                <span className="tracker__entry-date">{entry.date}</span>
                <div className="tracker__entry-consensus">
                  <span className="tracker__entry-label">The Consensus</span>
                  <p>{entry.consensus}</p>
                </div>
                <div className={`tracker__verdict tracker__verdict--${entry.verdict}`}>
                  {entry.verdict === 'wrong' ? 'Wrong' : 'Right'}
                </div>
                <span className="tracker__toggle">{activeEntry === entry.id ? '−' : '+'}</span>
              </div>

              {activeEntry === entry.id && (
                <div className="tracker__entry-outcome">
                  <span className="tracker__entry-label">What Actually Happened</span>
                  <p>{entry.outcome}</p>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
