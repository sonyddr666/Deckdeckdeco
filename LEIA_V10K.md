# DeckDeckDeco v10k

Essa versão muda a lógica principal para **Smart Button + arquivos editáveis**.

## O que usar no Ulanzi

Arraste **Smart Button** para uma tecla.

No painel pequeno do Ulanzi:

- `manual`: escolhe um perfil como `A`, `B`, `TOOLS`, `GLITCH`.
- `page`: usa `slotIndex` para virar um slot de página virtual.

## Onde editar botões

Abra **Control Panel** e clique no painel completo no navegador.

Arquivos principais:

```txt
deck-data/buttons.json
deck-data/pages.json
deck-data/assets/
deck-data/scripts/
```

## Regra visual

Smart Button **não troca para READY/DONE sozinho**. Ele mostra a imagem/GIF do perfil. Só muda se a ação do perfil mandar.

## Pastas virtuais

Um perfil com ação `page` troca todos os Smart Buttons em modo `page` para outra página definida em `deck-data/pages.json`.

Exemplo:

```json
{ "id": "TOOLS", "action": "page", "targetPage": "tools" }
```

Um perfil com ação `back` volta para a página anterior.
