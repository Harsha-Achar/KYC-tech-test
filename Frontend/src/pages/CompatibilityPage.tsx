import { useMemo, useState } from 'react'
import { SectionCard } from '../components/SectionCard'

type CompatibilitySignal = {
  key: string
  label: string
  keywords: string[]
  risk: string
  nextStep: string
}

type CompatibilityResult = {
  score: number
  status: 'High Compatibility' | 'Medium Compatibility' | 'Partial Compatibility' | 'Low Compatibility'
  matches: string[]
  gaps: string[]
  risks: string[]
  nextSteps: string[]
  technicalRecommendations: TechnicalRecommendation[]
}

type TechnicalRecommendation = {
  related_text?: string
  title: string
  type: string
  details: {
    technical_requirements: string[]
    implementation_steps?: string[]
    security: string[]
  }
}

const SIGNALS: CompatibilitySignal[] = [
  {
    key: 'api',
    label: 'API integration strategy',
    keywords: ['api', 'endpoint', 'rest', 'graphql', 'webhook'],
    risk: 'API contract mismatches can block integration timelines.',
    nextStep: 'Validate endpoint contracts and map request/response schemas.',
  },
  {
    key: 'security',
    label: 'Security and access controls',
    keywords: ['security', 'oauth', 'jwt', 'token', 'certificate', 'tls', 'ssl', 'sso'],
    risk: 'Security control gaps can delay go-live and compliance approval.',
    nextStep: 'Align auth mechanisms, cert requirements, and key rotation policy.',
  },
  {
    key: 'data',
    label: 'Data format and payload compatibility',
    keywords: ['json', 'xml', 'csv', 'schema', 'format', 'payload'],
    risk: 'Data format incompatibility can cause parsing and processing failures.',
    nextStep: 'Define canonical payload format and versioning rules.',
  },
  {
    key: 'architecture',
    label: 'Architecture and infrastructure fit',
    keywords: ['architecture', 'microservices', 'cloud', 'aws', 'azure', 'gcp', 'on-prem'],
    risk: 'Architecture differences can increase integration effort and cost.',
    nextStep: 'Review deployment topology, networking, and environment constraints.',
  },
  {
    key: 'operations',
    label: 'Operational readiness and monitoring',
    keywords: ['monitoring', 'logging', 'sla', 'alert', 'support', 'observability'],
    risk: 'Weak operational readiness can increase incident frequency post-launch.',
    nextStep: 'Agree on SLAs, alerts, runbooks, and production support ownership.',
  },
  {
    key: 'documents',
    label: 'Document and file handling requirements',
    keywords: ['pdf', 'docx', 'file', 'upload', 'storage', 'document'],
    risk: 'Unsupported file handling flows can impact core user journeys.',
    nextStep: 'Confirm supported file types, limits, and storage lifecycle controls.',
  },
]

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s/-]/g, ' ')
}

function includesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

function evaluateCompatibility(jpmcText: string, clientText: string): CompatibilityResult {
  const normalizedJpmc = normalizeText(jpmcText)
  const normalizedClient = normalizeText(clientText)

  const scopedSignals = SIGNALS.map((signal) => ({
    ...signal,
    jpmcHas: includesAnyKeyword(normalizedJpmc, signal.keywords),
    clientHas: includesAnyKeyword(normalizedClient, signal.keywords),
  }))

  const activeSignals = scopedSignals.filter((signal) => signal.jpmcHas || signal.clientHas)
  const workingSet = activeSignals.length > 0 ? activeSignals : scopedSignals

  const matches = workingSet
    .filter((signal) => signal.jpmcHas && signal.clientHas)
    .map((signal) => `${signal.label} is aligned across both sides.`)

  const jpmcOnlyGaps = workingSet
    .filter((signal) => signal.jpmcHas && !signal.clientHas)
    .map((signal) => `Client details do not clearly cover ${signal.label.toLowerCase()}.`)

  const clientOnlyGaps = workingSet
    .filter((signal) => !signal.jpmcHas && signal.clientHas)
    .map((signal) => `JPMC requirements do not clearly specify ${signal.label.toLowerCase()}.`)

  const gaps = [...jpmcOnlyGaps, ...clientOnlyGaps]
  const gapSignals = workingSet.filter((signal) => signal.jpmcHas !== signal.clientHas)
  const matchedCount = workingSet.filter((signal) => signal.jpmcHas && signal.clientHas).length
  const baseline = workingSet.length || 1

  const baseScore = Math.round((matchedCount / baseline) * 100)
  const detailBonus = Math.min(12, Math.round((jpmcText.length + clientText.length) / 250))
  const score = Math.max(0, Math.min(100, baseScore + detailBonus))

  const status: CompatibilityResult['status'] =
    score > 85
      ? 'High Compatibility'
      : score >= 60
        ? 'Medium Compatibility'
        : score > 30
          ? 'Partial Compatibility'
          : 'Low Compatibility'

  return {
    score,
    status,
    matches:
      matches.length > 0
        ? matches
        : ['Limited direct overlap detected across the current requirement descriptions.'],
    gaps: gaps.length > 0 ? gaps : ['No major compatibility gaps detected in this draft comparison.'],
    risks:
      gapSignals.length > 0
        ? gapSignals.map((signal) => signal.risk)
        : ['Current inputs indicate low immediate integration risk areas.'],
    nextSteps:
      gapSignals.length > 0
        ? gapSignals.map((signal) => signal.nextStep)
        : ['Proceed to a detailed API contract and security validation workshop.'],
    technicalRecommendations: [],
  }
}

function statusBadgeClass(status: CompatibilityResult['status']): string {
  if (status === 'High Compatibility') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'Medium Compatibility') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (status === 'Partial Compatibility') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-rose-200 bg-rose-50 text-rose-700'
}

function findTechnicalRecommendation(
  recommendations: TechnicalRecommendation[],
  text: string,
): TechnicalRecommendation | null {
  const normalizedText = text.trim().toLowerCase()
  return (
    recommendations.find((item) => item.related_text?.trim().toLowerCase() === normalizedText) ??
    recommendations.find((item) => normalizedText.includes(item.title.toLowerCase().split(' ')[0])) ??
    null
  )
}

export function CompatibilityPage() {
  const [clientInput, setClientInput] = useState('')
  const [result, setResult] = useState<CompatibilityResult | null>(null)
  const [activeRecommendation, setActiveRecommendation] = useState<TechnicalRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const canEvaluate = useMemo(() => Boolean(clientInput.trim().length > 0), [clientInput])

  async function onCheckCompatibility() {
    if (!canEvaluate || loading) return
    setLoading(true)
    setApiError(null)
    try {
      const res = await fetch('/api/compatibility/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_text: clientInput,
        }),
      })

      if (!res.ok) {
        let detail = `Compatibility check failed (${res.status})`
        try {
          const body = (await res.json()) as { detail?: string }
          if (body?.detail) detail = body.detail
        } catch {
          // Use default message when backend body is not JSON.
        }
        throw new Error(detail)
      }

      const data = (await res.json()) as {
        compatibility_score?: number
        status?: CompatibilityResult['status']
        key_matches?: string[]
        key_gaps?: string[]
        risks?: string[]
        recommended_next_steps?: string[]
        technical_recommendations?: TechnicalRecommendation[]
      }

      setResult({
        score: Math.max(0, Math.min(100, Number(data.compatibility_score ?? 0))),
        status:
          data.status === 'High Compatibility' ||
          data.status === 'Medium Compatibility' ||
          data.status === 'Partial Compatibility' ||
          data.status === 'Low Compatibility'
            ? data.status
            : 'Partial Compatibility',
        matches: Array.isArray(data.key_matches) && data.key_matches.length > 0 ? data.key_matches : ['No clear direct matches identified.'],
        gaps: Array.isArray(data.key_gaps) && data.key_gaps.length > 0 ? data.key_gaps : ['No major compatibility gaps identified.'],
        risks: Array.isArray(data.risks) && data.risks.length > 0 ? data.risks : ['No immediate critical risks identified.'],
        nextSteps:
          Array.isArray(data.recommended_next_steps) && data.recommended_next_steps.length > 0
            ? data.recommended_next_steps
            : ['Proceed with detailed architecture and API contract validation.'],
        technicalRecommendations: Array.isArray(data.technical_recommendations) ? data.technical_recommendations : [],
      })
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Compatibility API failed. Showing local heuristic result.')
      const fallback = evaluateCompatibility('cortexa baseline', clientInput)
      setResult({
        ...fallback,
        technicalRecommendations: [],
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4 px-4 pt-5 pb-6 rounded-2xl 
bg-[radial-gradient(circle_at_top,_#F9FAFB,_#E5E7EB)] ">
      <div>
        <h1 className=" text-small font-medium text-black-900">Compatibility Checker</h1>

      </div>

      <SectionCard title="">

        <label className="flex flex-col gap-2">
          <span className="-mt-5 text-sm font-medium text-gray-800">Client Side</span>
          <textarea
            value={clientInput}
            onChange={(e) => setClientInput(e.target.value)}
            className="min-h-[260px] w-full resize-none rounded-xl border border-[#E5E7EB] p-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:ring-primary/20"
            placeholder="Paste client technical stack, architecture, integration needs, formats, security setup, infrastructure details, etc."
          />

        </label>
        <div className="mt-5">
          <button
            type="button"
            onClick={() => void onCheckCompatibility()}
            disabled={!canEvaluate || loading}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 bg-gradient-to-r from-[#7A3F1D] via-[#9C5A2F] to-[#B97A52] px-4 shadow-sm cursor-pointer"
          >
            {loading ? 'Checking...' : 'Check Compatibility'}
          </button>
        </div>
        {apiError ? <p className="mt-3 text-xs font-medium text-amber-700">{apiError}</p> : null}
      </SectionCard>

      {result ? (
        <SectionCard title="Compatibility Result" className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-[#E5E7EB] bg-gray-50/80 p-4 lg:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Compatibility Score</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{result.score}%</p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-gray-50/80 p-4 lg:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Status</p>
              <span
                className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                  result.status,
                )}`}
              >
                {result.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Key matches</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {result.matches.map((line) => (
                  <li key={line} className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Key gaps</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {result.gaps.map((line) => {
                  const rec = findTechnicalRecommendation(result.technicalRecommendations, line)
                  return (
                    <li key={line}>
                      <button
                        type="button"
                        onClick={() => rec && setActiveRecommendation(rec)}
                        className="w-full rounded-md bg-amber-50 px-3 py-2 text-left text-amber-800 transition hover:bg-amber-100"
                      >
                        {line}
                        {rec ? <span className="ml-2 text-xs font-semibold text-amber-900">View technical details</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Risks / concerns</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {result.risks.map((line) => (
                  <li key={line} className="rounded-md bg-rose-50 px-3 py-2 text-rose-800">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
              <h3 className="text-sm font-semibold text-gray-900">Recommended next steps</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-700">
                {result.nextSteps.map((line) => {
                  const rec = findTechnicalRecommendation(result.technicalRecommendations, line)
                  return (
                    <li key={line}>
                      <button
                        type="button"
                        onClick={() => rec && setActiveRecommendation(rec)}
                        className="w-full rounded-md bg-sky-50 px-3 py-2 text-left text-sky-800 transition hover:bg-sky-100"
                      >
                        {line}
                        {rec ? <span className="ml-2 text-xs font-semibold text-sky-900">View more detail</span> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </SectionCard>
      ) : null}
      {activeRecommendation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-gray-900">{activeRecommendation.title}</h3>
              <button
                type="button"
                onClick={() => setActiveRecommendation(null)}
                className="rounded-md border border-[#E5E7EB] px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
            {activeRecommendation.related_text ? (
              <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Selected point</p>
                <p className="mt-1 text-sm text-gray-800">{activeRecommendation.related_text}</p>
              </div>
            ) : null}
            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900">Technical requirements</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {activeRecommendation.details.technical_requirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Security requirements</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {activeRecommendation.details.security.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}