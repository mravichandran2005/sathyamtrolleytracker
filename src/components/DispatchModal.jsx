import { useState } from 'react'
import { supabase } from '../supabaseClient'
import TrolleyQtyInputs from './TrolleyQtyInputs'

// direction: 'outbound' (my_company sending to a partner) or 'inbound' (partner sending back)
// fixedCompanyId: pass when the user's own company is fixed (partner users); leave null for my_company users who pick a partner
export default function DispatchModal({ direction, trolleyTypes, companies, vehicles, fixedCompanyId, userId, onClose, onCreated }) {
  const [companyId, setCompanyId] = useState(fixedCompanyId || '')
  const [vehicleId, setVehicleId] = useState('')
  const [qtys, setQtys] = useState({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const total = Object.values(qtys).reduce((s, v) => s + (v || 0), 0)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!companyId) { setError('Choose a company.'); return }
    if (!vehicleId) { setError('Choose which vehicle this is for.'); return }
    if (total <= 0) { setError('Enter at least one quantity.'); return }
    setBusy(true)
    try {
      const { data: tx, error: txErr } = await supabase
        .from('transactions')
        .insert({ company_id: companyId, vehicle_id: vehicleId, direction, created_by: userId, note: note || null })
        .select()
        .single()
      if (txErr) throw txErr

      const items = trolleyTypes
        .filter((tt) => qtys[tt.id] > 0)
        .map((tt) => ({ transaction_id: tx.id, trolley_type_id: tt.id, sent_qty: qtys[tt.id] }))
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
        <h3>{direction === 'outbound' ? 'Log a dispatch' : 'Log a return'}</h3>
        <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 4 }}>
          {direction === 'outbound'
            ? 'What are you sending out with this delivery?'
            : 'What are you sending back?'}
        </p>

        {error && <div className="banner error mt-16">{error}</div>}

        <form onSubmit={submit} className="mt-16">
          {!fixedCompanyId && (
            <div className="field">
              <label>Company</label>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
                <option value="">Select company…</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="field">
            <label>Vehicle</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required>
              <option value="">Select vehicle…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.number}</option>)}
            </select>
            {vehicles.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
                No vehicles set up yet — ask your Master to add one under Vehicles.
              </p>
            )}
          </div>

          <div className="field">
            <label>Quantities</label>
            <TrolleyQtyInputs trolleyTypes={trolleyTypes} values={qtys} onChange={(id, v) => setQtys((q) => ({ ...q, [id]: v }))} />
          </div>

          <div className="field">
            <label>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. driver name" />
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : 'Submit entry'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
