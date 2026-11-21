# ADR-019: Regressão visual

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); mecanismo no T35

## Contexto

As telas se contradizem entre si; um seed único não reproduz todas, e comparar com PNG de outro
ambiente estoura o limiar só por fonte e antialiasing.

## Decisão

Só no front, com a API interceptada por fixture de cada tela e relógio próprio; baseline é o HTML de
referência renderizado no mesmo navegador; E2E roda no back real com seed coerente, sem pixels.

- Cada tela com referência tem um fixture JSON tipado por `libs/api-contracts` em
  `apps/<app>/src/app/features/<feature>/testing/<Tela>.fixture.ts`, com os nomes e números exatos da
  tela e o seu relógio (por padrão 19/11/2026 09:00 America/Sao_Paulo).
- O baseline é `docs/design/telas/html/<Tela>.html` renderizado no mesmo contêiner e navegador, com a
  Inter self-hosted. O PNG serve para conferência humana.
- Limiar: 0,5% dos pixels; ajustável no T35 se o baseline não for determinístico.

## Alternativas consideradas

- **Comparar com os PNGs do protótipo**: diferenças de fonte e antialiasing entre ambientes geram
  falso positivo.
- **Regressão visual no E2E com seed único**: o seed não consegue reproduzir telas que se contradizem.
- **Chromatic**: custo e mesmo problema de ambiente.

## Consequências

- O fixture reproduz a tela; as regras de negócio não se curvam ao fixture. Divergências vão para
  `docs/design/inconsistencias.md`.
- O E2E valida fluxo e regra no back real, sem comparar pixels.
