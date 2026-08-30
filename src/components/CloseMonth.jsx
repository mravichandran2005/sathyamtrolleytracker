import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import ExportButton from './ExportButton'
import { toDateStr, addMonths, fetchCurrentPeriod, advancePeriod } from '../period'

export default function CloseMonth({ companies, trolleyTypes }) {
  const { profile } = useAuth()
  const [period, setPeriod] = useState(null)
  const [opening, setOpening] = useState([])
  const [myOpening, setMyOpening] = useState([])
  const [txs, setTxs] = useState([])
  const [closingEdits, setClosingEdits] = useState({})
  const [myClosingEdits, setMyClosingEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const currentPeriod = await fetchCurrentPeriod()
    const [{ data: os }, { data: mos }, { data: t }] = await Promise.all([
      supabase.from('opening_stock').select('*').eq('month', toDateStr(currentPeriod)),
      supabase.from('my_company_opening_stock').select('*').eq('month', toDateStr(currentPeriod)),
      supabase.from('transactions').select('*, items:transaction_items(*)').gte('created_at', currentPeriod.toISOString()),
    ])
    setPeriod(currentPeriod)
    setOpening(os || [])
    setMyOpening(mos || [])
    setTxs(t || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ---- partner companies ----
  function openingFor(companyId, typeId) {
    return opening.find((o) => o.company_id === companyId && o.trolley_type_id === typeId)?.qty ?? 0
  }
  function movementFor(companyId, typeId) {
    const relevant = txs.filter((t) => t.company_id === companyId && (t.status === 'acknowledged' || t.status === 'mismatch'))
    let dispatched = 0, returned = 0, mismatches = 0
    relevant.forEach((t) => {
      const item = t.items.find((it) => it.trolley_type_id === typeId)
      if (!item) return
      const qty = item.received_qty ?? item.sent_qty
      if (t.direction === 'outbound') dispatched += qty
      else returned += qty
      if (t.status === 'mismatch') mismatches += 1
    })
    return { dispatched, returned, mismatches }
  }
  function suggestedClosing(companyId, typeId) {
    const open = openingFor(companyId, typeId)
    const { dispatched, returned } = movementFor(companyId, typeId)
    return open + dispatched - returned
  }
  function closingValue(companyId, typeId) {
    const key = `${companyId}-${typeId}`
    return closingEdits[key] !== undefined ? closingEdits[key] : suggestedClosing(companyId, typeId)
  }

  // ---- my company's own inventory (aggregated across ALL partner companies) ----
  function myOpeningFor(typeId) {
    return myOpening.find((o) => o.trolley_type_id === typeId)?.qty ?? 0
  }
  function myMovementFor(typeId) {
    const relevant = txs.filter((t) => t.status === 'acknowledged' || t.status === 'mismatch')
    let dispatched = 0, returned = 0
    relevant.forEach((t) => {
      const item = t.items.find((it) => it.trolley_type_id === typeId)
      if (!item) return
      const qty = item.received_qty ?? item.sent_qty
      if (t.direction === 'outbound') dispatched += qty
      else returned += qty
    })
    return { dispatched, returned }
  }
  function mySuggestedClosing(typeId) {
    const open = myOpeningFor(typeId)
    const { dispatched, returned } = myMovementFor(typeId)
    return open - dispatched + returned
  }
  function myClosingValue(typeId) {
    return myClosingEdits[typeId] !== undefined ? myClosingEdits[typeId] : mySuggestedClosing(typeId)
  }

  const pendingCount = txs.filter((t) => t.status === 'pending').length

  async function closeMonth() {
    setError('')
    setBusy(true)
    try {
      const nextPeriod = addMonths(period, 1)

      for (const c of companies) {
        for (const tt of trolleyTypes) {
          const open = openingFor(c.id, tt.id)
          const { dispatched, returned, mismatches } = movementFor(c.id, tt.id)
          const closing = closingValue(c.id, tt.id)

          const { error: e1 } = await supabase.from('monthly_summary').upsert({
            company_id: c.id, trolley_type_id: tt.id, month: toDateStr(period),
            opening_qty: open, dispatched_qty: dispatched, returned_qty: returned,
            closing_qty: closing, mismatch_count: mismatches,
          }, { onConflict: 'company_id,trolley_type_id,month' })
          if (e1) throw e1

          const { error: e2 } = await supabase.from('opening_stock').upsert({
            company_id: c.id, trolley_type_id: tt.id, month: toDateStr(nextPeriod),
            qty: closing, set_by: profile.id,
          }, { onConflict: 'company_id,trolley_type_id,month' })
          if (e2) throw e2
        }
      }

      for (const tt of trolleyTypes) {
        const open = myOpeningFor(tt.id)
        const { dispatched, returned } = myMovementFor(tt.id)
        const closing = myClosingValue(tt.id)

        const { error: e3 } = await supabase.from('my_company_monthly_summary').upsert({
          trolley_type_id: tt.id, month: toDateStr(period),
          opening_qty: open, dispatched_qty: dispatched, returned_qty: returned, closing_qty: closing,
        }, { onConflict: 'trolley_type_id,month' })
        if (e3) throw e3

        const { error: e4 } = await supabase.from('my_company_opening_stock').upsert({
          trolley_type_id: tt.id, month: toDateStr(nextPeriod), qty: closing, set_by: profile.id,
        }, { onConflict: 'trolley_type_id,month' })
        if (e4) throw e4
      }

      const idsToDelete = txs.filter((t) => t.status !== 'pending').map((t) => t.id)
      if (idsToDelete.length > 0) {
        const { error: e5 } = await supabase.from('transactions').delete().in('id', idsToDelete)
        if (e5) throw e5
      }

      const { error: e6 } = await advancePeriod(nextPeriod)
      if (e6) throw e6

      setDone(true)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading || !period) return <div className="empty">Loading…</div>

  const monthLabel = period.toLocaleString(undefined, { month: 'long', year: 'numeric' })
  const now = new Date()
  const isOverdue = now >= addMonths(period, 1)
  const daysOverdue = isOverdue ? Math.floor((now - addMonths(period, 1)) / 86400000) : 0

  return (
    <div>
      <div className="card">
        <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 15 }}>Closing {monthLabel}</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-dim)', marginTop: 4 }}>
              Export first, then review the suggested closing stock below (adjust to match your physical count) —
              for each partner company, and for your own warehouse. Then close: this purges the confirmed
              transactions for this period and sets the next period's opening stock for everyone, including you.
            </p>
          </div>
          <ExportButton txs={txs} trolleyTypes={trolleyTypes} label="Export this period" />
        </div>

        {isOverdue && (
          <div className="banner info mt-16">
            It's past {monthLabel} on the calendar{daysOverdue > 0 ? ` (by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'})` : ''}, but that's fine —
            nothing is dropped or reset by waiting. The app stays on {monthLabel} until you close it, whenever you're ready.
          </div>
        )}
        {pendingCount > 0 && (
          <div className="banner info mt-16">
            {pendingCount} transaction(s) are still pending confirmation — they won't be purged and will carry over.
          </div>
        )}
        {error && <div className="banner error mt-16">{error}</div>}
        {done && <div className="banner info mt-16">Period closed. Opening stock is set for the new period, for every company and for your own inventory.</div>}
      </div>

      <div className="card mt-16" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>My Company — own inventory</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: 'var(--ink-dim)' }}>Type</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Opening</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Sent out</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Returned in</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Closing (editable)</th>
            </tr>
          </thead>
          <tbody>
            {trolleyTypes.map((tt) => {
              const { dispatched, returned } = myMovementFor(tt.id)
              return (
                <tr key={tt.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: 8 }}>{tt.name}</td>
                  <td className="mono" style={{ padding: 8, textAlign: 'right' }}>{myOpeningFor(tt.id)}</td>
                  <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--red)' }}>-{dispatched}</td>
                  <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--teal)' }}>+{returned}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    <input type="number" min="0" className="mono" style={{ width: 90, textAlign: 'right' }}
                      value={myClosingValue(tt.id)}
                      onChange={(e) => setMyClosingEdits((s) => ({ ...s, [tt.id]: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card mt-16" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Partner companies</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, color: 'var(--ink-dim)' }}>Company</th>
              <th style={{ textAlign: 'left', padding: 8, color: 'var(--ink-dim)' }}>Type</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Opening</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Dispatched</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Returned</th>
              <th style={{ textAlign: 'right', padding: 8, color: 'var(--ink-dim)' }}>Closing (editable)</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => trolleyTypes.map((tt) => {
              const { dispatched, returned } = movementFor(c.id, tt.id)
              const key = `${c.id}-${tt.id}`
              return (
                <tr key={key} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: 8 }}>{c.name}</td>
                  <td style={{ padding: 8 }}>{tt.name}</td>
                  <td className="mono" style={{ padding: 8, textAlign: 'right' }}>{openingFor(c.id, tt.id)}</td>
                  <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--amber)' }}>+{dispatched}</td>
                  <td className="mono" style={{ padding: 8, textAlign: 'right', color: 'var(--teal)' }}>-{returned}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    <input type="number" min="0" className="mono" style={{ width: 90, textAlign: 'right' }}
                      value={closingValue(c.id, tt.id)}
                      onChange={(e) => setClosingEdits((s) => ({ ...s, [key]: Math.max(0, parseInt(e.target.value, 10) || 0) }))} />
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="primary" disabled={busy} onClick={closeMonth}>
          {busy ? 'Closing…' : `Close ${monthLabel} & carry forward`}
        </button>
      </div>
    </div>
  )
}
