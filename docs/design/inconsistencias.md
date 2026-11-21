# Inconsistências entre telas

Registro das divergências encontradas entre as telas do protótipo (ou entre uma tela e uma regra de
negócio) e da decisão tomada. Mantido pelo Agente 10 (Qualidade). As demais pastas de `docs/design/`
são a referência visual copiada do protótipo e não devem ser alteradas.

Regra (ADR-019): o fixture de cada tela reproduz a própria tela; as regras de negócio não se curvam ao
fixture. Cada linha aponta a tela, o que diverge e o que foi decidido.

## Como registrar

- **Tela**: nome do arquivo em `telas/html/` (por exemplo `Alunos.html`); se envolver mais de uma, liste todas.
- **Divergência**: o que uma tela mostra e o que a outra (ou a regra) diz, com os valores exatos.
- **Decisão**: o que o seed, o fixture e a regra fazem, e quem decidiu (ticket ou PR).

## Registro

| Tela | Divergência | Decisão |
| ---- | ----------- | ------- |
