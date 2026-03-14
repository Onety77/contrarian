import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import './ReadingRoom.css'

const SEED = [
  { id:'s1', title:'The Psychology of Consensus', category:'Psychology', excerpt:'Why the human brain is wired to seek agreement, and what it costs when markets are at their most dangerous extremes.', readTime:'6 min', date:'March 2026' },
  { id:'s2', title:'Being Right Too Early', category:'Market History', excerpt:'A study of the most consequential contrarian calls in financial history, and the brutal cost of timing versus thesis.', readTime:'8 min', date:'February 2026' },
  { id:'s3', title:'The Anatomy of a Contrarian Trade', category:'Trading', excerpt:'What separates a genuine contrarian position from stubbornness, and how to know the difference when the market is moving against you.', readTime:'7 min', date:'February 2026' },
  { id:'s4', title:'Profiles in Independent Thought', category:'Profiles', excerpt:'From Galileo to Burry, the lives of history\'s most consequential contrarians share a pattern that goes beyond mere disagreement.', readTime:'10 min', date:'January 2026' },
  { id:'s5', title:'What the Crowd Gets Wrong About Crypto', category:'Crypto', excerpt:'Every cycle produces the same pattern. Understanding it does not make it easier to act on. Here is why, and what to do about it.', readTime:'5 min', date:'January 2026' },
  { id:'s6', title:'The Social Cost of Being Early', category:'Psychology', excerpt:'The financial cost of a contrarian position is well understood. The social cost, paid in family dinners and lost friendships, rarely gets discussed.', readTime:'6 min', date:'December 2025' },
]

const CATS = ['All','Psychology','Market History','Trading','Profiles','Crypto']

export default function ReadingRoom() {
  const ref = useRef(null)
  const [articles, setArticles] = useState(SEED)
  const [cat, setCat] = useState('All')

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.07 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [articles, cat])

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'articles'), orderBy('date','desc'))
        const snap = await getDocs(q)
        if (!snap.empty) setArticles(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      } catch(e) {}
    }
    load()
  }, [])

  const filtered = cat === 'All' ? articles : articles.filter(a => a.category === cat)

  return (
    <div className="rr-page page" ref={ref}>
      <div className="rr-hero">
        <div className="wrap rr-hero__content">
          <p className="label rv">Reading Room</p>
          <h1 className="rr-hero__title rv d1">Ideas worth<br /><em>sitting with.</em></h1>
          <p className="rr-hero__sub rv d2">Essays on contrarian thinking, market history, and the psychology of independent thought.</p>
        </div>
      </div>

      <div className="rr-body wrap">
        <div className="rr-cats rv">
          {CATS.map(c => (
            <button key={c} className={`rr-cat ${cat===c?'rr-cat--on':''}`} onClick={()=>setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="rr-grid">
          {filtered.map((a,i) => (
            <div key={a.id} className={`rr-card rv d${(i%3)+1}`}>
              <div className="rr-card__top">
                <span className="rr-card__cat">{a.category}</span>
                <span className="rr-card__date">{a.date}</span>
              </div>
              <h3 className="rr-card__title">{a.title}</h3>
              <p className="rr-card__excerpt">{a.excerpt}</p>
              <div className="rr-card__foot">
                <span className="rr-card__time">{a.readTime} read</span>
                <button className="rr-card__cta">Read →</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
