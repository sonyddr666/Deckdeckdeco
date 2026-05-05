# DeckDeckDeco

Um laboratorio de ideias e exemplos para transformar um **Ulanzi D200H** em um cockpit fisico de dev, IA, automacao, STT, TTS, traducao, testes, status visual e pequenas respostas na tecla.

A proposta nao e fingir que a telinha vira YouTube ou monitor gamer em miniatura. A vibe aqui e mais util e mais forte: **botao fisico que dispara scripts, muda GIF/status, roda IA, fala resposta no PC e mostra resumo curto no deck**.

## O que este repo entrega

Este projeto traz um plugin Node.js inicial para Ulanzi Studio com acoes prontas para experimentar:

| Acao | Ideia | O que aparece na tecla |
| --- | --- | --- |
| Run Command | roda comando/script/teste/build | RUN, OK, FAIL, tempo e resumo |
| Snippet Card | pega texto/saida/base64/resposta curta e joga na tecla | mini card com 2-5 linhas |
| Voice AI | STT -> LLM -> TTS | REC, STT, THINK, SPEAK, DONE |
| Translator | STT -> traducao -> TTS | PT->EN, EN->PT, OK/FAIL |
| YouTube Control | controla YouTube no PC, nao dentro da tecla | PLAY, OPEN, HOTKEY |

## Realidade tecnica, sem perfume de anuncio

### Da para tocar YouTube direto na tecla?

Nao pelo SDK normal. A tecla recebe imagem, texto, estado e GIF. Ela nao e um player de YouTube.

O uso certo e:

```txt
Deck -> abre/controla YouTube no PC
Deck -> mostra status, thumbnail, play/pause ou GIF
PC   -> roda o video de verdade
```

### Da para rodar programa e mostrar rosa/verde/vermelho?

Sim.

```txt
aperta botao
-> mostra RUN rosa / GIF
-> toca som
-> roda script
-> se exit code 0: verde OK
-> se erro: vermelho FAIL
```

### Da para mostrar resposta de IA na tecla?

Sim, desde que seja curta. O ideal e renderizar 2-5 linhas como imagem/SVG/base64.

```txt
AUTH BUG
refreshToken
line 42
```

Resposta completa fica em arquivo, clipboard, popup, terminal ou TTS.

### Da para fazer STT -> LLM -> TTS?

Sim. A D200H nao faz IA sozinha. Ela controla o fluxo:

```txt
D200H
-> plugin Node.js
-> grava audio / STT
-> LLM responde
-> TTS fala no PC
-> tecla mostra status/resumo
```

## Estrutura

```txt
Deckdeckdeco/
├── manifest.json
├── package.json
├── plugin/
│   └── app.js
├── property-inspector/
│   ├── inspector.html
│   └── inspector.js
├── config/
│   └── deckdeckdeco.config.example.json
├── scripts/
│   └── examples/
│       ├── fake-test.mjs
│       ├── fake-stt.mjs
│       ├── fake-llm.mjs
│       ├── fake-translate.mjs
│       ├── fake-tts.mjs
│       └── generate-snippet.mjs
└── resources/
    └── icons/
        ├── plugin.svg
        ├── run.svg
        ├── snippet.svg
        ├── voice.svg
        ├── translate.svg
        └── youtube.svg
```

## Instalacao local

### 1. Clone este repo

```bash
git clone https://github.com/sonyddr666/Deckdeckdeco.git
cd Deckdeckdeco
npm install
```

### 2. Copie o SDK oficial da Ulanzi

Este repo espera que voce copie as libs oficiais do SDK:

```txt
plugin/ulanzi-api/    <- conteudo do plugin-common-node / ulanzi-api
libs/                 <- conteudo do plugin-common-html/libs
```

Um jeito comum:

```bash
git clone --recursive https://github.com/UlanziTechnology/UlanziDeckPlugin-SDK.git
```

Depois copie:

```txt
UlanziDeckPlugin-SDK/common-node/*  -> Deckdeckdeco/plugin/ulanzi-api/
UlanziDeckPlugin-SDK/common-html/libs -> Deckdeckdeco/libs/
```

> Observacao: alguns exemplos da Ulanzi chamam essa pasta de `ulanzi-api`, outros de `common-node`. Aqui o import usado no plugin e `./ulanzi-api/index.js`.

### 3. Crie sua configuracao

```bash
cp config/deckdeckdeco.config.example.json config/deckdeckdeco.config.json
```

Edite os comandos conforme seu PC/projeto.

### 4. Coloque no Ulanzi Studio

O Ulanzi costuma esperar uma pasta de plugin com nome no padrao:

```txt
com.ulanzi.deckdeckdeco.ulanziPlugin
```

Voce pode copiar o conteudo deste repo para uma pasta com esse nome dentro da pasta de plugins do Ulanzi Studio.

Durante desenvolvimento, o `manifest.json` usa:

```json
"CodePath": "plugin/app.js"
```

## Acoes incluidas

### 1. Run Command

Roda um comando configurado e atualiza a tecla conforme o resultado.

Exemplo de uso:

```json
{
  "command": "node scripts/examples/fake-test.mjs",
  "cwd": "{pluginRoot}",
  "title": "TEST",
  "runningLabel": "RUN",
  "successLabel": "OK",
  "failLabel": "FAIL"
}
```

Ideias reais:

- `npm test`
- `pnpm lint`
- `npm run build`
- `docker compose up -d`
- gerar commit message com IA
- abrir relatorio de erro
- executar script de deploy local

### 2. Snippet Card

Atualiza uma tecla a cada intervalo com um texto curto vindo de arquivo ou comando.

```json
{
  "sourceCommand": "node scripts/examples/generate-snippet.mjs",
  "intervalMs": 1000,
  "title": "LIVE",
  "maxLines": 4,
  "maxCharsPerLine": 18
}
```

Ideias reais:

- ultimas linhas do teste
- status do servidor local
- resultado resumido da IA
- branch atual
- contagem de erros
- status do Docker
- temperatura/uso de CPU/GPU

### 3. Voice AI

Pipeline generico:

```txt
recordStartCommand -> recordStopCommand -> sttCommand -> llmCommand -> ttsCommand
```

Exemplo demo sem API externa:

```json
{
  "sttCommand": "node scripts/examples/fake-stt.mjs --out {transcriptFile}",
  "llmCommand": "node scripts/examples/fake-llm.mjs --in {transcriptFile} --out {responseFile}",
  "ttsCommand": "node scripts/examples/fake-tts.mjs --in {responseFile}"
}
```

Troque depois por Whisper, OpenAI, Gemini, Claude, Ollama, Piper, Edge TTS, ElevenLabs, DeepL ou o que voce usar.

### 4. Translator

Pipeline parecido com Voice AI, mas focado em traducao:

```txt
STT -> Translate -> TTS
```

Exemplo:

```json
{
  "sttCommand": "node scripts/examples/fake-stt.mjs --out {transcriptFile}",
  "translateCommand": "node scripts/examples/fake-translate.mjs --in {transcriptFile} --out {responseFile} --to en",
  "ttsCommand": "node scripts/examples/fake-tts.mjs --in {responseFile}"
}
```

### 5. YouTube Control

Nao toca YouTube na tecla. Controla o PC.

```json
{
  "url": "https://www.youtube.com/",
  "hotkey": "Space"
}
```

Ideias:

- abrir playlist
- play/pause
- mutar
- avancar
- voltar
- controlar volume
- abrir canal/documentacao/video aula

## Lista grande de ideias

### Dev e codigo

- Botao PANIC: pega `git diff`, logs, erro atual e monta prompt para IA.
- Botao TEST: roda testes e mostra OK/FAIL.
- Botao LINT: roda lint e mostra contagem de problemas.
- Botao BUILD: mostra tempo e resultado.
- Botao COMMIT: gera mensagem de commit com base no diff.
- Botao PR: gera resumo do pull request.
- Botao DOC: cria docstring ou README parcial.
- Botao FIX: envia erro + contexto para IA e salva `ai-fix.md`.
- Botao EXPLAIN: explica codigo selecionado.
- Botao SECURITY: revisa diff procurando risco.

### IA visual no deck

- Mini resposta da IA em 3 linhas.
- Status `AI THINK`, `AI READY`, `AI FAIL`.
- Card com severidade: LOW/MED/HIGH.
- Card com arquivo e linha sugerida.
- GIF rosa enquanto processa, verde/vermelho ao terminar.

### Voz

- Push-to-talk com STT -> LLM -> TTS.
- Tradutor PT->EN / EN->PT.
- Ler clipboard em voz alta.
- Transcrever reuniao em blocos.
- Resumir audio e mostrar `SUMMARY READY`.
- Repetir ultima resposta da IA.

### Sistema

- Abrir VS Code/projeto.
- Subir/parar Docker Compose.
- Resetar banco local.
- Trocar `.env`.
- Iniciar tunnel.
- Abrir logs.
- Abrir Sentry/Grafana/Supabase/Firebase.

### OBS e criacao

- Trocar cena.
- Mutar microfone.
- Iniciar/parar gravacao.
- Marcar timestamp.
- Abrir roteiro.
- Mostrar status `REC` na tecla.

### Monitoramento

- Status do servidor local.
- Healthcheck de API.
- Status de CI.
- Branch atual.
- PR aberto.
- Quantidade de testes falhando.
- Latencia de endpoint.

## Como adaptar para IA real

Este repo nao coloca segredo/API key dentro do codigo. Use variaveis de ambiente:

```bash
OPENAI_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPL_API_KEY=...
```

E aponte os comandos no JSON para seus scripts reais.

Exemplo conceitual:

```json
{
  "llmCommand": "node scripts/my-openai-response.mjs --in {transcriptFile} --out {responseFile}"
}
```

## Filosofia do projeto

A tecla pequena nao deve tentar ser uma tela grande. Ela deve ser um **sinalizador inteligente**:

```txt
REC
STT
THINK
SPEAK
OK
FAIL
AUTH BUG
LINE 42
```

A resposta completa vai para arquivo, clipboard, popup, navegador, terminal ou TTS.

O deck vira um painel fisico de comandos e estados. Um cockpit de dev. Uma mesa de controle para IA. Um semaforo bonito para o caos.
