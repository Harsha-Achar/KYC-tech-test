import { clients } from './clients'

export const dashboardKpis = {
  totalIntegrations: clients.length + 48,
  successfulIntegrations: clients.filter((c) => c.status === 'Successful').length + 32,
  inProgress: clients.filter((c) => c.status === 'In Progress').length + 8,
  failedOrIssues:
    clients.filter((c) => c.status === 'Failed' || c.status === 'Facing Issues').length + 6,
  successRatePct: 88.4,
  avgResolutionHours: 40,
}

export const recentActivities = [
  {
    id: 'a1',
    label: 'ISS-24081 updated — Identity & Security',
    time: '2026-04-08T07:40:00Z',
    type: 'issue' as const,
  },
  {
    id: 'a2',
    label: 'Meridian Global Payments — health score improved to 92',
    time: '2026-04-08T06:55:00Z',
    type: 'health' as const,
  },
  {
    id: 'a3',
    label: 'New upload ready for analysis: oauth-sandbox-trace.log',
    time: '2026-04-07T11:05:00Z',
    type: 'upload' as const,
  },
  {
    id: 'a4',
    label: 'ISS-24058 escalated to Architecture Review',
    time: '2026-04-07T16:10:00Z',
    type: 'escalation' as const,
  },
  {
    id: 'a5',
    label: 'KB-0994 viewed 24 times this week',
    time: '2026-04-07T09:00:00Z',
    type: 'kb' as const,
  },
]

export const escalationQueue = [
  {
    id: 'e1',
    issueId: 'ISS-24058',
    client: 'Vertex Insurance Group',
    priority: 'Critical' as const,
    reason: 'mTLS blocker — legacy edge',
    waitingHours: 96,
  },
  {
    id: 'e2',
    issueId: 'ISS-23981',
    client: 'BluePeak Payments Inc.',
    priority: 'Critical' as const,
    reason: 'PGP cipher rejection — reporting',
    waitingHours: 72,
  },
  {
    id: 'e3',
    issueId: 'ISS-24072',
    client: 'Sterling Retail Banking Co.',
    priority: 'High' as const,
    reason: 'SLA breached — DB pool',
    waitingHours: 54,
  },
]
