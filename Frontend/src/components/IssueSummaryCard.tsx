import { SeverityBadge } from './SeverityBadge'
import { IssueStatusPill } from './IssueStatusPill'
import { formatShortDate } from '../utils/formatters'
import type { Issue } from '../types'
import { getClientName } from '../data/clients'

export function IssueSummaryCard({ issue }: { issue: Issue }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{issue.id}</span>
        <SeverityBadge severity={issue.severity} />
        <IssueStatusPill status={issue.status} />
      </div>
      <p className="mt-2 text-sm text-gray-900">{issue.title}</p>
      <p className="mt-1 text-xs text-muted">
        {getClientName(issue.clientId)} · {issue.category}
      </p>
      <p className="mt-2 text-xs text-muted">Updated {formatShortDate(issue.updatedAt)}</p>
    </div>
  )
}
