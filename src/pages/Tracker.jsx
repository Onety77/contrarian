import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import './Tracker.css'

const SEED = [
  { id:'t1', date:'Nov 2021', consensus:'Bitcoin will hit $100k by end of year. Multiple analysts, institutions, and media in agreement.', outcome:'Bitcoin peaked at $69k in November, then dropped 75% over the following year.', verdict:'wrong' },
  { id:'t2', date:'Jan 2009', consensus:'Bitcoin is a toy for cypherpunks. No serious monetary use case. Will never gain mainstream traction.', outcome:'Bitcoin became a $1T+ asset class adopted by sovereign nations, Fortune 500 companies, and central banks.', verdict:'wrong' },
  { id:'t3', date:'Mar 2020', consensus:'Markets will continue falling. This is the beginning of a multi-year depression. Stay in cash.', outcome:'The S&P 500 bottomed exactly on March 23, 2020 and more than doubled over the next 18 months.', verdict:'wrong' },
  { id:'t4', date:'Dec 2017', consensus:'Crypto is the future of money. Bitcoin to $1M. Institutional money is coming. This time is different.', outcome:'Bitcoin dropped 84% over the following year. The bear market lasted until 2020.', verdict:'wrong' },
  { id:'t5', date:'Jun 2022', consensus:'Ethereum merge will fail or be indefinitely delayed. Too technically complex to execute.', outcome:'The Ethereum merge was completed successfully on September 15, 2022.', verdict:'wrong' },
  { id:'t6', date:'Sep 2008', consensus:'The financial system is fundamentally sound. Major banks are too big to fail.', outcome:'Lehman collapsed. The global financial system required a multi-trillion dollar bailout.', verdict:'wrong' },
]

export default function Tracker() {
  const ref = useRef(null)
  const [entries, setEntries] = useState(SEED)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.06 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [entries])

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db,'tracker'), orderBy('date','desc'))
        const snap = await getDocs(q)
        if (!snap.empty) setEntries(snap.docs.map(d=>({id:d.id,...d.data()})))
      } catch(e){}
    }
    load()
  },[])

  return (
    <div className="tracker-page page" ref={ref}>
      <div className="tr-hero">
        <div className="wrap tr-hero__content">
          <p className="label rv">Consensus vs Reality</p>
          <h1 className="tr-hero__title rv d1">The record<br /><em>speaks for itself.</em></h1>
          <p className="tr-hero__sub rv d2">What the crowd believed at the moment it mattered most, measured against what actually happened.</p>
        </div>
      </div>

      <div className="wrap tr-body">
        <div className="tr-stat rv">
          <span className="tr-stat__n">{entries.filter(e=>e.verdict==='wrong').length}</span>
          <div>
            <p className="tr-stat__label">Times the consensus was wrong</p>
            <p className="tr-stat__note">in this archive alone</p>
          </div>
        </div>

        <div className="tr-list">
          {entries.map((e,i) => (
            <div key={e.id} className={`tr-entry rv d${(i%3)+1} ${open===e.id?'tr-entry--open':''}`} onClick={()=>setOpen(open===e.id?null:e.id)}>
              <div className="tr-entry__row">
                <span className="tr-entry__date">{e.date}</span>
                <div className="tr-entry__main">
                  <span className="tr-entry__lbl">The Consensus</span>
                  <p className="tr-entry__txt">{e.consensus}</p>
                </div>
                <span className={`tr-verdict tr-verdict--${e.verdict}`}>{e.verdict==='wrong'?'Wrong':'Right'}</span>
                <span className="tr-toggle">{open===e.id?'−':'+'}</span>
              </div>
              {open===e.id&&(
                <div className="tr-entry__outcome">
                  <span className="tr-entry__lbl">What Actually Happened</span>
                  <p className="tr-entry__txt tr-entry__txt--out">{e.outcome}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
