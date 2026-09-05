import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import ManifestRow from '../components/ManifestRow'
import DispatchModal from '../components/DispatchModal'
import AckModal from '../components/AckModal'
import { SkeletonStats, SkeletonManifest } from '../components/Skeleton'
import { fetchNamesForTxs } from '../names'
import { toDateStr, fetchCurrentPeriod } from '../period'
import NotificationsPrompt from '../components/NotificationsPrompt'

const SELECT = '*, company:companies(name), vehicles(number), items:transaction_items(*, trolley_types(name))'

export default function PartnerPortal() {
  const { profile, session } = useAuth()
  const [tab, setTab] = useState('pending')
  const [trolleyTypes, setTrolleyTypes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [txs, setTxs] = useState([])
  const [names, setNames] = useState({})
  const [ourStock, setOurStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDispatch, setShowDispatch] = useState(false)
  const [ackTx, setAckTx] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const period = await fetchCurrentPeriod()
    const [{ data: tt }, { data: v }, { data: t }, { data: os }] = await Promise.all([
      supabase.from('trolley_types').select('*').order('name'),
      supabase.from('vehicles').select('*').order('number'),
      // RLS already restricts this to the partner's own company
      supabase.from('transactions').select(SELECT).order('created_at', { ascending: false }),
      supabase.from('opening_stock').select('*').eq('month', toDateStr(period)).eq('company_id', profile.company_id),
    ])
    setTrolleyTypes(tt || [])
    setVehicles(v || [])
    setTxs(t || [])

    const monthTxs = (t || []).filter((tx) => new Date(tx.created_at) >= period)
    const stock = (tt || []).map((ty) => {
      const open = (os || []).find((o) => o.trolley_type_id === ty.id)?.qty ?? 0
      let net = 0
      monthTxs.filter((tx) => tx.status === 'acknowledged' || tx.status === 'mismatch').forEach((tx) => {
        const item = tx.items.find((it) => it.trolley_type_id === ty.id)
        if (!item) return
        const qty = item.received_qty ?? item.sent_qty
        net += tx.direction === 'outbound' ? qty : -qty
      })
      return { name: ty.name, qty: open + net }
    })
    setOurStock(stock)
    setNames(await fetchNamesForTxs(t || []))
    setLoading(false)
  }, [profile.company_id])

  useEffect(() => { load() }, [load])

  const pending = txs.filter((t) => t.direction === 'outbound' && t.status === 'pending')
  const myEntryCount = txs.filter((t) => t.created_by === session.user.id).length

  if (loading) return <div><SkeletonStats /><SkeletonManifest /></div>

  return (
    <div>
      <NotificationsPrompt />
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {ourStock.map((s) => (
          <div key={s.name} className="stat">
            <div className="num mono">{s.qty}</div>
            <div className="label">{s.name} — with us</div>
          </div>
        ))}
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat"><div className="num mono">{myEntryCount}</div><div className="label">Entries you've given</div></div>
        <div className="stat"><div className="num mono">{pending.length}</div><div className="label">Deliveries to confirm</div></div>
        <div className="stat"><div className="num mono">{txs.filter((t) => t.status === 'mismatch').length}</div><div className="label">Mismatches on record</div></div>
      </div>

      <div className="row-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>To confirm ({pending.length})</button>
          <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>
        <button className="primary fab-mobile" onClick={() => setShowDispatch(true)}>+ Log a return</button>
      </div>

      {tab === 'pending' ? (
        <div className="manifest">
          {pending.length === 0 && <div className="empty">Nothing waiting on you right now.</div>}
          {pending.map((tx) => (
            <ManifestRow key={tx.id} tx={tx} showCompany={false} names={names} action={
              <button className="primary small" onClick={() => setAckTx(tx)}>Acknowledge</button>
            } />
          ))}
        </div>
      ) : (
        <div className="manifest">
          {txs.length === 0 && <div className="empty">No transactions yet.</div>}
          {txs.map((tx) => <ManifestRow key={tx.id} tx={tx} showCompany={false} names={names} />)}
        </div>
      )}

      {showDispatch && (
        <DispatchModal
          direction="inbound"
          trolleyTypes={trolleyTypes}
          companies={[]}
          vehicles={vehicles}
          fixedCompanyId={profile.company_id}
          userId={session.user.id}
          onClose={() => setShowDispatch(false)}
          onCreated={load}
        />
      )}
      {ackTx && (
        <AckModal tx={ackTx} userId={session.user.id} onClose={() => setAckTx(null)} onDone={load} />
      )}
    </div>
  )
}
