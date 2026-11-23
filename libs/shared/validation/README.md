# @gymos/shared-validation

Validadores puros (T08), sem Angular, usados pelo front e pelo back: CPF, CNPJ (também o
alfanumérico), telefone BR, e-mail, CEP, mínimo e máximo, senha forte, intervalo de datas, competência
`MM/yyyy` e URL do YouTube. Cada função recebe o valor cru e devolve `boolean`; os adaptadores
`ValidatorFn` ficam em `@gymos/shared-forms`.

Dono: Agente 3. Testes com 100% de cobertura: `pnpm nx test shared-validation`.
