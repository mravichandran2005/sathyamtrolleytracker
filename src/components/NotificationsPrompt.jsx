import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { pushSupported, getNotificationStatus, enablePush } from '../push'

export default function NotificationsPrompt() {
  const { session } = useAuth()
  const [status, setStatus] = useState('checking')
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getNotificationStatus().then(setStatus)
  }, [])

  if (!pushSupported() || status === 'granted' || status === 'denied' || dismissed) return null
  if (status === 'checking' || status === 'unsupported') return null

  async function handleEnable() {
    setBusy(true)
    setError('')
    try {
      await enablePush(session.user.id)
      setStatus('granted')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="banner info" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <span>Get notified on this device the moment something needs your confirmation.</span>
      <div className="row" style={{ gap: 8 }}>
        {error && <span style={{ color: 'var(--red)', fontSize: 12 }}>{error}</span>}
        <button className="primary small" disabled={busy} onClick={handleEnable}>
          {busy ? 'Enabling…' : 'Enable notifications'}
        </button>
        <button className="ghost small" onClick={() => setDismissed(true)}>Not now</button>
      </div>
    </div>
  )
}
