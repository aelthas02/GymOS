# @gymos/shared-templates

Parser e validador das mensagens com variáveis (`{nome}`, `{plano}`, `{vencimento}`, `{professor}`,
`{valor}`, `{link}`), com catálogo por contexto: `cobranca` aceita `{link}`, `marketing` não (T08). O
resolvedor que busca os dados de cada aluno é do T13d. Não importa Angular.

Dono: Agente 3. Testes com 100% de cobertura: `pnpm nx test shared-templates`.
