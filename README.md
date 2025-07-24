# Chat Streaming Real-Time com Claude 3.7+, Aprovação e Execução de Tool MCP em Streaming

## Visão Geral

Desenvolva uma aplicação fullstack de **chat em tempo real**, utilizando **Next.js** e **Tailwind CSS** no frontend, com backend WebSocket para orquestração da comunicação.

A inteligência artificial deve ser integrada via **Anthropic API** ou **AWS Bedrock** utilizando exclusivamente o modelo **Claude 3.7+ (ex: Sonnet 3.7+)**, sem utilização de mocks.

A particularidade do desafio é que a IA poderá solicitar o uso de uma **tool MCP** (ferramenta externa para criação/processamento), cuja execução depende de aprovação explícita do usuário e será feita em modo **streaming via chunks**, com o conteúdo do arquivo sendo escrito e exibido em tempo real durante o streaming.

## Descrição do Fluxo Completo

### 1. Interação Inicial do Usuário
- O usuário envia uma mensagem no chat solicitando uma ação, por exemplo: criação de um arquivo com conteúdo específico.

### 2. Envio da Mensagem ao Backend
- O frontend envia a mensagem ao backend via WebSocket.
- O backend repassa essa mensagem para o Claude 3.7+ (Anthropic ou Bedrock) via API, utilizando a interface de **tool use** para a possível execução da tool MCP.

### 3. Fluxo de Solicitação de Execução da Tool MCP pela IA
- Se a IA *decidir* que precisa executar a tool MCP para atender ao pedido, ela envia uma mensagem solicitando a execução da ferramenta.
- O backend captura essa solicitação e imediatamente envia um evento via WebSocket para o frontend, informando que a IA está pedindo autorização para executar a tool MCP (ex: criar e popular um arquivo).

### 4. Aprovação/Renegação do Usuário
- O frontend exibe uma interface clara (popup/modal ou similar), notificando o usuário da solicitação da IA para executar a ferramenta MCP.
- O usuário pode escolher **aprovar** ou **negar** a execução.
- A decisão do usuário é enviada de volta ao backend via WebSocket.

### 5. Após Aprovação: Execução da Tool MCP em Streaming
- Se o usuário **aprovar** a execução:
  - O backend invoca a tool MCP para iniciar a criação/população do arquivo.
  - A tool MCP gera o conteúdo do arquivo **progressivamente**, via **chunks**, enviando os dados parcial e sequencialmente conforme a criação avança.
  - O backend recebe esses chunks e os transmite em tempo real ao frontend via WebSocket, sem buffering ou agrupamento.

### 6. Exibição em Tempo Real no Frontend
- O frontend recebe cada chunk pelo socket e imediatamente atualiza a interface, exibindo o conteúdo do arquivo sendo escrito **em tempo real**, chunk a chunk.
- Pode-se mostrar mensagens auxiliares no chat, como “Arquivo sendo criado...”, “Chunk X recebido”, entre outras, para que o usuário tenha feedback claro do progresso.
- Ao final do envio, o frontend informa que o arquivo foi criado e está concluído.

### 7. Caso o Usuário Negue a Execução
- O backend comunica para a IA que a execução da tool foi negada.
- A IA responde adequadamente ao usuário via chat, explicando a negativa ou propondo alternativas.

### 8. Fluxo Contínuo
- O chat permanece ativo para o usuário continuar enviando novas mensagens.
- Toda vez que a IA solicitar uso da tool MCP, o fluxo de aprovação e execução em streaming será repetido.

## Requisitos Técnicos

### Frontend (Next.js + Tailwind CSS)
- Página única com interface de chat responsiva.
- Campo de input e exibição do histórico da conversa.
- Comunicação via WebSocket para envio das mensagens e recebimento das respostas parciais/finais.
- Interface clara para notificações de solicitação de execução da tool MCP.
- Capacidade de aprovar ou negar a execução da tool.
- Renderização em tempo real das mensagens da IA e do conteúdo dos arquivos gerados pelo streaming chunked da tool MCP.
- Indicadores visuais de carregamento / streaming (exemplo: “typing...” ou barras de progresso).

### Backend
- Server WebSocket para gerenciar conexões, receber mensagens e eventos, e enviar respostas parciais/finais.
- Integração real com Claude 3.7+ através da Anthropic API ou AWS Bedrock:
  - Uso da interface oficial de **tool use**.
  - Streaming real da resposta da IA (respostas parciais enviadas assim que recebidas).
- Controle e gerenciamento do fluxo de aprovação:
  - Bloqueio da execução da tool até o backend receber a autorização explícita do frontend/usuário.
- Chamada e execução da tool MCP em modo chunked, transmitindo cada chunk ao frontend via WebSocket em tempo real.
- Comunicação transparente com o frontend sobre o progresso da execução da tool MCP (envio de chunks, estado de finalização, etc).
- Não é permitido uso de mocks, todos os dados devem vir da integração real com a IA.

## Critérios de Avaliação

- **Integração real e funcional com Claude 3.7+** (Anthropic API ou AWS Bedrock), sem simulações.
- **Fluxo claro e robusto de aprovação do usuário** para execução de ferramentas externas (tool MCP).
- **Streaming chunked real-time** tanto no retorno das mensagens da IA quanto nos dados fragmentados enviados pela tool MCP.
- **Orquestração eficiente via WebSocket** para permitir comunicação bidirecional instantânea.
- **Organização e modularidade do código**, permitindo fácil manutenção e testes.
- **Documentação clara no README**, incluindo:
  - Como configurar as keys para Anthropic ou Bedrock.
  - Como rodar o projeto.
  - Descrição do fluxo de aprovação e streaming.
- O foco está na experiência de chat generativo com controle do usuário para execução de ferramentas e streaming progressivo de respostas e dados.

## Pontos Chave do Desafio

| Etapa                        | Detalhe                                         |
|-----------------------------|------------------------------------------------|
| Mensagem do usuário          | Enviada via WebSocket ao backend.               |
| IA solicita ferramenta MCP   | Notificação em tempo real ao frontend.          |
| Usuário aprova/nega          | Frontend envia decisão ao backend.               |
| Execução MCP (aprovada)     | Conteúdo do arquivo gerado e enviado por chunks.|
| Streaming ao usuário         | Frontend atualiza chat e conteúdo instante.      |
| Negação de execução          | IA responde explicando recurso negado.           |

## Referências Úteis

- [Anthropic API - Documentação Claude 3.7+](https://docs.anthropic.com/en/docs/get-started)
- [AWS Bedrock - Integração Claude 3.7+](https://docs.anthropic.com/en/docs/claude-code/amazon-bedrock)
- [Tool Use para Claude na Anthropic/AWS](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-tool-use.html)

 
