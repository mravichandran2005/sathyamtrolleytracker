const STATUS_LABEL = { pending: 'Pending', acknowledged: 'Matched', mismatch: 'Mismatch' }

export default function ManifestRow({ tx, showCompany = true, action }) {
  const dirLabel = tx.direction === 'outbound' ? 'Sent out' : 'Returned in'
  return (
    <div className={`manifest-row ${tx.status}`}>
      <div className="manifest-main">
        <div className="row-between">
          <div className="manifest-title">
            {dirLabel}{showCompany && tx.company ? ` · ${tx.company.name}` : ''}
          </div>
          <span className={`stamp ${tx.status}`}>{STATUS_LABEL[tx.status]}</span>
        </div>
        <div className="manifest-sub">
          {new Date(tx.created_at).toLocaleString()}
          {tx.vehicles?.number ? ` · Vehicle ${tx.vehicles.number}` : ''}
          {tx.note ? ` · ${tx.note}` : ''}
        </div>
        <div className="mt-8">
          {tx.items.map((it) => (
            <div className="item-line" key={it.id}>
              <span>{it.trolley_types.name}</span>
              <span className="qty">
                {it.sent_qty}{it.received_qty !== null && it.received_qty !== it.sent_qty ? ` → ${it.received_qty}` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
      {action}
    </div>
  )
}
