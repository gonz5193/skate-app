import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './supabaseClient'

const colors = ['#5a3d2b','#2b3d5a','#3d5a2b','#5a2b4d','#2b5a52','#5a4a2b']

function initials(name){ return name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

function colorFor(name){
  const sum = name.split('').reduce((a,c) => a + c.charCodeAt(0), 0)
  return colors[sum % colors.length]
}

function timeAgo(dateString){
  const diffMs = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function LetterTrack({ count }) {
  const word = ['S','K','A','T','E']
  return (
    <div className="skate-track">
      {word.map((l,i) => (
        <div key={i} className={`skate-letter ${i < count ? 'filled' : ''}`}>{l}</div>
      ))}
    </div>
  )
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      })
      if (error) {
        setError(error.message)
      } else {
        onAuthed(data.user)
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        onAuthed(data.user)
      }
    }
    setLoading(false)
  }

  return (
    <div className="app">
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 16 }}>
        <div className="wordmark" style={{ justifyContent: 'center', fontSize: 40, marginBottom: 8 }}>
          <span>SKATE</span><span>.</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 13, marginBottom: 32 }}>
          {mode === 'login' ? 'Log in to call someone out' : 'Create your account'}
        </div>

        {mode === 'signup' && (
          <div className="field">
            <label>USERNAME</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. mayaslides" />
          </div>
        )}
        <div className="field">
          <label>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
        </div>
        <div className="field">
          <label>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>

        {error && <div style={{ color: 'var(--tag)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button className="btn-submit" style={{ width: '100%', marginTop: 8 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'PLEASE WAIT…' : mode === 'login' ? 'LOG IN' : 'SIGN UP'}
        </button>

        <button
          className="action-btn"
          style={{ justifyContent: 'center', marginTop: 20 }}
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [screen, setScreen] = useState('feed')
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [opp, setOpp] = useState('@leo_ollies (Berlin)')
  const [trick, setTrick] = useState('')
  const [spot, setSpot] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchGames()
  }, [session])

  async function fetchGames() {
    setLoading(true)
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching games:', error)
    } else {
      setFeed(data)
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setFeed([])
  }

  async function toggleLike(game) {
    const newLikes = game.likes + 1
    setFeed(feed.map(p => p.id === game.id ? { ...p, likes: newLikes } : p))
    const { error } = await supabase.from('games').update({ likes: newLikes }).eq('id', game.id)
    if (error) console.error('Error updating likes:', error)
  }

  async function resolveAttempt(game, landed) {
    if (landed) return
    const newLetters = Math.min(5, game.self_letters + 1)
    setFeed(feed.map(p => p.id === game.id ? { ...p, self_letters: newLetters } : p))
    const { error } = await supabase.from('games').update({ self_letters: newLetters }).eq('id', game.id)
    if (error) console.error('Error updating letters:', error)
  }

  async function createGame() {
    const name = opp.split(' (')[0].replace('@','').replace(/_/g,' ')
    const location = opp.split('(')[1].replace(')','')
    const displayName = name.charAt(0).toUpperCase() + name.slice(1)

    const { data, error } = await supabase
      .from('games')
      .insert([{
        opponent_name: displayName,
        spot: (spot || 'Local spot') + ', ' + location,
        trick: (trick || 'Kickflip').toUpperCase(),
        self_letters: 0,
        opp_letters: 0,
        likes: 0
      }])
      .select()

    if (error) {
      console.error('Error creating game:', error)
      return
    }

    setFeed([data[0], ...feed])
    setTrick('')
    setSpot('')
    setModalOpen(false)
    setScreen('feed')
  }

  if (authLoading) {
    return <div className="app" style={{ minHeight: '100vh' }} />
  }

  if (!session) {
    return <AuthScreen onAuthed={() => {}} />
  }

  const displayName = session.user.user_metadata?.username || session.user.email.split('@')[0]

  return (
    <div className="app">
      <div className="topbar">
        <div className="wordmark"><span>SKATE</span><span>.</span></div>
        <div className="streak-pill">🔥 6 game streak</div>
      </div>

      {screen === 'feed' && (
        <div className="screen">
          <div className="section-head">WORLDWIDE FEED</div>
          {loading && <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>Loading games…</div>}
          {!loading && feed.length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No games yet. Call someone out.</div>
          )}
          {feed.map((p) => (
            <div className="feed-card" key={p.id}>
              <div className="feed-card-head">
                <div className="avatar" style={{ background: colorFor(p.opponent_name), color: '#fff' }}>{initials(p.opponent_name)}</div>
                <div className="who">
                  <div className="name">{p.opponent_name}</div>
                  <div className="spot">{p.spot}</div>
                </div>
                <div className="time">{timeAgo(p.created_at)}</div>
              </div>
              <div className="clip" style={{ background: `linear-gradient(160deg, ${colorFor(p.opponent_name)}, #0e0e0e 85%)` }}>
                <div className="play-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                </div>
                <div className="trick-tag">{p.trick}</div>
              </div>
              <div className="vs-row">
                <div className="vs-side">
                  <div className="vs-name">{p.opponent_name.split(' ')[0].toUpperCase()}</div>
                  <LetterTrack count={p.self_letters} />
                </div>
                <div className="vs-mid">VS</div>
                <div className="vs-side" style={{ alignItems: 'flex-end' }}>
                  <div className="vs-name">{displayName.toUpperCase()}</div>
                  <LetterTrack count={p.opp_letters} />
                </div>
              </div>
              <div className="feed-actions">
                <button className="action-btn" onClick={() => toggleLike(p)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                  {p.likes}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {screen === 'play' && (
        <div className="screen">
          <button className="new-game-btn" onClick={() => setModalOpen(true)}>+ CALL OUT SOMEONE NEW</button>
          <div className="section-head">YOUR MOVE</div>
          {feed.map((g) => (
            <div className="game-card" key={g.id}>
              <div className="top-row">
                <div className="opp-name">{g.opponent_name}</div>
                <LetterTrack count={g.self_letters} />
              </div>
              <div className="set-trick">TRICK SET: {g.trick} — {g.spot}</div>
              <div className="game-buttons">
                <button className="btn btn-land" onClick={() => resolveAttempt(g, true)}>LANDED IT</button>
                <button className="btn btn-miss" onClick={() => resolveAttempt(g, false)}>MISSED</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {screen === 'profile' && (
        <div className="screen">
          <div className="profile-head">
            <div className="avatar" style={{ background: 'var(--wheel)' }}>{initials(displayName)}</div>
            <div className="name">{displayName.toUpperCase()}</div>
            <div className="handle">{session.user.email}</div>
            <div className="stat-row">
              <div className="stat win"><div className="num">0</div><div className="lbl">WINS</div></div>
              <div className="stat loss"><div className="num">0</div><div className="lbl">LOSSES</div></div>
              <div className="stat"><div className="num">0</div><div className="lbl">STREAK</div></div>
            </div>
          </div>
          <div className="section-head">RECENT GAMES</div>
          {feed.slice(0, 3).map((p) => (
            <div className="game-card" key={p.id}>
              <div className="top-row">
                <div className="opp-name">vs {p.opponent_name}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--bone-dim)' }}>{timeAgo(p.created_at)} ago</div>
              </div>
            </div>
          ))}
          <button className="btn-cancel" style={{ width: '100%', marginTop: 12 }} onClick={handleLogout}>LOG OUT</button>
        </div>
      )}

      <div className="bottomnav">
        <button className={`navbtn ${screen === 'feed' ? 'active' : ''}`} onClick={() => setScreen('feed')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
          FEED
        </button>
        <button className={`navbtn ${screen === 'play' ? 'active' : ''}`} onClick={() => setScreen('play')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          PLAY
        </button>
        <button className={`navbtn ${screen === 'profile' ? 'active' : ''}`} onClick={() => setScreen('profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
          PROFILE
        </button>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>SET THE TRICK</h2>
            <div className="field">
              <label>CALL OUT</label>
              <select value={opp} onChange={e => setOpp(e.target.value)}>
                <option>@leo_ollies (Berlin)</option>
                <option>@ren_switch (Tokyo)</option>
                <option>@fifi_flips (São Paulo)</option>
                <option>@dtown_dana (LA)</option>
              </select>
            </div>
            <div className="field">
              <label>YOUR TRICK</label>
              <input type="text" value={trick} onChange={e => setTrick(e.target.value)} placeholder="e.g. Frontside heelflip" />
            </div>
            <div className="field">
              <label>SPOT</label>
              <input type="text" value={spot} onChange={e => setSpot(e.target.value)} placeholder="e.g. Locals Only skatepark" />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>CANCEL</button>
              <button className="btn-submit" onClick={createGame}>POST CALLOUT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}