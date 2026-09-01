import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function EditTransactionModal({ tx, vehicles, onClose, onSaved }) {
  const initial = {}
  tx.items.forEach((it) => { initial[it.id] = { sent: it.sent_qty, received: it.received_qty } })
  const [items, setItems] = useState(initial)
  const [vehicleId, setVehicleId] = useState(tx.vehicle_id || '')
  const [note, setNote] = useState(tx.note || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function setField(itemId, field, value) {
    setItems((s) => ({ ...s, [itemId]: { ...s[itemId], [field]: value === '' ? '' : Math.max(0, parseInt(value, 10) || 0) } }))
  }

  function computeStatus() {
    const vals = Object.values(items)
    const anyUnreceived = vals.some((v) => v.received === '' || v.received === null || v.received === undefined)
    if (anyUnreceived) return 'pending'
    const anyMismatch = tx.items.some((it) => Number(items[it.id].received) !== Number(items[it.id].sent))
    return anyMismatch ? 'mismatch' : 'acknowledged'
  }

  async function save() {
    setError('')
    setBusy(true)
    try {
      for (const it of tx.items) {
        const v = items[it.id]
        const { error } = await supabase
          .from('transaction_items')
          .update({ sent_qty: v.sent, received_qty: v.received === '' ? null : v.received })
          .eq('id', it.id)
        if (error) throw error
      }
      const status = computeStatus()
      const { error: txErr } = await supabase
        .from('transactions')
        .update({ vehicle_id: vehicleId || null, note: note || null, status })
        .eq('id', tx.id)
      if (txErr) throw txErr
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm('Delete this transaction permanently? This also removes any linked mismatch report.')) return
    setBusy(true)
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
      if (error) throw error
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit transaction</h3>
        <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 4 }}>{tx.company?.name} · {tx.direction === 'outbound' ? 'sent out' : 'returned in'}</p>

        {error && <div className="banner error mt-16">{error}</div>}

        <div className="field mt-16">
          <label>Vehicle</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">—</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.number}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Items (sent / received)</label>
          {tx.items.map((it) => (
            <div key={it.id} className="row" style={{ marginBottom: 8 }}>
              <span style={{ flex: 1, fontSize: 13.5 }}>{it.trolley_types.name}</span>
              <input type="number" min="0" className="mono" style={{ width: 80 }}
                value={items[it.id].sent}
                onChange={(e) => setField(it.id, 'sent', e.target.value)} />
              <span style={{ color: 'var(--ink-dim)' }}>→</span>
              <input type="number" min="0" className="mono" style={{ width: 80 }}
                value={items[it.id].received ?? ''}
                onChange={(e) => setField(it.id, 'received', e.target.value)} />
            </div>
          ))}
        </div>

        <div className="field">
          <label>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="row-between" style={{ marginTop: 20 }}>
          <button type="button" className="danger" disabled={busy} onClick={remove}>Delete transaction</button>
          <div className="row">
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
