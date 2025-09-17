import { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type Props = {
  role: 'user' | 'assistant' | 'system'
  children: ReactNode
}

export default function MessageBubble({ role, children }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const isUser = role === 'user'
  const isSystem = role === 'system'

  const baseStyles = 'relative max-w-[82%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-soft backdrop-blur-xs transition-colors sm:text-base'
  const userStyles = 'bg-gradient-to-br from-accent via-fuchsia-400 to-purple-500 text-white shadow-glow ring-1 ring-white/20'
  const assistantStyles = 'bg-surface/90 text-slate-800 ring-1 ring-white/40 dark:bg-surfaceStrong/80 dark:text-slate-100 dark:ring-white/5'
  const systemStyles = 'bg-warning/15 text-amber-800 ring-1 ring-amber-400/30 dark:text-amber-100'

  const bubbleStyles = `${baseStyles} ${isSystem ? systemStyles : isUser ? userStyles : assistantStyles}`

  return (
    <motion.div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
      layout="position"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 360, damping: 32, duration: prefersReducedMotion ? 0.24 : undefined }}
      role="listitem"
    >
      <div className={bubbleStyles}>
        <span className="block whitespace-pre-wrap break-words text-base/6 sm:text-[15px]/7">
          {children}
        </span>
      </div>
    </motion.div>
  )
}
