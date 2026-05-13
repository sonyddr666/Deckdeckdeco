# DeckDeckDeco

DeckDeckDeco e um plugin experimental para transformar o Ulanzi D200H em um cockpit fisico de automacao. A ideia e simples: voce aperta uma tecla no deck, o Ulanzi Studio envia o evento para o plugin, o plugin roda ou mostra algo no PC, e a tecla vira uma mini tela de estado.

```txt
D200H fisico
-> Ulanzi Studio
-> DeckDeckDeco em Node.js
-> comando, script, pagina, status, imagem ou GIF no PC
-> botao mostra o que voce configurou
```

O D200H nao roda Python, IA ou scripts sozinho. Ele e o controle fisico. Quem executa as coisas e o PC.

## O que este projeto quer resolver

O objetivo nao e fazer a telinha pequena virar um monitor completo. O objetivo e criar botoes vivos, configuraveis e reaproveitaveis:

- rodar comando local;
- abrir URL;
- mostrar imagem ou GIF;
- mostrar um card curto de status;
- executar Python, Node, PowerShell ou outro script;
- criar perfis de botoes pelo painel web;
- usar Smart Button como botao generico no deck;
- usar arquivos editaveis para guardar perfis, paginas, assets e scripts.

## Ideia principal: Smart Button

A lista lateral do Ulanzi Studio nao deve ter um item novo para cada botao que voce cria. Essa lista vem do `manifest.json` e e lida pelo Ulanzi quando o plugin carrega.

O jeito certo e ter uma action fixa:

```txt
DeckDeckDeco
- Control Panel
- Smart Button
- Run Command
- Snippet Card
- Voice AI
- Translator
- YouTube Control
```

Voce arrasta `Smart Button` para uma tecla. Depois escolhe qual perfil aquele botao deve usar: A, B, C, TOOLS, GLITCH, BACK etc.

```txt
Smart Button no deck
-> perfil escolhido no inspector pequeno
-> dados do perfil salvos em arquivo
-> imagem/GIF aparece na tecla
-> ao apertar, executa a acao configurada
```

## Painel pequeno vs painel web

Existem duas telas diferentes.

### Painel pequeno do Ulanzi

O painel pequeno embaixo do Ulanzi Studio deve ser minimalista. Para Smart Button, ele serve basicamente para escolher o perfil:

```txt
Perfil: [ A / B / C / TOOLS / GLITCH ]
Atualizar lista
```

Ele nao deve ser o painel completo espremido dentro do Ulanzi.

### Painel web completo

O painel completo abre no navegador pelo `Control Panel`. Ele e usado para criar e editar perfis.

No painel web voce configura:

- ID do perfil;
- titulo;
- imagem ou GIF;
- acao ao apertar;
- comando/script;
- URL;
- pagina virtual alvo;
- se deve mostrar status RUN/OK/FAIL;
- dados de glitch, se for o caso.

## Regra visual dos botoes

O Smart Button nao deve mudar o icone sozinho.

```txt
Se o perfil tem imagem fixa: fica imagem fixa.
Se o perfil tem GIF: fica GIF.
Se a acao nao manda mudar visual: nao muda.
Se voce ativar status RUN/OK/FAIL: ai sim muda durante a execucao.
```

Nada de `DONE`, `READY`, `SAVED` ou `BROWSER` aparecendo do nada em cima do icone escolhido.

## Estrutura de arquivos esperada

A versao baseada em Smart Buttons usa arquivos editaveis para controlar os botoes.

```txt
deck-data/
- buttons.json
- pages.json
- assets/
  - imagens e GIFs usados nos botoes
- scripts/
  - scripts chamados pelos botoes
```

### `buttons.json`

Guarda os perfis de botao.

Exemplo:

```json
{
  "buttons": [
    {
      "id": "A",
      "title": "A",
      "image": "deck-data/assets/a.png",
      "action": "none"
    },
    {
      "id": "B",
      "title": "PY",
      "image": "deck-data/assets/python.png",
      "action": "command",
      "command": "py -3 deck-data/scripts/hello.py"
    },
    {
      "id": "TOOLS",
      "title": "TOOLS",
      "image": "deck-data/assets/folder.png",
      "action": "page",
      "targetPage": "tools"
    }
  ]
}
```

### `pages.json`

Guarda paginas virtuais do deck. Uma pagina virtual e uma lista de perfis que podem preencher Smart Buttons.

Exemplo:

```json
{
  "currentPage": "main",
  "pages": {
    "main": ["A", "B", "TOOLS"],
    "tools": ["GLITCH", "BACK"]
  }
}
```

## Tipos de acao

Um perfil pode ter uma destas acoes:

| Acao | O que faz |
| --- | --- |
| `none` | Nao faz nada ao apertar |
| `command` | Roda comando/script no PC |
| `url` | Abre uma URL |
| `page` | Entra numa pagina virtual do deck |
| `back` | Volta para a pagina anterior |
| `glitch` | Executa efeito visual temporario configurado |

## Como usar Smart Button

1. Instale o plugin.
2. Arraste `Smart Button` para uma tecla.
3. No painel pequeno, escolha um perfil.
4. Abra `Control Panel` para editar ou criar perfis.
5. Salve o perfil.
6. A tecla deve mostrar a imagem/GIF do perfil escolhido.
7. Ao apertar a tecla fisica, ela executa a acao configurada.

## Rodando comandos e scripts

Para rodar Python:

```txt
command: py -3 deck-data/scripts/hello.py
```

Para rodar Node:

```txt
command: node scripts/examples/fake-test.mjs
```

Para abrir Bloco de Notas no Windows:

```txt
command: notepad
```

Sempre teste o comando no terminal antes. Se nao roda no terminal, o deck tambem nao vai salvar o mundo sozinho.

## Snippet Card

`Snippet Card` mostra texto curto vindo de comando ou arquivo. E util para mini dashboards:

```txt
BUILD OK
23:18:23
branch: main
deck: live
```

Ele pode mostrar status de build, branch, teste, servidor local, CPU, GPU ou qualquer comando que imprima texto curto.

## Control Panel

`Control Panel` abre o painel web completo. Ele nao e o lugar de executar comandos. Ele e a central de criacao e edicao.

Use ele para:

- criar perfis;
- enviar imagem/GIF;
- salvar assets em `deck-data/assets/`;
- editar comandos;
- configurar paginas virtuais;
- revisar JSON cru quando precisar.

## Clique no Studio vs tecla fisica

Isso e importante:

```txt
Clique com mouse no Ulanzi Studio
-> seleciona a tecla e mostra configuracao

Aperto no botao fisico do D200H
-> executa a action
```

Clicar na pre-visualizacao do deck dentro do Studio nao executa a action.

## Instalacao Windows

Na pasta do projeto, com o Ulanzi Studio fechado:

```powershell
npm install
npm run setup:windows
```

Depois abra o Ulanzi Studio.

Se o plugin parecer velho, feche o Ulanzi Studio, rode o setup de novo e abra novamente.

## Problemas comuns

### O perfil salva no painel web, mas o deck nao muda

O plugin precisa redesenhar os Smart Buttons que usam aquele perfil. Se nao atualizar na hora, troque o perfil no seletor ou clique em atualizar lista. A correcao ideal e o painel web avisar o plugin vivo para redesenhar todos os botoes afetados.

### A imagem aparece no painel web, mas nao aparece no deck

Confira se a imagem foi salva em `deck-data/assets/` e se o perfil aponta para esse caminho. Caminho quebrado cai em fallback de texto.

### Todos os botoes viraram A

Provavelmente todos os Smart Buttons estao usando o mesmo perfil A. Selecione cada tecla e escolha perfis diferentes.

### O botao mostra texto em vez de imagem

Isso e fallback. O plugin nao encontrou ou nao conseguiu renderizar a imagem configurada.

## Filosofia do projeto

DeckDeckDeco deve ser um deck por arquivos editaveis:

```txt
Painel web cria perfis
Arquivos guardam dados
Smart Button carrega perfil
Deck mostra imagem/GIF escolhido
Botao fisico executa acao configurada
```

A ideia e parar de criar botao rigido e passar a criar um sistema vivo, editavel e menos amaldiçoado. Um cockpit de automacao com dignidade visual.
