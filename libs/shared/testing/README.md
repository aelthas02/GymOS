# @gymos/shared-testing

Utilitários de teste para o Playwright (`apps/e2e`); não entra em nenhum bundle.

- **T10 · harness de teclado** (`teclado.ts`): simula o teclado virtual em dois modos (Android
  `resizes-content` e iOS) e confere se o campo focado e o botão principal ficam na área visível.
  A página de demonstração (`pagina-demo.ts`) executa o núcleo real do `appKeyboardSafe`. Guia de uso
  em [`CONTRIBUTING.md`](../../../CONTRIBUTING.md#teclado-virtual-em-formulários).
