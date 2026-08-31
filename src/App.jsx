import { useState, useEffect, useRef } from 'react'
import './App.css'
import { supabase } from './supabaseClient'

const colors = ['#5a3d2b','#2b3d5a','#3d5a2b','#5a2b4d','#2b5a52','#5a4a2b']

function initials(name){ return (name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() }
function colorFor(name){
  const sum = (name||'x').split('').reduce((a,c) => a + c.charCodeAt(0), 0)
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
      {word.map((l,i) => <div key={i} className={`skate-letter ${i < count ? 'filled' : ''}`}>{l}</div>)}
    </div>
  )
}

function CameraRecorder({ onCapture, seconds = 12 }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const [status, setStatus] = useState('loading')
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(seconds)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')

  useEffect(() => {
    let cancelled = false
    async function setup() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        setStatus('ready')
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.muted = true
            videoRef.current.playsInline = true
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(err => console.error('Preview play error:', err.name, err.message))
          }
        }, 100)
      } catch (err) {
        console.error('Camera error:', err)
        setStatus('error')
      }
    }
    setup()
    return () => {
      cancelled = true
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [facingMode])

    useEffect(() => {
    function warnBeforeLeaving(e) {
      if (status === 'countdown' || status === 'recording') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [status])

  function beginCountdown() {
    setStatus('countdown')
    setCountdown(3)
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(tick); startRecording(); return 0 }
        return c - 1
      })
    }, 1000)
  }

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : ''
    const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current)
    const actualType = recorder.mimeType || 'video/webm'
    const ext = actualType.includes('mp4') ? 'mp4' : 'webm'
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: actualType })
      const file = new File([blob], `clip-${Date.now()}.${ext}`, { type: actualType })
      setPreviewUrl(URL.createObjectURL(blob))
      setStatus('done')
      onCapture(file)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
    recorderRef.current = recorder
    recorder.start()
    setStatus('recording')
    setTimeLeft(seconds)
    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(interval); recorder.stop(); return 0 }
        return t - 1
      })
    }, 1000)
  }

  if (status === 'error') {
    return <div style={{ color: 'var(--tag)', fontSize: 14, padding: 20 }}>Couldn't access your camera. Check permissions and try again.</div>
  }
  if (status === 'loading') {
    return <div style={{ color: 'var(--bone-dim)', fontSize: 14, padding: 20 }}>Requesting camera access…</div>
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        {status !== 'done' ? (
          <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <video src={previewUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        {status === 'ready' && (
          <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} style={{
            position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: '50%', width: 44, height: 44, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          </button>
        )}
        {status === 'countdown' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wheel)', fontFamily: "'Anton',sans-serif", fontSize: 100 }}>{countdown}</div>
        )}
        {status === 'recording' && (
          <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.6)', padding: '8px 14px', borderRadius: 20, color: 'var(--tag)', fontFamily: "'Anton',sans-serif", fontSize: 16 }}>
            ● REC {timeLeft}s
          </div>
        )}
      </div>
      <div style={{ padding: 18, background: 'var(--panel-raised)' }}>
        {status === 'ready' && (
          <button className="btn-submit" style={{ width: '100%' }} onClick={beginCountdown}>● START RECORDING ({seconds}s, no retakes)</button>
        )}
        {status === 'countdown' && <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 13 }}>Get ready…</div>}
        {status === 'recording' && <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 13 }}>Recording — no way to stop early</div>}
        {status === 'done' && <div style={{ textAlign: 'center', color: 'var(--ok)', fontSize: 13 }}>Clip captured! Tap continue below.</div>}
      </div>
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
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit() {
    setError(''); setLoading(true)
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } })
      if (error) setError(error.message); else onAuthed(data.user)
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message); else onAuthed(data.user)
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(error.message); else setResetSent(true)
    setLoading(false)
  }

  if (mode === 'forgot') {
    return (
      <div className="app">
        <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 16 }}>
          <div className="wordmark" style={{ justifyContent: 'center', fontSize: 40, marginBottom: 8 }}><span>SKATE</span><span>.</span></div>
          <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 13, marginBottom: 32 }}>
            Reset your password
          </div>
          {resetSent ? (
            <div style={{ textAlign: 'center', color: 'var(--ok)', fontSize: 13, marginBottom: 20 }}>
              Check your email for a password reset link.
            </div>
          ) : (
            <>
              <div className="field"><label>EMAIL</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              {error && <div style={{ color: 'var(--tag)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <button className="btn-submit" style={{ width: '100%', marginTop: 8 }} onClick={handleForgotPassword} disabled={loading}>
                {loading ? 'SENDING…' : 'SEND RESET LINK'}
              </button>
            </>
          )}
          <button className="action-btn" style={{ justifyContent: 'center', marginTop: 20 }}
            onClick={() => { setMode('login'); setError(''); setResetSent(false) }}>
            Back to log in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 16 }}>
        <div className="wordmark" style={{ justifyContent: 'center', fontSize: 40, marginBottom: 8 }}><span>SKATE</span><span>.</span></div>
        <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 13, marginBottom: 32 }}>
          {mode === 'login' ? 'Log in to call someone out' : 'Create your account'}
        </div>
        {mode === 'signup' && (
          <div className="field"><label>USERNAME</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. mayaslides" />
          </div>
        )}
        <div className="field"><label>EMAIL</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" />
        </div>
        <div className="field"><label>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>
        {mode === 'login' && (
          <button className="action-btn" style={{ justifyContent: 'flex-end', marginBottom: 8 }} onClick={() => { setMode('forgot'); setError('') }}>
            Forgot password?
          </button>
        )}
        {error && <div style={{ color: 'var(--tag)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn-submit" style={{ width: '100%', marginTop: 8 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'PLEASE WAIT…' : mode === 'login' ? 'LOG IN' : 'SIGN UP'}
        </button>
        <button className="action-btn" style={{ justifyContent: 'center', marginTop: 20 }}
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}>
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
        {mode === 'signup' && (
          <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 11, marginTop: 16 }}>
            By signing up, you agree to our <a href="/terms-of-service.html" target="_blank" style={{ color: 'var(--wheel)' }}>Terms</a> and <a href="/privacy-policy.html" target="_blank" style={{ color: 'var(--wheel)' }}>Privacy Policy</a>.
          </div>
        )}
      </div>
    </div>
  )
}

function ResetPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    onDone()
  }

  return (
    <div className="app">
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: 16 }}>
        <div className="wordmark" style={{ justifyContent: 'center', fontSize: 40, marginBottom: 8 }}><span>SKATE</span><span>.</span></div>
        <div style={{ textAlign: 'center', color: 'var(--bone-dim)', fontSize: 13, marginBottom: 32 }}>
          Set a new password
        </div>
        <div className="field"><label>NEW PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </div>
        <div className="field"><label>CONFIRM PASSWORD</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
        </div>
        {error && <div style={{ color: 'var(--tag)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn-submit" style={{ width: '100%', marginTop: 8 }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'SAVING…' : 'SAVE NEW PASSWORD'}
        </button>
      </div>
    </div>
  )
}

function CallOutFlow({ friends, uploading, onCancel, onSubmit }) {
  const [step, setStep] = useState('details')
  const [selectedOpponent, setSelectedOpponent] = useState(friends[0]?.id || '')
  const [trick, setTrick] = useState('')
  const [spot, setSpot] = useState('')
  const [file, setFile] = useState(null)

  if (step === 'camera') {
    return (
      <>
        <CameraRecorder onCapture={setFile} />
        {file && (
          <div style={{ position: 'fixed', bottom: 100, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 101, padding: '0 18px' }}>
            <button className="btn-submit" style={{ width: '100%', maxWidth: 430 }} disabled={uploading}
              onClick={() => onSubmit({ opponentId: selectedOpponent, trick, spot, file })}>
              {uploading ? 'UPLOADING…' : 'POST CALLOUT'}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>SET THE TRICK</h2>
        <div className="field">
          <label>CALL OUT</label>
          {friends.length === 0 ? <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>Add friends first before calling someone out.</div> : (
            <select value={selectedOpponent} onChange={e => setSelectedOpponent(e.target.value)}>
              {friends.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
            </select>
          )}
        </div>
        <div className="field"><label>YOUR TRICK</label>
          <input type="text" value={trick} onChange={e => setTrick(e.target.value)} placeholder="e.g. Frontside heelflip" />
        </div>
        <div className="field"><label>SPOT</label>
          <input type="text" value={spot} onChange={e => setSpot(e.target.value)} placeholder="e.g. Locals Only skatepark" />
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>CANCEL</button>
          <button className="btn-submit" disabled={friends.length === 0} onClick={() => setStep('camera')}>CONTINUE TO CAMERA</button>
        </div>
      </div>
    </div>
  )
}

function ClipFlow({ game, uploading, onCancel, onSubmit }) {
  const [step, setStep] = useState('details')
  const [landed, setLanded] = useState(null)
  const [file, setFile] = useState(null)

  if (step === 'camera') {
    return (
      <>
        <CameraRecorder onCapture={setFile} />
        {file && (
          <div style={{ position: 'fixed', bottom: 100, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 101, padding: '0 18px' }}>
            <button className="btn-submit" style={{ width: '100%', maxWidth: 430 }} disabled={uploading}
              onClick={() => onSubmit(landed, file)}>
              {uploading ? 'UPLOADING…' : 'POST CLIP'}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>YOUR ATTEMPT</h2>
        <div style={{ color: 'var(--bone-dim)', fontSize: 13, marginBottom: 16 }}>
          Trick: <strong style={{ color: 'var(--wheel)' }}>{game.trick}</strong> — {game.spot}
        </div>
        <div className="field">
          <label>DID YOU LAND IT?</label>
          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button className={landed === true ? 'btn-submit' : 'btn-cancel'} style={{ flex: 1 }} onClick={() => setLanded(true)}>LANDED IT</button>
            <button className={landed === false ? 'btn-submit' : 'btn-cancel'} style={{ flex: 1 }} onClick={() => setLanded(false)}>MISSED</button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>CANCEL</button>
          <button className="btn-submit" disabled={landed === null} onClick={() => setStep('camera')}>CONTINUE TO CAMERA</button>
        </div>
      </div>
    </div>
  )
}

function ClipThread({ game, clips, myId, redoVote, myBallot, comments, onClose, onFlag, onVote, onResolve, onPostComment, onReportContent, onBlockUser }) {
  const [draft, setDraft] = useState('')
  const [timeLeft, setTimeLeft] = useState(null)
  const [reportingClipId, setReportingClipId] = useState(null)
  const [reportingCommentId, setReportingCommentId] = useState(null)
  const [reportText, setReportText] = useState('')
  const [reportedIds, setReportedIds] = useState([])

  useEffect(() => {
    if (!redoVote) { setTimeLeft(null); return }
    function tick() {
      const remaining = Math.max(0, Math.round((new Date(redoVote.closes_at).getTime() - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) onResolve(redoVote, game)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [redoVote])

  const latestClip = clips[clips.length - 1]
  const posterIsChallenger = latestClip && latestClip.player_id === game.challenger_id
  const redosUsed = posterIsChallenger ? (game.self_redos_used || 0) : (game.opp_redos_used || 0)
  const isParticipant = myId === game.challenger_id || myId === game.opponent_id
  const canFlag = latestClip && redosUsed < 2 && !redoVote && isParticipant && latestClip.player_id !== myId
  const canVote = redoVote && !isParticipant && !myBallot

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2>{game.trick} — {game.spot}</h2>

        {redoVote && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--tag)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontFamily: "'Anton',sans-serif", color: 'var(--tag)', fontSize: 14, marginBottom: 6 }}>
              ⚠ REDO VOTE IN PROGRESS — {timeLeft}s left
            </div>
            {isParticipant ? (
              <div style={{ fontSize: 12, color: 'var(--bone-dim)' }}>Viewers are deciding whether this clip needs a redo. If nobody votes, it defaults to a redo.</div>
            ) : canVote ? (
              <>
                <div style={{ fontSize: 12, color: 'var(--bone-dim)', marginBottom: 10 }}>Should this clip be redone?</div>
                <div className="modal-actions">
                  <button className="btn-land" style={{ flex: 1 }} onClick={() => onVote(redoVote.id, 'no_redo')}>KEEP IT</button>
                  <button className="btn-miss" style={{ flex: 1 }} onClick={() => onVote(redoVote.id, 'redo')}>REDO</button>
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--ok)', fontSize: 13 }}>You voted: {myBallot === 'redo' ? 'REDO' : 'KEEP IT'}</div>
            )}
          </div>
        )}

        {clips.length === 0 && <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No clips yet.</div>}
        {clips.map((c, i) => (
          <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--grip)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong>{c.player_name}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: c.landed ? 'var(--ok)' : 'var(--tag)', fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                  {c.landed ? 'LANDED' : 'MISSED'}
                </span>
                {c.player_id !== myId && (
                  <>
                    <button style={{ background: 'none', border: 'none', color: 'var(--bone-dim)', fontSize: 11, cursor: 'pointer' }}
                      onClick={() => setReportingClipId(reportingClipId === c.id ? null : c.id)}>
                      REPORT
                    </button>
                    <button style={{ background: 'none', border: 'none', color: 'var(--bone-dim)', fontSize: 11, cursor: 'pointer' }}
                      onClick={() => { if (window.confirm(`Block ${c.player_name}? This removes them as a friend and hides their content from your feed.`)) onBlockUser(c.player_id) }}>
                      BLOCK
                    </button>
                  </>
                )}
              </div>
            </div>
            {reportingClipId === c.id && (
              <div style={{ marginBottom: 10 }}>
                {reportedIds.includes(c.id) ? (
                  <div style={{ color: 'var(--ok)', fontSize: 12 }}>Reported. Thanks for flagging this.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" style={{ flex: 1 }} placeholder="Why are you reporting this clip?"
                      value={reportText} onChange={e => setReportText(e.target.value)} />
                    <button className="btn-land" onClick={() => {
                      onReportContent('clip', c.id, c.player_id, reportText)
                      setReportedIds(prev => [...prev, c.id]); setReportText(''); setReportingClipId(null)
                    }}>SEND</button>
                  </div>
                )}
              </div>
            )}
            {c.is_redo && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(90,61,43,0.4)', border: '1px solid var(--wheel)', borderRadius: 6, fontFamily: "'Anton',sans-serif", fontSize: 12, color: 'var(--wheel)' }}>
                🔁 THIS IS A REDO ATTEMPT
              </div>
            )}
            {c.video_url && <video controls style={{ width: '100%', borderRadius: 8 }} src={c.video_url} />}
            <div style={{ fontSize: 11, color: 'var(--bone-dim)', marginTop: 6 }}>{timeAgo(c.created_at)} ago</div>
            {c.flag_status === 'redone' && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(90,45,77,0.4)', border: '1px solid var(--tag)', borderRadius: 6, fontFamily: "'Anton',sans-serif", fontSize: 12, color: 'var(--tag)' }}>
                ⚠ REDO
              </div>
            )}
            {c.flag_status === 'kept' && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(43,90,82,0.4)', border: '1px solid var(--ok)', borderRadius: 6, fontFamily: "'Anton',sans-serif", fontSize: 12, color: 'var(--ok)' }}>
                ✅ KEPT — community voted to keep this clip
              </div>
            )}
            {i === clips.length - 1 && canFlag && (
              <button className="btn-cancel" style={{ width: '100%', marginTop: 10 }} onClick={() => onFlag(game, c)}>
                🚩 FLAG FOR REDO VOTE ({2 - redosUsed} left)
              </button>
            )}
          </div>
        ))}

        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Anton',sans-serif", fontSize: 13, color: 'var(--bone-dim)', marginBottom: 10 }}>
            COMMENTS
          </div>
          {comments.length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13, marginBottom: 10 }}>No comments yet.</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ fontSize: 13 }}>{c.user_name}</strong>
                <span style={{ fontSize: 11, color: 'var(--bone-dim)' }}>{timeAgo(c.created_at)}</span>
                {c.user_id !== myId && (
                  <button style={{ background: 'none', border: 'none', color: 'var(--bone-dim)', fontSize: 10, cursor: 'pointer', marginLeft: 'auto' }}
                    onClick={() => setReportingCommentId(reportingCommentId === c.id ? null : c.id)}>
                    REPORT
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13 }}>{c.text}</div>
              {reportingCommentId === c.id && (
                reportedIds.includes(c.id) ? (
                  <div style={{ color: 'var(--ok)', fontSize: 12, marginTop: 4 }}>Reported. Thanks for flagging this.</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <input type="text" style={{ flex: 1 }} placeholder="Why are you reporting this comment?"
                      value={reportText} onChange={e => setReportText(e.target.value)} />
                    <button className="btn-land" onClick={() => {
                      onReportContent('comment', c.id, c.user_id, reportText)
                      setReportedIds(prev => [...prev, c.id]); setReportText(''); setReportingCommentId(null)
                    }}>SEND</button>
                  </div>
                )
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="text"
              style={{ flex: 1 }}
              placeholder="Add a comment…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && draft.trim()) { onPostComment(draft.trim()); setDraft('') }
              }}
            />
            <button
              className="btn-land"
              onClick={() => { if (draft.trim()) { onPostComment(draft.trim()); setDraft('') } }}
            >
              POST
            </button>
          </div>
        </div>

        <button className="btn-cancel" style={{ width: '100%' }} onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [screen, setScreen] = useState('feed')
  const [friendSearch, setFriendSearch] = useState('')
  const [feed, setFeed] = useState([])
  const [clipsByGame, setClipsByGame] = useState({})
  const [allPlayers, setAllPlayers] = useState([])
  const [friendships, setFriendships] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [respondingTo, setRespondingTo] = useState(null)
  const [viewingThread, setViewingThread] = useState(null)
  const [commentsByGame, setCommentsByGame] = useState({})
  const [redoVotes, setRedoVotes] = useState({})
  const [myBallots, setMyBallots] = useState({})
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [blockedIds, setBlockedIds] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setAuthLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (_e === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) { fetchGames(); fetchAllPlayers(); fetchFriendships(); fetchBlocks() }
  }, [session])

  async function fetchAllPlayers() {
    const { data, error } = await supabase.from('profiles').select('id, username').neq('id', session.user.id)
    if (error) console.error(error); else setAllPlayers(data)
  }

  async function fetchFriendships() {
    const { data, error } = await supabase.from('friendships').select('*')
      .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`)
    if (error) console.error(error); else setFriendships(data)
  }

  async function fetchBlocks() {
    const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', session.user.id)
    if (error) { console.error(error); return }
    setBlockedIds(data.map(b => b.blocked_id))
  }

  async function blockUser(targetId) {
    const { error } = await supabase.from('blocks').insert([{ blocker_id: session.user.id, blocked_id: targetId }])
    if (error) { console.error(error); return }
    await supabase.from('friendships').delete()
      .or(`and(requester_id.eq.${session.user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${session.user.id})`)
    setBlockedIds(prev => [...prev, targetId])
    setFriendships(friendships.filter(f =>
      !((f.requester_id === session.user.id && f.addressee_id === targetId) ||
        (f.requester_id === targetId && f.addressee_id === session.user.id))
    ))
    setViewingThread(null)
  }

  async function unblockUser(targetId) {
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', session.user.id).eq('blocked_id', targetId)
    if (error) { console.error(error); return }
    setBlockedIds(prev => prev.filter(id => id !== targetId))
  }

  async function reportContent(contentType, contentId, reportedUserId, reason) {
    const { error } = await supabase.from('reports').insert([{
      reporter_id: session.user.id, reported_user_id: reportedUserId,
      content_type: contentType, content_id: String(contentId), reason
    }])
    if (error) console.error(error)
  }

  async function fetchGames() {
    setLoading(true)
    const { data, error } = await supabase.from('games').select('*').order('last_activity_at', { ascending: false })
    if (error) { console.error(error); setLoading(false); return }
    setFeed(data)
    await fetchClipsForGames(data.map(g => g.id))
    await fetchCommentsForGames(data.map(g => g.id))
    setLoading(false)
  }

  async function fetchClipsForGames(gameIds) {
    if (gameIds.length === 0) return
    const { data, error } = await supabase.from('game_clips').select('*').in('game_id', gameIds).order('created_at', { ascending: true })
    if (error) { console.error(error); return }
    const grouped = {}
    data.forEach(c => { grouped[c.game_id] = grouped[c.game_id] || []; grouped[c.game_id].push(c) })
    setClipsByGame(grouped)
  }

  async function fetchClipsForOneGame(gameId) {
    const { data, error } = await supabase.from('game_clips').select('*').eq('game_id', gameId).order('created_at', { ascending: true })
    if (error) { console.error(error); return }
    setClipsByGame(prev => ({ ...prev, [gameId]: data }))
  }

  async function fetchCommentsForGames(gameIds) {
    if (gameIds.length === 0) return
    const { data, error } = await supabase.from('comments').select('*').in('game_id', gameIds).order('created_at', { ascending: true })
    if (error) { console.error(error); return }
    const grouped = {}
    data.forEach(c => { grouped[c.game_id] = grouped[c.game_id] || []; grouped[c.game_id].push(c) })
    setCommentsByGame(grouped)
  }

  async function fetchCommentsForOneGame(gameId) {
    const { data, error } = await supabase.from('comments').select('*').eq('game_id', gameId).order('created_at', { ascending: true })
    if (error) { console.error(error); return }
    setCommentsByGame(prev => ({ ...prev, [gameId]: data }))
  }

  async function postComment(game, text) {
    const displayName = session.user.user_metadata?.username || session.user.email.split('@')[0]
    const { data, error } = await supabase.from('comments').insert([{
      game_id: game.id, user_id: session.user.id, user_name: displayName, text
    }]).select()
    if (error) { console.error(error); return }
    setCommentsByGame(prev => ({ ...prev, [game.id]: [...(prev[game.id] || []), data[0]] }))
  }

  async function fetchRedoVotes(gameId) {
    const { data, error } = await supabase
      .from('redo_votes')
      .select('*')
      .eq('game_id', gameId)
      .order('opens_at', { ascending: false })
      .limit(1)
    if (error) { console.error(error); return }
    if (data.length > 0 && !data[0].resolved) {
      setRedoVotes(prev => ({ ...prev, [gameId]: data[0] }))
      const { data: ballots } = await supabase.from('redo_ballots').select('*').eq('vote_id', data[0].id)
      if (ballots) {
        const mine = ballots.find(b => b.voter_id === session.user.id)
        if (mine) setMyBallots(prev => ({ ...prev, [data[0].id]: mine.choice }))
      }
    } else {
      setRedoVotes(prev => { const next = { ...prev }; delete next[gameId]; return next })
    }
  }

  async function flagRedo(game, clip) {
    const isChallengerClip = clip.player_id === game.challenger_id
    const redosUsed = isChallengerClip ? (game.self_redos_used || 0) : (game.opp_redos_used || 0)
    if (redosUsed >= 2) return
    const { data, error } = await supabase.from('redo_votes').insert([{
      game_id: game.id,
      clip_id: clip.id,
      flagged_by: session.user.id,
      target_player_id: clip.player_id,
      opens_at: new Date().toISOString(),
      closes_at: new Date(Date.now() + 60000).toISOString()
    }]).select()
    if (error) { console.error(error); return }
    setRedoVotes(prev => ({ ...prev, [game.id]: data[0] }))
  }

  async function castBallot(voteId, choice) {
    const { error } = await supabase.from('redo_ballots').insert([{ vote_id: voteId, voter_id: session.user.id, choice }])
    if (error) { console.error(error); return }
    setMyBallots(prev => ({ ...prev, [voteId]: choice }))
  }

  async function resolveRedoVote(vote, game) {
    const { data: ballots } = await supabase.from('redo_ballots').select('*').eq('vote_id', vote.id)
    const redoVotesCount = (ballots || []).filter(b => b.choice === 'redo').length
    const noRedoVotesCount = (ballots || []).filter(b => b.choice === 'no_redo').length
    const outcome = (ballots || []).length === 0 ? 'redo' : (redoVotesCount > noRedoVotesCount ? 'redo' : 'no_redo')

    await supabase.from('redo_votes').update({ resolved: true, outcome }).eq('id', vote.id)
    setRedoVotes(prev => { const next = { ...prev }; delete next[game.id]; return next })

    if (outcome === 'redo') {
      const isTargetChallenger = vote.target_player_id === game.challenger_id
      const redosUsed = isTargetChallenger ? (game.self_redos_used || 0) : (game.opp_redos_used || 0)
      if (redosUsed >= 2) return
      const updates = isTargetChallenger
        ? { self_redos_used: redosUsed + 1, whose_turn: vote.target_player_id, awaiting_redo: true, last_activity_at: new Date().toISOString() }
        : { opp_redos_used: redosUsed + 1, whose_turn: vote.target_player_id, awaiting_redo: true, last_activity_at: new Date().toISOString() }
      const { error: gameError } = await supabase.from('games').update(updates).eq('id', game.id)
      if (gameError) { console.error(gameError); return }
      const { error: clipError } = await supabase.from('game_clips').update({ flag_status: 'redone' }).eq('id', vote.clip_id)
      if (clipError) { console.error(clipError); return }
      const updatedFeed = feed.map(g => g.id === game.id ? { ...g, ...updates } : g)
      updatedFeed.sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
      setFeed(updatedFeed)
      setViewingThread(prev => prev && prev.id === game.id ? { ...prev, ...updates } : prev)
      await fetchClipsForOneGame(game.id)
    } else {
      await supabase.from('game_clips').update({ flag_status: 'kept' }).eq('id', vote.clip_id)
      await fetchClipsForOneGame(game.id)
    }
  }

  async function handleLogout() { await supabase.auth.signOut(); setFeed([]) }

  async function toggleLike(game) {
    const newLikes = game.likes + 1
    setFeed(feed.map(p => p.id === game.id ? { ...p, likes: newLikes } : p))
    const { error } = await supabase.from('games').update({ likes: newLikes }).eq('id', game.id)
    if (error) console.error(error)
  }

  async function uploadClip(file) {
    const fileExt = file.name.split('.').pop()
    const fileName = `${session.user.id}-${Date.now()}.${fileExt}`
    const { error } = await supabase.storage.from('trick-clips').upload(fileName, file)
    if (error) { console.error(error); return null }
    const { data } = supabase.storage.from('trick-clips').getPublicUrl(fileName)
    return data.publicUrl
  }

  async function submitClip(landed, file) {
    const game = respondingTo
    setUploading(true)
    const videoUrl = await uploadClip(file)
    if (!videoUrl) { setUploading(false); return }

    const myId = session.user.id
    const isChallenger = game.challenger_id === myId
    const currentLetters = isChallenger ? game.self_letters : game.opp_letters
    const newLetters = landed ? currentLetters : Math.min(5, currentLetters + 1)
    const isFinished = newLetters >= 5
    const winnerId = isFinished ? (isChallenger ? game.opponent_id : game.challenger_id) : null
    const isRedoAttempt = game.awaiting_redo || false

    const updates = isChallenger
      ? { self_letters: newLetters, finished: isFinished, winner_id: winnerId, whose_turn: isFinished ? null : game.opponent_id, awaiting_redo: false, last_activity_at: new Date().toISOString() }
      : { opp_letters: newLetters, finished: isFinished, winner_id: winnerId, whose_turn: isFinished ? null : game.challenger_id, awaiting_redo: false, last_activity_at: new Date().toISOString() }

    const { error: updateError } = await supabase.from('games').update(updates).eq('id', game.id)
    if (updateError) { console.error(updateError); setUploading(false); return }

    const { error: clipError } = await supabase.from('game_clips').insert([{
      game_id: game.id, player_id: myId, player_name: displayName, video_url: videoUrl, landed, is_redo: isRedoAttempt
    }])
    if (clipError) console.error(clipError)

    const updatedFeed = feed.map(g => g.id === game.id ? { ...g, ...updates } : g)
    updatedFeed.sort((a, b) => new Date(b.last_activity_at) - new Date(a.last_activity_at))
    setFeed(updatedFeed)
    await fetchClipsForOneGame(game.id)
    setUploading(false)
    setRespondingTo(null)
  }

  async function createGame({ opponentId, trick, spot, file }) {
    const opponentProfile = allPlayers.find(p => p.id === opponentId)
    if (!opponentProfile || !file) return
    setUploading(true)
    const videoUrl = await uploadClip(file)
    if (!videoUrl) { setUploading(false); return }

    const { data, error } = await supabase.from('games').insert([{
      challenger_id: session.user.id,
      challenger_name: displayName,
      opponent_id: opponentProfile.id,
      opponent_name: opponentProfile.username,
      spot: spot || 'Local spot',
      trick: (trick || 'Kickflip').toUpperCase(),
      self_letters: 0, opp_letters: 0, likes: 0,
      video_url: videoUrl, finished: false,
      whose_turn: opponentProfile.id,
      last_activity_at: new Date().toISOString()
    }]).select()

    if (error) { console.error(error); setUploading(false); return }

    const newGame = data[0]
    const { error: clipError } = await supabase.from('game_clips').insert([{
      game_id: newGame.id, player_id: session.user.id, player_name: displayName, video_url: videoUrl, landed: true
    }])
    if (clipError) console.error(clipError)

    setFeed([newGame, ...feed])
    await fetchClipsForOneGame(newGame.id)
    setUploading(false); setModalOpen(false); setScreen('feed')
  }

  if (authLoading) return <div className="app" style={{ minHeight: '100vh' }} />
  if (passwordRecovery) return <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
  if (!session) return <AuthScreen onAuthed={() => {}} />

  const myId = session.user.id
  const displayName = session.user.user_metadata?.username || session.user.email.split('@')[0]
  const myGames = feed.filter(g => g.challenger_id === myId || g.opponent_id === myId)
  const visibleFeed = feed.filter(g => !blockedIds.includes(g.challenger_id) && !blockedIds.includes(g.opponent_id))
  const activeGames = myGames.filter(g => !g.finished && !blockedIds.includes(g.challenger_id) && !blockedIds.includes(g.opponent_id))
  const pendingCallouts = activeGames.filter(g => g.challenger_id === myId && g.whose_turn === g.opponent_id)
  const finishedGames = myGames.filter(g => g.finished)
  const wins = finishedGames.filter(g => g.winner_id === myId).length
  const losses = finishedGames.filter(g => g.winner_id && g.winner_id !== myId).length
  const sortedFinished = [...finishedGames].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
  let streak = 0
  for (const g of sortedFinished) { if (g.winner_id === myId) streak++; else break }

  const acceptedFriendships = friendships.filter(f => f.status === 'accepted')
  const friendIds = acceptedFriendships.map(f => f.requester_id === myId ? f.addressee_id : f.requester_id)
  const friends = allPlayers.filter(p => friendIds.includes(p.id))
  const incomingRequests = friendships.filter(f => f.status === 'pending' && f.addressee_id === myId)
  const outgoingRequestIds = friendships.filter(f => f.status === 'pending' && f.requester_id === myId).map(f => f.addressee_id)
  const nonFriends = allPlayers.filter(p => !friendIds.includes(p.id) && !outgoingRequestIds.includes(p.id) && !incomingRequests.some(r => r.requester_id === p.id) && !blockedIds.includes(p.id))
  const searchResults = friendSearch.trim() === ''
    ? []
    : nonFriends.filter(p => p.username.toLowerCase().includes(friendSearch.trim().toLowerCase()))

  const pendingGamesCount = activeGames.filter(g => g.whose_turn === myId).length

  async function sendFriendRequest(targetId) {
    const existing = friendships.find(f =>
      (f.requester_id === myId && f.addressee_id === targetId) ||
      (f.requester_id === targetId && f.addressee_id === myId)
    )
    if (existing) {
      if (existing.status === 'pending' && existing.requester_id === targetId) {
        await respondToRequest(existing.id, true)
      }
      return
    }
    const { data, error } = await supabase.from('friendships').insert([{ requester_id: myId, addressee_id: targetId, status: 'pending' }]).select()
    if (error) console.error(error); else setFriendships([...friendships, data[0]])
  }
  async function deleteGame(game) {
    if (!window.confirm(`Delete this callout to ${game.opponent_name}? This can't be undone.`)) return
    await supabase.from('game_clips').delete().eq('game_id', game.id)
    await supabase.from('comments').delete().eq('game_id', game.id)
    await supabase.from('redo_votes').delete().eq('game_id', game.id)
    const { error } = await supabase.from('games').delete().eq('id', game.id)
    if (error) { console.error(error); return }
    setFeed(feed.filter(g => g.id !== game.id))
    setClipsByGame(prev => { const next = { ...prev }; delete next[game.id]; return next })
    setCommentsByGame(prev => { const next = { ...prev }; delete next[game.id]; return next })
  }
  async function respondToRequest(friendshipId, accept) {
    if (accept) {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
      if (!error) setFriendships(friendships.map(f => f.id === friendshipId ? { ...f, status: 'accepted' } : f))
    } else {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
      if (!error) setFriendships(friendships.filter(f => f.id !== friendshipId))
    }
  }

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
          {!loading && visibleFeed.length === 0 && <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No games yet. Call someone out.</div>}
          {visibleFeed.map((p) => {
            const clips = clipsByGame[p.id] || []
            const latestClip = clips[clips.length - 1]
            const displayClip = latestClip || { video_url: p.video_url, player_name: p.challenger_name }
            const turnPlayerName = p.whose_turn === p.challenger_id ? p.challenger_name : p.opponent_name
            return (
              <div className="feed-card" key={p.id}>
                <div className="feed-card-head">
                  <div className="avatar" style={{ background: colorFor(displayClip.player_name), color: '#fff' }}>{initials(displayClip.player_name)}</div>
                  <div className="who">
                    <div className="name">{p.finished ? `${displayClip.player_name} posted` : `${turnPlayerName}'s turn`}</div>
                    <div className="spot">{p.spot}</div>
                  </div>
                  <div className="time">{timeAgo(p.created_at)}</div>
                </div>
                {displayClip.video_url ? (
                  <video controls className="clip" style={{ width: '100%', background: '#000' }} src={displayClip.video_url} onClick={() => { setViewingThread(p); fetchClipsForOneGame(p.id); fetchCommentsForOneGame(p.id); fetchRedoVotes(p.id) }} />
                ) : (
                  <div className="clip" style={{ background: `linear-gradient(160deg, ${colorFor(displayClip.player_name)}, #0e0e0e 85%)` }}>
                    <div className="trick-tag">{p.trick}</div>
                  </div>
                )}
                {displayClip.flag_status === 'redone' && (
                  <div style={{ padding: '6px 14px', background: 'var(--panel-raised)', fontSize: 12, color: 'var(--tag)' }}>⚠ REDO</div>
                )}
                {displayClip.flag_status === 'kept' && (
                  <div style={{ padding: '6px 14px', background: 'var(--panel-raised)', fontSize: 12, color: 'var(--ok)' }}>✅ Community voted to keep this clip</div>
                )}
                {displayClip.is_redo && (
                  <div style={{ padding: '6px 14px', background: 'var(--panel-raised)', fontSize: 12, color: 'var(--wheel)' }}>🔁 Redo attempt</div>
                )}
                {p.finished && <div style={{ padding: '8px 14px', background: 'var(--panel-raised)', fontFamily: "'Anton',sans-serif", fontSize: 12, color: 'var(--wheel)' }}>GAME OVER</div>}
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
                  <button className="action-btn" onClick={() => { setViewingThread(p); fetchClipsForOneGame(p.id); fetchCommentsForOneGame(p.id); fetchRedoVotes(p.id) }}>
                    {clips.length} clip{clips.length !== 1 ? 's' : ''} — view thread
                  </button>
                  <button className="action-btn" onClick={() => { setViewingThread(p); fetchClipsForOneGame(p.id); fetchCommentsForOneGame(p.id); fetchRedoVotes(p.id) }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                    {(commentsByGame[p.id] || []).length}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {screen === 'play' && (
        <div className="screen">
          <button className="new-game-btn" onClick={() => setModalOpen(true)}>+ CALL OUT SOMEONE NEW</button>
          <div className="section-head">YOUR MOVE</div>
          {activeGames.map((g) => {
            const myTurn = g.whose_turn === myId
            if (!myTurn) return null
            const isChallenger = g.challenger_id === myId
            return (
              <div className="game-card" key={g.id}>
                <div className="top-row">
                  <div className="opp-name">{isChallenger ? g.opponent_name : g.challenger_name}</div>
                  <LetterTrack count={isChallenger ? g.self_letters : g.opp_letters} />
                </div>
                <div className="set-trick">TRICK SET: {g.trick} — {g.spot}</div>
                <div className="game-buttons">
                  <button className="btn btn-land" style={{ flex: 1 }} onClick={() => setRespondingTo(g)}>RESPOND WITH CLIP</button>
                </div>
              </div>
            )
          })}
          {activeGames.every(g => g.whose_turn !== myId) && <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No games waiting on you right now.</div>}
          {pendingCallouts.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 24 }}>YOUR PENDING CALLOUTS</div>
              {pendingCallouts.map(g => (
                <div className="game-card" key={g.id}>
                  <div className="top-row">
                    <div className="opp-name">{g.opponent_name}</div>
                  </div>
                  <div className="set-trick">TRICK SET: {g.trick} — {g.spot} · waiting on their response</div>
                  <div className="game-buttons">
                    <button className="btn-cancel" style={{ flex: 1 }} onClick={() => deleteGame(g)}>DELETE CALLOUT</button>
                  </div>
                </div>
              ))}
            </>
          )}
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
                    <div className="top-row"><div className="opp-name">{requesterProfile?.username || 'Unknown'}</div></div>
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
          {friends.length === 0 && <div style={{ color: 'var(--bone-dim)', fontSize: 13, marginBottom: 20 }}>No friends yet. Add some below.</div>}
          {friends.map(f => (
            <div className="feed-card-head" key={f.id} style={{ padding: '10px 4px' }}>
              <div className="avatar" style={{ background: colorFor(f.username), color: '#fff' }}>{initials(f.username)}</div>
              <div className="who"><div className="name">{f.username}</div></div>
              <button className="action-btn" style={{ color: 'var(--tag)', fontSize: 11 }}
                onClick={() => { if (window.confirm(`Block ${f.username}? This removes them as a friend and hides their content from your feed.`)) blockUser(f.id) }}>
                BLOCK
              </button>
            </div>
          ))}
          <div className="section-head" style={{ marginTop: 24 }}>ADD FRIENDS</div>
          <input
            type="text"
            placeholder="Search by username…"
            value={friendSearch}
            onChange={e => setFriendSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          {friendSearch.trim() === '' && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>Start typing a username to find someone.</div>
          )}
          {friendSearch.trim() !== '' && searchResults.length === 0 && (
            <div style={{ color: 'var(--bone-dim)', fontSize: 13 }}>No one found with that username.</div>
          )}
          {searchResults.map(p => (
            <div className="feed-card-head" key={p.id} style={{ padding: '10px 4px' }}>
              <div className="avatar" style={{ background: colorFor(p.username), color: '#fff' }}>{initials(p.username)}</div>
              <div className="who"><div className="name">{p.username}</div></div>
              <button className="action-btn" style={{ background: 'var(--wheel)', color: '#1a1200', padding: '6px 12px', borderRadius: 6, fontFamily: "'Anton',sans-serif" }} onClick={() => sendFriendRequest(p.id)}>ADD</button>
            </div>
          ))}
          {blockedIds.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 24 }}>BLOCKED USERS</div>
              {blockedIds.map(id => {
                const blockedProfile = allPlayers.find(p => p.id === id)
                return (
                  <div className="feed-card-head" key={id} style={{ padding: '10px 4px' }}>
                    <div className="avatar" style={{ background: colorFor(blockedProfile?.username), color: '#fff' }}>{initials(blockedProfile?.username)}</div>
                    <div className="who"><div className="name">{blockedProfile?.username || 'Unknown'}</div></div>
                    <button className="action-btn" onClick={() => unblockUser(id)}>UNBLOCK</button>
                  </div>
                )
              })}
            </>
          )}
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
                  vs {p.challenger_id === myId ? p.opponent_name : p.challenger_name}
                  {p.finished && <span style={{ marginLeft: 8, fontSize: 11, color: p.winner_id === myId ? 'var(--ok)' : 'var(--tag)' }}>{p.winner_id === myId ? 'WON' : 'LOST'}</span>}
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>FEED
        </button>
        <button className={`navbtn ${screen === 'play' ? 'active' : ''}`} onClick={() => setScreen('play')} style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>PLAY
          {pendingGamesCount > 0 && <span style={{ position: 'absolute', top: 2, right: '20%', background: 'var(--tag)', color: '#fff', fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingGamesCount}</span>}
        </button>
        <button className={`navbtn ${screen === 'friends' ? 'active' : ''}`} onClick={() => setScreen('friends')} style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>FRIENDS
          {incomingRequests.length > 0 && <span style={{ position: 'absolute', top: 2, right: '15%', background: 'var(--tag)', color: '#fff', fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{incomingRequests.length}</span>}
        </button>
        <button className={`navbtn ${screen === 'profile' ? 'active' : ''}`} onClick={() => setScreen('profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>PROFILE
        </button>
      </div>

      {modalOpen && (
        <CallOutFlow friends={friends} uploading={uploading} onCancel={() => setModalOpen(false)} onSubmit={createGame} />
      )}

      {respondingTo && (
        <ClipFlow game={respondingTo} uploading={uploading} onCancel={() => setRespondingTo(null)} onSubmit={submitClip} />
      )}

      {viewingThread && (
        <ClipThread
          game={viewingThread}
          clips={clipsByGame[viewingThread.id] || []}
          myId={myId}
          redoVote={redoVotes[viewingThread.id]}
          myBallot={redoVotes[viewingThread.id] ? myBallots[redoVotes[viewingThread.id].id] : null}
          comments={(commentsByGame[viewingThread.id] || []).filter(c => !blockedIds.includes(c.user_id))}
          onClose={() => setViewingThread(null)}
          onFlag={flagRedo}
          onVote={castBallot}
          onResolve={resolveRedoVote}
          onPostComment={(text) => postComment(viewingThread, text)}
          onReportContent={reportContent}
          onBlockUser={blockUser}
        />
      )}
    </div>
  )
}