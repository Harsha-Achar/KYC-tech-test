export function ProgressStepper({
  steps,
  currentIndex,
}: {
  steps: string[]
  currentIndex: number
}) {
  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
      {steps.map((s, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <li key={s} className="flex items-center gap-2 sm:flex-initial">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? 'bg-success text-white'
                  : active
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`text-xs font-medium ${active ? 'text-primary' : done ? 'text-gray-800' : 'text-muted'}`}
            >
              {s}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-2 hidden h-px w-6 bg-[#E5E7EB] sm:inline-block" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
