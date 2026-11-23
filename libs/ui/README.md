# @gymos/ui

Design system do GymOS: tokens, tema por academia e componentes de apresentação usados pelo painel e
pelo app do aluno. Dono: Agente 2 (T04 a T07).

Tags `scope:shared` e `type:ui`: importa só libs `type:ui` e `type:util`; nunca apps nem
`data-access`. Testes: `pnpm nx test ui`. Storybook: `pnpm nx storybook ui` (porta 4400) e
`pnpm nx build-storybook ui`.

## Estilos (`libs/ui/styles`)

| Arquivo                                | Conteúdo                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `index.css`                            | entrada global, carregada pelos dois apps e pelo Storybook                    |
| `tokens.css` / `tokens.ts`             | todos os tokens como custom properties e o espelho tipado (mesmas chaves)     |
| `fonts.css`, `fonts/inter/`            | Inter 4.1 self-hosted, subset latino, 400 a 700, com a licença OFL            |
| `base.css`                             | fonte e cores da página; `prefers-reduced-motion` zera transições e animações |
| `layout.css`                           | `.ui-full-height` (`100dvh`), `.ui-safe-area` e `--safe-*`                    |
| `_breakpoints.scss` / `breakpoints.ts` | mobile < 768, tablet 768–1279, desktop ≥ 1280, em mixins e em media queries   |
| `contrast.ts`                          | contraste WCAG, conversão Hex/RGB e o tema derivado do acento (ADR-014)       |

**Cores só por token.** Fora de `libs/ui/styles` nenhuma cor é escrita à mão: use `var(--nome)` no
CSS e `cssVar('nome')` no TypeScript. A regra `gymos/no-hardcoded-color` (`pnpm lint`) recusa hex,
`rgb()`/`hsl()`, nomes de cor e fallback de `var()` em CSS, SCSS, TypeScript e templates do front;
testes, fixtures e histórias ficam de fora. Cor nova vira token aqui, nos dois arquivos.

Num componente SCSS, os mixins ficam disponíveis por `@use 'breakpoints' as bp;` (os apps e o
Storybook incluem `libs/ui/styles` no `includePaths`).

## Tema da academia

`ThemeService.setAccent(hex)` recebe a cor de destaque (`#RGB` ou `#RRGGBB`) e escreve no
`documentElement`:

- `--accent`: a cor normalizada, para fundos e preenchimentos;
- `--accent-contrast`: texto e ícones sobre o acento, tinta `#0C1722` ou branco, a de maior
  contraste; nos tons médios em que nenhuma das duas chega a 4,5:1, preto;
- `--accent-text`: o acento escurecido até 4,5:1 sobre `--surface` e `--page`, para texto e ícones em
  fundo claro.

Cor inválida lança `InvalidHexColorError` e o tema fica como estava. Os signals `accent`,
`accentContrast`, `accentText` e `palette` expõem o tema atual. Quem carrega a cor da API (T14 e T32)
chama o serviço; sem chamada, vale o tema padrão de `tokens.css`.
