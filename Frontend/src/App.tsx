import { useState } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { AppRoutes } from './routes/AppRoutes'
import { LoginPage } from './pages/LoginPage'
 
type AuthSession = {
  role: 'admin' | 'client'
  email: string
}
 
const AUTH_KEY = 'affine.techspec.auth'
const QUICK_SWITCH_EMAIL: Record<'admin' | 'client', string> = {
  admin: 'admin@affine.ai',
  client: 'client.user@affine.ai',
}
 
function readSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if ((parsed.role === 'admin' || parsed.role === 'client') && typeof parsed.email === 'string') {
      return { role: parsed.role, email: parsed.email }
    }
    return null
  } catch {
    return null
  }
}
 
function AppContent() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession())
  const navigate = useNavigate() // ✅ now works
 
  function handleLogin(next: AuthSession) {
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    setSession(next)
 
    // 🔥 THIS FIXES YOUR PROBLEM
    if (next.role === 'admin') {
      navigate('/overview-dashboard')
    } else {
      navigate('/')
    }
  }
 
  function handleLogout() {
    window.localStorage.removeItem(AUTH_KEY)
    setSession(null)
    navigate('/') // optional but clean
  }
 
  function handleQuickSwitchRole() {
    setSession((prev) => {
      if (!prev) return prev
      const nextRole: 'admin' | 'client' = prev.role === 'admin' ? 'client' : 'admin'
      const nextSession: AuthSession = {
        role: nextRole,
        email: QUICK_SWITCH_EMAIL[nextRole],
      }
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(nextSession))
 
      // 🔥 also switch page
      navigate(nextRole === 'admin' ? '/overview-dashboard' : '/')
 
      return nextSession
    })
  }
 
  if (!session) {
    return <LoginPage onLogin={handleLogin} />
  }
 
  return (
    <AppRoutes
      role={session.role}
      email={session.email}
      onLogout={handleLogout}
      onSwitchRole={handleQuickSwitchRole}
    />
  )
}
 
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
 