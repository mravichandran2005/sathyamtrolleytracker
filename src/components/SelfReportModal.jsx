import { useState } from 'react'
import { supabase } from '../supabaseClient'
import TrolleyQtyInputs from './TrolleyQtyInputs'

export default function SelfReportModal({ trolleyTypes, companies, vehicles, userId, onClose, onCreated }) {
  const [companyId, setCompanyId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [qtys, setQtys] = useState({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const total = Object.values(qtys).reduce((s, v) => s + (v || 0), 0)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!companyId) { setError('Choose which company this came from.'); return }
    if (!vehicleId) { setError('Choose which vehicle this is for.'); return }
    if (total <= 0) { setError('Enter at least one quantity.'); return }
    setBusy(true)
    try {
      const nowIso = new Date().toISOString()
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({
          company_id: companyId, vehicle_id: vehicleId, direction: 'inbound',
          created_by: userId, note: note || null,
          self_reported: true, status: 'acknowledged',
          acknowledged_by: userId, acknowledged_at: nowIso,
        })
        .select()
        .single()
      if (txErr) throw txErr

      const items = trolleyTypes
        .filter((tt) => qtys[tt.id] > 0)
        .map((tt) => ({ transaction_id: tx.id, trolley_type_id: tt.id, sent_qty: qtys[tt.id], received_qty: qtys[tt.id] }))
      const { error: itemsErr } = await supabase.from('transaction_items').insert(items)
      if (itemsErr) throw itemsErr

      onCreated()
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
        <h3>Log a return received</h3>
        <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 4 }}>
          For when a partner sent trolleys back by vehicle but never logged it themselves. This gets recorded and
          counted immediately — clearly marked as self-reported, since there's no separate confirmation from their
          side to cross-check it against.
        </p>

        {error && <div className="banner error mt-16">{error}</div>}

        <form onSubmit={submit} className="mt-16">
          <div className="field">
            <label>Which company did this come from?</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
              <option value="">Select company…</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Vehicle</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.number}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Quantities received</label>
            <TrolleyQtyInputs trolleyTypes={trolleyTypes} values={qtys} onChange={(id, v) => setQtys((q) => ({ ...q, [id]: v }))} />
          </div>

          <div className="field">
            <label>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. driver name, why it wasn't logged by them" />
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Log received'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
