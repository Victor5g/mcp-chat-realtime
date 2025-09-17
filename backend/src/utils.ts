import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

export const gen_id = (): string => randomUUID()

export const ensure_dir = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true })
}

export const safe_join = (base: string, target: string): string => {
  const target_path = path.join(base, target)
  const resolved = path.resolve(target_path)
  const base_resolved = path.resolve(base)
  if (!resolved.startsWith(base_resolved)) throw new Error('invalid_path')
  return resolved
}

export const now_iso = (): string => new Date().toISOString()

export const sse_iter = async function* (res: Response): AsyncGenerator<unknown, void, unknown> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const chunk = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          yield JSON.parse(data)
        } catch (error) {
          console.warn(JSON.stringify({ level: 'warn', message: 'sse_chunk_parse_failed', error }))
        }
      }
    }
  }
  if (buf.trim()) {
    const lines = buf.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data)
      } catch (error) {
        console.warn(JSON.stringify({ level: 'warn', message: 'sse_chunk_parse_failed', error }))
      }
    }
  }
}
