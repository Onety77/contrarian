import React, { useEffect, useRef, useState } from 'react'
import './TestPage.css'

const QS = [
  { id:1, scenario:'Every analyst you follow is calling this the greatest bull run in a decade. Your feed is euphoric. The trade feels obvious.', q:'What do you do?', opts:[{t:"Buy in. You don't want to miss it.",s:0},{t:'Wait and watch. Something feels off.',s:2},{t:'Start looking for the exit. Euphoria always ends.',s:3},{t:'Ask what the bears are saying.',s:2}] },
  { id:2, scenario:"A position you've held for 6 months is down 40%. Your thesis hasn't changed. The crowd says you're delusional.", q:'How do you respond?', opts:[{t:"Sell. Protect what's left.",s:0},{t:'Hold. The thesis is intact.',s:3},{t:'Buy more. The mispricing is bigger now.',s:3},{t:'Panic. The crowd might be right.',s:0}] },
  { id:3, scenario:"Your family is asking why you haven't sold yet. They think you're throwing money away. The discomfort is real.", q:'What wins?', opts:[{t:'The relationship. You fold.',s:0},{t:'You explain your thesis again.',s:1},{t:"You hold. You've stopped explaining.",s:3},{t:'You doubt yourself for the first time.',s:1}] },
  { id:4, scenario:'The market is crashing. Your timeline is panic. A respected voice says this is the end of the cycle.', q:'Your move?', opts:[{t:'Sell everything.',s:0},{t:'Do nothing. Wait for data.',s:2},{t:'Start building a shopping list.',s:3},{t:'Follow the respected voice.',s:0}] },
  { id:5, scenario:"You see something nobody else is talking about. The opportunity is clear to you but invisible to the crowd.", q:'What stops you?', opts:[{t:'Nothing. You move.',s:3},{t:'You wait for confirmation.',s:1},{t:'You wait for someone else to notice first.',s:0},{t:'You research harder before acting.',s:2}] },
  { id:6, scenario:'You were wrong. A contrarian position you held with conviction failed. The crowd was right.', q:'What do you take from it?', opts:[{t:'The crowd is sometimes right. Adjust.',s:3},{t:'Never go against the consensus again.',s:0},{t:'Examine the thesis, not the outcome.',s:3},{t:'Ignore it and move on.',s:1}] },
  { id:7, scenario:"Everyone around you has made money following the trend. You've been sitting out. The pressure to join is enormous.", q:'What happens next?', opts:[{t:'You join. FOMO wins.',s:0},{t:'You watch. Your time will come.',s:3},{t:"You look for what they're missing.",s:3},{t:'You question your judgment.',s:1}] },
]

const PROFILES = [
  { min:0, max:7,   type:'The Follower',    desc:"You feel the pull of consensus strongly, and that is not a flaw. Most people do. The crowd provides comfort, social proof, and safety. The contrarian path requires a settled relationship with being alone in a thesis. You are not there yet. But you know it now." },
  { min:8, max:13,  type:'The Doubter',     desc:"You feel the discomfort of consensus but have not yet learned to trust that feeling. You see what the crowd misses, sometimes, but social pressure keeps winning. You are closer to the contrarian than you think. The gap is not intelligence. It is conviction." },
  { min:14, max:17, type:'The Independent', desc:"You think for yourself with more consistency than most. You have been right when the crowd was wrong, and you have paid the social price of it. You are not fully comfortable with the isolation yet, but you are learning to sit with it." },
  { min:18, max:21, type:'The Contrarian',  desc:"You do not need the crowd's approval. You have been the black sheep, the underdog, the one at the dinner table holding a position nobody else wanted to hear. You have been proven right in the long run often enough to trust your own judgment over the noise." },
]

export default function TestPage() {
  const ref = useRef(null)
  const [started, setStarted]   = useState(false)
  const [q, setQ]               = useState(0)
  const [scores, setScores]     = useState([])
  const [selected, setSelected] = useState(null)
  const [result, setResult]     = useState(null)

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.07 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [started, result, q])

  const pick = (score) => {
    setSelected(score)
    setTimeout(() => {
      const next = [...scores, score]
      setScores(next)
      setSelected(null)
      if (q + 1 >= QS.length) {
        const total = next.reduce((a,b)=>a+b,0)
        setResult({ total, profile: PROFILES.find(p=>total>=p.min&&total<=p.max) })
      } else {
        setQ(n=>n+1)
      }
    }, 380)
  }

  const reset = () => { setStarted(false); setQ(0); setScores([]); setSelected(null); setResult(null) }
  const pct = (q / QS.length) * 100

  return (
    <div className="test-page page" ref={ref}>
      <div className="test-hero">
        <div className="wrap test-hero__content">
          <p className="label rv">The Test</p>
          <h1 className="test-hero__title rv d1">How contrarian<br /><em>are you, really?</em></h1>
          <p className="test-hero__sub rv d2">Seven pressure scenarios. No right answers. Just a mirror.</p>
        </div>
      </div>

      <div className="wrap test-body">
        {!started && !result && (
          <div className="test-intro">
            <div className="test-intro__left rv">
              <p className="test-intro__desc">This is not a trivia quiz. It is a series of real pressure moments designed to reveal how you actually think versus how the crowd thinks. Your result will not be a percentage. It will be a profile.</p>
              <button className="btn btn-gold" onClick={()=>setStarted(true)}>Begin the Test</button>
            </div>
            <div className="test-intro__right rv d2">
              {PROFILES.map(p=>(
                <div key={p.type} className="test-profile-pill">
                  <span>{p.type}</span>
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
            <p className="test-prog__label">{q+1} / {QS.length}</p>

            <div className="test-q">
              <p className="test-scenario">{QS[q].scenario}</p>
              <h2 className="test-qtext">{QS[q].q}</h2>
            </div>

            <div className="test-opts">
              {QS[q].opts.map((o,i)=>(
                <button
                  key={i}
                  className={`test-opt ${selected===o.s&&selected!==null?'test-opt--sel':''}`}
                  onClick={()=>pick(o.s)}
                  disabled={selected!==null}
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
            <p className="label" style={{marginBottom:'1.5rem'}}>Your Profile</p>
            <h2 className="test-result__type">{result.profile.type}</h2>
            <div className="g-rule" style={{margin:'1.5rem 0'}} />
            <p className="test-result__desc">{result.profile.desc}</p>
            <div style={{marginTop:'2.5rem'}}>
              <button className="btn btn-ghost" onClick={reset}>Take It Again</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
