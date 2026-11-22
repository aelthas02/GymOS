# @gymos/shared-pipes

Pipes puros de exibição (T08): `brl`, `cpf`, `cnpj`, `phone`, `percent`, `dateBr`, `relativeTime`,
`initials` e `statusLabel`. Datas sempre em `America/Sao_Paulo`. O modelo guarda o valor cru (CPF sem
pontuação, dinheiro em centavos, percentual em pontos-base); a formatação acontece só na exibição.

Os mesmos formatadores, sem Angular, saem por `@gymos/shared-pipes/formatadores` para o back
(exportação para o contador, mensagens). O lint proíbe `@angular/*` em `src/formatadores/`.

Dono: Agente 3. Testes com 100% de cobertura: `pnpm nx test shared-pipes`.
