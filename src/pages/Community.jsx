import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../firebase'
import {
  collection, addDoc, getDocs, getDoc, doc, updateDoc,
  orderBy, query, where, serverTimestamp, increment, arrayUnion, arrayRemove, limit
} from 'firebase/firestore'
import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'firebase/auth'
import { getApp } from 'firebase/app'
import { askGemini } from '../gemini'
import './Community.css'

// ── AUTH INSTANCE ─────────────────────────────────────────────
const auth = getAuth(getApp())

// ── SCORE CONSTANTS ───────────────────────────────────────────
const SCORE = {
  POST_WITHOUT_TEST: 5,
  UPVOTE_RECEIVED:   2,
  COMMENT_UPVOTE:    1,
  OUTCOME_CORRECT:   15,
}

const TEST_SCORE_MAP = {
  'The Follower':    8,
  'The Doubter':     22,
  'The Independent': 42,
  'The Contrarian':  65,
}

// ── BADGE COMPONENT ───────────────────────────────────────────
function Badge({ score = 0, size = 38 }) {
  const pct     = Math.min(100, Math.max(0, score))
  const tier    = pct >= 80 ? 4 : pct >= 50 ? 3 : pct >= 20 ? 2 : pct > 0 ? 1 : 0
  const cx      = size / 2
  const r1      = size * 0.38
  const r2      = size * 0.28
  const c1      = 2 * Math.PI * r1
  const c2      = 2 * Math.PI * r2
  const dash1   = (pct / 100) * c1
  const dash2   = tier >= 3 ? c2 : 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="badge-svg">
      {/* Outer track */}
      <circle cx={cx} cy={cx} r={r1} fill="none" stroke="var(--rule-heavy)" strokeWidth="2" />
      {/* Outer fill */}
      {pct > 0 && (
        <circle
          cx={cx} cy={cx} r={r1}
          fill="none"
          stroke={tier >= 4 ? 'var(--red)' : 'var(--ink)'}
          strokeWidth="2"
          strokeDasharray={`${dash1} ${c1}`}
          strokeDashoffset={c1 * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      )}
      {/* Inner ring — tier 3+ */}
      {tier >= 3 && (
        <>
          <circle cx={cx} cy={cx} r={r2} fill="none" stroke="var(--rule-heavy)" strokeWidth="1.5" />
          <circle
            cx={cx} cy={cx} r={r2}
            fill="none"
            stroke={tier >= 4 ? 'var(--red)' : 'var(--ink)'}
            strokeWidth="1.5"
            strokeDasharray={`${dash2} ${c2}`}
            strokeDashoffset={c2 * 0.25}
            strokeLinecap="round"
          />
        </>
      )}
      {/* Center dot — tier 4 */}
      {tier >= 4 && <circle cx={cx} cy={cx} r={size * 0.08} fill="var(--red)" />}
      {/* Score text */}
      <text
        x={cx} y={cx + (tier >= 3 ? 0 : 1)}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * (pct >= 100 ? 0.18 : 0.2)}
        fontFamily="Barlow Condensed, sans-serif"
        fontWeight="700"
        fill={tier >= 4 ? 'var(--red)' : 'var(--ink)'}
        letterSpacing="0"
      >
        {pct}%
      </text>
    </svg>
  )
}

// ── USERNAME DISPLAY ──────────────────────────────────────────
function UserChip({ username, score, size = 32 }) {
  return (
    <div className="user-chip">
      <Badge score={score} size={size} />
      <span className="user-chip__name">{username}</span>
    </div>
  )
}

// ── AUTH MODAL ────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }) {
  const [mode,     setMode]     = useState('login')  // login | register
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const toEmail = (u) => `${u.trim().toLowerCase().replace(/\s+/g, '_')}@contra.app`

  const submit = async () => {
    if (!username.trim() || !password.trim()) { setError('Fill in both fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setError(''); setLoading(true)
    const email = toEmail(username)
    try {
      if (mode === 'register') {
        // Check username not taken
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', username.trim())))
        if (!snap.empty) { setError('That username is taken.'); setLoading(false); return }
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await addDoc(collection(db, 'users'), {
          uid:       cred.user.uid,
          username:  username.trim(),
          score:     0,
          testTaken: false,
          joinedAt:  serverTimestamp(),
        })
        onSuccess({ uid: cred.user.uid, username: username.trim(), score: 0, testTaken: false })
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password)
        const snap = await getDocs(query(collection(db,'users'), where('uid','==',cred.user.uid)))
        if (snap.empty) { setError('Account not found.'); setLoading(false); return }
        const data = snap.docs[0].data()
        onSuccess({ ...data, docId: snap.docs[0].id })
      }
    } catch(e) {
      const msg = e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
        ? 'Wrong username or password.'
        : e.code === 'auth/email-already-in-use'
        ? 'That username is already registered.'
        : 'Something went wrong. Try again.'
      setError(msg)
    }
    setLoading(false)
  }

  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <span className="eyebrow">{mode === 'login' ? 'Sign In' : 'Join The Few'}</span>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="rule--heavy" style={{margin:'1rem 0'}} />

        {mode === 'register' && (
          <p className="modal__sub">Choose a username. This is your public identity on The Few.</p>
        )}

        <div className="modal__fields">
          <input
            className="field"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            maxLength={24}
            autoComplete="username"
          />
          <input
            className="field"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </div>

        {error && <p className="modal__error">{error}</p>}

        <button className="btn btn-ink modal__submit" onClick={submit} disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          className="modal__switch"
          onClick={() => { setMode(mode==='login'?'register':'login'); setError('') }}
        >
          {mode === 'login' ? "Don't have an account? Join The Few" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

// ── POST CARD ─────────────────────────────────────────────────
function PostCard({ post, currentUser, onUpvote, onOpenComments }) {
  const hasUpvoted = currentUser && post.upvotedBy?.includes(currentUser.uid)
  const timeAgo    = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    const s = Math.floor((Date.now() - d) / 1000)
    if (s < 60)   return 'just now'
    if (s < 3600) return `${Math.floor(s/60)}m ago`
    if (s < 86400)return `${Math.floor(s/3600)}h ago`
    return `${Math.floor(s/86400)}d ago`
  }

  return (
    <div className={`post-card ${post.vindicated ? 'post-card--vindicated' : ''}`}>
      <div className="post-card__head">
        <UserChip username={post.username} score={post.authorScore || 0} size={34} />
        <div className="post-card__meta">
          {post.vindicated && <span className="post-card__vindicated">✦ Vindicated</span>}
          <span className="post-card__time">{timeAgo(post.createdAt)}</span>
        </div>
      </div>

      <div className="rule" style={{margin:'0.8rem 0'}} />

      {post.asset && (
        <span className="post-card__asset eyebrow" style={{fontSize:'0.54rem',marginBottom:'0.5rem',display:'block'}}>
          {post.asset}
        </span>
      )}

      <p className="post-card__thesis">{post.thesis}</p>

      {post.aiTag && (
        <div className="post-card__ai-tag">
          <span className="post-card__ai-label">◈ The Few agree</span>
          <p className="post-card__ai-text">{post.aiTag}</p>
        </div>
      )}

      <div className="post-card__foot">
        <button
          className={`post-card__upvote ${hasUpvoted ? 'post-card__upvote--on' : ''}`}
          onClick={() => onUpvote(post)}
          title={hasUpvoted ? 'Remove upvote' : 'Upvote'}
        >
          <span className="post-card__upvote-icon">▲</span>
          <span>{post.upvotes || 0}</span>
        </button>
        <button className="post-card__comments" onClick={() => onOpenComments(post)}>
          <span>◻</span>
          <span>{post.commentCount || 0} {post.commentCount === 1 ? 'reply' : 'replies'}</span>
        </button>
        <span className="post-card__score-badge">
          <Badge score={post.authorScore || 0} size={22} />
        </span>
      </div>
    </div>
  )
}

// ── COMMENT PANEL ─────────────────────────────────────────────
function CommentPanel({ post, currentUser, onAuth, onClose }) {
  const [comments,    setComments]    = useState([])
  const [text,        setText]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q    = query(collection(db,'comments'), where('postId','==',post.id), orderBy('createdAt','asc'))
      const snap = await getDocs(q)
      setComments(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    } catch(e) {}
    setLoading(false)
  }, [post.id])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!text.trim() || !currentUser) return
    setSubmitting(true)
    try {
      await addDoc(collection(db,'comments'), {
        postId:      post.id,
        uid:         currentUser.uid,
        username:    currentUser.username,
        authorScore: currentUser.score || 0,
        text:        text.trim(),
        upvotes:     0,
        upvotedBy:   [],
        createdAt:   serverTimestamp(),
      })
      // Increment comment count on post
      await updateDoc(doc(db,'community_posts',post.id), { commentCount: increment(1) })
      setText('')
      await load()
    } catch(e) {}
    setSubmitting(false)
  }

  const upvoteComment = async (c) => {
    if (!currentUser) { onAuth(); return }
    if (c.upvotedBy?.includes(currentUser.uid)) return
    try {
      await updateDoc(doc(db,'comments',c.id), {
        upvotes:   increment(1),
        upvotedBy: arrayUnion(currentUser.uid),
      })
      // Give commenter +1 to score
      const uSnap = await getDocs(query(collection(db,'users'), where('uid','==',c.uid)))
      if (!uSnap.empty) {
        await updateDoc(uSnap.docs[0].ref, { score: increment(SCORE.COMMENT_UPVOTE) })
      }
      await load()
    } catch(e) {}
  }

  const timeAgo = (ts) => {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    const s = Math.floor((Date.now() - d) / 1000)
    if (s < 60)    return 'just now'
    if (s < 3600)  return `${Math.floor(s/60)}m ago`
    if (s < 86400) return `${Math.floor(s/3600)}h ago`
    return `${Math.floor(s/86400)}d ago`
  }

  return (
    <div className="comment-panel">
      <div className="comment-panel__head">
        <span className="eyebrow">Replies</span>
        <button className="comment-panel__close" onClick={onClose}>✕</button>
      </div>
      <div className="rule--heavy" style={{margin:'0.8rem 0 1rem'}} />

      <div className="comment-panel__thesis">
        <p>"{post.thesis}"</p>
        <span className="comment-panel__author">— {post.username}</span>
      </div>

      <div className="rule" style={{margin:'1rem 0'}} />

      {loading && <p className="comment-panel__loading">Loading...</p>}

      <div className="comment-list">
        {comments.length === 0 && !loading && (
          <p className="comment-list__empty">No replies yet. Be the first.</p>
        )}
        {comments.map(c => (
          <div key={c.id} className="comment">
            <div className="comment__head">
              <UserChip username={c.username} score={c.authorScore || 0} size={24} />
              <span className="comment__time">{timeAgo(c.createdAt)}</span>
            </div>
            <p className="comment__text">{c.text}</p>
            <button
              className={`comment__upvote ${c.upvotedBy?.includes(currentUser?.uid) ? 'comment__upvote--on' : ''}`}
              onClick={() => upvoteComment(c)}
            >
              ▲ {c.upvotes || 0}
            </button>
          </div>
        ))}
      </div>

      <div className="comment-panel__input">
        {currentUser ? (
          <>
            <textarea
              ref={inputRef}
              className="field comment-field"
              placeholder="Add your perspective..."
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              maxLength={400}
            />
            <button
              className="btn btn-ink"
              onClick={submit}
              disabled={submitting || !text.trim()}
              style={{width:'100%'}}
            >
              {submitting ? 'Posting...' : 'Post Reply'}
            </button>
          </>
        ) : (
          <button className="btn btn-outline" onClick={onAuth} style={{width:'100%'}}>
            Sign in to reply
          </button>
        )}
      </div>
    </div>
  )
}

// ── POST COMPOSER ─────────────────────────────────────────────
function Composer({ currentUser, onPost }) {
  const [thesis, setThesis] = useState('')
  const [asset,  setAsset]  = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!thesis.trim() || thesis.trim().length < 20) return
    setSaving(true)
    try {
      const ref = await addDoc(collection(db,'community_posts'), {
        uid:         currentUser.uid,
        username:    currentUser.username,
        authorScore: currentUser.score || 0,
        thesis:      thesis.trim(),
        asset:       asset.trim(),
        upvotes:     0,
        upvotedBy:   [],
        commentCount:0,
        vindicated:  false,
        aiTag:       null,
        createdAt:   serverTimestamp(),
      })

      // Score: if no test taken, award POST_WITHOUT_TEST
      if (!currentUser.testTaken) {
        const uSnap = await getDocs(query(collection(db,'users'), where('uid','==',currentUser.uid)))
        if (!uSnap.empty) {
          await updateDoc(uSnap.docs[0].ref, { score: increment(SCORE.POST_WITHOUT_TEST) })
        }
      }

      // Try AI tag if post gets traction (for now just trigger on post for demo)
      try {
        const aiRes = await askGemini(
          `A user on a contrarian thinking platform posted this thesis: "${thesis.trim()}". 
          In exactly one sentence (max 18 words), write why independent thinkers would find this compelling. 
          Be direct. No fluff. No quotes around your response.`
        )
        if (aiRes && aiRes.length < 160) {
          await updateDoc(doc(db,'community_posts',ref.id), { aiTag: aiRes.trim() })
        }
      } catch(e) {}

      setThesis(''); setAsset('')
      onPost()
    } catch(e) {}
    setSaving(false)
  }

  return (
    <div className="composer">
      <div className="composer__head">
        <UserChip username={currentUser.username} score={currentUser.score || 0} size={36} />
      </div>
      <div className="rule" style={{margin:'1rem 0'}} />
      <input
        className="field"
        placeholder="Asset or topic (e.g. BTC, AI, Housing...)"
        value={asset}
        onChange={e => setAsset(e.target.value)}
        maxLength={40}
        style={{marginBottom:'0.6rem'}}
      />
      <textarea
        className="field composer__textarea"
        placeholder="State your contrarian thesis. What does the crowd have wrong?"
        value={thesis}
        onChange={e => setThesis(e.target.value)}
        rows={4}
        maxLength={500}
      />
      <div className="composer__foot">
        <span className="composer__count">{thesis.length}/500</span>
        <button
          className="btn btn-ink"
          onClick={submit}
          disabled={saving || thesis.trim().length < 20}
        >
          {saving ? 'Posting...' : 'Put It On Record'}
        </button>
      </div>
    </div>
  )
}

// ── MAIN COMMUNITY PAGE ───────────────────────────────────────
export default function Community() {
  const ref = useRef(null)

  const [user,         setUser]         = useState(null)   // firebase auth user
  const [profile,      setProfile]      = useState(null)   // firestore user doc
  const [posts,        setPosts]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showAuth,     setShowAuth]     = useState(false)
  const [activePost,   setActivePost]   = useState(null)   // for comment panel
  const [sortBy,       setSortBy]       = useState('recent') // recent | top
  const [showComposer, setShowComposer] = useState(false)

  // ── Fetch profile from Firestore ──────────────────────────
  const fetchProfile = useCallback(async (uid) => {
    try {
      const snap = await getDocs(query(collection(db,'users'), where('uid','==',uid)))
      if (!snap.empty) {
        setProfile({ ...snap.docs[0].data(), docId: snap.docs[0].id })
      }
    } catch(e) {}
  }, [])

  // ── Auth listener ─────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) await fetchProfile(u.uid)
      else   setProfile(null)
    })
    return unsub
  }, [fetchProfile])

  // ── Load posts ────────────────────────────────────────────
  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const order = sortBy === 'top' ? orderBy('upvotes','desc') : orderBy('createdAt','desc')
      const q     = query(collection(db,'community_posts'), order, limit(40))
      const snap  = await getDocs(q)
      setPosts(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    } catch(e) {}
    setLoading(false)
  }, [sortBy])

  useEffect(() => { loadPosts() }, [loadPosts])

  // ── Reveal animation ──────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.05 }
    )
    ref.current?.querySelectorAll('.rv').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [posts])

  // ── Upvote ────────────────────────────────────────────────
  const handleUpvote = async (post) => {
    if (!profile) { setShowAuth(true); return }
    if (post.uid === profile.uid) return // can't upvote own post

    const hasVoted = post.upvotedBy?.includes(profile.uid)
    try {
      await updateDoc(doc(db,'community_posts',post.id), {
        upvotes:   increment(hasVoted ? -1 : 1),
        upvotedBy: hasVoted ? arrayRemove(profile.uid) : arrayUnion(profile.uid),
      })
      // Give author score bump
      if (!hasVoted) {
        const aSnap = await getDocs(query(collection(db,'users'), where('uid','==',post.uid)))
        if (!aSnap.empty) {
          await updateDoc(aSnap.docs[0].ref, { score: increment(SCORE.UPVOTE_RECEIVED) })
        }
      }
      await loadPosts()
    } catch(e) {}
  }

  // ── Auth success ──────────────────────────────────────────
  const handleAuthSuccess = async (profileData) => {
    setProfile(profileData)
    setShowAuth(false)
    await loadPosts()
  }

  // ── Sign out ──────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut(auth)
    setProfile(null)
    setActivePost(null)
    setShowComposer(false)
  }

  return (
    <div className="comm-page page" ref={ref}>

      {/* HERO */}
      <div className="inner-hero">
        <div className="wrap">
          <div className="inner-hero__top rv">
            <span className="eyebrow">The Few</span>
          </div>
          <div className="rule--red rv d1" style={{margin:'1rem 0 1.2rem'}} />
          <h1 className="inner-hero__title rv d1">Put it<br /><em>on record.</em></h1>
          <div className="rule--thick rv d2" style={{margin:'1rem 0 1.5rem'}} />
          <p className="inner-hero__deck rv d2">
            Not a chat. Not a forum. A public record of independent thought — timestamped, permanent, and judged by the market.
          </p>
        </div>
      </div>

      {/* BODY */}
      <div className="comm-body wrap">

        {/* TOP BAR */}
        <div className="comm-topbar rv">
          <div className="comm-sort">
            <button className={`comm-sort__btn ${sortBy==='recent'?'comm-sort__btn--on':''}`} onClick={() => setSortBy('recent')}>Recent</button>
            <button className={`comm-sort__btn ${sortBy==='top'?'comm-sort__btn--on':''}`} onClick={() => setSortBy('top')}>Top</button>
          </div>

          <div className="comm-topbar__right">
            {profile ? (
              <div className="comm-user">
                <UserChip username={profile.username} score={profile.score || 0} size={32} />
                <button className="comm-post-btn btn btn-ink" onClick={() => setShowComposer(v => !v)}>
                  {showComposer ? 'Cancel' : '+ Post Thesis'}
                </button>
                <button className="comm-signout" onClick={handleSignOut}>Sign out</button>
              </div>
            ) : (
              <button className="btn btn-ink" onClick={() => setShowAuth(true)}>
                Join The Few
              </button>
            )}
          </div>
        </div>

        <div className="rule" style={{margin:'0 0 2rem'}} />

        {/* COMPOSER */}
        {showComposer && profile && (
          <div className="rv" style={{marginBottom:'2rem'}}>
            <Composer
              currentUser={profile}
              onPost={async () => { setShowComposer(false); await loadPosts() }}
            />
          </div>
        )}

        {/* LAYOUT: posts + comments panel */}
        <div className={`comm-layout ${activePost ? 'comm-layout--split' : ''}`}>

          {/* POSTS */}
          <div className="comm-posts">
            {loading && (
              <div className="comm-loading">
                <span className="eyebrow">Loading...</span>
              </div>
            )}
            {!loading && posts.length === 0 && (
              <div className="comm-empty rv">
                <div className="rule--red" style={{marginBottom:'1.5rem'}} />
                <p className="comm-empty__text">No theses yet. Be the first to put something on record.</p>
                {!profile && (
                  <button className="btn btn-ink" onClick={() => setShowAuth(true)} style={{marginTop:'1.5rem'}}>
                    Join The Few
                  </button>
                )}
              </div>
            )}
            {posts.map((p, i) => (
              <div key={p.id} className="rv" style={{transitionDelay:`${(i%6)*0.04}s`}}>
                <PostCard
                  post={p}
                  currentUser={profile}
                  onUpvote={handleUpvote}
                  onOpenComments={(post) => setActivePost(activePost?.id === post.id ? null : post)}
                />
              </div>
            ))}
          </div>

          {/* COMMENT PANEL */}
          {activePost && (
            <div className="comm-comments-wrap rv">
              <CommentPanel
                post={activePost}
                currentUser={profile}
                onAuth={() => setShowAuth(true)}
                onClose={() => setActivePost(null)}
              />
            </div>
          )}

        </div>
      </div>

      {/* AUTH MODAL */}
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

    </div>
  )
}
