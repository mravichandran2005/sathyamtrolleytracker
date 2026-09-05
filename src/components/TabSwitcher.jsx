export default function TabSwitcher({ tabs, active, onChange }) {
  return (
    <>
      <div className="tabs tabs-desktop">
        {tabs.map((t) => (
          <button key={t} className={`tab ${active === t ? 'active' : ''}`} onClick={() => onChange(t)}>{t}</button>
        ))}
      </div>
      <select className="tabs-mobile" value={active} onChange={(e) => onChange(e.target.value)} aria-label="Section">
        {tabs.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </>
  )
}
