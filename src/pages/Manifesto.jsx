import React, { useEffect, useRef } from 'react'
import './Manifesto.css'

// People mentioned in the article — images needed
// See image list at bottom of App.jsx
const FIGURES = [
  { name: 'John Templeton', img: 'templeton.jpg', note: 'Bought at maximum pessimism. 1939.' },
  { name: 'Warren Buffett',  img: 'buffett.jpg',   note: 'Fearful when others are greedy.' },
  { name: 'Michael Burry',   img: 'burry.jpg',     note: 'Held the housing short for years.' },
  { name: 'Elon Musk',       img: 'musk.jpg',      note: 'Contrarian by design. Proven right by default.' },
]

export default function Manifesto() {
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
    <div className="manifesto-page page" ref={ref}>

      {/* PAGE HERO */}
      <div className="mfst-hero">
        <div className="mfst-hero__overlay" />
        <div className="mfst-hero__content wrap">
          <p className="label rv">The Manifesto</p>
          <h1 className="mfst-hero__title rv d1">
            The<br /><em>Contrarian</em>
          </h1>
          <p className="mfst-hero__deck rv d2">
            On the rare and stubborn personality type that has quietly driven every major shift in human history, and why the market was always their natural home.
          </p>
        </div>
      </div>

      {/* ARTICLE */}
      <div className="mfst-body">
        <div className="mfst-layout wrap">

          {/* Sticky sidebar */}
          <aside className="mfst-sidebar rv">
            <p className="label" style={{marginBottom:'1.5rem'}}>The Figures</p>
            {FIGURES.map(f => (
              <div key={f.name} className="mfst-figure">
                <img
                  src={`/${f.img}`}
                  alt={f.name}
                  className="mfst-figure__img"
                  onError={e => { e.target.style.display='none' }}
                />
                <p className="mfst-figure__name">{f.name}</p>
                <p className="mfst-figure__note">{f.note}</p>
              </div>
            ))}
          </aside>

          {/* Article text */}
          <article className="mfst-article">

            <p className="mfst-dropcap rv">There is a personality type that has no comfortable name. Not a rebel, because rebels oppose for the sake of it. Not a pessimist, because pessimists simply believe things will fail. Not a genius, necessarily, though they are often mistaken for one in hindsight. The closest word we have is <strong>contrarian.</strong> And it is one of the most misunderstood, underestimated, and quietly powerful forces in human history.</p>

            <p className="rv">A contrarian is simply someone who looks at the same information as everyone else and arrives at a different conclusion. Not because they want to be different. Not because they enjoy the friction. But because they cannot make the evidence point in the direction the crowd is walking, and they are constitutionally incapable of pretending otherwise.</p>

            <p className="rv">This is rarer than it sounds. The pull of consensus is one of the most powerful forces in human psychology. We are social animals, wired for belonging. To stand apart from the herd, to hold a position that draws ridicule, to be the only voice in a room saying the opposite of what everyone wants to hear, requires a particular kind of character. Not courage, exactly. More like certainty.</p>

            <blockquote className="mfst-quote rv">
              <p>"The time to get interested is when no one else is. You can't buy what is popular and do well."</p>
              <cite>Warren Buffett</cite>
            </blockquote>

            <h2 className="rv">The Crowd Is Always Wrong at the Extremes</h2>

            <p className="rv">To understand the contrarian, you first have to understand the crowd. Markets, financial markets, cultural markets, idea markets, all follow the same basic pattern. A view forms. It gains momentum. Early adopters are joined by followers, then by the majority, then by the late majority who arrive already certain the trend will last forever. By the time something is consensus, it is almost always approaching its peak.</p>

            <p className="rv">The crowd is not stupid. Individual participants are often brilliant. But crowds operate on a different logic, the logic of social proof, of safety in numbers. And that logic, applied to markets, consistently produces the same outcome: prices pushed beyond reason at the top, and beaten below reason at the bottom.</p>

            <div className="mfst-ruled rv">
              <p>The contrarian does not profit because they are smarter. They profit because they are different, and different, at the extremes of market sentiment, is almost always correct.</p>
            </div>

            <h2 className="rv">Why Most People Simply Cannot Do It</h2>

            <p className="rv">Understanding the contrarian is easy. Being one is a different matter entirely. And the reason most people cannot do it has nothing to do with intelligence. It has to do with something far more primal: the need to belong.</p>

            <p className="rv">Human beings are wired for social agreement. When we hold a position that nobody around us shares, the brain registers it as a threat. The pressure to conform is not weakness. It is biology. And it is working against the contrarian every single day.</p>

            <p className="rv">This is why the contrarian is so often described in the language of social exile. The black sheep of the family, the underdog written off by the establishment. These are not just metaphors. They are accurate descriptions of what the contrarian social experience actually feels like, sitting at a dinner table defending a position nobody believes in, absorbing the concern of people who love you, holding the line anyway.</p>

            <p className="rv">Most people reach that dinner table and quietly fold. Not because their thesis was wrong. Because the social cost of holding it becomes heavier than the financial cost of abandoning it.</p>

            <h2 className="rv">The Names History Remembers</h2>

            <p className="rv">In 1939, as Europe descended into war and American markets were gripped by depression-era fear, a young investor named <strong>John Templeton</strong> borrowed money and used it to buy shares in every company on the New York Stock Exchange trading below one dollar, including dozens that were functionally bankrupt. Thirty-four of those companies went to zero. The rest made him rich, and launched one of the most celebrated investment careers of the twentieth century. His philosophy was simply this: the best time to buy is at the point of maximum pessimism.</p>

            <p className="rv"><strong>Warren Buffett</strong> compressed the same idea into a sentence that has survived every market cycle since: be fearful when others are greedy, and greedy when others are fearful. His most famous early trade was buying American Express after a scandal had collapsed its stock price. He saw a durable brand being mispriced by temporary panic. He was right. And the reason is not superior information. It is a superior relationship with the crowd's irrationality.</p>

            <p className="rv">Then there is <strong>Michael Burry,</strong> who read the mortgage data that everyone in finance had access to and arrived at a conclusion the entire industry found laughable: the housing market was a fraud, and it was going to collapse. He spent years absorbing losses, fighting off investors who wanted their money back, maintaining a thesis while the market moved violently against him. When the crash came in 2008, it arrived exactly as he had described. He did not celebrate. He had known for years. The waiting was the hard part.</p>

            <p className="rv">And then there is <strong>Elon Musk,</strong> whose entire biography reads as a sequence of contrarian positions held against expert consensus. In 2002, when he announced he intended to build reusable rockets, aerospace engineers said it was physically and economically impossible. When he announced Tesla would produce a mass-market electric vehicle, the automotive industry laughed. He did not argue. He built, and let the outcomes do the talking.</p>

            <blockquote className="mfst-quote rv">
              <p>Ray Dalio built the world's largest hedge fund on a single contrarian principle: you cannot make money agreeing with the consensus view.</p>
              <cite>Bridgewater Associates</cite>
            </blockquote>

            <h2 className="rv">The Price of Being Right Too Early</h2>

            <p className="rv">It would be dishonest to write about the contrarian without acknowledging what it actually costs. The romantic version of this story skips the middle. And the middle is where most contrarians live for a very long time.</p>

            <p className="rv">Writer and marketing strategist <strong>Sean D'Souza</strong> put it plainly: the road to contrarian ideas can be incredibly frustrating and possibly lead to dead ends. He uses the story of <strong>John Yudkin,</strong> the British scientist who published research in 1972 arguing that obesity was caused not by fat but by sugar. He was a serious scientist with serious evidence. The food industry dismantled him publicly. He died in 1995, largely forgotten. Decades later, the scientific consensus shifted almost entirely to his position. He was right. He simply ran out of time before the world caught up.</p>

            <div className="mfst-citation rv">
              <p>"The road to contrarian ideas can be incredibly frustrating and possibly lead to dead ends. Even so, being contrarian means you have to go against the trends that are clearly inferior."</p>
              <span>Sean D'Souza, Psychotactics</span>
            </div>

            <h2 className="rv">The Market Was Always Their Home</h2>

            <p className="rv">Crypto was built on contrarian thinking from its first block. To believe in Bitcoin in 2010 was not just a financial bet. It was a social one. It meant disagreeing with every central bank, every established economist, and most of your friends. The people who held through the ridicule of 2011, the crash of 2014, the collapse of 2018, the capitulation of 2022 were not holding a coin. They were holding a conviction.</p>

            <p className="rv">The pattern in crypto repeats with almost mechanical regularity. A small number of people see something early. The crowd ridicules it. The price collapses. The crowd celebrates. The contrarians buy more. The cycle turns. The crowd floods back in, now calling themselves believers. The contrarians say nothing. They already knew.</p>

            <h2 className="rv">The Type</h2>

            <p className="rv">You either recognize yourself in this or you don't. There is no teaching yourself into the contrarian personality. The instinct, the particular discomfort with consensus, the itch that arrives when everyone agrees, that is not learned. It is discovered.</p>

            <p className="rv">History does not remember the crowd. It remembers the ones who diverged from it at exactly the right moment, and had the character to hold.</p>

            <div className="mfst-close rv">
              <p>The crowd will understand eventually.</p>
              <span>They always do.</span>
            </div>

          </article>
        </div>
      </div>
    </div>
  )
}
