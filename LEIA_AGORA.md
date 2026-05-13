# DeckDeckDeco v5

Agora tem duas actions novas:

- **Open Icon Folder**: abre a pasta segura `resources/glitch` para voce trocar/adicionar icones.
- **Glitch FX**: usa os icones de `resources/glitch` para trocar temporariamente os botoes DeckDeckDeco e depois restaurar.

## Instalar

Feche o Ulanzi Studio, abra PowerShell nesta pasta e rode:

```powershell
npm run setup:windows
```

Depois abra o Ulanzi Studio.

## Como usar

1. Arraste **Open Icon Folder** para uma tecla. Aperte a tecla fisica para abrir a pasta dos icones.
2. Coloque ou edite arquivos `.svg`, `.png`, `.jpg`, `.webp` ou `.gif` dentro de `resources/glitch`.
3. Arraste **Glitch FX** para uma tecla. Aperte a tecla fisica para disparar o efeito.
4. Ele troca temporariamente os icones dos botoes DeckDeckDeco conhecidos e depois volta ao estado normal.

## Segurança

O plugin só aceita a pasta `resources/glitch` e subpastas dela para o efeito. Se tentar caminho fora disso, ele volta para a pasta segura.
