export function IssueStatusPill({ status }: { status: string }) {
  const base =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

  const styles =
    status === 'OPEN'
      ? 'bg-green-100 text-green-700'
      : status === 'CLOSED'
        ? 'bg-gray-200 text-gray-700'
        : status === 'FAILED'
          ? 'bg-red-100 text-red-700'
          : 'bg-gray-100 text-gray-600'

  return <span className={`${base} ${styles}`}>{status}</span>
}