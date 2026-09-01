import { useState } from 'react'
import { supabase } from '../supabaseClient'

// tx: a transaction row with .items[] (each has trolley_type name + sent_qty), .company.name
export default function AckModal({ tx, userId, onClose, onDone }) {
  const initial = {}
  tx.items.forEach((it) => { initial[it.id] = it.sent_qty })
  const [received, setReceived] = useState(initial)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const mismatched = tx.items.some((it) => Number(received[it.id]) !== it.sent_qty)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      for (const it of tx.items) {
        const { error } = await supabase
          .from('transaction_items')
          .update({ received_qty: received[it.id] })
          .eq('id', it.id)
        if (error) throw error
      }

      const status = mismatched ? 'mismatch' : 'acknowledged'
      const { error: txErr } = await supabase
        .from('transactions')
        .update({ status, acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
        .eq('id', tx.id)
      if (txErr) throw txErr

      if (mismatched) {
        const { error: repErr } = await supabase.from('mismatch_reports').insert({
          transaction_id: tx.id,
          raised_by: userId,
          description: desc || 'Received quantity did not match sent quantity.',
        })
        if (repErr) throw repErr
      }

      onDone()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Confirm receipt</h3>
        <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 4 }}>
          {tx.company?.name} · {tx.vehicles?.number ? `vehicle ${tx.vehicles.number} · ` : ''}declared {new Date(tx.created_at).toLocaleDateString()}
        </p>

        {error && <div className="banner error mt-16">{error}</div>}

        <form onSubmit={submit} className="mt-16">
          <div className="grid grid-3">
            {tx.items.map((it) => (
              <div key={it.id}>
                <label>{it.trolley_types.name} <span style={{ opacity: 0.6 }}>(sent {it.sent_qty})</span></label>
                <input
                  type="number"
                  min="0"
                  className="mono"
                  value={received[it.id]}
                  onChange={(e) => setReceived((r) => ({ ...r, [it.id]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                />
              </div>
            ))}
          </div>

          {mismatched && (
            <div className="field mt-16">
              <div className="banner error" style={{ marginBottom: 10 }}>
                Count doesn't match what was declared. A report will be sent to the Master.
              </div>
              <label>What happened? (optional)</label>
              <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Any detail that helps trace the difference" />
            </div>
          )}

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Acknowledge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
