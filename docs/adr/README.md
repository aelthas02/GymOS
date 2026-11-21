# Decisões de arquitetura (ADRs)

Cada ADR registra contexto, decisão, alternativas e consequências. "Proposto" significa que o projeto
segue com a premissa registrada, atrás de uma porta trocável, até a decisão final.

| ADR                                          | Decisão                                                  | Status   |
| -------------------------------------------- | -------------------------------------------------------- | -------- |
| [001](001-nx-com-pnpm.md)                    | Nx como monorepo, com pnpm e Node 26                     | Aceito   |
| [002](002-angular-zoneless-signals.md)       | Angular zoneless, standalone, signals e NgRx SignalStore | Aceito   |
| [003](003-nestjs-hexagonal-prisma-rls.md)    | NestJS hexagonal, Prisma e RLS com `SET LOCAL`           | Aceito   |
| [004](004-tenant-por-subdominio.md)          | Tenant resolvido por subdomínio                          | Aceito   |
| [005](005-contrato-openapi.md)               | Contrato único com OpenAPI gerado pela API               | Aceito   |
| [006](006-autenticacao-rbac-flags.md)        | JWT curto, refresh rotativo, RBAC e flags por tenant     | Aceito   |
| [007](007-bullmq-e-outbox.md)                | BullMQ com outbox transacional                           | Aceito   |
| [008](008-porta-emissor-fiscal.md)           | Porta para o emissor fiscal                              | Proposto |
| [009](009-porta-pagamentos.md)               | Porta para pagamentos                                    | Proposto |
| [010](010-porta-catraca.md)                  | Porta para a catraca                                     | Proposto |
| [011](011-porta-meta.md)                     | Portas para WhatsApp, Instagram e Facebook               | Proposto |
| [012](012-porta-ia.md)                       | Porta para IA                                            | Proposto |
| [013](013-estrategia-de-testes.md)           | Vitest, Angular Testing Library e Playwright             | Aceito   |
| [014](014-contraste-automatico-do-acento.md) | Cor de destaque com contraste automático                 | Aceito   |
| [015](015-criptografia-de-campos.md)         | Criptografia de campos sensíveis na aplicação            | Aceito   |
| [016](016-agente-local-da-catraca.md)        | Agente local da catraca como app próprio                 | Aceito   |
| [017](017-hospedagem.md)                     | Hospedagem em contêineres no Brasil                      | Proposto |
| [018](018-fronteira-de-atraso.md)            | Fronteira de atraso                                      | Aceito   |
| [019](019-regressao-visual.md)               | Regressão visual                                         | Aceito   |
| [020](020-rateio-de-receita.md)              | Rateio de receita                                        | Aceito   |

Para uma decisão nova, copie a estrutura de um ADR existente com o próximo número e abra o PR com
revisão da Plataforma (CODEOWNERS).
