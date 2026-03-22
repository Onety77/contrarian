// ── TRACKER ───────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react'
import { db } from '../firebase'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import TheRiver from './TheRiver'

const SEED_ENTRIES = [
  { id:'t1', date:'Nov 2021', consensus:'Bitcoin will hit $100k by end of year. Multiple analysts in agreement.',                          outcome:'Bitcoin peaked at $69k then dropped 75% over the following year.',               verdict:'wrong' },
  { id:'t2', date:'Jan 2009', consensus:'Bitcoin is a toy. No serious monetary use case. Will never gain mainstream traction.',           outcome:'Bitcoin became a $1T+ asset class adopted by sovereign nations and Fortune 500.', verdict:'wrong' },
  { id:'t3', date:'Mar 2020', consensus:'Markets will continue falling. This is the beginning of a multi-year depression. Stay in cash.', outcome:'The S&P 500 bottomed March 23, 2020 and more than doubled over 18 months.',       verdict:'wrong' },
  { id:'t4', date:'Dec 2017', consensus:'Crypto is the future of money. Bitcoin to $1M. Institutional money is coming.',                  outcome:'Bitcoin dropped 84% over the following year. Bear market lasted until 2020.',     verdict:'wrong' },
  { id:'t5', date:'Sep 2008', consensus:'The financial system is fundamentally sound. Major banks are too big to fail.',                  outcome:'Lehman collapsed. The global financial system required a multi-trillion bailout.', verdict:'wrong' },
  { id:'t6', date:'Jun 2022', consensus:'Ethereum merge will fail or be indefinitely delayed. Too technically complex to execute.',       outcome:'The Ethereum merge completed successfully on September 15, 2022.',               verdict:'wrong' },
]

export function Tracker() {
  const ref = useRef(null)
  const [entries, setEntries] = useState(SEED_ENTRIES)
  const [open, setOpen]       = useState(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.05 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const q    = query(collection(db,'tracker'), orderBy('date','desc'))
        const snap = await getDocs(q)
        if (!snap.empty) setEntries(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      } catch(e) {}
    }
    load()
  }, [])

  return (
    <div className="inner-page page" ref={ref}>
      <div className="inner-hero">
        <div className="wrap">
          <div className="inner-hero__top rv"><span className="eyebrow">Consensus vs Reality</span></div>
          <div className="rule--red rv d1" style={{margin:'1rem 0 1.2rem'}} />
          <h1 className="inner-hero__title rv d1">The record<br /><em>speaks for itself.</em></h1>
          <div className="rule--thick rv d2" style={{margin:'1rem 0 1.5rem'}} />
          <p className="inner-hero__deck rv d2">What the crowd believed at the moment it mattered most, measured against what actually happened.</p>
        </div>
      </div>

      <div className="inner-body wrap">
        <div className="tracker-stat rv">
          <span className="tracker-stat__n">{entries.filter(e=>e.verdict==='wrong').length}</span>
          <div>
            <p className="tracker-stat__label">Times the consensus was wrong</p>
            <p className="tracker-stat__sub">in this archive alone</p>
          </div>
        </div>

        <div className="tracker-list">
          {entries.map((e, i) => (
            <div key={e.id} className={`tracker-row rv d${(i%3)+1} ${open===e.id?'tracker-row--open':''}`} onClick={() => setOpen(open===e.id?null:e.id)}>
              <div className="tracker-row__main">
                <span className="tracker-row__date">{e.date}</span>
                <div className="tracker-row__content">
                  <span className="tracker-row__lbl eyebrow" style={{fontSize:'0.52rem',color:'var(--ink-faint)'}}>The Consensus</span>
                  <p className="tracker-row__txt">{e.consensus}</p>
                </div>
                <div className="tracker-row__actions">
                  <span className={`tracker-verdict ${e.verdict==='wrong'?'tracker-verdict--wrong':'tracker-verdict--right'}`}>
                    {e.verdict==='wrong'?'Wrong':'Right'}
                  </span>
                  <span className="tracker-toggle">{open===e.id?'−':'+'}</span>
                </div>
              </div>
              {open===e.id && (
                <div className="tracker-outcome">
                  <span className="tracker-row__lbl eyebrow" style={{fontSize:'0.52rem',color:'var(--ink-faint)'}}>What Actually Happened</span>
                  <p className="tracker-row__txt tracker-row__txt--out">{e.outcome}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── TEST PAGE ─────────────────────────────────────────────────
const QS = [
  { id:1, scenario:'Every analyst is calling this the greatest bull run in a decade. Your feed is euphoric. The trade feels obvious.',         q:'What do you do?',         opts:[{t:"Buy in. You don't want to miss it.",s:0},{t:'Wait and watch. Something feels off.',s:2},{t:'Start looking for the exit. Euphoria always ends.',s:3},{t:'Ask what the bears are saying.',s:2}] },
  { id:2, scenario:"A position you've held for 6 months is down 40%. Your thesis hasn't changed. The crowd says you're delusional.",          q:'How do you respond?',     opts:[{t:'Sell. Protect what\'s left.',s:0},{t:'Hold. The thesis is intact.',s:3},{t:'Buy more. The mispricing is bigger now.',s:3},{t:'Panic. The crowd might be right.',s:0}] },
  { id:3, scenario:"Your family is asking why you haven't sold yet. They think you're throwing money away.",                                   q:'What wins?',              opts:[{t:'The relationship. You fold.',s:0},{t:'You explain your thesis again.',s:1},{t:"You hold. You've stopped explaining.",s:3},{t:'You doubt yourself for the first time.',s:1}] },
  { id:4, scenario:'The market is crashing. Your timeline is panic. A respected voice says this is the end of the cycle.',                    q:'Your move?',              opts:[{t:'Sell everything.',s:0},{t:'Do nothing. Wait for data.',s:2},{t:'Start building a shopping list.',s:3},{t:'Follow the respected voice.',s:0}] },
  { id:5, scenario:"You see something nobody else is talking about. The opportunity is clear to you but invisible to the crowd.",              q:'What stops you?',         opts:[{t:'Nothing. You move.',s:3},{t:'You wait for confirmation.',s:1},{t:'You wait for someone else to notice first.',s:0},{t:'You research harder before acting.',s:2}] },
  { id:6, scenario:'You were wrong. A contrarian position you held with conviction failed. The crowd was right.',                             q:'What do you take from it?',opts:[{t:'The crowd is sometimes right. Adjust.',s:3},{t:'Never go against the consensus again.',s:0},{t:'Examine the thesis, not the outcome.',s:3},{t:'Ignore it and move on.',s:1}] },
  { id:7, scenario:"Everyone around you has made money following the trend. You've been sitting out. The pressure to join is enormous.",      q:'What happens next?',      opts:[{t:'You join. FOMO wins.',s:0},{t:'You watch. Your time will come.',s:3},{t:"You look for what they're missing.",s:3},{t:'You question your judgment.',s:1}] },
]

const PROFILES = [
  { min:0,  max:7,  type:'The Follower',    desc:'You feel the pull of consensus strongly, and that is not a flaw. Most people do. The crowd provides comfort, social proof, and safety. The contrarian path requires a settled relationship with being alone in a thesis. You are not there yet.' },
  { min:8,  max:13, type:'The Doubter',     desc:'You feel the discomfort of consensus but have not yet learned to trust that feeling. You see what the crowd misses, sometimes, but social pressure keeps winning. The gap is not intelligence. It is conviction.' },
  { min:14, max:17, type:'The Independent', desc:'You think for yourself with more consistency than most. You have been right when the crowd was wrong, and paid the social price of it. You are not fully comfortable with the isolation yet, but you are learning to sit with it.' },
  { min:18, max:21, type:'The Contrarian',  desc:'You do not need the crowd\'s approval. You have been the black sheep at the dinner table holding a position nobody wanted to hear. You have been proven right in the long run often enough to trust your own judgment over the noise.' },
]

export function TestPage() {
  const ref = useRef(null)
  const [started,  setStarted]  = useState(false)
  const [q,        setQ]        = useState(0)
  const [scores,   setScores]   = useState([])
  const [selected, setSelected] = useState(null)
  const [result,   setResult]   = useState(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.06 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [started, result, q])

  const pick = (score) => {
    setSelected(score)
    setTimeout(() => {
      const next = [...scores, score]
      setScores(next); setSelected(null)
      if (q + 1 >= QS.length) {
        const total = next.reduce((a,b)=>a+b,0)
        setResult({ total, profile: PROFILES.find(p=>total>=p.min&&total<=p.max) })
      } else { setQ(n=>n+1) }
    }, 350)
  }

  const reset = () => { setStarted(false); setQ(0); setScores([]); setSelected(null); setResult(null) }
  const pct   = (q / QS.length) * 100

  return (
    <div className="inner-page page" ref={ref}>
      <div className="inner-hero">
        <div className="wrap">
          <div className="inner-hero__top rv"><span className="eyebrow">The Test</span></div>
          <div className="rule--red rv d1" style={{margin:'1rem 0 1.2rem'}} />
          <h1 className="inner-hero__title rv d1">How contrarian<br /><em>are you, really?</em></h1>
          <div className="rule--thick rv d2" style={{margin:'1rem 0 1.5rem'}} />
          <p className="inner-hero__deck rv d2">Seven pressure scenarios. No right answers. Just a mirror.</p>
        </div>
      </div>

      <div className="inner-body wrap">
        {!started && !result && (
          <div className="test-intro">
            <div className="test-intro__left rv">
              <p className="test-intro__desc">This is not a trivia quiz. It is a series of real pressure moments designed to reveal how you actually think versus how the crowd thinks. Your result will not be a percentage. It will be a profile.</p>
              <button className="btn btn-ink" onClick={() => setStarted(true)}>Begin the Test</button>
            </div>
            <div className="test-intro__right rv d2">
              {PROFILES.map(p => (
                <div key={p.type} className="test-profile-item">
                  <div className="rule" style={{marginBottom:'0.6rem'}} />
                  <p className="test-profile-name">{p.type}</p>
                </div>
              ))}
              <p className="test-profile-hint">Four profiles. Which one are you?</p>
            </div>
          </div>
        )}

        {started && !result && (
          <div className="test-quiz rv">
            <div className="test-prog">
              <div className="test-prog__fill" style={{width:`${pct}%`}} />
            </div>
            <p className="test-prog__label">{q+1} of {QS.length}</p>
            <p className="test-scenario">{QS[q].scenario}</p>
            <h2 className="test-q">{QS[q].q}</h2>
            <div className="test-opts">
              {QS[q].opts.map((o,i) => (
                <button
                  key={i}
                  className={`test-opt ${selected===o.s&&selected!==null?'test-opt--sel':''}`}
                  onClick={() => pick(o.s)}
                  disabled={selected !== null}
                >
                  <span className="test-opt__lt">{String.fromCharCode(65+i)}</span>
                  <span className="test-opt__tx">{o.t}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="test-result rv">
            <span className="eyebrow">Your Profile</span>
            <div className="rule--red" style={{margin:'1rem 0 1.5rem'}} />
            <h2 className="test-result__type">{result.profile.type}</h2>
            <div className="rule--thick" style={{margin:'1.5rem 0'}} />
            <p className="test-result__desc">{result.profile.desc}</p>
            <button className="btn btn-outline" onClick={reset} style={{marginTop:'2rem'}}>Take It Again</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── GAME PAGE ─────────────────────────────────────────────────
export function GamePage() {
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.07 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="inner-page page" ref={ref}>
      <div className="inner-hero">
        <div className="wrap">
          <div className="inner-hero__top rv"><span className="eyebrow">The Game</span></div>
          <div className="rule--red rv d1" style={{margin:'1rem 0 1.2rem'}} />
          <h1 className="inner-hero__title rv d1">Go<br /><em>Against.</em></h1>
          <div className="rule--thick rv d2" style={{margin:'1rem 0 1.5rem'}} />
          <p className="inner-hero__deck rv d2">Hold to rise. Release to fall. The crowd flows against you. Find the gap.</p>
        </div>
      </div>
      <div className="inner-body">
        <TheRiver />
      </div>
    </div>
  )
}
