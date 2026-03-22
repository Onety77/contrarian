import React, { useState, useEffect } from 'react'
import './ReadingRoom.css'

const ARTICLES = [
  {
    id:'a1', category:'Market History', date:'March 2026', readTime:'7 min',
    title:'The Man Who Bought Every Dying Company on Wall Street',
    excerpt:'In September 1939, a 27-year-old investor borrowed money and bought shares in every NYSE stock under $1 — including 37 already in bankruptcy. His name was John Templeton.',
    body:`On the morning of September 1, 1939, German tanks crossed the Polish border and the Second World War began. That same day, a 27-year-old American working in New York picked up the phone and called his broker with an instruction that must have sounded, at the time, like the request of a madman.

Buy 100 shares of every stock on the New York Stock Exchange trading below one dollar per share. Every single one. Including the ones that are already bankrupt.

His name was John Templeton, and he had borrowed the $10,000 required to execute the trade. The United States was still hauling itself out of the worst economic depression in its history. Europe was descending into war. The prevailing mood on Wall Street was one of exhausted fear.

Templeton saw something different.

He was not sentimental about the companies he was buying. Of the 104 stocks he purchased that day — which included 37 already operating under bankruptcy protection — he expected many to fail entirely. His thesis was not that these businesses were good. It was that they were priced as though all of them would fail, and that was mathematically impossible.

America, Templeton reasoned, was about to become the arsenal of democracy. The war in Europe would generate industrial demand the continent had not seen since the last war. These battered, broken companies, so unloved they traded for less than a dollar, would be swept upward by an economic tide the market had not yet priced.

He was right.

Over the following four years, as the United States entered the war and its industrial base ignited, the portfolio performed beyond imagination. Of the 104 companies, only four went to zero. Templeton sold after an average holding period of four years. His $10,000 had become $40,000 — a fourfold return at a time when most investors had simply been trying to avoid losing everything.

He later said, with characteristic understatement, that he wished he had held on longer.

What Templeton had done was not find 104 great businesses. He had found 104 businesses priced for extinction during a moment of maximum collective pessimism, and he had bet against the pessimism rather than against the companies.

He went on to build one of the most celebrated investment careers of the twentieth century, founding the Templeton Growth Fund in 1954. A $10,000 investment at inception would have been worth more than $2 million when he sold the fund to Franklin Resources in 1992. Money magazine called him "arguably the greatest global stock picker of the century."

But the trade that mattered most happened in the first hours of a world war, when everyone was afraid, and he was on the phone to his broker.

"The time of maximum pessimism," Templeton said, "is the best time to buy."

He lived by that sentence. The market, eventually, rewarded him for it.`
  },
  {
    id:'a2', category:'Market History', date:'February 2026', readTime:'9 min',
    title:'The Doctor Who Read the Mortgage Documents Nobody Else Would',
    excerpt:"In 2003, a one-eyed hedge fund manager with Asperger's began reading mortgage bond prospectuses that Wall Street had never bothered to open. What he found would make him $750 million — and nearly break him first.",
    body:`Michael Burry was not supposed to be a hedge fund manager. He was a medical doctor — a neurology resident — who had never finished his residency. He had one glass eye and a self-diagnosed case of Asperger's syndrome that made him deeply uncomfortable in any room with more than a few people. He preferred to work alone, reading company filings late into the night, communicating with investors mostly by email.

What he had in abundance was a willingness to do tedious, unglamorous work that everyone else considered beneath them.

In 2003 and 2004, while the American housing market was being celebrated as the most reliable wealth-creation engine in the country's history, Burry began reading mortgage bond prospectuses. These were documents — often 200 pages or more — that described exactly which mortgages had been bundled together to create the bonds Wall Street was selling as safe, income-generating instruments. Almost nobody on Wall Street read them. The rating agencies that stamped them AAA had not read them carefully. The banks selling them had not read them.

Burry read them all.

What he found was a fraud so systematic and so large it was almost difficult to believe. The bonds were stuffed with loans made to borrowers who could not afford them — adjustable-rate mortgages with teaser rates that would reset sharply upward within two years. The borrowers had no documentation, no verifiable income, in some cases no assets. The only thing keeping the payments coming was the assumption that house prices would keep rising forever.

Burry calculated that when the rate resets arrived, beginning in 2007, defaults would cascade in a way the market had not imagined.

By May 2005, he had begun purchasing credit default swaps — a form of insurance — against mortgage-backed securities. He started with $60 million from Deutsche Bank, and by October 2005 had built a short position of more than $1 billion.

The banks who sold him these instruments thought he was confused. They were so certain housing prices would not fall nationally that they were, in effect, giving away money. They took his premiums each month and laughed.

Then 2006 arrived. And it nearly broke him.

Home prices had peaked in August 2005, but the mortgage bond market refused to reflect this. Burry's investors revolted. Some demanded their money back. He refused. Others threatened lawsuits. Goldman Sachs, which had sold him the CDS contracts, was marking his positions at prices designed — internal emails later revealed by Senator Carl Levin — to cause him "maximum pain."

He cut staff salaries. He cut his own. He kept paying the premiums.

In early 2007, the subprime mortgage market began to unravel exactly as he had predicted. Delinquency rates surged. Bear Stearns hedge funds imploded. Burry's credit default swaps became worth multiples of what he had paid for them.

Scion Capital gained 489% that year. He made roughly $750 million for his investors and over $100 million for himself.

When it was over, he shut down the fund. The vindication, he said, did not feel like he had imagined. He had been right. He had watched the financial system collapse onto the people who lived in the houses he had been short. He found that difficult to celebrate.

The entire crisis was sitting there in plain text in documents that were publicly available. The crowd had simply decided, collectively, that reading them was not necessary — because the crowd was certain that housing prices only went up.

One man with a glass eye and a willingness to do boring work saw it differently.`
  },
  {
    id:'a3', category:'Profiles', date:'February 2026', readTime:'8 min',
    title:'The Scientist Who Was Right About Sugar and Destroyed For It',
    excerpt:'John Yudkin published his research on the dangers of sugar in 1972. He was called a crank and a peddler of science fiction. He died in 1995 largely forgotten. Then the world caught up.',
    body:`In 1957, a British nutritionist named John Yudkin published a paper in The Lancet arguing that sugar, not fat, was the primary dietary driver of heart disease. He was a serious scientist — Professor of Nutrition at Queen Elizabeth College in London — and he had serious data. He had observed correlations between sugar consumption and heart disease across multiple countries, conducted experiments in his laboratory, and believed the evidence was pointing clearly in one direction.

He was right. It would take the rest of the world fifty years to admit it.

The man who stood in his way was Ancel Keys, an American physiologist who had built an enormous professional empire around the opposite theory: that saturated fat, not sugar, caused heart disease. Keys was brilliant, charismatic, and ferociously political. He had secured positions for himself and his allies on the boards of the American Heart Association and the National Institutes of Health. His Seven Countries Study — which showed a correlation between fat intake and heart disease — was celebrated as landmark science.

It was also, as researchers would later discover, deeply compromised. Keys had selected his countries apparently to support his hypothesis, omitting nations like France and West Germany that ate large quantities of saturated fat but had low rates of heart disease.

When Yudkin published Pure, White and Deadly in 1972 — a book aimed at general readers, summarizing the evidence that sugar was killing people — the response from the scientific establishment was not debate. It was destruction.

Keys called Yudkin's work "a mountain of nonsense" and "propaganda." The World Sugar Research Organization described the book as "science fiction." A campaign, funded partly by the sugar industry, worked to make Yudkin a pariah.

It succeeded.

Yudkin found himself uninvited from international nutrition conferences. Research journals rejected his papers. By the time he retired, his name had become, in certain corners of nutritional science, a cautionary tale about what happened to people who challenged consensus without sufficient institutional support.

In 2009, a pediatric endocrinologist at the University of California named Robert Lustig delivered a lecture called "Sugar: The Bitter Truth." It eventually reached 24 million views and said, using new biochemical evidence, precisely what Yudkin had said in 1972. Lustig called Yudkin's work "prophetic." He said "everything this man said in 1972 was the God's honest truth."

Pure, White and Deadly was republished in 2012 by Penguin, forty years after its first appearance. By then, the world had lived through five decades of the low-fat dietary experiment. The food industry had replaced fat in processed foods with sugar, with the blessing of institutions that had silenced the man warning about exactly that.

Yudkin died in 1995. He did not live to see his vindication.

What happened to him is not a story about nutritional science. It is a story about what organized consensus does to people who are right at the wrong time. Keys had power and used it. Yudkin had evidence. It was not enough.`
  },
  {
    id:'a4', category:'Market History', date:'January 2026', readTime:'7 min',
    title:'Buffett, Salad Oil, and the Scandal That Nearly Destroyed American Express',
    excerpt:'In November 1963, a fraud involving fake vegetable oil caused American Express stock to collapse 43%. A 33-year-old Warren Buffett walked into steakhouses to do his due diligence. What he found made him rich.',
    body:`The Great Salad Oil Swindle of 1963 involves a con man from the Bronx, thousands of tanks of fake vegetable oil, and a warehouse in Bayonne, New Jersey. It sounds almost comical. The consequences were not.

Anthony "Tino" De Angelis was running Allied Crude Vegetable Oil Refining Corporation, and he had found a beautiful gap to exploit. He stored vegetable oil in enormous tanks at a New Jersey warehouse. American Express had a subsidiary that issued warehouse receipts — certificates confirming that oil in the tanks existed and could be used as collateral for loans.

De Angelis discovered that inspectors checked for oil by dipping a rod into the tanks. Oil floats on water. If you fill the tanks mostly with seawater and top them with a thin layer of oil, the rod comes up coated in oil. The inspector leaves satisfied. The receipt is issued.

He did this for years, building a phantom inventory certified by American Express receipts and used to borrow hundreds of millions of dollars. By the time it unravelled in November 1963, American Express faced claims exceeding $150 million — against total shareholders' equity of around $78 million.

American Express shares fell from $61.81 to $40.00 in under two weeks, eventually bottoming at $35.31 — a decline of 43%. Wall Street had priced in the possibility that American Express might not survive.

Warren Buffett, who was 33 years old and running a small investment partnership in Omaha, watched the collapse with interest.

He had studied American Express before. He knew the business: the traveler's checks that millions used when crossing borders, the nascent credit card operation, the financial services that had made the company a trusted name in global commerce. He had an instinct that the market was confusing a problem with a subsidiary for a problem with the brand.

To test that instinct, he did something that would not appear in any finance textbook. He went to steakhouses and restaurants in Omaha and watched to see whether customers had stopped using American Express cards and traveler's checks.

They had not.

The scandal was all over the financial press. Wall Street was pricing American Express as though it might cease to exist. In steakhouses in Omaha, people were still pulling out their Amex cards as though nothing had happened.

Buffett understood what this meant. The scandal had damaged the balance sheet. It had not damaged the thing that made American Express valuable: the trust that millions of people placed in the name. The brand was intact. The market was selling it at a discount because of a warehousing subsidiary most customers had never heard of.

He invested $13 million — roughly 40% of his entire partnership's assets. It was the largest single position he had ever taken.

American Express, as of 2024, is worth over $130 billion. Berkshire Hathaway owns more than 20% of it. The position began with a salad oil fraud in a New Jersey warehouse and has compounded for sixty years.

The crowd saw a company that might go bankrupt. Buffett saw a brand that nobody had stopped trusting.`
  },
  {
    id:'a5', category:'Psychology', date:'January 2026', readTime:'6 min',
    title:'Why Your Brain Makes Contrarian Thinking Almost Impossible',
    excerpt:'The same neural systems that evolved to warn you about physical danger activate when you hold a position nobody around you supports. Being right is not the hard part. Staying right is.',
    body:`There is a well-documented experiment in social psychology that goes like this. A researcher shows a participant three lines of clearly different lengths and asks which is longest. The answer is obvious. Then the researcher brings in a group of actors who confidently give the wrong answer before the participant speaks. In more than a third of trials, the real participant abandons the correct answer and agrees with the group.

This is not a story about stupidity. The participants in these experiments — conducted by Solomon Asch in the 1950s — were ordinary people with functioning eyes and working brains. They could see which line was longest. Under social pressure, a significant proportion of them said it wasn't.

This is the problem with contrarian investing. It is not primarily an intellectual problem. People who understand markets intellectually — who can read a balance sheet, who know market history — still find it almost neurologically impossible to act on their knowledge during periods of extreme market sentiment.

The brain treats social disagreement as a threat. When you hold a position nobody around you supports, the same neural systems that evolved to warn you about physical danger begin to activate. Being the only voice at a table saying "this will fail" or "this is undervalued" feels, at a very basic level, like standing on the wrong side of a predator.

John Maynard Keynes — who was himself a professional investor — understood this when he observed that it is better for reputation to fail conventionally than to succeed unconventionally. The social cost of being wrong alone is higher than the social cost of being wrong with everyone else. This asymmetry operates independently of what any analysis suggests.

What the great contrarians share is not superior intelligence. It is a particular relationship with social feedback. Templeton moved to the Bahamas specifically to insulate himself from Wall Street consensus. Burry worked alone and refused to take investor meetings in person. Buffett lives in Omaha. The physical distance from the noise is not coincidental.

There is also a specific cognitive pattern that appears in accounts of great contrarian investors: a very high tolerance for being wrong in the short term while maintaining conviction about the long term. The people who were right about the 2008 housing crisis in 2005 spent three years being told, by price action and by peers, that they were wrong. Burry's investors tried to withdraw their money. The market was screaming at him to capitulate.

He did not.

The research on this kind of persistence suggests it is related to a particular type of information processing — one that weights internally derived conclusions more heavily than externally provided feedback. Most people's confidence in a position decays under sustained social pressure. In a small number of people, confidence is maintained or even increased by opposition, because opposition reads as evidence that the consensus has not yet caught up to what the data already shows.

This is not stubbornness. Stubbornness ignores contradicting evidence. The contrarian pattern involves constant re-examination of the thesis — with the crucial distinction that other people's disagreement is not treated as evidence that the thesis is wrong.

Templeton did not discover a trick for making this comfortable. He simply decided that discomfort was part of the process. That the fear itself, when it was widespread enough, was a signal.`
  },
  {
    id:'a6', category:'Psychology', date:'December 2025', readTime:'6 min',
    title:'The Social Cost of Being Early',
    excerpt:'Being right too early carries a financial cost that is well understood. The social cost — what it does to your relationships, your reputation, your standing at the dinner table — is almost never discussed.',
    body:`Michael Burry, in the years between 2005 and 2007, paid roughly $1.4 million per month in insurance premiums to maintain his short position against the housing market. This number appears in accounts of that period as an illustration of financial pressure — the ongoing cost of being correct before the market agreed with you.

What those accounts rarely dwell on is the other cost.

His investors wrote him letters describing him as unstable, delusional, and potentially fraudulent. Long-standing relationships with people who had trusted him with their money curdled into hostility. At least one investor sued him. Several demanded their capital back immediately. He later said that the vindication did not feel the way he had imagined it would. The years of isolation and accusation had cost him something that was not measured in basis points.

This is the part of contrarian investing that the financial literature treats as a footnote. The literature is focused on the trade — the entry, the thesis, the eventual return. The years in between, and what they do to the person holding the position, receive much less attention.

John Yudkin did not have investors to lose. He had colleagues. He had the professional community in which he had built a career — academic journals that had published his papers, conferences that had invited him to speak. By the mid-1970s, after Ancel Keys had spent years publicly destroying his credibility, most of those things were gone. He was not merely wrong in the consensus view. He was a cautionary tale.

He was right. His evidence was solid. None of that mattered.

The family dinner table problem is the version most individual investors encounter. It does not require a billion-dollar short or a career in nutritional science. It requires only that you hold a position that people who love you think is stupid.

In 2011, when Bitcoin was trading around five dollars, the people who owned it were not described by their families as visionary. They were described, more typically, as having been seduced by something that sounded like a scam. The holding period required to make the contrarian thesis pay off was measured in years during which every dinner table conversation involved the holder defending a position that people around them found, at best, eccentric.

The financial literature tells you what the position returned. It does not tell you how many Christmases were spent defending it.

There is no clean answer to this. The social cost is real and it is not cancelled out by eventual financial vindication. Burry was right and he still describes 2005 to 2007 in terms that do not suggest triumph. Yudkin was right and he died before anyone was willing to say so publicly.

What this means, practically, is that the analysis of a contrarian position cannot stop at the financial thesis. The question "is this right?" has to be followed by "can I hold this long enough for right to become recognized?" — and that second question involves an honest accounting of social capital, of relationships that may not survive the intermediate period.

The field spends enormous energy on the intellectual dimension of contrarian thinking and almost none on its social dimension. That is an honest gap worth naming.`
  }
]

const CATS = ['All', 'Market History', 'Psychology', 'Profiles']

function ArticleOverlay({ article, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', fn)
    }
  }, [onClose])

  const paragraphs = article.body.trim().split('\n\n').filter(Boolean)

  return (
    <div className="ao-veil" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ao-panel">
        <div className="ao-head">
          <span className="eyebrow">{article.category}</span>
          <button className="ao-close" onClick={onClose}>✕</button>
        </div>
        <div className="ao-divider" />
        <div className="ao-body">
          <div className="ao-meta">
            <span>{article.date}</span>
            <span>·</span>
            <span>{article.readTime} read</span>
          </div>
          <h1 className="ao-title">{article.title}</h1>
          <div className="ao-red-rule" />
          <div className="ao-content">
            {paragraphs.map((para, i) => (
              <p key={i} className={i === 0 ? 'ao-drop' : ''}>{para}</p>
            ))}
          </div>
          <div className="ao-foot">
            <div className="ao-divider" style={{ marginBottom: '1.2rem' }} />
            <p className="ao-footnote">A verified account drawn from public record, financial filings, and established reporting.</p>
            <button className="ao-back" onClick={onClose}>← Back to Reading Room</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReadingRoom() {
  const [cat,  setCat]  = useState('All')
  const [open, setOpen] = useState(null)

  const filtered = cat === 'All' ? ARTICLES : ARTICLES.filter(a => a.category === cat)

  return (
    <div className="rr-page page">

      <div className="inner-hero">
        <div className="wrap">
          <div className="inner-hero__top">
            <span className="eyebrow">Reading Room</span>
          </div>
          <div className="rule--red" style={{ margin: '1rem 0 1.2rem' }} />
          <h1 className="inner-hero__title">Stories worth<br /><em>remembering.</em></h1>
          <div className="rule--thick" style={{ margin: '1rem 0 1.5rem' }} />
          <p className="inner-hero__deck">
            Real accounts of the people who saw what the crowd missed — the trades, the science, the ideas — and what it cost them to hold the line.
          </p>
        </div>
      </div>

      <div className="inner-body">
        <div className="wrap">
          <div className="filter-row">
            {CATS.map(c => (
              <button key={c} className={`filter-btn ${cat === c ? 'filter-btn--on' : ''}`} onClick={() => setCat(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="rr-grid">
            {filtered.map((a, i) => (
              <div key={a.id} className={`rr-card ${i === 0 && cat === 'All' ? 'rr-card--lead' : ''}`}>
                <div className="rr-card__top">
                  <span className="rr-card__cat eyebrow" style={{ fontSize: '0.54rem', color: 'var(--ink-faint)' }}>{a.category}</span>
                  <span className="rr-card__date">{a.date}</span>
                </div>
                <div className="rule" style={{ margin: '0.7rem 0' }} />
                <h3 className="rr-card__title">{a.title}</h3>
                <p className="rr-card__excerpt">{a.excerpt}</p>
                <div className="rr-card__foot">
                  <span className="rr-card__time">{a.readTime} read</span>
                  <button className="rr-card__cta" onClick={() => setOpen(a)}>Read the story →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {open && <ArticleOverlay article={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
