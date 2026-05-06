# Screen AI ideas for DeckDeckDeco

Este documento adiciona ideias novas ao DeckDeckDeco sem apagar nada do que ja existe.

A proposta aqui e transformar o Ulanzi Deck em um painel fisico para capturar tela, transcrever imagem, traduzir pagina, resumir o que esta aberto e mandar respostas curtas para a tecla. A tela grande continua no PC. A tecla vira o sinalizador inteligente: status, resumo, erro, idioma, acao pronta.

## Principio geral

A tecla nao precisa virar monitor. Ela precisa responder:

```txt
CAPTURE
OCR
TRANS
SUMMARY
DONE
FAIL
```

O fluxo ideal:

```txt
Botao no deck
-> comando local tira print ou captura janela
-> OCR / visao / LLM processa
-> resultado completo vai para arquivo, clipboard, popup ou navegador
-> resumo curto vai para a tecla
```

## Novas actions sugeridas

| Action | Ideia | O que aparece na tecla |
| --- | --- | --- |
| Screenshot Capture | tira print da tela inteira, janela ativa ou regiao | SHOT, SAVED, FAIL |
| Image OCR | le texto de imagem/screenshot | OCR, TEXT, DONE |
| Screen Summary | resume o que esta aberto na tela | READ, THINK, SUM |
| Page Translator | traduz pagina atual, texto selecionado ou screenshot | PT>EN, EN>PT, OK |
| Visual Explain | explica grafico, erro, UI ou imagem aberta | LOOK, EXPLAIN, DONE |
| Clipboard OCR | pega imagem ou texto do clipboard e processa | CLIP, OCR, OK |
| Error Reader | captura erro na tela e gera explicacao/solucao | ERROR, FIX?, LINE |
| Meeting Slide Summary | resume slide ou tela compartilhada | SLIDE, NOTE, READY |
| Code Screenshot Explain | entende print de codigo e explica | CODE, BUG, TIP |
| Quick Translate Selection | traduz texto selecionado usando hotkey/clipboard | SEL, TRANS, DONE |

## 1. Screenshot Capture

Objetivo: apertar uma tecla e salvar um print automaticamente.

Configuracoes possiveis:

```json
{
  "mode": "activeWindow",
  "outputFile": "{runtimeDir}/screen.png",
  "afterCaptureCommand": "",
  "title": "SHOT"
}
```

Modos:

- `fullScreen`: tela inteira.
- `activeWindow`: janela ativa.
- `region`: regiao selecionada.
- `clipboard`: copia o print para clipboard alem de salvar.

Exemplos de ferramentas externas:

- Windows: PowerShell, ShareX CLI, nircmd, screenshot-cmd.
- macOS: `screencapture`.
- Linux: `grim`, `gnome-screenshot`, `maim`, `scrot`.

Status na tecla:

```txt
SHOT
SAVE
OK
```

ou

```txt
SHOT
FAIL
NO TOOL
```

## 2. Image OCR

Objetivo: ler texto de uma imagem, screenshot ou clipboard.

Fluxo:

```txt
captureCommand
-> ocrCommand
-> salva o texto em ocr.txt
-> mostra 2-4 linhas na tecla
```

Configuracao:

```json
{
  "captureCommand": "",
  "ocrCommand": "node scripts/examples/fake-ocr.mjs --image {imageFile} --out {textFile}",
  "imageFile": "{runtimeDir}/screen.png",
  "textFile": "{runtimeDir}/ocr.txt",
  "title": "OCR"
}
```

Ferramentas possiveis:

- Tesseract local.
- PaddleOCR.
- EasyOCR.
- Windows OCR via PowerShell/WinRT.
- macOS Vision OCR via atalho/AppleScript.
- APIs de visao quando quiser IA real.

Status:

```txt
OCR
READ
DONE
```

Resumo na tecla:

```txt
OCR
AUTH BUG
line 42
```

## 3. Screen Summary

Objetivo: tirar print da tela e pedir para uma IA resumir o que esta acontecendo.

Fluxo:

```txt
screenshot
-> vision/ocr
-> llm summary
-> arquivo screen-summary.md
-> tecla mostra resumo minimo
```

Configuracao:

```json
{
  "captureCommand": "",
  "summarizeCommand": "node scripts/examples/fake-screen-summary.mjs --image {imageFile} --out {summaryFile}",
  "imageFile": "{runtimeDir}/screen.png",
  "summaryFile": "{runtimeDir}/screen-summary.md",
  "title": "SCREEN"
}
```

Ideias de uso:

- resumir dashboard aberto.
- explicar erro visual.
- resumir pagina de documentacao.
- dizer quais botoes existem na UI.
- criar checklist do que fazer a seguir.

Status:

```txt
READ
THINK
SUM
```

## 4. Page Translator

Objetivo: traduzir pagina atual, texto selecionado ou print da pagina.

Tres modos:

| Modo | Como funciona |
| --- | --- |
| `selectedText` | copia texto selecionado, traduz e devolve no clipboard/arquivo |
| `pageScreenshot` | tira print, OCR, traduz texto detectado |
| `browserUrl` | pega URL atual com script/hotkey e manda para um tradutor/script |

Configuracao:

```json
{
  "mode": "selectedText",
  "sourceLang": "auto",
  "targetLang": "pt-BR",
  "translateCommand": "node scripts/examples/fake-page-translate.mjs --in {inputFile} --out {outputFile} --to pt-BR",
  "title": "TRANS"
}
```

Status:

```txt
TRANS
PT-BR
OK
```

ou

```txt
TRANS
NO TEXT
FAIL
```

## 5. Visual Explain

Objetivo: explicar imagem, tela, grafico, UI, erro, meme tecnico ou qualquer coisa visivel.

Fluxo:

```txt
screenshot
-> visionCommand
-> resposta completa em visual-explain.md
-> tecla mostra 3 linhas
```

Configuracao:

```json
{
  "captureCommand": "",
  "visionCommand": "node scripts/examples/fake-visual-explain.mjs --image {imageFile} --out {responseFile}",
  "prompt": "Explique o que aparece na tela e diga o proximo passo.",
  "title": "LOOK"
}
```

Exemplos de resultado na tecla:

```txt
LOOK
LOGIN ERR
CHECK TOKEN
```

```txt
LOOK
GRAPH
CPU SPIKE
```

## 6. Clipboard OCR

Objetivo: se houver imagem no clipboard, processar. Se houver texto, resumir/traduzir direto.

Fluxo:

```txt
clipboardCommand
-> detecta texto/imagem
-> OCR se imagem
-> resumo/traducao se texto
```

Configuracao:

```json
{
  "clipboardReadCommand": "node scripts/examples/fake-clipboard-read.mjs --out {inputFile}",
  "processCommand": "node scripts/examples/fake-clipboard-ai.mjs --in {inputFile} --out {outputFile}",
  "title": "CLIP"
}
```

Status:

```txt
CLIP
TEXT
DONE
```

ou

```txt
CLIP
IMAGE
OCR
```

## 7. Error Reader

Objetivo: capturar a tela quando tem erro, ler o texto, resumir causa provavel e sugerir proximo passo.

Fluxo:

```txt
screenshot
-> OCR
-> LLM focado em debug
-> ai-error.md
-> tecla mostra severidade + dica
```

Configuracao:

```json
{
  "captureCommand": "",
  "ocrCommand": "",
  "debugCommand": "node scripts/examples/fake-error-reader.mjs --in {textFile} --out {responseFile}",
  "title": "ERROR"
}
```

Status:

```txt
ERROR
AUTH
TOKEN
```

```txt
ERROR
IMPORT
PATH
```

## 8. Meeting Slide Summary

Objetivo: quando estiver vendo uma reuniao, aula, slide ou tela compartilhada, o botao captura e cria anotacao curta.

Fluxo:

```txt
screenshot
-> OCR/vision
-> resumo em markdown
-> append em notes.md
-> tecla mostra READY
```

Configuracao:

```json
{
  "captureCommand": "",
  "noteCommand": "node scripts/examples/fake-slide-note.mjs --image {imageFile} --append {notesFile}",
  "notesFile": "{runtimeDir}/meeting-notes.md",
  "title": "SLIDE"
}
```

Status:

```txt
SLIDE
NOTE
READY
```

## 9. Code Screenshot Explain

Objetivo: tirar print de codigo ou erro no editor e gerar explicacao curta.

Fluxo:

```txt
screenshot
-> OCR
-> LLM com prompt de codigo
-> resposta completa em code-explain.md
-> tecla mostra arquivo/linha/dica
```

Configuracao:

```json
{
  "captureCommand": "",
  "codeExplainCommand": "node scripts/examples/fake-code-explain.mjs --image {imageFile} --out {responseFile}",
  "title": "CODE"
}
```

Status:

```txt
CODE
BUG
LINE 42
```

## 10. Quick Translate Selection

Objetivo: selecionar texto em qualquer app, apertar o deck e receber traducao.

Fluxo recomendado:

```txt
hotkey Ctrl+C
-> le clipboard
-> traduz
-> copia traducao para clipboard
-> mostra OK na tecla
```

Configuracao:

```json
{
  "copyHotkey": "Ctrl+C",
  "translateCommand": "node scripts/examples/fake-translate-selection.mjs --out {outputFile} --to en",
  "pasteToClipboard": true,
  "title": "SEL"
}
```

Status:

```txt
SEL
EN
COPIED
```

## Nova secao de config sugerida

Essas actions poderiam entrar depois no `deckdeckdeco.config.example.json` assim:

```json
{
  "screenshotCapture": {
    "mode": "activeWindow",
    "captureCommand": "",
    "imageFile": "{runtimeDir}/screen.png",
    "title": "SHOT"
  },
  "imageOCR": {
    "captureCommand": "",
    "ocrCommand": "node scripts/examples/fake-ocr.mjs --image {imageFile} --out {textFile}",
    "imageFile": "{runtimeDir}/screen.png",
    "textFile": "{runtimeDir}/ocr.txt",
    "title": "OCR"
  },
  "screenSummary": {
    "captureCommand": "",
    "summarizeCommand": "node scripts/examples/fake-screen-summary.mjs --image {imageFile} --out {summaryFile}",
    "imageFile": "{runtimeDir}/screen.png",
    "summaryFile": "{runtimeDir}/screen-summary.md",
    "title": "SCREEN"
  },
  "pageTranslator": {
    "mode": "selectedText",
    "sourceLang": "auto",
    "targetLang": "pt-BR",
    "translateCommand": "node scripts/examples/fake-page-translate.mjs --in {inputFile} --out {outputFile} --to pt-BR",
    "title": "TRANS"
  },
  "visualExplain": {
    "captureCommand": "",
    "visionCommand": "node scripts/examples/fake-visual-explain.mjs --image {imageFile} --out {responseFile}",
    "prompt": "Explique o que aparece na tela e diga o proximo passo.",
    "title": "LOOK"
  }
}
```

## Novos scripts fake sugeridos

Para manter a filosofia atual do repo, da para criar scripts fake antes de integrar API real:

```txt
scripts/examples/fake-screenshot.mjs
scripts/examples/fake-ocr.mjs
scripts/examples/fake-screen-summary.mjs
scripts/examples/fake-page-translate.mjs
scripts/examples/fake-visual-explain.mjs
scripts/examples/fake-clipboard-read.mjs
scripts/examples/fake-error-reader.mjs
scripts/examples/fake-slide-note.mjs
scripts/examples/fake-code-explain.mjs
scripts/examples/fake-translate-selection.mjs
```

Eles podem gerar arquivos `.txt` ou `.md` em `.deckdeckdeco/` para testar o fluxo sem depender de API externa.

## Como isso encaixa no plugin atual

O plugin ja tem uma arquitetura boa para isso:

- `Run Command` ja roda scripts locais.
- `Snippet Card` ja mostra texto curto na tecla.
- `Voice AI` e `Translator` ja usam pipeline de comandos.
- O render de SVG/base64 ja resolve o feedback visual.

Entao as actions novas podem reaproveitar o mesmo modelo:

```txt
runPipelineCommand
applyTokens
setCard
runtimeDir
config json
property inspector dinamico
```

## Ordem recomendada de implementacao

1. Screenshot Capture
2. Image OCR
3. Screen Summary
4. Quick Translate Selection
5. Page Translator
6. Visual Explain
7. Error Reader
8. Meeting Slide Summary
9. Code Screenshot Explain
10. Clipboard OCR

Motivo: primeiro captura, depois le, depois resume/traduz. Sem captura confiavel, o resto vira experiencia espiritual reversa.

## Observacao importante

Essas ideias nao exigem que o deck processe imagem sozinho. O deck so dispara o fluxo e mostra feedback. Quem faz o trabalho pesado e o PC, scripts locais, ferramentas OCR, navegador, clipboard ou APIs de IA.
