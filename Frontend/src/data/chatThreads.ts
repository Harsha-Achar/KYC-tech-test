import type { ChatThread } from '../types'

export const chatThreads: ChatThread[] = [
  {
    threadId: 'thr-001',
    clientName: 'BluePeak Payments Inc.',
    issueContext: 'OAuth sandbox token exchange failures during UAT',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content:
          'We are getting invalid_grant on token exchange in sandbox. Redirect URI matches the portal.',
        timestamp: '2026-04-07T10:12:00Z',
        attachments: ['oauth-sandbox-trace.log'],
      },
      {
        id: 'm2',
        role: 'assistant',
        content:
          'I reviewed the trace: the authorization code is reused across two parallel browser sessions, and the second exchange correctly fails with invalid_grant. I also see a 90-second skew between your app server and the token endpoint.',
        timestamp: '2026-04-07T10:14:00Z',
      },
      {
        id: 'm3',
        role: 'user',
        content: 'We have two QA machines hitting the same user login — could that explain it?',
        timestamp: '2026-04-07T10:16:00Z',
      },
      {
        id: 'm4',
        role: 'assistant',
        content:
          'Yes. Codes are single-use. Isolate tests per session or use distinct test users. Next, sync NTP on both QA hosts and rotate the client secret once to rule out stale cache.',
        timestamp: '2026-04-07T10:17:00Z',
      },
    ],
    diagnosisSummary: {
      classification: 'OAuth flow — authorization code reuse & clock skew',
      rootCause:
        'Parallel sessions consuming the same auth code; secondary time skew amplifies intermittent failures.',
      confidence: 72,
      impactLevel: 'High — blocks UAT sign-off',
      affectedLayers: {
        api: true,
        database: false,
        security: true,
        architecture: false,
        scalability: false,
      },
      similarKnownIssues: 14,
      suggestedNextAction: 'Enforce single-flight auth per code; sync time; re-run exchange.',
      escalationRecommendation: 'Escalate if invalid_grant persists after secret rotation.',
    },
    recommendedSteps: [
      'Disable parallel OAuth flows sharing one authorization code.',
      'Sync NTP on all QA hosts; verify skew < 30s.',
      'Rotate client secret in developer portal; update vault references.',
      'Re-run token exchange with fresh login.',
    ],
    similarCases: [
      { id: 'ISS-23810', title: 'Sandbox OAuth invalid_grant — dual session', match: 96 },
      { id: 'ISS-23644', title: 'Clock skew causing intermittent OAuth failures', match: 88 },
    ],
  },
  {
    threadId: 'thr-002',
    clientName: 'Sterling Retail Banking Co.',
    issueContext: 'Database timeouts on payment status callbacks',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content:
          'Analyze this database timeout error from the payments API integration — callbacks stall under load.',
        timestamp: '2026-04-05T14:25:00Z',
        attachments: ['payments-openapi-v3.pdf', 'callback-db-timeout.log'],
      },
      {
        id: 'm2',
        role: 'assistant',
        content:
          'The wait events show connection pool saturation: 50/50 connections in use while webhook handler performs synchronous ledger writes. Under 180 rps webhook bursts, queue depth grows and queries exceed 30s statement timeout.',
        timestamp: '2026-04-05T14:28:00Z',
      },
    ],
    diagnosisSummary: {
      classification: 'Database pool exhaustion under inbound webhook load',
      rootCause: 'Synchronous heavy DB work on webhook thread without backpressure.',
      confidence: 88,
      impactLevel: 'Critical — pilot stability',
      affectedLayers: {
        api: true,
        database: true,
        security: false,
        architecture: true,
        scalability: true,
      },
      similarKnownIssues: 9,
      suggestedNextAction: 'Introduce async queue for webhook processing; tune pool and timeouts.',
      escalationRecommendation: 'Architecture review if legacy middleware blocks queueing.',
    },
    recommendedSteps: [
      'Acknowledge webhook quickly; enqueue payload for async workers.',
      'Increase pool size cautiously; add statement timeout guards.',
      'Add index on status lookup columns used in callback path.',
      'Load test with production-like burst curve.',
    ],
    similarCases: [
      { id: 'ISS-24072', title: 'DB timeout during transaction status callbacks', match: 99 },
      { id: 'KB-1029', title: 'Connection pool exhaustion during webhooks', match: 94 },
    ],
  },
  {
    threadId: 'thr-003',
    clientName: 'Vertex Insurance Group',
    issueContext: 'Legacy middleware and mTLS to Treasury API',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content:
          'Compare this client architecture against JPMC recommended integration patterns — we cannot complete mTLS from our edge.',
        timestamp: '2026-04-03T11:50:00Z',
        attachments: ['legacy-proxy-topology.drawio'],
      },
      {
        id: 'm2',
        role: 'assistant',
        content:
          'The topology shows TLS termination on an appliance that only advertises legacy cipher suites. JPMC endpoints require modern TLS 1.2+ with specific curves for mTLS. Recommended pattern: place a supported reverse proxy in front that handles mTLS, or establish a dedicated egress zone.',
        timestamp: '2026-04-03T11:55:00Z',
      },
    ],
    diagnosisSummary: {
      classification: 'Architecture — incompatible TLS termination for mTLS',
      rootCause: 'Edge appliance cannot negotiate required handshake for mutual TLS.',
      confidence: 94,
      impactLevel: 'Critical — go-live blocker',
      affectedLayers: {
        api: true,
        database: false,
        security: true,
        architecture: true,
        scalability: false,
      },
      similarKnownIssues: 6,
      suggestedNextAction: 'Replace or bypass TLS appliance for API egress path.',
      escalationRecommendation: 'Mandatory architecture workshop with JPMC field team.',
    },
    recommendedSteps: [
      'Inventory cipher suites supported by current appliance.',
      'Pilot NGINX/Envoy or approved corporate proxy for mTLS.',
      'Validate full chain trust stores on both sides.',
      'Document failover and certificate rotation runbook.',
    ],
    similarCases: [
      { id: 'ISS-24058', title: 'Legacy middleware encryption standard gap', match: 97 },
      { id: 'KB-1015', title: 'Legacy TLS appliances and mTLS', match: 96 },
    ],
  },
]

export const suggestedPrompts = [
  'Why is my OAuth flow failing during token exchange?',
  'Analyze this database timeout error from the payments API integration',
  'Compare this client architecture against JPMC recommended integration patterns',
  'Why is this implementation failing despite following the API documentation?',
]
