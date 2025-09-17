import dotenv from 'dotenv'

dotenv.config()

type Env = {
  port: number
  anthropic_api_key: string
  anthropic_model: string
  ws_allowed_origins: string[]
  workspace_dir: string
}

export const env: Env = {
  port: parseInt(process.env.PORT || '4000', 10),
  anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
  anthropic_model: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-2025-02-19',
  ws_allowed_origins: (process.env.WS_ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean),
  workspace_dir: process.env.WORKSPACE_DIR || 'workspace'
}
