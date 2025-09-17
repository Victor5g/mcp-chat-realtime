# 🚀 Chat em Tempo Real com Claude 3.7+ e Tool MCP (Streaming + Aprovação)

## 🧭 Visão Geral

Aplicação fullstack de chat em tempo real com **Next.js + Tailwind CSS** no frontend e **NestJS (WebSocket Gateway) + ws** no backend. A IA (**Claude 3.7+**) responde em streaming (SSE) e pode solicitar execução de uma **tool MCP** que cria arquivos em chunks mediante **aprovação explícita** do usuário.

## ✅ Pré-requisitos
- Node.js >= 18.17 (requer `fetch` nativo)
- npm (ou outro gerenciador compatível)

## ✨ Funcionalidades
- 🗨️ Chat com histórico e respostas em tempo real
- 🔌 WebSocket full-duplex entre frontend e backend
- 🤖 Integração real com Anthropic Claude 3.7+ (streaming SSE)
- 🧰 Tool MCP para criação de arquivos em chunks
- 🔐 Aprovação explícita do usuário para execução de tools
- 📡 Exibição de chunks em tempo real durante a execução da tool
- 🟢 Indicadores: “IA digitando...” e “Arquivo sendo criado...”

## 🏗️ Arquitetura
- Frontend: `Next.js 14 + Tailwind`
- Backend: `NestJS (WebSocket) + ws + TypeScript`
- IA: `Anthropic Messages API` com `tools` e `stream` habilitados
- Tool MCP: criação de arquivo incremental em `WORKSPACE_DIR`

## 📂 Estrutura

```
backend/
  src/
    app.module.ts
    env.ts
    logger.ts
    main.ts
    metrics.ts
    utils.ts
    http/
      health.controller.ts
      metrics.controller.ts
    modules/chat/
      chat.module.ts
      domain/
        chat_session.ts
        schemas.ts
        types.ts
      gateways/
        chat.gateway.ts
      services/
        anthropic_service.ts
        mcp_tool_service.ts
      usecases/
        process_client_event.usecase.ts
  package.json
  tsconfig.json
  .env.example
  .gitignore

frontend/
  app/
    globals.css
    layout.tsx
    page.tsx
  components/
    approval_modal.tsx
    message_bubble.tsx
    status_badge.tsx
    tool_output_view.tsx
  lib/ws_events.ts
  package.json
  next.config.js
  tailwind.config.js
  postcss.config.js
  tsconfig.json
  .gitignore
```

Observação: o backend usa um WebSocket Gateway do NestJS e valida todos os payloads com Zod.

## 🔑 Variáveis de Ambiente

- Backend
  - `ANTHROPIC_API_KEY` (obrigatória)
  - `ANTHROPIC_MODEL` (opcional, padrão `claude-3-7-sonnet-2025-02-19`)
  - `PORT` (opcional, padrão `4000`)
  - `WS_ALLOWED_ORIGINS` (opcional, padrão `*`)
  - `WORKSPACE_DIR` (opcional, padrão `workspace`)

- Frontend
  - `NEXT_PUBLIC_WS_URL` (opcional, padrão `ws://localhost:4000`)

## ▶️ Como Rodar

1) Backend

Crie o arquivo `.env` (baseado em `.env.example`) e defina sua chave:

```
cd backend
npm i
cp .env.example .env
# Edite .env e preencha ANTHROPIC_API_KEY
npm run dev
```

2) Frontend

```
cd frontend
npm i
NEXT_PUBLIC_WS_URL=ws://localhost:4000 npm run dev
```

Abra: http://localhost:3000

Dicas de configuração:
- Se quiser restringir origens WebSocket, ajuste `WS_ALLOWED_ORIGINS` (ex.: `http://localhost:3000`).
- O diretório `WORKSPACE_DIR` (padrão `workspace`) é criado relativo ao diretório onde o backend é iniciado.

## 🔁 Fluxo com Tool MCP
1. Usuário envia mensagem no chat
2. IA responde em streaming; se precisar da tool, envia `tool_use`
3. Backend pausa e envia `tool_request` → frontend exibe modal
4. Se aprovado ✅: tool cria arquivo chunk a chunk, emitindo `tool_chunk`
5. Backend envia `tool_result` ao Claude e continua a resposta em streaming
6. Se negado ❌: conversa segue sem executar a tool

## 📡 Eventos WebSocket
- Backend → Frontend
  - `session_created { session_id }`
  - `status_update { ai_typing?, tool_running?, file_path?, busy?, reconnecting?, error? }`
  - `ai_chunk { text }`
  - `assistant_message_completed { reason?: 'ok' | 'error' }`
  - `tool_request { id, name, input }`
  - `tool_chunk { chunk }`
  - `error { message, detail? }`

- Frontend → Backend
  - `user_message { text }`
  - `tool_approval { tool_use_id, approved }`

Todos os payloads trocados via WebSocket são validados com **Zod** no backend. Falhas retornam `error { message: 'invalid_payload' | 'invalid_json' }` e são registradas em log estruturado.

## 🧪 Testes & Qualidade

Rodar toda a suíte (backend + frontend):

```
cd backend && npm test
cd ../frontend && npm test
```

Cobertura dos testes inclui:
- Backend (Vitest): validação de payloads, aprovação negada/aprovada, erro da tool, auto-resposta para tool inválida.
- Frontend (Vitest + RTL): interação do modal de aprovação e tratamento de mensagens de erro.

## 🔍 Observabilidade
- Logs estruturados (`logger.ts`) com nível (`info|warn|error`), carimbo ISO e contexto (ex.: `session_id`, `tool_use_id`).
- Métricas em memória expostas em `GET /metrics` (formato Prometheus) — inclui contadores para conexões WebSocket, requisições Anthropic, aprovações de tool e durações médias de streaming/continuação.
- Endpoint `GET /health` segue disponível.
- Erros críticos propagados ao frontend com mensagens amigáveis e estado visual (badges/alertas) para reconexão, busy e falhas de tool.

## 🧪 Requisitos e Garantias
- ✅ Sem mocks: uso da API oficial Anthropic com SSE
- ✅ Streaming real-time fim-a-fim (IA e MCP)
- ✅ Código modular (services, utils, componentes)
- ✅ Logs/estados do fluxo via `status_update`

## 🧰 Exemplos úteis
- Peça à IA: “Crie um arquivo `notas/hello.txt` com o conteúdo: Olá mundo”.
  - O frontend exibirá um modal de aprovação com o input da tool.
  - Ao aprovar, você verá `tool_chunk` com o conteúdo sendo gravado em partes.
  - O arquivo será criado em `WORKSPACE_DIR/notas/hello.txt`.

## 🛡️ Segurança & Restrições
- A tool usa `safe_join` para prevenir path traversal; somente grava dentro de `WORKSPACE_DIR`.
- `WS_ALLOWED_ORIGINS` controla quais origens podem conectar via WebSocket.

## 🧯 Solução de Problemas
- Mensagens de erro mapeadas do backend (exibidas no frontend):
  - `ai_saldo_insuficiente`: crédito insuficiente na Anthropic.
  - `ai_nao_autorizado`: verifique `ANTHROPIC_API_KEY`.
  - `ai_limite_excedido`: rate limit; aguarde e tente novamente.
  - `ai_indisponivel`: erro 5xx; tente novamente.
  - `ai_error`: erro genérico; ver detalhes no log.
- Erros da tool:
  - `invalid_path`: caminho fora do `WORKSPACE_DIR`.
  - `write_failed` / `tool_error`: verifique permissões e disco.

## 📚 Referências
- 📖 Anthropic: https://docs.anthropic.com/en/docs/get-started
- ☁️ Bedrock: https://docs.anthropic.com/en/docs/claude-code/amazon-bedrock
- 🧩 Tool Use: https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-tool-use.html
