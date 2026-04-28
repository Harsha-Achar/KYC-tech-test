import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatShortDate } from '../utils/formatters'
import type { ChatMessage as Msg } from '../types'

export function ChatMessage({
  message,
  onShowDiagnosis,
}: {
  message: Msg
  onShowDiagnosis?: (message: Msg) => void
}) {
  const isUser = message.role === 'user'
  const canShowDiagnosis = !isUser && typeof onShowDiagnosis === 'function'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'rounded-br-md bg-gradient-to-r from-[#4B1F0F] via-[#6A2E17] to-[#7A3F1D] text-white'
            : 'rounded-bl-md border border-[#E5E7EB] bg-white text-gray-900'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.attachments?.length ? (
          <ul className={`mt-2 space-y-1 text-xs ${isUser ? 'text-white/90' : 'text-gray-500'}`}>
            {message.attachments.map((a) => (
              <li key={a}>Attachment: {a}</li>
            ))}
          </ul>
        ) : null}
        <p className={`mt-2 text-[10px] ${isUser ? 'text-white/70' : 'text-gray-400'}`}>
          {formatShortDate(message.timestamp)}
        </p>
        {canShowDiagnosis ? (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded border border-[#E5E7EB] bg-white px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-50"
              onClick={() => onShowDiagnosis(message)}
            >
              Diagnosis summary
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}