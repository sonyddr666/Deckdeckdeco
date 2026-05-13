# DeckDeckDeco

DeckDeckDeco transforma o Ulanzi D200H em um cockpit físico para rodar comandos, scripts, status cards, IA, STT, TTS, tradução e automações no PC.

## Ideia central

```txt
botão físico do D200H
-> Ulanzi Studio
-> plugin DeckDeckDeco em Node.js
-> comando roda no PC
-> tecla mostra RUN / OK / FAIL / status
```

O D200H não roda Python sozinho. O plugin recebe o evento e manda o Windows/macOS executar o comando.

## O que mudou na v0.3

- Inspector pequeno por action dentro do Ulanzi Studio.
- Páginas separadas de inspector para cada action, sem depender de query no manifest.
- Painel completo no navegador servido por HTTP local pelo próprio plugin.
- O painel completo salva direto em `config/deckdeckdeco.config.json`.
- `Control Panel` abre a página completa quando a tecla física é pressionada.
- Botão `Abrir painel completo` dentro do inspector.
- `Run Command` com exemplos Python e Node.
- `SAVED` não fica preso eternamente no botão.
- Timeout/falha de comando não vira sucesso falso.
- Script `setup:windows` copia SDK, instala npm e instala o plugin no Ulanzi.

## Instalação Windows

Feche o Ulanzi Studio e rode:

```powershell
npm run setup:windows
```

Depois abra o Ulanzi Studio.

## Actions

| Action | O que faz |
| --- | --- |
| Control Panel | Abre o painel completo no navegador |
| Run Command | Roda comando local no PC |
| Snippet Card | Mostra texto curto vindo de comando/arquivo |
| Voice AI | Pipeline STT -> LLM -> TTS |
| Translator | Pipeline STT -> tradução -> TTS |
| YouTube Control | Abre/controla YouTube no PC |

## Como rodar Python

Arraste `Run Command` para uma tecla e configure:

```txt
command: py -3 scripts/examples/teste.py
cwd: {pluginRoot}
```

Aperte o botão físico do D200H.

## Clique no Studio vs botão físico

- Clicar no botão dentro do Ulanzi Studio: seleciona e mostra configuração.
- Apertar o botão físico no D200H: executa a action.

Essa diferença é importante.
