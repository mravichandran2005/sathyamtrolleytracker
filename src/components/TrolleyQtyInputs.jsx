// Renders one number input per trolley type.
// `values` is { [trolley_type_id]: number }, `onChange(typeId, value)` updates it.
export default function TrolleyQtyInputs({ trolleyTypes, values, onChange }) {
  return (
    <div className="grid grid-3">
      {trolleyTypes.map((tt) => (
        <div key={tt.id}>
          <label>{tt.name}</label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            className="mono"
            value={values[tt.id] ?? ''}
            placeholder="0"
            onChange={(e) => onChange(tt.id, e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
      ))}
    </div>
  )
}
