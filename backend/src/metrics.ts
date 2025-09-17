const counters = new Map<string, number>()
const histograms = new Map<string, { count: number; sum: number }>()

export const increment_counter = (name: string, value = 1) => {
  const prev = counters.get(name) || 0
  counters.set(name, prev + value)
}

export const observe_duration = (name: string, milliseconds: number) => {
  const entry = histograms.get(name) || { count: 0, sum: 0 }
  entry.count += 1
  entry.sum += milliseconds
  histograms.set(name, entry)
}

export const start_timer = () => {
  const start = process.hrtime.bigint()
  return () => {
    const diff_ms = Number(process.hrtime.bigint() - start) / 1_000_000
    return diff_ms
  }
}

export const render_metrics = (): string => {
  const lines: string[] = []
  for (const [name, value] of counters.entries()) lines.push(`# TYPE ${name} counter`, `${name} ${value}`)
  for (const [name, entry] of histograms.entries()) {
    lines.push(`# TYPE ${name}_sum gauge`, `${name}_count ${entry.count}`, `${name}_sum ${entry.sum}`)
  }
  return lines.join('\n') + '\n'
}

export const reset_metrics = () => {
  counters.clear()
  histograms.clear()
}
