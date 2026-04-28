type EmptyStateProps = {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white px-6 py-12 text-center">
      <p className="text-base font-semibold text-gray-900">{title}</p>
      {description ? <p className="mt-2 max-w-md text-sm text-muted">{description}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-secondary"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
