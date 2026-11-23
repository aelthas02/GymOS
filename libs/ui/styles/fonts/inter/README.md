# Inter (self-hosted)

- Origem: release oficial [Inter 4.1](https://github.com/rsms/inter/releases/tag/v4.1)
  (`Inter-4.1.zip`, SHA-256 `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e`),
  arquivos `web/Inter-{Regular,Medium,SemiBold,Bold}.woff2`.
- Licença: SIL Open Font License 1.1, em [`LICENSE.txt`](LICENSE.txt). A Inter não tem nome de fonte
  reservado, então a versão reduzida mantém o nome.
- Subset latino (a mesma faixa do Google Fonts, declarada no `unicode-range` de `../../fonts.css`),
  com todas as features OpenType (inclusive `tnum`, para valores em colunas). Gerado com
  [`subset-font`](https://www.npmjs.com/package/subset-font) 2.9.0 (HarfBuzz), `targetFormat: 'woff2'`.

| Arquivo                 | Peso | Original | Subset  |
| ----------------------- | ---- | -------- | ------- |
| `inter-latin-400.woff2` | 400  | 111 KB   | 30,0 KB |
| `inter-latin-500.woff2` | 500  | 114 KB   | 30,7 KB |
| `inter-latin-600.woff2` | 600  | 115 KB   | 30,8 KB |
| `inter-latin-700.woff2` | 700  | 115 KB   | 30,8 KB |

Os apps publicam esta pasta em `/fonts/inter/` (`assets` do `project.json`) e fazem preload da 400 e
da 600 no `index.html`. Para atualizar a versão, refaça o subset com a mesma faixa e troque os quatro
arquivos e esta tabela.
