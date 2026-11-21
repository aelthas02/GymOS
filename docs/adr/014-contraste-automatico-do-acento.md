# ADR-014: Cor de destaque com contraste automático

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T04

## Contexto

A cor de destaque `#22C98A` é configurável por academia (tela Identidade visual) e reflete no painel e
no app do aluno. As telas põem texto tinta sobre o acento; uma academia que escolha um azul escuro
quebraria o contraste AA.

## Decisão

O tema calcula a cor do texto sobre o acento (tinta ou branco, a que der contraste ≥ 4,5:1) e um tom
acessível do acento para texto sobre fundo claro.

## Alternativas consideradas

- **Restringir a paleta**: contraria a tela, que aceita Hex e RGB livres.
- **Avisar e deixar a academia decidir**: transfere para o cliente um problema de acessibilidade.

## Consequências

- `#22C98A` gera texto tinta e `#1E3A8A` gera texto branco, ambos ≥ 4,5:1 (primeiro teste do T04).
- O cálculo de contraste tem cobertura de 100% (T03).
