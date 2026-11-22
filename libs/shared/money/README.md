# @gymos/shared-money

Dinheiro em centavos inteiros e percentuais em pontos-base inteiros (2,5% = 250), sem ponto flutuante
(T08). Usado pelo front e pelo back; não importa Angular.

- `Centavos` e `PontosBase`: inteiros com marca de tipo, criados por `centavos()` e `pontosBase()`.
- `somar`, `aplicarAliquota` (meio para cima, simétrico para negativos), `ratear` (resto na última
  parcela) e `ratearPorPeso` (maior resto).
- `formatarBrl`, `interpretarBrl` e `formatarPercentual`.

Dono: Agente 3. Testes com 100% de cobertura: `pnpm nx test shared-money`.
