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

## Componentes (`libs/ui/src/lib`)

Todos standalone, `OnPush`, com `input()`/`output()`/`model()` e seletor `ui-*`. Cada um tem teste ao
lado (`*.spec.ts`) e história em `src/stories/`. Import por `@gymos/ui`.

| Grupo      | Componentes                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Ações      | `Button` (primary, accent, outline, danger; sm, md, lg; `loading`), `IconButton`                                                      |
| Dados      | `Badge` (`ok`, `late`, `soon`, `off`), `Avatar`, `Card` (`inverse`), `Kpi`, `Table`                                                   |
| Navegação  | `Tabs` (rota), `SidebarNav`, `AppShell`, `PageHeader`, `BottomTabBar`                                                                 |
| Formulário | `Field` + `FieldControl`, `Select`, `Toggle`, `Checkbox`, `Chips`                                                                     |
| Camadas    | `Modal` (janela ou `variant="drawer"`), `ToastService` + `ToastOutlet`                                                                |
| Estados    | `EmptyState`, `ErrorState`, `NoPermissionState`, `Skeleton`                                                                           |
| Gráficos   | `BarChart`, `StackedBarChart`, `HorizontalBars`, `Donut`, `LineChart`, `AreaChart`, `Sparkline`, `Heatmap`, `ProgressBar`, `WeekDots` |
| Ícones     | `Icon` e o conjunto `icons` (24×24, traço de 2 px); acrescente em `icon/icons.ts`                                                     |

Decisões que valem para o uso:

- **Rota ativa vem do router**, não de estado: `Tabs`, `SidebarNav` e `BottomTabBar` usam
  `injectIsActive()` (`router/active-link.ts`). Não há `selected` para o pai manter.
- **`Table` não ordena nem pagina**: emite `sortChange` (`{ column, direction }`) e `pageChange`; o
  servidor responde. Acima de 100 linhas usa o viewport virtual do CDK (`rowHeight`, 61 px por padrão,
  precisa ser a altura real da linha). A célula é um slot: `<ng-template uiTableCell="nome" let-row>`.
- **`SidebarNav` recebe a lista pronta**: quem monta as seções resolve flags e permissões e marca
  `visible: false` (ou tira o item). Seção sem item visível some, título incluso.
- **`AppShell`** escolhe o modo por `BreakpointObserver`: menu completo no desktop, recolhido em ícones no
  tablet e gaveta (`Modal`) no mobile. O conteúdo da tela vai dentro do `<main>`.
- **Foco**: `Modal` prende o foco, fecha com Esc e devolve o foco a quem o abriu; `dismissable=false`
  desliga Esc, fundo e o X para fluxos que exigem resposta. `Toast`: até 3 por vez, o resto espera na
  fila; erro é `role="alert"`, os demais `status`. Coloque um `<ui-toast-outlet />` por app.
- **Checkbox** usa `accent-color: var(--accent-text)` (o acento da academia escurecido para 4,5:1),
  não o verde fixo `#0F8F63` do protótipo.
- Novos tokens de T05: `--on-ink`, `--border-dashed`, `--nav-*` e `--state-error-*`/`--state-warn-*`
  (cores que o protótipo repete e que não estavam em `design-tokens.json`).

### Gráficos ()

SVG próprio, sem biblioteca: e , então o gráfico acompanha a largura do pai.

- **Dados e formatação por input.** Os de uma série recebem ; recebe
  , a matriz e .
  é uma função : as telas injetam aqui os pipes do T08 (moeda, número,
  percentual). Sem ela vale o número em pt-BR; valor que não é número aparece como —.
- **Cor só por token.** A primeira série é (segue o tema da academia); as seguintes, a
  ; barras sem destaque, ; cancelamentos, . pinta o maior valor
  de acento e escreve o rótulo dele (112 às 18h); aceita para o 54% da legenda.
- **Acessibilidade.** O leva com o resumo ( da tela mais o pico) e, ao lado,
  uma tabela com todos os pontos já formatados; os cabeçalhos dela vêm de e
  . A cor nunca é a única pista: valor e rótulo estão no texto, na legenda e na tabela.
- **Estado vazio.** Lista vazia (ou total zero no ) mostra um com , nunca um
  SVG quebrado. Busca de dados e ficam com cada tela.
- **** parte de zero; com a escala vai do menor ao maior valor (evolução de carga,
  taxas). é o mesmo gráfico com a área preenchida.
- **Tamanho.** Medido num lazy chunk do staff-web (produção): o , o maior, com e a tabela,
  soma 4,9 kB em brotli; os dez juntos, cerca de 9 kB. Nenhum passa de 8 kB.
- Cores dos gráficos viram token em e , como as demais.

### Testes e acessibilidade

`src/testing/stories-a11y.spec.ts` monta **cada história** do Storybook no Vitest e roda o axe-core.
O jsdom não calcula layout nem cor, então a regra `color-contrast` fica de fora (e as regras de página
inteira, como `region`); o contraste vem dos tokens e é coberto por `contrast.spec.ts`. Ao criar uma
história nova, o teste a encontra sozinho.
