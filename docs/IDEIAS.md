# Compilado de ideias DeckDeckDeco

Este documento organiza as ideias discutidas para usar um Ulanzi D200H como painel fisico de automacao, IA e produtividade.

## 1. Botao de comando com status visual

Fluxo:

```txt
aperta botao
-> mostra GIF/estado rosa RUN
-> toca som opcional
-> executa comando
-> sucesso: verde OK
-> erro: vermelho FAIL
```

Usos:

- rodar `npm test`
- rodar `pnpm lint`
- rodar build
- subir Docker Compose
- resetar banco local
- abrir logs
- executar script de deploy local

## 2. Mini resposta de IA na tecla

A tecla nao deve mostrar resposta longa. Ela deve mostrar um resumo curto:

```txt
FIX READY
auth middleware
check JWT
```

A resposta completa pode ir para:

- arquivo `.md`
- clipboard
- VS Code
- popup HTML
- TTS
- terminal

## 3. Live snippet a cada segundo

Fluxo:

```txt
script gera texto curto
-> plugin renderiza card SVG/base64
-> tecla atualiza a cada 1s
```

Usos:

- status do servidor local
- branch atual
- ultimas linhas de teste
- estado do Docker
- resumo de IA
- CI local
- contador de erros

## 4. STT -> LLM -> TTS

Fluxo:

```txt
segura botao
-> grava voz
-> STT transcreve
-> LLM responde
-> TTS fala no PC
-> deck mostra status/resumo
```

Estados visuais:

```txt
REC
STT
THINK
SPEAK
DONE
ERR
```

## 5. Tradutor fisico

Fluxo:

```txt
fala em PT
-> STT
-> traduz para EN
-> TTS fala em EN
-> tecla mostra PT>EN OK
```

Ideias:

- PT -> EN
- EN -> PT
- texto do clipboard -> traducao
- repetir ultima traducao
- modo cliente gringo

## 6. YouTube e midia

Nao toca YouTube dentro da tecla pelo SDK normal.

Uso correto:

```txt
tecla abre/controla YouTube no PC
tecla mostra status PLAY/PAUSE/OPEN
video roda no navegador
```

Comandos possiveis:

- abrir playlist
- play/pause
- mutar
- avancar
- voltar
- abrir canal
- abrir video aula

## 7. Botao PANIC do dev

Fluxo:

```txt
aperta PANIC
-> coleta git diff
-> coleta logs
-> roda testes
-> monta prompt
-> chama IA
-> salva panic-report.md
-> tecla mostra FIX READY / FAIL
```

## 8. Tribunal do codigo

Fluxo:

```txt
pega diff atual
-> IA revisa
-> classifica severidade
-> tecla mostra OK / SUS / CRIME
```

## 9. Painel OBS/criacao

Usos:

- iniciar gravacao
- parar gravacao
- trocar cena
- mutar microfone
- marcar timestamp
- abrir roteiro
- mostrar REC na tecla

## 10. Principio de design

A D200H nao deve tentar ser uma tela grande. Ela deve ser um painel de estados curtos:

```txt
BUILD OK
TEST FAIL
AI READY
REC
STT
AUTH BUG
LINE 42
```

Isso e mais util que tentar enfiar video ou texto gigante nas teclas.
