import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

const COLORS = ['#F2A93B', '#4FB88A', '#E4572E', '#7C9CBF', '#B98CE0']

// stock: [{company_id, trolley_type_id, with_partner}], companies, trolleyTypes
export function StockByCompanyChart({ stock, companies, trolleyTypes }) {
  const data = companies.map((c) => {
    const row = { name: c.name }
    trolleyTypes.forEach((tt) => {
      const s = stock.find((x) => x.company_id === c.id && x.trolley_type_id === tt.id)
      row[tt.name] = s?.with_partner ?? 0
    })
    return row
  })
  return (
    <div className="card">
      <h3 style={{ fontSize: 14, marginBottom: 14 }}>Stock currently with each company</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid stroke="#333B47" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip contentStyle={{ background: '#20262F', border: '1px solid #333B47', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {trolleyTypes.map((tt, i) => (
            <Bar key={tt.id} dataKey={tt.name} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MyCompanyStockChart({ myStock }) {
  return (
    <div className="card mt-16">
      <h3 style={{ fontSize: 14, marginBottom: 14 }}>My Company — own inventory by type</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={myStock.map((s) => ({ name: s.name, Stock: s.qty }))}>
          <CartesianGrid stroke="#333B47" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip contentStyle={{ background: '#20262F', border: '1px solid #333B47', borderRadius: 8 }} />
          <Bar dataKey="Stock" fill="#7C9CBF" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
export function VolumeByCompanyChart({ txs, companies }) {
  const data = companies.map((c) => {
    const dispatched = txs
      .filter((t) => t.company_id === c.id && t.direction === 'outbound')
      .reduce((s, t) => s + t.items.reduce((a, it) => a + (it.received_qty ?? it.sent_qty), 0), 0)
    const returned = txs
      .filter((t) => t.company_id === c.id && t.direction === 'inbound')
      .reduce((s, t) => s + t.items.reduce((a, it) => a + (it.received_qty ?? it.sent_qty), 0), 0)
    const mismatches = txs.filter((t) => t.company_id === c.id && t.status === 'mismatch').length
    return { name: c.name, Dispatched: dispatched, Returned: returned, Mismatches: mismatches }
  })
  return (
    <div className="card mt-16">
      <h3 style={{ fontSize: 14, marginBottom: 14 }}>This month — dispatched vs returned, per company</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid stroke="#333B47" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
          <YAxis stroke="#9CA3AF" fontSize={12} />
          <Tooltip contentStyle={{ background: '#20262F', border: '1px solid #333B47', borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Dispatched" fill="#F2A93B" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Returned" fill="#4FB88A" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Mismatches" fill="#E4572E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
