export type LogLevel = 'info' | 'warn' | 'error'

export type LogFields = Record<string, unknown>

const normalizeField = (value: unknown): unknown => {
  if (value instanceof Error) {
    const err: Record<string, unknown> = {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
    const anyErr = value as Record<string, unknown>
    if (anyErr && typeof anyErr === 'object') {
      if ('code' in anyErr) err.code = anyErr.code
      if ('status' in anyErr) err.status = anyErr.status
      if ('detail' in anyErr) err.detail = anyErr.detail
    }
    return err
  }
  return value
}

const log = (level: LogLevel, message: string, fields?: LogFields) => {
  const normalizedFields: LogFields | undefined = fields
    ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, normalizeField(v)]))
    : undefined
  const payload = {
    level,
    message,
    ...normalizedFields,
    ts: new Date().toISOString()
  }
  const serialized = JSON.stringify(payload)
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.log(serialized)
}

export const logger = {
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields)
}

export type Logger = typeof logger
