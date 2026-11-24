# @gymos/shared-forms

Formulários Angular.

- **T08:** os adaptadores `ValidatorFn` de `@gymos/shared-validation` (`Validadores`) e o dicionário
  único de mensagens de erro (`MENSAGENS_DE_ERRO`, `mensagemDeErro`).
- **Máscaras** (diretivas de `input`, ligadas ao formulário como `ControlValueAccessor`; o campo mostra
  o texto formatado e o `FormControl` guarda o valor cru): `appCpf`, `appCnpj` (aceita alfanumérico),
  `appTelefone`, `appCep`, `appBrl` (centavos), `appPercent` (pontos-base), `appDecimal`
  (`[appDecimalCasas]`), `appData` (`dd/MM/yyyy`), `appCompetencia` (`MM/yyyy`), `appHorario`
  (`HH:mm`) e o híbrido `appCpfOuEmail`. Cada uma define `inputmode`, `type`, `autocomplete` e
  `enterkeyhint`; atributo escrito no template vence o padrão. `appEmail`, `appSenha` (`="nova"`) e
  `appCodigo` só definem os atributos de teclado.
- **Utilitárias:** `appAutofocus`, `appTrim`, `appOnlyNumbers`, `appDebounceClick`
  (emite `appDebouncedClick`), `appClickOutside`.
- **Acesso:** `*appPermission="'alunos:excluir'"` e `*appFeatureFlag="'loja'"` removem o elemento do
  DOM. Dependem dos tokens `PERMISSION_CHECKER` e `FEATURE_FLAGS` (padrão: nega); as implementações
  vêm do T14 e do T32.
- **Erro:** `<app-field-error [control] [submitted] id>` e `[appErrorFor]` no campo (`aria-invalid`,
  `aria-describedby`); a mensagem só aparece após `touched` ou envio. `mensagemVisivel` serve ao
  `error` do `ui-field`.

Dono: Agente 3. Testes com 100% de cobertura: `pnpm nx test shared-forms`.
