import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { ConnectionState } from '@/lib/use_chat_client'

type Props = {
  connection: ConnectionState
  aiTyping: boolean
  toolRunning: boolean
  busy: boolean
  filePath?: string
  assistantError?: string
}

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'accent'

const connectionLabel: Record<ConnectionState, string> = {
  connecting: 'Conectando',
  open: 'Conectado',
  reconnecting: 'Reconectando',
  closed: 'Desconectado'
}

export default function StatusBadge({ connection, aiTyping, toolRunning, busy, filePath, assistantError }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300" aria-live="polite">
      <StatusPill
        tone={connection === 'open' ? 'success' : connection === 'reconnecting' ? 'warning' : connection === 'connecting' ? 'info' : 'neutral'}
        pulse={connection !== 'open'}
        iconColor={connection === 'open' ? 'bg-success' : connection === 'reconnecting' ? 'bg-warning' : 'bg-slate-400 dark:bg-slate-500'}
      >
        {connectionLabel[connection]}
      </StatusPill>
      <StatusPill
        tone={aiTyping ? 'accent' : 'neutral'}
        dim={!aiTyping}
        pulse={aiTyping}
        iconColor={aiTyping ? 'bg-accent' : 'bg-slate-400 dark:bg-slate-500'}
      >
        IA {aiTyping ? 'respondendo' : 'ociosa'}
      </StatusPill>
      <StatusPill
        tone={toolRunning ? 'info' : 'neutral'}
        dim={!toolRunning}
        pulse={toolRunning}
        iconColor={toolRunning ? 'bg-fuchsia-400' : 'bg-slate-400 dark:bg-slate-500'}
      >
        Tool {toolRunning ? `em execução${filePath ? ` (${filePath})` : ''}` : 'inativa'}
      </StatusPill>
      {busy && (
        <StatusPill tone="warning" iconColor="bg-warning">
          Sessão ocupada
        </StatusPill>
      )}
      {assistantError && (
        <StatusPill tone="danger" iconColor="bg-danger">
          {assistantError}
        </StatusPill>
      )}
    </div>
  )
}

function StatusPill({
  tone,
  children,
  dim,
  pulse,
  iconColor
}: {
  tone: Tone
  children: ReactNode
  dim?: boolean
  pulse?: boolean
  iconColor: string
}) {
  const toneStyles: Record<Tone, string> = {
    neutral: 'bg-slate-500/10 text-slate-700 ring-slate-400/20 dark:bg-slate-700/30 dark:text-slate-200 dark:ring-slate-600/40',
    success: 'bg-success/15 text-emerald-700 ring-emerald-400/20 dark:bg-success/15 dark:text-success/80 dark:ring-success/20',
    warning: 'bg-warning/15 text-amber-600 ring-amber-400/30 dark:bg-warning/20 dark:text-warning/80 dark:ring-amber-300/40',
    info: 'bg-sky-500/15 text-sky-600 ring-sky-400/25 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-500/35',
    danger: 'bg-danger/15 text-rose-600 ring-rose-400/25 dark:bg-danger/20 dark:text-danger/80 dark:ring-rose-500/40',
    accent: 'bg-accent/15 text-accentStrong ring-accent/30 dark:bg-accent/20 dark:text-accent'
  }

  return (
    <motion.span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide ring-1 ring-inset transition ${toneStyles[tone]} ${dim ? 'opacity-60' : 'opacity-100'}`}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      style={{ willChange: 'transform' }}
      animate={pulse ? { opacity: [0.75, 1, 0.75] } : { opacity: dim ? 0.65 : 1 }}
      transition={{ duration: pulse ? 2.2 : 0.4, repeat: pulse ? Infinity : 0, ease: 'easeInOut' }}
    >
      <span className={`h-2.5 w-2.5 rounded-full shadow-soft ${iconColor}`} aria-hidden="true" />
      <span>{children}</span>
    </motion.span>
  )
}
