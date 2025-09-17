"use client"
import { useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ToolRequestPayload } from '@/lib/ws_events'

type Props = {
  open: boolean
  tool_name?: string
  tool_input?: ToolRequestPayload['input']
  on_approve: () => void
  on_deny: () => void
}

export default function ApprovalModal({ open, tool_name, tool_input, on_approve, on_deny }: Props) {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const on_key = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') on_deny()
      if (e.key.toLowerCase() === 'y') on_approve()
      if (e.key.toLowerCase() === 'n') on_deny()
    }
    window.addEventListener('keydown', on_key)
    return () => window.removeEventListener('keydown', on_key)
  }, [open, on_approve, on_deny])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.25, ease: 'easeOut' }}
          aria-hidden={!open}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-modal-title"
            aria-describedby="approval-modal-content"
            className="mx-auto w-[min(92vw,560px)] rounded-3xl border border-white/10 bg-surfaceStrong/95 p-8 text-slate-800 shadow-soft backdrop-blur-lg dark:text-slate-100"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, duration: prefersReducedMotion ? 0.18 : undefined }}
          >
            <div id="approval-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Solicitação de execução de tool
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">{tool_name}</div>
            <div
              id="approval-modal-content"
              className="mt-5 max-h-60 overflow-auto rounded-2xl border border-white/10 bg-surface/80 p-4 text-xs text-slate-700 shadow-inner dark:text-slate-200"
            >
              <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-inherit">
                {tool_input ? JSON.stringify(tool_input, null, 2) : 'Sem parâmetros'}
              </pre>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <motion.button
                type="button"
                onClick={on_deny}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-xl border border-slate-200/60 bg-white/70 px-5 py-2.5 text-sm font-medium text-slate-600 shadow-soft transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-white/20"
              >
                Negar
              </motion.button>
              <motion.button
                type="button"
                onClick={on_approve}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-xl bg-gradient-to-r from-accent to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Aprovar
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
