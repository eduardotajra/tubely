import { useState } from 'react'
import { MusicNote, Trash, DownloadSimple, Clock, SpinnerGap, CheckCircle, XCircle } from 'phosphor-react'
import { cn, formatDuration, formatDate } from '../lib/utils'
import type { Conversion } from '../types/conversion'

interface ConversionCardProps {
  conversion: Conversion
  onDelete: (id: string) => void
  deleting?: boolean
  apiUrl: string
}

function StatusBadge({ status }: { status: string }) {
  const configs = {
    pending: {
      label: 'Na fila',
      icon: Clock,
      className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    },
    processing: {
      label: 'Convertendo',
      icon: SpinnerGap,
      className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    completed: {
      label: 'Concluído',
      icon: CheckCircle,
      className: 'bg-green-500/10 text-green-400 border-green-500/20',
    },
    failed: {
      label: 'Falhou',
      icon: XCircle,
      className: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
  }
  const config = configs[status as keyof typeof configs] ?? configs.pending
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0',
        config.className,
      )}
    >
      <Icon size={11} className={status === 'processing' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  )
}

export function ConversionCard({ conversion, onDelete, deleting, apiUrl }: ConversionCardProps) {
  const [downloading, setDownloading] = useState(false)

  const downloadUrl = conversion.fileUrl
    ? conversion.fileUrl.startsWith('http')
      ? conversion.fileUrl
      : `${apiUrl}${conversion.fileUrl}`
    : null

  async function handleDownload() {
    if (!downloadUrl) return
    setDownloading(true)
    try {
      const res = await fetch(downloadUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${conversion.title ?? 'audio'}.mp3`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="group flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.06] hover:border-white/10">
      {/* Thumbnail */}
      {conversion.thumbnailUrl ? (
        <img
          src={conversion.thumbnailUrl}
          alt={conversion.title ?? 'Thumbnail'}
          className="h-14 w-24 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-14 w-24 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
          <MusicNote size={20} className="text-white/20" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between min-w-0 gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white/90 leading-snug">
              {conversion.title ?? 'Carregando...'}
            </p>
            {conversion.author && (
              <p className="truncate text-xs text-white/35 mt-0.5">{conversion.author}</p>
            )}
          </div>
          <StatusBadge status={conversion.status} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[11px] text-white/25">
            {conversion.duration && <span>{formatDuration(conversion.duration)}</span>}
            <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px]">{conversion.quality} kbps</span>
            <span>{formatDate(conversion.createdAt)}</span>
            {conversion.status === 'failed' && conversion.errorMsg && (
              <span className="text-red-400/70 truncate max-w-[160px]">{conversion.errorMsg}</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {conversion.status === 'completed' && downloadUrl && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {downloading
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <DownloadSimple size={13} />
                }
                {downloading ? 'Baixando...' : 'Baixar MP3'}
              </button>
            )}
            <button
              onClick={() => onDelete(conversion.id)}
              disabled={deleting}
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-white/30 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <Trash size={11} />
              Remover
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
