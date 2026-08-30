export function SkeletonStats({ count = 3 }) {
  return (
    <div className="grid grid-3" style={{ marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat">
          <div className="skel" style={{ width: 56, height: 26, marginBottom: 8 }} />
          <div className="skel" style={{ width: '70%', height: 11 }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonManifest({ count = 3 }) {
  return (
    <div className="manifest">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="manifest-row" style={{ borderLeftColor: 'var(--line)' }}>
          <div className="manifest-main">
            <div className="skel" style={{ width: '45%', height: 14, marginBottom: 10 }} />
            <div className="skel" style={{ width: '30%', height: 11, marginBottom: 14 }} />
            <div className="skel" style={{ width: '90%', height: 11, marginBottom: 6 }} />
            <div className="skel" style={{ width: '80%', height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
