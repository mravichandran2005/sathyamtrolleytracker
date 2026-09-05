import * as XLSX from 'xlsx'

export default function ExportButton({ txs, trolleyTypes, label = 'Export to Excel' }) {
  function exportNow() {
    const rows = txs.map((tx) => {
      const row = {
        Date: new Date(tx.created_at).toLocaleString(),
        Direction: tx.direction === 'outbound' ? 'Sent out' : 'Returned in',
        Company: tx.company?.name || '',
        Vehicle: tx.vehicles?.number || '',
        Status: tx.status,
        Note: tx.note || '',
      }
      trolleyTypes.forEach((tt) => {
        const item = tx.items.find((it) => it.trolley_type_id === tt.id)
        row[`${tt.name} — sent`] = item?.sent_qty ?? ''
        row[`${tt.name} — received`] = item?.received_qty ?? ''
      })
      return row
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `trolley-transactions-${stamp}.xlsx`)
  }

  return (
    <button className="ghost" onClick={exportNow} disabled={txs.length === 0}>
      {label}
    </button>
  )
}
