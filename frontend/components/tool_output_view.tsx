import { useMemo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

type Props = {
  chunks: string[]
}

export default function ToolOutputView({ chunks }: Props) {
  const content = useMemo(() => chunks.join(''), [chunks])
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {chunks.length > 0 && (
        <motion.section
          key="tool-output"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: prefersReducedMotion ? 0.18 : 0.3, ease: 'easeOut' }}
          className="space-y-2"
        >
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Saída da tool
          </div>
          <div className="max-h-56 overflow-auto rounded-2xl border border-white/10 bg-surface/80 p-4 text-sm text-slate-700 shadow-soft backdrop-blur-xs transition-shadow dark:text-slate-200">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-inherit">
              {content}
            </pre>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
