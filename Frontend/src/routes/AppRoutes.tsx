import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { OverviewDashboard } from '../pages/OverviewDashboard'
import { IssueMonitor } from '../pages/IssueMonitor'
import { IssueInsights } from '../pages/IssueInsights'
import { AITroubleshooter } from '../pages/AITroubleshooter'
import { UploadCenter } from '../pages/UploadCenter'
import { ClientChatbotPage } from '../pages/ClientChatbotPage'
import { CompatibilityPage } from '../pages/CompatibilityPage'

export function AppRoutes({
  role,
  email,
  onLogout,
  onSwitchRole,
}: {
  role: 'admin' | 'client'
  email: string
  onLogout: () => void
  onSwitchRole: () => void
}) {
  if (role === 'client') {
    return (
      <Routes>
        <Route element={<AppShell role={role} onLogout={onLogout} onSwitchRole={onSwitchRole} />}>

          {/* Home */}
          <Route path="/" element={<ClientChatbotPage userEmail={email} />} />

          {/* ⭐ IMPORTANT */}
          <Route path="/compatibility" element={<CompatibilityPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<AppShell role={role} onLogout={onLogout} onSwitchRole={onSwitchRole} />}>
        <Route path="/" element={<OverviewDashboard />} />
        <Route path="/issues" element={<IssueMonitor />} />
        <Route path="/issue-insights" element={<IssueInsights />} />
        <Route path="/ai" element={<AITroubleshooter adminEmail={''} />} />
        <Route path="/uploads" element={<UploadCenter />} />

        {/* ❌ NO compatibility */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}