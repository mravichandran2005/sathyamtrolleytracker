import { useState } from 'react'
import { supabase } from '../supabaseClient'
import PasswordInput from '../components/PasswordInput'
import { BRAND_NAME, APP_NAME } from '../brand'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) throw error
        setInfo('Account created. The site Master needs to approve your access before you can log in — check back shortly.')
      } else if (mode === 'forgot') {
        const { error } = await supabase.rpc('request_password_reset', { p_email: email })
        if (error) throw error
        setInfo('Password reset requested. Contact your Master — they can issue you a temporary password from the Users tab.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="row" style={{ marginBottom: 22 }}>
          <div className="brand-mark" />
          <div>
            <div className="brand-name">{BRAND_NAME}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{APP_NAME}</div>
          </div>
        </div>

        {error && <div className="banner error">{error}</div>}
        {info && <div className="banner info">{info}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label>Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== 'forgot' && (
            <div className="field">
              <label>Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </div>
          )}
          <button type="submit" className="primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Log in' : mode === 'signup' ? 'Create account' : 'Request reset'}
          </button>
        </form>

        {mode === 'signin' && (
          <div className="mt-8" style={{ textAlign: 'center' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); switchMode('forgot') }} style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
              Forgot password?
            </a>
          </div>
        )}

        <div className="mt-16" style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-dim)' }}>
          {mode === 'signin' && (
            <>New here? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signup') }}>Create an account</a></>
          )}
          {mode === 'signup' && (
            <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signin') }}>Log in</a></>
          )}
          {mode === 'forgot' && (
            <>Remembered it? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signin') }}>Back to log in</a></>
          )}
        </div>
      </div>
    </div>
  )
}
