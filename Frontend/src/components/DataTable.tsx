import type { ReactNode } from 'react'

export type Column<T> = {
  key: string
  header: ReactNode
  className?: string
  cell: (row: T) => ReactNode
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (p: number) => void
  }
}

/* 🔥 PRIORITY BADGE HELPER */
function renderPriority(value: any) {
  if (typeof value === 'string') {
    const v = value.toLowerCase()

    if (v === 'high') {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          HIGH
        </span>
      )
    }

    if (v === 'medium') {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          MEDIUM
        </span>
      )
    }

    if (v === 'low') {
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
          LOW
        </span>
      )
    }
  }

  return value
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty,
  pagination,
}: DataTableProps<T>) {
  if (!rows.length && empty) {
    return <>{empty}</>
  }

  const pageRows = pagination
    ? rows.slice(
      (pagination.page - 1) * pagination.pageSize,
      pagination.page * pagination.pageSize
    )
    : rows

  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1

  return (
    <div className="overflow-hidden rounded-xl border border-black/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">

          {/* 🔷 Header */}
          <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#E5E7EB]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-700 ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* 🔷 Body */}
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-gray-200 transition hover:bg-primary/[0.03] ${i % 2 === 1 ? 'bg-gray-50/70' : 'bg-white'
                  } ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => {
                  const value = col.cell(row)

                  return (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-4 py-3 text-gray-800 ${col.className ?? ''}`}
                    >
                      {renderPriority(value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔷 Pagination */}
      {pagination && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
          <span>
            Page {pagination.page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              className="rounded-md border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Prev
            </button>

            <button
              type="button"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              className="rounded-md border border-gray-300 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}