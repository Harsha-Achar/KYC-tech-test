export type IntegrationStatus =
  | 'Successful'
  | 'In Progress'
  | 'Failed'
  | 'Facing Issues'
  | 'Resolved'
  | 'Escalated'

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'

export type IssueCategory =
  | 'Integration Errors'
  | 'Database Problems'
  | 'Security Issues'
  | 'Compliance Constraints'
  | 'Architecture Design Problems'
  | 'Scalability Issues'

export type ArchitectureRisk = 'Low' | 'Medium' | 'High' | 'Critical'

export interface Client {
  id: string
  name: string
  segment: string
  region: string
  industry: string
  apiProduct: string
  integrationPhase: string
  status: IntegrationStatus
  healthScore: number
  openIssues: number
  criticalIssues: number
  lastActivity: string
  supportLead: string
  complianceFlag: boolean
  architectureRisk: ArchitectureRisk
  legacySystem: boolean
  environment: string
}

export interface Issue {
  id: string
  clientId: string
  title: string
  category: IssueCategory
  severity: Severity
  status: string
  rootCause: string
  rootCauseStatus: 'Identified' | 'Under Investigation' | 'Unknown' | 'Hypothesis'
  createdAt: string
  updatedAt: string
  assignedTeam: string
  slaRisk: 'On Track' | 'At Risk' | 'Breached'
  detectedSource: string
  affectedApi: string
  environment: string
  confidence: number
  estimatedFixTime: string
  businessImpact: string
  technicalSummary: string
}

export type UploadStatus =
  | 'Uploaded'
  | 'Updated'
  | 'Archived'

export interface UploadAsset {
  id: string
  fileName: string
  tag?: string
  uploadedBy: string
  uploadDate: string
  status: UploadStatus
}

export type ClientConfigEnvironment = 'Sandbox' | 'Production' | 'UAT'
export type ClientConfigSystemType = 'Cloud-native' | 'Legacy' | 'Hybrid'
export type ClientConfigPriority = 'High' | 'Medium' | 'Low'

export interface ClientConfigurationRecord {
  client_id: string
  client_name: string
  assigned_to: string
  product: 'Unified'
  services: string[]
  environment: ClientConfigEnvironment
  system_type: ClientConfigSystemType
  legacy_present: boolean
  llm_fallback: boolean
  industry?: string
  priority: ClientConfigPriority
  created_at: string
  updated_at?: string
}

export interface KnowledgeArticle {
  id: string
  title: string
  category: IssueCategory | string
  summary: string
  rootCause: string
  resolution: string
  matchScore: number
  tags: string[]
  product: string
  lastUpdated: string
  status: 'Resolved' | 'Open' | 'Deprecated'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  attachments?: string[]
  diagnosis?: string
  rootCause?: string
  root_cause?: string
}

export type ConversationStatus = 'resolved' | 'in-progress' | 'escalate'

export interface ConversationRecord {
  id: string
  client_name: string
  api_product: string
  environment: ClientConfigEnvironment
  status: ConversationStatus
  created_at: string
  updated_at: string
}

export interface PersistentChatThread {
  id: string
  owner_role: 'admin' | 'client'
  owner_email: string
  client_id: string
  client_name: string
  api_product: string
  environment: ClientConfigEnvironment
  status?: ConversationStatus
  title: string
  diagnosis: string
  root_cause: string
  created_at: string
  updated_at: string
  messages: ChatMessage[]
}

export interface DiagnosisSummary {
  classification: string
  rootCause: string
  confidence: number
  impactLevel: string
  affectedLayers: {
    api: boolean
    database: boolean
    security: boolean
    architecture: boolean
    scalability: boolean
  }
  similarKnownIssues: number
  suggestedNextAction: string
  escalationRecommendation: string
}

export interface ChatThread {
  threadId: string
  clientName: string
  issueContext: string
  messages: ChatMessage[]
  diagnosisSummary: DiagnosisSummary
  recommendedSteps: string[]
  similarCases: { id: string; title: string; match: number }[]
}

export interface UserProfile {
  name: string
  role: string
  team: string
  email: string
  avatar: string
  lastLogin: string
}

export interface TrendPoint {
  date: string
  value: number
  [key: string]: string | number | undefined
}

export interface AnalyticsBundle {
  issueTrend: TrendPoint[]
  severityBreakdown: { name: string; value: number }[]
  issueByCategory: {
    label: string
    Integration: number
    DB: number
    Security: number
    Compliance: number
    Architecture: number
    Scalability: number
  }[]
  resolutionTimeTrend: TrendPoint[]
  healthScoreDistribution: { range: string; count: number }[]
  topFailureReasons: { reason: string; count: number }[]
  apiFailureRate: { api: string; rate: number }[]
  supportWorkload: { team: string; open: number; resolved: number }[]
  confidenceTrend: TrendPoint[]
  integrationSuccessRate: TrendPoint[]
  resolutionByCategory: { category: string; hours: number }[]
  issueVolumeBySegment: { segment: string; count: number }[]
  issueVolumeByProduct: { product: string; count: number }[]
  scatterRiskResolution: { risk: number; hours: number; client: string }[]
  heatmapSeverityCause: { severity: string; cause: string; count: number }[]
  uploadSourceContribution: { source: string; count: number }[]
}