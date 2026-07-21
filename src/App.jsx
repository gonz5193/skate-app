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
  const [mode, setMode] = useState('login')
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
        email, password, options: { data: { username } }
      })
      if (error) setError(error.message)
      else onAuthed(data.user)
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else onAuthed(data.user)
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
  const [allPlayers, setAllPlayers] = useState([])
  const [friendships, setFriendships] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedOpponent, setSelectedOpponent] = useState('')
  const [trick, setTrick] = useState('')
  const [spot, setSpot] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [uploading, setUploading] = useState(false)

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
    if (session) {
      fetchGames()
      fetchAllPlayers()
      fetchFriendships()
    }
  }, [session])

  async function fetchAllPlayers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .neq('id', session.user.id)

    if (error) console.error('Error fetching players:', error)
    else setAllPlayers(data)
  }

  async function fetchFriendships() {
    const { data, error } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)

    if (error) console.error('Error fetching friendships:', error)
    else setFriendships(data)
  }

  async function fetchGames() {
    setLoading(true)
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) console.error('Error fetching games:', error)
    else setFeed(data)
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
    if (landed || game.finished) return
    const newLetters = Math.min(5, game.self_letters + 1)
    const isFinished = newLetters >= 5
    const winnerId = isFinished ? game.opponent_id : null
    const updates = { self_letters: newLetters, finished: isFinished, winner_id: winnerId }
    setFeed(feed.map(p => p.id === game.id ? { ...p, ...updates } : p))
    const { error } = await supabase.from('games').update(updates).eq('id', game.id)
    if (error) console.error('Error updating letters:', error)
  }

  async function sendFriendRequest(targetId) {
    const { data, error } = await supabase
      .from('friendships')
      .insert([{ requester_id: session.user.id, addressee_id: targetId, status: 'pending' }])
      .select()

    if (error) console.error('Error sending friend request:', error)
    else setFriendships([...friendships, data[0]])
  }

  async function respondToRequest(friendshipId, accept) {
    if (accept) {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
      if (error) { console.error('Error accepting request:', error); return }
      setFriendships(friendships.map(f => f.id === friendshipId ? { ...f, status: 'accepted' } : f))
    } else {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (error) { console.error('Error declining request:', error); return }
      setFriendships(friendships.filter(f => f.id !== friendshipId))
    }
  }

  async function createGame() {
    const opponentProfile = allPlayers.find(p => p.id === selectedOpponent)
    if (!opponentProfile) return

    setUploading(true)
    let videoUrl = null

    if (videoFile) {
      const fileExt = videoFile.name.split('.').pop()
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('trick-clips').upload(fileName, videoFile)
      if (uploadError) {
        console.error('Error uploading video:', uploadError)
        setUploading(false)
        return
      }
      const { data: urlData } = supabase.storage.from('trick-clips').getPublicUrl(fileName)
      videoUrl = urlData.publicUrl
    }

    const { data, error } = await supabase
      .from('games')
      .insert([{
        challenger_id: session.user.id,
        challenger_name: displayName,
        opponent_id: opponentProfile.id,
        opponent_name: opponentProfile.username,
        spot: spot || 'Local spot',
        trick: (trick || 'Kickflip').toUpperCase(),
        self_letters: 0,
        opp_letters: 0,
        likes: 0,
        video_url: videoUrl,
        finished: false
      }])
      .select()

    setUploading(false)

    if (error) { console.error('Error creating game:', error); return }

    setFeed([data[0], ...feed])
    setTrick('')
    setSpot('')
    setVideoFile(null)
    setModalOpen(false)
    setScreen('feed')
  }

  if (authLoading) return <div className="app" style={{ minHeight: '100vh' }} />
  if (!session) return <AuthScreen onAuthed={() => {}} />

  const myId = session.user.id
  const displayName = session.user.user_metadata?.username || session.user.email.split('@')[0]
  const myGames = feed.filter(g => g.challenger_id === myId || g.opponent_id === myId)

  const finishedGames = myGames.filter(g => g.finished)
  const wins = finishedGames.filter(g => g.winner_id === myId).length
  const losses = finishedGames.filter(g => g.winner_id && g.winner_id !== myId).length
  const sortedFinished = [...finishedGames].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  let streak = 0
  for (const g of sortedFinished) {
    if (g.winner_id === myId) streak++
    else break
  }

  // Friends = accepted friendships involving me
  const acceptedFriendships = friendships.filter(f => f.status === 'accepted')
  const friendIds = acceptedFriendships.map(f => f.requester_id === myId ? f.addressee_id : f.requester_id)
  const friends = allPlayers.filter(p => friendIds.includes(p.id))

  // Incoming = pending requests sent TO me
  const incomingRequests = friendships.filter(f => f.status === 'pending' && f.addressee_id === myId)
  // Outgoing = pending requests I sent, still waiting
  const outgoingRequestIds = friendships.filter(f => f.status === 'pending' && f.requester_id === myId).map(f => f.addressee_id)

  // People not yet friends and no pending request either way
  const nonFriends = allPlayers.filter(p =>
    !friendIds.includes(p.id) &&
    !outgoingRequestIds.includes(p.id) &&
    !incomingRequests.some(r => r.requester_id === p.id)
  )

  useEffect_setDefaultOpponent()
  function useEffect_setDefaultOpponent() {
    if (!selectedOpponent && friends.length > 0) setSelectedOpponent(friends[0].id)
  }

  const pendingGamesCount = myGames.filter(g => !g.finished).length

  return (
    <div className="app">
      <div className="topbar">
        <div className="wordmark"><span>SKATE</span><span>.</span></div>
        <div className="streak-pill">🔥 {streak} game streak</div>
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
                <div className="avatar" style={{ background: colorFor(p.opponent_name || 'x'), color: '#fff' }}>{initials(p.opponent_name || '??')}</div>
                <div className="who">
                  <div className="name">{p.opponent_name}</div>
                  <div className="spot">{p.spot}</div>
                </div>
                <div className="time">{timeAgo(p.created_at)}</div>
              </div>
              {p.video_url ? (
                <video controls className="clip" style={{ width: '100%', background: '#000' }} src={p.video_url} />
              ) : (
                <div className="clip" style={{ background: `linear-gradient(160deg, ${colorFor(p.opponent_name || 'x')}, #0e0e0e 85%)` }}>
                  <div className="play-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                  </div>
                  <div className="trick-tag">{p.trick}</div>
                </div>
              )}
              {p.finished && (
                <div style={{ padding: '8px 14px', background: 'var(--panel-raised)', fontFamily: "'Anton',sans-serif", fontSize: 12, color: 'var(--wheel)' }}>
                  GAME OVER
                </div>
              )}
              <div className="vs-row">
                <div className="vs-side">
                  <div className="vs-name">{(p.challenger_name || 'CHALLENGER').toUpperCase()}</div>
                  <LetterTrack count={p.self_letters} />
                </div>
                <div className="vs-mid">VS</div>
                <div className="vs-side" style={{ alignItems: 'flex-end' }}>
                  <div className="vs-name">{(p.opponent_name || '').toUpperCase()}</div>
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
          {myGames.filter(g => !g.finished).length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No games yet. Call someone out above.</div>
          )}
          {myGames.filter(g => !g.finished).map((g) => (
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

      {screen === 'friends' && (
        <div className="screen">
          {incomingRequests.length > 0 && (
            <>
              <div className="section-head">FRIEND REQUESTS</div>
              {incomingRequests.map(r => {
                const requesterProfile = allPlayers.find(p => p.id === r.requester_id)
                return (
                  <div className="game-card" key={r.id}>
                    <div className="top-row">
                      <div className="opp-name">{requesterProfile?.username || 'Unknown'}</div>
                    </div>
                    <div className="game-buttons">
                      <button className="btn btn-land" onClick={() => respondToRequest(r.id, true)}>ACCEPT</button>
                      <button className="btn btn-miss" onClick={() => respondToRequest(r.id, false)}>DECLINE</button>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          <div className="section-head">YOUR FRIENDS</div>
          {friends.length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13, marginBottom: 20 }}>No friends yet. Add some below.</div>
          )}
          {friends.map(f => (
            <div className="feed-card-head" key={f.id} style={{ padding: '10px 4px' }}>
              <div className="avatar" style={{ background: colorFor(f.username), color: '#fff' }}>{initials(f.username)}</div>
              <div className="who"><div className="name">{f.username}</div></div>
            </div>
          ))}

          <div className="section-head" style={{ marginTop: 24 }}>ADD FRIENDS</div>
          {nonFriends.length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No one new to add right now.</div>
          )}
          {nonFriends.map(p => (
            <div className="feed-card-head" key={p.id} style={{ padding: '10px 4px' }}>
              <div className="avatar" style={{ background: colorFor(p.username), color: '#fff' }}>{initials(p.username)}</div>
              <div className="who"><div className="name">{p.username}</div></div>
              <button className="action-btn" style={{ background: 'var(--wheel)', color: '#1a1200', padding: '6px 12px', borderRadius: 6, fontFamily: "'Anton',sans-serif" }} onClick={() => sendFriendRequest(p.id)}>
                ADD
              </button>
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
              <div className="stat win"><div className="num">{wins}</div><div className="lbl">WINS</div></div>
              <div className="stat loss"><div className="num">{losses}</div><div className="lbl">LOSSES</div></div>
              <div className="stat"><div className="num">{streak}</div><div className="lbl">STREAK</div></div>
            </div>
          </div>
          <div className="section-head">RECENT GAMES</div>
          {myGames.slice(0, 5).map((p) => (
            <div className="game-card" key={p.id}>
              <div className="top-row">
                <div className="opp-name">
                  vs {p.opponent_name}
                  {p.finished && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: p.winner_id === myId ? 'var(--ok)' : 'var(--tag)' }}>
                      {p.winner_id === myId ? 'WON' : 'LOST'}
                    </span>
                  )}
                </div>
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
        <button className={`navbtn ${screen === 'play' ? 'active' : ''}`} onClick={() => setScreen('play')} style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          PLAY
          {pendingGamesCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: '20%',
              background: 'var(--tag)', color: '#fff',
              fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
              borderRadius: '50%', width: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {pendingGamesCount}
            </span>
          )}
        </button>
        <button className={`navbtn ${screen === 'friends' ? 'active' : ''}`} onClick={() => setScreen('friends')} style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          FRIENDS
          {incomingRequests.length > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: '15%',
              background: 'var(--tag)', color: '#fff',
              fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700,
              borderRadius: '50%', width: 16, height: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {incomingRequests.length}
            </span>
          )}
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
              {friends.length === 0 ? (
                <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>Add friends first before calling someone out.</div>
              ) : (
                <select value={selectedOpponent} onChange={e => setSelectedOpponent(e.target.value)}>
                  {friends.map(p => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="field">
              <label>YOUR TRICK</label>
              <input type="text" value={trick} onChange={e => setTrick(e.target.value)} placeholder="e.g. Frontside heelflip" />
            </div>
            <div className="field">
              <label>SPOT</label>
              <input type="text" value={spot} onChange={e => setSpot(e.target.value)} placeholder="e.g. Locals Only skatepark" />
            </div>
            <div className="field">
              <label>VIDEO CLIP</label>
              <input type="file" accept="video/*" onChange={e => setVideoFile(e.target.files[0])} />
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>CANCEL</button>
              <button className="btn-submit" onClick={createGame} disabled={friends.length === 0 || uploading}>
                {uploading ? 'UPLOADING…' : 'POST CALLOUT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}