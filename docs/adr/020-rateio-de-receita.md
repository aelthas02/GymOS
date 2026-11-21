# ADR-020: Rateio de receita

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T21

## Contexto

As visões Setores, Aulas e Funcionários do Financeiro exigem a divisão e é cálculo financeiro com 100%
de cobertura.

## Decisão

Receita de plano distribuída pelas presenças do aluno no mês (musculação, aula, professor) pelo maior
resto; sem presença, 100% no setor do plano; personal e nutrição diretos ao profissional.

## Alternativas consideradas

- **Divisão igual entre os setores do plano**: ignora o uso real e não fecha com as visões por aula e
  por professor.
- **Arredondar cada parte isoladamente**: a soma das partes pode não bater com a receita em centavos;
  o maior resto garante a soma exata.

## Consequências

- Valores em centavos com as funções de `libs/shared/money` (T08); o rateio tem cobertura de 100%.
