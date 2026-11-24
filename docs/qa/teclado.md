# Roteiro manual: teclado virtual (T10)

O WebKit do Playwright não emula o teclado do iOS, então este roteiro em aparelho real é obrigatório
(iOS Safari e Android Chrome, aparelho próprio ou nuvem de dispositivos). Anexe as capturas ao PR.

## Telas

`FinEmitir`, `AulasGrade` (Nova aula), `AlunosFicha` e `Configuracoes`, no painel; o app do aluno nos
formulários que ele tiver. Repita em retrato e paisagem, no celular (390×844) e no tablet (820×1180).

## Passos (por tela e orientação)

1. Abra o formulário e role até o último campo.
2. Toque no último campo: o teclado abre. Confirme que o **campo em edição** está inteiro visível, sem
   ficar sob o teclado nem sob o rodapé de ação.
3. Confirme que o **botão principal** ("Salvar", "Emitir") continua visível, logo acima do teclado, e
   que o rodapé subiu **uma vez só** (sem espaço em branco duplicado nem sobreposição).
4. Toque em cada campo seguinte (ou use "Próximo" do teclado): cada um vai para o centro da área visível.
5. Feche o teclado (toque fora ou "OK"): o rodapé volta para a borda de baixo, sem salto.
6. Gire o aparelho com o teclado aberto e repita o passo 2.
7. Confira a área segura: em iPhone com entalhe, nada fica sob a barra inferior (`env(safe-area-inset-bottom)`).

## Registro

| Aparelho / navegador | Tela | Retrato | Paisagem | Captura |
| -------------------- | ---- | ------- | -------- | ------- |
|                      |      |         |          |         |

Falha: abra a tela com o dono dela e anexe a captura. Não "conserte" na diretiva sem reproduzir no
harness (`pnpm e2e teclado`).
