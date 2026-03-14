import React, { useEffect, useRef, useState } from 'react'
import './ContrTest.css'

const QUESTIONS = [
  {
    id: 1,
    scenario: 'Every analyst you follow is calling this the greatest bull run in a decade. Your feed is euphoric. The trade feels obvious.',
    question: 'What do you do?',
    options: [
      { text: 'Buy in. You don\'t want to miss it.', score: 0 },
      { text: 'Wait and watch. Something feels off.', score: 2 },
      { text: 'Start looking for the exit. Euphoria always ends.', score: 3 },
      { text: 'Ask what the bears are saying.', score: 2 },
    ],
  },
  {
    id: 2,
    scenario: 'A position you\'ve held for 6 months is down 40%. Your thesis hasn\'t changed. The crowd says you\'re delusional.',
    question: 'How do you respond?',
    options: [
      { text: 'Sell. Protect what\'s left.', score: 0 },
      { text: 'Hold. The thesis is intact.', score: 3 },
      { text: 'Buy more. The mispricing is bigger now.', score: 3 },
      { text: 'Panic. The crowd might be right.', score: 0 },
    ],
  },
  {
    id: 3,
    scenario: 'Your family is asking why you haven\'t sold yet. They think you\'re throwing your money away. The discomfort is real.',
    question: 'What wins?',
    options: [
      { text: 'The relationship. You fold.', score: 0 },
      { text: 'You explain your thesis again.', score: 1 },
      { text: 'You hold. You\'ve stopped explaining.', score: 3 },
      { text: 'You doubt yourself for the first time.', score: 1 },
    ],
  },
  {
    id: 4,
    scenario: 'The market is crashing. Your timeline is panic. A respected voice says this is the end of the cycle.',
    question: 'Your move?',
    options: [
      { text: 'Sell everything.', score: 0 },
      { text: 'Do nothing. Wait for data.', score: 2 },
      { text: 'Start building a shopping list.', score: 3 },
      { text: 'Follow the respected voice.', score: 0 },
    ],
  },
  {
    id: 5,
    scenario: 'You see something nobody else is talking about. The opportunity is clear to you but invisible to the crowd.',
    question: 'What stops you?',
    options: [
      { text: 'Nothing. You move.', score: 3 },
      { text: 'You wait for confirmation.', score: 1 },
      { text: 'You wait for someone else to notice first.', score: 0 },
      { text: 'You research harder before acting.', score: 2 },
    ],
  },
  {
    id: 6,
    scenario: 'You were wrong. A contrarian position you held with conviction failed. The crowd was right.',
    question: 'What do you take from it?',
    options: [
      { text: 'The crowd is sometimes right. Adjust.', score: 3 },
      { text: 'Never go against the consensus again.', score: 0 },
      { text: 'Examine the thesis, not the outcome.', score: 3 },
      { text: 'Ignore it and move on.', score: 1 },
    ],
  },
  {
    id: 7,
    scenario: 'Everyone around you has made money following the trend. You\'ve been sitting out. The pressure to join is enormous.',
    question: 'What happens next?',
    options: [
      { text: 'You join. FOMO wins.', score: 0 },
      { text: 'You watch. Your time will come.', score: 3 },
      { text: 'You look for what they\'re missing.', score: 3 },
      { text: 'You question your judgment.', score: 1 },
    ],
  },
]

const PROFILES = [
  {
    min: 0,
    max: 7,
    type: 'The Follower',
    description: 'You feel the pull of consensus strongly, and that is not a flaw. Most people do. The crowd provides comfort, social proof, and the feeling of safety in numbers. The contrarian path requires something most people never develop: a settled relationship with being alone in a thesis. You are not there yet. But you know it now.',
  },
  {
    min: 8,
    max: 13,
    type: 'The Doubter',
    description: 'You feel the discomfort of consensus but you have not yet learned to trust that feeling. You see what the crowd misses, sometimes, but the social pressure to conform keeps winning. You are closer to the contrarian than you think. The gap is not intelligence. It is conviction.',
  },
  {
    min: 14,
    max: 17,
    type: 'The Independent',
    description: 'You think for yourself with more consistency than most. You have been right when the crowd was wrong, and you have paid the social price of it. You understand that being early and being wrong look identical for a while. You are not fully comfortable with the isolation yet, but you are learning to sit with it.',
  },
  {
    min: 18,
    max: 21,
    type: 'The Contrarian',
    description: 'You do not need the crowd\'s approval. You have been the black sheep, the underdog, the one at the dinner table holding a position nobody else wanted to hear. You have been proven right in the long run often enough to trust your own judgment over the noise. This is not a personality trait you chose. It is one you discovered.',
  },
]

export default function ContrTest() {
  const sectionRef = useRef(null)
  const [started, setStarted] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(null)

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
  }, [started, result])

  const handleAnswer = (score) => {
    setSelected(score)
    setTimeout(() => {
      const newAnswers = [...answers, score]
      setAnswers(newAnswers)
      setSelected(null)
      if (currentQ + 1 >= QUESTIONS.length) {
        const total = newAnswers.reduce((a, b) => a + b, 0)
        const profile = PROFILES.find(p => total >= p.min && total <= p.max)
        setResult({ total, profile })
      } else {
        setCurrentQ(q => q + 1)
      }
    }, 400)
  }

  const reset = () => {
    setStarted(false)
    setCurrentQ(0)
    setAnswers([])
    setResult(null)
    setSelected(null)
  }

  const progress = ((currentQ) / QUESTIONS.length) * 100

  return (
    <section className="contr-test section" id="test" ref={sectionRef}>
      <div className="container">

        {!started && !result && (
          <div className="ct-intro">
            <div className="ct-intro__left reveal">
              <p className="section-label">The Test</p>
              <h2 className="ct-intro__title">
                How contrarian<br /><em>are you, really?</em>
              </h2>
              <p className="ct-intro__sub">
                Seven scenarios. No right answers. Just a mirror.
              </p>
              <p className="ct-intro__desc">
                This is not a trivia quiz. It is a series of real pressure moments designed to reveal how you actually think versus how the crowd thinks. Your result will not be a percentage. It will be a profile.
              </p>
              <button className="ct-start-btn" onClick={() => setStarted(true)}>
                Begin the Test
              </button>
            </div>
            <div className="ct-intro__right reveal reveal-delay-2">
              <div className="ct-profiles-preview">
                {PROFILES.map(p => (
                  <div key={p.type} className="ct-profile-preview-item">
                    <span className="ct-profile-preview-type">{p.type}</span>
                  </div>
                ))}
              </div>
              <p className="ct-profiles-hint">Four profiles. Which one are you?</p>
            </div>
          </div>
        )}

        {started && !result && (
          <div className="ct-quiz reveal">
            <div className="ct-progress-bar">
              <div className="ct-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="ct-progress-label">
              <span>{currentQ + 1} / {QUESTIONS.length}</span>
            </div>

            <div className="ct-question">
              <p className="ct-scenario">{QUESTIONS[currentQ].scenario}</p>
              <h3 className="ct-q-text">{QUESTIONS[currentQ].question}</h3>
            </div>

            <div className="ct-options">
              {QUESTIONS[currentQ].options.map((opt, i) => (
                <button
                  key={i}
                  className={`ct-option ${selected === opt.score && selected !== null ? 'ct-option--selected' : ''}`}
                  onClick={() => handleAnswer(opt.score)}
                  disabled={selected !== null}
                >
                  <span className="ct-option-letter">{String.fromCharCode(65 + i)}</span>
                  <span className="ct-option-text">{opt.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="ct-result reveal">
            <p className="section-label">Your Result</p>
            <div className="ct-result__type">{result.profile.type}</div>
            <div className="gold-rule" />
            <p className="ct-result__desc">{result.profile.description}</p>
            <div className="ct-result__actions">
              <button className="ct-start-btn" onClick={reset}>
                Take It Again
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  )
}
