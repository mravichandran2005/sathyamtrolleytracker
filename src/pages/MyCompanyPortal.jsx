import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import ManifestRow from '../components/ManifestRow'
import DispatchModal from '../components/DispatchModal'
import AckModal from '../components/AckModal'
import { SkeletonStats, SkeletonManifest } from '../components/Skeleton'

const SELECT = '*, company:companies(name), vehicles(number), items:transaction_items(*, trolley_types(name))'

export default function MyCompanyPortal() {
  const { session } = useAuth()
  const [tab, setTab] = useState('pending')
  const [companies, setCompanies] = useState([])
  const [trolleyTypes, setTrolleyTypes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDispatch, setShowDispatch] = useState(false)
  const [ackTx, setAckTx] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: c }, { data: tt }, { data: v }, { data: t }] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('trolley_types').select('*').order('name'),
      supabase.from('vehicles').select('*').order('number'),
      supabase.from('transactions').select(SELECT).order('created_at', { ascending: false }),
    ])
    setCompanies(c || [])
    setTrolleyTypes(tt || [])
    setVehicles(v || [])
    setTxs(t || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pending = txs.filter((t) => t.direction === 'inbound' && t.status === 'pending')
  const myEntryCount = txs.filter((t) => t.created_by === session.user.id).length

  if (loading) return <div><SkeletonStats /><SkeletonManifest /></div>

  return (
    <div>
      <div className="grid grid-3 mt-16" style={{ marginBottom: 24 }}>
        <div className="stat"><div className="num mono">{myEntryCount}</div><div className="label">Entries you've given</div></div>
        <div className="stat"><div className="num mono">{pending.length}</div><div className="label">Awaiting your confirmation</div></div>
        <div className="stat"><div className="num mono">{txs.filter((t) => t.status === 'mismatch').length}</div><div className="label">Mismatches on record</div></div>
      </div>

      <div className="row-between" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>To confirm ({pending.length})</button>
          <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>
        <button className="primary fab-mobile" onClick={() => setShowDispatch(true)}>+ Log a dispatch</button>
      </div>

      {tab === 'pending' ? (
        <div className="manifest">
          {pending.length === 0 && <div className="empty">Nothing waiting on you right now.</div>}
          {pending.map((tx) => (
            <ManifestRow key={tx.id} tx={tx} action={
              <button className="primary small" onClick={() => setAckTx(tx)}>Acknowledge</button>
            } />
          ))}
        </div>
      ) : (
        <div className="manifest">
          {txs.length === 0 && <div className="empty">No transactions yet.</div>}
          {txs.map((tx) => <ManifestRow key={tx.id} tx={tx} />)}
        </div>
      )}

      {showDispatch && (
        <DispatchModal
          direction="outbound"
          trolleyTypes={trolleyTypes}
          companies={companies}
          vehicles={vehicles}
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
