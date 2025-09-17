import fs from 'fs'
import path from 'path'
import { ensure_dir, safe_join } from '../../../utils.js'
import { env } from '../../../env.js'

export class ToolExecutionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ToolExecutionError'
  }
}

type GeneratorEvent = {
  chunk?: string
  written?: number
  done?: boolean
  file_path?: string
  size?: number
}

export const stream_create_file = async function* ({ rel_path, content }: { rel_path: string; content: string }): AsyncGenerator<GeneratorEvent, void, unknown> {
  const base = env.workspace_dir
  await ensure_dir(base)
  let abs: string
  try {
    abs = safe_join(base, rel_path)
  } catch (error) {
    throw new ToolExecutionError('invalid_path', error instanceof Error ? error.message : 'invalid_path')
  }
  await ensure_dir(path.dirname(abs))
  let handle: fs.promises.FileHandle | null = null
  try {
    handle = await fs.promises.open(abs, 'w')
    const parts = split_chunks(content)
    let written = 0
    for (const p of parts) {
      try {
        await handle.appendFile(p)
      } catch (error) {
        throw new ToolExecutionError('write_failed', error instanceof Error ? error.message : 'write_failed')
      }
      written += Buffer.byteLength(p)
      yield { chunk: p, written }
      await delay(80)
    }
    yield { done: true, file_path: abs, size: written }
  } catch (error) {
    if (error instanceof ToolExecutionError) throw error
    throw new ToolExecutionError('tool_error', error instanceof Error ? error.message : 'unknown_tool_error')
  } finally {
    if (handle) await handle.close()
  }
}

const split_chunks = (text: string): string[] => {
  const size = 120
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
