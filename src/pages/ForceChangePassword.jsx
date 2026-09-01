import { useState } from 'react'
import { supabase } from '../supabaseClient'
import PasswordInput from '../components/PasswordInput'
import { BRAND_NAME } from '../brand'

export default function ForceChangePassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (pw !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password: pw })
      if (pwErr) throw pwErr
      const { error: rpcErr } = await supabase.rpc('clear_must_change_password')
      if (rpcErr) throw rpcErr
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="row" style={{ marginBottom: 18 }}>
          <div className="brand-mark" />
          <div className="brand-name">{BRAND_NAME}</div>
        </div>
        <h2>Set a new password</h2>
        <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 6, marginBottom: 20 }}>
          You logged in with a temporary password from your Master. Choose a permanent one to continue.
        </p>
        {error && <div className="banner error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>New password</label>
            <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
          </div>
          <button type="submit" className="primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
