import React, { useEffect, useRef, useState } from 'react'
import './TestPage.css'

const QS = [
  {
    id: 1,
    scenario: 'A widely respected expert — someone you admire — publicly states the opposite of what you believe. Their reasoning sounds solid. The audience agrees.',
    q: 'What happens to your position?',
    opts: [
      { t: 'It shakes you. You start to wonder if you missed something.', s: 1 },
      { t: 'You go back to your own reasoning and check it against theirs.', s: 3 },
      { t: 'You quietly change your view. They probably know more than you.', s: 0 },
      { t: 'You become more curious about why they are wrong.', s: 3 },
    ]
  },
  {
    id: 2,
    scenario: 'You are at a dinner with people you respect. A topic comes up where you hold a strong, unpopular view. Everyone at the table disagrees with you, including people who are smarter and more experienced.',
    q: 'What do you do?',
    opts: [
      { t: 'You say nothing. This is not the right time.', s: 0 },
      { t: 'You voice your view once, clearly, then let it go.', s: 2 },
      { t: 'You defend your position for as long as it takes.', s: 2 },
      { t: 'You enjoy it. This is exactly where interesting conversations happen.', s: 3 },
    ]
  },
  {
    id: 3,
    scenario: 'You have believed something for years — about markets, people, or how the world works. New evidence suggests you might be wrong. But your identity is tied to this view.',
    q: 'How do you handle it?',
    opts: [
      { t: 'You look for flaws in the new evidence first.', s: 0 },
      { t: 'You sit with the discomfort and examine both sides honestly.', s: 3 },
      { t: 'You update your view, even if it costs you credibility.', s: 3 },
      { t: 'You need time. You are not ready to abandon it yet.', s: 1 },
    ]
  },
  {
    id: 4,
    scenario: 'You are early on something — a trade, an idea, a call on where things are heading. Eighteen months pass and nothing has moved. People who mocked you are still mocking you.',
    q: 'What does the silence tell you?',
    opts: [
      { t: 'That you were probably wrong.', s: 0 },
      { t: 'Nothing yet. Time alone does not invalidate a thesis.', s: 3 },
      { t: 'That the market is irrational and you just need to wait longer.', s: 1 },
      { t: 'You go back to first principles and check if the thesis still holds.', s: 3 },
    ]
  },
  {
    id: 5,
    scenario: "Everyone in your industry is moving in the same direction. The momentum feels unstoppable. Saying otherwise would damage your reputation and your relationships.",
    q: 'What do you do with what you actually think?',
    opts: [
      { t: 'You say nothing. The cost is too high.', s: 0 },
      { t: 'You find subtle ways to signal your doubts without full exposure.', s: 1 },
      { t: 'You say what you think, clearly, and accept the consequences.', s: 3 },
      { t: 'You wait until you see the first crack, then speak.', s: 2 },
    ]
  },
  {
    id: 6,
    scenario: 'A market you have been watching crashes exactly as you predicted. Friends who ignored your warnings have lost significant money. You were right.',
    q: 'What is your honest internal response?',
    opts: [
      { t: 'Relief. Being vindicated matters to you more than you admit.', s: 1 },
      { t: 'You feel very little. You already knew. The outcome was expected.', s: 3 },
      { t: 'Quiet satisfaction, but mostly you are focused on what comes next.', s: 3 },
      { t: 'You want to tell people. It is hard to resist.', s: 0 },
    ]
  },
  {
    id: 7,
    scenario: 'You hold a position that has been wrong for long enough that the people who trust your judgment are starting to lose faith in you, not just in the trade.',
    q: 'What matters most to you right now?',
    opts: [
      { t: 'Protecting the relationships. You fold.', s: 0 },
      { t: 'The thesis. If it is still right, none of the rest matters.', s: 3 },
      { t: 'Understanding whether you are right or just stubborn.', s: 3 },
      { t: 'Buying time. You need them to trust you a little longer.', s: 1 },
    ]
  },
]

const PROFILES = [
  {
    min: 0, max: 7,
    type: 'The Follower',
    desc: 'You feel the pull of consensus strongly, and that is not a flaw. Most people do. The crowd provides comfort, social proof, and the safety of shared blame when things go wrong. The contrarian path requires a settled relationship with being isolated in a correct belief — often for years. You are not there yet. But the fact that you took this test suggests you are looking for something the crowd is not giving you.'
  },
  {
    min: 8, max: 13,
    type: 'The Doubter',
    desc: "You see the cracks in the consensus more often than most. The problem is not what you think — it is what you do with it. Social pressure keeps winning at the moments that matter. You fold at the dinner table. You go quiet in the meeting. You wait for someone else to say it first. The gap between you and the contrarian is not intelligence. It is the willingness to pay the social cost of being right before anyone else is."
  },
  {
    min: 14, max: 17,
    type: 'The Independent',
    desc: "You think for yourself with more consistency than most people manage. You have held positions under pressure that most people would have abandoned. You have been the uncomfortable voice at the table and you have learned to live with it. What separates you from the fully formed contrarian is not conviction — it is comfort. You still feel the isolation more than you would like. That feeling fades with time and with being right often enough to trust your own signal."
  },
  {
    min: 18, max: 21,
    type: 'The Contrarian',
    desc: "You do not need the crowd's approval to hold a position and you have proven it under real pressure, not hypothetical pressure. You have sat at the table and said the thing nobody wanted to hear. You have held when the relationships around the thesis started to fray. You have been vindicated often enough that disagreement no longer reads as danger — it reads as signal. The crowd moving against you, at this point, is almost a reason to look harder at whether you are right."
  },
]

export default function TestPage() {
  const ref                     = useRef(null)
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
        const total = next.reduce((a, b) => a + b, 0)
        setResult({ total, profile: PROFILES.find(p => total >= p.min && total <= p.max) })
      } else {
        setQ(n => n + 1)
      }
    }, 380)
  }

  const reset = () => {
    setStarted(false); setQ(0); setScores([]); setSelected(null); setResult(null)
  }

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
              <p className="test-intro__desc">
                This is not a trivia quiz. It is a series of pressure moments designed to reveal how you actually behave when the crowd is against you — not how you think you would behave. Most people overestimate how contrarian they are. The test is built to find the gap.
              </p>
              <button className="btn btn-gold" onClick={() => setStarted(true)}>Begin the Test</button>
            </div>
            <div className="test-intro__right rv d2">
              {PROFILES.map(p => (
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
              <div className="test-prog__fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="test-prog__label">{q + 1} / {QS.length}</p>

            <div className="test-q">
              <p className="test-scenario">{QS[q].scenario}</p>
              <h2 className="test-qtext">{QS[q].q}</h2>
            </div>

            <div className="test-opts">
              {QS[q].opts.map((o, i) => (
                <button
                  key={i}
                  className={`test-opt ${selected === o.s && selected !== null ? 'test-opt--sel' : ''}`}
                  onClick={() => pick(o.s)}
                  disabled={selected !== null}
                >
                  <span className="test-opt__lt">{String.fromCharCode(65 + i)}</span>
                  <span className="test-opt__tx">{o.t}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="test-result rv">
            <p className="label" style={{ marginBottom: '1.5rem' }}>Your Profile</p>
            <h2 className="test-result__type">{result.profile.type}</h2>
            <div className="g-rule" style={{ margin: '1.5rem 0' }} />
            <p className="test-result__desc">{result.profile.desc}</p>
            <div style={{ marginTop: '2.5rem' }}>
              <button className="btn btn-ghost" onClick={reset}>Take It Again</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}