# Arquitetura

Visão das camadas do GymOS e das regras de import. As decisões e o porquê de cada escolha estão nos
[ADRs](docs/adr/README.md); as regras de tela e de fatia vertical estão resumidas no fim deste arquivo.

## Monorepo

Workspace Nx integrado com pnpm (ADR-001). Cada projeto tem um `project.json` com duas tags: o
**escopo** (de quem é o código) e o **tipo** (em que camada ele está). Os aliases de import ficam em
`tsconfig.base.json` (`@gymos/ui`, `@gymos/api-contracts` e um `@gymos/shared-<pacote>` por pacote
compartilhado).

| Projeto           | Caminho                | Escopo          | Tipo               |
| ----------------- | ---------------------- | --------------- | ------------------ |
| `staff-web`       | `apps/staff-web`       | `scope:staff`   | `type:app`         |
| `student-app`     | `apps/student-app`     | `scope:student` | `type:app`         |
| `api`             | `apps/api`             | `scope:api`     | `type:app`         |
| `turnstile-agent` | `apps/turnstile-agent` | `scope:agent`   | `type:app`         |
| `ui`              | `libs/ui`              | `scope:shared`  | `type:ui`          |
| `api-contracts`   | `libs/api-contracts`   | `scope:shared`  | `type:data-access` |
| `architecture`    | `tools/architecture`   | `scope:shared`  | `type:util`        |

## Regras de import entre projetos

Aplicadas pelo `@nx/enforce-module-boundaries` no `eslint.config.mjs` da raiz. `pnpm lint` falha se uma
regra for violada.

**Escopo**: cada escopo importa só de si mesmo e de `scope:shared`.

| Quem importa    | Pode importar                   |
| --------------- | ------------------------------- |
| `scope:staff`   | `scope:staff`, `scope:shared`   |
| `scope:student` | `scope:student`, `scope:shared` |
| `scope:api`     | `scope:api`, `scope:shared`     |
| `scope:agent`   | `scope:agent`, `scope:shared`   |
| `scope:shared`  | `scope:shared`                  |

**Tipo (camada)**: as dependências descem, nunca sobem.

| Quem importa       | Pode importar                                    |
| ------------------ | ------------------------------------------------ |
| `type:app`         | `feature`, `ui`, `data-access`, `domain`, `util` |
| `type:feature`     | `feature`, `ui`, `data-access`, `domain`, `util` |
| `type:ui`          | `ui`, `util`                                     |
| `type:data-access` | `data-access`, `domain`, `util`                  |
| `type:domain`      | `domain`, `util`                                 |
| `type:util`        | `util`                                           |

Consequências diretas:

- `libs/ui` não importa de `apps/*` (o Nx proíbe importar um app, por alias ou por caminho relativo)
  nem de libs `data-access`, como `libs/api-contracts`. Componentes de apresentação recebem dados por
  `input()` e emitem `output()`.
- Uma lib `domain` não importa `data-access`, que é a camada de infraestrutura do lado das libs.
- Nenhum projeto importa outro por caminho relativo; só pelo alias `@gymos/*`.

Ao criar um projeto, dê as duas tags no gerador (`--tags="scope:<escopo>,type:<tipo>"`). Os testes em
`tools/architecture` provam as regras com fixtures de lint e rodam em todo PR.

## Pacotes compartilhados (`libs/shared/<pacote>`)

`libs/shared/` é só uma pasta de agrupamento, sem projeto na raiz. Cada pacote compartilhado é um
projeto Nx próprio, criado pelo ticket que precisa dele:

- caminho `libs/shared/<pacote>`, um nível abaixo de `libs/shared/`;
- nome do projeto `shared-<pacote>` e alias `@gymos/shared-<pacote>`;
- tags `scope:shared` e exatamente um tipo: `type:util` (utilitários, formatação, componentes simples)
  ou `type:domain` (regras de negócio puras, sem framework).

```sh
pnpm nx g @nx/js:library libs/shared/<pacote> --name=shared-<pacote> \
  --importPath=@gymos/shared-<pacote> --bundler=none --unitTestRunner=vitest \
  --tags="scope:shared,type:util"
```

Pacotes com Angular (diretivas, componentes) usam `@nx/angular:library` com os mesmos nome, alias e
tags. O teste `tools/architecture/src/shared-packages.spec.ts` confere a convenção.

| Pacote       | Conteúdo                                                  | Ticket | Tipo          |
| ------------ | --------------------------------------------------------- | ------ | ------------- |
| `money`      | tipo Centavos, arredondamento, rateio                     | T08    | `type:util`   |
| `validation` | validadores (CPF, CNPJ, telefone, e-mail, datas)          | T08    | `type:util`   |
| `pipes`      | pipes de exibição (`brl`, `cpf`, `dateBr`…)               | T08    | `type:util`   |
| `templates`  | variáveis de mensagem                                     | T08    | `type:util`   |
| `forms`      | `ValidatorFn` e mensagens (T08); máscaras e diretivas     | T09    | `type:util`   |
| `testing`    | harness de teclado para testes                            | T10    | `type:util`   |
| `ambiente`   | banner DEV/STAGING, correlationId e Sentry do front       | T02    | `type:util`   |
| `events`     | tipos dos eventos de domínio                              | T13a   | `type:util`   |
| `acesso`     | regras de acesso usadas pela API e pelo agente da catraca | T23a   | `type:domain` |

O tipo da tabela é o esperado; o ticket confirma ao criar o pacote, e o dono do pacote está no
`CODEOWNERS`.

`money`, `validation`, `templates` e os formatadores de `pipes` também rodam no back, por isso o lint
proíbe `@angular/*` neles. O back importa os formatadores (`formatarBrl`, `formatarDataBr`…) pelo
alias `@gymos/shared-pipes/formatadores`, que não carrega os pipes Angular. Esses pacotes exigem 100%
de cobertura de linhas e branches no `vitest` de cada um.

Nos arquivos de `domain/`, o lint proíbe `* 0.`, `/ 100` e `/ 10000`: dinheiro é centavo inteiro e
alíquota é ponto-base inteiro, com as funções de `money` (`aplicarAliquota`, `ratear`, `ratearPorPeso`).

## Front-end (Angular)

Angular zoneless, standalone, signals e OnPush (ADR-002).

```
apps/<app>/src/app/
  app.ts, app.config.ts, app.routes.ts   raiz: só a saída do roteador e os providers
  features/<feature>/
    pages/        containers: injetam a store e compõem a tela
    components/   apresentação: só input() e output()
    data-access/  store da feature (NgRx SignalStore) e chamadas ao cliente gerado
    models/       tipos da feature (os da API vêm de @gymos/api-contracts)
    utils/        funções puras da feature
    testing/      fixtures da regressão visual (<Tela>.fixture.ts)
```

- Rota lazy por feature; cada módulo extra é um chunk próprio guardado por `featureFlagGuard`.
- Sem regra de negócio no componente: totais, prazos e situações vêm calculados da API.
- Derivados com `computed`, sem função chamada no template, `track` em todo `@for`.
- Cliente HTTP gerado de `libs/api-contracts`; nenhum tipo de API escrito à mão (ADR-005).
- O lint proíbe componente fora de OnPush (`prefer-on-push-component-change-detection`).
- Cor só por token de `libs/ui/styles` (`var(--nome)` ou `cssVar()`); a regra
  `gymos/no-hardcoded-color` recusa cor fixa no front. O acento da academia passa pelo
  `ThemeService` (ADR-014). Detalhes no [README da `libs/ui`](libs/ui/README.md).

## Back-end (NestJS, hexagonal)

Módulos por domínio em `apps/api/src/modules/<dominio>/` (ADR-003):

```
domain/        entidades, regras e portas; TypeScript puro
application/   casos de uso; dependem das portas do domínio
infra/         Prisma, filas, adapters das integrações externas
interface/     controllers e DTOs
```

As dependências apontam para dentro: `interface` e `infra` → `application` → `domain`. O
`apps/api/eslint.config.mjs` aplica isso:

- `domain/` não importa de `application/`, `infra/` nem `interface/`, nem `@nestjs/*`, `@prisma/*` ou
  `prisma`;
- `application/` não importa de `infra/` nem `interface/`;
- `domain/` e `application/` não leem o relógio do sistema (`Date.now()`, `new Date()` sem argumento):
  usam a porta `Relogio`; consultas SQL dos módulos não usam `now()` nem `CURRENT_*`;
- fora de `modules/platform`, nenhum módulo importa o cliente Prisma global (`PrismaService`).

### Plataforma e multi-tenancy

`modules/platform` concentra o que é transversal (ADR-003 e ADR-004):

```
requisição → contexto (AsyncLocalStorage) → tenant pelo Host (404 se desconhecido)
           → transação com set_config('app.tenant_id', id, true) → handler → commit
```

- Repositórios recebem `ContextoDoTenant` e usam `contexto.cliente()`, o cliente da transação.
- Workers, jobs e webhooks usam `ExecutorDeTenant.runAsTenant(tenantId, fn)` ou `paraCadaTenant(fn)`.
- Toda tabela de domínio nasce por `pnpm nx g @gymos/api:tabela <dominio> <nome>`: `tenant_id`, índice,
  RLS forçado, política por `app.tenant_id` e o teste de convenção.
- Tempo pela porta `Relogio` (`agora()`, `hojeEm(fuso)`); em teste, `RelogioFixo`.
- Endpoints com `@nestjs/swagger`; `pnpm nx run api:openapi` regenera `libs/api-contracts` (ADR-005).

Integrações externas (emissor fiscal, pagamentos, catraca, Meta, IA, armazenamento) ficam atrás de
portas com adapter fake determinístico (ADRs 008 a 012).

### Eventos, filas, cache e tempo real

O `EventosModule` (`modules/platform/eventos.module.ts`, ADR-007, T13a) é global. As portas ficam em
`modules/platform/application/eventos.ts`; os tipos dos eventos, em `@gymos/shared-events`.

```
caso de uso ─ publicar() ─▶ evento_outbox (mesma transação)
despachante ─ FOR UPDATE SKIP LOCKED ─▶ 1 job por consumidor (BullMQ, fila do consumidor)
worker ─ runAsTenant ─▶ marca evento_processado + efeito do consumidor (mesma transação) ─▶ ack
```

**Publicar um evento.** No caso de uso, injete `PublicadorDeEventos` e chame
`publicar({ tipo: 'PagamentoConfirmado', payload })` dentro da requisição ou de `runAsTenant`. O
tenant, o id e o instante vêm da plataforma. Se o caso de uso falha, o rollback leva o evento junto.

**Consumir um evento.** No `onModuleInit` do módulo do domínio, registre o consumidor:

```ts
registro.registrar({
  nome: 'fiscal.emitir-nota', // estável: com o id do evento, é a chave de idempotência
  evento: 'PagamentoConfirmado',
  fila: 'notas',
  tratar: async (evento) => {
    /* efeito pelo contexto.cliente(), na transação da entrega */
  },
});
```

- A entrega é pelo menos uma vez e o efeito no banco, exatamente uma: a marca em `evento_processado`
  e o efeito estão na mesma transação. Efeito fora do banco (e-mail, emissor) precisa de chave de
  idempotência própria no provedor, ou de um job seguinte.
- Erro faz nova tentativa com espera exponencial; na quinta falha o job vai para a fila `falhas` com
  o motivo. Reprocessar: `POST /api/interno/falhas/:id/reprocessar` com a chave de operação.
- Consumidor registrado depois de o evento ser despachado não o recebe.

**Filas e jobs.** `Filas.enfileirar(fila, nome, { tenantId, ... })` nas filas `eventos`, `cobranca`,
`notas`, `mensagens`, `importacao` e `notificacoes`; job sem `tenantId` é recusado. O trabalho é
registrado com `ProcessadorDeFilas.registrarTrabalho(fila, nome, fn)` e roda em `runAsTenant`. Com
`FILAS_PROCESSAR=true`, o processo sobe os workers e o despachante; em dev e staging, o painel fica em
`/interno/filas` (chave de operação no cabeçalho `x-chave-de-operacao` ou como senha do navegador).

**Cache.** Só pelo `CacheComTenant`: `obter(['resumo-financeiro', mes], carregar, { ttlSegundos })` e
`invalidar(chave)`, sempre no tenant do contexto (`chaveDeCache(tenantId, ...partes)` monta
`tenant:<id>:cache:...`). Para invalidar por evento:
`cache.invalidarAoReceber('PagamentoConfirmado', 'financeiro.cache-resumo', (e) => [['resumo-financeiro']])`.

**Tempo real.** `TempoRealPorTenant.publicar(topico, mensagem)` e `assinar(topico, aoReceber)`, no canal
`tenant:<id>:<topico>` do tenant do contexto. Publique a partir de um consumidor de evento, depois do
commit, para não avisar o que um rollback desfez.

O lint proíbe `ioredis`, `bullmq` e `@bull-board/*` fora de `modules/platform`. Tudo no Redis fica sob
`REDIS_PREFIXO`; os testes de integração usam um prefixo por arquivo (`usarRedisDeTeste`).

### Autenticação, permissões e módulos extras

`modules/autenticacao` (T12, ADR-006):

- **Acesso declarado em toda rota `/api`**: `@Publica()`, `@Autenticado()` ou
  `@RequirePermission('alunos:excluir')`. O teste `acesso-declarado.spec.ts` recusa rota sem
  declaração. `@RequireModule('loja')` responde 404 com o módulo desligado.
- O `AcessoGuard` é global e roda antes do interceptor de transação: lê o banco na própria transação
  do tenant. A sessão validada chega ao handler por `@SessaoAtual()`.
- Catálogo de permissões e tipos padrão em `domain/permissoes.ts` e `domain/tipos-de-acesso.ts`;
  planos e módulos extras em `domain/modulos-do-plano.ts`.
- E-mail só pela porta `EnvioDeEmail` (`EMAIL_TRANSPORTE=fake` guarda em memória).

### Proteção de dados pessoais (LGPD)

O `ProtecaoDeDadosModule` (`modules/platform/protecao-de-dados.module.ts`, ADR-015, T13c) é global.
As portas ficam em `modules/platform/application/protecao-de-dados.ts` e
`application/direitos-do-titular.ts`.

```
valor ─ AES-256-GCM (chave de dados do tenant, versão ativa) ─▶ g1.<versão>.<iv>.<tag>.<dados>
valor ─ normalizar ─ HMAC-SHA256 (chave de índice do tenant) ─▶ <campo>_hash
chaves do tenant ─ envelopadas pela chave mestra (ProvedorDeChaves) ─▶ chave_do_tenant
```

**Marcar um campo.** Junto do repositório do domínio, defina os campos e use `proteger` ao gravar e
`revelar` ao ler. A coluna do campo guarda o texto cifrado e a `<campo>_hash` (com
`UNIQUE (tenant_id, <campo>_hash)` quando o valor é único no tenant) guarda o índice cego:

```ts
const ALUNO = definirCamposProtegidos('aluno', {
  cpf: { indice: 'cpf' }, // grava cpf (cifrado) e cpfHash
  telefone: { indice: 'telefone' },
  observacoesDeSaude: { sensivel: true }, // cada leitura grava o log de acesso
});

const data = await cifra.proteger(ALUNO, { nome, cpf, telefone, observacoesDeSaude });
await contexto.cliente().aluno.create({ data });

const aluno = await cifra.revelar(ALUNO, linha, { titularId: linha.id, quem: sessao.sujeitoId });
```

- O dado autenticado da cifra é `<tenant>|<entidade>.<campo>`: o texto não decifra em outro tenant
  nem em outro campo (`CifraInvalidaError`). Nunca logue o valor revelado.
- **Buscar por índice cego**: `where: { cpfHash: await cifra.indiceCego('cpf', termo) }`. Só busca
  exata; CPF parcial não é suportado. A normalização é a de `domain/indice-cego.ts` (CPF e telefone
  só com dígitos, e-mail minúsculo e sem espaços).
- **Dado sensível** (saúde, biometria): `revelar` grava em `acesso_a_dado_sensivel` quem, quando, qual
  titular e qual campo, na transação da leitura. `quem` é o id do usuário da sessão, ou
  `sistema:<processo>` em jobs.
- **Chaves**: criadas na primeira cifra do tenant, numa transação própria. `ChavesDoTenant.rotacionar`
  cria uma nova chave de dados (as antigas continuam decifrando; `recifrar` migra um valor) e mantém
  a chave de índice. Em dev e teste, a chave mestra vem de `CHAVE_MESTRA_LOCAL`; produção recusa a
  chave local e usa o KMS.

**Checar consentimento.** `Consentimentos.elegivel(alunoId, finalidade)` ou `elegiveis(ids, finalidade)`
antes de enviar. `transacional` (cobrança, lembrete de vencimento, link de pagamento, nota fiscal,
avisos de reserva) é sempre elegível; `marketing`, `dados_de_saude` e `biometria` dependem do último
aceite. `registrar({ alunoId, finalidade, decisao: 'aceite' | 'revogacao', origem })` grava o
histórico com a data do `Relogio` e vale na hora.

**Implementar o provedor do titular.** Todo domínio que guarda dado de aluno registra um
`ProvedorDeDadosDoTitular` no `onModuleInit`:

```ts
registro.registrar({
  dominio: 'fiscal',
  retencao: { motivo: 'Guarda de notas fiscais', prazoEmAnos: 5 }, // só com obrigação legal
  exportar: (alunoId) => repositorio.notasDoAluno(alunoId),
  excluirOuAnonimizar: (alunoId, modo) => repositorio.anonimizarTomador(alunoId), // modo 'anonimizar'
});
```

`DireitosDoTitular.exportar(alunoId)` reúne o JSON de todos os domínios; `excluir(alunoId)` chama cada
provedor com `excluir`, ou `anonimizar` quando o domínio declara retenção, e devolve o relatório. Tudo
roda na transação do tenant: se um domínio falha, nada é excluído.

### Auditoria (log de atividades)

`Auditoria` (`modules/platform`, módulo global `AuditoriaModule`) alimenta a aba "Log de atividades" da tela
Permissões. Todo caso de uso que altera dado chama `registrarAtividade` **dentro da própria transação**:
o registro usa o cliente do `ContextoDoTenant`, então um rollback do caso de uso também o desfaz.

```ts
const autor = await auditoria.autorDoUsuario(sessao.sujeitoId); // { nome, papel } atuais
await auditoria.registrarAtividade({
  quem: { id: sessao.sujeitoId, nome: autor.nome },
  papel: autor.papel,
  acao: 'excluiu-aluno', // chave do catálogo em domain/atividade.ts
  detalhe: 'Cadastro duplicado: Marcelo Dias',
  // modulo e sensivel vêm do catálogo; passe `sensivel: true` para marcar uma ação comum.
});
```

- **Catálogo em código** (`ACOES_DA_AUDITORIA`): a chave fica no banco; o texto, o módulo e a etiqueta
  "Sensível" vêm do código. Ação nova entra no catálogo no PR do caso de uso dono.
- **Consulta** `GET /api/auditoria/atividades` (cursor opaco, `limite` até 100) e **CSV**
  `GET /api/auditoria/atividades/exportar`; filtros `usuarioId`, `modulo`, `de`, `ate` (exclusivo) e `tipo`
  (`todos` cronológico, `destaque` com sensíveis primeiro, `sensiveis`). Só o Administrador:
  `@RequirePermission('permissoes:ver')` (o catálogo do T12 não tem a ação `log`).
- **Cursor estável:** a ordem é (sensível quando em destaque, `ocorrido_em`, `ordem`), com `ordem` sequencial,
  então registros do mesmo milissegundo não se repetem nem se perdem entre páginas.
- **403 vira registro:** `AoNegarPermissaoAuditado` implementa o gancho do T12 e grava "Tentativa negada"
  (sensível, módulo da permissão negada). Falha ao gravar vai para o log e o 403 continua 403.
- **Retenção de 12 meses:** `LimpezaDaAuditoria` roda `paraCadaTenant` ao subir e a cada 24 h nos processos com
  `FILAS_PROCESSAR=true`; apaga `ocorrido_em` anterior a agora menos 12 meses (exatos ficam).

Quem grava cada ação do `Log.html` (o dono chama `registrarAtividade` no caso de uso):

| Ação (chave)                      | Texto                           | Módulo        | Sensível | Caso de uso dono                              |
| --------------------------------- | ------------------------------- | ------------- | -------- | --------------------------------------------- |
| `alterou-valor`                   | Alterou valor                   | Planos        | sim      | alterar valor do plano (T15a)                 |
| `alterou-permissao`               | Alterou permissão               | Permissões    | sim      | editar tipo de acesso (T26b)                  |
| `cadastrou-aluno`                 | Cadastrou aluno                 | Alunos        | não      | cadastrar aluno (T15a)                        |
| `enviou-cobranca-em-lote`         | Enviou cobrança em lote         | Alunos        | não      | cobrança em lote (T19)                        |
| `registrou-pagamento`             | Registrou pagamento             | Financeiro    | não      | baixa no balcão (T19)                         |
| `estornou-pagamento`              | Estornou pagamento              | Financeiro    | sim      | estornar (T19)                                |
| `combinou-nova-data`              | Combinou nova data              | Financeiro    | não      | combinar nova data (T19)                      |
| `trocou-forma-de-pagamento`       | Trocou forma de pagamento       | Financeiro    | não      | troca da forma de pagamento (T19)             |
| `alterou-configuracao-financeira` | Alterou configuração financeira | Configurações | sim      | tolerância e contratos (T26c)                 |
| `editou-ficha-de-treino`          | Editou ficha de treino          | Treinos       | não      | editar ficha (T25)                            |
| `excluiu-aluno`                   | Excluiu aluno                   | Alunos        | sim      | excluir aluno (T15a)                          |
| `trocou-cor-do-app`               | Trocou a cor do app             | Configurações | não      | `PUT /tenant/identidade` (T12, T26c)          |
| `cadastrou-funcionario`           | Cadastrou funcionário           | Equipe        | não      | cadastrar funcionário (T26a)                  |
| `editou-funcionario`              | Editou funcionário              | Equipe        | não      | editar ou inativar funcionário (T26a)         |
| `alterou-custo-de-funcionario`    | Alterou custo de funcionário    | Equipe        | sim      | alterar o custo mensal (T26a)                 |
| `alterou-acesso-de-funcionario`   | Alterou acesso de funcionário   | Equipe        | sim      | dar, trocar ou tirar o acesso (T26a)          |
| `excluiu-funcionario`             | Excluiu funcionário             | Equipe        | sim      | excluir funcionário (T26a)                    |
| `enviou-comunicado`               | Enviou comunicado               | Alunos        | não      | comunicado manual (T13e)                      |
| `conectou-integracao`             | Conectou integração             | Configurações | sim      | conectar Instagram, Facebook, WhatsApp (T13d) |
| `desconectou-integracao`          | Desconectou integração          | Configurações | sim      | desconectar um canal da Meta (T13d)           |
| `liberou-acesso-manual`           | Liberou acesso manual           | Acesso        | sim      | liberação manual da Recepção (T23a)           |
| `registrou-check-in`              | Registrou check-in              | Acesso        | não      | check-in da Recepção (T23a)                   |
| `alterou-regras-de-acesso`        | Alterou regras de acesso        | Configurações | sim      | regras de acesso da catraca (T23a)            |
| `alterou-alertas-de-frequencia`   | Alterou alertas de frequência   | Configurações | não      | alertas de frequência (T23a)                  |
| `gerou-codigo-de-pareamento`      | Gerou código de pareamento      | Configurações | não      | código do agente da catraca (T23b)            |
| `revogou-agente-da-catraca`       | Revogou agente da catraca       | Configurações | sim      | revogar a credencial do agente (T23b)         |
| `alterou-dispositivo`             | Alterou dispositivo             | Configurações | não      | cadastro de catraca ou leitor (T23b)          |
| `cadastrou-biometria`             | Cadastrou biometria             | Acesso        | sim      | cadastro de face ou digital (T23b)            |
| `tentativa-negada`                | Tentativa negada                | da permissão  | sim      | gancho `aoNegarPermissao` (T13b)              |

### Alunos, planos e contratos

`modules/alunos` (T15a, ADR-018). As regras puras ficam em `domain/contrato.ts`, `domain/plano.ts` e
`domain/datas.ts`; os casos de uso, em `Alunos`, `Planos`, `Contratos` e `ImportarAlunos`.

```
diasDeAtraso 0 → ativo · 1..T−1 → tolerancia ("encerra em T − dias") · ≥ T → encerrado (vencimento + T)
pagamento até R dias depois do encerramento → reativa o mesmo contrato · depois → nova adesão
trancado → não entra em tolerância; trancar N dias estende a vigência em N dias
```

- **Vigência**: `fimDaVigencia(inicio, meses)` é o dia anterior ao mesmo dia N meses depois (dia
  inexistente vai para o último dia do mês); vale até 23:59:59 de São Paulo (`fimDoDiaEm`).
- **Atraso e vencimento**: o contrato guarda `vencimentoEmAtraso` (parcela a receber vencida mais
  antiga) e `proximoVencimento`. Os consumidores `alunos.reavaliar-contrato-*` (`PagamentoConfirmado`,
  `PagamentoAtrasado`, `PagamentoEstornado` e `VencimentoCombinado`) os atualizam pela porta
  `ParcelasDoContrato`, que lê as parcelas da Cobrança; contrato sem parcelas usa o que o evento
  informa. `diasDeAtraso` é da Cobrança (`cobranca/domain/parcela.ts`).
- **Situação de vencimento** (lista e chips): `em_atraso` com `diasDeAtraso > 0`, `a_vencer` com a
  próxima parcela em até 7 dias (inclusive), senão `em_dia`. Aluno sem contrato fica em dia.
- **Rotina diária** (`RotinaDosContratos`, só com `FILAS_PROCESSAR`): renovação automática no fim da
  vigência e as transições pelo tempo, com os eventos `Contrato*`.
- **Login do aluno**: `LocalizadorDeAlunoPeloIndiceCego` acha o aluno pelo `cpf_hash` ou `email_hash`;
  a credencial do app não guarda e-mail em claro (o código de primeiro acesso nasce sem e-mail).
- **Configuração** "Contratos e atraso": `GET/PUT /api/configuracoes/contratos` (T, R e trancamento
  máximo; padrões 7, 30 e 90 dias).

### Funcionários (equipe)

`modules/funcionarios` (T26a). O cadastro da equipe vive aqui; o login do painel continua no T12 (`Usuario`).

- **Acesso**: `tipoDeAcessoId` nulo (ou o tipo padrão "Sem acesso") é só cadastro, sem e-mail obrigatório.
  Com tipo, o e-mail de login é obrigatório; o cadastro cria o `Usuario` sem senha e envia o convite do T12
  (`ConvidarParaEquipe`). Aceitar o convite só define a senha desse usuário. Voltar para "Sem acesso" ou
  inativar desativa o usuário e revoga as sessões; religar reativa o mesmo `Usuario` (`usuarioId` fica
  guardado). O e-mail de quem já teve acesso não muda.
- **Idempotência**: `criarSeNaoExistir` (Passo 3, `POST /api/funcionarios/convites`) devolve o funcionário
  que já tem o e-mail, sem novo convite. `POST /api/funcionarios` recusa e-mail repetido com 409.
- **Cargos** em `domain/funcionario.ts` (Professor, Recepção, Nutricionista, Limpeza, Manutenção,
  Administrativo, Gerente, Outro com descrição). Os contadores da tela Equipe são `todos` mais um por chip;
  Gerente e Outro só entram em `todos`.
- **Excluir** só sem vínculos: cada domínio registra uma `FonteDeVinculos` no `RegistroDeVinculos` (hoje, o
  professor responsável do aluno; o T28 acrescenta as aulas). Com vínculo, 409: inative.
- **Consumidores**: `GET /api/funcionarios/custos` (folha dos ativos, `financeiro:ver`, T21) e
  `GET /api/funcionarios/profissionais` (professores e nutricionistas ativos ou um cargo, qualquer sessão da
  equipe, T28 e T30a a T30c); em processo, `Funcionarios.custoDaEquipe()` e `profissionais()`.
- **Permissões**: `equipe:ver|criar|editar|excluir`. Alterar custo e acesso são ações sensíveis da auditoria.
- **LGPD**: o provedor `funcionarios` exporta o professor responsável do aluno e não tem o que excluir.

### Treinos

`modules/treinos` (T25). Regras puras em `domain/ficha.ts`; casos de uso na classe `Treinos`.

```
GeradorIA (sem nome nem CPF) ─▶ ficha "aguardando_aprovacao" ─ aprovar ─▶ ativa (professor e data) ─▶ aviso "Ficha atualizada"
ativa com validaAte < hoje → "vencida" (derivada, não guardada) · aluno (app) só enxerga a ativa dentro da validade
```

- **Tabelas**: `exercicio_de_treino`, `modelo_de_treino`, `ficha_de_treino` e `execucao_de_treino`. Treinos e exercícios de uma
  ficha ou modelo ficam em JSON (`treinos`, na ordem de execução: reordenar é gravar a nova ordem); as restrições da
  ficha são dado de saúde (cifradas, cada leitura no log de acesso).
- **Situações guardadas**: `rascunho`, `aguardando_aprovacao`, `ativa`, `recusada` e `arquivada` (a ativa trocada por outra). Aprovar
  ativa a ficha, registra quem aprovou e quando (validade padrão de 90 dias, se vazia), arquiva a ativa anterior e avisa o aluno.
- **Janelas de validade**: "Vencem em 30 dias" conta a ficha ativa que vence em até 30 dias (31 não entra); a tabela mostra o
  chip "Vence em N dias" até 31 (`venceEmDias`). "Avisar alunos" notifica quem está na janela de 30 dias.
- **IA**: `pedidoDeGeracao` leva só objetivo, nível, frequência, divisão e restrições. O provedor devolve texto livre; a ficha
  nasce com os treinos de partida da divisão e o professor revisa. Com o adapter fake, os exercícios vêm do desenho padrão.
- **Endpoints** (tag `treinos`): `GET /treinos/fichas` (KPIs, tabela e sugeridas), `POST /treinos/fichas/:id/aprovar|recusar`,
  `POST /treinos/fichas/avisar-vencimentos`, `GET /treinos/pendencias` (provedor "Ficha de treino para aprovar" do Início),
  `GET|PUT /treinos/alunos/:id/ficha`, `POST /treinos/alunos/:id/ficha/gerar-com-ia`, `GET /treinos/alunos/:id/acompanhamento`
  (carga, esforço e resumo da ficha, para o Acompanhamento do T16), `GET|POST|PUT /treinos/exercicios` e `/treinos/modelos`,
  `POST /treinos/modelos/:id/usar`. App do aluno (T33): `GET /app/treino`, `POST /app/treino/execucoes` (carga e esforço de 0 a 10)
  e `GET /app/treino/evolucao`.
- **Evolução de carga**: último registro menos o primeiro no período ("+8 kg em 6 semanas"), por exercício, os três com mais registros.
- **Permissões**: `treinos:ver|criar|editar`; aprovar, salvar e avisar exigem `editar`, gerar com IA e usar modelo exigem `criar`.
- **LGPD**: o provedor `treinos` exporta fichas (restrições reveladas) e execuções, e a exclusão apaga tudo (sem guarda legal).

### Cobrança e pagamentos

`modules/cobranca` (T19, ADR-009 e ADR-018). Regras puras em `domain/parcela.ts` e
`domain/pagamento.ts`; casos de uso em `Parcelas` e `Pagamentos`.

```
ContratoCriado/Renovado ─ ratear ─▶ parcelas (vencimento mensal no dia do início; dia inexistente → último)
em_aberto ─ 00:05 SP, vencida ─▶ atrasada + PagamentoAtrasado · trancado → suspensa · destrancado → reprogramada
link/2ª via ─ GatewayDePagamento ─▶ cobrança + CobrancaCriada ─ webhook assinado ─▶ PagamentoConfirmado
balcão ─ trava a parcela (FOR UPDATE) ─▶ PagamentoConfirmado · parcela já quitada → pagamento em duplicidade
```

- **`diasDeAtraso(vencimento, hoje)`**: dias corridos no calendário de São Paulo; única fonte do atraso.
- **Pagamento**: valor, forma, taxa, `origem` (`mensalidade`, `plano`, `aula_avulsa`, `personal`,
  `nutricao`, `loja`) e o `setor` atribuído pela origem. Menor que o saldo fica "pago parcial".
- **Provedor**: só o fake (`PAGAMENTOS_PROVEDOR=fake`). Webhook em `/api/webhooks/pagamentos-fake`,
  HMAC-SHA256 do corpo em `x-assinatura` (`PAGAMENTOS_WEBHOOK_SEGREDO`); sem assinatura, 401.
  Idempotente pelo id do evento do provedor. A página simulada fica em
  `/api/pagamento-simulado/:idExterno` (fora de produção).
- **Mensageria** (`{link}`, cobrança em lote): usa a `Mensageria` da plataforma (T13d); o `{link}` é a página da
  cobrança pendente da parcela a receber mais antiga (`VariavelLinkDePagamento`).
- **Pendências** (T18): `GET /api/cobranca/pendencias` ("Mensalidade em atraso" e pagamentos em
  duplicidade a estornar).
- **LGPD**: pagamentos têm retenção fiscal (5 anos): a exclusão anonimiza e cancela o que estava a receber.

### Avisos e notificações

`modules/avisos` (T13e) é o único lugar que notifica: a caixa de avisos do aluno (tela `AlunoAvisos`) e o Web Push.
Aulas, Loja, Saúde, Cobrança e Treinos só chamam o `Notificador`; o app (T32 e T33) se inscreve e exibe.

**Como um domínio notifica.** O `AvisosModule` é global: injete o `Notificador` no caso de uso (ou no consumidor de
evento) e chame dentro da transação do tenant.

```ts
// aviso na caixa e, com push, Web Push depois do commit
await notificador.notificar({
  destinatario: { tipo: 'aluno', id: alunoId }, // 'funcionario': id do usuário do painel
  tipo: 'reserva', // plano | aula | reserva | ficha | comunicado | loja | saude
  titulo: 'Reserva confirmada',
  texto: 'Spinning, quarta 18h30, bike 12.',
  link: '/aulas', // caminho interno do app; endereço externo é recusado
  push: true,
});

// lembrete: agenda por fila; a chave agrupa os agendamentos do fato e repetir a chave substitui o pendente
const { id } = await notificador.notificarEm(umaHoraAntesDaAula, pedido, {
  chave: `aula:${reservaId}`,
});
await notificador.cancelarAgendamentos(`aula:${reservaId}`); // reserva cancelada
```

```
notificar ─▶ aviso (mesma transação) ─▶ PushSolicitado (outbox) ─ commit ─▶ consumidor avisos.enviar-push
                                                                            ├ preferência do tipo desligada → só o aviso
                                                                            ├ cada inscrição ─▶ WebPush.enviar
                                                                            └ 404 ou 410 → remove a inscrição
notificarEm ─▶ aviso_agendado (pendente) + job atrasado na fila notificacoes ─ na hora ─▶ notificar
```

- **Push só depois do commit**, pelo evento `PushSolicitado`; rollback do caso de uso leva o aviso e o push junto.
  Falha de um dispositivo (que não seja 404 ou 410) vai para o log e não falha o evento: o aviso já está na caixa.
  O push leva `tag = id do aviso`, então uma reentrega não duplica a notificação na tela.
- **Porta `WebPush`** com VAPID (`PUSH_TRANSPORTE=vapid`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; um par por
  ambiente) e adapter fake (`PUSH_TRANSPORTE=fake`, recusado em produção) com `expirar(endpoint)` e `falhar(endpoint)`.
  O servidor faz POST no endpoint informado pelo cliente: só aceita https com nome de domínio (nunca IP nem localhost).
- **Preferências**: por destinatário e tipo; sem linha, o push está ligado. Desligar cala só o push, o aviso continua na lista.
- **Agendamento**: o cancelamento marca o `aviso_agendado`; o job que chegar depois não faz nada. O job espera ao menos
  1 s (nunca corre antes do commit). Com `FILAS_PROCESSAR=false` o job fica na fila até um worker subir.
- **Endpoints do app** (sessão do aluno): `GET /api/app/avisos` (`naoLidos`, `limite`, `cursor`; devolve `naoLidos`),
  `GET /api/app/avisos/contador`, `POST /api/app/avisos/lidos`, `POST /api/app/avisos/:id/lido`,
  `GET` e `PUT /api/app/avisos/preferencias`, `GET /api/app/push/chave-publica`,
  `POST` e `DELETE /api/app/push/inscricoes` (corpo no formato de `PushSubscription.toJSON()`).
- **Comunicado manual**: `POST /api/avisos/comunicados` (`alunos:editar`, auditoria `enviou-comunicado`), para todos os
  alunos ou os de `alunoIds`; sem tela no painel (lacuna registrada no plano).
- **Conteúdo**: título até 120 e texto até 500 caracteres. Não ponha dado de saúde no texto: o push passa pelo
  provedor do navegador. O aviso do tipo `saude` deve só apontar para a tela.
- **LGPD**: o provedor `avisos` exporta avisos, dispositivos (sem as chaves) e preferências, e a exclusão apaga tudo.

### Acesso e frequência

`modules/acesso` (T23a, ADR-018) e o pacote puro `@gymos/shared-acesso` (`libs/shared/acesso`, `type:domain`), que a API
e o agente da catraca (T24a) usam com as mesmas regras. Dispositivos, pareamento e tempo real estão em "Dispositivos, agente da catraca e tempo real" (T23b).

```
pedido ─▶ contrato → atraso (ADR-018) → horário → modalidade → anti-passback → limite diário → semanal ─▶ liberado | tolerância | negado(motivo)
QR do app ─ emitirQr (Ed25519, 60 s, nonce) ─▶ catraca ou Recepção ─ verificarQr + nonce de uso único ─▶ regras
agente offline ─ validarQrOffline (chave pública + nonces locais) ─▶ guarda acessos ─ sincronização ─▶ API (deduplica por idDeOrigem)
```

- **Regras** (`avaliarAcesso`): a primeira negação encerra; a tolerância só vale se nenhuma regra negar; **saída nunca é
  barrada**. Quem chama traz os fatos (contrato, `diasDeAtraso`, plano, passagens liberadas); nada lê relógio nem banco.
- **Atraso (ADR-018)**: `diasDeAtraso` vem da Cobrança (o estado do contrato é avaliado por `Contratos.situacao`). Com
  "bloquear após N dias" (padrão 7), nega com `diasDeAtraso ≥ N − 1` e libera "na tolerância" de 1 a `N − 2`
  (N = 1 bloqueia a partir do 1º dia, nunca quem está em dia). Contrato Encerrado, Trancado ou ausente nega.
- **Horário** de funcionamento no fuso de São Paulo (padrão 5h às 23h; início inclusivo, fim exclusivo). **Limite por dia**
  conta cada entrada (sair e voltar é nova entrada); **anti-passback** nega nova entrada no mesmo dia sem saída;
  **acessos por semana** (segunda a domingo) contam **dias** com entrada. Modalidade (ex.: `Lutas`) só com plano que a inclui.
- **QR** `gq1.<kid>.<payload>.<assinatura>`: a assinatura cobre `gymos-qr-v1\n` mais o texto exato transmitido, sem campo de
  algoritmo; o payload só é lido depois de a assinatura valer; o `tenantId` assinado barra uso em outra academia; validade
  de 60 s (emissão até 5 s no futuro é tolerada). **Uso único**: o nonce entra em `qr_usado` com `UNIQUE (tenant, nonce)`
  e `ON CONFLICT DO NOTHING` (duas leituras simultâneas disputam o índice e só uma vence). A chave privada fica cifrada
  (T13c) em `chave_de_qr`; o agente baixa as públicas em `GET /api/agente/chaves-publicas` e guarda os nonces usados
  (`NoncesEmMemoria`) até sincronizar. Limite conhecido: dois agentes offline distintos aceitam o mesmo QR; a sincronização
  detecta o caso (`qrRepetidos`).
- **Registro**: `Acessos.registrar` (catraca online), `checkInDaRecepcao`, `liberarManualmente` (exige motivo; auditoria
  sensível), `registrarPorQr` (QR recusado vira acesso negado) e `sincronizar` (deduplica por `idDeOrigem`, ordena pelo
  horário de origem e não reavalia: a pessoa já passou). O evento `AcessoRegistrado` sai só na primeira gravação.
- **Alertas de frequência**: `GET/PUT /api/configuracoes/alertas` e o job `RotinaDosAlertas` (a cada 5 min vê, por tenant, se
  passou da hora configurada e ainda não verificou hoje; só com `FILAS_PROCESSAR`). `verificar` abre, escala (comum para
  urgente) e resolve alertas; `mensagemAoAluno` só envia com consentimento de marketing (`Consentimentos.elegivel`) e pelo
  `Notificador`.
- **Leituras**: `GET /api/acesso/frequencia/{checkins-de-hoje,por-horario,por-aluno,presencas-do-mes,alunos-em-risco}`. Em
  processo, `Frequencia` (check-ins de hoje e frequência por horário para o Início; `presencasDoMes` para o rateio do T21).
- **LGPD**: o provedor `acesso` exporta acessos e alertas do aluno e a exclusão apaga tudo (sem retenção legal).

### Integrações de plataforma (Meta, mensageria, IA e arquivos)

`modules/integracoes` (T13d, ADR-011 e ADR-012) é global e não depende de nenhum domínio de negócio: alunos, cobrança e
funcionários registram nele os seus dados. Cada porta tem adapter fake determinístico (os flags de ambiente só aceitam
`fake`; só o armazenamento aceita `s3`). Os testes dos domínios usam sempre os fakes.

**Conexões Meta** (`ConexoesMeta`, único dono das contas): `GET /api/integracoes/meta` (estado dos três canais) e, com
`configuracoes.redes-sociais:editar`, `POST /:canal/conectar` (devolve `urlDoFluxo`; o WhatsApp passa a "Verificação
pendente"), `POST /:canal/retorno` (`codigo` e `state` devolvidos pela Meta), `POST /:canal/concluir` ("Concluir conexão":
pergunta à Meta se a verificação terminou) e `DELETE /:canal`. Não passa pelo módulo Marketing.

- O `state` é `<tenant>.<canal>.<expira>.<HMAC>` (15 min): amarra o retorno ao tenant e ao canal.
- O token fica cifrado (`conexao_meta.token`, T13c) e nunca sai pela API. `RenovacaoDosTokensDaMeta` renova o que vence em
  até 7 dias (ao subir e a cada 24 h, só com `FILAS_PROCESSAR`); a Meta recusar a renovação marca "expirado".
- Fake: qualquer código vale; `verificacao-pendente` deixa o WhatsApp pendente até "Concluir conexão".

**Mensageria** (`Mensageria.enviar`): quem chama informa a finalidade e recebe o resultado, sem exceção para recusa.

```ts
const r = await mensageria.enviar({
  alunoId,
  finalidade: 'marketing', // 'transacional' | 'marketing'
  contexto: 'marketing', // catálogo de variáveis do T08 (padrão: cobranca; marketing não leva {link})
  modelo: 'Oi, {nome}! O {plano} vence em {vencimento}.',
  canal: 'whatsapp', // opcional: sem canal, WhatsApp conectado e senão e-mail
});
// { enviada: true, mensagemId, canal } | { enviada: false, mensagemId, motivo: 'sem_consentimento' | ... }
```

- `marketing` só vai com aceite (`Consentimentos.elegivel`, T13c); `transacional` sempre. A recusa, com o motivo, e a
  falha do provedor ficam gravadas em `mensagem` (estado `recusada` ou `falha`).
- E-mail delega à `EnvioDeEmail` do T12. O telefone nunca é gravado: só passa pelo transporte (`TransporteDeWhatsapp`).
- **Webhook** `POST /api/webhooks/whatsapp/:tenantSlug` (tenant sempre pelo caminho; não há rota por id externo), com
  `x-hub-signature-256: sha256=<HMAC do JSON>` (`MENSAGERIA_WEBHOOK_SEGREDO`). Corpos: `{ tipo: 'status', idExterno,
status: 'delivered' | 'read' | 'failed' }` e `{ tipo: 'resposta', de, texto }`. A resposta de número que não é de aluno
  da academia é ignorada; "SAIR" (qualquer caixa e pontuação) revoga o marketing; toda resposta publica `MensagemRecebida`.
- **Fonte de contatos e variáveis**: o domínio dono registra no `onModuleInit`:
  `diretorio.registrar(fonte)` (alunos: nome, telefone, e-mail, aluno por telefone) e
  `variaveis.registrar({ variavel: 'professor', valor: (alunoId) => ... })`. Hoje: alunos (`nome`, `plano`, `vencimento`,
  `valor`), funcionários (`professor`) e cobrança (`link`). Valor passado em `variaveis` vence o do provedor; variável sem
  dado vira texto vazio. `ResolvedorDeVariaveis.resolver(modelo, contexto, alunoId)` serve a quem só quer o texto.
- Dev: o fake guarda as mensagens em memória e `GET /api/integracoes/dev/mensagens` as lista (fora de produção).
- LGPD: o provedor `integracoes` exporta e apaga as mensagens do aluno.

**GeradorIA** (`gerar({ finalidade, instrucao, dados, formato })`): `formato` é `{ campo: 'texto' | 'lista' }` e o retorno traz
cada campo. Antes de sair para qualquer provedor, o pedido perde as chaves `nome`, `cpf`, `telefone`, `email` (e variantes)
em qualquer profundidade e tem CPF, telefone e e-mail trocados por `[removido]` nos textos. Nome no meio de um texto livre
não é detectável: o domínio não deve mandá-lo. Cada chamada grava `uso_de_ia` (finalidade, provedor, tokens estimados), sem
prompt nem resposta. O fake devolve texto determinístico do pedido e guarda o que recebeu (`pedidos`) para os testes.

**Armazenamento** (`Armazenamento.enviar | urlAssinada | remover`): toda chave é `tenant/<id>/<pasta>/<uuid>.<ext>` (o nome do
cliente não entra) e só se abre a chave do tenant do contexto. O upload confere tipo (JPEG, PNG, WebP, PDF e MP4), extensão,
primeiros bytes e tamanho (5 MB imagens, 10 MB PDF, 50 MB vídeo). URL de leitura assinada de 5 min por padrão (máximo 1 h).
HTTP: `POST /api/arquivos` (multipart `arquivo` e `pasta`), `GET /api/arquivos/url?chave=`, `DELETE /api/arquivos?chave=`.
`ARMAZENAMENTO=fake` guarda em memória e serve `/api/arquivos/baixar` (assinatura HMAC de chave e prazo);
`ARMAZENAMENTO=s3` usa o MinIO/S3 (`S3_*`) com URLs pré-assinadas SigV4 sem SDK e cria o bucket ao subir.

### Dispositivos, agente da catraca e tempo real

`modules/dispositivos` (T23b, ADR-010 e ADR-016). O agente local (T24a) é o único cliente das rotas `/api/agente/*`.

```
painel ─ POST /agentes-da-catraca/codigos ─▶ código de 6 caracteres (30 min, uma troca)
agente ─ POST /agente/pareamento ─▶ credencial ga1.<agenteId>.<segredo> (só o hash fica no banco)
agente ─ POST /agente/batimento (30 s) ─▶ dispositivos online · comandos pendentes · versão do cache
sem batimento por 90 s ─ RotinaDasQuedas (30 s) ─▶ offline + queda aberta + DispositivoMudouDeEstado
evento ─ consumidor ─ TempoRealPorTenant ─▶ canal tenant:<id>:acesso.ao-vivo ─▶ SSE (qualquer réplica)
```

- **Credencial do agente**: `AgenteGuard` (rotas `@Publica()` para o guard de sessão) confere `Authorization: Bearer` no tenant
  do Host; ausente, errada ou revogada é 401. Rotacionar (`POST /agente/credencial/rotacionar`) invalida a anterior na hora;
  revogar (`POST /agentes-da-catraca/:id/revogar`, sensível) corta o acesso e exige novo pareamento.
- **Código de pareamento**: alfabeto sem ambíguos, `UPDATE` condicional como ponto de decisão (vence quem chega primeiro),
  só o último código gerado vale. Aceita minúsculas e hífen (`4f7-92k`).
- **Contrato do agente** (OpenAPI, tag `agente`): `GET /agente/alunos-autorizados?desde&limite` (cache com versão, regras e a
  decisão de contrato e atraso por aluno), `GET /agente/chaves-publicas`, `GET /agente/dispositivos`, `POST /agente/acessos`
  (lote com `idDeOrigem`, `Acessos.sincronizar`), `POST /agente/batimento` e `POST /agente/comandos/:id/resposta`. Os dois
  endpoints do agente que eram do painel no T23a (`/acesso/sincronizacao` e `/acesso/chaves-publicas`) saíram de lá.
- **Cache de autorização**: `alteracao_do_cache_de_acesso` dá uma versão (sequência do banco) ao aluno afetado por cada evento
  de contrato ou pagamento e à linha `regras` (evento `RegrasDeAcessoAlteradas`). O agente guarda a `versao`, a envia como
  `desde` e só recebe o que mudou (`removido: true` apaga o aluno do cache). A carga completa (sem `desde`) semeia quem nunca
  mudou.
- **Dispositivos e quedas**: `online` na API é pelo último batimento (90 s). Cada queda grava `desde` (último sinal) e fecha com
  a duração quando o batimento volta; `GET /dispositivos/alertas` traz o texto pronto ("Catraca 2 ficou 4 minutos sem
  resposta às 07:12 e já voltou").
- **Testar conexão**: `POST /dispositivos/:id/testes` (ou `/agentes-da-catraca/:id/testes` no Passo 4) cria um comando `ping`;
  o agente o recebe no batimento e responde; a tela consulta `GET /agentes-da-catraca/testes/:comandoId` (aguardando, ok,
  falhou ou expirou em 60 s).
- **SSE** `GET /api/acesso/ao-vivo/stream` (`acesso:ver`): `@SemTransacao()` (sem transação por requisição) e Bearer no
  cabeçalho, então o cliente usa fetch com stream, não `EventSource`. Mensagens `tipo: acesso` e `tipo: dispositivo`, mais um
  evento `ping` a cada 25 s. A publicação sai de consumidores de evento (`AcessoRegistrado`, `DispositivoMudouDeEstado`), depois
  do commit; precisa de `FILAS_PROCESSAR=true` em alguma réplica.
- **Biometria**: `POST /acesso/cadastros-biometricos` exige o consentimento `biometria` (422 sem ele), manda o comando
  `cadastrar_biometria` ao agente e guarda só a referência devolvida; o template fica no equipamento. A exclusão do titular pede
  ao agente que apague o cadastro (`remover_biometria`) e dá versão nova ao aluno no cache.

### Configuração

A API valida as variáveis de ambiente com Zod em `apps/api/src/config/env.ts`. `main.ts` chama
`loadEnv(process.env)` antes de criar a aplicação; se faltar ou estiver inválida alguma variável, registra
a lista e encerra com código 1. Toda variável nova entra no schema e no `.env.example` no mesmo PR.
As variáveis já validadas chegam aos providers pelo token `ENV` (`config/env.module.ts`).

### Observabilidade

Em `apps/api/src/observabilidade/` (T02):

- **Logs**: JSON pelo pino (`nestjs-pino`); use o `Logger` do `@nestjs/common`. Todo log feito
  durante uma requisição leva o `correlationId`, que vem do cabeçalho `x-correlation-id` (o front o
  envia em cada requisição) ou é gerado, e volta no cabeçalho da resposta.
- **Saúde**: `/health/live` (processo de pé) e `/health/ready` (Postgres e Redis; 503 se algum
  falha), fora do prefixo `/api`.
- **Métricas**: `/metrics` no formato do Prometheus, fora do prefixo `/api` e só na rede interna;
  latência e erros 5xx por rota do Nest. Cada fila registra a contagem de jobs no `QueueMetrics`.
- **Sentry**: `instrument.ts` inicia antes do Nest; erros que não são `HttpException` vão com a tag
  `correlationId`, o `APP_ENV` como ambiente e o `SENTRY_RELEASE`. Sem `SENTRY_DSN`, desligado. Os
  eventos não levam dados pessoais.

No front, `@gymos/shared-ambiente` dá o banner DEV/STAGING, o interceptor do `x-correlation-id` e o
Sentry dos dois apps. Cada app tem `environment.dev.ts`, `environment.staging.ts` e
`environment.prod.ts`, trocados por `fileReplacements` nas configurações de build de mesmo nome.

## Agente da catraca

`apps/turnstile-agent` é um app Node próprio (ADR-016). No T01 existe só com build e teste; o núcleo
chega no T24a.

## Regras comuns de tela e de fatia vertical

O detalhe está no ticket "Regras comuns a toda tela e fatia vertical"; o essencial:

- Tela fiel ao HTML e ao PNG de `docs/design/telas/`; regressão visual só no front, com a API
  interceptada por fixture e baseline no HTML de referência (ADR-019).
- Toda tela tem os estados carregando, vazio, erro com "Tentar agora" e sem permissão.
- Tempo sempre pela porta `Relogio`; dinheiro em centavos e percentuais em pontos-base com
  `libs/shared/money`; dias de atraso sempre de `diasDeAtraso` (ADR-018).
- Cache e tempo real só por tenant; eventos tipados em `libs/shared/events` com consumidores
  idempotentes pelo outbox (ADR-007).
- Todo caso de uso que altera dado chama a auditoria; campos sensíveis usam a cifra e o índice cego
  (ADR-015); todo domínio com dado de aluno implementa exportação e exclusão do titular (LGPD).
- Listas grandes paginam por cursor no servidor; endpoints documentados no OpenAPI e regenerados em
  `libs/api-contracts` no mesmo PR.
