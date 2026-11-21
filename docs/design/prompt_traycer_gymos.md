# PROMPT TRAYCER — GymOS (SaaS multi-tenant de gestão de academias)

> Anexe ao Traycer, como fonte da verdade visual: as capturas/arquivos das telas do protótipo (canvas "GymOS: telas da equipe e do aluno", arquivos `.dc.html`). Onde este prompt e as telas divergirem, **as telas vencem** para UI e este prompt vence para arquitetura e qualidade.

---

## 1. Objetivo

Construir o **GymOS**: sistema de gestão para academias, vendido como SaaS multi-tenant, com um **sistema base** e **módulos extras opcionais** que cada academia liga ou desliga. Há dois frontends: o **painel da equipe** (desktop e tablet) e o **app do aluno** (mobile, PWA). O resultado deve ser fiel às telas do protótipo, rápido, testado e organizado.

Idioma da interface: **português do Brasil**. Moeda BRL, datas `dd/MM/yyyy`, fuso `America/Sao_Paulo`.

## 2. Escopo funcional (resumo das telas existentes)

**Sistema base**
- Entrar e primeiros passos (assistente de configuração da academia nova: dados, planos, importar alunos por planilha, equipe).
- Início (dashboard), Recepção, Alunos (lista, ficha, acompanhamento, ações em lote, importação), Planos (com parcelas), Financeiro (visão geral + "Visualizar por": setores, funcionários, alunos, aulas, planos, forma de pagamento, **notas fiscais** + tela **Emitir nota**), CRM e vendas, Acesso e frequência (ao vivo, histórico, catraca), Treinos (fichas, modelos, biblioteca), Relatórios, Equipe, Permissões, Configurações (identidade visual, redes sociais e WhatsApp, alertas de frequência, dados fiscais, catraca, contratos e atraso, senha).
- Tutorial por tela (botão "?" com contornos numerados e resumo).

**Módulos extras** (cada um com aba própria "Configurações")
- **Aulas**: grade semanal, aulas cadastradas, reservas e presença, lista de espera, toggle de notificação 15 min antes.
- **Marketing**: publicar no Instagram/Facebook/WhatsApp, mensagens, grupos de WhatsApp, calendário e resultados.
- **Loja**: produtos, categorias, pedidos e estoque.
- **Saúde**: nutrição (agenda com consultas, canceladas e faltas), avaliações físicas, personal trainer.

**App do aluno**: login, início, treino, aulas, plano, loja, mais, desempenho, saúde, avisos.

**Notas fiscais**: NFS-e (mensalidades) e NFC-e (Loja) via **emissor fiscal terceirizado por API** (porta/adapter, nunca acoplado a um fornecedor). Fluxo: emitir manual, emissão automática ao confirmar pagamento, reenviar, corrigir rejeitadas, cancelar, exportar para o contador.

## 3. Stack alvo (ajustável pelo Traycer, justificando no plano)

- **Monorepo** (Nx ou pnpm workspaces + Turborepo): `apps/staff-web`, `apps/student-app`, `apps/api`, `libs/ui`, `libs/shared`, `libs/api-contracts`.
- **Frontend**: Angular (versão estável mais recente), componentes **standalone**, **signals**, control flow nativo (`@if`, `@for`), `OnPush` em tudo, rotas com **lazy loading** por módulo (cada módulo extra é um chunk separado), SSR/prerender apenas onde ajudar (login e páginas públicas). App do aluno como **PWA** instalável.
- **Backend**: Node + NestJS, PostgreSQL, Prisma ou TypeORM, Redis (cache e filas), filas para tarefas assíncronas (cobrança, notas fiscais, mensagens). **Multi-tenant** com `tenant_id` em todas as tabelas e **Row-Level Security** no Postgres.
- **Contrato único**: OpenAPI gerado pela API, cliente tipado gerado para os dois frontends (nada de tipos duplicados à mão).
- **Auth**: JWT de acesso curto + refresh em cookie `HttpOnly`/`Secure`/`SameSite`, RBAC por permissão (tela Permissões) e **feature flags por tenant** (módulos extras ligados por plano contratado).
- **Observabilidade**: logs estruturados, `correlationId`, Sentry (front e back), métricas e health checks.

## 4. Ambientes (dev, staging, prod)

- Três ambientes isolados: **dev** (local, `docker compose` com Postgres, Redis e emissor fiscal em sandbox), **staging** (espelho da produção, dados sintéticos, emissor em homologação) e **prod**.
- Configuração por variáveis de ambiente validadas na inicialização (schema com Zod/Joi); o app **não sobe** se faltar variável. Nada de segredo no repositório; `.env.example` completo.
- No front: `environment.dev.ts`, `environment.staging.ts`, `environment.prod.ts` com `fileReplacements`; build por configuração (`ng build -c staging`).
- **CI/CD** (GitHub Actions): PR roda lint, testes, build e Lighthouse CI; merge na `main` publica em **staging** automaticamente; promoção para **prod** com aprovação manual e tag de versão. Migrações de banco versionadas e executadas no pipeline, com rollback documentado.
- Banners discretos "STAGING" e "DEV" na UI (nunca em prod).

## 5. Regras de frontend (fidelidade às telas)

**5.1 Fidelidade visual**
- Reproduza **exatamente** as telas anexadas: espaçamentos, raios, bordas, tipografia, hierarquia, estados vazios, estados de erro, badges e ícones. Não "melhore" o design.
- **Design tokens** em um único lugar (CSS custom properties + tipagem): tinta `#0C1722`, texto secundário `#4A5A6B`, borda `#D5DDD8`, fundo `#F3F5F2`, cor de destaque `#22C98A` (a cor de destaque é **configurável por academia** na tela Identidade visual e deve refletir no painel e no app do aluno), laranja de tutorial `#F57C00`; fonte **Inter** (self-hosted, `font-display: swap`, subset latino).
- Badges de situação: ok (verde), late (vermelho), soon (amarelo), off (cinza). Padronize em um componente.
- Biblioteca de componentes própria em `libs/ui` (Button, IconButton, Badge, Card, KPI, Table, Tabs, Toggle, Field, Select, Chips, BarChart, Donut, Sparkline, HorizontalBars, Modal, Toast, EmptyState, Skeleton). Cada tela é composição desses componentes.
- Gráficos leves (SVG próprio ou lib pequena com import sob demanda). Sem bibliotecas pesadas só para barras e linhas.

**5.2 Formulários: diretivas, máscaras, pipes**
- Diretivas reutilizáveis: máscara de CPF, CNPJ, telefone, CEP, moeda BRL, percentual, data, placa se houver; `appAutofocus`, `appTrim`, `appOnlyNumbers`, `appDebounceClick`, `appClickOutside`, `appPermission` (esconde por permissão), `appFeatureFlag` (esconde por módulo contratado).
- Validadores reutilizáveis: CPF, CNPJ, telefone, e-mail, valor mínimo/máximo, senha forte, datas coerentes.
- Pipes puros: `brl`, `cpf`, `cnpj`, `phone`, `percent`, `dateBr`, `relativeTime`, `initials`, `statusLabel`. Formatação **na exibição**, valor cru no modelo (CPF sem pontuação, dinheiro em centavos inteiros).
- Erros de campo aparecem ao sair do campo (`touched`) e ao enviar, com mensagem curta em português, ligada ao campo por `aria-describedby`.

**5.2.1 Teclado mobile e tablet (obrigatório)**
- Use o `inputmode` e o `type` corretos em cada campo: `inputmode="numeric"` para CPF, CNPJ, CEP, código e valores inteiros; `inputmode="decimal"` para dinheiro e medidas; `type="tel"` para telefone; `type="email"` com `autocomplete="email"`; `autocomplete` adequado em todos (`name`, `current-password`, `new-password`, `one-time-code`, `street-address`...). `enterkeyhint` coerente (`next`, `done`, `search`, `send`).
- Desative `autocapitalize`/`autocorrect`/`spellcheck` onde atrapalham (e-mail, CPF, senha, códigos).
- **Teclado nunca pode esconder o campo em edição nem o botão principal**: use `visualViewport` (e `interactive-widget=resizes-content` no meta viewport) para reposicionar; ao focar, role o campo para dentro da área visível (`scrollIntoView({block:'center'})` com pequeno atraso); botões de ação fixos no rodapé sobem junto com o teclado; use `100dvh` (nunca `100vh`) e `env(safe-area-inset-*)`. Crie um serviço `KeyboardAwareService` + diretiva `appKeyboardSafe` e **teste em iOS Safari e Android Chrome**, retrato e paisagem, em formulários longos (ex.: Emitir nota, Nova aula, Ficha do aluno, Configurações).
- Alvos de toque de pelo menos 44×44 px; sem hover como única forma de ação; no tablet, layout intermediário (sidebar recolhida, tabelas com rolagem controlada).

**5.3 Responsividade e estados**
- Painel: desktop (≥1280), tablet (768–1279) e mobile básico. App do aluno: mobile-first (390 px de referência) e funcional no tablet.
- Toda tela tem estados de **carregando** (skeleton), **vazio**, **erro com tentar novamente** e **sem permissão**.
- Tabelas: ordenação, paginação no servidor, virtualização quando passar de ~100 linhas visíveis.

**5.4 Acessibilidade**
- Navegação por teclado completa, foco visível, ordem de tab lógica, `aria-*` em tabs, modais, toggles e tabelas, contraste mínimo AA, `prefers-reduced-motion` respeitado. Meta: Lighthouse Acessibilidade ≥ 95.

**5.5 Tutorial por tela**
- Componente `TutorialOverlay` que desenha contornos laranja numerados sobre os blocos reais da tela, a partir de uma configuração por tela (ordem de importância, texto curto). Aberto pelo botão "?". Não duplicar telas.

## 6. Qualidade de código

- **Clean Code e SOLID** como critério de revisão. Funções pequenas, nomes claros, sem comentários que expliquem o óbvio, sem código morto, sem `any` (TypeScript `strict`, `noUncheckedIndexedAccess`).
- **Arquitetura front**: por feature (`features/alunos`, `features/financeiro`, `features/modulos/aulas`...), cada uma com `pages`, `components`, `data-access` (facades/stores com signals), `models`, `utils`. Componentes de apresentação ("burros") separados dos containers. Estado local com signals; estado compartilhado com store leve por feature (NgRx SignalStore ou equivalente). Sem lógica de negócio em componente.
- **Arquitetura back**: módulos por domínio (hexagonal): `domain` (entidades e regras), `application` (casos de uso), `infra` (banco, filas, integrações), `interface` (controllers, DTOs). Dependências apontam para dentro; integrações externas atrás de **portas** (emissor fiscal, WhatsApp, Instagram/Facebook, catraca, pagamentos).
- **Design patterns quando fizerem sentido, e só então**: Repository, Strategy (cálculo de cobrança, ordenação), Adapter (emissor fiscal, catraca), Factory, Observer/eventos de domínio (ex.: `PagamentoConfirmado` dispara emissão de nota), Facade nas stores. Não force padrão sem necessidade.
- **Dinheiro** sempre em centavos inteiros; datas em UTC no banco e fuso local na exibição; nunca `float` para valor.
- Lint e formatação (ESLint + Prettier), regras de import por camada (Nx `enforce-module-boundaries`), Husky + lint-staged, Conventional Commits.
- **LGPD**: dados de saúde e pessoais protegidos, consentimento registrado, log de acesso a dados sensíveis, exportação e exclusão de dados do titular, criptografia em repouso para campos sensíveis.

## 7. Performance e Lighthouse

- Metas (mobile, rede 4G simulada): **Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90** (páginas públicas), PWA válido no app do aluno. LCP < 2,5 s, CLS < 0,1, INP < 200 ms.
- Lazy loading por rota e por módulo extra, `@defer` para blocos abaixo da dobra (gráficos), `NgOptimizedImage`, imagens em AVIF/WebP com dimensões declaradas, fontes self-hosted com preload da principal.
- Orçamentos de bundle no build (`budgets`) que **falham o CI** se estourarem; análise de bundle no pipeline.
- `trackBy`/`track` em todas as listas, `OnPush`, sem funções no template, `computed` para derivados, cache HTTP e deduplicação de requisições, `service worker` com estratégia por tipo de recurso.
- Back: índices por `tenant_id` + colunas de busca, paginação por cursor em listas grandes, cache em Redis para dashboards, trabalho pesado em fila, compressão e `ETag`.
- **Lighthouse CI** no pipeline com limites mínimos acima; bloquear PR que regredir.

## 8. TDD e testes

- **Ciclo vermelho → verde → refatorar** em todo código novo: o teste vem antes da implementação. O plano de cada tarefa deve listar os testes que serão escritos primeiro.
- **Cobertura mínima**: 85% de linhas e 80% de branches no geral; **100% nos validadores, máscaras, pipes, cálculos financeiros e regras de domínio**. CI falha abaixo disso.
- Front: Jest ou Vitest + Angular Testing Library; testes de diretivas (máscaras e inputmode), pipes, validadores, stores, componentes de `libs/ui` e páginas principais. Back: testes unitários de domínio e casos de uso (sem banco), testes de integração com Postgres em contêiner, testes de contrato da API.
- **E2E** (Playwright) nos fluxos críticos: login, primeiros passos, cadastrar aluno, cobrar, emitir nota, reservar aula no app do aluno, comprar na loja. Inclui execução em viewport mobile e tablet e verificação de que o teclado virtual não cobre o campo (emulação de viewport reduzido).
- **Regressão visual** (Playwright screenshots ou Storybook + Chromatic) comparando com as telas de referência anexadas.
- Dados de teste por factories; nunca depender de ordem entre testes; relógio e rede sempre controlados.

## 9. Agentes (máximo de 10)

Distribua o trabalho em **no máximo 10 agentes**, com donos claros e sem sobreposição. Cada agente escreve testes primeiro, entrega PR pequeno e segue este prompt. Proposta (o Traycer pode fundir, nunca ultrapassar 10):

1. **Arquiteto e Plataforma**: monorepo, convenções, lint, CI/CD, ambientes dev/staging/prod, Docker, observabilidade, orçamentos e Lighthouse CI.
2. **Design System (`libs/ui`)**: tokens, tema por tenant, todos os componentes base, Storybook, acessibilidade, regressão visual.
3. **Formulários e Utilitários**: diretivas, máscaras, pipes, validadores, `KeyboardAwareService`, inputmode por campo, testes em mobile e tablet.
4. **Backend Core**: multi-tenancy com RLS, auth, RBAC, feature flags por módulo, auditoria, LGPD, OpenAPI.
5. **Painel — Base 1**: Entrar, primeiros passos, Início, Recepção, Alunos (lista, ficha, acompanhamento, lote, importação), Planos.
6. **Painel — Base 2**: Financeiro completo (visões, cobrança, parcelas), **Notas fiscais e Emitir nota** (adapter do emissor), CRM, Relatórios.
7. **Painel — Operação**: Acesso e frequência (catraca), Treinos, Equipe, Permissões, Configurações (todas as seções), tutorial por tela.
8. **Módulos extras (painel)**: Aulas, Marketing, Loja e Saúde, cada um lazy e atrás de feature flag, com a respectiva aba Configurações.
9. **App do aluno (PWA)**: todas as telas mobile, instalação, offline básico, push, loja, aulas, saúde, desempenho.
10. **Qualidade e Segurança**: E2E, regressão visual, carga, revisão de segurança (OWASP), acessibilidade e auditoria final de Lighthouse e cobertura.

Ordem sugerida: 1 e 2 e 3 e 4 em paralelo → 5 e 6 e 7 → 8 e 9 → 10 contínuo.

## 10. Entregáveis e critérios de aceite

- Repositório rodando com `pnpm i && pnpm dev` (dev) e com pipelines verdes.
- Cada tela do protótipo implementada e conferida contra a imagem de referência (regressão visual aprovada).
- Todos os campos com máscara, `inputmode`, `autocomplete` e validação corretos; formulários longos testados sem o teclado cobrir campos ou botões em iOS e Android.
- Cobertura e metas de Lighthouse atingidas; orçamentos de bundle respeitados.
- Documentação curta: `README` (como rodar), `ARCHITECTURE.md` (camadas e decisões), `docs/adr/` (decisões importantes), `CONTRIBUTING.md` (TDD, commits, PR) e o `.env.example`.
- Dados de demonstração (seed) coerentes com as telas (ex.: Academia Ritmo, Paulo Reis, Pedro Almeida).

## 11. Antes de começar, o Traycer deve

1. Ler todas as telas anexadas e listar rotas, componentes e formulários encontrados.
2. Propor o plano por agente, com ordem, dependências e os primeiros testes de cada tarefa.
3. Apontar dúvidas ou decisões em aberto (stack, provedor de emissão fiscal, provedor de pagamento, hospedagem) **sem travar**: seguir com as premissas deste prompt e registrá-las em ADR.
4. Não inventar funcionalidades fora das telas; sugestões entram em uma lista separada para aprovação.
