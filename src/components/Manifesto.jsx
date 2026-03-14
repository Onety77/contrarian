import React, { useEffect, useRef } from 'react'
import './Manifesto.css'

export default function Manifesto() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.08 }
    )
    const els = sectionRef.current?.querySelectorAll('.reveal') || []
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <section className="manifesto section" id="manifesto" ref={sectionRef}>
      <div className="container">
        <div className="manifesto__header reveal">
          <p className="section-label">The Manifesto</p>
          <div className="gold-rule" />
        </div>

        <div className="manifesto__body">
          <div className="manifesto__title-col reveal">
            <h2 className="manifesto__title">
              The<br /><em>Contrarian</em>
            </h2>
            <p className="manifesto__deck">
              On the rare and stubborn personality type that has quietly driven every major shift in human history, and why the market was always their natural home.
            </p>
          </div>

          <div className="manifesto__text">

            <p className="drop-cap reveal">There is a personality type that has no comfortable name. Not a rebel, because rebels oppose for the sake of it. Not a pessimist, because pessimists simply believe things will fail. Not a genius, necessarily, though they are often mistaken for one in hindsight. The closest word we have is <strong>contrarian.</strong> And it is one of the most misunderstood, underestimated, and quietly powerful forces in human history.</p>

            <p className="reveal">A contrarian is simply someone who looks at the same information as everyone else and arrives at a different conclusion. Not because they want to be different. Not because they enjoy the friction. But because they cannot make the evidence point in the direction the crowd is walking, and they are constitutionally incapable of pretending otherwise.</p>

            <p className="reveal">This is rarer than it sounds. The pull of consensus is one of the most powerful forces in human psychology. We are social animals, wired for belonging. To stand apart from the herd, to hold a position that draws ridicule, to be the only voice in a room saying the opposite of what everyone wants to hear, requires a particular kind of character. Not courage, exactly. More like certainty. A calm, settled, privately-held certainty that the crowd has it wrong, and that time will prove it.</p>

            <blockquote className="manifesto__quote reveal">
              <p>"The time to get interested is when no one else is. You can't buy what is popular and do well."</p>
              <cite>Warren Buffett</cite>
            </blockquote>

            <h3 className="reveal">The Crowd Is Always Wrong at the Extremes</h3>

            <p className="reveal">To understand the contrarian, you first have to understand the crowd. Markets, financial markets, cultural markets, idea markets, all follow the same basic pattern. A view forms. It gains momentum. Early adopters are joined by followers, then by the majority, then by the late majority who arrive already certain the trend will last forever. By the time something is consensus, it is almost always approaching its peak.</p>

            <p className="reveal">The crowd is not stupid. Individual participants are often brilliant. But crowds operate on a different logic, the logic of social proof, of safety in numbers, of the comfortable warmth that comes from agreeing with most people. And that logic, applied to markets, consistently produces the same outcome: prices pushed beyond reason at the top, and beaten below reason at the bottom.</p>

            <div className="manifesto__ruled reveal">
              <p>The contrarian does not profit because they are smarter. They profit because they are different, and different, at the extremes of market sentiment, is almost always correct.</p>
            </div>

            <h3 className="reveal">Why Most People Simply Cannot Do It</h3>

            <p className="reveal">Understanding the contrarian is easy. Being one is a different matter entirely. And the reason most people cannot do it has nothing to do with intelligence. It has to do with something far more primal: the need to belong.</p>

            <p className="reveal">Human beings are wired for social agreement. For most of our history, being cast out from the group was not an inconvenience. It was a death sentence. That instinct is still running in us. When we hold a position that nobody around us shares, the brain registers it as a threat. The pressure to conform is not weakness. It is biology. And it is working against the contrarian every single day.</p>

            <p className="reveal">This is why the contrarian is so often described in the language of social exile. The black sheep of the family, the underdog written off by the establishment, the one chasing a white whale that everyone around them considers a waste of a life. These are not just metaphors. They are accurate descriptions of what the contrarian social experience actually feels like, sitting at a dinner table defending a position that nobody at that table believes in, absorbing the concern of people who love you, holding the line anyway.</p>

            <p className="reveal">Most people reach that dinner table and quietly fold. Not because their thesis was wrong. Because the social cost of holding it becomes heavier than the financial cost of abandoning it. The crowd does not need to be right to win in the short term. It just needs to be loud enough, long enough, for the contrarian to stop trusting themselves.</p>

            <h3 className="reveal">The Names History Remembers</h3>

            <p className="reveal">In 1939, as Europe descended into war and American markets were gripped by depression-era fear, a young investor named <strong>John Templeton</strong> did something that struck most observers as either visionary or insane. He borrowed money and used it to buy shares in every company on the New York Stock Exchange trading below one dollar, including dozens that were functionally bankrupt. Thirty-four of those companies went to zero. The rest made him rich, and launched one of the most celebrated investment careers of the twentieth century. His philosophy was simply this: the best time to buy is at the point of maximum pessimism.</p>

            <p className="reveal"><strong>Warren Buffett</strong> compressed the same idea into a sentence that has survived every market cycle since: be fearful when others are greedy, and greedy when others are fearful. His most famous early trade was buying American Express after a scandal had collapsed its stock price and consensus was that the company was finished. He saw a durable brand being mispriced by temporary panic. He was right. And the reason is not superior information. It is a superior relationship with the crowd's irrationality.</p>

            <p className="reveal">Then there is <strong>Michael Burry,</strong> the hedge fund manager who read the mortgage data that everyone in finance had access to and arrived at a conclusion the entire industry found laughable: the housing market was a fraud, and it was going to collapse. He spent years absorbing losses, fighting off investors who wanted their money back, maintaining a thesis while the market moved violently against him. When the crash came in 2008, it arrived exactly as he had described. He did not celebrate. He had known for years. The waiting was the hard part.</p>

            <p className="reveal">And then there is <strong>Elon Musk,</strong> whose entire biography reads as a sequence of contrarian positions held in the face of expert consensus. In 2002, when he announced he intended to build reusable rockets, aerospace engineers said it was physically and economically impossible. When he announced Tesla would produce a mass-market electric vehicle, the automotive industry laughed. He did not argue with them. He built the rockets, manufactured the cars, and let the outcomes do the talking.</p>

            <blockquote className="manifesto__quote reveal">
              <p>Ray Dalio built the world's largest hedge fund on a single contrarian principle: you cannot make money agreeing with the consensus view.</p>
              <cite>Bridgewater Associates</cite>
            </blockquote>

            <h3 className="reveal">The Price of Being Right Too Early</h3>

            <p className="reveal">It would be dishonest to write about the contrarian without acknowledging what it actually costs. The romantic version of this story, the one where the lone thinker is proven right and the crowd is forced to admit it, skips the middle. And the middle is where most contrarians live for a very long time.</p>

            <p className="reveal">Writer and marketing strategist <strong>Sean D'Souza</strong> put it plainly in his study of contrarian thinking: the road to contrarian ideas can be incredibly frustrating and possibly lead to dead ends. He uses the story of <strong>John Yudkin,</strong> the British scientist who published research in 1972 arguing that obesity was caused not by fat but by sugar. He was a serious scientist with serious evidence. And then the food industry and prominent nutritionists dismantled him publicly and completely. He died in 1995, largely forgotten. Decades later, the scientific consensus shifted almost entirely to his position. He was right. He simply ran out of time before the world caught up.</p>

            <div className="manifesto__citation reveal">
              <p>"The road to contrarian ideas can be incredibly frustrating and possibly lead to dead ends. Even so, being contrarian means you have to go against the trends that are clearly inferior."</p>
              <span>Sean D'Souza, Psychotactics</span>
            </div>

            <p className="reveal">This is the honest version of the contrarian story. Not a guaranteed path to success. A path where being right and being rewarded are two different things, separated sometimes by years, sometimes by decades, sometimes by a lifetime.</p>

            <h3 className="reveal">The Market Was Always Their Home</h3>

            <p className="reveal">Crypto, specifically, was built on contrarian thinking from its first block. To believe in Bitcoin in 2010 was not just a financial bet. It was a social one. It meant disagreeing with every central bank, every established economist, every financial institution, and most of your friends. The people who held through the ridicule of 2011, the crash of 2014, the collapse of 2018, the capitulation of 2022 were not holding a coin. They were holding a conviction.</p>

            <p className="reveal">The pattern in crypto repeats with almost mechanical regularity. A small number of people see something early. The crowd ridicules it. The price collapses. The crowd celebrates. The contrarians buy more. The cycle turns. The crowd floods back in, now calling themselves believers, and the contrarians, who never left, say nothing. They already knew.</p>

            <h3 className="reveal">The Type</h3>

            <p className="reveal">You either recognize yourself in this or you don't. There is no teaching yourself into the contrarian personality. The instinct, the particular discomfort with consensus, the itch that arrives when everyone agrees, that is not learned. It is discovered. Usually through a moment where you were right and alone, or wrong and right eventually, or right and unable to explain it to anyone who would listen.</p>

            <p className="reveal">These people were not lucky. They were not smarter than everyone else in any simple sense. They were contrarian, which is a different thing, a rarer thing, and ultimately a more enduring thing than any edge that can be copied or any system that can be followed.</p>

            <p className="reveal">History does not remember the crowd. It remembers the ones who diverged from it at exactly the right moment, and had the character to hold.</p>

            <div className="manifesto__closing reveal">
              <p>The crowd will understand eventually.</p>
              <p className="sub">They always do.</p>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
