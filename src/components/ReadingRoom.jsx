import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import './ReadingRoom.css'

// Fallback seed articles shown before Firebase loads
const SEED_ARTICLES = [
  {
    id: 'seed-1',
    title: 'The Psychology of Consensus',
    category: 'Psychology',
    excerpt: 'Why the human brain is wired to seek agreement, and what it costs us when markets are at their most dangerous extremes.',
    readTime: '6 min',
    date: 'March 2026',
  },
  {
    id: 'seed-2',
    title: 'Being Right Too Early',
    category: 'Market History',
    excerpt: 'A study of the most consequential contrarian calls in financial history, and the brutal cost of timing versus thesis.',
    readTime: '8 min',
    date: 'February 2026',
  },
  {
    id: 'seed-3',
    title: 'The Anatomy of a Contrarian Trade',
    category: 'Trading',
    excerpt: 'What separates a genuine contrarian position from stubbornness, and how to know the difference when the market is moving against you.',
    readTime: '7 min',
    date: 'February 2026',
  },
  {
    id: 'seed-4',
    title: 'Profiles in Independent Thought',
    category: 'Profiles',
    excerpt: 'From Galileo to Burry, the lives of history\'s most consequential contrarians share a pattern that goes beyond mere disagreement.',
    readTime: '10 min',
    date: 'January 2026',
  },
  {
    id: 'seed-5',
    title: 'What the Crowd Gets Wrong About Crypto',
    category: 'Crypto',
    excerpt: 'Every cycle produces the same pattern. Understanding it does not make it easier to act on. Here is why, and what to do about it.',
    readTime: '5 min',
    date: 'January 2026',
  },
  {
    id: 'seed-6',
    title: 'The Social Cost of Being Early',
    category: 'Psychology',
    excerpt: 'The financial cost of a contrarian position is well understood. The social cost, paid in family dinners and lost friendships, rarely gets discussed.',
    readTime: '6 min',
    date: 'December 2025',
  },
]

const CATEGORIES = ['All', 'Psychology', 'Market History', 'Trading', 'Profiles', 'Crypto']

export default function ReadingRoom() {
  const sectionRef = useRef(null)
  const [articles, setArticles] = useState(SEED_ARTICLES)
  const [activeCategory, setActiveCategory] = useState('All')
  const [loading, setLoading] = useState(true)

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
  }, [articles])

  useEffect(() => {
    async function fetchArticles() {
      try {
        const q = query(collection(db, 'articles'), orderBy('date', 'desc'))
        const snap = await getDocs(q)
        if (!snap.empty) {
          setArticles(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        }
      } catch (e) {
        // Firebase not yet set up or empty, use seeds
      } finally {
        setLoading(false)
      }
    }
    fetchArticles()
  }, [])

  const filtered = activeCategory === 'All'
    ? articles
    : articles.filter(a => a.category === activeCategory)

  return (
    <section className="reading-room section" id="reading-room" ref={sectionRef}>
      <div className="container">

        <div className="reading-room__header reveal">
          <p className="section-label">Reading Room</p>
          <div className="reading-room__title-row">
            <h2 className="reading-room__title">
              Ideas worth<br /><em>sitting with.</em>
            </h2>
            <p className="reading-room__sub">
              Essays on contrarian thinking, market history, and the psychology of independent thought. Content that earns your attention.
            </p>
          </div>
        </div>

        <div className="reading-room__categories reveal">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`rr-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="reading-room__grid">
          {filtered.map((article, i) => (
            <article
              key={article.id}
              className={`rr-card reveal reveal-delay-${(i % 4) + 1}`}
            >
              <div className="rr-card__meta">
                <span className="rr-card__category">{article.category}</span>
                <span className="rr-card__date">{article.date}</span>
              </div>
              <h3 className="rr-card__title">{article.title}</h3>
              <p className="rr-card__excerpt">{article.excerpt}</p>
              <div className="rr-card__footer">
                <span className="rr-card__read-time">{article.readTime} read</span>
                <button className="rr-card__link">Read essay</button>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  )
}
