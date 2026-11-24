# Como contribuir

## TDD: vermelho → verde → refatorar

Todo código novo começa pelo teste.

1. **Vermelho**: escreva os testes listados em "Testes primeiro" no ticket e veja-os falhar pelo motivo
   certo (a regra ainda não existe, não um erro de digitação no teste).
2. **Verde**: escreva o mínimo de código para os testes passarem.
3. **Refatorar**: limpe nomes, duplicações e estrutura com os testes verdes.

O PR mostra os testes falhando no primeiro commit e a implementação nos seguintes. Relógio e rede são
sempre controlados (porta `Relogio`, adapters fake); nenhum teste depende da ordem de outro. Testes de
regra de negócio usam dados próprios do teste, não os nomes do protótipo, quando a tela contradiz a
regra.

Cobertura: o relatório sai em `coverage/` a cada `pnpm test`. Os limites mínimos (85% de linhas e 80%
de branches no geral; 100% em validadores, máscaras, pipes, dinheiro e domínio) entram no CI pelo T03.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/), verificados pelo commitlint no hook
`commit-msg`. Assunto em português, no imperativo e em minúsculas:

```
feat(api): valida variáveis de ambiente na inicialização
fix(staff-web): corrige o foco do modal ao fechar
test(ui): cobre a navegação por teclado das abas
docs(adr): registra a decisão do provedor de pagamento
```

Tipos: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `style`, `build`, `ci`, `chore`, `revert`. O
escopo é opcional e costuma ser o projeto Nx. Linhas do corpo com até 100 caracteres.

O hook `pre-commit` roda ESLint e Prettier nos arquivos do commit (lint-staged). Não use `--no-verify`:
se o hook falhar, corrija a causa.

## Pull requests

- **Pequenos**: uma tela ou um caso de uso por PR quando possível.
- Antes de abrir, rode `pnpm lint`, `pnpm test` e `pnpm build`. O CI roda os mesmos alvos com
  `nx affected`, mais a verificação do Prettier.
- Mudança em pasta de outro agente exige a revisão do dono ([`CODEOWNERS`](CODEOWNERS)).
- Endpoint novo regenera `libs/api-contracts` no mesmo PR; variável de ambiente nova entra no schema
  da API e no `.env.example`.
- Divergência entre telas vai para [`docs/design/inconsistencias.md`](docs/design/inconsistencias.md)
  com a decisão tomada. Os demais arquivos de `docs/design/` não são alterados.
- Decisão de arquitetura nova vira um ADR em [`docs/adr/`](docs/adr/README.md).

## Projetos novos

Gere pelo Nx e dê as tags de escopo e de tipo (ver [`ARCHITECTURE.md`](ARCHITECTURE.md)):

```sh
pnpm nx g @nx/angular:library libs/<nome> --tags="scope:shared,type:ui"
pnpm nx g @nx/js:library libs/shared/<pacote> --name=shared-<pacote> \
  --importPath=@gymos/shared-<pacote> --bundler=none --unitTestRunner=vitest \
  --tags="scope:shared,type:util"
```

Pacotes compartilhados seguem a convenção de `libs/shared/<pacote>` descrita no `ARCHITECTURE.md`.
Acrescente o alvo `typecheck` no `project.json`, como nos projetos existentes, e confira a linha do dono
no `CODEOWNERS`.

## Seed

`pnpm seed` (build da API + `gymos seed`) popula a Academia Ritmo para dev e E2E, em ordem de
dependência, e pode rodar de novo: não duplica dados. Não roda em produção.

Para registrar o módulo de um domínio:

1. Crie `apps/api/src/seed/<dominio>.ts` e exporte um `ModuloDeSeed` (`modulo-de-seed.ts`):

   ```ts
   export const seedDosPlanos: ModuloDeSeed = {
     nome: 'planos',
     dependeDe: ['plataforma'], // nomes dos módulos que precisam rodar antes
     async executar(app, contexto) {
       await contexto.noTenant(async () => {
         // runAsTenant da Ritmo: use os repositórios do domínio e confira a existência antes de criar
       });
     },
   };
   ```

2. Acrescente o módulo em `MODULOS_DE_SEED` (`apps/api/src/seed/modulos.ts`). O runner ordena por
   `dependeDe`; uma dependência não registrada falha com a mensagem "depende de X, que não está
   registrado". Ordem de referência: plataforma → autenticação → funcionários → planos → alunos →
   contratos → parcelas → pagamentos → notas.
3. O módulo é **idempotente** e **coerente com as regras de negócio**: não copia as contradições das
   telas (registre a decisão em `docs/design/inconsistencias.md`). Tempo só pela porta `Relogio`.
4. Se o E2E precisa criar dados na hora, registre uma fábrica em `FabricasDeTeste` (API de teste,
   só dev e teste) e chame `criarPelaFabrica(request, '<nome>', dados)` de `apps/e2e/src/api.ts`.

## E2E e regressão visual

`apps/e2e` é o Playwright: projetos `desktop` (1280), `tablet` (820×1180) e `mobile` (390×844,
fator 2), cada um em Chromium e WebKit. O `test` de `apps/e2e/src/teste.ts` bloqueia a rede externa
(requisição para fora falha o teste), fixa o relógio do navegador e da API em 19/11/2026 09:00 de São
Paulo e já traz `expectScreenMatchesReference`. `pnpm e2e` cria um banco `gymos_e2e_*` descartável,
migra, roda o seed, sobe a API, executa o Playwright e apaga o banco (sem Docker: Postgres e Redis
locais; no CI, `services:`). Argumentos vão para o Playwright: `pnpm e2e --project=desktop-chromium`.

**Fixture de uma tela.** O dono da tela cria `apps/<app>/src/app/features/<feature>/testing/<Tela>.fixture.ts`
com as respostas da API (tipos de `libs/api-contracts`), os nomes e números exatos da tela e, se
precisar, o relógio da tela:

```ts
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';

export default {
  relogio: '2026-11-19T09:50:00-03:00', // opcional; o padrão é 19/11/2026 09:00
  respostas: [{ caminho: /^\/alunos(\?.*)?$/, corpo: { itens: [] /* ... */ } }],
} satisfies FixtureDeTela;
```

**Registro na regressão visual.** Um spec `apps/e2e/src/telas/<Tela>.visual.e2e.ts`:

```ts
import fixture from '<caminho>/Alunos.fixture';
import { servirFixture } from '../fixture-de-tela';
import { test } from '../teste';

test('Alunos bate com a referência', async ({ page, expectScreenMatchesReference }) => {
  await servirFixture(page, fixture); // API interceptada + relógio do fixture
  await page.goto('/alunos');
  await expectScreenMatchesReference('Alunos', {
    largura: 1280,
    regioesDinamicas: ['[data-cursor]'], // cursor e animações, pintados nas duas imagens
    relogio: fixture.relogio,
  });
});
```

O baseline é `docs/design/telas/html/<Tela>.html` renderizado no mesmo contêiner e navegador, com a
Inter local; o limiar é de 0,5% dos pixels. Telas do aluno rodam nos projetos `mobile-*`; em tablet
(820 px) não há referência: o snapshot é criado na primeira execução (`--update-snapshots=missing`) e
o revisor o aprova no PR. Overlays de tutorial usam `expectTutorialMatchesReference(page, 'Alunos')`
contra `TutAlunos.html`. Quando a diferença passa do limiar, o relatório (referência, atual e
diferenças) fica em `dist/e2e/relatorio-visual/index.html`, publicado como artefato do CI.
