"use client"
import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import MessageBubble from '@/components/message_bubble'
import ApprovalModal from '@/components/approval_modal'
import StatusBadge from '@/components/status_badge'
import ToolOutputView from '@/components/tool_output_view'
import { useChatClient } from '@/lib/use_chat_client'

const formatError = (message: string, detail?: string) => {
  switch (message) {
    case 'ai_error':
      return 'O modelo falhou ao responder. Tente novamente.'
    case 'tool_error':
      return `A tool falhou: ${detail || 'verifique o arquivo no backend.'}`
    case 'tool_input_invalid':
      return 'Solicitação de tool inválida. A execução foi abortada.'
    case 'no_pending_tool':
      return 'Não há tool pendente para aprovar.'
    case 'socket_not_ready':
      return 'Conexão indisponível. Aguarde a reconexão.'
    default:
      return detail ? `${message}: ${detail}` : message
  }
}

export default function Page() {
  const wsUrl = useMemo(() => process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000', [])
  const { state, actions } = useChatClient(wsUrl)
  const [draft, setDraft] = useState('')
  const prefersReducedMotion = useReducedMotion()

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!state.canSend) return
    const text = draft.trim()
    if (!text) return
    actions.sendMessage(text)
    setDraft('')
  }

  const errorText = state.errorMessage ? formatError(state.errorMessage, state.errorDetail) : null

  return (
    <div className="relative flex min-h-screen w-full flex-col px-4 py-6 sm:px-8">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute right-[-10%] top-20 h-72 w-72 rounded-full bg-fuchsia-500/40 blur-[130px] dark:bg-fuchsia-500/30"
          animate={{ opacity: [0.6, 0.4, 0.6] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
        <motion.div
          aria-hidden
          className="absolute left-[-8%] bottom-10 h-64 w-64 rounded-full bg-sky-400/30 blur-[120px] dark:bg-sky-500/30"
          animate={{ opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 16, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 mx-auto flex h-[min(960px,calc(100vh-3rem))] w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-3xl border border-white/15 bg-surfaceStrong/95 text-slate-900 shadow-soft backdrop-blur-2xl dark:border-white/10 dark:text-slate-100">
        <header className="border-b border-white/10 bg-white/60 px-6 py-5 backdrop-blur-md dark:bg-surface/70">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">MCPlink 📡</h1>
            <StatusBadge
              connection={state.connection}
              aiTyping={state.aiTyping}
              toolRunning={state.toolRunning}
              busy={state.busy || state.awaitingAssistant}
              filePath={state.filePath}
              assistantError={state.assistantError}
            />
          </div>
        </header>

        <div className="space-y-2 px-4 pt-4 md:px-6">
          <AnimatePresence initial={false}>
            {errorText && (
              <motion.div
                key="error-banner"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.3, ease: 'easeOut' }}
                className="flex items-start justify-between gap-3 rounded-2xl border border-danger/30 bg-danger/15 px-4 py-3 text-sm text-danger shadow-soft"
                role="alert"
              >
                <span className="leading-relaxed">{errorText}</span>
                <button
                  className="text-xs font-medium text-danger underline-offset-4 transition hover:underline"
                  onClick={actions.clearError}
                >
                  Dispensar
                </button>
              </motion.div>
            )}
            {state.connection === 'reconnecting' && (
              <motion.div
                key="reconnect-banner"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.3, ease: 'easeOut' }}
                className="rounded-2xl border border-warning/40 bg-warning/15 px-4 py-3 text-sm text-warning shadow-soft"
                role="status"
                aria-live="assertive"
              >
                Reconectando ao servidor...
              </motion.div>
            )}
            {state.assistantError && (
              <motion.div
                key="assistant-banner"
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.3, ease: 'easeOut' }}
                className="rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-700 shadow-soft dark:text-amber-200"
                role="alert"
              >
                {state.assistantError}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <main className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">
              <div className="mx-auto flex max-w-3xl flex-col space-y-4" role="list" aria-live="polite">
                {state.messages.map(msg => (
                  <MessageBubble key={msg.id} role={msg.role}>
                    {msg.text}
                  </MessageBubble>
                ))}
                <ToolOutputView chunks={state.toolChunks} />
              </div>
            </div>
          </div>
        </main>

        <footer className="border-t border-white/10 bg-white/60 px-4 py-4 backdrop-blur-md dark:bg-surface/70 sm:px-6">
          <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-3" aria-label="Enviar mensagem">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  className="w-full rounded-2xl border border-white/20 bg-surfaceStrong/80 px-4 py-3 text-sm text-slate-800 shadow-inset transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-400"
                  placeholder={state.connection === 'open' ? 'Digite sua mensagem' : 'Conectando...'}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  disabled={!state.canSend}
                  aria-disabled={!state.canSend}
                />
              </div>
              <motion.button
                type="submit"
                disabled={!state.canSend}
                whileHover={state.canSend ? { scale: 1.02 } : undefined}
                whileTap={state.canSend ? { scale: 0.96 } : undefined}
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                Enviar
              </motion.button>
            </div>
            {!state.canSend && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                className="text-xs text-slate-500 dark:text-slate-300"
              >
                Aguardando resposta da IA ou reconexão.
              </motion.div>
            )}
          </form>
        </footer>
      </div>

      <ApprovalModal
        open={!!state.pendingTool}
        tool_name={state.pendingTool?.name}
        tool_input={state.pendingTool?.input}
        on_approve={actions.approveTool}
        on_deny={actions.denyTool}
      />
    </div>
  )
}
