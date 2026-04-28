import { getExtraApiProducts } from '../utils/registry'

export const filterStatus = [
  'Successful',
  'In Progress',
  'Failed',
  'Facing Issues',
  'Resolved',
  'Escalated',
] as const

export const filterSeverity = ['Low', 'Medium', 'High', 'Critical'] as const

export const filterCategory = [
  'Integration Errors',
  'Database Problems',
  'Security Issues',
  'Compliance Constraints',
  'Architecture Design Problems',
  'Scalability Issues',
] as const

export const filterRegion = ['AMER', 'EMEA', 'APAC', 'Global'] as const

export const filterApiProduct = [
  'Payments API',
  'Treasury API',
  'Account Validation API',
  'FX Rates API',
  'Transaction Reporting API',
  'Identity / OAuth API',
  'Unified',
] as const

export function getApiProducts(): string[] {
  // dynamic extension (ex: added via Upload Center)
  // kept as function to avoid changing the existing design system.
  return Array.from(new Set([...filterApiProduct, ...getExtraApiProducts()])).sort((a, b) => a.localeCompare(b))
}

export const filterSupportTeam = [
  'Payments Integration',
  'Treasury & Cash',
  'Identity & Security',
  'Data & Reporting',
  'Architecture Review',
] as const

export const filterIntegrationPhase = [
  'Discovery',
  'Design',
  'Sandbox',
  'UAT',
  'Production Pilot',
  'Production',
] as const
