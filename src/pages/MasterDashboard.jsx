import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ManifestRow from '../components/ManifestRow'
import ExportButton from '../components/ExportButton'
import EditTransactionModal from '../components/EditTransactionModal'
import CloseMonth from '../components/CloseMonth'
import { StockByCompanyChart, VolumeByCompanyChart, MyCompanyStockChart } from '../components/Charts'
import TabSwitcher from '../components/TabSwitcher'
import { SkeletonStats, SkeletonManifest } from '../components/Skeleton'
import { ROLE_LABEL } from '../brand'
import { toDateStr, fetchCurrentPeriod } from '../period'
import { fetchNamesForTxs } from '../names'

const SELECT = '*, company:companies(name), vehicles(number), items:transaction_items(*, trolley_types(name))'
const TABS = ['Overview', 'Charts', 'Transactions', 'Reports', 'Month close', 'Companies', 'Trolley types', 'Vehicles', 'Users']

export default function MasterDashboard() {
  const [tab, setTab] = useState('Overview')
  const [period, setPeriod] = useState(null)
  const [companies, setCompanies] = useState([])
  const [trolleyTypes, setTrolleyTypes] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [txs, setTxs] = useState([])
  const [opening, setOpening] = useState([])
  const [myOpening, setMyOpening] = useState([])
  const [reports, setReports] = useState([])
  const [profiles, setProfiles] = useState([])
  const [names, setNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [editTx, setEditTx] = useState(null)
  const loadedOnce = useRef(false)

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true)
    const currentPeriod = await fetchCurrentPeriod()
    const thisMonth = toDateStr(currentPeriod)
    const [c, tt, veh, t, os, mos, r, p] = await Promise.all([
      supabase.from('companies').select('*').order('name'),
      supabase.from('trolley_types').select('*').order('name'),
      supabase.from('vehicles').select('*').order('number'),
      supabase.from('transactions').select(SELECT).order('created_at', { ascending: false }),
      supabase.from('opening_stock').select('*').eq('month', thisMonth),
      supabase.from('my_company_opening_stock').select('*').eq('month', thisMonth),
      supabase.from('mismatch_reports').select('*, transaction:transactions(*, company:companies(name), vehicles(number), items:transaction_items(*, trolley_types(name)))').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*, company:companies(name)').order('created_at'),
    ])
    setPeriod(currentPeriod)
    setCompanies(c.data || [])
    setTrolleyTypes(tt.data || [])
    setVehicles(veh.data || [])
    setTxs(t.data || [])
    setOpening(os.data || [])
    setMyOpening(mos.data || [])
    setReports(r.data || [])
    setProfiles(p.data || [])
    setNames(await fetchNamesForTxs(t.data || []))
    loadedOnce.current = true
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !period) return (
    <div>
      <SkeletonStats />
      <SkeletonManifest />
    </div>
  )

  const openReports = reports.filter((r) => r.status === 'open')
  const monthTxs = txs.filter((t) => new Date(t.created_at) >= period)

  // stock = opening (this month) + net of this month's resolved transactions
  const stock = []
  companies.forEach((c) => {
    trolleyTypes.forEach((tt) => {
      const open = opening.find((o) => o.company_id === c.id && o.trolley_type_id === tt.id)?.qty ?? 0
      const relevant = monthTxs.filter((t) => t.company_id === c.id && (t.status === 'acknowledged' || t.status === 'mismatch'))
      let net = 0
      relevant.forEach((t) => {
        const item = t.items.find((it) => it.trolley_type_id === tt.id)
        if (!item) return
        const qty = item.received_qty ?? item.sent_qty
        net += t.direction === 'outbound' ? qty : -qty
      })
      stock.push({ company_id: c.id, trolley_type_id: tt.id, with_partner: open + net })
    })
  })

  // my company's own inventory = opening + returns in - dispatches out, across ALL partners
  const myStock = trolleyTypes.map((tt) => {
    const open = myOpening.find((o) => o.trolley_type_id === tt.id)?.qty ?? 0
    const relevant = monthTxs.filter((t) => t.status === 'acknowledged' || t.status === 'mismatch')
    let net = 0
    relevant.forEach((t) => {
      const item = t.items.find((it) => it.trolley_type_id === tt.id)
      if (!item) return
      const qty = item.received_qty ?? item.sent_qty
      net += t.direction === 'outbound' ? -qty : qty
    })
    return { trolley_type_id: tt.id, name: tt.name, qty: open + net }
  })

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2>Dashboard</h2>
        <span className="role-tag mono">Tracking period: {period.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat"><div className="num mono">{txs.length}</div><div className="label">Total transactions</div></div>
        <div className="stat"><div className="num mono">{txs.filter((t) => t.status === 'pending').length}</div><div className="label">Awaiting confirmation</div></div>
        <div className="stat"><div className="num mono" style={{ color: openReports.length ? 'var(--red)' : 'var(--ink)' }}>{openReports.length}</div><div className="label">Open mismatch reports</div></div>
      </div>

      <TabSwitcher tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'Overview' && <Overview stock={stock} myStock={myStock} companies={companies} trolleyTypes={trolleyTypes} opening={opening} myOpening={myOpening} />}
      {tab === 'Charts' && (
        <>
          <MyCompanyStockChart myStock={myStock} />
          <StockByCompanyChart stock={stock} companies={companies} trolleyTypes={trolleyTypes} />
          <VolumeByCompanyChart txs={monthTxs} companies={companies} />
        </>
      )}
      {tab === 'Transactions' && (
        <div>
          <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 16 }}>
            <ExportButton txs={txs} trolleyTypes={trolleyTypes} />
          </div>
          <div className="manifest">
            {txs.map((tx) => (
              <ManifestRow key={tx.id} tx={tx} names={names} action={
                <button className="ghost small" onClick={() => setEditTx(tx)}>Edit</button>
              } />
            ))}
          </div>
        </div>
      )}
      {tab === 'Reports' && <Reports reports={reports} onChanged={load} />}
      {tab === 'Month close' && <CloseMonth companies={companies} trolleyTypes={trolleyTypes} onChanged={load} />}
      {tab === 'Companies' && <SimpleList table="companies" field="name" placeholder="New company name" items={companies} onChanged={load} />}
      {tab === 'Trolley types' && <SimpleList table="trolley_types" field="name" placeholder="New trolley/bin type" items={trolleyTypes} onChanged={load} />}
      {tab === 'Vehicles' && <SimpleList table="vehicles" field="number" placeholder="New vehicle number" items={vehicles} onChanged={load} />}
      {tab === 'Users' && <Users profiles={profiles} companies={companies} onChanged={load} />}

      {editTx && (
        <EditTransactionModal tx={editTx} vehicles={vehicles} onClose={() => setEditTx(null)} onSaved={load} />
      )}
    </div>
  )
}

function Overview({ stock, myStock, companies, trolleyTypes, opening, myOpening }) {
  const myOpeningMissing = trolleyTypes.length > 0 && myOpening.length === 0
  return (
    <div>
      {myOpeningMissing && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          No opening stock set yet for your own inventory this month — figures below assume 0 opening. Set it from the Month close tab.
        </div>
      )}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {myStock.map((s) => (
          <div key={s.trolley_type_id} className="stat">
            <div className="num mono">{s.qty}</div>
            <div className="label">My Company — {s.name}</div>
          </div>
        ))}
        {myStock.length === 0 && <div className="empty">Add a trolley type to see your own inventory here.</div>}
      </div>

      {companies.length === 0 ? (
        <div className="empty">Add a company to start tracking their stock too.</div>
      ) : (
        <CompanyStockTable stock={stock} companies={companies} trolleyTypes={trolleyTypes} opening={opening} />
      )}
    </div>
  )
}

function CompanyStockTable({ stock, companies, trolleyTypes, opening }) {
  const openingMissing = companies.length > 0 && trolleyTypes.length > 0 && opening.length === 0
  return (
    <div>
      {openingMissing && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          No opening stock set for this month yet for partner companies — figures below assume 0 opening. Set it from the Month close tab.
        </div>
      )}
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Stock with each partner company</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--ink-dim)', fontWeight: 600 }}>Company</th>
              {trolleyTypes.map((tt) => (
                <th key={tt.id} style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--ink-dim)', fontWeight: 600 }}>{tt.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '10px' }}>{c.name}</td>
                {trolleyTypes.map((tt) => {
                  const row = stock.find((s) => s.company_id === c.id && s.trolley_type_id === tt.id)
                  const val = row?.with_partner ?? 0
                  return <td key={tt.id} className="mono" style={{ padding: '10px', textAlign: 'right', color: val > 0 ? 'var(--amber)' : 'var(--ink-dim)' }}>{val}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: 'var(--ink-dim)', fontSize: 12.5, marginTop: 14 }}>
          Positive number = that many units currently with that company: this month's opening stock plus confirmed dispatches minus confirmed returns.
        </p>
      </div>
    </div>
  )
}

function Reports({ reports, onChanged }) {
  const [busyId, setBusyId] = useState(null)
  const [note, setNote] = useState({})

  async function resolve(r) {
    setBusyId(r.id)
    await supabase.from('mismatch_reports').update({
      status: 'resolved', resolved_at: new Date().toISOString(), resolution_note: note[r.id] || null,
    }).eq('id', r.id)
    setBusyId(null)
    onChanged()
  }

  if (reports.length === 0) return <div className="empty">No mismatch reports yet.</div>

  return (
    <div className="manifest">
      {reports.map((r) => {
        const mismatchedItems = (r.transaction?.items || []).filter((it) => it.received_qty !== null && it.received_qty !== it.sent_qty)
        return (
          <div key={r.id} className={`manifest-row ${r.status === 'open' ? 'mismatch' : 'acknowledged'}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="row-between">
              <div className="manifest-title">
                {r.transaction?.company?.name} — {r.transaction?.direction === 'outbound' ? 'delivery' : 'return'} on {new Date(r.transaction?.created_at).toLocaleDateString()}
                {r.transaction?.vehicles?.number ? ` · Vehicle ${r.transaction.vehicles.number}` : ''}
              </div>
              <span className={`stamp ${r.status === 'open' ? 'mismatch' : 'acknowledged'}`}>{r.status === 'open' ? 'Open' : 'Resolved'}</span>
            </div>

            <div className="mt-8">
              {mismatchedItems.length === 0 ? (
                <div className="manifest-sub">No item-level difference recorded.</div>
              ) : mismatchedItems.map((it) => (
                <div className="item-line" key={it.id}>
                  <span>{it.trolley_types.name}</span>
                  <span className="qty">declared {it.sent_qty} → confirmed {it.received_qty}</span>
                </div>
              ))}
            </div>
            {r.description && <div className="manifest-sub mt-8">Note: {r.description}</div>}

            {r.status === 'open' ? (
              <div className="row mt-16">
                <input placeholder="Resolution note (optional)" value={note[r.id] || ''} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} />
                <button className="primary small" disabled={busyId === r.id} onClick={() => resolve(r)}>Mark resolved</button>
              </div>
            ) : (
              r.resolution_note && <div className="manifest-sub mt-8">Resolution: {r.resolution_note}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Generic add/list for companies, trolley_types, vehicles (all just {id, <field>})
function SimpleList({ table, field, placeholder, items, onChanged }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  async function add(e) {
    e.preventDefault()
    if (!value.trim()) return
    const { error } = await supabase.from(table).insert({ [field]: value.trim() })
    if (error) { setError(error.message); return }
    setError('')
    setValue('')
    onChanged()
  }
  return (
    <div>
      <form onSubmit={add} className="row" style={{ marginBottom: 20 }}>
        <input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="primary" type="submit">Add</button>
      </form>
      {error && <div className="banner error">{error}</div>}
      <div className="grid grid-2">
        {items.map((it) => <div key={it.id} className="card">{it[field]}</div>)}
        {items.length === 0 && <div className="empty">Nothing added yet.</div>}
      </div>
    </div>
  )
}

function Users({ profiles, companies, onChanged }) {
  const [edits, setEdits] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [tempPasswordModal, setTempPasswordModal] = useState(null) // { name, password }
  const [resetError, setResetError] = useState('')

  function setEdit(id, patch) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }))
  }

  async function save(p) {
    const edit = edits[p.id] || {}
    const role = edit.role ?? p.role
    const company_id = role === 'partner' ? (edit.company_id ?? p.company_id) : null
    setBusyId(p.id)
    await supabase.from('profiles').update({ role, company_id }).eq('id', p.id)
    setBusyId(null)
    onChanged()
  }

  async function toggleActive(p) {
    setBusyId(p.id)
    await supabase.from('profiles').update({ active: !p.active }).eq('id', p.id)
    setBusyId(null)
    onChanged()
  }

  async function resetPassword(p) {
    setResetError('')
    setBusyId(p.id)
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', { body: { userId: p.id } })
      if (error) {
        console.error('reset-password function error:', error)
        throw new Error(
          `${error.message || 'Request failed'} — check that the Edge Function is deployed (Supabase dashboard → Edge Functions → reset-password should be listed), and check its Logs tab there for the real cause.`
        )
      }
      if (!data || data.error) throw new Error(data?.error || 'No response from the function.')
      setTempPasswordModal({ name: p.full_name, password: data.tempPassword })
    } catch (err) {
      setResetError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {resetError && <div className="banner error">{resetError}</div>}
      <div className="manifest">
        {profiles.map((p) => {
          const edit = edits[p.id] || {}
          const role = edit.role ?? p.role
          return (
            <div key={p.id} className={`manifest-row ${p.reset_requested ? 'mismatch' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', opacity: p.active ? 1 : 0.55 }}>
              <div className="row-between">
                <div>
                  <div className="manifest-title">{p.full_name}{!p.active ? ' (deactivated)' : ''}</div>
                  <div className="manifest-sub">{p.company?.name || '—'}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {p.reset_requested && <span className="stamp mismatch">Reset requested</span>}
                  <span className={`stamp ${p.role === 'pending' ? 'pending' : 'acknowledged'}`}>{ROLE_LABEL[p.role]}</span>
                </div>
              </div>
              <div className="row mt-16" style={{ flexWrap: 'wrap' }}>
                <select value={role} onChange={(e) => setEdit(p.id, { role: e.target.value })} style={{ width: 180 }}>
                  <option value="pending">{ROLE_LABEL.pending}</option>
                  <option value="master">{ROLE_LABEL.master}</option>
                  <option value="my_company">{ROLE_LABEL.my_company}</option>
                  <option value="partner">{ROLE_LABEL.partner}</option>
                </select>
                {role === 'partner' && (
                  <select value={edit.company_id ?? p.company_id ?? ''} onChange={(e) => setEdit(p.id, { company_id: e.target.value })} style={{ width: 200 }}>
                    <option value="">Select company…</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <button className="primary small" disabled={busyId === p.id} onClick={() => save(p)}>Save</button>
                <button className={p.active ? 'danger small' : 'ghost small'} disabled={busyId === p.id} onClick={() => toggleActive(p)}>
                  {p.active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button className="ghost small" disabled={busyId === p.id} onClick={() => resetPassword(p)}>
                  {busyId === p.id ? 'Working…' : 'Reset password'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {tempPasswordModal && (
        <div className="modal-backdrop" onClick={() => setTempPasswordModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Temporary password for {tempPasswordModal.name}</h3>
            <p style={{ color: 'var(--ink-dim)', fontSize: 13, marginTop: 8 }}>
              Share this with them privately (phone call, in person, WhatsApp). It won't be shown again after you
              close this — if you lose it, just reset again. They'll be required to set their own password the
              moment they log in with it.
            </p>
            <div className="card mono mt-16" style={{ textAlign: 'center', fontSize: 20, letterSpacing: '0.03em', padding: 16 }}>
              {tempPasswordModal.password}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="primary" onClick={() => setTempPasswordModal(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
