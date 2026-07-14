import { useState } from 'react'
import './App.css'

const colors = ['#5a3d2b','#2b3d5a','#3d5a2b','#5a2b4d','#2b5a52','#5a4a2b']

const initialFeed = [
  {name:'Leo Ollies', spot:'Mauerpark, Berlin', trick:'BACKSIDE 360 FLIP', opp:'You', selfLetters:2, oppLetters:1, likes:84, comments:12, time:'2h', color:colors[0], likedByMe:false},
  {name:'Ren Suzuki', spot:'Miyashita Park, Tokyo', trick:'SWITCH TRE FLIP', opp:'Dana K.', selfLetters:0, oppLetters:3, likes:212, comments:31, time:'4h', color:colors[1], likedByMe:false},
  {name:'Fifi Rocha', spot:'Parque Ibirapuera, SP', trick:'HALF-CAB HEELFLIP', opp:'You', selfLetters:1, oppLetters:1, likes:56, comments:8, time:'7h', color:colors[2], likedByMe:false},
  {name:'Dana K.', spot:'Downtown LA Courthouse', trick:'FRONTSIDE BLUNT', opp:'Ren S.', selfLetters:4, oppLetters:2, likes:301, comments:44, time:'11h', color:colors[3], likedByMe:false},
]

const initialGames = [
  {name:'Leo Ollies', spot:'Mauerpark, Berlin', trick:'Backside 360 flip', selfLetters:2},
  {name:'Fifi Rocha', spot:'Parque Ibirapuera, SP', trick:'Half-cab heelflip', selfLetters:1},
]

function initials(name){ return name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }

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

export default function App() {
  const [screen, setScreen] = useState('feed')
  const [feed, setFeed] = useState(initialFeed)
  const [games, setGames] = useState(initialGames)
  const [modalOpen, setModalOpen] = useState(false)
  const [opp, setOpp] = useState('@leo_ollies (Berlin)')
  const [trick, setTrick] = useState('')
  const [spot, setSpot] = useState('')

  function toggleLike(i) {
    setFeed(feed.map((p, idx) => idx === i
      ? { ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) }
      : p
    ))
  }

  function resolveAttempt(i, landed) {
    if (!landed) {
      setGames(games.map((g, idx) => idx === i
        ? { ...g, selfLetters: Math.min(5, g.selfLetters + 1) }
        : g
      ))
    }
  }

  function createGame() {
    const name = opp.split(' (')[0].replace('@','').replace(/_/g,' ')
    const location = opp.split('(')[1].replace(')','')
    setFeed([{
      name: name.charAt(0).toUpperCase() + name.slice(1),
      spot: (spot || 'Local spot') + ', ' + location,
      trick: (trick || 'Kickflip').toUpperCase(),
      opp: 'You',
      selfLetters: 0,
      oppLetters: 0,
      likes: 0,
      comments: 0,
      time: 'now',
      color: colors[Math.floor(Math.random() * colors.length)],
      likedByMe: false
    }, ...feed])
    setTrick('')
    setSpot('')
    setModalOpen(false)
    setScreen('feed')
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="wordmark"><span>SKATE</span><span>.</span></div>
        <div className="streak-pill">🔥 6 game streak</div>
      </div>

      {screen === 'feed' && (
        <div className="screen">
          <div className="section-head">WORLDWIDE FEED</div>
          {feed.map((p, i) => (
            <div className="feed-card" key={i}>
              <div className="feed-card-head">
                <div className="avatar" style={{ background: p.color, color: '#fff' }}>{initials(p.name)}</div>
                <div className="who">
                  <div className="name">{p.name}</div>
                  <div className="spot">{p.spot}</div>
                </div>
                <div className="time">{p.time}</div>
              </div>
              <div className="clip" style={{ background: `linear-gradient(160deg, ${p.color}, #0e0e0e 85%)` }}>
                <div className="play-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                </div>
                <div className="trick-tag">{p.trick}</div>
              </div>
              <div className="vs-row">
                <div className="vs-side">
                  <div className="vs-name">{p.name.split(' ')[0].toUpperCase()}</div>
                  <LetterTrack count={p.selfLetters} />
                </div>
                <div className="vs-mid">VS</div>
                <div className="vs-side" style={{ alignItems: 'flex-end' }}>
                  <div className="vs-name">{p.opp.toUpperCase()}</div>
                  <LetterTrack count={p.oppLetters} />
                </div>
              </div>
              <div className="feed-actions">
                <button className={`action-btn ${p.likedByMe ? 'liked' : ''}`} onClick={() => toggleLike(i)}>
                  <svg viewBox="0 0 24 24" fill={p.likedByMe ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
                  {p.likes}
                </button>
                <button className="action-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.5A8.7 8.7 0 0 1 4 11.5 8.7 8.7 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"/></svg>
                  {p.comments}
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
          {games.length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13, padding: '20px 0' }}>
              No games waiting on you right now. Call someone out.
            </div>
          )}
          {games.map((g, i) => (
            <div className="game-card" key={i}>
              <div className="top-row">
                <div className="opp-name">{g.name}</div>
                <LetterTrack count={g.selfLetters} />
              </div>
              <div className="set-trick">TRICK SET: {g.trick.toUpperCase()} — {g.spot}</div>
              <div className="game-buttons">
                <button className="btn btn-land" onClick={() => resolveAttempt(i, true)}>LANDED IT</button>
                <button className="btn btn-miss" onClick={() => resolveAttempt(i, false)}>MISSED</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {screen === 'profile' && (
        <div className="screen">
          <div className="profile-head">
            <div className="avatar" style={{ background: 'var(--wheel)' }}>MJ</div>
            <div className="name">MAYA JIMENEZ</div>
            <div className="handle">@mayaslides · Houston, TX</div>
            <div className="stat-row">
              <div className="stat win"><div className="num">41</div><div className="lbl">WINS</div></div>
              <div className="stat loss"><div className="num">17</div><div className="lbl">LOSSES</div></div>
              <div className="stat"><div className="num">6</div><div className="lbl">STREAK</div></div>
            </div>
          </div>
          <div className="section-head">RECENT GAMES</div>
          {feed.slice(0, 3).map((p, i) => (
            <div className="game-card" key={i}>
              <div className="top-row">
                <div className="opp-name">vs {p.name}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--bone-dim)' }}>{p.time} ago</div>
              </div>
              <div className="vs-row" style={{ padding: 0, border: 'none' }}>
                <div className="vs-side"><div className="vs-name">YOU</div><LetterTrack count={p.selfLetters} /></div>
                <div className="vs-mid">VS</div>
                <div className="vs-side" style={{ alignItems: 'flex-end' }}>
                  <div className="vs-name">{p.name.split(' ')[0].toUpperCase()}</div>
                  <LetterTrack count={p.oppLetters} />
                </div>
              </div>
            </div>
          ))}
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