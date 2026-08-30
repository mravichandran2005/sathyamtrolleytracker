import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import MasterDashboard from './pages/MasterDashboard'
import MyCompanyPortal from './pages/MyCompanyPortal'
import PartnerPortal from './pages/PartnerPortal'
import { BRAND_NAME, APP_NAME, LOGO_PATH, ROLE_LABEL } from './brand'

function Logo() {
  return LOGO_PATH ? (
    <img src={LOGO_PATH} alt={BRAND_NAME} style={{ width: 30, height: 30, objectFit: 'contain', borderRadius: 7 }} />
  ) : (
    <div className="brand-mark" />
  )
}

export default function App() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <div className="login-wrap"><div className="skel" style={{ width: 120, height: 14 }} /></div>
  if (!session) return <Login />

  if (!profile || profile.role === 'pending') {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ margin: '0 auto 16px', width: 30 }}><Logo /></div>
          <h2>Waiting for approval</h2>
          <p style={{ color: 'var(--ink-dim)', fontSize: 14 }}>
            Your account is created. The Master needs to assign your role before you can get in.
          </p>
          <button className="ghost mt-16" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  }

  if (!profile.active) {
    return (
      <div className="login-wrap">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ margin: '0 auto 16px', width: 30 }}><Logo /></div>
          <h2>Access disabled</h2>
          <p style={{ color: 'var(--ink-dim)', fontSize: 14 }}>
            Your access has been switched off. Contact your Master to have it restored.
          </p>
          <button className="ghost mt-16" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopBar />
      <div className="main">
        {profile.role === 'master' && <MasterDashboard />}
        {profile.role === 'my_company' && <MyCompanyPortal />}
        {profile.role === 'partner' && <PartnerPortal />}
      </div>
    </div>
  )
}

function TopBar() {
  const { profile, session, signOut } = useAuth()
  return (
    <div className="topbar">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand-name">{BRAND_NAME}</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{APP_NAME}</div>
        </div>
      </div>
      <div className="who">
        <span>{profile.full_name}</span>
        <span className="email">{session.user.email}</span>
        <span className="role-tag">{ROLE_LABEL[profile.role]}</span>
        <button className="ghost small" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
