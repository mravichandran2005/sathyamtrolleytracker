import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import ManifestRow from '../components/ManifestRow'
import DispatchModal from '../components/DispatchModal'
import AckModal from '../components/AckModal'
import { SkeletonStats, SkeletonManifest } from '../components/Skeleton'

const SELECT = '*, company:companies(name), vehicles(number), items:transaction_items(*, trolley_types(name))'

export default function PartnerPortal() {
  const { profile, session } = useAuth()
  const [tab, setTab] = useState('pending')
  const [trolleyTypes, setTrolleyTypes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDispatch, setShowDispatch] = useState(false)
  const [ackTx, setAckTx] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: tt }, { data: v }, { data: t }] = await Promise.all([
      supabase.from('trolley_types').select('*').order('name'),
      supabase.from('vehicles').select('*').order('number'),
      // RLS already restricts this to the partner's own company
      supabase.from('transactions').select(SELECT).order('created_at', { ascending: false }),
    ])
    setTrolleyTypes(tt || [])
    setVehicles(v || [])
    setTxs(t || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pending = txs.filter((t) => t.direction === 'outbound' && t.status === 'pending')
  const myEntryCount = txs.filter((t) => t.created_by === session.user.id).length

  if (loading) return <div><SkeletonStats /><SkeletonManifest /></div>

  return (
    <div>
      <div className="grid grid-3 mt-16" style={{ marginBottom: 24 }}>
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
            <ManifestRow key={tx.id} tx={tx} showCompany={false} action={
              <button className="primary small" onClick={() => setAckTx(tx)}>Acknowledge</button>
            } />
          ))}
        </div>
      ) : (
        <div className="manifest">
          {txs.length === 0 && <div className="empty">No transactions yet.</div>}
          {txs.map((tx) => <ManifestRow key={tx.id} tx={tx} showCompany={false} />)}
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
